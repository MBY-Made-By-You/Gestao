import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, assertSupabaseEnv } from "./env";

/** Cliente Supabase para Client Components (singleton no navegador). */
export function createClient() {
  assertSupabaseEnv();
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}

export type BrowserSupabaseClient = ReturnType<typeof createClient>;
