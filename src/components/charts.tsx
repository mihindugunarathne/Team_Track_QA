export function DonutChart({
  segments,
  centerValue,
  centerLabel,
}: {
  segments: { label: string; value: number; color: string }[];
  centerValue: string;
  centerLabel: string;
}) {
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  const radius = 42;
  const stroke = 12;
  const circ = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--track)" strokeWidth={stroke} />
          {total === 0 ? null : (
            segments.map((item) => {
              const length = (item.value / total) * circ;
              const dash = `${length} ${circ - length}`;
              const el = (
                <circle
                  key={item.label}
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={stroke}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  strokeLinecap="round"
                />
              );
              offset += length;
              return el;
            })
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-extrabold">{centerValue}</p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            {centerLabel}
          </p>
        </div>
      </div>
      <ul className="w-full space-y-2 text-sm">
        {segments.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
              {item.label}
            </span>
            <span className="font-bold">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HorizontalBars({
  rows,
}: {
  rows: { id: string; label: string; value: number; max: number; hint: string; color?: string }[];
}) {
  const max = Math.max(...rows.map((row) => row.max), 1);
  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No task owners yet.</p>
      ) : (
        rows.map((row) => (
          <div key={row.id}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <p className="font-bold">{row.label}</p>
              <p className="text-muted">{row.hint}</p>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-track">
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${Math.max(8, (row.value / max) * 100)}%`,
                  ...(row.color ? { background: row.color } : {}),
                }}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export function ProgressRing({
  value,
  color = "#1b6fea",
  size = 52,
}: {
  value: number;
  color?: string;
  size?: number;
}) {
  const radius = 16;
  const circ = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <svg viewBox="0 0 40 40" className="-rotate-90" style={{ width: size, height: size }}>
      <circle cx="20" cy="20" r={radius} fill={`${color}14`} stroke={`${color}28`} strokeWidth="5" />
      <circle
        cx="20"
        cy="20"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeDasharray={`${(clamped / 100) * circ} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  );
}
