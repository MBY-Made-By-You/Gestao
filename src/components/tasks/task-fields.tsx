"use client";

import { useState, useTransition } from "react";
import { Check, Plus, Tags } from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COLOR_SWATCHES, PRIORITY_LABEL, PRIORITY_STYLE, STORY_POINT_OPTIONS } from "@/lib/constants";
import type { BoardColumn, MiniProfile, Sprint, Tag, TaskPriority } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createTag } from "@/server/actions/board";

const NONE = "__none__";

export function AssigneeSelect({
  members,
  value,
  onChange,
  disabled,
  id,
}: {
  members: MiniProfile[];
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>
          <span className="grid size-5 place-items-center rounded-full border border-dashed text-[10px]">?</span>
          Sem responsável
        </SelectItem>
        <SelectSeparator />
        {members.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            <UserAvatar name={m.full_name} src={m.avatar_url} className="size-5" />
            {m.full_name || "Sem nome"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PrioritySelect({
  value,
  onChange,
  disabled,
  id,
}: {
  value: TaskPriority;
  onChange: (value: TaskPriority) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TaskPriority)} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((p) => (
          <SelectItem key={p} value={p}>
            <span className={cn("size-2 rounded-full", PRIORITY_STYLE[p].dot)} />
            {PRIORITY_LABEL[p]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PointsSelect({
  value,
  onChange,
  disabled,
  id,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STORY_POINT_OPTIONS.map((p) => (
          <SelectItem key={p} value={String(p)}>
            {p} {p === 1 ? "ponto" : "pontos"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ColumnSelect({
  columns,
  value,
  onChange,
  disabled,
  allowBacklog = true,
  id,
}: {
  columns: BoardColumn[];
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  allowBacklog?: boolean;
  id?: string;
}) {
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allowBacklog && <SelectItem value={NONE}>Backlog (fora do quadro)</SelectItem>}
        {columns.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SprintSelect({
  sprints,
  value,
  onChange,
  disabled,
  id,
}: {
  sprints: Sprint[];
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  id?: string;
}) {
  const options = sprints.filter((s) => s.status !== "completed" || s.id === value);
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Sem sprint</SelectItem>
        {options.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
            {s.status === "active" ? " · ativa" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Seleção múltipla de etiquetas com busca e criação inline. */
export function TagPicker({
  projectId,
  tags,
  selectedIds,
  onChange,
  onTagCreated,
  disabled,
}: {
  projectId: string;
  tags: Tag[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onTagCreated: (tag: Tag) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
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

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selectedTags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold"
          style={{ backgroundColor: `${tag.color}1f`, color: tag.color }}
        >
          <span className="size-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
          {tag.name}
        </span>
      ))}
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
                      <CommandItem key={tag.id} value={tag.name} onSelect={() => toggle(tag.id)}>
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                        <span className="flex-1 truncate">{tag.name}</span>
                        {selected.has(tag.id) && <Check className="text-brand" />}
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
    </div>
  );
}
