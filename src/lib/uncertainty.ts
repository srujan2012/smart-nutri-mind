// ============ Uncertainty Engine ============
// Honest ranges instead of false precision. Every AI-estimated quantity gets
// a band that widens when portions are vague, plus a plain-language reason.

export type UncertaintyBand = {
  low: number;
  high: number;
  /** 0 = database-computed, 1 = pure guess */
  uncertainty: number;
  reason: string;
};

export function bandFor(value: number, frac: number, matched: boolean): UncertaintyBand {
  const spread = Math.abs(value) * frac;
  const reason = matched
    ? frac <= 0.15
      ? "Portion stated — computed from the food database"
      : frac <= 0.25
        ? "Portion matched to a database serving"
        : "Portion approximated — moderate range"
    : "Not matched to the database — AI estimate, wide range";
  return {
    low: Math.max(0, value - spread),
    high: value + spread,
    uncertainty: frac,
    reason,
  };
}

export function overallConfidence(coverage: number, avgFrac: number): number {
  // 60% weight on database coverage, 40% on how tight the portion bands are.
  const portionScore = 1 - Math.min(1, avgFrac / 0.45);
  return Math.max(0.05, Math.min(0.99, coverage * 0.6 + portionScore * 0.4));
}

export function formatRange(low: number, high: number, unit: string): string {
  const r = (n: number) => (unit === "g" ? Math.round(n) : Math.round(n));
  return `${r(low)}–${r(high)}${unit === "kcal" ? " kcal" : unit}`;
}

export function confidenceLabel(c: number): { label: string; tone: "high" | "medium" | "low" } {
  if (c >= 0.75) return { label: "High confidence", tone: "high" };
  if (c >= 0.5) return { label: "Medium confidence", tone: "medium" };
  return { label: "Low confidence — verify portions", tone: "low" };
}
