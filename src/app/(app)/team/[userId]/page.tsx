import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, ListTodo, Sparkles, Timer, Trophy } from "lucide-react";

import { WeeklyBars } from "@/components/charts/weekly-bars";
import { BadgeIcon } from "@/components/team/badge-icon";
import { StatTile } from "@/components/shared/stat-tile";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { requireProfile } from "@/lib/auth";
import { PRIORITY_STYLE, ROLE_LABEL } from "@/lib/constants";
import { dueLabel, formatPercent, formatRelative } from "@/lib/format";
import { computeBadges, levelInfo, onTimeRate } from "@/lib/gamification";
import type { TaskPriority } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getMemberProfile } from "@/server/queries/team";

export const metadata: Metadata = { title: "Perfil" };

export default async function MemberPage({ params }: PageProps<"/team/[userId]">) {
  const [{ userId }, viewer] = await Promise.all([params, requireProfile()]);
  const data = await getMemberProfile(userId);
  if (!data) notFound();

  const { profile, stats } = data;
  const badgeStats = {
    xp: stats.xp ?? 0,
    tasks_completed: stats.tasks_completed ?? 0,
    tasks_on_time: stats.tasks_on_time ?? 0,
    tasks_completed_with_due: stats.tasks_completed_with_due ?? 0,
    tasks_completed_last_30d: stats.tasks_completed_last_30d ?? 0,
  };
  const info = levelInfo(badgeStats.xp);
  const badges = computeBadges(badgeStats);
  const rate = onTimeRate(badgeStats);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/team">
          <ArrowLeft /> Equipe
        </Link>
      </Button>

      <section className="flex flex-col gap-6 rounded-3xl border bg-gradient-to-br from-brand/10 via-card to-periwinkle/15 p-6 shadow-card sm:flex-row sm:items-center">
        <div className="relative">
          <svg viewBox="0 0 120 120" className="size-32 -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r="54" fill="none" stroke="var(--muted)" strokeWidth="8" />
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="var(--brand)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${info.progress * 339.3} 339.3`}
            />
          </svg>
          <UserAvatar
            name={profile.full_name}
            src={profile.avatar_url}
            className="absolute inset-3 size-26 text-2xl"
          />
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-brand px-2.5 py-0.5 text-xs font-extrabold text-white shadow">
            Nv. {info.level}
          </span>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight">{profile.full_name || "Sem nome"}</h1>
            <Badge variant={profile.role === "admin" ? "soft" : "muted"}>{ROLE_LABEL[profile.role]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {profile.job_title ? `${profile.job_title} · ` : ""}
            {profile.email}
          </p>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-strong dark:text-brand">
            <Sparkles className="size-4" /> {info.title} · {info.xp} XP
            {data.rank ? <span className="text-muted-foreground">· {data.rank}º no ranking</span> : null}
          </p>
          <div className="max-w-sm space-y-1">
            <Progress value={info.progress * 100} className="h-2" aria-label="Progresso de nível" />
            <p className="text-xs text-muted-foreground">
              {info.toNext} XP para o nível {info.level + 1}
            </p>
          </div>
        </div>
        {viewer.id === profile.id && (
          <Button asChild variant="outline" size="sm">
            <Link href="/settings">Editar perfil</Link>
          </Button>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="XP total" value={info.xp} icon={Trophy} />
        <StatTile label="Tarefas concluídas" value={badgeStats.tasks_completed} hint={`${badgeStats.tasks_completed_last_30d} nos últimos 30 dias`} icon={CheckCircle2} tone="success" />
        <StatTile
          label="Entregas no prazo"
          value={rate === null ? "—" : formatPercent(rate)}
          hint={`${badgeStats.tasks_on_time} de ${badgeStats.tasks_completed_with_due} com prazo`}
          icon={Timer}
          tone="warning"
        />
        <StatTile label="Em aberto" value={stats.open_tasks ?? 0} icon={ListTodo} tone="neutral" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Ritmo de entregas</CardTitle>
              <CardDescription>Tarefas concluídas por semana (12 semanas)</CardDescription>
            </CardHeader>
            <CardContent>
              <WeeklyBars data={data.weekly} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tarefas em aberto</CardTitle>
            </CardHeader>
            <CardContent>
              {data.openTasks.length ? (
                <ul className="space-y-1">
                  {data.openTasks.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/projects/${t.project_id}/board?task=${t.id}`}
                        className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-muted"
                      >
                        <span className={cn("size-2 shrink-0 rounded-full", PRIORITY_STYLE[t.priority as TaskPriority].dot)} />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t.title}</span>
                        {t.project && (
                          <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                            <span className="size-1.5 rounded-full" style={{ backgroundColor: t.project.color }} />
                            {t.project.name}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">{dueLabel(t.due_date)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma tarefa em aberto. 🎉</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Conquistas</CardTitle>
              <CardDescription>
                {badges.filter((b) => b.earned).length} de {badges.length} desbloqueadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {badges.map((badge) => (
                  <li key={badge.id} className={cn("flex items-center gap-3", !badge.earned && "opacity-60")}>
                    <BadgeIcon badge={badge} />
                    <div>
                      <p className="text-sm font-bold">{badge.name}</p>
                      <p className="text-xs text-muted-foreground">{badge.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico de XP</CardTitle>
            </CardHeader>
            <CardContent>
              {data.xpEvents.length ? (
                <ul className="space-y-2.5">
                  {data.xpEvents.map((event) => (
                    <li key={event.id} className="flex items-start gap-3">
                      <span className="mt-0.5 rounded-md bg-brand-soft px-1.5 py-0.5 text-xs font-extrabold text-brand-strong tabular-nums dark:text-brand">
                        +{event.points}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{event.task?.title ?? "Tarefa removida"}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelative(event.created_at)}
                          {event.on_time ? " · bônus no prazo" : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Ainda sem XP — conclua tarefas no quadro para pontuar.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
