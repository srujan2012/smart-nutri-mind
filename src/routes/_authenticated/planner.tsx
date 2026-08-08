import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateMealPlan } from "@/lib/nutrition.functions";
import { ChefHat, Clock, IndianRupee, ShoppingCart, Sparkles, Target, TimerReset, Utensils } from "lucide-react";
import { toast } from "sonner";
import { HealthSafetyBanner } from "@/components/HealthSafetyBanner";

export const Route = createFileRoute("/_authenticated/planner")({
  component: Planner,
});

type PlanMeal = {
  slot: string; name: string; why: string;
  gap_coverage?: string[]; meal_timing?: string; recovery_note?: string;
  ingredients: { name: string; amount: string }[];
  calories: number; protein: number; carbs: number; fat: number; fiber: number;
  prep_minutes: number; est_cost: number; instructions: string;
};

type Plan = Awaited<ReturnType<typeof generateMealPlan>>;

function Planner() {
  const gen = useServerFn(generateMealPlan);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const r = await gen();
      setPlan(r);
      if (r.grocery_items.length > 0) toast.success("Plan generated and grocery list updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Plan failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <HealthSafetyBanner context="diet" />
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-primary">
            <Sparkles className="h-3 w-3" /> Adaptive meal planner
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold">Rebalance the day</h1>
          <p className="text-sm text-muted-foreground">
            The AI fills your remaining nutrition gaps with meals tuned to your diet, budget & goals.
          </p>
        </div>
        <button
          onClick={run} disabled={loading}
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground glow-neon disabled:opacity-60"
        >
          {loading ? "Planning…" : "Generate plan"}
        </button>
      </div>

      {!plan && !loading && (
        <div className="glass rounded-3xl p-16 text-center">
          <ChefHat className="mx-auto h-10 w-10 text-primary/70" />
          <div className="mt-3 text-sm text-muted-foreground">
            No plan yet. Tap generate — AI will use your latest fridge scan, grocery gaps, and daily targets.
          </div>
        </div>
      )}

      {loading && (
        <div className="glass rounded-3xl p-16 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <div className="mt-4 text-sm text-muted-foreground">Reasoning about your day…</div>
        </div>
      )}

      {plan && (
        <div className="space-y-4">
          <div className="glass rounded-3xl p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
              <Target className="h-4 w-4" /> Remaining daily targets
            </div>
            <div className="grid grid-cols-2 gap-3 text-center text-xs md:grid-cols-5">
              {[
                { l: "Calories", v: plan.remaining.calories, u: "kcal" },
                { l: "Protein", v: plan.remaining.protein, u: "g" },
                { l: "Carbs", v: plan.remaining.carbs, u: "g" },
                { l: "Fats", v: plan.remaining.fat, u: "g" },
                { l: "Fiber", v: plan.remaining.fiber, u: "g" },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl border border-border/60 bg-background/30 p-3">
                  <div className="font-display text-lg">{Math.round(s.v)}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">{s.l} {s.u}</div>
                </div>
              ))}
            </div>
          </div>

          {plan.next_meal_recommendations.length > 0 && (
            <div className="glass rounded-3xl p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-accent">
                <TimerReset className="h-4 w-4" /> Next-meal gap prevention
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {plan.next_meal_recommendations.map((r, i) => (
                  <div key={i} className="rounded-2xl border border-border/60 p-3">
                    <div className="text-sm font-semibold">{r.name} <span className="font-normal text-muted-foreground">· {r.amount}</span></div>
                    <div className="mt-1 text-xs text-muted-foreground">{r.prevents_gap || r.fixes}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.nutrients_balanced.map((n) => (
                        <span key={n} className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] text-accent">{n}</span>
                      ))}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {Math.round(r.calories)} kcal · P {Math.round(r.protein)}g · C {Math.round(r.carbs)}g · F {Math.round(r.fat)}g · Fiber {Math.round(r.fiber)}g
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {plan.grocery_items.length > 0 && (
            <div className="glass rounded-3xl p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-warning">
                <ShoppingCart className="h-4 w-4" /> Grocery list updated
              </div>
              <div className="flex flex-wrap gap-2">
                {plan.grocery_items.map((g, i) => (
                  <span key={i} className="rounded-full border border-border px-3 py-1 text-xs">
                    {g.name}{g.amount ? ` · ${g.amount}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
          {plan.meals.map((m: PlanMeal, i) => (
            <div key={i} className="glass rounded-3xl p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-primary">{m.slot}</div>
                  <h3 className="font-display text-xl font-bold">{m.name}</h3>
                </div>
                <div className="text-right text-xs">
                  <div className="flex items-center justify-end gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" /> {m.prep_minutes}m
                  </div>
                  <div className="flex items-center justify-end gap-1 text-primary">
                    <IndianRupee className="h-3 w-3" /> {m.est_cost}
                  </div>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground italic">{m.why}</p>

              <div className="mt-3 grid gap-2 text-xs">
                {m.meal_timing && (
                  <div className="rounded-2xl border border-border/60 bg-background/30 p-3">
                    <span className="font-semibold text-primary">Timing:</span> {m.meal_timing}
                  </div>
                )}
                {m.recovery_note && (
                  <div className="rounded-2xl border border-border/60 bg-background/30 p-3">
                    <span className="font-semibold text-accent">Recovery:</span> {m.recovery_note}
                  </div>
                )}
              </div>

              <div className="mt-3 grid grid-cols-5 gap-2 rounded-2xl bg-background/40 p-3 text-center text-xs">
                {[
                  { l: "kcal", v: m.calories },
                  { l: "P", v: m.protein },
                  { l: "C", v: m.carbs },
                  { l: "F", v: m.fat },
                  { l: "fib", v: m.fiber },
                ].map((s) => (
                  <div key={s.l}>
                    <div className="font-display text-sm">{Math.round(s.v)}</div>
                    <div className="text-[9px] text-muted-foreground">{s.l}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium">
                  <Utensils className="h-3 w-3 text-primary" /> Ingredients
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {m.ingredients.map((ing, j) => (
                    <span key={j} className="rounded-full bg-primary/10 px-3 py-1 text-xs">
                      {ing.name} <span className="text-muted-foreground">· {ing.amount}</span>
                    </span>
                  ))}
                </div>
              </div>

              {m.gap_coverage && m.gap_coverage.length > 0 && (
                <div className="mt-3">
                  <div className="mb-2 text-xs font-medium text-accent">Gaps covered</div>
                  <div className="flex flex-wrap gap-1.5">
                    {m.gap_coverage.map((g) => (
                      <span key={g} className="rounded-full bg-accent/10 px-3 py-1 text-xs text-accent">{g}</span>
                    ))}
                  </div>
                </div>
              )}

              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-xs text-accent hover:underline">Cooking steps</summary>
                <p className="mt-2 whitespace-pre-line text-muted-foreground">{m.instructions}</p>
              </details>
            </div>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
