import { useStore } from "../store";
import { DAYS, dateForDay, todayIndexInWeek } from "../lib/time";

export function DayPills() {
  const selectedDay = useStore((s) => s.selectedDay);
  const setSelectedDay = useStore((s) => s.setSelectedDay);
  const currentWeekStart = useStore((s) => s.currentWeekStart);
  const todayIdx = todayIndexInWeek(currentWeekStart);

  return (
    <div className="day-pills">
      {DAYS.map((d, i) => (
        <button
          key={d}
          className={`day-pill ${i === selectedDay ? "active" : ""} ${
            i === todayIdx ? "is-today" : ""
          }`}
          onClick={() => setSelectedDay(i)}
        >
          <span className="dname">{d.toUpperCase()}</span>
          <span className="dnum">{dateForDay(currentWeekStart, i).getDate()}</span>
        </button>
      ))}
    </div>
  );
}
