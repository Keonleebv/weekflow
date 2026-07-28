import { useStore } from "../store";
import { isElapsed } from "../lib/time";
import type { Block } from "../types";

/**
 * One-tap estimate-accuracy check shown once a block's time has elapsed and it
 * hasn't been answered or dismissed. `estimateAccuracy` states:
 *   undefined = never asked (prompt shows), a string = answered, null = dismissed.
 */
export function EstimatePrompt({ block }: { block: Block }) {
  const updateBlock = useStore((s) => s.updateBlock);

  if (block.estimateAccuracy !== undefined) return null;
  if (!isElapsed(block.date, block.endMinutes)) return null;

  const set = (v: Block["estimateAccuracy"]) =>
    updateBlock(block.id, { estimateAccuracy: v });

  return (
    <div className="est-prompt" onPointerDown={(e) => e.stopPropagation()}>
      <span className="est-q">Time estimate?</span>
      <button type="button" className="est-btn" onClick={() => set("accurate")}>
        About right
      </button>
      <button type="button" className="est-btn" onClick={() => set("over")}>
        Took longer
      </button>
      <button type="button" className="est-btn" onClick={() => set("under")}>
        Was faster
      </button>
      <button
        type="button"
        className="est-dismiss"
        aria-label="Dismiss"
        onClick={() => set(null)}
      >
        ×
      </button>
    </div>
  );
}
