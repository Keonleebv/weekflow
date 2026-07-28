import { PieChart, Pie, Cell } from "recharts";
import { useStore } from "../store";
import { DAYS, datesOfWeek, dayIndexOfISO, fullDayNameISO } from "../lib/time";
import { catHoursForDates } from "../lib/stats";

type Props = {
  onOpenReview: () => void;
};

export function OverviewCard({ onOpenReview }: Props) {
  const blocks = useStore((s) => s.blocks);
  const categories = useStore((s) => s.categories);
  const currentWeekStart = useStore((s) => s.currentWeekStart);
  const view = useStore((s) => s.view);
  const mode = useStore((s) => s.mode);
  const selectedDate = useStore((s) => s.selectedDate);
  const journalEntries = useStore((s) => s.journalEntries);
  const tasks = useStore((s) => s.tasks);

  // Journal and Day view scope the overview to the selected date.
  const scopedDate =
    mode === "journal" || view === "day" ? selectedDate : null;
  const weekDates = datesOfWeek(currentWeekStart);
  const scopeDates = scopedDate ? [scopedDate] : weekDates;

  const catHours = (catId: string) =>
    catHoursForDates(blocks, catId, scopeDates);

  const totals = categories
    .map((c) => ({ cat: c, hrs: catHours(c.id) }))
    .filter((x) => x.hrs > 0);
  const total = totals.reduce((s, x) => s + x.hrs, 0);

  const title = scopedDate
    ? `Daily Overview — ${fullDayNameISO(scopedDate)}`
    : "Week Overview";
  const subLabel = scopedDate
    ? DAYS[dayIndexOfISO(scopedDate)].toUpperCase()
    : "TOTAL";
  const totalStr = total % 1 === 0 ? String(total) : total.toFixed(1);
  const pieData = totals.map((x) => ({ name: x.cat.name, value: x.hrs, color: x.cat.color }));

  // Show the week-in-review link once the week has something worth reviewing.
  const weekSet = new Set(weekDates);
  const weekHasJournal = Object.values(journalEntries).some(
    (e) =>
      weekSet.has(e.date) &&
      ((e.overallBody && e.overallBody.trim()) ||
        Object.values(e.blockNotes).some((v) => v && v.trim()))
  );
  const weekTasksDone = tasks.filter(
    (t) => t.done && weekSet.has(t.date)
  ).length;
  const showReview = !scopedDate && (weekHasJournal || weekTasksDone > 0);

  return (
    <div className="card">
      <p className="card-title">{title}</p>

      <div className="donut-wrap">
        {total > 0 ? (
          <PieChart width={168} height={168}>
            <Pie
              data={pieData}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              startAngle={90}
              endAngle={-270}
              paddingAngle={2}
              stroke="none"
            >
              {pieData.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        ) : (
          <svg width="168" height="168" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="70" fill="none" stroke="#1f242b" strokeWidth="22" />
          </svg>
        )}
        <div className="donut-center-label">
          <div className="donut-center-num">{totalStr}h</div>
          <div className="donut-center-sub">{subLabel}</div>
        </div>
      </div>

      <div>
        {scopedDate ? (
          totals.length ? (
            totals.map((x) => (
              <div className="legend-item" key={x.cat.id}>
                <div className="legend-top">
                  <span className="dot" style={{ background: x.cat.color }} />
                  <span className="legend-name">{x.cat.name}</span>
                  <span className="legend-hrs">
                    {x.hrs % 1 === 0 ? x.hrs : x.hrs.toFixed(1)}h
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="empty-note">Nothing scheduled this day.</p>
          )
        ) : (
          categories.map((c) => {
            const hrs = catHours(c.id);
            const goal = c.weeklyGoalHours || 0;
            const pct = goal ? Math.min(100, Math.round((hrs / goal) * 100)) : 0;
            return (
              <div className="legend-item" key={c.id}>
                <div className="legend-top">
                  <span className="dot" style={{ background: c.color }} />
                  <span className="legend-name">{c.name}</span>
                  <span className="legend-hrs">
                    {hrs % 1 === 0 ? hrs : hrs.toFixed(1)}h{goal ? ` / ${goal}h` : ""}
                  </span>
                </div>
                {goal ? (
                  <div className="legend-bar-track">
                    <div
                      className="legend-bar-fill"
                      style={{ width: `${pct}%`, background: c.color }}
                    />
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {showReview && (
        <button type="button" className="review-link" onClick={onOpenReview}>
          📊 View week in review
        </button>
      )}
    </div>
  );
}
