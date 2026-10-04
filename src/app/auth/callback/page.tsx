"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { createClient } from "@/lib/supabase/client";

/**
 * Retorno dos links de e-mail do Supabase Auth (confirmação, convite, magic link,
 * recuperação). Suporta os três formatos possíveis:
 *   ?code=...                  (PKCE)
 *   ?token_hash=...&type=...   (templates personalizados)
 *   #access_token=...          (fluxo implícito, ex.: convites do painel)
 */
function CallbackHandler() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const rawNext = params.get("next") ?? "/dashboard";
    const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

    async function run() {
      const code = params.get("code");
      const tokenHash = params.get("token_hash");
      const type = params.get("type") as EmailOtpType | null;
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const errorDescription = params.get("error_description") ?? hash.get("error_description");

      if (errorDescription) throw new Error(errorDescription);
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
      } else if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) throw error;
      } else if (hash.get("access_token") && hash.get("refresh_token")) {
        const { error } = await supabase.auth.setSession({
          access_token: hash.get("access_token")!,
          refresh_token: hash.get("refresh_token")!,
        });
        if (error) throw error;
      }

      const invited = type === "invite" || type === "recovery" || hash.get("type") === "invite" || hash.get("type") === "recovery";
      router.replace(invited ? "/settings?senha=1" : next);
      router.refresh();
    }

    run().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : "Não foi possível validar o link.");
    });
  }, [params, router]);

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Logo className="h-14" priority />
      {error ? (
        <>
          <p className="text-base font-bold">Link inválido ou expirado</p>
          <p className="max-w-xs text-sm text-muted-foreground">{error}</p>
          <a href="/login" className="text-sm font-semibold text-brand-strong hover:underline dark:text-brand">
            Voltar ao login
          </a>
        </>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Confirmando seu acesso…
        </p>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <main className="bg-app grid min-h-dvh place-items-center p-6">
      <Suspense>
        <CallbackHandler />
      </Suspense>
    </main>
  );
}
