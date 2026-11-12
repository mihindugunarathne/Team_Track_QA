export const DEFAULT_PAGE_SIZE = 20;

export type CursorPage<T> = {
  items: T[];
  hasMore: boolean;
  nextBefore: string | null;
};

export function withCursorQuery(
  path: string,
  params: Record<string, string | number | undefined | null> = {}
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "" || value === "all") continue;
    query.set(key, String(value));
  }
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export function mergeById<T extends { id: string | number }>(
  current: T[],
  incoming: T[]
) {
  const seen = new Set(current.map((item) => String(item.id)));
  return [...current, ...incoming.filter((item) => !seen.has(String(item.id)))];
}
