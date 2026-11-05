import { useState, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { breeds, getMatchedBreedInfo, BreedMetadata } from "@/data/breed-catalog";
import { ScanSearch, ImageIcon, Loader2, Check, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePredictions, useCattle } from "@/hooks/useDairy";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface PredictionResultState {
  prediction_id?: string;
  breed: string;
  confidence: number;
  reasoning?: string;
  warning?: string;
  breed_info?: {
    breed_name?: string;
    animal_type?: string;
    region?: string;
    avg_milk_liters_per_day?: string;
    lifespan_years?: string;
    primary_use?: string;
    description?: string;
  } | null;
}

const getConfidencePercentage = (val: number | string | null | undefined): number => {
  if (val == null || val === "") return 0;
  const num = typeof val === "string" ? parseFloat(val) : Number(val);
  if (isNaN(num)) return 0;
  const pct = num <= 1.0 && num > 0 ? num * 100.0 : num;
  return Math.min(100.0, Math.max(0.0, pct));
};

const formatConfidenceText = (val: number | string | null | undefined): string => {
  const pct = getConfidencePercentage(val);
  return `${pct.toFixed(1)}%`;
};

const BreedRecognition = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: predictions = [] } = usePredictions();
  const { data: cattle = [] } = useCattle();

  const [file, setFile] = useState<File | null>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResultState | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [confirmCattleId, setConfirmCattleId] = useState<string>("");
  const [selectedBreed, setSelectedBreed] = useState<string>("");

  const handleFile = (f: File) => {
    if (!f.type.startsWith("image/")) {
      toast.error("Invalid file format. Please upload a valid image (JPEG, PNG, WEBP).");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Image file is too large. Please upload an image under 10MB.");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const recognize = async () => {
    if (!file) {
      toast.error("No image file selected. Please select an image first.");
      return;
    }

    if (!user) {
      toast.error("Please sign in to identify cattle breeds.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // 1. Upload image to Supabase Storage bucket: breed-uploads
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("breed-uploads").upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      // 2. Create signed URL for Edge Function access
      const { data: signed, error: signErr } = await supabase.storage.from("breed-uploads").createSignedUrl(path, 3600);
      if (signErr || !signed?.signedUrl) {
        throw new Error(signErr?.message || "Failed to sign uploaded image URL");
      }

      // 3. Primary & only inference path: Supabase Edge Function breed-recognition
      const { data: sbData, error: fnErr } = await supabase.functions.invoke("breed-recognition", {
        body: { image_url: signed.signedUrl },
      });

      if (fnErr) throw fnErr;
      if (sbData && typeof sbData === "object" && "error" in sbData) {
        throw new Error(String(sbData.error));
      }

      if (!sbData) {
        throw new Error("Unable to connect to Roboflow prediction server. Please check your backend service.");
      }

      const backendRes = sbData as Record<string, unknown>;
      const predictedBreed = String(backendRes.breed || backendRes.predicted_breed || "Unknown");
      const confidenceVal = Number(backendRes.confidence) || 0;

      const predictionState: PredictionResultState = {
        prediction_id: backendRes.prediction_id as string | undefined,
        breed: predictedBreed,
        confidence: confidenceVal,
        warning: backendRes.warning as string | undefined,
        breed_info: backendRes.breed_info as PredictionResultState["breed_info"],
        reasoning: backendRes.reasoning as string | undefined,
      };

      setResult(predictionState);
      setSelectedBreed(predictedBreed);
      qc.invalidateQueries({ queryKey: ["breed_predictions"] });
      toast.success("Breed predicted successfully!");

    } catch (e: unknown) {
      const err = e as Error;
      console.error("Recognition error:", err);
      toast.error(err.message || "Failed to recognize breed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const confirmBreed = async () => {
    if (!result) return;
    try {
      const { error } = await supabase.functions.invoke("confirm-breed", {
        body: {
          prediction_id: result.prediction_id,
          confirmed_breed: selectedBreed || result.breed,
          cattle_id: confirmCattleId || null,
        },
      });
      if (error) throw error;
      toast.success(confirmCattleId ? "Confirmed and linked to cattle" : "Confirmation saved");
      qc.invalidateQueries({ queryKey: ["breed_predictions"] });
      qc.invalidateQueries({ queryKey: ["cattle"] });
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err.message || "Failed to confirm breed selection");
    }
  };

  // Get matching metadata from API response or catalog fallback
  const matchedCatalogInfo: BreedMetadata | null = result ? getMatchedBreedInfo(result.breed) : null;
  const apiBreedInfo = result?.breed_info;

  const displayAnimalType = apiBreedInfo?.animal_type || matchedCatalogInfo?.animalType || "Cattle";
  const displayRegion = apiBreedInfo?.region || matchedCatalogInfo?.origin || "Indian Subcontinent";
  const displayMilkYield = apiBreedInfo?.avg_milk_liters_per_day || matchedCatalogInfo?.avgMilkYield || "N/A";
  const displayLifespan = apiBreedInfo?.lifespan_years || matchedCatalogInfo?.lifespan || "15-20 years";
  const displayPrimaryUse = apiBreedInfo?.primary_use || matchedCatalogInfo?.primaryUse || "Dairy";
  const displayDescription = apiBreedInfo?.description || matchedCatalogInfo?.description || matchedCatalogInfo?.characteristics || "No description available";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Breed Recognition</h1>
          <p className="text-sm text-muted-foreground">
            Upload a cow or buffalo image to identify the breed using Roboflow AI model
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upload Image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors duration-200 cursor-pointer ${
                  dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById("file-input")?.click()}
              >
                {preview ? (
                  <img src={preview} alt="Preview" className="mx-auto max-h-56 rounded-lg object-cover" />
                ) : (
                  <div className="space-y-3">
                    <div className="mx-auto w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">Drag & drop a cattle/buffalo image here</p>
                    <p className="text-xs text-muted-foreground">or click to browse (max 10MB)</p>
                  </div>
                )}
                <input
                  id="file-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>
              <Button className="w-full" disabled={!file || loading} onClick={recognize}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing with Roboflow...
                  </>
                ) : (
                  <>
                    <ScanSearch className="mr-2 h-4 w-4" /> Identify Breed
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Prediction Result</CardTitle>
            </CardHeader>
            <CardContent>
              {result ? (
                <div className="space-y-4">
                  <div className="text-center p-4 bg-primary/5 rounded-xl border border-primary/10">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Predicted Breed</p>
                    <p className="text-3xl font-extrabold text-primary mt-1">{result.breed}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Confidence</span>
                      <span className="font-bold">{formatConfidenceText(result.confidence)}</span>
                    </div>
                    <Progress value={getConfidencePercentage(result.confidence)} className="h-2.5" />
                  </div>

                  {result.warning && (
                    <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <span>{result.warning}</span>
                    </div>
                  )}

                  {/* Breed Metadata Details */}
                  <div className="space-y-3 pt-2 border-t">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Breed Information</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="p-2.5 bg-muted/40 rounded-lg">
                        <p className="text-xs text-muted-foreground">Animal Type</p>
                        <p className="font-medium mt-0.5">{displayAnimalType}</p>
                      </div>
                      <div className="p-2.5 bg-muted/40 rounded-lg">
                        <p className="text-xs text-muted-foreground">Region / Origin</p>
                        <p className="font-medium mt-0.5">{displayRegion}</p>
                      </div>
                      <div className="p-2.5 bg-muted/40 rounded-lg">
                        <p className="text-xs text-muted-foreground">Avg Milk Production</p>
                        <p className="font-medium mt-0.5">{displayMilkYield}</p>
                      </div>
                      <div className="p-2.5 bg-muted/40 rounded-lg">
                        <p className="text-xs text-muted-foreground">Lifespan</p>
                        <p className="font-medium mt-0.5">{displayLifespan}</p>
                      </div>
                      <div className="p-2.5 bg-muted/40 rounded-lg col-span-2">
                        <p className="text-xs text-muted-foreground">Primary Use</p>
                        <p className="font-medium mt-0.5">{displayPrimaryUse}</p>
                      </div>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-lg text-xs space-y-1">
                      <p className="font-semibold text-muted-foreground">Description</p>
                      <p className="text-muted-foreground leading-relaxed">{displayDescription}</p>
                    </div>
                  </div>

                  {/* Confirmation Section */}
                  <div className="space-y-2 pt-2 border-t">
                    <Label className="text-xs font-medium">Confirm Breed</Label>
                    <Select value={selectedBreed} onValueChange={setSelectedBreed}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {breeds.map((b) => (
                          <SelectItem key={b} value={b}>
                            {b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {confirmCattleId && (
                    <div className="space-y-2 pt-2 border-t">
                      <Label className="text-xs font-medium">Confirm & link to cattle record (optional)</Label>
                      <div className="flex gap-2">
                        <Select value={confirmCattleId} onValueChange={setConfirmCattleId}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select cattle..." />
                          </SelectTrigger>
                          <SelectContent>
                            {cattle.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name} ({c.tag})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button onClick={confirmBreed} variant="secondary">
                          <Check className="mr-1 h-4 w-4" /> Confirm
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground text-sm text-center px-4 space-y-2 border-2 border-dashed rounded-xl">
                  <ScanSearch className="h-8 w-8 text-muted-foreground/50" />
                  <p className="font-medium">No Prediction Yet</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Upload a cattle image on the left and click "Identify Breed" to run Roboflow vision AI
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Previous Predictions Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Previous Predictions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {predictions.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">No predictions yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Predicted Breed</TableHead>
                    <TableHead>Confirmed Breed</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {predictions.map((p: PredictionRow) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.predicted_breed}</TableCell>
                      <TableCell className="text-muted-foreground">{p.confirmed_breed ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={getConfidencePercentage(p.confidence)} className="h-2 w-20" />
                          <span className="text-sm">{formatConfidenceText(p.confidence)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default BreedRecognition;
