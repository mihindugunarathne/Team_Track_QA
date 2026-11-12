"use client";

export function LoadMoreButton({
  hasMore,
  loading,
  onClick,
  label = "Load more",
}: {
  hasMore: boolean;
  loading: boolean;
  onClick: () => void;
  label?: string;
}) {
  if (!hasMore) return null;
  return (
    <button
      type="button"
      className="btn-ghost w-full"
      disabled={loading}
      onClick={onClick}
    >
      {loading ? "Loading…" : label}
    </button>
  );
}
