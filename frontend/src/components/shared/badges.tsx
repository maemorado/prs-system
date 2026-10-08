import { cn } from "cn";
import { Check, Circle, Minus, X, type LucideIcon } from "lucide-react";
import { capitalize } from "@/src/lib/format";

/**
 * Status is never communicated by color alone: each state carries a distinct
 * icon as well, so it stays readable for anyone who cannot distinguish the
 * muted status hues.
 */
const statusStyles: Record<
  string,
  { className: string; icon: LucideIcon }
> = {
  pending: {
    className: "border-warning/30 bg-warning/10 text-warning",
    icon: Circle,
  },
  approved: {
    className: "border-success/30 bg-success/10 text-success",
    icon: Check,
  },
  rejected: {
    className: "border-destructive/30 bg-destructive/10 text-destructive",
    icon: X,
  },
};

const defaultStatus = {
  className: "border-border bg-muted text-muted-foreground",
  icon: Minus,
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusStyles[status.toLowerCase()] ?? defaultStatus;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap",
        config.className
      )}
    >
      <Icon
        className={cn(
          "size-3",
          config === statusStyles.pending && "fill-current"
        )}
      />
      {capitalize(status)}
    </span>
  );
}

const priorityStyles: Record<string, string> = {
  urgent: "border-destructive/30 bg-destructive/10 text-destructive",
  high: "border-warning/30 bg-warning/10 text-warning",
  normal: "border-info/30 bg-info/10 text-info",
  medium: "border-info/30 bg-info/10 text-info",
  low: "border-border bg-muted text-muted-foreground",
};

const defaultPriority = "border-border bg-muted text-muted-foreground";

export function PriorityBadge({ priority }: { priority: string }) {
  if (!priority) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap",
        priorityStyles[priority.toLowerCase()] ?? defaultPriority
      )}
    >
      {capitalize(priority)}
    </span>
  );
}