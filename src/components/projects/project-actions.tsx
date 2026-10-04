"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Trash2, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_LABEL } from "@/lib/constants";
import type { AppRole, MiniProfile, Project } from "@/lib/types";
import { addProjectMember, deleteProject, removeProjectMember } from "@/server/actions/projects";

export function ProjectAdminButtons({ project, canDelete }: { project: Project; canDelete: boolean }) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
        <Pencil /> Editar
      </Button>
      {canDelete && (
        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmDelete(true)}>
          <Trash2 /> Excluir
        </Button>
      )}
      {editOpen && <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} project={project} />}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{project.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as tarefas, colunas, sprints, etiquetas, imagens e eventos do projeto serão apagados. Lançamentos
              financeiros vinculados viram custos gerais. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteProject(project.id);
                  if (result && !result.ok) toast.error(result.error);
                })
              }
            >
              {pending && <Loader2 className="animate-spin" />}
              Excluir projeto
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function ProjectMembers({
  projectId,
  members,
  allProfiles,
  canManage,
}: {
  projectId: string;
  members: (MiniProfile & { role: AppRole; email: string | null })[];
  allProfiles: (MiniProfile & { role: AppRole })[];
  canManage: boolean;
}) {
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();
  const memberIds = new Set(members.map((m) => m.id));
  const candidates = allProfiles.filter((p) => !memberIds.has(p.id));

  function add() {
    if (!selected) return;
    startTransition(async () => {
      const result = await addProjectMember(projectId, selected);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Membro adicionado ao projeto");
        setSelected("");
      }
    });
  }

  function remove(userId: string) {
    startTransition(async () => {
      const result = await removeProjectMember(projectId, userId);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3">
            <UserAvatar name={m.full_name} src={m.avatar_url} className="size-8" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{m.full_name || "Sem nome"}</p>
              <p className="truncate text-xs text-muted-foreground">{m.email}</p>
            </div>
            <Badge variant={m.role === "viewer" ? "outline" : "muted"}>
              {m.role === "viewer" ? "Cliente" : ROLE_LABEL[m.role]}
            </Badge>
            {canManage && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(m.id)}
                disabled={pending}
                aria-label={`Remover ${m.full_name} do projeto`}
              >
                <UserMinus />
              </Button>
            )}
          </li>
        ))}
        {members.length === 0 && <li className="text-sm text-muted-foreground">Ninguém vinculado ainda.</li>}
      </ul>
      {canManage && candidates.length > 0 && (
        <div className="flex gap-2">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger size="sm" aria-label="Escolher pessoa">
              <SelectValue placeholder="Adicionar pessoa ou cliente…" />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <UserAvatar name={p.full_name} src={p.avatar_url} className="size-5" />
                  {p.full_name || "Sem nome"} · {p.role === "viewer" ? "Cliente" : ROLE_LABEL[p.role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={add} disabled={!selected || pending}>
            {pending ? <Loader2 className="animate-spin" /> : <UserPlus />}
            Adicionar
          </Button>
        </div>
      )}
      {canManage && (
        <p className="text-xs text-muted-foreground">
          Visualizadores (clientes) só enxergam os projetos em que estão vinculados aqui.
        </p>
      )}
    </div>
  );
}
