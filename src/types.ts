export type Category = {
  id: string;
  name: string;
  color: string; // hex, assigned from palette
  weeklyGoalHours?: number;
};

export type Block = {
  id: string;
  categoryId: string;
  title: string;
  day: number; // 0=Mon..6=Sun
  startMinutes: number; // minutes from midnight
  endMinutes: number;
  weekOf: string; // ISO date of that week's Monday
  notes?: string;
};

export type Task = {
  id: string;
  title: string;
  categoryId?: string;
  done: boolean;
  blockId?: string;
  createdAt: string;
};

export type View = "week" | "day";
export type Mode = "planner" | "journal";
export type JournalVariant = "block" | "plain";
export type Mood = "rough" | "okay" | "good" | "great" | "fire";

export type JournalSummary = {
  bullets: string[];
  forTextHash: string; // hash of the text it summarized — regenerate when stale
  generatedAt: string;
};

export type JournalEntry = {
  // keyed by day index (0=Mon..6=Sun) in the store's journalEntries record
  mood: Mood | null;
  overallBody: string;
  blockNotes: Record<string, string>; // blockId -> note text ("By Block" variant)
  summary: JournalSummary | null;
};

// Not persisted — lives only in memory for the session.
export type GCalEvent = {
  id: string;
  summary: string;
  start: string; // ISO datetime, or date-only for all-day
  end: string;
  htmlLink: string;
};
