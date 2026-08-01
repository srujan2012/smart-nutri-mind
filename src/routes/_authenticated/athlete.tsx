import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { dateKeyOf } from "@/lib/dates";
import {
  Search, Trophy, ShieldAlert, Activity, Gauge, HeartPulse, CalendarRange, Zap,
  Droplets, Plane, Bed, Swords, Dumbbell, Info, Plus, Check, X,
} from "lucide-react";
import {
  DAY_TYPES, SEASON_PHASES, PERIODIZATION, SAFETY_DISCLAIMER,
  buildFuelPlan, loadState, performanceProfile, positionGuidance, readiness, trainingEmphasis,
  type DayType, type SeasonPhase, type SportRow,
} from "@/lib/sports-logic";

export const Route = createFileRoute("/_authenticated/athlete")({
  component: AthleteMode,
  head: () => ({
    meta: [
      { title: "Athlete Mode — Sport-Specific Fuelling & Training | NutriMind" },
      { name: "description", content: "Search a global sports catalog, pick your discipline and position, and get explainable practice, match, competition, travel and recovery plans with load and readiness intelligence." },
      { property: "og:title", content: "Athlete Mode — Sport-Specific Fuelling & Training" },
      { property: "og:description", content: "Sport, position and season-aware nutrition, hydration, training and recovery intelligence — every recommendation explained." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const DAY_ICON: Record<DayType, typeof Swords> = {
  practice: Dumbbell, match: Swords, competition: Trophy, travel: Plane, recovery: Bed,
};

function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-xs transition ${
        active ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Bar({ pct, tone = "primary" }: { pct: number; tone?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full bg-${tone}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

function AthleteMode() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const [dayType, setDayType] = useState<DayType>("practice");
  const [showCatalog, setShowCatalog] = useState(false);
  const [editSchedule, setEditSchedule] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return data;
    },
  });

  const { data: sports } = useQuery({
    queryKey: ["sports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sports").select("*").order("popularity", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SportRow[];
    },
  });

  const tz = profile?.timezone ?? undefined;
  const today = dateKeyOf(new Date(), tz);

  const { data: workouts } = useQuery({
    queryKey: ["athlete-workouts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("workouts")
        .select("scheduled_for, duration_min, perceived_effort, rest_day, name")
        .order("scheduled_for", { ascending: false })
        .limit(120);
      return data ?? [];
    },
  });

  const { data: metrics } = useQuery({
    queryKey: ["daily-metrics"],
    queryFn: async () => {
      const { data } = await supabase.from("daily_metrics").select("*").order("log_date", { ascending: false }).limit(30);
      return data ?? [];
    },
  });

  const selected = useMemo(
    () => (sports ?? []).find((s) => s.name === profile?.sport) ?? null,
    [sports, profile?.sport],
  );

  const categories = useMemo(
    () => ["All", ...Array.from(new Set((sports ?? []).map((s) => s.category))).sort()],
    [sports],
  );

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (sports ?? []).filter((s) => {
      if (category !== "All" && s.category !== category) return false;
      if (!term) return true;
      return (
        s.name.toLowerCase().includes(term) ||
        s.category.toLowerCase().includes(term) ||
        s.aliases.some((a) => a.toLowerCase().includes(term)) ||
        s.disciplines.some((d) => d.toLowerCase().includes(term)) ||
        s.events.some((e) => e.toLowerCase().includes(term)) ||
        s.positions.some((p) => p.toLowerCase().includes(term))
      );
    });
  }, [sports, q, category]);

  const saveProfile = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").update(patch).eq("id", u.user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Athlete profile updated — recommendations recalculated.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const seasonPhase = (profile?.season_phase ?? "In-season") as SeasonPhase;
  const inputs = {
    weight_kg: Number(profile?.weight_kg ?? 70),
    age: profile?.age ?? null,
    sport: selected,
    position: profile?.sport_position ?? null,
    competition_level: profile?.competition_level ?? null,
    training_days_per_week: Number(profile?.training_days_per_week ?? 3),
    training_hours_per_day: Number(profile?.training_hours_per_day ?? 1),
    season_phase: seasonPhase,
  };

  const fuel = useMemo(() => buildFuelPlan(inputs, dayType), [profile, selected, dayType]);
  const emphasis = useMemo(() => trainingEmphasis(inputs), [profile, selected]);
  const profileBars = performanceProfile(selected);

  const load = useMemo(() => {
    const sessions = (workouts ?? [])
      .filter((w) => !w.rest_day)
      .map((w) => ({
        date: String(w.scheduled_for).slice(0, 10),
        load: Number(w.duration_min ?? 0) * Number(w.perceived_effort ?? 5),
      }));
    return loadState(sessions, today);
  }, [workouts, today]);

  const todayMetric = (metrics ?? []).find((m) => m.log_date === today);
  const waterTarget = Math.max(1, fuel.fluid_ml);
  const ready = readiness({
    sleep_hours: todayMetric?.sleep_hours != null ? Number(todayMetric.sleep_hours) : null,
    soreness: todayMetric?.soreness ?? null,
    mood: todayMetric?.mood ?? null,
    hydrationPct: ((todayMetric?.water_ml ?? 0) / waterTarget) * 100,
    load,
  });

  // Fatigue trend: 7-day rolling soreness & sleep vs the prior 7 days.
  const fatigue = useMemo(() => {
    const rows = metrics ?? [];
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
    const s1 = avg(rows.slice(0, 7).map((r) => r.soreness).filter((v): v is number => v != null));
    const s2 = avg(rows.slice(7, 14).map((r) => r.soreness).filter((v): v is number => v != null));
    const sl1 = avg(rows.slice(0, 7).map((r) => Number(r.sleep_hours)).filter((v) => !Number.isNaN(v) && v > 0));
    return { soreness: s1, sorenessPrev: s2, sleep: sl1 };
  }, [metrics]);

  const schedule = (profile?.training_schedule ?? {}) as Record<string, string>;
  const [draftSchedule, setDraftSchedule] = useState<Record<string, string>>({});
  const activeSchedule = editSchedule ? draftSchedule : schedule;

  const pick = (patch: Record<string, unknown>) => saveProfile.mutate(patch);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-primary">
            <Trophy className="h-3.5 w-3.5" /> Athlete Mode
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold">Performance intelligence</h1>
          <p className="text-sm text-muted-foreground">
            {selected
              ? `${selected.name}${profile?.sport_discipline ? ` · ${profile.sport_discipline}` : ""}${profile?.sport_position ? ` · ${profile.sport_position}` : ""} · ${seasonPhase}`
              : "Search the sports catalog to unlock sport-specific plans."}
          </p>
        </div>
        <button
          onClick={() => setShowCatalog((v) => !v)}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          {selected ? "Change sport" : "Choose your sport"}
        </button>
      </header>

      {/* Safety */}
      <div className="glass flex items-start gap-3 rounded-2xl border-warning/40 p-4">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
        <p className="text-xs text-muted-foreground">{SAFETY_DISCLAIMER}</p>
      </div>

      {/* Catalog search */}
      {(showCatalog || !selected) && (
        <section className="glass-strong space-y-4 rounded-3xl p-6" aria-label="Sports catalog">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search sport, discipline, event or position (e.g. sprint, libero, 1500m)"
              aria-label="Search sports"
              className="w-full rounded-2xl border border-border/60 bg-background/50 py-3 pl-11 pr-4 text-sm outline-none focus:border-primary/50"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Chip>
            ))}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {results.length} of {sports?.length ?? 0} sports. The catalog is expandable — anything missing can be added and will feed the same engine.
          </div>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {results.slice(0, 60).map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  pick({ sport: s.name, sport_discipline: null, sport_event: null, sport_position: null });
                  setShowCatalog(false);
                }}
                className={`rounded-2xl border p-3 text-left transition hover:border-primary/40 ${
                  selected?.id === s.id ? "border-primary/50 bg-primary/10" : "border-border/60 bg-background/30"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm">{s.name}</span>
                  {selected?.id === s.id && <Check className="h-4 w-4 text-primary" />}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{s.category}</div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {s.energy_aerobic}% aerobic · {s.energy_glycolytic}% anaerobic · {s.energy_alactic}% power
                </div>
              </button>
            ))}
            {results.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                No match. Type the closest discipline — or add "{q}" via the search and it can be curated into the catalog.
              </div>
            )}
          </div>
        </section>
      )}

      {selected && (
        <>
          {/* Discipline / event / position / level / season */}
          <section className="glass-strong space-y-4 rounded-3xl p-6" aria-label="Sport details">
            <div className="flex items-center gap-2 text-sm font-semibold"><Activity className="h-4 w-4 text-primary" /> Your setup</div>
            {[
              { label: "Discipline", options: selected.disciplines, value: profile?.sport_discipline, key: "sport_discipline" },
              { label: "Event", options: selected.events, value: profile?.sport_event, key: "sport_event" },
              { label: "Position / role", options: selected.positions, value: profile?.sport_position, key: "sport_position" },
            ].map((row) => row.options.length > 0 && (
              <div key={row.key}>
                <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">{row.label}</div>
                <div className="flex flex-wrap gap-2">
                  {row.options.map((o) => (
                    <Chip key={o} active={row.value === o} onClick={() => pick({ [row.key]: row.value === o ? null : o })}>{o}</Chip>
                  ))}
                </div>
              </div>
            ))}
            <div>
              <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Competition level</div>
              <div className="flex flex-wrap gap-2">
                {["Recreational", "School", "Club", "State", "National", "Elite"].map((l) => (
                  <Chip key={l} active={profile?.competition_level === l} onClick={() => pick({ competition_level: l })}>{l}</Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                Season phase {selected.typical_season ? `· typical season ${selected.typical_season}` : ""}
              </div>
              <div className="flex flex-wrap gap-2">
                {SEASON_PHASES.map((p) => (
                  <Chip key={p} active={seasonPhase === p} onClick={() => pick({ season_phase: p })}>{p}</Chip>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-primary/5 p-3 text-[11px] text-muted-foreground">
              Source: {selected.data_source} · confidence {selected.confidence}. Numbers below are computed from your body weight,
              this sport's energy-system profile, your level and season phase — not from a generic template.
            </div>
          </section>

          {/* Day-type fuelling */}
          <section className="glass-strong space-y-4 rounded-3xl p-6" aria-label="Day-type fuelling plans">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold"><Droplets className="h-4 w-4 text-accent" /> Day-type fuelling & hydration</div>
              <div className="flex flex-wrap gap-2">
                {DAY_TYPES.map((d) => {
                  const Icon = DAY_ICON[d.id];
                  return (
                    <Chip key={d.id} active={dayType === d.id} onClick={() => setDayType(d.id)}>
                      <span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {d.label}</span>
                    </Chip>
                  );
                })}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{DAY_TYPES.find((d) => d.id === dayType)!.blurb}</p>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                { l: "Calories", v: fuel.calories, u: "kcal" },
                { l: "Carbs", v: fuel.carbs_g, u: `g · ${fuel.carbs_g_per_kg}/kg` },
                { l: "Protein", v: fuel.protein_g, u: `g · ${fuel.protein_g_per_kg}/kg` },
                { l: "Fluid", v: fuel.fluid_ml, u: "ml" },
                { l: "Sodium", v: fuel.sodium_mg, u: "mg" },
              ].map((c) => (
                <div key={c.l} className="rounded-2xl border border-border/60 bg-background/30 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{c.l}</div>
                  <div className="mt-1 font-display text-xl font-bold">{c.v.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground">{c.u}</div>
                </div>
              ))}
            </div>

            <ol className="space-y-2">
              {fuel.timeline.map((t) => (
                <li key={t.when} className="rounded-2xl border border-border/60 bg-background/30 p-3">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[10px] text-accent">{t.when}</span>
                    <span className="text-sm font-medium">{t.what}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">Why: {t.why}</div>
                </li>
              ))}
            </ol>

            <details className="rounded-2xl border border-border/60 bg-background/30 p-3">
              <summary className="cursor-pointer text-xs font-semibold text-primary">How these numbers were calculated</summary>
              <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                {fuel.why.map((w) => <li key={w}>• {w}</li>)}
              </ul>
            </details>
          </section>

          {/* Performance intelligence */}
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="glass-strong space-y-3 rounded-3xl p-6">
              <div className="flex items-center gap-2 text-sm font-semibold"><Zap className="h-4 w-4 text-warning" /> Energy-system & performance profile</div>
              {profileBars.map((p) => (
                <div key={p.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span>{p.label}</span><span className="text-muted-foreground">{p.value}%</span>
                  </div>
                  <Bar pct={p.value} />
                  <div className="mt-1 text-[11px] text-muted-foreground">{p.why}</div>
                </div>
              ))}
            </div>

            <div className="glass-strong space-y-3 rounded-3xl p-6">
              <div className="flex items-center gap-2 text-sm font-semibold"><Gauge className="h-4 w-4 text-primary" /> Training-load management</div>
              <div className="flex items-baseline gap-3">
                <div className="font-display text-4xl font-bold text-gradient">{load.ratio ?? "—"}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">acute : chronic</div>
              </div>
              <div className={`text-xs ${load.status === "high risk" ? "text-destructive" : load.status === "elevated" ? "text-warning" : "text-muted-foreground"}`}>
                {load.status} — {load.message}
              </div>
              <div className="text-[11px] text-muted-foreground">
                This week's load {load.acute.toLocaleString()} AU vs 4-week average {load.chronic.toLocaleString()} AU.
                Load = session minutes × perceived effort, from your logged workouts.
              </div>
            </div>

            <div className="glass-strong space-y-3 rounded-3xl p-6">
              <div className="flex items-center gap-2 text-sm font-semibold"><HeartPulse className="h-4 w-4 text-accent" /> Readiness score</div>
              <div className="flex items-baseline gap-3">
                <div className="font-display text-4xl font-bold">{ready.score}</div>
                <div className="text-xs text-muted-foreground">{ready.verdict}</div>
              </div>
              {ready.parts.map((p) => (
                <div key={p.label}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span>{p.label} <span className="text-muted-foreground">({Math.round(p.weight * 100)}%)</span></span>
                    <span className="text-muted-foreground">{p.note}</span>
                  </div>
                  <Bar pct={p.value * 100} tone="accent" />
                </div>
              ))}
              {ready.flags.map((f) => (
                <div key={f} className="flex items-start gap-2 rounded-xl bg-destructive/10 p-2 text-[11px] text-destructive">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {f}
                </div>
              ))}
            </div>

            <div className="glass-strong space-y-3 rounded-3xl p-6">
              <div className="flex items-center gap-2 text-sm font-semibold"><Activity className="h-4 w-4 text-warning" /> Fatigue & recovery status</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border/60 bg-background/30 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">7-day soreness</div>
                  <div className="font-display text-2xl">{fatigue.soreness != null ? fatigue.soreness.toFixed(1) : "—"}<span className="text-xs text-muted-foreground">/10</span></div>
                  <div className="text-[11px] text-muted-foreground">
                    {fatigue.soreness != null && fatigue.sorenessPrev != null
                      ? fatigue.soreness > fatigue.sorenessPrev + 0.5 ? "Rising vs last week — add a recovery day."
                        : fatigue.soreness < fatigue.sorenessPrev - 0.5 ? "Falling — you're absorbing the work well."
                        : "Stable week on week."
                      : "Log soreness daily to see a trend."}
                  </div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/30 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">7-day sleep</div>
                  <div className="font-display text-2xl">{fatigue.sleep != null ? fatigue.sleep.toFixed(1) : "—"}<span className="text-xs text-muted-foreground">h</span></div>
                  <div className="text-[11px] text-muted-foreground">
                    {fatigue.sleep != null && fatigue.sleep < 7 ? "Below 7 h — the single biggest limiter on adaptation." : "Sleep is supporting your training."}
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-primary/5 p-3 text-[11px] text-muted-foreground">
                Persistent fatigue, unexplained performance drops, resting heart-rate rise or disturbed sleep for 2+ weeks warrant a
                check-in with a sports physician — those are not things an app should manage alone.
              </div>
            </div>
          </section>

          {/* Weekly emphasis + position */}
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="glass-strong space-y-3 rounded-3xl p-6">
              <div className="flex items-center gap-2 text-sm font-semibold"><Dumbbell className="h-4 w-4 text-primary" /> Skill + strength integration</div>
              {emphasis.map((e) => (
                <div key={e.quality}>
                  <div className="flex items-center justify-between text-xs"><span>{e.quality}</span><span className="text-muted-foreground">{e.pct}%</span></div>
                  <Bar pct={e.pct * 2.5} />
                  <div className="mt-1 text-[11px] text-muted-foreground">{e.why}</div>
                </div>
              ))}
            </div>
            <div className="glass-strong space-y-2 rounded-3xl p-6">
              <div className="flex items-center gap-2 text-sm font-semibold"><Info className="h-4 w-4 text-accent" /> Position-specific guidance</div>
              {positionGuidance(selected, profile?.sport_position ?? null).map((g) => (
                <p key={g} className="rounded-2xl border border-border/60 bg-background/30 p-3 text-xs text-muted-foreground">{g}</p>
              ))}
            </div>
          </section>

          {/* Periodization */}
          <section className="glass-strong space-y-3 rounded-3xl p-6" aria-label="Periodization">
            <div className="flex items-center gap-2 text-sm font-semibold"><CalendarRange className="h-4 w-4 text-primary" /> Periodization & competition preparation</div>
            <div className="grid gap-3 md:grid-cols-5">
              {PERIODIZATION.map((p) => (
                <div key={p.phase} className={`rounded-2xl border p-3 ${p.phase === seasonPhase ? "border-primary/50 bg-primary/10" : "border-border/60 bg-background/30"}`}>
                  <div className="text-[10px] uppercase tracking-widest text-accent">{p.phase}</div>
                  <div className="mt-1 text-xs font-medium">{p.focus}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">Volume {p.volume} · Intensity {p.intensity}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{p.why}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Editable schedule */}
          <section className="glass-strong space-y-4 rounded-3xl p-6" aria-label="Training schedule">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold"><CalendarRange className="h-4 w-4 text-accent" /> Your weekly schedule</div>
              {editSchedule ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => { pick({ training_schedule: draftSchedule }); setEditSchedule(false); }}
                    className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  ><Check className="h-3.5 w-3.5" /> Save</button>
                  <button onClick={() => setEditSchedule(false)} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs">
                    <X className="h-3.5 w-3.5" /> Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setDraftSchedule({ ...schedule }); setEditSchedule(true); }}
                  className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs"
                ><Plus className="h-3.5 w-3.5" /> Edit schedule</button>
              )}
            </div>
            <div className="grid gap-2 md:grid-cols-7">
              {WEEKDAYS.map((d) => (
                <div key={d} className="rounded-2xl border border-border/60 bg-background/30 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{d}</div>
                  {editSchedule ? (
                    <select
                      value={draftSchedule[d] ?? "rest"}
                      onChange={(e) => setDraftSchedule((s) => ({ ...s, [d]: e.target.value }))}
                      aria-label={`${d} day type`}
                      className="mt-1 w-full rounded-lg border border-border/60 bg-background/60 p-1.5 text-xs"
                    >
                      <option value="rest">Rest</option>
                      {DAY_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  ) : (
                    <div className="mt-1 text-xs font-medium capitalize">{activeSchedule[d] ?? "rest"}</div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label className="flex items-center gap-2">
                Sessions / week
                <input
                  type="number" min={0} max={14} defaultValue={inputs.training_days_per_week}
                  onBlur={(e) => pick({ training_days_per_week: Number(e.target.value) })}
                  className="w-16 rounded-lg border border-border/60 bg-background/60 p-1.5"
                />
              </label>
              <label className="flex items-center gap-2">
                Hours / session
                <input
                  type="number" min={0} max={8} step={0.5} defaultValue={inputs.training_hours_per_day}
                  onBlur={(e) => pick({ training_hours_per_day: Number(e.target.value) })}
                  className="w-16 rounded-lg border border-border/60 bg-background/60 p-1.5"
                />
              </label>
              <span className="text-[11px] text-muted-foreground">
                Changing these instantly recalculates fuelling, hydration and weekly emphasis above.
              </span>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
