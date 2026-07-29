import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { useGCal, gcalDayItems } from "../lib/gcal";
import { layoutDay, columnStyle, seamLeft } from "../lib/layout";
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
  todayISO,
  datesOfWeek,
  parseISO,
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

type NativeItem = { kind: "native"; id: string; start: number; end: number; block: Block };
type GEventItem = { kind: "gcal"; id: string; start: number; end: number; title: string };
type Item = NativeItem | GEventItem;

export function WeekView({ onCreateRange, onEdit }: Props) {
  const blocks = useStore((s) => s.blocks);
  const categories = useStore((s) => s.categories);
  const currentWeekStart = useStore((s) => s.currentWeekStart);
  const deleteBlock = useStore((s) => s.deleteBlock);
  const skipOccurrence = useStore((s) => s.skipOccurrence);
  const updateBlock = useStore((s) => s.updateBlock);
  const gridEvents = useGCal((s) => s.gridEvents);

  const removeBlock = (b: Block) =>
    b.recurrence !== null ? skipOccurrence(b.id) : deleteBlock(b.id);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const create = useDragCreate(onCreateRange);
  const drag = useBlockDrag({
    onMove: (id, start, end) =>
      updateBlock(id, { startMinutes: start, endMinutes: end }),
    onTap: (block) => {
      if (selectedId === block.id) {
        setSelectedId(null);
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
  const today = todayISO();
  const weekDates = datesOfWeek(currentWeekStart);
  const visibleBlocks = blocks.filter((b) => !b.skipped);

  const hours: number[] = [];
  for (let h = GRID_START_H; h <= GRID_END_H; h++) hours.push(h);

  return (
    <div className="view-panel">
      <div className="week-header">
        <div className="hd" />
        {weekDates.map((iso, i) => (
          <div key={iso} className={`hd ${iso === today ? "is-today" : ""}`}>
            <span className="dname">{DAYS[i].toUpperCase()}</span>
            <span className="dnum">{parseISO(iso).getDate()}</span>
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
          {weekDates.map((iso) => {
            const dayBlocks = visibleBlocks.filter((b) => b.date === iso);
            const items: Item[] = [
              ...dayBlocks.map(
                (b): NativeItem => ({
                  kind: "native",
                  id: b.id,
                  start: b.startMinutes,
                  end: b.endMinutes,
                  block: b,
                })
              ),
              ...gcalDayItems(gridEvents, iso).map(
                (g): GEventItem => ({
                  kind: "gcal",
                  id: "g_" + g.id,
                  start: g.start,
                  end: g.end,
                  title: g.title,
                })
              ),
            ];
            const laid = layoutDay(items);
            const now = nowOffset(iso);
            return (
              <div
                key={iso}
                className="day-col"
                style={{ height: GRID_HEIGHT }}
                onPointerDown={(e) => {
                  if (e.target === e.currentTarget) setSelectedId(null);
                  create.onPointerDown(e, iso);
                }}
                onPointerMove={create.onPointerMove}
                onPointerUp={create.onPointerUp}
              >
                {laid.map((item) => {
                  const col = columnStyle(item.col, item.totalCols);
                  const seam = seamLeft(item.col, item.totalCols);

                  if (item.kind === "gcal") {
                    const top = offsetForMinutes(item.start);
                    const height = Math.max(
                      24,
                      ((item.end - item.start) / 60) * HOUR_H - 2
                    );
                    return (
                      <div key={item.id}>
                        <div
                          className="block gcal"
                          style={{ top, height, ...col }}
                          title={`${item.title} (Google Calendar — read-only)`}
                        >
                          <span className="b-title">
                            <span className="wk-gcal-badge">G</span>
                            {item.title}
                          </span>
                        </div>
                        {seam && (
                          <div
                            className="seam-handle"
                            style={{ left: seam, top: top + height / 2 - 13 }}
                          />
                        )}
                      </div>
                    );
                  }

                  const b = item.block;
                  const cat = catById(b.categoryId);
                  if (!cat) return null;
                  const isDragging = drag.live?.id === b.id;
                  const startM = isDragging ? drag.live!.start : b.startMinutes;
                  const endM = isDragging ? drag.live!.end : b.endMinutes;
                  const top = offsetForMinutes(startM);
                  const height = Math.max(26, ((endM - startM) / 60) * HOUR_H - 2);
                  const selected = selectedId === b.id;
                  return (
                    <div key={b.id}>
                      <div
                        className={`block${selected ? " selected" : ""}${
                          isDragging ? " dragging" : ""
                        }`}
                        style={{ top, height, ...blockStyle(cat), ...col }}
                        onPointerDown={(e) => drag.onPointerDown(e, b)}
                        onPointerMove={drag.onPointerMove}
                        onPointerUp={drag.onPointerUp}
                        title={
                          selected
                            ? "Drag to move, drag edges to resize, click to edit"
                            : "Click to select"
                        }
                      >
                        <button
                          className="b-del"
                          aria-label="Delete block"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedId === b.id) setSelectedId(null);
                            removeBlock(b);
                          }}
                        >
                          <XSmall />
                        </button>
                        <span className="b-title">{b.title || cat.name}</span>
                        <span className="b-time">
                          {fmtTime(startM)} – {fmtTime(endM)}
                        </span>
                        {selected && (
                          <>
                            <div
                              className="resize-handle top"
                              onPointerDown={(e) =>
                                drag.onPointerDown(e, b, "resize-start")
                              }
                              onPointerMove={drag.onPointerMove}
                              onPointerUp={drag.onPointerUp}
                            />
                            <div
                              className="resize-handle bottom"
                              onPointerDown={(e) =>
                                drag.onPointerDown(e, b, "resize-end")
                              }
                              onPointerMove={drag.onPointerMove}
                              onPointerUp={drag.onPointerUp}
                            />
                          </>
                        )}
                      </div>
                      {seam && (
                        <div
                          className="seam-handle"
                          style={{ left: seam, top: top + height / 2 - 13 }}
                        />
                      )}
                    </div>
                  );
                })}
                {create.preview && create.preview.date === iso && (
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
