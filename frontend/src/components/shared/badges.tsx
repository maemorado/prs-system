import { cn } from "cn";
import { capitalize } from "@/src/lib/format";

const statusStyles: Record<string, { className: string; dot: string }> = {
  pending: {
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  approved: {
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  rejected: {
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400",
    dot: "bg-red-500",
  },
};

const defaultStatus = {
  className:
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600/40 dark:bg-slate-500/10 dark:text-slate-300",
  dot: "bg-slate-400",
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusStyles[status.toLowerCase()] ?? defaultStatus;

  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap",
        config.className
      )}
    >
      <span className={cn("size-1.5 rounded-full", config.dot)} />
      {capitalize(status)}
    </span>
  );
}

const priorityStyles: Record<string, string> = {
  urgent:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400",
  high: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-400",
  normal:
    "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300",
  medium:
    "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300",
  low: "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600/40 dark:bg-slate-500/10 dark:text-slate-300",
};

const defaultPriority =
  "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600/40 dark:bg-slate-500/10 dark:text-slate-300";

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