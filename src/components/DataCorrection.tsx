import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { correctTodayData, type CoachPayload } from "@/lib/coach.functions";
import { Check, Pencil } from "lucide-react";
import { toast } from "sonner";

/** Lets the user correct the exact data the twin used, so a wrong number never sticks. */
export function DataCorrection({
  inputs,
  onSaved,
}: {
  inputs: CoachPayload["today_inputs"];
  onSaved: () => void;
}) {
  const save = useServerFn(correctTodayData);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    sleep_hours: inputs.sleep_hours ?? "",
    soreness: inputs.soreness ?? "",
    mood: inputs.mood ?? "",
    readiness: inputs.readiness ?? "",
    water_ml: inputs.water_ml,
  });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await save({
        data: {
          sleep_hours: form.sleep_hours === "" ? null : Number(form.sleep_hours),
          soreness: form.soreness === "" ? null : Number(form.soreness),
          mood: form.mood === "" ? null : Number(form.mood),
          readiness: form.readiness === "" ? null : Number(form.readiness),
          water_ml: Number(form.water_ml) || 0,
        },
      });
      toast.success("Updated — today's recommendations recalculated");
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
      >
        <Pencil className="h-3 w-3" /> Something wrong? Correct today's data
      </button>
    );

  const field = (
    key: keyof typeof form,
    label: string,
    props: { min: number; max: number; step?: number; hint?: string },
  ) => (
    <label className="block text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={form[key] as number | string}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="mt-1 w-full rounded-xl border border-border bg-background/40 px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />
      {props.hint && <span className="text-[10px] text-muted-foreground">{props.hint}</span>}
    </label>
  );

  return (
    <div className="rounded-3xl border border-border/60 bg-background/30 p-4">
      <div className="mb-3 text-xs font-semibold">Correct today's inputs</div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {field("sleep_hours", "Sleep (h)", { min: 0, max: 20, step: 0.5 })}
        {field("soreness", "Soreness", { min: 1, max: 5, hint: "1 none – 5 severe" })}
        {field("mood", "Mood", { min: 1, max: 5, hint: "1 low – 5 great" })}
        {field("readiness", "Felt readiness", { min: 1, max: 5, hint: "1 flat – 5 fresh" })}
        {field("water_ml", "Water (ml)", { min: 0, max: 10000, step: 50 })}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Check className="h-3 w-3" /> {busy ? "Saving…" : "Save & recalculate"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
