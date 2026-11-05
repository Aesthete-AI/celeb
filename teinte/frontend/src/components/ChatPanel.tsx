import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ArrowUp, Camera, ListChecks, RotateCcw, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CATEGORIES, PROFILES, profileGradient, profileKeyOf, type CategoryId, type ColourProfile, type Gender } from "../data/profiles";
import { QUIZ, scoreQuiz } from "../data/quiz";
import { ApiError, chatStream } from "../lib/api";
import { loadCatalog, prefetchProfile } from "../lib/catalog";
import { detectIntent, startersFor } from "../lib/intent";
import { useProfile, type Profile } from "../lib/profile";
import { buildContext, followupsFor, localAnswer, smallTalk, splitFollowups } from "../lib/stylist";
import { ease, RichText } from "./ui";

type Msg = {
  id: number;
  role: "user" | "assistant";
  content: string;
  followups?: string[];
  route?: { section: CategoryId; gender: string };
  gate?: boolean;
  quiz?: number;
  streaming?: boolean;
  source?: string;
};

const SKEY = "teinte.chat.v2";
let nextId = Date.now();

export default function ChatPanel() {
  const { profile, colour, setProfile, gender, setGender, chatOpen, setChatOpen, pending, takePending } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(SKEY) ?? "[]"); } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [quiz, setQuiz] = useState<{ step: number; answers: Record<string, number>; question: string } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    try { sessionStorage.setItem(SKEY, JSON.stringify(msgs.filter((m) => !m.streaming).slice(-40))); } catch { /* ignore */ }
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const push = (m: Omit<Msg, "id">) => {
    const id = nextId++;
    setMsgs((x) => [...x, { ...m, id }]);
    return id;
  };
  const patch = (id: number, p: Partial<Msg>) => setMsgs((x) => x.map((m) => (m.id === id ? { ...m, ...p } : m)));

  const currentSection = (): CategoryId | null => {
    const m = location.pathname.match(/^\/for-you\/([\w-]+)/);
    return m && m[1] in CATEGORIES ? (m[1] as CategoryId) : null;
  };
  const pageName = () => {
    const s = currentSection();
    if (s) return `${CATEGORIES[s].title} edit`;
    return ({ "/": "home page", "/analyze": "photo analysis", "/for-you": "their personal edit", "/palette": "their palette", "/seasons": "seasons explorer", "/wardrobe": "wardrobe colour check" } as Record<string, string>)[location.pathname] ?? location.pathname;
  };

  const answer = useCallback(
    async (question: string, history: Msg[], prof: Profile | null = profile, cp: ColourProfile | null = colour, g: Gender | "all" = gender) => {
      const intent = detectIntent(question);
      const section = intent.section ?? currentSection();
      const viewG: Gender = intent.gender ?? (g === "all" ? "female" : g);
      // the question's gender (if any) is a view override for this page only — the saved preference stays
      const gq = intent.gender ? `?g=${intent.gender}` : "";
      if (intent.section) navigate(`/for-you/${intent.section}${gq}`);
      const route = intent.section ? { section: intent.section, gender: intent.gender ?? "" } : undefined;
      const id = push({ role: "assistant", content: "", streaming: true, route });
      setBusy(true);
      const convo = [...history, { role: "user", content: question } as Msg]
        .filter((m) => m.content && !m.gate && m.quiz === undefined)
        .map((m) => ({ role: m.role, content: m.content }));
      const catalog = cp ? await loadCatalog(cp.key) : null;
      const ctx = buildContext(prof, cp, intent.gender ?? g, section, pageName(), catalog);
      let text = "";
      try {
        abort.current = new AbortController();
        const provider = await chatStream(convo, ctx, (d) => { text += d; patch(id, { content: splitFollowups(text).body }); }, abort.current.signal);
        const { body, followups } = splitFollowups(text);
        patch(id, { content: body, followups: followups ?? followupsFor(section, viewG), streaming: false, source: provider ?? undefined });
      } catch (e) {
        if ((e as Error).name === "AbortError") { patch(id, { streaming: false }); return; }
        if (!cp) { patch(id, { content: "I couldn't reach the stylist just now — please try again in a moment.", streaming: false }); return; }
        const local = localAnswer(cp, section, viewG);
        const words = local.text.split(/(\s+)/);
        let shown = "";
        for (let i = 0; i < words.length; i += 6) {
          shown += words.slice(i, i + 6).join("");
          patch(id, { content: shown });
          await new Promise((r) => setTimeout(r, 16));
        }
        patch(id, { content: local.text, followups: local.followups, streaming: false, source: e instanceof ApiError && e.status === 503 ? "curated" : "curated-fallback" });
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, colour, gender, location.pathname],
  );

  const send = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      setInput("");
      const history = msgs;
      push({ role: "user", content: q });
      if (quiz) {
        if (quiz.step === -1) setQuiz({ ...quiz, question: q });
        return;
      }
      const chat = smallTalk(q, colour);
      if (chat) {
        setTimeout(() => push({ role: "assistant", content: chat.text, followups: chat.followups, source: "curated" }), 250);
        return;
      }
      if (!profile) {
        push({ role: "assistant", content: "Love that question. To recommend what genuinely flatters you, I first need your **skin undertone** and **seasonal colour**. Scan a selfie for the most accurate read — or answer seven quick questions right here.", gate: true });
        setQuiz({ step: -1, answers: {}, question: q });
        return;
      }
      answer(q, history);
    },
    [busy, msgs, quiz, profile, colour, answer],
  );

  useEffect(() => {
    if (chatOpen && pending) {
      const q = takePending();
      if (q) setTimeout(() => send(q), 250);
    }
  }, [chatOpen, pending, takePending, send]);

  const startQuiz = () => {
    setQuiz((z) => (z ? { ...z, step: 0 } : z));
    push({ role: "assistant", content: QUIZ[0].prompt, quiz: 0 });
  };

  const pickQuiz = (qi: number, oi: number) => {
    if (!quiz || quiz.step !== qi) return;
    const qq = QUIZ[qi];
    const answers = { ...quiz.answers, [qq.id]: oi };
    push({ role: "user", content: qq.options[oi].label });
    const next = qi + 1;
    if (next < QUIZ.length) {
      setQuiz({ ...quiz, step: next, answers });
      setTimeout(() => push({ role: "assistant", content: QUIZ[next].prompt, quiz: next }), 280);
      return;
    }
    const r = scoreQuiz(answers);
    const key = profileKeyOf(r.season.name, r.undertone);
    const prof: Profile = { profile: key, season: r.season.name, undertone: r.undertone, source: "quiz", confidence: r.confidence, ranking: r.ranking, at: Date.now() };
    setProfile(prof);
    setGender(r.gender);
    prefetchProfile(key, r.gender === "male" ? "male" : "female");
    const cp = PROFILES[key];
    const original = quiz.question;
    setQuiz(null);
    setTimeout(() => {
      push({ role: "assistant", content: `Lovely — you read as **${cp.label}** (${r.season.name}). ${cp.rule}\n\nI've saved this to your profile; a selfie scan will make it more precise. Now, your question:` });
      setTimeout(() => answer(original, [], prof, cp, r.gender), 350);
    }, 300);
  };

  const reset = () => { abort.current?.abort(); setMsgs([]); setQuiz(null); };
  const headerGrad = colour ? profileGradient(colour, 120) : "linear-gradient(120deg,#5B2A86,#8A3B2E 50%,#0F5C55)";

  return (
    <AnimatePresence>
      {chatOpen && (
        <motion.aside
          key="chat"
          initial={{ x: "100%", opacity: 0.6 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0.6 }}
          transition={{ duration: 0.55, ease }}
          className="fixed inset-0 z-50 flex flex-col bg-night-2/95 backdrop-blur-2xl lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[440px] lg:border-l lg:border-edge"
          aria-label="Teinte stylist chat"
        >
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 opacity-50 blur-2xl" style={{ background: headerGrad }} />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-night-2" />
            <div className="relative flex items-start justify-between px-5 pb-4 pt-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-mist text-night"><Sparkles size={15} /></span>
                  <div>
                    <p className="font-display text-xl leading-none">Teinte Stylist</p>
                    <p className="mt-1 text-[11px] text-mist-soft">Clothing · makeup · hair · jewellery</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {profile && colour ? (
                    <>
                      <span className="chip !text-mist">{colour.family} · {colour.undertone}</span>
                      <span className="chip">{profile.season}</span>
                      <span className="chip">{profile.source === "scan" ? "From your scan" : "From quiz"}</span>
                    </>
                  ) : <span className="chip">No profile yet — I'll ask a few questions</span>}
                </div>
              </div>
              <div className="flex gap-1">
                {msgs.length > 0 && <IconBtn label="New chat" onClick={reset}><RotateCcw size={15} /></IconBtn>}
                <IconBtn label="Close" onClick={() => setChatOpen(false)}><X size={17} /></IconBtn>
              </div>
            </div>
          </div>

          <div ref={scroller} className="scroll-thin flex-1 space-y-4 overflow-y-auto px-5 pb-6">
            {msgs.length === 0 && <Welcome hasProfile={!!profile} gender={gender} onPick={send} />}
            {msgs.map((m) => (
              <Bubble key={m.id} m={m}>
                {m.gate && quiz?.step === -1 && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="btn-light !px-3 !py-2.5 !text-xs" onClick={startQuiz}><ListChecks size={14} /> Quick questions</button>
                    <button className="btn-ghost !px-3 !py-2.5 !text-xs" onClick={() => { navigate("/analyze"); setChatOpen(false); }}><Camera size={14} /> Scan selfie</button>
                  </div>
                )}
                {m.quiz !== undefined && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {QUIZ[m.quiz].options.map((o, oi) => (
                      <button key={oi} disabled={!quiz || quiz.step !== m.quiz} onClick={() => pickQuiz(m.quiz!, oi)} className="chip !text-mist transition enabled:hover:border-white/30 enabled:hover:bg-white/[0.08] disabled:opacity-40">
                        {o.swatch && <span className="h-3 w-3 rounded-full ring-1 ring-white/20" style={{ background: o.swatch }} />}
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
                {m.route && !m.streaming && (
                  <button onClick={() => navigate(`/for-you/${m.route!.section}${m.route!.gender ? `?g=${m.route!.gender}` : ""}`)} className="mt-3 flex w-full items-center justify-between rounded-2xl border border-edge bg-white/[0.04] px-4 py-3 text-left text-xs transition hover:border-white/25">
                    <span>
                      <span className="eyebrow block !text-[9px]">On screen now</span>
                      <span className="text-sm text-mist">{CATEGORIES[m.route.section].title}{colour ? ` · ${colour.family} ${colour.undertone}` : ""}</span>
                    </span>
                    <ArrowRight size={16} />
                  </button>
                )}
                {m.followups && !m.streaming && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {m.followups.map((f) => (
                      <button key={f} onClick={() => send(f)} style={{ WebkitTapHighlightColor: "transparent" }} className="rounded-full border border-dashed border-white/20 px-3 py-1.5 text-[11px] text-mist-soft transition hover:border-solid hover:border-white/40 hover:text-mist active:border-solid active:border-white/50 active:bg-white/[0.08] active:text-mist">{f}</button>
                    ))}
                  </div>
                )}
              </Bubble>
            ))}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t border-edge p-4">
            <div className="rounded-[22px] p-[1.5px] transition focus-within:shadow-[0_0_40px_-10px_rgba(201,167,240,.6)]" style={{ background: "linear-gradient(110deg,#f4b39a,#c9a7f0 45%,#9fe0cc)" }}>
              <div className="flex items-end gap-2 rounded-[21px] bg-night-2 px-4 py-2.5">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                  rows={1}
                  placeholder={quiz && quiz.step >= 0 ? "Tap an answer above…" : "Ask about outfits, makeup, hair, jewellery…"}
                  disabled={!!quiz && quiz.step >= 0}
                  className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-sm text-mist outline-none placeholder:text-mist-faint"
                />
                <button type="submit" disabled={!input.trim() || busy} aria-label="Send" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mist text-night transition disabled:opacity-25"><ArrowUp size={16} /></button>
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] text-mist-faint">Grounded in your colour profile. Your photo is never shared with the stylist.</p>
          </form>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function IconBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return <button aria-label={label} title={label} onClick={onClick} className="grid h-9 w-9 place-items-center rounded-full border border-edge bg-white/[0.04] text-mist-soft transition hover:text-mist">{children}</button>;
}

function Welcome({ hasProfile, gender, onPick }: { hasProfile: boolean; gender: Gender | "all"; onPick: (q: string) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="pt-2">
      <p className="font-display text-[30px] leading-[1.05]">What are we dressing for <em className="text-aura">today?</em></p>
      <p className="mt-2 text-sm text-mist-soft">{hasProfile ? "I know your colours — ask anything and I'll bring the matching edit on screen." : "Ask anything. I'll find your undertone and season first, then style you."}</p>
      <div className="mt-5 grid gap-2">
        {startersFor(gender).map((s, i) => (
          <motion.button key={s.q} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 + i * 0.05, duration: 0.5, ease }} onClick={() => onPick(s.q)}
            style={{ WebkitTapHighlightColor: "transparent" }}
            className="group flex items-center justify-between rounded-2xl border border-edge bg-white/[0.03] px-4 py-3 text-left text-sm text-mist transition hover:border-white/25 hover:bg-white/[0.06] active:bg-white/[0.1] active:text-mist">
            <span>{s.q}</span>
            <ArrowRight size={14} className="text-mist-faint transition group-hover:translate-x-0.5 group-hover:text-mist" />
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

function Bubble({ m, children }: { m: Msg; children?: React.ReactNode }) {
  const user = m.role === "user";
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }} className={`flex ${user ? "justify-end" : "justify-start"}`}>
      <div className={user ? "max-w-[85%] rounded-[20px] rounded-br-md bg-mist px-4 py-2.5 text-sm text-night" : "w-full text-[14px] leading-relaxed text-mist/90"}>
        {user ? m.content : (
          <>
            {m.content ? <RichText text={m.content} /> : <Typing />}
            {m.streaming && m.content && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-mist/40 align-middle" />}
            {children}
            {/* which model answered is never shown on the site
            {m.source && !m.streaming && <p className="mt-2 text-[10px] text-mist-faint">{m.source.startsWith("curated") ? "Answered from Teinte's style rules" : `Styled with ${m.source}`}</p>} */}
          </>
        )}
      </div>
    </motion.div>
  );
}

function Typing() {
  return (
    <div className="flex items-center gap-1.5 py-2">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="h-2 w-2 rounded-full" style={{ background: ["#f4b39a", "#c9a7f0", "#9fe0cc"][i] }} animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
      ))}
    </div>
  );
}
