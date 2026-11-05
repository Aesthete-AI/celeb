// Conversation store for the Studio interface: the threads behind Home, History and Recents.
//
// Everything lives in this browser's localStorage. Nothing is uploaded, and the colour profile is
// kept separately (lib/profile.tsx) so clearing conversations never loses someone's analysis.
import { useCallback, useEffect, useState } from "react";
import type { CategoryId } from "../data/profiles";

export type StudioMsg = {
  id: number;
  role: "user" | "assistant";
  content: string;
  followups?: string[];
  /** set when the answer also moved the edit on screen */
  route?: { section: CategoryId; gender: string };
  streaming?: boolean;
  source?: string;
  /** "needs a colour profile first" — rendered with the selfie / seven-question buttons */
  gate?: boolean;
  /** an analysis result posted into the conversation */
  card?: { season: string; undertone: string; profile: string; source: "scan" | "quiz"; confidence?: number };
  /** a photo the person attached to their message — a small thumbnail kept only in this browser */
  image?: string;
  /** an attached photo being read: the head-and-neck crop shown while the scan runs */
  scan?: { crop?: string; stage: "reading" | "analysing" };
  /** the seven-question colour analysis, answered inside the conversation */
  quiz7?: { step: number; answers: Record<string, number>; done?: boolean };
};

export type Thread = { id: string; title: string; at: number; msgs: StudioMsg[] };

const KEY = "teinte.threads.v1";
const MAX_THREADS = 60;
const MAX_MSGS = 80;

let counter = Date.now();
export const nextMsgId = () => counter++;

const newId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function read(): Thread[] {
  try {
    // `?reset` (handled in lib/profile.tsx for the colour profile) also starts the conversations over.
    // This module loads before the profile provider strips the flag from the URL, so it still sees it.
    if (new URLSearchParams(window.location.search).has("reset")) {
      localStorage.removeItem(KEY);
      return [];
    }
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? (v as Thread[]) : [];
  } catch {
    return [];
  }
}
function write(ts: Thread[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ts.slice(0, MAX_THREADS)));
  } catch {
    /* private mode — the session still works, it just isn't remembered */
  }
}

/** First user line, trimmed to something that fits a sidebar row. */
export function titleOf(msgs: StudioMsg[]) {
  const first = msgs.find((m) => m.role === "user")?.content.trim();
  if (!first) return "New conversation";
  const t = first.replace(/\s+/g, " ");
  return t.length > 48 ? `${t.slice(0, 46)}…` : t;
}

const DEFAULT_TITLE = "New conversation";
/** The first question names the thread; a thread that opened with an analysis is named after the
 *  result until a question arrives. */
function nextTitle(t: Thread, msg: StudioMsg) {
  const provisional = t.title === DEFAULT_TITLE || t.title.startsWith("Analysis · ");
  if (!provisional) return t.title;
  if (msg.role === "user") return titleOf([msg]);
  if (msg.card && t.title === DEFAULT_TITLE) return `Analysis · ${msg.card.season}`;
  return t.title;
}

/** A single store shared by every component that mounts the hook, so the sidebar and the
 *  canvas never drift apart. */
let store: Thread[] = read();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
function commit(next: Thread[], persist = true) {
  store = next;
  if (persist) write(store);
  emit();
}

export function useThreads() {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((x) => x + 1);
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);

  const threads = store;

  const create = useCallback((): string => {
    const id = newId();
    commit([{ id, title: "New conversation", at: Date.now(), msgs: [] }, ...store]);
    return id;
  }, []);

  const append = useCallback((threadId: string, msg: StudioMsg) => {
    commit(
      store.map((t) =>
        t.id === threadId
          ? { ...t, at: Date.now(), msgs: [...t.msgs, msg].slice(-MAX_MSGS), title: nextTitle(t, msg) }
          : t,
      ),
    );
  }, []);

  /** persist=false while tokens stream in, so localStorage is written once per answer, not per token */
  const patch = useCallback((threadId: string, msgId: number, p: Partial<StudioMsg>, persist = true) => {
    commit(store.map((t) => (t.id === threadId ? { ...t, msgs: t.msgs.map((m) => (m.id === msgId ? { ...m, ...p } : m)) } : t)), persist);
  }, []);

  const remove = useCallback((threadId: string) => {
    commit(store.filter((t) => t.id !== threadId));
  }, []);

  const clear = useCallback(() => commit([]), []);

  const get = useCallback((threadId: string | null) => store.find((t) => t.id === threadId) ?? null, []);

  return { threads, create, append, patch, remove, clear, get };
}

/** Thread list grouped the way a person thinks about time. */
export function groupByDay(threads: Thread[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const buckets: { label: string; items: Thread[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Earlier", items: [] },
  ];
  for (const t of threads) {
    const age = startOfToday - new Date(t.at).setHours(0, 0, 0, 0);
    const i = age <= 0 ? 0 : age <= 864e5 ? 1 : age <= 7 * 864e5 ? 2 : 3;
    buckets[i].items.push(t);
  }
  return buckets.filter((b) => b.items.length);
}
