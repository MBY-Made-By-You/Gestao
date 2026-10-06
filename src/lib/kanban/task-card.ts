import { parseDateOnly } from "@/lib/format";
import type { MiniProfile, Tag, Task, TaskCard } from "@/lib/types";

/**
 * Select do PostgREST para montar o card do Kanban numa única ida ao banco:
 * responsáveis e etiquetas (N:N) e contagem de anexos.
 */
export const TASK_CARD_SELECT =
  "*, task_assignees(assigned_at, profile:profiles!task_assignees_user_id_fkey(id, full_name, avatar_url)), task_tags(tags(*)), task_attachments(count)" as const;

export type TaskAssigneeRow = { assigned_at: string; profile: MiniProfile | null };

/** Responsáveis em ordem de atribuição. */
export function toAssignees(rows: TaskAssigneeRow[] | null | undefined): MiniProfile[] {
  return [...(rows ?? [])]
    .sort((a, b) => a.assigned_at.localeCompare(b.assigned_at))
    .map((r) => r.profile)
    .filter((p): p is MiniProfile => Boolean(p));
}

type TaskCardRow = Task & {
  task_assignees: TaskAssigneeRow[];
  task_tags: { tags: Tag | null }[];
  task_attachments: { count: number }[];
};

export function toTaskCard(row: TaskCardRow): TaskCard {
  const { task_tags, task_attachments, task_assignees, ...task } = row;
  return {
    ...task,
    assignees: toAssignees(task_assignees),
    tags: task_tags
      .map((t) => t.tags)
      .filter((tag): tag is Tag => Boolean(tag))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    attachment_count: task_attachments[0]?.count ?? 0,
  };
}

/** "Ana", "Ana e Bruno", "Ana, Bruno e Carla". */
export function joinFirstNames(people: Pick<MiniProfile, "full_name">[]): string {
  const names = people.map((p) => p.full_name.split(" ")[0]);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
}

/** XP que CADA responsável recebe: base da tarefa +50% se concluída no prazo. */
export function xpWithBonus(task: Pick<TaskCard, "xp_reward" | "due_date" | "completed_at">) {
  const base = task.xp_reward ?? 0;
  if (!task.due_date || !task.completed_at) return base;
  const onTime = new Date(task.completed_at) <= new Date(parseDateOnly(task.due_date).getTime() + 86_399_999);
  return onTime ? base + Math.ceil(base * 0.5) : base;
}

/** Mensagem ao concluir: "+15 XP para Ana e Bruno" (cada um ganha o XP cheio). */
export function completionMessage(task: TaskCard) {
  if (task.assignees.length === 0) return "Tarefa concluída! Defina um responsável para ganhar XP.";
  const each = task.assignees.length > 1 ? " cada" : "";
  return `Tarefa concluída! +${xpWithBonus(task)} XP${each} para ${joinFirstNames(task.assignees)}`;
}
