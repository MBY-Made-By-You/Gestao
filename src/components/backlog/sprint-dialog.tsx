"use client";

import { useState, useTransition } from "react";
import { addDays, format } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Sprint } from "@/lib/types";
import { saveSprint } from "@/server/actions/projects";

export function SprintDialog({
  projectId,
  sprint,
  open,
  onOpenChange,
  suggestedName,
}: {
  projectId: string;
  sprint: Sprint | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestedName: string;
}) {
  const [pending, startTransition] = useTransition();
  const today = new Date();
  const [name, setName] = useState(sprint?.name ?? suggestedName);
  const [goal, setGoal] = useState(sprint?.goal ?? "");
  const [startDate, setStartDate] = useState(sprint?.start_date ?? format(today, "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(sprint?.end_date ?? format(addDays(today, 13), "yyyy-MM-dd"));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveSprint(projectId, sprint?.id ?? null, {
        name,
        goal: goal.trim() || null,
        start_date: startDate,
        end_date: endDate,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(sprint ? "Sprint atualizada" : "Sprint criada");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{sprint ? "Editar sprint" : "Nova sprint"}</DialogTitle>
            <DialogDescription>Planeje um ciclo curto (1–4 semanas) com um objetivo claro.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="sprint-name">Nome</Label>
            <Input id="sprint-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sprint-goal">Objetivo</Label>
            <Textarea
              id="sprint-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Ex.: protótipo funcional do sensor para a banca"
              maxLength={500}
              className="min-h-16"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sprint-start">Início</Label>
              <Input id="sprint-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sprint-end">Fim</Label>
              <Input id="sprint-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending && <Loader2 className="animate-spin" />}
              {sprint ? "Salvar" : "Criar sprint"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
