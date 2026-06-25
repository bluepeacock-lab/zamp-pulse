import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://fnfqdjfiybgpmhkbjceg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_qh2H3prG45F4ZbW1DFAtoQ_zGEsxyBF";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
