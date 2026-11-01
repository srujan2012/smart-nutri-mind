// ============ Offline-First Mode ============
// Recent meals, dashboard data and plans stay readable without a network.
// Every successful fetch is mirrored to localStorage with a timestamp; when
// the network is down the cached copy is served and clearly labeled.

import { useEffect, useState } from "react";

const PREFIX = "nutrimind:offline:";

type Wrapped<T> = { at: number; value: T };

export function cacheSet(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    // quota errors are non-fatal: offline cache is best-effort
  }
}

export function cacheGet<T>(key: string): { value: T; at: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const wrapped = JSON.parse(raw) as Wrapped<T>;
    return { value: wrapped.value, at: wrapped.at };
  } catch {
    return null;
  }
}

export function cacheAgeLabel(at: number): string {
  const mins = Math.round((Date.now() - at) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/**
 * Wrap a TanStack Query queryFn with offline mirroring. On network failure it
 * serves the last cached value instead of throwing, and the `isStaleCache`
 * flag on the returned tuple lets the UI label it.
 */
export function withOfflineCache<T>(key: string, fn: () => Promise<T>): () => Promise<{ data: T; staleCache: boolean; cachedAt?: number }> {
  return async () => {
    try {
      const data = await fn();
      cacheSet(key, data);
      return { data, staleCache: false };
    } catch (err) {
      const cached = cacheGet<T>(key);
      if (cached) return { data: cached.value, staleCache: true, cachedAt: cached.at };
      throw err;
    }
  };
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}
