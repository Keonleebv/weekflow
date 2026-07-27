import { useStore } from "../store";
import { CalendarIcon, SlidersIcon, GearIcon, BookIcon } from "./icons";

type Props = {
  onOpenAllocation: () => void;
};

export function Rail({ onOpenAllocation }: Props) {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);

  return (
    <div className="rail">
      <div className="logo-dot">W</div>
      <div className="rail-nav">
        <button
          className={`rail-btn ${mode === "planner" ? "active" : ""}`}
          title="Planner"
          aria-label="Planner"
          onClick={() => setMode("planner")}
        >
          <CalendarIcon />
        </button>
        <button
          className="rail-btn"
          title="Allocation options"
          aria-label="Allocation options"
          onClick={onOpenAllocation}
        >
          <SlidersIcon />
        </button>
        <button
          className={`rail-btn ${mode === "journal" ? "active" : ""}`}
          title="Journal"
          aria-label="Journal"
          onClick={() => setMode("journal")}
        >
          <BookIcon />
        </button>
      </div>
      <div className="rail-bottom">
        <button
          className="rail-btn"
          title="Settings"
          aria-label="Settings"
          onClick={onOpenAllocation}
        >
          <GearIcon />
        </button>
      </div>
    </div>
  );
}
