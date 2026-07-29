// Unified overlap layout (§18c/18d). Ported verbatim from the algorithm in
// weekflow-gcal-overlay-demo.html — verify against that file's six edge cases,
// do not re-derive. Applies to ALL timeline items (native blocks AND Google
// Calendar events) through one shared function, never a per-kind special case.

export type LaidOut<T> = T & { col: number; totalCols: number };

type Span = { start: number; end: number };

/**
 * Group a day's items into overlap clusters (transitively connected), then
 * greedily assign each cluster's items to columns. Two items conflict only when
 * they truly overlap — sharing a boundary instant (back-to-back) is NOT a
 * conflict (strict inequality, edge case 3). Every item in a cluster reports
 * the same `totalCols`, so it stays its cluster's width for its whole span even
 * where it isn't personally double-booked (the deliberately simple rule —
 * edge cases 2 and 4).
 */
export function layoutDay<T extends Span>(items: T[]): LaidOut<T>[] {
  const sorted = [...items].sort((a, b) => a.start - b.start);

  const clusters: T[][] = [];
  sorted.forEach((item) => {
    let placed = false;
    for (const cluster of clusters) {
      if (cluster.some((o) => item.start < o.end && o.start < item.end)) {
        cluster.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([item]);
    // merge any clusters that this item just transitively bridged
    for (let i = clusters.length - 1; i > 0; i--) {
      for (let j = i - 1; j >= 0; j--) {
        if (
          clusters[i].some((a) =>
            clusters[j].some((b) => a.start < b.end && b.start < a.end)
          )
        ) {
          clusters[j] = clusters[j].concat(clusters[i]);
          clusters.splice(i, 1);
          break;
        }
      }
    }
  });

  const out: LaidOut<T>[] = [];
  clusters.forEach((cluster) => {
    cluster.sort((a, b) => a.start - b.start);
    const columns: T[][] = [];
    const colOf = new Map<T, number>();
    cluster.forEach((item) => {
      let col = columns.find((c) =>
        c.every((ex) => item.start >= ex.end || ex.start >= item.end)
      );
      if (!col) {
        col = [];
        columns.push(col);
      }
      col.push(item);
      colOf.set(item, columns.indexOf(col));
    });
    const totalCols = columns.length;
    cluster.forEach((item) =>
      out.push({ ...item, col: colOf.get(item)!, totalCols })
    );
  });
  return out;
}

const RADIUS = 12; // matches native block corner radius in the grid CSS

/**
 * Horizontal geometry + edge-to-edge corner/border treatment for one column of
 * an overlap cluster (§18c). Leftmost rounds its left corners, rightmost its
 * right, any middle column is square; internal borders are suppressed so a group
 * reads as one continuous outline with seam handles between columns.
 */
export function columnStyle(col: number, totalCols: number): React.CSSProperties {
  const width = 100 / totalCols;
  const isLeft = col === 0;
  const isRight = col === totalCols - 1;
  const style: React.CSSProperties = {
    left: `${col * width}%`,
    width: `${width}%`,
    right: "auto", // override the CSS side-inset so % width wins cleanly
  };
  if (totalCols === 1) {
    style.borderRadius = RADIUS;
  } else if (isLeft) {
    style.borderRadius = `${RADIUS}px 0 0 ${RADIUS}px`;
  } else if (isRight) {
    style.borderRadius = `0 ${RADIUS}px ${RADIUS}px 0`;
  } else {
    style.borderRadius = 0;
  }
  if (totalCols > 1) {
    if (!isLeft) style.borderLeft = "none";
    if (!isRight) style.borderRight = "none";
  }
  return style;
}

/** Left offset (as a CSS % string) of the seam handle after a column, or null
 *  for the rightmost column (no seam on the outer edge). */
export function seamLeft(col: number, totalCols: number): string | null {
  if (col === totalCols - 1) return null;
  const width = 100 / totalCols;
  return `calc(${(col + 1) * width}% - 2px)`;
}
