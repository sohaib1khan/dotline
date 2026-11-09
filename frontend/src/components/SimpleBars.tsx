/** Accessible horizontal bar chart (value + text; not color-alone). */

export function SimpleBars({
  items,
  labelKey,
  valueKey,
  formatValue = (value: number) => String(value),
}: {
  items: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(1, ...items.map((item) => Number(item[valueKey] || 0)));

  if (items.length === 0) {
    return <p className="lede">No data yet.</p>;
  }

  return (
    <ul className="bar-list" aria-label="Chart values">
      {items.map((item, index) => {
        const label = String(item[labelKey] ?? "");
        const value = Number(item[valueKey] || 0);
        const pct = Math.round((value / max) * 100);
        return (
          <li key={`${label}-${index}`} className="bar-row">
            <div className="bar-meta">
              <strong>{label}</strong>
              <span>{formatValue(value)}</span>
            </div>
            <div
              className="bar-track"
              role="img"
              aria-label={`${label}: ${formatValue(value)}`}
            >
              <span className="bar-fill" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
