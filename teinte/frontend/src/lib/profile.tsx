import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { SEASON_BY_NAME, type Season, type Undertone } from "../data/seasons";
import { DEFAULT_PROFILE, PROFILES, profileKeyOf, type ColourProfile, type Gender } from "../data/profiles";

export type Twin = { name: string; season: string; undertone: string; similarity: number };
export type Profile = {
  profile?: string; // family-undertone key into the recommendation catalogue
  season: string;
  undertone: Undertone;
  source: "scan" | "quiz";
  confidence?: number;
  ranking?: { season: string; p: number }[];
  probabilities?: Record<string, Record<string, number>>;
  measured?: { face: string | null; hair: string | null; neck: string | null };
  twins?: Twin[];
  photos?: number;
  ms?: number;
  demo?: boolean;
  at: number;
};

/** Kept in memory only — never written to storage, gone when the tab closes. */
export type SessionPhoto = { crop: string; mask?: string | null };

type Ctx = {
  profile: Profile | null;
  season: Season | null;
  /** the 4-season × 3-undertone profile the lookbook is built from (null before a scan or quiz) */
  colour: ColourProfile | null;
  colourKey: string;
  setProfile: (p: Profile | null) => void;
  gender: Gender | "all";
  setGender: (g: Gender | "all") => void;
  photo: SessionPhoto | null;
  setPhoto: (p: SessionPhoto | null) => void;
  chatOpen: boolean;
  setChatOpen: (o: boolean) => void;
  ask: (q: string) => void;
  pending: string | null;
  takePending: () => string | null;
};

const C = createContext<Ctx | null>(null);
const KEY = "teinte.profile.v1";
const GKEY = "teinte.gender.v1";
/** Which lookbook a visitor opens on before any scan or manual choice. */
export const DEFAULT_GENDER: Gender = "female";

const read = <T,>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (k: string, v: unknown) => {
  try {
    v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* private mode — the session still works */
  }
};

/** `?reset` on any URL wipes the saved colour profile and starts the visit over — the chat asks its
 *  seven questions again, as it does for someone who has never scanned. Handy for demos. */
function resetRequested() {
  try {
    if (!new URLSearchParams(window.location.search).has("reset")) return false;
    localStorage.removeItem(KEY);
    localStorage.removeItem(GKEY);
    sessionStorage.clear();
    const u = new URL(window.location.href);
    u.searchParams.delete("reset");
    window.history.replaceState({}, "", u.pathname + u.search + u.hash);
    return true;
  } catch {
    return false;
  }
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const fresh = resetRequested();
  const [profile, setProfileState] = useState<Profile | null>(() => (fresh ? null : read(KEY, null)));
  // Remembered like the colour profile: a scan sets it from the person in the photo, and the
  // Women / Men / Both toggle overrides it by hand. A visitor with neither starts on the women's edit.
  const [gender, setGenderState] = useState<Gender | "all">(() => (fresh ? DEFAULT_GENDER : read(GKEY, DEFAULT_GENDER)));
  const [photo, setPhoto] = useState<SessionPhoto | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const setProfile = useCallback((p: Profile | null) => {
    setProfileState(p);
    write(KEY, p);
  }, []);
  const setGender = useCallback((g: Gender | "all") => {
    setGenderState(g);
    write(GKEY, g);
  }, []);
  const ask = useCallback((q: string) => {
    setPending(q);
    setChatOpen(true);
  }, []);
  const takePending = useCallback(() => {
    const p = pending;
    setPending(null);
    return p;
  }, [pending]);

  useEffect(() => {
    document.documentElement.style.setProperty("--chat-open", chatOpen ? "1" : "0");
  }, [chatOpen]);

  const value = useMemo<Ctx>(
    () => ({
      profile,
      season: profile ? SEASON_BY_NAME[profile.season] ?? null : null,
      colour: profile ? PROFILES[profile.profile ?? profileKeyOf(profile.season, profile.undertone)] ?? null : null,
      colourKey: profile ? profile.profile ?? profileKeyOf(profile.season, profile.undertone) : DEFAULT_PROFILE,
      setProfile,
      gender,
      setGender,
      photo,
      setPhoto,
      chatOpen,
      setChatOpen,
      ask,
      pending,
      takePending,
    }),
    [profile, setProfile, gender, setGender, photo, chatOpen, ask, pending, takePending],
  );
  return <C.Provider value={value}>{children}</C.Provider>;
}

export const useProfile = () => {
  const c = useContext(C);
  if (!c) throw new Error("useProfile outside provider");
  return c;
};

export const gendersFor = (g: Gender | "all"): Gender[] => (g === "all" ? ["female", "male"] : [g]);
