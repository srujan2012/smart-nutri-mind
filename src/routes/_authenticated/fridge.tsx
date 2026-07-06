import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { scanFridge } from "@/lib/nutrition.functions";
import { fileToCompressedDataUrl } from "@/lib/image-compress";
import {
  Refrigerator, Camera, Upload, Sparkles, ShoppingCart, ChefHat, Clock, Flame, Star, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/fridge")({
  component: Fridge,
});

type Scan = Awaited<ReturnType<typeof scanFridge>>;
type GroceryItem = { name: string; amount?: string; reason?: string; nutrients?: string[] };

function groceryLabel(item: string | GroceryItem) {
  if (typeof item === "string") return item;
  return [item.name, item.amount].filter(Boolean).join(" · ");
}

function Fridge() {
  const scan = useServerFn(scanFridge);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Scan | null>(null);

  const onFile = async (file: File) => {
    try {
      const dataUrl = await fileToCompressedDataUrl(file, { maxSize: 1280, quality: 0.82 });
      setPreview(dataUrl);
      setResult(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read image");
    }
  };

  const run = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const r = await scan({ data: { imageDataUrl: preview, note } });
      setResult(r);
      toast.success("Fridge scanned, planner and grocery list updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setPreview(null); setResult(null); setNote(""); };

  const meals = (result?.meal_ideas ?? []).slice().sort((a, b) => b.fits_goal_score - a.fits_goal_score);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-primary">
          <Sparkles className="h-3 w-3" /> AI pantry vision
        </div>
        <h1 className="mt-1 font-display text-3xl font-bold">Scan your fridge</h1>
        <p className="text-sm text-muted-foreground">
          Show us what you have — we'll tell you what to cook, ranked for your goal.
        </p>
      </div>

      {!preview && (
        <div className="glass-strong rounded-3xl border-2 border-dashed border-primary/40 p-8 sm:p-12">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-full bg-primary/15 p-5">
              <Refrigerator className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="font-display text-lg font-semibold">Open the fridge, snap the shelves</div>
              <div className="mt-1 text-xs text-muted-foreground">Include as many items as possible in one shot</div>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={() => cameraRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground glow-neon"
              >
                <Camera className="h-4 w-4" /> Take photo
              </button>
              <button
                onClick={() => galleryRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-full border border-border px-6 py-3 text-sm"
              >
                <Upload className="h-4 w-4" /> Choose from gallery
              </button>
            </div>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            <input ref={galleryRef} type="file" accept="image/*" hidden
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </div>
        </div>
      )}

      {preview && !result && (
        <div className="space-y-4">
          <div className="glass-strong overflow-hidden rounded-3xl">
            <img src={preview} alt="" className="w-full max-h-96 object-cover" />
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional: cravings, time you have, cuisine…"
            className="w-full rounded-2xl border border-border bg-input/40 px-4 py-3 text-sm focus:border-primary focus:outline-none"
          />
          <div className="flex gap-3">
            <button onClick={reset} className="rounded-full border border-border px-5 py-2 text-sm">Retake</button>
            <button
              onClick={run}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground glow-neon disabled:opacity-60"
            >
              {loading ? (
                <><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> Cooking ideas…</>
              ) : (<><Sparkles className="h-4 w-4" /> Find meals I can cook</>)}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="glass-strong overflow-hidden rounded-3xl">
            <img src={preview!} alt="" className="w-full max-h-56 object-cover" />
            <div className="p-5">
              <div className="text-xs text-muted-foreground">Detected {result.items.length} ingredients</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {result.items.map((it, i) => (
                  <span
                    key={i}
                    className={`rounded-full px-3 py-1 text-xs ${
                      it.freshness === "use-soon"
                        ? "bg-warning/15 text-warning"
                        : it.freshness === "check"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {it.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {result.grocery_items?.length > 0 && (
            <div className="glass rounded-3xl p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-accent">
                <ShoppingCart className="h-4 w-4" /> Added to grocery list
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {result.grocery_items.map((s, i) => (
                  <div key={i} className="rounded-2xl border border-border/60 p-3 text-xs">
                    <div className="flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="h-3 w-3 text-primary" /> {groceryLabel(s)}
                    </div>
                    {typeof s !== "string" && s.reason && (
                      <div className="mt-1 text-muted-foreground">{s.reason}</div>
                    )}
                    {typeof s !== "string" && s.nutrients?.length ? (
                      <div className="mt-1 text-[10px] text-accent">Balances {s.nutrients.join(", ")}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <ChefHat className="h-4 w-4 text-primary" /> Ranked meal ideas
              {result.best_pick && (
                <span className="ml-auto rounded-full bg-primary/15 px-3 py-1 text-[10px] uppercase text-primary">
                  Top pick: {result.best_pick}
                </span>
              )}
            </div>
            <div className="space-y-3">
              {meals.map((m, i) => {
                const isTop = m.name === result.best_pick || i === 0;
                return (
                  <div
                    key={i}
                    className={`glass rounded-3xl p-5 ${isTop ? "border border-primary/50 glow-neon" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          {isTop && <Star className="h-4 w-4 fill-primary text-primary" />}
                          <h3 className="font-display text-lg font-bold">{m.name}</h3>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase">{m.slot}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{m.why}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase text-muted-foreground">Fit</div>
                        <div className="font-display text-2xl text-gradient">{m.fits_goal_score}</div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-6">
                      <div><div className="text-muted-foreground">Kcal</div><div className="font-mono">{Math.round(m.calories)}</div></div>
                      <div><div className="text-muted-foreground">P</div><div className="font-mono">{Math.round(m.protein)}g</div></div>
                      <div><div className="text-muted-foreground">C</div><div className="font-mono">{Math.round(m.carbs)}g</div></div>
                      <div><div className="text-muted-foreground">F</div><div className="font-mono">{Math.round(m.fat)}g</div></div>
                      <div><div className="text-muted-foreground">Fiber</div><div className="font-mono">{Math.round(m.fiber)}g</div></div>
                      <div><div className="text-muted-foreground flex items-center justify-center gap-1"><Clock className="h-3 w-3" />Prep</div><div className="font-mono">{m.prep_minutes}m</div></div>
                    </div>

                    <div className="mt-3">
                      <div className="text-[10px] uppercase text-muted-foreground">Uses</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {m.uses.map((u, j) => (
                          <span key={j} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">{u}</span>
                        ))}
                      </div>
                    </div>

                    {m.needs?.length > 0 && (
                      <div className="mt-2">
                        <div className="text-[10px] uppercase text-warning">Also needs</div>
                        <div className="mt-1 grid gap-1 sm:grid-cols-2">
                          {m.needs.map((u, j) => (
                            <div key={j} className="rounded-xl bg-warning/10 px-2 py-1 text-[11px] text-warning">
                              <div>{groceryLabel(u)}</div>
                              {typeof u !== "string" && u.nutrients?.length ? (
                                <div className="text-[10px] text-muted-foreground">Fills {u.nutrients.join(", ")}</div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {m.gap_coverage?.length > 0 && (
                      <div className="mt-2">
                        <div className="text-[10px] uppercase text-accent">Nutrition gaps covered</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {m.gap_coverage.map((g, j) => (
                            <span key={j} className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">{g}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 rounded-2xl border border-border/60 bg-background/30 p-3 text-xs">
                      <div className="mb-1 flex items-center gap-1 font-semibold"><Flame className="h-3 w-3 text-primary" /> Steps</div>
                      <p className="text-muted-foreground">{m.instructions}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button onClick={reset} className="w-full rounded-full border border-border px-5 py-3 text-sm">
            Scan another shelf
          </button>
        </div>
      )}
    </div>
  );
}
