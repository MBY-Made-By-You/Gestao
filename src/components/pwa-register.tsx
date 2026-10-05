"use client";

import { useEffect } from "react";

/** Registra o service worker (só em produção, para não atrapalhar o hot reload). */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Sem service worker o app continua funcionando normalmente.
    });
  }, []);
  return null;
}
