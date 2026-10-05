import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "./database.types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

const PUBLIC_PATHS = ["/login", "/signup", "/auth"];
const AUTH_PAGES = ["/login", "/signup"];

function matches(pathname: string, paths: string[]) {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Renova a sessão do Supabase a cada requisição (cookies) e protege as rotas
 * privadas. Executado pelo src/proxy.ts (antigo middleware do Next.js).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Importante: nada entre a criação do cliente e getClaims() — é aqui que o
  // token é validado e renovado.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (target: URL) => {
    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  // Links de e-mail do Supabase que caíram fora de /auth/callback — acontece
  // quando o Supabase volta para a "Site URL" (raiz) em vez do redirect pedido.
  if (!matches(pathname, ["/auth"])) {
    const params = request.nextUrl.searchParams;
    if (params.has("code") || params.has("token_hash")) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/callback";
      return redirectTo(url);
    }
    const linkError = params.get("error_code") ?? (params.has("error_description") ? "link_invalido" : null);
    if (linkError) {
      const url = request.nextUrl.clone();
      url.pathname = isAuthenticated ? "/dashboard" : "/login";
      url.search = "";
      if (!isAuthenticated) url.searchParams.set("erro", linkError);
      return redirectTo(url);
    }
  }

  if (!isAuthenticated && !matches(pathname, PUBLIC_PATHS)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
    return redirectTo(url);
  }

  if (isAuthenticated && (pathname === "/" || matches(pathname, AUTH_PAGES))) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return redirectTo(url);
  }

  return response;
}
