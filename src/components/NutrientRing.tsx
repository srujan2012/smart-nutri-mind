interface RingProps {
  value: number;
  target: number;
  label: string;
  unit: string;
  color?: "primary" | "accent" | "warning" | "destructive";
  size?: number;
}

const colorMap = {
  primary: "var(--primary)",
  accent: "var(--accent)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
};

export function NutrientRing({
  value,
  target,
  label,
  unit,
  color = "primary",
  size = 140,
}: RingProps) {
  const stroke = colorMap[color];
  const pct = Math.min(1, target > 0 ? value / target : 0);
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);

  const status =
    pct < 0.6 ? "Low" : pct < 0.95 ? "On track" : pct < 1.1 ? "Optimal" : "High";
  const statusColor =
    pct < 0.6 ? "text-warning" : pct >= 1.1 ? "text-destructive" : "text-primary";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--border)"
            strokeWidth={10}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{
              filter: `drop-shadow(0 0 8px ${stroke})`,
              transition: "stroke-dashoffset 900ms cubic-bezier(.2,.9,.3,1)",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-bold">{Math.round(value)}</span>
          <span className="text-[10px] text-muted-foreground">
            /{Math.round(target)}
            {unit}
          </span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
        <div className={`text-xs font-medium ${statusColor}`}>{status}</div>
      </div>
    </div>
  );
}
