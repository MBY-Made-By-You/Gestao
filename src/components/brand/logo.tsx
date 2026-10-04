import Image from "next/image";

import { cn } from "@/lib/utils";

/** Logo MβY (PNG transparente gerado a partir do arquivo original da marca). */
export function Logo({
  className,
  variant = "color",
  priority,
}: {
  className?: string;
  variant?: "color" | "white";
  priority?: boolean;
}) {
  return (
    <Image
      src={variant === "white" ? "/brand/mby-logo-white.png" : "/brand/mby-logo.png"}
      alt="MBY — Made By You"
      width={626}
      height={512}
      priority={priority}
      className={cn("h-9 w-auto select-none", className)}
    />
  );
}

export function LogoLockup({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Logo className="h-9" priority />
      {!compact && (
        <div className="flex flex-col leading-none">
          <span className="text-[15px] font-extrabold tracking-tight">Gestão</span>
          <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">Made By You</span>
        </div>
      )}
    </div>
  );
}
