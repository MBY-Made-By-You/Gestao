"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string; message?: string; email?: string } | undefined;

const credentials = z.object({
  email: z.email("Informe um e-mail válido.").trim().toLowerCase(),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
});

/** Só permite redirecionar para caminhos internos (evita open redirect). */
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

function translateAuthError(message: string) {
  if (/invalid login credentials/i.test(message)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(message)) return "Confirme seu e-mail antes de entrar (verifique a caixa de entrada).";
  if (/already registered|already exists/i.test(message)) return "Este e-mail já tem cadastro. Faça login.";
  if (/rate limit|too many/i.test(message)) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  if (/password/i.test(message) && /weak|short|least/i.test(message)) return "Senha muito fraca. Use pelo menos 8 caracteres.";
  return message;
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: translateAuthError(error.message), email };

  redirect(safeNext(formData.get("next")));
}

const signUpSchema = credentials.extend({
  fullName: z.string().trim().min(2, "Informe seu nome.").max(120),
});

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email };

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "http://localhost:3000";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
    },
  });
  if (error) return { error: translateAuthError(error.message), email };

  // Com confirmação de e-mail desativada no Supabase, a sessão já vem pronta.
  if (data.session) redirect("/dashboard");

  return {
    message: "Conta criada! Enviamos um link de confirmação para o seu e-mail.",
    email,
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
