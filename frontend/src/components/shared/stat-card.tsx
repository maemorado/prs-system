import Link from "next/link";
import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

type StatCardProps = {
  label: string;
  /**
   * The number to show. `null` means it has not been read yet, which is
   * different from zero: a card showing "0" is a real result, a card showing
   * "—" is one that is still on its way.
   */
  value: string | number | null;
  icon: LucideIcon;
  tone?: "default" | "primary" | "pending" | "approved" | "rejected";
  /** Optional supporting line under the value. */
  hint?: string;
  /** Makes the whole card a link, for a card that goes somewhere. */
  href?: string;
};

const tones: Record<
  NonNullable<StatCardProps["tone"]>,
  { icon: string; value: string }
> = {
  default: {
    icon: "bg-muted text-muted-foreground",
    value: "text-foreground",
  },
  primary: {
    icon: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
    value: "text-foreground",
  },
  pending: {
    icon: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    value: "text-amber-600 dark:text-amber-400",
  },
  approved: {
    icon: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    value: "text-emerald-600 dark:text-emerald-400",
  },
  rejected: {
    icon: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
    value: "text-red-600 dark:text-red-400",
  },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
  href,
}: StatCardProps) {
  const classes = tones[tone];

  const body = (
    <div className="flex items-center gap-3 px-(--card-spacing)">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          classes.icon
        )}
      >
        <Icon className="size-5" />
      </span>

      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted-foreground">
          {label}
        </p>

        <p
          className={cn(
            "text-2xl font-semibold tabular-nums",
            classes.value
          )}
        >
          {value ?? "—"}
        </p>

        {hint && (
          <p className="truncate text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Card className="gap-3 transition-colors hover:bg-muted/40" size="sm">
        <Link
          href={href}
          className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {body}
        </Link>
      </Card>
    );
  }

  return (
    <Card className="gap-3" size="sm">
      {body}
    </Card>
  );
}
