import { describe, expect, it } from "vitest";

import { parseMoney, toMoneyInput } from "./money";

describe("parseMoney", () => {
  it("entende formato brasileiro", () => {
    expect(parseMoney("1.234,56")).toBe(1234.56);
    expect(parseMoney("1234,5")).toBe(1234.5);
    expect(parseMoney("R$ 50")).toBe(50);
    expect(parseMoney("1.234")).toBe(1234);
    expect(parseMoney("12.345.678")).toBe(12345678);
  });
  it("aceita ponto decimal", () => {
    expect(parseMoney("99.90")).toBe(99.9);
  });
  it("retorna null para vazio", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
  });
  it("formata para edição", () => {
    expect(toMoneyInput(1234.5)).toBe("1234,50");
    expect(toMoneyInput(null)).toBe("");
  });
});
