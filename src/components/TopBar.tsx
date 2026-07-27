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
  const variant = useStore((s) => s.journalVariant);
  const setJournalVariant = useStore((s) => s.setJournalVariant);
  const journalSidebarOpen = useStore((s) => s.journalSidebarOpen);
  const toggleJournalSidebar = useStore((s) => s.toggleJournalSidebar);
  const currentWeekStart = useStore((s) => s.currentWeekStart);
  const prevWeek = useStore((s) => s.prevWeek);
  const nextWeek = useStore((s) => s.nextWeek);

  const monday = new Date(currentWeekStart + "T00:00:00");
  const sunday = addDays(monday, 6);
  const sameYear = monday.getFullYear() === sunday.getFullYear();
  const rangeStr = `${format(monday, "MMM d")} – ${format(sunday, "MMM d")}`;
  const yearStr = sameYear ? format(sunday, "yyyy") : "";

  const isJournal = mode === "journal";

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
        <>
          <div className="view-toggle" style={{ marginLeft: "auto" }}>
            <button
              className={variant === "block" ? "active" : ""}
              onClick={() => setJournalVariant("block")}
            >
              By Block
            </button>
            <button
              className={variant === "plain" ? "active" : ""}
              onClick={() => setJournalVariant("plain")}
            >
              Freeform Only
            </button>
          </div>
          <button
            className={`sidebar-toggle-btn ${journalSidebarOpen ? "" : "collapsed"}`}
            onClick={toggleJournalSidebar}
            title={journalSidebarOpen ? "Hide overview panel" : "Show overview panel"}
            aria-label="Toggle overview panel"
          >
            <PanelIcon />
          </button>
        </>
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
        </>
      )}
    </div>
  );
}
