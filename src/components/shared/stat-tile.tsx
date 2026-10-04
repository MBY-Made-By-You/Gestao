import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** KPI: o número é o gráfico. Texto sempre nas cores de texto, ícone como acento. */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "brand" | "success" | "danger" | "warning" | "neutral";
  className?: string;
}) {
  const toneClass = {
    brand: "bg-brand/12 text-brand-strong dark:text-brand",
    success: "bg-success/12 text-success",
    danger: "bg-destructive/12 text-destructive",
    warning: "bg-warning/15 text-warning",
    neutral: "bg-muted text-muted-foreground",
  }[tone];

  return (
    <div className={cn("rounded-2xl border border-border/80 bg-card p-4 shadow-card", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-muted-foreground">{label}</p>
        {Icon ? (
          <span className={cn("grid size-8 place-items-center rounded-xl", toneClass)}>
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[26px] leading-none font-extrabold tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
