import { useState } from "react";
import { useStore } from "../store";
import { hashText } from "../lib/time";

type Props = {
  day: number;
};

/**
 * Reflection summary card. Combines the overall body + all block notes, sends
 * them to the /api/summarize serverless function for a real Claude summary, and
 * caches the result on the journal entry (keyed by a hash of the source text so
 * reopening an unedited entry doesn't re-call the API).
 */
export function SummaryCard({ day }: Props) {
  const entry = useStore((s) => s.journalEntries[day]);
  const setJournalSummary = useStore((s) => s.setJournalSummary);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const overall = entry?.overallBody ?? "";
  const notes = entry ? Object.values(entry.blockNotes) : [];
  const combined = [overall, ...notes].filter((t) => t && t.trim()).join("\n\n").trim();

  // Only show the card once there's something to summarize.
  if (!combined) return null;

  const currentHash = hashText(combined);
  const cached =
    entry?.summary && entry.summary.forTextHash === currentHash
      ? entry.summary.bullets
      : null;

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: combined }),
      });
      if (!res.ok) throw new Error(`Summary service error (${res.status})`);
      const data = (await res.json()) as { bullets?: string[] };
      if (!Array.isArray(data.bullets) || data.bullets.length === 0) {
        throw new Error("No summary returned.");
      }
      setJournalSummary(day, {
        bullets: data.bullets,
        forTextHash: currentHash,
        generatedAt: new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate summary.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="summary-card">
      <div className="summary-head">
        <span>✨</span>
        <span className="sh-title">Reflection Summary</span>
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
          Write a reflection below, then generate a quick bullet summary to see
          at a glance next time you open this day.
        </p>
      )}
      {error && <p className="gcal-error">{error}</p>}
    </div>
  );
}
