import { addDays, differenceInCalendarDays, endOfDay, format, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";

import { parseDateOnly, toDate } from "@/lib/format";

export type BurndownTask = {
  story_points: number;
  created_at: string;
  completed_at: string | null;
};

export type BurndownPoint = {
  date: string; // yyyy-MM-dd
  label: string; // "04 out"
  ideal: number;
  remaining: number | null; // null = futuro (sem dado real)
};

export type BurndownResult = {
  points: BurndownPoint[];
  metric: "points" | "tasks";
  total: number;
  remaining: number;
  /** Positivo = adiantado em relação à linha ideal; negativo = atrasado. */
  deltaVsIdeal: number;
};

const MAX_POINTS = 60;

/**
 * Burn-down por pontos (ou por quantidade de tarefas, quando ninguém estimou
 * pontos). Para cada dia: escopo criado até o dia − trabalho concluído até o dia.
 * A linha ideal vai do escopo total no início até zero no prazo.
 */
export function buildBurndown(
  tasks: BurndownTask[],
  range: { start: string | Date; end: string | Date },
  today: Date = new Date(),
): BurndownResult {
  const start = typeof range.start === "string" ? parseDateOnly(range.start) : range.start;
  const end = typeof range.end === "string" ? parseDateOnly(range.end) : range.end;
  const totalDays = Math.max(1, differenceInCalendarDays(end, start));

  const pointTotal = tasks.reduce((sum, t) => sum + Math.max(0, t.story_points), 0);
  const metric: BurndownResult["metric"] = pointTotal > 0 ? "points" : "tasks";
  const weight = (t: BurndownTask) => (metric === "points" ? Math.max(0, t.story_points) : 1);
  const total = metric === "points" ? pointTotal : tasks.length;

  const step = Math.max(1, Math.ceil((totalDays + 1) / MAX_POINTS));
  const days: Date[] = [];
  for (let i = 0; i <= totalDays; i += step) days.push(addDays(start, i));
  if (differenceInCalendarDays(end, days[days.length - 1]) !== 0) days.push(end);

  const parsed = tasks.map((t) => ({
    w: weight(t),
    created: toDate(t.created_at),
    completed: toDate(t.completed_at),
  }));

  const points = days.map((day) => {
    const dayEnd = endOfDay(day);
    const elapsed = differenceInCalendarDays(day, start);
    const ideal = Math.max(0, total - (total * elapsed) / totalDays);
    let remaining: number | null = null;
    if (!isAfter(day, today)) {
      let scope = 0;
      let done = 0;
      for (const t of parsed) {
        if (!t.created || t.created <= dayEnd) scope += t.w;
        if (t.completed && t.completed <= dayEnd) done += t.w;
      }
      remaining = Math.max(0, scope - done);
    }
    return {
      date: format(day, "yyyy-MM-dd"),
      label: format(day, "dd MMM", { locale: ptBR }),
      ideal: Math.round(ideal * 100) / 100, // 2 casas: evita "degraus" na linha ideal com escopo pequeno
      remaining,
    };
  });

  const lastReal = [...points].reverse().find((p) => p.remaining !== null);
  const remainingNow = lastReal?.remaining ?? total;
  return {
    points,
    metric,
    total,
    remaining: remainingNow,
    deltaVsIdeal: lastReal ? Math.round((lastReal.ideal - remainingNow) * 10) / 10 : 0,
  };
}
