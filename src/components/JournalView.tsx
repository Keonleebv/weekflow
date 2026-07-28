import { useRef, useState } from "react";
import { format } from "date-fns";
import { track } from "@vercel/analytics";
import { useStore } from "../store";
import { fmtTime, fullDayNameISO, parseISO, addDaysISO } from "../lib/time";
import type { JournalEntry, Mood } from "../types";
import { SummaryCard } from "./SummaryCard";

function hasContent(e?: JournalEntry): boolean {
  if (!e) return false;
  if (e.overallBody && e.overallBody.trim()) return true;
  return Object.values(e.blockNotes).some((v) => v && v.trim());
}

const MOODS: { id: Mood; emoji: string; label: string }[] = [
  { id: "rough", emoji: "😕", label: "Rough" },
  { id: "okay", emoji: "😐", label: "Okay" },
  { id: "good", emoji: "🙂", label: "Good" },
  { id: "great", emoji: "😄", label: "Great" },
  { id: "fire", emoji: "🔥", label: "On fire" },
];

export function JournalView() {
  const selectedDate = useStore((s) => s.selectedDate);
  const blocks = useStore((s) => s.blocks);
  const categories = useStore((s) => s.categories);
  const journalEntries = useStore((s) => s.journalEntries);
  const entry = journalEntries[selectedDate];
  const setJournalMood = useStore((s) => s.setJournalMood);
  const setJournalOverall = useStore((s) => s.setJournalOverall);
  const setJournalBlockNote = useStore((s) => s.setJournalBlockNote);

  // block pill expand/collapse — UI-only, resets each session
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // quiet autosave indicator (store persists on every change; this is cosmetic)
  const [saved, setSaved] = useState("");
  const saveTimer = useRef<number | undefined>(undefined);
  const markSaving = () => {
    setSaved("Saving…");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      setSaved("Saved");
      track("journal_entry_saved");
    }, 500);
  };

  // real streak: consecutive calendar days with content, back from the selected
  // date — crosses week boundaries now that entries are keyed by ISO date.
  let streak = 0;
  for (let d = selectedDate; ; d = addDaysISO(d, -1)) {
    if (hasContent(journalEntries[d])) streak++;
    else break;
  }

  const catById = (id: string) => categories.find((c) => c.id === id);
  const dayBlocks = blocks
    .filter((b) => !b.skipped && b.date === selectedDate)
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const dateLabel = `${fullDayNameISO(selectedDate)}, ${format(
    parseISO(selectedDate),
    "MMM d"
  )}`;

  const overall = entry?.overallBody ?? "";
  const mood = entry?.mood ?? null;

  return (
    <div className="view-panel journal-panel">
      <div className="journal-scroll">
        <div className="journal-wrap">
          <div className="journal-date-row">
            <h2 className="journal-date">{dateLabel}</h2>
            {streak > 0 && (
              <span className="streak-badge">🔥 {streak}-day streak</span>
            )}
          </div>

          <SummaryCard date={selectedDate} />

          <div className="mood-row">
            <span className="mr-label">How was today?</span>
            <div className="mood-opts">
              {MOODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`mood-opt ${mood === m.id ? "sel" : ""}`}
                  onClick={() => setJournalMood(selectedDate, m.id)}
                >
                  <span className="me">{m.emoji}</span>
                  <span className="ml">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="journal-blocks">
            {dayBlocks.length === 0 ? (
              <p className="empty-note">
                Nothing scheduled this day — just the overall reflection below.
              </p>
            ) : (
              dayBlocks.map((b) => {
                const cat = catById(b.categoryId);
                if (!cat) return null;
                const noteVal = entry?.blockNotes[b.id] ?? "";
                const isOpen = expanded.has(b.id);
                return (
                  <div
                    key={b.id}
                    className={`block-note-card ${isOpen ? "expanded" : ""}`}
                  >
                    <button
                      type="button"
                      className="block-note-head"
                      onClick={() => toggleExpanded(b.id)}
                    >
                      <span className="dot" style={{ background: cat.color }} />
                      <span className="bn-name">{b.title || cat.name}</span>
                      {!isOpen && noteVal && (
                        <span className="bn-preview">{noteVal}</span>
                      )}
                      <span className="bn-time">
                        {fmtTime(b.startMinutes)}–{fmtTime(b.endMinutes)}
                      </span>
                      <span className="bn-chev">⌄</span>
                    </button>
                    {isOpen && (
                      <div className="block-note-body">
                        <textarea
                          className="journal-textarea small"
                          placeholder="Notes on this block..."
                          value={noteVal}
                          autoFocus
                          onChange={(e) => {
                            setJournalBlockNote(selectedDate, b.id, e.target.value);
                            markSaving();
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="overall-section">
            <span className="mr-label">
              Overall reflection <span className="optional-tag">(optional)</span>
            </span>
            <textarea
              className="journal-textarea"
              placeholder="Anything that didn't fit under a block above..."
              value={overall}
              onChange={(e) => {
                setJournalOverall(selectedDate, e.target.value);
                markSaving();
              }}
            />
          </div>
          <div className="journal-saved">{saved || " "}</div>
        </div>
      </div>
    </div>
  );
}
