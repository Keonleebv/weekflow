import { useStore } from "../store";
import { CalendarIcon, SlidersIcon, BookIcon, UserIcon } from "./icons";
import { useAuth } from "../lib/sync";

type Props = {
  onOpenAllocation: () => void;
  onOpenAccount: () => void;
};

export function Rail({ onOpenAllocation, onOpenAccount }: Props) {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const { user, enabled } = useAuth();
  const initial = (user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="rail">
      <div className="logo-dot">W</div>
      <div className="rail-nav">
        <button
          className={`rail-btn ${mode === "planner" ? "active" : ""}`}
          title="Planner"
          aria-label="Planner"
          onClick={() => setMode("planner")}
        >
          <CalendarIcon />
        </button>
        <button
          className={`rail-btn ${mode === "journal" ? "active" : ""}`}
          title="Journal"
          aria-label="Journal"
          onClick={() => setMode("journal")}
        >
          <BookIcon />
        </button>
      </div>
      <div className="rail-bottom">
        <button
          className="rail-btn"
          title="Allocation options"
          aria-label="Allocation options"
          onClick={onOpenAllocation}
        >
          <SlidersIcon />
        </button>
        {enabled && (
          <button
            className="rail-btn account-btn"
            title={user ? user.email || "Account" : "Sign in to sync"}
            aria-label={user ? "Account" : "Sign in to sync"}
            onClick={onOpenAccount}
          >
            {user ? <span className="account-initial">{initial}</span> : <UserIcon />}
          </button>
        )}
      </div>
    </div>
  );
}
