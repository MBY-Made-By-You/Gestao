import { timingSafeEqual } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { z } from "zod";

import type { Database } from "@/lib/supabase/database.types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/**
 * Entrega de Web Push. Chamado pelo próprio banco (gatilho em notifications +
 * pg_net) com o segredo compartilhado no cabeçalho `x-push-secret`.
 */
const payloadSchema = z.object({
  notification: z.object({
    id: z.string(),
    type: z.string(),
    title: z.string().max(200),
    body: z.string().max(500).nullable(),
    url: z.string().startsWith("/").nullable(),
  }),
  subscriptions: z
    .array(z.object({ endpoint: z.url(), p256dh: z.string(), auth: z.string() }))
    .max(50),
});

function validSecret(received: string | null, expected: string) {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.PUSH_WEBHOOK_SECRET;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!secret || !publicKey || !privateKey) {
    return Response.json({ error: "push não configurado" }, { status: 503 });
  }
  if (!validSecret(request.headers.get("x-push-secret"), secret)) {
    return Response.json({ error: "não autorizado" }, { status: 401 });
  }

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "payload inválido" }, { status: 400 });
  const { notification, subscriptions } = parsed.data;

  const subject = process.env.VAPID_SUBJECT ?? new URL(request.url).origin;
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const payload = JSON.stringify({
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body ?? "",
    url: notification.url ?? "/dashboard",
  });

  const gone: string[] = [];
  const results = await Promise.allSettled(
    subscriptions.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
        TTL: 60 * 60 * 24,
        urgency: "normal",
        topic: notification.id.replace(/-/g, "").slice(0, 32),
      }),
    ),
  );
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      const status = (result.reason as { statusCode?: number })?.statusCode;
      // 404/410: inscrição expirada ou cancelada pelo navegador.
      if (status === 404 || status === 410) gone.push(subscriptions[i].endpoint);
    }
  });

  if (gone.length) {
    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await supabase.rpc("prune_push_subscriptions", { p_secret: secret, p_endpoints: gone });
  }

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return Response.json({ sent, failed: results.length - sent, pruned: gone.length });
}
