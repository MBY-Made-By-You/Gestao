import "server-only";

import { addDays, format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

import { buildBurndown, type BurndownResult } from "@/lib/analytics/burndown";
import { toDateInput } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { CalendarEvent, MemberStats, MiniProfile, SessionProfile, TaskPriority } from "@/lib/types";
import { toNumber } from "@/lib/utils";

export type DashboardProject = {
  id: string;
  name: string;
  color: string;
  status: string;
  due_date: string | null;
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
  totalPoints: number;
  donePoints: number;
  burndown: BurndownResult & { label: string };
};

export type UrgentTask = {
  id: string;
  title: string;
  due_date: string;
  priority: TaskPriority;
  project: { id: string; name: string; color: string };
  assignee: MiniProfile | null;
};

export type CashflowPoint = { month: string; label: string; income: number; expense: number; balance: number };

export type DashboardData = {
  projects: DashboardProject[];
  urgentTasks: UrgentTask[];
  myOpenTasks: number;
  openTasks: number;
  finance: {
    monthIncome: number;
    monthExpense: number;
    monthBalance: number;
    totalBalance: number;
    pendingIncome: number;
    pendingExpense: number;
    history: CashflowPoint[];
  } | null;
  upcomingEvents: (CalendarEvent & { project: { name: string; color: string } | null })[];
  leaderboard: (MemberStats & { profile: MiniProfile })[];
  myStats: MemberStats | null;
};

export async function getDashboardData(profile: SessionProfile): Promise<DashboardData> {
  const supabase = await createClient();
  const today = new Date();
  const todayStr = toDateInput(today);
  const weekAhead = toDateInput(addDays(today, 7));
  const historyStart = toDateInput(startOfMonth(subMonths(today, 5)));
  const thisMonth = toDateInput(startOfMonth(today));

  const [projectsRes, urgentRes, openRes, myOpenRes, eventsRes, statsRes, profilesRes, financeRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, color, status, start_date, due_date, created_at")
      .in("status", ["active", "planning"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),
    supabase
      .from("tasks")
      .select(
        "id, title, due_date, priority, project:projects(id, name, color), assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url)",
      )
      .is("completed_at", null)
      .not("column_id", "is", null)
      .not("due_date", "is", null)
      .lte("due_date", weekAhead)
      .order("due_date")
      .limit(8),
    supabase.from("tasks").select("id", { count: "exact", head: true }).is("completed_at", null).not("column_id", "is", null),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .is("completed_at", null)
      .eq("assignee_id", profile.id),
    supabase
      .from("events")
      .select("*, project:projects(name, color)")
      .gte("starts_at", new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString())
      .lte("starts_at", addDays(today, 14).toISOString())
      .order("starts_at")
      .limit(5),
    supabase.from("member_stats").select("*").order("xp", { ascending: false }),
    supabase.from("profiles").select("id, full_name, avatar_url, role"),
    profile.isStaff
      ? supabase.from("finance_monthly").select("*").order("month")
      : Promise.resolve({ data: null }),
  ]);

  // Burn-down/progresso por projeto ativo.
  const projects = projectsRes.data ?? [];
  const projectIds = projects.map((p) => p.id);
  const [{ data: projectTasks }, { data: activeSprints }] = projectIds.length
    ? await Promise.all([
        supabase
          .from("tasks")
          .select("project_id, sprint_id, story_points, created_at, completed_at, due_date")
          .in("project_id", projectIds),
        supabase.from("sprints").select("*").in("project_id", projectIds).eq("status", "active"),
      ])
    : [{ data: [] }, { data: [] }];

  const dashboardProjects: DashboardProject[] = projects.map((p) => {
    const tasks = (projectTasks ?? []).filter((t) => t.project_id === p.id);
    const sprint = (activeSprints ?? []).find((s) => s.project_id === p.id);
    const scoped = sprint ? tasks.filter((t) => t.sprint_id === sprint.id) : tasks;
    let start = sprint?.start_date ?? p.start_date ?? p.created_at.slice(0, 10);
    const end = sprint?.end_date ?? p.due_date ?? toDateInput(addDays(today, 14));
    if (end < start) start = end;
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      status: p.status,
      due_date: p.due_date,
      totalTasks: tasks.length,
      doneTasks: tasks.filter((t) => t.completed_at).length,
      overdueTasks: tasks.filter((t) => !t.completed_at && t.due_date && t.due_date < todayStr).length,
      totalPoints: tasks.reduce((s, t) => s + t.story_points, 0),
      donePoints: tasks.filter((t) => t.completed_at).reduce((s, t) => s + t.story_points, 0),
      burndown: { ...buildBurndown(scoped, { start, end }, today), label: sprint ? sprint.name : "Projeto completo" },
    };
  });

  // Financeiro (somente equipe interna).
  let finance: DashboardData["finance"] = null;
  if (financeRes.data) {
    const rows = financeRes.data.map((r) => ({
      month: (r.month ?? "").slice(0, 10),
      income: toNumber(r.income),
      expense: toNumber(r.expense),
      balance: toNumber(r.balance),
      pendingIncome: toNumber(r.pending_income),
      pendingExpense: toNumber(r.pending_expense),
    }));
    const current = rows.find((r) => r.month === thisMonth);
    const history: CashflowPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const month = toDateInput(startOfMonth(subMonths(today, i)));
      const row = rows.find((r) => r.month === month);
      history.push({
        month,
        label: format(startOfMonth(subMonths(today, i)), "MMM", { locale: ptBR }),
        income: row?.income ?? 0,
        expense: row?.expense ?? 0,
        balance: row?.balance ?? 0,
      });
    }
    finance = {
      monthIncome: current?.income ?? 0,
      monthExpense: current?.expense ?? 0,
      monthBalance: current?.balance ?? 0,
      totalBalance: rows.reduce((s, r) => s + r.balance, 0),
      pendingIncome: rows.reduce((s, r) => s + r.pendingIncome, 0),
      pendingExpense: rows.reduce((s, r) => s + r.pendingExpense, 0),
      history: history.filter((h) => h.month >= historyStart),
    };
  }

  const profiles = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
  const stats = statsRes.data ?? [];
  const leaderboard = stats
    .filter((s) => s.user_id && profiles.get(s.user_id) && profiles.get(s.user_id)!.role !== "viewer")
    .slice(0, 5)
    .map((s) => ({ ...s, profile: profiles.get(s.user_id!)! }));

  return {
    projects: dashboardProjects,
    urgentTasks: (urgentRes.data ?? []).flatMap((t) => (t.due_date ? [{ ...t, due_date: t.due_date }] : [])),
    myOpenTasks: myOpenRes.count ?? 0,
    openTasks: openRes.count ?? 0,
    finance,
    upcomingEvents: eventsRes.data ?? [],
    leaderboard,
    myStats: stats.find((s) => s.user_id === profile.id) ?? null,
  };
}
