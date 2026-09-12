import { createClient } from "@supabase/supabase-js";

export const serverClient = createClient("https://xyz.supabase.co", "anon-key");
