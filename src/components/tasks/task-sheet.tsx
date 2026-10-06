"use client";

import { useState, useTransition } from "react";
import { CalendarClock, CircleCheckBig, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { TaskAttachments } from "@/components/tasks/attachments/task-attachments";
import {
  AssigneesPicker,
  ColumnSelect,
  PointsSelect,
  PrioritySelect,
  SprintSelect,
  TagPicker,
} from "@/components/tasks/task-fields";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/misc";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { dueLabel, dueState, formatDateTime, formatRelative } from "@/lib/format";
import type { BoardColumn, MiniProfile, Sprint, Tag, TaskCard } from "@/lib/types";
import { cn } from "@/lib/utils";
import { completionMessage } from "@/lib/kanban/task-card";
import { deleteTask, setTaskAssignees, setTaskTags, updateTask } from "@/server/actions/board";

export type TaskSheetProps = {
  task: TaskCard | null;
  onClose: () => void;
  project: { id: string; name: string; color: string };
  columns: BoardColumn[];
  members: MiniProfile[];
  tags: Tag[];
  sprints: Sprint[];
  canEdit: boolean;
  currentUserId: string;
  onTaskChange: (task: TaskCard) => void;
  onTaskDeleted: (taskId: string) => void;
  onAttachmentDelta: (taskId: string, delta: number) => void;
  onTagCreated: (tag: Tag) => void;
};

/** Painel lateral com todos os detalhes da tarefa (salvamento automático). */
export function TaskSheet(props: TaskSheetProps) {
  const { task, onClose } = props;
  return (
    <Sheet open={task !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-2xl">
        {task ? <TaskEditor key={task.id} {...props} task={task} /> : null}
      </SheetContent>
    </Sheet>
  );
}

type EditableField = "title" | "description" | "priority" | "due_date" | "story_points" | "sprint_id" | "column_id";

function TaskEditor({
  task,
  onClose,
  project,
  columns,
  members,
  tags,
  sprints,
  canEdit,
  currentUserId,
  onTaskChange,
  onTaskDeleted,
  onAttachmentDelta,
  onTagCreated,
}: TaskSheetProps & { task: TaskCard }) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [saving, setSaving] = useState<EditableField | "tags" | "assignees" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, startDelete] = useTransition();

  const column = columns.find((c) => c.id === task.column_id);
  const due = dueState(task.due_date, task.completed_at);

  async function save<K extends EditableField>(field: K, value: TaskCard[K]) {
    if (task[field] === value) return;
    const previous = task;
    onTaskChange({ ...task, [field]: value }); // otimista
    setSaving(field);
    const result = await updateTask(task.id, { [field]: value });
    setSaving(null);
    if (!result.ok) {
      onTaskChange(previous);
      toast.error(result.error);
      return;
    }
    onTaskChange(result.data!);
    if (field === "column_id" && !previous.completed_at && result.data!.completed_at) {
      toast.success(completionMessage(result.data!));
    }
  }

  async function saveTags(ids: string[]) {
    setSaving("tags");
    const optimistic = tags.filter((t) => ids.includes(t.id));
    const previous = task;
    onTaskChange({ ...task, tags: optimistic });
    const result = await setTaskTags(task.id, ids);
    setSaving(null);
    if (!result.ok) {
      onTaskChange(previous);
      toast.error(result.error);
      return;
    }
    onTaskChange(result.data!);
  }

  async function saveAssignees(people: MiniProfile[]) {
    setSaving("assignees");
    const previous = task;
    onTaskChange({ ...task, assignees: people });
    const result = await setTaskAssignees(
      task.id,
      people.map((p) => p.id),
    );
    setSaving(null);
    if (!result.ok) {
      onTaskChange(previous);
      toast.error(result.error);
      return;
    }
    onTaskChange(result.data!);
  }

  function commitTitle() {
    const value = title.trim();
    if (!value) {
      setTitle(task.title);
      return;
    }
    void save("title", value);
  }

  function remove() {
    startDelete(async () => {
      const result = await deleteTask(task.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Tarefa excluída");
      setConfirmDelete(false);
      onTaskDeleted(task.id);
      onClose();
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b px-6 pt-6 pb-4">
        <div className="flex items-center gap-2 pr-8 text-xs font-semibold text-muted-foreground">
          <span className="size-2.5 rounded-[4px]" style={{ backgroundColor: project.color }} />
          <span className="truncate">{project.name}</span>
          <span>·</span>
          <span className="truncate">{column?.name ?? "Backlog"}</span>
          {saving && (
            <span className="ml-auto flex items-center gap-1 text-[11px]">
              <Loader2 className="size-3 animate-spin" /> Salvando
            </span>
          )}
        </div>
        <SheetTitle className="sr-only">{task.title}</SheetTitle>
        {canEdit ? (
          <Textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            maxLength={200}
            aria-label="Título da tarefa"
            className="min-h-0 resize-none border-transparent bg-transparent px-1 py-1 text-xl font-extrabold tracking-tight shadow-none hover:border-border focus-visible:border-ring"
          />
        ) : (
          <p aria-hidden className="text-xl font-extrabold tracking-tight">
            {task.title}
          </p>
        )}
        <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span>Criada {formatRelative(task.created_at)}</span>
          {task.completed_at ? (
            <span className="inline-flex items-center gap-1 font-semibold text-success">
              <CircleCheckBig className="size-3.5" /> Concluída em {formatDateTime(task.completed_at)}
            </span>
          ) : task.due_date ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 font-semibold",
                due === "overdue" && "text-destructive",
                (due === "today" || due === "soon") && "text-warning",
              )}
            >
              <CalendarClock className="size-3.5" /> {dueLabel(task.due_date)}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 font-semibold text-brand-strong dark:text-brand">
            <Sparkles className="size-3.5" /> {task.xp_reward ?? 0} XP{task.assignees.length > 1 ? " para cada" : ""} (+50% no prazo)
          </span>
        </SheetDescription>
      </div>

      <div className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status" htmlFor="task-column">
            <ColumnSelect
              id="task-column"
              columns={columns}
              value={task.column_id}
              onChange={(v) => void save("column_id", v)}
              disabled={!canEdit}
            />
          </Field>
          <Field label="Prioridade" htmlFor="task-priority">
            <PrioritySelect
              id="task-priority"
              value={task.priority}
              onChange={(v) => void save("priority", v)}
              disabled={!canEdit}
            />
          </Field>
          <Field label="Prazo" htmlFor="task-due">
            <Input
              id="task-due"
              type="date"
              value={task.due_date ?? ""}
              onChange={(e) => void save("due_date", e.target.value || null)}
              disabled={!canEdit}
            />
          </Field>
          <Field label="Estimativa" htmlFor="task-points">
            <PointsSelect
              id="task-points"
              value={task.story_points}
              onChange={(v) => void save("story_points", v)}
              disabled={!canEdit}
            />
          </Field>
          <Field label="Sprint" htmlFor="task-sprint">
            <SprintSelect
              id="task-sprint"
              sprints={sprints}
              value={task.sprint_id}
              onChange={(v) => void save("sprint_id", v)}
              disabled={!canEdit}
            />
          </Field>
        </div>

        <Field label="Responsáveis" htmlFor="task-assignees">
          <AssigneesPicker
            id="task-assignees"
            members={members}
            value={task.assignees}
            onChange={(people) => void saveAssignees(people)}
            disabled={!canEdit}
          />
        </Field>

        <Field label="Etiquetas">
          <TagPicker
            projectId={project.id}
            tags={tags}
            selectedIds={task.tags.map((t) => t.id)}
            onChange={(ids) => void saveTags(ids)}
            onTagCreated={onTagCreated}
            disabled={!canEdit}
          />
        </Field>

        <Field label="Descrição" htmlFor="task-description">
          {canEdit ? (
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => void save("description", description.trim() ? description : null)}
              placeholder="Contexto, critérios de aceite, links…"
              className="min-h-32"
              maxLength={10000}
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap text-foreground/90">
              {task.description || <span className="text-muted-foreground">Sem descrição.</span>}
            </p>
          )}
        </Field>

        <Separator />

        <TaskAttachments
          taskId={task.id}
          projectId={project.id}
          userId={currentUserId}
          canEdit={canEdit}
          onCountDelta={(delta) => onAttachmentDelta(task.id, delta)}
        />
      </div>

      {canEdit && (
        <div className="flex items-center justify-between gap-2 border-t px-6 py-3">
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 /> Excluir tarefa
          </Button>
          <Button size="sm" variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{task.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              A tarefa, suas etiquetas e imagens anexadas serão removidas. O XP já concedido por ela também é
              estornado. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={remove} disabled={deleting}>
              {deleting && <Loader2 className="animate-spin" />}
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </Label>
      {children}
    </div>
  );
}
