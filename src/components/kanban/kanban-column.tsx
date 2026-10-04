"use client";

import { useRef, useState } from "react";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CircleCheckBig, GripVertical, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

import { SortableTaskCard } from "@/components/kanban/kanban-card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import type { BoardColumn, TaskCard } from "@/lib/types";
import { cn } from "@/lib/utils";

export function KanbanColumn({
  column,
  tasks,
  totalCount,
  canEdit,
  filtered,
  onOpenTask,
  onQuickAdd,
  onEdit,
  onDelete,
}: {
  column: BoardColumn;
  /** Tarefas visíveis (após filtros). */
  tasks: TaskCard[];
  /** Total real da coluna (para o limite WIP). */
  totalCount: number;
  canEdit: boolean;
  filtered?: boolean;
  onOpenTask: (taskId: string) => void;
  onQuickAdd: (columnId: string, title: string) => Promise<boolean>;
  onEdit: (column: BoardColumn) => void;
  onDelete: (column: BoardColumn) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging, setActivatorNodeRef } = useSortable({
    id: column.id,
    data: { type: "column" },
    disabled: !canEdit,
  });

  const overWip = column.wip_limit !== null && totalCount > column.wip_limit;
  const points = tasks.reduce((sum, t) => sum + t.story_points, 0);

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      aria-label={`Coluna ${column.name}`}
      className={cn(
        "flex max-h-full w-[300px] shrink-0 flex-col rounded-2xl border border-border/70 bg-muted/55 backdrop-blur-sm dark:bg-card/55",
        isDragging && "opacity-40",
      )}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        {canEdit && (
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="-ml-1 grid size-6 cursor-grab place-items-center rounded-md text-muted-foreground/60 hover:bg-accent hover:text-foreground active:cursor-grabbing"
            aria-label={`Mover coluna ${column.name}`}
          >
            <GripVertical className="size-4" />
          </button>
        )}
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: column.color }} />
        <h3 className="truncate text-[13px] font-extrabold tracking-wide uppercase">{column.name}</h3>
        {column.is_done && <CircleCheckBig className="size-3.5 shrink-0 text-success" aria-label="Coluna de conclusão" />}
        <span
          className={cn(
            "ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
            overWip ? "bg-destructive/15 text-destructive" : "bg-card text-muted-foreground",
          )}
          title={column.wip_limit ? `Limite WIP: ${column.wip_limit}` : `${totalCount} tarefa(s)`}
        >
          {filtered ? `${tasks.length}/` : ""}
          {totalCount}
          {column.wip_limit ? ` / ${column.wip_limit}` : ""}
        </span>
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label={`Opções da coluna ${column.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onEdit(column)}>
                <Pencil /> Editar coluna
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(column)}>
                <Trash2 /> Excluir coluna
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {points > 0 && (
        <p className="-mt-1 px-3 pb-2 text-[11px] font-medium text-muted-foreground">{points} pontos</p>
      )}

      <div className="scrollbar-thin flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              columnId={column.id}
              disabled={!canEdit}
              onOpen={onOpenTask}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            {filtered ? "Nenhuma tarefa com esses filtros" : "Arraste tarefas para cá"}
          </div>
        )}
      </div>

      {canEdit && <QuickAdd columnId={column.id} onQuickAdd={onQuickAdd} />}
    </section>
  );
}

/** Prévia estática da coluna exibida durante o arraste (sem hooks de sortable). */
export function ColumnPreview({ column, tasks }: { column: BoardColumn; tasks: TaskCard[] }) {
  return (
    <section className="flex w-[300px] rotate-[1.5deg] flex-col rounded-2xl border border-brand/40 bg-muted/90 shadow-2xl ring-2 ring-brand/30 dark:bg-card/90">
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <GripVertical className="size-4 text-muted-foreground" />
        <span className="size-2.5 rounded-full" style={{ backgroundColor: column.color }} />
        <h3 className="truncate text-[13px] font-extrabold tracking-wide uppercase">{column.name}</h3>
        <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
          {tasks.length}
        </span>
      </header>
      <div className="flex flex-col gap-2 px-2 pb-3">
        {tasks.slice(0, 3).map((task) => (
          <div key={task.id} className="rounded-xl border bg-card p-3 text-[13px] font-semibold shadow-sm">
            <span className="line-clamp-2">{task.title}</span>
          </div>
        ))}
        {tasks.length > 3 && (
          <p className="px-1 text-xs font-semibold text-muted-foreground">+{tasks.length - 3} tarefa(s)</p>
        )}
      </div>
    </section>
  );
}

function QuickAdd({
  columnId,
  onQuickAdd,
}: {
  columnId: string;
  onQuickAdd: (columnId: string, title: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function submit() {
    const value = title.trim();
    if (!value || saving) return;
    setSaving(true);
    const ok = await onQuickAdd(columnId, value);
    setSaving(false);
    if (ok) {
      setTitle("");
      inputRef.current?.focus();
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-2 mb-2 flex items-center gap-1.5 rounded-xl px-2 py-2 text-[13px] font-semibold text-muted-foreground transition hover:bg-card hover:text-foreground"
      >
        <Plus className="size-4" /> Adicionar tarefa
      </button>
    );
  }

  return (
    <div className="mx-2 mb-2 space-y-2 rounded-xl border bg-card p-2 shadow-sm">
      <Textarea
        ref={inputRef}
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
          if (e.key === "Escape") {
            setOpen(false);
            setTitle("");
          }
        }}
        placeholder="Título da tarefa… (Enter para salvar)"
        className="min-h-14 resize-none border-0 bg-transparent p-1 shadow-none focus-visible:ring-0"
        maxLength={200}
      />
      <div className="flex items-center justify-end gap-1.5">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setTitle("");
          }}
        >
          Cancelar
        </Button>
        <Button size="sm" onClick={() => void submit()} disabled={!title.trim() || saving}>
          {saving && <Loader2 className="animate-spin" />}
          Adicionar
        </Button>
      </div>
    </div>
  );
}
