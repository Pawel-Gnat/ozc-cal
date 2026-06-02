import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types";

/** Typed Supabase client used across services and API routes. */
export type AppSupabaseClient = SupabaseClient<Database, "public">;
