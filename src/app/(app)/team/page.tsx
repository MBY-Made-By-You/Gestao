import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { CheckCircle2, Crown, ListTodo, Medal, Timer } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { BadgeIcon } from "@/components/team/badge-icon";
import { InviteButton, RoleSelect } from "@/components/team/team-admin";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/misc";
import { requireProfile } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/constants";
import { formatPercent } from "@/lib/format";
import { computeBadges, levelInfo, onTimeRate } from "@/lib/gamification";
import { cn } from "@/lib/utils";
import { isInviteAvailable } from "@/server/actions/team";
import { getTeam, type TeamMember } from "@/server/queries/team";

export const metadata: Metadata = { title: "Equipe" };

function statsFor(member: TeamMember) {
  return {
    xp: member.stats.xp ?? 0,
    tasks_completed: member.stats.tasks_completed ?? 0,
    tasks_on_time: member.stats.tasks_on_time ?? 0,
    tasks_completed_with_due: member.stats.tasks_completed_with_due ?? 0,
    tasks_completed_last_30d: member.stats.tasks_completed_last_30d ?? 0,
  };
}

export default async function TeamPage() {
  const profile = await requireProfile();
  const [team, inviteEnabled, headerList] = await Promise.all([getTeam(), isInviteAvailable(), headers()]);
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `${headerList.get("x-forwarded-proto") ?? "http"}://${headerList.get("host")}`;
  const staff = team.filter((m) => m.role !== "viewer");
  const podium = staff.filter((m) => (m.stats.xp ?? 0) > 0).slice(0, 3);
  const clients = team.filter((m) => m.role === "viewer");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Gestão de equipe"
        title="Equipe"
        description="Perfis de acesso, desempenho e a gamificação da MBY: cada tarefa concluída rende XP."
        actions={profile.isAdmin ? <InviteButton inviteEnabled={inviteEnabled} signupUrl={`${origin}/signup`} /> : null}
      />

      {podium.length > 0 && (
        <section aria-label="Pódio de XP" className="grid gap-4 md:grid-cols-3">
          {podium.map((member, index) => {
            const info = levelInfo(member.stats.xp ?? 0);
            return (
              <Link
                key={member.id}
                href={`/team/${member.id}`}
                className={cn(
                  "relative overflow-hidden rounded-2xl border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift",
                  index === 0 && "border-amber-400/40 bg-gradient-to-br from-amber-300/15 via-card to-card md:order-2",
                  index === 1 && "md:order-1",
                  index === 2 && "md:order-3",
                )}
              >
                <span
                  className={cn(
                    "absolute top-4 right-4 grid size-9 place-items-center rounded-full",
                    index === 0 ? "bg-amber-400/20 text-amber-600 dark:text-amber-300" : "bg-muted text-muted-foreground",
                  )}
                >
                  {index === 0 ? <Crown className="size-4.5" /> : <Medal className="size-4.5" />}
                </span>
                <div className="flex items-center gap-3">
                  <UserAvatar name={member.full_name} src={member.avatar_url} className="size-14 ring-4 ring-brand/15" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-muted-foreground">{index + 1}º lugar</p>
                    <p className="truncate text-lg font-extrabold">{member.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Nível {info.level} · {info.title}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-3xl font-extrabold text-brand-strong tabular-nums dark:text-brand">
                  {info.xp} <span className="text-base font-bold">XP</span>
                </p>
              </Link>
            );
          })}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-base font-extrabold">Membros ({staff.length})</h2>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {staff.map((member) => {
            const stats = statsFor(member);
            const info = levelInfo(stats.xp);
            const badges = computeBadges(stats);
            const rate = onTimeRate(stats);
            return (
              <article key={member.id} className="space-y-4 rounded-2xl border bg-card p-5 shadow-card">
                <div className="flex items-start gap-3">
                  <UserAvatar name={member.full_name} src={member.avatar_url} className="size-12" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/team/${member.id}`} className="block truncate font-extrabold hover:underline">
                      {member.full_name || "Sem nome"}
                      {member.id === profile.id && <span className="ml-1 text-xs font-semibold text-muted-foreground">(você)</span>}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">{member.job_title || member.email}</p>
                  </div>
                  {profile.isAdmin && member.id !== profile.id ? (
                    <RoleSelect userId={member.id} role={member.role} />
                  ) : (
                    <Badge variant={member.role === "admin" ? "soft" : "muted"}>{ROLE_LABEL[member.role]}</Badge>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold">
                      Nível {info.level} · <span className="text-muted-foreground">{info.title}</span>
                    </span>
                    <span className="font-semibold text-brand-strong tabular-nums dark:text-brand">{info.xp} XP</span>
                  </div>
                  <Progress value={info.progress * 100} className="h-1.5" aria-label="Progresso de nível" />
                  <p className="text-[11px] text-muted-foreground">{info.toNext} XP para o nível {info.level + 1}</p>
                </div>

                <dl className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-muted/60 p-2">
                    <dt className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                      <CheckCircle2 className="size-3" /> Concluídas
                    </dt>
                    <dd className="text-lg font-extrabold tabular-nums">{stats.tasks_completed}</dd>
                  </div>
                  <div className="rounded-xl bg-muted/60 p-2">
                    <dt className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                      <Timer className="size-3" /> No prazo
                    </dt>
                    <dd className="text-lg font-extrabold tabular-nums">{rate === null ? "—" : formatPercent(rate)}</dd>
                  </div>
                  <div className="rounded-xl bg-muted/60 p-2">
                    <dt className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                      <ListTodo className="size-3" /> Abertas
                    </dt>
                    <dd className="text-lg font-extrabold tabular-nums">{member.stats.open_tasks ?? 0}</dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-1.5" aria-label="Conquistas">
                  {badges.map((badge) => (
                    <BadgeIcon key={badge.id} badge={badge} size="sm" />
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {clients.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-extrabold">Clientes e visualizadores ({clients.length})</h2>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
            <ul className="divide-y">
              {clients.map((member) => (
                <li key={member.id} className="flex items-center gap-3 px-4 py-3">
                  <UserAvatar name={member.full_name} src={member.avatar_url} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{member.full_name || "Sem nome"}</p>
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  {profile.isAdmin ? (
                    <RoleSelect userId={member.id} role={member.role} />
                  ) : (
                    <Badge variant="outline">{ROLE_LABEL[member.role]}</Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            Visualizadores só enxergam os projetos em que forem adicionados (na visão geral do projeto → Pessoas no projeto).
          </p>
        </section>
      )}
    </div>
  );
}
