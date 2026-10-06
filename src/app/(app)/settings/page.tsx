import type { Metadata } from "next";
import { Bell, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PushSettings } from "@/components/notifications/push-settings";
import { PasswordForm, ProfileForm } from "@/components/settings/settings-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/constants";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const [{ senha }, profile] = await Promise.all([searchParams, requireProfile()]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Configurações" description="Seu perfil, segurança e preferências." />

      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>Como você aparece para a equipe nos cards, no ranking e no calendário.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Senha</CardTitle>
          <CardDescription>Use pelo menos 8 caracteres.</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm highlight={senha === "1"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-4 text-brand" /> Notificações
          </CardTitle>
          <CardDescription>
            Tarefas atribuídas a você, convites, atas, XP ganho e lembretes de prazo e de eventos do dia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PushSettings />
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Aparência</CardTitle>
            <CardDescription>Claro, escuro ou seguir o sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeToggle className="max-w-48" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-brand" /> Seu acesso
            </CardTitle>
            <CardDescription>Definido por um administrador.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-bold">{ROLE_LABEL[profile.role]}</p>
            <p className="text-sm text-muted-foreground">{ROLE_DESCRIPTION[profile.role]}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
