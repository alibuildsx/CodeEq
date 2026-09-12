import { createClient } from "@supabase/supabase-js";

export const clientA = createClient("https://xyz.supabase.co", "anon-key");
