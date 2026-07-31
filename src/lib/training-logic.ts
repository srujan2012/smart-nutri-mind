// Deterministic training maths. No AI here, so every number can be explained exactly.

export type FitnessLevel = "beginner" | "intermediate" | "advanced";

export function ageBand(age: number | null | undefined): string {
  const a = Number(age ?? 0);
  if (!a) return "unspecified";
  if (a < 13) return "under-13";
  if (a < 16) return "13-15";
  if (a < 18) return "16-17";
  if (a < 30) return "18-29";
  if (a < 45) return "30-44";
  if (a < 60) return "45-59";
  return "60+";
}

export function isYouth(age: number | null | undefined): boolean {
  const a = Number(age ?? 99);
  return a > 0 && a < 18;
}

/** Everything that should force the plan to be rebuilt when it changes. */
export interface PlanInputs {
  goal: string | null | undefined;
  goals: string[] | null | undefined;
  fitness_level: string | null | undefined;
  age: number | null | undefined;
  equipment: string[] | null | undefined;
  sport: string | null | undefined;
  sport_position: string | null | undefined;
  training_days_per_week: number | null | undefined;
  training_hours_per_day: number | null | undefined;
  activity_level: string | null | undefined;
  daily_schedule: string | null | undefined;
}

export function planSignature(p: PlanInputs): string {
  return [
    p.goal ?? "-",
    [...(p.goals ?? [])].sort().join("+") || "-",
    p.fitness_level ?? "-",
    ageBand(p.age),
    [...(p.equipment ?? [])].sort().join("+") || "none",
    p.sport ?? "-",
    p.sport_position ?? "-",
    p.training_days_per_week ?? "-",
    p.training_hours_per_day ?? "-",
    p.activity_level ?? "-",
    p.daily_schedule ?? "-",
  ].join("|");
}

const LABELS: Record<string, string> = {
  goal: "primary goal",
  goals: "focus areas",
  fitness_level: "fitness level",
  age: "age range",
  equipment: "available equipment",
  sport: "sport",
  sport_position: "position",
  training_days_per_week: "training days per week",
  training_hours_per_day: "session length",
  activity_level: "activity level",
  daily_schedule: "daily schedule",
};

/** Plain-English list of what changed between the signature the plan was built on and now. */
export function signatureDiff(oldSig: string | null | undefined, newSig: string): string[] {
  if (!oldSig) return [];
  const keys = Object.keys(LABELS);
  const a = oldSig.split("|");
  const b = newSig.split("|");
  const out: string[] = [];
  for (let i = 0; i < keys.length; i++) {
    if (a[i] !== b[i]) {
      out.push(`${LABELS[keys[i]]}: "${a[i] ?? "-"}" → "${b[i] ?? "-"}"`);
    }
  }
  return out;
}

// ---------- Progressive overload, with safe limits ----------

export interface OverloadInput {
  weight_kg: number | null;
  reps: number;
  target_reps_low: number;
  target_reps_high: number;
  rpe: number | null; // 1-10 perceived effort
  age: number | null | undefined;
}

export interface OverloadSuggestion {
  weight_kg: number | null;
  reps: number;
  change: "increase-load" | "increase-reps" | "hold" | "reduce";
  why: string;
}

/**
 * Double progression: earn the reps first, then a small load step.
 * Hard caps: load never moves more than 5% (2.5% for under-18s) in one step.
 */
export function suggestNextSet(i: OverloadInput): OverloadSuggestion {
  const youth = isYouth(i.age);
  const stepPct = youth ? 0.025 : 0.05;
  const rpe = i.rpe;

  if (rpe !== null && rpe >= 9.5) {
    return {
      weight_kg: i.weight_kg ? round2(i.weight_kg * 0.95) : null,
      reps: Math.max(i.target_reps_low, i.reps - 1),
      change: "reduce",
      why: `You rated that ${rpe}/10 — essentially all-out. Backing the load off 5% keeps 1–2 reps in reserve, which is where most of the adaptation happens with far less injury and fatigue cost.`,
    };
  }

  if (i.reps >= i.target_reps_high && (rpe === null || rpe <= 8)) {
    if (i.weight_kg && i.weight_kg > 0) {
      const next = round2(Math.max(i.weight_kg + (youth ? 1 : 1.25), i.weight_kg * (1 + stepPct)));
      return {
        weight_kg: next,
        reps: i.target_reps_low,
        change: "increase-load",
        why: `You hit the top of the ${i.target_reps_low}–${i.target_reps_high} rep range${rpe !== null ? ` at RPE ${rpe}` : ""}, so the load has earned a step up of about ${Math.round(stepPct * 100)}% (to ${next} kg) and reps reset to ${i.target_reps_low}.${youth ? " Steps are deliberately half-size because you're under 18 — technique and consistency matter more than load at this stage." : ""}`,
      };
    }
    return {
      weight_kg: null,
      reps: i.reps + 2,
      change: "increase-reps",
      why: `Bodyweight movement at the top of its range${rpe !== null ? ` and only RPE ${rpe}` : ""} — add 2 reps, or move to the harder progression listed on the exercise.`,
    };
  }

  if (i.reps < i.target_reps_low) {
    return {
      weight_kg: i.weight_kg ? round2(i.weight_kg * 0.95) : null,
      reps: i.target_reps_low,
      change: "reduce",
      why: `You finished ${i.reps} reps, under the ${i.target_reps_low}-rep floor for this range. Dropping the load ~5% puts you back inside the range where the set actually does its job.`,
    };
  }

  return {
    weight_kg: i.weight_kg,
    reps: Math.min(i.target_reps_high, i.reps + 1),
    change: "hold",
    why: `You're inside the ${i.target_reps_low}–${i.target_reps_high} range${rpe !== null ? ` at RPE ${rpe}` : ""}. Keep the load and chase one more rep — load only moves once the top of the range is clean.`,
  };
}

function round2(n: number) {
  return Math.round(n * 4) / 4;
}

// ---------- Weight trend: a range, never a date ----------

export interface TrendPoint { date: string; weight: number }

export interface TrendEstimate {
  slope_kg_per_week: number;
  low_kg_per_week: number;
  high_kg_per_week: number;
  points: TrendPoint[];
  confidence: "low" | "medium" | "high";
  explanation: string;
}

export function estimateTrend(points: TrendPoint[]): TrendEstimate | null {
  const pts = [...points].sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < 3) return null;

  const t0 = new Date(pts[0].date).getTime();
  const xs = pts.map((p) => (new Date(p.date).getTime() - t0) / 86400000);
  const ys = pts.map((p) => p.weight);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  const sxy = xs.reduce((a, x, k) => a + (x - mx) * (ys[k] - my), 0);
  const slopePerDay = sxx === 0 ? 0 : sxy / sxx;

  // Residual spread → honest uncertainty band on the slope.
  const resid = ys.map((y, k) => y - (my + slopePerDay * (xs[k] - mx)));
  const sd = Math.sqrt(resid.reduce((a, r) => a + r * r, 0) / Math.max(1, n - 2));
  const se = sxx === 0 ? 0 : sd / Math.sqrt(sxx);
  const band = 1.96 * se * 7;
  const slope = slopePerDay * 7;

  const spanDays = xs[n - 1];
  const confidence: TrendEstimate["confidence"] =
    n >= 8 && spanDays >= 21 ? "high" : n >= 5 && spanDays >= 10 ? "medium" : "low";

  return {
    slope_kg_per_week: slope,
    low_kg_per_week: slope - band,
    high_kg_per_week: slope + band,
    points: pts,
    confidence,
    explanation:
      `Based on ${n} weigh-ins over ${Math.round(spanDays)} days, your body weight is trending about ` +
      `${fmt(slope)} kg/week, most likely somewhere between ${fmt(slope - band)} and ${fmt(slope + band)} kg/week. ` +
      `Day-to-day weight moves with water, food volume, salt, sleep and hormones, so this is a range, not a promise — ` +
      `and it can't be turned into a date you'll hit a particular number. ` +
      (confidence === "low"
        ? "Confidence is low: more weigh-ins over a longer stretch will tighten this range."
        : confidence === "medium"
          ? "Confidence is moderate; a few more weeks of data will tighten this range."
          : "Confidence is good — this is a real trend, not noise."),
  };
}

function fmt(n: number) {
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}`;
}

/** Non-judgemental progress messages. Never comments on how a body looks. */
export function celebrate(o: {
  sessionsThisWeek: number;
  streakDays: number;
  trend: TrendEstimate | null;
  goal: string | null | undefined;
}): string {
  const bits: string[] = [];
  if (o.sessionsThisWeek > 0)
    bits.push(`${o.sessionsThisWeek} session${o.sessionsThisWeek === 1 ? "" : "s"} done this week`);
  if (o.streakDays > 1) bits.push(`${o.streakDays}-day logging streak`);
  if (o.trend && o.trend.confidence !== "low") bits.push("enough data for a real trend line");
  if (bits.length === 0)
    return "No sessions logged yet this week. One short session counts — starting is the hard part.";
  return `Nice work: ${bits.join(", ")}. Showing up consistently is the part that actually drives results.`;
}
