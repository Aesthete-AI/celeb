import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Camera, Lock, ScanFace, Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ease, Reveal } from "../components/ui";
import { CATEGORIES, FAMILY_RULE, OCCASIONS, PROFILES, PROFILE_KEYS, STYLE_GUIDES, UNDERTONE_RULE, profileGradient } from "../data/profiles";
import { sized, useCatalog } from "../lib/catalog";
import { startersFor } from "../lib/intent";
import { useProfile } from "../lib/profile";

/** `studio` — rendered as the Home tab of the Studio interface: the two hero buttons and the three
 *  small notes are left out (they stay in the Previous interface), and `slot` fills that space. */
export default function Home({ studio = false, slot }: { studio?: boolean; slot?: ReactNode } = {}) {
  const { setChatOpen, ask, colourKey, gender } = useProfile();
  const { catalog } = useCatalog(colourKey);
  const g = gender === "male" ? "male" : "female";
  // section spacing — the Studio's Home runs tighter, one even rhythm from the hero down
  const gap = studio ? "pt-20" : "pt-28";
  return (
    <>
      {/* ── hero */}
      <section className={`mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:px-10 ${studio ? "pb-4 pt-6 md:pt-10" : "pb-16 pt-8 md:pt-16"}`}>
        <div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, duration: 0.8 }} className="eyebrow">AI colour analysis · Personal stylist</motion.p>
          <h1 className={`display mt-6 ${studio ? "text-[56px] sm:text-[80px] xl:text-[96px]" : "text-[64px] sm:text-[92px] xl:text-[118px]"}`}>
            <motion.span className="block" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease }}>Colour that</motion.span>
            <motion.span className="block italic text-aura" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease, delay: 0.12 }}>knows you.</motion.span>
          </h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease, delay: 0.3 }} className="mt-8 max-w-xl text-lg leading-relaxed text-mist-soft">
            {/* One selfie. Twelve vision models read your skin undertone and seasonal colour in under a second — then your edit of jewellery, hair, makeup and outfits for every occasion appears, ranked to your palette. */}
            One selfie reads your skin undertone and seasonal colour in seconds — then your edit of jewellery, hair, makeup and outfits for every occasion appears, ranked to your palette.
          </motion.p>
          {!studio && (<>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease, delay: 0.42 }} className="mt-10 flex flex-wrap gap-3">
            <Link to="/analyze" className="btn-aura !px-7 !py-3.5 text-[15px]"><Camera size={17} /> Try AI analysis</Link>
            <button onClick={() => setChatOpen(true)} className="btn-ghost !px-7 !py-3.5 text-[15px]"><Sparkles size={16} /> Ask the stylist</button>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75, duration: 1 }} className="mt-12 flex flex-wrap gap-x-7 gap-y-2 text-xs text-mist-faint">
            <span className="flex items-center gap-1.5"><Lock size={13} /> Your full photo never leaves your device</span>
            {/* <span className="flex items-center gap-1.5"><ScanFace size={13} /> Graphonomy + 7 CNN + 5 ViT</span> */}
            <span className="flex items-center gap-1.5"><ScanFace size={13} /> Reads face, hair & neck</span>
            <span className="flex items-center gap-1.5"><Sparkles size={13} /> 12 profiles × 12 edits</span>
          </motion.div>
          </>)}
        </div>
        <Orb compact={studio} />
      </section>
      {slot}

      {/* ── the rules */}
      <section className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 ${studio ? "pt-16" : "pt-24"}`}>
        <Reveal className="max-w-3xl">
          <p className="eyebrow">How your edit is built</p>
          <h2 className="display mt-4 text-5xl md:text-6xl">Undertone sets the <em>temperature.</em> Season sets the <em>depth.</em></h2>
        </Reveal>
        <div className={`grid gap-4 md:grid-cols-3 ${studio ? "mt-10" : "mt-14"}`}>
          {(["Warm", "Neutral", "Cool"] as const).map((u, i) => (
            <Reveal key={u} delay={i * 0.08}>
              <div className="panel relative h-full overflow-hidden p-7">
                <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full opacity-50 blur-3xl" style={{ background: u === "Warm" ? "#C8643B" : u === "Cool" ? "#4F6FB0" : "#B76E79" }} />
                <p className="relative eyebrow">{u} undertone</p>
                <p className="relative mt-5 text-[15px] leading-relaxed text-mist/90">{UNDERTONE_RULE[u]}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(["Spring", "Summer", "Autumn", "Winter"] as const).map((f, i) => (
            <Reveal key={f} delay={i * 0.06}>
              <div className="panel h-full p-6">
                <div className="flex -space-x-2">{(["warm", "neutral", "cool"] as const).map((u) => <span key={u} className="h-7 w-7 rounded-full ring-2 ring-night" style={{ background: profileGradient(PROFILES[`${f.toLowerCase()}-${u}`]) }} />)}</div>
                <p className="mt-5 font-display text-2xl">{f}</p>
                <p className="mt-2 text-sm leading-relaxed text-mist-soft">{FAMILY_RULE[f]}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── edits */}
      <section className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 ${gap}`}>
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="eyebrow">Your edit</p>
            <h2 className="display mt-4 text-5xl md:text-6xl">Twelve edits, <em>one palette.</em></h2>
          </div>
          <Link to="/for-you" className="btn-ghost">Open your edit <ArrowRight size={15} /></Link>
        </Reveal>
        <div className={`grid grid-cols-2 gap-3 md:grid-cols-4 ${studio ? "mt-10" : "mt-12"}`}>
          {/* {[...STYLE_GUIDES, ...OCCASIONS.slice(0, 4)].map((id, i) => { */}
          {[...STYLE_GUIDES, ...OCCASIONS.slice(0, 8 - STYLE_GUIDES.length)].map((id, i) => {
            const it = catalog?.categories[id]?.[g]?.[0];
            const p = PROFILES[colourKey];
            const col = p.colours[i % p.colours.length].hex;
            return (
              <Reveal key={id} delay={(i % 4) * 0.06}>
                <Link to={`/for-you/${id}`} className="group relative block aspect-[3/4] overflow-hidden rounded-[24px] ring-1 ring-white/[0.07]" style={{ background: it?.avg ?? `radial-gradient(120% 90% at 30% 15%, ${col}, ${col}99 50%, #0E0D12 125%)` }}>
                  {it && <img src={sized(it.thumb, 520)} alt={it.alt} loading="lazy" className="h-full w-full object-cover transition duration-[1400ms] group-hover:scale-[1.05]" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                  <div className="absolute inset-x-4 bottom-4 flex items-end justify-between">
                    <div><p className="eyebrow !text-[9px] !text-white/70">{CATEGORIES[id].kicker}</p><p className="font-display text-2xl leading-tight text-white">{CATEGORIES[id].title}</p></div>
                    <ArrowUpRight size={18} className="text-white transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ── ask */}
      <section className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 ${gap}`}>
        <Reveal>
          <div className="panel relative overflow-hidden p-8 md:p-14">
            <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-[#5B2A86] opacity-40 blur-[90px]" />
            <div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-[#0F5C55] opacity-40 blur-[90px]" />
            <div className="relative grid gap-10 md:grid-cols-[1fr_1.2fr]">
              <div>
                <p className="eyebrow">Your stylist</p>
                <h2 className="display mt-4 text-5xl">Ask it anything.</h2>
                <p className="mt-4 text-mist-soft">It knows your profile, asks the right follow-up, and opens the matching edit beside the conversation.</p>
              </div>
              <div className="flex flex-wrap content-start gap-2">
                {startersFor(gender).map((s) => (
                  <button key={s.q} onClick={() => ask(s.q)} className="rounded-full border border-edge bg-white/[0.04] px-4 py-2.5 text-sm text-mist transition hover:-translate-y-0.5 hover:border-white/30">{s.q}</button>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── privacy */}
      <section className={`mx-auto max-w-4xl px-4 text-center sm:px-6 ${gap}`}>
        <Reveal>
          <Lock className="mx-auto text-mist-soft" size={20} />
          <p className="display mt-6 text-3xl md:text-4xl">Your photo stays in your browser and is visible only to you.</p>
          <p className="mx-auto mt-4 max-w-2xl text-mist-soft">No one else can see it unless you choose to share it. Only a tight head-and-neck crop is sent to be read — analysed in memory, then discarded. Never stored, never used for training.</p>
          <Link to="/privacy" className="mt-6 inline-flex items-center gap-1 text-sm text-mist underline decoration-white/25 underline-offset-4 hover:decoration-white">How we handle your photo <ArrowRight size={13} /></Link>
        </Reveal>
      </section>
    </>
  );
}

/** A slowly cycling orb through all 12 season × undertone profiles, with each palette orbiting it. */
function Orb({ compact = false }: { compact?: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % PROFILE_KEYS.length), 3200);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, ease }} className={`relative mx-auto aspect-square w-full ${compact ? "max-w-[480px]" : "max-w-[540px]"}`}>
      {PROFILE_KEYS.map((k, n) => {
        const p = PROFILES[k];
        const on = n === i;
        return (
          <div key={k} aria-hidden={!on} className={`absolute inset-0 transition-opacity duration-[1400ms] ${on ? "opacity-100" : "opacity-0"}`}>
            <div className="absolute inset-[14%] rounded-full blur-3xl" style={{ background: profileGradient(p), opacity: 0.55 }} />
            <div className="absolute inset-[18%] rounded-full" style={{ background: `conic-gradient(from 200deg, ${p.colours.map((c) => c.hex).join(", ")}, ${p.colours[0].hex})` }} />
            <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,.35),transparent_45%),radial-gradient(circle_at_50%_50%,transparent_45%,rgba(8,8,11,.55)_100%)]" />
            {p.neutrals.concat(p.metals).map((s, j, a) => {
              const ang = (j / a.length) * Math.PI * 2 - Math.PI / 2;
              return <span key={j} title={s.name} className={`absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-white/15 transition-transform duration-[1400ms] ${on ? "scale-100" : "scale-50"}`} style={{ left: `${50 + 46 * Math.cos(ang)}%`, top: `${50 + 46 * Math.sin(ang)}%`, background: s.hex, transitionDelay: `${j * 60}ms` }} />;
            })}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-black/35 px-5 py-3 text-center backdrop-blur-xl">
              <p className="eyebrow !text-[9px] !text-white/70">{p.undertone} undertone</p>
              <p className="font-display text-3xl leading-tight text-white">{p.family}</p>
              <p className="text-xs text-white/70">{p.mood}</p>
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}
