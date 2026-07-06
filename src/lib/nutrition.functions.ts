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
  add_to_this_meal: z.array(
    z.object({
      name: z.string(),
      amount: z.string(),
      fixes: z.string(),
      calories: z.number().default(0),
    }),
  ).default([]),
  add_to_next_meal: z.array(
    z.object({
      name: z.string(),
      amount: z.string(),
      fixes: z.string(),
      calories: z.number().default(0),
    }),
  ).default([]),
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

    const profileCtx = profile
      ? `User profile: age ${profile.age}, ${profile.gender}, ${profile.height_cm}cm, ${profile.weight_kg}kg, diet: ${profile.food_preference}, goal: ${profile.goal}, activity: ${profile.activity_level}, conditions: ${(profile.conditions ?? []).join(", ") || "none"}, targets: ${profile.calorie_target}kcal / ${profile.protein_target}g protein daily.`
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
  "add_to_this_meal": [{"name": string (specific food), "amount": string (e.g. '1/2 cup', '30g'), "fixes": string (which imbalance it corrects), "calories": number}] — ONLY items that pair well with the current plate right now (garnish, side, drink, topping). 1-4 items. Empty if meal is already balanced.
  "add_to_next_meal": [{"name": string, "amount": string, "fixes": string, "calories": number}] — items to eat later today/tomorrow to cover remaining gaps. 1-4 items.
  "recommendations": [{"nutrient": string, "current": number, "recommended": number, "action": string, "priority": "now"|"next-meal"|"info"}],
  "confidence": 0-1
}
Be specific and realistic. For 'add_to_this_meal' suggest things the user can literally add to the plate in front of them (a squeeze of lemon, a sprinkle of seeds, a glass of milk, a side of yogurt). For 'add_to_next_meal' suggest a proper dish or ingredient.
Consider the user's profile when scoring and recommending. ${profileCtx}${data.note ? ` User note: ${data.note}` : ""}`;


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

    const { error } = await context.supabase.from("meals").insert({
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
        add_to_this_meal: parsed.add_to_this_meal,
        add_to_next_meal: parsed.add_to_next_meal,
        recommendations: parsed.recommendations,
        confidence: parsed.confidence,
      },

    });
    if (error) throw new Error(error.message);
    return parsed;
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
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
    }\nToday so far: ${totals.calories.toFixed(0)}kcal, ${totals.protein.toFixed(0)}g protein, ${totals.carbs.toFixed(0)}g carbs, ${totals.fat.toFixed(0)}g fat, ${totals.fiber.toFixed(0)}g fiber. Meals logged: ${(meals ?? []).map((m) => m.name).join("; ") || "none"}.\nAlways respect dietary preference and medical conditions. Suggest specific foods with portions. When medical advice is needed, note that a professional should be consulted.`;

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: meals } = await context.supabase
      .from("meals")
      .select("name, calories, protein, fiber")
      .eq("user_id", context.userId)
      .gte("consumed_at", today.toISOString());

    const consumed = (meals ?? []).reduce(
      (a, m) => ({
        calories: a.calories + Number(m.calories ?? 0),
        protein: a.protein + Number(m.protein ?? 0),
        fiber: a.fiber + Number(m.fiber ?? 0),
      }),
      { calories: 0, protein: 0, fiber: 0 },
    );

    const remaining = {
      calories: Math.max(0, (profile.calorie_target ?? 2000) - consumed.calories),
      protein: Math.max(0, (profile.protein_target ?? 100) - consumed.protein),
      fiber: Math.max(0, (profile.fiber_target ?? 30) - consumed.fiber),
    };

    const system = `You are a meal planning AI. Generate a personalized meal plan for the remaining meals of today that fills these gaps: ${remaining.calories.toFixed(0)}kcal, ${remaining.protein.toFixed(0)}g protein, ${remaining.fiber.toFixed(0)}g fiber. Respect diet: ${profile.food_preference}. Country: ${profile.country}. Budget: ${profile.daily_budget}. Conditions: ${(profile.conditions ?? []).join(", ") || "none"}. Return ONLY JSON:
{"meals":[{"slot":"Lunch"|"Snack"|"Dinner"|"Post-workout","name":string,"why":string,"ingredients":[{"name":string,"amount":string}],"calories":number,"protein":number,"carbs":number,"fat":number,"fiber":number,"prep_minutes":number,"est_cost":number,"instructions":string}]}`;

    const content = await callGateway({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: "Plan the rest of my day." },
      ],
    });
    return extractJson(content) as {
      meals: Array<{
        slot: string;
        name: string;
        why: string;
        ingredients: { name: string; amount: string }[];
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        fiber: number;
        prep_minutes: number;
        est_cost: number;
        instructions: string;
      }>;
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

    // Ask AI for macro estimate of the added item
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
    const macros = extractJson(content) as {
      calories: number; protein: number; carbs: number; fat: number; fiber: number;
    };

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

// ---------- Scan refrigerator / pantry photo ----------
const FridgeScanSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      category: z.string(),
      freshness: z.enum(["fresh", "use-soon", "check"]).default("fresh"),
    }),
  ),
  missing_staples: z.array(z.string()).default([]),
  meal_ideas: z.array(
    z.object({
      name: z.string(),
      slot: z.enum(["breakfast", "lunch", "dinner", "snack"]),
      uses: z.array(z.string()),
      needs: z.array(z.string()).default([]),
      why: z.string(),
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: meals } = await context.supabase
      .from("meals")
      .select("calories, protein, fiber")
      .eq("user_id", context.userId)
      .gte("consumed_at", today.toISOString());
    const consumed = (meals ?? []).reduce(
      (a, m) => ({
        calories: a.calories + Number(m.calories ?? 0),
        protein: a.protein + Number(m.protein ?? 0),
        fiber: a.fiber + Number(m.fiber ?? 0),
      }),
      { calories: 0, protein: 0, fiber: 0 },
    );
    const remaining = profile
      ? {
          calories: Math.max(0, (profile.calorie_target ?? 2000) - consumed.calories),
          protein: Math.max(0, (profile.protein_target ?? 100) - consumed.protein),
          fiber: Math.max(0, (profile.fiber_target ?? 30) - consumed.fiber),
        }
      : { calories: 2000, protein: 100, fiber: 30 };

    const profileCtx = profile
      ? `Diet: ${profile.food_preference}. Goal: ${profile.goal}. Conditions: ${(profile.conditions ?? []).join(", ") || "none"}. Country: ${profile.country}. Remaining today: ${remaining.calories.toFixed(0)}kcal, ${remaining.protein.toFixed(0)}g protein, ${remaining.fiber.toFixed(0)}g fiber.`
      : "";

    const system = `You are NutriMind Pantry Vision. Look at this photo of a refrigerator, pantry, or grocery haul. Identify every visible food ingredient, then propose meals the user can cook using ONLY (or mostly) those ingredients — tuned to their profile and today's remaining nutrition targets. Return ONLY JSON:
{
  "items": [{"name": string, "category": "produce"|"dairy"|"protein"|"grain"|"condiment"|"beverage"|"other", "freshness": "fresh"|"use-soon"|"check"}],
  "missing_staples": [string] — pantry basics that would unlock more meals if bought,
  "meal_ideas": [{"name": string, "slot": "breakfast"|"lunch"|"dinner"|"snack", "uses": [string], "needs": [string] (only if truly required), "why": string (1 sentence tying to user's goal / remaining targets), "calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number, "prep_minutes": number, "instructions": string (3-5 short steps, joined with " • "), "fits_goal_score": 0-100}],
  "best_pick": string (name of the single best meal_idea for right now)
}
Give 3-5 meal ideas, ranked best first. ${profileCtx}${data.note ? ` Note: ${data.note}` : ""}`;

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

    return FridgeScanSchema.parse(extractJson(content));
  });

