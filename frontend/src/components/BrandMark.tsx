import { Link } from "react-router-dom";

type Props = {
  className?: string;
  title?: string;
  /** When set, logo + title navigate home (login → `/`, learner → `/app`, admin → `/admin`). */
  to?: string;
};

/** Dotline logo mark + wordmark for auth, landing, and nav. */
export function BrandMark({ className = "", title = "Dotline", to }: Props) {
  const body = (
    <>
      <img src="/logo.svg" alt="" width={48} height={48} className="brand-mark-icon" />
      <span className="brand-mark-text">{title}</span>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className={`brand-mark brand-mark-link ${className}`.trim()}
        aria-label={`${title} — go to home`}
      >
        {body}
      </Link>
    );
  }

  return <span className={`brand-mark ${className}`.trim()}>{body}</span>;
}
