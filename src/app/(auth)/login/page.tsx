import type { Metadata } from "next";

import { describeAuthLinkError } from "@/lib/auth-link-errors";

import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, erro } = await searchParams;
  return (
    <AuthForm
      mode="login"
      next={typeof next === "string" ? next : undefined}
      notice={typeof erro === "string" ? describeAuthLinkError(erro) : undefined}
    />
  );
}
