import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Save, Loader2, Moon, Info, Lightbulb, X } from "lucide-react";
import { suggestNextSet } from "@/lib/training-logic";
import { noonISO } from "@/lib/dates";

export interface LoggedSet { reps: number; weight_kg: number | null }
export interface LoggedExercise {
  name: string;
  target_reps_low: number;
  target_reps_high: number;
  sets: LoggedSet[];
}

export interface Draft {
  name: string;
  workout_type: string;
  duration_min: number;
  exercises: LoggedExercise[];
  notes: string;
}

const TYPES = ["strength", "endurance", "mobility", "flexibility", "stability", "balance", "speed", "power", "recovery", "sport"];

function parseRange(reps: string): [number, number] {
  const m = reps.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (m) return [Number(m[1]), Number(m[2])];
  const n = Number(reps.replace(/\D/g, "")) || 10;
  return [n, n];
}

export function makeDraftFromPlanDay(day: {
  title: string; focus: string; duration_min: number;
  blocks: { exercise: string; sets: number; reps: string }[];
}): Draft {
  return {
    name: day.title,
    workout_type: day.focus || "strength",
    duration_min: day.duration_min,
    notes: "",
    exercises: day.blocks.map((b) => {
      const [lo, hi] = parseRange(b.reps);
      return {
        name: b.exercise,
        target_reps_low: lo,
        target_reps_high: hi,
        sets: Array.from({ length: Math.max(1, b.sets) }, () => ({ reps: lo, weight_kg: null })),
      };
    }),
  };
}

export const emptyDraft: Draft = {
  name: "",
  workout_type: "strength",
  duration_min: 40,
  exercises: [],
  notes: "",
};

export function WorkoutLogger({
  dateKey,
  draft,
  setDraft,
  history,
  age,
  onSaved,
}: {
  dateKey: string;
  draft: Draft;
  setDraft: (d: Draft) => void;
  history: { exercises: unknown; scheduled_for: string; perceived_effort: number | null }[];
  age: number | null | undefined;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [rpe, setRpe] = useState(6);
  const [restDay, setRestDay] = useState(false);
  const [picker, setPicker] = useState(false);

  useEffect(() => { if (restDay) setPicker(false); }, [restDay]);

  /** Last time each exercise was performed → drives the overload suggestion. */
  const lastPerformance = useMemo(() => {
    const map = new Map<string, { set: LoggedSet; lo: number; hi: number; rpe: number | null }>();
    for (const w of [...history].sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))) {
      const exs = (Array.isArray(w.exercises) ? w.exercises : []) as LoggedExercise[];
      for (const ex of exs) {
        const best = [...(ex.sets ?? [])].sort(
          (a, b) => (b.weight_kg ?? 0) - (a.weight_kg ?? 0) || b.reps - a.reps,
        )[0];
        if (best) {
          map.set(ex.name.toLowerCase(), {
            set: best,
            lo: ex.target_reps_low ?? 8,
            hi: ex.target_reps_high ?? 12,
            rpe: w.perceived_effort,
          });
        }
      }
    }
    return map;
  }, [history]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Not signed in");
      const { error } = await supabase.from("workouts").insert({
        user_id: uid,
        name: restDay ? "Rest day" : draft.name || "Session",
        workout_type: restDay ? "recovery" : draft.workout_type,
        duration_min: restDay ? 0 : draft.duration_min,
        intensity: rpe >= 8 ? "hard" : rpe >= 5 ? "moderate" : "easy",
        perceived_effort: restDay ? null : rpe,
        rest_day: restDay,
        exercises: (restDay ? [] : draft.exercises) as never,
        notes: draft.notes || null,
        completed: true,
        scheduled_for: noonISO(dateKey),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workouts"] });
      toast.success(restDay ? "Rest day logged — recovery is training." : "Session logged.");
      setDraft(emptyDraft);
      setRestDay(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = (fn: (d: Draft) => Draft) => setDraft(fn(draft));

  return (
    <div className="glass-strong space-y-4 rounded-3xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Log {dateKey}</h2>
        <button
          onClick={() => setRestDay((v) => !v)}
          aria-pressed={restDay}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs ${restDay ? "border-accent bg-accent/15 text-accent" : "border-border text-muted-foreground"}`}
        >
          <Moon className="h-3.5 w-3.5" /> Rest day
        </button>
      </div>

      {!restDay && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Session name">
              <input
                value={draft.name}
                onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
                placeholder="Lower body strength"
                className="w-full rounded-xl border border-border bg-input/40 px-3 py-2 text-sm outline-none"
              />
            </Field>
            <Field label="Type">
              <select
                value={draft.workout_type}
                onChange={(e) => update((d) => ({ ...d, workout_type: e.target.value }))}
                className="w-full rounded-xl border border-border bg-input/40 px-3 py-2 text-sm capitalize outline-none"
              >
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Duration (min)">
              <input
                type="number"
                min={0}
                value={draft.duration_min}
                onChange={(e) => update((d) => ({ ...d, duration_min: Number(e.target.value) }))}
                className="w-full rounded-xl border border-border bg-input/40 px-3 py-2 text-sm outline-none"
              />
            </Field>
          </div>

          <div className="space-y-3">
            {draft.exercises.map((ex, xi) => {
              const prev = lastPerformance.get(ex.name.toLowerCase());
              const suggestion = prev
                ? suggestNextSet({
                    weight_kg: prev.set.weight_kg,
                    reps: prev.set.reps,
                    target_reps_low: prev.lo,
                    target_reps_high: prev.hi,
                    rpe: prev.rpe,
                    age,
                  })
                : null;

              return (
                <div key={xi} className="rounded-2xl border border-border/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{ex.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        target {ex.target_reps_low}–{ex.target_reps_high} reps
                      </div>
                    </div>
                    <button
                      onClick={() => update((d) => ({ ...d, exercises: d.exercises.filter((_, i) => i !== xi) }))}
                      aria-label={`Remove ${ex.name}`}
                      className="rounded-full p-2 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {suggestion && (
                    <div className="mt-2 rounded-xl border border-primary/25 bg-primary/5 p-2.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                        <Lightbulb className="h-3 w-3" /> Suggested next step:{" "}
                        {suggestion.weight_kg ? `${suggestion.weight_kg} kg × ${suggestion.reps}` : `${suggestion.reps} reps`}
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{suggestion.why}</p>
                      <button
                        onClick={() =>
                          update((d) => ({
                            ...d,
                            exercises: d.exercises.map((e, i) =>
                              i === xi
                                ? { ...e, sets: e.sets.map(() => ({ reps: suggestion.reps, weight_kg: suggestion.weight_kg })) }
                                : e,
                            ),
                          }))
                        }
                        className="mt-1.5 text-[11px] text-primary underline"
                      >
                        Apply to all sets
                      </button>
                    </div>
                  )}

                  <div className="mt-2 space-y-2">
                    {ex.sets.map((s, si) => (
                      <div key={si} className="flex items-center gap-2">
                        <span className="w-10 shrink-0 text-[11px] text-muted-foreground">Set {si + 1}</span>
                        <label className="flex-1">
                          <span className="sr-only">{ex.name} set {si + 1} reps</span>
                          <input
                            type="number" min={0} value={s.reps}
                            onChange={(e) =>
                              update((d) => ({
                                ...d,
                                exercises: d.exercises.map((x, i) =>
                                  i === xi ? { ...x, sets: x.sets.map((y, j) => (j === si ? { ...y, reps: Number(e.target.value) } : y)) } : x,
                                ),
                              }))
                            }
                            className="w-full rounded-lg border border-border bg-input/40 px-2 py-1.5 text-sm outline-none"
                            placeholder="reps"
                          />
                        </label>
                        <label className="flex-1">
                          <span className="sr-only">{ex.name} set {si + 1} weight in kg</span>
                          <input
                            type="number" min={0} step="0.25" value={s.weight_kg ?? ""}
                            onChange={(e) =>
                              update((d) => ({
                                ...d,
                                exercises: d.exercises.map((x, i) =>
                                  i === xi
                                    ? { ...x, sets: x.sets.map((y, j) => (j === si ? { ...y, weight_kg: e.target.value === "" ? null : Number(e.target.value) } : y)) }
                                    : x,
                                ),
                              }))
                            }
                            className="w-full rounded-lg border border-border bg-input/40 px-2 py-1.5 text-sm outline-none"
                            placeholder="kg (blank = bodyweight)"
                          />
                        </label>
                      </div>
                    ))}
                    <button
                      onClick={() =>
                        update((d) => ({
                          ...d,
                          exercises: d.exercises.map((x, i) =>
                            i === xi ? { ...x, sets: [...x.sets, x.sets[x.sets.length - 1] ?? { reps: x.target_reps_low, weight_kg: null }] } : x,
                          ),
                        }))
                      }
                      className="text-[11px] text-primary"
                    >
                      + add set
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setPicker(true)}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Add exercise
          </button>

          {picker && (
            <ExercisePicker
              onClose={() => setPicker(false)}
              onPick={(name, lo, hi, sets) => {
                update((d) => ({
                  ...d,
                  exercises: [...d.exercises, { name, target_reps_low: lo, target_reps_high: hi, sets: Array.from({ length: sets }, () => ({ reps: lo, weight_kg: null })) }],
                }));
                setPicker(false);
              }}
            />
          )}

          <Field label={`Perceived effort (RPE): ${rpe}/10`}>
            <input
              type="range" min={1} max={10} step={0.5} value={rpe}
              onChange={(e) => setRpe(Number(e.target.value))}
              className="w-full accent-[hsl(var(--primary))]"
              aria-label="Perceived effort out of 10"
            />
            <p className="mt-1 flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              1 = very easy, 7–8 = a couple of reps left in the tank, 10 = nothing left. This drives your next
              session's load suggestion, so answer honestly rather than heroically.
            </p>
          </Field>
        </>
      )}

      <Field label="Notes">
        <textarea
          value={draft.notes}
          onChange={(e) => update((d) => ({ ...d, notes: e.target.value }))}
          rows={2}
          placeholder={restDay ? "How does recovery feel today?" : "Anything that affected the session…"}
          className="w-full rounded-xl border border-border bg-input/40 px-3 py-2 text-sm outline-none"
        />
      </Field>

      <button
        onClick={() => save.mutate()}
        disabled={save.isPending || (!restDay && !draft.name && draft.exercises.length === 0)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save log
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ExercisePicker({
  onPick, onClose,
}: {
  onPick: (name: string, lo: number, hi: number, sets: number) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["exercises"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exercises").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const list = (data ?? []).filter((e) =>
    !q.trim() ||
    e.name.toLowerCase().includes(q.toLowerCase()) ||
    ((e.muscle_groups ?? []) as string[]).some((m) => m.toLowerCase().includes(q.toLowerCase())),
  ).slice(0, 40);

  return (
    <div className="rounded-2xl border border-border p-3">
      <div className="mb-2 flex items-center gap-2">
        <input
          autoFocus value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search the exercise library…"
          aria-label="Search the exercise library"
          className="w-full rounded-xl border border-border bg-input/40 px-3 py-2 text-sm outline-none"
        />
        <button onClick={onClose} aria-label="Close exercise picker" className="rounded-full p-2 text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {list.map((e) => {
          const [lo, hi] = parseRange(e.default_reps ?? "8-12");
          return (
            <li key={e.id}>
              <button
                onClick={() => onPick(e.name, lo, hi, e.default_sets ?? 3)}
                className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="font-medium">{e.name}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {e.category} · {e.difficulty} · {((e.equipment ?? []) as string[]).join(", ") || "no equipment"}
                </span>
              </button>
            </li>
          );
        })}
        {list.length === 0 && <li className="p-3 text-xs text-muted-foreground">No matches.</li>}
      </ul>
    </div>
  );
}
