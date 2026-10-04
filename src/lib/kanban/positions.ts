/**
 * Ordenação fracionária: cada tarefa guarda um `position` (double). Ao soltar
 * um card entre dois vizinhos, a nova posição é a média entre eles — apenas a
 * tarefa movida é atualizada no banco (1 UPDATE por arraste).
 */
export const POSITION_GAP = 1024;

/** Menor distância aceitável entre vizinhos antes de renumerar a coluna. */
export const MIN_POSITION_GAP = 1e-6;

export function positionBetween(prev: number | null | undefined, next: number | null | undefined): number {
  const hasPrev = typeof prev === "number" && Number.isFinite(prev);
  const hasNext = typeof next === "number" && Number.isFinite(next);
  if (hasPrev && hasNext) return (prev + next) / 2;
  if (hasPrev) return prev + POSITION_GAP;
  if (hasNext) return next - POSITION_GAP;
  return POSITION_GAP;
}

/** Posição para inserir em `index` numa lista já ordenada (sem o item movido). */
export function positionAtIndex(sortedPositions: number[], index: number): number {
  const clamped = Math.max(0, Math.min(index, sortedPositions.length));
  return positionBetween(sortedPositions[clamped - 1], sortedPositions[clamped]);
}

/** true quando a posição calculada ficou "espremida" entre os vizinhos. */
export function needsRebalance(
  prev: number | null | undefined,
  next: number | null | undefined,
): boolean {
  if (typeof prev !== "number" || typeof next !== "number") return false;
  return Math.abs(next - prev) < MIN_POSITION_GAP * 2;
}
