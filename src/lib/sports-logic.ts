// Deterministic sport-science engine. No AI: every number here can be traced to an
// explicit rule, so recommendations stay explainable and reproducible.
//
// SAFETY: this is general educational guidance, not medical or coaching advice.

export interface SportRow {
  id: string;
  name: string;
  category: string;
  disciplines: string[];
  events: string[];
  positions: string[];
  aliases: string[];
  energy_aerobic: number;
  energy_glycolytic: number;
  energy_alactic: number;
  primary_qualities: string[];
  typical_season: string | null;
  contact_level: string;
  weight_sensitive: boolean;
  popularity: number;
  data_source: string;
  confidence: string;
}

export type DayType = "practice" | "match" | "competition" | "travel" | "recovery";

export const DAY_TYPES: { id: DayType; label: string; blurb: string }[] = [
  { id: "practice", label: "Practice day", blurb: "Normal skill + conditioning session" },
  { id: "match", label: "Match day", blurb: "One competitive game today" },
  { id: "competition", label: "Competition day", blurb: "Multi-round / all-day event" },
  { id: "travel", label: "Travel day", blurb: "On the road, limited food control" },
  { id: "recovery", label: "Recovery day", blurb: "Rest or light regeneration" },
];

export const SEASON_PHASES = ["Off-season", "Pre-season", "In-season", "Peaking", "Transition"] as const;
export type SeasonPhase = (typeof SEASON_PHASES)[number];

export interface AthleteInputs {
  weight_kg: number;
  age: number | null;
  sport: SportRow | null;
  position: string | null;
  competition_level: string | null;
  training_days_per_week: number;
  training_hours_per_day: number;
  season_phase: SeasonPhase;
}

export interface FuelPlan {
  dayType: DayType;
  carbs_g: number;
  carbs_g_per_kg: number;
  protein_g: number;
  protein_g_per_kg: number;
  fat_g: number;
  calories: number;
  fluid_ml: number;
  sodium_mg: number;
  timeline: { when: string; what: string; why: string }[];
  why: string[];
}

const LEVEL_MULT: Record<string, number> = {
  recreational: 0.9,
  club: 1,
  school: 0.95,
  state: 1.05,
  national: 1.12,
  elite: 1.18,
  professional: 1.2,
};

function levelMult(level: string | null | undefined) {
  const key = (level ?? "").toLowerCase();
  const hit = Object.keys(LEVEL_MULT).find((k) => key.includes(k));
  return hit ? LEVEL_MULT[hit] : 1;
}

const PHASE_MULT: Record<SeasonPhase, number> = {
  "Off-season": 0.9,
  "Pre-season": 1.05,
  "In-season": 1,
  Peaking: 1.02,
  Transition: 0.85,
};

/** Carbohydrate need is driven mostly by how glycolytic + aerobic the sport is. */
export function carbBase(sport: SportRow | null): number {
  if (!sport) return 4;
  const endurance = (sport.energy_aerobic + sport.energy_glycolytic * 0.6) / 100;
  return Math.round((3 + endurance * 4) * 10) / 10; // 3.0 – 7.0 g/kg
}

export function proteinBase(sport: SportRow | null): number {
  if (!sport) return 1.6;
  const strength = (sport.energy_alactic + sport.energy_glycolytic * 0.5) / 100;
  return Math.round((1.4 + strength * 0.8) * 10) / 10; // 1.4 – 2.2 g/kg
}

export function buildFuelPlan(inp: AthleteInputs, dayType: DayType): FuelPlan {
  const kg = Math.max(30, inp.weight_kg || 70);
  const sport = inp.sport;
  const lm = levelMult(inp.competition_level);
  const pm = PHASE_MULT[inp.season_phase] ?? 1;
  const hours = Math.max(0.5, inp.training_hours_per_day || 1);

  const dayCarbMult: Record<DayType, number> = {
    practice: 1,
    match: 1.15,
    competition: 1.25,
    travel: 0.85,
    recovery: 0.75,
  };
  const dayFluidMult: Record<DayType, number> = {
    practice: 1,
    match: 1.15,
    competition: 1.25,
    travel: 1.1,
    recovery: 0.9,
  };

  let carbsPerKg = carbBase(sport) * dayCarbMult[dayType] * lm * pm;
  // Longer sessions need more; short sessions need less.
  carbsPerKg *= dayType === "recovery" || dayType === "travel" ? 1 : 0.85 + Math.min(0.5, hours * 0.15);
  carbsPerKg = Math.round(Math.min(10, Math.max(2.5, carbsPerKg)) * 10) / 10;

  let proteinPerKg = proteinBase(sport) * (dayType === "recovery" ? 1.05 : 1) * lm;
  // Youth athletes get a growth-protective floor and no restriction.
  if (inp.age && inp.age < 18) proteinPerKg = Math.max(1.5, proteinPerKg);
  proteinPerKg = Math.round(Math.min(2.4, Math.max(1.2, proteinPerKg)) * 10) / 10;

  const carbs_g = Math.round(carbsPerKg * kg);
  const protein_g = Math.round(proteinPerKg * kg);
  const fat_g = Math.round(kg * (dayType === "competition" || dayType === "match" ? 0.8 : 1.0));
  const calories = Math.round(carbs_g * 4 + protein_g * 4 + fat_g * 9);

  const sweatFactor = sport && sport.energy_aerobic > 55 ? 1.15 : 1;
  const fluid_ml = Math.round(kg * 35 * dayFluidMult[dayType] * sweatFactor + hours * 600);
  const sodium_mg = Math.round(500 + hours * (dayType === "recovery" ? 150 : 450));

  const name = sport?.name ?? "your training";
  const timelines: Record<DayType, { when: string; what: string; why: string }[]> = {
    practice: [
      { when: "3 h before", what: `${Math.round(kg * 1.5)} g carbs + ${Math.round(kg * 0.35)} g protein, low fat/fibre`, why: "Tops up muscle glycogen while leaving the stomach comfortable." },
      { when: "30 min before", what: "200–300 ml fluid + optional small carb snack", why: "Starts the session hydrated without sloshing." },
      { when: "During (>60 min)", what: "30–60 g carbs/hour + 400–800 ml fluid", why: "Maintains blood glucose so late-session skill quality holds." },
      { when: "Within 45 min after", what: `${Math.round(kg * 0.3)} g protein + ${Math.round(kg * 1)} g carbs`, why: "Fastest window for glycogen resynthesis and muscle repair." },
    ],
    match: [
      { when: "Night before", what: `Carb-focused dinner (~${Math.round(kg * 2)} g carbs)`, why: "Full glycogen stores before a maximal effort." },
      { when: "3–4 h pre-match", what: `${Math.round(kg * 2)} g carbs, familiar foods only`, why: "Nothing new on match day — reduces gut risk." },
      { when: "60 min pre", what: "300–500 ml fluid with electrolytes", why: "Arrives euhydrated; sodium helps retain the fluid." },
      { when: "Half-time / breaks", what: "20–30 g fast carbs + 250 ml fluid", why: "Restores second-half sprint capacity." },
      { when: "Post-match", what: `${Math.round(kg * 0.35)} g protein + ${Math.round(kg * 1.2)} g carbs + ${Math.round(kg * 20)} ml fluid`, why: "Recovery starts the moment the whistle goes." },
    ],
    competition: [
      { when: "Wake-up", what: `Breakfast ${Math.round(kg * 2)} g carbs, moderate protein`, why: "Long days need a full tank at the start." },
      { when: "Between rounds (<2 h)", what: "Liquid carbs + fruit, 30–60 g per hour", why: "Digestible fuel keeps you sharp without heaviness." },
      { when: "Between rounds (>3 h)", what: "Small mixed meal: carbs + lean protein", why: "Rebuilds glycogen when the gap allows real food." },
      { when: "All day", what: `Sip to total ~${fluid_ml} ml with electrolytes`, why: "Repeated efforts multiply sweat loss." },
      { when: "End of day", what: "Full recovery meal + 7–9 h sleep", why: "Tomorrow's performance is decided tonight." },
    ],
    travel: [
      { when: "Pack ahead", what: "Nuts, fruit, oat bars, jerky/paneer, shaker", why: "Airport/roadside options are often high-fat and low-protein." },
      { when: "Every 2 h", what: "150–250 ml water", why: "Cabin air and long sitting dehydrate you quietly." },
      { when: "Meals", what: "Keep protein at each meal, choose plain carbs", why: "Protects muscle when training volume drops." },
      { when: "On arrival", what: "Light walk + daylight exposure", why: "Speeds circadian adjustment and reduces stiffness." },
    ],
    recovery: [
      { when: "All day", what: `${protein_g} g protein spread over 4 meals`, why: "Even distribution beats one large dose for repair." },
      { when: "Meals", what: "Colourful veg, fruit, omega-3 source", why: "Supports tissue repair and reduces perceived soreness." },
      { when: "Evening", what: "Carbs at dinner + consistent sleep time", why: "Aids sleep quality, which is the strongest recovery lever." },
    ],
  };

  const why = [
    `Carbs set at ${carbsPerKg} g/kg because ${name} is ~${sport?.energy_aerobic ?? 40}% aerobic and ~${sport?.energy_glycolytic ?? 30}% glycolytic.`,
    `${DAY_TYPES.find((d) => d.id === dayType)!.label} multiplier ×${dayCarbMult[dayType]} applied to the baseline.`,
    `Competition level (${inp.competition_level ?? "unspecified"}) ×${lm} and ${inp.season_phase} phase ×${pm}.`,
    `Protein at ${proteinPerKg} g/kg reflects the strength/power share of the sport${inp.age && inp.age < 18 ? " with a youth growth floor of 1.5 g/kg" : ""}.`,
    `Fluid estimate assumes ${hours} h of work; weigh yourself before and after to personalise it.`,
  ];

  return {
    dayType,
    carbs_g,
    carbs_g_per_kg: carbsPerKg,
    protein_g,
    protein_g_per_kg: proteinPerKg,
    fat_g,
    calories,
    fluid_ml,
    sodium_mg,
    timeline: timelines[dayType],
    why,
  };
}

/** Weekly split of training emphasis, scaled to the sport's energy profile and phase. */
export interface EmphasisSlice {
  quality: string;
  pct: number;
  why: string;
}

export function trainingEmphasis(inp: AthleteInputs): EmphasisSlice[] {
  const s = inp.sport;
  const aer = s?.energy_aerobic ?? 40;
  const gly = s?.energy_glycolytic ?? 30;
  const ala = s?.energy_alactic ?? 30;
  const phase = inp.season_phase;

  const base = {
    "Skill + sport practice": 30,
    "Strength": 8 + ala * 0.15,
    "Speed & power": 5 + ala * 0.12,
    "Endurance / conditioning": 5 + aer * 0.2,
    "Mobility & stability": 12,
    "Recovery work": 10 + gly * 0.05,
  } as Record<string, number>;

  if (phase === "Off-season") { base["Strength"] *= 1.4; base["Skill + sport practice"] *= 0.7; }
  if (phase === "Pre-season") { base["Endurance / conditioning"] *= 1.3; base["Speed & power"] *= 1.2; }
  if (phase === "In-season") { base["Skill + sport practice"] *= 1.25; base["Endurance / conditioning"] *= 0.75; base["Strength"] *= 0.8; }
  if (phase === "Peaking") { base["Speed & power"] *= 1.3; base["Endurance / conditioning"] *= 0.6; base["Recovery work"] *= 1.3; }
  if (phase === "Transition") { base["Skill + sport practice"] *= 0.5; base["Recovery work"] *= 1.8; base["Mobility & stability"] *= 1.4; }

  const total = Object.values(base).reduce((a, b) => a + b, 0);
  const reasons: Record<string, string> = {
    "Skill + sport practice": "Technical quality transfers more than any gym lift; kept highest in-season.",
    "Strength": `Alactic (max-effort) share of the sport is ${ala}%, so force production matters this much.`,
    "Speed & power": "Expressed early in sessions when the nervous system is fresh.",
    "Endurance / conditioning": `Aerobic share is ${aer}% — this builds the base you repeat efforts on.`,
    "Mobility & stability": "Protects joints under the sport's specific loading pattern.",
    "Recovery work": "Deliberate low-intensity work keeps weekly load sustainable.",
  };

  return Object.entries(base)
    .map(([quality, v]) => ({ quality, pct: Math.round((v / total) * 100), why: reasons[quality] }))
    .sort((a, b) => b.pct - a.pct);
}

/** Position-specific emphasis, derived from the sport's qualities and the chosen role. */
export function positionGuidance(sport: SportRow | null, position: string | null): string[] {
  if (!sport) return [];
  const out: string[] = [];
  const p = (position ?? "").toLowerCase();

  if (/keeper|goalie|goaltender|goalkeeper/.test(p)) {
    out.push("Reactive agility, short explosive dives and landing mechanics over long-distance running.");
    out.push("Lower total energy demand than outfield roles — keep carbs at the lower end of your range on quiet match days.");
  } else if (/back|defen|lock|prop|line/.test(p)) {
    out.push("Bracing strength, collision tolerance and neck/trunk stability take priority.");
  } else if (/mid|centre|center|guard/.test(p)) {
    out.push("Highest running volume in most team sports — aerobic base and repeat-sprint ability lead your week.");
  } else if (/wing|forward|striker|receiver|raider|attack/.test(p)) {
    out.push("Maximum speed and acceleration are decisive — protect sprint quality with full recoveries.");
  } else if (/bowler|pitcher|thrower|server/.test(p)) {
    out.push("Manage throwing/bowling volume like a load metric; shoulder and hip mobility work daily.");
  } else if (p) {
    out.push(`Bias sessions toward the demands you meet most often as a ${position}.`);
  }

  out.push(`Sport-wide priorities: ${sport.primary_qualities.join(", ") || "general athleticism"}.`);
  if (sport.contact_level === "collision") out.push("Collision sport: include neck strength and landing/deceleration work, and never train through concussion symptoms.");
  if (sport.weight_sensitive) out.push("Weight-category or aesthetics-linked sport: no aggressive cuts here — use gradual changes and speak to a sports dietitian.");
  return out;
}

/** Acute:chronic workload ratio — the standard load-management guardrail. */
export interface LoadState {
  acute: number;
  chronic: number;
  ratio: number | null;
  status: "insufficient data" | "undertrained" | "optimal" | "elevated" | "high risk";
  message: string;
}

export function loadState(sessions: { date: string; load: number }[], today: string): LoadState {
  const dayDiff = (a: string, b: string) =>
    Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86400000);
  const within = (n: number) => sessions.filter((s) => { const d = dayDiff(s.date, today); return d >= 0 && d < n; });

  const acute = within(7).reduce((a, s) => a + s.load, 0);
  const chronic28 = within(28).reduce((a, s) => a + s.load, 0);
  const chronic = chronic28 / 4;

  if (within(28).length < 4 || chronic === 0) {
    return { acute, chronic: Math.round(chronic), ratio: null, status: "insufficient data", message: "Log at least 4 sessions over 4 weeks and this becomes a real load ratio." };
  }
  const ratio = Math.round((acute / chronic) * 100) / 100;
  if (ratio < 0.8) return { acute, chronic: Math.round(chronic), ratio, status: "undertrained", message: "This week is well below your 4-week average — you can safely add a little volume." };
  if (ratio <= 1.3) return { acute, chronic: Math.round(chronic), ratio, status: "optimal", message: "Your week sits in the sweet spot relative to what you're conditioned for." };
  if (ratio <= 1.5) return { acute, chronic: Math.round(chronic), ratio, status: "elevated", message: "Load is climbing faster than your base. Hold volume steady for a week." };
  return { acute, chronic: Math.round(chronic), ratio, status: "high risk", message: "Sharp spike vs your 4-week base — this pattern is associated with higher injury risk. Reduce volume and prioritise sleep." };
}

export interface ReadinessBreakdown {
  score: number;
  parts: { label: string; value: number; weight: number; note: string }[];
  verdict: string;
  flags: string[];
}

export function readiness(args: {
  sleep_hours: number | null;
  soreness: number | null;
  mood: number | null;
  hydrationPct: number;
  load: LoadState;
}): ReadinessBreakdown {
  const sleep = args.sleep_hours != null ? Math.min(1, args.sleep_hours / 8) : 0.6;
  const soreness = args.soreness != null ? 1 - args.soreness / 10 : 0.7;
  const mood = args.mood != null ? args.mood / 10 : 0.7;
  const hydration = Math.min(1, args.hydrationPct / 100);
  const loadScore = args.load.ratio == null ? 0.7 : args.load.ratio > 1.5 ? 0.35 : args.load.ratio > 1.3 ? 0.6 : 0.9;

  const parts = [
    { label: "Sleep", value: sleep, weight: 0.3, note: args.sleep_hours != null ? `${args.sleep_hours} h logged` : "not logged — assumed average" },
    { label: "Soreness", value: soreness, weight: 0.2, note: args.soreness != null ? `${args.soreness}/10 reported` : "not logged" },
    { label: "Mood / stress", value: mood, weight: 0.15, note: args.mood != null ? `${args.mood}/10 reported` : "not logged" },
    { label: "Hydration", value: hydration, weight: 0.15, note: `${Math.round(args.hydrationPct)}% of today's fluid target` },
    { label: "Training load", value: loadScore, weight: 0.2, note: args.load.ratio == null ? "not enough history" : `acute:chronic ${args.load.ratio}` },
  ];
  const score = Math.round(parts.reduce((a, p) => a + p.value * p.weight, 0) * 100);

  const flags: string[] = [];
  if (args.sleep_hours != null && args.sleep_hours < 6) flags.push("Under 6 h sleep — cut intensity today, keep the skill work.");
  if (args.soreness != null && args.soreness >= 7) flags.push("High soreness — if it's sharp, one-sided or joint pain, stop and see a physiotherapist.");
  if (args.load.status === "high risk") flags.push(args.load.message);

  const verdict =
    score >= 80 ? "Green — go ahead with the planned session."
    : score >= 60 ? "Amber — train, but hold intensity at 80% and keep volume as planned."
    : "Red — swap for mobility, technique or full rest. Ramping up today costs more than it gains.";

  return { score, parts, verdict, flags };
}

export interface PhasePlan {
  phase: SeasonPhase;
  focus: string;
  volume: string;
  intensity: string;
  why: string;
}

export const PERIODIZATION: PhasePlan[] = [
  { phase: "Off-season", focus: "Build strength, fix asymmetries, general aerobic base", volume: "High", intensity: "Moderate", why: "Furthest from competition — the safest time to accumulate work and change physical qualities." },
  { phase: "Pre-season", focus: "Sport-specific conditioning, speed development, tactical volume", volume: "High → moderate", intensity: "Rising", why: "Convert the off-season base into the exact demands of your sport before results matter." },
  { phase: "In-season", focus: "Maintain strength & speed, prioritise skill and freshness", volume: "Moderate → low", intensity: "Match-driven", why: "Two short quality gym sessions per week maintain qualities without competing with match performance." },
  { phase: "Peaking", focus: "Taper volume, keep intensity sharp, maximise recovery", volume: "Low", intensity: "High but brief", why: "Reduced volume with retained intensity is the best-supported way to arrive fresh and fast." },
  { phase: "Transition", focus: "Active rest, mobility, unrelated movement you enjoy", volume: "Low", intensity: "Low", why: "Planned downtime prevents burnout and lets niggles fully resolve." },
];

/** Simple 0–100 profile across the three performance qualities. */
export function performanceProfile(sport: SportRow | null) {
  const s = sport;
  return [
    { label: "Power", value: s?.energy_alactic ?? 30, why: "Share of efforts under ~10 s at maximal output." },
    { label: "Speed / anaerobic", value: s?.energy_glycolytic ?? 30, why: "Repeated hard efforts of ~10 s – 2 min." },
    { label: "Endurance", value: s?.energy_aerobic ?? 40, why: "Sustained aerobic work and between-effort recovery." },
  ];
}

export const SAFETY_DISCLAIMER =
  "NutriMind gives general sports-science guidance. It is not a substitute for a qualified coach, sports physician, physiotherapist or dietitian. Stop training and seek professional care for pain, swelling, dizziness, chest symptoms, head impacts, or fatigue that doesn't clear with rest.";
