"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { POSITION_GAP } from "@/lib/kanban/positions";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { ActionResult, Project, Sprint } from "@/lib/types";
import { failure, getActionContext } from "@/server/action-context";

const uuid = z.uuid();
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

const projectSchema = z
  .object({
    name: z.string().trim().min(1, "Dê um nome ao projeto.").max(120),
    description: z.string().trim().max(5000).nullable(),
    client_name: z.string().trim().max(120).nullable(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    status: z.enum(["planning", "active", "on_hold", "completed", "archived"]),
    start_date: dateOnly,
    due_date: dateOnly,
    budget: z.number().nonnegative().max(1e12).nullable(),
  })
  .refine((p) => !p.start_date || !p.due_date || p.due_date >= p.start_date, {
    message: "A entrega não pode ser antes do início.",
  });

export type ProjectInput = z.input<typeof projectSchema>;

export async function createProject(input: ProjectInput): Promise<ActionResult<Project>> {
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const context = await getActionContext("member");
  if (!context.ok) return context;

  const { data, error } = await context.ctx.supabase.from("projects").insert(parsed.data).select("*").single();
  if (error) return failure(error, "Não foi possível criar o projeto.");
  revalidatePath("/", "layout");
  return { ok: true, data };
}

export async function updateProject(projectId: string, input: ProjectInput): Promise<ActionResult<Project>> {
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success || !uuid.safeParse(projectId).success) {
    return { ok: false, error: parsed.error?.issues[0]?.message ?? "Dados inválidos." };
  }
  const context = await getActionContext("member");
  if (!context.ok) return context;

  const { data, error } = await context.ctx.supabase
    .from("projects")
    .update(parsed.data)
    .eq("id", projectId)
    .select("*")
    .single();
  if (error) return failure(error, "Não foi possível salvar o projeto.");
  revalidatePath("/", "layout");
  return { ok: true, data };
}

export async function deleteProject(projectId: string): Promise<ActionResult> {
  if (!uuid.safeParse(projectId).success) return { ok: false, error: "Projeto inválido." };
  const context = await getActionContext("member");
  if (!context.ok) return context;
  const { supabase } = context.ctx;

  // Limpa as imagens do Storage antes do CASCADE apagar os registros.
  const { data: attachments } = await supabase
    .from("task_attachments")
    .select("storage_path")
    .eq("project_id", projectId);
  if (attachments?.length) {
    await supabase.storage.from("task-attachments").remove(attachments.map((a) => a.storage_path));
  }
  const { data, error } = await supabase.from("projects").delete().eq("id", projectId).select("id");
  if (error) return failure(error, "Não foi possível excluir o projeto.");
  if (!data?.length) return { ok: false, error: "Apenas administradores ou o dono do projeto podem excluí-lo." };
  revalidatePath("/", "layout");
  redirect("/projects");
}

export async function addProjectMember(projectId: string, userId: string): Promise<ActionResult> {
  if (!uuid.safeParse(projectId).success || !uuid.safeParse(userId).success) return { ok: false, error: "Dados inválidos." };
  const context = await getActionContext("member");
  if (!context.ok) return context;
  const { error } = await context.ctx.supabase.from("project_members").insert({ project_id: projectId, user_id: userId });
  if (error) return failure(error, "Não foi possível adicionar o membro.");
  refresh();
  return { ok: true };
}

export async function removeProjectMember(projectId: string, userId: string): Promise<ActionResult> {
  if (!uuid.safeParse(projectId).success || !uuid.safeParse(userId).success) return { ok: false, error: "Dados inválidos." };
  const context = await getActionContext("member");
  if (!context.ok) return context;
  const { error } = await context.ctx.supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) return failure(error, "Não foi possível remover o membro.");
  refresh();
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Sprints e backlog
// -----------------------------------------------------------------------------

const sprintSchema = z
  .object({
    name: z.string().trim().min(1, "Dê um nome à sprint.").max(80),
    goal: z.string().trim().max(500).nullable(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe o início."),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe o fim."),
  })
  .refine((s) => s.end_date >= s.start_date, { message: "O fim não pode ser antes do início." });

export type SprintInput = z.input<typeof sprintSchema>;

export async function saveSprint(
  projectId: string,
  sprintId: string | null,
  input: SprintInput,
): Promise<ActionResult<Sprint>> {
  const parsed = sprintSchema.safeParse(input);
  if (!parsed.success || !uuid.safeParse(projectId).success) {
    return { ok: false, error: parsed.error?.issues[0]?.message ?? "Dados inválidos." };
  }
  const context = await getActionContext("member");
  if (!context.ok) return context;
  const { supabase } = context.ctx;

  const query = sprintId
    ? supabase.from("sprints").update(parsed.data).eq("id", sprintId).eq("project_id", projectId)
    : supabase.from("sprints").insert({ ...parsed.data, project_id: projectId });
  const { data, error } = await query.select("*").single();
  if (error) return failure(error, "Não foi possível salvar a sprint.");
  refresh();
  return { ok: true, data };
}

/** Inicia a sprint: vira a sprint ativa e suas tarefas do backlog entram no quadro. */
export async function startSprint(sprintId: string): Promise<ActionResult<{ moved: number }>> {
  if (!uuid.safeParse(sprintId).success) return { ok: false, error: "Sprint inválida." };
  const context = await getActionContext("member");
  if (!context.ok) return context;
  const { supabase } = context.ctx;

  try {
    const { data: sprint, error } = await supabase.from("sprints").select("*").eq("id", sprintId).single();
    if (error) throw error;

    const { data: running } = await supabase
      .from("sprints")
      .select("id, name")
      .eq("project_id", sprint.project_id)
      .eq("status", "active")
      .maybeSingle();
    if (running && running.id !== sprintId) {
      return { ok: false, error: `Conclua a sprint “${running.name}” antes de iniciar outra.` };
    }

    const { data: firstColumn } = await supabase
      .from("board_columns")
      .select("id")
      .eq("project_id", sprint.project_id)
      .order("position")
      .limit(1)
      .maybeSingle();
    if (!firstColumn) return { ok: false, error: "O quadro não tem colunas." };

    const { error: statusError } = await supabase.from("sprints").update({ status: "active" }).eq("id", sprintId);
    if (statusError) throw statusError;

    const moved = await sendToColumn(supabase, sprint.project_id, firstColumn.id, { sprintId });
    refresh();
    return { ok: true, data: { moved } };
  } catch (error) {
    return failure(error, "Não foi possível iniciar a sprint.");
  }
}

/** Conclui a sprint: tarefas não concluídas ficam sem sprint (voltam a ser planejáveis). */
export async function completeSprint(sprintId: string): Promise<ActionResult<{ carriedOver: number }>> {
  if (!uuid.safeParse(sprintId).success) return { ok: false, error: "Sprint inválida." };
  const context = await getActionContext("member");
  if (!context.ok) return context;
  const { supabase } = context.ctx;

  try {
    const { error } = await supabase.from("sprints").update({ status: "completed" }).eq("id", sprintId);
    if (error) throw error;
    const { data: carried, error: tasksError } = await supabase
      .from("tasks")
      .update({ sprint_id: null })
      .eq("sprint_id", sprintId)
      .is("completed_at", null)
      .select("id");
    if (tasksError) throw tasksError;
    refresh();
    return { ok: true, data: { carriedOver: carried?.length ?? 0 } };
  } catch (error) {
    return failure(error, "Não foi possível concluir a sprint.");
  }
}

export async function deleteSprint(sprintId: string): Promise<ActionResult> {
  if (!uuid.safeParse(sprintId).success) return { ok: false, error: "Sprint inválida." };
  const context = await getActionContext("member");
  if (!context.ok) return context;
  const { error } = await context.ctx.supabase.from("sprints").delete().eq("id", sprintId);
  if (error) return failure(error, "Não foi possível excluir a sprint.");
  refresh();
  return { ok: true };
}

/** Envia tarefas do backlog para a primeira coluna do quadro. */
export async function sendTasksToBoard(projectId: string, taskIds: string[]): Promise<ActionResult<{ moved: number }>> {
  const parsed = z.object({ projectId: uuid, taskIds: z.array(uuid).min(1).max(200) }).safeParse({ projectId, taskIds });
  if (!parsed.success) return { ok: false, error: "Seleção inválida." };
  const context = await getActionContext("member");
  if (!context.ok) return context;
  const { supabase } = context.ctx;

  try {
    const { data: firstColumn } = await supabase
      .from("board_columns")
      .select("id")
      .eq("project_id", projectId)
      .order("position")
      .limit(1)
      .maybeSingle();
    if (!firstColumn) return { ok: false, error: "O quadro não tem colunas." };
    const moved = await sendToColumn(supabase, projectId, firstColumn.id, { taskIds });
    refresh();
    return { ok: true, data: { moved } };
  } catch (error) {
    return failure(error, "Não foi possível enviar para o quadro.");
  }
}

async function sendToColumn(
  supabase: ServerSupabaseClient,
  projectId: string,
  columnId: string,
  filter: { sprintId?: string; taskIds?: string[] },
): Promise<number> {
  let query = supabase.from("tasks").select("id").eq("project_id", projectId).is("column_id", null).order("position");
  if (filter.sprintId) query = query.eq("sprint_id", filter.sprintId);
  if (filter.taskIds) query = query.in("id", filter.taskIds);
  const { data: tasks, error } = await query;
  if (error) throw error;

  const { data: last } = await supabase
    .from("tasks")
    .select("position")
    .eq("column_id", columnId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  let position = last?.position ?? 0;
  for (const task of tasks ?? []) {
    position += POSITION_GAP;
    const { error: updateError } = await supabase.from("tasks").update({ column_id: columnId, position }).eq("id", task.id);
    if (updateError) throw updateError;
  }
  return tasks?.length ?? 0;
}
