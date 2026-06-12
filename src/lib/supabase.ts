import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key)
  console.warn(
    "Supabase env belum diisi. Copy .env.example ke .env lalu isi URL dan anon key.",
  );
export const supabase = createClient(
  url || "https://example.supabase.co",
  key || "demo-key",
);
