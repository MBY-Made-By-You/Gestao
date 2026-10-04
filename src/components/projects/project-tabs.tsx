"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ListTodo, SquareKanban } from "lucide-react";

import { cn } from "@/lib/utils";

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const tabs = [
    { href: base, label: "Visão geral", icon: LayoutGrid, active: pathname === base },
    { href: `${base}/board`, label: "Quadro", icon: SquareKanban, active: pathname.startsWith(`${base}/board`) },
    { href: `${base}/backlog`, label: "Backlog e sprints", icon: ListTodo, active: pathname.startsWith(`${base}/backlog`) },
  ];
  return (
    <nav aria-label="Seções do projeto" className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
      {tabs.map(({ href, label, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold whitespace-nowrap text-muted-foreground transition hover:text-foreground",
            active && "bg-card text-foreground shadow-sm",
          )}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
