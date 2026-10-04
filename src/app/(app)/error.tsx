"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-[60dvh] place-items-center">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" />
        </span>
        <div className="space-y-1.5">
          <h1 className="text-xl font-extrabold">Algo deu errado</h1>
          <p className="text-sm text-muted-foreground">
            Não conseguimos carregar esta tela. Verifique sua conexão e tente novamente.
            {error.digest ? ` (código ${error.digest})` : ""}
          </p>
        </div>
        <Button onClick={reset}>
          <RotateCw /> Tentar de novo
        </Button>
      </div>
    </div>
  );
}
