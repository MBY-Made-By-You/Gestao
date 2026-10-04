"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Campo de valor em R$ com teclado numérico no celular (use parseMoney ao salvar). */
export function MoneyInput({
  value,
  onChange,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
        R$
      </span>
      <Input
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("pl-9 tabular-nums", className)}
        placeholder="0,00"
        {...props}
      />
    </div>
  );
}
