export const PALETTE = [
  "#7c6cf6", // violet
  "#34d399", // emerald
  "#f2a93b", // amber
  "#f2555a", // rose
  "#38bdf8", // sky
  "#c084fc", // purple
  "#f472b6", // pink
  "#94a3b8", // slate
];

export function nextUnusedColor(usedColors: string[]): string {
  return (
    PALETTE.find((p) => !usedColors.includes(p)) ||
    PALETTE[usedColors.length % PALETTE.length]
  );
}
