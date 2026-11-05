// The Studio interface: sidebar on the left, tabs across the top (Chat · Your Edit · Palette ·
// Wardrobe Check · Previous), the analysis panel beside the content when open, and the search box
// always centred at the bottom of the content column.
//
// The pages behind the tabs are the same components the Previous interface uses, on the same URLs,
// so recommendations, deep links and the catalogue behave identically in both.
import { AnimatePresence, motion } from "framer-motion";
import { /* BarChart3, */ ArrowUpRight, History, Menu } from "lucide-react";
import { useEffect, useRef } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { Aurora, ease } from "../components/ui";
// import { profileGradient } from "../data/profiles";
import { useProfile } from "../lib/profile";
import { useShell } from "../lib/shell";
import { useThreads } from "../lib/threads";
import { ForYouCategory, ForYouHub } from "../pages/ForYou";
import NotFound from "../pages/NotFound";
import Palette from "../pages/Palette";
import Privacy from "../pages/Privacy";
import Seasons from "../pages/Seasons";
import Wardrobe from "../pages/Wardrobe";
import AnalysisPanel, { PANEL_W } from "./AnalysisPanel";
import ChatView from "./ChatView";
import Composer from "./Composer";
import HistoryPage from "./HistoryPage";
import Modals from "./Modals";
import Sidebar, { RAIL_W, SIDEBAR_W } from "./Sidebar";
import { ANALYSE, StudioProvider, useStudio } from "./StudioContext";
import StudioHome from "./StudioHome";
import { useDesktop } from "./useDesktop";

export default function StudioShell() {
  return (
    <StudioProvider>
      <Layout />
    </StudioProvider>
  );
}

type Tab = "chat" | "edit" | "palette" | "wardrobe";
const TABS: { id: Tab; label: string; short?: string; to: string }[] = [
  // { id: "chat", label: "Chat", to: "/" },
  { id: "chat", label: "Analyse", to: ANALYSE },
  { id: "edit", label: "Your Edit", to: "/for-you" },
  { id: "palette", label: "Palette", to: "/palette" },
  { id: "wardrobe", label: "Wardrobe Check", short: "Wardrobe", to: "/wardrobe" },
];
const tabOf = (path: string): Tab | null =>
  path === ANALYSE ? "chat" : path.startsWith("/for-you") ? "edit" : path.startsWith("/palette") || path.startsWith("/seasons") ? "palette" : path.startsWith("/wardrobe") ? "wardrobe" : null;

/** Three questions nearly everyone asks first — worded so they fit anyone. */
const STARTERS = ["Which colours suit me best?", "What should I wear to a wedding?", "Gold or silver — which suits me?"];

function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const desktop = useDesktop();
  const { analysisOpen, threadId, send, railOpen } = useStudio();
  const { colour, pending, takePending, setChatOpen } = useProfile();
  const { get } = useThreads();
  const tab = tabOf(location.pathname);

  useEffect(() => window.scrollTo({ top: 0 }), [location.pathname]);

  // Pages shared with the Previous interface call ask("…") to hand a question to the stylist.
  // Here that means: go to Chat and ask it in the open conversation.
  useEffect(() => {
    if (!pending) return;
    const q = takePending();
    setChatOpen(false);
    if (q) { navigate(ANALYSE); setTimeout(() => send(q), 120); }
  }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps

  const sideW = railOpen ? SIDEBAR_W : RAIL_W;
  // const contentLeft = desktop ? sideW + (analysisOpen ? PANEL_W : 0) : 0;
  // the side Analysis panel is retired — analysis happens inside the conversation
  const contentLeft = desktop ? sideW + (analysisOpen && false ? PANEL_W : 0) : 0;
  // const heroShowing = location.pathname === "/" && !(get(threadId)?.msgs.length);
  const onHome = location.pathname === "/";
  // the common prompts sit just above the search box on Home and on an empty Analyse tab
  // const showPrompts = onHome || (location.pathname === ANALYSE && !get(threadId)?.msgs.length);
  // Home is a pure landing page now — no search box there; the prompts sit above it on an empty Analyse tab
  const showPrompts = location.pathname === ANALYSE && !get(threadId)?.msgs.length;
  const tint = colour ? [colour.colours[0].hex, colour.colours[3].hex, colour.colours[5].hex, colour.neutrals[3].hex] : undefined;

  return (
    <>
      <div className="grain" />
      <Aurora colours={tint} />
      <Sidebar />
      {/* <AnalysisPanel left={desktop ? sideW : 0} />   ← retired: analysis now runs inside the chat */}
      {false && <AnalysisPanel left={desktop ? sideW : 0} />}

      <motion.div className="min-h-screen" initial={false} animate={{ paddingLeft: contentLeft }} transition={{ duration: 0.5, ease }}>
        <TopBar tab={tab} />
        <AnimatePresence mode="wait">
          <motion.main key={location.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.4, ease }}
            className={onHome ? "pb-20" : showPrompts ? "pb-64" : "pb-44"}>
            <Routes location={location}>
              {/* <Route path="/" element={<ChatView />} /> */}
              <Route path="/" element={<StudioHome />} />
              <Route path={ANALYSE} element={<ChatView />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/analyze" element={<OpenAnalysis />} />
              <Route path="/for-you" element={<ForYouHub />} />
              <Route path="/for-you/:category" element={<ForYouCategory />} />
              <Route path="/lookbook" element={<Navigate to="/for-you" replace />} />
              <Route path="/style/:section" element={<LegacyStyle />} />
              <Route path="/palette" element={<Palette />} />
              <Route path="/seasons" element={<Seasons />} />
              <Route path="/seasons/:id" element={<Palette />} />
              <Route path="/wardrobe" element={<Wardrobe />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </motion.main>
        </AnimatePresence>
      </motion.div>

      {/* the docked search box — at the bottom centre of the content column on every tab except Home */}
      <AnimatePresence>
        {!onHome && (
          <motion.div key="dock" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0, left: contentLeft }} exit={{ opacity: 0, y: 24 }} transition={{ duration: 0.45, ease }}
            className="pointer-events-none fixed bottom-0 right-0 z-30 px-3 pb-3 pt-10 sm:px-6 sm:pb-5"
            style={{ left: contentLeft, background: "linear-gradient(to top, rgba(8,8,11,.96) 35%, rgba(8,8,11,.75) 65%, transparent)" }}>
            <div className="pointer-events-auto mx-auto w-full max-w-[780px]">
              <AnimatePresence>
                {showPrompts && (
                  <motion.div key="prompts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.35, ease }}
                    className="no-scrollbar -mx-3 mb-3 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0">
                    {STARTERS.map((q) => (
                      <button key={q} onClick={() => send(q)} style={{ WebkitTapHighlightColor: "transparent" }}
                        className="group inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-edge bg-night-2/80 px-4 py-2 text-[13px] text-mist-soft backdrop-blur-xl transition hover:border-white/25 hover:bg-white/[0.07] hover:text-mist">
                        {q}<ArrowUpRight size={13} className="text-mist-faint transition group-hover:text-mist" />
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
              <Composer mode={tab === "edit" ? "edit" : "chat"} photo={onHome} />
              <p className="mt-2 hidden text-center text-[10.5px] text-mist-faint sm:block">
                {tab === "edit" ? "Searching your edit — results re-rank to your palette." : "Grounded in your colour profile. Your photo is never shared with the stylist."}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Modals />
    </>
  );
}

function TopBar({ tab }: { tab: Tab | null }) {
  const navigate = useNavigate();
  const { setShell } = useShell();
  const { setDrawer, editPath } = useStudio();
  // const { toggleAnalysis, analysisOpen } = useStudio();
  // const { colour } = useProfile();

  return (
    <header className="sticky top-0 z-[35] border-b border-edge bg-night/90 backdrop-blur-2xl">
      <div className="relative flex h-16 items-center gap-2 px-3 sm:px-5">
        <button onClick={() => setDrawer(true)} aria-label="Open menu" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-mist-soft transition hover:bg-white/[0.06] hover:text-mist lg:hidden"><Menu size={19} /></button>

        <nav className="no-scrollbar mx-auto flex h-full min-w-0 items-stretch gap-0.5 overflow-x-auto" aria-label="Sections">
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button key={t.id} onClick={() => navigate(t.id === "edit" ? editPath : t.to)} aria-current={on ? "page" : undefined}
                className={`relative shrink-0 whitespace-nowrap px-2.5 text-[13.5px] transition-colors sm:px-4 ${on ? "text-mist" : "text-mist-soft hover:text-mist"}`}>
                {t.short ? <><span className="sm:hidden">{t.short}</span><span className="hidden sm:inline">{t.label}</span></> : t.label}
                {on && <motion.span layoutId="studio-tab" className="absolute inset-x-2.5 bottom-0 h-[2px] rounded-full sm:inset-x-4" style={{ background: "linear-gradient(90deg,#f4b39a,#c9a7f0,#9fe0cc)" }} transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
              </button>
            );
          })}
          <span className="mx-1 h-4 w-px shrink-0 self-center bg-white/10 sm:mx-2" />
          <button onClick={() => setShell("classic")} title="Switch to the previous interface" aria-label="Previous interface"
            className="inline-flex shrink-0 items-center gap-1.5 self-center whitespace-nowrap rounded-full border border-edge bg-white/[0.03] px-2.5 py-1.5 text-[12.5px] text-mist-soft transition hover:border-white/25 hover:text-mist sm:px-3">
            <History size={13} /> <span className="hidden sm:inline">Previous</span>
          </button>
        </nav>

        {/* the mobile Analysis button is retired along with the sidebar one
        <button onClick={toggleAnalysis} aria-pressed={analysisOpen} aria-label="Analysis" className="grid h-10 w-10 shrink-0 place-items-center rounded-full lg:hidden">
          <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: colour ? profileGradient(colour) : "…" }}><BarChart3 size={14} /></span>
        </button> */}
        <span className="w-10 shrink-0 lg:hidden" />
      </div>
    </header>
  );
}

function OpenAnalysis() {
  const { openAnalysis } = useStudio();
  // useEffect(() => openAnalysis("photo"), []);
  // a file picker can only open from a click, so the old /analyze link starts the analysis in the chat instead
  const once = useRef(false);
  useEffect(() => { if (!once.current) { once.current = true; openAnalysis("intro"); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <Navigate to={ANALYSE} replace />;
}

function LegacyStyle() {
  const { section } = useParams();
  return <Navigate to={`/for-you/${section === "hair" ? "hairstyles" : section}`} replace />;
}
