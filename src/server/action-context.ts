import "server-only";

import { createClient, type ServerSupabaseClient } from "@/lib/supabase/server";
import type { ActionResult, AppRole, Profile } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

const RANK: Record<AppRole, number> = { viewer: 0, member: 1, admin: 2 };

type Context = { supabase: ServerSupabaseClient; profile: Profile };

/**
 * Contexto das Server Actions: cliente Supabase do usuário + checagem de papel.
 * A RLS no banco continua sendo a barreira definitiva; esta checagem só dá
 * mensagens melhores e evita idas desnecessárias ao banco.
 */
export async function getActionContext(
  minRole: AppRole = "member",
): Promise<{ ok: true; ctx: Context } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { ok: false, error: "Sua sessão expirou. Entre novamente." };

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (!profile) return { ok: false, error: "Perfil não encontrado." };
  if (RANK[profile.role] < RANK[minRole]) {
    return { ok: false, error: "Você não tem permissão para esta ação." };
  }
  return { ok: true, ctx: { supabase, profile } };
}

export function failure(error: unknown, fallback?: string): ActionResult<never> {
  return { ok: false, error: errorMessage(error, fallback) };
}
