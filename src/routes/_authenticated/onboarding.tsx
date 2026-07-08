import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computeTargets, bmi, type ActivityLevel, type Goal, type Sex } from "@/lib/nutrition-targets";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, Check, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

const DIETS = ["Vegetarian", "Vegan", "Eggetarian", "Non-Vegetarian", "Pescatarian", "Jain"];
const LIFESTYLES = [
  "Office Worker","School Student","College Student","Athlete","Runner","Cyclist",
  "Gym Beginner","Intermediate Gym","Advanced Gym","Bodybuilder","Homemaker",
  "Shift Worker","Senior Citizen","Cricketer","Football","Basketball","Swimmer",
];
const CONDITIONS = [
  "None","Diabetes","Prediabetes","Hypertension","High Cholesterol","Thyroid",
  "PCOS","Kidney Disease","Iron Deficiency","Vitamin D Deficiency","B12 Deficiency",
  "Lactose Intolerance","Gluten Intolerance","Food Allergy",
];
const ALLERGIES = [
  "Peanuts","Tree Nuts","Dairy","Eggs","Soy","Wheat/Gluten","Fish","Shellfish","Sesame","Mustard","Corn","Sulfites",
];
const GOALS: { value: Goal; label: string; desc: string }[] = [
  { value: "lose", label: "Lose fat", desc: "Sustained deficit" },
  { value: "maintain", label: "Maintain", desc: "Balanced fuel" },
  { value: "recomp", label: "Recomp", desc: "Build + lean" },
  { value: "gain", label: "Gain muscle", desc: "Surplus + protein" },
];
const ACTIVITIES: { value: ActivityLevel; label: string }[] = [
  { value: "sedentary", label: "Sedentary" },
  { value: "light", label: "Light" },
  { value: "moderate", label: "Moderate" },
  { value: "very", label: "Very active" },
  { value: "athlete", label: "Athlete" },
];

function Chip({
  active, children, onClick,
}: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm transition ${
        active
          ? "border-primary bg-primary/15 text-primary glow-neon"
          : "border-border bg-background/40 text-muted-foreground hover:border-primary/50 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [full_name, setFullName] = useState("");
  const [age, setAge] = useState(25);
  const [gender, setGender] = useState<Sex>("male");
  const [height_cm, setHeight] = useState(170);
  const [weight_kg, setWeight] = useState(70);
  const [country, setCountry] = useState("India");
  const [daily_budget, setBudget] = useState(300);
  const [food_preference, setDiet] = useState("Vegetarian");
  const [lifestyle, setLifestyle] = useState<string[]>([]);
  const [conditions, setConditions] = useState<string[]>(["None"]);
  const [medications, setMedications] = useState("");
  const [goal, setGoal] = useState<Goal>("maintain");
  const [activity, setActivity] = useState<ActivityLevel>("moderate");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) => {
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };

  const targets = computeTargets({
    age, sex: gender, height_cm, weight_kg, activity, goal,
  });

  const save = async () => {
    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("No user");
      const meds = medications
        .split(",").map((m) => m.trim()).filter(Boolean);
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name, age, gender,
          height_cm, weight_kg, country,
          daily_budget, food_preference,
          lifestyle, conditions,
          medications: meds,
          allergies,
          goal, activity_level: activity,
          calorie_target: targets.calories,
          protein_target: targets.protein,
          carbs_target: targets.carbs,
          fat_target: targets.fat,
          fiber_target: targets.fiber,
          onboarded: true,
        })
        .eq("id", user.user.id);
      if (error) throw error;
      toast.success("Profile complete!");
      router.navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    "Basics", "Body", "Lifestyle", "Diet & Health", "Goal", "Preview",
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex-1">
            <div
              className={`h-1 rounded-full transition ${
                i <= step ? "bg-primary glow-neon" : "bg-border"
              }`}
            />
            <div
              className={`mt-1 text-[10px] uppercase tracking-widest ${
                i === step ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {s}
            </div>
          </div>
        ))}
      </div>

      <div className="glass-strong rounded-3xl p-8">
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-bold">Let's meet you</h2>
            <p className="text-sm text-muted-foreground">The AI needs to know who it's coaching.</p>
            <input
              placeholder="Full name"
              value={full_name}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-2xl border border-border bg-input/40 px-4 py-3 text-sm focus:border-primary focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number" placeholder="Age" value={age}
                onChange={(e) => setAge(+e.target.value)}
                className="rounded-2xl border border-border bg-input/40 px-4 py-3 text-sm focus:border-primary focus:outline-none"
              />
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as Sex)}
                className="rounded-2xl border border-border bg-input/40 px-4 py-3 text-sm focus:border-primary focus:outline-none"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <input
              placeholder="Country / Region"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full rounded-2xl border border-border bg-input/40 px-4 py-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-bold">Your body</h2>
            <p className="text-sm text-muted-foreground">Used to calibrate calorie & macro targets.</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Height (cm)</span>
                <input
                  type="number" value={height_cm}
                  onChange={(e) => setHeight(+e.target.value)}
                  className="w-full rounded-2xl border border-border bg-input/40 px-4 py-3 text-sm focus:border-primary focus:outline-none"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Weight (kg)</span>
                <input
                  type="number" value={weight_kg}
                  onChange={(e) => setWeight(+e.target.value)}
                  className="w-full rounded-2xl border border-border bg-input/40 px-4 py-3 text-sm focus:border-primary focus:outline-none"
                />
              </label>
            </div>
            <div className="rounded-2xl bg-primary/10 p-4 text-sm">
              <div className="text-xs text-muted-foreground">BMI</div>
              <div className="font-display text-2xl text-primary">
                {bmi(weight_kg, height_cm)}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                Activity level
              </div>
              <div className="flex flex-wrap gap-2">
                {ACTIVITIES.map((a) => (
                  <Chip key={a.value} active={activity === a.value} onClick={() => setActivity(a.value)}>
                    {a.label}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-bold">Your lifestyle</h2>
            <p className="text-sm text-muted-foreground">Select any that apply.</p>
            <div className="flex flex-wrap gap-2">
              {LIFESTYLES.map((l) => (
                <Chip key={l} active={lifestyle.includes(l)} onClick={() => toggle(lifestyle, l, setLifestyle)}>
                  {l}
                </Chip>
              ))}
            </div>
            <label className="mt-4 block space-y-1">
              <span className="text-xs text-muted-foreground">Daily food budget (local currency)</span>
              <input
                type="number" value={daily_budget}
                onChange={(e) => setBudget(+e.target.value)}
                className="w-full rounded-2xl border border-border bg-input/40 px-4 py-3 text-sm focus:border-primary focus:outline-none"
              />
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-bold">Diet & health</h2>
            <div>
              <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Diet</div>
              <div className="flex flex-wrap gap-2">
                {DIETS.map((d) => (
                  <Chip key={d} active={food_preference === d} onClick={() => setDiet(d)}>{d}</Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Conditions</div>
              <div className="flex flex-wrap gap-2">
                {CONDITIONS.map((c) => (
                  <Chip key={c} active={conditions.includes(c)} onClick={() => toggle(conditions, c, setConditions)}>{c}</Chip>
                ))}
              </div>
            </div>
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Medications (comma-separated, optional)</span>
              <input
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
                placeholder="e.g. Metformin 500mg, Vitamin D"
                className="w-full rounded-2xl border border-border bg-input/40 px-4 py-3 text-sm focus:border-primary focus:outline-none"
              />
            </label>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-bold">Your goal</h2>
            <div className="grid grid-cols-2 gap-3">
              {GOALS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGoal(g.value)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    goal === g.value
                      ? "border-primary bg-primary/10 glow-neon"
                      : "border-border bg-background/40 hover:border-primary/50"
                  }`}
                >
                  <div className="font-display font-semibold">{g.label}</div>
                  <div className="text-xs text-muted-foreground">{g.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 text-xs text-primary">
              <Sparkles className="h-3 w-3" /> AI-calibrated targets
            </div>
            <h2 className="font-display text-2xl font-bold">Your daily blueprint</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                { l: "Calories", v: targets.calories, u: "kcal" },
                { l: "Protein", v: targets.protein, u: "g" },
                { l: "Carbs", v: targets.carbs, u: "g" },
                { l: "Fat", v: targets.fat, u: "g" },
                { l: "Fiber", v: targets.fiber, u: "g" },
              ].map((s) => (
                <div key={s.l} className="glass rounded-2xl p-4">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.l}</div>
                  <div className="font-display text-xl">{s.v}</div>
                  <div className="text-xs text-muted-foreground">{s.u}</div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl bg-accent/10 p-4 text-sm text-accent">
              Water target: ~{targets.water_ml} ml/day
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-2 rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground glow-neon"
            >
              Next <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground glow-neon disabled:opacity-60"
            >
              <Check className="h-4 w-4" /> {saving ? "Saving…" : "Activate AI"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
