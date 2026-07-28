import { useState } from "react";
import { useStore } from "../store";
import {
  fmtTime,
  fullDayNameISO,
  todayISO,
  datesOfWeek,
} from "../lib/time";

export function TaskList() {
  const blocks = useStore((s) => s.blocks);
  const tasks = useStore((s) => s.tasks);
  const categories = useStore((s) => s.categories);
  const currentWeekStart = useStore((s) => s.currentWeekStart);
  const view = useStore((s) => s.view);
  const mode = useStore((s) => s.mode);
  const selectedDate = useStore((s) => s.selectedDate);
  const toggleTask = useStore((s) => s.toggleTask);
  const addTask = useStore((s) => s.addTask);

  const today = todayISO();
  const weekDates = datesOfWeek(currentWeekStart);
  // Journal / Day view focus the selected date; Week view shows today (or the
  // shown week's Monday when today is in a different week).
  const viewedDate =
    mode === "journal" || view === "day"
      ? selectedDate
      : weekDates.includes(today)
        ? today
        : currentWeekStart;

  const catById = (id: string) => categories.find((c) => c.id === id);
  const dayBlocks = blocks
    .filter((b) => !b.skipped && b.date === viewedDate)
    .sort((a, b) => a.startMinutes - b.startMinutes);
  const dayBlockIds = new Set(dayBlocks.map((b) => b.id));

  // date-based carryover: unfinished tasks from any earlier day (not tied to a
  // block recurring). One row per task — this is display-only, no duplication.
  const overdue = tasks
    .filter((t) => !t.done && t.date < viewedDate)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const dayTasks = tasks.filter((t) => t.date === viewedDate);
  const otherTasks = dayTasks.filter(
    (t) => !t.blockId || !dayBlockIds.has(t.blockId)
  );

  const doneCount = dayTasks.filter((t) => t.done).length;
  const weekTasks = tasks.filter((t) => weekDates.includes(t.date));
  const weekDone = weekTasks.filter((t) => t.done).length;
  const pct = (done: number, total: number) =>
    total ? `${(done / total) * 100}%` : "0%";

  const row = (t: (typeof tasks)[number], withDate = false) => (
    <div className={`task-row ${t.done ? "done" : ""}`} key={t.id}>
      <input
        type="checkbox"
        checked={t.done}
        onChange={() => toggleTask(t.id)}
        id={`tr-${t.id}`}
      />
      <label htmlFor={`tr-${t.id}`}>{t.title}</label>
      {withDate && (
        <span className="task-overdue-date">{shortDate(t.date)}</span>
      )}
    </div>
  );

  return (
    <>
      <div className="card">
        <p className="today-label">Today — {fullDayNameISO(viewedDate)}</p>

        {overdue.length > 0 && (
          <div className="task-group carried-over">
            <div className="task-group-head">
              <span className="dot" style={{ background: "var(--danger)" }} />
              <span className="tg-name">Carried over</span>
              <span className="tg-time">{overdue.length} overdue</span>
            </div>
            {overdue.map((t) => row(t, true))}
          </div>
        )}

        {dayBlocks.length === 0 && otherTasks.length === 0 ? (
          <p className="empty-note">No blocks scheduled. Add one to get started.</p>
        ) : (
          dayBlocks.map((b) => {
            const cat = catById(b.categoryId);
            if (!cat) return null;
            const blockTasks = dayTasks.filter((t) => t.blockId === b.id);
            return (
              <div className="task-group" key={b.id}>
                <div className="task-group-head">
                  <span className="dot" style={{ background: cat.color }} />
                  <span className="tg-name">{b.title || cat.name}</span>
                  <span className="tg-time">
                    {fmtTime(b.startMinutes)}–{fmtTime(b.endMinutes)}
                  </span>
                </div>
                {blockTasks.map((t) => row(t))}
                <AddTaskInput
                  onAdd={(title) =>
                    addTask({ title, date: viewedDate, blockId: b.id, categoryId: b.categoryId })
                  }
                />
              </div>
            );
          })
        )}

        {(otherTasks.length > 0 || dayBlocks.length > 0) && (
          <div className="task-group">
            {otherTasks.length > 0 && (
              <div className="task-group-head">
                <span className="dot" style={{ background: "var(--text-faint)" }} />
                <span className="tg-name">Other</span>
              </div>
            )}
            {otherTasks.map((t) => row(t))}
            <AddTaskInput onAdd={(title) => addTask({ title, date: viewedDate })} />
          </div>
        )}
      </div>

      <div className="card">
        <p className="card-title">Progress</p>

        <div className="progress-label">
          <span>Today</span>
          <span>
            {doneCount} / {dayTasks.length}
          </span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: pct(doneCount, dayTasks.length) }}
          />
        </div>

        <div className="progress-label" style={{ marginTop: 14 }}>
          <span>This week</span>
          <span>
            {weekDone} / {weekTasks.length}
          </span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: pct(weekDone, weekTasks.length) }}
          />
        </div>
      </div>
    </>
  );
}

function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function AddTaskInput({ onAdd }: { onAdd: (title: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="add-task-row">
      <input
        type="text"
        placeholder="+ Add task..."
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && val.trim()) {
            onAdd(val.trim());
            setVal("");
          }
        }}
      />
    </div>
  );
}
