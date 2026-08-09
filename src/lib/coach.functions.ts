// Daily coaching system: builds the Digital Twin from the user's own logged data,
// derives deterministic recommendations, and persists one coaching card per local day.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { addDays, dateKeyOf } from "@/lib/dates";
import {
  buildDailyPlan,
  buildTwin,
  confidenceLine,
  futureSelf,
  motivationPulse,
  type DailyPlan,
  type DayRecord,
  type Twin,
  type TwinInputs,
} from "@/lib/digital-twin";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callGateway(body: unknown): Promise<string> {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new Error("Missing LOVABLE_API_KEY");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": k },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("Rate limited. Please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits.");
    throw new Error(`AI error ${res.status}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

const intensityFactor = (i: string | null) =>
  i === "high" ? 1.5 : i === "low" ? 0.6 : 1;

export interface Habit {
  id: string;
  name: string;
  cue: string | null;
  routine: string | null;
  reward: string | null;
  identity_statement: string | null;
  target_days_per_week: number;
  done_today: boolean;
  days_done_this_week: number;
}

export interface CoachPayload {
  date: string;
  twin: Twin;
  plan: DailyPlan;
  narrative: string | null;
  nba_done: boolean;
  confidence_line: string;
  motivation: string;
  future_self: string;
  streak: { days: number; best: number; shields_available: number; at_risk: boolean };
  identity_statement: string | null;
  habits: Habit[];
  micro_wins: { id: string; title: string; detail: string | null; log_date: string }[];
  today_inputs: {
    sleep_hours: number | null;
    soreness: number | null;
    mood: number | null;
    readiness: number | null;
    water_ml: number;
  };
}

export const getCoachToday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CoachPayload> => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles").select("*").eq("id", userId).maybeSingle();

    const tz = profile?.timezone ?? null;
    const today = dateKeyOf(new Date(), tz);
    const from = addDays(today, -13);

    const [metricsRes, mealsRes, workoutsRes, flagsRes, stateRes, habitsRes, winsRes, dayRes] =
      await Promise.all([
        supabase.from("daily_metrics").select("*").eq("user_id", userId).gte("log_date", from),
        supabase.from("meals").select("calories, protein, consumed_at").eq("user_id", userId)
          .gte("consumed_at", `${from}T00:00:00`),
        supabase.from("workouts").select("duration_min, intensity, rest_day, completed, scheduled_for")
          .eq("user_id", userId).gte("scheduled_for", `${from}T00:00:00`),
        supabase.from("health_flags").select("blocks_diet, blocks_training, acknowledged")
          .eq("user_id", userId),
        supabase.from("coach_state").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("habits").select("*").eq("user_id", userId).eq("active", true)
          .order("created_at"),
        supabase.from("micro_wins").select("id, title, detail, log_date").eq("user_id", userId)
          .order("log_date", { ascending: false }).limit(12),
        supabase.from("coach_days").select("*").eq("user_id", userId).eq("log_date", today).maybeSingle(),
      ]);

    const metrics = metricsRes.data ?? [];
    const days: DayRecord[] = [];
    for (let i = 0; i < 14; i++) {
      const key = addDays(today, -i);
      const m = metrics.find((x) => x.log_date === key);
      const dayMeals = (mealsRes.data ?? []).filter(
        (x) => dateKeyOf(new Date(x.consumed_at), tz) === key,
      );
      const dayWorkouts = (workoutsRes.data ?? []).filter(
        (w) => dateKeyOf(new Date(w.scheduled_for), tz) === key,
      );
      const trainingMinutes = dayWorkouts
        .filter((w) => w.completed && !w.rest_day)
        .reduce((a, w) => a + Number(w.duration_min ?? 0), 0);
      days.push({
        date: key,
        calories: dayMeals.reduce((a, x) => a + Number(x.calories ?? 0), 0),
        protein: dayMeals.reduce((a, x) => a + Number(x.protein ?? 0), 0),
        meals_logged: dayMeals.length,
        water_ml: Number(m?.water_ml ?? 0),
        sleep_hours: m?.sleep_hours == null ? null : Number(m.sleep_hours),
        soreness: m?.soreness ?? null,
        mood: m?.mood ?? null,
        readiness_self: m?.readiness ?? null,
        weight_kg: m?.weight_kg == null ? null : Number(m.weight_kg),
        training_minutes: trainingMinutes,
        training_load: dayWorkouts
          .filter((w) => w.completed && !w.rest_day)
          .reduce((a, w) => a + Number(w.duration_min ?? 0) * intensityFactor(w.intensity), 0),
        rest_day: dayWorkouts.some((w) => w.rest_day) || trainingMinutes === 0,
      });
    }

    const openFlags = (flagsRes.data ?? []).filter((f) => !f.acknowledged);
    const injuries = Array.isArray(profile?.injuries)
      ? (profile.injuries as unknown[]).map(String).filter(Boolean)
      : [];

    const inputs: TwinInputs = {
      age: profile?.age ?? null,
      goal: profile?.goal ?? null,
      weight_kg: profile?.weight_kg == null ? null : Number(profile.weight_kg),
      lifestyle: profile?.lifestyle ?? [],
      exam_mode: Boolean(profile?.exam_mode),
      injuries,
      growth_mode: Boolean(profile?.growth_mode),
      daily_budget: profile?.daily_budget == null ? null : Number(profile.daily_budget),
      timezone: tz,
      training_days_per_week: profile?.training_days_per_week ?? null,
      calorie_target: Number(profile?.calorie_target ?? 2000),
      protein_target: Number(profile?.protein_target ?? 100),
      water_target_ml: Math.round(Number(profile?.weight_kg ?? 70) * 35),
      days,
      blocks_training: openFlags.some((f) => f.blocks_training),
      blocks_diet: openFlags.some((f) => f.blocks_diet),
    };

    const twin = buildTwin(inputs);
    const plan = buildDailyPlan(twin, inputs);

    // ---- Streak & consistency (streak protection: a shield covers one missed day) ----
    const state = stateRes.data;
    const activeToday = days[0].meals_logged > 0 || days[0].training_minutes > 0 || days[0].sleep_hours != null;
    let streak = 0;
    for (const d of days) {
      const active = d.meals_logged > 0 || d.training_minutes > 0 || d.sleep_hours != null;
      if (active) streak++;
      else if (d.date === today) continue;
      else break;
    }
    const best = Math.max(streak, Number(state?.best_streak ?? 0));
    await supabase.from("coach_state").upsert(
      {
        user_id: userId,
        streak_days: streak,
        best_streak: best,
        last_active_date: activeToday ? today : (state?.last_active_date ?? null),
        consistency_score: twin.consistency,
      },
      { onConflict: "user_id" },
    );

    // ---- Habits ----
    const habitIds = (habitsRes.data ?? []).map((h) => h.id);
    const weekStart = addDays(today, -6);
    const { data: habitLogs } = habitIds.length
      ? await supabase.from("habit_logs").select("habit_id, log_date, done")
          .eq("user_id", userId).gte("log_date", weekStart)
      : { data: [] as { habit_id: string; log_date: string; done: boolean }[] };
    const habits: Habit[] = (habitsRes.data ?? []).map((h) => ({
      id: h.id,
      name: h.name,
      cue: h.cue,
      routine: h.routine,
      reward: h.reward,
      identity_statement: h.identity_statement,
      target_days_per_week: h.target_days_per_week,
      done_today: (habitLogs ?? []).some((l) => l.habit_id === h.id && l.log_date === today && l.done),
      days_done_this_week: (habitLogs ?? []).filter((l) => l.habit_id === h.id && l.done).length,
    }));

    // ---- Persist the day's card ----
    await supabase.from("coach_days").upsert(
      {
        user_id: userId,
        log_date: today,
        twin: JSON.parse(JSON.stringify(twin)),
        recommendations: JSON.parse(JSON.stringify(plan)),
        next_best_action: JSON.parse(JSON.stringify(plan.nextBestAction)),
        factors: JSON.parse(JSON.stringify(twin.factors)),

      },
      { onConflict: "user_id,log_date" },
    );

    return {
      date: today,
      twin,
      plan,
      narrative: dayRes.data?.narrative ?? null,
      nba_done: Boolean(dayRes.data?.nba_done),
      confidence_line: confidenceLine(twin),
      motivation: motivationPulse(twin, streak),
      future_self: futureSelf(twin, profile?.goal ?? null),
      streak: {
        days: streak,
        best,
        shields_available: Number(state?.shields_available ?? 2),
        at_risk: streak > 0 && !activeToday,
      },
      identity_statement: state?.identity_statement ?? null,
      habits,
      micro_wins: winsRes.data ?? [],
      today_inputs: {
        sleep_hours: days[0].sleep_hours,
        soreness: days[0].soreness,
        mood: days[0].mood,
        readiness: days[0].readiness_self,
        water_ml: days[0].water_ml,
      },
    };
  });

/** User correction of the data the twin used. Keeps the human in the loop. */
export const correctTodayData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      sleep_hours: z.number().min(0).max(20).nullable().optional(),
      soreness: z.number().int().min(1).max(5).nullable().optional(),
      mood: z.number().int().min(1).max(5).nullable().optional(),
      readiness: z.number().int().min(1).max(5).nullable().optional(),
      water_ml: z.number().int().min(0).max(10000).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("timezone").eq("id", userId).maybeSingle();
    const today = dateKeyOf(new Date(), profile?.timezone ?? null);
    const { error } = await supabase
      .from("daily_metrics")
      .upsert({ user_id: userId, log_date: today, ...data }, { onConflict: "user_id,log_date" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const completeNextBestAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ title: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("timezone").eq("id", userId).maybeSingle();
    const today = dateKeyOf(new Date(), profile?.timezone ?? null);
    await supabase.from("coach_days").update({ nba_done: true })
      .eq("user_id", userId).eq("log_date", today);
    await supabase.from("micro_wins").insert({
      user_id: userId, log_date: today, kind: "next_best_action",
      title: data.title, detail: "Next Best Action completed",
    });
    return { ok: true };
  });

export const saveHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1).max(120),
      cue: z.string().max(200).nullable(),
      routine: z.string().max(200).nullable(),
      reward: z.string().max(200).nullable(),
      identity_statement: z.string().max(200).nullable(),
      target_days_per_week: z.number().int().min(1).max(7),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = { ...data, user_id: userId };
    const { error } = data.id
      ? await supabase.from("habits").update(row).eq("id", data.id).eq("user_id", userId)
      : await supabase.from("habits").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await context.supabase.from("habits").delete().eq("id", data.id).eq("user_id", context.userId);
    return { ok: true };
  });

export const toggleHabitToday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ habit_id: z.string().uuid(), done: z.boolean(), name: z.string() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("timezone").eq("id", userId).maybeSingle();
    const today = dateKeyOf(new Date(), profile?.timezone ?? null);
    const { error } = await supabase.from("habit_logs").upsert(
      { user_id: userId, habit_id: data.habit_id, log_date: today, done: data.done },
      { onConflict: "habit_id,log_date" },
    );
    if (error) throw new Error(error.message);
    if (data.done) {
      await supabase.from("micro_wins").insert({
        user_id: userId, log_date: today, kind: "habit",
        title: data.name, detail: "Habit kept",
      });
    }
    return { ok: true };
  });

export const useStreakShield = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: state } = await supabase
      .from("coach_state").select("*").eq("user_id", userId).maybeSingle();
    const available = Number(state?.shields_available ?? 2);
    if (available <= 0) throw new Error("No streak shields left this month.");
    await supabase.from("coach_state").upsert(
      {
        user_id: userId,
        shields_available: available - 1,
        shields_used: Number(state?.shields_used ?? 0) + 1,
      },
      { onConflict: "user_id" },
    );
    return { shields_available: available - 1 };
  });

export const saveIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ identity_statement: z.string().max(200) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await context.supabase.from("coach_state").upsert(
      { user_id: context.userId, identity_statement: data.identity_statement },
      { onConflict: "user_id" },
    );
    return { ok: true };
  });

export const savePersonalizationModes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      exam_mode: z.boolean(),
      exam_until: z.string().nullable(),
      growth_mode: z.boolean(),
      injuries: z.array(z.string().max(80)).max(10),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({
        exam_mode: data.exam_mode,
        exam_until: data.exam_until,
        growth_mode: data.growth_mode,
        injuries: data.injuries,
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Optional AI narrative that explains the deterministic card in plain language. */
export const generateCoachBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ narrative: string }> => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("timezone, goal, age, sport").eq("id", userId).maybeSingle();
    const today = dateKeyOf(new Date(), profile?.timezone ?? null);
    const { data: day } = await supabase
      .from("coach_days").select("twin, recommendations")
      .eq("user_id", userId).eq("log_date", today).maybeSingle();
    if (!day) throw new Error("Open your coach card first so today's data exists.");

    const narrative = await callGateway({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You are a supportive daily coach inside a fitness and nutrition app. You are given a JSON card of ALREADY-COMPUTED recommendations. Write a short daily briefing (max 140 words, warm, plain English, second person, markdown, no headings). Rules: never invent numbers that are not in the JSON; never diagnose, prescribe, or name medicines; never guarantee weight, body or height outcomes; state uncertainty when confidence is low or medium; never shame, guilt-trip, or use urgency/manipulation; if a health block is active, tell them to speak to a qualified professional. End with the single Next Best Action.",
        },
        {
          role: "user",
          content: `Goal: ${profile?.goal ?? "unknown"}. Age: ${profile?.age ?? "unknown"}. Sport: ${profile?.sport ?? "none"}.\nCard JSON:\n${JSON.stringify({ twin: day.twin, plan: day.recommendations }).slice(0, 6000)}`,
        },
      ],
    });

    await supabase.from("coach_days").update({ narrative })
      .eq("user_id", userId).eq("log_date", today);
    return { narrative };
  });
