export function StatusBadge({
  label,
  background,
  color,
  bg,
  fg,
}: {
  label: string;
  background?: string;
  color?: string;
  bg?: string;
  fg?: string;
}) {
  return (
    <span
      className="inline-flex min-h-6 items-center rounded-full px-2.5 py-1 text-xs font-bold capitalize"
      style={{ background: background ?? bg, color: color ?? fg }}
    >
      {label}
    </span>
  );
}
