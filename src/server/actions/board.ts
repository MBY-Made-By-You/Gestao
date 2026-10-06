"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { MIN_POSITION_GAP, POSITION_GAP } from "@/lib/kanban/positions";
import { TASK_CARD_SELECT, toTaskCard } from "@/lib/kanban/task-card";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { ActionResult, BoardColumn, Tag, TaskCard } from "@/lib/types";
import { failure, getActionContext } from "@/server/action-context";

const uuid = z.uuid("Identificador inválido.");
const MAX_ASSIGNEES = 10;
const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida.");
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
  .nullable();

const taskFields = z.object({
  title: z.string().trim().min(1, "Dê um título à tarefa.").max(200),
  description: z.string().max(10000).nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  due_date: dateOnly,
  story_points: z.number().int().min(0).max(21),
  sprint_id: uuid.nullable(),
  column_id: uuid.nullable(),
});

async function fetchTaskCard(supabase: ServerSupabaseClient, taskId: string): Promise<TaskCard> {
  const { data, error } = await supabase.from("tasks").select(TASK_CARD_SELECT).eq("id", taskId).single();
  if (error) throw error;
  return toTaskCard(data);
}

// -----------------------------------------------------------------------------
// Tarefas
// -----------------------------------------------------------------------------

const createTaskSchema = taskFields.partial().extend({
  project_id: uuid,
  title: taskFields.shape.title,
  tag_ids: z.array(uuid).max(20).optional(),
  assignee_ids: z.array(uuid).max(MAX_ASSIGNEES, `No máximo ${MAX_ASSIGNEES} responsáveis.`).optional(),
  position: z.number().finite().optional(),
});

export async function createTask(input: z.input<typeof createTaskSchema>): Promise<ActionResult<TaskCard>> {
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const context = await getActionContext("member");
  if (!context.ok) return context;
  const { supabase } = context.ctx;
  const { tag_ids, assignee_ids, position, ...fields } = parsed.data;

  try {
    // Posição no fim da coluna (ou do backlog).
    let finalPosition = position;
    if (finalPosition === undefined) {
      let query = supabase.from("tasks").select("position").eq("project_id", fields.project_id);
      query = fields.column_id ? query.eq("column_id", fields.column_id) : query.is("column_id", null);
      const { data: last } = await query.order("position", { ascending: false }).limit(1).maybeSingle();
      finalPosition = (last?.position ?? 0) + POSITION_GAP;
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({ ...fields, position: finalPosition })
      .select("id")
      .single();
    if (error) throw error;

    if (tag_ids?.length) {
      const { error: tagError } = await supabase
        .from("task_tags")
        .insert(tag_ids.map((tag_id) => ({ task_id: data.id, tag_id })));
      if (tagError) throw tagError;
    }
    if (assignee_ids?.length) {
      const { error: assigneeError } = await supabase
        .from("task_assignees")
        .insert([...new Set(assignee_ids)].map((user_id) => ({ task_id: data.id, user_id })));
      if (assigneeError) throw assigneeError;
    }
    return { ok: true, data: await fetchTaskCard(supabase, data.id) };
  } catch (error) {
    return failure(error, "Não foi possível criar a tarefa.");
  }
}

const updateTaskSchema = z.object({ id: uuid, patch: taskFields.partial() });

export async function updateTask(
  id: string,
  patch: z.input<typeof updateTaskSchema>["patch"],
): Promise<ActionResult<TaskCard>> {
  const parsed = updateTaskSchema.safeParse({ id, patch });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const context = await getActionContext("member");
  if (!context.ok) return context;
  const { supabase } = context.ctx;

  try {
    const update = { ...parsed.data.patch };
    // Ao mudar de coluna pelo formulário, a tarefa vai para o fim da coluna.
    if (update.column_id !== undefined) {
      const { data: current } = await supabase.from("tasks").select("column_id, project_id").eq("id", id).single();
      if (current && current.column_id !== update.column_id) {
        let query = supabase.from("tasks").select("position").eq("project_id", current.project_id);
        query = update.column_id ? query.eq("column_id", update.column_id) : query.is("column_id", null);
        const { data: last } = await query.order("position", { ascending: false }).limit(1).maybeSingle();
        Object.assign(update, { position: (last?.position ?? 0) + POSITION_GAP });
      }
    }
    const { error } = await supabase.from("tasks").update(update).eq("id", id);
    if (error) throw error;
    return { ok: true, data: await fetchTaskCard(supabase, id) };
  } catch (error) {
    return failure(error, "Não foi possível salvar a tarefa.");
  }
}

const moveTaskSchema = z.object({
  taskId: uuid,
  columnId: uuid,
  position: z.number().finite(),
  prev: z.number().finite().optional(),
  next: z.number().finite().optional(),
});

/**
 * Persiste um arraste do Kanban: 1 UPDATE (coluna + posição). Os gatilhos do
 * banco cuidam de completed_at e do XP quando a coluna é de conclusão.
 */
export async function moveTask(
  input: z.input<typeof moveTaskSchema>,
): Promise<ActionResult<{ task: TaskCard; rebalanced: boolean }>> {
  const parsed = moveTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Movimento inválido." };
  const context = await getActionContext("member");
  if (!context.ok) return context;
  const { supabase } = context.ctx;
  const { taskId, columnId, position, prev, next } = parsed.data;

  try {
    const { data: moved, error } = await supabase
      .from("tasks")
      .update({ column_id: columnId, position })
      .eq("id", taskId)
      .select("project_id")
      .single();
    if (error) throw error;

    let rebalanced = false;
    const squeezed =
      (prev !== undefined && Math.abs(position - prev) < MIN_POSITION_GAP) ||
      (next !== undefined && Math.abs(next - position) < MIN_POSITION_GAP);
    if (squeezed) {
      const { error: rpcError } = await supabase.rpc("rebalance_task_positions", {
        p_project_id: moved.project_id,
        p_column_id: columnId,
      });
      if (rpcError) throw rpcError;
      rebalanced = true;
    }

    return { ok: true, data: { task: await fetchTaskCard(supabase, taskId), rebalanced } };
  } catch (error) {
    return failure(error, "Não foi possível mover a tarefa.");
  }
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  if (!uuid.safeParse(taskId).success) return { ok: false, error: "Tarefa inválida." };
  const context = await getActionContext("member");
  if (!context.ok) return context;
  const { supabase } = context.ctx;

  try {
    // Remove os arquivos do Storage antes (o CASCADE só apaga os registros).
    const { data: attachments } = await supabase
      .from("task_attachments")
      .select("storage_path")
      .eq("task_id", taskId);
    if (attachments?.length) {
      await supabase.storage.from("task-attachments").remove(attachments.map((a) => a.storage_path));
    }
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    return failure(error, "Não foi possível excluir a tarefa.");
  }
}

export async function setTaskTags(taskId: string, tagIds: string[]): Promise<ActionResult<TaskCard>> {
  const parsed = z.object({ taskId: uuid, tagIds: z.array(uuid).max(20) }).safeParse({ taskId, tagIds });
  if (!parsed.success) return { ok: false, error: "Etiquetas inválidas." };
  const context = await getActionContext("member");
  if (!context.ok) return context;
  const { supabase } = context.ctx;

  try {
    const { data: current, error } = await supabase.from("task_tags").select("tag_id").eq("task_id", taskId);
    if (error) throw error;
    const currentIds = new Set((current ?? []).map((t) => t.tag_id));
    const wanted = new Set(tagIds);
    const toRemove = [...currentIds].filter((id) => !wanted.has(id));
    const toAdd = [...wanted].filter((id) => !currentIds.has(id));
    if (toRemove.length) {
      const { error: delError } = await supabase.from("task_tags").delete().eq("task_id", taskId).in("tag_id", toRemove);
      if (delError) throw delError;
    }
    if (toAdd.length) {
      const { error: insError } = await supabase
        .from("task_tags")
        .insert(toAdd.map((tag_id) => ({ task_id: taskId, tag_id })));
      if (insError) throw insError;
    }
    return { ok: true, data: await fetchTaskCard(supabase, taskId) };
  } catch (error) {
    return failure(error, "Não foi possível atualizar as etiquetas.");
  }
}

/**
 * Define os responsáveis da tarefa. Os gatilhos do banco dão (ou estornam) o
 * XP de quem entra/sai quando a tarefa já está concluída.
 */
export async function setTaskAssignees(taskId: string, userIds: string[]): Promise<ActionResult<TaskCard>> {
  const parsed = z
    .object({ taskId: uuid, userIds: z.array(uuid).max(MAX_ASSIGNEES, `No máximo ${MAX_ASSIGNEES} responsáveis.`) })
    .safeParse({ taskId, userIds });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Responsáveis inválidos." };
  const context = await getActionContext("member");
  if (!context.ok) return context;
  const { supabase } = context.ctx;

  try {
    const { data: current, error } = await supabase.from("task_assignees").select("user_id").eq("task_id", taskId);
    if (error) throw error;
    const currentIds = new Set((current ?? []).map((a) => a.user_id));
    const wanted = new Set(userIds);
    const toRemove = [...currentIds].filter((id) => !wanted.has(id));
    const toAdd = [...wanted].filter((id) => !currentIds.has(id));
    if (toRemove.length) {
      const { error: delError } = await supabase
        .from("task_assignees")
        .delete()
        .eq("task_id", taskId)
        .in("user_id", toRemove);
      if (delError) throw delError;
    }
    if (toAdd.length) {
      const { error: insError } = await supabase
        .from("task_assignees")
        .insert(toAdd.map((user_id) => ({ task_id: taskId, user_id })));
      if (insError) throw insError;
    }
    return { ok: true, data: await fetchTaskCard(supabase, taskId) };
  } catch (error) {
    return failure(error, "Não foi possível atualizar os responsáveis.");
  }
}

export async function createTag(projectId: string, name: string, color: string): Promise<ActionResult<Tag>> {
  const parsed = z
    .object({ projectId: uuid, name: z.string().trim().min(1).max(40), color: hexColor })
    .safeParse({ projectId, name, color });
  if (!parsed.success) return { ok: false, error: "Etiqueta inválida." };
  const context = await getActionContext("member");
  if (!context.ok) return context;

  const { data, error } = await context.ctx.supabase
    .from("tags")
    .insert({ project_id: parsed.data.projectId, name: parsed.data.name, color: parsed.data.color })
    .select("*")
    .single();
  if (error) return failure(error, "Não foi possível criar a etiqueta.");
  return { ok: true, data };
}

// -----------------------------------------------------------------------------
// Colunas
// -----------------------------------------------------------------------------

const columnFields = z.object({
  name: z.string().trim().min(1, "Dê um nome à coluna.").max(60),
  color: hexColor,
  wip_limit: z.number().int().positive().max(999).nullable(),
  is_done: z.boolean(),
});

const tagSchema = z.object({
  tagId: uuid,
  name: z.string().trim().min(1, "Dê um nome à etiqueta.").max(40, "Nome muito longo (máx. 40)."),
  color: hexColor,
});

/** Renomeia/recolore a etiqueta — vale para todas as tarefas que a usam. */
export async function updateTag(tagId: string, name: string, color: string): Promise<ActionResult<Tag>> {
  const parsed = tagSchema.safeParse({ tagId, name, color });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Etiqueta inválida." };
  const context = await getActionContext("member");
  if (!context.ok) return context;

  const { data, error } = await context.ctx.supabase
    .from("tags")
    .update({ name: parsed.data.name, color: parsed.data.color })
    .eq("id", parsed.data.tagId)
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Já existe uma etiqueta com esse nome no projeto." };
    return failure(error, "Não foi possível salvar a etiqueta.");
  }
  return { ok: true, data };
}

/** Exclui a etiqueta do projeto (sai de todas as tarefas). */
export async function deleteTag(tagId: string): Promise<ActionResult> {
  if (!uuid.safeParse(tagId).success) return { ok: false, error: "Etiqueta inválida." };
  const context = await getActionContext("member");
  if (!context.ok) return context;

  const { error } = await context.ctx.supabase.from("tags").delete().eq("id", tagId);
  if (error) return failure(error, "Não foi possível excluir a etiqueta.");
  return { ok: true };
}

export async function createColumn(
  projectId: string,
  fields: z.input<typeof columnFields>,
): Promise<ActionResult<BoardColumn>> {
  const parsed = columnFields.safeParse(fields);
  if (!parsed.success || !uuid.safeParse(projectId).success) {
    return { ok: false, error: parsed.error?.issues[0]?.message ?? "Dados inválidos." };
  }
  const context = await getActionContext("member");
  if (!context.ok) return context;
  const { supabase } = context.ctx;

  const { data: last } = await supabase
    .from("board_columns")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("board_columns")
    .insert({ ...parsed.data, project_id: projectId, position: (last?.position ?? 0) + POSITION_GAP })
    .select("*")
    .single();
  if (error) return failure(error, "Não foi possível criar a coluna.");
  return { ok: true, data };
}

export async function updateColumn(
  columnId: string,
  fields: Partial<z.input<typeof columnFields>>,
): Promise<ActionResult<BoardColumn>> {
  const parsed = columnFields.partial().safeParse(fields);
  if (!parsed.success || !uuid.safeParse(columnId).success) {
    return { ok: false, error: parsed.error?.issues[0]?.message ?? "Dados inválidos." };
  }
  const context = await getActionContext("member");
  if (!context.ok) return context;

  const { data, error } = await context.ctx.supabase
    .from("board_columns")
    .update(parsed.data)
    .eq("id", columnId)
    .select("*")
    .single();
  if (error) return failure(error, "Não foi possível salvar a coluna.");
  // Marcar/desmarcar "concluída" altera tarefas (gatilho) — recarrega a página.
  if (parsed.data.is_done !== undefined) refresh();
  return { ok: true, data };
}

export async function moveColumn(columnId: string, position: number): Promise<ActionResult> {
  if (!uuid.safeParse(columnId).success || !Number.isFinite(position)) return { ok: false, error: "Movimento inválido." };
  const context = await getActionContext("member");
  if (!context.ok) return context;
  const { error } = await context.ctx.supabase.from("board_columns").update({ position }).eq("id", columnId);
  if (error) return failure(error, "Não foi possível reordenar as colunas.");
  return { ok: true };
}

/**
 * Exclui a coluna. Se `moveTasksTo` for informado, as tarefas vão para o fim
 * daquela coluna; senão voltam para o backlog (FK ON DELETE SET NULL).
 */
export async function deleteColumn(columnId: string, moveTasksTo: string | null): Promise<ActionResult> {
  if (!uuid.safeParse(columnId).success || (moveTasksTo && !uuid.safeParse(moveTasksTo).success)) {
    return { ok: false, error: "Dados inválidos." };
  }
  const context = await getActionContext("member");
  if (!context.ok) return context;
  const { supabase } = context.ctx;

  try {
    if (moveTasksTo) {
      const [{ data: tasks }, { data: last }] = await Promise.all([
        supabase.from("tasks").select("id").eq("column_id", columnId).order("position"),
        supabase
          .from("tasks")
          .select("position")
          .eq("column_id", moveTasksTo)
          .order("position", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      let position = last?.position ?? 0;
      for (const task of tasks ?? []) {
        position += POSITION_GAP;
        const { error } = await supabase.from("tasks").update({ column_id: moveTasksTo, position }).eq("id", task.id);
        if (error) throw error;
      }
    }
    const { error } = await supabase.from("board_columns").delete().eq("id", columnId);
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (error) {
    return failure(error, "Não foi possível excluir a coluna.");
  }
}
