import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Flag, Hourglass, ListTodo, Milestone, SquareKanban } from "lucide-react";

import { BurndownChart } from "@/components/charts/burndown-chart";
import { ProjectAdminButtons, ProjectMembers } from "@/components/projects/project-actions";
import { StatTile } from "@/components/shared/stat-tile";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { requireProfile } from "@/lib/auth";
import { PRIORITY_STYLE } from "@/lib/constants";
import { dueLabel, formatCurrency, formatDate, formatPercent, parseDateOnly } from "@/lib/format";
import type { TaskPriority } from "@/lib/types";
import { cn, toNumber } from "@/lib/utils";
import { getProjectOverview } from "@/server/queries/projects";

export const metadata: Metadata = { title: "Visão geral do projeto" };

export default async function ProjectOverviewPage({ params }: PageProps<"/projects/[projectId]">) {
  const [{ projectId }, profile] = await Promise.all([params, requireProfile()]);
  const overview = await getProjectOverview(projectId);
  if (!overview) notFound();

  const { project, progress, financials, burndown } = overview;
  const total = progress?.total_tasks ?? 0;
  const done = progress?.done_tasks ?? 0;
  const ratio = total ? done / total : 0;
  const daysLeft = project.due_date
    ? Math.ceil((parseDateOnly(project.due_date).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000)
    : null;
  const budget = project.budget === null ? null : toNumber(project.budget);
  const totalCost = toNumber(financials?.total_cost);
  const canDelete = profile.isAdmin || (profile.isStaff && project.owner_id === profile.id);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Progresso"
            value={formatPercent(ratio)}
            hint={`${done} de ${total} tarefas · ${progress?.done_points ?? 0}/${progress?.total_points ?? 0} pts`}
            icon={CheckCircle2}
          />
          <StatTile
            label="Em aberto"
            value={total - done}
            hint={`${progress?.backlog_tasks ?? 0} no backlog`}
            icon={ListTodo}
            tone="neutral"
          />
          <StatTile
            label="Atrasadas"
            value={progress?.overdue_tasks ?? 0}
            hint={(progress?.overdue_tasks ?? 0) > 0 ? "Precisam de atenção" : "Tudo dentro do prazo"}
            icon={AlertTriangle}
            tone={(progress?.overdue_tasks ?? 0) > 0 ? "danger" : "success"}
          />
          <StatTile
            label="Prazo final"
            value={daysLeft === null ? "—" : daysLeft >= 0 ? `${daysLeft} dias` : `${Math.abs(daysLeft)} dias atrás`}
            hint={project.due_date ? formatDate(project.due_date) : "Sem data de entrega"}
            icon={Hourglass}
            tone={daysLeft !== null && daysLeft < 0 ? "danger" : "warning"}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Burn-down · {burndown.label}</CardTitle>
            <CardDescription>
              {formatDate(burndown.start)} → {formatDate(burndown.end)} ·{" "}
              {burndown.deltaVsIdeal >= 0
                ? `${burndown.deltaVsIdeal} ${burndown.metric === "points" ? "pts" : "tarefas"} à frente do ritmo ideal`
                : `${Math.abs(burndown.deltaVsIdeal)} ${burndown.metric === "points" ? "pts" : "tarefas"} atrás do ritmo ideal`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {burndown.total > 0 ? (
              <BurndownChart points={burndown.points} metric={burndown.metric} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Crie tarefas (com estimativa em pontos) para acompanhar o burn-down.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Próximas entregas</CardTitle>
              <CardDescription>Tarefas em aberto com prazo</CardDescription>
            </CardHeader>
            <CardContent>
              {overview.upcomingTasks.length ? (
                <ul className="space-y-2.5">
                  {overview.upcomingTasks.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/projects/${project.id}/board?task=${t.id}`}
                        className="flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-muted"
                      >
                        <span className={cn("size-2 shrink-0 rounded-full", PRIORITY_STYLE[t.priority as TaskPriority].dot)} />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t.title}</span>
                        <span className="text-xs text-muted-foreground">{dueLabel(t.due_date)}</span>
                        {t.assignee && <UserAvatar name={t.assignee.full_name} src={t.assignee.avatar_url} className="size-6" />}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma tarefa com prazo pela frente.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Marcos</CardTitle>
              <CardDescription>Milestones do calendário</CardDescription>
            </CardHeader>
            <CardContent>
              {overview.milestones.length ? (
                <ol className="relative space-y-3 border-l border-border pl-4">
                  {overview.milestones.map((m) => {
                    const past = new Date(m.starts_at) < new Date();
                    return (
                      <li key={m.id} className="relative">
                        <span
                          className={cn(
                            "absolute top-1 -left-[21.5px] size-2.5 rounded-full ring-4 ring-card",
                            past ? "bg-success" : "bg-brand",
                          )}
                        />
                        <p className="text-sm font-semibold">{m.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(m.starts_at)}</p>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Milestone className="size-4" /> Nenhum marco cadastrado.
                  </p>
                  {profile.isStaff && (
                    <Button asChild size="sm" variant="outline">
                      <Link href="/calendar">
                        <Flag /> Criar no calendário
                      </Link>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <aside className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Sobre o projeto</CardTitle>
            {overview.ownerName && <CardDescription>Responsável: {overview.ownerName}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm whitespace-pre-wrap text-foreground/90">
              {project.description || <span className="text-muted-foreground">Sem descrição.</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href={`/projects/${project.id}/board`}>
                  <SquareKanban /> Abrir quadro
                </Link>
              </Button>
              {profile.isStaff && <ProjectAdminButtons project={project} canDelete={canDelete} />}
            </div>
          </CardContent>
        </Card>

        {profile.isStaff && (
          <Card>
            <CardHeader>
              <CardTitle>Financeiro do projeto</CardTitle>
              <CardDescription>Despesas + materiais consumidos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Orçamento</dt>
                  <dd className="font-bold tabular-nums">{budget === null ? "—" : formatCurrency(budget)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Custo total</dt>
                  <dd className="font-bold tabular-nums">{formatCurrency(totalCost)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Materiais</dt>
                  <dd className="font-semibold tabular-nums">{formatCurrency(toNumber(financials?.materials_cost))}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Receitas</dt>
                  <dd className="font-semibold text-success tabular-nums">{formatCurrency(toNumber(financials?.income))}</dd>
                </div>
              </dl>
              {budget !== null && budget > 0 && (
                <div className="space-y-1.5">
                  <Progress
                    value={Math.min(100, (totalCost / budget) * 100)}
                    indicatorClassName={totalCost > budget ? "bg-destructive" : "bg-success"}
                    aria-label="Orçamento consumido"
                  />
                  <p className="text-xs text-muted-foreground">
                    {formatPercent(totalCost / budget)} do orçamento consumido
                    {totalCost > budget && <Badge variant="destructive" className="ml-2">Estourado</Badge>}
                  </p>
                </div>
              )}
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link href="/finance">Ver lançamentos</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Pessoas no projeto</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectMembers
              projectId={project.id}
              members={overview.members}
              allProfiles={overview.allProfiles}
              canManage={profile.isStaff}
            />
          </CardContent>
        </Card>

      </aside>
    </div>
  );
}
