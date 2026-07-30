import { create } from "zustand";
import { track } from "@vercel/analytics";
import type { GCalEvent } from "../types";
import { addDaysISO } from "./time";
import { useStore } from "../store";

/** The week currently shown in the planner — the range the grid overlay fetches. */
const currentWeek = () => useStore.getState().currentWeekStart;

// Read-only Google Calendar, entirely client-side (§9). The connection is
// ACCOUNT-SCOPED: it's tied to the signed-in Weekflow account, tagged onto the
// stored token so one account never sees another's calendar, and it drops on
// sign-out. The short-lived token lives in sessionStorage (tab-scoped, cleared
// when the tab closes — never localStorage at rest) so a refresh reconnects the
// same account deterministically. A tiny per-account "was connected" flag also
// enables a best-effort silent GIS reconnect.

const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const CLIENT_ID_STORAGE_KEY = "weekflow-gcal-client-id";
const TOKEN_KEY = "weekflow-gcal-token"; // sessionStorage
const TOKEN_ACCT_KEY = "weekflow-gcal-token-acct"; // which account owns that token
const ENV_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any;

let accessToken: string | null = null;
// The signed-in Weekflow account the calendar connection belongs to. "" means
// no account (Supabase off, or connecting while logged out).
let currentAccount = "";

const autoKey = () => "weekflow-gcal-auto:" + currentAccount;

function ss(): Storage | null {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

function setToken(token: string) {
  accessToken = token;
  ss()?.setItem(TOKEN_KEY, token);
  ss()?.setItem(TOKEN_ACCT_KEY, currentAccount);
  try {
    localStorage.setItem(autoKey(), "1");
  } catch {
    /* ignore */
  }
}

// Suspend on sign-out: drop the live connection + hidden events, but KEEP the
// tab's stored token so re-logging into the SAME account restores it.
function suspendToken() {
  accessToken = null;
}

// Full teardown for an explicit Disconnect: forget the token and the per-account
// reconnect memory entirely.
function clearToken() {
  accessToken = null;
  ss()?.removeItem(TOKEN_KEY);
  ss()?.removeItem(TOKEN_ACCT_KEY);
  try {
    localStorage.removeItem(autoKey());
  } catch {
    /* ignore */
  }
}

/** Run cb once the GIS script has loaded (it's async in index.html). */
function whenGoogleReady(cb: () => void, onFail?: () => void, tries = 0) {
  if (typeof google !== "undefined" && google.accounts?.oauth2) return cb();
  if (tries > 40) return onFail?.(); // ~10s
  setTimeout(() => whenGoogleReady(cb, onFail, tries + 1), 250);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEvents(items: any[]): GCalEvent[] {
  return (items || []).map((ev) => ({
    id: ev.id,
    summary: ev.summary || "(untitled)",
    start: ev.start?.dateTime || ev.start?.date || "",
    end: ev.end?.dateTime || ev.end?.date || "",
    htmlLink: ev.htmlLink || "",
  }));
}

async function fetchRange(
  timeMin: string,
  timeMax: string,
  maxResults: number
): Promise<GCalEvent[]> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
      timeMin
    )}&timeMax=${encodeURIComponent(
      timeMax
    )}&singleEvents=true&orderBy=startTime&maxResults=${maxResults}`,
    { headers: { Authorization: "Bearer " + accessToken } }
  );
  if (!res.ok) {
    const err = new Error("Google Calendar request failed (" + res.status + ")");
    // @ts-expect-error tag status for expiry handling
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return mapEvents(data.items);
}

type GCalState = {
  clientId: string;
  connected: boolean;
  error: string;
  sidebarEvents: GCalEvent[] | null; // rolling next 7 days (sidebar card)
  gridEvents: GCalEvent[]; // visible week ± 1 week buffer (timeline overlay)
  lastSyncAt: number | null;
  setClientIdFromInput: (val: string) => void;
  resetClientId: () => void;
  connect: (weekStart: string) => void;
  tryAutoConnect: () => void;
  disconnect: () => void;
  adoptToken: (token: string, weekStart: string) => void;
  setAccount: (id: string) => void;
  suspend: () => void;
  refreshSidebar: () => Promise<void>;
  refreshGrid: (weekStart: string) => Promise<void>;
};

export const useGCal = create<GCalState>((set, get) => ({
  clientId: ENV_CLIENT_ID || localStorage.getItem(CLIENT_ID_STORAGE_KEY) || "",
  connected: false,
  error: "",
  sidebarEvents: null,
  gridEvents: [],
  lastSyncAt: null,

  setClientIdFromInput: (val) => {
    const v = val.trim();
    if (!v) return;
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, v);
    set({ clientId: v });
  },

  resetClientId: () => {
    localStorage.removeItem(CLIENT_ID_STORAGE_KEY);
    clearToken();
    set({
      clientId: ENV_CLIENT_ID || "",
      connected: false,
      sidebarEvents: null,
      gridEvents: [],
      error: "",
    });
  },

  refreshSidebar: async () => {
    if (!accessToken) return;
    try {
      const timeMin = new Date().toISOString();
      const timeMax = new Date(Date.now() + 7 * 864e5).toISOString();
      const events = await fetchRange(timeMin, timeMax, 10);
      set({ sidebarEvents: events, error: "", lastSyncAt: Date.now() });
    } catch (e) {
      handleFetchError(e, set);
    }
  },

  refreshGrid: async (weekStart) => {
    if (!accessToken) return;
    try {
      // visible week plus a one-week buffer on either side (§18b)
      const timeMin = new Date(addDaysISO(weekStart, -7) + "T00:00:00").toISOString();
      const timeMax = new Date(addDaysISO(weekStart, 14) + "T00:00:00").toISOString();
      const events = await fetchRange(timeMin, timeMax, 100);
      set({ gridEvents: events, error: "", lastSyncAt: Date.now() });
    } catch (e) {
      handleFetchError(e, set);
    }
  },

  connect: (weekStart) => {
    const { clientId } = get();
    if (!clientId) return;
    set({ error: "" });
    whenGoogleReady(
      () => {
        const tc = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: GCAL_SCOPE,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          callback: (resp: any) => {
            if (resp.error) {
              set({ error: "Sign-in was cancelled or denied." });
              return;
            }
            setToken(resp.access_token);
            set({ connected: true, error: "" });
            track("gcal_connected");
            get().refreshSidebar();
            get().refreshGrid(weekStart);
          },
        });
        tc.requestAccessToken({ prompt: accessToken ? "" : "consent" });
      },
      () => set({ error: "Google sign-in script not loaded yet — try again in a moment." })
    );
  },

  // Reconnect for the CURRENT account only, and ONLY from this tab's stored
  // token if it belongs to this account — a genuinely silent path. We never
  // auto-invoke Google's token flow here: `requestAccessToken` always opens a
  // window (even with prompt:""), so triggering it on login is a surprise popup.
  // Without a valid stored token we simply leave the Connect button for a
  // deliberate click.
  tryAutoConnect: () => {
    if (accessToken) return;
    const store = ss();
    const stored = store?.getItem(TOKEN_KEY) ?? null;
    const storedAcct = store?.getItem(TOKEN_ACCT_KEY) ?? "";
    if (stored && storedAcct === currentAccount) {
      accessToken = stored;
      set({ connected: true, error: "" });
      get().refreshSidebar(); // a 401 here (expired) clears back to disconnected
      get().refreshGrid(currentWeek());
    }
  },

  disconnect: () => {
    if (accessToken && typeof google !== "undefined" && google.accounts?.oauth2) {
      google.accounts.oauth2.revoke(accessToken, () => {});
    }
    clearToken(); // full teardown incl. per-account reconnect memory
    set({ connected: false, sidebarEvents: null, gridEvents: [], error: "" });
  },

  // Reuse the Google access token handed back by Supabase's "Sign in with
  // Google" (session.provider_token) so the calendar connects in one step,
  // without a second OAuth popup. Short-lived and not refreshed by Supabase —
  // once it expires, the Connect button re-establishes it via GIS.
  adoptToken: (token, weekStart) => {
    setToken(token);
    set({ connected: true, error: "" });
    get().refreshSidebar();
    get().refreshGrid(weekStart);
  },

  // Sync tells us which account is signed in (or "" when signed out) so the
  // calendar connection is scoped to it.
  setAccount: (id) => {
    currentAccount = id;
  },

  // On sign-out: drop the live connection + hide events, but keep the tab's
  // stored token so re-logging into the SAME account restores it silently.
  suspend: () => {
    suspendToken();
    set({ connected: false, sidebarEvents: null, gridEvents: [], error: "" });
  },
}));

export type GCalDayItem = {
  id: string;
  title: string;
  start: number; // minutes from midnight, clamped to the day
  end: number;
};

/** GCal events that fall on `iso`, as timeline items in minutes-of-day.
 *  All-day (date-only) events are skipped here — they stay in the sidebar. */
export function gcalDayItems(events: GCalEvent[], iso: string): GCalDayItem[] {
  const dayStart = new Date(iso + "T00:00:00").getTime();
  const dayEnd = dayStart + 864e5;
  const out: GCalDayItem[] = [];
  for (const ev of events) {
    if (!ev.start.includes("T")) continue; // all-day → sidebar only
    const s = new Date(ev.start).getTime();
    const e = new Date(ev.end).getTime();
    if (isNaN(s) || isNaN(e)) continue;
    if (e <= dayStart || s >= dayEnd) continue; // not on this day
    const startMin = Math.max(0, Math.round((s - dayStart) / 60000));
    const endMin = Math.min(1440, Math.round((e - dayStart) / 60000));
    if (endMin <= startMin) continue;
    out.push({ id: ev.id, title: ev.summary, start: startMin, end: endMin });
  }
  return out;
}

// A failed fetch after connecting almost always means the token expired
// mid-session. Surface it visibly and drop to a reconnectable state (§17).
function handleFetchError(
  e: unknown,
  set: (partial: Partial<GCalState>) => void
) {
  const err = e as { status?: number; message?: string };
  if (err.status === 401 || err.status === 403) {
    clearToken();
    set({
      connected: false,
      error: "Google Calendar session expired — reconnect to refresh.",
    });
  } else {
    set({ error: err.message || "Could not load Google Calendar events." });
  }
}
