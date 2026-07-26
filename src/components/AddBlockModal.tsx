import { useEffect, useState } from "react";
import { useStore } from "../store";
import { DAYS, GRID_START_H, GRID_END_H, SNAP_MIN, fmtTime } from "../lib/time";
import { CloseIcon } from "./icons";

type Prefill = { day: number; start: number; end: number };

type Props = {
  open: boolean;
  prefill?: Prefill | null;
  onClose: () => void;
  onSaved: () => void;
};

const TIME_OPTIONS: number[] = [];
for (let m = GRID_START_H * 60; m <= GRID_END_H * 60; m += SNAP_MIN)
  TIME_OPTIONS.push(m);

export function AddBlockModal({ open, prefill, onClose, onSaved }: Props) {
  const categories = useStore((s) => s.categories);
  const view = useStore((s) => s.view);
  const selectedDay = useStore((s) => s.selectedDay);
  const addBlock = useStore((s) => s.addBlock);

  const [catId, setCatId] = useState(categories[0]?.id ?? "");
  const [day, setDay] = useState(2);
  const [start, setStart] = useState(9 * 60);
  const [end, setEnd] = useState(11 * 60);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setCatId(categories[0]?.id ?? "");
      setDay(prefill ? prefill.day : view === "day" ? selectedDay : 2);
      setStart(prefill ? prefill.start : 9 * 60);
      setEnd(prefill ? prefill.end : 11 * 60);
      setTitle("");
      setError("");
    }
  }, [open, prefill, view, selectedDay, categories]);

  if (!open) return null;

  const save = () => {
    if (end <= start) {
      setError("End time must be after start time.");
      return;
    }
    addBlock({
      categoryId: catId,
      day,
      startMinutes: start,
      endMinutes: end,
      title: title.trim(),
    });
    onSaved();
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
          <h3>Add Block</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

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
                className={`chip ${i === day ? "sel" : ""}`}
                onClick={() => setDay(i)}
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

        <div className="field">
          <label>Block Title (optional)</label>
          <input
            className="text-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Deep work session"
          />
        </div>

        {error && <div className="gcal-error" style={{ marginBottom: 12 }}>{error}</div>}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save}>
            Add Block
          </button>
        </div>
      </div>
    </div>
  );
}
