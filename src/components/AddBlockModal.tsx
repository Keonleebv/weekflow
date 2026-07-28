import { useEffect, useState } from "react";
import { useStore } from "../store";
import {
  DAYS,
  GRID_START_H,
  GRID_END_H,
  SNAP_MIN,
  fmtTime,
  datesOfWeek,
  weekStartOfISO,
} from "../lib/time";
import type { Block, Recurrence } from "../types";
import { CloseIcon } from "./icons";

type Prefill = { date: string; start: number; end: number };

type Props = {
  open: boolean;
  prefill?: Prefill | null;
  editing?: Block | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
};

const TIME_OPTIONS: number[] = [];
for (let m = GRID_START_H * 60; m <= GRID_END_H * 60; m += SNAP_MIN)
  TIME_OPTIONS.push(m);

export function AddBlockModal({ open, prefill, editing, onClose, onSaved }: Props) {
  const categories = useStore((s) => s.categories);
  const selectedDate = useStore((s) => s.selectedDate);
  const addBlock = useStore((s) => s.addBlock);
  const updateBlock = useStore((s) => s.updateBlock);
  const deleteBlock = useStore((s) => s.deleteBlock);
  const skipOccurrence = useStore((s) => s.skipOccurrence);
  const stopRepeating = useStore((s) => s.stopRepeating);

  const [catId, setCatId] = useState(categories[0]?.id ?? "");
  const [date, setDate] = useState(selectedDate);
  const [start, setStart] = useState(9 * 60);
  const [end, setEnd] = useState(11 * 60);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>(null);
  const [askDelete, setAskDelete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCatId(editing.categoryId);
      setDate(editing.date);
      setStart(editing.startMinutes);
      setEnd(editing.endMinutes);
      setTitle(editing.title);
      setNotes(editing.notes ?? "");
      setRecurrence(editing.recurrence);
    } else {
      setCatId(categories[0]?.id ?? "");
      setDate(prefill ? prefill.date : selectedDate);
      setStart(prefill ? prefill.start : 9 * 60);
      setEnd(prefill ? prefill.end : 11 * 60);
      setTitle("");
      setNotes("");
      setRecurrence(null);
    }
    setAskDelete(false);
    setError("");
  }, [open, editing, prefill, selectedDate, categories]);

  if (!open) return null;

  // the day-chip row reflects the week the block sits in
  const weekDates = datesOfWeek(weekStartOfISO(date));
  const isRecurring = !!editing && editing.recurrence !== null;
  // the "driving instance" is the series original (id === seriesId) that's
  // still repeating — edits to it flow into not-yet-generated future weeks.
  const isDrivingInstance =
    !!editing && editing.recurrence !== null && editing.seriesId === editing.id;

  const save = () => {
    if (end <= start) {
      setError("End time must be after start time.");
      return;
    }
    if (editing) {
      updateBlock(editing.id, {
        categoryId: catId,
        date,
        startMinutes: start,
        endMinutes: end,
        title: title.trim(),
        notes: notes.trim() || undefined,
      });
      onSaved("Block updated");
    } else {
      addBlock({
        categoryId: catId,
        date,
        startMinutes: start,
        endMinutes: end,
        title: title.trim(),
        recurrence,
        notes: notes.trim() || undefined,
      });
      onSaved("Block added");
    }
    onClose();
  };

  const onDeleteClick = () => {
    if (!editing) return;
    if (isRecurring) {
      setAskDelete(true);
      return;
    }
    deleteBlock(editing.id);
    onSaved("Block deleted");
    onClose();
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
          <h3>{editing ? "Edit Block" : "Add Block"}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {isDrivingInstance && (
          <div className="edit-note">
            <span>🔁</span>
            <span>Changes here also apply to future weeks of this repeating block.</span>
          </div>
        )}

        <div className="field">
          <label>Category</label>
          <div className="chip-group">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip ${c.id === catId ? "sel" : ""}`}
                onClick={() => setCatId(c.id)}
              >
                <span className="dot" style={{ background: c.color }} />
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Day</label>
          <div className="day-chip-group">
            {DAYS.map((d, i) => (
              <button
                key={d}
                type="button"
                className={`chip ${weekDates[i] === date ? "sel" : ""}`}
                onClick={() => setDate(weekDates[i])}
              >
                {d.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="two-col">
          <div className="field">
            <label>Start Time</label>
            <select
              value={start}
              onChange={(e) => setStart(parseInt(e.target.value, 10))}
            >
              {TIME_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {fmtTime(m)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>End Time</label>
            <select
              value={end}
              onChange={(e) => setEnd(parseInt(e.target.value, 10))}
            >
              {TIME_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {fmtTime(m)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!editing && (
          <div className="field">
            <label>Repeats</label>
            <select
              value={recurrence ?? "none"}
              onChange={(e) =>
                setRecurrence(
                  e.target.value === "none"
                    ? null
                    : (e.target.value as Recurrence)
                )
              }
            >
              <option value="none">Doesn't repeat</option>
              <option value="weekly">Every week</option>
              <option value="biweekly">Every 2 weeks</option>
            </select>
          </div>
        )}

        <div className="field">
          <label>Block Title (optional)</label>
          <input
            className="text-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Deep work session"
          />
        </div>

        <div className="field">
          <label>Notes (optional)</label>
          <textarea
            className="text-input modal-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything you want to remember for this block…"
          />
        </div>

        {error && <div className="gcal-error" style={{ marginBottom: 12 }}>{error}</div>}

        {askDelete && editing ? (
          <div className="delete-choice">
            <p className="dc-label">This is a repeating block — what do you want to delete?</p>
            <button
              className="btn-secondary"
              onClick={() => {
                skipOccurrence(editing.id);
                onSaved("Occurrence removed");
                onClose();
              }}
            >
              Just this occurrence
            </button>
            <button
              className="btn-secondary btn-danger"
              onClick={() => {
                stopRepeating(editing.id);
                onSaved("Stopped repeating");
                onClose();
              }}
            >
              Stop repeating (keep this one)
            </button>
            <button className="btn-secondary" onClick={() => setAskDelete(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="modal-actions">
            {editing && (
              <button
                className="btn-secondary btn-danger"
                onClick={onDeleteClick}
                style={{ marginRight: "auto" }}
              >
                Delete
              </button>
            )}
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary" onClick={save}>
              {editing ? "Save changes" : "Add Block"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
