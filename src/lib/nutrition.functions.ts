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
  "recommendations": [{"nutrient": string, "current": number, "recommended": number, "action": string (specific food + serving), "priority": "now"|"next-meal"|"info"}],
  "confidence": 0-1
}
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
