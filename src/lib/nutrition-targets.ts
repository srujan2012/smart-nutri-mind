// Nutrition targets: Mifflin-St Jeor + activity/goal multipliers.

export type Sex = "male" | "female" | "other";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "very" | "athlete";
export type Goal = "lose" | "maintain" | "gain" | "recomp";

export interface TargetsInput {
  age: number;
  sex: Sex;
  height_cm: number;
  weight_kg: number;
  activity: ActivityLevel;
  goal: Goal;
}

export interface Targets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  water_ml: number;
}

const activityFactor: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  athlete: 1.9,
};

const goalDelta: Record<Goal, number> = {
  lose: -500,
  maintain: 0,
  gain: 400,
  recomp: -150,
};

export function computeTargets(i: TargetsInput): Targets {
  const bmr =
    i.sex === "female"
      ? 10 * i.weight_kg + 6.25 * i.height_cm - 5 * i.age - 161
      : 10 * i.weight_kg + 6.25 * i.height_cm - 5 * i.age + 5;
  const tdee = bmr * activityFactor[i.activity];
  const calories = Math.round(tdee + goalDelta[i.goal]);

  const proteinFactor =
    i.activity === "athlete" || i.goal === "gain" || i.goal === "recomp" ? 1.9 : 1.6;
  const protein = Math.round(i.weight_kg * proteinFactor);
  const fat = Math.round((calories * 0.28) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
  const fiber = Math.max(25, Math.round((calories / 1000) * 14));
  const water_ml = Math.round(i.weight_kg * 35);

  return { calories, protein, carbs, fat, fiber, water_ml };
}

export function bmi(weight_kg: number, height_cm: number): number {
  const m = height_cm / 100;
  return +(weight_kg / (m * m)).toFixed(1);
}
