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
import { nextUnusedColor } from "./lib/palette";
import { uid, weekStartISO } from "./lib/time";

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

function seed(): State {
  const currentWeekStart = weekStartISO(new Date());
  const categories: Category[] = [
    { id: "c1", name: "App Dev", color: "#7c6cf6", weeklyGoalHours: 14 },
    { id: "c2", name: "Resume & Career", color: "#34d399", weeklyGoalHours: 6 },
    { id: "c3", name: "Personal Projects", color: "#f2a93b", weeklyGoalHours: 8 },
    { id: "c4", name: "Exercise", color: "#f2555a", weeklyGoalHours: 5 },
    { id: "c5", name: "Learning", color: "#c084fc", weeklyGoalHours: 5 },
    { id: "c6", name: "Other", color: "#94a3b8", weeklyGoalHours: 2 },
  ];
  const B = (
    categoryId: string,
    day: number,
    startMinutes: number,
    endMinutes: number,
    title = ""
  ): Block => ({
    id: uid("b"),
    categoryId,
    day,
    startMinutes,
    endMinutes,
    title,
    weekOf: currentWeekStart,
  });
  const blocks: Block[] = [
    B("c4", 0, 420, 480), B("c1", 0, 540, 660), B("c6", 0, 720, 750, "Lunch Break"), B("c2", 0, 840, 960), B("c5", 0, 1140, 1200),
    B("c4", 1, 420, 480), B("c1", 1, 540, 720), B("c3", 1, 840, 900), B("c5", 1, 1140, 1200),
    B("c4", 2, 420, 480), B("c1", 2, 540, 660), B("c6", 2, 720, 750, "Lunch Break"), B("c3", 2, 840, 960), B("c2", 2, 960, 1020),
    B("c4", 3, 420, 480), B("c1", 3, 540, 720), B("c6", 3, 720, 750, "Lunch Break"), B("c3", 3, 840, 960), B("c5", 3, 1140, 1200),
    B("c4", 4, 420, 480), B("c1", 4, 540, 780), B("c6", 4, 780, 810, "Lunch Break"), B("c2", 4, 840, 960),
    B("c3", 5, 600, 780),
    B("c5", 6, 900, 960), B("c2", 6, 960, 1020),
  ];
  const byDayCat = (day: number, cat: string) =>
    blocks.find((b) => b.day === day && b.categoryId === cat)!;
  const wedApp = byDayCat(2, "c1");
  const wedEx = byDayCat(2, "c4");
  const wedLunch = byDayCat(2, "c6");
  const wedPP = byDayCat(2, "c3");
  const wedRC = byDayCat(2, "c2");
  const T = (
    blockId: string,
    categoryId: string,
    title: string,
    done: boolean
  ): Task => ({ id: uid("t"), blockId, categoryId, title, done, createdAt: new Date().toISOString() });
  const tasks: Task[] = [
    T(wedEx.id, "c4", "Morning run", true),
    T(wedApp.id, "c1", "Auth flow", true),
    T(wedApp.id, "c1", "Fix API bug", true),
    T(wedApp.id, "c1", "Repo setup", true),
    T(wedLunch.id, "c6", "Step outside", false),
    T(wedPP.id, "c3", "Write blog post draft", true),
    T(wedPP.id, "c3", "Update portfolio", true),
    T(wedRC.id, "c2", "Tailor resume for Anthropic", false),
  ];

  return {
    categories,
    blocks,
    tasks,
    view: "week",
    mode: "planner",
    selectedDay: 2,
    currentWeekStart,
    journalEntries: {},
    journalVariant: "block",
    sidebarOpen: true,
    pendingScrollMinutes: null,
  };
}

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      ...seed(),

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

      addBlock: (b) =>
        set((s) => ({
          blocks: [
            ...s.blocks,
            { ...b, id: uid("b"), weekOf: b.weekOf ?? s.currentWeekStart },
          ],
        })),
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
      toggleTask: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, done: !t.done } : t
          ),
        })),
      deleteTask: (id) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      addCategory: () =>
        set((s) => {
          const color = nextUnusedColor(s.categories.map((c) => c.color));
          return {
            categories: [
              ...s.categories,
              { id: uid("c"), name: "New Category", color, weeklyGoalHours: 0 },
            ],
          };
        }),
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
      }),
    }
  )
);
