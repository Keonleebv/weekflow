import { useState } from "react";
import { CloseIcon } from "./icons";
import {
  useAuth,
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signOut,
} from "../lib/sync";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AuthModal({ open, onClose }: Props) {
  const { user, enabled } = useAuth();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!email.trim() || !password) {
      setError("Enter an email and password.");
      return;
    }
    setBusy(true);
    if (tab === "up") {
      const res = await signUpWithEmail(email.trim(), password);
      setBusy(false);
      if (res.error) setError(res.error);
      else if (res.needsConfirmation)
        setNotice("Account created — check your inbox to confirm, then sign in.");
      else onClose(); // signed in immediately (confirmation off)
      return;
    }
    const res = await signInWithEmail(email.trim(), password);
    setBusy(false);
    if (res.error) setError(res.error);
    else onClose();
  };

  const google = async () => {
    setError("");
    setBusy(true);
    const res = await signInWithGoogle();
    setBusy(false);
    if (res.error) setError(res.error);
    // success → browser redirects to Google, no further UI needed
  };

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal auth-modal">
        <div className="modal-head">
          <h3>{user ? "Account" : "Sync across devices"}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {!enabled ? (
          <p className="auth-hint">
            Cloud sync isn't configured for this build yet. Your data is saved
            locally on this device.
          </p>
        ) : user ? (
          <div className="auth-signed-in">
            <p className="auth-email">{user.email || "Signed in"}</p>
            <p className="auth-hint">
              Your planner syncs automatically across every device you sign in
              on.
            </p>
            <button
              className="btn-ghost danger"
              onClick={async () => {
                await signOut();
                onClose();
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <>
            <p className="auth-hint">
              Sign in to keep your blocks, tasks, and journal in sync between
              your laptop and PC. Your current data on this device is kept.
            </p>

            <button
              type="button"
              className="google-btn"
              onClick={google}
              disabled={busy}
            >
              <GoogleG />
              Continue with Google
            </button>

            <div className="auth-divider">
              <span>or</span>
            </div>

            <div className="auth-tabs">
              <button
                type="button"
                className={tab === "in" ? "active" : ""}
                onClick={() => {
                  setTab("in");
                  setError("");
                  setNotice("");
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                className={tab === "up" ? "active" : ""}
                onClick={() => {
                  setTab("up");
                  setError("");
                  setNotice("");
                }}
              >
                Create account
              </button>
            </div>

            <form onSubmit={submitEmail} className="auth-form">
              <input
                type="email"
                placeholder="you@email.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                type="password"
                placeholder="Password"
                autoComplete={tab === "in" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : tab === "in"
                    ? "Sign in"
                    : "Create account"}
              </button>
            </form>
          </>
        )}

        {error && <div className="auth-error">{error}</div>}
        {notice && <div className="auth-notice">{notice}</div>}
      </div>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
