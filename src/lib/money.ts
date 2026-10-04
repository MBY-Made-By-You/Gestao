/**
 * Converte texto digitado em valor numérico, aceitando o formato brasileiro:
 * "1.234,56" → 1234.56 · "1234,5" → 1234.5 · "1.234" → 1234 · "99.90" → 99.9
 */
export function parseMoney(value: string): number | null {
  const cleaned = value.replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;
  let normalized = cleaned;
  if (cleaned.includes(",")) normalized = cleaned.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) normalized = cleaned.replace(/\./g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** 1234.5 → "1234,50" (valor inicial para campos de edição). */
export function toMoneyInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return value.toFixed(2).replace(".", ",");
}
