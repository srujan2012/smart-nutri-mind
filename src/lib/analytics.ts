/**
 * Deterministic analytics helpers. No AI here — every number on the Insights
 * screen comes from these pure functions so it can be explained and audited.
 */
import { addDays, dateKeyOf } from "@/lib/dates";

export type DayPoint = {
  day: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  water_ml: number | null;
  sleep_hours: number | null;
  weight_kg: number | null;
  readiness: number | null;
  mood: number | null;
  soreness: number | null;
  load: number | null;
  meals: number;
  sessions: number;
};

export function emptyDay(day: string): DayPoint {
  return {
    day,
    calories: null, protein: null, carbs: null, fat: null, fiber: null,
    water_ml: null, sleep_hours: null, weight_kg: null,
    readiness: null, mood: null, soreness: null, load: null,
    meals: 0, sessions: 0,
  };
}

export function dayRange(days: number, tz?: string | null): string[] {
  const today = dateKeyOf(new Date(), tz);
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(addDays(today, -i));
  return out;
}

/** Session load = duration x RPE (a standard sRPE unit). Falls back to intensity. */
export function sessionLoad(duration_min: number | null, rpe: number | null, intensity: string | null) {
  const rpeGuess = rpe ?? (intensity === "high" ? 8 : intensity === "low" ? 4 : 6);
  return Math.round(Number(duration_min ?? 0) * rpeGuess);
}

export function mean(values: Array<number | null | undefined>) {
  const v = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

/** Rolling average that ignores gaps, used to calm noisy daily series. */
export function rolling(points: DayPoint[], key: keyof DayPoint, window: number) {
  return points.map((p, i) => {
    const slice = points.slice(Math.max(0, i - window + 1), i + 1).map((s) => s[key] as number | null);
    return { day: p.day, value: p[key] as number | null, avg: mean(slice) };
  });
}

export type Trend = {
  slopePerWeek: number;
  lowPerWeek: number;
  highPerWeek: number;
  confidence: "low" | "moderate" | "good";
  n: number;
  r2: number;
};

/** Least-squares slope with a residual-based band. Never presented as a promise. */
export function linearTrend(series: Array<{ day: string; value: number | null }>): Trend | null {
  const pts = series
    .map((s, i) => ({ x: i, y: s.value }))
    .filter((p): p is { x: number; y: number } => typeof p.y === "number");
  if (pts.length < 3) return null;
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  const den = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0) || 1;
  const slope = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / den;
  const intercept = my - slope * mx;
  const ssRes = pts.reduce((a, p) => a + (p.y - (slope * p.x + intercept)) ** 2, 0);
  const ssTot = pts.reduce((a, p) => a + (p.y - my) ** 2, 0) || 1;
  const r2 = Math.max(0, 1 - ssRes / ssTot);
  const sd = Math.sqrt(ssRes / Math.max(1, n - 2));
  const se = sd / Math.sqrt(den);
  const perWeek = slope * 7;
  const band = se * 7 * 1.96;
  return {
    slopePerWeek: perWeek,
    lowPerWeek: perWeek - band,
    highPerWeek: perWeek + band,
    confidence: n >= 14 && r2 > 0.4 ? "good" : n >= 7 ? "moderate" : "low",
    n,
    r2,
  };
}

export function adherence(points: DayPoint[], target: number | null, key: keyof DayPoint, tolerance = 0.15) {
  if (!target) return null;
  const logged = points.filter((p) => typeof p[key] === "number" && (p[key] as number) > 0);
  if (!logged.length) return null;
  const within = logged.filter((p) => Math.abs((p[key] as number) - target) / target <= tolerance).length;
  return { pct: Math.round((within / logged.length) * 100), loggedDays: logged.length, totalDays: points.length };
}

export type Pattern = { title: string; detail: string; tone: "good" | "watch" | "info" };

/** Descriptive patterns only. We deliberately never claim one thing caused another. */
export function detectPatterns(points: DayPoint[]): Pattern[] {
  const out: Pattern[] = [];
  const weekday = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
  const weekend = points.filter((p) => weekday(p.day) === 0 || weekday(p.day) === 6);
  const week = points.filter((p) => weekday(p.day) > 0 && weekday(p.day) < 6);
  const wkCal = mean(weekend.map((p) => p.calories));
  const wdCal = mean(week.map((p) => p.calories));
  if (wkCal && wdCal && Math.abs(wkCal - wdCal) / wdCal > 0.15) {
    out.push({
      title: wkCal > wdCal ? "Weekends run higher" : "Weekends run lower",
      detail: `Weekend intake averages ${Math.round(wkCal)} kcal vs ${Math.round(wdCal)} kcal on weekdays. This is an observed difference, not a cause.`,
      tone: "watch",
    });
  }
  const loggedDays = points.filter((p) => p.meals > 0).length;
  if (points.length >= 7) {
    const pct = Math.round((loggedDays / points.length) * 100);
    out.push({
      title: `${pct}% of days logged`,
      detail: pct >= 70
        ? "Consistent logging — the trends below have enough data to be meaningful."
        : "Gaps in logging widen every range shown below. More logged days narrows the uncertainty.",
      tone: pct >= 70 ? "good" : "info",
    });
  }
  const sleep = mean(points.map((p) => p.sleep_hours));
  if (sleep && sleep < 7) {
    out.push({
      title: "Sleep is averaging under 7h",
      detail: `Average ${sleep.toFixed(1)}h across logged nights. Shown for awareness only — it is not a diagnosis.`,
      tone: "watch",
    });
  }
  const water = mean(points.map((p) => p.water_ml));
  if (water) {
    out.push({
      title: `Hydration averaging ${(water / 1000).toFixed(1)} L/day`,
      detail: "Based on the days you logged water. Days with no entry are excluded rather than counted as zero.",
      tone: water >= 2000 ? "good" : "info",
    });
  }
  const load = points.map((p) => p.load ?? 0);
  const acute = mean(load.slice(-7));
  const chronic = mean(load.slice(-28));
  if (acute && chronic && chronic > 0) {
    const ratio = acute / chronic;
    out.push({
      title: `Training load ratio ${ratio.toFixed(2)}`,
      detail: ratio > 1.5
        ? "Recent load is well above your longer-term average. Consider an easier day; sharp jumps are associated with higher injury risk in the literature, though this is a population-level association, not a prediction for you."
        : "Recent load sits close to your longer-term average.",
      tone: ratio > 1.5 ? "watch" : "good",
    });
  }
  return out;
}

export type PeriodReport = {
  label: string;
  from: string;
  to: string;
  daysLogged: number;
  totalDays: number;
  avg: { calories: number | null; protein: number | null; water_ml: number | null; sleep_hours: number | null; readiness: number | null };
  sessions: number;
  load: number;
  weightChange: number | null;
  positives: string[];
  difficulties: string[];
  nextFocus: string;
};

export function buildReport(points: DayPoint[], label: string, targets: { calories?: number | null; protein?: number | null }): PeriodReport {
  const from = points[0]?.day ?? "";
  const to = points[points.length - 1]?.day ?? "";
  const daysLogged = points.filter((p) => p.meals > 0 || p.sessions > 0 || p.water_ml).length;
  const weights = points.map((p) => p.weight_kg).filter((w): w is number => typeof w === "number");
  const avgCal = mean(points.map((p) => p.calories));
  const avgPro = mean(points.map((p) => p.protein));
  const sleep = mean(points.map((p) => p.sleep_hours));
  const water = mean(points.map((p) => p.water_ml));
  const readiness = mean(points.map((p) => p.readiness));
  const sessions = points.reduce((a, p) => a + p.sessions, 0);
  const load = points.reduce((a, p) => a + (p.load ?? 0), 0);

  const positives: string[] = [];
  const difficulties: string[] = [];
  if (daysLogged / Math.max(1, points.length) >= 0.7) positives.push("You logged most days — that consistency is the habit that matters most.");
  else difficulties.push("Several days went unlogged, so the averages here rest on partial data.");
  if (targets.protein && avgPro && avgPro >= targets.protein * 0.9) positives.push(`Protein averaged ${Math.round(avgPro)}g, close to your ${targets.protein}g target.`);
  else if (targets.protein && avgPro) difficulties.push(`Protein averaged ${Math.round(avgPro)}g against a ${targets.protein}g target.`);
  if (sessions > 0) positives.push(`${sessions} training session${sessions === 1 ? "" : "s"} completed.`);
  else difficulties.push("No training sessions were logged in this period.");
  if (sleep && sleep >= 7) positives.push(`Sleep averaged ${sleep.toFixed(1)}h.`);
  else if (sleep) difficulties.push(`Sleep averaged ${sleep.toFixed(1)}h, below the 7–9h general guidance.`);

  const nextFocus = difficulties.length
    ? `Next practical focus: ${difficulties[0]!.replace(/\.$/, "")} — pick one small, repeatable change rather than several.`
    : "Next practical focus: hold the current routine steady for another period and let the trend range narrow.";

  return {
    label, from, to, daysLogged, totalDays: points.length,
    avg: { calories: avgCal, protein: avgPro, water_ml: water, sleep_hours: sleep, readiness },
    sessions, load,
    weightChange: weights.length >= 2 ? weights[weights.length - 1]! - weights[0]! : null,
    positives, difficulties, nextFocus,
  };
}

export function toCSV(points: DayPoint[]) {
  const cols: (keyof DayPoint)[] = [
    "day", "calories", "protein", "carbs", "fat", "fiber",
    "water_ml", "sleep_hours", "weight_kg", "readiness", "mood", "soreness", "load", "meals", "sessions",
  ];
  const head = cols.join(",");
  const rows = points.map((p) => cols.map((c) => (p[c] ?? "")).join(","));
  return [head, ...rows].join("\n");
}
