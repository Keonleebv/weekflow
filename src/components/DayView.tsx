import { useStore } from "../store";
import {
  GRID_START_H,
  GRID_END_H,
  GRID_HEIGHT,
  HOUR_H,
  hourLabel,
  fmtTime,
  offsetForMinutes,
  nowOffset,
} from "../lib/time";
import type { Category } from "../types";
import { XSmall } from "./icons";

function blockStyle(cat: Category): React.CSSProperties {
  return {
    background: cat.color + "22",
    borderColor: cat.color + "66",
    color: cat.color,
  };
}

export function DayView() {
  const blocks = useStore((s) => s.blocks);
  const tasks = useStore((s) => s.tasks);
  const categories = useStore((s) => s.categories);
  const currentWeekStart = useStore((s) => s.currentWeekStart);
  const selectedDay = useStore((s) => s.selectedDay);
  const toggleTask = useStore((s) => s.toggleTask);
  const deleteBlock = useStore((s) => s.deleteBlock);

  const catById = (id: string) => categories.find((c) => c.id === id);
  const dayBlocks = blocks
    .filter((b) => b.weekOf === currentWeekStart && b.day === selectedDay)
    .sort((a, b) => a.startMinutes - b.startMinutes);
  const now = nowOffset(currentWeekStart, selectedDay);

  const hours: number[] = [];
  for (let h = GRID_START_H; h <= GRID_END_H; h++) hours.push(h);

  return (
    <div className="view-panel">
      <div className="day-timeline-scroll">
        <div className="day-timeline" style={{ height: GRID_HEIGHT }}>
          <div className="dt-labels" style={{ height: GRID_HEIGHT }}>
            {hours.map((h) => (
              <div
                key={h}
                className="hour-label"
                style={{ top: (h - GRID_START_H) * HOUR_H }}
              >
                {hourLabel(h)}
              </div>
            ))}
          </div>
          <div className="dt-track" style={{ height: GRID_HEIGHT }}>
            {dayBlocks.map((b) => {
              const cat = catById(b.categoryId);
              if (!cat) return null;
              const top = offsetForMinutes(b.startMinutes);
              const blockTasks = tasks.filter((t) => t.blockId === b.id);
              const minH = 64 + blockTasks.length * 24;
              const height = Math.max(
                minH,
                ((b.endMinutes - b.startMinutes) / 60) * HOUR_H - 4
              );
              return (
                <div
                  key={b.id}
                  className="dt-block"
                  style={{ top, height, ...blockStyle(cat) }}
                >
                  <div className="dt-head">
                    <span
                      className="dt-tag"
                      style={{ background: cat.color + "33", color: cat.color }}
                    >
                      {cat.name.toUpperCase()}
                    </span>
                    <span className="dt-title">{b.title || cat.name}</span>
                    <span className="dt-time">{fmtTime(b.startMinutes)}</span>
                    <button
                      className="dt-del"
                      aria-label="Delete block"
                      onClick={() => deleteBlock(b.id)}
                    >
                      <XSmall />
                    </button>
                  </div>
                  <div className="dt-tasks">
                    {blockTasks.map((t) => (
                      <div key={t.id} className={`dt-task ${t.done ? "done" : ""}`}>
                        <input
                          type="checkbox"
                          checked={t.done}
                          onChange={() => toggleTask(t.id)}
                          id={`dt-${t.id}`}
                        />
                        <label htmlFor={`dt-${t.id}`}>{t.title}</label>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {now !== null && <div className="dt-now-line" style={{ top: now }} />}
          </div>
        </div>
      </div>
    </div>
  );
}
