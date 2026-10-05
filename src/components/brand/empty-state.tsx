import Image from "next/image";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Estado vazio com a capivara mascote da MBY (ou um ícone, quando `icon` é informado). */
export function EmptyState({
  title,
  description,
  action,
  className,
  compact,
  icon: Icon,
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
      {Icon ? (
        <div className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-strong dark:text-brand">
          <Icon className="size-6" />
        </div>
      ) : (
      <div className="relative">
        <div className="absolute inset-0 -z-10 rounded-full bg-brand/25 blur-2xl" />
        <Image
          src="/brand/capivara-sm.webp"
          alt="Capivara MBY"
          width={320}
          height={320}
          className={cn(
            "rounded-full border-4 border-card object-cover shadow-lift",
            compact ? "size-20" : "size-28",
          )}
        />
      </div>
      )}
      <div className="max-w-sm space-y-1">
        <p className="text-[15px] font-bold">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
