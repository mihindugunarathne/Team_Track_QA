"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { buildCrumbs, withHome, type Crumb } from "@/lib/breadcrumbs";

type BreadcrumbState = {
  labels: Record<string, string>;
  override: Crumb[] | null;
};

type BreadcrumbSetters = {
  setLabels: (labels: Record<string, string>) => void;
  setOverride: (crumbs: Crumb[] | null) => void;
};

const BreadcrumbStateContext = createContext<BreadcrumbState>({
  labels: {},
  override: null,
});
const BreadcrumbSettersContext = createContext<BreadcrumbSetters | null>(null);

function compactLabels(labels: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(labels).filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
}

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [override, setOverride] = useState<Crumb[] | null>(null);
  const state = useMemo(() => ({ labels, override }), [labels, override]);
  const setters = useMemo(() => ({ setLabels, setOverride }), []);
  return (
    <BreadcrumbSettersContext.Provider value={setters}>
      <BreadcrumbStateContext.Provider value={state}>{children}</BreadcrumbStateContext.Provider>
    </BreadcrumbSettersContext.Provider>
  );
}

export function useBreadcrumbLabels(labels: Record<string, string | undefined>) {
  const setters = useContext(BreadcrumbSettersContext);
  const key = JSON.stringify(compactLabels(labels));

  useEffect(() => {
    if (!setters) return;
    setters.setLabels(JSON.parse(key) as Record<string, string>);
    return () => setters.setLabels({});
  }, [key, setters]);
}

export function useBreadcrumbs(crumbs: Crumb[] | null | undefined) {
  const setters = useContext(BreadcrumbSettersContext);
  const key = JSON.stringify(crumbs ?? null);

  useEffect(() => {
    if (!setters) return;
    const next = JSON.parse(key) as Crumb[] | null;
    if (!next?.length) return;
    setters.setOverride(next);
    return () => setters.setOverride(null);
  }, [key, setters]);
}

export function AppBreadcrumbs({
  homeHref,
  homeLabel,
}: {
  homeHref: string;
  homeLabel: string;
}) {
  const pathname = usePathname();
  const { labels, override } = useContext(BreadcrumbStateContext);
  const crumbs = useMemo(() => {
    const trail = override?.length
      ? withHome(override, homeHref, homeLabel)
      : buildCrumbs(pathname, { homeHref, homeLabel, labels });
    return trail.map((crumb, index) =>
      index === trail.length - 1 ? { ...crumb, href: undefined } : crumb
    );
  }, [homeHref, homeLabel, labels, override, pathname]);

  if (!crumbs.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex justify-end">
      <ol className="flex max-w-full flex-wrap items-center justify-end gap-1.5 text-[13px] font-semibold">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={`${crumb.href ?? crumb.label}:${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? (
                <span className="text-text-muted" aria-hidden>
                  /
                </span>
              ) : null}
              {crumb.href && !last ? (
                <Link
                  href={crumb.href}
                  className="max-w-48 truncate text-muted transition hover:text-primary sm:max-w-xs"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className="max-w-56 truncate text-foreground sm:max-w-sm"
                  aria-current="page"
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
