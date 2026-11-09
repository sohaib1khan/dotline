const DOT_ORDER: { dot: number; row: number; col: number }[] = [
  { dot: 1, row: 0, col: 0 },
  { dot: 2, row: 1, col: 0 },
  { dot: 3, row: 2, col: 0 },
  { dot: 4, row: 0, col: 1 },
  { dot: 5, row: 1, col: 1 },
  { dot: 6, row: 2, col: 1 },
];

type Props = {
  dots: number[];
  label?: string;
  showNumbers?: boolean;
};

export function BrailleCell({ dots, label, showNumbers = true }: Props) {
  const raised = new Set(dots);

  return (
    <div className="braille-cell-display" role="img" aria-label={label ?? `Braille cell dots ${dots.join(" ")}`}>
      <div className="braille-cell-grid">
        {DOT_ORDER.map(({ dot, row, col }) => {
          const on = raised.has(dot);
          return (
            <span
              key={dot}
              className={`braille-cell-dot${on ? " is-raised" : ""}`}
              style={{ gridRow: row + 1, gridColumn: col + 1 }}
            >
              {showNumbers ? <span className="braille-cell-num">{dot}</span> : null}
              <span className="sr-only">
                Dot {dot} {on ? "raised" : "flat"}
              </span>
            </span>
          );
        })}
      </div>
      {label ? <p className="braille-cell-caption"><strong>{label}</strong></p> : null}
    </div>
  );
}
