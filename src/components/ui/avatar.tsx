"use client";

import * as React from "react";
import { Avatar as AvatarPrimitive } from "radix-ui";

import { cn, initials } from "@/lib/utils";

function Avatar({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn("relative flex size-8 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  );
}

function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  );
}

function AvatarFallback({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-gradient-to-br from-brand/90 to-periwinkle text-[11px] font-bold text-white",
        className,
      )}
      {...props}
    />
  );
}

/** Avatar de usuário com fallback de iniciais. */
function UserAvatar({
  name,
  src,
  className,
  title,
}: {
  name: string | null | undefined;
  src?: string | null;
  className?: string;
  title?: string;
}) {
  return (
    <Avatar className={className} title={title ?? name ?? undefined}>
      {src ? <AvatarImage src={src} alt={name ?? ""} /> : null}
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

/** Avatares sobrepostos (ex.: responsáveis de uma tarefa), com "+N" excedente. */
function AvatarStack({
  people,
  max = 3,
  className,
  ringClassName = "ring-card",
}: {
  people: { id: string; full_name: string | null; avatar_url: string | null }[];
  max?: number;
  className?: string;
  ringClassName?: string;
}) {
  const shown = people.length > max ? people.slice(0, max - 1) : people;
  const rest = people.length - shown.length;
  return (
    <span
      className="flex -space-x-1.5"
      title={people.map((p) => p.full_name).filter(Boolean).join(", ")}
    >
      {shown.map((p) => (
        <UserAvatar key={p.id} name={p.full_name} src={p.avatar_url} className={cn("ring-2", ringClassName, className)} />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            "relative grid place-items-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground ring-2",
            ringClassName,
            className,
          )}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}

export { Avatar, AvatarImage, AvatarFallback, UserAvatar, AvatarStack };
