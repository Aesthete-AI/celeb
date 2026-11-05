// Shared state for the Studio interface: the analysis panel, the open conversation, modals, and the
// stylist engine itself (send / answer / stop). Kept in one provider so the hero search box, the docked
// composer, the analysis panel and the sidebar all act on the same conversation.
//
// The answering logic mirrors components/ChatPanel.tsx (which still runs the Previous interface) —
// same context builder, same streaming endpoint, same offline fallback — with two differences:
//   1. answers never move the page; they carry a card that opens the matching edit instead, and
//   2. a question asked before any analysis opens the analysis panel and is answered as soon as a
//      result arrives.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PROFILES, profileKeyOf, type CategoryId, type ColourProfile, type Gender } from "../data/profiles";
import { QUIZ7, scoreQuiz7 } from "../data/quiz7";
import { analyze, ApiError, chatStream } from "../lib/api";
import { loadCatalog, prefetchProfile } from "../lib/catalog";
import { readFace } from "../lib/face";
import { detectIntent } from "../lib/intent";
import { useProfile, type Profile } from "../lib/profile";
// import { buildContext, followupsFor, localAnswer, smallTalk, splitFollowups } from "../lib/stylist";
import { buildContext, followupsFor, smallTalk, splitFollowups } from "../lib/stylist";
import { structuredLocal } from "./answers";
import { nextMsgId, useThreads, type StudioMsg } from "../lib/threads";

export type AnalysisMode = "intro" | "photo" | "quiz";
export type SendMode = "chat" | "edit";
type Modal = null | "about" | "settings";
/** where the Analyse (chat) tab lives; Home ("/") is the landing page */
export const ANALYSE = "/analyse";

type Ctx = {
  analysisOpen: boolean;
  analysisMode: AnalysisMode;
  /** file — a photo picked from the search bar's image button; the panel reads and scans it */
  openAnalysis: (m?: AnalysisMode, file?: Blob) => void;
  pendingFile: Blob | null;
  takeFile: () => Blob | null;
  closeAnalysis: () => void;
  toggleAnalysis: () => void;
  setAnalysisMode: (m: AnalysisMode) => void;
  threadId: string | null;
  openThread: (id: string) => void;
  newChat: () => void;
  send: (text: string, mode?: SendMode) => { section: CategoryId | null } | void;
  stop: () => void;
  busy: boolean;
  /** a photo attached in the search box: shown in the conversation, then read like a selfie scan */
  sendPhoto: (file: File, text?: string) => void;
  /** an attached photo is being read */
  scanning: boolean;
  /** the seven questions, inside the conversation */
  answerQuiz: (msgId: number, option: number) => void;
  quizBack: (msgId: number) => void;
  /** called by the analysis panel when a scan or the questionnaire produces a profile */
  reportResult: (p: Profile) => void;
  drawer: boolean;
  setDrawer: (o: boolean) => void;
  modal: Modal;
  setModal: (m: Modal) => void;
  /** desktop sidebar expanded (true) or collapsed to an icon rail (false), as in Gemini */
  railOpen: boolean;
  setRailOpen: (o: boolean) => void;
  /** the last recommendation shown in Your Edit, so the tab returns to it */
  editPath: string;
};

const C = createContext<Ctx | null>(null);
const TKEY = "teinte.thread.current";
const RKEY = "teinte.rail.v1";

export function StudioProvider({ children }: { children: ReactNode }) {
  const { profile, colour, gender } = useProfile();
  const th = useThreads();
  const navigate = useNavigate();
  const location = useLocation();

  const [railOpen, setRailState] = useState(() => { try { return localStorage.getItem(RKEY) !== "0"; } catch { return true; } });
  const setRailOpen = useCallback((o: boolean) => { setRailState(o); try { localStorage.setItem(RKEY, o ? "1" : "0"); } catch { /* ignore */ } }, []);
  const [pendingFile, setPendingFile] = useState<Blob | null>(null);
  const takeFile = useCallback(() => { const f = pendingFile; setPendingFile(null); return f; }, [pendingFile]);
  // Your Edit keeps whatever recommendation it last showed — a query, a "show more", a category tab —
  // until something new replaces it, so switching to Analyse and back lands on the same edit
  const [editPath, setEditPath] = useState("/for-you");
  useEffect(() => { if (location.pathname.startsWith("/for-you")) setEditPath(location.pathname + location.search); }, [location.pathname, location.search]);

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("intro");
  const [drawer, setDrawer] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const { setProfile, setGender, setPhoto } = useProfile();
  const [threadId, setThreadIdState] = useState<string | null>(() => {
    try { return sessionStorage.getItem(TKEY); } catch { return null; }
  });
  const tidRef = useRef(threadId);
  const abort = useRef<AbortController | null>(null);
  /** a question asked before there was a colour profile — answered once analysis completes */
  const deferred = useRef<{ q: string; thread: string } | null>(null);

  const setThreadId = useCallback((id: string | null) => {
    tidRef.current = id;
    setThreadIdState(id);
    try { id ? sessionStorage.setItem(TKEY, id) : sessionStorage.removeItem(TKEY); } catch { /* ignore */ }
  }, []);

  // a remembered id whose thread was deleted elsewhere falls back to a fresh start
  useEffect(() => { if (threadId && !th.get(threadId)) setThreadId(null); }, [threadId, th, setThreadId]);

  const ensureThread = useCallback(() => {
    let id = tidRef.current;
    if (!id || !th.get(id)) {
      id = th.create();
      setThreadId(id);
    }
    return id;
  }, [th, setThreadId]);

  const say = useCallback((tid: string, m: Omit<StudioMsg, "id">) => {
    const id = nextMsgId();
    th.append(tid, { ...m, id });
    return id;
  }, [th]);

  const answer = useCallback(
    async (tid: string, question: string, prof: Profile | null, cp: ColourProfile | null, g: Gender | "all") => {
      const intent = detectIntent(question);
      const section = intent.section;
      const viewG: Gender = intent.gender ?? (g === "all" ? "female" : g);
      // const route = section ? { section, gender: intent.gender ?? "" } : undefined;
      // every styled answer carries reference photos — a general question draws on Clothing & Colour
      const route = { section: section ?? ("clothing" as CategoryId), gender: intent.gender ?? "" };
      const id = say(tid, { role: "assistant", content: "", streaming: true, route });
      setBusy(true);
      const convo = (th.get(tid)?.msgs ?? [])
        .filter((m) => m.id !== id && m.content && !m.gate && !m.card)
        .map((m) => ({ role: m.role, content: m.content }));
      const catalog = cp ? await loadCatalog(cp.key) : null;
      const ctx = buildContext(prof, cp, intent.gender ?? g, section, "the Teinte studio chat", catalog);
      let text = "";
      try {
        abort.current = new AbortController();
        const provider = await chatStream(convo, ctx, (d) => { text += d; th.patch(tid, id, { content: splitFollowups(text).body }, false); }, abort.current.signal, "structured");
        const { body, followups } = splitFollowups(text);
        th.patch(tid, id, { content: body, followups: followups ?? followupsFor(section, viewG), streaming: false, source: provider ?? undefined });
      } catch (e) {
        if ((e as Error).name === "AbortError") { th.patch(tid, id, { content: splitFollowups(text).body, streaming: false }); return; }
        if (!cp) { th.patch(tid, id, { content: "I couldn't reach the stylist just now — please try again in a moment.", streaming: false }); return; }
        // const local = localAnswer(cp, section, viewG);
        const local = structuredLocal(cp, section, viewG, question);
        const words = local.text.split(/(\s+)/);
        let shown = "";
        for (let i = 0; i < words.length; i += 6) {
          shown += words.slice(i, i + 6).join("");
          th.patch(tid, id, { content: shown }, false);
          await new Promise((r) => setTimeout(r, 16));
        }
        th.patch(tid, id, { content: local.text, followups: local.followups, streaming: false, source: e instanceof ApiError && e.status === 503 ? "curated" : "curated-fallback" });
      } finally {
        abort.current = null;
        setBusy(false);
      }
    },
    [th, say],
  );

  const send = useCallback(
    (text: string, mode: SendMode = "chat") => {
      const q = text.trim();
      if (!q || busy) return;
      const tid = ensureThread();
      say(tid, { role: "user", content: q });

      // ── Your Edit is open: the query re-points the recommendations on screen
      if (mode === "edit") {
        const intent = detectIntent(q);
        const gq = intent.gender ? `?g=${intent.gender}` : "";
        navigate(intent.section ? `/for-you/${intent.section}${gq}` : "/for-you");
        // if (colour) {
        //   const g: Gender = intent.gender ?? (gender === "male" ? "male" : "female");
        //   const local = localAnswer(colour, intent.section, g);
        //   say(tid, { role: "assistant", content: local.text, followups: local.followups, source: "curated", route: intent.section ? { section: intent.section, gender: intent.gender ?? "" } : undefined });
        // } else {
        // The edit on screen changes now; the stylist's answer streams into the conversation in the
        // background, so the same query and its response are waiting on the Analyse tab.
        if (profile && colour) {
          answer(tid, q, profile, colour, gender);
        } else {
          say(tid, { role: "assistant", content: "I've opened an **example edit** for that. Run an analysis — a selfie or seven quick questions — and every photo re-ranks to your own colouring.", gate: true });
        }
        return { section: intent.section };
      }

      // ── Chat — asked from Palette or Wardrobe, the answer is shown on the Chat tab
      if (window.location.pathname !== ANALYSE) navigate(ANALYSE);
      const chat = smallTalk(q, colour);
      if (chat) {
        setTimeout(() => say(tid, { role: "assistant", content: chat.text, followups: chat.followups, source: "curated" }), 250);
        return;
      }
      if (!profile) {
        deferred.current = { q, thread: tid };
        say(tid, {
          role: "assistant",
          content: "Love that question. To recommend what genuinely flatters you, I first need your **skin undertone** and **seasonal colour**. Add a selfie for the most accurate read — or answer seven quick questions. I'll answer the moment your result is in.",
          gate: true,
        });
        // setAnalysisMode("intro");
        // setAnalysisOpen(true);       ← the side panel is retired: the gate's buttons work in the conversation
        return;
      }
      answer(tid, q, profile, colour, gender);
    },
    [busy, ensureThread, say, navigate, colour, gender, profile, answer],
  );

  const sendPhoto = useCallback(
    async (file: File, text = "") => {
      if (busy || scanning) return;
      const q = text.trim();
      const tid = ensureThread();
      if (window.location.pathname !== ANALYSE) navigate(ANALYSE);
      say(tid, { role: "user", content: q, image: await thumbnail(file).catch(() => undefined) });
      const id = say(tid, { role: "assistant", content: "", scan: { stage: "reading" } });
      setScanning(true);
      try {
        // the full photo stays here: only the head-and-neck crop made on this device is sent to be read
        const read = await readFace(file).catch(() => null);
        if (!read || !read.ok) {
          const why = read ? read.checks[read.checks.length - 1].detail : "I couldn't open that image — try a JPG or PNG.";
          th.patch(tid, id, { scan: undefined, content: `I couldn't analyse that photo. ${why}\n\nFor the best read, use a front-facing photo in even daylight with your hair and neck in frame.` });
          return;
        }
        th.patch(tid, id, { scan: { stage: "analysing", crop: read.cropUrl ? await shrink(read.cropUrl, 320) : undefined } }, false);
        const t0 = performance.now();
        const r = await analyze([read.crop!]);
        const key = r.profile ?? profileKeyOf(r.season, r.undertone);
        prefetchProfile(key, r.gender ?? "female");
        await new Promise((ok) => setTimeout(ok, Math.max(0, 2200 - (performance.now() - t0))));   // let the scan read
        const p: Profile = {
          profile: key, season: r.season, undertone: r.undertone, source: "scan", confidence: r.season_confidence, ranking: r.season_ranking,
          probabilities: r.probabilities, measured: r.measured, twins: r.colour_twins, photos: r.photos_used, ms: r.timings.total_ms, demo: r.demo, at: Date.now(),
        };
        setProfile(p);
        const g: Gender | "all" = r.gender ?? "all";
        setGender(g);
        setPhoto({ crop: read.cropUrl!, mask: r.regions?.mask });
        th.patch(tid, id, { scan: undefined, card: { season: p.season, undertone: p.undertone, profile: key, source: "scan", confidence: p.confidence } });
        // the question typed with the photo — or one asked earlier, before there was a profile — is answered now
        const d = deferred.current;
        deferred.current = null;
        const ask = q || (d && d.thread === tid ? d.q : "");
        if (ask && PROFILES[key]) setTimeout(() => answer(tid, ask, p, PROFILES[key], g), 400);
      } catch (e) {
        th.patch(tid, id, { scan: undefined, content: e instanceof ApiError ? e.message : "Something went wrong while reading that photo — please try again." });
      } finally {
        setScanning(false);
      }
    },
    [busy, scanning, ensureThread, navigate, say, th, answer, setProfile, setGender, setPhoto],
  );

  const reportResult = useCallback(
    (p: Profile) => {
      const key = p.profile ?? "";
      const cp = PROFILES[key] ?? null;
      const tid = deferred.current?.thread && th.get(deferred.current.thread) ? deferred.current.thread : ensureThread();
      say(tid, {
        role: "assistant",
        content: "",
        card: { season: p.season, undertone: p.undertone, profile: key, source: p.source, confidence: p.confidence },
      });
      const d = deferred.current;
      deferred.current = null;
      if (d && cp) {
        if (tidRef.current !== tid) setThreadId(tid);
        // the gender the scan read (or the quiz's choice) is already in the profile store by now,
        // but this closure predates it — read the freshest value straight from storage
        let g: Gender | "all" = gender;
        try { g = JSON.parse(localStorage.getItem("teinte.gender.v1") ?? "null") ?? gender; } catch { /* keep */ }
        setTimeout(() => answer(tid, d.q, p, cp, g), 450);
      }
    },
    [th, ensureThread, say, answer, gender, setThreadId],
  );

  // ── the seven questions, as one interactive card in the conversation
  const startQuiz = useCallback(() => {
    const tid = ensureThread();
    if (window.location.pathname !== ANALYSE) navigate(ANALYSE);
    say(tid, { role: "assistant", content: "", quiz7: { step: 0, answers: {} } });
  }, [ensureThread, navigate, say]);

  const findMsg = (msgId: number) => {
    const tid = tidRef.current;
    const m = tid ? th.get(tid)?.msgs.find((x) => x.id === msgId) : undefined;
    return tid && m?.quiz7 && !m.quiz7.done ? { tid, q: m.quiz7 } : null;
  };

  const quizBack = useCallback((msgId: number) => {
    const f = findMsg(msgId);
    if (f && f.q.step > 0) th.patch(f.tid, msgId, { quiz7: { ...f.q, step: f.q.step - 1 } });
  }, [th]); // eslint-disable-line react-hooks/exhaustive-deps

  const answerQuiz = useCallback((msgId: number, option: number) => {
    const f = findMsg(msgId);
    if (!f) return;
    const { tid, q } = f;
    const answers = { ...q.answers, [QUIZ7[q.step].id]: option };
    if (q.step + 1 < QUIZ7.length) { th.patch(tid, msgId, { quiz7: { step: q.step + 1, answers } }); return; }
    th.patch(tid, msgId, { quiz7: { step: q.step, answers, done: true } });
    const r = scoreQuiz7(answers);
    const key = profileKeyOf(r.season.name, r.undertone);
    const p: Profile = { profile: key, season: r.season.name, undertone: r.undertone, source: "quiz", confidence: r.confidence, ranking: r.ranking, at: Date.now() };
    setProfile(p);
    prefetchProfile(key, gender === "male" ? "male" : "female");
    say(tid, { role: "assistant", content: "", card: { season: p.season, undertone: p.undertone, profile: key, source: "quiz", confidence: p.confidence } });
    const d = deferred.current;
    deferred.current = null;
    if (d && d.thread === tid && PROFILES[key]) setTimeout(() => answer(tid, d.q, p, PROFILES[key], gender), 450);
  }, [th, say, setProfile, gender, answer]); // eslint-disable-line react-hooks/exhaustive-deps

  // a hidden file picker for "Add a selfie" buttons anywhere on the page: the photo goes straight into the chat
  const picker = useRef<HTMLInputElement>(null);

  const stop = useCallback(() => abort.current?.abort(), []);
  const newChat = useCallback(() => { abort.current?.abort(); deferred.current = null; setThreadId(null); navigate(ANALYSE); setDrawer(false); }, [navigate, setThreadId]);
  const openThread = useCallback((id: string) => { setThreadId(id); navigate(ANALYSE); setDrawer(false); }, [navigate, setThreadId]);
  // const openAnalysis = useCallback((m: AnalysisMode = "intro", file?: Blob) => { if (file) setPendingFile(file); setAnalysisMode(m); setAnalysisOpen(true); setDrawer(false); }, []);
  // The side panel is retired: every way into the analysis now happens inside the conversation.
  const openAnalysis = useCallback((m: AnalysisMode = "intro", file?: Blob) => {
    setDrawer(false);
    if (file) { sendPhoto(file as File); return; }
    if (m === "photo") { picker.current?.click(); return; }
    if (m === "quiz") { startQuiz(); return; }
    const tid = ensureThread();
    if (window.location.pathname !== ANALYSE) navigate(ANALYSE);
    say(tid, { role: "assistant", gate: true, content: profile
      ? `You read as **${profile.season} · ${profile.undertone} undertone**. Want to retake it? Add a selfie for the most accurate read, or answer seven quick questions.`
      : "Let's find your colours. Add a selfie for the most accurate read — or answer seven quick questions." });
  }, [sendPhoto, startQuiz, ensureThread, navigate, say, profile]);
  const closeAnalysis = useCallback(() => setAnalysisOpen(false), []);
  // const toggleAnalysis = useCallback(() => { if (!analysisOpen) setAnalysisMode("intro"); setAnalysisOpen(!analysisOpen); setDrawer(false); }, [analysisOpen]);
  const toggleAnalysis = useCallback(() => openAnalysis("intro"), [openAnalysis]);

  return (
    <C.Provider
      value={{
        analysisOpen, analysisMode, openAnalysis, closeAnalysis, toggleAnalysis, setAnalysisMode,
        threadId, openThread, newChat, send, stop, busy, reportResult, sendPhoto, scanning, answerQuiz, quizBack, drawer, setDrawer, modal, setModal,
        railOpen, setRailOpen, editPath, pendingFile, takeFile,
      }}
    >
      <input ref={picker} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) sendPhoto(f); e.target.value = ""; }} />
      {children}
    </C.Provider>
  );
}

export const useStudio = () => {
  const c = useContext(C);
  if (!c) throw new Error("useStudio outside provider");
  return c;
};

/** A small JPEG of an attached photo for the conversation (kept only in this browser's storage). */
async function thumbnail(file: Blob, max = 360): Promise<string> {
  const url = URL.createObjectURL(file);
  try { return await shrink(url, max); } finally { URL.revokeObjectURL(url); }
}

function shrink(src: string, max: number): Promise<string> {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      ok(c.toDataURL("image/jpeg", 0.78));
    };
    img.onerror = fail;
    img.src = src;
  });
}
