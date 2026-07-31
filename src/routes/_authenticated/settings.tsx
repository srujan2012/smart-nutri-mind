import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { deleteMyAccount } from "@/lib/account.functions";
import { computeTargets, type ActivityLevel, type Goal, type Sex } from "@/lib/nutrition-targets";
import { useTheme } from "@/lib/theme";
import { toast } from "sonner";
import {
  Bell, Download, Moon, Sun, ShieldCheck, Trash2, Save, Lock, UserCog, AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: "lose", label: "Healthy weight management" },
  { value: "maintain", label: "General fitness" },
  { value: "recomp", label: "Recomposition" },
  { value: "gain", label: "Muscle development" },
];
const ACTIVITIES: ActivityLevel[] = ["sedentary", "light", "moderate", "very", "athlete"];

function Section({
  icon: Icon, title, desc, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-strong rounded-3xl p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Toggle({
  checked, onChange, label, hint,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`h-6 w-11 shrink-0 rounded-full border transition ${
          checked ? "border-primary bg-primary/30" : "border-border bg-muted"
        }`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-foreground transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

const field =
  "w-full rounded-2xl border border-border bg-input/40 px-4 py-3 text-sm focus:border-primary focus:outline-none";

function SettingsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { theme, setTheme } = useTheme();
  const deleteAccount = useServerFn(deleteMyAccount);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return data;
    },
  });

  const [form, setForm] = useState({
    full_name: "", age: 25, gender: "male", height_cm: 170, weight_kg: 70,
    goal: "maintain", activity_level: "moderate", fitness_level: "beginner",
    daily_schedule: "", daily_budget: 300,
    reminders_enabled: true, consent_ai: true, consent_analytics: false,
  });
  const [saving, setSaving] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name ?? "",
      age: profile.age ?? 25,
      gender: profile.gender ?? "male",
      height_cm: Number(profile.height_cm ?? 170),
      weight_kg: Number(profile.weight_kg ?? 70),
      goal: profile.goal ?? "maintain",
      activity_level: profile.activity_level ?? "moderate",
      fitness_level: profile.fitness_level ?? "beginner",
      daily_schedule: profile.daily_schedule ?? "",
      daily_budget: Number(profile.daily_budget ?? 300),
      reminders_enabled: profile.reminders_enabled ?? true,
      consent_ai: profile.consent_ai ?? true,
      consent_analytics: profile.consent_analytics ?? false,
    });
  }, [profile]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const t = computeTargets({
        age: form.age,
        sex: form.gender as Sex,
        height_cm: form.height_cm,
        weight_kg: form.weight_kg,
        activity: form.activity_level as ActivityLevel,
        goal: form.goal as Goal,
      });
      const { error } = await supabase
        .from("profiles")
        .update({
          ...form,
          theme,
          calorie_target: t.calories,
          protein_target: t.protein,
          carbs_target: t.carbs,
          fat_target: t.fat,
          fiber_target: t.fiber,
        })
        .eq("id", u.user.id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Settings saved — targets recalculated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const exportData = async () => {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const [p, meals, metrics, workouts, grocery, pantry] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
        supabase.from("meals").select("*"),
        supabase.from("daily_metrics").select("*"),
        supabase.from("workouts").select("*"),
        supabase.from("grocery_items").select("*"),
        supabase.from("pantry_scans").select("*"),
      ]);
      const payload = {
        exported_at: new Date().toISOString(),
        account: { id: u.user.id, email: u.user.email },
        profile: p.data,
        meals: meals.data ?? [],
        daily_metrics: metrics.data ?? [],
        workouts: workouts.data ?? [],
        grocery_items: grocery.data ?? [],
        pantry_scans: pantry.data ?? [],
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nutrimind-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  const removeAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccount({ data: undefined });
      await supabase.auth.signOut();
      toast.success("Account deleted");
      router.navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deletion failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold">Settings</h1>
          <p className="text-xs text-muted-foreground">Profile, privacy, notifications and appearance.</p>
        </div>
        <button
          onClick={saveProfile}
          disabled={saving}
          className="flex shrink-0 items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground glow-neon disabled:opacity-60"
        >
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
        </button>
      </header>

      <Section icon={UserCog} title="Profile" desc="Changing body data or goal recalculates your targets.">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Name</span>
            <input className={field} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Age</span>
            <input type="number" className={field} value={form.age} onChange={(e) => setForm({ ...form, age: +e.target.value })} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Sex (for physiological estimates)</span>
            <select className={field} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other / prefer not to say</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Fitness level</span>
            <select className={field} value={form.fitness_level} onChange={(e) => setForm({ ...form, fitness_level: e.target.value })}>
              {["beginner", "intermediate", "advanced", "elite"].map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Height (cm)</span>
            <input type="number" className={field} value={form.height_cm} onChange={(e) => setForm({ ...form, height_cm: +e.target.value })} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Weight (kg)</span>
            <input type="number" className={field} value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: +e.target.value })} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Primary goal</span>
            <select className={field} value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })}>
              {GOAL_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Activity level</span>
            <select className={field} value={form.activity_level} onChange={(e) => setForm({ ...form, activity_level: e.target.value })}>
              {ACTIVITIES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs text-muted-foreground">Daily schedule (used for meal & training timing)</span>
            <input
              className={field}
              placeholder="e.g. Classes 9–4, gym 6pm, dinner 8:30pm"
              value={form.daily_schedule}
              onChange={(e) => setForm({ ...form, daily_schedule: e.target.value })}
            />
          </label>
        </div>
        <p className="mt-4 rounded-2xl bg-warning/10 p-3 text-[11px] text-muted-foreground">
          Targets are estimates from standard equations, not medical advice. Progress is shown as trend ranges —
          no exact dates, guaranteed body changes, or height outcomes are promised.
        </p>
      </Section>

      <Section icon={Bell} title="Notifications" desc="Reminder scheduling is in-app only for now.">
        <Toggle
          label="Daily reminders"
          hint="Meal, hydration and training nudges on your dashboard."
          checked={form.reminders_enabled}
          onChange={(v) => setForm({ ...form, reminders_enabled: v })}
        />
        <p className="mt-2 rounded-2xl border border-dashed border-border p-3 text-[11px] text-muted-foreground">
          Placeholder: push/email delivery requires a notification provider to be connected. Until then reminders
          appear inside the app only.
        </p>
      </Section>

      <Section icon={theme === "dark" ? Moon : Sun} title="Appearance">
        <div className="flex gap-2">
          {(["dark", "light"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm capitalize transition ${
                theme === t ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
              }`}
            >
              {t === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />} {t}
            </button>
          ))}
        </div>
      </Section>

      <Section icon={ShieldCheck} title="Privacy & consent" desc="You control how your data is used.">
        <Toggle
          label="AI personalisation"
          hint="Allow meal photos and profile data to be sent to the AI coach for analysis."
          checked={form.consent_ai}
          onChange={(v) => setForm({ ...form, consent_ai: v })}
        />
        <Toggle
          label="Product analytics"
          hint="Anonymous usage stats to improve the app. Off by default."
          checked={form.consent_analytics}
          onChange={(v) => setForm({ ...form, consent_analytics: v })}
        />
        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-background/40 p-3 text-[11px] text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          Your logs are private to your account and protected by row-level security — nobody else can read them.
        </div>
      </Section>

      <Section icon={Download} title="Your data">
        <button onClick={exportData} className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:border-primary/50">
          <Download className="h-4 w-4" /> Export everything (JSON)
        </button>
      </Section>

      <Section icon={Trash2} title="Delete account" desc="Permanent. Removes your profile, meals, workouts and logs.">
        <div className="flex items-start gap-2 rounded-2xl bg-destructive/10 p-3 text-[11px] text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          This cannot be undone. Export your data first if you want a copy.
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input
            className={field}
            placeholder='Type DELETE to confirm'
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            aria-label="Type DELETE to confirm account deletion"
          />
          <button
            onClick={removeAccount}
            disabled={confirmText !== "DELETE" || deleting}
            className="rounded-2xl bg-destructive px-5 py-3 text-sm font-semibold text-destructive-foreground disabled:opacity-40"
          >
            {deleting ? "Deleting…" : "Delete account"}
          </button>
        </div>
      </Section>
    </div>
  );
}
