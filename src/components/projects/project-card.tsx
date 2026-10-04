import Link from "next/link";
import { AlertTriangle, Building2, CalendarClock, ListTodo } from "lucide-react";

import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/misc";
import { PROJECT_STATUS_LABEL } from "@/lib/constants";
import { formatCurrency, formatPercent, formatShortDate } from "@/lib/format";
import { toNumber } from "@/lib/utils";
import type { ProjectListItem } from "@/server/queries/projects";

export function ProjectCard({ project, showFinance }: { project: ProjectListItem; showFinance: boolean }) {
  const total = project.progress?.total_tasks ?? 0;
  const done = project.progress?.done_tasks ?? 0;
  const overdue = project.progress?.overdue_tasks ?? 0;
  const ratio = total ? done / total : 0;
  const budget = project.budget === null ? null : toNumber(project.budget);
  const spent = toNumber(project.financials?.total_cost);
  const budgetRatio = budget ? spent / budget : 0;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lift"
    >
      <div className="h-1.5" style={{ backgroundColor: project.color }} />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-extrabold tracking-tight group-hover:text-brand-strong dark:group-hover:text-brand">
              {project.name}
            </h3>
            {project.client_name && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="size-3.5" /> {project.client_name}
              </p>
            )}
          </div>
          <Badge variant={project.status === "active" ? "soft" : "muted"}>{PROJECT_STATUS_LABEL[project.status]}</Badge>
        </div>

        {project.description && <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-muted-foreground">
              {done} de {total} tarefas
            </span>
            <span className="font-bold tabular-nums">{formatPercent(ratio)}</span>
          </div>
          <Progress value={ratio * 100} indicatorStyle={{ backgroundColor: project.color }} aria-label="Progresso" />
        </div>

        {showFinance && budget !== null && (
          <div className="space-y-1.5 rounded-xl bg-muted/60 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Orçamento usado</span>
              <span className="font-semibold tabular-nums">
                {formatCurrency(spent)} / {formatCurrency(budget)}
              </span>
            </div>
            <Progress
              value={Math.min(100, budgetRatio * 100)}
              className="h-1.5"
              indicatorClassName={budgetRatio > 1 ? "bg-destructive" : budgetRatio > 0.85 ? "bg-warning" : "bg-success"}
              aria-label="Orçamento usado"
            />
          </div>
        )}

        <div className="mt-auto flex items-center gap-3 pt-1 text-xs text-muted-foreground">
          {project.due_date && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" /> {formatShortDate(project.due_date)}
            </span>
          )}
          {(project.progress?.backlog_tasks ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1">
              <ListTodo className="size-3.5" /> {project.progress?.backlog_tasks} no backlog
            </span>
          )}
          {overdue > 0 && (
            <span className="inline-flex items-center gap-1 font-semibold text-destructive">
              <AlertTriangle className="size-3.5" /> {overdue} atrasada{overdue > 1 ? "s" : ""}
            </span>
          )}
          <div className="ml-auto flex -space-x-2">
            {project.members.slice(0, 4).map((m) => (
              <UserAvatar key={m.id} name={m.full_name} src={m.avatar_url} className="size-7 ring-2 ring-card" />
            ))}
            {project.members.length > 4 && (
              <span className="grid size-7 place-items-center rounded-full bg-muted text-[10px] font-bold ring-2 ring-card">
                +{project.members.length - 4}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
