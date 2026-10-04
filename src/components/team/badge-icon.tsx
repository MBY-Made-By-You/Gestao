import { Crown, Flame, Medal, Rocket, Sparkles, Timer, type LucideIcon } from "lucide-react";

import type { Badge } from "@/lib/gamification";
import { cn } from "@/lib/utils";

const ICONS: Record<Badge["icon"], LucideIcon> = { Rocket, Medal, Crown, Timer, Flame, Sparkles };

export function BadgeIcon({ badge, size = "md" }: { badge: Badge; size?: "sm" | "md" }) {
  const Icon = ICONS[badge.icon];
  return (
    <span
      title={`${badge.name} — ${badge.description}${badge.earned ? "" : " (bloqueada)"}`}
      className={cn(
        "grid place-items-center rounded-xl ring-1 transition",
        size === "sm" ? "size-7" : "size-11",
        badge.earned
          ? "bg-gradient-to-br from-brand/20 to-periwinkle/30 text-brand-strong ring-brand/25 dark:text-brand"
          : "bg-muted text-muted-foreground/40 ring-border grayscale",
      )}
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-5"} />
      <span className="sr-only">
        {badge.name}
        {badge.earned ? "" : " (bloqueada)"}
      </span>
    </span>
  );
}
