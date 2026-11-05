// The one search box. Large and centred on the welcome screen, docked at the bottom everywhere else —
// always in the middle of the content column. What it does depends on the tab: on Chat it asks the
// stylist; on Your Edit it re-points the recommendations on screen.
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Check, ImagePlus, Loader2, Mic, Search, Sparkles, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDictation } from "../lib/voice";
import { CATEGORIES } from "../data/profiles";
import { ease } from "../components/ui";
import { useStudio, type SendMode } from "./StudioContext";

const PLACEHOLDER: Record<SendMode, string[]> = {
  chat: [
    "Ask about outfits, makeup, hair or jewellery…",
    "What should I wear to a wedding this weekend?",
    "Which colours make me look most awake?",
    "Gold or silver — which suits me?",
  ],
  edit: [
    "Search your edit — try “wedding guest”, “office” or “gold jewellery”",
    "Show me date-night looks",
    "Beach holiday outfits",
  ],
};

/** photo — show the image button (Home only): it opens the device's file picker and sends the chosen
 *  selfie straight into the analysis panel. */
export default function Composer({ mode, hero = false, autoFocus = false, photo = false }: { mode: SendMode; hero?: boolean; autoFocus?: boolean; photo?: boolean }) {
  const { send, busy, stop, openAnalysis, sendPhoto, scanning } = useStudio();
  const [value, setValue] = useState("");
  // ── attached photo (shown inside the box, sent with the message, read like a selfie scan)
  const [attached, setAttached] = useState<{ file: File; url: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const attachInput = useRef<HTMLInputElement>(null);
  const attach = (f: File | null | undefined) => {
    if (!f || !f.type.startsWith("image/")) return;
    if (attached) URL.revokeObjectURL(attached.url);
    setAttached({ file: f, url: URL.createObjectURL(f) });
    ta.current?.focus();
  };
  const detach = () => { if (attached) URL.revokeObjectURL(attached.url); setAttached(null); };
  // ── voice: the words appear in the box as they are spoken, and are corrected by a final pass on stop
  const base = useRef("");
  const voice = useDictation((text, final) => {
    const joined = [base.current.trimEnd(), text.trim()].filter(Boolean).join(" ");
    setValue(joined);
    if (final) { base.current = ""; requestAnimationFrame(() => ta.current?.focus()); }
  });
  const recording = voice.state === "recording" || voice.state === "starting";
  const startVoice = () => { base.current = value; voice.start(); };
  const cancelVoice = () => { voice.cancel(); setValue(base.current); };
  const [toast, setToast] = useState<string | null>(null);
  const [ph, setPh] = useState(0);
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // the placeholder slowly rotates through example questions while the box is empty
  useEffect(() => {
    if (value) return;
    const t = setInterval(() => setPh((x) => x + 1), 4200);
    return () => clearInterval(t);
  }, [value]);
  useEffect(() => { if (autoFocus && window.matchMedia("(min-width: 1024px)").matches) ta.current?.focus(); }, [autoFocus]);
  // grow with the text, up to a limit
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); }, [toast]);

  const submit = () => {
    if (busy || scanning || recording || voice.state === "finishing") return;
    if (attached) {
      sendPhoto(attached.file, value);
      setAttached(null);
      setValue("");
      return;
    }
    if (!value.trim()) return;
    const r = send(value, mode);
    setValue("");
    if (mode === "edit" && r) setToast(r.section ? `Showing ${CATEGORIES[r.section].title}` : "Showing your full edit");
  };
  const placeholders = PLACEHOLDER[mode];
  const placeholder = placeholders[ph % placeholders.length];

  return (
    <div className="relative w-full">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.3, ease }}
            className="absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-edge bg-night-3/90 px-4 py-1.5 text-xs text-mist shadow-lift backdrop-blur">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {voice.error && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.3, ease }}
            className="absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#5a3a20] bg-[#2a1a10]/95 px-4 py-1.5 text-xs text-[#f2c49b] shadow-lift backdrop-blur">
            {voice.error}
          </motion.div>
        )}
      </AnimatePresence>
      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); attach(e.dataTransfer.files?.[0]); }}
        className={`group relative rounded-[30px] p-px transition-shadow duration-500 focus-within:shadow-[0_0_60px_-12px_rgba(201,167,240,.55)] ${hero ? "shadow-[0_30px_80px_-30px_rgba(0,0,0,.9)]" : ""}`}
        style={{ background: "linear-gradient(110deg, rgba(244,179,154,.55), rgba(201,167,240,.55) 45%, rgba(159,224,204,.55))" }}
      >
        <div className={`relative rounded-[29px] bg-night-2/95 backdrop-blur-2xl ${hero ? "px-3 py-3 sm:px-4 sm:py-3.5" : "px-2.5 py-2.5"}`}>
        {dragging && <div className="pointer-events-none absolute inset-1 z-10 grid place-items-center rounded-[26px] border border-dashed border-white/30 bg-night-2/90 text-sm text-mist">Drop your photo to attach it</div>}
        <AnimatePresence initial={false}>
          {attached && (
            <motion.div key="att" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease }} className="overflow-hidden">
              <div className="flex items-center gap-3 px-1.5 pb-2.5 pt-0.5">
                <div className="group/att relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/15">
                  <img src={attached.url} alt="Attached photo" className="h-full w-full object-cover" />
                  <button type="button" onClick={detach} aria-label="Remove photo" title="Remove photo"
                    className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white transition hover:bg-black"><X size={11} /></button>
                </div>
                <div className="min-w-0 text-xs leading-relaxed">
                  <p className="truncate text-mist">{attached.file.name || "Photo"}</p>
                  <p className="text-mist-faint">I'll read your undertone and season from it. Only a head-and-neck crop leaves your device.</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex items-end gap-2">
          {/* the image button used to sit here on every search box and only opened the panel
          <button type="button" onClick={() => openAnalysis("photo")} title="Add a selfie for analysis" aria-label="Add a selfie for analysis"
            className={`grid shrink-0 place-items-center rounded-full border border-edge bg-white/[0.04] text-mist-soft transition hover:border-white/25 hover:text-mist ${hero ? "h-11 w-11" : "h-9 w-9"}`}>
            <ImagePlus size={hero ? 18 : 16} />
          </button> */}
          {/* <span className="w-1.5 shrink-0" /> */}
          <input ref={attachInput} type="file" accept="image/*" hidden onChange={(e) => { attach(e.target.files?.[0]); e.target.value = ""; }} />
          <button type="button" onClick={() => attachInput.current?.click()} disabled={recording} title="Add a photo" aria-label="Add a photo"
            className={`grid shrink-0 place-items-center rounded-full border border-edge bg-white/[0.04] text-mist-soft transition hover:border-white/25 hover:text-mist disabled:opacity-30 ${hero ? "h-11 w-11" : "h-9 w-9"}`}>
            <ImagePlus size={hero ? 18 : 16} />
          </button>
          <div className="relative min-w-0 flex-1 self-center">
            {mode === "edit" && <Search size={15} className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-mist-faint" />}
            <textarea
              ref={ta}
              value={value}
              rows={1}
              onChange={(e) => setValue(e.target.value)}
              onPaste={(e) => { const f = [...e.clipboardData.files].find((x) => x.type.startsWith("image/")); if (f) { e.preventDefault(); attach(f); } }}
              readOnly={recording}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
              aria-label={mode === "edit" ? "Search your edit" : "Ask the stylist"}
              className={`block w-full resize-none bg-transparent text-mist outline-none placeholder:text-transparent ${hero ? "py-2 text-[16px] sm:text-[17px]" : "py-1.5 text-[15px]"} ${mode === "edit" ? "pl-6" : "pl-1"}`}
            />
            {!value && recording && (
              <span className={`pointer-events-none absolute inset-y-0 left-1 right-0 flex items-center text-mist-soft ${hero ? "text-[16px] sm:text-[17px]" : "text-[15px]"}`}>
                {voice.state === "starting" ? "Starting the microphone…" : "Listening — start speaking"}
              </span>
            )}
            {!value && !recording && (
              <AnimatePresence mode="wait">
                <motion.span
                  key={placeholder}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35, ease }}
                  className={`pointer-events-none absolute inset-y-0 flex items-center truncate text-mist-faint ${hero ? "text-[16px] sm:text-[17px]" : "text-[15px]"} ${mode === "edit" ? "left-6" : "left-1"} right-0`}
                >
                  {placeholder}
                </motion.span>
              </AnimatePresence>
            )}
          </div>
          {false && photo && (   /* the Home-only image button — superseded by the attach button on the left */
            <>
              <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) openAnalysis("photo", f); e.target.value = ""; }} />
              <button type="button" onClick={() => fileInput.current?.click()} title="Upload a selfie from your device" aria-label="Upload a selfie from your device"
                className={`grid shrink-0 place-items-center rounded-full text-mist-soft transition hover:bg-white/[0.07] hover:text-mist ${hero ? "h-11 w-11" : "h-9 w-9"}`}>
                <ImagePlus size={hero ? 19 : 17} />
              </button>
            </>
          )}
          {recording ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <Wave level={voice.level} />
              <span className="w-9 text-right text-xs tabular-nums text-mist-soft">{Math.floor(voice.seconds / 60)}:{String(Math.floor(voice.seconds % 60)).padStart(2, "0")}</span>
              <button type="button" onClick={cancelVoice} aria-label="Cancel voice input" title="Cancel"
                className={`grid shrink-0 place-items-center rounded-full border border-edge text-mist-soft transition hover:border-white/25 hover:text-mist ${hero ? "h-11 w-11" : "h-9 w-9"}`}>
                <X size={16} />
              </button>
              <button type="button" onClick={voice.stop} disabled={voice.state !== "recording"} aria-label="Finish voice input" title="Done"
                className={`grid shrink-0 place-items-center rounded-full bg-mist text-night transition hover:bg-white disabled:opacity-40 ${hero ? "h-11 w-11" : "h-9 w-9"}`}>
                <Check size={17} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={startVoice} disabled={voice.state === "finishing" || busy || scanning} aria-label="Speak your question" title="Speak"
              className={`grid shrink-0 place-items-center rounded-full text-mist-soft transition hover:bg-white/[0.07] hover:text-mist disabled:opacity-40 ${hero ? "h-11 w-11" : "h-9 w-9"}`}>
              {voice.state === "finishing" ? <Loader2 size={hero ? 18 : 17} className="animate-spin" /> : <Mic size={hero ? 19 : 17} />}
            </button>
          )}
          {recording ? null : busy ? (
            <button type="button" onClick={stop} aria-label="Stop answering" title="Stop"
              className={`grid shrink-0 place-items-center rounded-full bg-mist text-night transition hover:bg-white ${hero ? "h-11 w-11" : "h-9 w-9"}`}>
              <Square size={13} fill="currentColor" />
            </button>
          ) : (
            <button type="submit" disabled={(!value.trim() && !attached) || scanning || voice.state === "finishing"} aria-label={mode === "edit" && !attached ? "Search" : "Send"}
              className={`grid shrink-0 place-items-center rounded-full bg-mist text-night transition hover:bg-white disabled:bg-white/10 disabled:text-mist-faint ${hero ? "h-11 w-11" : "h-9 w-9"}`}>
              {mode === "edit" && !attached ? <Sparkles size={16} /> : <ArrowUp size={hero ? 19 : 17} />}
            </button>
          )}
        </div>
        </div>
      </form>
    </div>
  );
}

/** Live input level as a small moving waveform. */
function Wave({ level }: { level: number }) {
  const shape = [0.45, 0.8, 1, 0.7, 0.5, 0.85, 0.6];
  return (
    <span className="flex h-6 items-center gap-[3px]" aria-hidden>
      {shape.map((k, i) => (
        <motion.span key={i} className="w-[3px] rounded-full bg-gradient-to-t from-aura-lilac to-aura-peach"
          animate={{ height: Math.max(3, Math.min(22, 3 + level * 26 * k * (0.75 + Math.random() * 0.5))) }}
          transition={{ duration: 0.12, ease: "easeOut" }} />
      ))}
    </span>
  );
}
