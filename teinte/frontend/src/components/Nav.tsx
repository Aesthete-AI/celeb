import { AnimatePresence, motion } from "framer-motion";
import { Menu, MessageSquare, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { profileGradient } from "../data/profiles";
import { useProfile } from "../lib/profile";
import { useShell } from "../lib/shell";
import { ease } from "./ui";

const LINKS = [
  { to: "/analyze", label: "Analyse" },
  { to: "/for-you", label: "Your Edit" },
  { to: "/palette", label: "Palette" },
  { to: "/seasons", label: "Seasons" },
  { to: "/wardrobe", label: "Wardrobe Check" },
];

export default function Nav() {
  const { colour, chatOpen, setChatOpen } = useProfile();
  const { setShell } = useShell();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 12);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);

  return (
    <header className={`sticky top-0 z-40 transition-all duration-500 ${scrolled ? "border-b border-edge bg-night/70 backdrop-blur-2xl" : "bg-transparent"}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-10">
        <Link to="/" className="flex items-baseline">
          <span className="font-display text-[32px] leading-none tracking-tight">Teinte</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => `relative rounded-full px-3.5 py-2 text-[13px] transition-colors ${isActive ? "text-mist" : "text-mist-soft hover:text-mist"}`}>
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="nav-active" className="absolute inset-0 -z-10 rounded-full border border-edge bg-white/[0.06]" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                  {l.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {colour && (
            <Link to="/for-you" className="hidden items-center gap-2 rounded-full border border-edge bg-white/[0.04] py-1 pl-1 pr-3 text-xs text-mist-soft transition hover:text-mist sm:flex" title="Your colour profile">
              <span className="h-6 w-6 rounded-full" style={{ background: profileGradient(colour) }} />
              {colour.family} · {colour.undertone}
            </Link>
          )}
          {/* back to the new chat-first interface */}
          <button onClick={() => { setChatOpen(false); setShell("studio"); }} title="Back to the Studio interface" className="hidden items-center gap-1.5 rounded-full border border-edge bg-white/[0.04] px-3.5 py-2 text-[12.5px] text-mist-soft transition hover:border-white/25 hover:text-mist sm:flex">
            <MessageSquare size={14} /> Studio
          </button>
          <button
            onClick={() => setChatOpen(!chatOpen)}
            aria-pressed={chatOpen}
            className={`group relative flex items-center gap-2 overflow-hidden rounded-full px-4 py-2 text-[13px] font-medium transition ${chatOpen ? "bg-mist text-night" : "text-night"}`}
          >
            {!chatOpen && <span className="absolute inset-0 -z-10 animate-sheen" style={{ background: "linear-gradient(110deg,#f4b39a,#c9a7f0 25%,#9fe0cc 50%,#e9cf95 75%,#f4b39a)", backgroundSize: "200% 100%" }} />}
            <Sparkles size={15} className="transition group-hover:rotate-12" />
            <span>Stylist</span>
          </button>
          <button className="grid h-9 w-9 place-items-center rounded-full text-mist md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease }} className="overflow-hidden border-t border-edge bg-night/95 backdrop-blur md:hidden">
            <div className="flex flex-col px-4 py-3">
              {LINKS.map((l) => (
                <NavLink key={l.to} to={l.to} className={({ isActive }) => `py-3 font-display text-2xl ${isActive ? "text-mist" : "text-mist-soft"}`}>{l.label}</NavLink>
              ))}
              <button onClick={() => setShell("studio")} className="py-3 text-left font-display text-2xl text-mist-soft">← Studio</button>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
