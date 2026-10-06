"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { ColorPicker } from "@/components/shared/color-picker";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COLOR_SWATCHES } from "@/lib/constants";
import type { Tag } from "@/lib/types";
import { createTag, deleteTag, updateTag } from "@/server/actions/board";

export function TagChip({ tag, className }: { tag: Pick<Tag, "name" | "color">; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold ${className ?? ""}`}
      style={{ backgroundColor: `${tag.color}1f`, color: tag.color }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
      {tag.name}
    </span>
  );
}

/**
 * Seleção múltipla de etiquetas com busca e criação inline. Clicar numa
 * etiqueta aplicada a remove da tarefa; o lápis na lista edita nome e cor
 * (vale para todas as tarefas do projeto).
 */
export function TagPicker({
  projectId,
  tags,
  selectedIds,
  onChange,
  onTagCreated,
  onTagUpdated,
  onTagDeleted,
  disabled,
}: {
  projectId: string;
  tags: Tag[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onTagCreated: (tag: Tag) => void;
  onTagUpdated: (tag: Tag) => void;
  onTagDeleted: (tagId: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Tag | null>(null);
  const [pending, startTransition] = useTransition();
  const selected = new Set(selectedIds);
  const selectedTags = tags.filter((t) => selected.has(t.id));
  const trimmed = search.trim();
  const exists = tags.some((t) => t.name.toLocaleLowerCase("pt-BR") === trimmed.toLocaleLowerCase("pt-BR"));

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }

  function create() {
    if (!trimmed) return;
    const color = COLOR_SWATCHES[tags.length % COLOR_SWATCHES.length];
    startTransition(async () => {
      const result = await createTag(projectId, trimmed, color);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onTagCreated(result.data!);
      onChange([...selected, result.data!.id]);
      setSearch("");
    });
  }

  function startEditing(tag: Tag) {
    setOpen(false);
    setEditing(tag);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selectedTags.map((tag) =>
        disabled ? (
          <TagChip key={tag.id} tag={tag} />
        ) : (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggle(tag.id)}
            title="Clique para remover da tarefa"
            aria-label={`Remover etiqueta ${tag.name}`}
            className="group inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            style={{ backgroundColor: `${tag.color}1f`, color: tag.color }}
          >
            <span className="size-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
            {tag.name}
            <X className="-mr-0.5 size-3 opacity-50 transition group-hover:opacity-100" />
          </button>
        ),
      )}
      {!disabled && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-7 border-dashed">
              <Tags /> {selectedTags.length ? "Editar" : "Adicionar etiqueta"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar ou criar…" value={search} onValueChange={setSearch} />
              <CommandList>
                <CommandEmpty>{trimmed ? "Nenhuma etiqueta encontrada." : "Nenhuma etiqueta ainda."}</CommandEmpty>
                {tags.length > 0 && (
                  <CommandGroup heading="Etiquetas do projeto">
                    {tags.map((tag) => (
                      <CommandItem key={tag.id} value={`${tag.name} ${tag.id}`} onSelect={() => toggle(tag.id)}>
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                        <span className="flex-1 truncate">{tag.name}</span>
                        {selected.has(tag.id) && <Check className="text-brand" />}
                        <button
                          type="button"
                          aria-label={`Editar etiqueta ${tag.name}`}
                          title="Editar nome e cor"
                          className="-my-1 -mr-1 grid size-6 place-items-center rounded-md text-muted-foreground transition hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(tag);
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {trimmed && !exists && (
                  <CommandGroup>
                    <CommandItem value={`__create__${trimmed}`} onSelect={create} disabled={pending}>
                      <Plus /> Criar etiqueta “{trimmed}”
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
      {disabled && selectedTags.length === 0 && <span className="text-sm text-muted-foreground">Nenhuma</span>}

      {editing && (
        <TagEditDialog
          key={editing.id}
          tag={editing}
          onClose={() => setEditing(null)}
          onSaved={(tag) => {
            onTagUpdated(tag);
            setEditing(null);
          }}
          onDeleted={(tagId) => {
            onTagDeleted(tagId);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function TagEditDialog({
  tag,
  onClose,
  onSaved,
  onDeleted,
}: {
  tag: Tag;
  onClose: () => void;
  onSaved: (tag: Tag) => void;
  onDeleted: (tagId: string) => void;
}) {
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const trimmed = name.trim();
  const changed = trimmed !== tag.name || color.toLowerCase() !== tag.color.toLowerCase();

  function save(event: React.FormEvent) {
    // O diálogo pode estar dentro de outro formulário (criação de tarefa).
    event.preventDefault();
    event.stopPropagation();
    if (!trimmed || !changed) return;
    startTransition(async () => {
      const result = await updateTag(tag.id, trimmed, color);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Etiqueta atualizada");
      onSaved(result.data!);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteTag(tag.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Etiqueta excluída");
      onDeleted(tag.id);
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={save} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Editar etiqueta</DialogTitle>
            <DialogDescription>A mudança vale para todas as tarefas com esta etiqueta.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="tag-name">Nome</Label>
            <Input id="tag-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Cor</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            Prévia: <TagChip tag={{ name: trimmed || "Etiqueta", color }} />
          </div>
          <DialogFooter className="sm:justify-between">
            {confirmDelete ? (
              <Button type="button" variant="destructive" onClick={remove} disabled={pending}>
                <Trash2 /> Excluir de todas as tarefas
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={pending}
              >
                <Trash2 /> Excluir etiqueta
              </Button>
            )}
            <Button type="submit" disabled={pending || !trimmed || !changed}>
              {pending && <Loader2 className="animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
