export type Health = {
  engine: "starting" | "loading" | "ready" | "demo" | "error";
  loaded: number;
  total: number;
  device: string | null;
  error: string | null;
  chat: string[];
  accuracy?: Record<string, number>;
};

export type AnalyzeResult = {
  profile?: string;
  undertone: "Warm" | "Cool" | "Neutral";
  undertone_confidence: number;
  season: string;
  season_family: string;
  season_confidence: number;
  season_ranking: { season: string; p: number }[];
  probabilities: Record<string, Record<string, number>>;
  colour_twins: { name: string; season: string; undertone: string; similarity: number }[];
  /** Apparent gender of the person, read from the same features as the colour result. null = unsure. */
  gender: "male" | "female" | null;
  gender_confidence: number;
  regions: { mask: string; share: Record<string, number>; kept_percent: number } | null;
  measured: { face: string | null; hair: string | null; neck: string | null };
  photos_used: number;
  timings: Record<string, number>;
  device: string;
  demo: boolean;
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function health(): Promise<Health | null> {
  try {
    const r = await fetch("/api/health");
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export async function analyze(crops: Blob[]): Promise<AnalyzeResult> {
  const fd = new FormData();
  crops.forEach((b, i) => fd.append("photos", b, `crop-${i}.jpg`));
  let r: Response;
  try {
    r = await fetch("/api/analyze", { method: "POST", body: fd });
  } catch {
    throw new ApiError(0, "We couldn't reach the analysis service. Check your connection and try again.");
  }
  if (!r.ok) {
    let msg = "Something went wrong while analysing.";
    try {
      msg = (await r.json()).detail ?? msg;
    } catch { /* keep default */ }
    throw new ApiError(r.status, msg);
  }
  return r.json();
}

export type ChatMsg = { role: "user" | "assistant"; content: string };

/** Streams the stylist's answer. Resolves with the provider used; rejects with ApiError(503) when no LLM is configured. */
/** format "structured" asks for the Studio's verdict-plus-sections answers; the Previous interface sends prose */
export async function chatStream(messages: ChatMsg[], context: string, onDelta: (d: string) => void, signal?: AbortSignal, format: "prose" | "structured" = "prose") {
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, context, format }),
    signal,
  });
  if (!r.ok || !r.body) throw new ApiError(r.status, "chat unavailable");
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "", provider: string | null = null, got = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 2);
      if (!line.startsWith("data:")) continue;
      const ev = JSON.parse(line.slice(5));
      if (ev.delta) (got = true), onDelta(ev.delta);
      if (ev.done) provider = ev.provider;
      if (ev.error && !got) throw new ApiError(502, ev.error);
    }
  }
  return provider;
}
