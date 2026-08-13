import { useId } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Info } from "lucide-react";

export type Series = { day: string; value: number | null; avg?: number | null };

interface Props {
  title: string;
  unit: string;
  data: Series[];
  kind?: "line" | "area" | "bar";
  color?: string;
  target?: number | null;
  targetLabel?: string;
  confidence?: string | null;
  note?: string;
  emptyHint?: string;
}

const short = (d: string) => d.slice(5).replace("-", "/");

export function InsightChart({
  title, unit, data, kind = "line", color = "hsl(var(--primary))",
  target, targetLabel, confidence, note, emptyHint,
}: Props) {
  const id = useId();
  const hasData = data.some((d) => typeof d.value === "number");
  const labelledBy = `${id}-title`;

  return (
    <figure className="glass rounded-3xl p-4 sm:p-5" role="group" aria-labelledby={labelledBy}>
      <figcaption className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id={labelledBy} className="font-display text-sm font-semibold">{title}</h3>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{unit}</p>
        </div>
        {confidence && (
          <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            Confidence: {confidence}
          </span>
        )}
      </figcaption>

      {!hasData ? (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border/70 px-4 text-center text-xs text-muted-foreground">
          {emptyHint ?? "No data logged for this range yet."}
        </div>
      ) : (
        <div className="h-44 w-full" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            {kind === "bar" ? (
              <BarChart data={data} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" tickFormatter={short} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" minTickGap={18} />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => String(l)} />
                {target ? <ReferenceLine y={target} stroke="hsl(var(--accent))" strokeDasharray="4 4" /> : null}
                <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : kind === "area" ? (
              <AreaChart data={data} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" tickFormatter={short} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" minTickGap={18} />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={tooltipStyle} />
                {target ? <ReferenceLine y={target} stroke="hsl(var(--accent))" strokeDasharray="4 4" /> : null}
                <Area type="monotone" dataKey="value" stroke={color} fill={`url(#g${id})`} connectNulls />
              </AreaChart>
            ) : (
              <LineChart data={data} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" tickFormatter={short} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" minTickGap={18} />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={["auto", "auto"]} />
                <Tooltip contentStyle={tooltipStyle} />
                {target ? <ReferenceLine y={target} stroke="hsl(var(--accent))" strokeDasharray="4 4" /> : null}
                <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="avg" stroke="hsl(var(--accent))" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {/* Screen-reader equivalent of the chart */}
      <p className="sr-only">
        {title}. {hasData
          ? data.filter((d) => typeof d.value === "number").map((d) => `${d.day}: ${d.value} ${unit}`).join(". ")
          : "No data."}
      </p>

      {targetLabel && (
        <p className="mt-2 text-[11px] text-accent">Dashed line: {targetLabel}</p>
      )}
      {note && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" /> {note}
        </p>
      )}
    </figure>
  );
}

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 12,
  fontSize: 12,
  color: "hsl(var(--popover-foreground))",
} as const;
