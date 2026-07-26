import { CalendarIcon, SlidersIcon, GearIcon } from "./icons";

type Props = {
  onOpenAllocation: () => void;
};

export function Rail({ onOpenAllocation }: Props) {
  return (
    <div className="rail">
      <div className="logo-dot">W</div>
      <div className="rail-nav">
        <button className="rail-btn active" title="Planner" aria-label="Planner">
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
