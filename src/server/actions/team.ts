"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { refresh, revalidatePath } from "next/cache";
import { z } from "zod";

import type { Database } from "@/lib/supabase/database.types";
import { SUPABASE_URL } from "@/lib/supabase/env";
import type { ActionResult, AppRole } from "@/lib/types";
import { failure, getActionContext } from "@/server/action-context";

const uuid = z.uuid();

/** Altera o papel de um usuário (somente admin; o banco também valida). */
export async function updateMemberRole(userId: string, role: AppRole): Promise<ActionResult> {
  const parsed = z.object({ userId: uuid, role: z.enum(["admin", "member", "viewer"]) }).safeParse({ userId, role });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  const context = await getActionContext("admin");
  if (!context.ok) return context;

  const { error } = await context.ctx.supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return failure(error, "Não foi possível alterar o papel.");
  refresh();
  return { ok: true };
}

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome.").max(120),
  job_title: z.string().trim().max(80).nullable(),
  avatar_url: z.url().max(1000).nullable().optional(),
});

export async function updateOwnProfile(input: z.input<typeof profileSchema>): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const context = await getActionContext("viewer");
  if (!context.ok) return context;
  const { supabase, profile } = context.ctx;

  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", profile.id);
  if (error) return failure(error, "Não foi possível salvar o perfil.");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function isInviteAvailable(): Promise<boolean> {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Convite por e-mail (opcional): requer SUPABASE_SERVICE_ROLE_KEY no servidor.
 * O convidado define a senha ao abrir o link (/auth/callback → /settings).
 */
export async function inviteMember(email: string, fullName: string, role: AppRole): Promise<ActionResult> {
  const parsed = z
    .object({ email: z.email("E-mail inválido."), fullName: z.string().trim().max(120), role: z.enum(["admin", "member", "viewer"]) })
    .safeParse({ email, fullName, role });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const context = await getActionContext("admin");
  if (!context.ok) return context;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return { ok: false, error: "Convites por e-mail exigem SUPABASE_SERVICE_ROLE_KEY no servidor." };
  }

  const admin = createAdminClient<Database>(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "http://localhost:3000";
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { full_name: parsed.data.fullName },
    redirectTo: `${origin}/auth/callback`,
  });
  if (error) return failure(error, "Não foi possível enviar o convite.");

  if (data.user && parsed.data.role !== "viewer") {
    await admin.from("profiles").update({ role: parsed.data.role }).eq("id", data.user.id);
  }
  refresh();
  return { ok: true, message: `Convite enviado para ${parsed.data.email}.` };
}
