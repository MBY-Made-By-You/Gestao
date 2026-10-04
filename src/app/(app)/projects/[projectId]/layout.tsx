import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, CalendarRange } from "lucide-react";

import { ProjectTabs } from "@/components/projects/project-tabs";
import { Badge } from "@/components/ui/badge";
import { PROJECT_STATUS_LABEL } from "@/lib/constants";
import { formatShortDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectLayout({ children, params }: LayoutProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, color, status, client_name, start_date, due_date")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/projects"
            className="grid size-9 shrink-0 place-items-center rounded-xl border bg-card text-muted-foreground transition hover:text-foreground"
            aria-label="Voltar para projetos"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <span
            className="grid size-10 shrink-0 place-items-center rounded-xl text-base font-extrabold text-white shadow-sm"
            style={{ backgroundColor: project.color }}
            aria-hidden
          >
            {project.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">{project.name}</h1>
              <Badge variant={project.status === "active" ? "soft" : "muted"}>
                {PROJECT_STATUS_LABEL[project.status]}
              </Badge>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {project.client_name && (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="size-3.5" /> {project.client_name}
                </span>
              )}
              {(project.start_date || project.due_date) && (
                <span className="inline-flex items-center gap-1">
                  <CalendarRange className="size-3.5" />
                  {formatShortDate(project.start_date)} → {formatShortDate(project.due_date)}
                </span>
              )}
            </div>
          </div>
        </div>
        <ProjectTabs projectId={project.id} />
      </div>
      {children}
    </div>
  );
}
