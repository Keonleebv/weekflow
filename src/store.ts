import { create } from "zustand";
import { persist } from "zustand/middleware";
import { track } from "@vercel/analytics";
import type {
  Block,
  Category,
  JournalEntry,
  JournalSummary,
  Mode,
  Mood,
  Recurrence,
  Task,
  View,
  WeeklyDigest,
} from "./types";
import { nextUnusedColor } from "./lib/palette";
import {
  uid,
  todayISO,
  weekStartOfISO,
  addDaysISO,
  datesOfWeek,
  parseISO,
} from "./lib/time";

type State = {
  categories: Category[];
  blocks: Block[];
  tasks: Task[];
  view: View;
  mode: Mode;
  selectedDate: string; // ISO date
  currentWeekStart: string; // ISO Monday of the shown week
  journalEntries: Record<string, JournalEntry>; // keyed by ISO date
  weeklyDigests: Record<string, WeeklyDigest>; // keyed by weekOf
  sidebarOpen: boolean;
  onboarded: boolean;
  // transient: minute-of-day the Day view should scroll to on next mount
  pendingScrollMinutes: number | null;
};

type Actions = {
  setView: (v: View) => void;
  setMode: (m: Mode) => void;
  setSelectedDate: (d: string) => void;
  focusDate: (date: string, minutes: number) => void;
  clearPendingScroll: () => void;
  prevWeek: () => void;
  nextWeek: () => void;
  ensureCurrentWeek: () => void;

  addBlock: (b: {
    categoryId: string;
    title: string;
    date: string;
    startMinutes: number;
    endMinutes: number;
    recurrence?: Recurrence;
    notes?: string;
  }) => void;
  updateBlock: (id: string, patch: Partial<Block>) => void;
  deleteBlock: (id: string) => void;
  skipOccurrence: (id: string) => void; // "delete just this occurrence"
  stopRepeating: (id: string) => void; // "stop repeating" — ends the series

  addTask: (t: {
    title: string;
    date: string;
    blockId?: string;
    categoryId?: string;
  }) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;

  addCategory: () => void;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  toggleSidebar: () => void;
  completeOnboarding: () => void;
  resetForLogout: () => void;
  setJournalMood: (date: string, mood: Mood) => void;
  setJournalOverall: (date: string, text: string) => void;
  setJournalBlockNote: (date: string, blockId: string, text: string) => void;
  setJournalSummary: (date: string, summary: JournalSummary | null) => void;
  setWeeklyDigest: (weekOf: string, digest: WeeklyDigest | null) => void;
};

const blankEntry = (date: string): JournalEntry => ({
  date,
  mood: null,
  overallBody: "",
  blockNotes: {},
  summary: null,
});

const daysBetween = (a: string, b: string) =>
  Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);

/**
 * Lazily generate one recurring occurrence per series for `weekStart`, if the
 * pattern lands in that week and nothing already occupies that date (including
 * skipped tombstones and edited copies). The series template is the original
 * instance (id === seriesId) while its recurrence is still set. Returns the
 * blocks to append — never mutates.
 */
function generateForWeek(blocks: Block[], weekStart: string): Block[] {
  const weekDates = datesOfWeek(weekStart);
  const seriesIds = new Set(
    blocks.filter((b) => b.seriesId).map((b) => b.seriesId as string)
  );
  const created: Block[] = [];

  for (const sid of seriesIds) {
    const members = blocks.filter((b) => b.seriesId === sid);
    const template = members.find((b) => b.id === sid);
    if (!template || !template.recurrence) continue; // one-off original / stopped
    const interval = template.recurrence === "weekly" ? 7 : 14;

    for (const d of weekDates) {
      const diff = daysBetween(template.date, d);
      if (diff <= 0 || diff % interval !== 0) continue; // only future, on-cadence
      const occupied =
        members.some((b) => b.date === d) ||
        created.some((b) => b.seriesId === sid && b.date === d);
      if (occupied) continue;
      created.push({
        id: uid("b"),
        seriesId: sid,
        categoryId: template.categoryId,
        title: template.title,
        startMinutes: template.startMinutes,
        endMinutes: template.endMinutes,
        date: d,
        recurrence: template.recurrence,
      });
    }
  }
  return created;
}

function blankState(): State {
  const selectedDate = todayISO();
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
    selectedDate,
    currentWeekStart: weekStartOfISO(selectedDate),
    journalEntries: {},
    weeklyDigests: {},
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
      setSelectedDate: (selectedDate) => set({ selectedDate }),
      focusDate: (date, minutes) =>
        set({ selectedDate: date, view: "day", pendingScrollMinutes: minutes }),
      clearPendingScroll: () => set({ pendingScrollMinutes: null }),

      ensureCurrentWeek: () =>
        set((s) => {
          const created = generateForWeek(s.blocks, s.currentWeekStart);
          return created.length ? { blocks: [...s.blocks, ...created] } : {};
        }),
      prevWeek: () =>
        set((s) => {
          const currentWeekStart = addDaysISO(s.currentWeekStart, -7);
          const selectedDate = addDaysISO(s.selectedDate, -7);
          const created = generateForWeek(s.blocks, currentWeekStart);
          return {
            currentWeekStart,
            selectedDate,
            blocks: created.length ? [...s.blocks, ...created] : s.blocks,
          };
        }),
      nextWeek: () =>
        set((s) => {
          const currentWeekStart = addDaysISO(s.currentWeekStart, 7);
          const selectedDate = addDaysISO(s.selectedDate, 7);
          const created = generateForWeek(s.blocks, currentWeekStart);
          return {
            currentWeekStart,
            selectedDate,
            blocks: created.length ? [...s.blocks, ...created] : s.blocks,
          };
        }),

      addBlock: (b) => {
        const id = uid("b");
        const recurrence = b.recurrence ?? null;
        set((s) => ({
          blocks: [
            ...s.blocks,
            {
              id,
              categoryId: b.categoryId,
              title: b.title,
              date: b.date,
              startMinutes: b.startMinutes,
              endMinutes: b.endMinutes,
              recurrence,
              // a recurring block is its own series origin
              seriesId: recurrence ? id : undefined,
              notes: b.notes,
            },
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
          // keep the tasks — they're date-based (§13b) and should still carry
          // over; just unlink them from the deleted block.
          tasks: s.tasks.map((t) =>
            t.blockId === id ? { ...t, blockId: undefined } : t
          ),
        })),
      skipOccurrence: (id) =>
        set((s) => ({
          // tombstone: hidden from views, but blocks the generator from recreating it
          blocks: s.blocks.map((b) =>
            b.id === id ? { ...b, skipped: true } : b
          ),
          tasks: s.tasks.map((t) =>
            t.blockId === id ? { ...t, blockId: undefined } : t
          ),
        })),
      stopRepeating: (id) =>
        set((s) => {
          const target = s.blocks.find((b) => b.id === id);
          const sid = target?.seriesId;
          if (!sid) return {};
          // end the series everywhere so nothing regenerates
          return {
            blocks: s.blocks.map((b) =>
              b.seriesId === sid ? { ...b, recurrence: null } : b
            ),
          };
        }),

      addTask: ({ title, date, blockId, categoryId }) =>
        set((s) => ({
          tasks: [
            ...s.tasks,
            {
              id: uid("t"),
              title,
              date,
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

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      completeOnboarding: () => set({ onboarded: true }),

      // Clear this account's synced content on sign-out so the next account
      // starts clean (no data leaking between accounts). Keeps onboarded true
      // and the current view/date so the app doesn't jar back to onboarding.
      resetForLogout: () => {
        const blank = blankState();
        set({
          categories: blank.categories,
          blocks: [],
          tasks: [],
          journalEntries: {},
          weeklyDigests: {},
        });
      },
      setJournalMood: (date, mood) =>
        set((s) => {
          const entry = s.journalEntries[date] ?? blankEntry(date);
          return {
            journalEntries: {
              ...s.journalEntries,
              [date]: { ...entry, mood: entry.mood === mood ? null : mood },
            },
          };
        }),
      setJournalOverall: (date, text) =>
        set((s) => {
          const entry = s.journalEntries[date] ?? blankEntry(date);
          return {
            journalEntries: {
              ...s.journalEntries,
              [date]: { ...entry, overallBody: text },
            },
          };
        }),
      setJournalBlockNote: (date, blockId, text) =>
        set((s) => {
          const entry = s.journalEntries[date] ?? blankEntry(date);
          return {
            journalEntries: {
              ...s.journalEntries,
              [date]: {
                ...entry,
                blockNotes: { ...entry.blockNotes, [blockId]: text },
              },
            },
          };
        }),
      setJournalSummary: (date, summary) =>
        set((s) => {
          const entry = s.journalEntries[date] ?? blankEntry(date);
          return {
            journalEntries: {
              ...s.journalEntries,
              [date]: { ...entry, summary },
            },
          };
        }),
      setWeeklyDigest: (weekOf, digest) =>
        set((s) => {
          const next = { ...s.weeklyDigests };
          if (digest) next[weekOf] = digest;
          else delete next[weekOf];
          return { weeklyDigests: next };
        }),
    }),
    {
      name: "weekflow-state",
      version: 2,
      // Migrate the phase-1 single-week model (day-index) to ISO dates.
      migrate: (persisted, version) => {
        if (!persisted || version >= 2) return persisted as State;
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const s = persisted as any;
        const cws: string = s.currentWeekStart || weekStartOfISO(todayISO());
        const oldBlocks: any[] = s.blocks || [];
        const blocks = oldBlocks.map((b) => ({
          id: b.id,
          categoryId: b.categoryId,
          title: b.title,
          date:
            b.weekOf != null && b.day != null
              ? addDaysISO(b.weekOf, b.day)
              : todayISO(),
          startMinutes: b.startMinutes,
          endMinutes: b.endMinutes,
          recurrence: null,
          notes: b.notes,
        }));
        const blockDate = (id?: string) =>
          blocks.find((x) => x.id === id)?.date;
        s.tasks = (s.tasks || []).map((t: any) => ({
          ...t,
          date: blockDate(t.blockId) || todayISO(),
        }));
        const je: Record<string, any> = {};
        Object.entries(s.journalEntries || {}).forEach(([k, v]: [string, any]) => {
          const date = addDaysISO(cws, parseInt(k, 10) || 0);
          je[date] = {
            date,
            mood: v.mood ?? null,
            overallBody: v.overallBody || "",
            blockNotes: v.blockNotes || {},
            summary: v.summary || null,
          };
        });
        s.blocks = blocks;
        s.journalEntries = je;
        s.weeklyDigests = {};
        s.selectedDate =
          s.selectedDay != null ? addDaysISO(cws, s.selectedDay) : todayISO();
        delete s.selectedDay;
        delete s.journalVariant;
        return s as State;
        /* eslint-enable @typescript-eslint/no-explicit-any */
      },
      partialize: (s) => ({
        categories: s.categories,
        blocks: s.blocks,
        tasks: s.tasks,
        view: s.view,
        mode: s.mode,
        selectedDate: s.selectedDate,
        currentWeekStart: s.currentWeekStart,
        journalEntries: s.journalEntries,
        weeklyDigests: s.weeklyDigests,
        sidebarOpen: s.sidebarOpen,
        onboarded: s.onboarded,
      }),
      // A pre-existing save has already seen the app — keep onboarding hidden.
      // A genuinely fresh user has no persisted state → onboarded stays false.
      merge: (persisted, current) => {
        if (!persisted) return current;
        const p = persisted as Partial<State>;
        return { ...current, ...p, onboarded: p.onboarded ?? true };
      },
    }
  )
);
