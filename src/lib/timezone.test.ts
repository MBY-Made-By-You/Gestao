import { describe, expect, it } from "vitest";

import { toWallClock, todayYmd, wallTimeToIso, zonedParts } from "./timezone";

describe("timezone (America/Sao_Paulo)", () => {
  it("extrai componentes no fuso da equipe", () => {
    const p = zonedParts("2026-10-04T02:30:00Z"); // 23:30 do dia 3 em Brasília
    expect(p.ymd).toBe("2026-10-03");
    expect(p.hm).toBe("23:30");
  });

  it("converte horário de parede para UTC", () => {
    expect(wallTimeToIso("2026-10-04", "14:30")).toBe("2026-10-04T17:30:00.000Z");
    expect(wallTimeToIso("2026-01-15")).toBe("2026-01-15T03:00:00.000Z");
  });

  it("ida e volta preservam o horário", () => {
    const iso = wallTimeToIso("2026-12-31", "23:59");
    expect(zonedParts(iso).ymd).toBe("2026-12-31");
    expect(zonedParts(iso).hm).toBe("23:59");
  });

  it("wall clock reflete os componentes do fuso", () => {
    const d = toWallClock("2026-10-04T17:30:00Z");
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 10, 4, 14, 30]);
  });

  it("hoje no fuso da equipe", () => {
    expect(todayYmd(new Date("2026-10-05T01:00:00Z"))).toBe("2026-10-04");
  });
});
