import { describe, expect, it } from "vitest";

import { niceTicks } from "@/lib/analytics/ticks";

describe("niceTicks", () => {
  it("usa passos redondos para valores monetários", () => {
    expect(niceTicks(3000)).toEqual([0, 1000, 2000, 3000]);
    expect(niceTicks(2560.1)).toEqual([0, 1000, 2000, 3000]);
    expect(niceTicks(439.9)).toEqual([0, 200, 400, 600]);
    expect(niceTicks(9)).toEqual([0, 2.5, 5, 7.5, 10]);
  });

  it("respeita eixos de inteiros (pontos, tarefas)", () => {
    expect(niceTicks(1, { integer: true })).toEqual([0, 1]);
    expect(niceTicks(7, { integer: true })).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(13, { integer: true })).toEqual([0, 5, 10, 15]);
  });

  it("o topo sempre cobre o máximo", () => {
    for (const max of [0.3, 1, 4, 18, 99, 101, 1234.5, 98765]) {
      const ticks = niceTicks(max);
      expect(ticks.at(-1)!).toBeGreaterThanOrEqual(max);
      expect(ticks[0]).toBe(0);
    }
  });

  it("sem dados → [0, 1]", () => {
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(Number.NaN)).toEqual([0, 1]);
  });
});
