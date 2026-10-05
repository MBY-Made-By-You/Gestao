"use client";

import { Slider as SliderPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Slider({
  className,
  "aria-label": ariaLabel,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full bg-brand" />
      </SliderPrimitive.Track>
      {/* o rótulo vai no thumb, que é o elemento com role="slider" */}
      <SliderPrimitive.Thumb
        aria-label={ariaLabel}
        className="block size-4 rounded-full border-2 border-brand bg-white shadow-sm transition-[box-shadow] outline-none hover:ring-4 hover:ring-brand/20 focus-visible:ring-4 focus-visible:ring-brand/30"
      />
    </SliderPrimitive.Root>
  );
}

export { Slider };
