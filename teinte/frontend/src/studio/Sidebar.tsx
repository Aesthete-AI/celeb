// Left rail: a menu button that expands and collapses it (as in Gemini), New chat, Home, History and
// Recents — and at the foot, About and the person (settings) button. Collapsed, it shrinks to an icon
// rail; on phones and tablets it slides in as a drawer.
import { AnimatePresence, motion } from "framer-motion";
import { /* BarChart3, ChevronRight, */ Clock, Home, Info, Menu, MessageSquare, PenLine, Trash2, UserRound, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
// import { profileGradient } from "../data/profiles";
import { ease } from "../components/ui";
// import { useProfile } from "../lib/profile";
import { useThreads } from "../lib/threads";
import { ANALYSE, useStudio } from "./StudioContext";

export const SIDEBAR_W = 272;
export const RAIL_W = 72;

export default function Sidebar() {
  const { drawer, setDrawer, railOpen } = useStudio();
  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: railOpen ? SIDEBAR_W : RAIL_W }}
        transition={{ duration: 0.4, ease }}
        className="fixed inset-y-0 left-0 z-40 hidden overflow-hidden border-r border-edge bg-night-2/70 backdrop-blur-2xl lg:block"
      >
        <Rail open={railOpen} />
      </motion.aside>
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div key="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm lg:hidden" />
            <motion.aside key="drawer" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ duration: 0.45, ease }}
              className="fixed inset-y-0 left-0 z-[60] w-[86vw] max-w-[320px] border-r border-edge bg-night-2 lg:hidden">
              <Rail open mobile />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function Rail({ open, mobile = false }: { open: boolean; mobile?: boolean }) {
  const { newChat, openThread, threadId, setDrawer, setModal, railOpen, setRailOpen } = useStudio();
  // const { analysisOpen, toggleAnalysis } = useStudio();
  const { threads, remove } = useThreads();
  // const { colour, profile } = useProfile();
  const loc = useLocation();
  const navigateHome = () => setDrawer(false);
  const onAnalyse = loc.pathname === ANALYSE;
  const recents = threads.filter((t) => t.msgs.length).slice(0, 10);

  return (
    <div className="flex h-full flex-col px-3 pb-3 pt-3" style={{ width: mobile ? "100%" : open ? SIDEBAR_W : RAIL_W }}>
      <div className="flex h-12 items-center gap-1">
        {mobile ? (
          <button onClick={() => setDrawer(false)} aria-label="Close menu" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-mist-soft transition hover:bg-white/[0.06] hover:text-mist"><X size={18} /></button>
        ) : (
          <button onClick={() => setRailOpen(!railOpen)} aria-label={railOpen ? "Collapse menu" : "Expand menu"} title={railOpen ? "Collapse menu" : "Expand menu"} aria-expanded={railOpen}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-mist-soft transition hover:bg-white/[0.06] hover:text-mist">
            <Menu size={19} />
          </button>
        )}
        <AnimatePresence initial={false}>
          {open && (
            <motion.span key="wm" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.25 }}>
              <Link to="/" onClick={navigateHome} className="ml-1 block font-display text-[28px] leading-none tracking-tight">Teinte</Link>
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4">
        <button onClick={newChat} title={open ? undefined : "New chat"} aria-label="New chat"
          className={`flex h-11 items-center gap-3 rounded-full border border-edge bg-white/[0.04] text-[13.5px] text-mist transition hover:border-white/20 hover:bg-white/[0.07] ${open ? "w-full px-4" : "w-11 justify-center"}`}>
          <PenLine size={16} className="shrink-0" />
          {open && <span className="truncate">New chat</span>}
        </button>
      </div>

      <nav className="mt-4 space-y-0.5">
        <RailItem open={open} icon={<Home size={18} />} label="Home" active={loc.pathname === "/"} to="/" onClick={navigateHome} />
        <RailItem open={open} icon={<Clock size={18} />} label="History" active={loc.pathname === "/history"} to="/history" onClick={navigateHome} />
      </nav>

      {open ? (
        <>
          <p className="eyebrow mt-7 px-3 !text-[9.5px]">Recents</p>
          <div className="scroll-thin mt-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-0.5">
            {recents.length === 0 && <p className="px-3 py-2 text-xs leading-relaxed text-mist-faint">Your conversations will appear here. They stay on this device.</p>}
            <AnimatePresence initial={false}>
              {recents.map((t) => {
                const on = onAnalyse && t.id === threadId;
                return (
                  <motion.div key={t.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease }} className="group relative">
                    <button onClick={() => openThread(t.id)} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] transition ${on ? "bg-white/[0.08] text-mist" : "text-mist-soft hover:bg-white/[0.04] hover:text-mist"}`}>
                      <MessageSquare size={14} className="shrink-0 opacity-60" />
                      <span className="truncate pr-5">{t.title}</span>
                    </button>
                    <button onClick={() => remove(t.id)} aria-label={`Delete “${t.title}”`} title="Delete"
                      className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-mist-faint opacity-0 transition hover:bg-white/[0.08] hover:text-mist focus:opacity-100 group-hover:opacity-100">
                      <Trash2 size={13} />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </>
      ) : (
        <div className="flex-1" />
      )}

      <div className={`mt-3 border-t border-edge pt-3 ${open ? "" : "space-y-1"}`}>
        {/* The Analysis button lived here. It did what Your Edit and the Analyse tab already do, so it is
            retired; the analysis panel opens from the Home cards, the image button and the Analyse tab.
        <button onClick={toggleAnalysis} aria-pressed={analysisOpen} className="group flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition …">
          <span className="relative grid h-9 w-9 …" style={{ background: colour ? profileGradient(colour) : "…" }}><BarChart3 size={16} /></span>
          <span className="min-w-0 flex-1"><span>Analysis</span><span>{profile && colour ? `${profile.season} · ${colour.undertone}` : "Find your colours"}</span></span>
          <ChevronRight size={16} />
        </button> */}
        <div className={`flex items-center ${open ? "justify-between px-1" : "flex-col gap-1"}`}>
          <button onClick={() => setModal("about")} title={open ? undefined : "About"} aria-label="About"
            className={`flex items-center gap-2 rounded-full text-[12.5px] text-mist-soft transition hover:bg-white/[0.05] hover:text-mist ${open ? "px-2.5 py-2" : "h-11 w-11 justify-center"}`}>
            <Info size={16} /> {open && "About"}
          </button>
          <button onClick={() => setModal("settings")} title="Profile & settings" aria-label="Profile and settings" className="grid h-10 w-10 place-items-center rounded-full border border-edge bg-white/[0.04] text-mist-soft transition hover:border-white/25 hover:text-mist">
            <UserRound size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function RailItem({ open, icon, label, active, onClick, to }: { open: boolean; icon: React.ReactNode; label: string; active: boolean; onClick?: () => void; to: string }) {
  return (
    <Link to={to} onClick={onClick} title={open ? undefined : label} aria-label={label}
      className={`relative flex h-11 items-center gap-3 rounded-full text-[14px] transition ${open ? "px-3.5" : "w-11 justify-center"} ${active ? "text-mist" : "text-mist-soft hover:bg-white/[0.04] hover:text-mist"}`}>
      {active && <motion.span layoutId="rail-active" className="absolute inset-0 -z-10 rounded-full bg-white/[0.08]" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
      <span className="shrink-0">{icon}</span>
      {open && <span className="truncate">{label}</span>}
    </Link>
  );
}
