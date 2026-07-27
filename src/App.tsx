import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "./store";
import { Rail } from "./components/Rail";
import { TopBar } from "./components/TopBar";
import { DayPills } from "./components/DayPills";
import { WeekView } from "./components/WeekView";
import { DayView } from "./components/DayView";
import { JournalView } from "./components/JournalView";
import { OverviewCard } from "./components/OverviewCard";
import { TaskList } from "./components/TaskList";
import { GCalCard } from "./components/GCalCard";
import { AddBlockModal } from "./components/AddBlockModal";
import { AllocationModal } from "./components/AllocationModal";
import type { Block } from "./types";

type Prefill = { day: number; start: number; end: number };

function App() {
  const view = useStore((s) => s.view);
  const mode = useStore((s) => s.mode);
  const journalSidebarOpen = useStore((s) => s.journalSidebarOpen);
  const [blockOpen, setBlockOpen] = useState(false);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [allocOpen, setAllocOpen] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2000);
  }, []);

  const openAdd = useCallback((p: Prefill | null = null) => {
    setEditingBlock(null);
    setPrefill(p);
    setBlockOpen(true);
  }, []);

  const openEdit = useCallback((block: Block) => {
    setPrefill(null);
    setEditingBlock(block);
    setBlockOpen(true);
  }, []);

  const closeBlock = useCallback(() => {
    setBlockOpen(false);
    setEditingBlock(null);
    setPrefill(null);
  }, []);

  // "c" keyboard shortcut for Add Block
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeBlock();
        setAllocOpen(false);
        return;
      }
      if (e.key === "c" && mode === "planner" && !blockOpen && !allocOpen) {
        const tag = (document.activeElement?.tagName || "").toUpperCase();
        if (tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA") {
          e.preventDefault();
          openAdd();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [blockOpen, allocOpen, openAdd, closeBlock, mode]);

  // re-render every minute to move the now-line
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 60000);
    return () => window.clearInterval(id);
  }, []);

  const shellClass =
    mode === "journal" && !journalSidebarOpen
      ? "app-shell sidebar-collapsed"
      : "app-shell";

  return (
    <div className={shellClass}>
      <Rail onOpenAllocation={() => setAllocOpen(true)} />

      <div className="content-col">
        <TopBar onAddBlock={() => openAdd()} />
        {(mode === "journal" || view === "day") && <DayPills />}
        {mode === "journal" ? (
          <JournalView />
        ) : view === "week" ? (
          <WeekView onCreateRange={openAdd} onEdit={openEdit} />
        ) : (
          <DayView onCreateRange={openAdd} onEdit={openEdit} />
        )}
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
        prefill={prefill}
        editing={editingBlock}
        onClose={closeBlock}
        onSaved={(msg) => showToast(msg)}
      />
      <AllocationModal open={allocOpen} onClose={() => setAllocOpen(false)} />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default App;
