import type { MiniProfile, Tag, Task, TaskCard } from "@/lib/types";

/**
 * Select do PostgREST para montar o card do Kanban numa única ida ao banco:
 * responsável (FK desambiguada), etiquetas (N:N) e contagem de anexos.
 */
export const TASK_CARD_SELECT =
  "*, assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url), task_tags(tags(*)), task_attachments(count)" as const;

type TaskCardRow = Task & {
  assignee: MiniProfile | null;
  task_tags: { tags: Tag | null }[];
  task_attachments: { count: number }[];
};

export function toTaskCard(row: TaskCardRow): TaskCard {
  const { task_tags, task_attachments, assignee, ...task } = row;
  return {
    ...task,
    assignee: assignee ?? null,
    tags: task_tags
      .map((t) => t.tags)
      .filter((tag): tag is Tag => Boolean(tag))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    attachment_count: task_attachments[0]?.count ?? 0,
  };
}
