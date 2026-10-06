"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { syncPushSubscription } from "@/lib/push";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";

export type AppNotification = Pick<
  Tables<"notifications">,
  "id" | "type" | "title" | "body" | "url" | "read_at" | "created_at"
>;

const SELECT = "id, type, title, body, url, read_at, created_at";
const PAGE = 30;

type NotificationsContextValue = {
  items: AppNotification[];
  unread: number;
  loaded: boolean;
  open: (notification: AppNotification) => void;
  markAllRead: () => void;
  clearRead: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function useNotifications() {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error("useNotifications precisa do NotificationsProvider.");
  return value;
}

/**
 * Caixa de notificações da pessoa logada: carrega as últimas, escuta novas via
 * Realtime (mostrando um aviso na tela) e mantém o push deste navegador em dia.
 */
export function NotificationsProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState(false);

  const markRead = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: n.read_at ?? now } : n)));
    void createClient().from("notifications").update({ read_at: now }).in("id", ids).is("read_at", null);
  }, []);

  const open = useCallback(
    (notification: AppNotification) => {
      markRead([notification.id]);
      if (notification.url) router.push(notification.url);
    },
    [markRead, router],
  );

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    supabase
      .from("notifications")
      .select(SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(PAGE)
      .then(({ data }) => {
        if (cancelled) return;
        setItems(data ?? []);
        setLoaded(true);
      });

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as AppNotification;
          setItems((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev].slice(0, PAGE)));
          toast(n.title, {
            description: n.body ?? undefined,
            action: n.url ? { label: "Abrir", onClick: () => open(n) } : undefined,
          });
        },
      )
      .subscribe();

    void syncPushSubscription();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [userId, open]);

  // Clique numa notificação push com o app já aberto: o service worker avisa.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "notification-click" && typeof event.data.url === "string") {
        if (event.data.id) markRead([event.data.id]);
        router.push(event.data.url);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [markRead, router]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      items,
      unread: items.filter((n) => !n.read_at).length,
      loaded,
      open,
      markAllRead: () => markRead(items.filter((n) => !n.read_at).map((n) => n.id)),
      clearRead: () => {
        const ids = items.filter((n) => n.read_at).map((n) => n.id);
        if (ids.length === 0) return;
        setItems((prev) => prev.filter((n) => !n.read_at));
        void createClient().from("notifications").delete().in("id", ids);
      },
    }),
    [items, loaded, open, markRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
