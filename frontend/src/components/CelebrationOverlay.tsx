import { useEffect } from "react";
import { feedback } from "@/feedback";
import { usePreferences } from "@/store/preferences";

export type CelebrationKind = "level_up" | "badge";

export type CelebrationPayload = {
  kind: CelebrationKind;
  title: string;
  detail: string;
};

type Props = {
  payload: CelebrationPayload | null;
  onDismiss: () => void;
};

export function CelebrationOverlay({ payload, onDismiss }: Props) {
  const reduceMotion = usePreferences((s) => s.settings.reduce_motion);

  useEffect(() => {
    if (!payload) return;
    if (payload.kind === "level_up") feedback.levelUp(payload.title);
    else feedback.badge(payload.title);
  }, [payload]);

  if (!payload) return null;

  return (
    <div
      className={`celebration-overlay${reduceMotion ? " is-static" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
    >
      <div className="celebration-card">
        <p className="celebration-eyebrow">
          {payload.kind === "level_up" ? "Level up" : "Badge earned"}
        </p>
        <h2 id="celebration-title" className="celebration-title">
          {payload.title}
        </h2>
        <p className="celebration-detail">
          <strong>{payload.detail}</strong>
        </p>
        <button className="primary-button" type="button" onClick={onDismiss} autoFocus>
          Continue
        </button>
      </div>
    </div>
  );
}
