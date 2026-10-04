import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { SessionProfile } from "@/lib/types";

/**
 * Usuário logado + perfil (papel). Memoizado por requisição com React.cache,
 * então layouts e páginas podem chamar à vontade sem consultas duplicadas.
 */
export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (!profile) return null;

  return {
    ...profile,
    isAdmin: profile.role === "admin",
    isStaff: profile.role === "admin" || profile.role === "member",
  };
});

export async function requireProfile(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  return profile;
}

/** Admin ou membro (equipe interna). Visualizadores voltam ao dashboard. */
export async function requireStaff(): Promise<SessionProfile> {
  const profile = await requireProfile();
  if (!profile.isStaff) redirect("/dashboard");
  return profile;
}
