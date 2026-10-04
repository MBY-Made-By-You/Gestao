import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "Ana Beatriz Souza" -> "AS" */
export function initials(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** Converte qualquer valor numérico vindo do PostgREST (numeric pode vir como string). */
export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/** Mensagem amigável a partir de erros do Supabase/PostgREST. */
export function errorMessage(error: unknown, fallback = "Algo deu errado. Tente novamente."): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error && "message" in error) {
    const message = String((error as { message: unknown }).message);
    if (/row-level security|permission denied|42501/i.test(message)) {
      return "Você não tem permissão para esta ação.";
    }
    if (/duplicate key/i.test(message)) return "Já existe um registro com esses dados.";
    return message || fallback;
  }
  return fallback;
}
