import { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  children?: ReactNode;
};

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>

        {description && (
          <p className="max-w-2xl text-sm text-pretty text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}