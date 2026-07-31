import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Search, ScanBarcode, Plus, ShieldAlert, BadgeCheck, Info, Utensils, ShoppingCart,
  ChevronDown, Camera, Database, X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/foods")({
  head: () => ({
    meta: [
      { title: "Food database — NutriMind AI" },
      {
        name: "description",
        content:
          "Search Indian, regional, international, packaged and restaurant foods with macros, micronutrients, allergens and data-source confidence.",
      },
      { property: "og:title", content: "Food database — NutriMind AI" },
      {
        property: "og:description",
        content: "Search foods with macros, micronutrients, allergens and source confidence.",
      },
    ],
  }),
  component: FoodsPage,
});

const TYPES = ["all", "ingredient", "recipe", "packaged", "restaurant"] as const;
const DIETS = ["all", "vegetarian", "vegan", "eggetarian", "non-vegetarian", "jain", "gluten-free"] as const;

const field =
  "w-full rounded-2xl border border-border bg-input/40 px-4 py-3 text-sm focus:border-primary focus:outline-none";

type Food = {
  id: string;
  name: string;
  brand: string | null;
  food_type: string;
  category: string;
  cuisine: string | null;
  region: string | null;
  serving_desc: string;
  serving_grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  micros: Record<string, number> | unknown;
  allergens: string[];
  diet_tags: string[];
  ingredients: string[];
  recipe_steps: string[];
  est_cost: number | null;
  data_source: string;
  confidence: string;
  verified: boolean;
};

function ConfidenceBadge({ confidence, verified }: { confidence: string; verified: boolean }) {
  const tone =
    confidence === "high" ? "bg-primary/15 text-primary" : confidence === "medium" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest ${tone}`}>
      {verified && <BadgeCheck className="h-3 w-3" />} {confidence} confidence
    </span>
  );
}

function FoodsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("all");
  const [diet, setDiet] = useState<(typeof DIETS)[number]>("all");
  const [hideAllergens, setHideAllergens] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [servings, setServings] = useState<Record<string, number>>({});
  const [showAdd, setShowAdd] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return data;
    },
  });

  const { data: foods, isLoading } = useQuery({
    queryKey: ["foods", q, type, diet],
    queryFn: async () => {
      let query = supabase.from("foods").select("*").order("verified", { ascending: false }).limit(120);
      if (q.trim()) query = query.or(`name.ilike.%${q.trim()}%,brand.ilike.%${q.trim()}%,cuisine.ilike.%${q.trim()}%,category.ilike.%${q.trim()}%`);
      if (type !== "all") query = query.eq("food_type", type);
      if (diet !== "all") query = query.contains("diet_tags", [diet]);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Food[];
    },
  });

  const allergies = useMemo(() => (profile?.allergies ?? []) as string[], [profile]);

  const visible = useMemo(() => {
    if (!foods) return [];
    if (!hideAllergens || allergies.length === 0) return foods;
    return foods.filter((f) => !f.allergens.some((a) => allergies.includes(a)));
  }, [foods, hideAllergens, allergies]);

  const hiddenCount = (foods?.length ?? 0) - visible.length;

  const logFood = async (f: Food) => {
    const mult = servings[f.id] ?? 1;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (f.allergens.some((a) => allergies.includes(a))) {
      toast.error(`${f.name} contains one of your declared allergens — not logged.`);
      return;
    }
    const { error } = await supabase.from("meals").insert({
      user_id: u.user.id,
      name: `${f.name}${mult !== 1 ? ` ×${mult}` : ""}`,
      foods: [{ name: f.name, serving: f.serving_desc, servings: mult }],
      calories: f.calories * mult,
      protein: f.protein * mult,
      carbs: f.carbs * mult,
      fat: f.fat * mult,
      fiber: f.fiber * mult,
      micros: (f.micros ?? {}) as Record<string, number>,
      analysis: { logged_from: "food-database", data_source: f.data_source, confidence: f.confidence },
    });
    if (error) toast.error(error.message);
    else {
      toast.success(`Logged ${f.name} — ${Math.round(f.calories * mult)} kcal`);
      qc.invalidateQueries({ queryKey: ["meals-today"] });
    }
  };

  const addToGrocery = async (f: Food) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("grocery_items").insert({
      user_id: u.user.id,
      name: f.name,
      amount: f.serving_desc,
      reason: `From food database · ${f.category}`,
      source: "food-db",
      aisle: f.category,
    });
    if (error) toast.error(error.message);
    else toast.success(`${f.name} added to your grocery list`);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-primary">
            <Database className="h-3 w-3" /> Food intelligence
          </div>
          <h1 className="truncate font-display text-2xl font-bold">Food database</h1>
          <p className="text-xs text-muted-foreground">
            Indian, regional, international, packaged and restaurant foods — with sources and confidence.
          </p>
        </div>
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground glow-neon"
        >
          <Plus className="h-4 w-4" /> Add food
        </button>
      </header>

      {showAdd && <AddFoodForm onDone={() => { setShowAdd(false); qc.invalidateQueries({ queryKey: ["foods"] }); }} />}

      {/* Search + filters */}
      <div className="glass-strong space-y-3 rounded-3xl p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search dosa, paneer, biryani, oats, pizza…"
              aria-label="Search the food database"
              className={`${field} pl-11`}
            />
          </div>
          <button
            onClick={() => toast.info("Barcode scanning is not live yet — it needs a verified packaged-food barcode data source. Search by product name meanwhile.")}
            className="flex shrink-0 items-center gap-2 rounded-2xl border border-dashed border-border px-4 text-xs text-muted-foreground"
            title="Barcode scanning placeholder"
          >
            <ScanBarcode className="h-4 w-4" /> <span className="hidden sm:inline">Barcode</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded-full border px-3 py-1.5 text-xs capitalize transition ${
                type === t ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DIETS.map((d) => (
            <button
              key={d}
              onClick={() => setDiet(d)}
              className={`rounded-full border px-3 py-1.5 text-xs capitalize transition ${
                diet === d ? "border-accent bg-accent/15 text-accent" : "border-border text-muted-foreground"
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        {allergies.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={hideAllergens} onChange={(e) => setHideAllergens(e.target.checked)} />
            <ShieldAlert className="h-3.5 w-3.5 text-warning" />
            Hide foods containing my allergens ({allergies.join(", ")})
            {hiddenCount > 0 && <span className="text-warning">· {hiddenCount} hidden</span>}
          </label>
        )}

        <div className="flex items-start gap-2 rounded-2xl bg-background/40 p-3 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          This is a growing starter library, not every food that exists. Values come from IFCT 2017 (NIN/ICMR),
          USDA FoodData Central, product labels or recipe estimates — each entry shows its source and confidence.
          Restaurant and recipe entries vary by kitchen; verify when precision matters, and add your own foods.
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="glass rounded-3xl p-10 text-center text-sm text-muted-foreground">Searching…</div>
      ) : visible.length === 0 ? (
        <div className="glass rounded-3xl p-10 text-center">
          <div className="text-sm text-muted-foreground">No matches in the library yet.</div>
          <button onClick={() => setShowAdd(true)} className="mt-4 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
            Add it yourself
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((f) => {
            const open = openId === f.id;
            const mult = servings[f.id] ?? 1;
            const micros = (f.micros ?? {}) as Record<string, number>;
            return (
              <li key={f.id} className="glass rounded-2xl p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{f.name}</span>
                      {f.brand && <span className="text-xs text-muted-foreground">{f.brand}</span>}
                      <ConfidenceBadge confidence={f.confidence} verified={f.verified} />
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {f.serving_desc} · {f.food_type} · {f.category}
                      {f.cuisine ? ` · ${f.cuisine}` : ""}
                      {f.est_cost ? ` · ~${f.est_cost}` : ""}
                    </div>
                    <div className="mt-1 font-mono text-xs">
                      {Math.round(f.calories * mult)} kcal · P {Math.round(f.protein * mult)}g · C{" "}
                      {Math.round(f.carbs * mult)}g · F {Math.round(f.fat * mult)}g · Fib{" "}
                      {Math.round(f.fiber * mult)}g
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {f.diet_tags.slice(0, 4).map((t) => (
                        <span key={t} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{t}</span>
                      ))}
                      {f.allergens.map((a) => (
                        <span
                          key={a}
                          className={`rounded-full px-2 py-0.5 text-[10px] ${
                            allergies.includes(a) ? "bg-destructive/20 text-destructive" : "bg-warning/10 text-warning"
                          }`}
                        >
                          contains {a}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => setOpenId(open ? null : f.id)}
                    aria-expanded={open}
                    aria-label={`Details for ${f.name}`}
                    className="shrink-0 rounded-full border border-border p-2 text-muted-foreground"
                  >
                    <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
                  </button>
                </div>

                {open && (
                  <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
                    {Object.keys(micros).length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Key micronutrients (per serving)</div>
                        <ul className="mt-1 flex flex-wrap gap-2 text-xs">
                          {Object.entries(micros).map(([k, v]) => (
                            <li key={k} className="rounded-full bg-accent/10 px-2.5 py-1 text-accent">
                              {k.replace(/_/g, " ")}: {Number(v) * mult}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {f.ingredients.length > 0 && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Ingredients: </span>
                        {f.ingredients.join(", ")}
                      </div>
                    )}
                    {f.recipe_steps.length > 0 && (
                      <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                        {f.recipe_steps.map((s, i) => <li key={i}>{s}</li>)}
                      </ol>
                    )}
                    <div className="rounded-2xl bg-background/40 p-3 text-[11px] text-muted-foreground">
                      <span className="text-foreground">Source:</span> {f.data_source} · {f.confidence} confidence
                      {f.verified ? " · cross-checked against a reference table" : " · not independently verified"}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        Servings
                        <input
                          type="number"
                          min={0.25}
                          step={0.25}
                          value={mult}
                          onChange={(e) => setServings({ ...servings, [f.id]: Number(e.target.value) })}
                          aria-label={`Servings of ${f.name}`}
                          className="w-20 rounded-xl border border-border bg-input/40 px-2 py-1 text-sm"
                        />
                      </label>
                      <button onClick={() => logFood(f)} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
                        <Utensils className="h-3.5 w-3.5" /> Log to today
                      </button>
                      <button onClick={() => addToGrocery(f)} className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs">
                        <ShoppingCart className="h-3.5 w-3.5" /> Add to grocery
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="glass rounded-3xl p-5">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Camera className="h-4 w-4 text-primary" /> Other ways to log
        </div>
        <p className="text-xs text-muted-foreground">
          Photo meal recognition is live in the Scan tab. Barcode lookup is a placeholder until a verified
          packaged-food barcode source is connected — the button above tells you the same. Anything missing can be
          added manually and will be searchable for you immediately.
        </p>
      </div>
    </div>
  );
}

function AddFoodForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({
    name: "", brand: "", food_type: "ingredient", category: "Other", cuisine: "",
    serving_desc: "100 g", serving_grams: 100,
    calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
    data_source: "User entered",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!f.name.trim()) return toast.error("Name is required");
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("foods").insert({
        ...f,
        brand: f.brand || null,
        cuisine: f.cuisine || null,
        created_by: u.user.id,
        confidence: "low",
        verified: false,
      });
      if (error) throw error;
      toast.success("Food added to the library");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-strong rounded-3xl p-6">
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h2 className="truncate font-display text-lg font-semibold">Add a food</h2>
        <button onClick={onDone} aria-label="Close add food form" className="rounded-full p-1.5 text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={field} placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Food name" />
        <input className={field} placeholder="Brand (optional)" value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} aria-label="Brand" />
        <select className={field} value={f.food_type} onChange={(e) => setF({ ...f, food_type: e.target.value })} aria-label="Food type">
          {["ingredient", "recipe", "packaged", "restaurant"].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className={field} placeholder="Category (e.g. Grains)" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} aria-label="Category" />
        <input className={field} placeholder="Cuisine (optional)" value={f.cuisine} onChange={(e) => setF({ ...f, cuisine: e.target.value })} aria-label="Cuisine" />
        <input className={field} placeholder="Serving (e.g. 1 katori (150 g))" value={f.serving_desc} onChange={(e) => setF({ ...f, serving_desc: e.target.value })} aria-label="Serving description" />
        {(["calories", "protein", "carbs", "fat", "fiber"] as const).map((k) => (
          <label key={k} className="space-y-1">
            <span className="text-xs capitalize text-muted-foreground">{k} per serving</span>
            <input type="number" className={field} value={f[k]} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} />
          </label>
        ))}
        <input className={field} placeholder="Where the numbers come from" value={f.data_source} onChange={(e) => setF({ ...f, data_source: e.target.value })} aria-label="Data source" />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Foods you add are marked low confidence and unverified — they're yours to edit and everyone can search them.
      </p>
      <button onClick={save} disabled={saving} className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground glow-neon disabled:opacity-60">
        {saving ? "Saving…" : "Save food"}
      </button>
    </div>
  );
}
