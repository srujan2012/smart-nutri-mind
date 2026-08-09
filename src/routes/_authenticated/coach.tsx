import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  completeNextBestAction,
  generateCoachBriefing,
  getCoachToday,
  saveIdentity,
  savePersonalizationModes,
  useStreakShield,
  type CoachPayload,
} from "@/lib/coach.functions";
import { HabitTracker } from "@/components/HabitTracker";
import { DataCorrection } from "@/components/DataCorrection";
import { HealthSafetyBanner } from "@/components/HealthSafetyBanner";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import {
  Activity,
  ArrowRight,
  BatteryCharging,
  BedDouble,
  Brain,
  Check,
  Droplets,
  Dumbbell,
  Flame,
  Gauge,
  HeartHandshake,
  Info,
  Shield,
  Sparkles,
  Telescope,
  Trophy,
  Utensils,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/coach")({
  component: Coach,
  head: () => ({
    meta: [
      { title: "AI Coach — Daily Readiness & Next Best Action | NutriMind" },
      {
        name: "description",
        content:
          "Your AI digital twin: daily readiness, recovery, training, nutrition, sleep and hydration guidance built from your own logged data — with every factor explained.",
      },
      { property: "og:title", content: "AI Coach — Daily Readiness & Next Best Action" },
      {
        property: "og:description",
        content:
          "Readiness, recovery and one clear Next Best Action each day, explained and correctable.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const ring = (v: number) =>
  v >= 85 ? "text-primary" : v >= 70 ? "text-accent" : v >= 50 ? "text-warning" : "text-destructive";

function Score({ label, value, icon: Icon, caption }: {
  label: string; value: number; icon: typeof Gauge; caption: string;
}) {
  return (
    <div
      className="rounded-3xl border border-border/60 bg-background/30 p-4"
      role="group"
      aria-label={`${label}: ${value} out of 100. ${caption}`}
      tabIndex={0}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`mt-1 font-display text-3xl font-bold ${ring(value)}`}>{value}</div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-current opacity-80" style={{ width: `${value}%` }} />
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">{caption}</div>
    </div>
  );
}

function RecCard({ icon: Icon, tone, rec }: {
  icon: typeof Dumbbell; tone: string; rec: { title: string; detail: string; why: string };
}) {
  return (
    <div className="glass rounded-3xl p-5">
      <div className={`flex items-center gap-2 text-xs font-semibold ${tone}`}>
        <Icon className="h-4 w-4" /> {rec.title}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{rec.detail}</p>
      <details className="mt-3">
        <summary className="cursor-pointer text-[11px] text-accent hover:underline">
          Why this recommendation?
        </summary>
        <p className="mt-1.5 text-[11px] text-muted-foreground">{rec.why}</p>
      </details>
    </div>
  );
}

function Coach() {
  const load = useServerFn(getCoachToday);
  const brief = useServerFn(generateCoachBriefing);
  const doneNba = useServerFn(completeNextBestAction);
  const shield = useServerFn(useStreakShield);
  const setIdentity = useServerFn(saveIdentity);
  const setModes = useServerFn(savePersonalizationModes);

  const [data, setData] = useState<CoachPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [briefing, setBriefing] = useState(false);
  const [identity, setIdentityText] = useState("");

  const refresh = useCallback(async () => {
    try {
      const r = await load({ data: {} });
      setData(r);
      setIdentityText(r.identity_statement ?? "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load your coach");
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (loading)
    return (
      <div className="glass rounded-3xl p-16 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <div className="mt-4 text-sm text-muted-foreground">Building your digital twin…</div>
      </div>
    );
  if (!data) return null;

  const { twin, plan } = data;

  return (
    <div className="space-y-6">
      <HealthSafetyBanner context="diet" />

      <header>
        <div className="flex items-center gap-2 text-xs text-primary">
          <Brain className="h-3 w-3" /> AI Digital Twin
        </div>
        <h1 className="mt-1 font-display text-3xl font-bold">Today's coaching</h1>
        <p className="text-sm text-muted-foreground">{data.confidence_line}</p>
        {plan.modes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {plan.modes.map((m) => (
              <span key={m} className="rounded-full bg-accent/10 px-3 py-1 text-[11px] text-accent">{m}</span>
            ))}
          </div>
        )}
      </header>

      {/* Next Best Action */}
      <section className="glass-strong rounded-3xl border border-primary/30 p-6">
        <div className="flex items-center gap-2 text-xs text-primary">
          <Sparkles className="h-3 w-3" /> Next Best Action
        </div>
        <h2 className="mt-1 font-display text-2xl font-bold">{plan.nextBestAction.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{plan.nextBestAction.detail}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">Why: {plan.nextBestAction.why}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to={plan.nextBestAction.route}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground glow-neon"
          >
            Take me there <ArrowRight className="h-3 w-3" />
          </Link>
          <button
            disabled={data.nba_done}
            onClick={async () => {
              await doneNba({ data: { title: plan.nextBestAction.title } });
              toast.success("Nice — logged as a micro-win");
              void refresh();
            }}
            className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs disabled:opacity-50"
          >
            <Check className="h-3 w-3" /> {data.nba_done ? "Done today" : "Mark done"}
          </button>
        </div>
      </section>

      {/* Twin scores */}
      <section className="glass rounded-3xl p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Gauge className="h-4 w-4" /> Daily readiness & recovery
          </div>
          <DataCorrection inputs={data.today_inputs} onSaved={refresh} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Score label="Readiness" value={twin.readiness} icon={Activity} caption={`${twin.readinessBand} today`} />
          <Score label="Recovery" value={twin.recovery} icon={BatteryCharging} caption={twin.recoveryStatus} />
          <Score label="Adherence" value={twin.adherence} icon={Utensils} caption="calories & protein in range" />
          <Score label="Consistency" value={twin.consistency} icon={Flame} caption="days shown up, last 14" />
        </div>

        <div className="mt-4 rounded-2xl border border-border/60 bg-background/30 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
            <Info className="h-3.5 w-3.5 text-accent" /> Factors used (and how much they counted)
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {twin.factors.map((f) => (
              <li key={f.label} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-muted-foreground">{f.label}</span>
                <span className="text-right">
                  {f.value}
                  <span className="ml-2 text-[10px] text-muted-foreground">{f.weight}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground">
            These scores describe patterns in your own logs. They are not a medical assessment, and
            the app can only see what has been logged.
          </p>
        </div>
      </section>

      {/* Recovery override / rest day */}
      {plan.recoveryOverride && (
        <div className="rounded-3xl border border-warning/40 bg-warning/5 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-warning">
            <Shield className="h-4 w-4" /> {plan.recoveryOverride.title}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{plan.recoveryOverride.detail}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">{plan.recoveryOverride.why}</p>
        </div>
      )}

      {/* Daily recommendations */}
      <section className="grid gap-4 md:grid-cols-2">
        <RecCard icon={Dumbbell} tone="text-primary" rec={plan.training} />
        <RecCard icon={Utensils} tone="text-accent" rec={plan.nutrition} />
        <RecCard icon={BedDouble} tone="text-primary" rec={plan.sleep} />
        <RecCard icon={Droplets} tone="text-accent" rec={plan.hydration} />
        <RecCard icon={Activity} tone="text-warning" rec={plan.loadAdjustment} />
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <Gauge className="h-4 w-4" /> Adaptive targets
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl border border-border/60 p-3">
              <div className="font-display text-xl">{plan.calorieSuggestion.value}</div>
              <div className="text-[10px] uppercase text-muted-foreground">kcal suggested</div>
            </div>
            <div className="rounded-2xl border border-border/60 p-3">
              <div className="font-display text-xl">{plan.proteinSuggestion.value} g</div>
              <div className="text-[10px] uppercase text-muted-foreground">protein</div>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">{plan.calorieSuggestion.why}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{plan.proteinSuggestion.why}</p>
        </div>
      </section>

      {plan.smartRestDay.offered && (
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-accent">
            <BatteryCharging className="h-4 w-4" /> Smart rest day available
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {plan.smartRestDay.reason} Taking it today keeps your streak intact — rest counts as
            training here.
          </p>
        </div>
      )}

      {/* AI briefing */}
      <section className="glass rounded-3xl p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Sparkles className="h-4 w-4" /> Daily brief
          </div>
          <button
            onClick={async () => {
              setBriefing(true);
              try {
                const r = await brief({ data: {} });
                setData({ ...data, narrative: r.narrative });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Briefing failed");
              } finally {
                setBriefing(false);
              }
            }}
            disabled={briefing}
            className="rounded-full border border-border px-4 py-1.5 text-xs hover:border-primary/50 disabled:opacity-50"
          >
            {briefing ? "Writing…" : data.narrative ? "Rewrite" : "Write today's brief"}
          </button>
        </div>
        {data.narrative ? (
          <div className="prose prose-sm prose-invert max-w-none text-sm prose-strong:text-primary">
            <ReactMarkdown>{data.narrative}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            The numbers above are calculated, not generated. Tap to have the AI explain them in plain
            language — it can only use the card above and never diagnoses or prescribes.
          </p>
        )}
      </section>

      {/* Behaviour: identity, streak, micro-wins */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="glass rounded-3xl p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <HeartHandshake className="h-4 w-4" /> Identity-based coaching
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Goals pull; identity carries. Finish the sentence in your own words.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={identity}
                onChange={(e) => setIdentityText(e.target.value)}
                placeholder="I'm someone who trains consistently and eats enough protein"
                className="min-w-0 flex-1 rounded-xl border border-border bg-background/40 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
              <button
                onClick={async () => {
                  await setIdentity({ data: { identity_statement: identity } });
                  toast.success("Saved");
                  void refresh();
                }}
                className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
              >
                Save
              </button>
            </div>
          </div>

          <div className="glass rounded-3xl p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-warning">
              <Flame className="h-4 w-4" /> Streak {data.streak.days} · best {data.streak.best}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{data.motivation}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground">
                {data.streak.shields_available} streak shield
                {data.streak.shields_available === 1 ? "" : "s"} left
              </span>
              {data.streak.at_risk && (
                <button
                  onClick={async () => {
                    try {
                      await shield({ data: {} });
                      toast.success("Shield used — your streak is safe today");
                      void refresh();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "No shields left");
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-[11px] text-warning"
                >
                  <Shield className="h-3 w-3" /> Protect today
                </button>
              )}
            </div>
          </div>

          <div className="glass rounded-3xl p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-accent">
              <Telescope className="h-4 w-4" /> Future self
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{data.future_self}</p>
          </div>
        </div>

        <div className="space-y-4">
          <HabitTracker habits={data.habits} onChange={refresh} />

          <div className="glass rounded-3xl p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Trophy className="h-4 w-4" /> Micro-wins
            </div>
            {data.micro_wins.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Small wins show up here as you log them. They count.
              </p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {data.micro_wins.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-3 text-xs">
                    <span>{w.title}</span>
                    <span className="text-[10px] text-muted-foreground">{w.log_date}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <PersonalizationModes onSaved={refresh} save={setModes} />

      <p className="pb-4 text-center text-[11px] text-muted-foreground">
        NutriMind's coach supports your training and nutrition decisions — it does not replace a
        qualified coach, doctor, dietitian or physiotherapist. Pain, injury, unusual fatigue or any
        medical question belongs with a professional.
      </p>
    </div>
  );
}

function PersonalizationModes({
  save,
  onSaved,
}: {
  save: ReturnType<typeof useServerFn<typeof savePersonalizationModes>>;
  onSaved: () => void;
}) {
  const [exam, setExam] = useState(false);
  const [growth, setGrowth] = useState(false);
  const [injuries, setInjuries] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <section className="glass rounded-3xl p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-accent">
        <Brain className="h-4 w-4" /> Personalization modes
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Turn these on and every recommendation above adapts — lighter loads, simpler meals, more
        sleep priority.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/30 p-3 text-xs">
          <input type="checkbox" checked={exam} onChange={(e) => setExam(e.target.checked)} className="accent-[hsl(var(--primary))]" />
          School / exam mode
        </label>
        <label className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/30 p-3 text-xs">
          <input type="checkbox" checked={growth} onChange={(e) => setGrowth(e.target.checked)} className="accent-[hsl(var(--primary))]" />
          Growth & development
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Current niggles / injuries</span>
          <input
            value={injuries}
            onChange={(e) => setInjuries(e.target.value)}
            placeholder="left knee, lower back"
            className="mt-1 w-full rounded-xl border border-border bg-background/40 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </label>
      </div>
      <button
        onClick={async () => {
          setBusy(true);
          try {
            await save({
              data: {
                exam_mode: exam,
                exam_until: null,
                growth_mode: growth,
                injuries: injuries.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10),
              },
            });
            toast.success("Modes updated");
            onSaved();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not save");
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
        className="mt-3 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Saving…" : "Apply modes"}
      </button>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Injury notes are used to work around movements, not to diagnose. Get any persistent pain
        assessed in person.
      </p>
    </section>
  );
}
