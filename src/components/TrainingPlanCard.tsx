import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Sparkles, Loader2, ShieldAlert, Info, ChevronDown, RefreshCw, CalendarDays, History,
} from "lucide-react";
import { generateTrainingPlan } from "@/lib/training.functions";
import { planSignature, signatureDiff, type PlanInputs } from "@/lib/training-logic";

interface PlanDay {
  day: string;
  title: string;
  focus: string;
  rest_day: boolean;
  duration_min: number;
  blocks: { exercise: string; sets: number; reps: string; rest_sec: number; why: string }[];
  note: string;
}

interface Plan {
  id: string;
  name: string;
  week: PlanDay[];
  rationale: string | null;
  safety_notes: string[];
  adjustments: unknown;
  inputs_signature: string | null;
  days_per_week: number;
  session_minutes: number;
}

export function TrainingPlanCard({
  plan,
  profile,
  onUseDay,
}: {
  plan: Plan | null;
  profile: (PlanInputs & { age?: number | null }) | null | undefined;
  onUseDay: (day: PlanDay) => void;
}) {
  const qc = useQueryClient();
  const generate = useServerFn(generateTrainingPlan);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const currentSig = profile ? planSignature(profile) : "";
  const drift = plan && profile ? signatureDiff(plan.inputs_signature, currentSig) : [];

  const mut = useMutation({
    mutationFn: (reason: string) => generate({ data: { reason } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-plan"] });
      toast.success("Plan updated — see the reasoning below.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adjustments = (Array.isArray(plan?.adjustments) ? plan?.adjustments : []) as {
    at: string; changed: string[]; explanation: string;
  }[];
  const latest = adjustments[adjustments.length - 1];

  if (!plan) {
    return (
      <section className="glass-strong rounded-3xl p-6 text-center">
        <Sparkles className="mx-auto h-6 w-6 text-primary" />
        <h2 className="mt-3 font-display text-lg font-bold">Build your training week</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Your plan is built from your goal, fitness level, age range, available equipment, session length, sport and
          your recent sleep and soreness — and only uses exercises from the verified library.
        </p>
        <button
          onClick={() => mut.mutate("first plan")}
          disabled={mut.isPending}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {mut.isPending ? "Building your week…" : "Generate my plan"}
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {drift.length > 0 && (
        <div className="glass rounded-3xl border border-accent/40 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-accent">
            <RefreshCw className="h-4 w-4" /> Your plan is out of date
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            You changed {drift.join("; ")}. Rebuild so the sessions, volume and exercise choices match what you have now.
          </p>
          <button
            onClick={() => mut.mutate("profile changed")}
            disabled={mut.isPending}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground disabled:opacity-60"
          >
            {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Adapt my plan
          </button>
        </div>
      )}

      <div className="glass-strong rounded-3xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-primary">
              <CalendarDays className="h-3 w-3" /> Active plan
            </div>
            <h2 className="font-display text-xl font-bold">{plan.name}</h2>
            <p className="text-xs text-muted-foreground">
              {plan.days_per_week} days/week · ~{plan.session_minutes} min per session
            </p>
          </div>
          <button
            onClick={() => mut.mutate("regenerate")}
            disabled={mut.isPending}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs disabled:opacity-60"
          >
            {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Regenerate
          </button>
        </div>

        {plan.rationale && (
          <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/5 p-4">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-primary">
              <Info className="h-3.5 w-3.5" /> Why this plan looks like this
            </div>
            <p className="text-sm text-muted-foreground">{plan.rationale}</p>
          </div>
        )}

        {latest && (
          <div className="mt-3 rounded-2xl border border-border/60 p-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide">Latest adjustment</div>
            <p className="text-sm text-muted-foreground">{latest.explanation}</p>
            {adjustments.length > 1 && (
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary"
              >
                <History className="h-3 w-3" />
                {showHistory ? "Hide" : `Show all ${adjustments.length} adjustments`}
              </button>
            )}
            {showHistory && (
              <ul className="mt-3 space-y-2 border-t border-border/60 pt-3">
                {[...adjustments].reverse().map((a, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    <span className="text-foreground">{new Date(a.at).toLocaleDateString()}</span> — {a.explanation}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {plan.safety_notes?.length > 0 && (
          <div className="mt-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-destructive">
              <ShieldAlert className="h-3.5 w-3.5" /> Train safely
            </div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {plan.safety_notes.map((s, i) => <li key={i}>• {s}</li>)}
            </ul>
          </div>
        )}
      </div>

      <ul className="grid gap-3 md:grid-cols-2">
        {plan.week.map((d) => {
          const open = openDay === d.day;
          return (
            <li key={d.day} className={`glass rounded-3xl ${d.rest_day ? "opacity-80" : ""}`}>
              <button
                onClick={() => setOpenDay(open ? null : d.day)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-3 p-4 text-left"
              >
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{d.day}</div>
                  <div className="truncate font-semibold">{d.rest_day ? "Rest & recover" : d.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.rest_day ? "Recovery day" : `${d.focus} · ${d.duration_min} min · ${d.blocks.length} moves`}
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
              </button>

              {open && (
                <div className="space-y-3 border-t border-border/60 px-4 pb-4 pt-3">
                  {d.note && <p className="text-xs text-muted-foreground">{d.note}</p>}
                  {d.blocks.map((b, i) => (
                    <div key={i} className="rounded-2xl border border-border/60 p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium">{b.exercise}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {b.sets}×{b.reps} · {b.rest_sec}s rest
                        </span>
                      </div>
                      {b.why && <p className="mt-1 text-xs text-muted-foreground">{b.why}</p>}
                    </div>
                  ))}
                  {!d.rest_day && (
                    <button
                      onClick={() => onUseDay(d)}
                      className="w-full rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                    >
                      Load this session into today's log
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
