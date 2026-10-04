/**
 * Marcas "redondas" para eixos que começam em zero (passos 1, 2, 2,5 e 5 × 10ⁿ).
 * Ex.: 3000 → [0, 1000, 2000, 3000]; 1 → [0, 1]; 7 (inteiros) → [0, 2, 4, 6, 8].
 * O último valor é o topo do domínio, então a maior barra/linha sempre cabe.
 */
export function niceTicks(max: number, { integer = false, target = 4 }: { integer?: boolean; target?: number } = {}) {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];

  const rough = max / target;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const multipliers = integer ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
  let step = magnitude * (multipliers.find((m) => m * magnitude >= rough) ?? 10);
  if (integer) step = Math.max(1, Math.round(step));

  const count = Math.ceil(max / step - 1e-9);
  return Array.from({ length: count + 1 }, (_, i) => Number((i * step).toFixed(10)));
}
