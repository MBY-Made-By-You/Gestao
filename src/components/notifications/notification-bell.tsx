"use client";

import { useState } from "react";
import {
  Bell,
  BellRing,
  CalendarClock,
  CalendarPlus,
  CheckCheck,
  ClipboardCheck,
  FileText,
  FolderPlus,
  Sparkles,
  Trash2,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { useNotifications, type AppNotification } from "@/components/notifications/notifications-provider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<string, LucideIcon> = {
  task_assigned: UserPlus,
  event_invite: CalendarPlus,
  minutes: FileText,
  xp: Sparkles,
  project_added: FolderPlus,
  due_today: ClipboardCheck,
  event_today: CalendarClock,
  test: BellRing,
};

export function NotificationBell({ className, align = "start" }: { className?: string; align?: "start" | "end" }) {
  const { items, unread, loaded, open, markAllRead, clearRead } = useNotifications();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const hasRead = items.some((n) => n.read_at);

  function select(notification: AppNotification) {
    setPopoverOpen(false);
    open(notification);
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", className)}
          aria-label={unread ? `Notificações (${unread} não lidas)` : "Notificações"}
        >
          <Bell />
          {unread > 0 && (
            <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] leading-none font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <p className="text-sm font-bold">Notificações</p>
          <div className="ml-auto flex gap-1">
            {unread > 0 && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={markAllRead}>
                <CheckCheck /> Marcar como lidas
              </Button>
            )}
            {hasRead && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={clearRead}
                aria-label="Apagar notificações lidas"
                title="Apagar lidas"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
        <ul className="scrollbar-thin max-h-[min(26rem,70dvh)] overflow-y-auto">
          {items.length === 0 ? (
            <li className="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground">
              <Bell className="size-6 opacity-50" />
              {loaded ? "Nada por aqui. Avisaremos quando algo acontecer." : "Carregando…"}
            </li>
          ) : (
            items.map((n) => {
              const Icon = TYPE_ICON[n.type] ?? Bell;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => select(n)}
                    className={cn(
                      "flex w-full gap-3 px-4 py-3 text-left transition hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
                      !n.read_at && "bg-brand/5",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
                        n.read_at ? "bg-muted text-muted-foreground" : "bg-brand/15 text-brand",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm", n.read_at ? "font-medium" : "font-bold")}>{n.title}</span>
                      {n.body && <span className="block truncate text-xs text-muted-foreground">{n.body}</span>}
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {formatRelative(n.created_at)}
                      </span>
                    </span>
                    {!n.read_at && (
                      <span className="mt-2 size-2 shrink-0 rounded-full bg-brand" aria-label="Não lida" />
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
