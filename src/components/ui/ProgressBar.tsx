export function ProgressBar({
  value,
  color = "var(--primary)",
}: {
  value: number;
  color?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-track">
      <div
        className="h-full rounded-full"
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  );
}
