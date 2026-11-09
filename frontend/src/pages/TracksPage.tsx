import { AuthShell } from "@/components/AuthForm";

export function TracksPage() {
  return (
    <AuthShell
      title="What do you want to learn?"
      subtitle="Track picker arrives fully in a later phase. Your email is verified."
    >
      <div className="banner" role="status">
        <strong>Braille</strong> and <strong>Cursive</strong> tracks will be selectable here.
      </div>
    </AuthShell>
  );
}
