import { useStore } from "../store";
import { DAYS, datesOfWeek, parseISO, todayISO } from "../lib/time";

export function DayPills() {
  const selectedDate = useStore((s) => s.selectedDate);
  const setSelectedDate = useStore((s) => s.setSelectedDate);
  const currentWeekStart = useStore((s) => s.currentWeekStart);
  const today = todayISO();
  const weekDates = datesOfWeek(currentWeekStart);

  return (
    <div className="day-pills">
      {weekDates.map((iso, i) => (
        <button
          key={iso}
          className={`day-pill ${iso === selectedDate ? "active" : ""} ${
            iso === today ? "is-today" : ""
          }`}
          onClick={() => setSelectedDate(iso)}
        >
          <span className="dname">{DAYS[i].toUpperCase()}</span>
          <span className="dnum">{parseISO(iso).getDate()}</span>
        </button>
      ))}
    </div>
  );
}
