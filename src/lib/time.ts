import { startOfWeek, addDays, format } from "date-fns";

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_FULL = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const GRID_START_H = 0; // 12am
export const GRID_END_H = 24; // 12am (next day) — full 24 hours
export const HOUR_H = 60;
export const GRID_HEIGHT = (GRID_END_H - GRID_START_H) * HOUR_H;

/** ISO date (yyyy-MM-dd) of the Monday for the week containing `d`. */
export function weekStartISO(d: Date): string {
  return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

/** Date object for a given day index (0=Mon) within a week starting `weekOf`. */
export function dateForDay(weekOfISO: string, dayIdx: number): Date {
  const monday = new Date(weekOfISO + "T00:00:00");
  return addDays(monday, dayIdx);
}

/** Day index (0=Mon..6=Sun) for today, or -1 if not in `weekOfISO`. */
export function todayIndexInWeek(weekOfISO: string): number {
  const today = weekStartISO(new Date());
  if (today !== weekOfISO) return -1;
  const now = new Date();
  return (now.getDay() + 6) % 7; // JS Sun=0 -> Mon=0 index
}

export function fmtTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ap = h >= 12 ? "PM" : "AM";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return h12 + (m ? ":" + String(m).padStart(2, "0") : "") + ap;
}

export function hourLabel(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  if (hh === 0) return "12AM";
  if (hh === 12) return "12PM";
  return hh > 12 ? hh - 12 + "PM" : hh + "AM";
}

/** Vertical pixel offset from grid top for a minute-of-day value. */
export function offsetForMinutes(mins: number): number {
  return ((mins - GRID_START_H * 60) / 60) * HOUR_H;
}

export const SNAP_MIN = 15;

/** Minute-of-day for a vertical pixel offset, snapped to SNAP_MIN and clamped to grid. */
export function minutesFromOffset(offsetPx: number): number {
  const raw = GRID_START_H * 60 + (offsetPx / HOUR_H) * 60;
  const snapped = Math.round(raw / SNAP_MIN) * SNAP_MIN;
  return Math.max(GRID_START_H * 60, Math.min(GRID_END_H * 60, snapped));
}

/** Now-line offset for a day, or null if today isn't that day / off-grid. */
export function nowOffset(weekOfISO: string, dayIdx: number): number | null {
  if (todayIndexInWeek(weekOfISO) !== dayIdx) return null;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins < GRID_START_H * 60 || mins > GRID_END_H * 60) return null;
  return offsetForMinutes(mins);
}

/** A sensible initial scrollTop so the grid opens near the current time
 *  (with some lead-in padding) rather than at midnight. */
export function scrollToNowTop(padding = 150): number {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  return Math.max(0, offsetForMinutes(mins) - padding);
}

export function uid(prefix: string): string {
  return prefix + Math.random().toString(36).slice(2, 9);
}
