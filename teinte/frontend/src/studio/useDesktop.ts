import { useEffect, useState } from "react";

/** true at the lg breakpoint and up, where the sidebar and analysis panel sit side by side */
export function useDesktop() {
  const q = "(min-width: 1024px)";
  const [on, set] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => set(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return on;
}
