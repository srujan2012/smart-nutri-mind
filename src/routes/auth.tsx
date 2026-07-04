import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { Sparkles, Mail, Lock, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "Sign in — NutriMind AI" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.navigate({ to: "/dashboard" });
    });
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Welcome to NutriMind!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message);
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    router.navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-grid">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="relative h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-accent glow-neon">
            <div className="absolute inset-1 rounded-md bg-background flex items-center justify-center">
              <span className="text-primary font-black text-xs">N</span>
            </div>
          </div>
          <span className="font-display font-bold text-xl">
            NutriMind<span className="text-primary">.</span>
          </span>
        </Link>

        <div className="glass-strong rounded-3xl p-8 shadow-glow-sm">
          <div className="mb-6 flex items-center gap-2 text-xs text-primary">
            <Sparkles className="h-3 w-3" />
            <span>{mode === "signin" ? "Welcome back" : "Create your account"}</span>
          </div>
          <h1 className="font-display text-2xl font-bold">
            {mode === "signin" ? "Sign in to your AI" : "Meet your AI nutritionist"}
          </h1>

          <button
            onClick={google}
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-background/50 px-4 py-3 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4">
              <path fill="#EA4335" d="M12 5.04c1.68 0 3.19.58 4.38 1.72l3.28-3.28C17.46 1.56 14.97.5 12 .5 7.31.5 3.26 3.19 1.28 7.09l3.82 2.96C6.05 7.09 8.8 5.04 12 5.04z"/>
              <path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.28 1.4-1.13 2.6-2.4 3.4l3.7 2.87c2.17-2 3.43-4.95 3.43-8.51z"/>
              <path fill="#FBBC05" d="M5.1 14.4c-.23-.7-.36-1.44-.36-2.4s.13-1.7.36-2.4L1.28 6.64C.47 8.26 0 10.08 0 12s.47 3.74 1.28 5.36l3.82-2.96z"/>
              <path fill="#34A853" d="M12 23.5c3.24 0 5.96-1.07 7.94-2.9l-3.7-2.87c-1.03.69-2.35 1.09-4.24 1.09-3.2 0-5.95-2.05-6.9-4.86l-3.82 2.96C3.26 20.81 7.31 23.5 12 23.5z"/>
            </svg>
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-4 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <input
                type="text"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-2xl border border-border bg-input/40 px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-border bg-input/40 py-3 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                required
                minLength={6}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-border bg-input/40 py-3 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground glow-neon transition hover:scale-[1.01] disabled:opacity-60"
            >
              {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {mode === "signin" ? "New here?" : "Have an account?"}{" "}
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-primary hover:underline"
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
