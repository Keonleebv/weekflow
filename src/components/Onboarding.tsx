import { useState } from "react";
import { track } from "@vercel/analytics";
import { useStore } from "../store";

const STEPS = [
  {
    icon: "🗓️",
    title: "Plan your week",
    body: "Time-block your week across the categories that actually matter to you — work, health, personal projects, whatever you're juggling.",
  },
  {
    icon: "🎯",
    title: "Make it yours",
    body: "Head to Allocation options to create your own categories, pick colors, and set a weekly hour goal for each one.",
  },
  {
    icon: "📓",
    title: "Reflect as you go",
    body: "Journal against the blocks you actually worked on, tag your mood, and get a quick AI summary of how the day went.",
  },
];

export function Onboarding() {
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const s = STEPS[step];

  const finish = (skipped: boolean) => {
    track(skipped ? "onboarding_skipped" : "onboarding_completed");
    completeOnboarding();
  };

  return (
    <div className="overlay">
      <div className="modal onboarding-modal">
        <div className="ob-icon">{s.icon}</div>
        <h3 className="ob-title">{s.title}</h3>
        <p className="ob-body">{s.body}</p>
        <div className="ob-dots">
          {STEPS.map((_, i) => (
            <span key={i} className={`ob-dot ${i === step ? "active" : ""}`} />
          ))}
        </div>
        <div className="ob-actions">
          <button
            type="button"
            className="ob-skip"
            style={{ visibility: isLast ? "hidden" : "visible" }}
            onClick={() => finish(true)}
          >
            Skip
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => (isLast ? finish(false) : setStep(step + 1))}
          >
            {isLast ? "Get Started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
