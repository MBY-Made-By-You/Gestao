"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  ArrowRightToLine,
  CalendarRange,
  CheckCheck,
  Loader2,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/brand/empty-state";
import { SprintDialog } from "@/components/backlog/sprint-dialog";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { TaskSheet } from "@/components/tasks/task-sheet";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox, Progress } from "@/components/ui/misc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITY_LABEL, PRIORITY_STYLE, SPRINT_STATUS_LABEL } from "@/lib/constants";
import { dueLabel, dueState, formatShortDate } from "@/lib/format";
import type { BoardColumn, MiniProfile, Project, Sprint, Tag, TaskCard } from "@/lib/types";
import { cn } from "@/lib/utils";
import { updateTask } from "@/server/actions/board";
import { completeSprint, deleteSprint, sendTasksToBoard, startSprint } from "@/server/actions/projects";

type SprintTaskStat = { sprint_id: string | null; story_points: number; completed_at: string | null; column_id: string | null };

const NO_SPRINT = "__none__";

export function BacklogView({
  project,
  tasks: initialTasks,
  columns,
  tags: initialTags,
  sprints,
  sprintTasks,
  members,
  canEdit,
  currentUserId,
}: {
  project: Project;
  tasks: TaskCard[];
  columns: BoardColumn[];
  tags: Tag[];
  sprints: Sprint[];
  sprintTasks: SprintTaskStat[];
  members: MiniProfile[];
  canEdit: boolean;
  currentUserId: string;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [tags, setTags] = useState(initialTags);
  const [source, setSource] = useState(initialTasks);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [sprintDialog, setSprintDialog] = useState<{ open: boolean; sprint: Sprint | null }>({ open: false, sprint: null });
  const [pending, startTransition] = useTransition();
  const [showCompleted, setShowCompleted] = useState(false);

  // Recarregou no servidor (ex.: sprint iniciada) → sincroniza a lista.
  if (initialTasks !== source) {
    setSource(initialTasks);
    setTasks(initialTasks);
    setSelected(new Set());
  }

  const openSprints = useMemo(
    () =>
      sprints
        .filter((s) => s.status !== "completed")
        .sort((a, b) =>
          a.status === "active" ? -1 : b.status === "active" ? 1 : a.start_date.localeCompare(b.start_date),
        ),
    [sprints],
  );
  const completedSprints = sprints.filter((s) => s.status === "completed");

  const groups = useMemo(() => {
    const result: { key: string; title: string; sprint: Sprint | null; tasks: TaskCard[] }[] = [];
    for (const sprint of openSprints) {
      const list = tasks.filter((t) => t.sprint_id === sprint.id);
      if (list.length) result.push({ key: sprint.id, title: `Planejadas para ${sprint.name}`, sprint, tasks: list });
    }
    const loose = tasks.filter((t) => !t.sprint_id || !openSprints.some((s) => s.id === t.sprint_id));
    result.push({ key: NO_SPRINT, title: "Sem sprint", sprint: null, tasks: loose });
    return result;
  }, [tasks, openSprints]);

  const totalPoints = tasks.reduce((s, t) => s + t.story_points, 0);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function sendToBoard(ids: string[]) {
    startTransition(async () => {
      const result = await sendTasksToBoard(project.id, ids);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTasks((prev) => prev.filter((t) => !ids.includes(t.id)));
      setSelected(new Set());
      toast.success(`${result.data!.moved} tarefa(s) enviada(s) para “${columns[0]?.name ?? "o quadro"}”`);
    });
  }

  function planInSprint(task: TaskCard, sprintId: string | null) {
    const previous = task.sprint_id;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, sprint_id: sprintId } : t)));
    startTransition(async () => {
      const result = await updateTask(task.id, { sprint_id: sprintId });
      if (!result.ok) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, sprint_id: previous } : t)));
        toast.error(result.error);
      }
    });
  }

  function sprintAction(action: "start" | "complete" | "delete", sprint: Sprint) {
    startTransition(async () => {
      if (action === "start") {
        const result = await startSprint(sprint.id);
        if (!result.ok) return void toast.error(result.error);
        toast.success(`Sprint iniciada — ${result.data!.moved} tarefa(s) foram para o quadro.`);
      } else if (action === "complete") {
        const result = await completeSprint(sprint.id);
        if (!result.ok) return void toast.error(result.error);
        toast.success(
          result.data!.carriedOver
            ? `Sprint concluída. ${result.data!.carriedOver} tarefa(s) não concluída(s) ficaram sem sprint.`
            : "Sprint concluída. Tudo entregue! 🎉",
        );
      } else {
        const result = await deleteSprint(sprint.id);
        if (!result.ok) return void toast.error(result.error);
        toast.success("Sprint excluída");
      }
    });
  }

  const handleTaskChange = useCallback((task: TaskCard) => {
    if (task.column_id) {
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      setOpenTaskId(null);
      toast.success("Tarefa enviada para o quadro");
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
  }, []);

  const openTask = tasks.find((t) => t.id === openTaskId) ?? null;

  return (
    <div className="space-y-6">
      {/* Sprints ------------------------------------------------------------ */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-extrabold">Sprints</h2>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setSprintDialog({ open: true, sprint: null })}>
              <Plus /> Nova sprint
            </Button>
          )}
        </div>

        {openSprints.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
            Nenhuma sprint planejada. Sprints agrupam tarefas do backlog em ciclos com objetivo e prazo — ao iniciar uma
            sprint, as tarefas planejadas entram no quadro automaticamente.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {openSprints.map((sprint) => {
              const stats = sprintTasks.filter((t) => t.sprint_id === sprint.id);
              const points = stats.reduce((s, t) => s + t.story_points, 0);
              const donePoints = stats.filter((t) => t.completed_at).reduce((s, t) => s + t.story_points, 0);
              const inBacklog = stats.filter((t) => !t.column_id && !t.completed_at).length;
              return (
                <article
                  key={sprint.id}
                  className={cn(
                    "space-y-3 rounded-2xl border bg-card p-4 shadow-card",
                    sprint.status === "active" && "border-brand/40 ring-1 ring-brand/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-bold">{sprint.name}</h3>
                        <Badge variant={sprint.status === "active" ? "default" : "muted"}>
                          {SPRINT_STATUS_LABEL[sprint.status]}
                        </Badge>
                      </div>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarRange className="size-3.5" />
                        {formatShortDate(sprint.start_date)} → {formatShortDate(sprint.end_date)}
                      </p>
                    </div>
                    {canEdit && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Ações da ${sprint.name}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setSprintDialog({ open: true, sprint })}>
                            <Pencil /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => sprintAction("delete", sprint)}>
                            <Trash2 /> Excluir sprint
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  {sprint.goal && (
                    <p className="flex gap-1.5 text-sm text-muted-foreground">
                      <Target className="mt-0.5 size-3.5 shrink-0 text-brand" /> {sprint.goal}
                    </p>
                  )}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {stats.length} tarefa(s) · {inBacklog} no backlog
                      </span>
                      <span className="font-semibold tabular-nums">
                        {donePoints}/{points} pts
                      </span>
                    </div>
                    <Progress value={points ? (donePoints / points) * 100 : 0} className="h-1.5" aria-label="Pontos concluídos" />
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      {sprint.status === "planned" ? (
                        <Button size="sm" className="w-full" onClick={() => sprintAction("start", sprint)} disabled={pending}>
                          <Play /> Iniciar sprint
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => sprintAction("complete", sprint)}
                          disabled={pending}
                        >
                          <CheckCheck /> Concluir sprint
                        </Button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {completedSprints.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              {showCompleted ? "Ocultar" : "Ver"} {completedSprints.length} sprint(s) concluída(s)
            </button>
            {showCompleted && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {completedSprints.map((s) => (
                  <li key={s.id} className="rounded-lg bg-muted px-2.5 py-1 text-xs">
                    <span className="font-semibold">{s.name}</span> · {formatShortDate(s.start_date)} → {formatShortDate(s.end_date)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Backlog ------------------------------------------------------------ */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold">Backlog</h2>
            <p className="text-xs text-muted-foreground">
              {tasks.length} tarefa(s) fora do quadro · {totalPoints} pontos
            </p>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              {selected.size > 0 && (
                <Button size="sm" variant="soft" onClick={() => sendToBoard([...selected])} disabled={pending}>
                  {pending ? <Loader2 className="animate-spin" /> : <ArrowRightToLine />}
                  Enviar {selected.size} para o quadro
                </Button>
              )}
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus /> Nova tarefa
              </Button>
            </div>
          )}
        </div>

        {tasks.length === 0 ? (
          <EmptyState
            compact
            title="Backlog vazio"
            description="Ideias e tarefas futuras ficam aqui até entrarem em uma sprint ou no quadro."
            action={canEdit ? <Button size="sm" onClick={() => setCreateOpen(true)}>Adicionar ao backlog</Button> : null}
          />
        ) : (
          <div className="space-y-5">
            {groups
              .filter((g) => g.tasks.length > 0)
              .map((group) => (
                <div key={group.key} className="overflow-hidden rounded-2xl border bg-card shadow-card">
                  <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-2.5">
                    {canEdit && (
                      <Checkbox
                        checked={group.tasks.every((t) => selected.has(t.id))}
                        onCheckedChange={(checked) =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            group.tasks.forEach((t) => (checked ? next.add(t.id) : next.delete(t.id)));
                            return next;
                          })
                        }
                        aria-label={`Selecionar todas de ${group.title}`}
                      />
                    )}
                    <h3 className="text-sm font-bold">{group.title}</h3>
                    <span className="text-xs text-muted-foreground">
                      {group.tasks.length} · {group.tasks.reduce((s, t) => s + t.story_points, 0)} pts
                    </span>
                  </div>
                  <ul className="divide-y">
                    {group.tasks.map((task) => {
                      const due = dueState(task.due_date);
                      return (
                        <li key={task.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 transition hover:bg-muted/40">
                          {canEdit && (
                            <Checkbox
                              checked={selected.has(task.id)}
                              onCheckedChange={() => toggle(task.id)}
                              aria-label={`Selecionar ${task.title}`}
                            />
                          )}
                          <span
                            className={cn("size-2 shrink-0 rounded-full", PRIORITY_STYLE[task.priority].dot)}
                            title={`Prioridade ${PRIORITY_LABEL[task.priority]}`}
                          />
                          <button
                            type="button"
                            onClick={() => setOpenTaskId(task.id)}
                            className="min-w-0 flex-1 truncate text-left text-sm font-semibold hover:text-brand-strong dark:hover:text-brand"
                          >
                            {task.title}
                          </button>
                          <div className="hidden items-center gap-1 md:flex">
                            {task.tags.slice(0, 2).map((tag) => (
                              <span
                                key={tag.id}
                                className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold"
                                style={{ backgroundColor: `${tag.color}1f`, color: tag.color }}
                              >
                                {tag.name}
                              </span>
                            ))}
                          </div>
                          {task.due_date && (
                            <span className={cn("text-xs", due === "overdue" ? "font-semibold text-destructive" : "text-muted-foreground")}>
                              {dueLabel(task.due_date)}
                            </span>
                          )}
                          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-secondary px-1 text-[10.5px] font-bold">
                            {task.story_points}
                          </span>
                          {task.assignee ? (
                            <UserAvatar name={task.assignee.full_name} src={task.assignee.avatar_url} className="size-6" />
                          ) : (
                            <span className="size-6" />
                          )}
                          {canEdit && (
                            <>
                              <Select
                                value={task.sprint_id ?? NO_SPRINT}
                                onValueChange={(v) => planInSprint(task, v === NO_SPRINT ? null : v)}
                              >
                                <SelectTrigger size="sm" className="w-36" aria-label="Planejar em sprint">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={NO_SPRINT}>Sem sprint</SelectItem>
                                  {openSprints.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {s.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => sendToBoard([task.id])}
                                disabled={pending}
                                title="Enviar para o quadro"
                                aria-label={`Enviar ${task.title} para o quadro`}
                              >
                                <ArrowRightToLine />
                              </Button>
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
          </div>
        )}
      </section>

      <TaskSheet
        task={openTask}
        onClose={() => setOpenTaskId(null)}
        project={{ id: project.id, name: project.name, color: project.color }}
        columns={columns}
        members={members}
        tags={tags}
        sprints={sprints}
        canEdit={canEdit}
        currentUserId={currentUserId}
        onTaskChange={handleTaskChange}
        onTaskDeleted={(id) => setTasks((prev) => prev.filter((t) => t.id !== id))}
        onAttachmentDelta={(id, delta) =>
          setTasks((prev) =>
            prev.map((t) => (t.id === id ? { ...t, attachment_count: Math.max(0, t.attachment_count + delta) } : t)),
          )
        }
        onTagCreated={(tag) => setTags((prev) => [...prev, tag])}
      />

      {canEdit && createOpen && (
        <CreateTaskDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          projectId={project.id}
          columns={columns}
          members={members}
          tags={tags}
          sprints={sprints}
          defaultColumnId={null}
          onCreated={(task) => {
            if (!task.column_id) setTasks((prev) => [...prev, task]);
            else toast.info("Tarefa criada direto no quadro.");
          }}
          onTagCreated={(tag) => setTags((prev) => [...prev, tag])}
        />
      )}

      {canEdit && sprintDialog.open && (
        <SprintDialog
          key={sprintDialog.sprint?.id ?? "new"}
          projectId={project.id}
          sprint={sprintDialog.sprint}
          open={sprintDialog.open}
          onOpenChange={(open) => setSprintDialog((s) => ({ ...s, open }))}
          suggestedName={`Sprint ${sprints.length + 1}`}
        />
      )}
    </div>
  );
}
