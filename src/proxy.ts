import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Tudo, exceto arquivos estáticos, imagens otimizadas, ícones/metadados e o
    // webhook de push (autenticado por segredo, chamado pelo banco).
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|opengraph-image.png|manifest.webmanifest|sw.js|offline.html|api/push|brand/|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
