"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useBreadcrumbs } from "@/components/Breadcrumbs";
import type { Crumb } from "@/lib/breadcrumbs";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
  actionHref,
  actionLabel,
  secondaryHref,
  secondaryLabel,
  crumbs,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  actionHref?: string;
  actionLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  crumbs?: Crumb[];
}) {
  useBreadcrumbs(crumbs);
  const hasActions =
    Boolean(action) ||
    Boolean(actionHref && actionLabel) ||
    Boolean(secondaryHref && secondaryLabel);

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-[28px] font-extrabold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-xl text-[15px] text-muted">{subtitle}</p> : null}
      </div>
      {hasActions ? (
        <div className="flex flex-wrap items-center gap-2">
          {secondaryHref && secondaryLabel ? (
            <Link href={secondaryHref} className="btn-ghost text-sm">
              {secondaryLabel}
            </Link>
          ) : null}
          {action}
          {actionHref && actionLabel ? (
            <Link href={actionHref} className="btn-primary text-sm">
              {actionLabel}
            </Link>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
