"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Escuta alterações de tarefas/colunas do projeto via Supabase Realtime (a RLS
 * filtra o que cada usuário recebe) e chama `onChange` com debounce — usado
 * para recarregar o quadro quando outra pessoa mexe nele.
 */
export function useBoardRealtime(projectId: string, onChange: () => void, delay = 600) {
  const callback = useRef(onChange);

  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => callback.current(), delay);
    };

    const channel = supabase
      .channel(`board:${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `project_id=eq.${projectId}` }, schedule)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "board_columns", filter: `project_id=eq.${projectId}` },
        schedule,
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [projectId, delay]);
}
