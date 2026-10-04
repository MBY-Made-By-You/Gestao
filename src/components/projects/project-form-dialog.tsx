"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ColorPicker } from "@/components/shared/color-picker";
import { MoneyInput } from "@/components/shared/money-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PROJECT_STATUS_LABEL } from "@/lib/constants";
import { parseMoney, toMoneyInput } from "@/lib/money";
import type { Project, ProjectStatus } from "@/lib/types";
import { createProject, updateProject } from "@/server/actions/projects";

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [clientName, setClientName] = useState(project?.client_name ?? "");
  const [color, setColor] = useState(project?.color ?? "#0399FB");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "active");
  const [startDate, setStartDate] = useState(project?.start_date ?? "");
  const [dueDate, setDueDate] = useState(project?.due_date ?? "");
  const [budget, setBudget] = useState(toMoneyInput(project?.budget ?? null));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const input = {
      name,
      description: description.trim() || null,
      client_name: clientName.trim() || null,
      color,
      status,
      start_date: startDate || null,
      due_date: dueDate || null,
      budget: budget.trim() ? parseMoney(budget) : null,
    };
    startTransition(async () => {
      const result = project ? await updateProject(project.id, input) : await createProject(input);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(project ? "Projeto atualizado" : "Projeto criado com as colunas padrão do Kanban");
      onOpenChange(false);
      if (!project) router.push(`/projects/${result.data!.id}/board`);
      else router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{project ? "Editar projeto" : "Novo projeto"}</DialogTitle>
            <DialogDescription>
              {project
                ? "Atualize as informações do projeto."
                : "Criamos o quadro com A Fazer, Em Andamento, Revisão e Concluído — personalize depois."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="project-name">Nome</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Protótipo FETIN 2026"
                maxLength={120}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger id="project-status" className="sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {PROJECT_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description">Descrição</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Objetivo, escopo, entregáveis…"
              maxLength={5000}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project-client">Cliente</Label>
              <Input
                id="project-client"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Opcional"
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-budget">Orçamento</Label>
              <MoneyInput id="project-budget" value={budget} onChange={setBudget} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-start">Início</Label>
              <Input id="project-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-due">Entrega</Label>
              <Input id="project-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cor do projeto</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending && <Loader2 className="animate-spin" />}
              {project ? "Salvar" : "Criar projeto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewProjectButton({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>{children ?? "Novo projeto"}</Button>
      {open && <ProjectFormDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}
