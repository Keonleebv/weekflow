import { useEffect, useState } from "react";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { supabase, supabaseEnabled, STATE_TABLE } from "./supabase";
import { useStore } from "../store";
import { useGCal } from "./gcal";

// User CONTENT is synced across devices. View/navigation state (which day/week
// is on screen) stays device-local so two open screens don't fight the cursor.
const SYNC_KEYS = [
  "categories",
  "blocks",
  "tasks",
  "journalEntries",
  "weeklyDigests",
  "onboarded",
] as const;

type StoreState = ReturnType<typeof useStore.getState>;
type SyncData = Pick<StoreState, (typeof SYNC_KEYS)[number]>;

function extract(): SyncData {
  const s = useStore.getState();
  return {
    categories: s.categories,
    blocks: s.blocks,
    tasks: s.tasks,
    journalEntries: s.journalEntries,
    weeklyDigests: s.weeklyDigests,
    onboarded: s.onboarded,
  };
}

// True while we're writing remote data into the store, so the store subscriber
// doesn't immediately push it straight back up (echo loop guard).
let applyingRemote = false;

// Wall-clock time of this device's last local content edit, persisted so it
// survives reloads. Compared against the cloud row's updated_at to decide, on
// login, which copy is more recent ("most-recently-edited wins").
const EDIT_KEY = "weekflow-edited-at";
function getLocalEditedAt(): number {
  return Number(localStorage.getItem(EDIT_KEY)) || 0;
}
function setLocalEditedAt(ms: number) {
  localStorage.setItem(EDIT_KEY, String(ms));
}

function applyRemote(data: Partial<SyncData>, remoteEditedAtMs: number) {
  applyingRemote = true;
  useStore.setState({
    categories: data.categories ?? [],
    blocks: data.blocks ?? [],
    tasks: data.tasks ?? [],
    journalEntries: data.journalEntries ?? {},
    weeklyDigests: data.weeklyDigests ?? {},
    onboarded: data.onboarded ?? true,
  });
  applyingRemote = false;
  // This device now holds the remote copy, timestamped as the remote was.
  setLocalEditedAt(remoteEditedAtMs);
}

let currentUserId: string | null = null;
let pushTimer: number | undefined;

function schedulePush() {
  if (!supabase || !currentUserId) return;
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(pushNow, 1200);
}

async function pushNow() {
  if (!supabase || !currentUserId) return;
  // Stamp the cloud row with the actual local edit time (not the push time), so
  // "most recent edit" comparisons across devices stay accurate.
  const editedAt = getLocalEditedAt() || Date.now();
  setLocalEditedAt(editedAt);
  const { error } = await supabase.from(STATE_TABLE).upsert({
    user_id: currentUserId,
    data: extract(),
    updated_at: new Date(editedAt).toISOString(),
  });
  if (error) console.error("weekflow sync push failed:", error.message);
}

// Ignore realtime events that just echo our own write (same content).
function realtimeApply(incoming: SyncData, remoteEditedAtMs: number) {
  if (JSON.stringify(incoming) === JSON.stringify(extract())) return;
  applyRemote(incoming, remoteEditedAtMs);
}

let channel: RealtimeChannel | null = null;

function subscribeRealtime(userId: string) {
  unsubscribeRealtime();
  if (!supabase) return;
  channel = supabase
    .channel(`weekflow-state-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: STATE_TABLE,
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new as {
          data?: SyncData;
          updated_at?: string;
        } | null;
        if (row?.data)
          realtimeApply(row.data, Date.parse(row.updated_at ?? "") || Date.now());
      }
    )
    .subscribe();
}

function unsubscribeRealtime() {
  if (channel && supabase) {
    supabase.removeChannel(channel);
    channel = null;
  }
}

// Which account the data currently in localStorage belongs to. Absent = the
// user has never logged in on this device (genuine anonymous local data).
const OWNER_KEY = "weekflow-owner";

async function onLogin(userId: string) {
  if (!supabase || currentUserId === userId) return;
  currentUserId = userId;
  const { data, error } = await supabase
    .from(STATE_TABLE)
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("weekflow sync load failed:", error.message);
    return;
  }

  // Is the local data actually this account's? It only is when the persisted
  // owner matches (e.g. a reload of an already-signed-in session). After a
  // logout we clear the owner, so a different account never treats the previous
  // account's leftover data as its own — the root of the cross-account leak.
  const owner = localStorage.getItem(OWNER_KEY);
  const localIsThisAccount = owner === userId;

  if (data) {
    const remoteMs = Date.parse((data.updated_at as string) ?? "") || 0;
    if (localIsThisAccount && getLocalEditedAt() > remoteMs) {
      await pushNow(); // same account, local edited more recently → keep local
    } else {
      applyRemote(data.data as SyncData, remoteMs); // adopt the cloud copy
    }
  } else if (owner == null) {
    await pushNow(); // genuine first-ever login → seed cloud from local data
  } else {
    // A different account with no cloud row yet — start clean, never push the
    // previous account's data into it.
    useStore.getState().resetForLogout();
    await pushNow();
  }

  localStorage.setItem(OWNER_KEY, userId);
  subscribeRealtime(userId);
}

function onLogout() {
  currentUserId = null;
  window.clearTimeout(pushTimer);
  unsubscribeRealtime();
  // Wipe this account's data locally so the next account starts clean.
  localStorage.removeItem(OWNER_KEY);
  localStorage.removeItem(EDIT_KEY);
  useStore.getState().resetForLogout();
}

let started = false;

/** Wire auth ↔ store sync. Safe no-op until Supabase keys are configured. */
export function initSync() {
  if (!supabaseEnabled || !supabase || started) return;
  started = true;

  // Push local content edits (debounced) up to the cloud.
  useStore.subscribe((state, prev) => {
    if (applyingRemote) return;
    const changed = SYNC_KEYS.some((k) => state[k] !== prev[k]);
    if (changed) {
      setLocalEditedAt(Date.now()); // this device just edited
      schedulePush();
    }
  });

  // Emits INITIAL_SESSION on load, then SIGNED_IN / SIGNED_OUT. Crucially, a
  // logged-out load fires INITIAL_SESSION with a null session — that is NOT a
  // sign-out and must not wipe a genuine anonymous user's local data. Only a
  // real SIGNED_OUT event clears local data.
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      onLogin(session.user.id);
      // If they signed in with Google (calendar scope granted), the session
      // carries a Google access token — connect the calendar in one step.
      // provider_token is only present right after the OAuth redirect, not on
      // a restored session, so a reload falls back to the Connect button.
      if (session.provider_token) {
        useGCal
          .getState()
          .adoptToken(session.provider_token, useStore.getState().currentWeekStart);
      }
    } else if (event === "SIGNED_OUT") {
      onLogout();
      // Google Calendar stays connected across Weekflow account switches — it's
      // a device-level connection to the user's Google account, not
      // Weekflow-account data (the schedule is, and that's reset above). Ending
      // it is an explicit choice via the sidebar's Disconnect button.
    }
  });
}

// ── Auth helpers + hook for the UI ─────────────────────────────────────────
type AuthResult = { error: string | null };

export async function signInWithGoogle(): Promise<AuthResult> {
  if (!supabase) return { error: "Cloud sync is not configured." };
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
      // Also request read-only calendar so the timeline auto-connects — one
      // handshake instead of a second popup.
      scopes: "https://www.googleapis.com/auth/calendar.readonly",
      queryParams: { access_type: "offline", include_granted_scopes: "true" },
    },
  });
  return { error: error?.message ?? null };
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  if (!supabase) return { error: "Cloud sync is not configured." };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error?.message ?? null };
}

export async function signUpWithEmail(
  email: string,
  password: string
): Promise<AuthResult & { needsConfirmation: boolean }> {
  if (!supabase)
    return { error: "Cloud sync is not configured.", needsConfirmation: false };
  const { data, error } = await supabase.auth.signUp({ email, password });
  // If a session came back, the user is already signed in (email confirmation
  // is off). Otherwise they must confirm via email before signing in.
  return {
    error: error?.message ?? null,
    needsConfirmation: !error && !data.session,
  };
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(supabaseEnabled);
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return {
    session,
    user: session?.user ?? null,
    loading,
    enabled: supabaseEnabled,
  };
}
