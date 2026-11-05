// Confirm or correct a breed prediction; optionally link to a cattle record.
// Input: { prediction_id, confirmed_breed, cattle_id? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    const body = await req.json().catch(() => null);
    const predictionId = body?.prediction_id;
    const confirmedBreed = body?.confirmed_breed;
    const cattleId = body?.cattle_id ?? null;

    if (!predictionId || typeof predictionId !== "string") return json({ error: "prediction_id required" }, 400);
    if (!confirmedBreed || typeof confirmedBreed !== "string" || confirmedBreed.length > 100) {
      return json({ error: "confirmed_breed required" }, 400);
    }

    const { data: updated, error: updErr } = await supabase
      .from("breed_predictions")
      .update({ confirmed_breed: confirmedBreed, cattle_id: cattleId })
      .eq("id", predictionId)
      .select("id, cattle_id")
      .single();

    if (updErr) return json({ error: updErr.message }, 400);

    if (cattleId) {
      const { error: cattleErr } = await supabase
        .from("cattle")
        .update({ breed: confirmedBreed })
        .eq("id", cattleId);
      if (cattleErr) console.error("Cattle update warning:", cattleErr);
    }

    return json({ success: true, prediction: updated });
  } catch (e) {
    console.error("confirm-breed error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
