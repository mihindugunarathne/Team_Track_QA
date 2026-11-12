"use client";

function ScopeCountBadge({
  count,
  active,
}: {
  count: number;
  active: boolean;
}) {
  return (
    <span
      className={`min-w-[1.35rem] rounded-full px-1.5 py-0.5 text-center text-[11px] font-extrabold leading-none tabular-nums ${
        active ? "bg-white text-error" : "bg-error text-white"
      }`}
      aria-label={`${count} unread`}
    >
      {count}
    </span>
  );
}

export function WorkScopeToggle({
  value,
  onChange,
  mineLabel = "My work",
  teamLabel = "Team",
  mineCount,
  teamCount,
}: {
  value: "mine" | "team";
  onChange: (value: "mine" | "team") => void;
  mineLabel?: string;
  teamLabel?: string;
  mineCount?: number;
  teamCount?: number;
}) {
  return (
    <div className="segment w-fit" aria-label="View">
      <button
        type="button"
        className={`segment-item inline-flex items-center gap-2 ${value === "mine" ? "active" : ""}`}
        onClick={() => onChange("mine")}
      >
        {mineLabel}
        {mineCount !== undefined ? (
          <ScopeCountBadge count={mineCount} active={value === "mine"} />
        ) : null}
      </button>
      <button
        type="button"
        className={`segment-item inline-flex items-center gap-2 ${value === "team" ? "active" : ""}`}
        onClick={() => onChange("team")}
      >
        {teamLabel}
        {teamCount !== undefined ? (
          <ScopeCountBadge count={teamCount} active={value === "team"} />
        ) : null}
      </button>
    </div>
  );
}
