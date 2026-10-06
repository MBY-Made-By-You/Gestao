"use client";

import { useEffect, useState, useTransition } from "react";
import { BellOff, BellRing, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { disablePush, enablePush, getCurrentSubscription, getPushSupport, type PushSupport } from "@/lib/push";
import { createClient } from "@/lib/supabase/client";

type DeviceState = "loading" | "on" | "off" | "denied" | Exclude<PushSupport, "supported">;

/** Ligar/desligar o push neste dispositivo e mandar uma notificação de teste. */
export function PushSettings() {
  const [state, setState] = useState<DeviceState>("loading");
  const [pending, startTransition] = useTransition();

  async function refresh() {
    const support = getPushSupport();
    if (support !== "supported") return setState(support);
    if (Notification.permission === "denied") return setState("denied");
    setState((await getCurrentSubscription()) && Notification.permission === "granted" ? "on" : "off");
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- APIs do navegador só existem após montar
    void refresh();
  }, []);

  function enable() {
    startTransition(async () => {
      const result = await enablePush();
      if (!result.ok) toast.error(result.error);
      else toast.success("Notificações ativadas neste dispositivo");
      await refresh();
    });
  }

  function disable() {
    startTransition(async () => {
      await disablePush();
      toast.success("Notificações desativadas neste dispositivo");
      await refresh();
    });
  }

  function test() {
    startTransition(async () => {
      const { error } = await createClient().rpc("send_test_notification");
      if (error) toast.error("Não foi possível enviar o teste.");
    });
  }

  const message: Record<DeviceState, string> = {
    loading: "Verificando…",
    on: "Ativadas neste dispositivo. Você recebe avisos mesmo com o app fechado.",
    off: "Desativadas neste dispositivo. Os avisos aparecem só no sininho do app.",
    denied:
      "Bloqueadas pelo navegador. Libere em Configurações do site (ícone ao lado do endereço) → Notificações → Permitir.",
    "ios-needs-install":
      "No iPhone/iPad, adicione o app à Tela de Início (Compartilhar → Adicionar à Tela de Início) e ative por lá.",
    unsupported: "Este navegador não suporta notificações push. Os avisos aparecem no sininho do app.",
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{message[state]}</p>
      <div className="flex flex-wrap gap-2">
        {state === "off" && (
          <Button size="sm" onClick={enable} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <BellRing />} Ativar neste dispositivo
          </Button>
        )}
        {state === "on" && (
          <Button size="sm" variant="outline" onClick={disable} disabled={pending}>
            <BellOff /> Desativar neste dispositivo
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={test} disabled={pending}>
          <Send /> Enviar notificação de teste
        </Button>
      </div>
    </div>
  );
}
