import { useState } from "react";
import { CelebrationOverlay, type CelebrationPayload } from "@/components/CelebrationOverlay";
import { Field, FormStatus } from "@/components/AuthForm";
import { ApiError, apiPost } from "@/lib/api";

type GrantResult = {
  amount: number;
  reason: string;
  total_xp: number;
  previous_level: number;
  level: number;
  xp_into_level: number;
  xp_for_next: number;
  leveled_up: boolean;
  levels_gained: number;
  new_badges: { key: string; title: string; description: string }[];
};

export function AdminXpDebugPage() {
  const [amount, setAmount] = useState("100");
  const [reason, setReason] = useState("admin_grant");
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [celebration, setCelebration] = useState<CelebrationPayload | null>(null);
  const [pending, setPending] = useState<CelebrationPayload[]>([]);

  async function grant(xpAmount: number, xpReason: string) {
    setBusy(true);
    setError("");
    setSummary("");
    try {
      const result = await apiPost<GrantResult>("/api/admin/debug/xp", {
        amount: xpAmount,
        reason: xpReason.trim() || "admin_grant",
      });
      setSummary(
        `Granted ${result.amount} XP. Level ${result.previous_level} → ${result.level}. ` +
          `${result.xp_into_level}/${result.xp_for_next} toward next · ${result.total_xp} total.`,
      );
      const queue: CelebrationPayload[] = [];
      if (result.leveled_up) {
        queue.push({
          kind: "level_up",
          title: `Level ${result.level}`,
          detail:
            result.levels_gained > 1
              ? `You jumped ${result.levels_gained} levels.`
              : "Keep going — new challenges unlock as you climb.",
        });
      }
      for (const badge of result.new_badges) {
        queue.push({
          kind: "badge",
          title: badge.title,
          detail: badge.description,
        });
      }
      if (queue.length > 0) {
        setCelebration(queue[0] ?? null);
        setPending(queue.slice(1));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Grant failed.");
    } finally {
      setBusy(false);
    }
  }

  function dismissCelebration() {
    if (pending.length > 0) {
      setCelebration(pending[0] ?? null);
      setPending(pending.slice(1));
      return;
    }
    setCelebration(null);
  }

  return (
    <section aria-labelledby="xp-debug-title">
      <h1 id="xp-debug-title" className="page-title">
        Debug → Grant XP
      </h1>
      <p className="page-copy">
        <strong>Award XP to yourself</strong> to test level-up sound, speech, and haptics.
      </p>
      <form
        className="settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          void grant(Number(amount), reason);
        }}
        noValidate
      >
        <Field id="xp-amount" label="XP amount" value={amount} onChange={setAmount} />
        <Field id="xp-reason" label="Reason" value={reason} onChange={setReason} />
        <FormStatus message={error} />
        {summary ? (
          <p className="success-text" role="status">
            {summary}
          </p>
        ) : null}
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? "Granting…" : "Grant XP"}
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={busy}
          onClick={() => void grant(100, "admin_grant")}
        >
          Quick +100 XP
        </button>
      </form>
      <CelebrationOverlay payload={celebration} onDismiss={dismissCelebration} />
    </section>
  );
}
