import { useEffect, useRef, useState } from "react";
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

export function WeekView({ onCreateRange, onEdit }: Props) {
  const blocks = useStore((s) => s.blocks);
  const categories = useStore((s) => s.categories);
  const currentWeekStart = useStore((s) => s.currentWeekStart);
  const deleteBlock = useStore((s) => s.deleteBlock);
  const updateBlock = useStore((s) => s.updateBlock);

  // one click selects (highlights) a block; a second click on the selected
  // block opens the editor. Only a selected block can be dragged to move.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const create = useDragCreate(onCreateRange);
  const drag = useBlockDrag({
    onMove: (id, start, end) =>
      updateBlock(id, { startMinutes: start, endMinutes: end }),
    onTap: (block) => {
      if (selectedId === block.id) {
        setSelectedId(null); // opening the editor returns to neutral
        onEdit(block);
      } else {
        setSelectedId(block.id);
      }
    },
    canDrag: (block) => selectedId === block.id,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollToNowTop();
  }, []);

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
      <div className="grid-scroll" ref={scrollRef}>
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
              <div
                key={d}
                className="day-col"
                style={{ height: GRID_HEIGHT }}
                onPointerDown={(e) => {
                  // pressing empty space deselects, then may start a create-drag
                  if (e.target === e.currentTarget) setSelectedId(null);
                  create.onPointerDown(e, d);
                }}
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
                  const height = Math.max(
                    26,
                    ((endM - startM) / 60) * HOUR_H - 2
                  );
                  const selected = selectedId === b.id;
                  return (
                    <div
                      key={b.id}
                      className={`block${selected ? " selected" : ""}${
                        isDragging ? " dragging" : ""
                      }`}
                      style={{ top, height, ...blockStyle(cat) }}
                      onPointerDown={(e) => drag.onPointerDown(e, b)}
                      onPointerMove={drag.onPointerMove}
                      onPointerUp={drag.onPointerUp}
                      title={selected ? "Click again to edit, or drag to move" : "Click to select"}
                    >
                      <button
                        className="b-del"
                        aria-label="Delete block"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectedId === b.id) setSelectedId(null);
                          deleteBlock(b.id);
                        }}
                      >
                        <XSmall />
                      </button>
                      <span className="b-title">{b.title || cat.name}</span>
                      <span className="b-time">
                        {fmtTime(startM)} – {fmtTime(endM)}
                      </span>
                    </div>
                  );
                })}
                {create.preview && create.preview.day === d && (
                  <div
                    className="drag-preview"
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
                {now !== null && <div className="now-line" style={{ top: now }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
