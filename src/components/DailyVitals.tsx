import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Droplets, Moon, BatteryCharging, Flame, Scale, Plus, Minus, Sparkles, Camera, Dumbbell, Info,
} from "lucide-react";

export function localDateKey(tz?: string | null) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz || undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type Profile = {
  weight_kg?: number | null;
  timezone?: string | null;
  goal?: string | null;
  reminders_enabled?: boolean | null;
};

interface Props {
  profile: Profile | null | undefined;
  mealsLogged: number;
  caloriesLogged: number;
  calorieTarget: number;
}

export function DailyVitals({ profile, mealsLogged, caloriesLogged, calorieTarget }: Props) {
  const qc = useQueryClient();
  const tz = profile?.timezone ?? undefined;
  const today = localDateKey(tz);
  const waterTarget = Math.round(Number(profile?.weight_kg ?? 70) * 35);

  const { data: metrics } = useQuery({
    queryKey: ["daily-metrics", today],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_metrics")
        .select("*")
        .order("log_date", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  const { data: workouts } = useQuery({
    queryKey: ["workouts-today", today],
    queryFn: async () => {
      const { data } = await supabase.from("workouts").select("*").eq("scheduled_for", today);
      return data ?? [];
    },
  });

  const todayRow = metrics?.find((m) => m.log_date === today);
  const [sleep, setSleep] = useState("");
  const [weight, setWeight] = useState("");

  useEffect(() => {
    setSleep(todayRow?.sleep_hours != null ? String(todayRow.sleep_hours) : "");
    setWeight(todayRow?.weight_kg != null ? String(todayRow.weight_kg) : "");
  }, [todayRow?.sleep_hours, todayRow?.weight_kg]);

  const upsert = async (patch: Record<string, number | null>) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase
      .from("daily_metrics")
      .upsert({ user_id: u.user.id, log_date: today, ...patch }, { onConflict: "user_id,log_date" });
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["daily-metrics"] });
  };

  const water = todayRow?.water_ml ?? 0;
  const waterPct = Math.min(100, Math.round((water / waterTarget) * 100));

  // Streak: consecutive days (ending today or yesterday) with any logged activity.
  const streak = useMemo(() => {
    const days = new Set((metrics ?? []).filter((m) => (m.water_ml ?? 0) > 0 || m.sleep_hours != null).map((m) => m.log_date));
    let count = 0;
    const cursor = new Date(`${today}T12:00:00`);
    for (let i = 0; i < 60; i++) {
      const key = cursor.toISOString().slice(0, 10);
      if (days.has(key)) count++;
      else if (i > 0) break;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [metrics, today]);

  // Readiness: transparent composite of sleep, hydration, fuelling and soreness.
  const readiness = useMemo(() => {
    const sleepScore = todayRow?.sleep_hours != null ? Math.min(1, Number(todayRow.sleep_hours) / 8) : 0.6;
    const hydration = Math.min(1, water / waterTarget);
    const fuel = calorieTarget ? Math.min(1, caloriesLogged / calorieTarget) : 0.5;
    const soreness = todayRow?.soreness != null ? 1 - Number(todayRow.soreness) / 10 : 0.7;
    return Math.round((sleepScore * 0.35 + hydration * 0.2 + fuel * 0.25 + soreness * 0.2) * 100);
  }, [todayRow, water, waterTarget, caloriesLogged, calorieTarget]);

  const nextBestAction = useMemo(() => {
    if (mealsLogged === 0)
      return { title: "Log your first meal", why: "Nothing logged today — a scan sets your whole day's guidance.", to: "/scan" as const, icon: Camera };
    if (waterPct < 50)
      return { title: `Drink 500 ml water`, why: `You're at ${water} of ${waterTarget} ml — hydration is your biggest open gap.`, to: "/dashboard" as const, icon: Droplets };
    if (todayRow?.sleep_hours == null)
      return { title: "Log last night's sleep", why: "Sleep drives 35% of your readiness estimate.", to: "/dashboard" as const, icon: Moon };
    if ((workouts ?? []).length === 0)
      return { title: "Plan today's session", why: "No training logged — schedule one to match your fuelling.", to: "/train" as const, icon: Dumbbell };
    if (caloriesLogged < calorieTarget * 0.6)
      return { title: "Fill your remaining macros", why: `${Math.max(0, calorieTarget - Math.round(caloriesLogged))} kcal left — the planner closes the gap.`, to: "/planner" as const, icon: Flame };
    return { title: "You're on track — keep the streak", why: "All core habits logged today. Review tomorrow's plan.", to: "/planner" as const, icon: Sparkles };
  }, [mealsLogged, waterPct, water, waterTarget, todayRow, workouts, caloriesLogged, calorieTarget]);

  // Weight trend as a range, never a promise.
  const weightTrend = useMemo(() => {
    const pts = (metrics ?? []).filter((m) => m.weight_kg != null).slice(0, 21);
    if (pts.length < 2) return null;
    const newest = Number(pts[0].weight_kg);
    const oldest = Number(pts[pts.length - 1].weight_kg);
    const days = Math.max(1, (new Date(pts[0].log_date).getTime() - new Date(pts[pts.length - 1].log_date).getTime()) / 86400000);
    const perWeek = ((newest - oldest) / days) * 7;
    return { perWeek, low: perWeek - 0.25, high: perWeek + 0.25, points: pts.length };
  }, [metrics]);

  return (
    <div className="space-y-4">
      {/* Next best action */}
      <Link
        to={nextBestAction.to}
        className="glass-strong grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-3xl p-5 transition hover:border-primary/40"
      >
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent">
          <nextBestAction.icon className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-primary">Next best action</div>
          <div className="truncate font-display text-lg font-semibold">{nextBestAction.title}</div>
          <div className="text-xs text-muted-foreground">{nextBestAction.why}</div>
        </div>
      </Link>

      <div className="grid gap-4 md:grid-cols-4">
        {/* Hydration */}
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Droplets className="h-4 w-4 text-accent" /> Hydration
          </div>
          <div className="mt-2 font-display text-2xl font-bold">
            {water}
            <span className="ml-1 text-xs font-normal text-muted-foreground">/ {waterTarget} ml</span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={waterPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Hydration ${waterPct} percent of daily target`}
          >
            <div className="h-full rounded-full bg-accent" style={{ width: `${waterPct}%` }} />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => upsert({ water_ml: Math.max(0, water - 250) })}
              aria-label="Remove 250 millilitres of water"
              className="grid h-8 w-8 place-items-center rounded-full border border-border"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => upsert({ water_ml: water + 250 })}
              className="flex flex-1 items-center justify-center gap-1 rounded-full bg-accent/15 py-1.5 text-xs font-semibold text-accent"
            >
              <Plus className="h-3.5 w-3.5" /> 250 ml
            </button>
          </div>
        </div>

        {/* Sleep */}
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Moon className="h-4 w-4 text-primary" /> Sleep
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <input
              type="number"
              step="0.5"
              min="0"
              max="16"
              value={sleep}
              onChange={(e) => setSleep(e.target.value)}
              onBlur={() => upsert({ sleep_hours: sleep === "" ? null : Number(sleep) })}
              placeholder="—"
              aria-label="Hours slept last night"
              className="w-16 bg-transparent font-display text-2xl font-bold outline-none"
            />
            <span className="text-xs text-muted-foreground">hours</span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            7–9 h supports recovery and appetite regulation.
          </p>
        </div>

        {/* Readiness */}
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BatteryCharging className="h-4 w-4 text-warning" /> Readiness
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-gradient">{readiness}</div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Estimate from sleep 35%, fuelling 25%, hydration 20%, soreness 20%. Not a medical metric.
          </p>
          <label className="mt-3 block text-[10px] uppercase tracking-widest text-muted-foreground">
            Soreness (0–10)
          </label>
          <input
            type="range"
            min={0}
            max={10}
            value={todayRow?.soreness ?? 3}
            onChange={(e) => upsert({ soreness: Number(e.target.value) })}
            aria-label="Muscle soreness from 0 to 10"
            className="w-full accent-[var(--primary)]"
          />
        </div>

        {/* Streak + weight */}
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Flame className="h-4 w-4 text-primary" /> Streak
          </div>
          <div className="mt-2 font-display text-2xl font-bold">
            {streak}<span className="ml-1 text-xs font-normal text-muted-foreground">days</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Scale className="h-3.5 w-3.5" />
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              onBlur={() => upsert({ weight_kg: weight === "" ? null : Number(weight) })}
              placeholder="Log weight"
              aria-label="Today's body weight in kilograms"
              className="w-24 bg-transparent outline-none"
            />
            kg
          </div>
        </div>
      </div>

      {/* Progress trend with uncertainty */}
      <div className="glass rounded-3xl p-5">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Info className="h-4 w-4 text-primary" /> Progress trend
        </div>
        {weightTrend ? (
          <p className="text-xs text-muted-foreground">
            Based on {weightTrend.points} weigh-ins, your recent trend is roughly{" "}
            <span className="font-semibold text-foreground">
              {weightTrend.low > 0 ? "+" : ""}
              {weightTrend.low.toFixed(2)} to {weightTrend.high > 0 ? "+" : ""}
              {weightTrend.high.toFixed(2)} kg/week
            </span>
            . This is an estimated range, not a prediction — daily weight swings from water, food volume and sleep
            mean actual results vary. No date or guaranteed outcome is implied.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Log your weight on a few days to see an estimated trend range. We show ranges rather than exact
            predictions because short-term weight fluctuates for reasons unrelated to fat or muscle change.
          </p>
        )}
      </div>
    </div>
  );
}
