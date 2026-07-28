import { useState } from "react";
import { format } from "date-fns";
import { track } from "@vercel/analytics";
import { useStore } from "../store";
import {
  DAYS,
  datesOfWeek,
  parseISO,
  hashText,
} from "../lib/time";
import { catHoursForDates } from "../lib/stats";
import type { Mood } from "../types";
import { CloseIcon } from "./icons";

const MOOD_EMOJI: Record<Mood, string> = {
  rough: "😕",
  okay: "😐",
  good: "🙂",
  great: "😄",
  fire: "🔥",
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export function WeeklyReviewModal({ open, onClose }: Props) {
  const currentWeekStart = useStore((s) => s.currentWeekStart);
  const blocks = useStore((s) => s.blocks);
  const categories = useStore((s) => s.categories);
  const tasks = useStore((s) => s.tasks);
  const journalEntries = useStore((s) => s.journalEntries);
  const weeklyDigests = useStore((s) => s.weeklyDigests);
  const setWeeklyDigest = useStore((s) => s.setWeeklyDigest);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const weekDates = datesOfWeek(currentWeekStart);
  const weekSet = new Set(weekDates);
  const rangeLabel = `${format(parseISO(weekDates[0]), "MMM d")} – ${format(
    parseISO(weekDates[6]),
    "MMM d"
  )}`;

  const rows = categories
    .map((c) => ({ cat: c, hrs: catHoursForDates(blocks, c.id, weekDates) }))
    .filter((x) => x.hrs > 0 || (x.cat.weeklyGoalHours || 0) > 0);

  const weekTasks = tasks.filter((t) => weekSet.has(t.date));
  const doneCount = weekTasks.filter((t) => t.done).length;

  // AI digest — reuse /api/summarize fed this week's journal text
  const combined = weekDates
    .map((d) => journalEntries[d])
    .filter(Boolean)
    .flatMap((e) => [e!.overallBody, ...Object.values(e!.blockNotes)])
    .filter((t) => t && t.trim())
    .join("\n\n")
    .trim();
  const currentHash = hashText(combined);
  const digest = weeklyDigests[currentWeekStart];
  const cached =
    digest && digest.forTextHash === currentHash ? digest.bullets : null;

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: combined }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        bullets?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || `Summary service error (${res.status})`);
      if (!Array.isArray(data.bullets) || data.bullets.length === 0)
        throw new Error(data.error || "No summary returned.");
      setWeeklyDigest(currentWeekStart, {
        weekOf: currentWeekStart,
        bullets: data.bullets,
        forTextHash: currentHash,
        generatedAt: new Date().toISOString(),
      });
      track("journal_summary_generated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate summary.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-head">
          <h3>Week in review</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <p className="review-range">{rangeLabel}</p>

        <div className="review-section">
          <p className="mr-label">Hours vs. goal</p>
          {rows.length === 0 ? (
            <p className="empty-note">No time blocked this week yet.</p>
          ) : (
            rows.map(({ cat, hrs }) => {
              const goal = cat.weeklyGoalHours || 0;
              const pct = goal ? Math.min(100, Math.round((hrs / goal) * 100)) : 0;
              return (
                <div className="legend-item" key={cat.id}>
                  <div className="legend-top">
                    <span className="dot" style={{ background: cat.color }} />
                    <span className="legend-name">{cat.name}</span>
                    <span className="legend-hrs">
                      {hrs % 1 === 0 ? hrs : hrs.toFixed(1)}h{goal ? ` / ${goal}h` : ""}
                    </span>
                  </div>
                  {goal ? (
                    <div className="legend-bar-track">
                      <div
                        className="legend-bar-fill"
                        style={{ width: `${pct}%`, background: cat.color }}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <div className="review-section">
          <p className="mr-label">Mood trend</p>
          <div className="mood-trend">
            {weekDates.map((d, i) => {
              const m = journalEntries[d]?.mood;
              return (
                <div className="mt-day" key={d}>
                  <span className="mt-emoji">{m ? MOOD_EMOJI[m] : "·"}</span>
                  <span className="mt-label">{DAYS[i]}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="review-section">
          <p className="mr-label">Tasks completed</p>
          <div className="progress-label">
            <span>This week</span>
            <span>
              {doneCount} / {weekTasks.length}
            </span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: weekTasks.length
                  ? `${(doneCount / weekTasks.length) * 100}%`
                  : "0%",
              }}
            />
          </div>
        </div>

        {combined && (
          <div className="summary-card" style={{ marginTop: 4 }}>
            <div className="summary-head">
              <span>✨</span>
              <span className="sh-title">Week in review</span>
              <button
                type="button"
                className="summary-btn"
                onClick={generate}
                disabled={loading}
              >
                {loading ? "Summarizing…" : cached ? "Regenerate" : "Generate summary"}
              </button>
            </div>
            {cached ? (
              <ul className="summary-bullets">
                {cached.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            ) : (
              <p className="summary-empty">
                Generate an AI recap of this week's reflections.
              </p>
            )}
            {error && <p className="gcal-error">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
