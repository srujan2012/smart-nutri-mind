import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { deleteHabit, saveHabit, toggleHabitToday, type Habit } from "@/lib/coach.functions";
import { Check, Plus, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";

const EMPTY = {
  name: "",
  cue: "",
  routine: "",
  reward: "",
  identity_statement: "",
  target_days_per_week: 5,
};

/** Habit loops built the behavioural way: cue → routine → reward, tied to an identity. */
export function HabitTracker({ habits, onChange }: { habits: Habit[]; onChange: () => void }) {
  const save = useServerFn(saveHabit);
  const remove = useServerFn(deleteHabit);
  const toggle = useServerFn(toggleHabitToday);
  const [form, setForm] = useState({ ...EMPTY });
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await save({
        data: {
          name: form.name.trim(),
          cue: form.cue.trim() || null,
          routine: form.routine.trim() || null,
          reward: form.reward.trim() || null,
          identity_statement: form.identity_statement.trim() || null,
          target_days_per_week: form.target_days_per_week,
        },
      });
      setForm({ ...EMPTY });
      setAdding(false);
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save habit");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass rounded-3xl p-5">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Repeat className="h-4 w-4" /> Habit loops
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> New habit
        </button>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Cue → routine → reward. Missing a day costs nothing here; the point is the identity, not a
        perfect grid.
      </p>

      {adding && (
        <div className="mb-4 space-y-2 rounded-2xl border border-border/60 bg-background/30 p-4">
          {(
            [
              ["name", "Habit", "Drink water with every meal"],
              ["cue", "Cue (when/where)", "When I sit down to eat"],
              ["routine", "Routine", "Fill and finish one glass"],
              ["reward", "Reward", "Tick it off, notice the afternoon energy"],
              ["identity_statement", "Identity", "I'm someone who stays hydrated"],
            ] as const
          ).map(([key, label, ph]) => (
            <label key={key} className="block text-xs">
              <span className="text-muted-foreground">{label}</span>
              <input
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={ph}
                className="mt-1 w-full rounded-xl border border-border bg-background/40 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </label>
          ))}
          <label className="block text-xs">
            <span className="text-muted-foreground">Days per week: {form.target_days_per_week}</span>
            <input
              type="range"
              min={1}
              max={7}
              value={form.target_days_per_week}
              onChange={(e) => setForm({ ...form, target_days_per_week: Number(e.target.value) })}
              className="mt-1 w-full accent-[hsl(var(--primary))]"
            />
          </label>
          <button
            onClick={submit}
            disabled={busy || !form.name.trim()}
            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add habit"}
          </button>
        </div>
      )}

      {habits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
          No habits yet. One small, boring, repeatable habit beats a heroic plan you drop in a week.
        </div>
      ) : (
        <ul className="space-y-2">
          {habits.map((h) => (
            <li
              key={h.id}
              className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/30 p-3"
            >
              <button
                onClick={async () => {
                  await toggle({ data: { habit_id: h.id, done: !h.done_today, name: h.name } });
                  onChange();
                }}
                aria-pressed={h.done_today}
                aria-label={`${h.done_today ? "Undo" : "Mark done"}: ${h.name}`}
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  h.done_today
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-transparent hover:border-primary/60"
                }`}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{h.name}</div>
                {h.identity_statement && (
                  <div className="text-xs italic text-accent">“{h.identity_statement}”</div>
                )}
                {(h.cue || h.routine || h.reward) && (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {[h.cue, h.routine, h.reward].filter(Boolean).join(" → ")}
                  </div>
                )}
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex gap-1" aria-hidden>
                    {Array.from({ length: 7 }).map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 w-4 rounded-full ${
                          i < h.days_done_this_week ? "bg-primary" : "bg-border"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {h.days_done_this_week}/{h.target_days_per_week} this week
                  </span>
                </div>
              </div>
              <button
                onClick={async () => {
                  await remove({ data: { id: h.id } });
                  onChange();
                }}
                aria-label={`Delete habit ${h.name}`}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
