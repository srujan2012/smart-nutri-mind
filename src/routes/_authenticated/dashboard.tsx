import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NutrientRing } from "@/components/NutrientRing";
import { DailyVitals } from "@/components/DailyVitals";
import { Camera, MessageSquare, ChefHat, TrendingUp, Sparkles, Award, Droplets, Clock, HeartPulse, Target, Flame, Beef, Wheat, Salad, Nut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return data;
    },
  });

  const tz = profile?.timezone ?? undefined;
  const { data: meals } = useQuery({
    queryKey: ["meals-today", tz],
    queryFn: async () => {
      const now = new Date();
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz || undefined,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      }).formatToParts(now);
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
      const asUtc = Date.UTC(+get("year"), +get("month")-1, +get("day"), +get("hour"), +get("minute"), +get("second"));
      const offset = asUtc - now.getTime();
      const start = new Date(Date.UTC(+get("year"), +get("month")-1, +get("day")) - offset);
      const { data } = await supabase
        .from("meals").select("*")
        .gte("consumed_at", start.toISOString())
        .order("consumed_at", { ascending: false });
      return data ?? [];
    },
    enabled: profile !== undefined,
  });

  const totals = (meals ?? []).reduce(
    (a, m) => ({
      calories: a.calories + Number(m.calories ?? 0),
      protein: a.protein + Number(m.protein ?? 0),
      carbs: a.carbs + Number(m.carbs ?? 0),
      fat: a.fat + Number(m.fat ?? 0),
      fiber: a.fiber + Number(m.fiber ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );

  const avgScore = meals && meals.length
    ? Math.round(meals.reduce((a, m) => a + (m.meal_score ?? 0), 0) / meals.length)
    : 0;

  const water_ml = Math.round(Number(profile?.weight_kg ?? 70) * 35);
  const goal = profile?.goal ?? "maintain";
  const activity = profile?.activity_level ?? "moderate";

  const mealTiming = [
    { slot: "Breakfast", window: "7:00 – 9:00", note: "Protein + slow carbs to steady blood sugar" },
    { slot: "Lunch", window: "12:30 – 14:00", note: "Largest plate: protein, veg, complex carbs" },
    { slot: "Snack", window: "16:00 – 17:00", note: "Fiber + protein to prevent evening crash" },
    { slot: "Dinner", window: "19:00 – 20:30", note: "Lighter carbs, healthy fats, veg-forward" },
  ];

  const recoveryNote =
    activity === "athlete" || activity === "very"
      ? "Post-workout: 25–35g protein + 40–60g carbs within 45 min. Add electrolytes if sweat loss >1L."
      : goal === "gain" || goal === "recomp"
      ? "Post-training: 20–30g protein + 30g carbs. Sleep 7–9h to lock in gains."
      : "Rest day: prioritize fiber, omega-3s, and 7–9h sleep for recovery.";

  const targetCards = [
    { icon: Flame, label: "Calories", value: profile?.calorie_target ?? 2000, unit: "kcal", tone: "text-primary" },
    { icon: Beef, label: "Protein", value: profile?.protein_target ?? 100, unit: "g", tone: "text-accent" },
    { icon: Wheat, label: "Carbs", value: profile?.carbs_target ?? 250, unit: "g", tone: "text-warning" },
    { icon: Nut, label: "Healthy fats", value: profile?.fat_target ?? 70, unit: "g", tone: "text-warning" },
    { icon: Salad, label: "Fiber", value: profile?.fiber_target ?? 30, unit: "g", tone: "text-primary" },
    { icon: Droplets, label: "Water", value: water_ml, unit: "ml", tone: "text-accent" },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-primary">
            <Sparkles className="h-3 w-3" /> Today's intelligence
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold">
            Hi {profile?.full_name?.split(" ")[0] ?? "there"}
          </h1>
        </div>
        <Link
          to="/scan"
          className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground glow-neon"
        >
          <Camera className="h-4 w-4" /> Scan meal
        </Link>
      </div>

      {/* Vitals: hydration, sleep, readiness, streak, next best action */}
      <DailyVitals
        profile={profile}
        mealsLogged={meals?.length ?? 0}
        caloriesLogged={totals.calories}
        calorieTarget={profile?.calorie_target ?? 2000}
      />

      <AdaptiveTargets />



      {/* Rings row */}
      <div className="glass-strong rounded-3xl p-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <NutrientRing value={totals.calories} target={profile?.calorie_target ?? 2000} label="Calories" unit="" />
          <NutrientRing value={totals.protein} target={profile?.protein_target ?? 100} label="Protein" unit="g" color="accent" />
          <NutrientRing value={totals.carbs} target={profile?.carbs_target ?? 250} label="Carbs" unit="g" color="warning" />
          <NutrientRing value={totals.fat} target={profile?.fat_target ?? 70} label="Fat" unit="g" color="warning" />
          <NutrientRing value={totals.fiber} target={profile?.fiber_target ?? 30} label="Fiber" unit="g" color="primary" />
        </div>
      </div>

      {/* Daily Nutrition Targets */}
      <div className="glass-strong rounded-3xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Target className="h-4 w-4 text-primary" /> Daily nutrition targets
          </div>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Personalized for {goal} · {activity}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {targetCards.map((t) => (
            <div key={t.label} className="rounded-2xl border border-border/60 bg-background/30 p-3">
              <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-widest ${t.tone}`}>
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </div>
              <div className="mt-1 font-display text-xl font-bold">
                {t.value.toLocaleString()}
                <span className="ml-1 text-xs font-normal text-muted-foreground">{t.unit}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-background/30 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary">
              <Clock className="h-4 w-4" /> Meal timing
            </div>
            <ul className="space-y-1.5 text-xs">
              {mealTiming.map((m) => (
                <li key={m.slot} className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{m.slot}</div>
                    <div className="text-[11px] text-muted-foreground">{m.note}</div>
                  </div>
                  <div className="whitespace-nowrap font-mono text-[11px] text-accent">{m.window}</div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/30 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-accent">
              <HeartPulse className="h-4 w-4" /> Recovery nutrition
            </div>
            <p className="text-xs text-muted-foreground">{recoveryNote}</p>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
              <Droplets className="h-3.5 w-3.5 text-accent" />
              Sip {Math.round(water_ml / 250)} × 250ml glasses across the day
            </div>
          </div>
        </div>
      </div>

      {/* Athlete Mode training-day timeline */}
      {profile?.sport && (
        <div className="glass-strong rounded-3xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Sparkles className="h-4 w-4" /> Athlete mode · {profile.sport}
              {profile.sport_position ? <span className="text-muted-foreground font-normal">· {profile.sport_position}</span> : null}
            </div>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {profile.competition_level ?? "Recreational"} · {profile.training_days_per_week ?? 3}×/wk · {profile.training_hours_per_day ?? 1}h
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { title: "Pre-training (2–3h before)", body: "Complex carbs + moderate protein, low fat/fiber. e.g. oats + banana + whey, or rice + chicken + fruit." },
              { title: "During (>60 min)", body: "30–60g carbs/hour + electrolytes (300–600 mg sodium/L). Sports drink, dates, or gel." },
              { title: "Post-training (within 45 min)", body: `${Math.round(Number(profile.weight_kg ?? 70) * 0.3)}g protein + ${Math.round(Number(profile.weight_kg ?? 70) * 1)}g carbs. e.g. shake + rice bowl, or milk + fruit + toast.` },
            ].map((b) => (
              <div key={b.title} className="rounded-2xl border border-border/60 bg-background/30 p-4">
                <div className="text-[10px] uppercase tracking-widest text-accent">{b.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{b.body}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl bg-primary/5 p-3 text-[11px] text-muted-foreground">
            Session hydration: ~500ml 2h pre · 150–250ml every 15–20 min during · 1.25–1.5L per kg lost post-session. Add electrolytes if sweating heavily or over 60 min.
          </div>
        </div>
      )}




      {/* Quick actions + score */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass rounded-3xl p-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Award className="h-4 w-4 text-primary" /> Avg meal score today
          </div>
          <div className="mt-2 font-display text-5xl font-bold text-gradient">
            {avgScore || "—"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {meals?.length ?? 0} meals logged
          </div>
        </div>
        <Link to="/planner" className="glass rounded-3xl p-6 transition hover:border-accent/40">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ChefHat className="h-4 w-4 text-accent" /> Adaptive planner
          </div>
          <div className="mt-2 font-display text-lg">Rebalance my day</div>
          <div className="mt-1 text-xs text-muted-foreground">
            AI fills the gaps in remaining meals.
          </div>
        </Link>
        <Link to="/chat" className="glass rounded-3xl p-6 transition hover:border-primary/40">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MessageSquare className="h-4 w-4 text-primary" /> AI coach
          </div>
          <div className="mt-2 font-display text-lg">Ask anything</div>
          <div className="mt-1 text-xs text-muted-foreground">
            "What should I eat post-workout?"
          </div>
        </Link>
      </div>

      {/* Meal timeline */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="h-4 w-4 text-primary" /> Today's log
            <span className="ml-2 text-[10px] uppercase tracking-widest text-muted-foreground">auto-saves · rolls at midnight</span>
          </div>
          <Link to="/history" className="text-xs text-primary hover:underline">View history →</Link>
        </div>

        {(!meals || meals.length === 0) ? (
          <div className="glass rounded-3xl p-10 text-center">
            <div className="text-sm text-muted-foreground">No meals yet.</div>
            <Link
              to="/scan"
              className="mt-4 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              Scan your first meal
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {meals.map((m) => (
              <div key={m.id} className="glass flex items-center gap-4 rounded-2xl p-4">
                <div className="flex h-14 w-14 flex-col items-center justify-center rounded-xl bg-primary/10">
                  <span className="font-display text-xl font-bold text-primary">
                    {m.meal_score ?? "—"}
                  </span>
                  <span className="text-[9px] text-muted-foreground">SCORE</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{m.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {Math.round(Number(m.calories))} kcal · P {Math.round(Number(m.protein))}g · C {Math.round(Number(m.carbs))}g · F {Math.round(Number(m.fat))}g
                  </div>
                </div>
                <div className="hidden md:block text-xs text-muted-foreground">
                  {new Date(m.consumed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
