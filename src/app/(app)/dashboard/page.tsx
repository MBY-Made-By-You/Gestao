import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  Crown,
  FolderKanban,
  Landmark,
  ListTodo,
  Medal,
  Sparkles,
  Video,
} from "lucide-react";

import { CashflowChart } from "@/components/charts/cashflow-chart";
import { DashboardBurndown } from "@/components/dashboard/dashboard-burndown";
import { EmptyState } from "@/components/brand/empty-state";
import { StatTile } from "@/components/shared/stat-tile";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { requireProfile } from "@/lib/auth";
import { EVENT_TYPE_LABEL, PRIORITY_STYLE } from "@/lib/constants";
import { dueLabel, dueState, formatCurrency, formatDate, formatPercent, plural, todayInAppTimeZone } from "@/lib/format";
import { levelInfo } from "@/lib/gamification";
import { cn } from "@/lib/utils";
import { getDashboardData } from "@/server/queries/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const data = await getDashboardData(profile);
  const firstName = profile.full_name.split(" ")[0] || "por aqui";
  const level = levelInfo(data.myStats?.xp ?? 0);
  const overdue = data.urgentTasks.filter((t) => dueState(t.due_date) === "overdue").length;

  return (
    <div className="space-y-6">
      {/* Boas-vindas ------------------------------------------------------- */}
      <section className="relative overflow-hidden rounded-3xl border border-brand/15 bg-gradient-to-br from-brand/12 via-card to-periwinkle/20 p-6 shadow-card sm:p-7 dark:from-brand/15 dark:via-card dark:to-periwinkle/10">
        <div className="relative z-10 max-w-xl space-y-3">
          <p className="text-sm font-semibold text-brand-strong dark:text-brand">
            {formatDate(todayInAppTimeZone(), "EEEE, dd 'de' MMMM")}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {greeting()}, {firstName}! 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.urgentTasks.length
              ? `Você tem ${plural(data.urgentTasks.length, "tarefa urgente", "tarefas urgentes")} nesta semana${overdue ? `, ${plural(overdue, "atrasada")}` : ""}.`
              : "Nenhuma tarefa urgente nesta semana. Bom trabalho!"}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Badge variant="soft" className="gap-1.5 px-2.5 py-1 text-xs">
              <Sparkles className="size-3.5" /> Nível {level.level} · {level.title}
            </Badge>
            <div className="flex min-w-48 items-center gap-2">
              <Progress value={level.progress * 100} className="h-1.5 w-32" aria-label="Progresso do nível" />
              <span className="text-xs text-muted-foreground">
                {level.xp} XP · faltam {level.toNext}
              </span>
            </div>
          </div>
        </div>
        <Image
          src="/brand/capivara.webp"
          alt=""
          width={640}
          height={640}
          priority
          className="pointer-events-none absolute -right-6 -bottom-10 hidden size-56 rounded-full object-cover opacity-95 shadow-2xl ring-8 ring-card/60 md:block lg:size-64"
        />
      </section>

      {/* KPIs --------------------------------------------------------------- */}
      <section className={cn("grid gap-4 sm:grid-cols-2", data.finance ? "xl:grid-cols-5" : "xl:grid-cols-3")}>
        <StatTile
          label="Projetos ativos"
          value={data.projects.length}
          hint={`${plural(data.projects.reduce((s, p) => s + p.overdueTasks, 0), "tarefa atrasada", "tarefas atrasadas")} no total`}
          icon={FolderKanban}
        />
        <StatTile
          label="Tarefas em aberto"
          value={data.openTasks}
          hint={`${plural(data.myOpenTasks, "atribuída", "atribuídas")} a você`}
          icon={ListTodo}
          tone="neutral"
        />
        <StatTile
          label="Urgentes da semana"
          value={data.urgentTasks.length}
          hint={overdue ? `${plural(overdue, "já atrasada", "já atrasadas")}` : "Prazos nos próximos 7 dias"}
          icon={AlertTriangle}
          tone={overdue ? "danger" : "warning"}
        />
        {data.finance && (
          <>
            <StatTile
              label="Resultado do mês"
              value={formatCurrency(data.finance.monthBalance)}
              hint={`${formatCurrency(data.finance.monthIncome)} entradas · ${formatCurrency(data.finance.monthExpense)} saídas`}
              icon={CircleDollarSign}
              tone={data.finance.monthBalance >= 0 ? "success" : "danger"}
            />
            <StatTile
              label="Saldo atual"
              value={formatCurrency(data.finance.totalBalance)}
              hint={`A receber ${formatCurrency(data.finance.pendingIncome)} · a pagar ${formatCurrency(data.finance.pendingExpense)}`}
              icon={Landmark}
              tone={data.finance.totalBalance >= 0 ? "brand" : "danger"}
            />
          </>
        )}
      </section>

      {/* Burn-down + urgentes ------------------------------------------------- */}
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Burn-down</CardTitle>
            <CardDescription>Trabalho restante x ritmo ideal até a entrega</CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardBurndown projects={data.projects} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Urgentes da semana</CardTitle>
            <CardDescription>Atrasadas e com prazo em até 7 dias</CardDescription>
          </CardHeader>
          <CardContent>
            {data.urgentTasks.length ? (
              <ul className="space-y-1">
                {data.urgentTasks.map((task) => {
                  const state = dueState(task.due_date);
                  return (
                    <li key={task.id}>
                      <Link
                        href={`/projects/${task.project.id}/board?task=${task.id}`}
                        className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-muted"
                      >
                        <span className={cn("size-2 shrink-0 rounded-full", PRIORITY_STYLE[task.priority].dot)} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{task.title}</p>
                          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <span className="size-1.5 rounded-full" style={{ backgroundColor: task.project.color }} />
                            {task.project.name}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold",
                            state === "overdue"
                              ? "bg-destructive/12 text-destructive"
                              : state === "today"
                                ? "bg-warning/15 text-warning"
                                : "bg-muted text-muted-foreground",
                          )}
                        >
                          {dueLabel(task.due_date)}
                        </span>
                        {task.assignee && (
                          <UserAvatar name={task.assignee.full_name} src={task.assignee.avatar_url} className="size-6" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState compact title="Semana tranquila" description="Nenhuma tarefa urgente por aqui." />
            )}
          </CardContent>
        </Card>
      </section>

      {/* Progresso dos projetos + finanças ------------------------------------ */}
      <section className={cn("grid gap-5", data.finance && "xl:grid-cols-2")}>
        <Card>
          <CardHeader>
            <CardTitle>Progresso dos projetos ativos</CardTitle>
            <CardDescription>Tarefas concluídas sobre o total</CardDescription>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href="/projects">
                  Ver todos <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {data.projects.length ? (
              <ul className="space-y-4">
                {data.projects.map((p) => {
                  const ratio = p.totalTasks ? p.doneTasks / p.totalTasks : 0;
                  return (
                    <li key={p.id}>
                      <Link href={`/projects/${p.id}`} className="group block space-y-1.5">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="size-2.5 rounded-[4px]" style={{ backgroundColor: p.color }} />
                          <span className="min-w-0 flex-1 truncate font-semibold group-hover:text-brand-strong dark:group-hover:text-brand">
                            {p.name}
                          </span>
                          {p.overdueTasks > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive">
                              <AlertTriangle className="size-3.5" /> {p.overdueTasks}
                            </span>
                          )}
                          <span className="w-12 text-right text-xs font-bold tabular-nums">{formatPercent(ratio)}</span>
                        </div>
                        <Progress value={ratio * 100} className="h-2" aria-label={`Progresso de ${p.name}`} />
                        <p className="text-[11px] text-muted-foreground">
                          {p.doneTasks}/{p.totalTasks} tarefas · {p.donePoints}/{p.totalPoints} pts
                          {p.due_date ? ` · entrega ${formatDate(p.due_date, "dd MMM")}` : ""}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={FolderKanban}
                title="Nenhum projeto ativo"
                action={
                  profile.isStaff ? (
                    <Button asChild size="sm">
                      <Link href="/projects">Criar projeto</Link>
                    </Button>
                  ) : null
                }
              />
            )}
          </CardContent>
        </Card>

        {data.finance && (
          <Card>
            <CardHeader>
              <CardTitle>Receitas x despesas</CardTitle>
              <CardDescription>Últimos 6 meses (lançamentos efetivados)</CardDescription>
              <CardAction>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/finance">
                    Financeiro <ArrowRight />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <CashflowChart data={data.finance.history} height={240} />
            </CardContent>
          </Card>
        )}
      </section>

      {/* Agenda + ranking ------------------------------------------------------- */}
      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Próximos eventos</CardTitle>
            <CardDescription>Reuniões, eventos e marcos (14 dias)</CardDescription>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href="/calendar">
                  Calendário <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {data.upcomingEvents.length ? (
              <ul className="space-y-2">
                {data.upcomingEvents.map((event) => {
                  const date = event.starts_at;
                  return (
                    <li key={event.id} className="flex items-center gap-3 rounded-xl border p-2.5">
                      <div className="grid w-12 shrink-0 place-items-center rounded-lg bg-brand-soft py-1 text-brand-strong dark:text-brand">
                        <span className="text-[10px] font-bold uppercase">{formatDate(date, "MMM")}</span>
                        <span className="text-lg leading-none font-extrabold">{formatDate(date, "dd")}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{event.title}</p>
                        <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                          {event.type === "meeting" ? <Video className="size-3.5" /> : <CalendarDays className="size-3.5" />}
                          {EVENT_TYPE_LABEL[event.type]}
                          {!event.all_day && ` · ${formatDate(date, "HH:mm")}`}
                          {event.project && ` · ${event.project.name}`}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nada agendado para os próximos dias.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ranking da equipe</CardTitle>
            <CardDescription>XP por tarefas concluídas (+50% no prazo)</CardDescription>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href="/team">
                  Equipe <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {data.leaderboard.length ? (
              <ol className="space-y-2">
                {data.leaderboard.map((member, index) => {
                  const info = levelInfo(member.xp ?? 0);
                  return (
                    <li key={member.user_id} className="flex items-center gap-3 rounded-xl p-1.5">
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-full text-xs font-extrabold",
                          index === 0 && "bg-amber-400/20 text-amber-600 dark:text-amber-300",
                          index === 1 && "bg-slate-400/20 text-slate-600 dark:text-slate-300",
                          index === 2 && "bg-orange-400/20 text-orange-700 dark:text-orange-300",
                          index > 2 && "bg-muted text-muted-foreground",
                        )}
                      >
                        {index === 0 ? <Crown className="size-3.5" /> : index < 3 ? <Medal className="size-3.5" /> : index + 1}
                      </span>
                      <UserAvatar name={member.profile.full_name} src={member.profile.avatar_url} className="size-8" />
                      <div className="min-w-0 flex-1">
                        <Link href={`/team/${member.user_id}`} className="truncate text-sm font-semibold hover:underline">
                          {member.profile.full_name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          Nível {info.level} · {plural(member.tasks_completed ?? 0, "concluída")}
                        </p>
                      </div>
                      <span className="text-sm font-extrabold text-brand-strong tabular-nums dark:text-brand">
                        {member.xp} XP
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">Conclua tarefas para aparecer no ranking.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
