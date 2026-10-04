import { describe, expect, it } from "vitest";

import { buildBurndown } from "./burndown";

const day = (d: string, h = 12) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00`).toISOString();

describe("buildBurndown", () => {
  const tasks = [
    { story_points: 5, created_at: day("2026-10-01"), completed_at: day("2026-10-02") },
    { story_points: 3, created_at: day("2026-10-01"), completed_at: day("2026-10-04") },
    { story_points: 2, created_at: day("2026-10-03"), completed_at: null },
  ];

  it("calcula escopo restante por dia e a linha ideal", () => {
    const result = buildBurndown(tasks, { start: "2026-10-01", end: "2026-10-05" }, new Date("2026-10-04T18:00:00"));
    expect(result.metric).toBe("points");
    expect(result.total).toBe(10);
    expect(result.points.map((p) => p.date)).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
    ]);
    expect(result.points.map((p) => p.remaining)).toEqual([8, 3, 5, 2, null]);
    expect(result.points[0].ideal).toBe(10);
    expect(result.points[4].ideal).toBe(0);
    expect(result.remaining).toBe(2);
  });

  it("usa contagem de tarefas quando não há pontos estimados", () => {
    const result = buildBurndown(
      tasks.map((t) => ({ ...t, story_points: 0 })),
      { start: "2026-10-01", end: "2026-10-05" },
      new Date("2026-10-05T18:00:00"),
    );
    expect(result.metric).toBe("tasks");
    expect(result.total).toBe(3);
    expect(result.points.at(-1)?.remaining).toBe(1);
  });

  it("amostra intervalos longos para no máximo ~60 pontos", () => {
    const result = buildBurndown([], { start: "2026-01-01", end: "2026-12-31" }, new Date("2026-06-01"));
    expect(result.points.length).toBeLessThanOrEqual(62);
    expect(result.points.at(-1)?.date).toBe("2026-12-31");
  });
});
