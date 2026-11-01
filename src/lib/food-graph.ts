// ============ Food Knowledge Graph ============
// Pure graph over the structured food database: categories, allergens,
// diet tags, substitutes and nutrient-complement pairs. Every suggestion the
// app shows can be traced to an edge in this graph.

import type { EngineFood } from "@/lib/nutrition-engine";
import { normalizeFoodName } from "@/lib/nutrition-engine";

export type FoodGraph = {
  rows: EngineFood[];
  byCategory: Map<string, EngineFood[]>;
  index: Map<string, EngineFood>;
};

export function buildFoodGraph(rows: EngineFood[]): FoodGraph {
  const byCategory = new Map<string, EngineFood[]>();
  const index = new Map<string, EngineFood>();
  for (const row of rows) {
    const list = byCategory.get(row.category) ?? [];
    list.push(row);
    byCategory.set(row.category, list);
    for (const tok of normalizeFoodName(row.name)) {
      if (!index.has(tok)) index.set(tok, row);
    }
  }
  return { rows, byCategory, index };
}

// ---------- Allergen derivative map ----------
// An allergy to X rules out more than literal "X": these derivatives must
// also be blocked, checked against both food names and allergen tags.
const DERIVATIVES: Record<string, string[]> = {
  peanut: ["peanut oil", "peanut butter", "groundnut", "satay", "kaju katli"],
  "tree nuts": ["almond", "cashew", "walnut", "pistachio", "pecan", "hazelnut", "macadamia", "praline"],
  milk: ["paneer", "cheese", "butter", "ghee", "yogurt", "curd", "whey", "casein", "cream", "khoya", "mawa", "lactose"],
  egg: ["mayonnaise", "mayo", "albumin", "meringue", "egg wash"],
  wheat: ["atta", "maida", "semolina", "sooji", "rava", "gluten", "bread", "pasta", "noodle", "couscous", "seitan"],
  soy: ["tofu", "soy sauce", "edamame", "miso", "tempeh", "soybean", "soya"],
  fish: ["fish oil", "anchovy", "worcestershire", "surimi"],
  shellfish: ["shrimp", "prawn", "crab", "lobster", "crayfish", "squid", "oyster", "clam", "mussel"],
  sesame: ["tahini", "til"],
  mustard: ["raee", "rai", "sarson"],
  sulphites: ["wine", "vinegar", "dried fruit"],
};

/** True when the free text conflicts with any of the user's allergies. */
export function conflictsWithAllergens(text: string, allergies: string[]): boolean {
  const t = text.toLowerCase();
  for (const allergyRaw of allergies) {
    const allergy = allergyRaw.trim().toLowerCase();
    if (!allergy) continue;
    const terms = [allergy, ...(DERIVATIVES[allergy] ?? [])];
    for (const term of terms) {
      if (t.includes(term)) return true;
    }
  }
  return false;
}

export function filterAllergenSuggestions<T extends { name?: string }>(
  items: T[],
  allergies: string[],
): { safe: T[]; blocked: string[] } {
  const safe: T[] = [];
  const blocked: string[] = [];
  for (const item of items) {
    const hay = [item.name ?? "", ...Object.values(item).filter((v) => typeof v === "string" && v.length < 200)].join(" ");
    if (allergies.length && conflictsWithAllergens(hay, allergies)) {
      blocked.push(item.name ?? "unknown item");
    } else {
      safe.push(item);
    }
  }
  return { safe, blocked };
}

/** Safe swaps for a food: same category, matching diet tags, no allergen conflict. */
export function substitutesFor(name: string, graph: FoodGraph, allergies: string[], limit = 4): EngineFood[] {
  const key = normalizeFoodName(name)[0] ?? "";
  const self = graph.index.get(key) ?? matchByRow(name, graph);
  const pool = self ? (graph.byCategory.get(self.category) ?? graph.rows) : graph.rows;
  const selfTags = new Set(self?.diet_tags ?? []);
  const candidates = pool
    .filter((r) => !self || r.id !== self.id)
    .filter((r) => !conflictsWithAllergens(`${r.name} ${r.allergens.join(" ")}`, allergies))
    .map((r) => {
      const sharedTags = r.diet_tags.filter((t) => selfTags.has(t)).length;
      const sharedName = normalizeFoodName(r.name).filter((t) => normalizeFoodName(name).includes(t)).length;
      return { r, score: sharedTags * 2 + sharedName };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.r);
  return candidates.slice(0, limit);
}

function matchByRow(name: string, graph: FoodGraph): EngineFood | null {
  for (const row of graph.rows) {
    if (row.name.toLowerCase() === name.toLowerCase()) return row;
  }
  return null;
}

// ---------- Nutrient complement pairs ----------
// Deterministic "what pairs well with this" edges, grounded in published
// nutrient-interaction knowledge (iron + vitamin C, etc.).
const COMPLEMENT_PAIRS: { a: string[]; b: string[]; why: string }[] = [
  {
    a: ["spinach", "lentil", "chickpea", "beans", "tofu", "rajma", "chole", "beet", "dates", "jaggery", "red meat", "liver"],
    b: ["tomato", "lemon", "lime", "citrus", "orange", "amla", "bell pepper", "capsicum", "guava", "strawberry", "broccoli"],
    why: "Vitamin C from the pairing food boosts absorption of plant/iron-rich sources by 2–3×",
  },
  {
    a: ["rice", "wheat", "bread", "roti", "oats", "corn", "millet"],
    b: ["lentil", "beans", "chickpea", "rajma", "chole", "tofu", "pea", "soy"],
    why: "Grain + legume together form a complete amino-acid profile",
  },
  {
    a: ["salmon", "egg", "mushroom", "fortified milk"],
    b: ["milk", "yogurt", "cheese", "paneer", "sardine"],
    why: "Vitamin D improves calcium uptake from dairy sources",
  },
  {
    a: ["carrot", "papaya", "mango", "sweet potato", "pumpkin"],
    b: ["ghee", "olive oil", "avocado", "nuts", "peanut", "coconut"],
    why: "A little healthy fat carries fat-soluble vitamins A, D, E, K",
  },
];

export function complementFor(foodName: string): { pair: string; why: string } | null {
  const toks = normalizeFoodName(foodName);
  for (const pair of COMPLEMENT_PAIRS) {
    const inA = pair.a.some((k) => toks.some((t) => k.includes(t) || t.includes(k)));
    const inB = pair.b.some((k) => toks.some((t) => k.includes(t) || t.includes(k)));
    if (inA) {
      return { pair: `pair with one of: ${pair.b.slice(0, 4).join(", ")}`, why: pair.why };
    }
    if (inB) {
      return { pair: `pair with one of: ${pair.a.slice(0, 4).join(", ")}`, why: pair.why };
    }
  }
  return null;
}

/** Complement suggestions for a whole plate, allergy-safe, deduplicated. */
export function complementsForPlate(
  foodNames: string[],
  allergies: string[],
): { pair: string; why: string; from: string }[] {
  const out: { pair: string; why: string; from: string }[] = [];
  const seen = new Set<string>();
  for (const name of foodNames) {
    if (conflictsWithAllergens(name, allergies)) continue;
    const c = complementFor(name);
    if (c && !seen.has(c.why)) {
      seen.add(c.why);
      out.push({ ...c, from: name });
    }
  }
  return out.slice(0, 3);
}
