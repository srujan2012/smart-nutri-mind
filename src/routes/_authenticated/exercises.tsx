import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, ShieldAlert, Play, Repeat, Timer, Dumbbell, ChevronDown, BadgeCheck, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/exercises")({
  head: () => ({
    meta: [
      { title: "Exercise library — NutriMind AI" },
      { name: "description", content: "Search verified exercises with instructions, safety cues, muscle groups, equipment, alternatives and contraindication notes." },
      { property: "og:title", content: "Exercise library — NutriMind AI" },
      { property: "og:description", content: "Verified exercises with instructions, safety cues, equipment, difficulty, alternatives and contraindications." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExercisesPage,
});

const CATEGORIES = ["all", "strength", "endurance", "mobility", "flexibility", "stability", "balance", "speed", "power", "recovery"];
const LEVELS = ["all", "beginner", "intermediate", "advanced"];
const SETTINGS = ["all", "home", "gym"];

const chip = "rounded-full border px-3 py-1.5 text-xs capitalize transition-colors";

function ExercisesPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [level, setLevel] = useState("all");
  const [place, setPlace] = useState("all");
  const [noEquipOnly, setNoEquipOnly] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const { data: exercises, isLoading } = useQuery({
    queryKey: ["exercises"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exercises").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (exercises ?? []).filter((e) => {
      if (cat !== "all" && e.category !== cat) return false;
      if (level !== "all" && e.difficulty !== level) return false;
      if (place !== "all" && e.setting !== place) return false;
      const eq = (e.equipment ?? []) as string[];
      if (noEquipOnly && eq.length > 0 && !eq.includes("none")) return false;
      if (!term) return true;
      return (
        e.name.toLowerCase().includes(term) ||
        ((e.muscle_groups ?? []) as string[]).some((m) => m.toLowerCase().includes(term)) ||
        eq.some((m) => m.toLowerCase().includes(term)) ||
        ((e.sports ?? []) as string[]).some((m) => m.toLowerCase().includes(term))
      );
    });
  }, [exercises, q, cat, level, place, noEquipOnly]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <div className="flex items-center gap-2 text-xs text-primary">
          <Dumbbell className="h-3 w-3" /> Exercise library
        </div>
        <h1 className="font-display text-2xl font-bold">Every movement, explained</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Instructions, safety cues, alternatives and contraindications — each entry shows where the guidance comes from.
        </p>
      </header>

      <section className="glass-strong space-y-3 rounded-3xl p-4">
        <label className="flex items-center gap-2 rounded-2xl border border-border bg-input/40 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            className="w-full bg-transparent text-sm outline-none"
            placeholder="Search by name, muscle, equipment or sport…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search exercises"
          />
        </label>

        <FilterRow label="Type" value={cat} setValue={setCat} options={CATEGORIES} />
        <FilterRow label="Level" value={level} setValue={setLevel} options={LEVELS} />
        <FilterRow label="Where" value={place} setValue={setPlace} options={SETTINGS} />

        <button
          onClick={() => setNoEquipOnly((v) => !v)}
          aria-pressed={noEquipOnly}
          className={`${chip} ${noEquipOnly ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}
        >
          No equipment needed
        </button>
      </section>

      <p className="text-xs text-muted-foreground">
        {isLoading ? "Loading…" : `${filtered.length} exercise${filtered.length === 1 ? "" : "s"}`} · this library is
        built to grow — it is not a complete catalogue of every exercise that exists.
      </p>

      <ul className="space-y-3">
        {filtered.map((e) => {
          const isOpen = open === e.id;
          return (
            <li key={e.id} className="glass rounded-3xl">
              <button
                onClick={() => setOpen(isOpen ? null : e.id)}
                aria-expanded={isOpen}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 text-left"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{e.name}</span>
                    {e.verified && (
                      <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
                        <BadgeCheck className="h-3 w-3" /> verified
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="capitalize">{e.category}</span>
                    <span>· {e.difficulty}</span>
                    <span>· {((e.equipment ?? []) as string[]).join(", ") || "no equipment"}</span>
                    {e.duration_sec ? (
                      <span className="flex items-center gap-1"><Timer className="h-3 w-3" />{Math.round(e.duration_sec / 60) || 1}m</span>
                    ) : e.default_reps ? (
                      <span className="flex items-center gap-1"><Repeat className="h-3 w-3" />{e.default_sets}×{e.default_reps}</span>
                    ) : null}
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && (
                <div className="space-y-4 border-t border-border/60 px-4 pb-5 pt-4 text-sm">
                  <Block title="How to do it">
                    <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                      {((e.instructions ?? []) as string[]).map((s, i) => <li key={i}>{s}</li>)}
                    </ol>
                  </Block>

                  <Block title="Safety cues">
                    <ul className="space-y-1 text-muted-foreground">
                      {((e.safety_cues ?? []) as string[]).map((s, i) => (
                        <li key={i} className="flex gap-2"><span className="text-primary">•</span>{s}</li>
                      ))}
                    </ul>
                  </Block>

                  {((e.contraindications ?? []) as string[]).length > 0 && (
                    <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3">
                      <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-destructive">
                        <ShieldAlert className="h-3.5 w-3.5" /> Skip or get clearance first if you have
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {((e.contraindications ?? []) as string[]).join(" · ")}
                      </p>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        General guidance only — not medical advice. Check with a clinician if you're unsure.
                      </p>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-3">
                    <TagList title="Muscles" items={(e.muscle_groups ?? []) as string[]} />
                    <TagList title="Alternatives" items={(e.alternatives ?? []) as string[]} />
                    <TagList title="Sports" items={(e.sports ?? []) as string[]} />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <StepList icon={<ArrowUpRight className="h-3.5 w-3.5 text-primary" />} title="Harder" items={(e.progressions ?? []) as string[]} />
                    <StepList icon={<ArrowDownRight className="h-3.5 w-3.5 text-accent" />} title="Easier" items={(e.regressions ?? []) as string[]} />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
                    <span>Source: {e.data_source}</span>
                    <span>· Confidence: {e.confidence}</span>
                    {e.source_url && (
                      <a href={e.source_url} target="_blank" rel="noreferrer" className="text-primary underline">
                        reference
                      </a>
                    )}
                    <span className="flex items-center gap-1">
                      <Play className="h-3 w-3" />
                      {e.video_url ? (
                        <a href={e.video_url} target="_blank" rel="noreferrer" className="text-primary underline">watch</a>
                      ) : (
                        "Video placeholder — a licensed demo clip will sit here once a verified video source is connected."
                      )}
                    </span>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {!isLoading && filtered.length === 0 && (
        <div className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">
          Nothing matches those filters yet.
        </div>
      )}
    </div>
  );
}

function FilterRow({ label, value, setValue, options }: { label: string; value: string; setValue: (v: string) => void; options: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => setValue(o)}
          aria-pressed={value === o}
          className={`${chip} ${value === o ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function TagList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide">{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((m) => (
          <span key={m} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{m}</span>
        ))}
      </div>
    </div>
  );
}

function StepList({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border/60 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold">{icon}{title}</div>
      <p className="text-xs text-muted-foreground">{items.join(" · ")}</p>
    </div>
  );
}
