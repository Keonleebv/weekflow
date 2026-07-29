import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public, client-safe keys (the anon key is designed to ship in the browser;
// Row Level Security on the table is what actually protects each user's data).
// Set both in .env locally and in Vercel. When they're absent the app runs in
// local-only mode — exactly the pre-sync behaviour, no login shown.
const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseEnabled = !!(URL && ANON);

export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(URL as string, ANON as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // completes the Google OAuth redirect
      },
    })
  : null;

// One Postgres row per user holds the whole planner state as JSON.
export const STATE_TABLE = "weekflow_state";
