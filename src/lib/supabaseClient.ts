import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Export a flag to check if Supabase is properly configured
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    "Supabase URL or Anon Key is missing. TripMitra will run in Local Offline Mode using localStorage."
  );
}

// Client export (initialized safely)
export const supabase = createClient(
  supabaseUrl || "https://placeholder-url.supabase.co",
  supabaseAnonKey || "placeholder-anon-key"
);
