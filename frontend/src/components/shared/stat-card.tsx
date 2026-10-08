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
  { icon: string }
> = {
  default: {
    icon: "bg-muted text-muted-foreground",
  },
  primary: {
    icon: "bg-primary/10 text-primary",
  },
  pending: {
    icon: "bg-warning/10 text-warning",
  },
  approved: {
    icon: "bg-success/10 text-success",
  },
  rejected: {
    icon: "bg-destructive/10 text-destructive",
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
    <div className="flex flex-col px-(--card-spacing)">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          classes.icon
        )}
      >
        <Icon className="size-5" />
      </span>

      <p className="mt-4 text-3xl leading-none font-semibold tracking-tight text-foreground tabular-nums">
        {value ?? "—"}
      </p>

      <p className="mt-2 text-sm font-medium text-foreground/80">{label}</p>

      {hint && (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );

  if (href) {
    return (
      <Card className="transition-colors hover:ring-primary/30">
        <Link
          href={href}
          className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {body}
        </Link>
      </Card>
    );
  }

return <Card>{body}</Card>;
}
