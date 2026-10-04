"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartLegend, ChartTooltip } from "@/components/charts/chart-tooltip";
import { niceTicks } from "@/lib/analytics/ticks";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";

export type CashflowDatum = { label: string; income: number; expense: number; balance: number };

/** Receitas x despesas por mês (barras agrupadas, mesma escala em R$). */
export function CashflowChart({
  data,
  height = 260,
  highlightLast = true,
}: {
  data: CashflowDatum[];
  height?: number;
  highlightLast?: boolean;
}) {
  const max = Math.max(0, ...data.map((d) => Math.max(d.income, d.expense)));
  const ticks = niceTicks(max);

  return (
    <div className="space-y-3">
      <ChartLegend
        items={[
          { label: "Receitas", color: "var(--chart-1)" },
          { label: "Despesas", color: "var(--chart-2)" },
        ]}
      />
      <div style={{ height }} className="relative w-full" role="img" aria-label="Gráfico de receitas e despesas por mês">
        {max === 0 && (
          <p className="absolute inset-x-0 top-1/3 z-10 text-center text-sm text-muted-foreground">
            Nenhum lançamento efetivado no período.
          </p>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeWidth={1} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "var(--chart-grid)" }}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              ticks={ticks}
              domain={[0, ticks.at(-1)!]}
              tickLine={false}
              axisLine={false}
              width={64}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickFormatter={(v: number) => formatCompactCurrency(v)}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={(props) => (
                <ChartTooltip
                  {...props}
                  formatValue={(v) => formatCurrency(v)}
                  footer={(entries) => {
                    const income = Number(entries.find((e) => e.dataKey === "income")?.value ?? 0);
                    const expense = Number(entries.find((e) => e.dataKey === "expense")?.value ?? 0);
                    const result = income - expense;
                    return (
                      <p className="flex justify-between gap-3 font-semibold">
                        <span className="text-muted-foreground">Resultado</span>
                        <span className={result >= 0 ? "text-success" : "text-destructive"}>
                          {formatCurrency(result)}
                        </span>
                      </p>
                    );
                  }}
                />
              )}
            />
            <Bar
              dataKey="income"
              name="Receitas"
              fill="var(--chart-1)"
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
              fillOpacity={1}
              shape={(props: unknown) => <FadedBar {...(props as BarShapeProps)} highlightLast={highlightLast} total={data.length} />}
            />
            <Bar
              dataKey="expense"
              name="Despesas"
              fill="var(--chart-2)"
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
              shape={(props: unknown) => <FadedBar {...(props as BarShapeProps)} highlightLast={highlightLast} total={data.length} />}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

type BarShapeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  index?: number;
};

/** Barra com topo arredondado (4px) e base reta; meses anteriores levemente esmaecidos. */
function FadedBar({ x = 0, y = 0, width = 0, height = 0, fill, index = 0, highlightLast, total }: BarShapeProps & { highlightLast: boolean; total: number }) {
  if (height <= 0 || width <= 0) return null;
  const r = Math.min(4, width / 2, height);
  const path = `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
  const opacity = highlightLast && index !== total - 1 ? 0.55 : 1;
  return <path d={path} fill={fill} fillOpacity={opacity} />;
}
