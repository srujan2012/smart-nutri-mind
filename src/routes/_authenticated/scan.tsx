import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { analyzeMeal, addToMeal } from "@/lib/nutrition.functions";
import { fileToCompressedDataUrl } from "@/lib/image-compress";
import {
  Camera, Upload, Sparkles, ArrowRight, AlertCircle, CheckCircle2,
  Lightbulb, Plus, TrendingDown, TrendingUp, Clock, Check, Droplets, X, ZoomIn,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/scan")({
  component: Scan,
});

type Analysis = Awaited<ReturnType<typeof analyzeMeal>>;

function Scan() {
  const router = useRouter();
  const analyze = useServerFn(analyzeMeal);
  const addItem = useServerFn(addToMeal);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);
  const [mealId, setMealId] = useState<string | null>(null);
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState(false);

  const onFile = async (file: File) => {
    setPreparing(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file, { maxSize: 1280, quality: 0.82 });
      setPreview(dataUrl);
      setResult(null);
      setMealId(null);
      setAddedKeys(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read image");
    } finally {
      setPreparing(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  };

  const run = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const r = await analyze({ data: { imageDataUrl: preview, note } });
      setResult(r);
      setMealId(r.meal_id);
      toast.success("Meal analyzed & logged");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const addToCurrentMeal = async (
    item: { name: string; amount: string; calories: number; protein?: number; carbs?: number; fat?: number; fiber?: number },
    key: string,
  ) => {
    if (!mealId) return toast.error("Meal not saved yet");
    setAddingKey(key);
    try {
      await addItem({ data: { mealId, item } });
      setAddedKeys((s) => new Set(s).add(key));
      toast.success(`Added ${item.name} to this meal`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add");
    } finally {
      setAddingKey(null);
    }
  };

  const reset = () => {
    setPreview(null); setResult(null); setNote(""); setMealId(null); setAddedKeys(new Set());
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-primary">
          <Sparkles className="h-3 w-3" /> AI meal recognition
        </div>
        <h1 className="mt-1 font-display text-3xl font-bold">Scan your meal</h1>
        <p className="text-sm text-muted-foreground">
          Snap a photo — AI identifies foods, portions, imbalances, and what to add.
        </p>
      </div>

      {!preview && (
        <div className="glass-strong rounded-3xl border-2 border-dashed border-primary/40 p-8 sm:p-12">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-full bg-primary/15 p-5">
              <Camera className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="font-display text-lg font-semibold">Capture your meal</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Best for meal scanning: rear camera, full plate in frame, bright light
              </div>
            </div>
            {preparing && (
              <div className="flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs text-accent">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                Compressing photo for phone upload…
              </div>
            )}
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground glow-neon"
              >
                <Camera className="h-4 w-4" /> Take photo
              </button>
              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-full border border-border px-6 py-3 text-sm"
              >
                <Upload className="h-4 w-4" /> Choose from gallery
              </button>
            </div>
            <input
              ref={cameraRef}
              type="file" accept="image/*" capture="environment"
              hidden
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
            <input
              ref={galleryRef}
              type="file" accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </div>
          <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-left text-xs">
            <div className="mb-2 flex items-center gap-2 font-semibold text-primary">
              <Lightbulb className="h-3.5 w-3.5" /> Guided capture checklist
            </div>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              <li className="flex items-start gap-2"><span className="text-primary">◉</span> Use rear camera, hold phone 20–30cm above the plate</li>
              <li className="flex items-start gap-2"><span className="text-primary">◉</span> Bright natural light on the food — avoid harsh shadows</li>
              <li className="flex items-start gap-2"><span className="text-primary">◉</span> Shoot straight down (top-down) for best portion estimates</li>
              <li className="flex items-start gap-2"><span className="text-primary">◉</span> Include the whole plate & any drink/side in one frame</li>
            </ul>
          </div>

        </div>
      )}

      {preview && !result && (
        <div className="space-y-4">
          <div className="glass-strong overflow-hidden rounded-3xl relative">
            <button
              type="button"
              onClick={() => setLightbox(true)}
              className="block w-full text-left"
              aria-label="View meal photo full-size"
            >
              <img src={preview} alt="Meal preview" className="w-full max-h-96 object-cover" />
              <span className="absolute right-3 top-3 rounded-full bg-background/70 p-1.5 text-primary">
                <ZoomIn className="h-4 w-4" />
              </span>
            </button>
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (optional) — e.g. 'grilled, no oil'"
            className="w-full rounded-2xl border border-border bg-input/40 px-4 py-3 text-sm focus:border-primary focus:outline-none"
          />
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="rounded-full border border-border px-5 py-2 text-sm"
            >
              Retake
            </button>
            <button
              onClick={run}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground glow-neon disabled:opacity-60"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  AI reasoning…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Analyze with AI
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="glass-strong overflow-hidden rounded-3xl">
            <button
              type="button"
              onClick={() => setLightbox(true)}
              className="relative block w-full text-left"
              aria-label="View meal photo full-size"
            >
              <img src={preview!} alt={`Photo of ${result.name}`} className="w-full max-h-64 object-cover" />
              <span className="absolute right-3 top-3 rounded-full bg-background/70 p-1.5 text-primary">
                <ZoomIn className="h-4 w-4" />
              </span>
            </button>
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Detected</div>
                  <h2 className="font-display text-2xl font-bold">{result.name}</h2>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(result.foods ?? []).map((f, i) => (
                      <span key={i} className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                        {f.name} · {f.portion}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] uppercase text-muted-foreground">Score</div>
                  <div className="font-display text-4xl font-bold text-gradient">{result.meal_score}</div>
                  <div className="text-xs text-primary">Grade {result.grade}</div>
                </div>
              </div>
          </div>

          {(result.foods ?? []).length > 0 && (
            <div className="glass rounded-3xl p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
                <Sparkles className="h-4 w-4" /> What the AI saw in your photo
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Every recommendation below traces back to these detected items. Tap the image above to view full-size and verify.
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {result.foods.map((f, i) => (
                  <li key={i} className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/30 p-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-mono text-primary">{i + 1}</span>
                      <span className="font-semibold">{f.name}</span>
                      <span className="text-muted-foreground">· {f.portion}</span>
                    </div>
                    <span className="font-mono text-primary">{Math.round(f.calories)} kcal</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                AI confidence: {(result.confidence * 100).toFixed(0)}%
              </div>
            </div>
          )}
          </div>

          <ul
            className="glass grid grid-cols-2 gap-3 rounded-3xl p-4 md:grid-cols-5"
            aria-label="Meal macronutrient totals"
          >
            {[
              { l: "Cal", full: "Calories", v: result.calories, u: "kcal" },
              { l: "Protein", full: "Protein", v: result.protein, u: "grams" },
              { l: "Carbs", full: "Carbohydrates", v: result.carbs, u: "grams" },
              { l: "Fat", full: "Fat", v: result.fat, u: "grams" },
              { l: "Fiber", full: "Fiber", v: result.fiber, u: "grams" },
            ].map((s) => (
              <li
                key={s.l}
                tabIndex={0}
                aria-label={`${s.full}: ${Math.round(s.v)} ${s.u}`}
                className="text-center rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="text-[10px] uppercase text-muted-foreground">{s.l}</div>
                <div className="font-display text-xl">{Math.round(s.v)}{s.u === "grams" ? "g" : ""}</div>
              </li>
            ))}
          </ul>

          {result.plate_balance?.length > 0 && (
            <div className="glass rounded-3xl p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
                <Sparkles className="h-4 w-4" /> Plate balance
              </div>
              <div className="space-y-3">
                {result.plate_balance.map((b, i) => {
                  const max = Math.max(b.current, b.target_for_meal, 1);
                  const pct = Math.min(100, Math.round((b.current / max) * 100));
                  const tone = b.status === "high" ? "bg-destructive" : b.status === "low" ? "bg-warning" : "bg-primary";
                  return (
                    <div
                      key={i}
                      tabIndex={0}
                      role="group"
                      aria-label={`${b.nutrient} is ${b.status}. Current ${Math.round(b.current)}, target ${Math.round(b.target_for_meal)}. ${b.explanation}`}
                      className="rounded-2xl border border-border/60 p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{b.nutrient}</div>
                          <div className="text-xs text-muted-foreground">{b.explanation}</div>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${
                          b.status === "high" ? "bg-destructive/20 text-destructive" : b.status === "low" ? "bg-warning/20 text-warning" : "bg-primary/15 text-primary"
                        }`}>
                          {b.status}
                        </span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                        <span>{Math.round(b.current)} now</span>
                        <span>{Math.round(b.target_for_meal)} target · gap {Math.round(Math.abs(b.gap))}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {result.water_recommendation_ml && (
            <div className="glass rounded-3xl p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-accent">
                <Droplets className="h-4 w-4" /> Water recommendation
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Target today: <span className="font-mono text-foreground">{result.water_recommendation_ml} ml</span>. If this meal is salty or high-protein, add 300–500 ml over the next hour.
              </div>
            </div>
          )}

          {result.imbalances?.length > 0 && (
            <div className="glass rounded-3xl p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-warning">
                <AlertCircle className="h-4 w-4" /> Nutritional imbalances
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {result.imbalances.map((im, i) => (
                  <div key={i} className="rounded-2xl border border-border/60 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        {im.status === "low" ? (
                          <TrendingDown className="h-4 w-4 text-warning" />
                        ) : (
                          <TrendingUp className="h-4 w-4 text-destructive" />
                        )}
                        {im.nutrient}
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${
                        im.severity === "severe"
                          ? "bg-destructive/20 text-destructive"
                          : im.severity === "moderate"
                          ? "bg-warning/20 text-warning"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {im.severity} · {im.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{im.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.add_to_this_meal?.length > 0 && (
            <div className="glass rounded-3xl border border-primary/30 p-5">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-primary">
                <Plus className="h-4 w-4" /> Add to THIS meal to balance it
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Tap to log an item onto your current plate.
              </p>
              <div className="space-y-2">
                {result.add_to_this_meal.map((it, i) => {
                  const key = `now-${i}-${it.name}`;
                  const added = addedKeys.has(key);
                  return (
                    <div
                      key={key}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 p-3"
                      title={`Nutrient impact — +${Math.round(it.calories)} kcal · Protein +${Math.round(it.protein ?? 0)}g · Carbs +${Math.round(it.carbs ?? 0)}g · Fat +${Math.round(it.fat ?? 0)}g · Fiber +${Math.round(it.fiber ?? 0)}g${it.nutrients_balanced?.length ? ` — closes gap in ${it.nutrients_balanced.join(", ")}` : ""}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm">{it.name} <span className="text-muted-foreground font-normal">· {it.amount}</span></div>
                        <div className="text-xs text-muted-foreground">Fixes: {it.fixes}</div>
                        {it.nutrients_balanced?.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {it.nutrients_balanced.map((n) => (
                              <span key={n} className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] text-accent">{n}</span>
                            ))}
                          </div>
                        )}
                        <details className="mt-1.5">
                          <summary className="cursor-pointer text-[10px] uppercase tracking-widest text-primary">Why this closes the gap</summary>
                          <div className="mt-1 rounded-xl bg-background/40 p-2 text-[11px] text-muted-foreground">
                            Adds <span className="text-foreground font-mono">+{Math.round(it.calories)} kcal</span>, protein <span className="text-foreground font-mono">+{Math.round(it.protein ?? 0)}g</span>, carbs <span className="text-foreground font-mono">+{Math.round(it.carbs ?? 0)}g</span>, fat <span className="text-foreground font-mono">+{Math.round(it.fat ?? 0)}g</span>, fiber <span className="text-foreground font-mono">+{Math.round(it.fiber ?? 0)}g</span>.
                            {it.nutrients_balanced?.length ? <> Directly rebalances <span className="text-accent">{it.nutrients_balanced.join(", ")}</span> on this plate.</> : null}
                          </div>
                        </details>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {previewKey === key && !added ? (
                          <>
                            <div className="rounded-xl border border-primary/40 bg-primary/10 p-2 text-right text-[10px] leading-tight text-foreground">
                              <div className="font-semibold text-primary">Impact preview</div>
                              <div className="font-mono">+{Math.round(it.calories)} kcal</div>
                              <div className="font-mono">P +{Math.round(it.protein ?? 0)}g · C +{Math.round(it.carbs ?? 0)}g</div>
                              <div className="font-mono">F +{Math.round(it.fat ?? 0)}g · Fib +{Math.round(it.fiber ?? 0)}g</div>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => setPreviewKey(null)}
                                className="rounded-full border border-border px-2 py-1 text-[10px]"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => { setPreviewKey(null); addToCurrentMeal(it, key); }}
                                disabled={addingKey === key || !mealId}
                                className="rounded-full bg-primary px-3 py-1 text-[10px] font-semibold text-primary-foreground glow-neon disabled:opacity-60"
                              >
                                {addingKey === key ? "Adding…" : "Confirm add"}
                              </button>
                            </div>
                          </>
                        ) : (
                          <button
                            onClick={() => (added ? null : setPreviewKey(key))}
                            disabled={added || addingKey === key || !mealId}
                            title="Preview macro impact before adding to your current meal"
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                              added ? "bg-primary/20 text-primary" : "bg-primary text-primary-foreground glow-neon"
                            } disabled:opacity-60`}
                          >
                            {added ? (<><Check className="mr-1 inline h-3 w-3" />Added</>) : (<><Plus className="mr-1 inline h-3 w-3" />Preview & add</>)}
                          </button>
                        )}
                      </div>
          )}

          {result.add_to_next_meal?.length > 0 && (
            <div className="glass rounded-3xl p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-accent">
                <Clock className="h-4 w-4" /> Add to your NEXT meal
              </div>
              <div className="space-y-2">
                {result.add_to_next_meal.map((it, i) => (
                  <div key={i} className="rounded-2xl border border-border/60 p-3">
                    <div className="text-sm font-semibold">{it.name} <span className="text-muted-foreground font-normal">· {it.amount}</span></div>
                    <div className="text-xs text-muted-foreground">Fixes: {it.fixes}</div>
                      {it.prevents_gap && (
                        <div className="mt-1 text-xs text-accent">Prevents gap: {it.prevents_gap}</div>
                      )}
                      {it.nutrients_balanced?.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {it.nutrients_balanced.map((n) => (
                            <span key={n} className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] text-accent">{n}</span>
                          ))}
                        </div>
                      )}
                    {it.calories > 0 && (
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          ≈ {Math.round(it.calories)} kcal · P {Math.round(it.protein ?? 0)}g · C {Math.round(it.carbs ?? 0)}g · F {Math.round(it.fat ?? 0)}g · Fiber {Math.round(it.fiber ?? 0)}g
                        </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.highlights?.length > 0 && (
            <div className="glass rounded-3xl p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
                <CheckCircle2 className="h-4 w-4" /> What's good
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {result.highlights.map((h, i) => <li key={i}>• {h}</li>)}
              </ul>
            </div>
          )}

          {result.concerns?.length > 0 && (
            <div className="glass rounded-3xl border-warning/30 p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-warning">
                <AlertCircle className="h-4 w-4" /> Watch outs
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {result.concerns.map((h, i) => <li key={i}>• {h}</li>)}
              </ul>
            </div>
          )}

          {result.recommendations?.length > 0 && (
            <div className="glass rounded-3xl p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-accent">
                <Lightbulb className="h-4 w-4" /> Explainable recommendations
              </div>
              <div className="space-y-3">
                {result.recommendations.map((r, i) => {
                  const diff = r.recommended - r.current;
                  const isLow = diff > 0;
                  return (
                    <div key={i} className="rounded-2xl border border-border/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-widest text-muted-foreground">
                            {r.nutrient}
                          </div>
                          <div className="mt-1 font-mono text-sm">
                            <span className={isLow ? "text-warning" : "text-primary"}>
                              {r.current}
                            </span>
                            <span className="text-muted-foreground"> / {r.recommended}</span>
                            <span className={`ml-2 ${isLow ? "text-warning" : "text-primary"}`}>
                              {isLow ? "−" : "+"}{Math.abs(diff)}
                            </span>
                          </div>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[10px] uppercase ${
                          r.priority === "now"
                            ? "bg-destructive/20 text-destructive"
                            : r.priority === "next-meal"
                            ? "bg-warning/20 text-warning"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {r.priority}
                        </span>
                      </div>
                      <p className="mt-2 text-sm">{r.action}</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                AI confidence: {(result.confidence * 100).toFixed(0)}%
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={reset} className="rounded-full border border-border px-5 py-3 text-sm">
              Scan another
            </button>
            <button
              onClick={() => router.navigate({ to: "/dashboard" })}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground glow-neon"
            >
              View day <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {lightbox && preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Meal photo, full-size"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4"
          onClick={() => setLightbox(false)}
          onKeyDown={(e) => e.key === "Escape" && setLightbox(false)}
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightbox(false); }}
            aria-label="Close full-size photo"
            className="absolute right-4 top-4 rounded-full border border-border bg-background/80 p-2 text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={preview}
            alt={result ? `Photo of ${result.name}, full-size` : "Meal photo, full-size"}
            className="max-h-full max-w-full rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
