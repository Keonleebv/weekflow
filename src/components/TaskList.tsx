import { useState } from "react";
import { useStore } from "../store";
import {
  DAY_FULL,
  fmtTime,
  todayIndexInWeek,
} from "../lib/time";

export function TaskList() {
  const blocks = useStore((s) => s.blocks);
  const tasks = useStore((s) => s.tasks);
  const categories = useStore((s) => s.categories);
  const currentWeekStart = useStore((s) => s.currentWeekStart);
  const view = useStore((s) => s.view);
  const selectedDay = useStore((s) => s.selectedDay);
  const toggleTask = useStore((s) => s.toggleTask);
  const addTask = useStore((s) => s.addTask);

  const todayIdx = todayIndexInWeek(currentWeekStart);
  const day = view === "day" ? selectedDay : todayIdx >= 0 ? todayIdx : 0;

  const catById = (id: string) => categories.find((c) => c.id === id);
  const dayBlocks = blocks
    .filter((b) => b.weekOf === currentWeekStart && b.day === day)
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const dayBlockIds = dayBlocks.map((b) => b.id);
  const dayTasks = tasks.filter((t) => t.blockId && dayBlockIds.includes(t.blockId));
  const doneCount = dayTasks.filter((t) => t.done).length;

  // whole-week progress across every block in the current week
  const weekBlockIds = blocks
    .filter((b) => b.weekOf === currentWeekStart)
    .map((b) => b.id);
  const weekTasks = tasks.filter(
    (t) => t.blockId && weekBlockIds.includes(t.blockId)
  );
  const weekDone = weekTasks.filter((t) => t.done).length;
  const pct = (done: number, total: number) =>
    total ? `${(done / total) * 100}%` : "0%";

  return (
    <>
      <div className="card">
        <p className="today-label">Today — {DAY_FULL[day]}</p>
        {dayBlocks.length === 0 ? (
          <p className="empty-note">No blocks scheduled. Add one to get started.</p>
        ) : (
          dayBlocks.map((b) => {
            const cat = catById(b.categoryId);
            if (!cat) return null;
            const blockTasks = tasks.filter((t) => t.blockId === b.id);
            return (
              <div className="task-group" key={b.id}>
                <div className="task-group-head">
                  <span className="dot" style={{ background: cat.color }} />
                  <span className="tg-name">{b.title || cat.name}</span>
                  <span className="tg-time">
                    {fmtTime(b.startMinutes)}–{fmtTime(b.endMinutes)}
                  </span>
                </div>
                {blockTasks.map((t) => (
                  <div className={`task-row ${t.done ? "done" : ""}`} key={t.id}>
                    <input
                      type="checkbox"
                      checked={t.done}
                      onChange={() => toggleTask(t.id)}
                      id={`tr-${t.id}`}
                    />
                    <label htmlFor={`tr-${t.id}`}>{t.title}</label>
                  </div>
                ))}
                <AddTaskInput blockId={b.id} categoryId={b.categoryId} onAdd={addTask} />
              </div>
            );
          })
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

function AddTaskInput({
  blockId,
  categoryId,
  onAdd,
}: {
  blockId: string;
  categoryId: string;
  onAdd: (t: { title: string; blockId?: string; categoryId?: string }) => void;
}) {
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
            onAdd({ title: val.trim(), blockId, categoryId });
            setVal("");
          }
        }}
      />
    </div>
  );
}
