import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { recalibrateTargets, type RecalibrationResult } from "@/lib/adaptive.functions";
import { supabase } from "@/integrations/supabase/client";
import { Gauge, TrendingUp, ShieldAlert, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function AdaptiveTargets() {
  const qc = useQueryClient();
  const run = useServerFn(recalibrateTargets);

  const { data: history } = useQuery({
    queryKey: ["plan-adjustments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("plan_adjustments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  const mutation = useMutation({
    mutationFn: async () => (await run({})) as RecalibrationResult,
    onSuccess: (r) => {
      toast[r.applied ? "success" : "info"](
        r.applied ? `Targets updated to ${r.new_calories} kcal` : "No change needed",
      );
      qc.invalidateQueries({ queryKey: ["plan-adjustments"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not recalibrate"),
  });

  const latest = mutation.data ?? null;
  const last = history?.[0];

  return (
    <section className="glass-strong rounded-3xl p-5" aria-labelledby="adaptive-heading">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-primary">
            <Gauge className="h-3.5 w-3.5" /> Adaptive targets
          </div>
          <h2 id="adaptive-heading" className="font-display text-lg font-semibold">
            Tune my calories &amp; protein
          </h2>
          <p className="text-xs text-muted-foreground">
            Uses your last 14 days of logs and weigh-ins. Moves by at most 5% at a time, and never below safe floors.
          </p>
        </div>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground glow-neon disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${mutation.isPending ? "animate-spin" : ""}`} />
          {mutation.isPending ? "Checking…" : "Recalibrate"}
        </button>
      </div>

      {latest && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2 font-mono text-xs">
            <span className="rounded-full bg-background/50 px-3 py-1">
              {latest.old_calories} → <span className="text-primary">{latest.new_calories}</span> kcal
            </span>
            <span className="rounded-full bg-background/50 px-3 py-1">
              protein {latest.old_protein} → <span className="text-accent">{latest.new_protein}</span> g
            </span>
            {latest.adherence_pct !== null && (
              <span className="rounded-full bg-background/50 px-3 py-1">adherence {latest.adherence_pct}%</span>
            )}
            {latest.trend_kg_per_week !== null && (
              <span className="flex items-center gap-1 rounded-full bg-background/50 px-3 py-1">
                <TrendingUp className="h-3 w-3" />
                {latest.trend_kg_per_week > 0 ? "+" : ""}
                {latest.trend_kg_per_week.toFixed(2)} kg/wk
              </span>
            )}
          </div>
          <p className="rounded-2xl bg-background/40 p-3 text-xs text-muted-foreground">
            <span className="text-foreground">Why: </span>
            {latest.reason}
          </p>
          {latest.safety_note && (
            <p className="flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {latest.safety_note}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            Trends are estimates from your own logs, not predictions. Weight moves with hydration, salt and sleep too,
            so treat any weekly figure as a range rather than a promise.
          </p>
        </div>
      )}

      {!latest && last && (
        <p className="mt-4 rounded-2xl bg-background/40 p-3 text-xs text-muted-foreground">
          <span className="text-foreground">Last adjustment ({new Date(last.created_at).toLocaleDateString()}): </span>
          {last.reason}
        </p>
      )}
    </section>
  );
}
