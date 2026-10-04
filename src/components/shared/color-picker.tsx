"use client";

import { Check } from "lucide-react";

import { COLOR_SWATCHES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function ColorPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (color: string) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label="Cor" className={cn("flex flex-wrap gap-2", className)}>
      {COLOR_SWATCHES.map((color) => {
        const selected = value.toLowerCase() === color.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color}
            onClick={() => onChange(color)}
            className={cn(
              "grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-popover transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              selected && "ring-2 ring-foreground/70",
            )}
            style={{ backgroundColor: color }}
          >
            {selected && <Check className="size-3.5 text-white drop-shadow" />}
          </button>
        );
      })}
    </div>
  );
}
