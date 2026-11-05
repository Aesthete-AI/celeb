import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Camera, Check, CircleDot, ImagePlus, Lock, Loader2, Plus, RefreshCw, Sparkles, Sun, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ease, GenderToggle, Meter, Reveal } from "../components/ui";
import { SEASON_BY_NAME, UNDERTONE_COPY, gradientCss } from "../data/seasons";
import { analyze, ApiError, health, type AnalyzeResult, type Health } from "../lib/api";
import { readFace, loadLandmarker, type FaceRead } from "../lib/face";
import { useProfile } from "../lib/profile";
import { prefetchProfile } from "../lib/catalog";
import { PROFILES, profileGradient, profileKeyOf } from "../data/profiles";

type Phase = "upload" | "scanning" | "result";
// const MODELS = ["ResNet-50", "EfficientNet-B7", "DenseNet-201", "Inception-ResNet-V2", "SE-ResNeXt-101", "NASNet-Large", "ConvNeXt-L", "DINOv2 ViT-L", "CLIP ViT-L", "SigLIP SO400M", "EVA-02 L", "ViT-L/16 21k"];
// model names are kept out of the shipped site entirely
const MODELS: string[] = [];

export default function Analyze() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [reads, setReads] = useState<FaceRead[]>([]);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [eng, setEng] = useState<Health | null | undefined>(undefined);
  const { setProfile, setPhoto, setGender, ask } = useProfile();

  useEffect(() => {
    loadLandmarker().catch(() => {});
    let alive = true;
    const poll = async () => {
      const h = await health();
      if (!alive) return;
      setEng(h);
      if (h && (h.engine === "loading" || h.engine === "starting")) setTimeout(poll, 3000);
    };
    poll();
    return () => { alive = false; };
  }, []);

  const addFile = useCallback(async (file: Blob) => {
    setError(null);
    setReading(true);
    try {
      const r = await readFace(file);
      if (!r.ok) setError(r.checks[r.checks.length - 1].detail);
      else setReads((x) => [...x, r].slice(0, 3));
    } catch {
      setError("We couldn't open that image. Try a JPG or PNG photo.");
    } finally {
      setReading(false);
    }
  }, []);

  const start = async () => {
    if (!reads.length) return;
    setPhase("scanning");
    setError(null);
  };

  const onDone = (r: AnalyzeResult) => {
    setResult(r);
    const key = r.profile ?? profileKeyOf(r.season, r.undertone);
    setProfile({
      profile: key,
      season: r.season, undertone: r.undertone, source: "scan", confidence: r.season_confidence, ranking: r.season_ranking,
      probabilities: r.probabilities, measured: r.measured, twins: r.colour_twins, photos: r.photos_used, ms: r.timings.total_ms, demo: r.demo, at: Date.now(),
    });
    // A new face replaces the previous person entirely: their apparent gender decides which lookbook
    // the edit opens on, so switching from a woman's photo to a man's flips every category to his.
    // When the read is not confident the engine sends null, and we show both edits rather than guess
    // or leave the previous person's lookbook up — one tap on the toggle then narrows it.
    setGender(r.gender ?? "all");
    setPhoto({ crop: reads[0].cropUrl!, mask: r.regions?.mask });
    setPhase("result");
  };

  const onFail = (msg: string) => {
    setError(msg);
    setPhase("upload");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6 md:pt-10 lg:px-10">
      <AnimatePresence mode="wait">
        {phase === "upload" && (
          <motion.div key="up" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.5, ease }}>
            <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
              <Guidelines eng={eng} />
              <Uploader reads={reads} reading={reading} error={error} onFile={addFile} onRemove={(i) => setReads((x) => x.filter((_, k) => k !== i))} onStart={start} onQuiz={() => ask("Help me find my season and undertone")} eng={eng} />
            </div>
          </motion.div>
        )}
        {phase === "scanning" && (
          <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
            <Scanner reads={reads} onDone={onDone} onFail={onFail} />
          </motion.div>
        )}
        {phase === "result" && result && (
          <motion.div key="res" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
            <Result r={result} crop={reads[0].cropUrl!} onRetry={() => { setReads([]); setResult(null); setPhase("upload"); }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────────────────────────────────────────────── guidelines */
function Guidelines({ eng }: { eng: Health | null | undefined }) {
  const tips = [
    { i: <CircleDot size={16} />, t: "Face the camera", d: "Straight on, head level, eyes open." },
    { i: <Sun size={16} />, t: "Even daylight", d: "Face a window. No harsh sun, flash or coloured light." },
    { i: <Sparkles size={16} />, t: "Minimal makeup, no filters", d: "Bare skin reads truest; filters shift every colour." },
    { i: <ImagePlus size={16} />, t: "Hair to neck in frame", d: "Leave space above your hair and include your neck." },
  ];
  return (
    <div>
      <p className="eyebrow">AI colour analysis</p>
      <h1 className="display mt-4 text-[56px] md:text-[76px]">Let's find <em className="text-aura">your</em> colours.</h1>
      <p className="mt-6 max-w-lg text-lg leading-relaxed text-mist-soft">
        Upload a front-facing portrait taken in even daylight — minimal makeup, no filters — with everything from the top of your head (including your hair) down to your neck clearly visible.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {tips.map((t, i) => (
          <motion.div key={t.t} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.07, duration: 0.6, ease }} className="panel !rounded-2xl p-4">
            <div className="flex items-center gap-2 text-sm font-medium"><span className="grid h-7 w-7 place-items-center rounded-full bg-white/[0.05]">{t.i}</span>{t.t}</div>
            <p className="mt-2 text-xs leading-relaxed text-mist-soft">{t.d}</p>
          </motion.div>
        ))}
      </div>
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-edge bg-white/[0.04] p-4 text-sm text-mist-soft">
        <Lock size={16} className="mt-0.5 shrink-0 text-mist" />
        <p>
          <span className="text-mist">Your photo stays in your browser and is visible only to you.</span> Nobody else can see it unless you choose to share it. We trim it to your head and neck on your device, and only that crop is sent to be read — analysed in memory, then discarded.
        </p>
      </div>
      <EngineStatus eng={eng} />
    </div>
  );
}

function EngineStatus({ eng }: { eng: Health | null | undefined }) {
  if (eng === undefined) return null;
  const s = !eng ? { c: "#d97757", t: "Analysis service unreachable — you can still take the quiz." } :
    // eng.engine === "ready" ? { c: "#4f9d7e", t: `Analysis engine ready · ${eng.total} models on ${eng.device?.toUpperCase()}` } :
    eng.engine === "ready" ? { c: "#4f9d7e", t: "Ready when you are" } :
    eng.engine === "demo" ? { c: "#c9a227", t: "Demo mode — results are illustrative, not the trained model." } :
    eng.engine === "error" ? { c: "#d97757", t: "Analysis engine unavailable right now — try the quiz instead." } :
    // { c: "#c9a227", t: `Engine warming up · ${eng.loaded}/${eng.total} models loaded` };
    { c: "#c9a227", t: "Getting ready — this takes a few seconds" };
  return (
    <p className="mt-4 flex items-center gap-2 text-xs text-mist-soft">
      <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: s.c }} /><span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: s.c }} /></span>
      {s.t}
    </p>
  );
}

/* ───────────────────────────────────────────────── uploader */
function Uploader({ reads, reading, error, onFile, onRemove, onStart, onQuiz, eng }: {
  reads: FaceRead[]; reading: boolean; error: string | null; onFile: (f: Blob) => void; onRemove: (i: number) => void; onStart: () => void; onQuiz: () => void; eng: Health | null | undefined;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [camera, setCamera] = useState(false);
  const main = reads[0];
  const blocked = main?.checks.some((c) => !c.ok && !c.warn);
  const engineOk = eng && (eng.engine === "ready" || eng.engine === "demo");

  return (
    <div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      {!main ? (
        <motion.div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
          animate={{ scale: drag ? 1.015 : 1 }}
          className="relative flex aspect-[4/5] max-h-[640px] w-full flex-col items-center justify-center overflow-hidden rounded-t-[999px] rounded-b-[40px] border border-dashed border-white/20 bg-white/[0.04] p-8 text-center backdrop-blur-sm"
        >
          <div className="absolute inset-0 opacity-60" style={{ background: "radial-gradient(50% 40% at 50% 35%, #f6d6c8 0%, transparent 70%), radial-gradient(40% 40% at 70% 70%, #dccdf0 0%, transparent 70%)" }} />
          <svg viewBox="0 0 200 240" className="relative w-40 text-white/25" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 4">
            <ellipse cx="100" cy="96" rx="46" ry="58" />
            <path d="M58,60 Q100,10 142,60" />
            <path d="M80,152 L80,190 M120,152 L120,190 M40,236 Q100,186 160,236" />
          </svg>
          <p className="relative mt-6 font-display text-3xl">Drop your portrait here</p>
          <p className="relative mt-2 text-sm text-mist-soft">JPG, PNG or HEIC from your phone — up to 3 photos</p>
          <div className="relative mt-7 flex flex-wrap justify-center gap-3">
            <button onClick={() => input.current?.click()} className="btn-light" disabled={reading}>{reading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />} Choose photo</button>
            <button onClick={() => setCamera(true)} className="btn-ghost" disabled={reading}><Camera size={16} /> Take a selfie</button>
          </div>
          <button onClick={onQuiz} className="relative mt-6 text-xs text-mist-soft underline decoration-white/25 underline-offset-4 hover:text-mist">No photo handy? Answer 7 quick questions instead</button>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="panel overflow-hidden p-5 sm:p-7">
          <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
            <div>
              <div className="relative overflow-hidden rounded-t-[999px] rounded-b-3xl bg-mist/5">
                <img src={main.cropUrl!} alt="Your head-and-neck crop" className="aspect-square w-full object-cover" />
                {main.samples.map((s) => (
                  <span key={s.name} className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white" style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, background: s.hex }} title={s.name} />
                ))}
              </div>
              <p className="mt-2 text-center text-[11px] text-mist-faint">This crop is all that leaves your device</p>
            </div>
            <div>
              <p className="eyebrow">Photo check</p>
              <ul className="mt-3 space-y-2.5">
                {main.checks.map((c, i) => (
                  <motion.li key={c.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08, duration: 0.4 }} className="flex gap-3 text-sm">
                    <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${c.ok && !c.warn ? "bg-[#13312a] text-[#7fd8b5]" : "bg-[#33240f] text-[#f0bf73]"}`}>{c.ok && !c.warn ? <Check size={12} /> : <AlertTriangle size={11} />}</span>
                    <span><span className="font-medium">{c.label}</span><span className="block text-xs text-mist-soft">{c.detail}</span></span>
                  </motion.li>
                ))}
              </ul>
              <p className="eyebrow mt-6">Tones we sampled</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {main.samples.map((s) => (
                  <span key={s.name} className="chip"><span className="h-3.5 w-3.5 rounded-full border border-white/15" style={{ background: s.hex }} />{s.name}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-7 border-t border-edge pt-5">
            <p className="text-sm">Photos <span className="text-mist-soft">· add up to two more for a steadier read (features are averaged, as in training)</span></p>
            <div className="mt-3 flex gap-3">
              {reads.map((r, i) => (
                <div key={i} className="group relative h-16 w-16 overflow-hidden rounded-2xl">
                  <img src={r.cropUrl!} alt="" className="h-full w-full object-cover" />
                  <button onClick={() => onRemove(i)} aria-label="Remove photo" className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-white/[0.06] opacity-0 transition group-hover:opacity-100"><X size={11} /></button>
                </div>
              ))}
              {reads.length < 3 && (
                <button onClick={() => input.current?.click()} disabled={reading} className="grid h-16 w-16 place-items-center rounded-2xl border border-dashed border-white/25 text-mist-soft transition hover:border-white/50 hover:text-mist">
                  {reading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={18} />}
                </button>
              )}
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button onClick={onStart} disabled={blocked || !engineOk} className="btn-aura !px-8 !py-3.5 text-[15px]"><Sparkles size={16} /> Analyse my colouring</button>
            <button onClick={() => { reads.forEach((_, i) => onRemove(reads.length - 1 - i)); }} className="btn-ghost"><RefreshCw size={15} /> Start over</button>
          </div>
          {!engineOk && eng !== undefined && <p className="mt-3 text-xs text-[#f0bf73]">The analysis engine isn't available right now. <button onClick={onQuiz} className="underline">Take the quiz instead</button>.</p>}
        </motion.div>
      )}
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 flex items-start gap-2 rounded-2xl border border-[#5a3a20] bg-[#2a1a10] p-4 text-sm text-[#f2c49b]">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
          </motion.p>
        )}
      </AnimatePresence>
      {camera && <CameraModal onClose={() => setCamera(false)} onCapture={(b) => { setCamera(false); onFile(b); }} />}
    </div>
  );
}

function CameraModal({ onClose, onCapture }: { onClose: () => void; onCapture: (b: Blob) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then((s) => { stream = s; if (video.current) { video.current.srcObject = s; video.current.play(); } })
      .catch(() => setErr("We couldn't open your camera. Check permissions, or upload a photo instead."));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);
  const snap = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const g = c.getContext("2d")!;
    g.translate(c.width, 0);
    g.scale(-1, 1);
    g.drawImage(v, 0, 0);
    c.toBlob((b) => b && onCapture(b), "image/jpeg", 0.95);
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[60] grid place-items-center bg-mist/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-[32px] bg-white/[0.05]">
        <div className="relative aspect-[3/4] bg-black">
          <video ref={video} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
          <svg viewBox="0 0 300 400" className="pointer-events-none absolute inset-0 h-full w-full" fill="none" stroke="white" strokeOpacity=".75" strokeWidth="1.5" strokeDasharray="5 6">
            <ellipse cx="150" cy="165" rx="78" ry="100" />
            <path d="M95,300 Q150,262 205,300" />
          </svg>
          {err && <p className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-2xl bg-white/[0.06] p-4 text-center text-sm">{err}</p>}
          <p className="absolute inset-x-0 bottom-4 text-center text-xs text-white/85">Fit your hair and neck inside the guide · face a window</p>
        </div>
        <div className="flex items-center justify-between p-4">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={snap} disabled={!!err} className="grid h-16 w-16 place-items-center rounded-full border-4 border-white/10 bg-mist text-night"><Camera size={22} /></button>
          <span className="w-[88px]" />
        </div>
      </div>
    </motion.div>
  );
}

/* ───────────────────────────────────────────────── scanner */
const STAGES = [
  // { t: "Mapping 478 facial landmarks", d: "On your device · MediaPipe" },
  // { t: "Isolating hair, face & neck", d: "Graphonomy human parsing" },
  { t: "Finding your face", d: "On your device — your photo stays with you" },
  { t: "Isolating hair, face & neck", d: "Only these three regions are read" },
  { t: "Sampling skin, hair & neck tones", d: "Robust median colour per region" },
  // { t: "Twelve models read your colouring", d: "7 CNNs + 5 vision transformers" },
  { t: "Reading your colouring", d: "Undertone, depth and clarity" },
  { t: "Matching you to 12 seasons", d: "Mean of probabilities · undertone & season" },
];

function Scanner({ reads, onDone, onFail }: { reads: FaceRead[]; onDone: (r: AnalyzeResult) => void; onFail: (m: string) => void }) {
  const [stage, setStage] = useState(2);
  const [lit, setLit] = useState(0);
  const [res, setRes] = useState<AnalyzeResult | null>(null);
  const main = reads[0];
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const t0 = performance.now();
    const timers = [setTimeout(() => setStage((x) => Math.max(x, 3)), 900), setTimeout(() => setStage((x) => Math.max(x, 4)), 1800)];
    const tick = setInterval(() => setLit((x) => (performance.now() - t0 > 1800 ? Math.min(11, x + 1) : x)), 240);
    analyze(reads.map((r) => r.crop!))
      .then(async (r) => {
        setRes(r);
        // fetch the profile's ranked edit while the reveal plays, so it opens instantly
        prefetchProfile(r.profile ?? profileKeyOf(r.season, r.undertone), r.gender ?? "female");
        // the theatre never runs shorter than ~3.4 s, and never holds a finished result for long
        await new Promise((ok) => setTimeout(ok, Math.max(0, 3400 - (performance.now() - t0))));
        setLit(12);
        setStage(5);
        await new Promise((ok) => setTimeout(ok, 1100));
        onDone(r);
      })
      .catch((e) => onFail(e instanceof ApiError ? e.message : "Something went wrong — please try again."))
      .finally(() => { timers.forEach(clearTimeout); clearInterval(tick); });
  }, [reads, onDone, onFail]);

  const regionsShown = !!res?.regions;

  return (
    <div className="grid items-center gap-12 lg:grid-cols-2">
      <div className="relative mx-auto w-full max-w-[460px]">
        <div className="relative overflow-hidden rounded-t-[999px] rounded-b-[40px] bg-mist shadow-lift">
          <img src={main.cropUrl!} alt="" className="aspect-square w-full object-cover" />
          {/* region mask from Graphonomy */}
          {res?.regions && <RegionOverlay mask={res.regions.mask} show={regionsShown} />}
          {/* landmark mesh */}
          <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
            {main.cropPoints.map(([x, y], i) => (
              <motion.circle key={i} cx={x} cy={y} r={0.0032} fill="white" initial={{ opacity: 0 }} animate={{ opacity: stage >= 4 ? 0.15 : [0, 0.95, 0.55] }} transition={{ delay: (i % 60) * 0.012, duration: 0.8 }} />
            ))}
          </svg>
          {/* scanning beam */}
          {stage < 5 && (
            <motion.div className="absolute inset-x-0 h-24" style={{ background: "linear-gradient(to bottom, transparent, rgba(255,255,255,.28), transparent)" }} animate={{ top: ["-20%", "100%"] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />
          )}
          {/* sampled tones */}
          {stage >= 3 && main.samples.map((s, i) => (
            <motion.div key={s.name} className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5" style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.12, duration: 0.5, ease }}>
              <span className="h-4 w-4 rounded-full ring-2 ring-white shadow" style={{ background: s.hex }} />
            </motion.div>
          ))}
        </div>
        {regionsShown && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex justify-center gap-2">
            {[["Face", "#F6B8A0"], ["Hair", "#B9A2E6"], ["Neck", "#8FD3B8"]].map(([l, c]) => (
              <span key={l} className="chip"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{l}</span>
            ))}
          </motion.div>
        )}
      </div>

      <div>
        <p className="eyebrow">Analysing</p>
        <h2 className="display mt-3 text-5xl md:text-6xl">Reading your <em>colouring</em>…</h2>
        <ol className="mt-10 space-y-5">
          {STAGES.map((s, i) => {
            const n = i + 1;
            const done = stage > n || (n === 5 && !!res && lit === 12);
            const active = stage === n && !done;
            return (
              <li key={s.t} className={`flex gap-4 transition-opacity duration-500 ${stage >= n || active ? "opacity-100" : "opacity-35"}`}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-colors ${done ? "border-mist bg-mist text-night" : "border-white/20"}`}>
                  {done ? <Check size={14} /> : active ? <Loader2 size={14} className="animate-spin" /> : <span className="text-xs text-mist-faint">{n}</span>}
                </span>
                <div className="flex-1">
                  <p className="text-[15px]">{s.t}</p>
                  <p className="text-xs text-mist-soft">{s.d}</p>
                  {n === 3 && stage >= 3 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {main.samples.map((x) => <span key={x.name} className="chip !py-1"><span className="h-3 w-3 rounded-full" style={{ background: x.hex }} />{x.name}</span>)}
                    </div>
                  )}
                  {/* the grid of twelve model names is no longer shown */}
                  {false && n === 4 && stage >= 4 && (
                    <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                      {MODELS.map((m, k) => (
                        <motion.span key={m} className="rounded-lg border px-2 py-1 text-center text-[10px]" animate={{ backgroundColor: k < lit ? "#1C1917" : "rgba(255,255,255,.6)", color: k < lit ? "#FBF8F4" : "#A8A29E", borderColor: k < lit ? "#1C1917" : "#E7E1D8" }} transition={{ duration: 0.35 }}>{m}</motion.span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/** Paints Graphonomy's label map (1 face, 2 hair, 3 neck) as soft tints over the crop. */
function RegionOverlay({ mask, show }: { mask: string; show: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height);
      const tint: Record<number, [number, number, number]> = { 1: [246, 184, 160], 2: [185, 162, 230], 3: [143, 211, 184] };
      for (let i = 0; i < d.data.length; i += 4) {
        const t = tint[d.data[i]];
        if (t) { d.data[i] = t[0]; d.data[i + 1] = t[1]; d.data[i + 2] = t[2]; d.data[i + 3] = 150; }
        else d.data[i + 3] = 0;
      }
      g.putImageData(d, 0, 0);
      setUrl(c.toDataURL());
    };
    img.src = mask;
  }, [mask]);
  return url ? <motion.img src={url} alt="" className="absolute inset-0 h-full w-full mix-blend-soft-light" style={{ imageRendering: "auto" }} initial={{ opacity: 0 }} animate={{ opacity: show ? 1 : 0 }} transition={{ duration: 0.9 }} /> : null;
}

/* ───────────────────────────────────────────────── result */
function Result({ r, crop, onRetry }: { r: AnalyzeResult; crop: string; onRetry: () => void }) {
  const s = SEASON_BY_NAME[r.season];
  const navigate = useNavigate();
  const { gender, setGender, setChatOpen } = useProfile();
  const u = UNDERTONE_COPY[r.undertone];
  const cp = PROFILES[r.profile ?? profileKeyOf(r.season, r.undertone)];
  const ut = Object.entries(r.probabilities.undertone).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      {r.demo && (
        <p className="mb-6 flex items-center gap-2 rounded-2xl border border-[#5c4a1c] bg-[#2b2410] p-4 text-sm text-[#ead08a]"><AlertTriangle size={16} /> Demo mode: this result is illustrative only, not a full analysis.</p>
      )}
      <section className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative mx-auto w-full max-w-[440px]">
          <motion.div className="absolute -inset-6 rounded-t-[999px] rounded-b-[56px] opacity-80" style={{ background: gradientCss(s.gradient, 160) }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 0.85, scale: 1 }} transition={{ duration: 1.2, ease }} />
          <div className="relative overflow-hidden rounded-t-[999px] rounded-b-[40px] shadow-lift">
            <img src={crop} alt="Your photo" className="aspect-square w-full object-cover" />
          </div>
          <div className="absolute -bottom-5 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-white/[0.06] p-1.5 shadow-lift backdrop-blur">
            {s.palette.slice(0, 8).map((p, i) => (
              <motion.span key={p.hex} title={p.name} className="h-7 w-7 rounded-full" style={{ background: p.hex }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 + i * 0.06, type: "spring", stiffness: 300, damping: 18 }} />
            ))}
          </div>
        </div>

        <div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="eyebrow">Your seasonal colour</motion.p>
          <motion.h1 initial={{ opacity: 0, y: 24, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 1, ease, delay: 0.25 }} className="display mt-3 text-[64px] md:text-[96px]">
            <span style={{ background: gradientCss([s.gradient[1], s.gradient[2], s.gradient[0]], 100), WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", filter: "saturate(1.4) brightness(.8)" }}>{s.name}</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-2 font-display text-2xl italic text-mist-soft">{s.tagline}</motion.p>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.6 }} className="mt-7 grid gap-3 sm:grid-cols-2">
            <div className="panel !rounded-3xl p-5">
              <p className="eyebrow !text-[10px]">Skin undertone</p>
              <p className="mt-2 font-display text-3xl">{r.undertone}</p>
              <p className="mt-1 text-xs leading-relaxed text-mist-soft">{u.body}</p>
              <div className="mt-4 space-y-2.5">{ut.map(([k, v]) => <Meter key={k} label={k} value={v} tint={k === "Warm" ? "#d98b5f" : k === "Cool" ? "#7b8fd6" : "#a99c8c"} />)}</div>
            </div>
            <div className="panel !rounded-3xl p-5">
              <p className="eyebrow !text-[10px]">Closest seasons</p>
              <div className="mt-3 space-y-2.5">
                {r.season_ranking.map((x) => <Meter key={x.season} label={x.season} value={x.p} tint={SEASON_BY_NAME[x.season]?.gradient[1]} />)}
              </div>
              <p className="mt-3 text-[11px] text-mist-faint">{s.family} family · {s.dims.hue}, {s.dims.value}, {s.dims.chroma}</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.6 }} className="panel mt-3 flex items-start gap-4 !rounded-3xl p-5">
            <span className="mt-1 h-10 w-10 shrink-0 rounded-full" style={{ background: profileGradient(cp) }} />
            <div>
              <p className="eyebrow !text-[10px]">Your profile · {cp.mood}</p>
              <p className="mt-1 font-display text-2xl">{cp.family} · {cp.undertone} undertone</p>
              <p className="mt-1 text-sm leading-relaxed text-mist-soft">{cp.rule}</p>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.95 }} className="mt-5 flex flex-wrap items-center gap-2 text-xs text-mist-soft">
            {(["face", "hair", "neck"] as const).map((k) => r.measured[k] && <span key={k} className="chip"><span className="h-3 w-3 rounded-full border border-white/15" style={{ background: r.measured[k]! }} />Measured {k}</span>)}
            {/* {!r.demo && <span className="chip">Analysed in {(r.timings.total_ms / 1000).toFixed(2)} s · {r.photos_used} photo{r.photos_used > 1 ? "s" : ""} · {r.device.toUpperCase()}</span>} */}
            {!r.demo && <span className="chip">Read in {(r.timings.total_ms / 1000).toFixed(2)} s</span>}
          </motion.div>
        </div>
      </section>

      {r.colour_twins.length > 0 && (
        <Reveal className="mt-20">
          <p className="eyebrow">Colouring like yours</p>
          <h2 className="display mt-3 text-4xl">Your colour twins</h2>
          <p className="mt-2 max-w-xl text-sm text-mist-soft">The people in our analyst-verified reference set whose colouring sits closest to yours.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {r.colour_twins.map((t) => (
              <span key={t.name} className="flex items-center gap-2 rounded-full border border-edge bg-white/[0.06] py-1.5 pl-1.5 pr-4 text-sm">
                <span className="h-7 w-7 rounded-full" style={{ background: gradientCss(SEASON_BY_NAME[t.season]?.gradient ?? s.gradient) }} />
                {t.name}<span className="text-xs text-mist-faint">· {t.season}</span>
              </span>
            ))}
          </div>
        </Reveal>
      )}

      <Reveal className="mt-20">
        <div className="panel relative overflow-hidden p-8 md:p-12">
          <div className="absolute inset-0 opacity-40" style={{ background: gradientCss(s.gradient, 120) }} />
          <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">Next</p>
              <h2 className="display mt-3 text-5xl">Your edit is ready.</h2>
              <p className="mt-3 max-w-md text-mist-soft">Jewellery, hair, makeup, clothing and outfits for every occasion — ranked to your {cp.family} · {cp.undertone} palette.</p>
              <div className="mt-6 flex items-center gap-3 text-sm"><span className="text-mist-soft">Show me looks for</span><GenderToggle value={gender} onChange={setGender} /></div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => navigate("/for-you")} className="btn-light !px-7 !py-3.5">Open my edit <ArrowRight size={16} /></button>
              <Link to="/palette" className="btn-ghost !px-7 !py-3.5">Full palette</Link>
              <button onClick={() => setChatOpen(true)} className="btn-ghost !px-7 !py-3.5"><Sparkles size={15} /> Ask stylist</button>
            </div>
          </div>
        </div>
      </Reveal>
      <div className="mt-8 text-center">
        <button onClick={onRetry} className="text-sm text-mist-soft underline decoration-white/25 underline-offset-4 hover:text-mist">Analyse another photo</button>
      </div>
    </div>
  );
}
