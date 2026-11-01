// ============ Personalization Engine ============
// Pure signals derived from the user's own logs + profile. Server functions
// call buildPersonalizationSignals() and inject renderPersonalizationPrompt()
// so recommendations adapt to what the user actually eats — not just what
// they declared at onboarding.

export type PersonalizationMeal = {
  name: string | null;
  foods: unknown;
  calories: number | null;
  meal_score: number | null;
  consumed_at: string;
  meal_type?: string | null;
};

export type PersonalizationSignals = {
  favoriteFoods: string[];
  favoredCategories: string[];
  avgCaloriesPerMeal: number;
  mealCount: number;
  highestRated: string[];
  skippedLateMeals: boolean;
};

const CATEGORY_HINTS: { category: string; keys: string[] }[] = [
  { category: "grains", keys: ["rice", "roti", "bread", "oats", "pasta", "noodle", "wheat", "quinoa", "millet", "idli", "dosa"] },
  { category: "legumes", keys: ["dal", "lentil", "rajma", "chole", "chickpea", "beans", "tofu", "soy"] },
  { category: "dairy", keys: ["milk", "yogurt", "curd", "paneer", "cheese", "ghee"] },
  { category: "vegetables", keys: ["sabzi", "veg", "salad", "spinach", "broccoli", "carrot", "tomato", "bhindi", "palak"] },
  { category: "fruit", keys: ["banana", "apple", "mango", "orange", "papaya", "guava", "berries", "melon"] },
  { category: "protein-animal", keys: ["chicken", "egg", "fish", "mutton", "beef", "prawn", "turkey"] },
  { category: "nuts-seeds", keys: ["almond", "cashew", "peanut", "seed", "walnut", "pistachio"] },
];

export function buildPersonalizationSignals(meals: PersonalizationMeal[] | null | undefined, maxMeals = 40): PersonalizationSignals {
  const list = (meals ?? []).slice(0, maxMeals);
  const foodCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const rated: { name: string; score: number }[] = [];
  let calorieSum = 0;
  let calorieCount = 0;
  let lateMeals = 0;
  let slotCount = 0;

  for (const m of list) {
    const foods = Array.isArray(m.foods) ? (m.foods as { name?: string }[]) : [];
    for (const f of foods) {
      const n = (f?.name ?? "").trim();
      if (!n) continue;
      const key = n.toLowerCase();
      foodCounts.set(key, (foodCounts.get(key) ?? 0) + 1);
      for (const c of CATEGORY_HINTS) {
        if (c.keys.some((k) => key.includes(k))) {
          categoryCounts.set(c.category, (categoryCounts.get(c.category) ?? 0) + 1);
          break;
        }
      }
    }
    if (m.meal_score != null && m.name) rated.push({ name: m.name, score: Number(m.meal_score) });
    if (m.calories != null) {
      calorieSum += Number(m.calories);
      calorieCount += 1;
    }
    const hour = new Date(m.consumed_at).getHours();
    if (hour >= 22 || hour <= 4) lateMeals += 1;
    slotCount += 1;
  }

  return {
    favoriteFoods: [...foodCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k),
    favoredCategories: [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k),
    avgCaloriesPerMeal: calorieCount ? calorieSum / calorieCount : 0,
    mealCount: list.length,
    highestRated: rated.sort((a, b) => b.score - a.score).slice(0, 5).map((r) => r.name),
    skippedLateMeals: slotCount > 3 ? lateMeals / slotCount < 0.1 : false,
  };
}

export function renderPersonalizationPrompt(s: PersonalizationSignals): string {
  if (s.mealCount === 0) return "";
  const parts = [
    s.favoriteFoods.length ? `Frequently eaten foods: ${s.favoriteFoods.join(", ")}.` : "",
    s.favoredCategories.length ? `Preferred food groups: ${s.favoredCategories.join(", ")}.` : "",
    s.avgCaloriesPerMeal ? `Typical meal size: ~${Math.round(s.avgCaloriesPerMeal)} kcal.` : "",
    s.highestRated.length ? `Meals they rated highly: ${s.highestRated.join(", ")}.` : "",
    s.skippedLateMeals ? "They consistently avoid very late-night meals — keep suggestions within their usual eating window." : "",
  ].filter(Boolean);
  return ` PERSONALIZATION — learned from their last ${s.mealCount} logged meals: ${parts.join(" ")} Lean into foods they already enjoy; introduce novelty gently.`;
}
