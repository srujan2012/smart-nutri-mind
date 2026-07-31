import { useMemo } from "react";
import { estimateTrend, celebrate, type TrendPoint } from "@/lib/training-logic";
import { TrendingUp, Info, Sparkles, Activity } from "lucide-react";

interface Props {
  weighIns: TrendPoint[];
  sessionsThisWeek: number;
  streakDays: number;
  goal: string | null | undefined;
  age: number | null | undefined;
}

export function ProgressTrend({ weighIns, sessionsThisWeek, streakDays, goal, age }: Props) {
  const trend = useMemo(() => estimateTrend(weighIns), [weighIns]);
  const youth = Number(age ?? 99) < 18;

  return (
    <section className="space-y-4">
      <div className="glass-strong rounded-3xl p-5">
        <div className="flex items-center gap-2 text-xs text-primary">
          <Sparkles className="h-3 w-3" /> Progress
        </div>
        <p className="mt-2 text-sm">{celebrate({ sessionsThisWeek, streakDays, trend, goal })}</p>
      </div>

      <div className="glass rounded-3xl p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <TrendingUp className="h-4 w-4 text-primary" /> Body-weight trend
        </div>

        {!trend ? (
          <p className="text-sm text-muted-foreground">
            Log at least three weigh-ins and a trend line will appear here — shown as a range, because weight moves
            day to day for reasons that have nothing to do with your training.
          </p>
        ) : (
          <>
            <Sparkline points={trend.points} />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat label="Trend" value={`${trend.slope_kg_per_week > 0 ? "+" : ""}${trend.slope_kg_per_week.toFixed(2)} kg/wk`} />
              <Stat label="Likely range" value={`${trend.low_kg_per_week.toFixed(2)} to ${trend.high_kg_per_week.toFixed(2)}`} />
              <Stat label="Confidence" value={trend.confidence} />
            </div>
            <div className="mt-3 rounded-2xl border border-primary/25 bg-primary/5 p-4">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-primary">
                <Info className="h-3.5 w-3.5" /> How to read this
              </div>
              <p className="text-sm text-muted-foreground">{trend.explanation}</p>
            </div>
          </>
        )}
      </div>

      <div className="glass rounded-3xl p-5">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Activity className="h-4 w-4 text-accent" /> If your measurements are changing
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Keep resistance training 2–4×/week — retaining muscle protects strength and daily function as weight moves.</li>
          <li>• Spend a few minutes daily on mobility for hips, ankles and thoracic spine; stiffness, not weakness, is what usually limits movement.</li>
          <li>• Work posture directly: rows, face pulls and loaded carries balance out long hours seated.</li>
          <li>• For skin health, the evidence supports sleep, hydration, adequate protein, sun protection and not smoking. No exercise or plan can promise skin tightening — that varies with genetics, age and how much and how fast weight changes.</li>
        </ul>
      </div>

      {youth && (
        <div className="glass rounded-3xl p-5">
          <div className="mb-2 text-sm font-semibold">Growing and developing well</div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Sleep is the single biggest lever — 8–10 hours nightly, on a consistent schedule.</li>
            <li>• Eat enough. Under-eating during growth years costs energy, mood, bone health and performance.</li>
            <li>• Train for skill, technique and enjoyment; keep loads submaximal and vary your activities.</li>
            <li>• Posture and mobility work help you stand and move tall and comfortably.</li>
            <li>• Honest note: height is set by genetics and overall health during growth. No exercise, stretch, or supplement can increase it, and anything claiming otherwise is selling something.</li>
          </ul>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-display text-lg font-bold capitalize">{value}</div>
    </div>
  );
}

function Sparkline({ points }: { points: TrendPoint[] }) {
  const w = 640;
  const h = 140;
  const pad = 8;
  const ys = points.map((p) => p.weight);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => [pad + i * step, h - pad - ((p.weight - min) / span) * (h - pad * 2)] as const);
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${h - pad} L${coords[0][0].toFixed(1)},${h - pad} Z`;

  return (
    <figure>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-36 w-full"
        role="img"
        aria-label={`Body weight from ${points[0].weight} kg to ${points[points.length - 1].weight} kg over ${points.length} weigh-ins`}
      >
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#trendFill)" />
        <path d={line} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3" fill="hsl(var(--primary))" />
        ))}
      </svg>
      <figcaption className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{points[0].date} · {min.toFixed(1)} kg low</span>
        <span>{points[points.length - 1].date} · {max.toFixed(1)} kg high</span>
      </figcaption>
    </figure>
  );
}
