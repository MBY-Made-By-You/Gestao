"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CircleCheck, Circle, FileText, Flag, Plus, Video } from "lucide-react";

import { EventDialog, type EventDraft } from "@/components/calendar/event-dialog";
import { ProjectFilterLabel } from "@/components/shared/project-filter-label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/misc";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EVENT_TYPE_LABEL, PRIORITY_STYLE } from "@/lib/constants";
import { capitalizeFirst, formatMonthYear, parseDateOnly } from "@/lib/format";
import { zonedParts } from "@/lib/timezone";
import type { EventType, MiniProfile } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { CalendarEventItem, CalendarTaskItem, CalendarView as View } from "@/server/queries/calendar";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const FIRST_HOUR = 7;
const LAST_HOUR = 22;
const HOUR_PX = 48;

const TYPE_COLOR: Record<EventType, string> = {
  meeting: "var(--chart-1)",
  event: "var(--chart-3)",
  milestone: "var(--chart-2)",
};

type DayItems = { events: CalendarEventItem[]; tasks: CalendarTaskItem[] };

function subscribeMinute(callback: () => void) {
  const id = setInterval(callback, 60_000);
  return () => clearInterval(id);
}

export function CalendarView({
  view,
  anchor,
  today,
  range,
  events,
  tasks,
  projects,
  members,
  canEdit,
  openEventId,
  openTab,
}: {
  view: View;
  anchor: string;
  today: string;
  range: { start: string; end: string };
  events: CalendarEventItem[];
  tasks: CalendarTaskItem[];
  projects: { id: string; name: string; color: string }[];
  members: MiniProfile[];
  canEdit: boolean;
  /** Abre este evento ao carregar (links da página de atas). */
  openEventId?: string;
  openTab?: "details" | "minutes";
}) {
  const router = useRouter();
  const [projectFilter, setProjectFilter] = useState("all");
  const [showTasks, setShowTasks] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [dialog, setDialog] = useState<{
    event: CalendarEventItem | null;
    draft: EventDraft | null;
    tab?: "details" | "minutes";
  } | null>(() => {
    const linked = openEventId ? events.find((e) => e.id === openEventId) : undefined;
    return linked ? { event: linked, draft: null, tab: openTab } : null;
  });

  const anchorDate = parseDateOnly(anchor);
  const days = useMemo(() => {
    const start = parseDateOnly(range.start);
    const total = differenceInCalendarDays(parseDateOnly(range.end), start) + 1;
    return Array.from({ length: total }, (_, i) => format(addDays(start, i), "yyyy-MM-dd"));
  }, [range.start, range.end]);

  const byDay = useMemo(() => {
    const map = new Map<string, DayItems>(days.map((d) => [d, { events: [], tasks: [] }]));
    const matchProject = (projectId: string | null) =>
      projectFilter === "all" || (projectFilter === "general" ? !projectId : projectId === projectFilter);

    if (showEvents) {
      for (const event of events) {
        if (!matchProject(event.project_id)) continue;
        const startYmd = zonedParts(event.starts_at).ymd;
        const endYmd = event.ends_at ? zonedParts(event.ends_at).ymd : startYmd;
        for (const day of days) {
          if (day >= startYmd && day <= endYmd) map.get(day)!.events.push(event);
        }
      }
    }
    if (showTasks) {
      for (const task of tasks) {
        if (!matchProject(task.project.id)) continue;
        map.get(task.due_date)?.tasks.push(task);
      }
    }
    return map;
  }, [days, events, tasks, projectFilter, showEvents, showTasks]);

  const step = (direction: -1 | 1) => {
    const next =
      view === "week"
        ? addDays(anchorDate, 7 * direction)
        : new Date(anchorDate.getFullYear(), anchorDate.getMonth() + direction, 1);
    return `/calendar?view=${view}&date=${format(next, "yyyy-MM-dd")}`;
  };

  const title =
    view === "month"
      ? formatMonthYear(anchorDate)
      : `${format(parseDateOnly(range.start), "dd 'de' MMM", { locale: ptBR })} – ${format(parseDateOnly(range.end), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}`;

  const openTask = (task: CalendarTaskItem) => router.push(`/projects/${task.project.id}/board?task=${task.id}`);
  const openEvent = (event: CalendarEventItem) => setDialog({ event, draft: null });
  const newEvent = (draft: EventDraft) => canEdit && setDialog({ event: null, draft });

  return (
    <div className="space-y-4">
      {/* Barra de navegação ------------------------------------------------- */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border bg-card p-1 shadow-xs">
            <Button asChild variant="ghost" size="icon-sm" aria-label="Anterior">
              <Link href={step(-1)}>
                <ChevronLeft />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/calendar?view=${view}&date=${today}`}>Hoje</Link>
            </Button>
            <Button asChild variant="ghost" size="icon-sm" aria-label="Próximo">
              <Link href={step(1)}>
                <ChevronRight />
              </Link>
            </Button>
          </div>
          <h2 className="text-lg font-extrabold">{title}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger size="sm" className="w-full min-w-40 sm:w-auto" aria-label="Filtrar por projeto">
              <SelectValue>
                <ProjectFilterLabel value={projectFilter} projects={projects} />
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os projetos</SelectItem>
              <SelectItem value="general">Geral da equipe</SelectItem>
              <SelectSeparator />
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-[13px] font-semibold">
            <Switch checked={showTasks} onCheckedChange={setShowTasks} /> Prazos
          </label>
          <label className="flex items-center gap-2 text-[13px] font-semibold">
            <Switch checked={showEvents} onCheckedChange={setShowEvents} /> Eventos
          </label>
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => v && router.push(`/calendar?view=${v}&date=${anchor}`)}
            aria-label="Visualização"
          >
            <ToggleGroupItem value="month">Mês</ToggleGroupItem>
            <ToggleGroupItem value="week">Semana</ToggleGroupItem>
          </ToggleGroup>
          <Button asChild size="sm" variant="outline">
            <Link href="/calendar/atas">
              <FileText /> Atas
            </Link>
          </Button>
          {canEdit && (
            <Button size="sm" onClick={() => newEvent({ date: today })}>
              <Plus /> Novo evento
            </Button>
          )}
        </div>
      </div>

      <Legend />

      {view === "month" ? (
        <MonthGrid
          days={days}
          byDay={byDay}
          today={today}
          month={anchorDate.getMonth()}
          canEdit={canEdit}
          onNewEvent={newEvent}
          onOpenEvent={openEvent}
          onOpenTask={openTask}
        />
      ) : (
        <WeekGrid
          days={days}
          byDay={byDay}
          today={today}
          canEdit={canEdit}
          onNewEvent={newEvent}
          onOpenEvent={openEvent}
          onOpenTask={openTask}
        />
      )}

      {dialog && (
        <EventDialog
          key={dialog.event?.id ?? `new-${dialog.draft?.date}-${dialog.draft?.time ?? ""}`}
          open
          onOpenChange={(open) => !open && setDialog(null)}
          event={dialog.event}
          draft={dialog.draft}
          initialTab={dialog.tab}
          projects={projects}
          members={members}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {(Object.keys(TYPE_COLOR) as EventType[]).map((type) => (
        <li key={type} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: TYPE_COLOR[type] }} />
          {EVENT_TYPE_LABEL[type]}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <Circle className="size-3" /> Prazo de tarefa
      </li>
    </ul>
  );
}

// -----------------------------------------------------------------------------
// Itens
// -----------------------------------------------------------------------------

function EventChip({ event, onOpen, compact }: { event: CalendarEventItem; onOpen: (e: CalendarEventItem) => void; compact?: boolean }) {
  const color = TYPE_COLOR[event.type];
  const time = !event.all_day ? zonedParts(event.starts_at).hm : null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(event);
      }}
      className="flex w-full items-center gap-1 truncate rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-[11.5px] font-semibold text-foreground transition hover:brightness-95"
      style={{ borderColor: color, backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)` }}
      title={`${EVENT_TYPE_LABEL[event.type]}: ${event.title}${event.project ? ` · ${event.project.name}` : ""}`}
    >
      {event.type === "milestone" ? <Flag className="size-3 shrink-0" style={{ color }} /> : null}
      {event.type === "meeting" && !compact ? <Video className="size-3 shrink-0" style={{ color }} /> : null}
      {time && <span className="shrink-0 font-bold tabular-nums">{time}</span>}
      <span className="truncate">{event.title}</span>
      {event.has_minutes && <FileText className="ml-auto size-3 shrink-0 opacity-70" aria-label="Tem ata" />}
    </button>
  );
}

function TaskChip({ task, onOpen }: { task: CalendarTaskItem; onOpen: (t: CalendarTaskItem) => void }) {
  const done = Boolean(task.completed_at);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(task);
      }}
      className={cn(
        "flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[11.5px] font-medium transition hover:bg-muted",
        done && "text-muted-foreground line-through",
      )}
      title={`Prazo: ${task.title} · ${task.project.name}`}
    >
      {done ? (
        <CircleCheck className="size-3 shrink-0 text-success" />
      ) : (
        <span className={cn("size-2 shrink-0 rounded-full", PRIORITY_STYLE[task.priority].dot)} />
      )}
      <span className="truncate">{task.title}</span>
      <span className="ml-auto size-1.5 shrink-0 rounded-full" style={{ backgroundColor: task.project.color }} />
    </button>
  );
}

// -----------------------------------------------------------------------------
// Visão mensal
// -----------------------------------------------------------------------------

function MonthGrid({
  days,
  byDay,
  today,
  month,
  canEdit,
  onNewEvent,
  onOpenEvent,
  onOpenTask,
}: {
  days: string[];
  byDay: Map<string, DayItems>;
  today: string;
  month: number;
  canEdit: boolean;
  onNewEvent: (draft: EventDraft) => void;
  onOpenEvent: (e: CalendarEventItem) => void;
  onOpenTask: (t: CalendarTaskItem) => void;
}) {
  const MAX_VISIBLE = 3;
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
      <div className="grid grid-cols-7 border-b bg-muted/50">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const date = parseDateOnly(day);
          const items = byDay.get(day) ?? { events: [], tasks: [] };
          const sortedEvents = [...items.events].sort((a, b) => Number(b.all_day) - Number(a.all_day) || a.starts_at.localeCompare(b.starts_at));
          const all = [
            ...sortedEvents.map((e) => ({ kind: "event" as const, event: e })),
            ...items.tasks.map((t) => ({ kind: "task" as const, task: t })),
          ];
          const visible = all.slice(0, MAX_VISIBLE);
          const hidden = all.length - visible.length;
          const outside = date.getMonth() !== month;
          const isToday = day === today;

          return (
            <div
              key={day}
              role={canEdit ? "button" : undefined}
              tabIndex={canEdit ? 0 : undefined}
              onClick={() => onNewEvent({ date: day })}
              onKeyDown={(e) => {
                if (canEdit && (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                  e.preventDefault();
                  onNewEvent({ date: day });
                }
              }}
              aria-label={canEdit ? `${format(date, "dd 'de' MMMM", { locale: ptBR })}: criar evento` : undefined}
              className={cn(
                "group min-h-28 space-y-1 border-b border-l p-1.5 text-left transition-colors [&:nth-child(7n+1)]:border-l-0",
                outside && "bg-muted/30",
                canEdit && "cursor-pointer hover:bg-brand-soft/30",
                index >= days.length - 7 && "border-b-0",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full text-xs font-bold",
                    isToday && "bg-brand text-white",
                    !isToday && outside && "text-muted-foreground/60",
                  )}
                >
                  {date.getDate()}
                </span>
                {canEdit && <Plus className="size-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100" />}
              </div>
              <div className="space-y-0.5">
                {visible.map((item) =>
                  item.kind === "event" ? (
                    <EventChip key={`e-${item.event.id}`} event={item.event} onOpen={onOpenEvent} compact />
                  ) : (
                    <TaskChip key={`t-${item.task.id}`} task={item.task} onOpen={onOpenTask} />
                  ),
                )}
                {hidden > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="w-full rounded-md px-1.5 py-0.5 text-left text-[11px] font-bold text-muted-foreground hover:bg-muted"
                      >
                        +{hidden} mais
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 space-y-1 p-2" onClick={(e) => e.stopPropagation()}>
                      <p className="px-1 pb-1 text-xs font-bold">
                        {capitalizeFirst(format(date, "EEEE, dd 'de' MMMM", { locale: ptBR }))}
                      </p>
                      {all.map((item) =>
                        item.kind === "event" ? (
                          <EventChip key={`pe-${item.event.id}`} event={item.event} onOpen={onOpenEvent} />
                        ) : (
                          <TaskChip key={`pt-${item.task.id}`} task={item.task} onOpen={onOpenTask} />
                        ),
                      )}
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Visão semanal (grade de horários)
// -----------------------------------------------------------------------------

type PositionedEvent = { event: CalendarEventItem; top: number; height: number; lane: number; lanes: number };

function layoutDay(events: CalendarEventItem[], day: string): PositionedEvent[] {
  const timed = events
    .filter((e) => !e.all_day && e.type !== "milestone")
    .map((e) => {
      const start = zonedParts(e.starts_at);
      const end = e.ends_at ? zonedParts(e.ends_at) : null;
      const startMin = start.ymd < day ? FIRST_HOUR * 60 : start.hour * 60 + start.minute;
      const endMin = !end ? startMin + 60 : end.ymd > day ? LAST_HOUR * 60 : end.hour * 60 + end.minute;
      return { event: e, startMin, endMin: Math.max(endMin, startMin + 30) };
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  const result: PositionedEvent[] = [];
  let cluster: typeof timed = [];
  let clusterEnd = -1;
  const flush = () => {
    const laneEnds: number[] = [];
    const placed = cluster.map((item) => {
      let lane = laneEnds.findIndex((end) => end <= item.startMin);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(item.endMin);
      } else laneEnds[lane] = item.endMin;
      return { item, lane };
    });
    for (const { item, lane } of placed) {
      const clampedStart = Math.max(item.startMin, FIRST_HOUR * 60);
      const clampedEnd = Math.min(item.endMin, (LAST_HOUR + 1) * 60);
      result.push({
        event: item.event,
        top: ((clampedStart - FIRST_HOUR * 60) / 60) * HOUR_PX,
        height: Math.max(22, ((clampedEnd - clampedStart) / 60) * HOUR_PX - 2),
        lane,
        lanes: laneEnds.length,
      });
    }
    cluster = [];
  };
  for (const item of timed) {
    if (cluster.length && item.startMin >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  if (cluster.length) flush();
  return result;
}

function WeekGrid({
  days,
  byDay,
  today,
  canEdit,
  onNewEvent,
  onOpenEvent,
  onOpenTask,
}: {
  days: string[];
  byDay: Map<string, DayItems>;
  today: string;
  canEdit: boolean;
  onNewEvent: (draft: EventDraft) => void;
  onOpenEvent: (e: CalendarEventItem) => void;
  onOpenTask: (t: CalendarTaskItem) => void;
}) {
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
  const now = useSyncExternalStore(
    subscribeMinute,
    () => {
      const p = zonedParts(new Date());
      return `${p.ymd}|${p.hour * 60 + p.minute}`;
    },
    () => null,
  );
  const [nowDay, nowMinutes] = now ? [now.split("|")[0], Number(now.split("|")[1])] : [null, 0];

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          {/* Cabeçalho */}
          <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b bg-muted/50">
            <div />
            {days.map((day) => {
              const date = parseDateOnly(day);
              return (
                <div key={day} className="border-l px-2 py-2 text-center">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase">{WEEKDAYS[date.getDay()]}</p>
                  <p
                    className={cn(
                      "mx-auto mt-0.5 grid size-7 place-items-center rounded-full text-sm font-extrabold",
                      day === today && "bg-brand text-white",
                    )}
                  >
                    {date.getDate()}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Dia inteiro: marcos, eventos de dia inteiro e prazos */}
          <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b">
            <div className="px-1 py-2 text-right text-[10px] font-semibold text-muted-foreground">Dia todo</div>
            {days.map((day) => {
              const items = byDay.get(day) ?? { events: [], tasks: [] };
              const allDay = items.events.filter((e) => e.all_day || e.type === "milestone");
              return (
                <div key={day} className="min-h-12 space-y-0.5 border-l p-1">
                  {allDay.map((e) => (
                    <EventChip key={e.id} event={e} onOpen={onOpenEvent} />
                  ))}
                  {items.tasks.map((t) => (
                    <TaskChip key={t.id} task={t} onOpen={onOpenTask} />
                  ))}
                </div>
              );
            })}
          </div>

          {/* Grade de horários */}
          <div className="scrollbar-thin max-h-[620px] overflow-y-auto">
            <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
              <div>
                {hours.map((h) => (
                  <div key={h} className="relative pr-2 text-right text-[10px] font-semibold text-muted-foreground" style={{ height: HOUR_PX }}>
                    {/* o primeiro rótulo fica abaixo da linha para não ser cortado pelo topo da rolagem */}
                    <span className={cn("inline-block", h !== hours[0] && "-translate-y-1.5")}>
                      {String(h).padStart(2, "0")}:00
                    </span>
                  </div>
                ))}
              </div>
              {days.map((day) => {
                const items = byDay.get(day) ?? { events: [], tasks: [] };
                const positioned = layoutDay(items.events, day);
                return (
                  <div key={day} className="relative border-l">
                    {hours.map((h) => (
                      <div
                        key={h}
                        role={canEdit ? "button" : undefined}
                        tabIndex={canEdit ? 0 : undefined}
                        aria-label={canEdit ? `Criar evento às ${h}h` : undefined}
                        onClick={() => onNewEvent({ date: day, time: `${String(h).padStart(2, "0")}:00` })}
                        onKeyDown={(e) => {
                          if (canEdit && (e.key === "Enter" || e.key === " ")) {
                            e.preventDefault();
                            onNewEvent({ date: day, time: `${String(h).padStart(2, "0")}:00` });
                          }
                        }}
                        className={cn("border-b border-border/60", canEdit && "cursor-pointer hover:bg-brand-soft/30")}
                        style={{ height: HOUR_PX }}
                      />
                    ))}
                    {positioned.map(({ event, top, height, lane, lanes }) => {
                      const color = TYPE_COLOR[event.type];
                      const start = zonedParts(event.starts_at).hm;
                      const end = event.ends_at ? zonedParts(event.ends_at).hm : null;
                      const compact = height < 40; // eventos curtos: título e horário numa linha só
                      return (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => onOpenEvent(event)}
                          className={cn(
                            "absolute overflow-hidden rounded-lg border-l-[3px] px-1.5 text-left text-[11px] leading-tight shadow-sm transition hover:z-10 hover:shadow-md",
                            compact ? "flex items-center" : "py-1",
                          )}
                          style={{
                            top,
                            height,
                            left: `calc(${(lane / lanes) * 100}% + 2px)`,
                            width: `calc(${100 / lanes}% - 4px)`,
                            borderColor: color,
                            backgroundColor: `color-mix(in oklab, ${color} 16%, var(--card))`,
                          }}
                          title={`${event.title} · ${start}${end ? `–${end}` : ""}`}
                        >
                          {compact ? (
                            <p className="truncate">
                              <span className="font-bold">{event.title}</span>{" "}
                              <span className="text-muted-foreground tabular-nums">{start}</span>
                            </p>
                          ) : (
                            <>
                              <p className="flex items-center gap-1 truncate font-bold">
                            <span className="truncate">{event.title}</span>
                            {event.has_minutes && <FileText className="size-3 shrink-0 opacity-70" aria-label="Tem ata" />}
                          </p>
                              <p className="truncate text-muted-foreground tabular-nums">
                                {start}
                                {end ? `–${end}` : ""}
                              </p>
                            </>
                          )}
                        </button>
                      );
                    })}
                    {nowDay === day && nowMinutes >= FIRST_HOUR * 60 && nowMinutes <= (LAST_HOUR + 1) * 60 && (
                      <div
                        className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                        style={{ top: ((nowMinutes - FIRST_HOUR * 60) / 60) * HOUR_PX }}
                        aria-hidden
                      >
                        <span className="-ml-1 size-2 rounded-full bg-destructive" />
                        <span className="h-0.5 flex-1 bg-destructive" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
