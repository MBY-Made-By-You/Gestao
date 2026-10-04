import { differenceInCalendarDays, format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { APP_TIME_ZONE, toWallClock, todayYmd } from "@/lib/timezone";

export { APP_TIME_ZONE };

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

/** "1 tarefa", "0 tarefas", "3 tarefas" (zero vai no plural, como no português). */
export function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${formatNumber(count)} ${count === 1 ? singular : pluralForm}`;
}

export function formatPercent(ratio: number) {
  return percent.format(Number.isFinite(ratio) ? ratio : 0);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Datas "puras" (coluna date, ex.: 2026-10-04) viram meia-noite local, para não
 * "voltar um dia" ao converter de UTC.
 */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Hoje (meia-noite local) no fuso da equipe — igual no servidor e no navegador. */
export function todayInAppTimeZone(now: Date = new Date()): Date {
  return parseDateOnly(todayYmd(now));
}

/** Instante real (para comparações e tempo relativo). */
export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const date = DATE_ONLY.test(value) ? parseDateOnly(value) : parseISO(value);
  return isValid(date) ? date : null;
}

/** Date pronto para exibição: timestamps são convertidos para o fuso da equipe. */
function toDisplayDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  if (DATE_ONLY.test(value)) return parseDateOnly(value);
  const instant = parseISO(value);
  return isValid(instant) ? toWallClock(instant) : null;
}

export function formatDate(value: string | Date | null | undefined, pattern = "dd MMM yyyy") {
  const date = toDisplayDate(value);
  return date ? format(date, pattern, { locale: ptBR }) : "—";
}

export function formatShortDate(value: string | Date | null | undefined) {
  return formatDate(value, "dd MMM");
}

export function formatDateTime(value: string | Date | null | undefined) {
  return formatDate(value, "dd MMM yyyy, HH:mm");
}

/** Só a primeira letra maiúscula ("Outubro de 2026"), como pede a norma do português. */
export function capitalizeFirst(text: string) {
  return text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);
}

/** "Outubro de 2026" */
export function formatMonthYear(date: Date) {
  return capitalizeFirst(format(date, "MMMM 'de' yyyy", { locale: ptBR }));
}

export function formatRelative(value: string | Date | null | undefined) {
  const date = toDate(value);
  return date ? formatDistanceToNowStrict(date, { locale: ptBR, addSuffix: true }) : "—";
}

/** yyyy-MM-dd (para inputs type="date" e colunas date). Padrão: hoje na equipe. */
export function toDateInput(date: Date = todayInAppTimeZone()) {
  return format(date, "yyyy-MM-dd");
}

/** yyyy-MM (para filtros mensais). */
export function toMonthInput(date: Date = todayInAppTimeZone()) {
  return format(date, "yyyy-MM");
}

export type DueState = "overdue" | "today" | "soon" | "later" | "done" | "none";

export function dueState(due: string | null, completedAt?: string | null, today = todayInAppTimeZone()): DueState {
  if (completedAt) return "done";
  if (!due) return "none";
  const diff = differenceInCalendarDays(parseDateOnly(due), today);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 3) return "soon";
  return "later";
}

export function dueLabel(due: string | null, completedAt?: string | null, today = todayInAppTimeZone()) {
  if (!due) return "Sem prazo";
  const state = dueState(due, completedAt, today);
  const diff = differenceInCalendarDays(parseDateOnly(due), today);
  if (state === "today") return "Hoje";
  if (state === "overdue") return diff === -1 ? "Venceu ontem" : `Atrasada há ${Math.abs(diff)} dias`;
  if (diff === 1) return "Amanhã";
  return formatShortDate(due);
}
