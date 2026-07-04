import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Camera, Brain, Zap, ShieldCheck, Activity } from "lucide-react";
import heroOrb from "@/assets/hero-orb.jpg";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen overflow-hidden bg-grid">
      {/* Nav */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent glow-neon">
            <div className="absolute inset-1 rounded-md bg-background flex items-center justify-center">
              <span className="text-primary font-black text-xs">N</span>
            </div>
          </div>
          <span className="font-display font-bold text-lg">
            NutriMind<span className="text-primary">.</span>
          </span>
        </div>
        <Link
          to="/auth"
          className="rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/20"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-7xl gap-12 px-6 pt-8 pb-24 md:grid-cols-2 md:items-center md:pt-16">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3 w-3" />
            World's first AI Nutrition OS
          </div>
          <h1 className="mt-6 font-display text-5xl font-bold leading-[0.95] tracking-tight md:text-7xl">
            Your body,{" "}
            <span className="text-gradient">decoded</span>
            <br />
            meal by meal.
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            NutriMind AI thinks like a nutritionist, dietitian, and performance coach —
            combined. Snap a photo, get instant explainable analysis, and let the AI
            rebalance your day automatically.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/auth"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground glow-neon transition hover:scale-[1.02]"
            >
              Start free
              <Zap className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#features"
              className="rounded-full border border-border px-6 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              How it thinks
            </a>
          </div>
          <div className="mt-8 flex items-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Privacy-first
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent" />
              Real-time reasoning
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-8 rounded-full bg-primary/20 blur-3xl" />
          <img
            src={heroOrb}
            alt="NutriMind AI glowing nutrition orb"
            width={1280}
            height={1280}
            className="relative animate-float rounded-3xl border border-primary/20"
          />
          {/* Floating stat cards */}
          <div className="absolute -left-4 top-8 glass rounded-2xl px-4 py-3 text-xs shadow-glow-sm">
            <div className="text-muted-foreground">Meal score</div>
            <div className="font-display text-2xl text-primary">87</div>
          </div>
          <div className="absolute -right-2 bottom-12 glass rounded-2xl px-4 py-3 text-xs shadow-cyan">
            <div className="text-muted-foreground">Protein deficit</div>
            <div className="font-display text-lg text-accent">+18g needed</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Camera,
              title: "Snap. Reason. Learn.",
              body: "Point your camera at any meal. Gemini vision identifies foods, portions, cooking methods — in seconds.",
            },
            {
              icon: Brain,
              title: "Explainable AI",
              body: "Every recommendation shows current vs. recommended, why it matters, and the exact food to add.",
            },
            {
              icon: Activity,
              title: "Adaptive rebalance",
              body: "Missed protein at breakfast? Your lunch plan updates automatically to close the gap.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="glass rounded-3xl p-6 transition hover:border-primary/40"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/50 py-8 text-center text-xs text-muted-foreground">
        NutriMind AI · Not medical advice. Consult a professional for medical decisions.
      </footer>
    </div>
  );
}
