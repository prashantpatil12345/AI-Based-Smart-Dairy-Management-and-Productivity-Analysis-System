// One-click demo data seeder for the calling user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const SAMPLE_CATTLE = [
  { tag: "C001", name: "Lakshmi", breed: "Gir", age: 5, gender: "Female", color: "Brown", health_status: "Healthy", milk_yield: 12.5 },
  { tag: "C002", name: "Ganga", breed: "Sahiwal", age: 4, gender: "Female", color: "Reddish", health_status: "At Risk", milk_yield: 10.2 },
  { tag: "C003", name: "Nandi", breed: "Holstein Friesian", age: 3, gender: "Male", color: "Black/White", health_status: "Healthy", milk_yield: 0 },
  { tag: "C004", name: "Kamdhenu", breed: "Jersey", age: 6, gender: "Female", color: "Fawn", health_status: "Healthy", milk_yield: 15.8 },
  { tag: "C005", name: "Bhola", breed: "Indigenous", age: 7, gender: "Male", color: "Grey", health_status: "Critical", milk_yield: 0 },
  { tag: "C006", name: "Sundari", breed: "Gir", age: 4, gender: "Female", color: "Brown", health_status: "Healthy", milk_yield: 11.3 },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid token" }, 401);
    const uid = userData.user.id;

    // Skip if user already has cattle
    const { count } = await supabase.from("cattle").select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0) return json({ skipped: true, message: "Demo data already present" });

    const { data: cattleRows, error: cErr } = await supabase
      .from("cattle")
      .insert(SAMPLE_CATTLE.map((c) => ({ ...c, owner_id: uid })))
      .select("id, name");
    if (cErr) return json({ error: cErr.message }, 500);

    const cattleByName = Object.fromEntries((cattleRows ?? []).map((c: { name: string; id: string }) => [c.name, c.id]));

    // Milk records: last 7 days
    const milkRows: Record<string, unknown>[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      for (const c of SAMPLE_CATTLE.filter((c) => c.gender === "Female")) {
        const base = c.milk_yield / 2;
        milkRows.push({
          cattle_id: cattleByName[c.name],
          date: dateStr,
          morning: Number((base + Math.random() * 0.5).toFixed(2)),
          evening: Number((base - 0.2 + Math.random() * 0.5).toFixed(2)),
          recorded_by: uid,
        });
      }
    }
    await supabase.from("milk_records").insert(milkRows);

    // Health records
    const in7 = new Date();
    in7.setDate(in7.getDate() + 7);
    const overdue = new Date();
    overdue.setDate(overdue.getDate() - 3);
    await supabase.from("health_records").insert([
      { cattle_id: cattleByName["Ganga"], condition: "FMD Vaccination", treatment: "Scheduled", vet_name: "Dr. Sharma", date: new Date().toISOString().slice(0, 10), next_checkup: in7.toISOString().slice(0, 10), status: "Upcoming", created_by: uid },
      { cattle_id: cattleByName["Bhola"], condition: "Anthrax Vaccination", treatment: "Pending", vet_name: "Dr. Patel", date: overdue.toISOString().slice(0, 10), next_checkup: overdue.toISOString().slice(0, 10), status: "Overdue", created_by: uid },
      { cattle_id: cattleByName["Lakshmi"], condition: "Routine checkup", treatment: "Healthy", vet_name: "Dr. Kumar", date: new Date().toISOString().slice(0, 10), next_checkup: in7.toISOString().slice(0, 10), status: "Scheduled", created_by: uid },
    ]);

    return json({ success: true, cattle: cattleRows?.length ?? 0 });
  } catch (e) {
    console.error("seed-demo-data error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
