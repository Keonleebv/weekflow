import { useRef, useState } from "react";
import { HOUR_H, SNAP_MIN } from "./time";
import type { Block } from "../types";

const GRID_MIN = 0;
const GRID_MAX = 24 * 60;
const MOVE_THRESHOLD = 4; // px before a press counts as a drag rather than a tap

export type LiveDrag = { id: string; start: number; end: number } | null;

type Opts = {
  /** Commit a moved block (called once, on release). */
  onMove: (id: string, start: number, end: number) => void;
  /** A plain tap with no drag (e.g. select or open editor). */
  onTap: (block: Block) => void;
  /** Whether this block may be dragged right now (Week view gates on selection). */
  canDrag: (block: Block) => boolean;
};

function isInteractive(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  return !!node?.closest?.("button,input,textarea,label,select");
}

/**
 * Press-and-drag to move a time block, preserving its duration and snapping to
 * SNAP_MIN. A press that never crosses MOVE_THRESHOLD is treated as a tap.
 * Interactive children (checkboxes, notes, delete) are left alone.
 */
export function useBlockDrag({ onMove, onTap, canDrag }: Opts) {
  const [live, setLive] = useState<LiveDrag>(null);
  const st = useRef<{
    block: Block;
    startY: number;
    moved: boolean;
    pointerId: number;
    el: HTMLElement;
    live: { start: number; end: number } | null;
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent, block: Block) => {
    if (isInteractive(e.target)) return;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    st.current = {
      block,
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
      if (!canDrag(d.block)) return; // e.g. unselected block in Week view
      d.moved = true;
    }
    const deltaMin =
      Math.round(((dy / HOUR_H) * 60) / SNAP_MIN) * SNAP_MIN;
    let start = d.block.startMinutes + deltaMin;
    let end = d.block.endMinutes + deltaMin;
    if (start < GRID_MIN) {
      end += GRID_MIN - start;
      start = GRID_MIN;
    }
    if (end > GRID_MAX) {
      start -= end - GRID_MAX;
      end = GRID_MAX;
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
