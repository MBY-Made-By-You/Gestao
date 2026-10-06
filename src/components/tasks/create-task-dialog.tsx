"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  AssigneesPicker,
  ColumnSelect,
  PointsSelect,
  PrioritySelect,
  SprintSelect,
} from "@/components/tasks/task-fields";
import { TagPicker } from "@/components/tasks/tag-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PRIORITY_XP_WEIGHT } from "@/lib/constants";
import type { BoardColumn, MiniProfile, Sprint, Tag, TaskCard, TaskPriority } from "@/lib/types";
import { createTask } from "@/server/actions/board";

export function CreateTaskDialog({
  open,
  onOpenChange,
  projectId,
  columns,
  members,
  tags,
  sprints,
  defaultColumnId,
  onCreated,
  onTagCreated,
  onTagUpdated,
  onTagDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  columns: BoardColumn[];
  members: MiniProfile[];
  tags: Tag[];
  sprints: Sprint[];
  /** undefined = primeira coluna; null = backlog */
  defaultColumnId?: string | null;
  onCreated: (task: TaskCard) => void;
  onTagCreated: (tag: Tag) => void;
  onTagUpdated: (tag: Tag) => void;
  onTagDeleted: (tagId: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [columnId, setColumnId] = useState<string | null>(
    defaultColumnId === undefined ? (columns[0]?.id ?? null) : defaultColumnId,
  );
  const [assignees, setAssignees] = useState<MiniProfile[]>([]);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [points, setPoints] = useState(1);
  const [sprintId, setSprintId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createTask({
        project_id: projectId,
        title,
        description: description.trim() || null,
        column_id: columnId,
        assignee_ids: assignees.map((p) => p.id),
        priority,
        due_date: dueDate || null,
        story_points: points,
        sprint_id: sprintId,
        tag_ids: tagIds,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Tarefa criada");
      onCreated(result.data!);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Nova tarefa</DialogTitle>
            <DialogDescription>
              Vale {points * PRIORITY_XP_WEIGHT[priority]} XP para cada responsável ao concluir (+50% se no prazo).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="new-task-title">Título</Label>
            <Input
              id="new-task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Testar sensor de umidade"
              maxLength={200}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-task-description">Descrição</Label>
            <Textarea
              id="new-task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes, critérios de aceite…"
              maxLength={10000}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-task-column">Status</Label>
              <ColumnSelect id="new-task-column" columns={columns} value={columnId} onChange={setColumnId} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-task-priority">Prioridade</Label>
              <PrioritySelect id="new-task-priority" value={priority} onChange={setPriority} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-task-due">Prazo</Label>
              <Input id="new-task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-task-points">Estimativa</Label>
              <PointsSelect id="new-task-points" value={points} onChange={setPoints} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-task-sprint">Sprint</Label>
              <SprintSelect id="new-task-sprint" sprints={sprints} value={sprintId} onChange={setSprintId} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-task-assignees">Responsáveis</Label>
            <AssigneesPicker id="new-task-assignees" members={members} value={assignees} onChange={setAssignees} />
          </div>

          <div className="space-y-2">
            <Label>Etiquetas</Label>
            <TagPicker
              projectId={projectId}
              tags={tags}
              selectedIds={tagIds}
              onChange={setTagIds}
              onTagCreated={onTagCreated}
              onTagUpdated={onTagUpdated}
              onTagDeleted={(tagId) => {
                setTagIds((prev) => prev.filter((id) => id !== tagId));
                onTagDeleted(tagId);
              }}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !title.trim()}>
              {pending && <Loader2 className="animate-spin" />}
              Criar tarefa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
