// About and Profile & settings — opened from the foot of the sidebar.
import { AnimatePresence, motion } from "framer-motion";
import { History, Lock, RotateCcw, Trash2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { ease, GenderToggle } from "../components/ui";
import { profileGradient } from "../data/profiles";
import { useProfile } from "../lib/profile";
import { useShell } from "../lib/shell";
import { useThreads } from "../lib/threads";
import { useStudio } from "./StudioContext";

export default function Modals() {
  const { modal, setModal } = useStudio();
  return (
    <AnimatePresence>
      {modal && (
        <motion.div key="m" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] grid place-items-end bg-black/60 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" onClick={() => setModal(null)}>
          <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.4, ease }}
            onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
            className="scroll-thin max-h-[88svh] w-full overflow-y-auto rounded-t-[28px] border border-edge bg-night-2 p-6 shadow-lift sm:max-w-[480px] sm:rounded-[28px] sm:p-7">
            <button onClick={() => setModal(null)} aria-label="Close" className="float-right grid h-9 w-9 place-items-center rounded-full border border-edge bg-white/[0.04] text-mist-soft transition hover:text-mist"><X size={16} /></button>
            {modal === "about" ? <About /> : <Settings />}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function About() {
  const { setModal } = useStudio();
  return (
    <div>
      <p className="eyebrow">About</p>
      <h2 className="display mt-3 text-[44px]">Teinte</h2>
      <p className="mt-3 text-sm leading-relaxed text-mist-soft">
        A personal stylist built on colour science. Teinte reads your <span className="text-mist">skin undertone</span> and <span className="text-mist">seasonal colour</span>, then recommends clothing, makeup, hair and jewellery — and every photo in your edit is ranked by how closely its colours match your palette.
      </p>
      <div className="mt-6 space-y-3">
        {[
          // ["How it reads you", "Graphonomy isolates your face, hair and neck; seven CNNs and five vision transformers each read the region, and their answers are fused into an undertone and one of twelve seasons."],
          ["How it reads you", "Teinte looks only at your face, hair and neck — the colours that decide what suits you — and places you on your undertone and one of twelve seasons."],
          ["No photo?", "Seven questions — veins, metals, skin depth, hair, eyes, whites and clarity — place you on the same three axes: temperature, value and chroma."],
          ["The stylist", "Answers from your profile's rules, never from your photo. If the AI is unreachable, it answers from Teinte's curated style rules instead."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-2xl border border-edge bg-white/[0.03] p-4">
            <p className="text-sm text-mist">{t}</p>
            <p className="mt-1 text-xs leading-relaxed text-mist-soft">{d}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-mist-soft">
        <Lock size={13} className="mt-0.5 shrink-0 text-mist" />
        Your photo stays in your browser. Only a head-and-neck crop is sent to be read — analysed in memory, then discarded. <Link to="/privacy" onClick={() => setModal(null)} className="text-mist underline decoration-white/30">Privacy</Link>
      </p>
    </div>
  );
}

function Settings() {
  const { profile, colour, gender, setGender, setProfile, setPhoto } = useProfile();
  const { clear, threads } = useThreads();
  const { setShell } = useShell();
  const { openAnalysis, setModal, newChat } = useStudio();
  return (
    <div>
      <p className="eyebrow">Profile & settings</p>
      <div className="mt-4 flex items-center gap-4">
        <span className="h-14 w-14 shrink-0 rounded-2xl" style={{ background: colour ? profileGradient(colour) : "linear-gradient(135deg,#2a2833,#15141b)" }} />
        <div>
          <p className="font-display text-2xl leading-tight">{profile ? profile.season : "No analysis yet"}</p>
          <p className="text-xs text-mist-soft">{profile && colour ? `${colour.undertone} undertone · from your ${profile.source === "scan" ? "selfie" : "answers"}` : "Add a selfie or answer seven questions"}</p>
        </div>
      </div>
      <div className="mt-6 space-y-2.5">
        <Row label="Show looks for"><GenderToggle value={gender} onChange={setGender} /></Row>
        <button onClick={() => { setModal(null); openAnalysis(profile ? "intro" : "photo"); }} className="flex w-full items-center justify-between rounded-2xl border border-edge bg-white/[0.03] px-4 py-3.5 text-left text-sm transition hover:border-white/25">
          {profile ? "View or retake my analysis" : "Run my analysis"} <span className="text-mist-faint">→</span>
        </button>
        {profile && (
          <button onClick={() => { setProfile(null); setPhoto(null); }} className="flex w-full items-center gap-2 rounded-2xl border border-edge bg-white/[0.03] px-4 py-3.5 text-left text-sm text-mist-soft transition hover:border-white/25 hover:text-mist">
            <RotateCcw size={15} /> Forget my colour profile
          </button>
        )}
        <button disabled={!threads.length} onClick={() => { clear(); newChat(); }} className="flex w-full items-center gap-2 rounded-2xl border border-edge bg-white/[0.03] px-4 py-3.5 text-left text-sm text-mist-soft transition enabled:hover:border-white/25 enabled:hover:text-mist disabled:opacity-40">
          <Trash2 size={15} /> Clear all conversations
        </button>
        <button onClick={() => { setModal(null); setShell("classic"); }} className="flex w-full items-center gap-2 rounded-2xl border border-edge bg-white/[0.03] px-4 py-3.5 text-left text-sm text-mist-soft transition hover:border-white/25 hover:text-mist">
          <History size={15} /> Switch to the Previous interface
        </button>
      </div>
      <p className="mt-5 text-[11px] leading-relaxed text-mist-faint">Everything here is stored only in this browser.</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 rounded-2xl border border-edge bg-white/[0.03] px-4 py-3"><span className="text-sm text-mist-soft">{label}</span>{children}</div>;
}
