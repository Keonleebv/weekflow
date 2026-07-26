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

// Not persisted — lives only in memory for the session.
export type GCalEvent = {
  id: string;
  summary: string;
  start: string; // ISO datetime, or date-only for all-day
  end: string;
  htmlLink: string;
};
