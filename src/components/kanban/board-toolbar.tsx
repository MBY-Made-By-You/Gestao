"use client";

import { Columns3, Plus, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITY_LABEL } from "@/lib/constants";
import { EMPTY_FILTERS, hasActiveFilters, type BoardFilters } from "@/lib/kanban/board-state";
import type { MiniProfile, Sprint, Tag, TaskPriority } from "@/lib/types";

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
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
      <div className="relative w-full xl:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.query}
          onChange={(e) => set("query", e.target.value)}
          placeholder="Buscar tarefas, etiquetas…"
          className="pl-9"
          aria-label="Buscar tarefas"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.assigneeId} onValueChange={(v) => set("assigneeId", v)}>
          <SelectTrigger size="sm" className="w-auto min-w-36" aria-label="Filtrar por responsável">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os responsáveis</SelectItem>
            <SelectItem value="none">Sem responsável</SelectItem>
            <SelectSeparator />
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.full_name || "Sem nome"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.priority} onValueChange={(v) => set("priority", v as TaskPriority | "all")}>
          <SelectTrigger size="sm" className="w-auto min-w-32" aria-label="Filtrar por prioridade">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda prioridade</SelectItem>
            {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {tags.length > 0 && (
          <Select value={filters.tagId} onValueChange={(v) => set("tagId", v)}>
            <SelectTrigger size="sm" className="w-auto min-w-32" aria-label="Filtrar por etiqueta">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as etiquetas</SelectItem>
              {tags.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="size-2 rounded-full" style={{ backgroundColor: t.color }} />
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {activeSprints.length > 0 && (
          <Select value={filters.sprintId} onValueChange={(v) => set("sprintId", v)}>
            <SelectTrigger size="sm" className="w-auto min-w-32" aria-label="Filtrar por sprint">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as sprints</SelectItem>
              {activeSprints.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                  {s.status === "active" ? " · ativa" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasActiveFilters(filters) && (
          <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>
            <X /> Limpar
          </Button>
        )}
      </div>

      {canEdit && (
        <div className="flex gap-2 xl:ml-auto">
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
