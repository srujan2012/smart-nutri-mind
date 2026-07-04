import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User, Settings } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  component: Profile,
});

function Profile() {
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return data;
    },
  });

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent glow-neon">
          <User className="h-7 w-7 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">{profile.full_name}</h1>
          <div className="text-sm text-muted-foreground">
            {profile.age}y · {profile.gender} · {profile.country}
          </div>
        </div>
        <Link
          to="/onboarding"
          className="ml-auto flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm"
        >
          <Settings className="h-4 w-4" /> Edit
        </Link>
      </div>

      <div className="glass-strong rounded-3xl p-6">
        <div className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
          Daily targets
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { l: "Calories", v: profile.calorie_target, u: "kcal" },
            { l: "Protein", v: profile.protein_target, u: "g" },
            { l: "Carbs", v: profile.carbs_target, u: "g" },
            { l: "Fat", v: profile.fat_target, u: "g" },
            { l: "Fiber", v: profile.fiber_target, u: "g" },
          ].map((s) => (
            <div key={s.l} className="glass rounded-2xl p-4">
              <div className="text-[10px] uppercase text-muted-foreground">{s.l}</div>
              <div className="font-display text-xl">{s.v}</div>
              <div className="text-xs text-muted-foreground">{s.u}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass rounded-3xl p-6">
          <div className="mb-2 text-xs uppercase text-muted-foreground">Diet</div>
          <div className="font-display text-lg">{profile.food_preference}</div>
          <div className="mt-3 flex flex-wrap gap-1">
            {(profile.lifestyle ?? []).map((l: string) => (
              <span key={l} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{l}</span>
            ))}
          </div>
        </div>
        <div className="glass rounded-3xl p-6">
          <div className="mb-2 text-xs uppercase text-muted-foreground">Health</div>
          <div className="flex flex-wrap gap-1">
            {(profile.conditions ?? []).map((c: string) => (
              <span key={c} className="rounded-full bg-accent/10 px-2.5 py-1 text-xs text-accent">{c}</span>
            ))}
          </div>
          {(profile.medications ?? []).length > 0 && (
            <>
              <div className="mt-4 text-xs uppercase text-muted-foreground">Meds</div>
              <div className="text-sm">{(profile.medications ?? []).join(", ")}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
