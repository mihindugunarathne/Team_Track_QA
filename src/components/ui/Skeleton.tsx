export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="card space-y-3 p-5">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-2.5 w-full" />
    </div>
  );
}
