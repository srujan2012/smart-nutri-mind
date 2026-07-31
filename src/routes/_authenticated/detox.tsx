import { createFileRoute } from "@tanstack/react-router";
import { Droplets, Moon, Salad, Wind, Activity, ShieldCheck, Info } from "lucide-react";

export const Route = createFileRoute("/_authenticated/detox")({
  head: () => ({
    meta: [
      { title: "Reset habits — NutriMind AI" },
      {
        name: "description",
        content:
          "Evidence-based reset habits: hydration, balanced plates, sleep, movement and cutting back ultra-processed food. No detox myths, no cleanses.",
      },
      { property: "og:title", content: "Reset habits — NutriMind AI" },
      { property: "og:description", content: "Evidence-based habits that support how your body already clears waste." },
    ],
  }),
  component: DetoxPage,
});

const HABITS = [
  {
    icon: Droplets,
    title: "Drink to a steady, pale-yellow urine colour",
    what: "Roughly 30–35 ml per kg of body weight per day, more on training days and in heat.",
    why: "Your kidneys filter waste continuously and need water to concentrate and excrete it. Adequate fluid supports normal kidney function — it does not 'flush toxins' beyond what your kidneys already do.",
  },
  {
    icon: Salad,
    title: "Build a balanced plate: half vegetables, a palm of protein, a fist of whole grains",
    what: "Aim for 25–35 g fibre a day and at least 4–5 different plant foods.",
    why: "Fibre feeds gut bacteria and moves bile acids and waste out through stool. Higher fibre intake is consistently linked with lower cardiovascular and colorectal disease risk.",
  },
  {
    icon: Wind,
    title: "Cut back on ultra-processed foods rather than 'cleansing' after them",
    what: "Swap one ultra-processed item a day for a whole-food version. No food is banned.",
    why: "Trials show that diets high in ultra-processed food increase spontaneous calorie intake. Reducing them lowers excess energy, sodium and added sugar — that is the actual mechanism, not toxin removal.",
  },
  {
    icon: Moon,
    title: "Protect 7–9 hours of sleep (8–10 if you're a teenager)",
    what: "Consistent sleep and wake times, dim light in the last hour, caffeine cut-off 8 hours before bed.",
    why: "Short sleep raises appetite signalling and impairs glucose handling and recovery. Sleep is also when the brain's glymphatic clearance is most active.",
  },
  {
    icon: Activity,
    title: "Move most days, including something that makes you breathe hard",
    what: "150+ minutes of moderate activity a week, plus 2 strength sessions.",
    why: "Activity improves insulin sensitivity, blood pressure and liver fat — the organs that actually do the detoxifying work better when you're active.",
  },
  {
    icon: ShieldCheck,
    title: "Limit alcohol and don't smoke",
    what: "The fewer drinks, the better; there is no amount proven to be beneficial.",
    why: "Alcohol is metabolised by the liver into acetaldehyde. Drinking less directly reduces the load on the one organ that does most of your detoxification.",
  },
];

function DetoxPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <div className="text-xs text-primary">Healthy habits</div>
        <h1 className="font-display text-2xl font-bold">Reset, the honest way</h1>
        <p className="text-sm text-muted-foreground">
          Six habits with real evidence behind them — no cleanses, no teas, no juice fasts.
        </p>
      </header>

      <div className="glass-strong rounded-3xl border border-warning/30 p-5">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="space-y-2 text-xs text-muted-foreground">
            <p className="text-sm font-semibold text-foreground">What "detox" does and doesn't mean here</p>
            <p>
              Your liver, kidneys, lungs, gut and skin already remove waste continuously. No food, drink, supplement or
              programme has been shown to remove toxins beyond that, and commercial detox products have repeatedly
              failed to demonstrate it. Anything promising otherwise is marketing.
            </p>
            <p>
              So this section does something different: it gives you the habits that help those organs work well. It is
              general wellbeing guidance, not medical advice, and it does not diagnose, treat or cure anything. If you
              are pregnant, managing a condition, or taking medication, check changes with your clinician first.
            </p>
          </div>
        </div>
      </div>

      <ul className="space-y-3">
        {HABITS.map((h) => (
          <li key={h.title} className="glass rounded-2xl p-5" tabIndex={0}>
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-primary/10 p-2 text-primary">
                <h.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 space-y-1.5">
                <h2 className="font-semibold leading-snug">{h.title}</h2>
                <p className="text-xs text-muted-foreground">{h.what}</p>
                <p className="rounded-xl bg-background/40 p-3 text-[11px] text-muted-foreground">
                  <span className="text-foreground">Why it works: </span>
                  {h.why}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="glass rounded-3xl p-5 text-xs text-muted-foreground">
        Track hydration and sleep on the Today tab — those two habits are already measured for you, so you can see the
        streak build instead of guessing.
      </div>
    </div>
  );
}
