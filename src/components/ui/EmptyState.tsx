import type { ReactNode } from "react";

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-8 py-10 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-2xl text-primary">
        ◯
      </div>
      <p className="text-lg font-extrabold">{title}</p>
      {body ? <p className="mt-1 max-w-md text-sm leading-5 text-muted">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
