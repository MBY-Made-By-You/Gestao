import "server-only";

import { addDays, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";

import { toDateInput } from "@/lib/format";
import { wallTimeToIso } from "@/lib/timezone";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, CalendarEvent, MiniProfile, TaskPriority } from "@/lib/types";

export type CalendarView = "month" | "week";

export type CalendarEventItem = CalendarEvent & {
  project: { id: string; name: string; color: string } | null;
  attendees: string[];
};

export type CalendarTaskItem = {
  id: string;
  title: string;
  due_date: string;
  priority: TaskPriority;
  completed_at: string | null;
  project: { id: string; name: string; color: string };
  assignee: MiniProfile | null;
};

export function calendarRange(view: CalendarView, anchor: Date) {
  if (view === "week") {
    const start = startOfWeek(anchor, { weekStartsOn: 0 });
    return { start, end: addDays(start, 6) };
  }
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 0 });
  return { start, end };
}

export async function getCalendarData(view: CalendarView, anchor: Date) {
  const supabase = await createClient();
  const { start, end } = calendarRange(view, anchor);
  // Limites do intervalo no fuso da equipe (o servidor roda em UTC).
  const fromIso = wallTimeToIso(toDateInput(start), "00:00");
  const toIso = new Date(new Date(wallTimeToIso(toDateInput(end), "23:59")).getTime() + 59_999).toISOString();

  const [eventsRes, tasksRes, projectsRes, profilesRes] = await Promise.all([
    supabase
      .from("events")
      .select("*, project:projects(id, name, color), event_attendees(user_id)")
      .lte("starts_at", toIso)
      .or(`ends_at.gte.${fromIso},and(ends_at.is.null,starts_at.gte.${fromIso})`)
      .order("starts_at"),
    supabase
      .from("tasks")
      .select(
        "id, title, due_date, priority, completed_at, project:projects(id, name, color), assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url)",
      )
      .gte("due_date", toDateInput(start))
      .lte("due_date", toDateInput(end))
      .order("due_date"),
    supabase.from("projects").select("id, name, color").in("status", ["planning", "active", "on_hold"]).order("name"),
    supabase.from("profiles").select("id, full_name, avatar_url, role").order("full_name"),
  ]);
  if (eventsRes.error) throw eventsRes.error;
  if (tasksRes.error) throw tasksRes.error;

  const events: CalendarEventItem[] = (eventsRes.data ?? []).map(({ event_attendees, ...e }) => ({
    ...e,
    attendees: event_attendees.map((a) => a.user_id),
  }));
  const tasks: CalendarTaskItem[] = (tasksRes.data ?? []).flatMap((t) =>
    t.due_date ? [{ ...t, due_date: t.due_date }] : [],
  );

  return {
    range: { start: toDateInput(start), end: toDateInput(end) },
    events,
    tasks,
    projects: projectsRes.data ?? [],
    members: (profilesRes.data ?? []) as (MiniProfile & { role: AppRole })[],
  };
}
