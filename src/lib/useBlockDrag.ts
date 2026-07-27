import { useRef, useState } from "react";
import { HOUR_H, SNAP_MIN } from "./time";
import type { Block } from "../types";

const GRID_MIN = 0;
const GRID_MAX = 24 * 60;
const MIN_DUR = SNAP_MIN; // smallest block a resize can produce
const MOVE_THRESHOLD = 4; // px before a press counts as a drag rather than a tap

export type DragMode = "move" | "resize-start" | "resize-end";
export type LiveDrag = { id: string; start: number; end: number } | null;

type Opts = {
  /** Commit a moved/resized block (called once, on release). */
  onMove: (id: string, start: number, end: number) => void;
  /** A plain tap with no drag (e.g. select, or open editor). */
  onTap: (block: Block) => void;
  /** Whether this block may be dragged right now (both views gate on selection). */
  canDrag: (block: Block) => boolean;
};

function isInteractive(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  return !!node?.closest?.("button,input,textarea,label,select");
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/**
 * Press-and-drag to move or resize a time block, snapping to SNAP_MIN.
 * `mode` decides the gesture: "move" (whole block, preserves duration),
 * "resize-start" (top edge → start time), "resize-end" (bottom edge → end).
 * A press that never crosses MOVE_THRESHOLD is treated as a tap.
 */
export function useBlockDrag({ onMove, onTap, canDrag }: Opts) {
  const [live, setLive] = useState<LiveDrag>(null);
  const st = useRef<{
    block: Block;
    mode: DragMode;
    startY: number;
    moved: boolean;
    pointerId: number;
    el: HTMLElement;
    live: { start: number; end: number } | null;
  } | null>(null);

  const onPointerDown = (
    e: React.PointerEvent,
    block: Block,
    mode: DragMode = "move"
  ) => {
    if (isInteractive(e.target)) return;
    if (mode !== "move") e.stopPropagation(); // edge handle shouldn't also move
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    st.current = {
      block,
      mode,
      startY: e.clientY,
      moved: false,
      pointerId: e.pointerId,
      el,
      live: null,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = st.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    if (!d.moved) {
      if (Math.abs(dy) < MOVE_THRESHOLD) return;
      if (!canDrag(d.block)) return; // must be selected first
      d.moved = true;
    }
    const delta = Math.round(((dy / HOUR_H) * 60) / SNAP_MIN) * SNAP_MIN;
    const { startMinutes: s, endMinutes: en } = d.block;
    let start = s;
    let end = en;
    if (d.mode === "move") {
      start = s + delta;
      end = en + delta;
      if (start < GRID_MIN) {
        end += GRID_MIN - start;
        start = GRID_MIN;
      }
      if (end > GRID_MAX) {
        start -= end - GRID_MAX;
        end = GRID_MAX;
      }
    } else if (d.mode === "resize-start") {
      start = clamp(s + delta, GRID_MIN, en - MIN_DUR);
    } else {
      end = clamp(en + delta, s + MIN_DUR, GRID_MAX);
    }
    d.live = { start, end };
    setLive({ id: d.block.id, start, end });
  };

  const onPointerUp = () => {
    const d = st.current;
    if (!d) return;
    try {
      d.el.releasePointerCapture(d.pointerId);
    } catch {
      // already released
    }
    if (d.moved && d.live) onMove(d.block.id, d.live.start, d.live.end);
    else onTap(d.block);
    st.current = null;
    setLive(null);
  };

  return { live, onPointerDown, onPointerMove, onPointerUp };
}
