// The Analysis panel. Opens beside the conversation (a full-screen sheet on phones) and holds the two
// ways in — a selfie scan through the real 12-model engine, or the seven questions from the colour
// analysis card — and then the result, with “Open my edit →”.
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Camera, Check, ImagePlus, ListChecks, Loader2, Lock, MessageCircle, /* Plus, */ RefreshCw, Sparkles, X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ease, GenderToggle } from "../components/ui";
import { PROFILES, profileGradient, profileKeyOf } from "../data/profiles";
import { QUIZ7, scoreQuiz7, type Q7Art, type Q7Option } from "../data/quiz7";
import { SEASON_BY_NAME, UNDERTONE_COPY, gradientCss } from "../data/seasons";
import { analyze, ApiError, health, type Health } from "../lib/api";
import { prefetchProfile } from "../lib/catalog";
import { shade } from "../lib/color";
import { loadLandmarker, readFace, type FaceRead } from "../lib/face";
import { useProfile, type Profile } from "../lib/profile";
import { useStudio } from "./StudioContext";
import { useDesktop } from "./useDesktop";

export const PANEL_W = 408;
type View = "choose" | "photo" | "quiz" | "result";

export default function AnalysisPanel({ left }: { left: number }) {
  const { analysisOpen, closeAnalysis } = useStudio();
  const desktop = useDesktop();
  return (
    <AnimatePresence>
      {analysisOpen && (
        <motion.section
          key="analysis"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.45, ease }}
          aria-label="Colour analysis"
          className="fixed inset-0 z-50 flex flex-col bg-night-2/[0.97] backdrop-blur-2xl lg:inset-auto lg:bottom-3 lg:top-[68px] lg:rounded-[28px] lg:border lg:border-edge lg:bg-night-2/80 lg:shadow-lift"
          style={desktop ? { left: left + 12, width: PANEL_W - 12 } : undefined}
        >
          <div className="flex items-center justify-between border-b border-edge px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-mist text-night"><Sparkles size={14} /></span>
              <div>
                <p className="text-[15px] font-medium leading-none">Analysis</p>
                <p className="mt-1 text-[11px] text-mist-soft">Skin undertone · seasonal colour</p>
              </div>
            </div>
            <button onClick={closeAnalysis} aria-label="Close analysis" className="grid h-9 w-9 place-items-center rounded-full border border-edge bg-white/[0.04] text-mist-soft transition hover:text-mist"><X size={16} /></button>
          </div>
          <Body />
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function Body() {
  const { analysisMode, setAnalysisMode } = useStudio();
  const { profile } = useProfile();
  const viewFor = useCallback((): View => (analysisMode === "photo" ? "photo" : analysisMode === "quiz" ? "quiz" : profile ? "result" : "choose"), [analysisMode, profile]);
  const [view, setView] = useState<View>(viewFor);
  useEffect(() => setView(viewFor()), [analysisMode]); // eslint-disable-line react-hooks/exhaustive-deps
  // a photo picked from the search bar always lands on the photo step, even over a finished result
  const { pendingFile } = useStudio();
  useEffect(() => { if (pendingFile) setView("photo"); }, [pendingFile]);

  const go = (v: View) => { setView(v); if (v === "photo" || v === "quiz") setAnalysisMode(v); };
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => scroller.current?.scrollTo({ top: 0 }), [view]);

  return (
    <div ref={scroller} className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <AnimatePresence mode="wait">
        <motion.div key={view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease }} className="px-5 py-5">
          {view === "choose" && <Choose onPick={go} />}
          {view === "photo" && <PhotoFlow onBack={() => go(profile ? "result" : "choose")} onDone={() => setView("result")} />}
          {view === "quiz" && <QuizFlow onBack={() => go(profile ? "result" : "choose")} onDone={() => setView("result")} />}
          {view === "result" && <ResultView onRetake={go} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ────────────────────────────────────────────── choose */
function Choose({ onPick }: { onPick: (v: View) => void }) {
  return (
    <div>
      <h2 className="font-display text-[34px] leading-[1.02]">Let's find <em className="text-aura">your</em> colours.</h2>
      <p className="mt-3 text-sm leading-relaxed text-mist-soft">Two ways in. A selfie is the most precise; the questions need nothing but a mirror and a minute.</p>
      <div className="mt-6 space-y-3">
        <WayCard
          onClick={() => onPick("photo")}
          icon={<Camera size={17} />}
          title="Add a selfie"
          // sub="Twelve AI models read your skin, hair and neck"
          sub="We read your skin, hair and neck in seconds"
          meta={["Most accurate", "≈ 1 second"]}
          art={<SelfieArt />}
        />
        <WayCard
          onClick={() => onPick("quiz")}
          icon={<ListChecks size={17} />}
          title="Answer 7 questions"
          sub="Veins, metals, depth, hair, eyes, whites and clarity"
          meta={["No photo needed", "≈ 1 minute"]}
          art={<QuizArt />}
        />
      </div>
      <Privacy />
    </div>
  );
}

function WayCard({ onClick, icon, title, sub, meta, art }: { onClick: () => void; icon: React.ReactNode; title: string; sub: string; meta: string[]; art: React.ReactNode }) {
  return (
    <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }} onClick={onClick}
      className="group relative flex w-full items-stretch gap-4 overflow-hidden rounded-3xl border border-edge bg-white/[0.035] p-4 text-left transition hover:border-white/25 hover:bg-white/[0.06]">
      <div className="relative h-[104px] w-[86px] shrink-0 overflow-hidden rounded-2xl">{art}</div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 text-[15px] font-medium text-mist"><span className="text-mist-soft">{icon}</span>{title}</span>
        <span className="mt-1 text-xs leading-relaxed text-mist-soft">{sub}</span>
        <span className="mt-auto flex flex-wrap gap-1.5 pt-2">{meta.map((m) => <span key={m} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] text-mist-soft">{m}</span>)}</span>
      </div>
      <ArrowRight size={16} className="self-center text-mist-faint transition group-hover:translate-x-0.5 group-hover:text-mist" />
    </motion.button>
  );
}

export function SelfieArt() {
  return (
    <div className="absolute inset-0" style={{ background: "radial-gradient(70% 55% at 50% 38%, #f6d6c8 0%, #c79a86 45%, #3b2a33 100%)" }}>
      <svg viewBox="0 0 86 104" className="absolute inset-0 h-full w-full text-white/60" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3">
        <ellipse cx="43" cy="44" rx="19" ry="24" />
        <path d="M24,30 Q43,6 62,30" />
        <path d="M34,68 L34,82 M52,68 L52,82 M14,104 Q43,82 72,104" />
      </svg>
      <motion.div className="absolute inset-x-0 h-8" style={{ background: "linear-gradient(to bottom, transparent, rgba(255,255,255,.45), transparent)" }} animate={{ top: ["-20%", "100%"] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
    </div>
  );
}

export function QuizArt() {
  const rows = [["#6B8E4E", "#4A5FA8", "#2F7F7A"], ["#D4AF37", "#C0C4CA", "#C98C7A"], ["#F6E0D2", "#CD9B74", "#5E3722"], ["#D9BE7F", "#4A2C20", "#A8492A"]];
  return (
    <div className="absolute inset-0 grid grid-rows-4 gap-1 bg-night-3 p-2">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-3 gap-1">
          {r.map((c, k) => <motion.span key={c} className="rounded-md" style={{ background: c }} initial={{ opacity: 0.4 }} animate={{ opacity: [0.45, 1, 0.45] }} transition={{ duration: 3, repeat: Infinity, delay: (i * 3 + k) * 0.18 }} />)}
        </div>
      ))}
    </div>
  );
}

function Privacy() {
  return (
    <p className="mt-6 flex items-start gap-2.5 rounded-2xl border border-edge bg-white/[0.03] p-3.5 text-[11.5px] leading-relaxed text-mist-soft">
      <Lock size={14} className="mt-0.5 shrink-0 text-mist" />
      <span><span className="text-mist">Your photo never leaves your hands.</span> It stays in your browser; only a head-and-neck crop is read — in memory, then discarded. Never stored, never used for training, never shown to the stylist.</span>
    </p>
  );
}

function Back({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="mb-4 inline-flex items-center gap-1.5 text-xs text-mist-soft transition hover:text-mist"><ArrowLeft size={14} /> {label}</button>
  );
}

/* ────────────────────────────────────────────── photo */
const STAGES = [
  // { t: "Mapping 478 facial landmarks", d: "On your device · MediaPipe" },
  // { t: "Isolating hair, face & neck", d: "Graphonomy human parsing" },
  { t: "Finding your face", d: "On your device — your photo stays with you" },
  { t: "Isolating hair, face & neck", d: "Only these three regions are read" },
  { t: "Sampling skin, hair & neck tones", d: "Robust median colour per region" },
  // { t: "Twelve models read your colouring", d: "7 CNNs + 5 vision transformers" },
  { t: "Reading your colouring", d: "Undertone, depth and clarity" },
  { t: "Matching you to 12 seasons", d: "Undertone & season, fused" },
];

function PhotoFlow({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { setProfile, setGender, setPhoto } = useProfile();
  const { reportResult, pendingFile, takeFile } = useStudio();
  const [reads, setReads] = useState<FaceRead[]>([]);
  /** a photo handed over by the search bar's image button scans as soon as it passes the checks */
  const [autoRun, setAutoRun] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [stage, setStage] = useState(0);
  const [eng, setEng] = useState<Health | null | undefined>(undefined);
  const [drag, setDrag] = useState(false);
  const [camera, setCamera] = useState(false);
  const input = useRef<HTMLInputElement>(null);

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

  const addFile = async (file: Blob, auto = false) => {
    setError(null);
    setReading(true);
    try {
      const r = await readFace(file);
      if (!r.ok) setError(r.checks[r.checks.length - 1].detail);
      // else setReads((x) => [...x, r].slice(0, 3));   ← up to three photos, averaged
      // one photo per person — a new photo replaces the previous one
      else { setReads([r]); setAutoRun(auto); }
    } catch {
      setError("We couldn't open that image. Try a JPG or PNG photo.");
    } finally {
      setReading(false);
    }
  };

  const run = async () => {
    if (!reads.length) return;
    setScanning(true);
    setError(null);
    setStage(1);
    const t0 = performance.now();
    const timers = [setTimeout(() => setStage(2), 700), setTimeout(() => setStage(3), 1400), setTimeout(() => setStage(4), 2100)];
    try {
      const r = await analyze(reads.map((x) => x.crop!));
      const key = r.profile ?? profileKeyOf(r.season, r.undertone);
      prefetchProfile(key, r.gender ?? "female");
      // the theatre never runs shorter than ~3.4 s, and never holds a finished result for long
      await new Promise((ok) => setTimeout(ok, Math.max(0, 3400 - (performance.now() - t0))));
      setStage(5);
      await new Promise((ok) => setTimeout(ok, 700));
      const p: Profile = {
        profile: key, season: r.season, undertone: r.undertone, source: "scan", confidence: r.season_confidence, ranking: r.season_ranking,
        probabilities: r.probabilities, measured: r.measured, twins: r.colour_twins, photos: r.photos_used, ms: r.timings.total_ms, demo: r.demo, at: Date.now(),
      };
      setProfile(p);
      // the engine reads apparent gender from the same features; unsure → show both edits
      setGender(r.gender ?? "all");
      setPhoto({ crop: reads[0].cropUrl!, mask: r.regions?.mask });
      reportResult(p);
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong — please try again.");
      setScanning(false);
      setStage(0);
    } finally {
      timers.forEach(clearTimeout);
    }
  };

  const main = reads[0];
  const blocked = main?.checks.some((c) => !c.ok && !c.warn);
  const engineOk = !!eng && (eng.engine === "ready" || eng.engine === "demo");

  useEffect(() => {
    if (!pendingFile) return;
    const f = takeFile();
    if (f) { setScanning(false); addFile(f, true); }
  }, [pendingFile]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (autoRun && main && !blocked && engineOk && !scanning) { setAutoRun(false); run(); }
  }, [autoRun, main, blocked, engineOk, scanning]); // eslint-disable-line react-hooks/exhaustive-deps

  if (scanning && main) {
    return (
      <div>
        <div className="relative mx-auto w-full max-w-[300px] overflow-hidden rounded-t-[999px] rounded-b-[32px] shadow-lift">
          <img src={main.cropUrl!} alt="" className="aspect-square w-full object-cover" />
          <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
            {main.cropPoints.map(([x, y], i) => (
              <motion.circle key={i} cx={x} cy={y} r={0.0035} fill="white" initial={{ opacity: 0 }} animate={{ opacity: stage >= 4 ? 0.15 : [0, 0.95, 0.55] }} transition={{ delay: (i % 60) * 0.012, duration: 0.8 }} />
            ))}
          </svg>
          {stage < 5 && <motion.div className="absolute inset-x-0 h-20" style={{ background: "linear-gradient(to bottom, transparent, rgba(255,255,255,.3), transparent)" }} animate={{ top: ["-20%", "100%"] }} transition={{ duration: 1.7, repeat: Infinity, ease: "easeInOut" }} />}
          {stage >= 3 && main.samples.map((s, i) => (
            <motion.span key={s.name} className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white" style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, background: s.hex }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.1, duration: 0.4, ease }} />
          ))}
        </div>
        <p className="mt-6 font-display text-3xl">Reading your <em>colouring</em>…</p>
        <ol className="mt-5 space-y-3.5">
          {STAGES.map((s, i) => {
            const n = i + 1;
            const done = stage > n;
            const active = stage === n;
            return (
              <li key={s.t} className={`flex gap-3 transition-opacity duration-500 ${stage >= n ? "opacity-100" : "opacity-35"}`}>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors ${done ? "border-mist bg-mist text-night" : "border-white/20"}`}>
                  {done ? <Check size={13} /> : active ? <Loader2 size={13} className="animate-spin" /> : <span className="text-[11px] text-mist-faint">{n}</span>}
                </span>
                <div><p className="text-[13.5px]">{s.t}</p><p className="text-[11px] text-mist-soft">{s.d}</p></div>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <div>
      <Back onClick={onBack} />
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) addFile(f); e.target.value = ""; }} />
      {!main ? (
        <>
          <h2 className="font-display text-[30px] leading-[1.05]">Add a selfie</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-mist-soft">Front-facing, in even daylight, minimal makeup and no filters — with your hair down to your neck in frame.</p>
          <motion.div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) addFile(f); }}
            animate={{ scale: drag ? 1.015 : 1 }}
            className="relative mt-5 flex aspect-[4/5] w-full flex-col items-center justify-center overflow-hidden rounded-t-[999px] rounded-b-[32px] border border-dashed border-white/20 bg-white/[0.035] p-6 text-center"
          >
            <div className="absolute inset-0 opacity-50" style={{ background: "radial-gradient(50% 40% at 50% 35%, #f6d6c8 0%, transparent 70%), radial-gradient(40% 40% at 70% 70%, #dccdf0 0%, transparent 70%)" }} />
            <svg viewBox="0 0 200 240" className="relative w-28 text-white/30" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 4">
              <ellipse cx="100" cy="96" rx="46" ry="58" /><path d="M58,60 Q100,10 142,60" /><path d="M80,152 L80,190 M120,152 L120,190 M40,236 Q100,186 160,236" />
            </svg>
            <p className="relative mt-4 font-display text-2xl">Drop your portrait here</p>
            {/* <p className="relative mt-1 text-xs text-mist-soft">JPG, PNG or HEIC · up to 3 photos</p> */}
            <p className="relative mt-1 text-xs text-mist-soft">One clear photo · JPG, PNG or HEIC</p>
            <div className="relative mt-5 flex flex-wrap justify-center gap-2">
              <button onClick={() => input.current?.click()} className="btn-light !px-5 !py-2.5 !text-[13px]" disabled={reading}>{reading ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />} Choose photo</button>
              <button onClick={() => setCamera(true)} className="btn-ghost !px-5 !py-2.5 !text-[13px]" disabled={reading}><Camera size={15} /> Camera</button>
            </div>
          </motion.div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-[120px_1fr] gap-4">
            <div className="relative overflow-hidden rounded-t-[999px] rounded-b-2xl">
              <img src={main.cropUrl!} alt="Your head-and-neck crop" className="aspect-square w-full object-cover" />
              {main.samples.map((s) => <span key={s.name} className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white" style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, background: s.hex }} />)}
            </div>
            <ul className="space-y-2">
              {main.checks.map((c) => (
                <li key={c.id} className="flex gap-2 text-[12.5px]">
                  <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full ${c.ok && !c.warn ? "bg-[#13312a] text-[#7fd8b5]" : "bg-[#33240f] text-[#f0bf73]"}`}>{c.ok && !c.warn ? <Check size={10} /> : <AlertTriangle size={9} />}</span>
                  <span className="leading-snug">{c.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-2 text-[11px] text-mist-faint">This crop is all that leaves your device.</p>
          {/* Extra photos (up to three, averaged) are retired — one photo per person.
          <div className="mt-4 flex gap-2">
            {reads.map((r, i) => (
              <div key={i} className="group relative h-14 w-14 overflow-hidden rounded-xl">
                <img src={r.cropUrl!} alt="" className="h-full w-full object-cover" />
                <button onClick={() => setReads((x) => x.filter((_, k) => k !== i))} aria-label="Remove photo" className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 opacity-0 transition group-hover:opacity-100"><X size={10} /></button>
              </div>
            ))}
            {reads.length < 3 && (
              <button onClick={() => input.current?.click()} disabled={reading} title="Add another photo for a steadier read" className="grid h-14 w-14 place-items-center rounded-xl border border-dashed border-white/25 text-mist-soft transition hover:border-white/50 hover:text-mist">
                {reading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={16} />}
              </button>
            )}
          </div> */}
          <button onClick={run} disabled={blocked || !engineOk} className="btn-aura mt-5 w-full !py-3.5"><Sparkles size={16} /> Analyse my colouring</button>
          {/* <button onClick={() => setReads([])} className="btn-ghost mt-2 w-full !py-2.5 !text-[13px]"><RefreshCw size={14} /> Start over</button> */}
          <button onClick={() => input.current?.click()} disabled={reading} className="btn-ghost mt-2 w-full !py-2.5 !text-[13px]"><RefreshCw size={14} /> Use a different photo</button>
        </>
      )}
      <EngineLine eng={eng} />
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 flex items-start gap-2 rounded-2xl border border-[#5a3a20] bg-[#2a1a10] p-3.5 text-[13px] text-[#f2c49b]">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
          </motion.p>
        )}
      </AnimatePresence>
      <Privacy />
      {camera && <CameraSheet onClose={() => setCamera(false)} onCapture={(b) => { setCamera(false); addFile(b); }} />}
    </div>
  );
}

function EngineLine({ eng }: { eng: Health | null | undefined }) {
  if (eng === undefined) return null;
  const s = !eng ? { c: "#d97757", t: "Analysis service unreachable — try the seven questions." } :
    // eng.engine === "ready" ? { c: "#4f9d7e", t: `Engine ready · ${eng.total} models on ${eng.device?.toUpperCase()}` } :
    eng.engine === "ready" ? null :
    eng.engine === "demo" ? { c: "#c9a227", t: "Demo mode — results are illustrative." } :
    eng.engine === "error" ? { c: "#d97757", t: "Engine unavailable — try the seven questions." } :
    // { c: "#c9a227", t: `Warming up · ${eng.loaded}/${eng.total} models loaded` };
    { c: "#c9a227", t: "Getting ready — this takes a few seconds" };
  // nothing to say when the engine is ready — the line only appears when something needs attention
  if (!s) return null;
  return (
    <p className="mt-4 flex items-center gap-2 text-[11.5px] text-mist-soft">
      <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: s.c }} /><span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: s.c }} /></span>
      {s.t}
    </p>
  );
}

function CameraSheet({ onClose, onCapture }: { onClose: () => void; onCapture: (b: Blob) => void }) {
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[80] grid place-items-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-[32px] border border-edge bg-night-2">
        <div className="relative aspect-[3/4] bg-black">
          <video ref={video} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
          <svg viewBox="0 0 300 400" className="pointer-events-none absolute inset-0 h-full w-full" fill="none" stroke="white" strokeOpacity=".75" strokeWidth="1.5" strokeDasharray="5 6">
            <ellipse cx="150" cy="165" rx="78" ry="100" /><path d="M95,300 Q150,262 205,300" />
          </svg>
          {err && <p className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-2xl bg-black/70 p-4 text-center text-sm">{err}</p>}
          <p className="absolute inset-x-0 bottom-4 text-center text-xs text-white/85">Fit your hair and neck inside the guide · face a window</p>
        </div>
        <div className="flex items-center justify-between p-4">
          <button onClick={onClose} className="btn-ghost !px-5">Cancel</button>
          <button onClick={snap} disabled={!!err} aria-label="Take photo" className="grid h-16 w-16 place-items-center rounded-full border-4 border-white/10 bg-mist text-night"><Camera size={22} /></button>
          <span className="w-[84px]" />
        </div>
      </div>
    </motion.div>
  );
}

/* ────────────────────────────────────────────── seven questions */
function QuizFlow({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { setProfile } = useProfile();
  const { reportResult } = useStudio();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<number | null>(null);
  const q = QUIZ7[step];

  const pick = (oi: number) => {
    if (picked !== null) return;
    setPicked(oi);
    const next = { ...answers, [q.id]: oi };
    setAnswers(next);
    setTimeout(() => {
      setPicked(null);
      if (step + 1 < QUIZ7.length) { setStep(step + 1); return; }
      const r = scoreQuiz7(next);
      const key = profileKeyOf(r.season.name, r.undertone);
      const p: Profile = { profile: key, season: r.season.name, undertone: r.undertone, source: "quiz", confidence: r.confidence, ranking: r.ranking, at: Date.now() };
      setProfile(p);
      prefetchProfile(key, "female");
      reportResult(p);
      onDone();
    }, 260);
  };

  return (
    <div>
      <Back onClick={() => (step ? setStep(step - 1) : onBack())} label={step ? "Previous question" : "Back"} />
      <div className="flex items-center gap-1">
        {QUIZ7.map((_, i) => (
          <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
            <motion.span className="block h-full rounded-full bg-mist" initial={false} animate={{ width: i < step ? "100%" : i === step ? "45%" : "0%" }} transition={{ duration: 0.5, ease }} />
          </span>
        ))}
      </div>
      <p className="eyebrow mt-5 !text-[10px]">Question {step + 1} of {QUIZ7.length}</p>
      <AnimatePresence mode="wait">
        <motion.div key={q.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.35, ease }}>
          <h2 className="mt-2 font-display text-[26px] leading-[1.12]">{q.prompt}</h2>
          <p className="mt-2 text-xs leading-relaxed text-mist-soft">{q.why}</p>
          <div className={`mt-5 grid gap-2.5 ${q.art === "mosaic" ? "grid-cols-1" : "grid-cols-3"}`}>
            {q.options.map((o, oi) => {
              const chosen = picked === oi || (picked === null && answers[q.id] === oi);
              return (
                <motion.button
                  key={o.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: oi * 0.035, duration: 0.35, ease }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => pick(oi)}
                  className={`group rounded-2xl border p-1.5 text-left transition ${chosen ? "border-mist bg-white/[0.09]" : "border-edge bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"} ${q.art === "mosaic" ? "flex items-center gap-3" : ""}`}
                >
                  <div className={`relative overflow-hidden rounded-xl ${q.art === "mosaic" ? "h-16 w-28 shrink-0" : "aspect-square w-full"}`}>
                    <OptionArt art={q.art} o={o} />
                    {chosen && <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-mist text-night"><Check size={11} /></span>}
                  </div>
                  <span className={`block px-1 pb-1 pt-2 text-[11.5px] leading-tight ${chosen ? "text-mist" : "text-mist-soft group-hover:text-mist"} ${q.art === "mosaic" ? "!p-0 text-[13px]" : "text-center"}`}>{o.label}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const SKIN = "#E3BB9C";
export function OptionArt({ art, o }: { art: Q7Art; o: Q7Option }) {
  const hex = o.swatch ?? "#888";
  if (art === "mosaic") {
    return <div className="grid h-full w-full grid-cols-3 grid-rows-2">{(o.swatches ?? []).map((c) => <span key={c} style={{ background: c }} />)}</div>;
  }
  if (art === "vein") {
    const unsure = Object.keys(o.score).length === 0;
    return (
      <div className="h-full w-full" style={{ background: `radial-gradient(120% 90% at 40% 30%, ${shade(SKIN, 0.25)}, ${SKIN} 55%, ${shade(SKIN, -0.12)})` }}>
        {unsure ? (
          <span className="grid h-full w-full place-items-center font-display text-3xl text-black/35">?</span>
        ) : (
          <svg viewBox="0 0 100 100" className="h-full w-full" fill="none" stroke={hex} strokeLinecap="round" strokeOpacity=".7">
            <path d="M30,100 C34,70 40,50 38,0" strokeWidth="3" />
            <path d="M62,100 C58,72 66,46 70,0" strokeWidth="2.6" />
            <path d="M38,58 C46,50 56,52 64,44" strokeWidth="1.8" />
            <path d="M36,28 C26,20 20,10 18,0" strokeWidth="1.4" />
          </svg>
        )}
      </div>
    );
  }
  if (art === "metal") {
    return <div className="h-full w-full" style={{ background: `linear-gradient(135deg, rgba(255,255,255,.55) 0%, transparent 32%, transparent 60%, rgba(255,255,255,.25) 72%, transparent 85%), linear-gradient(135deg, ${shade(hex, 0.25)}, ${hex} 50%, ${shade(hex, -0.35)})` }} />;
  }
  if (art === "hair") {
    return <div className="h-full w-full" style={{ background: `repeating-linear-gradient(100deg, rgba(255,255,255,.10) 0 1.5px, transparent 1.5px 6px), linear-gradient(165deg, ${shade(hex, 0.22)}, ${hex} 45%, ${shade(hex, -0.4)})` }} />;
  }
  if (art === "eye") {
    return (
      <div className="h-full w-full" style={{ background: SKIN }}>
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <defs>
            <radialGradient id={`iris-${hex.slice(1)}`}><stop offset="0%" stopColor={shade(hex, -0.5)} /><stop offset="45%" stopColor={hex} /><stop offset="100%" stopColor={shade(hex, -0.45)} /></radialGradient>
          </defs>
          <path d="M8,52 Q50,14 92,52 Q50,86 8,52 Z" fill="#F6F1EC" />
          <circle cx="50" cy="51" r="20" fill={`url(#iris-${hex.slice(1)})`} />
          <circle cx="50" cy="51" r="7.5" fill="#0b0b0d" />
          <circle cx="56" cy="45" r="3.2" fill="#fff" opacity=".9" />
          <path d="M8,52 Q50,14 92,52" fill="none" stroke="#2b1e1a" strokeWidth="2.5" />
        </svg>
      </div>
    );
  }
  if (art === "white") {
    return <div className="h-full w-full ring-1 ring-inset ring-black/10" style={{ background: `linear-gradient(160deg, ${shade(hex, 0.3)}, ${hex} 60%, ${shade(hex, -0.05)})` }} />;
  }
  // skin depth
  return <div className="h-full w-full" style={{ background: `radial-gradient(110% 90% at 35% 25%, ${shade(hex, 0.18)}, ${hex} 55%, ${shade(hex, -0.12)})` }} />;
}

/* ────────────────────────────────────────────── result */
function ResultView({ onRetake }: { onRetake: (v: View) => void }) {
  const { profile, colour, gender, setGender } = useProfile();
  const navigate = useNavigate();
  if (!profile) return null;
  const s = SEASON_BY_NAME[profile.season];
  const cp = colour ?? PROFILES[profile.profile ?? profileKeyOf(profile.season, profile.undertone)];
  const u = UNDERTONE_COPY[profile.undertone];
  const ranking = profile.ranking ?? [];

  return (
    <div>
      {profile.demo && <p className="mb-4 flex items-center gap-2 rounded-2xl border border-[#5c4a1c] bg-[#2b2410] p-3 text-xs text-[#ead08a]"><AlertTriangle size={14} /> Demo mode — illustrative result.</p>}
      <div className="relative overflow-hidden rounded-[26px] border border-edge p-5">
        <motion.div className="absolute inset-0 opacity-40" style={{ background: s ? gradientCss(s.gradient, 140) : profileGradient(cp, 140) }} initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} transition={{ duration: 1.2 }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-night-2/40 to-night-2/90" />
        <div className="relative">
          <p className="eyebrow !text-[10px]">Your seasonal colour</p>
          <motion.h2 initial={{ opacity: 0, y: 14, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.9, ease }} className="display mt-2 text-[46px]">
            {profile.season}
          </motion.h2>
          {s && <p className="mt-1 font-display text-lg italic text-mist-soft">{s.tagline}</p>}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {cp.colours.slice(0, 8).map((c, i) => (
              <motion.span key={c.hex + c.name} title={`${c.name} · ${c.hex}`} className="h-7 w-7 rounded-full ring-1 ring-white/15" style={{ background: c.hex }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 + i * 0.05, type: "spring", stiffness: 300, damping: 18 }} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-edge bg-white/[0.035] p-4">
          <p className="eyebrow !text-[9.5px]">Skin undertone</p>
          <p className="mt-1.5 font-display text-[28px] leading-none">{profile.undertone}</p>
          <p className="mt-2 text-[11px] leading-relaxed text-mist-soft">{u.metals}</p>
        </div>
        <div className="rounded-2xl border border-edge bg-white/[0.035] p-4">
          <p className="eyebrow !text-[9.5px]">Profile</p>
          <p className="mt-1.5 font-display text-[28px] leading-none">{cp.family}</p>
          <p className="mt-2 text-[11px] leading-relaxed text-mist-soft">{cp.mood}</p>
        </div>
      </div>

      {ranking.length > 0 && (
        <div className="mt-2.5 rounded-2xl border border-edge bg-white/[0.035] p-4">
          <p className="eyebrow !text-[9.5px]">Closest seasons</p>
          <div className="mt-3 space-y-2.5">
            {ranking.map((x) => (
              <div key={x.season}>
                <div className="mb-1 flex justify-between text-[11.5px]"><span className="text-mist-soft">{x.season}</span><span className="tabular-nums text-mist">{Math.round(x.p * 100)}%</span></div>
                <div className="h-1 overflow-hidden rounded-full bg-white/[0.07]">
                  <motion.div className="h-full rounded-full" style={{ background: SEASON_BY_NAME[x.season]?.gradient[1] ?? "#EEEAE4" }} initial={{ width: 0 }} animate={{ width: `${x.p * 100}%` }} transition={{ duration: 1, ease }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-[11px] text-mist-faint">
        {profile.source === "scan"
          ? `From your selfie${profile.ms ? ` · read in ${(profile.ms / 1000).toFixed(2)} s` : ""}${profile.photos ? ` · ${profile.photos} photo${profile.photos > 1 ? "s" : ""}` : ""}`
          : "From your seven answers — a selfie scan will sharpen it."}
      </p>

      <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-edge bg-white/[0.03] px-4 py-3">
        <span className="text-xs text-mist-soft">Show looks for</span>
        <GenderToggle value={gender} onChange={setGender} />
      </div>

      <button onClick={() => navigate("/for-you")} className="btn-light mt-4 w-full !py-3.5 text-[15px]">Open my edit <ArrowRight size={16} /></button>
      <button onClick={() => navigate("/")} className="btn-ghost mt-2 w-full !py-3"><MessageCircle size={15} /> Ask the stylist</button>

      <div className="mt-5 flex items-center justify-center gap-4 text-xs text-mist-soft">
        <button onClick={() => onRetake("photo")} className="inline-flex items-center gap-1.5 hover:text-mist"><Camera size={13} /> Scan a selfie</button>
        <span className="h-3 w-px bg-edge" />
        <button onClick={() => onRetake("quiz")} className="inline-flex items-center gap-1.5 hover:text-mist"><ListChecks size={13} /> Retake questions</button>
      </div>
    </div>
  );
}
