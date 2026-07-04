import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NutrientRing } from "@/components/NutrientRing";
import { Camera, MessageSquare, ChefHat, TrendingUp, Sparkles, Award } from "lucide-react";

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

  const { data: meals } = useQuery({
    queryKey: ["meals-today"],
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("meals").select("*")
        .gte("consumed_at", start.toISOString())
        .order("consumed_at", { ascending: false });
      return data ?? [];
    },
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
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <TrendingUp className="h-4 w-4 text-primary" /> Today's log
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
