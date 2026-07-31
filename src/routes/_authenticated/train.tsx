import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { localDateKey } from "@/components/DailyVitals";
import { addDays, prettyDay, startOfWeek } from "@/lib/dates";
import { TrainingPlanCard } from "@/components/TrainingPlanCard";
import { WorkoutLogger, emptyDraft, makeDraftFromPlanDay, type Draft } from "@/components/WorkoutLogger";
import { ProgressTrend } from "@/components/ProgressTrend";
import { CalendarDays, Dumbbell, LineChart, Moon, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/train")({
  head: () => ({
    meta: [
      { title: "Training plan & log — NutriMind AI" },
      { name: "description", content: "Adaptive training plans, a workout calendar, set-by-set logging with RPE, safe progressive overload and honest progress trends." },
      { property: "og:title", content: "Training plan & log — NutriMind AI" },
      { property: "og:description", content: "Adaptive plans built from your goal, level, equipment and recovery — with logging, progressive overload and trend ranges." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrainPage,
});

type Tab = "plan" | "log" | "progress";

function TrainPage() {
  const [tab, setTab] = useState<Tab>("plan");
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
      return data;
    },
  });

  const today = localDateKey(profile?.timezone);
  const [selected, setSelected] = useState(today);

  const { data: plan } = useQuery({
    queryKey: ["training-plan"],
    queryFn: async () => {
      const { data } = await supabase
        .from("training_plans")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: workouts } = useQuery({
    queryKey: ["workouts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("workouts")
        .select("*")
        .order("scheduled_for", { ascending: false })
        .limit(120);
      return data ?? [];
    },
  });

  const { data: metrics } = useQuery({
    queryKey: ["metrics-weight"],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_metrics")
        .select("log_date, weight_kg")
        .not("weight_kg", "is", null)
        .order("log_date", { ascending: true })
        .limit(120);
      return data ?? [];
    },
  });

  const byDay = useMemo(() => {
    const m = new Map<string, typeof workouts extends undefined ? never : NonNullable<typeof workouts>>();
    for (const w of workouts ?? []) {
      const key = String(w.scheduled_for).slice(0, 10);
      const arr = m.get(key) ?? [];
      arr.push(w);
      m.set(key, arr);
    }
    return m;
  }, [workouts]);

  const weekStart = startOfWeek(selected);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const thisWeekStart = startOfWeek(today);
  const sessionsThisWeek = (workouts ?? []).filter(
    (w) => !w.rest_day && String(w.scheduled_for).slice(0, 10) >= thisWeekStart,
  ).length;

  const streakDays = useMemo(() => {
    let n = 0;
    let cursor = today;
    for (let i = 0; i < 90; i++) {
      if ((byDay.get(cursor)?.length ?? 0) > 0) n++;
      else if (i > 0) break;
      cursor = addDays(cursor, -1);
    }
    return n;
  }, [byDay, today]);

  const planDays = (Array.isArray(plan?.week) ? plan?.week : []) as {
    day: string; title: string; focus: string; rest_day: boolean; duration_min: number;
    blocks: { exercise: string; sets: number; reps: string; rest_sec: number; why: string }[]; note: string;
  }[];

  const tabs: { id: Tab; label: string; icon: typeof Dumbbell }[] = [
    { id: "plan", label: "My plan", icon: Dumbbell },
    { id: "log", label: "Calendar & log", icon: CalendarDays },
    { id: "progress", label: "Progress", icon: LineChart },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <div className="flex items-center gap-2 text-xs text-primary">
          <Dumbbell className="h-3 w-3" /> Training
        </div>
        <h1 className="font-display text-2xl font-bold">Train with a reason for every set</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your week adapts when your goal, level, schedule, equipment, sport or feedback changes — and every change is explained.
        </p>
      </header>

      <div role="tablist" aria-label="Training sections" className="glass flex gap-1 rounded-full p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-medium transition-colors ${
              tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "plan" && (
        <TrainingPlanCard
          plan={plan ? { ...plan, week: planDays } : null}
          profile={profile}
          onUseDay={(d) => {
            setDraft(makeDraftFromPlanDay(d));
            setSelected(today);
            setTab("log");
          }}
        />
      )}

      {tab === "log" && (
        <div className="space-y-4">
          <section className="glass rounded-3xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <button onClick={() => setSelected(addDays(selected, -7))} className="rounded-full border border-border px-3 py-1.5 text-xs">
                ← Previous week
              </button>
              <span className="text-xs text-muted-foreground">{prettyDay(weekStart)} – {prettyDay(addDays(weekStart, 6))}</span>
              <button onClick={() => setSelected(addDays(selected, 7))} className="rounded-full border border-border px-3 py-1.5 text-xs">
                Next week →
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {week.map((key) => {
                const logs = byDay.get(key) ?? [];
                const rest = logs.some((l) => l.rest_day);
                const done = logs.some((l) => !l.rest_day);
                return (
                  <button
                    key={key}
                    onClick={() => setSelected(key)}
                    aria-current={key === selected}
                    aria-label={`${prettyDay(key)}${done ? ", session logged" : rest ? ", rest day" : ", nothing logged"}`}
                    className={`flex flex-col items-center gap-1 rounded-2xl border p-2 text-[11px] ${
                      key === selected ? "border-primary bg-primary/10" : "border-border/60"
                    } ${key === today ? "ring-1 ring-accent/60" : ""}`}
                  >
                    <span className="text-muted-foreground">{prettyDay(key).split(" ")[0]}</span>
                    <span className="font-semibold">{key.slice(8)}</span>
                    {done ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : rest ? <Moon className="h-3.5 w-3.5 text-accent" /> : <span className="h-3.5" />}
                  </button>
                );
              })}
            </div>
          </section>

          {(byDay.get(selected) ?? []).map((w) => (
            <div key={w.id} className="glass rounded-3xl p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{w.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {w.rest_day ? "Rest day" : `${w.workout_type} · ${w.duration_min} min${w.perceived_effort ? ` · RPE ${w.perceived_effort}` : ""}`}
                  </div>
                </div>
              </div>
              {((Array.isArray(w.exercises) ? w.exercises : []) as { name: string; sets: { reps: number; weight_kg: number | null }[] }[]).map((ex, i) => (
                <div key={i} className="mt-2 text-xs text-muted-foreground">
                  <span className="text-foreground">{ex.name}</span> —{" "}
                  {(ex.sets ?? []).map((s) => (s.weight_kg ? `${s.reps}×${s.weight_kg}kg` : `${s.reps} reps`)).join(", ")}
                </div>
              ))}
              {w.notes && <p className="mt-2 text-xs italic text-muted-foreground">{w.notes}</p>}
            </div>
          ))}

          <WorkoutLogger
            dateKey={selected}
            draft={draft}
            setDraft={setDraft}
            history={(workouts ?? []).map((w) => ({
              exercises: w.exercises,
              scheduled_for: String(w.scheduled_for),
              perceived_effort: w.perceived_effort,
            }))}
            age={profile?.age}
            onSaved={() => undefined}
          />
        </div>
      )}

      {tab === "progress" && (
        <ProgressTrend
          weighIns={(metrics ?? []).map((m) => ({ date: m.log_date, weight: Number(m.weight_kg) }))}
          sessionsThisWeek={sessionsThisWeek}
          streakDays={streakDays}
          goal={profile?.goal}
          age={profile?.age}
        />
      )}
    </div>
  );
}
