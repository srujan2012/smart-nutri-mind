import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { analyzeMeal } from "@/lib/nutrition.functions";
import { Camera, Upload, Sparkles, ArrowRight, AlertCircle, CheckCircle2, Lightbulb } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/scan")({
  component: Scan,
});

type Analysis = Awaited<ReturnType<typeof analyzeMeal>>;

function Scan() {
  const router = useRouter();
  const analyze = useServerFn(analyzeMeal);
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);

  const onFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
    setResult(null);
  };

  const run = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const r = await analyze({ data: { imageDataUrl: preview, note } });
      setResult(r);
      toast.success("Meal analyzed & logged");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setPreview(null); setResult(null); setNote(""); };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-primary">
          <Sparkles className="h-3 w-3" /> AI meal recognition
        </div>
        <h1 className="mt-1 font-display text-3xl font-bold">Scan your meal</h1>
        <p className="text-sm text-muted-foreground">
          Snap a photo — Gemini vision identifies foods, portions, and nutrients in seconds.
        </p>
      </div>

      {!preview && (
        <div
          onClick={() => inputRef.current?.click()}
          className="glass-strong flex cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-primary/40 p-16 transition hover:border-primary hover:glow-neon"
        >
          <div className="rounded-full bg-primary/15 p-5">
            <Camera className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <div className="font-display text-lg font-semibold">Tap to capture or upload</div>
            <div className="mt-1 text-xs text-muted-foreground">JPG or PNG · &lt; 10MB</div>
          </div>
          <input
            ref={inputRef}
            type="file" accept="image/*" capture="environment"
            hidden
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </div>
      )}

      {preview && !result && (
        <div className="space-y-4">
          <div className="glass-strong overflow-hidden rounded-3xl">
            <img src={preview} alt="Meal preview" className="w-full max-h-96 object-cover" />
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
            <img src={preview!} alt="" className="w-full max-h-64 object-cover" />
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
          </div>

          <div className="glass grid grid-cols-2 gap-3 rounded-3xl p-4 md:grid-cols-5">
            {[
              { l: "Cal", v: result.calories, u: "" },
              { l: "Protein", v: result.protein, u: "g" },
              { l: "Carbs", v: result.carbs, u: "g" },
              { l: "Fat", v: result.fat, u: "g" },
              { l: "Fiber", v: result.fiber, u: "g" },
            ].map((s) => (
              <div key={s.l} className="text-center">
                <div className="text-[10px] uppercase text-muted-foreground">{s.l}</div>
                <div className="font-display text-xl">{Math.round(s.v)}{s.u}</div>
              </div>
            ))}
          </div>

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
    </div>
  );
}
