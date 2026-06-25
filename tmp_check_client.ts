import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://fnfqdjfiybgpmhkbjceg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_qh2H3prG45F4ZbW1DFAtoQ_zGEsxyBF";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
});

async function main() {
  const { data: clients, error: clientsErr } = await supabase
    .from("clients")
    .select("id, slug, name")
    .order("slug");

  if (clientsErr) {
    console.error("clients error:", clientsErr.message);
    return;
  }

  console.log("=== clients ===");
  for (const c of clients || []) {
    console.log(`slug=${c.slug} name=${c.name} id=${c.id}`);
  }

  const dd = clients?.find((c) => c.slug === "doordash");
  const uber = clients?.find((c) => c.slug === "uber");

  if (!dd) {
    console.log("DoorDash client NOT found");
    return;
  }
  if (!uber) {
    console.log("Uber client NOT found");
  }

  console.log(`DoorDash id=${dd.id}`);
  if (uber) console.log(`Uber id=${uber.id}`);

  const tables = ["agents", "task_events", "correction_events", "baselines", "health_signals"];
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select("client_id", { count: "exact", head: true })
        .eq("client_id", dd.id);
      if (error) {
        console.log(`table=${table} door_dash_rows=ERROR: ${error.message}`);
      } else {
        console.log(`table=${table} door_dash_rows=${count}`);
      }
    } catch (e) {
      console.log(`table=${table} door_dash_rows=EXCEPTION: ${(e as Error).message}`);
    }
  }

  if (uber) {
    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select("client_id", { count: "exact", head: true })
          .eq("client_id", uber.id);
        if (error) {
          console.log(`table=${table} uber_rows=ERROR: ${error.message}`);
        } else {
          console.log(`table=${table} uber_rows=${count}`);
        }
      } catch (e) {
        console.log(`table=${table} uber_rows=EXCEPTION: ${(e as Error).message}`);
      }
    }
  }
}

main().catch((e) => console.error(e));
