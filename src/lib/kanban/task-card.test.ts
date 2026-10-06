import { describe, expect, it } from "vitest";

import { joinFirstNames, toAssignees } from "./task-card";

const person = (full_name: string) => ({ id: full_name, full_name, avatar_url: null });

describe("responsáveis da tarefa", () => {
  it("ordena por data de atribuição e ignora perfis ausentes", () => {
    const rows = [
      { assigned_at: "2026-10-06T12:00:00Z", profile: person("Bruno Lima") },
      { assigned_at: "2026-10-06T10:00:00Z", profile: person("Ana Souza") },
      { assigned_at: "2026-10-06T11:00:00Z", profile: null },
    ];
    expect(toAssignees(rows).map((p) => p.full_name)).toEqual(["Ana Souza", "Bruno Lima"]);
    expect(toAssignees(null)).toEqual([]);
  });

  it("junta os primeiros nomes em português", () => {
    expect(joinFirstNames([])).toBe("");
    expect(joinFirstNames([person("Ana Souza")])).toBe("Ana");
    expect(joinFirstNames([person("Ana Souza"), person("Bruno Lima")])).toBe("Ana e Bruno");
    expect(joinFirstNames([person("Ana Souza"), person("Bruno Lima"), person("Carla Dias")])).toBe(
      "Ana, Bruno e Carla",
    );
  });
});
