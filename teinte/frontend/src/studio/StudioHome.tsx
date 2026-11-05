// The Home tab: the Previous interface's landing page, with its hero buttons and small notes replaced by
// the two ways to give us your colouring (or, once analysed, the person's result) — aligned with the
// search box docked at the bottom.
// import { motion } from "framer-motion";
// import { ease } from "../components/ui";
// import { useProfile } from "../lib/profile";
import Home from "../pages/Home";
// import { ProfileStrip, StartCards } from "./ChatView";

// export default function StudioHome() {
//   const { profile } = useProfile();
//   return (
//     <Home
//       studio
//       slot={
//         <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease, delay: 0.5 }} className="mx-auto w-full max-w-[780px] px-4 pb-6 sm:px-6">
//           {profile ? <ProfileStrip /> : <StartCards />}
//         </motion.div>
//       }
//     />
//   );
// }

/** Home is a pure landing page: no search box and no selfie / seven-question cards (those live on the
 *  Analyse tab), with the sections below the hero pulled closer together. */
export default function StudioHome() {
  return <Home studio />;
}
