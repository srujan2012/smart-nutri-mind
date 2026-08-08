// Health-report extraction + validated safety evaluation.
// The AI ONLY transcribes values from the document. Every judgement about whether
// a value needs review comes from deterministic rules in health-rules.ts.
// No diagnosis, no prescription, no medicine changes — ever.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import {
  EXPECTED_BY_TYPE,
  RULES,
  evaluateLabValues,
  evaluateLifestyleRisk,
  highestLevel,
  type AlertLevel,
  type HealthFlag,
  type LabValue,
} from "@/lib/health-rules";

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
    const text = await res.text();
    if (res.status === 429) throw new Error("Rate limited. Please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits.");
    throw new Error(`AI error ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

/** Round-trip through JSON so Postgres jsonb columns accept the value. */
function jsonSafe(v: unknown): Json {
  return JSON.parse(JSON.stringify(v));
}

function extractJson(s: string): unknown {
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : s;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
  return JSON.parse(raw);
}

export interface ReportAnalysis {
  report_id: string;
  alert_level: AlertLevel;
  summary: string;
  values: LabValue[];
  missing_fields: string[];
  profile_mismatches: { field: string; report: string; profile: string; note: string }[];
  flags: HealthFlag[];
  blocks_plan: boolean;
  low_confidence: boolean;
}

/**
 * Analyse an already-uploaded report. The client passes the file as a base64 data URL
 * (the stored copy stays in the private bucket).
 */
export const analyzeHealthReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { reportId: string; fileData: string; mime: string; reportType: string }) => input,
  )
  .handler(async ({ data, context }): Promise<ReportAnalysis> => {
    const { supabase, userId } = context;

    const { data: report } = await supabase
      .from("health_reports")
      .select("*")
      .eq("id", data.reportId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!report) throw new Error("Report not found");

    const { data: consent } = await supabase
      .from("health_consents")
      .select("granted")
      .eq("user_id", userId)
      .eq("granted", true)
      .maybeSingle();
    if (!consent) throw new Error("Consent required before any health document is read.");

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    const analyteList = RULES.map((r) => `${r.key} (${r.label}, usual unit ${r.unit})`).join("; ");

    const system =
      "You are a careful medical DOCUMENT TRANSCRIBER, not a clinician. You transcribe printed values from a health report into JSON. " +
      "You must NEVER diagnose, name a disease, suggest medicines, dosage changes or treatment. " +
      "If a value is unreadable or absent, omit it rather than guessing. Return JSON only.";

    const prompt =
      `Transcribe this health report. Return JSON:\n` +
      `{"report_type_guess":string,"report_date":"YYYY-MM-DD"|null,"patient_name":string|null,"patient_age":number|null,"patient_sex":string|null,` +
      `"lab_name":string|null,"values":[{"key":string,"label":string,"value":number,"unit":string,"reference":string|null,"source_text":string}],` +
      `"unmapped_values":[{"label":string,"value":string,"unit":string|null}],"legibility":"good"|"partial"|"poor","notes":string}\n\n` +
      `Use these keys where the analyte matches: ${analyteList}. Anything else goes in unmapped_values. ` +
      `source_text must be the exact line you read the number from. Do not interpret, grade or comment on whether values are normal.`;

    const raw = await callGateway({
      model: "google/gemini-3-flash",
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            data.mime === "application/pdf"
              ? { type: "file", file: { filename: "report.pdf", file_data: data.fileData } }
              : { type: "image_url", image_url: { url: data.fileData } },
          ],
        },
      ],
    });

    const parsed = extractJson(raw) as unknown as {
      report_date?: string | null;
      patient_age?: number | null;
      patient_sex?: string | null;
      values?: LabValue[];
      unmapped_values?: unknown[];
      legibility?: string;
      notes?: string;
    };

    const values: LabValue[] = (parsed.values ?? [])
      .filter((v) => v && typeof v.value === "number")
      .map((v) => ({
        key: String(v.key ?? "").toLowerCase(),
        label: String(v.label ?? v.key ?? ""),
        value: Number(v.value),
        unit: v.unit ?? null,
        reference: v.reference ?? null,
        source_text: v.source_text ?? null,
      }));

    // ---- missing information
    const expected = EXPECTED_BY_TYPE[data.reportType] ?? EXPECTED_BY_TYPE.blood_panel;
    const present = new Set(values.map((v) => v.key));
    const missing_fields = expected
      .filter((k) => !present.has(k))
      .map((k) => RULES.find((r) => r.key === k)?.label ?? k);
    if (!parsed.report_date && !report.report_date) missing_fields.push("Report date");

    // ---- profile mismatches
    const profile_mismatches: ReportAnalysis["profile_mismatches"] = [];
    if (
      parsed.patient_age &&
      profile?.age &&
      Math.abs(Number(parsed.patient_age) - Number(profile.age)) > 2
    ) {
      profile_mismatches.push({
        field: "Age",
        report: String(parsed.patient_age),
        profile: String(profile.age),
        note: "The age on the report differs from your profile. Check you uploaded your own, current report.",
      });
    }
    if (
      parsed.patient_sex &&
      profile?.gender &&
      String(parsed.patient_sex).toLowerCase()[0] !== String(profile.gender).toLowerCase()[0]
    ) {
      profile_mismatches.push({
        field: "Sex",
        report: String(parsed.patient_sex),
        profile: String(profile.gender),
        note: "Reference ranges depend on sex. Confirm which is correct before relying on any interpretation.",
      });
    }
    const reportDate = parsed.report_date ?? report.report_date;
    if (reportDate) {
      const ageDays = (Date.now() - new Date(reportDate).getTime()) / 86400000;
      if (ageDays > 365) {
        profile_mismatches.push({
          field: "Report age",
          report: String(reportDate),
          profile: "today",
          note: "This report is over a year old, so values may no longer reflect your current health.",
        });
      }
    }

    // ---- validated rules (deterministic)
    const flags = evaluateLabValues(values);

    const low_confidence = parsed.legibility === "poor" || values.length === 0;
    const alert_level = highestLevel(flags);
    const blocks_plan = flags.some((f) => f.blocks_diet || f.blocks_training);

    const summary =
      values.length === 0
        ? "No numeric values could be read from this document. Extracted values can be incorrect — please re-upload a clearer scan or enter values manually."
        : `Transcribed ${values.length} value${values.length === 1 ? "" : "s"}. ${flags.length} sit outside general reference ranges. This is not a diagnosis and extracted values can be incorrect.`;

    await supabase
      .from("health_reports")
      .update({
        upload_status: "analyzed",
        report_date: reportDate ?? null,
        extracted: jsonSafe({
          values,
          unmapped: parsed.unmapped_values ?? [],
          legibility: parsed.legibility ?? "good",
          notes: parsed.notes ?? "",
        }),
        missing_fields: jsonSafe(missing_fields),
        profile_mismatches: jsonSafe(profile_mismatches),
        alert_level,
        summary,
        blocks_plan,
      })
      .eq("id", data.reportId)
      .eq("user_id", userId);

    await supabase
      .from("health_flags")
      .delete()
      .eq("report_id", data.reportId)
      .eq("user_id", userId);
    if (flags.length) {
      await supabase.from("health_flags").insert(
        flags.map((f) => ({
          user_id: userId,
          report_id: data.reportId,
          category: f.category,
          level: f.level,
          title: f.title,
          message: f.message,
          evidence: jsonSafe(f.evidence),
          blocks_diet: f.blocks_diet,
          blocks_training: f.blocks_training,
        })),
      );
    }

    // satisfy any pending program requirement
    await supabase
      .from("program_report_requirements")
      .update({ satisfied_by: data.reportId })
      .eq("user_id", userId)
      .is("satisfied_by", null);

    return {
      report_id: data.reportId,
      alert_level,
      summary,
      values,
      missing_fields,
      profile_mismatches,
      flags,
      blocks_plan,
      low_confidence,
    };
  });

export interface SafetyStatus {
  level: AlertLevel;
  blocks_diet: boolean;
  blocks_training: boolean;
  flags: (HealthFlag & { id?: string; source: "report" | "lifestyle" })[];
  pending_requirement: {
    program: string;
    region: string;
    due_date: string | null;
    days_left: number | null;
    daily_reminder: boolean;
  } | null;
}

/** Combined safety state used by the dashboard, planner and training pages. */
export const getSafetyStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SafetyStatus> => {
    const { supabase, userId } = context;

    const [
      { data: profile },
      { data: flagRows },
      { data: metrics },
      { data: workouts },
      { data: reqs },
    ] = await Promise.all([
      supabase.from("profiles").select("weight_kg").eq("id", userId).maybeSingle(),
      supabase.from("health_flags").select("*").eq("user_id", userId).eq("acknowledged", false),
      supabase
        .from("daily_metrics")
        .select("*")
        .eq("user_id", userId)
        .order("log_date", { ascending: false })
        .limit(14),
      supabase
        .from("workouts")
        .select("duration_min, scheduled_for, completed")
        .eq("user_id", userId)
        .eq("completed", true)
        .order("scheduled_for", { ascending: false })
        .limit(60),
      supabase
        .from("program_report_requirements")
        .select("*")
        .eq("user_id", userId)
        .is("satisfied_by", null),
    ]);

    const last7 = (metrics ?? []).slice(0, 7);
    const now = Date.now();
    const mins = (from: number, to: number) =>
      (workouts ?? [])
        .filter((w) => {
          const t = new Date(w.scheduled_for as string).getTime();
          return t <= now - from * 86400000 ? false : t > now - to * 86400000;
        })
        .reduce((a, w) => a + Number(w.duration_min ?? 0), 0);

    const lifestyle = evaluateLifestyleRisk({
      sleepHours7d: last7.map((m) => Number(m.sleep_hours ?? 0)),
      soreness7d: last7.map((m) => Number(m.soreness ?? 0)),
      waterMl: Number(last7[0]?.water_ml ?? 0),
      waterTargetMl: Math.round(Number(profile?.weight_kg ?? 70) * 35),
      loadThisWeek: mins(0, 7),
      loadLastWeek: mins(7, 14),
    });

    const reportFlags = (flagRows ?? []).map((f) => ({
      id: f.id as string,
      category: f.category as string,
      level: f.level as AlertLevel,
      title: f.title as string,
      message: f.message as string,
      blocks_diet: Boolean(f.blocks_diet),
      blocks_training: Boolean(f.blocks_training),
      evidence: (f.evidence ?? {}) as Record<string, string | number | boolean | null>,
      source: "report" as const,
    }));

    const all = [...reportFlags, ...lifestyle.map((f) => ({ ...f, source: "lifestyle" as const }))];

    const req = (reqs ?? [])[0] ?? null;
    let pending: SafetyStatus["pending_requirement"] = null;
    if (req) {
      const due = (req.due_date as string | null) ?? null;
      const days_left = due
        ? Math.ceil((new Date(due + "T00:00:00").getTime() - now) / 86400000)
        : null;
      pending = {
        program: req.program as string,
        region: req.region as string,
        due_date: due,
        days_left,
        daily_reminder: Boolean(req.daily_reminder),
      };
    }

    return {
      level: highestLevel(all),
      blocks_diet: all.some((f) => f.blocks_diet),
      blocks_training: all.some((f) => f.blocks_training),
      flags: all,
      pending_requirement: pending,
    };
  });

/**
 * Medication interaction checking requires an approved clinical data source
 * (e.g. a licensed drug-interaction database). None is connected, so the
 * feature reports itself unavailable rather than guessing.
 */
export const checkMedicationInteractions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    available: false as const,
    reason:
      "Medication interaction checking is unavailable. It stays switched off until a licensed clinical drug-interaction database is connected — we will not estimate interactions with a general-purpose model.",
  }));
