import { addDays, format } from "date-fns";
import { useStore } from "../store";
import { ChevronLeft, ChevronRight, PlusIcon, PanelIcon } from "./icons";

type Props = {
  onAddBlock: () => void;
};

export function TopBar({ onAddBlock }: Props) {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const mode = useStore((s) => s.mode);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const currentWeekStart = useStore((s) => s.currentWeekStart);
  const prevWeek = useStore((s) => s.prevWeek);
  const nextWeek = useStore((s) => s.nextWeek);

  const monday = new Date(currentWeekStart + "T00:00:00");
  const sunday = addDays(monday, 6);
  const sameYear = monday.getFullYear() === sunday.getFullYear();
  const rangeStr = `${format(monday, "MMM d")} – ${format(sunday, "MMM d")}`;
  const yearStr = sameYear ? format(sunday, "yyyy") : "";

  const isJournal = mode === "journal";

  const collapseBtn = (
    <button
      className={`sidebar-toggle-btn ${sidebarOpen ? "" : "collapsed"}`}
      onClick={toggleSidebar}
      title={sidebarOpen ? "Hide overview panel" : "Show overview panel"}
      aria-label="Toggle overview panel"
    >
      <PanelIcon />
    </button>
  );

  return (
    <div className="topbar">
      <div className="nav-arrows">
        <button onClick={prevWeek} aria-label="Previous week">
          <ChevronLeft />
        </button>
        <button onClick={nextWeek} aria-label="Next week">
          <ChevronRight />
        </button>
      </div>
      <div className="date-range">
        <strong>{rangeStr}</strong>
        {yearStr ? `, ${yearStr}` : ""}
      </div>

      {isJournal ? (
        <div style={{ marginLeft: "auto" }}>{collapseBtn}</div>
      ) : (
        <>
          <div className="view-toggle">
            <button
              className={view === "week" ? "active" : ""}
              onClick={() => setView("week")}
            >
              Week
            </button>
            <button
              className={view === "day" ? "active" : ""}
              onClick={() => setView("day")}
            >
              Day
            </button>
          </div>
          <button className="btn-primary" onClick={onAddBlock} aria-label="Add block">
            <PlusIcon />
            Add Block
          </button>
          {collapseBtn}
        </>
      )}
    </div>
  );
}
