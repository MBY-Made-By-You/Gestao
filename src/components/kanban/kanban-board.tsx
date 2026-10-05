"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { BoardToolbar } from "@/components/kanban/board-toolbar";
import { ColumnDialog, DeleteColumnDialog } from "@/components/kanban/column-dialogs";
import { TaskCardView } from "@/components/kanban/kanban-card";
import { ColumnPreview, KanbanColumn } from "@/components/kanban/kanban-column";
import { useBoardRealtime } from "@/components/kanban/use-board-realtime";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { TaskSheet } from "@/components/tasks/task-sheet";
import {
  EMPTY_FILTERS,
  computeTaskPosition,
  createBoardState,
  findTask,
  findTaskColumn,
  hasActiveFilters,
  matchesFilters,
  moveTaskInState,
  removeTaskFromState,
  updateTaskInState,
  upsertTaskInState,
  type BoardFilters,
  type BoardState,
} from "@/lib/kanban/board-state";
import { positionBetween } from "@/lib/kanban/positions";
import { parseDateOnly } from "@/lib/format";
import type { BoardColumn, Tag, TaskCard } from "@/lib/types";
import { createTask, moveColumn, moveTask } from "@/server/actions/board";
import type { BoardData } from "@/server/queries/board";

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }),
};

const screenReaderInstructions = {
  draggable:
    "Para mover, pressione espaço. Use ← e → para trocar de coluna, ↑ e ↓ para mudar a posição e espaço para soltar. Esc cancela. Enter abre os detalhes.",
};

const subscribeNoop = () => () => {};

function xpWithBonus(task: TaskCard) {
  const base = task.xp_reward ?? 0;
  if (!task.due_date || !task.completed_at) return base;
  const onTime = new Date(task.completed_at) <= new Date(parseDateOnly(task.due_date).getTime() + 86_399_999);
  return onTime ? base + Math.ceil(base * 0.5) : base;
}

/**
 * Quadro Kanban com arrastar e soltar (dnd-kit):
 * - cards ordenáveis dentro e entre colunas; colunas reordenáveis;
 * - estado otimista com rollback se o servidor recusar;
 * - posição fracionária (1 UPDATE por movimento);
 * - mouse, toque (pressionar e arrastar) e teclado, com anúncios em pt-BR;
 * - sincronização em tempo real com outros usuários (Supabase Realtime).
 */
export function KanbanBoard({
  data,
  canEdit,
  currentUserId,
  initialTaskId,
}: {
  data: BoardData;
  canEdit: boolean;
  currentUserId: string;
  initialTaskId?: string | null;
}) {
  const router = useRouter();
  const [board, setBoard] = useState<BoardState>(() => createBoardState(data.columns, data.tasks));
  const [tags, setTags] = useState<Tag[]>(data.tags);
  const [syncedData, setSyncedData] = useState(data);
  const [active, setActive] = useState<{ id: string; type: "task" | "column" } | null>(null);
  const [filters, setFilters] = useState<BoardFilters>(EMPTY_FILTERS);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialTaskId ?? null);
  const [createOpen, setCreateOpen] = useState(false);
  const [columnDialog, setColumnDialog] = useState<{ open: boolean; column: BoardColumn | null }>({
    open: false,
    column: null,
  });
  const [columnToDelete, setColumnToDelete] = useState<BoardColumn | null>(null);

  // Dados novos do servidor (refresh/realtime) substituem o estado local,
  // exceto durante um arraste — nesse caso sincroniza ao soltar.
  if (data !== syncedData && active === null) {
    setSyncedData(data);
    setBoard(createBoardState(data.columns, data.tasks));
    setTags(data.tags);
  }

  const boardRef = useRef(board);
  const snapshot = useRef<BoardState | null>(null);
  const lastOverId = useRef<UniqueIdentifier | null>(null);
  const movedToNewColumn = useRef(false);
  const dragging = useRef(false);

  useLayoutEffect(() => {
    boardRef.current = board;
  });

  useEffect(() => {
    dragging.current = active !== null;
  }, [active]);

  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  useBoardRealtime(
    data.project.id,
    useCallback(() => {
      if (!dragging.current) router.refresh();
    }, [router]),
  );

  /**
   * Teclado: ←/→ leva o card para a coluna vizinha; ↑/↓ muda a posição dentro
   * da coluna atual. (O padrão do dnd-kit não conhece colunas.)
   */
  const keyboardCoordinates: KeyboardCoordinateGetter = useCallback((event, args) => {
    const { active, droppableRects, droppableContainers } = args.context;
    if (!active || active.data.current?.type === "column") return sortableKeyboardCoordinates(event, args);
    const state = boardRef.current;
    const columnId = findTaskColumn(state, String(active.id));
    if (!columnId) return undefined;

    if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
      event.preventDefault();
      const index = state.columns.findIndex((c) => c.id === columnId);
      const target = state.columns[index + (event.code === "ArrowRight" ? 1 : -1)];
      const rect = target ? droppableRects.get(target.id) : null;
      return rect ? { x: rect.left + 8, y: rect.top + 56 } : undefined;
    }

    if (event.code === "ArrowUp" || event.code === "ArrowDown") {
      const sameColumn = new Set(state.tasksByColumn[columnId].map((t) => t.id));
      const restricted = {
        getEnabled: () => droppableContainers.getEnabled().filter((c) => sameColumn.has(String(c.id))),
        get: (id: UniqueIdentifier) => droppableContainers.get(id),
      } as typeof droppableContainers;
      return sortableKeyboardCoordinates(event, { ...args, context: { ...args.context, droppableContainers: restricted } });
    }
    return undefined;
  }, []);

  const keyboardOptions = useMemo(
    () => ({
      coordinateGetter: keyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
    [keyboardCoordinates],
  );

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, keyboardOptions),
  );

  const isColumnId = useCallback(
    (id: UniqueIdentifier) => boardRef.current.columns.some((c) => c.id === id),
    [],
  );

  const filtered = hasActiveFilters(filters);
  const visibleTasks = useMemo(() => {
    const result: Record<string, TaskCard[]> = {};
    for (const column of board.columns) {
      const tasks = board.tasksByColumn[column.id] ?? [];
      result[column.id] = filtered ? tasks.filter((t) => matchesFilters(t, filters)) : tasks;
    }
    return result;
  }, [board, filters, filtered]);

  // ---------------------------------------------------------------------------
  // Detecção de colisão: colunas usam o centro mais próximo; cards priorizam o
  // ponteiro e, sobre uma coluna com cards, miram no card mais próximo.
  // ---------------------------------------------------------------------------
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      if (active?.type === "column") {
        return closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter((c) => isColumnId(c.id)),
        });
      }

      const pointerHits = pointerWithin(args);
      const hits = pointerHits.length > 0 ? pointerHits : rectIntersection(args);
      let overId = getFirstCollision(hits, "id");

      if (overId != null) {
        if (isColumnId(overId)) {
          const columnTaskIds = new Set((boardRef.current.tasksByColumn[String(overId)] ?? []).map((t) => t.id));
          if (columnTaskIds.size > 0) {
            const closest = closestCenter({
              ...args,
              droppableContainers: args.droppableContainers.filter((c) => columnTaskIds.has(String(c.id))),
            })[0]?.id;
            if (closest) overId = closest;
          }
        }
        lastOverId.current = overId;
        return [{ id: overId }];
      }

      // Logo após trocar de coluna o layout muda; mantém o último alvo válido.
      if (movedToNewColumn.current) lastOverId.current = active?.id ?? null;
      return lastOverId.current ? [{ id: lastOverId.current }] : [];
    },
    [active, isColumnId],
  );

  // ---------------------------------------------------------------------------
  // Ciclo do arraste
  // ---------------------------------------------------------------------------
  function handleDragStart({ active: dragged }: DragStartEvent) {
    snapshot.current = boardRef.current;
    const type = dragged.data.current?.type === "column" ? "column" : "task";
    setActive({ id: String(dragged.id), type });
  }

  /** Ao cruzar para outra coluna, move o card no estado (prévia ao vivo). */
  function handleDragOver({ active: dragged, over }: DragOverEvent) {
    if (!over || dragged.data.current?.type === "column") return;
    const taskId = String(dragged.id);
    const overId = String(over.id);
    const overIsColumn = isColumnId(overId);
    const translated = dragged.rect.current.translated;
    const isBelow = translated ? translated.top > over.rect.top + over.rect.height / 2 : false;

    const resolveTarget = (state: BoardState) => {
      const fromColumn = findTaskColumn(state, taskId);
      const toColumn = overIsColumn ? overId : findTaskColumn(state, overId);
      if (!fromColumn || !toColumn || fromColumn === toColumn) return null;
      const targetTasks = state.tasksByColumn[toColumn];
      const overIndex = overIsColumn ? -1 : targetTasks.findIndex((t) => t.id === overId);
      const index = overIndex >= 0 ? overIndex + (isBelow ? 1 : 0) : targetTasks.length;
      return { toColumn, index };
    };

    if (!resolveTarget(boardRef.current)) return;
    movedToNewColumn.current = true;
    setBoard((state) => {
      const target = resolveTarget(state);
      return target ? moveTaskInState(state, taskId, target.toColumn, target.index) : state;
    });
  }

  function restoreSnapshot() {
    if (snapshot.current) setBoard(snapshot.current);
  }

  function handleDragCancel() {
    restoreSnapshot();
    setActive(null);
  }

  async function handleDragEnd({ active: dragged, over }: DragEndEvent) {
    const before = snapshot.current;
    setActive(null);
    movedToNewColumn.current = false;
    if (!before) return;
    if (!over) {
      restoreSnapshot();
      return;
    }

    // ---- Reordenação de colunas -------------------------------------------
    if (dragged.data.current?.type === "column") {
      const columns = boardRef.current.columns;
      const oldIndex = columns.findIndex((c) => c.id === dragged.id);
      const newIndex = columns.findIndex((c) => c.id === over.id);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const reordered = arrayMove(columns, oldIndex, newIndex);
      const position = positionBetween(reordered[newIndex - 1]?.position, reordered[newIndex + 1]?.position);
      reordered[newIndex] = { ...reordered[newIndex], position };
      setBoard((s) => ({ ...s, columns: reordered }));
      const result = await moveColumn(reordered[newIndex].id, position);
      if (!result.ok) {
        setBoard(before);
        toast.error(result.error);
      }
      return;
    }

    // ---- Movimento de tarefa ----------------------------------------------
    const taskId = String(dragged.id);
    let state = boardRef.current;
    const column = findTaskColumn(state, taskId);
    const overId = String(over.id);
    if (column && !isColumnId(overId) && findTaskColumn(state, overId) === column) {
      const tasks = state.tasksByColumn[column];
      const from = tasks.findIndex((t) => t.id === taskId);
      const to = tasks.findIndex((t) => t.id === overId);
      if (from !== to && to >= 0) state = moveTaskInState(state, taskId, column, to);
    }

    const placement = computeTaskPosition(state, taskId);
    const original = findTask(before, taskId);
    const originalColumn = findTaskColumn(before, taskId);
    if (!placement || !original || !originalColumn) {
      restoreSnapshot();
      return;
    }
    const originalIndex = before.tasksByColumn[originalColumn].findIndex((t) => t.id === taskId);
    if (placement.columnId === originalColumn && placement.index === originalIndex) {
      setBoard(before); // soltou no mesmo lugar
      return;
    }

    const targetColumn = state.columns.find((c) => c.id === placement.columnId)!;
    const optimistic = updateTaskInState(state, taskId, {
      column_id: placement.columnId,
      position: placement.position,
      completed_at: targetColumn.is_done ? (original.completed_at ?? new Date().toISOString()) : null,
    });
    setBoard(optimistic);

    const result = await moveTask({
      taskId,
      columnId: placement.columnId,
      position: placement.position,
      prev: placement.prev,
      next: placement.next,
    });

    if (!result.ok) {
      setBoard(before);
      toast.error(result.error);
      return;
    }

    const saved = result.data!.task;
    setBoard((s) => upsertTaskInState(s, saved));
    if (result.data!.rebalanced) router.refresh();

    if (!original.completed_at && saved.completed_at) {
      const who = saved.assignee?.full_name?.split(" ")[0];
      toast.success(
        who ? `Tarefa concluída! +${xpWithBonus(saved)} XP para ${who}` : "Tarefa concluída! Defina um responsável para ganhar XP.",
      );
    }
    const count = (optimistic.tasksByColumn[placement.columnId] ?? []).length;
    if (placement.columnId !== originalColumn && targetColumn.wip_limit && count > targetColumn.wip_limit) {
      toast.warning(`Limite WIP de “${targetColumn.name}” excedido (${count}/${targetColumn.wip_limit}).`);
    }
  }

  // ---------------------------------------------------------------------------
  // Leitores de tela (pt-BR)
  // ---------------------------------------------------------------------------
  const labelOf = useCallback((id: UniqueIdentifier) => {
    const state = boardRef.current;
    const column = state.columns.find((c) => c.id === id);
    if (column) return `coluna ${column.name}`;
    const task = findTask(state, String(id));
    return task ? `tarefa ${task.title}` : "item";
  }, []);

  /** "na coluna Em Andamento, posição 2 de 5" (ou a posição da coluna no quadro). */
  const positionOf = useCallback((id: UniqueIdentifier) => {
    const state = boardRef.current;
    const columnIndex = state.columns.findIndex((c) => c.id === id);
    if (columnIndex >= 0) return `na posição ${columnIndex + 1} de ${state.columns.length}`;
    const columnId = findTaskColumn(state, String(id));
    if (!columnId) return "";
    const tasks = state.tasksByColumn[columnId];
    const name = state.columns.find((c) => c.id === columnId)?.name ?? "";
    return `na coluna ${name}, posição ${tasks.findIndex((t) => t.id === id) + 1} de ${tasks.length}`;
  }, []);

  const announcements: Announcements = {
    onDragStart: ({ active: a }) => `Você pegou a ${labelOf(a.id)}, ${positionOf(a.id)}.`,
    onDragOver: ({ active: a, over }) =>
      over ? `${labelOf(a.id)} ${positionOf(a.id)}.` : `${labelOf(a.id)} fora de uma área válida.`,
    onDragEnd: ({ active: a, over }) =>
      over ? `${labelOf(a.id)} solta ${positionOf(a.id)}.` : `${labelOf(a.id)} solta.`,
    onDragCancel: ({ active: a }) => `Movimento da ${labelOf(a.id)} cancelado; voltou ${positionOf(a.id)}.`,
  };

  // ---------------------------------------------------------------------------
  // Ações vindas de outros componentes
  // ---------------------------------------------------------------------------
  const openTask = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
    window.history.replaceState(null, "", `?task=${taskId}`);
  }, []);

  const closeTask = useCallback(() => {
    setSelectedTaskId(null);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const handleQuickAdd = useCallback(
    async (columnId: string, title: string) => {
      const result = await createTask({ project_id: data.project.id, title, column_id: columnId });
      if (!result.ok) {
        toast.error(result.error);
        return false;
      }
      setBoard((s) => upsertTaskInState(s, result.data!));
      return true;
    },
    [data.project.id],
  );

  const handleTaskChange = useCallback(
    (task: TaskCard) => {
      if (!task.column_id) {
        setBoard((s) => removeTaskFromState(s, task.id));
        closeTask();
        toast.info("Tarefa movida para o backlog.");
        return;
      }
      setBoard((s) => upsertTaskInState(s, task));
    },
    [closeTask],
  );

  const handleTaskCreated = useCallback((task: TaskCard) => {
    if (task.column_id) setBoard((s) => upsertTaskInState(s, task));
    else toast.info("Tarefa criada no backlog.");
  }, []);

  const handleTaskDeleted = useCallback((taskId: string) => setBoard((s) => removeTaskFromState(s, taskId)), []);

  const handleAttachmentDelta = useCallback((taskId: string, delta: number) => {
    setBoard((s) => {
      const task = findTask(s, taskId);
      return task ? updateTaskInState(s, taskId, { attachment_count: Math.max(0, task.attachment_count + delta) }) : s;
    });
  }, []);

  const handleTagCreated = useCallback((tag: Tag) => setTags((prev) => [...prev, tag]), []);

  function handleColumnSaved(column: BoardColumn, isNew: boolean) {
    setBoard((s) =>
      isNew
        ? { columns: [...s.columns, column], tasksByColumn: { ...s.tasksByColumn, [column.id]: [] } }
        : { ...s, columns: s.columns.map((c) => (c.id === column.id ? column : c)) },
    );
  }

  const selectedTask = selectedTaskId ? findTask(board, selectedTaskId) : null;
  const activeTask = active?.type === "task" ? findTask(board, active.id) : null;
  const activeColumn = active?.type === "column" ? board.columns.find((c) => c.id === active.id) : null;
  const members = data.members;

  return (
    <div className="flex flex-col gap-4">
      <BoardToolbar
        filters={filters}
        onChange={setFilters}
        members={members}
        tags={tags}
        sprints={data.sprints}
        canEdit={canEdit}
        onNewTask={() => setCreateOpen(true)}
        onNewColumn={() => setColumnDialog({ open: true, column: null })}
      />

      <DndContext
        id={`kanban-${data.project.id}`} // id estável: evita divergência de hidratação no aria-describedby
        sensors={sensors}
        collisionDetection={collisionDetection}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={(event) => void handleDragEnd(event)}
        onDragCancel={handleDragCancel}
        accessibility={{ announcements, screenReaderInstructions }}
      >
        <div className="scrollbar-thin -mx-4 flex items-start gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:h-[calc(100dvh-15.5rem)] lg:min-h-[30rem] lg:px-8">
          <SortableContext items={board.columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
            {board.columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={visibleTasks[column.id] ?? []}
                totalCount={board.tasksByColumn[column.id]?.length ?? 0}
                canEdit={canEdit}
                filtered={filtered}
                onOpenTask={openTask}
                onQuickAdd={handleQuickAdd}
                onEdit={(c) => setColumnDialog({ open: true, column: c })}
                onDelete={setColumnToDelete}
              />
            ))}
          </SortableContext>

          {canEdit && (
            <button
              type="button"
              onClick={() => setColumnDialog({ open: true, column: null })}
              className="flex h-14 w-[300px] shrink-0 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-sm font-semibold text-muted-foreground transition hover:border-brand/50 hover:bg-brand-soft/40 hover:text-foreground"
            >
              <Plus className="size-4" /> Adicionar coluna
            </button>
          )}
        </div>

        {mounted &&
          createPortal(
            <DragOverlay dropAnimation={dropAnimation}>
              {activeTask ? (
                <TaskCardView task={activeTask} isOverlay className="w-[284px]" />
              ) : activeColumn ? (
                <ColumnPreview column={activeColumn} tasks={board.tasksByColumn[activeColumn.id] ?? []} />
              ) : null}
            </DragOverlay>,
            document.body,
          )}
      </DndContext>

      <TaskSheet
        task={selectedTask}
        onClose={closeTask}
        project={{ id: data.project.id, name: data.project.name, color: data.project.color }}
        columns={board.columns}
        members={members}
        tags={tags}
        sprints={data.sprints}
        canEdit={canEdit}
        currentUserId={currentUserId}
        onTaskChange={handleTaskChange}
        onTaskDeleted={handleTaskDeleted}
        onAttachmentDelta={handleAttachmentDelta}
        onTagCreated={handleTagCreated}
      />

      {canEdit && createOpen && (
        <CreateTaskDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          projectId={data.project.id}
          columns={board.columns}
          members={members}
          tags={tags}
          sprints={data.sprints}
          onCreated={handleTaskCreated}
          onTagCreated={handleTagCreated}
        />
      )}

      {canEdit && columnDialog.open && (
        <ColumnDialog
          key={columnDialog.column?.id ?? "new"}
          projectId={data.project.id}
          column={columnDialog.column}
          open={columnDialog.open}
          onOpenChange={(open) => setColumnDialog((s) => ({ ...s, open }))}
          onSaved={handleColumnSaved}
        />
      )}

      <DeleteColumnDialog
        key={columnToDelete?.id ?? "none"}
        column={columnToDelete}
        columns={board.columns}
        taskCount={columnToDelete ? (board.tasksByColumn[columnToDelete.id]?.length ?? 0) : 0}
        open={columnToDelete !== null}
        onOpenChange={(open) => !open && setColumnToDelete(null)}
        onDeleted={() => setColumnToDelete(null)}
      />
    </div>
  );
}
