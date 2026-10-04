import { describe, expect, it } from "vitest";

import { POSITION_GAP, needsRebalance, positionAtIndex, positionBetween } from "./positions";

describe("positionBetween", () => {
  it("usa a média entre vizinhos", () => {
    expect(positionBetween(1024, 2048)).toBe(1536);
  });
  it("adiciona um intervalo ao final da lista", () => {
    expect(positionBetween(4096, undefined)).toBe(4096 + POSITION_GAP);
  });
  it("subtrai um intervalo no início da lista", () => {
    expect(positionBetween(undefined, 1024)).toBe(0);
  });
  it("lista vazia começa no intervalo padrão", () => {
    expect(positionBetween(null, null)).toBe(POSITION_GAP);
  });
});

describe("positionAtIndex", () => {
  const sorted = [1024, 2048, 3072];
  it("insere no meio", () => expect(positionAtIndex(sorted, 1)).toBe(1536));
  it("insere no início", () => expect(positionAtIndex(sorted, 0)).toBe(0));
  it("insere no fim", () => expect(positionAtIndex(sorted, 3)).toBe(3072 + POSITION_GAP));
  it("limita índices fora do intervalo", () => expect(positionAtIndex(sorted, 99)).toBe(3072 + POSITION_GAP));
});

describe("needsRebalance", () => {
  it("detecta vizinhos muito próximos", () => {
    expect(needsRebalance(1, 1 + 1e-7)).toBe(true);
    expect(needsRebalance(1, 2)).toBe(false);
    expect(needsRebalance(undefined, 2)).toBe(false);
  });
  it("bisseções repetidas eventualmente pedem rebalanceamento", () => {
    let prev = 1024;
    const next = 2048;
    let iterations = 0;
    while (!needsRebalance(prev, next) && iterations < 200) {
      prev = positionBetween(prev, next);
      iterations++;
    }
    expect(iterations).toBeGreaterThan(20);
    expect(iterations).toBeLessThan(200);
  });
});
