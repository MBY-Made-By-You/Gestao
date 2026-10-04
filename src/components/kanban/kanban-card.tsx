"use client";

import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, CircleCheckBig, Flag, Paperclip } from "lucide-react";

import { UserAvatar } from "@/components/ui/avatar";
import { PRIORITY_LABEL, PRIORITY_STYLE } from "@/lib/constants";
import { dueLabel, dueState } from "@/lib/format";
import type { TaskCard } from "@/lib/types";
import { cn } from "@/lib/utils";

const DUE_STYLE: Record<ReturnType<typeof dueState>, string> = {
  overdue: "bg-destructive/12 text-destructive",
  today: "bg-warning/15 text-warning",
  soon: "bg-warning/10 text-warning",
  later: "bg-muted text-muted-foreground",
  done: "bg-success/12 text-success",
  none: "",
};

/** Visual do card (usado no quadro e na sobreposição durante o arraste). */
export const TaskCardView = memo(function TaskCardView({
  task,
  isOverlay,
  isPlaceholder,
  className,
}: {
  task: TaskCard;
  isOverlay?: boolean;
  isPlaceholder?: boolean;
  className?: string;
}) {
  const due = dueState(task.due_date, task.completed_at);
  const done = Boolean(task.completed_at);
  const visibleTags = task.tags.slice(0, 3);
  const hiddenTags = task.tags.length - visibleTags.length;

  return (
    <div
      className={cn(
        "group/card relative rounded-xl border border-border/80 bg-card p-3 text-left shadow-[0_1px_2px_rgb(11_26_51/0.05)] transition-[box-shadow,transform,border-color] duration-200",
        "hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lift",
        isOverlay && "rotate-[2.5deg] cursor-grabbing border-brand/40 shadow-2xl ring-2 ring-brand/30",
        isPlaceholder && "border-dashed border-brand/50 bg-brand-soft/40 opacity-60 shadow-none [&>*]:invisible",
        className,
      )}
    >
      {task.priority === "urgent" && !done && (
        <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-red-500" aria-hidden />
      )}

      {visibleTags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {visibleTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex max-w-[9rem] items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[10.5px] font-bold"
              style={{ backgroundColor: `${tag.color}1f`, color: tag.color }}
            >
              <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
              <span className="truncate">{tag.name}</span>
            </span>
          ))}
          {hiddenTags > 0 && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10.5px] font-bold text-muted-foreground">
              +{hiddenTags}
            </span>
          )}
        </div>
      )}

      <div className="flex items-start gap-2">
        {done && <CircleCheckBig className="mt-0.5 size-4 shrink-0 text-success" aria-label="Concluída" />}
        <p
          className={cn(
            "line-clamp-3 text-[13.5px] leading-snug font-semibold text-foreground",
            done && "text-muted-foreground",
          )}
        >
          {task.title}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        {(task.priority === "high" || task.priority === "urgent") && !done && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold",
              PRIORITY_STYLE[task.priority].badge,
            )}
            title={`Prioridade ${PRIORITY_LABEL[task.priority]}`}
          >
            <Flag className="size-3" />
            {PRIORITY_LABEL[task.priority]}
          </span>
        )}
        {task.due_date && (
          <span
            className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold", DUE_STYLE[due])}
            title="Prazo"
          >
            <CalendarClock className="size-3" />
            {done ? "Entregue" : dueLabel(task.due_date, task.completed_at)}
          </span>
        )}
        {task.attachment_count > 0 && (
          <span
            className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-muted-foreground"
            title={`${task.attachment_count} anexo(s)`}
          >
            <Paperclip className="size-3" />
            {task.attachment_count}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          {task.story_points > 0 && (
            <span
              className="grid h-5 min-w-5 place-items-center rounded-full bg-secondary px-1 text-[10.5px] font-bold text-secondary-foreground"
              title={`${task.story_points} ponto(s) · ${task.xp_reward ?? 0} XP`}
            >
              {task.story_points}
            </span>
          )}
          {task.assignee ? (
            <UserAvatar
              name={task.assignee.full_name}
              src={task.assignee.avatar_url}
              className="size-6 ring-2 ring-card"
            />
          ) : (
            <span
              className="grid size-6 place-items-center rounded-full border border-dashed border-muted-foreground/40 text-[10px] text-muted-foreground"
              title="Sem responsável"
            >
              ?
            </span>
          )}
        </span>
      </div>
    </div>
  );
});

/** Card arrastável (dnd-kit). Clique abre os detalhes; espaço inicia o arraste pelo teclado. */
export function SortableTaskCard({
  task,
  columnId,
  disabled,
  onOpen,
}: {
  task: TaskCard;
  columnId: string;
  disabled?: boolean;
  onOpen: (taskId: string) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", columnId },
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      role="button"
      aria-roledescription="tarefa arrastável"
      aria-label={`${task.title}. Pressione Enter para abrir${disabled ? "" : " ou espaço para mover"}.`}
      onClick={() => onOpen(task.id)}
      onKeyDown={(event) => {
        listeners?.onKeyDown?.(event);
        if (event.key === "Enter" && !event.defaultPrevented) onOpen(task.id);
      }}
      className={cn(
        "touch-manipulation rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        disabled ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
      )}
    >
      <TaskCardView task={task} isPlaceholder={isDragging} />
    </div>
  );
}
