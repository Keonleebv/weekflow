import { useRef, useState } from "react";
import { format } from "date-fns";
import { useStore } from "../store";
import { DAY_FULL, dateForDay, fmtTime } from "../lib/time";
import type { Mood } from "../types";
import { SummaryCard } from "./SummaryCard";

const MOODS: { id: Mood; emoji: string; label: string }[] = [
  { id: "rough", emoji: "😕", label: "Rough" },
  { id: "okay", emoji: "😐", label: "Okay" },
  { id: "good", emoji: "🙂", label: "Good" },
  { id: "great", emoji: "😄", label: "Great" },
  { id: "fire", emoji: "🔥", label: "On fire" },
];

export function JournalView() {
  const selectedDay = useStore((s) => s.selectedDay);
  const currentWeekStart = useStore((s) => s.currentWeekStart);
  const variant = useStore((s) => s.journalVariant);
  const blocks = useStore((s) => s.blocks);
  const categories = useStore((s) => s.categories);
  const entry = useStore((s) => s.journalEntries[selectedDay]);
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
    saveTimer.current = window.setTimeout(() => setSaved("Saved"), 500);
  };

  const catById = (id: string) => categories.find((c) => c.id === id);
  const dayBlocks = blocks
    .filter((b) => b.weekOf === currentWeekStart && b.day === selectedDay)
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const dateLabel = `${DAY_FULL[selectedDay]}, ${format(
    dateForDay(currentWeekStart, selectedDay),
    "MMM d"
  )}`;

  const overall = entry?.overallBody ?? "";
  const mood = entry?.mood ?? null;

  return (
    <div className="view-panel journal-panel">
      <div className="journal-scroll">
        <div className="journal-wrap">
          <h2 className="journal-date">{dateLabel}</h2>

          <SummaryCard day={selectedDay} />

          <div className="mood-row">
            <span className="mr-label">How was today?</span>
            <div className="mood-opts">
              {MOODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`mood-opt ${mood === m.id ? "sel" : ""}`}
                  onClick={() => setJournalMood(selectedDay, m.id)}
                >
                  <span className="me">{m.emoji}</span>
                  <span className="ml">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {variant === "block" && (
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
                              setJournalBlockNote(selectedDay, b.id, e.target.value);
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
          )}

          <div className="overall-section">
            {variant === "block" && (
              <span className="mr-label">
                Overall reflection <span className="optional-tag">(optional)</span>
              </span>
            )}
            <textarea
              className="journal-textarea"
              placeholder={
                variant === "block"
                  ? "Anything that didn't fit under a block above..."
                  : "What stood out today?"
              }
              value={overall}
              onChange={(e) => {
                setJournalOverall(selectedDay, e.target.value);
                markSaving();
              }}
            />
          </div>
          <div className="journal-saved">{saved || " "}</div>
        </div>
      </div>
    </div>
  );
}
