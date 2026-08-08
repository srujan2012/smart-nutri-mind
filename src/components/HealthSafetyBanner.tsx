import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSafetyStatus } from "@/lib/health.functions";
import { LEVEL_LABEL, REVIEW_LINE, SAFE_FALLBACK_PLAN, type AlertLevel } from "@/lib/health-rules";
import { AlertTriangle, Info, ShieldAlert, ShieldCheck, CalendarClock } from "lucide-react";
import { Link } from "@tanstack/react-router";

const tone: Record<AlertLevel, { ring: string; text: string; icon: typeof Info }> = {
  information: { ring: "border-primary/30 bg-primary/5", text: "text-primary", icon: Info },
  caution: { ring: "border-warning/40 bg-warning/5", text: "text-warning", icon: AlertTriangle },
  urgent: {
    ring: "border-destructive/50 bg-destructive/5",
    text: "text-destructive",
    icon: ShieldAlert,
  },
};

/**
 * Calm, non-alarmist safety banner + unsafe-plan blocker.
 * `context` decides which recommendations get paused on this page.
 */
export function HealthSafetyBanner({ context = "all" }: { context?: "diet" | "training" | "all" }) {
  const fetchStatus = useServerFn(getSafetyStatus);
  const { data } = useQuery({
    queryKey: ["safety-status"],
    queryFn: () => fetchStatus({ data: undefined as never }),
    staleTime: 60_000,
  });

  if (!data) return null;

  const relevant = data.flags.filter((f) =>
    context === "diet"
      ? f.blocks_diet || f.level !== "information"
      : context === "training"
        ? f.blocks_training || f.level !== "information"
        : true,
  );

  const paused =
    (context === "diet" && data.blocks_diet) ||
    (context === "training" && data.blocks_training) ||
    (context === "all" && (data.blocks_diet || data.blocks_training));

  const pending = data.pending_requirement;
  if (relevant.length === 0 && !pending) return null;

  const t = tone[data.level];
  const Icon = t.icon;

  return (
    <div className="space-y-3">
      {pending && (
        <div className="glass rounded-3xl border border-accent/40 bg-accent/5 p-4" role="status">
          <div className="flex items-center gap-2 text-sm font-semibold text-accent">
            <CalendarClock className="h-4 w-4" />
            {pending.days_left === 1
              ? "Report review is due tomorrow."
              : pending.days_left !== null && pending.days_left <= 0
                ? `Report review for ${pending.program} is due today.`
                : `Report for ${pending.program} due in ${pending.days_left} day${pending.days_left === 1 ? "" : "s"}`}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {pending.program} ({pending.region}) needs a health report before the specialised plan
            unlocks. General wellness guidance stays available in the meantime.{" "}
            <Link to="/health" className="text-primary hover:underline">
              Upload report →
            </Link>
          </p>
        </div>
      )}

      {relevant.length > 0 && (
        <div className={`glass rounded-3xl border p-4 ${t.ring}`} role="alert" aria-live="polite">
          <div className={`flex items-center gap-2 text-sm font-semibold ${t.text}`}>
            <Icon className="h-4 w-4" aria-hidden />
            {LEVEL_LABEL[data.level]} · health safety
          </div>
          <ul className="mt-2 space-y-2">
            {relevant.slice(0, 4).map((f, i) => (
              <li key={f.id ?? i} className="text-xs">
                <span className="font-semibold">{f.title}</span>
                <span className="text-muted-foreground"> — {f.message}</span>
              </li>
            ))}
          </ul>
          {paused && (
            <div className="mt-3 rounded-2xl border border-border/60 bg-background/40 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <ShieldCheck className="h-4 w-4 text-primary" /> Personalised{" "}
                {context === "training"
                  ? "training"
                  : context === "diet"
                    ? "diet"
                    : "diet and training"}{" "}
                recommendations are paused
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{REVIEW_LINE}</p>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                {context !== "training" && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Safer general eating
                    </div>
                    <ul className="mt-1 space-y-1 text-[11px] text-muted-foreground">
                      {SAFE_FALLBACK_PLAN.diet.map((d) => (
                        <li key={d}>· {d}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {context !== "diet" && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Safer general movement
                    </div>
                    <ul className="mt-1 space-y-1 text-[11px] text-muted-foreground">
                      {SAFE_FALLBACK_PLAN.training.map((d) => (
                        <li key={d}>· {d}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="mt-3 text-[10px] text-muted-foreground">
            This app does not diagnose disease and is not a substitute for a doctor, sports
            physician or physiotherapist.{" "}
            <Link to="/health" className="text-primary hover:underline">
              Open health &amp; safety →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
