import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useStore } from "../store";
import { useGCal, gcalDayItems } from "../lib/gcal";
import { layoutDay, columnStyle, seamLeft } from "../lib/layout";
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
import { EstimatePrompt } from "./EstimatePrompt";

function blockStyle(cat: Category): React.CSSProperties {
  return {
    background: cat.color + "22",
    borderColor: cat.color + "66",
    color: cat.color,
  };
}

/**
 * Scrollable block body. Block height is strictly time-based (§16), so content
 * scrolls internally instead of pushing the block taller and bleeding into the
 * next one. A bottom fade appears only when there's more to scroll to.
 */
function BlockScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  });
  return (
    <>
      <div className="dt-scroll" ref={ref}>
        {children}
      </div>
      {overflowing && <div className="dt-fade" />}
    </>
  );
}

type Props = {
  onCreateRange: (r: Range) => void;
  onEdit: (block: Block) => void;
};

// Combined timeline item: a native block or a read-only Google Calendar event.
type NativeItem = { kind: "native"; id: string; start: number; end: number; block: Block };
type GEventItem = { kind: "gcal"; id: string; start: number; end: number; title: string };
type Item = NativeItem | GEventItem;

export function DayView({ onCreateRange, onEdit }: Props) {
  const blocks = useStore((s) => s.blocks);
  const tasks = useStore((s) => s.tasks);
  const categories = useStore((s) => s.categories);
  const selectedDate = useStore((s) => s.selectedDate);
  const toggleTask = useStore((s) => s.toggleTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const deleteBlock = useStore((s) => s.deleteBlock);
  const skipOccurrence = useStore((s) => s.skipOccurrence);
  const updateBlock = useStore((s) => s.updateBlock);
  const gridEvents = useGCal((s) => s.gridEvents);

  const removeBlock = (b: Block) =>
    b.recurrence !== null ? skipOccurrence(b.id) : deleteBlock(b.id);

  // one click selects (highlights); a second click on the selected block opens
  // the editor. Only a selected block can be dragged to move/resize.
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
  const scrolledRef = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || scrolledRef.current) return; // guard StrictMode double-invoke
    scrolledRef.current = true;
    const pending = useStore.getState().pendingScrollMinutes;
    if (pending != null) {
      el.scrollTop = Math.max(0, offsetForMinutes(pending) - 80);
      useStore.getState().clearPendingScroll();
    } else {
      el.scrollTop = scrollToNowTop();
    }
  }, []);

  const catById = (id: string) => categories.find((c) => c.id === id);
  const dayBlocks = blocks.filter((b) => !b.skipped && b.date === selectedDate);
  const now = nowOffset(selectedDate);

  // Native blocks + Google events share one overlap layout (§18c) — column
  // widths are computed from stored times, so a live drag ghost moves vertically
  // without reshuffling columns every frame.
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
    ...gcalDayItems(gridEvents, selectedDate).map(
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
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) setSelectedId(null);
              create.onPointerDown(e, selectedDate);
            }}
            onPointerMove={create.onPointerMove}
            onPointerUp={create.onPointerUp}
          >
            {laid.map((item) => {
              const col = columnStyle(item.col, item.totalCols);
              const seam = seamLeft(item.col, item.totalCols);

              if (item.kind === "gcal") {
                const top = offsetForMinutes(item.start);
                const height = Math.max(24, ((item.end - item.start) / 60) * HOUR_H - 4);
                return (
                  <div key={item.id}>
                    <div
                      className="dt-gcal"
                      style={{ top, height, ...col }}
                      title={`${item.title} (from Google Calendar — read-only)`}
                    >
                      <span className="dt-gcal-badge">G</span>
                      <span className="dt-gcal-title">{item.title}</span>
                      <span className="dt-gcal-time">{fmtTime(item.start)}</span>
                    </div>
                    {seam && <Seam left={seam} top={top} height={height} />}
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
              const blockTasks = tasks.filter((t) => t.blockId === b.id);
              const height = Math.max(24, ((endM - startM) / 60) * HOUR_H - 4);
              const selected = selectedId === b.id;
              return (
                <div key={b.id}>
                  <div
                    className={`dt-block${selected ? " selected" : ""}${
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
                        onClick={() => {
                          if (selectedId === b.id) setSelectedId(null);
                          removeBlock(b);
                        }}
                      >
                        <XSmall />
                      </button>
                    </div>
                    <BlockScroll>
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
                            <button
                              className="task-del"
                              aria-label="Delete task"
                              title="Delete task"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={() => deleteTask(t.id)}
                            >
                              <XSmall />
                            </button>
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
                      <EstimatePrompt block={b} />
                    </BlockScroll>
                    {selected && (
                      <>
                        <div
                          className="resize-handle top"
                          onPointerDown={(e) => drag.onPointerDown(e, b, "resize-start")}
                          onPointerMove={drag.onPointerMove}
                          onPointerUp={drag.onPointerUp}
                        />
                        <div
                          className="resize-handle bottom"
                          onPointerDown={(e) => drag.onPointerDown(e, b, "resize-end")}
                          onPointerMove={drag.onPointerMove}
                          onPointerUp={drag.onPointerUp}
                        />
                      </>
                    )}
                  </div>
                  {seam && <Seam left={seam} top={top} height={height} />}
                </div>
              );
            })}
            {create.preview && create.preview.date === selectedDate && (
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

function Seam({ left, top, height }: { left: string; top: number; height: number }) {
  return (
    <div className="seam-handle" style={{ left, top: top + height / 2 - 13 }} />
  );
}
