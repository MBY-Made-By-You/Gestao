"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { signIn, signUp, type AuthFormState } from "./actions";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    mode === "login" ? signIn : signUp,
    undefined,
  );
  const [showPassword, setShowPassword] = useState(false);
  const isLogin = mode === "login";

  return (
    <div className="space-y-7">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-extrabold tracking-tight">
          {isLogin ? "Bem-vindo de volta 👋" : "Crie sua conta"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isLogin
            ? "Entre para acompanhar projetos, finanças e a sua equipe."
            : "O primeiro cadastro vira administrador; os próximos entram como visualizadores até um admin promovê-los."}
        </p>
      </div>

      {state?.message ? (
        <div className="flex gap-3 rounded-xl border border-success/30 bg-success/10 p-3 text-sm">
          <MailCheck className="mt-0.5 size-4 shrink-0 text-success" />
          <p>{state.message}</p>
        </div>
      ) : null}

      <form action={formAction} className="space-y-4" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {!isLogin && (
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome completo</Label>
            <Input id="fullName" name="fullName" autoComplete="name" placeholder="Ana Souza" required />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@mby.com.br"
            defaultValue={state?.email}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={isLogin ? "current-password" : "new-password"}
              placeholder="Mínimo de 8 caracteres"
              minLength={8}
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {state?.error ? (
          <p role="alert" className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            {state.error}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {isLogin ? "Entrar" : "Criar conta"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {isLogin ? "Ainda não tem conta? " : "Já tem conta? "}
        <Link
          href={isLogin ? "/signup" : "/login"}
          className="font-semibold text-brand-strong hover:underline dark:text-brand"
        >
          {isLogin ? "Cadastre-se" : "Entrar"}
        </Link>
      </p>
    </div>
  );
}
