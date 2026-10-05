import { Inbox, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Estado vazio: ícone, título, descrição e ação opcional. */
export function EmptyState({
  title,
  description,
  action,
  className,
  compact,
  icon: Icon = Inbox,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
        className,
      )}
    >
      <div
        className={cn(
          "grid place-items-center rounded-2xl bg-brand-soft text-brand-strong dark:text-brand",
          compact ? "size-12" : "size-14",
        )}
      >
        <Icon className={compact ? "size-6" : "size-7"} />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-[15px] font-bold">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
