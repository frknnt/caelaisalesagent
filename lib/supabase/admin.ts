import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/db/database.types";
import {
  requireSupabasePublicConfig,
  requireSupabaseSecretKey,
} from "@/lib/env";

export function createAdminClient() {
  const { url } = requireSupabasePublicConfig();
  return createClient<Database>(url, requireSupabaseSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
