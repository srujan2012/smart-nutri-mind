// Deterministic, safety-bounded target recalibration.
// No AI guessing here: the maths is transparent so the reason can be explained exactly.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeTargets, type ActivityLevel, type Goal, type Sex } from "@/lib/nutrition-targets";

export interface RecalibrationResult {
  applied: boolean;
  reason: string;
  safety_note: string | null;
  adherence_pct: number | null;
  trend_kg_per_week: number | null;
  old_calories: number;
  new_calories: number;
  old_protein: number;
  new_protein: number;
  days_logged: number;
  weigh_ins: number;
}

const MAX_STEP_PCT = 0.05; // never move calories more than 5% in one adjustment

export const recalibrateTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecalibrationResult> => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("Profile not found");

    const age = Number(profile.age ?? 25);
    const isTeen = age < 18;
    const sex = (profile.gender ?? "other") as Sex;
    const weight = Number(profile.weight_kg ?? 70);
    const goal = (profile.goal ?? "maintain") as Goal;

    const baseline = computeTargets({
      age,
      sex,
      height_cm: Number(profile.height_cm ?? 170),
      weight_kg: weight,
      activity: (profile.activity_level ?? "moderate") as ActivityLevel,
      goal,
    });

    const oldCalories = Number(profile.calorie_target ?? baseline.calories);
    const oldProtein = Number(profile.protein_target ?? baseline.protein);

    const since = new Date(Date.now() - 14 * 86400000).toISOString();
    const { data: meals } = await supabase
      .from("meals").select("calories, consumed_at").gte("consumed_at", since);
    const { data: metrics } = await supabase
      .from("daily_metrics").select("log_date, weight_kg")
      .gte("log_date", since.slice(0, 10)).order("log_date", { ascending: false });

    // Adherence = share of days where logged intake landed within 85–115% of target.
    const byDay = new Map<string, number>();
    for (const m of meals ?? []) {
      const day = new Date(m.consumed_at).toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + Number(m.calories ?? 0));
    }
    const daysLogged = byDay.size;
    const onTargetDays = [...byDay.values()].filter(
      (kcal) => kcal >= oldCalories * 0.85 && kcal <= oldCalories * 1.15,
    ).length;
    const adherence = daysLogged > 0 ? Math.round((onTargetDays / daysLogged) * 100) : null;

    const weighIns = (metrics ?? []).filter((m) => m.weight_kg != null);
    let trend: number | null = null;
    if (weighIns.length >= 3) {
      const newest = weighIns[0];
      const oldest = weighIns[weighIns.length - 1];
      const days = Math.max(
        1,
        (new Date(newest.log_date).getTime() - new Date(oldest.log_date).getTime()) / 86400000,
      );
      trend = ((Number(newest.weight_kg) - Number(oldest.weight_kg)) / days) * 7;
    }

    const noData = (msg: string): RecalibrationResult => ({
      applied: false,
      reason: msg,
      safety_note: null,
      adherence_pct: adherence,
      trend_kg_per_week: trend,
      old_calories: oldCalories,
      new_calories: oldCalories,
      old_protein: oldProtein,
      new_protein: oldProtein,
      days_logged: daysLogged,
      weigh_ins: weighIns.length,
    });

    if (daysLogged < 5)
      return noData(
        `Only ${daysLogged} of the last 14 days have logged meals. Targets stay unchanged — adjusting on sparse data would chase noise rather than a real trend. Log at least 5 days.`,
      );
    if (trend === null)
      return noData(
        `You have ${weighIns.length} weigh-in${weighIns.length === 1 ? "" : "s"} in the last 14 days. Targets stay unchanged until there are at least 3, so a change reflects a trend rather than a single day's fluctuation.`,
      );
    if ((adherence ?? 0) < 50)
      return noData(
        `Adherence is ${adherence}% — intake landed outside 85–115% of target on most logged days. Changing the number won't help while the current one isn't being followed; targets stay as they are.`,
      );

    // Desired weekly change, conservative for teenagers.
    const desired: Record<Goal, { low: number; high: number }> = isTeen
      ? { lose: { low: -0.35, high: -0.1 }, maintain: { low: -0.1, high: 0.1 }, recomp: { low: -0.1, high: 0.15 }, gain: { low: 0.1, high: 0.3 } }
      : { lose: { low: -0.75, high: -0.25 }, maintain: { low: -0.15, high: 0.15 }, recomp: { low: -0.25, high: 0.15 }, gain: { low: 0.15, high: 0.4 } };
    const band = desired[goal];

    let newCalories = oldCalories;
    let reason: string;

    if (trend < band.low) {
      newCalories = Math.round(oldCalories * (1 + MAX_STEP_PCT));
      reason = `You're trending ${trend.toFixed(2)} kg/week, faster than the safe ${band.low} to ${band.high} kg/week range for a "${goal}" goal. Calories go up ${Math.round(MAX_STEP_PCT * 100)}% to slow the rate and protect muscle and energy levels.`;
    } else if (trend > band.high) {
      newCalories = Math.round(oldCalories * (1 - MAX_STEP_PCT));
      reason = `You're trending ${trend > 0 ? "+" : ""}${trend.toFixed(2)} kg/week, above the ${band.low} to ${band.high} kg/week range for a "${goal}" goal. Calories come down ${Math.round(MAX_STEP_PCT * 100)}% — a single small step, not a crash cut.`;
    } else {
      reason = `Your ${trend > 0 ? "+" : ""}${trend.toFixed(2)} kg/week trend sits inside the ${band.low} to ${band.high} kg/week range for a "${goal}" goal, with ${adherence}% adherence. Nothing needs to change — consistency is already working.`;
    }

    // ---- Safety floors ----
    let safety: string | null = null;
    const absoluteFloor = sex === "female" ? 1200 : 1500;
    const teenFloor = Math.round(baseline.calories * 0.9);
    const floor = isTeen ? Math.max(absoluteFloor, teenFloor) : absoluteFloor;
    const ceiling = Math.round(baseline.calories * 1.25);

    if (newCalories < floor) {
      newCalories = floor;
      safety = isTeen
        ? `Held at ${floor} kcal. Under 18, growth, puberty and schoolwork need fuel, so this app never applies an aggressive restriction — if you want to go lower, talk to a doctor or registered dietitian first.`
        : `Held at the ${floor} kcal safety floor. Going below this makes protein and micronutrient needs very hard to meet without supervision.`;
    } else if (newCalories > ceiling) {
      newCalories = ceiling;
      safety = `Capped at ${ceiling} kcal so intake stays close to your estimated needs.`;
    }

    // Protein: 1.6–2.2 g/kg, clamped and nudged up in a deficit.
    const proteinPerKg = goal === "lose" ? 2.0 : goal === "gain" ? 1.8 : 1.6;
    const newProtein = Math.round(Math.min(2.2, Math.max(1.4, proteinPerKg)) * weight);

    const changed = newCalories !== oldCalories || newProtein !== oldProtein;
    if (changed) {
      const remainder = newCalories - newProtein * 4;
      const fat = Math.round((remainder * 0.3) / 9);
      const carbs = Math.round((remainder * 0.7) / 4);
      await supabase
        .from("profiles")
        .update({
          calorie_target: newCalories,
          protein_target: newProtein,
          fat_target: fat,
          carbs_target: carbs,
        })
        .eq("id", userId);
    }

    await supabase.from("plan_adjustments").insert({
      user_id: userId,
      old_calories: oldCalories,
      new_calories: newCalories,
      old_protein: oldProtein,
      new_protein: newProtein,
      adherence_pct: adherence,
      trend_kg_per_week: trend,
      reason,
      safety_note: safety,
    });

    return {
      applied: changed,
      reason,
      safety_note: safety,
      adherence_pct: adherence,
      trend_kg_per_week: trend,
      old_calories: oldCalories,
      new_calories: newCalories,
      old_protein: oldProtein,
      new_protein: newProtein,
      days_logged: daysLogged,
      weigh_ins: weighIns.length,
    };
  });
