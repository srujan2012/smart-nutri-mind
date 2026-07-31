import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { localDateKey } from "@/components/DailyVitals";
import { toast } from "sonner";
import { Dumbbell, Plus, Check, Trash2, Timer, Flame } from "lucide-react";

export const Route = createFileRoute("/_authenticated/train")({
  head: () => ({
    meta: [
      { title: "Training log — NutriMind AI" },
      { name: "description", content: "Plan and log workouts, then fuel them with matched nutrition targets." },
      { property: "og:title", content: "Training log — NutriMind AI" },
      { property: "og:description", content: "Plan and log workouts, then fuel them with matched nutrition targets." },
    ],
  }),
  component: TrainPage,
});

const TYPES = ["strength", "endurance", "mobility", "sport practice", "match", "recovery"];
const INTENSITIES = ["easy", "moderate", "hard", "max"];

const field =
  "w-full rounded-2xl border border-border bg-input/40 px-4 py-3 text-sm focus:border-primary focus:outline-none";

function TrainPage() {
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return data;
    },
  });

  const today = localDateKey(profile?.timezone);

  const { data: workouts } = useQuery({
    queryKey: ["workouts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("workouts")
        .select("*")
        .order("scheduled_for", { ascending: false })
        .limit(60);
      return data ?? [];
    },
  });

  const [form, setForm] = useState({
    name: "",
    workout_type: "strength",
    intensity: "moderate",
    duration_min: 45,
    scheduled_for: today,
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!form.name.trim()) return toast.error("Give the session a name");
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("workouts").insert({ ...form, user_id: u.user.id });
      if (error) throw error;
      setForm({ ...form, name: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["workouts"] });
      toast.success("Session added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: string, completed: boolean) => {
    await supabase.from("workouts").update({ completed: !completed }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["workouts"] });
  };

  const remove = async (id: string) => {
    await supabase.from("workouts").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["workouts"] });
  };

  const todays = (workouts ?? []).filter((w) => w.scheduled_for === today);
  const past = (workouts ?? []).filter((w) => w.scheduled_for !== today);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-primary">
            <Dumbbell className="h-3 w-3" /> Training
          </div>
          <h1 className="truncate font-display text-2xl font-bold">Sessions & recovery</h1>
        </div>
      </header>

      <section className="glass-strong rounded-3xl p-6">
        <h2 className="mb-4 font-display text-lg font-semibold">Add a session</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className={field}
            placeholder="Session name (e.g. Upper body push)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            aria-label="Session name"
          />
          <input
            type="date"
            className={field}
            value={form.scheduled_for}
            onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })}
            aria-label="Session date"
          />
          <select className={field} value={form.workout_type} onChange={(e) => setForm({ ...form, workout_type: e.target.value })} aria-label="Session type">
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className={field} value={form.intensity} onChange={(e) => setForm({ ...form, intensity: e.target.value })} aria-label="Intensity">
            {INTENSITIES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs text-muted-foreground">Duration: {form.duration_min} min</span>
            <input
              type="range"
              min={10}
              max={180}
              step={5}
              value={form.duration_min}
              onChange={(e) => setForm({ ...form, duration_min: +e.target.value })}
              className="w-full accent-[var(--primary)]"
              aria-label="Duration in minutes"
            />
          </label>
          <input
            className={`${field} sm:col-span-2`}
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            aria-label="Session notes"
          />
        </div>
        <button
          onClick={add}
          disabled={saving}
          className="mt-4 flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground glow-neon disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> {saving ? "Saving…" : "Add session"}
        </button>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Calories burned are not estimated automatically — that needs a verified device or heart-rate source.
          Connect one later and this will fill in.
        </p>
      </section>

      <SessionList title="Today" items={todays} onToggle={toggle} onRemove={remove} empty="Nothing scheduled today." />
      <SessionList title="Recent & upcoming" items={past} onToggle={toggle} onRemove={remove} empty="No other sessions yet." />
    </div>
  );
}

function SessionList({
  title, items, onToggle, onRemove, empty,
}: {
  title: string;
  items: { id: string; name: string; workout_type: string; intensity: string; duration_min: number; completed: boolean; scheduled_for: string; calories_burned: number | null }[];
  onToggle: (id: string, completed: boolean) => void;
  onRemove: (id: string) => void;
  empty: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {items.length === 0 ? (
        <div className="glass rounded-3xl p-6 text-center text-sm text-muted-foreground">{empty}</div>
      ) : (
        <ul className="space-y-3">
          {items.map((w) => (
            <li key={w.id} className="glass grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl p-4">
              <button
                onClick={() => onToggle(w.id, w.completed)}
                aria-label={w.completed ? `Mark ${w.name} incomplete` : `Mark ${w.name} complete`}
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${
                  w.completed ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground"
                }`}
              >
                <Check className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <div className="truncate font-semibold">{w.name}</div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="capitalize">{w.workout_type}</span>
                  <span className="capitalize">· {w.intensity}</span>
                  <span className="flex items-center gap-1"><Timer className="h-3 w-3" />{w.duration_min}m</span>
                  <span>· {w.scheduled_for}</span>
                  {w.calories_burned != null && (
                    <span className="flex items-center gap-1"><Flame className="h-3 w-3" />{w.calories_burned} kcal</span>
                  )}
                </div>
              </div>
              <button onClick={() => onRemove(w.id)} aria-label={`Delete ${w.name}`} className="shrink-0 rounded-full p-2 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
