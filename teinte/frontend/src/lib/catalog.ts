// Loads a profile's pre-ranked lookbook (public/catalog/<profile>.json). Each file holds every category ×
// gender for that profile, so one request — prefetched the moment a scan returns — renders the whole edit.
import { useEffect, useState } from "react";
import type { CategoryId, Gender } from "../data/profiles";

export type CatalogItem = {
  id: number;
  w: number;
  h: number;
  alt: string;
  avg: string | null;
  thumb: string;
  full: string;
  colours: string[];
  match: string | null;
  matchHex: string | null;
  score: number;
  photographer: string;
  photographerUrl: string;
  source?: string; // Unsplash | Pexels
  url: string;
};
export type Catalog = { profile: string; generated: number; source: string; categories: Partial<Record<CategoryId, Partial<Record<Gender, CatalogItem[]>>>> };

const cache = new Map<string, Promise<Catalog | null>>();

export function loadCatalog(profile: string): Promise<Catalog | null> {
  if (!cache.has(profile)) {
    const p = fetch(`/catalog/${profile}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Catalog>) : null))
      .catch(() => null);
    cache.set(profile, p);
    p.then((c) => { if (!c) setTimeout(() => cache.delete(profile), 30_000); });
  }
  return cache.get(profile)!;
}

/** Warm the browser cache for the first images of each category so they paint instantly. */
export function prefetchProfile(profile: string, gender: Gender) {
  loadCatalog(profile).then((c) => {
    if (!c) return;
    Object.values(c.categories).forEach((byG) => byG?.[gender]?.slice(0, 3).forEach((it) => { const i = new Image(); i.src = it.thumb; }));
  });
}

export function useCatalog(profile: string) {
  const [state, set] = useState<{ catalog: Catalog | null; loading: boolean }>({ catalog: null, loading: true });
  useEffect(() => {
    let alive = true;
    set((s) => ({ ...s, loading: true }));
    loadCatalog(profile).then((c) => alive && set({ catalog: c, loading: false }));
    return () => { alive = false; };
  }, [profile]);
  return state;
}

/** Pexels serves resized variants from query params; ask for what the card actually needs. */
export const sized = (url: string, w: number) => {
  try {
    const u = new URL(url);
    u.searchParams.set("auto", "compress");
    u.searchParams.set("cs", "tinysrgb");
    u.searchParams.set("w", String(w));
    u.searchParams.delete("h");
    u.searchParams.delete("fit");
    return u.toString();
  } catch {
    return url;
  }
};
