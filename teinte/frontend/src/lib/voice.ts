// Dictation for the search box. The microphone is recorded in the browser as 16 kHz mono PCM; while the
// person speaks, everything said so far is re-transcribed on our own server (Whisper large-v3-turbo on the
// GPU) about once a second, so the words appear live; when they stop, one final pass over the whole clip
// gives the most accurate text. Audio is never stored and never goes to a third party.
import { useCallback, useEffect, useRef, useState } from "react";

const SR = 16000;
const MAX_SECONDS = 60;
const PARTIAL_EVERY_MS = 500;      // each pass takes ~0.1 s on the GPU, so words appear about twice a second

export type DictationState = "idle" | "starting" | "recording" | "finishing";

// AudioWorklet that hands raw mic frames to the page (inlined so no extra file is served)
const WORKLET = `class Tap extends AudioWorkletProcessor{process(i){const c=i[0]&&i[0][0];if(c)this.port.postMessage(c.slice(0));return true}}registerProcessor("tap",Tap)`;

/** Linear resample of a Float32 frame to 16 kHz. */
function resample(input: Float32Array, from: number): Float32Array {
  if (from === SR) return input;
  const ratio = from / SR;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const x = i * ratio, j = Math.floor(x), f = x - j;
    out[i] = input[j] * (1 - f) + (input[j + 1] ?? input[j]) * f;
  }
  return out;
}

function toInt16(chunks: Float32Array[]): ArrayBuffer {
  const n = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Int16Array(n);
  let k = 0;
  for (const c of chunks) for (let i = 0; i < c.length; i++) out[k++] = Math.max(-1, Math.min(1, c[i])) * 0x7fff;
  return out.buffer;
}

async function transcribe(pcm: ArrayBuffer, signal?: AbortSignal): Promise<string> {
  const r = await fetch("/api/transcribe", { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: pcm, signal });
  if (!r.ok) {
    let msg = "Voice input is unavailable right now.";
    try { msg = (await r.json()).detail ?? msg; } catch { /* keep default */ }
    throw new Error(msg);
  }
  return (await r.json()).text as string;
}

export function useDictation(onText: (text: string, final: boolean) => void) {
  const [state, setState] = useState<DictationState>("idle");
  const [level, setLevel] = useState(0);            // 0-1 input loudness, for the waveform
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const r = useRef<{ ctx?: AudioContext; stream?: MediaStream; node?: AudioWorkletNode; chunks: Float32Array[]; samples: number; sent: number; inflight: boolean; timer?: number; t0: number; ac?: AbortController }>({ chunks: [], samples: 0, sent: 0, inflight: false, t0: 0 });
  const cb = useRef(onText);
  cb.current = onText;

  const teardown = useCallback(() => {
    const s = r.current;
    if (s.timer) clearInterval(s.timer);
    s.node?.disconnect();
    s.stream?.getTracks().forEach((t) => t.stop());
    s.ctx?.close().catch(() => {});
    Object.assign(s, { ctx: undefined, stream: undefined, node: undefined, timer: undefined });
    setLevel(0);
  }, []);

  const finish = useCallback(async () => {
    const s = r.current;
    if (!s.chunks.length) { teardown(); setState("idle"); return; }
    teardown();
    setState("finishing");
    s.ac?.abort();                                    // a partial still running is superseded by the final pass
    try {
      const text = await transcribe(toInt16(s.chunks));
      cb.current(text, true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      s.chunks = []; s.samples = 0; s.sent = 0;
      setState("idle");
    }
  }, [teardown]);

  const start = useCallback(async () => {
    if (state !== "idle") return;
    setError(null);
    setSeconds(0);
    setState("starting");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser can't record audio.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const ctx = new AudioContext();
      await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" })));
      const src = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, "tap");
      const s = r.current;
      Object.assign(s, { ctx, stream, node, chunks: [], samples: 0, sent: 0, inflight: false, t0: performance.now() });
      let acc = 0, n = 0;
      node.port.onmessage = (ev: MessageEvent<Float32Array>) => {
        const f = resample(ev.data, ctx.sampleRate);
        s.chunks.push(f);
        s.samples += f.length;
        for (let i = 0; i < f.length; i += 4) { acc += f[i] * f[i]; n++; }
        if (n > 800) { setLevel(Math.min(1, Math.sqrt(acc / n) * 9)); acc = 0; n = 0; }
      };
      src.connect(node);
      s.timer = window.setInterval(async () => {
        const secs = (performance.now() - s.t0) / 1000;
        setSeconds(secs);
        if (secs >= MAX_SECONDS) { finish(); return; }
        // live text: re-transcribe everything so far, one request at a time, only when there is new audio
        if (s.inflight || s.samples - s.sent < SR * 0.3) return;
        s.inflight = true;
        s.sent = s.samples;
        s.ac = new AbortController();
        try {
          const text = await transcribe(toInt16(s.chunks), s.ac.signal);
          if (s.stream) cb.current(text, false);
        } catch (e) {
          if ((e as Error).name !== "AbortError") setError((e as Error).message);
        } finally {
          s.inflight = false;
        }
      }, PARTIAL_EVERY_MS);
      setState("recording");
    } catch (e) {
      teardown();
      setState("idle");
      const err = e as Error;
      setError(err.name === "NotAllowedError" ? "Microphone access was blocked — allow it in your browser's site settings." :
        err.name === "NotFoundError" ? "No microphone was found." : err.message || "Couldn't start the microphone.");
    }
  }, [state, finish, teardown]);

  const cancel = useCallback(() => {
    r.current.ac?.abort();
    r.current.chunks = [];
    teardown();
    setState("idle");
  }, [teardown]);

  useEffect(() => () => teardown(), [teardown]);
  useEffect(() => { if (!error) return; const t = setTimeout(() => setError(null), 4500); return () => clearTimeout(t); }, [error]);

  return { state, level, seconds, error, start, stop: finish, cancel };
}
