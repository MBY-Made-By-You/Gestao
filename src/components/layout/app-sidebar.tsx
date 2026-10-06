"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  Users,
  Wallet,
} from "lucide-react";

import { signOut } from "@/app/(auth)/actions";
import { LogoLockup } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL } from "@/lib/constants";
import type { AppRole } from "@/lib/types";
import { cn } from "@/lib/utils";

export type SidebarProject = { id: string; name: string; color: string };
export type SidebarUser = { name: string; email: string | null; avatarUrl: string | null; role: AppRole };

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; staffOnly?: boolean };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projetos", icon: FolderKanban },
  { href: "/calendar", label: "Calendário", icon: CalendarDays },
  { href: "/finance", label: "Financeiro", icon: Wallet, staffOnly: true },
  { href: "/finance/resources", label: "Insumos", icon: Package, staffOnly: true },
  { href: "/team", label: "Equipe", icon: Users },
];

function isActive(pathname: string, href: string) {
  if (href === "/finance") return pathname === "/finance";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarContent({
  user,
  projects,
  onNavigate,
  showNotifications = false,
}: {
  user: SidebarUser;
  projects: SidebarProject[];
  onNavigate?: () => void;
  /** Sininho ao lado da marca (só na barra lateral do desktop). */
  showNotifications?: boolean;
}) {
  const pathname = usePathname();
  const isStaff = user.role !== "viewer";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-5 pt-5 pb-4">
        <Link href="/dashboard" onClick={onNavigate} aria-label="Ir para o dashboard">
          <LogoLockup />
        </Link>
        {showNotifications && <NotificationBell className="-mr-2" />}
      </div>

      <nav className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-3 pb-4" aria-label="Principal">
        <ul className="space-y-0.5">
          {NAV.filter((item) => !item.staffOnly || isStaff).map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-sidebar-foreground/70 transition hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    active && "bg-sidebar-accent text-sidebar-foreground",
                  )}
                >
                  {active && (
                    <span className="absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand" />
                  )}
                  <Icon
                    className={cn(
                      "size-[18px] transition",
                      active ? "text-brand" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80",
                    )}
                  />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        {projects.length > 0 && (
          <div>
            <p className="px-3 pb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              Projetos ativos
            </p>
            <ul className="space-y-0.5">
              {projects.map((project) => {
                const href = `/projects/${project.id}`;
                const active = pathname.startsWith(href);
                return (
                  <li key={project.id}>
                    <Link
                      href={`${href}/board`}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-1.5 text-[13px] font-medium text-sidebar-foreground/70 transition hover:bg-sidebar-accent hover:text-sidebar-foreground",
                        active && "bg-sidebar-accent/70 text-sidebar-foreground",
                      )}
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-[4px] ring-2 ring-white/40 dark:ring-black/30"
                        style={{ backgroundColor: project.color }}
                      />
                      <span className="truncate">{project.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </nav>

      <div className="space-y-3 border-t border-sidebar-border p-3">
        <ThemeToggle />
        <div className="flex items-center gap-2.5 rounded-xl p-1.5">
          <Link href="/settings" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2.5">
            <UserAvatar name={user.name} src={user.avatarUrl} className="size-9" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[13px] font-bold">{user.name || "Sem nome"}</p>
              <Badge variant={user.role === "admin" ? "soft" : "muted"} className="mt-1 px-1.5 py-0 text-[10px]">
                {ROLE_LABEL[user.role]}
              </Badge>
            </div>
          </Link>
          <Link
            href="/settings"
            onClick={onNavigate}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
            title="Configurações"
          >
            <Settings className="size-4" />
            <span className="sr-only">Configurações</span>
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              title="Sair"
            >
              <LogOut className="size-4" />
              <span className="sr-only">Sair</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
