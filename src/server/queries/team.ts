import "server-only";

import { format, startOfWeek, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";

import { createClient } from "@/lib/supabase/server";
import type { MemberStats, Profile } from "@/lib/types";

export type TeamMember = Profile & { stats: MemberStats };

const EMPTY_STATS = (userId: string): MemberStats => ({
  user_id: userId,
  xp: 0,
  tasks_completed: 0,
  tasks_on_time: 0,
  tasks_completed_with_due: 0,
  open_tasks: 0,
  tasks_completed_last_30d: 0,
});

export async function getTeam(): Promise<TeamMember[]> {
  const supabase = await createClient();
  const [{ data: profiles, error }, { data: stats }] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("member_stats").select("*"),
  ]);
  if (error) throw error;
  const byUser = new Map((stats ?? []).map((s) => [s.user_id, s]));
  return (profiles ?? [])
    .map((p) => ({ ...p, stats: byUser.get(p.id) ?? EMPTY_STATS(p.id) }))
    .sort((a, b) => (b.stats.xp ?? 0) - (a.stats.xp ?? 0));
}

export async function getMemberProfile(userId: string) {
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (!profile) return null;

  const since = startOfWeek(subWeeks(new Date(), 11), { weekStartsOn: 1 });
  const [{ data: stats }, { data: xpEvents }, { data: openTasks }, { data: completed }, { data: allStats }] =
    await Promise.all([
      supabase.from("member_stats").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("xp_events")
        .select("id, points, on_time, created_at, task:tasks(id, title, project_id, project:projects(name, color))")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("tasks")
        .select("id, title, due_date, priority, project_id, project:projects(name, color)")
        .eq("assignee_id", userId)
        .is("completed_at", null)
        .not("column_id", "is", null)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(10),
      supabase
        .from("tasks")
        .select("completed_at")
        .eq("assignee_id", userId)
        .gte("completed_at", since.toISOString()),
      supabase.from("member_stats").select("user_id, xp").order("xp", { ascending: false }),
    ]);

  // Tarefas concluídas por semana (últimas 12 semanas).
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = startOfWeek(subWeeks(new Date(), 11 - i), { weekStartsOn: 1 });
    return { key: start.toISOString().slice(0, 10), label: format(start, "dd MMM", { locale: ptBR }), count: 0 };
  });
  for (const t of completed ?? []) {
    if (!t.completed_at) continue;
    const key = startOfWeek(new Date(t.completed_at), { weekStartsOn: 1 }).toISOString().slice(0, 10);
    const week = weeks.find((w) => w.key === key);
    if (week) week.count += 1;
  }

  const rank = (allStats ?? []).findIndex((s) => s.user_id === userId) + 1;

  return {
    profile,
    stats: stats ?? EMPTY_STATS(userId),
    xpEvents: xpEvents ?? [],
    openTasks: openTasks ?? [],
    weekly: weeks,
    rank: rank > 0 ? rank : null,
  };
}
