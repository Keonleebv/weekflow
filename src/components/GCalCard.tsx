import { useState } from "react";
import { track } from "@vercel/analytics";
import type { GCalEvent } from "../types";

/* Google Identity Services token client (implicit OAuth2) — client-side only.
   Read-only scope: pulls invites in, never writes. Token lives in memory only
   (module-level), so it clears on refresh — reconnect each session. */
const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const CLIENT_ID_STORAGE_KEY = "weekflow-gcal-client-id";
const ENV_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any;

let tokenClient: ReturnType<typeof initClient> | null = null;
let accessToken: string | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function initClient(clientId: string, callback: (resp: any) => void) {
  return google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: GCAL_SCOPE,
    callback,
  });
}

const FAKE_EVENTS = [
  { summary: "Team Standup", time: "9:00 AM" },
  { summary: "Interview Prep", time: "2:30 PM" },
  { summary: "Dentist Appt", time: "4:00 PM" },
];

function fmtEventTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "All day";
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return h12 + (m ? ":" + String(m).padStart(2, "0") : "") + ap;
}

export function GCalCard() {
  const [clientId, setClientId] = useState(
    ENV_CLIENT_ID || localStorage.getItem(CLIENT_ID_STORAGE_KEY) || ""
  );
  const [clientIdInput, setClientIdInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<GCalEvent[] | null>(null);
  const [error, setError] = useState("");
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  const saveClientId = () => {
    const val = clientIdInput.trim();
    if (!val) return;
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, val);
    tokenClient = null;
    setClientId(val);
  };

  const changeClientId = () => {
    localStorage.removeItem(CLIENT_ID_STORAGE_KEY);
    accessToken = null;
    tokenClient = null;
    setClientId(ENV_CLIENT_ID || "");
    setConnected(false);
    setEvents(null);
    setError("");
  };

  const fetchEvents = () => {
    setError("");
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
        timeMin
      )}&timeMax=${encodeURIComponent(
        timeMax
      )}&singleEvents=true&orderBy=startTime&maxResults=10`,
      { headers: { Authorization: "Bearer " + accessToken } }
    )
      .then((r) => {
        if (!r.ok) throw new Error("Google Calendar request failed (" + r.status + ")");
        return r.json();
      })
      .then((data) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items = (data.items || []).map((ev: any) => ({
          id: ev.id,
          summary: ev.summary || "(untitled)",
          start: ev.start?.dateTime || ev.start?.date || "",
          end: ev.end?.dateTime || ev.end?.date || "",
          htmlLink: ev.htmlLink || "",
        }));
        setEvents(items);
        setConnected(true);
        track("gcal_connected");
      })
      .catch((e: Error) => setError(e.message || "Could not load events."));
  };

  const connect = () => {
    if (!clientId) return;
    setError("");
    if (typeof google === "undefined" || !google.accounts?.oauth2) {
      setError("Google sign-in script not loaded yet — try again in a moment.");
      return;
    }
    if (!tokenClient) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tokenClient = initClient(clientId, (resp: any) => {
        if (resp.error) {
          setError("Sign-in was cancelled or denied.");
          return;
        }
        accessToken = resp.access_token;
        fetchEvents();
      });
    }
    tokenClient.requestAccessToken({ prompt: accessToken ? "" : "consent" });
  };

  const disconnect = () => {
    if (accessToken && typeof google !== "undefined") {
      google.accounts.oauth2.revoke(accessToken, () => {});
    }
    accessToken = null;
    setConnected(false);
    setEvents(null);
    setError("");
  };

  return (
    <>
      <p
        className="card-title"
        style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 7 }}
      >
        Google Calendar
        <span
          className="ro-badge"
          title="Weekflow only reads your calendar — it never creates, edits, or deletes events on it."
        >
          Read-only
        </span>
      </p>

      {!clientId && (
        <div className="gcal-setup">
          <p>
            Pull real invites in (read-only). One-time setup in{" "}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Cloud Console
            </a>
            :
          </p>
          <ol className="gcal-steps">
            <li>Pick or create a project (top-left).</li>
            <li>
              Enable the <b>Google Calendar API</b> (APIs &amp; Services → Enable
              APIs).
            </li>
            <li>
              <b>OAuth consent screen</b> → External → add your email under Test
              users.
            </li>
            <li>
              <b>Credentials → Create credentials → OAuth client ID</b> → type{" "}
              <b>Web application</b>.
            </li>
            <li>
              Under <b>Authorized JavaScript origins</b> add{" "}
              <code>{origin}</code>, then Create.
            </li>
            <li>Paste the Client ID below.</li>
          </ol>
          <div className="gcal-setup-row">
            <input
              type="text"
              placeholder="xxxxxxxx.apps.googleusercontent.com"
              value={clientIdInput}
              onChange={(e) => setClientIdInput(e.target.value)}
            />
            <button type="button" onClick={saveClientId}>
              Save
            </button>
          </div>
        </div>
      )}

      <div>
        {connected && events ? (
          events.length === 0 ? (
            <p className="empty-note">No events in the next 7 days.</p>
          ) : (
            events.slice(0, 6).map((ev) => (
              <div className="gcal-row" key={ev.id}>
                <div>
                  <span className="gname">{ev.summary}</span>
                  <span className="gtime">
                    {ev.start.includes("T") ? fmtEventTime(ev.start) : "All day"}
                  </span>
                </div>
              </div>
            ))
          )
        ) : (
          FAKE_EVENTS.map((ev) => (
            <div className="gcal-row" key={ev.summary}>
              <div>
                <span className="gname">{ev.summary}</span>
                <span className="gtime">{ev.time}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <button
        className={`btn-ghost ${connected ? "danger" : ""}`}
        disabled={!clientId}
        onClick={() => (connected ? disconnect() : connect())}
      >
        {connected ? "Disconnect" : "Connect Google Calendar"}
      </button>

      {clientId && (
        <div className="gcal-status">
          <span className={connected ? "dot-live" : "dot-off"} />
          {connected ? "Synced with Google Calendar" : "Not connected"}
          {!ENV_CLIENT_ID && (
            <span className="gcal-edit-link" onClick={changeClientId}>
              change client ID
            </span>
          )}
        </div>
      )}

      {error && <div className="gcal-error">{error}</div>}
    </>
  );
}
