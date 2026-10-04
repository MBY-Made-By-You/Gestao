import { describe, expect, it } from "vitest";

import { computeBadges, levelFromXp, levelInfo, onTimeRate, xpForLevel } from "./gamification";

describe("níveis", () => {
  it("curva quadrática de XP", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(50);
    expect(xpForLevel(3)).toBe(200);
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(49)).toBe(1);
    expect(levelFromXp(50)).toBe(2);
    expect(levelFromXp(199)).toBe(2);
    expect(levelFromXp(200)).toBe(3);
  });

  it("progresso dentro do nível", () => {
    const info = levelInfo(125);
    expect(info.level).toBe(2);
    expect(info.title).toBe("Capivara Curiosa");
    expect(info.toNext).toBe(75);
    expect(info.progress).toBeCloseTo(0.5);
  });

  it("título máximo a partir do nível 6", () => {
    expect(levelInfo(50_000).title).toBe("Capivara Lendária");
  });
});

describe("conquistas", () => {
  it("pontualidade exige pelo menos 5 entregas com prazo", () => {
    const base = { xp: 0, tasks_completed: 4, tasks_on_time: 4, tasks_completed_with_due: 4, tasks_completed_last_30d: 0 };
    expect(computeBadges(base).find((b) => b.id === "punctual")?.earned).toBe(false);
    const enough = { ...base, tasks_completed: 10, tasks_on_time: 9, tasks_completed_with_due: 10 };
    expect(computeBadges(enough).find((b) => b.id === "punctual")?.earned).toBe(true);
  });

  it("taxa no prazo é nula sem entregas com prazo", () => {
    expect(onTimeRate({ tasks_on_time: 0, tasks_completed_with_due: 0 })).toBeNull();
  });
});
