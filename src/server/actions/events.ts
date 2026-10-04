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
