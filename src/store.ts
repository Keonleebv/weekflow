import { create } from "zustand";
import { persist } from "zustand/middleware";
import { addDays, format } from "date-fns";
import type {
  Block,
  Category,
  JournalEntry,
  JournalSummary,
  JournalVariant,
  Mode,
  Mood,
  Task,
  View,
} from "./types";
import { track } from "@vercel/analytics";
import { nextUnusedColor } from "./lib/palette";
import { uid, weekStartISO, todayIndexInWeek } from "./lib/time";

type State = {
  categories: Category[];
  blocks: Block[];
  tasks: Task[];
  view: View;
  mode: Mode;
  selectedDay: number;
  currentWeekStart: string;
  journalEntries: Record<number, JournalEntry>;
  journalVariant: JournalVariant;
  sidebarOpen: boolean; // overview/task sidebar collapse (both modes)
  onboarded: boolean; // false only for a genuine new user (first-run carousel)
  // transient: minute-of-day that Day view should scroll to on next mount
  // (set when jumping from a Week-view block). Not persisted.
  pendingScrollMinutes: number | null;
};

type Actions = {
  setView: (v: View) => void;
  setMode: (m: Mode) => void;
  setSelectedDay: (d: number) => void;
  focusDay: (day: number, minutes: number) => void;
  clearPendingScroll: () => void;
  prevWeek: () => void;
  nextWeek: () => void;

  addBlock: (b: Omit<Block, "id" | "weekOf"> & { weekOf?: string }) => void;
  updateBlock: (id: string, patch: Partial<Block>) => void;
  deleteBlock: (id: string) => void;

  addTask: (t: { title: string; blockId?: string; categoryId?: string }) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;

  addCategory: () => void;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  setJournalVariant: (v: JournalVariant) => void;
  toggleSidebar: () => void;
  completeOnboarding: () => void;
  setJournalMood: (day: number, mood: Mood) => void;
  setJournalOverall: (day: number, text: string) => void;
  setJournalBlockNote: (day: number, blockId: string, text: string) => void;
  setJournalSummary: (day: number, summary: JournalSummary | null) => void;
};

const blankEntry = (): JournalEntry => ({
  mood: null,
  overallBody: "",
  blockNotes: {},
  summary: null,
});

// A genuine new user starts here: three generic starter categories with no
// weekly goals set yet (Allocation options is where they'd set those), and
// nothing scheduled, tasked, or journaled. `onboarded: false` triggers the
// first-run carousel. (The old demo week lives only in git history.)
function blankState(): State {
  const currentWeekStart = weekStartISO(new Date());
  const todayIdx = todayIndexInWeek(currentWeekStart);
  const categories: Category[] = [
    { id: "g1", name: "Work", color: "#7c6cf6" },
    { id: "g2", name: "Personal", color: "#34d399" },
    { id: "g3", name: "Health", color: "#f2555a" },
  ];
  return {
    categories,
    blocks: [],
    tasks: [],
    view: "week",
    mode: "planner",
    selectedDay: todayIdx >= 0 ? todayIdx : 0,
    currentWeekStart,
    journalEntries: {},
    journalVariant: "block",
    sidebarOpen: true,
    onboarded: false,
    pendingScrollMinutes: null,
  };
}

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      ...blankState(),

      setView: (view) => set({ view }),
      setMode: (mode) => set({ mode }),
      setSelectedDay: (selectedDay) => set({ selectedDay }),
      focusDay: (day, minutes) =>
        set({ selectedDay: day, view: "day", pendingScrollMinutes: minutes }),
      clearPendingScroll: () => set({ pendingScrollMinutes: null }),
      prevWeek: () =>
        set((s) => ({
          currentWeekStart: format(
            addDays(new Date(s.currentWeekStart + "T00:00:00"), -7),
            "yyyy-MM-dd"
          ),
        })),
      nextWeek: () =>
        set((s) => ({
          currentWeekStart: format(
            addDays(new Date(s.currentWeekStart + "T00:00:00"), 7),
            "yyyy-MM-dd"
          ),
        })),

      addBlock: (b) => {
        set((s) => ({
          blocks: [
            ...s.blocks,
            { ...b, id: uid("b"), weekOf: b.weekOf ?? s.currentWeekStart },
          ],
        }));
        track("block_created");
      },
      updateBlock: (id, patch) =>
        set((s) => ({
          blocks: s.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
        })),
      deleteBlock: (id) =>
        set((s) => ({
          blocks: s.blocks.filter((b) => b.id !== id),
          tasks: s.tasks.filter((t) => t.blockId !== id),
        })),

      addTask: ({ title, blockId, categoryId }) =>
        set((s) => ({
          tasks: [
            ...s.tasks,
            {
              id: uid("t"),
              title,
              blockId,
              categoryId,
              done: false,
              createdAt: new Date().toISOString(),
            },
          ],
        })),
      toggleTask: (id) => {
        const t = get().tasks.find((x) => x.id === id);
        const becomingDone = t ? !t.done : false;
        set((s) => ({
          tasks: s.tasks.map((x) =>
            x.id === id ? { ...x, done: !x.done } : x
          ),
        }));
        if (becomingDone) track("task_completed");
      },
      deleteTask: (id) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      addCategory: () => {
        set((s) => {
          const color = nextUnusedColor(s.categories.map((c) => c.color));
          return {
            categories: [
              ...s.categories,
              { id: uid("c"), name: "New Category", color, weeklyGoalHours: 0 },
            ],
          };
        });
        track("category_created");
      },
      updateCategory: (id, patch) =>
        set((s) => ({
          categories: s.categories.map((c) =>
            c.id === id ? { ...c, ...patch } : c
          ),
        })),
      deleteCategory: (id) => {
        if (get().categories.length <= 1) return;
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          blocks: s.blocks.filter((b) => b.categoryId !== id),
          tasks: s.tasks.filter((t) => t.categoryId !== id),
        }));
      },

      setJournalVariant: (journalVariant) => set({ journalVariant }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      completeOnboarding: () => set({ onboarded: true }),
      setJournalMood: (day, mood) =>
        set((s) => {
          const entry = s.journalEntries[day] ?? blankEntry();
          return {
            journalEntries: {
              ...s.journalEntries,
              // tapping the selected mood again clears it
              [day]: { ...entry, mood: entry.mood === mood ? null : mood },
            },
          };
        }),
      setJournalOverall: (day, text) =>
        set((s) => {
          const entry = s.journalEntries[day] ?? blankEntry();
          return {
            journalEntries: {
              ...s.journalEntries,
              [day]: { ...entry, overallBody: text },
            },
          };
        }),
      setJournalBlockNote: (day, blockId, text) =>
        set((s) => {
          const entry = s.journalEntries[day] ?? blankEntry();
          return {
            journalEntries: {
              ...s.journalEntries,
              [day]: {
                ...entry,
                blockNotes: { ...entry.blockNotes, [blockId]: text },
              },
            },
          };
        }),
      setJournalSummary: (day, summary) =>
        set((s) => {
          const entry = s.journalEntries[day] ?? blankEntry();
          return {
            journalEntries: {
              ...s.journalEntries,
              [day]: { ...entry, summary },
            },
          };
        }),
    }),
    {
      name: "weekflow-state",
      // pendingScrollMinutes is a transient UI signal — don't persist it
      partialize: (s) => ({
        categories: s.categories,
        blocks: s.blocks,
        tasks: s.tasks,
        view: s.view,
        mode: s.mode,
        selectedDay: s.selectedDay,
        currentWeekStart: s.currentWeekStart,
        journalEntries: s.journalEntries,
        journalVariant: s.journalVariant,
        sidebarOpen: s.sidebarOpen,
        onboarded: s.onboarded,
      }),
      // Anyone with a pre-existing save has already seen the app — don't
      // re-show onboarding to them just because the flag is newly added.
      // A genuinely fresh user has no persisted state → keep onboarded:false.
      merge: (persisted, current) => {
        if (!persisted) return current;
        const p = persisted as Partial<State>;
        return {
          ...current,
          ...p,
          onboarded: p.onboarded ?? true,
        };
      },
    }
  )
);
