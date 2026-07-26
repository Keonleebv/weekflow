import { useStore } from "../store";
import {
  DAYS,
  GRID_START_H,
  GRID_END_H,
  GRID_HEIGHT,
  HOUR_H,
  hourLabel,
  fmtTime,
  offsetForMinutes,
  nowOffset,
  todayIndexInWeek,
  dateForDay,
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

export function WeekView() {
  const blocks = useStore((s) => s.blocks);
  const categories = useStore((s) => s.categories);
  const currentWeekStart = useStore((s) => s.currentWeekStart);
  const deleteBlock = useStore((s) => s.deleteBlock);

  const catById = (id: string) => categories.find((c) => c.id === id);
  const todayIdx = todayIndexInWeek(currentWeekStart);
  const weekBlocks = blocks.filter((b) => b.weekOf === currentWeekStart);

  const hours: number[] = [];
  for (let h = GRID_START_H; h <= GRID_END_H; h++) hours.push(h);

  return (
    <div className="view-panel">
      <div className="week-header">
        <div className="hd" />
        {DAYS.map((d, i) => (
          <div key={d} className={`hd ${i === todayIdx ? "is-today" : ""}`}>
            <span className="dname">{d.toUpperCase()}</span>
            <span className="dnum">{dateForDay(currentWeekStart, i).getDate()}</span>
          </div>
        ))}
      </div>
      <div className="grid-scroll">
        <div className="grid" style={{ height: GRID_HEIGHT }}>
          <div className="hour-labels" style={{ height: GRID_HEIGHT }}>
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
          {DAYS.map((_, d) => {
            const dayBlocks = weekBlocks
              .filter((b) => b.day === d)
              .sort((a, b) => a.startMinutes - b.startMinutes);
            const now = nowOffset(currentWeekStart, d);
            return (
              <div key={d} className="day-col" style={{ height: GRID_HEIGHT }}>
                {dayBlocks.map((b) => {
                  const cat = catById(b.categoryId);
                  if (!cat) return null;
                  const top = offsetForMinutes(b.startMinutes);
                  const height = Math.max(
                    26,
                    ((b.endMinutes - b.startMinutes) / 60) * HOUR_H - 2
                  );
                  return (
                    <div
                      key={b.id}
                      className="block"
                      style={{ top, height, ...blockStyle(cat) }}
                    >
                      <button
                        className="b-del"
                        aria-label="Delete block"
                        onClick={() => deleteBlock(b.id)}
                      >
                        <XSmall />
                      </button>
                      <span className="b-title">{b.title || cat.name}</span>
                      <span className="b-time">
                        {fmtTime(b.startMinutes)} – {fmtTime(b.endMinutes)}
                      </span>
                    </div>
                  );
                })}
                {now !== null && <div className="now-line" style={{ top: now }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
