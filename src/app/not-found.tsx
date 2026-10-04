import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="bg-app grid min-h-dvh place-items-center p-6">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <Image
          src="/brand/capivara-sm.webp"
          alt="Capivara MBY"
          width={320}
          height={320}
          className="size-40 rounded-full border-4 border-card object-cover shadow-lift"
          priority
        />
        <div className="space-y-2">
          <p className="text-sm font-bold text-brand-strong dark:text-brand">Erro 404</p>
          <h1 className="text-2xl font-extrabold tracking-tight">A capivara procurou, mas não achou</h1>
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
