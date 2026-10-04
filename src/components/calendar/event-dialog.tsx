"use client";

import { useState, useTransition } from "react";
import { Check, Flag, Loader2, MapPin, Trash2, Users, Video } from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/misc";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EVENT_TYPE_LABEL } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { wallTimeToIso, zonedParts } from "@/lib/timezone";
import type { EventType, MiniProfile } from "@/lib/types";
import { deleteEvent, saveEvent } from "@/server/actions/events";
import type { CalendarEventItem } from "@/server/queries/calendar";

const NONE = "__none__";

export type EventDraft = { date: string; time?: string };

export function EventDialog({
  open,
  onOpenChange,
  event,
  draft,
  projects,
  members,
  canEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEventItem | null;
  draft: EventDraft | null;
  projects: { id: string; name: string; color: string }[];
  members: MiniProfile[];
  canEdit: boolean;
}) {
  const start = event ? zonedParts(event.starts_at) : null;
  const end = event?.ends_at ? zonedParts(event.ends_at) : null;
  const initialTime = draft?.time ?? "09:00";
  const plusOneHour = `${String(Math.min(23, Number(initialTime.slice(0, 2)) + 1)).padStart(2, "0")}:${initialTime.slice(3, 5)}`;

  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(event?.title ?? "");
  const [type, setType] = useState<EventType>(event?.type ?? (draft?.time ? "meeting" : "event"));
  const [projectId, setProjectId] = useState(event?.project_id ?? NONE);
  const [allDay, setAllDay] = useState(event ? event.all_day : !draft?.time);
  const [date, setDate] = useState(start?.ymd ?? draft?.date ?? "");
  const [endDate, setEndDate] = useState(end?.ymd ?? start?.ymd ?? draft?.date ?? "");
  const [startTime, setStartTime] = useState(start?.hm ?? initialTime);
  const [endTime, setEndTime] = useState(end?.hm ?? plusOneHour);
  const [location, setLocation] = useState(event?.location ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [attendees, setAttendees] = useState<string[]>(event?.attendees ?? []);

  const readOnly = !canEdit;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return void toast.error("Escolha a data.");
    const isMilestone = type === "milestone";
    const allDayFinal = allDay || isMilestone;
    const startsAt = wallTimeToIso(date, allDayFinal ? "00:00" : startTime);
    const lastDay = endDate && endDate >= date ? endDate : date;
    const endsAt = allDayFinal
      ? isMilestone
        ? null
        : wallTimeToIso(lastDay, "23:59")
      : wallTimeToIso(date, endTime && endTime > startTime ? endTime : startTime);

    startTransition(async () => {
      const result = await saveEvent(event?.id ?? null, {
        title,
        description: description.trim() || null,
        type,
        project_id: projectId === NONE ? null : projectId,
        starts_at: startsAt,
        ends_at: endsAt,
        all_day: allDayFinal,
        location: location.trim() || null,
        attendee_ids: attendees,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(event ? "Evento atualizado" : `${EVENT_TYPE_LABEL[type]} criado(a)`);
      onOpenChange(false);
    });
  }

  function remove() {
    if (!event) return;
    startTransition(async () => {
      const result = await deleteEvent(event.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Evento excluído");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{event ? (readOnly ? event.title : "Editar evento") : "Novo evento"}</DialogTitle>
            <DialogDescription>
              {event
                ? `${EVENT_TYPE_LABEL[event.type]} · ${formatDateTime(event.starts_at)}`
                : "Eventos, reuniões e marcos de entrega aparecem no calendário junto com os prazos das tarefas."}
            </DialogDescription>
          </DialogHeader>

          <ToggleGroup
            type="single"
            value={type}
            onValueChange={(v) => v && setType(v as EventType)}
            className="w-full"
            disabled={readOnly}
            aria-label="Tipo"
          >
            <ToggleGroupItem value="meeting" className="flex-1">
              <Video /> Reunião
            </ToggleGroupItem>
            <ToggleGroupItem value="event" className="flex-1">
              <Users /> Evento
            </ToggleGroupItem>
            <ToggleGroupItem value="milestone" className="flex-1">
              <Flag /> Marco
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="space-y-2">
            <Label htmlFor="event-title">Título</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type === "milestone" ? "Ex.: Entrega do MVP" : "Ex.: Daily da equipe"}
              maxLength={160}
              required
              disabled={readOnly}
              autoFocus={!event}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-project">Projeto</Label>
            <Select value={projectId} onValueChange={setProjectId} disabled={readOnly}>
              <SelectTrigger id="event-project">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Geral da equipe</SelectItem>
                <SelectSeparator />
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {type !== "milestone" && (
            <label className="flex items-center justify-between gap-3 text-sm font-semibold">
              Dia inteiro
              <Switch checked={allDay} onCheckedChange={setAllDay} disabled={readOnly} />
            </label>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="event-date">{allDay && type !== "milestone" ? "Início" : "Data"}</Label>
              <Input id="event-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required disabled={readOnly} />
            </div>
            {type !== "milestone" &&
              (allDay ? (
                <div className="space-y-2">
                  <Label htmlFor="event-end-date">Fim</Label>
                  <Input
                    id="event-end-date"
                    type="date"
                    value={endDate}
                    min={date}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={readOnly}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="event-start-time">Das</Label>
                    <Input id="event-start-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={readOnly} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event-end-time">Até</Label>
                    <Input id="event-end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={readOnly} />
                  </div>
                </div>
              ))}
          </div>

          {type !== "milestone" && (
            <div className="space-y-2">
              <Label htmlFor="event-location">Local ou link</Label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="event-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Sala, endereço ou link do Meet/Zoom"
                  maxLength={300}
                  className="pl-9"
                  disabled={readOnly}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Participantes</Label>
            <AttendeePicker members={members} value={attendees} onChange={setAttendees} disabled={readOnly} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-description">Descrição</Label>
            <Textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Pauta, links, observações…"
              maxLength={5000}
              className="min-h-20"
              disabled={readOnly}
            />
          </div>

          {canEdit && (
            <DialogFooter className="sm:justify-between">
              {event ? (
                <Button type="button" variant="ghost" className="text-destructive" onClick={remove} disabled={pending}>
                  <Trash2 /> Excluir
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending || !title.trim()}>
                  {pending && <Loader2 className="animate-spin" />}
                  Salvar
                </Button>
              </div>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AttendeePicker({
  members,
  value,
  onChange,
  disabled,
}: {
  members: MiniProfile[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const selected = members.filter((m) => value.includes(m.id));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selected.map((m) => (
        <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-muted py-0.5 pr-2.5 pl-0.5 text-xs font-semibold">
          <UserAvatar name={m.full_name} src={m.avatar_url} className="size-5" />
          {m.full_name.split(" ")[0]}
        </span>
      ))}
      {!disabled && (
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-7 border-dashed">
              <Users /> {selected.length ? "Editar" : "Convidar pessoas"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar pessoa…" />
              <CommandList>
                <CommandEmpty>Ninguém encontrado.</CommandEmpty>
                <CommandGroup>
                  {members.map((m) => {
                    const checked = value.includes(m.id);
                    return (
                      <CommandItem
                        key={m.id}
                        value={m.full_name || m.id}
                        onSelect={() => onChange(checked ? value.filter((id) => id !== m.id) : [...value, m.id])}
                      >
                        <UserAvatar name={m.full_name} src={m.avatar_url} className="size-5" />
                        <span className="flex-1 truncate">{m.full_name || "Sem nome"}</span>
                        {checked && <Check className="text-brand" />}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
      {disabled && selected.length === 0 && <span className="text-sm text-muted-foreground">Nenhum</span>}
    </div>
  );
}
