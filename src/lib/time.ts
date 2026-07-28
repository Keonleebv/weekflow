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

/** Today's ISO date (yyyy-MM-dd), local time. */
export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** Parse an ISO date string to a local Date at midnight. */
export function parseISO(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

/** ISO date `n` days after `iso`. */
export function addDaysISO(iso: string, n: number): string {
  return format(addDays(parseISO(iso), n), "yyyy-MM-dd");
}

/** Monday (ISO) of the week containing `iso`. */
export function weekStartOfISO(iso: string): string {
  return weekStartISO(parseISO(iso));
}

/** The 7 ISO dates (Mon..Sun) of the week starting `weekOfISO`. */
export function datesOfWeek(weekOfISO: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(weekOfISO, i));
}

/** Day index (0=Mon..6=Sun) of an ISO date. */
export function dayIndexOfISO(iso: string): number {
  return (parseISO(iso).getDay() + 6) % 7;
}

/** Date object for a given day index (0=Mon) within a week starting `weekOf`. */
export function dateForDay(weekOfISO: string, dayIdx: number): Date {
  return addDays(parseISO(weekOfISO), dayIdx);
}

/** Full weekday name for an ISO date (e.g. "Wednesday"). */
export function fullDayNameISO(iso: string): string {
  return DAY_FULL[dayIndexOfISO(iso)];
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

/** Current local time as minutes from midnight. */
export function nowMinutes(): number {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

/** True once a block's end time has passed (a past day, or today past its end). */
export function isElapsed(dateISO: string, endMinutes: number): boolean {
  const today = todayISO();
  if (dateISO < today) return true;
  if (dateISO === today) return endMinutes <= nowMinutes();
  return false;
}

/** Now-line offset for an ISO date, or null if it isn't today / off-grid. */
export function nowOffset(dateISO: string): number | null {
  if (dateISO !== todayISO()) return null;
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

/** Small stable string hash (djb2) — used to invalidate cached journal summaries. */
export function hashText(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
  return (h >>> 0).toString(36);
}
