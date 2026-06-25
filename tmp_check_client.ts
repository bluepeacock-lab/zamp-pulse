import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://fnfqdjfiybgpmhkbjceg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_qh2H3prG45F4ZbW1DFAtoQ_zGEsxyBF";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
});

async function testTable(table: string, columns: string) {
  const { data, error, count } = await supabase
    .from(table)
    .select(columns, { count: "exact" })
    .limit(3);
  console.log(`\n=== ${table} select(${columns}) ===`);
  if (error) {
    console.log("ERROR:", error.message);
  } else {
    console.log("count:", count, "rows:", JSON.stringify(data, null, 2));
  }
}

async function main() {
  await testTable("clients", "id, slug, name");
  await testTable("agents", "id, name, client_id");
  await testTable("agents", "id, name");
  await testTable("task_events", "id, agent_id, client_id, outcome");
  await testTable("correction_events", "id, agent_id, client_id");
  await testTable("baselines", "id, agent_id, client_id");
  await testTable("health_signals", "id, client_id");
}

main().catch((e) => console.error(e));
