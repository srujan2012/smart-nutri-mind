// ============ Event-Driven Architecture (client) ============
// A tiny typed event bus. When a user logs a meal, scans their pantry, or
// edits their profile, every screen that depends on that data hears about it
// once — through AppShell's central subscription — and refetches. No screen
// needs to know which other screens care.

export type AppEventType =
  | "meal-logged"       // meals, dashboard, history, coach, insights
  | "pantry-scanned"    // grocery list, planner
  | "grocery-updated"   // grocery list, planner
  | "plan-updated"      // planner, grocery
  | "profile-updated"   // profile, dashboard targets, coach, athlete
  | "metrics-updated";  // vitals, coach, insights

export type AppEvent = { type: AppEventType; at: number };

const EVENT_NAME = "nutrimind:app-event";

export function emitAppEvent(type: AppEventType): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AppEvent>(EVENT_NAME, { detail: { type, at: Date.now() } }));
}

export function onAppEvent(handler: (e: AppEvent) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<AppEvent>).detail);
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}

// Which cached queries each event invalidates — the single source of truth
// for cross-screen reactivity.
export const INVALIDATION_MAP: Record<AppEventType, string[][]> = {
  "meal-logged": [["meals-today"], ["meals-history"], ["daily-metrics"], ["coach"]],
  "pantry-scanned": [["grocery-list"], ["meal-plan"]],
  "grocery-updated": [["grocery-list"], ["meal-plan"]],
  "plan-updated": [["meal-plan"], ["grocery-list"], ["plan-adjustments"]],
  "profile-updated": [["profile"], ["coach"], ["insights"]],
  "metrics-updated": [["daily-metrics"], ["coach"], ["insights"]],
};
