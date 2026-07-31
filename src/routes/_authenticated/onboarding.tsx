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

const FITNESS_LEVELS = ["Beginner", "Intermediate", "Advanced", "Elite"];
const EQUIPMENT = [
  "None / bodyweight","Dumbbells","Barbell + rack","Resistance bands","Kettlebells",
  "Pull-up bar","Full gym","Treadmill","Stationary bike","Yoga mat","Pool","Track",
];
const FOCUS_GOALS = [
  "Healthy weight management","Strength","Muscle development","Endurance",
  "General fitness","Mobility","Sports performance","Recovery","Healthy growth & development",
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

const SPORTS = [
  "None","Running","Cycling","Swimming","Football","Basketball","Cricket","Tennis",
  "Weightlifting","CrossFit","Boxing","MMA","Rowing","Yoga","Hiking","Triathlon","Volleyball","Badminton",
];
const COMP_LEVELS = ["Recreational","Amateur","Semi-Pro","Professional"];

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
  const [sport, setSport] = useState<string>("None");
  const [sport_position, setPosition] = useState<string>("");
  const [competition_level, setCompLevel] = useState<string>("Recreational");
  const [training_days_per_week, setTrainDays] = useState<number>(3);
  const [training_hours_per_day, setTrainHours] = useState<number>(1);
  const [wake_time, setWake] = useState<string>("07:00");
  const [sleep_time, setSleep] = useState<string>("23:00");
  const [fitness_level, setFitnessLevel] = useState("Beginner");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>(["General fitness"]);
  const [daily_schedule, setSchedule] = useState("");
  const [consent_ai, setConsentAi] = useState(true);
  const [consent_analytics, setConsentAnalytics] = useState(false);
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
      const timezone =
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : null;
      const isAthlete = sport && sport !== "None";
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
          fitness_level, equipment, goals, daily_schedule,
          consent_ai, consent_analytics,
          reminders_enabled: true,
          calorie_target: targets.calories,
          protein_target: targets.protein,
          carbs_target: targets.carbs,
          fat_target: targets.fat,
          fiber_target: targets.fiber,
          sport: isAthlete ? sport : null,
          sport_position: isAthlete ? sport_position || null : null,
          competition_level: isAthlete ? competition_level : null,
          training_days_per_week: isAthlete ? training_days_per_week : null,
          training_hours_per_day: isAthlete ? training_hours_per_day : null,
          wake_time,
          sleep_time,
          timezone,
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
    "Basics", "Body", "Lifestyle", "Diet & Health", "Goals", "Athlete", "Preview",
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
            <div>
              <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Fitness level</div>
              <div className="flex flex-wrap gap-2">
                {FITNESS_LEVELS.map((f) => (
                  <Chip key={f} active={fitness_level === f} onClick={() => setFitnessLevel(f)}>{f}</Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Available equipment</div>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT.map((e) => (
                  <Chip key={e} active={equipment.includes(e)} onClick={() => toggle(equipment, e, setEquipment)}>{e}</Chip>
                ))}
              </div>
            </div>
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Daily schedule (classes, work, training, meals)</span>
              <input
                value={daily_schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder="e.g. College 9–4, gym 6pm, dinner 8:30pm"
                className="w-full rounded-2xl border border-border bg-input/40 px-4 py-3 text-sm focus:border-primary focus:outline-none"
              />
            </label>
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
            <div>
              <div className="mb-2 text-xs uppercase tracking-widest text-warning">Food allergies — never suggested</div>
              <div className="flex flex-wrap gap-2">
                {ALLERGIES.map((a) => (
                  <Chip key={a} active={allergies.includes(a)} onClick={() => toggle(allergies, a, setAllergies)}>{a}</Chip>
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
            <h2 className="font-display text-2xl font-bold">Your goals</h2>
            <p className="text-sm text-muted-foreground">Primary nutrition goal drives your calorie target.</p>
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
            <div>
              <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                Focus areas (pick any)
              </div>
              <div className="flex flex-wrap gap-2">
                {FOCUS_GOALS.map((g) => (
                  <Chip key={g} active={goals.includes(g)} onClick={() => toggle(goals, g, setGoals)}>{g}</Chip>
                ))}
              </div>
            </div>
            <p className="rounded-2xl bg-warning/10 p-3 text-[11px] text-muted-foreground">
              We show estimated trend ranges, never exact dates or guaranteed body or height outcomes — individual
              results vary with genetics, sleep, stress and adherence.
            </p>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <h2 className="font-display text-2xl font-bold">Athlete mode</h2>
            <p className="text-sm text-muted-foreground">
              Optional. Pick your sport to unlock pre / during / post-training nutrition tuned to your session.
            </p>
            <div>
              <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Sport</div>
              <div className="flex flex-wrap gap-2">
                {SPORTS.map((s) => (
                  <Chip key={s} active={sport === s} onClick={() => setSport(s)}>{s}</Chip>
                ))}
              </div>
            </div>
            {sport !== "None" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">Position / discipline (optional)</span>
                    <input
                      value={sport_position}
                      onChange={(e) => setPosition(e.target.value)}
                      placeholder="e.g. Midfielder, Sprinter"
                      className="w-full rounded-2xl border border-border bg-input/40 px-4 py-3 text-sm focus:border-primary focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">Competition level</span>
                    <select
                      value={competition_level}
                      onChange={(e) => setCompLevel(e.target.value)}
                      className="w-full rounded-2xl border border-border bg-input/40 px-4 py-3 text-sm focus:border-primary focus:outline-none"
                    >
                      {COMP_LEVELS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">Training days / week</span>
                    <input
                      type="number" min={0} max={14}
                      value={training_days_per_week}
                      onChange={(e) => setTrainDays(+e.target.value)}
                      className="w-full rounded-2xl border border-border bg-input/40 px-4 py-3 text-sm focus:border-primary focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">Hours / session</span>
                    <input
                      type="number" min={0.25} max={8} step={0.25}
                      value={training_hours_per_day}
                      onChange={(e) => setTrainHours(+e.target.value)}
                      className="w-full rounded-2xl border border-border bg-input/40 px-4 py-3 text-sm focus:border-primary focus:outline-none"
                    />
                  </label>
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Wake time (for meal timing)</span>
                <input
                  type="time" value={wake_time}
                  onChange={(e) => setWake(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-input/40 px-4 py-3 text-sm focus:border-primary focus:outline-none"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Sleep time</span>
                <input
                  type="time" value={sleep_time}
                  onChange={(e) => setSleep(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-input/40 px-4 py-3 text-sm focus:border-primary focus:outline-none"
                />
              </label>
            </div>
            <div className="rounded-2xl bg-primary/5 p-3 text-[11px] text-muted-foreground">
              Timezone auto-detected — your daily log will roll over at your local midnight.
            </div>
          </div>
        )}

        {step === 6 && (
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
            <div className="space-y-2 rounded-2xl border border-border p-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Consent</div>
              <label className="flex items-start gap-2 text-xs">
                <input type="checkbox" checked={consent_ai} onChange={(e) => setConsentAi(e.target.checked)} className="mt-0.5" />
                Allow my photos and profile to be analysed by the AI coach (required for scanning).
              </label>
              <label className="flex items-start gap-2 text-xs">
                <input type="checkbox" checked={consent_analytics} onChange={(e) => setConsentAnalytics(e.target.checked)} className="mt-0.5" />
                Share anonymous usage analytics to improve the app (optional).
              </label>
              <div className="text-[11px] text-muted-foreground">You can change these any time in Settings.</div>
            </div>
            {sport !== "None" && (
              <div className="rounded-2xl bg-primary/10 p-4 text-sm">
                <div className="text-[10px] uppercase tracking-widest text-primary">Athlete mode</div>
                <div className="mt-1">
                  {sport}{sport_position ? ` · ${sport_position}` : ""} · {competition_level} · {training_days_per_week}×/wk, {training_hours_per_day}h
                </div>
              </div>
            )}
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
