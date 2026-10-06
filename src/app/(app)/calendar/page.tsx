import type { Metadata } from "next";

import { CalendarView } from "@/components/calendar/calendar-view";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth";
import { parseDateOnly } from "@/lib/format";
import { todayYmd } from "@/lib/timezone";
import { getCalendarData, type CalendarView as View } from "@/server/queries/calendar";

export const metadata: Metadata = { title: "Calendário" };

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const [{ view: viewParam, date: dateParam, evento, aba }, profile] = await Promise.all([searchParams, requireProfile()]);
  const view: View = viewParam === "week" ? "week" : "month";
  const today = todayYmd();
  const anchor = typeof dateParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const data = await getCalendarData(view, parseDateOnly(anchor));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Calendário e planejamento"
        title="Calendário"
        description="Prazos das tarefas do Kanban, reuniões, eventos e marcos de entrega em um só lugar."
      />
      <CalendarView
        view={view}
        anchor={anchor}
        today={today}
        range={data.range}
        events={data.events}
        tasks={data.tasks}
        projects={data.projects}
        members={data.members}
        canEdit={profile.isStaff}
        openEventId={typeof evento === "string" ? evento : undefined}
        openTab={aba === "ata" ? "minutes" : "details"}
      />
    </div>
  );
}
