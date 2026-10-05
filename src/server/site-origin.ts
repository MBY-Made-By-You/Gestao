import "server-only";

import { headers } from "next/headers";

/**
 * Origem pública do app para montar links de e-mail (confirmação, convite).
 * Prioriza o endereço real de quem fez a requisição — assim produção, previews
 * da Vercel e o ambiente local apontam cada um para si mesmo — e só então cai
 * para as variáveis de ambiente.
 */
export async function getSiteOrigin(): Promise<string> {
  const requestOrigin = (await headers()).get("origin");
  if (requestOrigin && /^https?:\/\//.test(requestOrigin)) return requestOrigin;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}
