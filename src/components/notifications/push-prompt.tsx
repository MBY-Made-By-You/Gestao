"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing, Loader2, Share, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { enablePush, getPushSupport } from "@/lib/push";

const DISMISS_KEY = "mby-push-prompt-dismissed-at";
const DISMISS_DAYS = 7;

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Boolean(at) && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

type PromptKind = "ask" | "ios-install";

/**
 * Recadinho no topo do app pedindo para ativar as notificações. Some depois de
 * ativar, ao bloquear no navegador, ou por 7 dias ao tocar em "Agora não".
 */
export function PushPrompt() {
  const [kind, setKind] = useState<PromptKind | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (dismissedRecently()) return;
    const support = getPushSupport();
    const next: PromptKind | null =
      support === "ios-needs-install"
        ? "ios-install"
        : support === "supported" && Notification.permission === "default"
          ? "ask"
          : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- APIs do navegador só existem após montar
    setKind(next);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // sem armazenamento: só esconde nesta visita
    }
    setKind(null);
  }

  function activate() {
    startTransition(async () => {
      const result = await enablePush();
      if (!result.ok) {
        toast.error(result.error);
        if (Notification.permission === "denied") setKind(null);
        return;
      }
      toast.success("Notificações ativadas neste dispositivo");
      setKind(null);
    });
  }

  if (!kind) return null;

  return (
    <div
      role="region"
      aria-label="Ativar notificações"
      className="mb-6 flex flex-col gap-3 rounded-2xl border border-brand/25 bg-brand/[0.07] p-4 sm:flex-row sm:items-center"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
        <BellRing className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">Quer receber avisos do MBY Gestão?</p>
        {kind === "ask" ? (
          <p className="text-sm text-muted-foreground">
            Avisamos quando te colocarem numa tarefa, te convidarem para uma reunião, uma ata sair ou um prazo vencer
            hoje — mesmo com o app fechado.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No iPhone, toque em <Share className="inline size-3.5 align-[-2px]" /> <strong>Compartilhar</strong> →{" "}
            <strong>Adicionar à Tela de Início</strong>, abra o app por lá e ative as notificações.
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-2 self-end sm:self-auto">
        <Button variant="ghost" size="sm" onClick={dismiss}>
          {kind === "ask" ? (
            "Agora não"
          ) : (
            <>
              <X /> Fechar
            </>
          )}
        </Button>
        {kind === "ask" && (
          <Button size="sm" onClick={activate} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <BellRing />}
            Ativar notificações
          </Button>
        )}
      </div>
    </div>
  );
}
