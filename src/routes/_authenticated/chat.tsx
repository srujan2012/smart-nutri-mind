import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { chatWithAI } from "@/lib/nutrition.functions";
import { Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/_authenticated/chat")({
  component: Chat,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What should I eat post-workout?",
  "Is my lunch diabetes-friendly?",
  "Suggest a high-protein snack under 200 kcal",
  "How can I hit my fiber target today?",
];

function Chat() {
  const call = useServerFn(chatWithAI);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hey! I'm your AI nutritionist. Ask me anything about your food, goals, or health." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const r = await call({ data: { messages: next } });
      setMessages([...next, { role: "assistant", content: r.content }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: e instanceof Error ? `⚠️ ${e.message}` : "Error" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-11rem)] max-w-3xl flex-col">
      <div className="mb-4">
        <div className="flex items-center gap-2 text-xs text-primary">
          <Sparkles className="h-3 w-3" /> AI Coach
        </div>
        <h1 className="font-display text-2xl font-bold">Nutrition assistant</h1>
      </div>

      <div ref={scroll} className="glass-strong flex-1 space-y-4 overflow-y-auto rounded-3xl p-6">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "user" ? (
              <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                {m.content}
              </div>
            ) : (
              <div className="max-w-[85%] text-sm">
                <div className="prose prose-sm prose-invert max-w-none prose-headings:font-display prose-headings:text-foreground prose-strong:text-primary prose-a:text-accent">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex gap-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" style={{ animationDelay: "150ms" }} />
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" style={{ animationDelay: "300ms" }} />
            </div>
            Thinking about your nutrition…
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-border bg-background/40 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="mt-4 flex items-center gap-2 glass-strong rounded-full p-2"
      >
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your nutrition…"
          className="flex-1 bg-transparent px-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none"
        />
        <button
          type="submit" disabled={loading || !input.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground glow-neon disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
