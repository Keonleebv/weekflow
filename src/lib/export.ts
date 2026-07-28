import type { Block, Category, JournalEntry, Task } from "../types";
import { fmtTime, todayISO } from "./time";

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Full backup: every piece of the user's data, re-import-friendly. */
export function exportJSON(data: {
  categories: Category[];
  blocks: Block[];
  tasks: Task[];
  journalEntries: Record<string, JournalEntry>;
}) {
  const payload = { exportedAt: new Date().toISOString(), ...data };
  download(
    `weekflow-backup-${todayISO()}.json`,
    JSON.stringify(payload, null, 2),
    "application/json"
  );
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Schedule as a spreadsheet-friendly CSV (one row per block). */
export function exportBlocksCSV(blocks: Block[], categories: Category[]) {
  const catName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? "";
  const header = ["Date", "Category", "Title", "Start", "End", "Repeats"];
  const rows = blocks
    .filter((b) => !b.skipped)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.startMinutes - b.startMinutes))
    .map((b) =>
      [
        b.date,
        catName(b.categoryId),
        b.title || catName(b.categoryId),
        fmtTime(b.startMinutes),
        fmtTime(b.endMinutes),
        b.recurrence ?? "once",
      ]
        .map(csvCell)
        .join(",")
    );
  download(
    `weekflow-schedule-${todayISO()}.csv`,
    [header.join(","), ...rows].join("\n"),
    "text/csv"
  );
}
