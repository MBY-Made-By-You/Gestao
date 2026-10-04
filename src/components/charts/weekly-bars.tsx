"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { niceTicks } from "@/lib/analytics/ticks";

/** Série única (tarefas concluídas por semana) — uma cor, sem legenda. */
export function WeeklyBars({ data, height = 200 }: { data: { label: string; count: number }[]; height?: number }) {
  const ticks = niceTicks(Math.max(0, ...data.map((d) => d.count)), { integer: true });
  return (
    <div style={{ height }} className="w-full" role="img" aria-label="Tarefas concluídas por semana">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeWidth={1} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "var(--chart-grid)" }}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            allowDecimals={false}
            ticks={ticks}
            domain={[0, ticks.at(-1)!]}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            content={(props) => (
              <ChartTooltip
                {...props}
                formatLabel={(l) => `Semana de ${l}`}
                formatValue={(v) => `${v} tarefa${v === 1 ? "" : "s"}`}
              />
            )}
          />
          <Bar dataKey="count" name="Concluídas" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
