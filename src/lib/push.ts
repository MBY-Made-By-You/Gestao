"use client";

import { createClient } from "@/lib/supabase/client";

/** Chave pública VAPID (pode ficar no navegador). */
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushSupport =
  | "supported"
  /** iPhone/iPad no Safari: push só funciona com o app instalado na Tela de Início. */
  | "ios-needs-install"
  | "unsupported";

export function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function getPushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const isIos =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const hasApis = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (isIos && !isStandalone()) return "ios-needs-install";
  if (!hasApis || !VAPID_PUBLIC_KEY) return "unsupported";
  return "supported";
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function getRegistration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  return (
    existing ??
    navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    })
  );
}

export async function getCurrentSubscription() {
  if (getPushSupport() !== "supported") return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

async function saveSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON();
  const { error } = await createClient().rpc("save_push_subscription", {
    p_endpoint: subscription.endpoint,
    p_p256dh: json.keys?.p256dh ?? "",
    p_auth: json.keys?.auth ?? "",
    p_user_agent: navigator.userAgent,
  });
  if (error) throw error;
}

/**
 * Pede permissão (se preciso), inscreve este navegador no Web Push e salva a
 * inscrição para a pessoa logada. Deve ser chamado a partir de um clique.
 */
export async function enablePush(): Promise<{ ok: true } | { ok: false; error: string }> {
  const support = getPushSupport();
  if (support === "ios-needs-install") {
    return {
      ok: false,
      error: "No iPhone, adicione o app à Tela de Início e ative por lá.",
    };
  }
  if (support !== "supported") return { ok: false, error: "Este navegador não suporta notificações." };

  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      ok: false,
      error:
        permission === "denied"
          ? "As notificações estão bloqueadas. Libere nas configurações do site no navegador."
          : "Permissão não concedida.",
    };
  }

  try {
    const registration = await getRegistration();
    await navigator.serviceWorker.ready;
    const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    let subscription = await registration.pushManager.getSubscription();
    // Inscrição feita com outra chave (ex.: chave trocada) → refaz.
    const current = subscription?.options.applicationServerKey;
    if (subscription && current && new Uint8Array(current).toString() !== key.toString()) {
      await subscription.unsubscribe();
      subscription = null;
    }
    subscription ??= await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    });
    await saveSubscription(subscription);
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Não foi possível ativar as notificações neste dispositivo.",
    };
  }
}

/** Mantém a inscrição deste navegador ligada à pessoa logada (sem pedir nada). */
export async function syncPushSubscription() {
  if (getPushSupport() !== "supported" || Notification.permission !== "granted") return;
  const subscription = await getCurrentSubscription();
  if (subscription) await saveSubscription(subscription).catch(() => {});
  else await enablePush();
}

export async function disablePush() {
  const subscription = await getCurrentSubscription();
  if (!subscription) return;
  await createClient().from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
  await subscription.unsubscribe();
}
