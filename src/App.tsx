import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "./store";
import { Rail } from "./components/Rail";
import { TopBar } from "./components/TopBar";
import { DayPills } from "./components/DayPills";
import { WeekView } from "./components/WeekView";
import { DayView } from "./components/DayView";
import { OverviewCard } from "./components/OverviewCard";
import { TaskList } from "./components/TaskList";
import { GCalCard } from "./components/GCalCard";
import { AddBlockModal } from "./components/AddBlockModal";
import { AllocationModal } from "./components/AllocationModal";

function App() {
  const view = useStore((s) => s.view);
  const [blockOpen, setBlockOpen] = useState(false);
  const [allocOpen, setAllocOpen] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2000);
  }, []);

  // "c" keyboard shortcut for Add Block
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setBlockOpen(false);
        setAllocOpen(false);
        return;
      }
      if (e.key === "c" && !blockOpen && !allocOpen) {
        const tag = (document.activeElement?.tagName || "").toUpperCase();
        if (tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA") {
          e.preventDefault();
          setBlockOpen(true);
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [blockOpen, allocOpen]);

  // re-render every minute to move the now-line
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 60000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="app-shell">
      <Rail onOpenAllocation={() => setAllocOpen(true)} />

      <div className="content-col">
        <TopBar onAddBlock={() => setBlockOpen(true)} />
        {view === "day" && <DayPills />}
        {view === "week" ? <WeekView /> : <DayView />}
      </div>

      <div className="sidebar">
        <OverviewCard />
        <TaskList />
        <div className="card">
          <GCalCard />
        </div>
      </div>

      <AddBlockModal
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        onSaved={() => showToast("Block added")}
      />
      <AllocationModal open={allocOpen} onClose={() => setAllocOpen(false)} />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default App;
