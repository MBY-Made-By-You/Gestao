"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ColorPicker } from "@/components/shared/color-picker";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/misc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BoardColumn } from "@/lib/types";
import { createColumn, deleteColumn, updateColumn } from "@/server/actions/board";

export function ColumnDialog({
  projectId,
  column,
  open,
  onOpenChange,
  onSaved,
}: {
  projectId: string;
  /** null = nova coluna */
  column: BoardColumn | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (column: BoardColumn, isNew: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(column?.name ?? "");
  const [color, setColor] = useState(column?.color ?? "#0399FB");
  const [wip, setWip] = useState(column?.wip_limit ? String(column.wip_limit) : "");
  const [isDone, setIsDone] = useState(column?.is_done ?? false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const fields = {
      name,
      color,
      wip_limit: wip ? Number(wip) : null,
      is_done: isDone,
    };
    startTransition(async () => {
      const result = column ? await updateColumn(column.id, fields) : await createColumn(projectId, fields);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onSaved(result.data!, !column);
      toast.success(column ? "Coluna atualizada" : "Coluna criada");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{column ? "Editar coluna" : "Nova coluna"}</DialogTitle>
            <DialogDescription>Personalize o fluxo do quadro deste projeto.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="column-name">Nome</Label>
            <Input
              id="column-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Em testes"
              maxLength={60}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Cor</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="column-wip">Limite WIP (opcional)</Label>
            <Input
              id="column-wip"
              type="number"
              min={1}
              max={999}
              inputMode="numeric"
              value={wip}
              onChange={(e) => setWip(e.target.value)}
              placeholder="Sem limite"
            />
            <p className="text-xs text-muted-foreground">
              Máximo de tarefas simultâneas — o contador fica vermelho quando é ultrapassado.
            </p>
          </div>
          <label className="flex items-start justify-between gap-4 rounded-xl border p-3">
            <span className="space-y-0.5">
              <span className="block text-sm font-semibold">Coluna de conclusão</span>
              <span className="block text-xs text-muted-foreground">
                Tarefas aqui contam como concluídas e geram XP para o responsável.
              </span>
            </span>
            <Switch checked={isDone} onCheckedChange={setIsDone} />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending && <Loader2 className="animate-spin" />}
              {column ? "Salvar" : "Criar coluna"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteColumnDialog({
  column,
  columns,
  taskCount,
  open,
  onOpenChange,
  onDeleted,
}: {
  column: BoardColumn | null;
  columns: BoardColumn[];
  taskCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (columnId: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const others = columns.filter((c) => c.id !== column?.id);
  const [target, setTarget] = useState<string>("backlog");

  if (!column) return null;

  function confirm() {
    if (!column) return;
    startTransition(async () => {
      const result = await deleteColumn(column.id, target === "backlog" ? null : target);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onDeleted(column.id);
      toast.success(`Coluna "${column.name}" excluída`);
      onOpenChange(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir a coluna “{column.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {taskCount > 0
              ? `Ela tem ${taskCount} tarefa(s). Escolha para onde elas vão:`
              : "A coluna está vazia e será removida do quadro."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {taskCount > 0 && (
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="backlog">Backlog (fora do quadro)</SelectItem>
              {others.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  Coluna “{c.name}”
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Excluir coluna
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
