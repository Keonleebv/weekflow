import { useState } from "react";
import { useGCal } from "../lib/gcal";
import { useStore } from "../store";

const ENV_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

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

const FAKE_EVENTS = [
  { summary: "Team Standup", time: "9:00 AM" },
  { summary: "Interview Prep", time: "2:30 PM" },
  { summary: "Dentist Appt", time: "4:00 PM" },
];

export function GCalCard() {
  const clientId = useGCal((s) => s.clientId);
  const connected = useGCal((s) => s.connected);
  const events = useGCal((s) => s.sidebarEvents);
  const error = useGCal((s) => s.error);
  const setClientIdFromInput = useGCal((s) => s.setClientIdFromInput);
  const resetClientId = useGCal((s) => s.resetClientId);
  const connect = useGCal((s) => s.connect);
  const disconnect = useGCal((s) => s.disconnect);
  const currentWeekStart = useStore((s) => s.currentWeekStart);

  const [clientIdInput, setClientIdInput] = useState("");
  const origin = typeof window !== "undefined" ? window.location.origin : "";

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
            <button type="button" onClick={() => setClientIdFromInput(clientIdInput)}>
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
        onClick={() => (connected ? disconnect() : connect(currentWeekStart))}
      >
        {connected ? "Disconnect" : "Connect Google Calendar"}
      </button>

      {clientId && (
        <div className="gcal-status">
          <span className={connected ? "dot-live" : "dot-off"} />
          {connected ? "Synced — also shown on your timeline" : "Not connected"}
          {!ENV_CLIENT_ID && (
            <span className="gcal-edit-link" onClick={resetClientId}>
              change client ID
            </span>
          )}
        </div>
      )}

      {error && <div className="gcal-error">{error}</div>}
    </>
  );
}
