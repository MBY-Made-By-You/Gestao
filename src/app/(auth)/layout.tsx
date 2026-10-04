import Image from "next/image";
import { CalendarDays, SquareKanban, Trophy, Wallet } from "lucide-react";

import { Logo } from "@/components/brand/logo";

const FEATURES = [
  { icon: SquareKanban, title: "Kanban com arrastar e soltar", text: "Colunas personalizáveis, backlog e sprints." },
  { icon: Wallet, title: "Financeiro por projeto", text: "Receitas, despesas e insumos sob controle." },
  { icon: CalendarDays, title: "Calendário integrado", text: "Prazos, reuniões e marcos de entrega." },
  { icon: Trophy, title: "Equipe gamificada", text: "XP, níveis e conquistas a cada entrega." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Painel da marca */}
      <aside className="relative hidden overflow-hidden bg-[#05070b] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 -right-32 size-[34rem] rounded-full bg-[#0399fb]/30 blur-[120px]" />
          <div className="absolute -bottom-48 -left-24 size-[30rem] rounded-full bg-[#99b1ef]/20 blur-[120px]" />
          <svg className="absolute inset-0 size-full opacity-[0.06]" aria-hidden>
            <defs>
              <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse">
                <path d="M36 0H0V36" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative flex items-center gap-3">
          <Logo className="h-12" priority />
          <div className="leading-tight">
            <p className="text-lg font-extrabold tracking-tight">Gestão</p>
            <p className="text-xs text-white/60">Made By You</p>
          </div>
        </div>

        <div className="relative mx-auto grid w-full max-w-xl items-center gap-10 xl:grid-cols-[1fr_auto]">
          <div className="space-y-6">
            <h1 className="text-4xl leading-[1.1] font-extrabold tracking-tight xl:text-5xl">
              Seu time, seus projetos,{" "}
              <span className="bg-gradient-to-r from-[#22a6ff] to-[#b9c8f5] bg-clip-text text-transparent">
                feito por você.
              </span>
            </h1>
            <ul className="space-y-4">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-white/8 ring-1 ring-white/12">
                    <Icon className="size-4.5 text-[#22a6ff]" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold">{title}</span>
                    <span className="block text-sm text-white/60">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative hidden xl:block">
            <div className="absolute inset-0 -z-10 scale-110 rounded-full bg-[#0399fb]/40 blur-3xl" />
            <Image
              src="/brand/capivara.webp"
              alt="Capivara mascote da MBY trabalhando no notebook"
              width={640}
              height={640}
              priority
              className="size-56 animate-float rounded-[2rem] object-cover shadow-2xl ring-1 ring-white/15"
            />
          </div>
        </div>

        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} MBY — Made By You</p>
      </aside>

      {/* Formulário */}
      <main className="bg-app flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo className="h-11" priority />
            <div className="leading-tight">
              <p className="text-base font-extrabold">Gestão</p>
              <p className="text-xs text-muted-foreground">Made By You</p>
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
