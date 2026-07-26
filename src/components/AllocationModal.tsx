import { useState } from "react";
import { useStore } from "../store";
import { PALETTE } from "../lib/palette";
import { CloseIcon, TrashIcon } from "./icons";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AllocationModal({ open, onClose }: Props) {
  const categories = useStore((s) => s.categories);
  const updateCategory = useStore((s) => s.updateCategory);
  const deleteCategory = useStore((s) => s.deleteCategory);
  const addCategory = useStore((s) => s.addCategory);

  const [swatchFor, setSwatchFor] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  if (!open) return null;

  const openSwatch = (id: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setSwatchFor({ id, x: rect.left, y: rect.bottom + 6 });
  };

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-head">
          <h3>Allocation Options</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <p
          style={{
            color: "var(--text-faint)",
            fontSize: 12,
            marginTop: -8,
            marginBottom: 14,
          }}
        >
          Create, recolor, or set a weekly goal for each category. Blocks and tasks read
          from this list.
        </p>

        <div>
          {categories.map((c) => (
            <div className="alloc-row" key={c.id}>
              <button
                type="button"
                className="swatch-btn"
                style={{ background: c.color }}
                aria-label="Change color"
                onClick={(e) => openSwatch(c.id, e)}
              />
              <input
                type="text"
                className="alloc-name"
                value={c.name}
                onChange={(e) => updateCategory(c.id, { name: e.target.value })}
                onBlur={(e) =>
                  updateCategory(c.id, { name: e.target.value.trim() || "Untitled" })
                }
              />
              <div style={{ textAlign: "center" }}>
                <input
                  type="number"
                  min={0}
                  max={80}
                  className="alloc-goal"
                  value={c.weeklyGoalHours ?? 0}
                  onChange={(e) =>
                    updateCategory(c.id, {
                      weeklyGoalHours: Math.max(0, parseInt(e.target.value, 10) || 0),
                    })
                  }
                />
                <div className="alloc-goal-label">hrs / wk</div>
              </div>
              <button
                type="button"
                className="icon-btn"
                title="Delete category"
                aria-label="Delete category"
                onClick={() => {
                  if (categories.length <= 1) {
                    alert("You need at least one category.");
                    return;
                  }
                  if (
                    confirm(
                      "Delete this category? Its blocks and tasks will be removed too."
                    )
                  ) {
                    deleteCategory(c.id);
                  }
                }}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>

        <button className="new-cat-btn" onClick={addCategory}>
          + New category
        </button>
      </div>

      {swatchFor && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 59 }}
            onClick={() => setSwatchFor(null)}
          />
          <div
            className="swatch-pop"
            style={{ left: swatchFor.x, top: swatchFor.y }}
          >
            {PALETTE.map((p) => (
              <button
                key={p}
                type="button"
                className="sw"
                style={{ background: p }}
                onClick={() => {
                  updateCategory(swatchFor.id, { color: p });
                  setSwatchFor(null);
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
