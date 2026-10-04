"use client";

import type { ReactNode } from "react";
import { Columns3, Plus, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITY_LABEL } from "@/lib/constants";
import { EMPTY_FILTERS, hasActiveFilters, type BoardFilters } from "@/lib/kanban/board-state";
import type { MiniProfile, Sprint, Tag, TaskPriority } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BoardToolbar({
  filters,
  onChange,
  members,
  tags,
  sprints,
  canEdit,
  onNewTask,
  onNewColumn,
}: {
  filters: BoardFilters;
  onChange: (filters: BoardFilters) => void;
  members: MiniProfile[];
  tags: Tag[];
  sprints: Sprint[];
  canEdit: boolean;
  onNewTask: () => void;
  onNewColumn: () => void;
}) {
  const set = <K extends keyof BoardFilters>(key: K, value: BoardFilters[K]) => onChange({ ...filters, [key]: value });
  const activeSprints = sprints.filter((s) => s.status !== "completed");

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative w-full lg:w-60 lg:shrink-0">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.query}
          onChange={(e) => set("query", e.target.value)}
          placeholder="Buscar tarefas, etiquetas…"
          className="h-8 pl-9"
          aria-label="Buscar tarefas"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <FilterSelect
          label="Responsável"
          allLabel="Todos os responsáveis"
          value={filters.assigneeId}
          onValueChange={(v) => set("assigneeId", v)}
        >
          <SelectItem value="none">Sem responsável</SelectItem>
          <SelectSeparator />
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.full_name || "Sem nome"}
            </SelectItem>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Prioridade"
          allLabel="Todas as prioridades"
          value={filters.priority}
          onValueChange={(v) => set("priority", v as TaskPriority | "all")}
        >
          {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((p) => (
            <SelectItem key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </SelectItem>
          ))}
        </FilterSelect>

        {tags.length > 0 && (
          <FilterSelect label="Etiqueta" allLabel="Todas as etiquetas" value={filters.tagId} onValueChange={(v) => set("tagId", v)}>
            {tags.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                <span className="size-2 rounded-full" style={{ backgroundColor: t.color }} />
                {t.name}
              </SelectItem>
            ))}
          </FilterSelect>
        )}

        {activeSprints.length > 0 && (
          <FilterSelect label="Sprint" allLabel="Todas as sprints" value={filters.sprintId} onValueChange={(v) => set("sprintId", v)}>
            {activeSprints.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
                {s.status === "active" ? " · ativa" : ""}
              </SelectItem>
            ))}
          </FilterSelect>
        )}

        {hasActiveFilters(filters) && (
          <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>
            <X /> Limpar
          </Button>
        )}
      </div>

      {canEdit && (
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={onNewColumn}>
            <Columns3 /> Nova coluna
          </Button>
          <Button size="sm" onClick={onNewTask}>
            <Plus /> Nova tarefa
          </Button>
        </div>
      )}
    </div>
  );
}

/** Filtro compacto: mostra o nome da dimensão quando inativo e o valor escolhido (destacado) quando ativo. */
function FilterSelect({
  label,
  allLabel,
  value,
  onValueChange,
  children,
}: {
  label: string;
  allLabel: string;
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}) {
  const active = value !== "all";
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        size="sm"
        aria-label={`Filtrar por ${label.toLocaleLowerCase("pt-BR")}`}
        className={cn(
          "w-auto max-w-52",
          active && "border-brand/45 bg-brand-soft/60 font-semibold text-brand-strong dark:text-brand [&_svg:not([class*='text-'])]:text-current",
        )}
      >
        <SelectValue>{active ? undefined : label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {children}
      </SelectContent>
    </Select>
  );
}
