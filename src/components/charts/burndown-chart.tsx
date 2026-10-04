"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartLegend, ChartTooltip } from "@/components/charts/chart-tooltip";
import type { BurndownPoint } from "@/lib/analytics/burndown";
import { niceTicks } from "@/lib/analytics/ticks";
import { formatNumber } from "@/lib/format";

/**
 * Burn-down: linha ideal (tracejada, neutra) x trabalho restante real (azul MBY).
 * Uma única escala (pontos ou tarefas) — nada de eixo duplo.
 */
export function BurndownChart({
  points,
  metric,
  height = 260,
}: {
  points: BurndownPoint[];
  metric: "points" | "tasks";
  height?: number;
}) {
  const unit = metric === "points" ? "pontos" : "tarefas";
  const lastReal = [...points].reverse().find((p) => p.remaining !== null);
  const ticks = niceTicks(Math.max(0, ...points.map((p) => Math.max(p.ideal, p.remaining ?? 0))), { integer: true });

  return (
    <div className="space-y-3">
      <ChartLegend
        items={[
          { label: `Restante (${unit})`, color: "var(--chart-1)" },
          { label: "Ritmo ideal", color: "var(--chart-neutral)", dashed: true },
        ]}
      />
      <div style={{ height }} className="w-full" role="img" aria-label={`Gráfico de burn-down em ${unit}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeWidth={1} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "var(--chart-grid)" }}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              minTickGap={24}
            />
            <YAxis
              allowDecimals={false}
              ticks={ticks}
              domain={[0, ticks.at(-1)!]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              width={40}
            />
            <Tooltip
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              content={(props) => (
                <ChartTooltip {...props} formatValue={(v) => `${formatNumber(v)} ${unit}`} />
              )}
            />
            <Line
              type="linear"
              dataKey="ideal"
              name="Ritmo ideal"
              stroke="var(--chart-neutral)"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="remaining"
              name="Restante"
              stroke="var(--chart-1)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              connectNulls={false}
              dot={(props) => {
                const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: { date: string } };
                if (!lastReal || payload?.date !== lastReal.date || cx === undefined || cy === undefined) {
                  return <g key={`dot-${payload?.date ?? cx}`} />;
                }
                return (
                  <circle
                    key="dot-last"
                    cx={cx}
                    cy={cy}
                    r={5}
                    fill="var(--chart-1)"
                    stroke="var(--card)"
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{ r: 5, fill: "var(--chart-1)", stroke: "var(--card)", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
