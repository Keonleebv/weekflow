import { useRef, useState } from "react";
import { GRID_END_H, minutesFromOffset } from "./time";

export type Range = { day: number; start: number; end: number };

/**
 * Pointer drag-to-create for a time column. Attach the returned handlers to a
 * track element; dragging on empty space (target === the track itself) paints a
 * preview and, on release, calls `onCreate` with a snapped {day, start, end}.
 * A near-zero drag (a tap) still yields a default 1-hour block.
 */
export function useDragCreate(onCreate: (r: Range) => void) {
  const [preview, setPreview] = useState<Range | null>(null);
  const drag = useRef<{
    day: number;
    start: number;
    el: HTMLElement;
    pointerId: number;
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent, day: number) => {
    // only start on the track background, not on a child block
    if (e.target !== e.currentTarget) return;
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const m = minutesFromOffset(e.clientY - rect.top);
    el.setPointerCapture(e.pointerId);
    drag.current = { day, start: m, el, pointerId: e.pointerId };
    setPreview({ day, start: m, end: m });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const rect = d.el.getBoundingClientRect();
    const m = minutesFromOffset(e.clientY - rect.top);
    setPreview({
      day: d.day,
      start: Math.min(d.start, m),
      end: Math.max(d.start, m),
    });
  };

  const finish = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const rect = d.el.getBoundingClientRect();
    const m = minutesFromOffset(e.clientY - rect.top);
    let start = Math.min(d.start, m);
    let end = Math.max(d.start, m);
    if (end - start < 30) end = Math.min(GRID_END_H * 60, start + 60);
    if (start === end) start = Math.max(GRID_END_H * 60 - 60, start - 60);
    try {
      d.el.releasePointerCapture(d.pointerId);
    } catch {
      // pointer may already be released
    }
    drag.current = null;
    setPreview(null);
    onCreate({ day: d.day, start, end });
  };

  return { preview, onPointerDown, onPointerMove, onPointerUp: finish };
}
