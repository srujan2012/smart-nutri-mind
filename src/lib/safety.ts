// ============ Privacy & Safety Layer ============
// One guard rail every AI output passes through: allergen filtering for food
// suggestions and medical-claim scrubbing for free text. No other module may
// bypass these — suggestions shown to users must come through here.

import { conflictsWithAllergens } from "@/lib/food-graph";

export const SAFETY_DISCLAIMER =
  "NutriMind offers general nutrition guidance only — it never diagnoses, treats, or prescribes. For medical questions, consult a qualified doctor or registered dietitian.";

const CLAIM_PATTERNS: { re: RegExp; replacement: string }[] = [
  { re: /\byou (?:have|are suffering from|suffer from) (?:a |an |the )?(diabetes|hypertension|thyroid|anemia|anaemia|disease|deficiency|condition)/gi, replacement: "some patterns in your data can be worth discussing with a doctor" },
  { re: /\b(?:this|it) (?:will |can |may )?(?:cure|treat|heal|reverse)\b/gi, replacement: "this supports general wellness — it is not a cure" },
  { re: /\bdiagnos\w*/gi, replacement: "identify patterns" },
  { re: /\bprescrib\w*/gi, replacement: "recommend (non-medical)" },
  { re: /\bguarantees? (?:weight loss|results|recovery|gains)\b/gi, replacement: "supports your goal — individual results vary" },
  { re: /\bstops? (?:your )?medication\b/gi, replacement: "any medication change must go through your doctor" },
  { re: /\bboosts? (?:your )?immunity \d*%/gi, replacement: "supports immune function through balanced nutrition" },
];

export type GuardedText = { text: string; flagged: boolean };

export function guardMedicalClaims(text: string): GuardedText {
  let flagged = false;
  let out = text;
  for (const { re, replacement } of CLAIM_PATTERNS) {
    if (re.test(out)) {
      out = out.replace(re, replacement);
      flagged = true;
    }
  }
  if (flagged) out += `\n\n_${SAFETY_DISCLAIMER}_`;
  return { text: out, flagged };
}

export function filterSuggestions<T extends { name?: string }>(items: T[], allergies: string[]) {
  const safe: T[] = [];
  const blocked: string[] = [];
  for (const item of items) {
    const hay = [
      item.name ?? "",
      ...Object.values(item).filter((v) => typeof v === "string" && v.length < 200),
    ].join(" ");
    if (allergies.length && conflictsWithAllergens(hay, allergies)) blocked.push(item.name ?? "item");
    else safe.push(item);
  }
  return { safe, blocked };
}
