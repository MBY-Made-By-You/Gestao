"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/types";
import { failure, getActionContext } from "@/server/action-context";

const uuid = z.uuid();

const eventSchema = z
  .object({
    title: z.string().trim().min(1, "Dê um título ao evento.").max(160),
    description: z.string().trim().max(5000).nullable(),
    type: z.enum(["event", "meeting", "milestone"]),
    project_id: uuid.nullable(),
    starts_at: z.iso.datetime({ offset: true, error: "Início inválido." }),
    ends_at: z.iso.datetime({ offset: true, error: "Fim inválido." }).nullable(),
    all_day: z.boolean(),
    location: z.string().trim().max(300).nullable(),
    attendee_ids: z.array(uuid).max(100),
  })
  .refine((e) => !e.ends_at || e.ends_at >= e.starts_at, { message: "O fim não pode ser antes do início." });

export type EventInput = z.input<typeof eventSchema>;

export async function saveEvent(id: string | null, input: EventInput): Promise<ActionResult> {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (id && !uuid.safeParse(id).success) return { ok: false, error: "Evento inválido." };
  const context = await getActionContext("member");
  if (!context.ok) return context;
  const { supabase } = context.ctx;
  const { attendee_ids, ...event } = parsed.data;

  try {
    let eventId = id;
    if (id) {
      const { error } = await supabase.from("events").update(event).eq("id", id);
      if (error) throw error;
      const { error: delError } = await supabase.from("event_attendees").delete().eq("event_id", id);
      if (delError) throw delError;
    } else {
      const { data, error } = await supabase.from("events").insert(event).select("id").single();
      if (error) throw error;
      eventId = data.id;
    }
    if (attendee_ids.length && eventId) {
      const { error } = await supabase
        .from("event_attendees")
        .insert(attendee_ids.map((user_id) => ({ event_id: eventId!, user_id })));
      if (error) throw error;
    }
    refresh();
    return { ok: true };
  } catch (error) {
    return failure(error, "Não foi possível salvar o evento.");
  }
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Evento inválido." };
  const context = await getActionContext("member");
  if (!context.ok) return context;
  const { error } = await context.ctx.supabase.from("events").delete().eq("id", id);
  if (error) return failure(error, "Não foi possível excluir o evento.");
  refresh();
  return { ok: true };
}

const minutesSchema = z.object({
  summary: z.string().trim().max(20000, "O resumo está longo demais."),
  decisions: z.string().trim().max(10000, "As decisões estão longas demais."),
  learnings: z.string().trim().max(10000, "Os aprendizados estão longos demais."),
  next_steps: z.string().trim().max(10000, "Os próximos passos estão longos demais."),
});

export type EventMinutesInput = z.input<typeof minutesSchema>;

/** Salva a ata do evento (cria ou atualiza). Ata toda em branco é removida. */
export async function saveEventMinutes(eventId: string, input: EventMinutesInput): Promise<ActionResult> {
  if (!uuid.safeParse(eventId).success) return { ok: false, error: "Evento inválido." };
  const parsed = minutesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const context = await getActionContext("member");
  if (!context.ok) return context;
  const { supabase } = context.ctx;
  const values = Object.fromEntries(Object.entries(parsed.data).map(([k, v]) => [k, v || null])) as {
    [K in keyof typeof parsed.data]: string | null;
  };

  try {
    if (Object.values(values).every((v) => v === null)) {
      const { error } = await supabase.from("event_minutes").delete().eq("event_id", eventId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("event_minutes").upsert({ event_id: eventId, ...values });
      if (error) throw error;
    }
    refresh();
    return { ok: true };
  } catch (error) {
    return failure(error, "Não foi possível salvar a ata.");
  }
}
