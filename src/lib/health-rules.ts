// Deterministic, validated safety rules for lab values.
// These rules NEVER diagnose. They only decide whether a value sits outside a
// widely published reference range and therefore deserves professional review.
// Reference ranges are general adult ranges and vary by lab, assay, age, sex,
// pregnancy and altitude — that uncertainty is surfaced in the UI.

export type AlertLevel = "information" | "caution" | "urgent";

export const ALERT_ORDER: Record<AlertLevel, number> = {
  information: 0,
  caution: 1,
  urgent: 2,
};

export interface LabValue {
  key: string;
  label: string;
  value: number | null;
  unit: string | null;
  reference?: string | null;
  /** Verbatim text the AI read this from, for traceability. */
  source_text?: string | null;
}

export interface HealthFlag {
  category: string;
  level: AlertLevel;
  title: string;
  message: string;
  blocks_diet: boolean;
  blocks_training: boolean;
  evidence: Record<string, string | number | boolean | null>;
}

export const REVIEW_LINE =
  "There may be a deviation or value requiring review. Please consult a qualified doctor before changing your diet or exercise plan.";

interface Rule {
  key: string;
  label: string;
  unit: string;
  category: string;
  /** [low, high] normal band. */
  normal: [number, number];
  /** Outside this band → Urgent Review. */
  urgent?: [number, number];
  lowTitle: string;
  lowMessage: string;
  highTitle: string;
  highMessage: string;
  blocks_diet?: boolean;
  blocks_training?: boolean;
}

/** Analyte keys the extractor should look for, with general adult reference bands. */
export const RULES: Rule[] = [
  {
    key: "hemoglobin",
    label: "Haemoglobin",
    unit: "g/dL",
    category: "anemia",
    normal: [12, 17.5],
    urgent: [8, 20],
    lowTitle: "Low haemoglobin (anaemia-related concern)",
    lowMessage:
      "Your haemoglobin reads below the common adult reference range. Low haemoglobin can cause fatigue and breathlessness and can make hard training unsafe.",
    highTitle: "High haemoglobin",
    highMessage:
      "Your haemoglobin reads above the common adult reference range. This can relate to dehydration, altitude or other causes.",
    blocks_training: true,
  },
  {
    key: "ferritin",
    label: "Ferritin",
    unit: "ng/mL",
    category: "anemia",
    normal: [30, 300],
    urgent: [10, 1000],
    lowTitle: "Low ferritin (iron stores)",
    lowMessage:
      "Ferritin reads low, which often reflects depleted iron stores. Endurance load and recovery are commonly affected.",
    highTitle: "High ferritin",
    highMessage: "Ferritin reads above the usual range; this has several possible causes.",
    blocks_training: true,
  },
  {
    key: "tsh",
    label: "TSH",
    unit: "mIU/L",
    category: "thyroid",
    normal: [0.4, 4.5],
    urgent: [0.1, 10],
    lowTitle: "Low TSH (thyroid-related concern)",
    lowMessage: "TSH reads below the usual range. Thyroid values influence metabolism, heart rate and heat tolerance.",
    highTitle: "High TSH (thyroid-related concern)",
    highMessage: "TSH reads above the usual range. Thyroid values influence metabolism, energy and weight change.",
    blocks_diet: true,
  },
  {
    key: "alt",
    label: "ALT (SGPT)",
    unit: "U/L",
    category: "liver",
    normal: [7, 55],
    urgent: [0, 165],
    lowTitle: "Low ALT",
    lowMessage: "ALT reads below the usual range.",
    highTitle: "Raised ALT (liver-related concern)",
    highMessage:
      "ALT reads above the usual range. Liver enzymes can rise from many causes including recent intense exercise, medication and illness.",
    blocks_diet: true,
    blocks_training: true,
  },
  {
    key: "ast",
    label: "AST (SGOT)",
    unit: "U/L",
    category: "liver",
    normal: [8, 48],
    urgent: [0, 145],
    lowTitle: "Low AST",
    lowMessage: "AST reads below the usual range.",
    highTitle: "Raised AST (liver-related concern)",
    highMessage:
      "AST reads above the usual range. This can follow heavy training as well as liver-related causes.",
    blocks_training: true,
  },
  {
    key: "creatinine",
    label: "Creatinine",
    unit: "mg/dL",
    category: "kidney",
    normal: [0.6, 1.3],
    urgent: [0.3, 2],
    lowTitle: "Low creatinine",
    lowMessage: "Creatinine reads below the usual range; low muscle mass and pregnancy are common contributors.",
    highTitle: "Raised creatinine (kidney-related concern)",
    highMessage:
      "Creatinine reads above the usual range. Hydration status, high protein intake and muscle mass also affect this value.",
    blocks_diet: true,
    blocks_training: true,
  },
  {
    key: "egfr",
    label: "eGFR",
    unit: "mL/min/1.73m²",
    category: "kidney",
    normal: [60, 200],
    urgent: [30, 300],
    lowTitle: "Reduced eGFR (kidney-related concern)",
    lowMessage: "eGFR reads below the usual range, which relates to kidney filtration.",
    highTitle: "High eGFR",
    highMessage: "eGFR reads above the usual reported range.",
    blocks_diet: true,
  },
  {
    key: "sodium",
    label: "Sodium",
    unit: "mmol/L",
    category: "hydration",
    normal: [135, 145],
    urgent: [130, 150],
    lowTitle: "Low sodium (hydration risk)",
    lowMessage:
      "Sodium reads low. Low sodium with heavy sweating or high plain-water intake can be dangerous during long sessions.",
    highTitle: "High sodium (hydration risk)",
    highMessage: "Sodium reads high, which commonly accompanies dehydration.",
    blocks_diet: true,
    blocks_training: true,
  },
  {
    key: "potassium",
    label: "Potassium",
    unit: "mmol/L",
    category: "hydration",
    normal: [3.5, 5.1],
    urgent: [3, 5.5],
    lowTitle: "Low potassium",
    lowMessage: "Potassium reads low. Potassium affects muscle and heart function.",
    highTitle: "High potassium",
    highMessage: "Potassium reads high. Potassium affects muscle and heart function.",
    blocks_diet: true,
    blocks_training: true,
  },
  {
    key: "fasting_glucose",
    label: "Fasting glucose",
    unit: "mg/dL",
    category: "metabolic",
    normal: [70, 99],
    urgent: [54, 180],
    lowTitle: "Low fasting glucose",
    lowMessage: "Fasting glucose reads below the usual range.",
    highTitle: "Raised fasting glucose",
    highMessage: "Fasting glucose reads above the usual range.",
    blocks_diet: true,
  },
  {
    key: "hba1c",
    label: "HbA1c",
    unit: "%",
    category: "metabolic",
    normal: [4, 5.6],
    urgent: [3.5, 8],
    lowTitle: "Low HbA1c",
    lowMessage: "HbA1c reads below the usual range.",
    highTitle: "Raised HbA1c",
    highMessage: "HbA1c reads above the usual range.",
    blocks_diet: true,
  },
  {
    key: "vitamin_d",
    label: "Vitamin D (25-OH)",
    unit: "ng/mL",
    category: "micronutrient",
    normal: [30, 100],
    urgent: [10, 150],
    lowTitle: "Low vitamin D",
    lowMessage: "Vitamin D reads low, which is common and relates to bone health and recovery.",
    highTitle: "High vitamin D",
    highMessage: "Vitamin D reads high, which can occur with high-dose supplementation.",
  },
  {
    key: "vitamin_b12",
    label: "Vitamin B12",
    unit: "pg/mL",
    category: "micronutrient",
    normal: [200, 900],
    urgent: [120, 2000],
    lowTitle: "Low vitamin B12",
    lowMessage: "B12 reads low. B12 relates to energy, nerve function and red blood cell formation.",
    highTitle: "High vitamin B12",
    highMessage: "B12 reads high, often from supplementation.",
  },
  {
    key: "creatine_kinase",
    label: "Creatine kinase (CK)",
    unit: "U/L",
    category: "overtraining",
    normal: [30, 400],
    urgent: [0, 1000],
    lowTitle: "Low CK",
    lowMessage: "CK reads below the usual range.",
    highTitle: "Raised CK (muscle load / overtraining concern)",
    highMessage:
      "CK reads high. Very high CK after heavy training, heat or dehydration can indicate significant muscle breakdown.",
    blocks_training: true,
  },
  {
    key: "ldl",
    label: "LDL cholesterol",
    unit: "mg/dL",
    category: "cardio",
    normal: [0, 129],
    urgent: [0, 190],
    lowTitle: "Low LDL",
    lowMessage: "LDL reads low.",
    highTitle: "Raised LDL cholesterol",
    highMessage: "LDL reads above the commonly used desirable range.",
    blocks_diet: true,
  },
];

export const RULE_KEYS = RULES.map((r) => r.key);

/** Analytes we expect on a routine blood panel; anything absent is reported as missing. */
export const EXPECTED_BY_TYPE: Record<string, string[]> = {
  blood_panel: ["hemoglobin", "ferritin", "tsh", "alt", "creatinine", "fasting_glucose", "vitamin_d"],
  metabolic_panel: ["fasting_glucose", "hba1c", "creatinine", "sodium", "potassium"],
  thyroid_panel: ["tsh"],
  lipid_profile: ["ldl"],
  vitamin_panel: ["vitamin_d", "vitamin_b12"],
  liver_panel: ["alt", "ast"],
  kidney_panel: ["creatinine", "egfr"],
  other: [],
};

function outside(v: number, band: [number, number]) {
  return v < band[0] || v > band[1];
}

/** Run validated rules over extracted values. Deterministic — no AI involved. */
export function evaluateLabValues(values: LabValue[]): HealthFlag[] {
  const flags: HealthFlag[] = [];
  for (const rule of RULES) {
    const found = values.find((v) => v.key === rule.key && typeof v.value === "number" && !Number.isNaN(v.value));
    if (!found || found.value === null) continue;
    const v = found.value;
    if (!outside(v, rule.normal)) continue;
    const low = v < rule.normal[0];
    const urgent = rule.urgent ? outside(v, rule.urgent) : false;
    flags.push({
      category: rule.category,
      level: urgent ? "urgent" : "caution",
      title: low ? rule.lowTitle : rule.highTitle,
      message: `${low ? rule.lowMessage : rule.highMessage} ${REVIEW_LINE}`,
      blocks_diet: Boolean(rule.blocks_diet),
      blocks_training: Boolean(rule.blocks_training),
      evidence: {
        value: v,
        unit: found.unit ?? rule.unit,
        reference_used: `${rule.normal[0]}–${rule.normal[1]} ${rule.unit}`,
        reported_reference: found.reference ?? null,
        source_text: found.source_text ?? null,
        rule: rule.key,
      },
    });
  }
  return flags;
}

/** Lifestyle signals from the daily log — hydration, fatigue and training-load risk. */
export function evaluateLifestyleRisk(input: {
  sleepHours7d: number[];
  soreness7d: number[];
  waterMl: number;
  waterTargetMl: number;
  loadThisWeek: number;
  loadLastWeek: number;
}): HealthFlag[] {
  const flags: HealthFlag[] = [];
  const sleeps = input.sleepHours7d.filter((n) => n > 0);
  const avgSleep = sleeps.length ? sleeps.reduce((a, b) => a + b, 0) / sleeps.length : 0;
  if (sleeps.length >= 3 && avgSleep < 6) {
    flags.push({
      category: "fatigue",
      level: avgSleep < 5 ? "urgent" : "caution",
      title: "Severe fatigue risk — very low sleep",
      message: `Your average sleep is ${avgSleep.toFixed(1)}h across the last ${sleeps.length} logged nights. Sustained short sleep raises injury and illness risk. ${REVIEW_LINE}`,
      blocks_diet: false,
      blocks_training: avgSleep < 5,
      evidence: { avg_sleep_hours: Number(avgSleep.toFixed(1)), nights: sleeps.length },
    });
  }

  const sore = input.soreness7d.filter((n) => n > 0);
  const avgSore = sore.length ? sore.reduce((a, b) => a + b, 0) / sore.length : 0;
  if (sore.length >= 3 && avgSore >= 7) {
    flags.push({
      category: "overtraining",
      level: avgSore >= 8.5 ? "urgent" : "caution",
      title: "Overtraining risk — persistently high soreness",
      message: `Soreness has averaged ${avgSore.toFixed(1)}/10. Persistent high soreness with training is a common overreaching signal. ${REVIEW_LINE}`,
      blocks_diet: false,
      blocks_training: avgSore >= 8.5,
      evidence: { avg_soreness: Number(avgSore.toFixed(1)), days: sore.length },
    });
  }

  if (input.waterTargetMl > 0 && input.waterMl > 0 && input.waterMl < input.waterTargetMl * 0.5) {
    flags.push({
      category: "hydration",
      level: "caution",
      title: "Hydration risk",
      message: `You have logged ${input.waterMl} ml against a ${input.waterTargetMl} ml guide. Training while under-hydrated increases heat and cramp risk.`,
      blocks_diet: false,
      blocks_training: false,
      evidence: { water_ml: input.waterMl, target_ml: input.waterTargetMl },
    });
  }

  if (input.loadLastWeek > 0) {
    const ratio = input.loadThisWeek / input.loadLastWeek;
    if (ratio > 1.5) {
      flags.push({
        category: "overtraining",
        level: ratio > 1.8 ? "urgent" : "caution",
        title: "Training-load spike",
        message: `Your training minutes jumped ${Math.round((ratio - 1) * 100)}% versus last week. Large week-to-week jumps are associated with higher injury risk. ${REVIEW_LINE}`,
        blocks_diet: false,
        blocks_training: ratio > 1.8,
        evidence: { this_week_min: input.loadThisWeek, last_week_min: input.loadLastWeek, ratio: Number(ratio.toFixed(2)) },
      });
    }
  }

  return flags;
}

export function highestLevel(flags: { level: AlertLevel }[]): AlertLevel {
  return flags.reduce<AlertLevel>(
    (max, f) => (ALERT_ORDER[f.level] > ALERT_ORDER[max] ? f.level : max),
    "information",
  );
}

export const LEVEL_LABEL: Record<AlertLevel, string> = {
  information: "Information",
  caution: "Caution",
  urgent: "Urgent Review",
};

/** Safer general plan shown while a recommendation is paused. */
export const SAFE_FALLBACK_PLAN = {
  diet: [
    "Balanced plates: half vegetables/fruit, a quarter protein, a quarter whole-grain carbs.",
    "Normal hydration spread across the day — no aggressive water loading or restriction.",
    "No calorie deficit, no fasting protocol and no new supplements until reviewed.",
    "Keep the diet you were already cleared for; change nothing based on this app alone.",
  ],
  training: [
    "Easy aerobic movement only — walking or light cycling you can hold a conversation through.",
    "Mobility and light technique work; skip heavy loads, sprints and max efforts.",
    "Stop immediately for chest pain, dizziness, unusual breathlessness, dark urine or new pain.",
    "Resume structured training after a qualified professional reviews your report.",
  ],
};
