import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isValid,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";

/** Fuso da equipe: "hoje" no servidor (UTC na Vercel) segue o horário de Brasília. */
export const APP_TIME_ZONE = "America/Sao_Paulo";

/** Data de hoje (meia-noite local) no fuso da equipe. */
export function todayInAppTimeZone(now: Date = new Date()): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parseDateOnly(ymd);
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compactCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

export function formatCurrency(value: number | null | undefined) {
  return currency.format(value ?? 0);
}

export function formatCompactCurrency(value: number | null | undefined) {
  return compactCurrency.format(value ?? 0);
}

export function formatNumber(value: number | null | undefined) {
  return number.format(value ?? 0);
}

export function formatPercent(ratio: number) {
  return percent.format(Number.isFinite(ratio) ? ratio : 0);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/**
 * Datas "puras" (coluna date, ex.: 2026-10-04) são interpretadas no fuso local
 * para não "voltar um dia" ao converter de UTC.
 */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const date = value.length === 10 ? parseDateOnly(value) : parseISO(value);
  return isValid(date) ? date : null;
}

export function formatDate(value: string | Date | null | undefined, pattern = "dd MMM yyyy") {
  const date = toDate(value);
  return date ? format(date, pattern, { locale: ptBR }) : "—";
}

export function formatShortDate(value: string | Date | null | undefined) {
  return formatDate(value, "dd MMM");
}

export function formatDateTime(value: string | Date | null | undefined) {
  return formatDate(value, "dd MMM yyyy, HH:mm");
}

export function formatRelative(value: string | Date | null | undefined) {
  const date = toDate(value);
  return date ? formatDistanceToNowStrict(date, { locale: ptBR, addSuffix: true }) : "—";
}

/** yyyy-MM-dd no fuso local (para inputs type="date" e colunas date). */
export function toDateInput(date: Date = new Date()) {
  return format(date, "yyyy-MM-dd");
}

/** yyyy-MM (para filtros mensais). */
export function toMonthInput(date: Date = new Date()) {
  return format(date, "yyyy-MM");
}

export type DueState = "overdue" | "today" | "soon" | "later" | "done" | "none";

export function dueState(due: string | null, completedAt?: string | null, today = new Date()): DueState {
  if (completedAt) return "done";
  if (!due) return "none";
  const diff = differenceInCalendarDays(parseDateOnly(due), today);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 3) return "soon";
  return "later";
}

export function dueLabel(due: string | null, completedAt?: string | null, today = new Date()) {
  if (!due) return "Sem prazo";
  const state = dueState(due, completedAt, today);
  const diff = differenceInCalendarDays(parseDateOnly(due), today);
  if (state === "today") return "Hoje";
  if (state === "overdue") return diff === -1 ? "Ontem" : `${Math.abs(diff)} dias atrasada`;
  if (diff === 1) return "Amanhã";
  return formatShortDate(due);
}
