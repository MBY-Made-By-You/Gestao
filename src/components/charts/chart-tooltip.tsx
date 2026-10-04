"use client";

type Entry = { name?: string | number; value?: unknown; color?: string; dataKey?: unknown };

/** Tooltip padrão dos gráficos: cartão do tema + amostra de cor da série. */
export function ChartTooltip({
  active,
  payload,
  label,
  formatValue,
  formatLabel,
  footer,
}: {
  active?: boolean;
  payload?: readonly unknown[];
  label?: string | number;
  formatValue?: (value: number, entry: Entry) => string;
  formatLabel?: (label: string | number | undefined) => string;
  footer?: (entries: Entry[]) => React.ReactNode;
}) {
  if (!active || !payload?.length) return null;
  const entries = payload as unknown as Entry[];
  return (
    <div className="min-w-40 rounded-xl border bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <p className="mb-1.5 font-bold text-foreground">{formatLabel ? formatLabel(label) : label}</p>
      <ul className="space-y-1">
        {entries
          .filter((e) => e.value !== null && e.value !== undefined)
          .map((entry) => (
            <li key={String(entry.dataKey ?? entry.name)} className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name}</span>
              <span className="ml-auto pl-3 font-semibold text-foreground tabular-nums">
                {formatValue ? formatValue(Number(entry.value), entry) : String(entry.value)}
              </span>
            </li>
          ))}
      </ul>
      {footer ? <div className="mt-1.5 border-t pt-1.5">{footer(entries)}</div> : null}
    </div>
  );
}

/** Legenda compacta (≥ 2 séries), sempre com texto — nunca só cor. */
export function ChartLegend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          {item.dashed ? (
            <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: item.color }} />
          ) : (
            <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: item.color }} />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  );
}
