import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10">
        <Loader2 className="size-5 animate-spin text-primary" />
      </span>

      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="flex flex-col rounded-xl border border-border bg-card p-5"
          aria-hidden="true"
        >
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="mt-4 h-8 w-16" />
          <Skeleton className="mt-2 h-3.5 w-24" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="rounded-xl border border-border bg-card p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2 max-w-64" />
              <Skeleton className="h-3 w-32" />
            </div>

            <Skeleton className="h-6 w-24 shrink-0 rounded-full" />
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="rounded-xl border border-border bg-card p-5">
        <Skeleton className="h-4 w-36" />
        <div className="mt-4 space-y-3">
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-2/3 rounded-lg" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <Skeleton className="h-4 w-28" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  const widths = ["w-24", "w-40", "w-28", "w-20", "w-32"];

  return (
    <div
      className="overflow-hidden rounded-xl border border-border bg-card"
      aria-hidden="true"
    >
      <div className="flex items-center gap-4 border-b border-border bg-muted/60 px-4 py-3.5">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton
            key={index}
            className={cn("h-3 rounded-full", widths[index % widths.length])}
          />
        ))}
      </div>

      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex items-center gap-4 border-b border-border px-4 py-4 last:border-b-0"
        >
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={cn(
                "h-3.5 rounded-full",
                columnIndex === 0 ? "w-28" : "w-20"
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

type ErrorStateProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  retryDisabled?: boolean;
};

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try Again",
  retryDisabled = false,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5"
    >
      <div className="flex items-center gap-2 text-destructive">
        <span className="flex size-7 items-center justify-center rounded-full bg-destructive/10">
          <TriangleAlert className="size-4" />
        </span>

        <p className="text-sm font-semibold">{title}</p>
      </div>

      <p className="text-sm text-foreground/90">{message}</p>

      {onRetry && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={retryDisabled}
        >
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-14 text-center",
        className
      )}
    >
      {Icon && (
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </span>
      )}

      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">{title}</p>

        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}