import { useEffect, useRef } from "react";
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
  scrollToNowTop,
} from "../lib/time";
import { useDragCreate, type Range } from "../lib/useDragCreate";
import { useBlockDrag } from "../lib/useBlockDrag";
import type { Block, Category } from "../types";
import { XSmall } from "./icons";

function blockStyle(cat: Category): React.CSSProperties {
  return {
    background: cat.color + "22",
    borderColor: cat.color + "66",
    color: cat.color,
  };
}

type Props = {
  onCreateRange: (r: Range) => void;
  onEdit: (block: Block) => void;
};

export function DayView({ onCreateRange, onEdit }: Props) {
  const blocks = useStore((s) => s.blocks);
  const tasks = useStore((s) => s.tasks);
  const categories = useStore((s) => s.categories);
  const currentWeekStart = useStore((s) => s.currentWeekStart);
  const selectedDay = useStore((s) => s.selectedDay);
  const toggleTask = useStore((s) => s.toggleTask);
  const deleteBlock = useStore((s) => s.deleteBlock);
  const updateBlock = useStore((s) => s.updateBlock);

  const create = useDragCreate(onCreateRange);
  // direct drag to move a block; a plain tap opens the editor
  const drag = useBlockDrag({
    onMove: (id, start, end) =>
      updateBlock(id, { startMinutes: start, endMinutes: end }),
    onTap: (block) => onEdit(block),
    canDrag: () => true,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolledRef = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || scrolledRef.current) return; // guard StrictMode double-invoke
    scrolledRef.current = true;
    const pending = useStore.getState().pendingScrollMinutes;
    if (pending != null) {
      // jumped here from a Week-view block — land on that block
      el.scrollTop = Math.max(0, offsetForMinutes(pending) - 80);
      useStore.getState().clearPendingScroll();
    } else {
      el.scrollTop = scrollToNowTop();
    }
  }, []);

  const catById = (id: string) => categories.find((c) => c.id === id);
  const dayBlocks = blocks
    .filter((b) => b.weekOf === currentWeekStart && b.day === selectedDay)
    .sort((a, b) => a.startMinutes - b.startMinutes);
  const now = nowOffset(currentWeekStart, selectedDay);

  const hours: number[] = [];
  for (let h = GRID_START_H; h <= GRID_END_H; h++) hours.push(h);

  return (
    <div className="view-panel">
      <div className="day-timeline-scroll" ref={scrollRef}>
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
          <div
            className="dt-track"
            style={{ height: GRID_HEIGHT }}
            onPointerDown={(e) => create.onPointerDown(e, selectedDay)}
            onPointerMove={create.onPointerMove}
            onPointerUp={create.onPointerUp}
          >
            {dayBlocks.map((b) => {
              const cat = catById(b.categoryId);
              if (!cat) return null;
              const isDragging = drag.live?.id === b.id;
              const startM = isDragging ? drag.live!.start : b.startMinutes;
              const endM = isDragging ? drag.live!.end : b.endMinutes;
              const top = offsetForMinutes(startM);
              const blockTasks = tasks.filter((t) => t.blockId === b.id);
              const minH = 64 + blockTasks.length * 24 + 48;
              const height = Math.max(
                minH,
                ((endM - startM) / 60) * HOUR_H - 4
              );
              return (
                <div
                  key={b.id}
                  className={`dt-block${isDragging ? " dragging" : ""}`}
                  style={{ top, height, ...blockStyle(cat) }}
                  onPointerDown={(e) => drag.onPointerDown(e, b)}
                  onPointerMove={drag.onPointerMove}
                  onPointerUp={drag.onPointerUp}
                >
                  <div className="dt-head">
                    <span
                      className="dt-tag"
                      style={{ background: cat.color + "33", color: cat.color }}
                    >
                      {cat.name.toUpperCase()}
                    </span>
                    <span className="dt-title">{b.title || cat.name}</span>
                    <span className="dt-time">{fmtTime(startM)}</span>
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
                  <textarea
                    className="dt-notes"
                    placeholder="Notes…"
                    value={b.notes ?? ""}
                    onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => updateBlock(b.id, { notes: e.target.value })}
                  />
                </div>
              );
            })}
            {create.preview && create.preview.day === selectedDay && (
              <div
                className="dt-drag-preview"
                style={{
                  top: offsetForMinutes(create.preview.start),
                  height: Math.max(
                    2,
                    offsetForMinutes(create.preview.end) -
                      offsetForMinutes(create.preview.start)
                  ),
                }}
              />
            )}
            {now !== null && <div className="dt-now-line" style={{ top: now }} />}
          </div>
        </div>
      </div>
    </div>
  );
}
