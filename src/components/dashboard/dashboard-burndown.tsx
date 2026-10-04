"use client";

import { useState } from "react";

import { BurndownChart } from "@/components/charts/burndown-chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DashboardProject } from "@/server/queries/dashboard";

/** Burn-down com seletor de projeto (sprint ativa, ou o projeto inteiro). */
export function DashboardBurndown({ projects }: { projects: DashboardProject[] }) {
  const withWork = projects.filter((p) => p.burndown.total > 0);
  const [selectedId, setSelectedId] = useState(withWork[0]?.id ?? projects[0]?.id ?? "");
  const project = projects.find((p) => p.id === selectedId);

  if (!project) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Nenhum projeto ativo ainda.</p>;
  }

  const { burndown } = project;
  const unit = burndown.metric === "points" ? "pts" : "tarefas";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger size="sm" className="w-auto min-w-48" aria-label="Projeto do burn-down">
            <SelectValue>
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
              {project.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {burndown.label} · faltam <strong className="text-foreground">{burndown.remaining}</strong> de {burndown.total} {unit}
          {" · "}
          <span className={burndown.deltaVsIdeal >= 0 ? "font-semibold text-success" : "font-semibold text-destructive"}>
            {burndown.deltaVsIdeal >= 0 ? "no ritmo" : `${Math.abs(burndown.deltaVsIdeal)} ${unit} atrás do ideal`}
          </span>
        </p>
      </div>
      {burndown.total > 0 ? (
        <BurndownChart points={burndown.points} metric={burndown.metric} height={240} />
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">Este projeto ainda não tem tarefas.</p>
      )}
    </div>
  );
}
