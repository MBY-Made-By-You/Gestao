import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { EventType } from "@/lib/types";

export type MinutesListItem = {
  event_id: string;
  summary: string | null;
  decisions: string | null;
  learnings: string | null;
  next_steps: string | null;
  updated_at: string;
  editor: { full_name: string } | null;
  event: {
    id: string;
    title: string;
    type: EventType;
    starts_at: string;
    all_day: boolean;
    project: { id: string; name: string; color: string } | null;
  };
};

/** Atas visíveis para quem consulta (RLS), da reunião mais recente para a mais antiga. */
export async function listMinutes({ query, projectId }: { query?: string; projectId?: string }) {
  const supabase = await createClient();
  let request = supabase
    .from("event_minutes")
    .select(
      "event_id, summary, decisions, learnings, next_steps, updated_at, editor:profiles!event_minutes_updated_by_fkey(full_name), event:events!inner(id, title, type, starts_at, all_day, project_id, project:projects(id, name, color))",
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  // Vírgulas e parênteses têm significado no filtro do PostgREST.
  const term = query?.replace(/[,()%*\\]/g, " ").trim();
  if (term) {
    const like = `%${term}%`;
    request = request.or(
      `summary.ilike.${like},decisions.ilike.${like},learnings.ilike.${like},next_steps.ilike.${like}`,
    );
  }
  if (projectId === "general") request = request.is("event.project_id", null);
  else if (projectId) request = request.eq("event.project_id", projectId);

  const [{ data, error }, projectsRes] = await Promise.all([
    request,
    supabase.from("projects").select("id, name, color").order("name"),
  ]);
  if (error) throw error;

  const items = (data ?? []) as unknown as MinutesListItem[];
  items.sort((a, b) => b.event.starts_at.localeCompare(a.event.starts_at));
  return { items, projects: projectsRes.data ?? [] };
}
