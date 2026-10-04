"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { SidebarContent, type SidebarProject, type SidebarUser } from "@/components/layout/app-sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export function MobileNav({ user, projects }: { user: SidebarUser; projects: SidebarProject[] }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="surface-glass sticky top-0 z-40 flex h-14 items-center gap-3 border-b px-4 lg:hidden">
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Abrir menu">
        <Menu />
      </Button>
      <Link href="/dashboard" className="flex items-center gap-2">
        <Logo className="h-7" />
        <span className="text-sm font-extrabold">Gestão</span>
      </Link>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[290px] bg-sidebar p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarContent user={user} projects={projects} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
