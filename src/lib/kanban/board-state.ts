import type { BoardColumn, TaskCard, TaskPriority } from "@/lib/types";

import { positionBetween } from "./positions";

/** Estado do quadro: colunas ordenadas + tarefas agrupadas por coluna. */
export type BoardState = {
  columns: BoardColumn[];
  tasksByColumn: Record<string, TaskCard[]>;
};

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

export function createBoardState(columns: BoardColumn[], tasks: TaskCard[]): BoardState {
  const sortedColumns = [...columns].sort(byPosition);
  const tasksByColumn: Record<string, TaskCard[]> = Object.fromEntries(sortedColumns.map((c) => [c.id, []]));
  for (const task of tasks) {
    if (task.column_id && tasksByColumn[task.column_id]) tasksByColumn[task.column_id].push(task);
  }
  for (const id of Object.keys(tasksByColumn)) tasksByColumn[id].sort(byPosition);
  return { columns: sortedColumns, tasksByColumn };
}

export function findTaskColumn(state: BoardState, taskId: string): string | null {
  for (const [columnId, tasks] of Object.entries(state.tasksByColumn)) {
    if (tasks.some((t) => t.id === taskId)) return columnId;
  }
  return null;
}

export function findTask(state: BoardState, taskId: string): TaskCard | null {
  for (const tasks of Object.values(state.tasksByColumn)) {
    const task = tasks.find((t) => t.id === taskId);
    if (task) return task;
  }
  return null;
}

/** Move (imutável) uma tarefa para `toColumnId` na posição de índice `toIndex`. */
export function moveTaskInState(state: BoardState, taskId: string, toColumnId: string, toIndex: number): BoardState {
  const fromColumnId = findTaskColumn(state, taskId);
  if (!fromColumnId || !state.tasksByColumn[toColumnId]) return state;

  const source = state.tasksByColumn[fromColumnId];
  const task = source.find((t) => t.id === taskId)!;
  const withoutTask = source.filter((t) => t.id !== taskId);

  const targetBase = fromColumnId === toColumnId ? withoutTask : state.tasksByColumn[toColumnId];
  const index = Math.max(0, Math.min(toIndex, targetBase.length));
  const target = [...targetBase.slice(0, index), { ...task, column_id: toColumnId }, ...targetBase.slice(index)];

  return {
    ...state,
    tasksByColumn: {
      ...state.tasksByColumn,
      [fromColumnId]: fromColumnId === toColumnId ? target : withoutTask,
      [toColumnId]: target,
    },
  };
}

/**
 * Posição fracionária final da tarefa a partir dos vizinhos na coluna atual.
 * Retorna também os vizinhos para o servidor decidir se precisa renumerar.
 */
export function computeTaskPosition(state: BoardState, taskId: string) {
  const columnId = findTaskColumn(state, taskId);
  if (!columnId) return null;
  const tasks = state.tasksByColumn[columnId];
  const index = tasks.findIndex((t) => t.id === taskId);
  const prev = tasks[index - 1]?.position;
  const next = tasks[index + 1]?.position;
  return { columnId, index, position: positionBetween(prev, next), prev, next };
}

export function updateTaskInState(state: BoardState, taskId: string, patch: Partial<TaskCard>): BoardState {
  const columnId = findTaskColumn(state, taskId);
  if (!columnId) return state;
  return {
    ...state,
    tasksByColumn: {
      ...state.tasksByColumn,
      [columnId]: state.tasksByColumn[columnId].map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
    },
  };
}

/** Substitui/insere a tarefa vinda do servidor, respeitando coluna e posição. */
export function upsertTaskInState(state: BoardState, task: TaskCard): BoardState {
  const without = removeTaskFromState(state, task.id);
  if (!task.column_id || !without.tasksByColumn[task.column_id]) return without;
  const list = [...without.tasksByColumn[task.column_id], task].sort(byPosition);
  return { ...without, tasksByColumn: { ...without.tasksByColumn, [task.column_id]: list } };
}

export function removeTaskFromState(state: BoardState, taskId: string): BoardState {
  const columnId = findTaskColumn(state, taskId);
  if (!columnId) return state;
  return {
    ...state,
    tasksByColumn: {
      ...state.tasksByColumn,
      [columnId]: state.tasksByColumn[columnId].filter((t) => t.id !== taskId),
    },
  };
}

export type BoardFilters = {
  query: string;
  assigneeId: string | "all" | "none";
  tagId: string | "all";
  priority: TaskPriority | "all";
  sprintId: string | "all";
};

export const EMPTY_FILTERS: BoardFilters = {
  query: "",
  assigneeId: "all",
  tagId: "all",
  priority: "all",
  sprintId: "all",
};

export function hasActiveFilters(filters: BoardFilters) {
  return (
    filters.query.trim() !== "" ||
    filters.assigneeId !== "all" ||
    filters.tagId !== "all" ||
    filters.priority !== "all" ||
    filters.sprintId !== "all"
  );
}

export function matchesFilters(task: TaskCard, filters: BoardFilters): boolean {
  const query = filters.query.trim().toLocaleLowerCase("pt-BR");
  if (query) {
    const haystack = `${task.title} ${task.description ?? ""} ${task.tags.map((t) => t.name).join(" ")}`.toLocaleLowerCase("pt-BR");
    if (!haystack.includes(query)) return false;
  }
  if (filters.assigneeId === "none" && task.assignees.length > 0) return false;
  if (
    filters.assigneeId !== "all" &&
    filters.assigneeId !== "none" &&
    !task.assignees.some((a) => a.id === filters.assigneeId)
  )
    return false;
  if (filters.tagId !== "all" && !task.tags.some((t) => t.id === filters.tagId)) return false;
  if (filters.priority !== "all" && task.priority !== filters.priority) return false;
  if (filters.sprintId !== "all" && task.sprint_id !== filters.sprintId) return false;
  return true;
}
