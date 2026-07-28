export type Category = {
  id: string;
  name: string;
  color: string; // hex, assigned from palette
  weeklyGoalHours?: number;
};

export type Recurrence = "weekly" | "biweekly" | null;

export type Block = {
  id: string;
  categoryId: string;
  title: string;
  date: string; // ISO date (yyyy-MM-dd) this instance occurs on
  startMinutes: number; // minutes from midnight
  endMinutes: number;
  recurrence: Recurrence; // null = one-off
  seriesId?: string; // ties every instance of a recurring series together
  skipped?: boolean; // "delete just this occurrence" tombstone
  notes?: string; // day-view per-block notes
  // one-tap estimate-accuracy tag: undefined = never asked, null = dismissed
  estimateAccuracy?: "accurate" | "over" | "under" | null;
};

export type Task = {
  id: string;
  title: string;
  categoryId?: string;
  done: boolean;
  blockId?: string;
  date: string; // ISO date this task belongs to (independent of blockId)
  createdAt: string;
};

export type View = "week" | "day";
export type Mode = "planner" | "journal";
export type Mood = "rough" | "okay" | "good" | "great" | "fire";

export type JournalSummary = {
  bullets: string[];
  forTextHash: string; // hash of the text it summarized — regenerate when stale
  generatedAt: string;
};

export type JournalEntry = {
  date: string; // ISO date — keyed by real calendar date in the store
  mood: Mood | null;
  overallBody: string;
  blockNotes: Record<string, string>; // blockId -> note text
  summary: JournalSummary | null;
};

export type WeeklyDigest = {
  weekOf: string; // ISO Monday of the week
  bullets: string[];
  forTextHash: string;
  generatedAt: string;
};

// Not persisted — lives only in memory for the session.
export type GCalEvent = {
  id: string;
  summary: string;
  start: string; // ISO datetime, or date-only for all-day
  end: string;
  htmlLink: string;
};
