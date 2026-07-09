// AI-powered nutrition server functions using Lovable AI Gateway (Gemini).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

function key() {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new Error("Missing LOVABLE_API_KEY");
  return k;
}

async function callGateway(body: unknown): Promise<string> {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("Rate limited. Please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits.");
    throw new Error(`AI error ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content ?? "";
}

function extractJson(s: string): unknown {
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : s;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
  return JSON.parse(raw);
}

type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

const emptyTotals: MacroTotals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

function addTotals<T extends Partial<MacroTotals>>(rows: T[] | null | undefined): MacroTotals {
  return (rows ?? []).reduce(
    (a, m) => ({
      calories: a.calories + Number(m.calories ?? 0),
      protein: a.protein + Number(m.protein ?? 0),
      carbs: a.carbs + Number(m.carbs ?? 0),
      fat: a.fat + Number(m.fat ?? 0),
      fiber: a.fiber + Number(m.fiber ?? 0),
    }),
    { ...emptyTotals },
  );
}

function profileTargets(profile: {
  calorie_target?: number | null;
  protein_target?: number | null;
  carbs_target?: number | null;
  fat_target?: number | null;
  fiber_target?: number | null;
  weight_kg?: number | null;
} | null): MacroTotals & { water_ml: number } {
  return {
    calories: Number(profile?.calorie_target ?? 2000),
    protein: Number(profile?.protein_target ?? 100),
    carbs: Number(profile?.carbs_target ?? 250),
    fat: Number(profile?.fat_target ?? 70),
    fiber: Number(profile?.fiber_target ?? 30),
    water_ml: Math.round(Number(profile?.weight_kg ?? 70) * 35),
  };
}

function allergyClause(profile: { allergies?: string[] | null } | null): string {
  const a = (profile?.allergies ?? []).filter(Boolean);
  if (a.length === 0) return "";
  return ` STRICT ALLERGIES — NEVER suggest, include, or hide these ingredients in ANY food, sauce, drink, add-on, recipe, grocery item, or substitute (also exclude derivatives, e.g. peanut → peanut oil, peanut butter): ${a.join(", ")}. If a recipe would require any of these, replace with a safe alternative and note the swap.`;
}

function sportContext(profile: {
  sport?: string | null;
  sport_position?: string | null;
  competition_level?: string | null;
  training_days_per_week?: number | null;
  training_hours_per_day?: number | null;
  wake_time?: string | null;
  sleep_time?: string | null;
  activity_level?: string | null;
} | null): string {
  if (!profile?.sport) return "";
  const parts = [
    `Sport: ${profile.sport}`,
    profile.sport_position ? `Position: ${profile.sport_position}` : "",
    profile.competition_level ? `Level: ${profile.competition_level}` : "",
    profile.training_days_per_week ? `Trains ${profile.training_days_per_week}×/week` : "",
    profile.training_hours_per_day ? `${profile.training_hours_per_day}h per session` : "",
    profile.wake_time ? `Wakes ${profile.wake_time}` : "",
    profile.sleep_time ? `Sleeps ${profile.sleep_time}` : "",
  ].filter(Boolean).join(" · ");
  return ` ATHLETE MODE — ${parts}. Tune pre-training (2–3h before: complex carbs + moderate protein, low fat/fiber), during-training (>60 min: 30–60g carbs/h + electrolytes), and post-training (within 45 min: 0.3g/kg protein + 1g/kg carbs) recommendations to this sport, position, and today's likely training window. Call out hydration and sodium needs for the session.`;
}

// Returns the UTC Date that corresponds to 00:00 in the user's local timezone.
function startOfLocalDay(tz?: string | null): Date {
  const tzName = tz || "UTC";
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tzName,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
    const asUtc = Date.UTC(+get("year"), +get("month") - 1, +get("day"), +get("hour"), +get("minute"), +get("second"));
    const offsetMs = asUtc - now.getTime();
    const localMidUtc = Date.UTC(+get("year"), +get("month") - 1, +get("day"), 0, 0, 0);
    return new Date(localMidUtc - offsetMs);
  } catch {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
}

function remainingFrom(targets: MacroTotals, consumed: MacroTotals): MacroTotals {
  return {
    calories: Math.max(0, targets.calories - consumed.calories),
    protein: Math.max(0, targets.protein - consumed.protein),
    carbs: Math.max(0, targets.carbs - consumed.carbs),
    fat: Math.max(0, targets.fat - consumed.fat),
    fiber: Math.max(0, targets.fiber - consumed.fiber),
  };
}

const AddOnSchema = z.object({
  name: z.string(),
  amount: z.string(),
  fixes: z.string(),
  nutrients_balanced: z.array(z.string()).default([]),
  calories: z.number().default(0),
  protein: z.number().default(0),
  carbs: z.number().default(0),
  fat: z.number().default(0),
  fiber: z.number().default(0),
});

const GrocerySuggestionSchema = z.object({
  name: z.string(),
  amount: z.string().default(""),
  reason: z.string().default("Supports today's nutrition gaps"),
  nutrients: z.array(z.string()).default([]),
  aisle: z.string().default("Other"),
  substitutes: z.array(z.object({
    name: z.string(),
    why: z.string().default(""),
  })).default([]),
});


const MealAnalysisSchema = z.object({
  name: z.string(),
  foods: z.array(
    z.object({
      name: z.string(),
      portion: z.string(),
      calories: z.number(),
    }),
  ),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  fiber: z.number(),
  micros: z.record(z.string(), z.number()).default({}),
  meal_score: z.number().min(0).max(100),
  grade: z.string(),
  highlights: z.array(z.string()).default([]),
  concerns: z.array(z.string()).default([]),
  imbalances: z.array(
    z.object({
      nutrient: z.string(),
      status: z.enum(["low", "high"]),
      severity: z.enum(["mild", "moderate", "severe"]),
      explanation: z.string(),
    }),
  ).default([]),
  plate_balance: z.array(
    z.object({
      nutrient: z.string(),
      current: z.number(),
      target_for_meal: z.number(),
      status: z.enum(["low", "balanced", "high"]),
      gap: z.number(),
      explanation: z.string(),
    }),
  ).default([]),
  add_to_this_meal: z.array(AddOnSchema).default([]),
  add_to_next_meal: z.array(AddOnSchema.extend({ prevents_gap: z.string().default("") })).default([]),
  recommendations: z.array(
    z.object({
      nutrient: z.string(),
      current: z.number(),
      recommended: z.number(),
      action: z.string(),
      priority: z.enum(["now", "next-meal", "info"]),
    }),
  ).default([]),
  confidence: z.number().min(0).max(1).default(0.75),
});


export type MealAnalysis = z.infer<typeof MealAnalysisSchema>;

// ---------- Analyze meal from photo ----------
export const analyzeMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        imageDataUrl: z.string().startsWith("data:image/"),
        note: z.string().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    // fetch profile for personalization
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();

    const today = startOfLocalDay(profile?.timezone);
    const { data: todayMeals } = await context.supabase
      .from("meals")
      .select("calories, protein, carbs, fat, fiber")
      .eq("user_id", context.userId)
      .gte("consumed_at", today.toISOString());
    const consumed = addTotals(todayMeals);
    const targets = profileTargets(profile);
    const remaining = remainingFrom(targets, consumed);

    const profileCtx = profile
      ? `User profile: age ${profile.age}, ${profile.gender}, ${profile.height_cm}cm, ${profile.weight_kg}kg, diet: ${profile.food_preference}, goal: ${profile.goal}, activity: ${profile.activity_level}, conditions: ${(profile.conditions ?? []).join(", ") || "none"}. Daily targets: ${targets.calories}kcal, ${targets.protein}g protein, ${targets.carbs}g carbs, ${targets.fat}g fat, ${targets.fiber}g fiber, ${targets.water_ml}ml water. Already eaten today: ${consumed.calories.toFixed(0)}kcal, ${consumed.protein.toFixed(0)}g protein, ${consumed.carbs.toFixed(0)}g carbs, ${consumed.fat.toFixed(0)}g fat, ${consumed.fiber.toFixed(0)}g fiber. Remaining before this meal: ${remaining.calories.toFixed(0)}kcal, ${remaining.protein.toFixed(0)}g protein, ${remaining.carbs.toFixed(0)}g carbs, ${remaining.fat.toFixed(0)}g fat, ${remaining.fiber.toFixed(0)}g fiber.`
      : "No profile.";

    const system = `You are NutriMind, an expert AI nutritionist. Analyze the meal photo. Estimate portion sizes carefully. Return ONLY JSON matching this schema:
{
  "name": string (short meal name),
  "foods": [{"name": string, "portion": string, "calories": number}],
  "calories": number, "protein": number (g), "carbs": number (g), "fat": number (g), "fiber": number (g),
  "micros": { "iron_mg": number, "calcium_mg": number, "vitamin_c_mg": number, "vitamin_d_iu": number, "b12_mcg": number, "sodium_mg": number },
  "meal_score": 0-100, "grade": "A"|"B"|"C"|"D"|"F",
  "highlights": [string], "concerns": [string],
  "imbalances": [{"nutrient": string, "status": "low"|"high", "severity": "mild"|"moderate"|"severe", "explanation": string (1 sentence why this is imbalanced for THIS user)}],
  "plate_balance": [{"nutrient": "Calories"|"Protein"|"Carbohydrates"|"Healthy fats"|"Fiber"|"Water"|string, "current": number, "target_for_meal": number, "status": "low"|"balanced"|"high", "gap": number, "explanation": string}],
  "add_to_this_meal": [{"name": string (specific food), "amount": string (e.g. '1/2 cup', '30g'), "fixes": string (which imbalance it corrects), "nutrients_balanced": [string], "calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number}] — ONLY items that pair well with the current plate right now (garnish, side, drink, topping). 1-4 items. Empty if meal is already balanced.
  "add_to_next_meal": [{"name": string, "amount": string, "fixes": string, "prevents_gap": string (how this prevents daily nutrient gaps), "nutrients_balanced": [string], "calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number}] — items for the NEXT MEAL based on remaining daily targets. 2-5 items.
  "recommendations": [{"nutrient": string, "current": number, "recommended": number, "action": string, "priority": "now"|"next-meal"|"info"}],
  "confidence": 0-1
}
Be specific and realistic. For 'plate_balance', compare this plate against a sensible single-meal share of daily needs and explain low/high nutrients. Include daily calories, protein requirements, carbohydrates, healthy fats, fiber, water recommendations, meal timing, and recovery nutrition when relevant. For 'add_to_this_meal' suggest things the user can literally add to the plate in front of them (a squeeze of lemon, a sprinkle of seeds, a glass of milk, a side of yogurt) and include exact macros. For 'add_to_next_meal' suggest a proper dish or ingredient that closes the user's remaining daily target gaps and explain what gap it prevents.
Consider the user's profile when scoring and recommending. ${profileCtx}${allergyClause(profile)}${data.note ? ` User note: ${data.note}` : ""}`;


    const content = await callGateway({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this meal. Return JSON only." },
            { type: "image_url", image_url: { url: data.imageDataUrl } },
          ],
        },
      ],
    });

    const parsed = MealAnalysisSchema.parse(extractJson(content));

    const { data: inserted, error } = await context.supabase.from("meals").insert({
      user_id: context.userId,
      name: parsed.name,
      foods: parsed.foods,
      calories: parsed.calories,
      protein: parsed.protein,
      carbs: parsed.carbs,
      fat: parsed.fat,
      fiber: parsed.fiber,
      micros: parsed.micros,
      meal_score: parsed.meal_score,
      grade: parsed.grade,
      analysis: {
        highlights: parsed.highlights,
        concerns: parsed.concerns,
        imbalances: parsed.imbalances,
        plate_balance: parsed.plate_balance,
        add_to_this_meal: parsed.add_to_this_meal,
        add_to_next_meal: parsed.add_to_next_meal,
        recommendations: parsed.recommendations,
        confidence: parsed.confidence,
      },

    }).select("id").single();
    if (error) throw new Error(error.message);
    return {
      ...parsed,
      meal_id: inserted.id,
      daily_remaining: remaining,
      water_recommendation_ml: targets.water_ml,
    };
  });

// ---------- Chat assistant ----------
export const chatWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        messages: z.array(
          z.object({ role: z.enum(["user", "assistant"]), content: z.string() }),
        ),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();

    const today = startOfLocalDay(profile?.timezone);
    const { data: meals } = await context.supabase
      .from("meals")
      .select("name, calories, protein, carbs, fat, fiber, meal_score, consumed_at")
      .eq("user_id", context.userId)
      .gte("consumed_at", today.toISOString())
      .order("consumed_at", { ascending: true });

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

    const system = `You are NutriMind AI, a personalized nutritionist, dietitian, and health coach. Reply in concise, warm, actionable markdown. Use headings and bullet points sparingly. ${
      profile
        ? `\nUser: age ${profile.age}, ${profile.gender}, ${profile.height_cm}cm/${profile.weight_kg}kg, diet ${profile.food_preference}, goal ${profile.goal}, activity ${profile.activity_level}, lifestyle: ${(profile.lifestyle ?? []).join(", ")}, conditions: ${(profile.conditions ?? []).join(", ") || "none"}, meds: ${(profile.medications ?? []).join(", ") || "none"}, country: ${profile.country}, daily budget: ${profile.daily_budget}.\nTargets: ${profile.calorie_target}kcal, ${profile.protein_target}g protein, ${profile.carbs_target}g carbs, ${profile.fat_target}g fat, ${profile.fiber_target}g fiber.`
        : ""
    }\nToday so far: ${totals.calories.toFixed(0)}kcal, ${totals.protein.toFixed(0)}g protein, ${totals.carbs.toFixed(0)}g carbs, ${totals.fat.toFixed(0)}g fat, ${totals.fiber.toFixed(0)}g fiber. Meals logged: ${(meals ?? []).map((m) => m.name).join("; ") || "none"}.\nAlways respect dietary preference and medical conditions. Suggest specific foods with portions. When medical advice is needed, note that a professional should be consulted.${allergyClause(profile)}`;

    const content = await callGateway({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: system }, ...data.messages],
    });

    return { content };
  });

// ---------- Generate meal plan ----------
export const generateMealPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile) throw new Error("Complete your profile first.");

    const today = startOfLocalDay(profile?.timezone);
    const { data: meals } = await context.supabase
      .from("meals")
      .select("name, calories, protein, carbs, fat, fiber")
      .eq("user_id", context.userId)
      .gte("consumed_at", today.toISOString());
    const { data: latestPantry } = await context.supabase
      .from("pantry_scans")
      .select("items, missing_staples, meal_ideas, best_pick, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: groceries } = await context.supabase
      .from("grocery_items")
      .select("name, amount, reason, source, checked")
      .eq("user_id", context.userId)
      .eq("checked", false)
      .order("created_at", { ascending: false })
      .limit(40);

    const consumed = addTotals(meals);
    const targets = profileTargets(profile);
    const remaining = remainingFrom(targets, consumed);
    const pantryText = latestPantry
      ? `Latest fridge scan: visible items ${JSON.stringify(latestPantry.items).slice(0, 1200)}. Fridge recipe ideas ${JSON.stringify(latestPantry.meal_ideas).slice(0, 1600)}. Missing ingredients ${JSON.stringify(latestPantry.missing_staples).slice(0, 900)}.`
      : "No fridge scan yet.";
    const groceryText = (groceries ?? []).length
      ? `Current grocery list: ${JSON.stringify(groceries).slice(0, 1200)}.`
      : "No open grocery list items.";

    const system = `You are a meal planning AI. Generate a personalized plan for the remaining meals of today. Fill these remaining gaps: ${remaining.calories.toFixed(0)}kcal, ${remaining.protein.toFixed(0)}g protein, ${remaining.carbs.toFixed(0)}g carbs, ${remaining.fat.toFixed(0)}g healthy fats, ${remaining.fiber.toFixed(0)}g fiber. Water target: ${targets.water_ml}ml/day. Respect diet: ${profile.food_preference}. Country: ${profile.country}. Budget: ${profile.daily_budget}. Goal: ${profile.goal}. Activity: ${profile.activity_level}. Conditions: ${(profile.conditions ?? []).join(", ") || "none"}.${allergyClause(profile)} ${pantryText} ${groceryText}
Use fridge ingredients first. Prefer recipes from the latest fridge scan when they fit the gaps. If something is missing, add it to grocery items with "aisle" (Produce | Dairy & Eggs | Meat & Seafood | Bakery | Grains & Pasta | Canned & Jarred | Frozen | Snacks | Beverages | Condiments & Spices | Other) and 1-2 "substitutes" [{name, why}]. Include meal timing and recovery nutrition when relevant. Return ONLY JSON:

{"meals":[{"slot":"Lunch"|"Snack"|"Dinner"|"Post-workout","name":string,"why":string,"gap_coverage":[string],"meal_timing":string,"recovery_note":string,"ingredients":[{"name":string,"amount":string}],"calories":number,"protein":number,"carbs":number,"fat":number,"fiber":number,"prep_minutes":number,"est_cost":number,"instructions":string}],"next_meal_recommendations":[{"name":string,"amount":string,"fixes":string,"prevents_gap":string,"nutrients_balanced":[string],"calories":number,"protein":number,"carbs":number,"fat":number,"fiber":number}],"grocery_items":[{"name":string,"amount":string,"reason":string,"nutrients":[string],"aisle":string,"substitutes":[{"name":string,"why":string}]}]}`;

    const content = await callGateway({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: "Plan the rest of my day." },
      ],
    });
    const parsed = z.object({
      meals: z.array(z.object({
        slot: z.string(),
        name: z.string(),
        why: z.string(),
        gap_coverage: z.array(z.string()).default([]),
        meal_timing: z.string().default("Best as your next main meal."),
        recovery_note: z.string().default(""),
        ingredients: z.array(z.object({ name: z.string(), amount: z.string() })),
        calories: z.number(),
        protein: z.number(),
        carbs: z.number(),
        fat: z.number(),
        fiber: z.number(),
        prep_minutes: z.number(),
        est_cost: z.number(),
        instructions: z.string(),
      })),
      next_meal_recommendations: z.array(AddOnSchema.extend({ prevents_gap: z.string().default("") })).default([]),
      grocery_items: z.array(GrocerySuggestionSchema).default([]),
    }).parse(extractJson(content));

    const groceryRows = parsed.grocery_items.slice(0, 24).map((item) => ({
      user_id: context.userId,
      name: item.name,
      amount: item.amount,
      reason: `${item.reason}${item.nutrients.length ? ` · Nutrients: ${item.nutrients.join(", ")}` : ""}`,
      source: "planner",
      aisle: item.aisle || "Other",
      substitutes: item.substitutes ?? [],
    }));
    if (groceryRows.length > 0) {
      await context.supabase.from("grocery_items").insert(groceryRows);
    }


    return {
      ...parsed,
      remaining,
      daily_targets: targets,
      pantry_available: latestPantry?.items ?? [],
    };
  });

// ---------- Add a supplemental item to an existing meal ----------
export const addToMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        mealId: z.string().uuid(),
        item: z.object({
          name: z.string(),
          amount: z.string(),
          calories: z.number().default(0),
          protein: z.number().default(0),
          carbs: z.number().default(0),
          fat: z.number().default(0),
          fiber: z.number().default(0),
        }),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: meal, error: readErr } = await context.supabase
      .from("meals")
      .select("*")
      .eq("id", data.mealId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!meal) throw new Error("Meal not found");

    let macros: MacroTotals = {
      calories: data.item.calories,
      protein: data.item.protein,
      carbs: data.item.carbs,
      fat: data.item.fat,
      fiber: data.item.fiber,
    };
    if (!macros.calories && !macros.protein && !macros.carbs && !macros.fat && !macros.fiber) {
      const content = await callGateway({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              'Estimate nutrition for a single food item. Return ONLY JSON: {"calories":number,"protein":number,"carbs":number,"fat":number,"fiber":number}',
          },
          { role: "user", content: `${data.item.amount} ${data.item.name}` },
        ],
      });
      macros = z.object({
        calories: z.number(),
        protein: z.number(),
        carbs: z.number(),
        fat: z.number(),
        fiber: z.number(),
      }).parse(extractJson(content));
    }

    const foods = Array.isArray(meal.foods) ? meal.foods : [];
    const updatedFoods = [
      ...foods,
      { name: data.item.name, portion: data.item.amount, calories: macros.calories, added: true },
    ];

    const { error } = await context.supabase
      .from("meals")
      .update({
        foods: updatedFoods,
        calories: Number(meal.calories ?? 0) + (macros.calories || 0),
        protein: Number(meal.protein ?? 0) + (macros.protein || 0),
        carbs: Number(meal.carbs ?? 0) + (macros.carbs || 0),
        fat: Number(meal.fat ?? 0) + (macros.fat || 0),
        fiber: Number(meal.fiber ?? 0) + (macros.fiber || 0),
      })
      .eq("id", data.mealId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true, added: macros };
  });

// ---------- Suggest substitutes for an out-of-stock grocery item ----------
export const suggestSubstitutes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ itemId: z.string().uuid(), name: z.string(), reason: z.string().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles").select("food_preference, allergies, conditions, country").eq("id", context.userId).maybeSingle();
    const system = `Suggest 3 smart grocery substitutes for an out-of-stock item. Respect diet: ${profile?.food_preference ?? "any"}. Country: ${profile?.country ?? "any"}. Conditions: ${(profile?.conditions ?? []).join(", ") || "none"}.${allergyClause(profile)} Return ONLY JSON: {"substitutes":[{"name":string,"why":string (why it works nutritionally / culinarily)}]}`;
    const content = await callGateway({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Item unavailable: ${data.name}. Original reason it was needed: ${data.reason ?? "n/a"}. Give 3 substitutes.` },
      ],
    });
    const parsed = z.object({
      substitutes: z.array(z.object({ name: z.string(), why: z.string().default("") })).default([]),
    }).parse(extractJson(content));
    const { error } = await context.supabase
      .from("grocery_items")
      .update({ substitutes: parsed.substitutes, unavailable: true })
      .eq("id", data.itemId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return parsed;
  });


// ---------- Scan refrigerator / pantry photo ----------
const FridgeScanSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      category: z.string(),
      freshness: z.enum(["fresh", "use-soon", "check"]).default("fresh"),
    }),
  ),
  missing_staples: z.array(z.union([z.string(), GrocerySuggestionSchema])).default([]),
  meal_ideas: z.array(
    z.object({
      name: z.string(),
      slot: z.enum(["breakfast", "lunch", "dinner", "snack"]),
      uses: z.array(z.string()),
      needs: z.array(z.union([z.string(), GrocerySuggestionSchema])).default([]),
      why: z.string(),
      gap_coverage: z.array(z.string()).default([]),
      calories: z.number(),
      protein: z.number(),
      carbs: z.number(),
      fat: z.number(),
      fiber: z.number(),
      prep_minutes: z.number(),
      instructions: z.string(),
      fits_goal_score: z.number().min(0).max(100),
    }),
  ),
  grocery_items: z.array(GrocerySuggestionSchema).default([]),
  best_pick: z.string().optional(),
});

export type FridgeScan = z.infer<typeof FridgeScanSchema>;

export const scanFridge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        imageDataUrl: z.string().startsWith("data:image/"),
        note: z.string().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();

    const today = startOfLocalDay(profile?.timezone);
    const { data: meals } = await context.supabase
      .from("meals")
      .select("calories, protein, carbs, fat, fiber")
      .eq("user_id", context.userId)
      .gte("consumed_at", today.toISOString());
    const consumed = addTotals(meals);
    const targets = profileTargets(profile);
    const remaining = remainingFrom(targets, consumed);

    const profileCtx = profile
      ? `Diet: ${profile.food_preference}. Goal: ${profile.goal}. Conditions: ${(profile.conditions ?? []).join(", ") || "none"}. Country: ${profile.country}. Remaining today: ${remaining.calories.toFixed(0)}kcal, ${remaining.protein.toFixed(0)}g protein, ${remaining.carbs.toFixed(0)}g carbs, ${remaining.fat.toFixed(0)}g healthy fats, ${remaining.fiber.toFixed(0)}g fiber. Water target: ${targets.water_ml}ml/day.`
      : "";

    const system = `You are NutriMind Pantry Vision. Look at this photo of a refrigerator, pantry, or grocery haul. Identify every visible food ingredient, then propose meals the user can cook using ONLY (or mostly) those ingredients — tuned to their profile and today's remaining nutrition targets. Return ONLY JSON:
{
  "items": [{"name": string, "category": "produce"|"dairy"|"protein"|"grain"|"condiment"|"beverage"|"other", "freshness": "fresh"|"use-soon"|"check"}],
  "missing_staples": [{"name": string, "amount": string, "reason": string, "nutrients": [string]}] — pantry basics that would unlock more meals and close nutrition gaps,
  "meal_ideas": [{"name": string, "slot": "breakfast"|"lunch"|"dinner"|"snack", "uses": [string], "needs": [{"name": string, "amount": string, "reason": string, "nutrients": [string]}] (only if truly required), "why": string (1 sentence tying to user's goal / remaining targets), "gap_coverage": [string] (daily calories, protein requirements, carbohydrates, healthy fats, fiber, water, meal timing, recovery nutrition covered), "calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number, "prep_minutes": number, "instructions": string (3-5 short steps, joined with " • "), "fits_goal_score": 0-100}],
  "grocery_items": [{"name": string, "amount": string, "reason": string, "nutrients": [string]}],
  "best_pick": string (name of the single best meal_idea for right now)
}
Give 3-5 meal ideas, ranked best first. For each grocery_items/missing_staples/needs entry, set "aisle" (Produce | Dairy & Eggs | Meat & Seafood | Bakery | Grains & Pasta | Canned & Jarred | Frozen | Snacks | Beverages | Condiments & Spices | Other) and add 1-2 "substitutes" [{name, why}] so the user can swap when the store is out. ${profileCtx}${allergyClause(profile)}${data.note ? ` Note: ${data.note}` : ""}`;

    const content = await callGateway({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: "Scan this fridge/pantry. Return JSON only." },
            { type: "image_url", image_url: { url: data.imageDataUrl } },
          ],
        },
      ],
    });

    const parsed = FridgeScanSchema.parse(extractJson(content));
    const emptySugg = { aisle: "Other", substitutes: [] as { name: string; why: string }[] };
    const normalizedMissing = parsed.missing_staples.map((item) =>
      typeof item === "string"
        ? { name: item, amount: "", reason: "Unlocks more balanced fridge meals", nutrients: [], ...emptySugg }
        : { ...emptySugg, ...item },
    );
    const normalizedMeals = parsed.meal_ideas.map((meal) => ({
      ...meal,
      needs: meal.needs.map((item) =>
        typeof item === "string"
          ? { name: item, amount: "", reason: "Required to complete this recipe", nutrients: [], ...emptySugg }
          : { ...emptySugg, ...item },
      ),
    }));
    const groceryByName = new Map<string, z.infer<typeof GrocerySuggestionSchema>>();
    [...normalizedMissing, ...parsed.grocery_items, ...normalizedMeals.flatMap((m) => m.needs)].forEach((item) => {
      if (!item.name) return;
      groceryByName.set(item.name.toLowerCase(), item);
    });
    const groceryRows = Array.from(groceryByName.values()).slice(0, 30).map((item) => ({
      user_id: context.userId,
      name: item.name,
      amount: item.amount,
      reason: `${item.reason}${item.nutrients.length ? ` · Nutrients: ${item.nutrients.join(", ")}` : ""}`,
      source: "fridge",
      aisle: item.aisle || "Other",
      substitutes: item.substitutes ?? [],
    }));


    const { data: saved, error: saveError } = await context.supabase
      .from("pantry_scans")
      .insert({
        user_id: context.userId,
        items: parsed.items,
        missing_staples: normalizedMissing,
        meal_ideas: normalizedMeals,
        best_pick: parsed.best_pick ?? null,
        note: data.note ?? null,
      })
      .select("id")
      .single();
    if (saveError) throw new Error(saveError.message);

    if (groceryRows.length > 0) {
      await context.supabase.from("grocery_items").insert(groceryRows);
    }

    return {
      ...parsed,
      id: saved.id,
      missing_staples: normalizedMissing,
      meal_ideas: normalizedMeals,
      grocery_items: Array.from(groceryByName.values()),
      remaining,
      daily_targets: targets,
    };
  });

