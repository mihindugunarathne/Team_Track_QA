export function FilterChips<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`h-9 rounded-lg border px-3 text-[13px] font-semibold ${
              active
                ? "border-primary bg-primary text-white"
                : "border-border bg-surface text-muted hover:border-primary/40 hover:bg-primary-soft hover:text-primary"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
