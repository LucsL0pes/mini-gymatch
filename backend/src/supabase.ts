import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE!; // server-side
if (!url || !serviceKey) {
  console.error("Faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE no .env");
  process.exit(1);
}

export const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
