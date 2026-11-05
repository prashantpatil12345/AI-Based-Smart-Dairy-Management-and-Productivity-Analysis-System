// Aggregated dashboard / reports data for the calling user.
// GET /reports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid token" }, 401);

    // Cattle (RLS limits to owner)
    const { data: cattle, error: cattleErr } = await supabase
      .from("cattle")
      .select("id, breed, health_status, milk_yield");
    if (cattleErr) return json({ error: cattleErr.message }, 500);

    const totalCattle = cattle?.length ?? 0;
    const healthCounts = { Healthy: 0, "At Risk": 0, Critical: 0 } as Record<string, number>;
    const breedCounts: Record<string, number> = {};
    for (const c of cattle ?? []) {
      healthCounts[c.health_status] = (healthCounts[c.health_status] ?? 0) + 1;
      breedCounts[c.breed] = (breedCounts[c.breed] ?? 0) + 1;
    }

    // Milk records for last 30 days
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString().slice(0, 10);
    const { data: milk, error: milkErr } = await supabase
      .from("milk_records")
      .select("date, total")
      .gte("date", sinceStr)
      .order("date", { ascending: true });
    if (milkErr) return json({ error: milkErr.message }, 500);

    // Daily series
    const dailyMap = new Map<string, number>();
    let monthTotal = 0;
    let weekTotal = 0;
    let todayTotal = 0;
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().slice(0, 10);
    for (const m of milk ?? []) {
      const t = Number(m.total ?? 0);
      dailyMap.set(m.date, (dailyMap.get(m.date) ?? 0) + t);
      monthTotal += t;
      if (m.date >= weekAgoStr) weekTotal += t;
      if (m.date === today) todayTotal += t;
    }
    const dailySeries = Array.from(dailyMap.entries()).map(([date, total]) => ({ date, total }));

    // Health alerts (next_checkup within 7 days OR overdue)
    const in7 = new Date();
    in7.setDate(in7.getDate() + 7);
    const { data: alerts, error: alertsErr } = await supabase
      .from("health_records")
      .select("id, condition, date, next_checkup, status, cattle_id")
      .neq("status", "Completed")
      .or(`status.eq.Overdue,next_checkup.lte.${in7.toISOString().slice(0, 10)}`)
      .order("next_checkup", { ascending: true })
      .limit(20);
    if (alertsErr) return json({ error: alertsErr.message }, 500);

    const avgPerCattle = totalCattle > 0 ? Number((weekTotal / 7 / totalCattle).toFixed(1)) : 0;

    return json({
      summary: {
        total_cattle: totalCattle,
        healthy: healthCounts.Healthy,
        at_risk: healthCounts["At Risk"],
        critical: healthCounts.Critical,
        active_alerts: alerts?.length ?? 0,
        today_milk: Number(todayTotal.toFixed(1)),
        week_milk: Number(weekTotal.toFixed(1)),
        month_milk: Number(monthTotal.toFixed(1)),
        avg_per_cattle: avgPerCattle,
      },
      health_distribution: [
        { name: "Healthy", value: healthCounts.Healthy, color: "hsl(142, 70%, 40%)" },
        { name: "At Risk", value: healthCounts["At Risk"], color: "hsl(38, 92%, 50%)" },
        { name: "Critical", value: healthCounts.Critical, color: "hsl(0, 84%, 60%)" },
      ],
      breed_distribution: Object.entries(breedCounts).map(([breed, count]) => ({ breed, count })),
      daily_milk: dailySeries,
      alerts: alerts ?? [],
    });
  } catch (e) {
    console.error("reports error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
