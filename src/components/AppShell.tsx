import { Link, useRouter } from "@tanstack/react-router";
import { LogOut, LayoutDashboard, Camera, Refrigerator, ChefHat, MessageSquare, User, ShoppingCart } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

const nav = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Today" },
  { to: "/scan", icon: Camera, label: "Scan" },
  { to: "/fridge", icon: Refrigerator, label: "Fridge" },
  { to: "/planner", icon: ChefHat, label: "Plan" },
  { to: "/grocery", icon: ShoppingCart, label: "List" },
  { to: "/chat", icon: MessageSquare, label: "Coach" },
  { to: "/profile", icon: User, label: "Me" },
] as const;



export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-grid">
      <header className="sticky top-0 z-40 glass-strong border-b border-border/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent glow-neon">
              <div className="absolute inset-1 rounded-md bg-background flex items-center justify-center">
                <span className="text-primary font-black text-xs">N</span>
              </div>
            </div>
            <span className="font-display font-bold text-lg tracking-tight">
              NutriMind<span className="text-primary">.</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                activeProps={{
                  className:
                    "flex items-center gap-2 rounded-full px-4 py-2 text-sm bg-primary/10 text-primary border border-primary/30",
                }}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            ))}
          </nav>
          <button
            onClick={signOut}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-6">{children}</main>

      {/* Mobile nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden glass-strong border-t border-border/60">
        <div className="grid grid-cols-7">

          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex flex-col items-center gap-1 py-3 text-xs text-muted-foreground"
              activeProps={{
                className: "flex flex-col items-center gap-1 py-3 text-xs text-primary",
              }}
            >
              <n.icon className="h-5 w-5" />
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
