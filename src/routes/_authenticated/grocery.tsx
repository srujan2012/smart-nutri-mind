import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { suggestSubstitutes } from "@/lib/nutrition.functions";
import { useState } from "react";
import { ShoppingCart, Sparkles, RefreshCw, Check, X, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/grocery")({
  component: Grocery,
});

type Item = {
  id: string;
  name: string;
  amount: string | null;
  reason: string | null;
  aisle: string;
  checked: boolean;
  unavailable: boolean;
  substitutes: { name: string; why: string }[] | unknown;
  source: string;
};

const AISLE_ORDER = [
  "Produce","Dairy & Eggs","Meat & Seafood","Bakery","Grains & Pasta",
  "Canned & Jarred","Frozen","Snacks","Beverages","Condiments & Spices","Other",
];

function Grocery() {
  const qc = useQueryClient();
  const swap = useServerFn(suggestSubstitutes);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [newItem, setNewItem] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["grocery-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("grocery_items")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as Item[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["grocery-list"] });

  const toggleChecked = async (item: Item) => {
    await supabase.from("grocery_items").update({ checked: !item.checked }).eq("id", item.id);
    refresh();
  };
  const remove = async (id: string) => {
    await supabase.from("grocery_items").delete().eq("id", id);
    refresh();
  };
  const addManual = async () => {
    const name = newItem.trim();
    if (!name) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("grocery_items").insert({
      user_id: u.user.id, name, source: "manual", aisle: "Other",
    });
    setNewItem("");
    refresh();
  };
  const findSwap = async (item: Item) => {
    setSwapping(item.id);
    try {
      await swap({ data: { itemId: item.id, name: item.name, reason: item.reason ?? "" } });
      toast.success("Smart substitutes ready");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not find swaps");
    } finally {
      setSwapping(null);
    }
  };
  const acceptSubstitute = async (item: Item, sub: { name: string; why: string }) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("grocery_items").insert({
      user_id: u.user.id,
      name: sub.name,
      reason: `Substitute for ${item.name}: ${sub.why}`,
      aisle: item.aisle,
      source: "substitute",
    });
    await supabase.from("grocery_items").update({ checked: true, unavailable: true }).eq("id", item.id);
    toast.success(`Swapped in ${sub.name}`);
    refresh();
  };

  const grouped = new Map<string, Item[]>();
  for (const it of items) {
    const key = it.aisle || "Other";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(it);
  }
  const sortedAisles = Array.from(grouped.keys()).sort(
    (a, b) => AISLE_ORDER.indexOf(a) - AISLE_ORDER.indexOf(b),
  );

  const remaining = items.filter((i) => !i.checked).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-primary">
            <Sparkles className="h-3 w-3" /> AI grocery list
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold">Shopping list</h1>
          <p className="text-sm text-muted-foreground">
            Grouped by aisle · {remaining} to buy · tap "Not available" for smart swaps
          </p>
        </div>
        <button onClick={refresh} className="rounded-full border border-border p-2">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="glass rounded-3xl p-4 flex gap-2">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addManual()}
          placeholder="Add an item…"
          className="flex-1 rounded-full border border-border bg-input/40 px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <button onClick={addManual} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="inline h-4 w-4" /> Add
        </button>
      </div>

      {items.length === 0 && (
        <div className="glass rounded-3xl p-16 text-center">
          <ShoppingCart className="mx-auto h-10 w-10 text-primary/70" />
          <div className="mt-3 text-sm text-muted-foreground">
            Your list is empty. Scan your fridge or generate a meal plan to auto-fill it.
          </div>
        </div>
      )}

      {sortedAisles.map((aisle) => (
        <div key={aisle} className="glass rounded-3xl p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
            <ShoppingCart className="h-3.5 w-3.5" /> {aisle}
            <span className="ml-auto text-[10px] font-normal text-muted-foreground">
              {grouped.get(aisle)!.filter((i) => !i.checked).length} to buy
            </span>
          </div>
          <div className="space-y-2">
            {grouped.get(aisle)!.map((item) => {
              const subs = Array.isArray(item.substitutes)
                ? (item.substitutes as { name: string; why: string }[])
                : [];
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border p-3 transition ${
                    item.checked ? "border-border/40 opacity-60" : "border-border/60"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleChecked(item)}
                      className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                        item.checked ? "border-primary bg-primary" : "border-border"
                      }`}
                      aria-label={item.checked ? "Uncheck" : "Check"}
                    >
                      {item.checked && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-semibold ${item.checked ? "line-through" : ""}`}>
                        {item.name}
                        {item.amount && <span className="ml-1 font-normal text-muted-foreground">· {item.amount}</span>}
                        {item.unavailable && (
                          <span className="ml-2 rounded-full bg-warning/20 px-2 py-0.5 text-[10px] text-warning">
                            unavailable
                          </span>
                        )}
                      </div>
                      {item.reason && (
                        <div className="text-xs text-muted-foreground">{item.reason}</div>
                      )}
                      {subs.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="text-[10px] uppercase tracking-widest text-accent">Smart substitutes</div>
                          {subs.map((s, i) => (
                            <div key={i} className="flex items-start justify-between gap-2 rounded-xl border border-border/40 bg-background/30 p-2">
                              <div className="min-w-0">
                                <div className="text-xs font-semibold">{s.name}</div>
                                <div className="text-[10px] text-muted-foreground">{s.why}</div>
                              </div>
                              <button
                                onClick={() => acceptSubstitute(item, s)}
                                className="shrink-0 rounded-full bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground"
                              >
                                Use
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <button
                        onClick={() => findSwap(item)}
                        disabled={swapping === item.id}
                        className="rounded-full border border-border px-2 py-1 text-[10px] disabled:opacity-60"
                        title="Get AI substitutes if this item isn't available"
                      >
                        <X className="mr-1 inline h-3 w-3" />
                        {swapping === item.id ? "…" : "Not avail."}
                      </button>
                      <button
                        onClick={() => remove(item.id)}
                        className="rounded-full p-1 text-muted-foreground hover:text-destructive"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
