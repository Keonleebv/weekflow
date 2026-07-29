import { useEffect, useState } from "react";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { supabase, supabaseEnabled, STATE_TABLE } from "./supabase";
import { useStore } from "../store";

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

function applyRemote(data: Partial<SyncData>) {
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
  const { error } = await supabase.from(STATE_TABLE).upsert({
    user_id: currentUserId,
    data: extract(),
    updated_at: new Date().toISOString(),
  });
  if (error) console.error("weekflow sync push failed:", error.message);
}

// Ignore realtime events that just echo our own write (same content).
function realtimeApply(incoming: SyncData) {
  if (JSON.stringify(incoming) === JSON.stringify(extract())) return;
  applyRemote(incoming);
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
        const row = payload.new as { data?: SyncData } | null;
        if (row?.data) realtimeApply(row.data);
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

async function onLogin(userId: string) {
  if (!supabase || currentUserId === userId) return;
  currentUserId = userId;
  const { data, error } = await supabase
    .from(STATE_TABLE)
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("weekflow sync load failed:", error.message);
    return;
  }
  if (data?.data) {
    applyRemote(data.data as SyncData); // cloud is the shared truth
  } else {
    await pushNow(); // first-ever login → seed the cloud from local data
  }
  subscribeRealtime(userId);
}

function onLogout() {
  currentUserId = null;
  window.clearTimeout(pushTimer);
  unsubscribeRealtime();
  // Local data stays in localStorage so the logged-out app still works.
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
    if (changed) schedulePush();
  });

  // Emits INITIAL_SESSION on load (restored session) then SIGNED_IN/SIGNED_OUT.
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) onLogin(session.user.id);
    else onLogout();
  });
}

// ── Auth helpers + hook for the UI ─────────────────────────────────────────
type AuthResult = { error: string | null };

export async function signInWithGoogle(): Promise<AuthResult> {
  if (!supabase) return { error: "Cloud sync is not configured." };
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
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
): Promise<AuthResult> {
  if (!supabase) return { error: "Cloud sync is not configured." };
  const { error } = await supabase.auth.signUp({ email, password });
  return { error: error?.message ?? null };
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
