import { describe, expect, it } from "vitest";

import type { BoardColumn, TaskCard } from "@/lib/types";

import {
  computeTaskPosition,
  createBoardState,
  matchesFilters,
  moveTaskInState,
  upsertTaskInState,
  EMPTY_FILTERS,
} from "./board-state";

const column = (id: string, position: number): BoardColumn => ({
  id,
  project_id: "p",
  name: id,
  color: "#000000",
  position,
  is_done: false,
  wip_limit: null,
  created_at: "",
});

const task = (id: string, column_id: string, position: number, extra: Partial<TaskCard> = {}): TaskCard => ({
  id,
  project_id: "p",
  column_id,
  sprint_id: null,
  title: id,
  description: null,
  assignee_id: null,
  created_by: null,
  priority: "medium",
  due_date: null,
  story_points: 1,
  xp_reward: 10,
  position,
  completed_at: null,
  created_at: "",
  updated_at: "",
  assignee: null,
  tags: [],
  attachment_count: 0,
  ...extra,
});

const state = createBoardState(
  [column("todo", 1024), column("doing", 2048)],
  [task("a", "todo", 1024), task("b", "todo", 2048), task("c", "todo", 3072), task("d", "doing", 1024)],
);

describe("board state", () => {
  it("agrupa e ordena por posição", () => {
    expect(state.tasksByColumn.todo.map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(state.tasksByColumn.doing.map((t) => t.id)).toEqual(["d"]);
  });

  it("reordena dentro da mesma coluna", () => {
    const next = moveTaskInState(state, "c", "todo", 0);
    expect(next.tasksByColumn.todo.map((t) => t.id)).toEqual(["c", "a", "b"]);
    expect(computeTaskPosition(next, "c")?.position).toBe(0);
  });

  it("move entre colunas e calcula a posição entre vizinhos", () => {
    const next = moveTaskInState(state, "a", "doing", 1);
    expect(next.tasksByColumn.todo.map((t) => t.id)).toEqual(["b", "c"]);
    expect(next.tasksByColumn.doing.map((t) => t.id)).toEqual(["d", "a"]);
    expect(next.tasksByColumn.doing[1].column_id).toBe("doing");
    expect(computeTaskPosition(next, "a")).toMatchObject({ columnId: "doing", position: 2048 });
  });

  it("upsert respeita a ordem pela posição", () => {
    const next = upsertTaskInState(state, task("b", "todo", 3500));
    expect(next.tasksByColumn.todo.map((t) => t.id)).toEqual(["a", "c", "b"]);
  });

  it("filtra por texto, responsável e prioridade", () => {
    const t = task("x", "todo", 1, { title: "Montar protótipo", priority: "high", assignee_id: "u1" });
    expect(matchesFilters(t, { ...EMPTY_FILTERS, query: "protót" })).toBe(true);
    expect(matchesFilters(t, { ...EMPTY_FILTERS, assigneeId: "u2" })).toBe(false);
    expect(matchesFilters(t, { ...EMPTY_FILTERS, assigneeId: "none" })).toBe(false);
    expect(matchesFilters(t, { ...EMPTY_FILTERS, priority: "high" })).toBe(true);
  });
});
