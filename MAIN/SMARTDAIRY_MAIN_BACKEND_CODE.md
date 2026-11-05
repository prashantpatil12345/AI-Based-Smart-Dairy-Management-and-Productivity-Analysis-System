# SmartDairy Main Backend Code

## 1. Backend Architecture

The main server-side implementation is Supabase: authenticated Edge Functions, SQL migrations defining tables/RLS/storage, and Supabase project configuration. All code blocks below are copied from the current repository source. The project also contains a separate `ml-service/`, but the current SmartDairy breed-recognition page invokes the `breed-recognition` Edge Function; the inactive/legacy Roboflow service is not included as active backend code. `.env` and generated/local configuration are intentionally excluded.

## 2. Supabase Edge Functions

### supabase/functions/breed-recognition/index.ts

Purpose: Authenticates and rate-limits breed recognition, fetches a signed image, calls the hosted classifier, and persists the prediction.

### supabase/functions/breed-recognition/index.ts

```typescript
// Breed recognition via the hosted 26-class ViT classifier.
// Input:  { image_url: string }
// Output: { prediction_id, breed, confidence, reasoning }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CLASSIFIER_URL =
  "https://sajit9285-cattle-breed-classifier.hf.space/predict/file";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // ---------------------------------------------------------
    // 1. Check authentication
    // ---------------------------------------------------------
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return json({ error: "Missing authorization" }, 401);
    }

    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      },
    );

    const {
      data: userData,
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !userData.user) {
      return json({ error: "Invalid token" }, 401);
    }

    const userId = userData.user.id;

    // ---------------------------------------------------------
    // 2. Rate limiting: max 5 requests/minute/user
    // ---------------------------------------------------------
    const oneMinAgo = new Date(
      Date.now() - 60_000,
    ).toISOString();

    const {
      count: recentCount,
      error: countErr,
    } = await supabase
      .from("ai_request_log")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("user_id", userId)
      .eq("endpoint", "breed-recognition")
      .gte("created_at", oneMinAgo);

    if (countErr) {
      console.error(
        "Rate limit check error:",
        countErr,
      );
    }

    if ((recentCount ?? 0) >= 5) {
      return json(
        {
          error:
            "Rate limit exceeded: max 5 breed recognitions per minute. Please wait.",
        },
        429,
      );
    }

    const { error: logErr } = await supabase
      .from("ai_request_log")
      .insert({
        user_id: userId,
        endpoint: "breed-recognition",
      });

    if (logErr) {
      console.error(
        "Rate limit log error:",
        logErr,
      );
    }

    // ---------------------------------------------------------
    // 3. Read request body
    // ---------------------------------------------------------
    const body = await req.json().catch(() => null);
    const imageUrl = body?.image_url;

    if (
      !imageUrl ||
      typeof imageUrl !== "string" ||
      imageUrl.length > 10000
    ) {
      return json(
        { error: "image_url is required" },
        400,
      );
    }

    // Validate image URL
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return json(
        { error: "Invalid image URL" },
        400,
      );
    }

    if (
      parsedUrl.protocol !== "http:" &&
      parsedUrl.protocol !== "https:"
    ) {
      return json(
        { error: "Invalid image URL protocol" },
        400,
      );
    }

    // ---------------------------------------------------------
    // 4. Fetch image bytes from signed URL
    // ---------------------------------------------------------
    let imageResponse: Response;
    try {
      imageResponse = await fetch(imageUrl);
    } catch (fetchErr) {
      console.error("Failed to fetch image from URL:", fetchErr);
      return json(
        { error: "Failed to download image from storage URL" },
        400,
      );
    }

    if (!imageResponse.ok) {
      console.error(
        "Image fetch returned error status:",
        imageResponse.status,
      );
      return json(
        {
          error: `Failed to download image from storage (status ${imageResponse.status})`,
        },
        400,
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    if (!imageBuffer || imageBuffer.byteLength === 0) {
      return json({ error: "Retrieved empty image data" }, 400);
    }

    // ---------------------------------------------------------
    // 5. Send the image to the hosted 26-class classifier
    // ---------------------------------------------------------
    const classifierForm = new FormData();
    classifierForm.append(
      "file",
      new Blob(
        [new Uint8Array(imageBuffer)],
        {
          type:
            imageResponse.headers.get("content-type") ??
              "application/octet-stream",
        },
      ),
      "image",
    );

    let classifierResponse: Response;
    try {
      classifierResponse = await fetch(CLASSIFIER_URL, {
        method: "POST",
        body: classifierForm,
      });
    } catch (fetchError) {
      console.error(
        "Failed to reach the breed classifier:",
        fetchError,
      );
      return json(
        { error: "Breed classifier is unavailable" },
        503,
      );
    }

    if (!classifierResponse.ok) {
      console.error(
        "Breed classifier returned an error status:",
        classifierResponse.status,
      );
      return json(
        {
          error: `Breed classifier request failed (HTTP ${classifierResponse.status})`,
        },
        classifierResponse.status >= 500 ? 503 : 502,
      );
    }

    let classifierData: unknown;
    try {
      classifierData = await classifierResponse.json();
    } catch {
      return json(
        { error: "Breed classifier returned invalid JSON" },
        502,
      );
    }

    if (
      !classifierData ||
      typeof classifierData !== "object" ||
      Array.isArray(classifierData)
    ) {
      return json(
        { error: "Breed classifier returned an invalid response" },
        502,
      );
    }

    const classifierResult =
      classifierData as Record<string, unknown>;
    const predictedBreedValue = classifierResult.predicted_breed;
    const rawConfidence = classifierResult.confidence;

    if (
      typeof predictedBreedValue !== "string" ||
      !predictedBreedValue.trim() ||
      typeof rawConfidence !== "number" ||
      !Number.isFinite(rawConfidence) ||
      rawConfidence < 0 ||
      rawConfidence > 100
    ) {
      return json(
        {
          error:
            "Breed classifier response is missing a valid breed or confidence",
        },
        502,
      );
    }

    const predictedBreed = predictedBreedValue;

    // ---------------------------------------------------------
    // 8. Normalize breed name
    // ---------------------------------------------------------
    const normalizeBreed = (value: string): string => {
      let result = value
        .trim()
        .replace(/\s+/g, " ");

      // Remove common dataset suffixes
      result = result
        .replace(/\s+Cow$/i, "")
        .replace(/\s+Buffalo$/i, "")
        .trim();

      return result;
    };

    const finalBreed =
      normalizeBreed(predictedBreed);

    // ---------------------------------------------------------
    // 9. Normalize confidence to percentage
    // ---------------------------------------------------------
    const confidencePercent =
      rawConfidence <= 1
        ? rawConfidence * 100
        : rawConfidence;

    const finalConfidence = Math.max(
      0,
      Math.min(
        100,
        Number(confidencePercent.toFixed(2)),
      ),
    );

    // ---------------------------------------------------------
    // 10. Create reasoning
    // ---------------------------------------------------------
    const topPredictions = Array.isArray(classifierResult.top_k)
      ? classifierResult.top_k
        .filter(
          (
            prediction,
          ): prediction is { breed: string; confidence: number } =>
          typeof prediction === "object" &&
          prediction !== null &&
          !Array.isArray(prediction) &&
          typeof prediction.breed === "string" &&
          typeof prediction.confidence === "number" &&
          Number.isFinite(prediction.confidence),
        )
        .slice(0, 3)
        .map((prediction) => {
          const predictionConfidence =
            prediction.confidence <= 1
              ? prediction.confidence * 100
              : prediction.confidence;
          return `${prediction.breed} (${predictionConfidence.toFixed(1)}%)`;
        })
      : [];

    const breedInfo = classifierResult.breed_info;
    const breedDescription =
      typeof breedInfo === "object" &&
        breedInfo !== null &&
        !Array.isArray(breedInfo) &&
        typeof (breedInfo as Record<string, unknown>).description === "string"
        ? (breedInfo as Record<string, unknown>).description as string
        : "";
    const classifierWarning =
      typeof classifierResult.warning === "string"
        ? classifierResult.warning
        : "";
    const modelVersion =
      typeof classifierResult.model_version === "string"
        ? classifierResult.model_version
        : "26-class ViT";
    const reasoningParts = [
      `Predicted ${finalBreed} using the ${modelVersion} breed classifier with ${finalConfidence.toFixed(1)}% confidence.`,
      topPredictions.length > 0
        ? `Top predictions: ${topPredictions.join(", ")}.`
        : "",
      breedDescription,
      classifierWarning,
    ].filter(Boolean);
    const finalReasoning = reasoningParts.join(" ");

    // ---------------------------------------------------------
    // 11. Save prediction
    // ---------------------------------------------------------
    const {
      data: inserted,
      error: insertError,
    } = await supabase
      .from("breed_predictions")
      .insert({
        user_id: userId,
        image_url: imageUrl,
        predicted_breed: finalBreed,
        confidence: finalConfidence,
        reasoning: finalReasoning,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error(
        "Prediction insert error:",
        insertError,
      );

      return json(
        { error: insertError.message },
        500,
      );
    }

    if (!inserted?.id) {
      console.error(
        "Prediction inserted but no ID returned",
      );

      return json(
        { error: "Prediction was saved but ID was not returned" },
        500,
      );
    }

    // ---------------------------------------------------------
    // 12. Return result
    // ---------------------------------------------------------
    return json({
      prediction_id: inserted.id,
      breed: finalBreed,
      confidence: finalConfidence,
      reasoning: finalReasoning,
    });
  } catch (error) {
    console.error(
      "breed-recognition error:",
      error,
    );

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      500,
    );
  }
});
```

### supabase/functions/confirm-breed/index.ts

Purpose: Saves the confirmed breed and optionally updates the linked cattle row.

### supabase/functions/confirm-breed/index.ts

```typescript
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
```

### supabase/functions/reports/index.ts

Purpose: Aggregates cattle, milk and health data for dashboard/report views.

### supabase/functions/reports/index.ts

```typescript
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
```

### supabase/functions/seed-demo-data/index.ts

Purpose: Creates demonstration cattle and related milk/health records for an authenticated user.

### supabase/functions/seed-demo-data/index.ts

```typescript
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
```

### supabase/functions/_shared/cors.ts

Purpose: Shared CORS and JSON response helpers used by the Edge Functions.

### supabase/functions/_shared/cors.ts

```typescript
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
```

## 3. Database and Backend Definitions

The complete migration source is included in chronological order. It contains the schema, enums, indexes, triggers, constraints, RLS policies, Storage buckets/policies, and subsequent backend policy/schema changes.

### supabase/migrations/20260502182151_0fd5ae57-b568-44f0-8d66-39c1ca4c36d5.sql

```sql

-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'farmer');
CREATE TYPE public.gender_t AS ENUM ('Male', 'Female');
CREATE TYPE public.health_t AS ENUM ('Healthy', 'At Risk', 'Critical');
CREATE TYPE public.vacc_status_t AS ENUM ('Scheduled', 'Upcoming', 'Overdue', 'Completed');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  farm_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

-- ============ CATTLE ============
CREATE TABLE public.cattle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  name TEXT NOT NULL,
  breed TEXT NOT NULL,
  age INTEGER NOT NULL DEFAULT 0,
  gender public.gender_t NOT NULL DEFAULT 'Female',
  color TEXT,
  health_status public.health_t NOT NULL DEFAULT 'Healthy',
  milk_yield NUMERIC(6,2) NOT NULL DEFAULT 0,
  purchase_date DATE,
  notes TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, tag)
);
CREATE INDEX idx_cattle_owner ON public.cattle(owner_id);
ALTER TABLE public.cattle ENABLE ROW LEVEL SECURITY;

-- ============ MILK RECORDS ============
CREATE TABLE public.milk_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cattle_id UUID NOT NULL REFERENCES public.cattle(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  morning NUMERIC(6,2) NOT NULL DEFAULT 0,
  evening NUMERIC(6,2) NOT NULL DEFAULT 0,
  total NUMERIC(6,2) GENERATED ALWAYS AS (morning + evening) STORED,
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cattle_id, date)
);
CREATE INDEX idx_milk_cattle_date ON public.milk_records(cattle_id, date DESC);
ALTER TABLE public.milk_records ENABLE ROW LEVEL SECURITY;

-- ============ HEALTH RECORDS ============
CREATE TABLE public.health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cattle_id UUID NOT NULL REFERENCES public.cattle(id) ON DELETE CASCADE,
  condition TEXT NOT NULL,
  treatment TEXT,
  vet_name TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  next_checkup DATE,
  status public.vacc_status_t NOT NULL DEFAULT 'Scheduled',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_health_cattle_date ON public.health_records(cattle_id, date DESC);
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;

-- ============ BREED PREDICTIONS ============
CREATE TABLE public.breed_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  predicted_breed TEXT NOT NULL,
  confidence NUMERIC(5,2) NOT NULL,
  reasoning TEXT,
  confirmed_breed TEXT,
  cattle_id UUID REFERENCES public.cattle(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pred_user ON public.breed_predictions(user_id, created_at DESC);
ALTER TABLE public.breed_predictions ENABLE ROW LEVEL SECURITY;

-- ============ updated_at TRIGGER ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_cattle_updated BEFORE UPDATE ON public.cattle
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ NEW USER TRIGGER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, farm_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'farm_name', 'My Farm')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'farmer');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- user_roles (read only for users; admins read all)
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- cattle
CREATE POLICY "Owners view cattle" ON public.cattle FOR SELECT
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners insert cattle" ON public.cattle FOR INSERT
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update cattle" ON public.cattle FOR UPDATE
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners delete cattle" ON public.cattle FOR DELETE
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

-- milk_records (via cattle ownership)
CREATE POLICY "Owners view milk" ON public.milk_records FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.cattle c WHERE c.id = cattle_id AND (c.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "Owners insert milk" ON public.milk_records FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.cattle c WHERE c.id = cattle_id AND c.owner_id = auth.uid()) AND auth.uid() = recorded_by);
CREATE POLICY "Owners update milk" ON public.milk_records FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.cattle c WHERE c.id = cattle_id AND c.owner_id = auth.uid()));
CREATE POLICY "Owners delete milk" ON public.milk_records FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.cattle c WHERE c.id = cattle_id AND c.owner_id = auth.uid()));

-- health_records
CREATE POLICY "Owners view health" ON public.health_records FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.cattle c WHERE c.id = cattle_id AND (c.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "Owners insert health" ON public.health_records FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.cattle c WHERE c.id = cattle_id AND c.owner_id = auth.uid()) AND auth.uid() = created_by);
CREATE POLICY "Owners update health" ON public.health_records FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.cattle c WHERE c.id = cattle_id AND c.owner_id = auth.uid()));
CREATE POLICY "Owners delete health" ON public.health_records FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.cattle c WHERE c.id = cattle_id AND c.owner_id = auth.uid()));

-- breed_predictions
CREATE POLICY "Users view own predictions" ON public.breed_predictions FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own predictions" ON public.breed_predictions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own predictions" ON public.breed_predictions FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users delete own predictions" ON public.breed_predictions FOR DELETE
  USING (auth.uid() = user_id);

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public) VALUES ('cattle-images', 'cattle-images', false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('breed-uploads', 'breed-uploads', false)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies: users access only their own folder
CREATE POLICY "Users read own cattle images" ON storage.objects FOR SELECT
  USING (bucket_id = 'cattle-images' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Users upload own cattle images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'cattle-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own cattle images" ON storage.objects FOR UPDATE
  USING (bucket_id = 'cattle-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own cattle images" ON storage.objects FOR DELETE
  USING (bucket_id = 'cattle-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own breed uploads" ON storage.objects FOR SELECT
  USING (bucket_id = 'breed-uploads' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Users upload own breed uploads" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'breed-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own breed uploads" ON storage.objects FOR DELETE
  USING (bucket_id = 'breed-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### supabase/migrations/20260502182215_150fc01c-7496-4d9b-b739-6f6e674ce472.sql

```sql

-- Fix mutable search_path on set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Revoke public/anon/authenticated EXECUTE on SECURITY DEFINER functions.
-- They are still callable by triggers and by RLS policies (which run as the table owner).
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
```

### supabase/migrations/20260502182328_a9165272-1bfb-4c02-a654-1cc06f7ba262.sql

```sql

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, anon;
```

### supabase/migrations/20260503174441_3e6ddeb8-869a-4e2f-9cf5-c5d1f7dd4f26.sql

```sql

-- Drop existing FKs (if any) and recreate with cascade
ALTER TABLE public.milk_records DROP CONSTRAINT IF EXISTS milk_records_cattle_id_fkey;
ALTER TABLE public.health_records DROP CONSTRAINT IF EXISTS health_records_cattle_id_fkey;
ALTER TABLE public.breed_predictions DROP CONSTRAINT IF EXISTS breed_predictions_cattle_id_fkey;

DELETE FROM public.milk_records WHERE cattle_id NOT IN (SELECT id FROM public.cattle);
DELETE FROM public.health_records WHERE cattle_id NOT IN (SELECT id FROM public.cattle);
UPDATE public.breed_predictions SET cattle_id = NULL
  WHERE cattle_id IS NOT NULL AND cattle_id NOT IN (SELECT id FROM public.cattle);

ALTER TABLE public.milk_records
  ADD CONSTRAINT milk_records_cattle_id_fkey
  FOREIGN KEY (cattle_id) REFERENCES public.cattle(id) ON DELETE CASCADE;

ALTER TABLE public.health_records
  ADD CONSTRAINT health_records_cattle_id_fkey
  FOREIGN KEY (cattle_id) REFERENCES public.cattle(id) ON DELETE CASCADE;

ALTER TABLE public.breed_predictions
  ADD CONSTRAINT breed_predictions_cattle_id_fkey
  FOREIGN KEY (cattle_id) REFERENCES public.cattle(id) ON DELETE SET NULL;

ALTER TABLE public.cattle DROP CONSTRAINT IF EXISTS cattle_owner_tag_unique;
ALTER TABLE public.cattle ADD CONSTRAINT cattle_owner_tag_unique UNIQUE (owner_id, tag);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT
    '{"health_alerts": true, "vaccination_reminders": true, "milk_reports": false}'::jsonb;

CREATE TABLE IF NOT EXISTS public.ai_request_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_request_log_user_endpoint_time
  ON public.ai_request_log (user_id, endpoint, created_at DESC);

ALTER TABLE public.ai_request_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own ai logs" ON public.ai_request_log;
CREATE POLICY "Users view own ai logs" ON public.ai_request_log
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own ai logs" ON public.ai_request_log;
CREATE POLICY "Users insert own ai logs" ON public.ai_request_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

## 4. Supabase Backend Configuration

Relevant project/function configuration as checked in. No environment secret values are included.

### supabase/config.toml

```toml
project_id = "lfnirxpxeyopzazvjtpa"

[functions.breed-recognition]
verify_jwt = false

[functions.confirm-breed]
verify_jwt = false

[functions.reports]
verify_jwt = false

[functions.seed-demo-data]
verify_jwt = false
```

