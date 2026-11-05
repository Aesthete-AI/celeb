import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import ChatPanel from "./components/ChatPanel";
import Footer from "./components/Footer";
import Nav from "./components/Nav";
import { Aurora, ease } from "./components/ui";
import { useProfile } from "./lib/profile";
import { useShell } from "./lib/shell";
import StudioShell from "./studio/StudioShell";
import Home from "./pages/Home";

import Analyze from "./pages/Analyze";
import Palette from "./pages/Palette";
import { ForYouCategory, ForYouHub } from "./pages/ForYou";
import Seasons from "./pages/Seasons";
import Wardrobe from "./pages/Wardrobe";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";

/** The Studio (chat-first) interface is the default; “Previous” switches to the original site below,
 *  which is kept exactly as it was. Both read the same profile, catalogue and URLs. */
export default function App() {
  const { shell } = useShell();
  return shell === "classic" ? <ClassicApp /> : <StudioShell />;
}

// export default function App() {   ← the original entry point, now reached through the “Previous” button
export function ClassicApp() {
  const location = useLocation();
  const { chatOpen, colour } = useProfile();
  useEffect(() => window.scrollTo({ top: 0 }), [location.pathname]);
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const f = () => setDesktop(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  // the background glows take on the user's palette once they have one
  const tint = colour ? [colour.colours[0].hex, colour.colours[3].hex, colour.colours[5].hex, colour.neutrals[3].hex] : undefined;

  return (
    <>
      <div className="grain" />
      <Aurora colours={tint} />
      <motion.div
        className="min-h-screen"
        animate={{ paddingRight: chatOpen && desktop ? 440 : 0 }}
        transition={{ duration: 0.55, ease }}
      >
        <Nav />
        <AnimatePresence mode="wait">
          <motion.main key={location.pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.45, ease }}>
              <Routes location={location}>
                <Route path="/" element={<Home />} />
                <Route path="/analyze" element={<Analyze />} />
                <Route path="/palette" element={<Palette />} />
                <Route path="/seasons" element={<Seasons />} />
                <Route path="/seasons/:id" element={<Palette />} />
                <Route path="/for-you" element={<ForYouHub />} />
                <Route path="/for-you/:category" element={<ForYouCategory />} />
                <Route path="/lookbook" element={<Navigate to="/for-you" replace />} />
                <Route path="/style/:section" element={<LegacyStyle />} />
                <Route path="/wardrobe" element={<Wardrobe />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
          </motion.main>
        </AnimatePresence>
        <Footer />
      </motion.div>
      <ChatPanel />
    </>
  );
}

function LegacyStyle() {
  const { section } = useParams();
  return <Navigate to={`/for-you/${section === "hair" ? "hairstyles" : section}`} replace />;
}
