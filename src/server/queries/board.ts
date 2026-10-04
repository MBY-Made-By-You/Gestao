import "server-only";

import { TASK_CARD_SELECT, toTaskCard } from "@/lib/kanban/task-card";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, BoardColumn, MiniProfile, Project, Sprint, Tag, TaskCard } from "@/lib/types";

export type BoardMember = MiniProfile & { role: AppRole };

export type BoardData = {
  project: Project;
  columns: BoardColumn[];
  tasks: TaskCard[];
  tags: Tag[];
  members: BoardMember[];
  sprints: Sprint[];
};

/** Pessoas que podem ser responsáveis: equipe interna + membros do projeto. */
async function loadAssignableMembers(projectId: string): Promise<BoardMember[]> {
  const supabase = await createClient();
  const [{ data: profiles }, { data: projectMembers }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url, role").order("full_name"),
    supabase.from("project_members").select("user_id").eq("project_id", projectId),
  ]);
  const inProject = new Set((projectMembers ?? []).map((m) => m.user_id));
  return (profiles ?? []).filter((p) => p.role !== "viewer" || inProject.has(p.id));
}

export async function getBoardData(projectId: string): Promise<BoardData | null> {
  const supabase = await createClient();
  const [projectRes, columnsRes, tasksRes, tagsRes, sprintsRes, members] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
    supabase.from("board_columns").select("*").eq("project_id", projectId).order("position"),
    supabase
      .from("tasks")
      .select(TASK_CARD_SELECT)
      .eq("project_id", projectId)
      .not("column_id", "is", null)
      .order("position"),
    supabase.from("tags").select("*").eq("project_id", projectId).order("name"),
    supabase.from("sprints").select("*").eq("project_id", projectId).order("start_date", { ascending: false }),
    loadAssignableMembers(projectId),
  ]);

  if (projectRes.error) throw projectRes.error;
  if (!projectRes.data) return null;
  if (tasksRes.error) throw tasksRes.error;

  return {
    project: projectRes.data,
    columns: columnsRes.data ?? [],
    tasks: (tasksRes.data ?? []).map(toTaskCard),
    tags: tagsRes.data ?? [],
    members,
    sprints: sprintsRes.data ?? [],
  };
}

export async function getBacklogData(projectId: string) {
  const supabase = await createClient();
  const [projectRes, tasksRes, columnsRes, tagsRes, sprintsRes, members] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
    supabase
      .from("tasks")
      .select(TASK_CARD_SELECT)
      .eq("project_id", projectId)
      .is("column_id", null)
      .order("position"),
    supabase.from("board_columns").select("*").eq("project_id", projectId).order("position"),
    supabase.from("tags").select("*").eq("project_id", projectId).order("name"),
    supabase.from("sprints").select("*").eq("project_id", projectId).order("start_date"),
    loadAssignableMembers(projectId),
  ]);
  if (projectRes.error) throw projectRes.error;
  if (!projectRes.data) return null;
  if (tasksRes.error) throw tasksRes.error;

  // Pontos por sprint (inclui tarefas que já estão no quadro) para a capacidade.
  const sprintIds = (sprintsRes.data ?? []).map((s) => s.id);
  const { data: sprintTasks } = sprintIds.length
    ? await supabase
        .from("tasks")
        .select("id, sprint_id, story_points, completed_at, column_id")
        .in("sprint_id", sprintIds)
    : {
        data: [] as {
          id: string;
          sprint_id: string | null;
          story_points: number;
          completed_at: string | null;
          column_id: string | null;
        }[],
      };

  return {
    project: projectRes.data,
    tasks: (tasksRes.data ?? []).map(toTaskCard),
    columns: columnsRes.data ?? [],
    tags: tagsRes.data ?? [],
    sprints: sprintsRes.data ?? [],
    sprintTasks: sprintTasks ?? [],
    members,
  };
}
