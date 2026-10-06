import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { MinutesBrowser } from "@/components/calendar/minutes-browser";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { listMinutes } from "@/server/queries/minutes";

export const metadata: Metadata = { title: "Atas" };

export default async function MinutesPage() {
  await requireProfile();
  const { items, projects } = await listMinutes({});

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Calendário e planejamento"
        title="Atas"
        description="O que foi discutido, decidido e aprendido em reuniões, eventos e marcos."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/calendar">
              <ArrowLeft /> Calendário
            </Link>
          </Button>
        }
      />
      <MinutesBrowser items={items} projects={projects} />
    </div>
  );
}
