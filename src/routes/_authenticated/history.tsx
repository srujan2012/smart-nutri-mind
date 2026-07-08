import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Flame, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/history")({
  component: History,
});

type MealRow = {
  id: string;
  name: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  meal_score: number | null;
  consumed_at: string;
};

function History() {
  const { data: meals = [] } = useQuery({
    queryKey: ["meals-history"],
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const { data } = await supabase
        .from("meals")
        .select("id,name,calories,protein,carbs,fat,fiber,meal_score,consumed_at")
        .gte("consumed_at", cutoff.toISOString())
        .order("consumed_at", { ascending: false });
      return (data ?? []) as MealRow[];
    },
  });

  const days = new Map<string, MealRow[]>();
  for (const m of meals) {
    const d = new Date(m.consumed_at);
    const key = d.toISOString().slice(0, 10);
    if (!days.has(key)) days.set(key, []);
    days.get(key)!.push(m);
  }
  const sorted = Array.from(days.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-primary">
          <Calendar className="h-3 w-3" /> Rolling 30-day log
        </div>
        <h1 className="mt-1 font-display text-3xl font-bold">Daily log history</h1>
        <p className="text-sm text-muted-foreground">
          Each day auto-saves and rolls to a new log at midnight. Nothing is lost.
        </p>
      </div>

      {sorted.length === 0 && (
        <div className="glass rounded-3xl p-16 text-center text-sm text-muted-foreground">
          No meals logged in the last 30 days.
        </div>
      )}

      {sorted.map(([day, rows]) => {
        const totals = rows.reduce(
          (a, m) => ({
            calories: a.calories + Number(m.calories ?? 0),
            protein: a.protein + Number(m.protein ?? 0),
            carbs: a.carbs + Number(m.carbs ?? 0),
            fat: a.fat + Number(m.fat ?? 0),
            fiber: a.fiber + Number(m.fiber ?? 0),
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
        );
        const avg = Math.round(rows.reduce((a, m) => a + (m.meal_score ?? 0), 0) / rows.length);
        const label = new Date(day).toLocaleDateString(undefined, {
          weekday: "long", month: "short", day: "numeric",
        });
        return (
          <div key={day} className="glass rounded-3xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="font-display text-lg font-bold">{label}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {day === todayKey ? "Today (live)" : "Saved log"} · {rows.length} meals
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase text-muted-foreground">Avg score</div>
                <div className="font-display text-2xl text-gradient">{avg || "—"}</div>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2 rounded-2xl bg-background/40 p-3 text-center text-xs">
              {[
                { l: "kcal", v: totals.calories },
                { l: "P", v: totals.protein },
                { l: "C", v: totals.carbs },
                { l: "F", v: totals.fat },
                { l: "Fib", v: totals.fiber },
              ].map((s) => (
                <div key={s.l}>
                  <div className="font-display text-base">{Math.round(s.v)}</div>
                  <div className="text-[9px] text-muted-foreground">{s.l}</div>
                </div>
              ))}
            </div>
            <ul className="mt-3 space-y-1.5 text-xs">
              {rows.map((m) => (
                <li key={m.id} className="flex items-center justify-between border-b border-border/40 pb-1 last:border-0">
                  <div className="min-w-0 truncate">
                    <Flame className="mr-1 inline h-3 w-3 text-primary" />
                    {m.name}
                  </div>
                  <div className="ml-2 shrink-0 font-mono text-muted-foreground">
                    {Math.round(Number(m.calories))} kcal ·{" "}
                    {new Date(m.consumed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <Link
        to="/dashboard"
        className="flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm"
      >
        <TrendingUp className="h-4 w-4" /> Back to today
      </Link>
    </div>
  );
}
