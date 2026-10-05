import Link from "next/link";
import { SearchX } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="bg-app grid min-h-dvh place-items-center p-6">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <Logo className="h-12" priority />
        <div className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand-strong dark:text-brand">
          <SearchX className="size-7" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-bold text-brand-strong dark:text-brand">Erro 404</p>
          <h1 className="text-2xl font-extrabold tracking-tight">Página não encontrada</h1>
          <p className="text-sm text-muted-foreground">
            A página não existe ou você não tem acesso a ela. Se for um projeto, peça para ser incluído na equipe dele.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard">Voltar ao dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
