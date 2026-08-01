// AI training-plan generation. Grounded in the verified exercise library:
// the model may only pick exercises that actually exist in the database.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ageBand, isYouth, planSignature, signatureDiff } from "@/lib/training-logic";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callGateway(body: unknown): Promise<string> {
  const k = process.env["LOVABLE_API_KEY"];
  if (!k) throw new Error("Missing LOVABLE_API_KEY");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": k },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("Rate limited. Please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits.");
    throw new Error(`AI error ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
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

export interface PlanBlock {
  exercise: string;
  sets: number;
  reps: string;
  rest_sec: number;
  why: string;
}

export interface PlanDay {
  day: string;
  title: string;
  focus: string;
  rest_day: boolean;
  duration_min: number;
  blocks: PlanBlock[];
  note: string;
}

export interface GeneratedPlan {
  id: string;
  name: string;
  week: PlanDay[];
  rationale: string;
  safety_notes: string[];
  adjustments: { at: string; changed: string[]; explanation: string }[];
  inputs_signature: string;
  days_per_week: number;
  session_minutes: number;
}

export const generateTrainingPlan = createServerFn({ method: "POST" })
  .inputValidator((d: { reason?: string } | undefined) => d ?? {})
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<GeneratedPlan> => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("Complete onboarding first so the plan can be built around you.");

    const age = Number(profile.age ?? 0);
    const youth = isYouth(age);
    const equipment = (profile.equipment ?? []) as string[];
    const hasGym = equipment.some((e) => /gym|barbell|machine|rack/i.test(e));

    // Only offer exercises the person can actually do.
    const { data: library } = await supabase
      .from("exercises")
      .select("name, category, muscle_groups, equipment, difficulty, setting, sports, default_sets, default_reps, duration_sec, rest_sec, min_age, contraindications")
      .limit(400);

    const usable = (library ?? []).filter((ex) => {
      if (ex.min_age && age && age < ex.min_age) return false;
      const eq = (ex.equipment ?? []) as string[];
      if (eq.length === 0 || eq.includes("none")) return true;
      if (hasGym) return true;
      return eq.some((e) => equipment.some((have) => have.toLowerCase().includes(e.toLowerCase())));
    });

    const catalogue = usable
      .map((e) => `${e.name} [${e.category}; ${(e.muscle_groups ?? []).join("/")}; equip: ${((e.equipment ?? []) as string[]).join("/") || "none"}; ${e.difficulty}]`)
      .join("\n");

    const days = Number(profile.training_days_per_week ?? 3) || 3;
    const minutes = Math.round((Number(profile.training_hours_per_day ?? 0.75) || 0.75) * 60);

    const recovery: string[] = [];
    const { data: metrics } = await supabase
      .from("daily_metrics")
      .select("log_date, sleep_hours, soreness, readiness")
      .order("log_date", { ascending: false })
      .limit(7);
    const sleeps = (metrics ?? []).map((m) => m.sleep_hours).filter((s): s is number => s != null);
    const sores = (metrics ?? []).map((m) => m.soreness).filter((s): s is number => s != null);
    if (sleeps.length) {
      const avg = sleeps.reduce((a, b) => a + Number(b), 0) / sleeps.length;
      recovery.push(`Average sleep last ${sleeps.length} days: ${avg.toFixed(1)}h${avg < 7 ? " (below 7h — keep intensity conservative)" : ""}`);
    }
    if (sores.length) {
      const avg = sores.reduce((a, b) => a + Number(b), 0) / sores.length;
      recovery.push(`Average soreness: ${avg.toFixed(1)}/10${avg >= 6 ? " (high — add an extra easy or rest day)" : ""}`);
    }

    const youthClause = youth
      ? ` YOUTH ATHLETE (age ${age}): prioritise technique, bodyweight and light-load work, full range of motion, and fun. Keep loads submaximal (never 1-3 rep maxes), cap plyometric volume, include at least 2 full rest days, and never frame training around body appearance or weight loss. Growth and development come from sleep, food and consistent age-appropriate activity — never claim training changes height.`
      : "";

    let sportClause = "";
    if (profile.sport) {
      const { data: sportRow } = await supabase
        .from("sports")
        .select("name, category, energy_aerobic, energy_glycolytic, energy_alactic, primary_qualities, contact_level, weight_sensitive")
        .eq("name", profile.sport)
        .maybeSingle();
      const energy = sportRow
        ? ` Energy systems: ${sportRow.energy_aerobic}% aerobic, ${sportRow.energy_glycolytic}% glycolytic, ${sportRow.energy_alactic}% alactic/power — mirror that ratio in the conditioning you prescribe. Key qualities: ${((sportRow.primary_qualities ?? []) as string[]).join(", ") || "general athleticism"}.`
        : "";
      const contact = sportRow?.contact_level === "collision"
        ? " Collision sport: include neck strength, landing and deceleration mechanics."
        : "";
      const weightNote = sportRow?.weight_sensitive
        ? " Weight-sensitive sport: never prescribe aggressive cuts or rapid weight-making strategies."
        : "";
      const season = profile.season_phase
        ? ` Season phase: ${profile.season_phase} — ${
            profile.season_phase === "In-season" ? "keep gym volume low and preserve freshness for competition"
            : profile.season_phase === "Pre-season" ? "build sport-specific conditioning and speed"
            : profile.season_phase === "Peaking" ? "taper volume, retain short high-quality intensity"
            : profile.season_phase === "Transition" ? "active rest, mobility and enjoyable low-intensity work only"
            : "highest volume of the year; build strength and correct asymmetries"
          }.`
        : "";
      sportClause = ` SPORT: ${profile.sport}${profile.sport_discipline ? ` — ${profile.sport_discipline}` : ""}${profile.sport_event ? ` (${profile.sport_event})` : ""}${profile.sport_position ? `, position ${profile.sport_position}` : ""}${profile.competition_level ? `, ${profile.competition_level} level` : ""}.${energy}${season}${contact}${weightNote} Include sport-specific conditioning and common injury-prevention work. Place hard/speed work on fresher days and keep it away from heavy lower-body lifting.`;
    }


    const focus = ((profile.goals ?? []) as string[]).join(", ");
    const prompt = `Build a 7-day training plan.

PERSON
- Age range: ${ageBand(age)}${age ? ` (age ${age})` : ""}
- Sex: ${profile.gender ?? "unspecified"}
- Primary goal: ${profile.goal ?? "general fitness"}
- Focus areas: ${focus || "general fitness"}
- Fitness level: ${profile.fitness_level ?? "beginner"}
- Activity level: ${profile.activity_level ?? "moderate"}
- Available equipment: ${equipment.join(", ") || "none (bodyweight only, at home)"}
- Available: ${days} training days/week, ~${minutes} min per session
- Daily schedule/lifestyle: ${profile.daily_schedule ?? "unspecified"}
- Recovery signals: ${recovery.join("; ") || "no recent recovery data"}
${sportClause}${youthClause}

EXERCISE LIBRARY (you MUST only use these exact names, spelled exactly as shown):
${catalogue}

RULES
- Exactly 7 day objects, Monday..Sunday. Mark non-training days rest_day: true with an empty blocks array and a short recovery suggestion in "note".
- Exactly ${days} training days. Each training day totals roughly ${minutes} minutes including warm-up.
- Every training day opens with "Dynamic warm-up".
- Cover the person's focus areas across the week: strength, endurance, mobility, flexibility, stability, balance, speed, power and recovery as relevant to their goals — do not make everything one modality.
- Rest between sets must suit the goal (strength 90-180s, endurance/circuit 30-60s, power 90-180s).
- "why" on each block explains in one plain sentence why that exercise is in this plan for this person.
- "rationale" (3-5 sentences) explains the overall structure: why this split, this volume, this intensity, given their goal, level, equipment, time and recovery.
- "safety_notes": 3-6 concrete cautions specific to this person and plan.
- Never promise a date, a body-shape outcome, guaranteed weight change, or increased height. Never comment on appearance.

Return ONLY JSON:
{"name":"...","week":[{"day":"Monday","title":"...","focus":"strength|endurance|mobility|...","rest_day":false,"duration_min":45,"blocks":[{"exercise":"exact library name","sets":3,"reps":"8-12","rest_sec":90,"why":"..."}],"note":"..."}],"rationale":"...","safety_notes":["..."]}`;

    const raw = await callGateway({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You are a certified strength & conditioning coach. You are evidence-based, conservative with load progression, and you never make body-composition or height promises. Output strict JSON only.",
        },
        { role: "user", content: prompt },
      ],
    });

    const parsed = extractJson(raw) as {
      name?: string; week?: PlanDay[]; rationale?: string; safety_notes?: string[];
    };

    const known = new Set(usable.map((e) => e.name.toLowerCase()));
    const week: PlanDay[] = (parsed.week ?? []).map((d) => ({
      day: String(d.day ?? ""),
      title: String(d.title ?? ""),
      focus: String(d.focus ?? ""),
      rest_day: Boolean(d.rest_day),
      duration_min: Number(d.duration_min ?? minutes),
      note: String(d.note ?? ""),
      blocks: (d.blocks ?? [])
        .filter((b) => known.has(String(b.exercise ?? "").toLowerCase()))
        .map((b) => ({
          exercise: String(b.exercise),
          sets: Number(b.sets ?? 3),
          reps: String(b.reps ?? "8-12"),
          rest_sec: Number(b.rest_sec ?? 60),
          why: String(b.why ?? ""),
        })),
    }));

    const signature = planSignature(profile);

    // Keep a written record of why the plan changed.
    const { data: prev } = await supabase
      .from("training_plans")
      .select("id, inputs_signature, adjustments")
      .eq("user_id", userId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const changed = signatureDiff(prev?.inputs_signature, signature);
    const history = Array.isArray(prev?.adjustments) ? (prev.adjustments as unknown[]) : [];
    const explanation = !prev
      ? "First plan built from your profile — goal, fitness level, age range, equipment, available time, sport and recent recovery data all fed into it."
      : changed.length > 0
        ? `Plan rebuilt because your inputs changed (${changed.join("; ")}). The structure below was re-derived from the new values — sessions, volume and exercise selection all follow from them.`
        : `Plan regenerated${data.reason ? ` (${data.reason})` : " on request"}. Your profile inputs are unchanged, so the differences you see are variation in exercise selection, not a change in direction.`;

    const adjustments = [
      ...history,
      { at: new Date().toISOString(), changed, explanation },
    ].slice(-20);

    await supabase.from("training_plans").update({ active: false }).eq("user_id", userId).eq("active", true);

    const { data: saved, error } = await supabase
      .from("training_plans")
      .insert({
        user_id: userId,
        name: parsed.name ?? "Training plan",
        goal: profile.goal,
        focus: (profile.goals ?? []) as string[],
        fitness_level: profile.fitness_level,
        age_range: ageBand(age),
        equipment,
        sport: profile.sport,
        days_per_week: days,
        session_minutes: minutes,
        week: week as unknown as never,
        rationale: parsed.rationale ?? "",
        safety_notes: parsed.safety_notes ?? [],
        adjustments: adjustments as unknown as never,
        inputs_signature: signature,
        active: true,
      })
      .select("id")
      .single();
    if (error) throw error;

    return {
      id: saved.id,
      name: parsed.name ?? "Training plan",
      week,
      rationale: parsed.rationale ?? "",
      safety_notes: parsed.safety_notes ?? [],
      adjustments: adjustments as GeneratedPlan["adjustments"],
      inputs_signature: signature,
      days_per_week: days,
      session_minutes: minutes,
    };
  });
