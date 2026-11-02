// ============ Nutrition Calculation Engine ============
// Deterministic nutrition math from structured food-database rows.
// The AI vision layer identifies WHAT is on the plate; this engine computes
// HOW MUCH of each nutrient it carries, from structured data instead of
// trusting free-form AI numbers.

export type EngineFood = {
  id: string;
  name: string;
  category: string;
  serving_desc: string | null;
  serving_grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  allergens: string[];
  diet_tags: string[];
  data_source: string;
  confidence: string;
  verified: boolean;
};

// ---------- Name normalization ----------
const STOP_WORDS = new Set([
  "fresh", "raw", "cooked", "boiled", "grilled", "fried", "roasted", "steamed",
  "baked", "chopped", "sliced", "diced", "minced", "medium", "small", "large",
  "whole", "homemade", "of", "a", "with", "and", "the", "some", "serving",
  "portion", "plate", "bowl", "piece", "pieces", "slice",
]);

function singular(word: string): string {
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("oes") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("sses") && word.length > 5) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) return word.slice(0, -1);
  return word;
}

export function normalizeFoodName(name: string): string[] {
  return name
    .toLowerCase()
    // keep parenthesized aliases (e.g. "Chickpea Curry (Chole)") — they are
    // common ways users and the AI name the same food; only drop punctuation
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((w) => singular(w))
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

function tokensOverlap(query: string[], candidate: string): number {
  const cand = normalizeFoodName(candidate);
  if (cand.length === 0) return 0;
  const setCand = new Set(cand);
  const hits = query.filter((t) => setCand.has(t)).length;
  return hits / Math.max(query.length, 1);
}

/** Best database match for a free-form food name. Threshold keeps near-misses out. */
export function matchFoodInDb(name: string, rows: EngineFood[]): EngineFood | null {
  const q = normalizeFoodName(name);
  if (q.length === 0) return null;
  let best: EngineFood | null = null;
  let bestScore = 0;
  for (const row of rows) {
    const cand = normalizeFoodName(row.name);
    const exact = cand.length === q.length && cand.every((t, i) => t === q[i]);
    const score = exact ? 1 : tokensOverlap(q, row.name);
    // Candidates must cover most of the query tokens, not just one stray word.
    const scoreAdj = score >= 0.5 ? score : 0;
    if (scoreAdj > bestScore) {
      bestScore = scoreAdj;
      best = row;
    }
  }
  return bestScore >= 0.5 ? best : null;
}

// ---------- Portion parsing ----------
export type ParsedPortion = {
  /** explicit grams/ml stated in the portion text */
  grams?: number;
  /** fraction of the database serving, when the portion references a serving count */
  fraction?: number;
  /** how vague the AI's portion estimate is (drives the uncertainty range) */
  vagueness: "explicit" | "serving" | "vague" | "unknown";
};

export function parsePortion(portion: string | undefined | null, servingDesc?: string | null): ParsedPortion {
  const p = (portion ?? "").toLowerCase();
  // explicit metric weight
  const g = p.match(/(\d+(?:\.\d+)?)\s*(?:g|gram|grams|gm|gms|ml|milli)/);
  if (g) return { grams: Number(g[1]), vagueness: "explicit" };
  const kg = p.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilogram)/);
  if (kg) return { grams: Number(kg[1]) * 1000, vagueness: "explicit" };
  const oz = p.match(/(\d+(?:\.\d+)?)\s*oz/);
  if (oz) return { grams: Number(oz[1]) * 28.35, vagueness: "explicit" };

  // does the portion text match the database serving description? (e.g. "1 cup")
  if (servingDesc && p.length > 0) {
    const descTokens = servingDesc.toLowerCase().replace(/[^a-z0-9\s.]/g, " ").split(/\s+/).filter(Boolean);
    const pTokens = p.replace(/[^a-z0-9\s.]/g, " ").split(/\s+/).filter(Boolean);
    const overlap = pTokens.filter((t) => descTokens.includes(t)).length;
    if (overlap >= 1 && descTokens.length > 0) {
      // counts like "2 cups" vs a 1-serving description
      const count = pTokens.find((t) => /^\d+(?:\.\d+)?$/.test(t));
      return { fraction: count ? Math.min(Number(count), 5) : 1, vagueness: "serving" };
    }
  }

  // fractions of a serving
  if (/half|1\/2|0\.5/.test(p)) return { fraction: 0.5, vagueness: "vague" };
  if (/quarter|1\/4|0\.25/.test(p)) return { fraction: 0.25, vagueness: "vague" };
  if (/3\/4|0\.75/.test(p)) return { fraction: 0.75, vagueness: "vague" };
  const bareCount = p.match(/^(\d+)$/);
  if (bareCount) return { fraction: Math.min(Number(bareCount[1]), 5), vagueness: "serving" };

  return { vagueness: "unknown" };
}

// ---------- Scaling ----------
export type ItemNutrition = {
  name: string;
  matched: boolean;
  food_name?: string;
  source: "database" | "ai";
  data_source?: string;
  verified?: boolean;
  confidence?: string;
  grams?: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  /** relative uncertainty for this item, used to build the range */
  frac: number;
};

function vaguenessFrac(v: ParsedPortion["vagueness"]): number {
  switch (v) {
    case "explicit": return 0.12;
    case "serving": return 0.2;
    case "vague": return 0.3;
    default: return 0.45;
  }
}

export function scaleFood(food: EngineFood, portion: ParsedPortion, aiCalories: number): ItemNutrition {
  const n = food.serving_grams > 0 ? food.serving_grams : 100;
  const fraction = portion.grams != null ? portion.grams / n : (portion.fraction ?? 1);
  const safeFrac = Math.min(Math.max(fraction, 0.05), 8);
  return {
    name: food.name,
    matched: true,
    food_name: food.name,
    source: "database",
    data_source: food.data_source,
    verified: food.verified,
    confidence: food.confidence,
    grams: Math.round(safeFrac * n),
    calories: Number(food.calories) * safeFrac,
    protein: Number(food.protein) * safeFrac,
    carbs: Number(food.carbs) * safeFrac,
    fat: Number(food.fat) * safeFrac,
    fiber: Number(food.fiber) * safeFrac,
    frac: vaguenessFrac(portion.vagueness),
  };
}

function aiItem(name: string, portion: string, aiCalories: number): ItemNutrition {
  // AI-only fallback: carry its calorie guess, derive rough macro split,
  // and widen the uncertainty band so the UI shows honest ranges.
  return {
    name,
    matched: false,
    source: "ai",
    calories: aiCalories,
    protein: aiCalories * 0.075,
    carbs: aiCalories * 0.45 / 4,
    fat: aiCalories * 0.35 / 9,
    fiber: aiCalories * 0.015,
    frac: 0.45,
    grams: undefined,
  };
}

export type EngineResult = {
  items: ItemNutrition[];
  totals: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
  /** calories / protein / ... -> [low, high] honest ranges */
  ranges: Record<string, [number, number]>;
  matchedCount: number;
  totalCount: number;
  /** share of items computed from the structured database */
  coverage: number;
  authoritative: boolean;
  sources: string[];
};

export function computeMealNutrition(
  foods: { name: string; portion?: string; calories?: number }[] | null | undefined,
  dbRows: EngineFood[],
): EngineResult {
  const list = foods ?? [];
  const items = list.map((f) => {
    const row = dbRows.length ? matchFoodInDb(f.name, dbRows) : null;
    if (row) {
      const portion = parsePortion(f.portion, row.serving_desc);
      return scaleFood(row, portion, f.calories ?? 0);
    }
    return aiItem(f.name, f.portion ?? "", Number(f.calories ?? 0));
  });

  const totals = items.reduce(
    (a, it) => ({
      calories: a.calories + it.calories,
      protein: a.protein + it.protein,
      carbs: a.carbs + it.carbs,
      fat: a.fat + it.fat,
      fiber: a.fiber + it.fiber,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );

  // Independent-item uncertainty: sum of values ± root-sum-square of the bands.
  const keys = ["calories", "protein", "carbs", "fat", "fiber"] as const;
  const ranges: Record<string, [number, number]> = {};
  for (const k of keys) {
    const spread = Math.sqrt(items.reduce((a, it) => a + (it[k] * it.frac) ** 2, 0));
    ranges[k] = [Math.max(0, totals[k] - spread), totals[k] + spread];
  }

  const matchedCount = items.filter((i) => i.matched).length;
  const totalCount = items.length;
  const coverage = totalCount === 0 ? 0 : matchedCount / totalCount;
  const sources = [...new Set(items.filter((i) => i.data_source).map((i) => i.data_source as string))];

  return {
    items,
    totals,
    ranges,
    matchedCount,
    totalCount,
    coverage,
    // Trust the structured computation only when most items matched; the caller
    // cross-checks against the AI total before adopting it.
    authoritative: coverage >= 0.6 && totalCount > 0,
    sources,
  };
}

/** Sanity gate: engine result may replace the AI estimate only when they agree in magnitude. */
export function engineAgreesWithAi(engine: EngineResult, aiCalories: number): boolean {
  if (aiCalories <= 0 || engine.totals.calories <= 0) return false;
  const ratio = engine.totals.calories / aiCalories;
  return ratio >= 0.5 && ratio <= 2;
}
