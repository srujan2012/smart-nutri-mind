import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { InsightChart } from "@/components/InsightChart";
import {
  adherence, buildReport, dayRange, detectPatterns, emptyDay, linearTrend,
  mean, rolling, sessionLoad, toCSV, type DayPoint,
} from "@/lib/analytics";
import { dateKeyOf } from "@/lib/dates";
import {
  LineChart as LineIcon, Download, Printer, TrendingUp, AlertTriangle, Sparkles, FileText,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/insights")({
  component: Insights,
});

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

function Insights() {
  const [days, setDays] = useState<number>(30);

  const { data: profile } = useQuery({
    queryKey: ["profile-insights"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("calorie_target,protein_target,fiber_target,timezone,goal,age")
        .maybeSingle();
      return data;
    },
  });
  const tz = profile?.timezone ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["insights", days, tz],
    queryFn: async () => {
      const keys = dayRange(Math.max(days, 90), tz);
      const from = keys[0]!;
      const fromISO = `${from}T00:00:00`;
      const [metrics, meals, workouts] = await Promise.all([
        supabase.from("daily_metrics")
          .select("log_date,water_ml,sleep_hours,weight_kg,mood,soreness,readiness")
          .gte("log_date", from),
        supabase.from("meals")
          .select("calories,protein,carbs,fat,fiber,consumed_at")
          .gte("consumed_at", fromISO),
        supabase.from("workouts")
          .select("duration_min,intensity,perceived_effort,completed,rest_day,scheduled_for")
          .gte("scheduled_for", fromISO),
      ]);

      const map = new Map<string, DayPoint>(keys.map((k) => [k, emptyDay(k)]));
      for (const m of metrics.data ?? []) {
        const p = map.get(m.log_date);
        if (!p) continue;
        p.water_ml = m.water_ml ?? null;
        p.sleep_hours = m.sleep_hours == null ? null : Number(m.sleep_hours);
        p.weight_kg = m.weight_kg == null ? null : Number(m.weight_kg);
        p.mood = m.mood ?? null;
        p.soreness = m.soreness ?? null;
        p.readiness = m.readiness ?? null;
      }
      for (const m of meals.data ?? []) {
        const p = map.get(dateKeyOf(new Date(m.consumed_at), tz));
        if (!p) continue;
        p.meals += 1;
        p.calories = (p.calories ?? 0) + Number(m.calories ?? 0);
        p.protein = (p.protein ?? 0) + Number(m.protein ?? 0);
        p.carbs = (p.carbs ?? 0) + Number(m.carbs ?? 0);
        p.fat = (p.fat ?? 0) + Number(m.fat ?? 0);
        p.fiber = (p.fiber ?? 0) + Number(m.fiber ?? 0);
      }
      for (const w of workouts.data ?? []) {
        const p = map.get(dateKeyOf(new Date(w.scheduled_for), tz));
        if (!p || w.rest_day || !w.completed) continue;
        p.sessions += 1;
        p.load = (p.load ?? 0) + sessionLoad(w.duration_min, w.perceived_effort, w.intensity);
      }
      return keys.map((k) => map.get(k)!);
    },
  });

  const all = data ?? [];
  const points = useMemo(() => all.slice(-days), [all, days]);

  const weightSeries = rolling(points, "weight_kg", 7);
  const weightTrend = linearTrend(weightSeries);
  const calSeries = rolling(points, "calories", 7);
  const patterns = useMemo(() => detectPatterns(all), [all]);

  const calAdh = adherence(points, profile?.calorie_target ?? null, "calories");
  const proAdh = adherence(points, profile?.protein_target ?? null, "protein");

  const weekly = useMemo(() => buildReport(all.slice(-7), "This week", {
    calories: profile?.calorie_target, protein: profile?.protein_target,
  }), [all, profile]);
  const monthly = useMemo(() => buildReport(all.slice(-30), "Last 30 days", {
    calories: profile?.calorie_target, protein: profile?.protein_target,
  }), [all, profile]);

  const downloadCSV = () => {
    const blob = new Blob([toCSV(points)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nutrimind-${days}d-${dateKeyOf(new Date(), tz)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="print:block">
        <div className="flex items-center gap-2 text-xs text-primary">
          <LineIcon className="h-3 w-3" /> Intelligence &amp; analytics
        </div>
        <h1 className="mt-1 font-display text-3xl font-bold">Insights</h1>
        <p className="text-sm text-muted-foreground">
          Every chart here is computed from your own logs — no AI guesses. Trends are shown as ranges, and
          patterns describe what happened together, never what caused what.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div role="tablist" aria-label="Time range" className="flex gap-1 rounded-full bg-muted p-1">
          {RANGES.map((r) => (
            <button
              key={r.days}
              role="tab"
              aria-selected={days === r.days}
              onClick={() => setDays(r.days)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                days === r.days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={downloadCSV}
            className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs"
          >
            <Printer className="h-3.5 w-3.5" /> Export PDF
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="glass rounded-3xl p-12 text-center text-sm text-muted-foreground">Loading your history…</div>
      )}

      {!isLoading && (
        <>
          {/* Trend detection + adherence summary */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="glass-strong rounded-3xl p-5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <TrendingUp className="h-4 w-4 text-primary" /> Body-weight trend
              </div>
              {weightTrend ? (
                <>
                  <div className="mt-2 font-display text-2xl text-gradient">
                    {weightTrend.slopePerWeek > 0 ? "+" : ""}{weightTrend.slopePerWeek.toFixed(2)} kg/week
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Likely range {weightTrend.lowPerWeek.toFixed(2)} to {weightTrend.highPerWeek.toFixed(2)} kg/week ·
                    {" "}confidence {weightTrend.confidence} ({weightTrend.n} weigh-ins)
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    This is a fitted line through your weigh-ins, not a prediction of a date or an outcome. Day-to-day
                    weight moves with water, food volume and sleep.
                  </p>
                </>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Log at least three weigh-ins in this range and a trend with an uncertainty band appears here.
                </p>
              )}
            </div>

            <div className="glass-strong rounded-3xl p-5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-accent" /> Adherence
              </div>
              <dl className="mt-3 space-y-2 text-xs">
                <Row label="Calories within ±15% of target" value={calAdh ? `${calAdh.pct}%` : "Set a calorie target"} sub={calAdh ? `${calAdh.loggedDays}/${calAdh.totalDays} days logged` : undefined} />
                <Row label="Protein within ±15% of target" value={proAdh ? `${proAdh.pct}%` : "Set a protein target"} sub={proAdh ? `${proAdh.loggedDays}/${proAdh.totalDays} days logged` : undefined} />
                <Row label="Days with any log" value={`${points.filter((p) => p.meals > 0 || p.sessions > 0 || p.water_ml).length}/${points.length}`} />
              </dl>
            </div>
          </section>

          {/* Charts */}
          <section className="grid gap-4 md:grid-cols-2">
            <InsightChart
              title="Weight" unit="kg" kind="line" data={weightSeries}
              confidence={weightTrend?.confidence ?? "insufficient data"}
              note="Solid line is each weigh-in; dashed line is a 7-day rolling average, which is the more reliable signal."
              emptyHint="No weigh-ins logged yet. Add one from Today → Daily vitals."
            />
            <InsightChart
              title="Calories" unit="kcal per day" kind="bar" color="var(--accent)"
              data={calSeries} target={profile?.calorie_target ?? null}
              targetLabel={profile?.calorie_target ? `${profile.calorie_target} kcal target` : undefined}
              note="Only days with logged meals are counted. Missing bars mean no log, not zero intake."
              emptyHint="No meals logged in this range."
            />
            <InsightChart
              title="Protein" unit="g per day" kind="bar"
              data={rolling(points, "protein", 7)} target={profile?.protein_target ?? null}
              targetLabel={profile?.protein_target ? `${profile.protein_target} g target` : undefined}
              emptyHint="No meals logged in this range."
            />
            <InsightChart
              title="Carbs, fat &amp; fiber balance" unit="g fiber per day" kind="area" color="var(--accent)"
              data={rolling(points, "fiber", 7)} target={profile?.fiber_target ?? null}
              targetLabel={profile?.fiber_target ? `${profile.fiber_target} g fiber target` : undefined}
              note="Fiber is shown as the balance marker because it is the macro most often under-hit."
              emptyHint="No meals logged in this range."
            />
            <InsightChart
              title="Hydration" unit="ml per day" kind="area"
              data={rolling(points, "water_ml", 7)}
              emptyHint="No water logged yet."
            />
            <InsightChart
              title="Sleep" unit="hours per night" kind="line" color="var(--accent)"
              data={rolling(points, "sleep_hours", 7)} target={7} targetLabel="7h general guidance"
              note="General adult guidance is 7–9h. Individual needs vary, and this is not a medical assessment."
              emptyHint="No sleep logged yet."
            />
            <InsightChart
              title="Training load" unit="duration × effort (sRPE units)" kind="bar"
              data={rolling(points, "load", 7)}
              note="Load = session minutes × perceived effort. Sharp jumps are worth easing; this is a general training principle, not a personal prediction."
              emptyHint="No completed sessions logged in this range."
            />
            <InsightChart
              title="Readiness" unit="score 0–100" kind="line"
              data={rolling(points, "readiness", 7)}
              emptyHint="Readiness appears once you log sleep, soreness and mood."
            />
            <InsightChart
              title="Recovery signals" unit="soreness 1–10 (lower is better)" kind="line" color="var(--accent)"
              data={rolling(points, "soreness", 7)}
              emptyHint="No soreness ratings logged yet."
            />
            <InsightChart
              title="Consistency" unit="meals + sessions logged per day" kind="bar"
              data={points.map((p) => ({ day: p.day, value: p.meals + p.sessions }))}
              emptyHint="Nothing logged in this range yet."
            />
          </section>

          {/* Patterns */}
          <section className="glass rounded-3xl p-5">
            <h2 className="font-display text-lg font-bold">Patterns detected</h2>
            <p className="text-xs text-muted-foreground">
              These are observed associations in your own data. They do not establish cause and effect.
            </p>
            <ul className="mt-3 space-y-2">
              {patterns.length === 0 && <li className="text-sm text-muted-foreground">Not enough data yet.</li>}
              {patterns.map((p, i) => (
                <li key={i} className={`rounded-2xl border p-3 text-xs ${
                  p.tone === "good" ? "border-primary/30 bg-primary/5"
                    : p.tone === "watch" ? "border-warning/30 bg-warning/5" : "border-border/60"
                }`}>
                  <div className="font-semibold">{p.title}</div>
                  <div className="mt-0.5 text-muted-foreground">{p.detail}</div>
                </li>
              ))}
            </ul>
          </section>

          {/* Scenario simulation */}
          <Scenario points={points} target={profile?.calorie_target ?? null} />

          {/* Reports */}
          <section className="grid gap-4 md:grid-cols-2">
            <ReportCard report={weekly} />
            <ReportCard report={monthly} />
          </section>

          <p className="flex items-start gap-2 rounded-2xl border border-border/60 p-4 text-[11px] text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            Analytics here describe your logs. They are not a medical assessment and do not diagnose anything. If you
            have pain, unusual fatigue or concerning symptoms, speak with a qualified professional.
          </p>
        </>
      )}
    </div>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">
        <div className="font-mono">{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
      </dd>
    </div>
  );
}

/** Simple, transparent what-if. Arithmetic only — shown with its own assumptions. */
function Scenario({ points, target }: { points: DayPoint[]; target: number | null }) {
  const [delta, setDelta] = useState(0);
  const avgCal = mean(points.map((p) => p.calories));
  const base = avgCal ?? target ?? 0;
  const weeklyEnergy = delta * 7;
  const kgPerWeek = weeklyEnergy / 7700; // ~7700 kcal per kg of body mass, a population average

  return (
    <section className="glass rounded-3xl p-5">
      <h2 className="font-display text-lg font-bold">Scenario simulation</h2>
      <p className="text-xs text-muted-foreground">
        A transparent arithmetic estimate, not a prediction. It assumes your activity, logging accuracy and
        adherence stay the same, which rarely holds exactly.
      </p>
      <label htmlFor="delta" className="mt-4 block text-xs font-medium">
        Change average daily intake by {delta > 0 ? "+" : ""}{delta} kcal
      </label>
      <input
        id="delta" type="range" min={-500} max={500} step={50} value={delta}
        onChange={(e) => setDelta(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--primary)]"
      />
      <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs">
        <Stat label="New daily average" value={`${Math.round(base + delta)} kcal`} />
        <Stat label="Estimated weight change" value={`${kgPerWeek > 0 ? "+" : ""}${kgPerWeek.toFixed(2)} kg/week`} />
        <Stat label="Plausible range" value={`${(kgPerWeek * 0.6).toFixed(2)} to ${(kgPerWeek * 1.4).toFixed(2)} kg/week`} />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Based on the ~7,700 kcal per kg population average. Do not use this to set aggressive deficits — teenagers and
        athletes in particular should keep changes small and supervised.
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-lg">{value}</div>
    </div>
  );
}

function ReportCard({ report }: { report: ReturnType<typeof buildReport> }) {
  return (
    <article className="glass-strong rounded-3xl p-5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <FileText className="h-4 w-4 text-primary" /> {report.label}
      </div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {report.from} → {report.to} · {report.daysLogged}/{report.totalDays} days with data
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <Stat label="Avg kcal" value={report.avg.calories ? String(Math.round(report.avg.calories)) : "—"} />
        <Stat label="Avg protein" value={report.avg.protein ? `${Math.round(report.avg.protein)} g` : "—"} />
        <Stat label="Avg sleep" value={report.avg.sleep_hours ? `${report.avg.sleep_hours.toFixed(1)} h` : "—"} />
        <Stat label="Avg water" value={report.avg.water_ml ? `${Math.round(report.avg.water_ml)} ml` : "—"} />
        <Stat label="Sessions" value={String(report.sessions)} />
        <Stat label="Weight change" value={report.weightChange == null ? "—" : `${report.weightChange > 0 ? "+" : ""}${report.weightChange.toFixed(1)} kg`} />
      </dl>

      <div className="mt-4 space-y-3 text-xs">
        <div>
          <div className="font-semibold text-primary">What went well</div>
          <ul className="mt-1 space-y-1 text-muted-foreground">
            {report.positives.length ? report.positives.map((p, i) => <li key={i}>• {p}</li>) : <li>• Not enough data yet.</li>}
          </ul>
        </div>
        <div>
          <div className="font-semibold text-warning">Where it was harder</div>
          <ul className="mt-1 space-y-1 text-muted-foreground">
            {report.difficulties.length ? report.difficulties.map((p, i) => <li key={i}>• {p}</li>) : <li>• Nothing flagged.</li>}
          </ul>
        </div>
        <p className="rounded-2xl border border-primary/25 bg-primary/5 p-3 text-muted-foreground">{report.nextFocus}</p>
      </div>
    </article>
  );
}
