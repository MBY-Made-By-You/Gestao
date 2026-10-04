import "server-only";

import { buildBurndown, type BurndownResult } from "@/lib/analytics/burndown";
import { toDateInput } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type {
  AppRole,
  CalendarEvent,
  MiniProfile,
  Project,
  ProjectFinancials,
  ProjectProgress,
  ProjectStatus,
  Sprint,
} from "@/lib/types";

export type ProjectListItem = Project & {
  progress: ProjectProgress | null;
  financials: ProjectFinancials | null;
  members: (MiniProfile & { role: AppRole })[];
};

const ACTIVE_STATUSES: ProjectStatus[] = ["planning", "active", "on_hold"];

export async function listProjects(filter: "active" | "all" | "closed" = "active"): Promise<ProjectListItem[]> {
  const supabase = await createClient();
  let query = supabase.from("projects").select("*").order("updated_at", { ascending: false });
  if (filter === "active") query = query.in("status", ACTIVE_STATUSES);
  if (filter === "closed") query = query.in("status", ["completed", "archived"]);
  const { data: projects, error } = await query;
  if (error) throw error;
  if (!projects?.length) return [];

  const ids = projects.map((p) => p.id);
  const [{ data: progress }, { data: financials }, { data: members }] = await Promise.all([
    supabase.from("project_progress").select("*").in("project_id", ids),
    supabase.from("project_financials").select("*").in("project_id", ids),
    supabase
      .from("project_members")
      .select("project_id, profile:profiles(id, full_name, avatar_url, role)")
      .in("project_id", ids),
  ]);

  const progressBy = new Map((progress ?? []).map((p) => [p.project_id, p]));
  const financialsBy = new Map((financials ?? []).map((f) => [f.project_id, f]));
  const membersBy = new Map<string, ProjectListItem["members"]>();
  for (const m of members ?? []) {
    if (!m.profile) continue;
    const list = membersBy.get(m.project_id) ?? [];
    list.push(m.profile);
    membersBy.set(m.project_id, list);
  }

  return projects.map((p) => ({
    ...p,
    progress: progressBy.get(p.id) ?? null,
    financials: financialsBy.get(p.id) ?? null,
    members: membersBy.get(p.id) ?? [],
  }));
}

export type ProjectOverview = {
  project: Project;
  progress: ProjectProgress | null;
  financials: ProjectFinancials | null;
  members: (MiniProfile & { role: AppRole; email: string | null })[];
  allProfiles: (MiniProfile & { role: AppRole })[];
  sprints: Sprint[];
  activeSprint: Sprint | null;
  burndown: BurndownResult & { scope: "sprint" | "project"; label: string; start: string; end: string };
  milestones: CalendarEvent[];
  upcomingTasks: { id: string; title: string; due_date: string | null; priority: string; assignee: MiniProfile | null }[];
  ownerName: string | null;
};

export async function getProjectOverview(projectId: string): Promise<ProjectOverview | null> {
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) return null;

  const today = toDateInput();
  const [progressRes, financialsRes, membersRes, profilesRes, sprintsRes, tasksRes, milestonesRes, upcomingRes] =
    await Promise.all([
      supabase.from("project_progress").select("*").eq("project_id", projectId).maybeSingle(),
      supabase.from("project_financials").select("*").eq("project_id", projectId).maybeSingle(),
      supabase
        .from("project_members")
        .select("profile:profiles(id, full_name, avatar_url, role, email)")
        .eq("project_id", projectId),
      supabase.from("profiles").select("id, full_name, avatar_url, role").order("full_name"),
      supabase.from("sprints").select("*").eq("project_id", projectId).order("start_date", { ascending: false }),
      supabase.from("tasks").select("story_points, created_at, completed_at, sprint_id").eq("project_id", projectId),
      supabase
        .from("events")
        .select("*")
        .eq("project_id", projectId)
        .eq("type", "milestone")
        .order("starts_at")
        .limit(6),
      supabase
        .from("tasks")
        .select("id, title, due_date, priority, assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url)")
        .eq("project_id", projectId)
        .is("completed_at", null)
        .not("due_date", "is", null)
        .gte("due_date", today)
        .order("due_date")
        .limit(6),
    ]);

  const sprints = sprintsRes.data ?? [];
  const activeSprint = sprints.find((s) => s.status === "active") ?? null;
  const tasks = tasksRes.data ?? [];

  // Burn-down da sprint ativa; sem sprint, do projeto inteiro.
  let scope: "sprint" | "project" = "project";
  let start = project.start_date ?? project.created_at.slice(0, 10);
  let end = project.due_date ?? toDateInput(new Date(Date.now() + 14 * 86_400_000));
  let scopedTasks = tasks;
  let label = "Projeto completo";
  if (activeSprint) {
    scope = "sprint";
    start = activeSprint.start_date;
    end = activeSprint.end_date;
    scopedTasks = tasks.filter((t) => t.sprint_id === activeSprint.id);
    label = activeSprint.name;
  }
  if (end < start) end = start;

  const owner = profilesRes.data?.find((p) => p.id === project.owner_id);

  return {
    project,
    progress: progressRes.data ?? null,
    financials: financialsRes.data ?? null,
    members: (membersRes.data ?? []).map((m) => m.profile).filter((p): p is NonNullable<typeof p> => Boolean(p)),
    allProfiles: profilesRes.data ?? [],
    sprints,
    activeSprint,
    burndown: { ...buildBurndown(scopedTasks, { start, end }), scope, label, start, end },
    milestones: milestonesRes.data ?? [],
    upcomingTasks: upcomingRes.data ?? [],
    ownerName: owner?.full_name ?? null,
  };
}
