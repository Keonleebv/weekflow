import { PieChart, Pie, Cell } from "recharts";
import { useStore } from "../store";
import { DAY_FULL, DAYS } from "../lib/time";

export function OverviewCard() {
  const blocks = useStore((s) => s.blocks);
  const categories = useStore((s) => s.categories);
  const currentWeekStart = useStore((s) => s.currentWeekStart);
  const view = useStore((s) => s.view);
  const mode = useStore((s) => s.mode);
  const selectedDay = useStore((s) => s.selectedDay);

  // Journal and Day view both scope the overview to the selected day.
  const scopedDay =
    mode === "journal" || view === "day" ? selectedDay : undefined;

  const catHours = (catId: string) => {
    let bs = blocks.filter(
      (b) => b.weekOf === currentWeekStart && b.categoryId === catId
    );
    if (scopedDay !== undefined) bs = bs.filter((b) => b.day === scopedDay);
    return bs.reduce((s, b) => s + (b.endMinutes - b.startMinutes), 0) / 60;
  };

  const totals = categories
    .map((c) => ({ cat: c, hrs: catHours(c.id) }))
    .filter((x) => x.hrs > 0);
  const total = totals.reduce((s, x) => s + x.hrs, 0);

  const title =
    scopedDay !== undefined
      ? `Daily Overview — ${DAY_FULL[scopedDay]}`
      : "Week Overview";
  const subLabel = scopedDay !== undefined ? DAYS[scopedDay].toUpperCase() : "TOTAL";
  const totalStr = total % 1 === 0 ? String(total) : total.toFixed(1);

  const pieData = totals.map((x) => ({ name: x.cat.name, value: x.hrs, color: x.cat.color }));

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
        {scopedDay !== undefined ? (
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
    </div>
  );
}
