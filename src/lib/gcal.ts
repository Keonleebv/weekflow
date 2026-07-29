import { create } from "zustand";
import { track } from "@vercel/analytics";
import type { GCalEvent } from "../types";
import { addDaysISO } from "./time";
import { useStore } from "../store";

/** The week currently shown in the planner — the range the grid overlay fetches. */
const currentWeek = () => useStore.getState().currentWeekStart;

// Read-only Google Calendar, entirely client-side (§9). The token lives in
// memory only — never localStorage — so it clears on refresh. We DO persist a
// tiny boolean ("was connected"), which lets us ask Google for a fresh token
// silently on the next load (no popup) if the grant + Google session are still
// live — so a refresh no longer forces a manual reconnect.

const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const CLIENT_ID_STORAGE_KEY = "weekflow-gcal-client-id";
const AUTO_KEY = "weekflow-gcal-auto"; // "1" once connected; enables silent reconnect
const ENV_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any;

let accessToken: string | null = null;

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
    localStorage.removeItem(AUTO_KEY);
    accessToken = null;
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
            accessToken = resp.access_token;
            localStorage.setItem(AUTO_KEY, "1");
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

  // Silent reconnect on load — no popup. Only attempts if a prior connection
  // was recorded and Google still has a live grant + session for this client.
  tryAutoConnect: () => {
    const { clientId } = get();
    if (!clientId || accessToken) return;
    if (localStorage.getItem(AUTO_KEY) !== "1") return;
    whenGoogleReady(() => {
      const tc = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GCAL_SCOPE,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callback: (resp: any) => {
          if (resp.error) return; // stay disconnected quietly
          accessToken = resp.access_token;
          set({ connected: true, error: "" });
          get().refreshSidebar();
          get().refreshGrid(currentWeek());
        },
        error_callback: () => {}, // silent — leave the Connect button
      });
      tc.requestAccessToken({ prompt: "" });
    });
  },

  disconnect: () => {
    if (accessToken && typeof google !== "undefined" && google.accounts?.oauth2) {
      google.accounts.oauth2.revoke(accessToken, () => {});
    }
    accessToken = null;
    localStorage.removeItem(AUTO_KEY); // don't silently reconnect after an explicit disconnect
    set({ connected: false, sidebarEvents: null, gridEvents: [], error: "" });
  },

  // Reuse the Google access token handed back by Supabase's "Sign in with
  // Google" (session.provider_token) so the calendar connects in one step,
  // without a second OAuth popup. Short-lived and not refreshed by Supabase —
  // once it expires, the Connect button re-establishes it via GIS.
  adoptToken: (token, weekStart) => {
    accessToken = token;
    localStorage.setItem(AUTO_KEY, "1"); // enable silent GIS reconnect after reload
    set({ connected: true, error: "" });
    get().refreshSidebar();
    get().refreshGrid(weekStart);
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
    accessToken = null;
    set({
      connected: false,
      error: "Google Calendar session expired — reconnect to refresh.",
    });
  } else {
    set({ error: err.message || "Could not load Google Calendar events." });
  }
}
