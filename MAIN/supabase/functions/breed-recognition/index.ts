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