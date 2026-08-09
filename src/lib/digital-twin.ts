// AI Digital Twin — a deterministic model of the person built from their own logged data.
//
// Everything in this file is transparent maths, not AI guessing: each score exposes the
// exact factors that produced it, so the app can explain (and the user can correct) it.
// Confidence is always reported, because a twin built on 2 days of data is a guess.

export type Confidence = "low" | "medium" | "high";

export interface TwinInputs {
  // profile
  age: number | null;
  goal: string | null;
  weight_kg: number | null;
  lifestyle: string[];
  exam_mode: boolean;
  injuries: string[];
  growth_mode: boolean;
  daily_budget: number | null;
  timezone: string | null;
  training_days_per_week: number | null;
  // targets
  calorie_target: number;
  protein_target: number;
  water_target_ml: number;
  // recent history (most recent first), last 14 days
  days: DayRecord[];
  // health blocks
  blocks_training: boolean;
  blocks_diet: boolean;
}

export interface DayRecord {
  date: string;
  calories: number;
  protein: number;
  meals_logged: number;
  water_ml: number;
  sleep_hours: number | null;
  soreness: number | null; // 1 (none) – 5 (severe)
  mood: number | null; // 1–5
  readiness_self: number | null; // 1–5
  weight_kg: number | null;
  training_minutes: number;
  training_load: number; // minutes × intensity factor
  rest_day: boolean;
}

export interface Factor {
  label: string;
  value: string;
  weight: string;
  editable?: "sleep" | "soreness" | "water" | "mood" | "readiness";
}

export interface Twin {
  readiness: number; // 0–100
  readinessBand: "low" | "moderate" | "good" | "peak";
  recovery: number; // 0–100
  recoveryStatus: "under-recovered" | "recovering" | "recovered";
  adherence: number; // 0–100
  consistency: number; // 0–100
  acwr: number | null; // acute:chronic workload ratio
  loadFlag: "detraining" | "optimal" | "rising" | "spike" | null;
  trendKgPerWeek: number | null;
  confidence: Confidence;
  daysWithData: number;
  factors: Factor[];
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function buildTwin(input: TwinInputs): Twin {
  const days = input.days;
  const last7 = days.slice(0, 7);
  const daysWithData = days.filter(
    (d) => d.meals_logged > 0 || d.sleep_hours != null || d.training_minutes > 0 || d.water_ml > 0,
  ).length;

  const factors: Factor[] = [];

  // ---- Sleep ----
  const sleeps = last7.map((d) => d.sleep_hours).filter((n): n is number => n != null);
  const sleepAvg = sleeps.length ? avg(sleeps) : null;
  const lastSleep = days[0]?.sleep_hours ?? null;
  const sleepNeed = input.growth_mode || (input.age ?? 30) < 18 ? 9 : 8;
  const sleepScore =
    lastSleep == null ? 60 : clamp(Math.round((lastSleep / sleepNeed) * 100), 0, 110);
  factors.push({
    label: "Last night's sleep",
    value: lastSleep == null ? "not logged" : `${lastSleep.toFixed(1)}h of ~${sleepNeed}h needed`,
    weight: "35% of readiness",
    editable: "sleep",
  });

  // ---- Soreness ----
  const soreness = days[0]?.soreness ?? null;
  const sorenessScore = soreness == null ? 65 : clamp(100 - (soreness - 1) * 22);
  factors.push({
    label: "Muscle soreness",
    value: soreness == null ? "not logged" : `${soreness}/5`,
    weight: "20% of readiness",
    editable: "soreness",
  });

  // ---- Self-reported readiness / mood ----
  const selfR = days[0]?.readiness_self ?? null;
  const mood = days[0]?.mood ?? null;
  const selfScore = selfR == null ? (mood == null ? 65 : mood * 20) : selfR * 20;
  factors.push({
    label: "How you said you feel",
    value: selfR ? `${selfR}/5 readiness` : mood ? `${mood}/5 mood` : "not logged",
    weight: "15% of readiness",
    editable: "readiness",
  });

  // ---- Hydration ----
  const waterToday = days[0]?.water_ml ?? 0;
  const hydrationScore = clamp(Math.round((waterToday / Math.max(1, input.water_target_ml)) * 100));
  factors.push({
    label: "Hydration",
    value: `${waterToday} ml of ${input.water_target_ml} ml`,
    weight: "10% of readiness",
    editable: "water",
  });

  // ---- Training load / ACWR ----
  const acute = avg(last7.map((d) => d.training_load));
  const chronic = avg(days.slice(0, 14).map((d) => d.training_load));
  const acwr = chronic > 0 ? Number((acute / chronic).toFixed(2)) : null;
  let loadFlag: Twin["loadFlag"] = null;
  if (acwr != null) {
    if (acwr < 0.8) loadFlag = "detraining";
    else if (acwr <= 1.1) loadFlag = "optimal";
    else if (acwr <= 1.3) loadFlag = "rising";
    else loadFlag = "spike";
  }
  const loadScore =
    loadFlag === "spike" ? 45 : loadFlag === "rising" ? 70 : loadFlag === "detraining" ? 85 : 90;
  factors.push({
    label: "Training load balance",
    value:
      acwr == null
        ? "not enough training logged"
        : `acute:chronic ${acwr.toFixed(2)} (${loadFlag})`,
    weight: "20% of readiness",
  });

  const readiness = clamp(
    Math.round(
      sleepScore * 0.35 + sorenessScore * 0.2 + selfScore * 0.15 + hydrationScore * 0.1 + loadScore * 0.2,
    ),
  );
  const readinessBand: Twin["readinessBand"] =
    readiness >= 85 ? "peak" : readiness >= 70 ? "good" : readiness >= 50 ? "moderate" : "low";

  // ---- Recovery (rolling, slower moving than readiness) ----
  const sleepDebt = sleeps.length ? avg(sleeps.map((h) => clamp((h / sleepNeed) * 100, 0, 110))) : 60;
  const sorenessTrend = avg(
    last7.map((d) => (d.soreness == null ? 65 : clamp(100 - (d.soreness - 1) * 22))),
  );
  const restDays = last7.filter((d) => d.rest_day || d.training_minutes === 0).length;
  const restScore = clamp(restDays === 0 ? 45 : restDays >= 3 ? 95 : 70 + restDays * 8);
  const recovery = clamp(Math.round(sleepDebt * 0.4 + sorenessTrend * 0.35 + restScore * 0.25));
  const recoveryStatus: Twin["recoveryStatus"] =
    recovery >= 75 ? "recovered" : recovery >= 55 ? "recovering" : "under-recovered";
  factors.push({
    label: "Rest days in last 7",
    value: `${restDays}`,
    weight: "25% of recovery",
  });

  // ---- Adherence (calories + protein within sensible bands, on days that were logged) ----
  const logged = days.filter((d) => d.meals_logged > 0);
  const kcalHit = logged.filter(
    (d) => d.calories >= input.calorie_target * 0.85 && d.calories <= input.calorie_target * 1.15,
  ).length;
  const proteinHit = logged.filter((d) => d.protein >= input.protein_target * 0.85).length;
  const adherence = logged.length
    ? clamp(Math.round(((kcalHit + proteinHit) / (logged.length * 2)) * 100))
    : 0;
  factors.push({
    label: "Nutrition adherence",
    value: logged.length
      ? `${adherence}% across ${logged.length} logged day${logged.length === 1 ? "" : "s"}`
      : "no meals logged yet",
    weight: "drives calorie/macro tuning",
  });

  // ---- Consistency score: showing up, not perfection ----
  const window = Math.min(14, Math.max(1, days.length));
  const showedUp = days.filter(
    (d) => d.meals_logged > 0 || d.training_minutes > 0 || d.sleep_hours != null,
  ).length;
  const consistency = clamp(Math.round((showedUp / window) * 100));

  // ---- Weight trend ----
  const weighIns = days.filter((d) => d.weight_kg != null);
  let trendKgPerWeek: number | null = null;
  if (weighIns.length >= 3) {
    const newest = weighIns[0];
    const oldest = weighIns[weighIns.length - 1];
    const spanDays = Math.max(
      1,
      (Date.parse(newest.date) - Date.parse(oldest.date)) / 86400000,
    );
    trendKgPerWeek = Number(
      ((((newest.weight_kg as number) - (oldest.weight_kg as number)) / spanDays) * 7).toFixed(2),
    );
  }

  const confidence: Confidence =
    daysWithData >= 10 ? "high" : daysWithData >= 4 ? "medium" : "low";

  return {
    readiness,
    readinessBand,
    recovery,
    recoveryStatus,
    adherence,
    consistency,
    acwr,
    loadFlag,
    trendKgPerWeek,
    confidence,
    daysWithData,
    factors,
  };
}

// ---------------------------------------------------------------------------
// Daily recommendations — deterministic, explainable, safety-bounded.
// ---------------------------------------------------------------------------

export interface Recommendation {
  title: string;
  detail: string;
  why: string;
}

export interface DailyPlan {
  training: Recommendation;
  nutrition: Recommendation;
  sleep: Recommendation;
  hydration: Recommendation;
  loadAdjustment: Recommendation;
  recoveryOverride: Recommendation | null;
  smartRestDay: { offered: boolean; reason: string };
  nextBestAction: { title: string; detail: string; why: string; route: string };
  modes: string[];
  calorieSuggestion: { value: number; delta: number; why: string; capped: boolean };
  proteinSuggestion: { value: number; why: string };
}

export function buildDailyPlan(twin: Twin, input: TwinInputs): DailyPlan {
  const isTeen = (input.age ?? 30) < 18 || input.growth_mode;
  const modes: string[] = [];
  if (isTeen) modes.push("Growth & development mode");
  if (input.exam_mode) modes.push("School / exam mode");
  if (input.injuries.length) modes.push("Injury-aware mode");
  if (input.daily_budget) modes.push("Budget-aware nutrition");
  if (input.lifestyle.some((l) => /shift|night/i.test(l))) modes.push("Shift-work timing");

  // ---- Training ----
  let training: Recommendation;
  if (input.blocks_training) {
    training = {
      title: "Light movement only — plan paused",
      detail:
        "A health flag is open, so structured training stays paused. Walking, easy mobility and stretching are fine.",
      why: "An uploaded health report raised a value that should be reviewed by a doctor before load goes up.",
    };
  } else if (twin.readinessBand === "low" || twin.recoveryStatus === "under-recovered") {
    training = {
      title: "Easy day — 20–30 min low intensity",
      detail:
        "Zone-1 cardio, mobility, or technique work. Keep effort conversational (RPE 3–4) and skip heavy or maximal sets.",
      why: `Readiness ${twin.readiness}/100 and recovery ${twin.recovery}/100. Training hard on top of that usually costs more than it earns.`,
    };
  } else if (twin.loadFlag === "spike") {
    training = {
      title: "Hold volume — repeat last week's session",
      detail: "Same sets and reps as your last session; no added load or extra sets today.",
      why: `Your acute:chronic workload is ${twin.acwr}, above the 1.3 threshold where injury risk typically climbs.`,
    };
  } else if (twin.readinessBand === "peak") {
    training = {
      title: "Green light — hardest session of the week",
      detail:
        "Good day for your key strength, speed or interval work. Add one small progression (about 2–5%) if last session felt controlled.",
      why: `Readiness ${twin.readiness}/100 with ${twin.recoveryStatus} recovery and ${twin.loadFlag ?? "steady"} load.`,
    };
  } else {
    training = {
      title: "Normal session as planned",
      detail: "Run your scheduled session. Stop a set short if bar speed or form drops off.",
      why: `Readiness ${twin.readiness}/100 sits in the normal working range.`,
    };
  }
  if (input.injuries.length && !input.blocks_training) {
    training.detail += ` Work around: ${input.injuries.join(", ")}. Pain above a 3/10, sharp pain, or swelling means stop and get it looked at.`;
  }

  // ---- Dynamic calorie adjustment (safety-bounded, max 5% step) ----
  const goal = (input.goal ?? "maintain").toLowerCase();
  const band: Record<string, [number, number]> = isTeen
    ? { lose: [-0.35, -0.1], maintain: [-0.1, 0.1], recomp: [-0.1, 0.15], gain: [0.1, 0.3] }
    : { lose: [-0.75, -0.25], maintain: [-0.15, 0.15], recomp: [-0.25, 0.15], gain: [0.15, 0.4] };
  const [low, high] = band[goal] ?? band.maintain;
  let delta = 0;
  let why = `Not enough weigh-ins or logged days yet to move your target, so it stays at ${input.calorie_target} kcal.`;
  let capped = false;
  if (twin.trendKgPerWeek != null && twin.adherence >= 50 && twin.daysWithData >= 5) {
    if (twin.trendKgPerWeek < low) {
      delta = Math.round(input.calorie_target * 0.05);
      why = `You're trending ${twin.trendKgPerWeek} kg/week, faster than the ${low} to ${high} kg/week range that's safe for a "${goal}" goal — a 5% increase slows it down.`;
    } else if (twin.trendKgPerWeek > high) {
      delta = -Math.round(input.calorie_target * 0.05);
      why = `You're trending ${twin.trendKgPerWeek > 0 ? "+" : ""}${twin.trendKgPerWeek} kg/week, above the ${low} to ${high} kg/week range for a "${goal}" goal — one small 5% step down, never a crash cut.`;
    } else {
      why = `Your ${twin.trendKgPerWeek > 0 ? "+" : ""}${twin.trendKgPerWeek} kg/week trend is inside the ${low} to ${high} kg/week range with ${twin.adherence}% adherence. Nothing needs to change.`;
    }
  } else if (twin.adherence < 50 && twin.daysWithData >= 5) {
    why = `Adherence is ${twin.adherence}%. Changing the number won't help while the current one isn't being followed, so the target holds.`;
  }
  let calorieValue = input.calorie_target + delta;
  const floor = isTeen ? Math.round(input.calorie_target * 0.9) : 1200;
  if (calorieValue < floor) {
    calorieValue = floor;
    capped = true;
    why += isTeen
      ? " Held at a conservative floor — under 18, growth and schoolwork need fuel, so this app never applies an aggressive restriction."
      : " Held at the safety floor; going lower makes nutrient needs very hard to meet without supervision.";
  }

  // ---- Smart macro optimization ----
  const weight = input.weight_kg ?? 70;
  const perKg = goal === "lose" ? 2.0 : goal === "gain" ? 1.8 : 1.6;
  const proteinValue = Math.round(Math.min(2.2, Math.max(1.4, perKg)) * weight);

  let nutritionDetail = `Aim for ~${calorieValue} kcal and ~${proteinValue} g protein, split across ${input.exam_mode ? "3 meals plus 2 easy snacks around study blocks" : "3–4 meals"}.`;
  if (input.blocks_diet) {
    nutritionDetail =
      "Structured targets are paused while a health flag is open. Stick to balanced plates, regular meals and steady hydration until a professional reviews the report.";
  } else if (input.daily_budget) {
    nutritionDetail += ` Budget-aware: build around staples (eggs, dal/lentils, curd, seasonal veg, peanuts, oats) to stay near your ${input.daily_budget}/day.`;
  }
  if (twin.loadFlag === "spike" || twin.readinessBand === "peak") {
    nutritionDetail += " Put most carbs in the meals either side of training today.";
  }
  const nutrition: Recommendation = {
    title: input.blocks_diet ? "Safe general eating while your report is reviewed" : "Today's fuelling",
    detail: nutritionDetail,
    why: input.blocks_diet ? "An open health flag blocks personalized targets." : why,
  };

  // ---- Sleep ----
  const sleepNeed = isTeen ? 9 : 8;
  const lastSleep = input.days[0]?.sleep_hours ?? null;
  const sleep: Recommendation = {
    title:
      lastSleep != null && lastSleep < sleepNeed - 1
        ? `Get to bed 30–60 min earlier tonight`
        : `Hold your ${sleepNeed}h sleep window`,
    detail:
      lastSleep == null
        ? `Log last night's sleep so this stops being a guess. Target is about ${sleepNeed}h.`
        : `You logged ${lastSleep.toFixed(1)}h against a ~${sleepNeed}h need. ${lastSleep < sleepNeed - 1 ? "Screens off 45 min before bed and a fixed wake time close the gap fastest." : "Keep the wake time constant — that's what stabilises the rest."}`,
    why: isTeen
      ? "Under 18, sleep does most of the growth, learning and recovery work, so it outranks extra training."
      : "Sleep is the single largest input into your readiness score (35%).",
  };

  // ---- Hydration ----
  const waterToday = input.days[0]?.water_ml ?? 0;
  const extra = twin.loadFlag === "spike" || (input.days[0]?.training_minutes ?? 0) > 60 ? 500 : 0;
  const waterGoal = input.water_target_ml + extra;
  const hydration: Recommendation = {
    title: `${Math.max(0, waterGoal - waterToday)} ml still to drink`,
    detail: `Target ${waterGoal} ml today${extra ? " (includes +500 ml for a long/hard session)" : ""}. A glass with each meal plus one before and after training usually covers it.`,
    why: `Based on ~35 ml per kg of body weight${extra ? " with a session-length top-up" : ""}.`,
  };

  // ---- Load adjustment ----
  const loadAdjustment: Recommendation = {
    title:
      twin.loadFlag === "spike"
        ? "Cut this week's volume by about 20%"
        : twin.loadFlag === "detraining"
          ? "Add one short session this week"
          : "Keep progressing in small steps",
    detail:
      twin.loadFlag === "spike"
        ? "Drop a set from each main lift or 15–20 min from your longest session for the rest of the week."
        : twin.loadFlag === "detraining"
          ? "Your recent volume has dropped below your own baseline. Add one easy 20–30 min session rather than a big one."
          : "Progress by roughly 5% a week in load, reps or minutes — no more.",
    why:
      twin.acwr == null
        ? "Not enough logged training yet to compute a load ratio, so this is a general guideline."
        : `Acute:chronic workload ratio is ${twin.acwr}. Ratios above 1.3 are associated with higher injury risk; below 0.8 tends to mean fitness is slipping.`,
  };

  // ---- Recovery override ----
  let recoveryOverride: Recommendation | null = null;
  if (twin.recoveryStatus === "under-recovered" || twin.readiness < 45) {
    recoveryOverride = {
      title: "Recovery override active — today's plan was downgraded",
      detail:
        "Your scheduled session has been replaced with mobility, a walk, and an earlier bedtime. Nothing is lost; this is what keeps the next three weeks intact.",
      why: `Readiness ${twin.readiness}/100 and recovery ${twin.recovery}/100 both sit under the threshold where hard training reliably pays off.`,
    };
  }

  const smartRestDay = {
    offered: twin.recoveryStatus === "under-recovered" || twin.readiness < 55 || twin.loadFlag === "spike",
    reason:
      twin.loadFlag === "spike"
        ? "Your load jumped faster than your body has adapted to."
        : `Readiness ${twin.readiness}/100 with ${twin.recoveryStatus} recovery.`,
  };

  // ---- Next Best Action: the single highest-leverage thing right now ----
  let nextBestAction = {
    title: "Log your next meal",
    detail: "One photo keeps today's picture accurate and takes about 10 seconds.",
    why: "Logged data is what makes every other recommendation here specific rather than generic.",
    route: "/scan",
  };
  if (input.blocks_training || input.blocks_diet) {
    nextBestAction = {
      title: "Get your flagged report reviewed",
      detail: "Open Health to see exactly which value needs a professional's eyes.",
      why: "Until that's cleared, personalized diet and training targets stay paused for safety.",
      route: "/health",
    };
  } else if (lastSleep == null && (input.days[0]?.meals_logged ?? 0) > 0) {
    nextBestAction = {
      title: "Log last night's sleep",
      detail: "It's 35% of your readiness score and the one gap in today's data.",
      why: "Without it, today's training call is partly a guess.",
      route: "/dashboard",
    };
  } else if (recoveryOverride) {
    nextBestAction = {
      title: "Take the easy day",
      detail: "Swap today's session for 20 minutes of walking or mobility.",
      why: recoveryOverride.why,
      route: "/train",
    };
  } else if (waterGoal - waterToday > waterGoal * 0.5) {
    nextBestAction = {
      title: `Drink ${Math.round((waterGoal - waterToday) / 250)} more glasses`,
      detail: "You're more than halfway short of today's fluid target.",
      why: "Hydration is the fastest-moving lever on how you'll feel this afternoon.",
      route: "/dashboard",
    };
  } else if (twin.readinessBand === "peak" && !input.blocks_training) {
    nextBestAction = {
      title: "Do your hardest session today",
      detail: "Readiness is high — this is the day to spend it.",
      why: training.why,
      route: "/train",
    };
  } else if ((input.days[0]?.meals_logged ?? 0) === 0) {
    nextBestAction = {
      title: "Log your first meal of the day",
      detail: "Nothing logged yet today.",
      why: "The twin can only adapt to what it can see.",
      route: "/scan",
    };
  }

  return {
    training,
    nutrition,
    sleep,
    hydration,
    loadAdjustment,
    recoveryOverride,
    smartRestDay,
    nextBestAction,
    modes,
    calorieSuggestion: { value: calorieValue, delta, why, capped },
    proteinSuggestion: {
      value: proteinValue,
      why: `${perKg} g per kg of body weight for a "${goal}" goal, clamped to the 1.4–2.2 g/kg evidence range.`,
    },
  };
}

// ---------------------------------------------------------------------------
// Behaviour psychology — supportive, never shaming, never manipulative.
// ---------------------------------------------------------------------------

export function motivationPulse(twin: Twin, streak: number): string {
  if (twin.consistency >= 80)
    return `You've shown up ${twin.consistency}% of the last two weeks. That's the whole game — the results are just the receipt.`;
  if (streak >= 3) return `${streak} days in a row. Small, repeatable, yours.`;
  if (twin.daysWithData === 0)
    return "Nothing logged yet — that's a starting line, not a verdict. One entry is enough for today.";
  if (twin.consistency < 40)
    return "A quiet stretch happens to everyone. Nothing is lost and nothing needs making up — just log the next thing.";
  return "Steady progress. You don't need a perfect week, only a next one.";
}

export function confidenceLine(twin: Twin): string {
  if (twin.confidence === "high")
    return `High confidence — built on ${twin.daysWithData} days of your own data.`;
  if (twin.confidence === "medium")
    return `Medium confidence — ${twin.daysWithData} days of data. Treat the numbers as directional, not exact.`;
  return `Low confidence — only ${twin.daysWithData} day${twin.daysWithData === 1 ? "" : "s"} of data, so these are general starting points rather than personalized calls.`;
}

export function futureSelf(twin: Twin, goal: string | null, weeks = 12): string {
  const g = (goal ?? "maintain").toLowerCase();
  if (twin.trendKgPerWeek == null || twin.daysWithData < 5) {
    return `Keep the current consistency for ${weeks} weeks and the realistic picture is steadier energy, better sleep and stronger sessions. Weight and body change ranges appear here once there are enough weigh-ins to see a real trend — this app won't invent a date.`;
  }
  const lo = (twin.trendKgPerWeek * weeks * 0.6).toFixed(1);
  const hi = (twin.trendKgPerWeek * weeks * 1.1).toFixed(1);
  return `If your current ${twin.trendKgPerWeek > 0 ? "+" : ""}${twin.trendKgPerWeek} kg/week trend holds, ${weeks} weeks lands somewhere in the ${lo} to ${hi} kg range for a "${g}" goal. That's an estimated range, not a promise — sleep, stress, illness and life all move it.`;
}
