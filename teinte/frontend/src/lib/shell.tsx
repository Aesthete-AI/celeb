// Which interface is on screen: the Studio (chat-first, default) or the Previous one — the original
// page-based site, kept intact so the team can switch back at any time.
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export type Shell = "studio" | "classic";
const KEY = "teinte.shell.v1";
const C = createContext<{ shell: Shell; setShell: (s: Shell) => void } | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [shell, set] = useState<Shell>(() => {
    try {
      return localStorage.getItem(KEY) === "classic" ? "classic" : "studio";
    } catch {
      return "studio";
    }
  });
  const setShell = useCallback((s: Shell) => {
    set(s);
    try { localStorage.setItem(KEY, s); } catch { /* private mode */ }
    window.scrollTo({ top: 0 });
  }, []);
  return <C.Provider value={{ shell, setShell }}>{children}</C.Provider>;
}

export const useShell = () => {
  const c = useContext(C);
  if (!c) throw new Error("useShell outside provider");
  return c;
};
