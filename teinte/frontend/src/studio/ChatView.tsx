// The Analyse tab. Empty → a quiet welcome (and, before any analysis, the two ways in). With messages →
// the conversation: each answer is a one-line verdict, labelled sections, and reference photos from the
// person's own edit, with "Show more recommendations" leading into Your Edit.
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Camera, Check, Copy, ListChecks, Lock } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Lightbox } from "../components/ItemCard";
import { ease, GenderToggle, RichText } from "../components/ui";
import { QUIZ7 } from "../data/quiz7";
import { CATEGORIES, PROFILES, profileGradient, type CategoryId, type Gender } from "../data/profiles";
import { SEASON_BY_NAME, gradientCss } from "../data/seasons";
import { sized, useCatalog, type CatalogItem } from "../lib/catalog";
import { useProfile } from "../lib/profile";
import { useThreads, type StudioMsg } from "../lib/threads";
import { OptionArt, QuizArt, SelfieArt } from "./AnalysisPanel";
import { parseStructured, type Block, type Parsed } from "./answers";
import { useStudio } from "./StudioContext";

export default function ChatView() {
  const { threadId } = useStudio();
  const { get } = useThreads();
  const t = get(threadId);
  if (!t || !t.msgs.length) return <Welcome />;
  return <Conversation msgs={t.msgs} />;
}

/* ────────────────────────────────────────────── shared bits */
export function AuraOrb({ size = 28, spinning = false }: { size?: number; spinning?: boolean }) {
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <motion.span className="absolute inset-[-30%] rounded-full opacity-60 blur-xl" style={{ background: "conic-gradient(from 0deg,#f4b39a,#c9a7f0,#9fe0cc,#e9cf95,#f4b39a)" }}
        animate={{ rotate: 360 }} transition={{ duration: spinning ? 2.4 : 18, repeat: Infinity, ease: "linear" }} />
      <motion.span className="absolute inset-0 rounded-full" style={{ background: "conic-gradient(from 0deg,#f4b39a,#c9a7f0,#9fe0cc,#e9cf95,#f4b39a)" }}
        animate={{ rotate: 360 }} transition={{ duration: spinning ? 2.4 : 18, repeat: Infinity, ease: "linear" }} />
      <span className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,.55),rgba(255,255,255,.05)_55%,transparent)]" />
    </span>
  );
}

/** The two ways to give us your colouring — used on Home and on an empty Analyse tab. */
export function StartCards({ heading = "Start with your colouring" }: { heading?: string }) {
  const { openAnalysis } = useStudio();
  return (
    <div className="w-full">
      <div className="mb-4 flex items-center gap-4">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
        <p className="eyebrow !text-[9.5px]">{heading}</p>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <StartCard onClick={() => openAnalysis("photo")} art={<SelfieArt />} icon={<Camera size={15} />} title="Add a selfie" sub="We read your skin, hair and neck in seconds." /* was: "Twelve AI models read your skin, hair and neck." */ tag="Most accurate · ≈ 1 s" />
        <StartCard onClick={() => openAnalysis("quiz")} art={<QuizArt />} icon={<ListChecks size={15} />} title="Answer 7 questions" sub="No photo? Veins, metals, hair, eyes and more." tag="No photo needed · ≈ 1 min" />
      </div>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-mist-faint">
        <Lock size={12} /> Your photo stays in your browser — only a head-and-neck crop is read, then discarded.
      </p>
    </div>
  );
}

function StartCard({ onClick, art, icon, title, sub, tag }: { onClick: () => void; art: ReactNode; icon: ReactNode; title: string; sub: string; tag: string }) {
  return (
    <motion.button whileHover={{ y: -3 }} whileTap={{ scale: 0.99 }} onClick={onClick}
      className="group relative flex items-center gap-4 overflow-hidden rounded-[26px] border border-edge bg-white/[0.035] p-3.5 text-left backdrop-blur-xl transition hover:border-white/25 hover:bg-white/[0.06]">
      <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-3xl transition duration-700 group-hover:opacity-60" style={{ background: "radial-gradient(circle,#c9a7f0,transparent 70%)" }} />
      <span className="relative h-[92px] w-[76px] shrink-0 overflow-hidden rounded-[18px]">{art}</span>
      <span className="relative min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[15px] font-medium text-mist"><span className="text-mist-soft">{icon}</span>{title}</span>
        <span className="mt-1 block text-[12.5px] leading-relaxed text-mist-soft">{sub}</span>
        <span className="mt-2.5 inline-block rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10.5px] text-mist-soft">{tag}</span>
      </span>
      <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-edge text-mist-soft transition group-hover:border-white/30 group-hover:bg-mist group-hover:text-night"><ArrowRight size={15} /></span>
    </motion.button>
  );
}

/** Once someone has a result: their colouring, and a way into the edit. */
export function ProfileStrip() {
  const { profile, colour } = useProfile();
  const navigate = useNavigate();
  if (!profile || !colour) return null;
  return (
    <button onClick={() => navigate("/for-you")} className="group relative flex w-full items-center gap-4 overflow-hidden rounded-[26px] border border-edge bg-white/[0.035] p-4 text-left transition hover:border-white/25 sm:p-5">
      <span className="absolute inset-0 opacity-25 transition group-hover:opacity-35" style={{ background: profileGradient(colour, 100) }} />
      <span className="relative h-14 w-14 shrink-0 rounded-2xl" style={{ background: profileGradient(colour) }} />
      <span className="relative min-w-0 flex-1">
        <span className="eyebrow block !text-[9.5px]">Your colouring · from your {profile.source === "scan" ? "selfie" : "answers"}</span>
        <span className="mt-1 block font-display text-2xl leading-tight sm:text-[28px]">{profile.season} · {colour.undertone} undertone</span>
      </span>
      <span className="relative hidden items-center gap-1.5 rounded-full bg-mist px-4 py-2 text-[13px] font-medium text-night sm:inline-flex">Open my edit <ArrowRight size={14} /></span>
      <ArrowRight size={18} className="relative sm:hidden" />
    </button>
  );
}

/* ────────────────────────────────────────────── welcome */
function Welcome() {
  const { profile, colour } = useProfile();
  return (
    <div className="flex min-h-[calc(100svh-15rem)] flex-col items-center justify-center px-4 pb-10 pt-10 sm:px-6">
      <div className="flex w-full max-w-[760px] flex-col items-center text-center">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, ease }}>
          <AuraOrb size={56} />
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 18, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.9, ease, delay: 0.08 }}
          className="display mt-8 text-[42px] sm:text-[58px]">
          {profile ? <>What are we <em className="text-aura">dressing for?</em></> : <>Let's find <em className="text-aura">your</em> colours.</>}
        </motion.h1>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.2 }} className="mt-5">
          {profile && colour ? (
            <span className="inline-flex items-center gap-3 rounded-full border border-edge bg-white/[0.04] py-1.5 pl-2 pr-4 text-[13px] text-mist-soft">
              <span className="flex -space-x-1.5">{colour.colours.slice(0, 5).map((c) => <span key={c.hex + c.name} className="h-5 w-5 rounded-full ring-2 ring-night" style={{ background: c.hex }} />)}</span>
              Styling for <span className="text-mist">{profile.season} · {colour.undertone}</span>
            </span>
          ) : (
            <p className="max-w-[520px] text-[15px] leading-relaxed text-mist-soft">Ask anything about outfits, makeup, hair or jewellery. I'll read your undertone and season first — then style you in seconds.</p>
          )}
        </motion.div>
        {!profile && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease, delay: 0.32 }} className="mt-12 w-full">
            <StartCards />
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────── conversation */
function Conversation({ msgs }: { msgs: StudioMsg[] }) {
  const last = msgs[msgs.length - 1];
  const count = useRef(msgs.length);
  // follow the answer as it streams — unless the reader has scrolled up to re-read something
  useEffect(() => {
    const grew = msgs.length !== count.current;
    count.current = msgs.length;
    const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 280;
    if (grew || nearBottom) window.scrollTo({ top: document.documentElement.scrollHeight, behavior: grew ? "smooth" : "auto" });
  }, [msgs.length, last?.content]);

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-52 pt-8 sm:px-6 sm:pt-12">
      <div className="space-y-12">
        {msgs.map((m) => <Message key={m.id} m={m} />)}
      </div>
    </div>
  );
}

function Message({ m }: { m: StudioMsg }) {
  const { send, openAnalysis } = useStudio();
  const [copied, setCopied] = useState(false);

  if (m.role === "user") {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }} className="flex flex-col items-end gap-2">
        {m.image && <img src={m.image} alt="Your photo" className="max-h-64 max-w-[60%] rounded-[20px] object-cover ring-1 ring-white/10 sm:max-w-[240px]" />}
        {m.content && <div className="max-w-[85%] whitespace-pre-wrap rounded-[22px] bg-white/[0.07] px-5 py-3 text-[15px] leading-relaxed text-mist sm:max-w-[72%]">{m.content}</div>}
      </motion.div>
    );
  }
  if (m.scan) return <Scanning scan={m.scan} />;
  if (m.quiz7) return <QuizCard id={m.id} q={m.quiz7} />;
  if (m.card) return <ResultCard card={m.card} />;

  const parsed = m.content ? parseStructured(m.content) : null;
  const copy = () => navigator.clipboard?.writeText(m.content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }, () => {});
  // const sourceLabel = m.source ? (m.source.startsWith("curated") ? "Teinte style rules" : m.source) : null;
  // which model answered is never shown on the site
  const sourceLabel: string | null = null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }} className="group">
      <div className="mb-3.5 flex items-center gap-2.5 text-[12px]">
        <AuraOrb size={22} spinning={!!m.streaming} />
        <span className="font-medium text-mist">Teinte</span>
        {sourceLabel && !m.streaming && <span className="text-mist-faint">· {sourceLabel}</span>}
      </div>

      {!m.content ? <Thinking /> : parsed ? <Structured p={parsed} streaming={!!m.streaming} /> : (
        <div className="text-[15px] leading-[1.75] text-mist/90"><RichText text={m.content} /></div>
      )}

      {m.gate && (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button onClick={() => openAnalysis("photo")} className="btn-light !justify-start !rounded-2xl !px-4 !py-3 !text-[13px]"><Camera size={15} /> Add a selfie <span className="ml-auto text-[11px] font-normal opacity-60">most accurate</span></button>
          <button onClick={() => openAnalysis("quiz")} className="btn-ghost !justify-start !rounded-2xl !px-4 !py-3 !text-[13px]"><ListChecks size={15} /> Answer 7 questions <span className="ml-auto text-[11px] opacity-60">≈ 1 min</span></button>
        </div>
      )}

      {m.route && !m.streaming && m.content && <References section={m.route.section} gender={m.route.gender} />}

      {m.followups && !m.streaming && (
        <div className="mt-5 flex flex-wrap gap-2">
          {m.followups.map((f) => (
            <button key={f} onClick={() => send(f)} style={{ WebkitTapHighlightColor: "transparent" }}
              className="rounded-full border border-edge px-3.5 py-1.5 text-[12.5px] text-mist-soft transition hover:border-white/30 hover:bg-white/[0.05] hover:text-mist active:bg-white/[0.1]">
              {f}
            </button>
          ))}
        </div>
      )}

      {!m.streaming && m.content && (
        <div className="mt-3 flex items-center gap-3 text-[11px] text-mist-faint opacity-0 transition group-hover:opacity-100 max-sm:opacity-70">
          <button onClick={copy} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 transition hover:bg-white/[0.06] hover:text-mist" aria-label="Copy answer">
            {copied ? <Check size={12} /> : <Copy size={12} />}{copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ── v1 renderer: one fixed shape (labelled sections of key → value rows) ───────────────────────────
// /** Verdict, then labelled sections of key → value rows. Hex codes become swatches. */
// function Structured({ p, streaming }: { p: NonNullable<ReturnType<typeof parseStructured>>; streaming: boolean }) {
//   return (
//     <div>
//       {p.lead && <p className="font-display text-[23px] leading-[1.3] text-mist sm:text-[26px]">{inline(p.lead)}</p>}
//       {p.sections.length > 0 && (
//         <div className="mt-5 overflow-hidden rounded-[24px] border border-edge bg-white/[0.025] backdrop-blur-xl">
//           {p.sections.map((s, i) => (
//             <motion.div key={s.label + i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}
//               className={`grid gap-2.5 px-5 py-4 sm:grid-cols-[128px_1fr] sm:gap-6 sm:px-6 sm:py-5 ${i ? "border-t border-white/[0.06]" : ""}`}>
//               <p className="eyebrow !text-[9.5px] sm:pt-1">{s.label}</p>
//               <ul className="space-y-2.5">
//                 {s.rows.map((r, k) => (
//                   <li key={k} className="flex gap-3 text-[14.5px] leading-relaxed">
//                     {r.key && <span className="w-[88px] shrink-0 pt-px text-[13px] text-mist-soft">{r.key}</span>}
//                     <span className="min-w-0 text-mist/90">{inline(r.value)}</span>
//                   </li>
//                 ))}
//               </ul>
//             </motion.div>
//           ))}
//           {streaming && <div className="h-1 animate-pulse bg-gradient-to-r from-transparent via-white/10 to-transparent" />}
//         </div>
//       )}
//     </div>
//   );
// }
// ────────────────────────────────────────────────────────────────────────────────────────────────

/** Verdict, then the body in whatever shape suits the question. Hex codes become swatches. */
function Structured({ p, streaming }: { p: Parsed; streaming: boolean }) {
  // a section with its own label gets a label column; a single unlabelled list or table runs full width
  return (
    <div>
      {p.lead && <p className="font-display text-[23px] leading-[1.3] text-mist sm:text-[26px]">{inline(p.lead)}</p>}
      {p.sections.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-[24px] border border-edge bg-white/[0.025] backdrop-blur-xl">
          {p.sections.map((s, i) => (
            <motion.div key={(s.label ?? "") + i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}
              className={`px-5 py-4 sm:px-6 sm:py-5 ${i ? "border-t border-white/[0.06]" : ""} ${s.label ? "grid gap-2.5 sm:grid-cols-[128px_1fr] sm:gap-6" : ""}`}>
              {s.label && <p className="eyebrow !text-[9.5px] sm:pt-1">{s.label}</p>}
              <div className="min-w-0 space-y-3.5">{s.blocks.map((b, k) => <BlockView key={k} b={b} />)}</div>
            </motion.div>
          ))}
          {streaming && <div className="h-1 animate-pulse bg-gradient-to-r from-transparent via-white/10 to-transparent" />}
        </div>
      )}
    </div>
  );
}

function BlockView({ b }: { b: Block }) {
  if (b.kind === "rows")
    return (
      <ul className="space-y-2.5">
        {b.rows.map((r, k) => (
          <li key={k} className="flex gap-3 text-[14.5px] leading-relaxed">
            {r.key && <span className="w-[88px] shrink-0 pt-px text-[13px] text-mist-soft">{r.key}</span>}
            <span className="min-w-0 text-mist/90">{inline(r.value)}</span>
          </li>
        ))}
      </ul>
    );
  if (b.kind === "list" && b.ordered)
    return (
      <ol className="space-y-3">
        {b.items.map((t, k) => (
          <li key={k} className="flex gap-3.5 text-[14.5px] leading-relaxed">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.04] font-display text-[13px] text-mist">{k + 1}</span>
            <span className="min-w-0 pt-0.5 text-mist/90">{inline(t)}</span>
          </li>
        ))}
      </ol>
    );
  if (b.kind === "list")
    return (
      <ul className="space-y-2">
        {b.items.map((t, k) => (
          <li key={k} className="flex gap-3 text-[14.5px] leading-relaxed">
            <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-aura-peach to-aura-lilac" />
            <span className="min-w-0 text-mist/90">{inline(t)}</span>
          </li>
        ))}
      </ul>
    );
  if (b.kind === "table")
    return (
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[420px] border-separate border-spacing-0 text-left text-[14px]">
          <thead>
            <tr>
              {b.head.map((c, k) => (
                <th key={k} className={`border-b border-white/10 px-3 pb-2.5 font-normal ${k ? "font-display text-[18px] text-mist" : "text-[11px] uppercase tracking-luxe text-mist-faint"}`}>{inline(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {b.rows.map((r, k) => (
              <tr key={k}>
                {r.map((c, n) => (
                  <td key={n} className={`border-b border-white/[0.05] px-3 py-2.5 align-top leading-relaxed ${n ? "text-mist/90" : "text-[13px] text-mist-soft"}`}>{inline(c)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  // tip
  const t = b.text.match(/^\**(tip|note|pro tip)\**:?\s*(.+)$/i);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] py-3 pl-5 pr-4 text-[14px] leading-relaxed text-mist/90">
      <span className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-aura-peach via-aura-lilac to-aura-mint" />
      <span className="eyebrow mr-2 !text-[9.5px]">{t ? t[1] : "Tip"}</span>{inline(t ? t[2] : b.text)}
    </div>
  );
}

function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\s?\(?#[0-9a-fA-F]{6}\)?)/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) out.push(<strong key={k++} className="font-medium text-mist">{t.slice(2, -2)}</strong>);
    else {
      const hex = t.replace(/[()\s]/g, "");
      out.push(<span key={k++} title={hex} className="mx-1 inline-block h-3.5 w-3.5 translate-y-[2px] rounded-full ring-1 ring-white/20" style={{ background: hex }} />);
    }
    last = m.index + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

/** Reference photos from the person's own ranked edit, and the way into the rest of it. */
function References({ section, gender }: { section: CategoryId; gender: string }) {
  const { colourKey, gender: saved, colour } = useProfile();
  const { send } = useStudio();
  const { catalog } = useCatalog(colourKey);
  const navigate = useNavigate();
  const [open, setOpen] = useState<CatalogItem | null>(null);
  const g = (gender || saved) as Gender | "all";
  const byG = catalog?.categories[section];
  const items: CatalogItem[] = g === "all"
    ? [0, 1, 2, 3].map((i) => byG?.[i % 2 ? "male" : "female"]?.[i >> 1]).filter((x): x is CatalogItem => !!x)
    : (byG?.[g] ?? []).slice(0, 4);
  const more = () => navigate(`/for-you/${section}${gender ? `?g=${gender}` : ""}`);
  if (!colour) return null;

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <p className="eyebrow !text-[9.5px]">From your edit · {CATEGORIES[section].title}</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {items.length
          ? items.map((it, i) => (
              <motion.button key={it.id} onClick={() => setOpen(it)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.5, ease }}
                className="group/p relative aspect-[3/4] overflow-hidden rounded-[18px] ring-1 ring-white/[0.07]" style={{ background: it.avg ?? "#15141B" }}>
                <img src={sized(it.thumb, 420)} alt={it.alt || "Reference look"} className="h-full w-full object-cover transition duration-[1200ms] group-hover/p:scale-[1.05]" />
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                {it.match && (
                  <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/45 py-0.5 pl-0.5 pr-2 text-[10px] text-white/90 backdrop-blur-md">
                    <span className="h-3.5 w-3.5 rounded-full ring-1 ring-white/30" style={{ background: it.matchHex ?? undefined }} />{it.match}
                  </span>
                )}
              </motion.button>
            ))
          : colour.colours.slice(0, 4).map((c, i) => (
              <div key={i} className="aspect-[3/4] rounded-[18px] ring-1 ring-white/[0.07]" style={{ background: `radial-gradient(120% 90% at 30% 15%, ${c.hex}, ${c.hex}aa 50%, #0E0D12 125%)` }} />
            ))}
      </div>
      <button onClick={more} className="group/m mt-3 inline-flex items-center gap-2 rounded-full border border-edge bg-white/[0.03] px-4 py-2 text-[13px] text-mist transition hover:border-white/30 hover:bg-white/[0.07]">
        Show more recommendations <ArrowRight size={14} className="transition group-hover/m:translate-x-0.5" />
      </button>
      <Lightbox item={open} onClose={() => setOpen(null)} onAsk={(it) => { setOpen(null); send(`How should I style this ${it.alt?.split(",")[0] || "piece"}${it.match ? ` (it matches my ${it.match})` : ""}?`); }} />
    </div>
  );
}

function ResultCard({ card }: { card: NonNullable<StudioMsg["card"]> }) {
  const navigate = useNavigate();
  const { gender, setGender } = useProfile();
  const s = SEASON_BY_NAME[card.season];
  const cp = PROFILES[card.profile];
  if (!cp) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, ease }}>
      <div className="mb-3.5 flex items-center gap-2.5 text-[12px]">
        <AuraOrb size={22} />
        <span className="font-medium text-mist">Teinte</span>
        <span className="text-mist-faint">· your result{card.source === "quiz" ? ", from your seven answers" : ", read from your selfie"}</span>
      </div>
      <div className="relative overflow-hidden rounded-[26px] border border-edge">
        <div className="absolute inset-0 opacity-45" style={{ background: s ? gradientCss(s.gradient, 120) : profileGradient(cp, 120) }} />
        <div className="absolute inset-0 bg-gradient-to-r from-night-2/90 via-night-2/60 to-transparent" />
        <div className="relative grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-end sm:p-7">
          <div>
            <p className="eyebrow !text-[9.5px]">Seasonal colour</p>
            <p className="display mt-1.5 text-[42px] sm:text-[52px]">{card.season}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="chip !text-mist">Skin undertone · {card.undertone}</span>
              <span className="chip">{cp.family} · {cp.mood}</span>
              {card.confidence !== undefined && <span className="chip">{Math.round(card.confidence * 100)}% match</span>}
            </div>
            <div className="mt-4 flex gap-1.5">
              {cp.colours.slice(0, 8).map((c) => <span key={c.hex + c.name} title={c.name} className="h-6 w-6 rounded-full ring-1 ring-white/15" style={{ background: c.hex }} />)}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-mist-soft">Show looks for <GenderToggle value={gender} onChange={setGender} /></div>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col">
            <button onClick={() => navigate("/for-you")} className="btn-light !px-5 !py-2.5 !text-[13px]">Open my edit <ArrowRight size={14} /></button>
            <button onClick={() => navigate("/palette")} className="btn-ghost !px-5 !py-2.5 !text-[13px]">Full palette</button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/** The seven questions as one card in the conversation: it advances in place, with a progress bar and Back. */
function QuizCard({ id, q }: { id: number; q: NonNullable<StudioMsg["quiz7"]> }) {
  const { answerQuiz, quizBack } = useStudio();
  const [picked, setPicked] = useState<number | null>(null);
  const qq = QUIZ7[q.step];
  if (q.done) {
    return (
      <div className="flex items-center gap-2.5 text-[13px] text-mist-soft">
        <AuraOrb size={22} /><span className="font-medium text-mist">Teinte</span>
        <span>· seven questions answered</span><Check size={14} className="text-mist" />
      </div>
    );
  }
  const pick = (oi: number) => {
    if (picked !== null) return;
    setPicked(oi);
    setTimeout(() => { setPicked(null); answerQuiz(id, oi); }, 260);
  };
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}>
      <div className="mb-3.5 flex items-center gap-2.5 text-[12px]">
        <AuraOrb size={22} />
        <span className="font-medium text-mist">Teinte</span>
        <span className="text-mist-faint">· colour analysis, no photo needed</span>
      </div>
      <div className="rounded-[26px] border border-edge bg-white/[0.025] p-5 backdrop-blur-xl sm:p-6">
        <div className="flex items-center gap-1">
          {QUIZ7.map((_, i) => (
            <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
              <motion.span className="block h-full rounded-full bg-mist" initial={false} animate={{ width: i < q.step ? "100%" : i === q.step ? "45%" : "0%" }} transition={{ duration: 0.5, ease }} />
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="eyebrow !text-[9.5px]">Question {q.step + 1} of {QUIZ7.length}</p>
          {q.step > 0 && <button onClick={() => quizBack(id)} className="inline-flex items-center gap-1 text-xs text-mist-soft transition hover:text-mist"><ArrowLeft size={13} /> Previous</button>}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={qq.id} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: 0.3, ease }}>
            <h3 className="mt-2 font-display text-[24px] leading-[1.15] sm:text-[27px]">{qq.prompt}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-mist-soft">{qq.why}</p>
            <div className={`mt-5 grid gap-2.5 ${qq.art === "mosaic" ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5"}`}>
              {qq.options.map((o, oi) => {
                const chosen = picked === oi || (picked === null && q.answers[qq.id] === oi);
                return (
                  <motion.button key={o.label} onClick={() => pick(oi)} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: oi * 0.03, duration: 0.3, ease }}
                    className={`group rounded-2xl border p-1.5 text-left transition ${chosen ? "border-mist bg-white/[0.09]" : "border-edge bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"} ${qq.art === "mosaic" ? "flex items-center gap-3 sm:block" : ""}`}>
                    <div className={`relative overflow-hidden rounded-xl ${qq.art === "mosaic" ? "h-16 w-28 shrink-0 sm:h-20 sm:w-full" : "aspect-square w-full"}`}>
                      <OptionArt art={qq.art} o={o} />
                      {chosen && <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-mist text-night"><Check size={11} /></span>}
                    </div>
                    <span className={`block px-1 pb-1 pt-2 text-[11.5px] leading-tight ${chosen ? "text-mist" : "text-mist-soft group-hover:text-mist"} ${qq.art === "mosaic" ? "text-[13px] sm:text-center" : "text-center"}`}>{o.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/** An attached photo being read, inline in the conversation. */
function Scanning({ scan }: { scan: NonNullable<StudioMsg["scan"]> }) {
  const steps = ["Finding your face", "Isolating hair, face & neck", "Reading your colouring"];
  const at = scan.stage === "reading" ? 0 : 2;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}>
      <div className="mb-3.5 flex items-center gap-2.5 text-[12px]">
        <AuraOrb size={22} spinning />
        <span className="font-medium text-mist">Teinte</span>
        <span className="text-mist-faint">· reading your photo</span>
      </div>
      <div className="flex items-center gap-5 rounded-[24px] border border-edge bg-white/[0.025] p-4 backdrop-blur-xl">
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-t-[999px] rounded-b-2xl bg-white/[0.04]">
          {scan.crop && <img src={scan.crop} alt="" className="h-full w-full object-cover" />}
          <motion.div className="absolute inset-x-0 h-10" style={{ background: "linear-gradient(to bottom, transparent, rgba(255,255,255,.35), transparent)" }}
            animate={{ top: ["-30%", "100%"] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} />
        </div>
        <ol className="space-y-2.5 text-[13.5px]">
          {steps.map((t, i) => (
            <li key={t} className={`flex items-center gap-2.5 transition-opacity ${i <= at ? "opacity-100" : "opacity-35"}`}>
              <span className={`grid h-5 w-5 place-items-center rounded-full border ${i < at ? "border-mist bg-mist text-night" : "border-white/20"}`}>
                {i < at ? <Check size={11} /> : i === at ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mist" /> : null}
              </span>
              {t}
            </li>
          ))}
          <li className="pt-1 text-[11px] text-mist-faint">Only the head-and-neck crop leaves your device.</li>
        </ol>
      </div>
    </motion.div>
  );
}

function Thinking() {
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 py-1">
        <p className="animate-sheen bg-[linear-gradient(90deg,#6F6A66_0%,#EEEAE4_50%,#6F6A66_100%)] bg-[length:200%_100%] bg-clip-text text-[15px] text-transparent">Styling your answer…</p>
        <div className="space-y-2">
          {[92, 74, 58].map((w, i) => <div key={i} className="h-2.5 animate-pulse rounded-full bg-white/[0.05]" style={{ width: `${w}%`, animationDelay: `${i * 0.15}s` }} />)}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
