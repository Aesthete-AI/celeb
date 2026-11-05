import { motion } from "framer-motion";
import { ArrowRight, Camera, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Drape from "../components/Drape";
import { ease, GenderToggle, Reveal, SwatchDot, SwatchTile } from "../components/ui";
import celebs from "../data/celebs.json";
import { FAMILIES, SEASON_BY_ID, SEASONS, UNDERTONE_COPY, gradientCss, type Season, type Swatch } from "../data/seasons";
import { useProfile } from "../lib/profile";

const CELEBS = celebs as Record<string, { n: string; g: string; u: string }[]>;

// The palette grouped by garment, the way Dressika groups clothing colours by clothing type.
function paletteByGarment(s: Season) {
  const r = s.roles;
  const uniq = (xs: Swatch[]) => xs.filter((x, i) => xs.findIndex((y) => y.hex.toLowerCase() === x.hex.toLowerCase()) === i);
  const half = Math.ceil(s.palette.length / 2);
  return [
    { title: "Tops, shirts & dresses", note: "Worn near the face — your most flattering colours.", swatches: uniq([r.signature, r.bright, r.pastel, r.soft, ...s.palette.slice(0, half)]) },
    { title: "Suiting & outerwear", note: "Large areas of colour — anchor them in neutrals.", swatches: uniq([r.dark, r.mid, r.deep, ...s.neutrals]) },
    { title: "Trousers, skirts & denim", note: "Grounding shades that let the top do the talking.", swatches: uniq([r.dark, r.deep, r.mid, r.light, ...s.neutrals]) },
    { title: "Knitwear & accents", note: "Bags, scarves, knits and statement pieces.", swatches: uniq([r.accent, ...s.palette.slice(half)]) },
  ];
}

export default function Palette() {
  const { id } = useParams();
  const { season: mine, profile } = useProfile();
  const season = id ? SEASON_BY_ID[id] : mine;
  if (!season) return <NoProfile />;
  return <SeasonView season={season} own={!id || id === mine?.id} undertone={!id || id === mine?.id ? profile?.undertone : undefined} />;
}

function NoProfile() {
  const { ask } = useProfile();
  return (
    <div className="mx-auto max-w-5xl px-4 pt-16 text-center sm:px-6">
      <p className="eyebrow">My palette</p>
      <h1 className="display mt-4 text-6xl">You haven't found your season yet.</h1>
      <p className="mx-auto mt-4 max-w-lg text-mist-soft">Scan a selfie for the most accurate read, or answer seven quick questions with the stylist.</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link to="/analyze" className="btn-aura !px-7"><Camera size={16} /> Try AI analysis</Link>
        <button onClick={() => ask("Help me find my season and undertone")} className="btn-ghost !px-7"><Sparkles size={15} /> Take the quiz</button>
      </div>
      <div className="mt-20 grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
        {FAMILIES.map((f) => (
          <div key={f}>
            <p className="eyebrow mb-3">{f}</p>
            {SEASONS.filter((s) => s.family === f).map((s) => (
              <Link key={s.id} to={`/seasons/${s.id}`} className="mb-2 flex items-center gap-3 rounded-2xl border border-edge bg-white/[0.04] p-3 transition hover:bg-white/[0.08]">
                <span className="h-8 w-8 rounded-full" style={{ background: gradientCss(s.gradient) }} />
                <span className="font-display text-lg">{s.name}</span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SeasonView({ season: s, own, undertone }: { season: Season; own: boolean; undertone?: "Warm" | "Cool" | "Neutral" }) {
  const { photo, gender, setGender } = useProfile();
  const [pick, setPick] = useState<Swatch>(s.roles.signature);
  const [cmp, setCmp] = useState(false);
  const groups = useMemo(() => paletteByGarment(s), [s]);
  const people = (CELEBS[s.name] ?? []).filter((c) => gender === "all" || c.g === (gender === "male" ? "m" : "f"));
  const u = UNDERTONE_COPY[undertone ?? s.undertone];

  return (
    <div className="pb-10">
      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-70" style={{ background: `radial-gradient(70% 90% at 85% 10%, ${s.gradient[0]}, transparent 70%), radial-gradient(60% 80% at 10% 90%, ${s.gradient[2]}88, transparent 70%)` }} />
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 md:pt-16 lg:px-10">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="eyebrow">{own ? "Your colour profile" : `${s.family} family`}</motion.p>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease }} className="display mt-4 text-[64px] md:text-[110px]">{s.name}</motion.h1>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease, delay: 0.15 }} className="mt-2 font-display text-3xl italic text-mist-soft">{s.tagline}</motion.p>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease, delay: 0.25 }} className="mt-6 max-w-2xl text-lg leading-relaxed text-mist-soft">{s.description}</motion.p>
          <div className="mt-7 flex flex-wrap gap-2">
            <span className="chip !text-mist">Hue · {s.dims.hue}</span>
            <span className="chip !text-mist">Value · {s.dims.value}</span>
            <span className="chip !text-mist">Chroma · {s.dims.chroma}</span>
            <span className="chip !text-mist">Contrast · {s.contrast}</span>
            {undertone && <span className="chip !bg-mist !text-night">{undertone} undertone</span>}
          </div>
          <motion.div className="mt-10 flex h-16 overflow-hidden rounded-full shadow-lift md:h-20" initial={{ clipPath: "inset(0 100% 0 0 round 999px)" }} animate={{ clipPath: "inset(0 0% 0 0 round 999px)" }} transition={{ duration: 1.4, ease, delay: 0.3 }}>
            {s.palette.map((p) => <span key={p.hex} className="flex-1" style={{ background: p.hex }} title={p.name} />)}
          </motion.div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-24 px-4 sm:px-6 lg:px-10">
        {/* drape studio */}
        <Reveal>
          <div className="panel overflow-hidden">
            <div className="grid lg:grid-cols-[1fr_1.1fr]">
              <div className="relative grid place-items-center p-6" style={{ background: `${pick.hex}22` }}>
                {own && photo ? (
                  cmp ? (
                    <div className="grid w-full max-w-md grid-cols-2 gap-3">
                      {[s.roles.signature, s.avoid[0]].map((c, i) => (
                        <figure key={i}>
                          <Drape crop={photo.crop} mask={photo.mask} colour={c.hex} className="aspect-square w-full rounded-t-[999px] rounded-b-3xl object-cover shadow-lift" />
                          <figcaption className="mt-2 text-center text-xs text-mist-soft">{i === 0 ? "Flattering" : "Draining"} · {c.name}</figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : (
                    <Drape crop={photo.crop} mask={photo.mask} colour={pick.hex} className="aspect-square w-full max-w-sm rounded-t-[999px] rounded-b-[40px] shadow-lift" />
                  )
                ) : (
                  <div className="flex aspect-square w-full max-w-sm flex-col items-center justify-center rounded-t-[999px] rounded-b-[40px] text-center shadow-lift" style={{ background: pick.hex }}>
                    <div className="mx-6 rounded-3xl bg-white/[0.06] p-5 backdrop-blur">
                      <p className="font-display text-2xl">{pick.name}</p>
                      <p className="mt-1 text-xs text-mist-soft">{own ? "Scan a selfie in this session to drape colours on your own photo." : "Draping uses your own photo — it's never saved, so scan to try it."}</p>
                      <Link to="/analyze" className="btn-light mt-4 !py-2 !text-xs"><Camera size={13} /> Scan now</Link>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-6 md:p-10">
                <p className="eyebrow">Drape studio</p>
                <h2 className="display mt-3 text-4xl">See colour on <em>you</em>.</h2>
                <p className="mt-3 text-sm text-mist-soft">Tap any shade to drape it under your face. Watch how the right colours even out skin and brighten eyes, while the wrong ones cast shadows.</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {[...s.palette, ...s.neutrals].map((p) => (
                    <button key={p.hex + p.name} onClick={() => { setPick(p); setCmp(false); }} title={p.name} className={`h-9 w-9 rounded-full border border-white/10 transition hover:scale-110 ${pick.hex === p.hex ? "ring-2 ring-mist ring-offset-2 ring-offset-night-2" : ""}`} style={{ background: p.hex }} />
                  ))}
                </div>
                <p className="eyebrow mt-6 !text-[10px]">Try a colour to avoid</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.avoid.map((p) => (
                    <button key={p.hex} onClick={() => { setPick(p); setCmp(false); }} title={p.name} className={`relative h-9 w-9 rounded-full border border-white/15 transition hover:scale-110 ${pick.hex === p.hex ? "ring-2 ring-mist ring-offset-2 ring-offset-night-2" : ""}`} style={{ background: p.hex }} />
                  ))}
                </div>
                {own && photo && <button onClick={() => setCmp(!cmp)} className="btn-ghost mt-7 !py-2.5 text-xs">{cmp ? "Back to single drape" : "Compare best vs. avoid"}</button>}
              </div>
            </div>
          </div>
        </Reveal>

        {/* palette by garment */}
        <section>
          <Reveal>
            <p className="eyebrow">Your palette</p>
            <h2 className="display mt-3 text-5xl">Colour, by garment.</h2>
          </Reveal>
          <div className="mt-10 space-y-12">
            {groups.map((g) => (
              <Reveal key={g.title}>
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-2xl">{g.title}</h3>
                  <p className="text-sm text-mist-soft">{g.note}</p>
                </div>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
                  {g.swatches.slice(0, 16).map((x) => <SwatchTile key={x.hex + x.name} s={x} onPick={setPick} />)}
                </div>
              </Reveal>
            ))}
            <Reveal>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-2xl">Keep away from your face</h3>
                <p className="text-sm text-mist-soft">Wear these below the waist, if at all.</p>
              </div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {s.avoid.map((x) => <SwatchTile key={x.hex} s={x} crossed />)}
              </div>
            </Reveal>
          </div>
        </section>

        {/* metals, makeup, hair */}
        <section className="grid gap-5 lg:grid-cols-3">
          <Reveal>
            <InfoCard title="Metals & gems" eyebrow="Jewellery" link="/for-you/jewellery">
              <div className="flex gap-3">{s.metals.best.map((m) => <div key={m.name} className="text-center"><span className="mx-auto block h-12 w-12 rounded-full shadow-glow" style={{ background: `radial-gradient(circle at 30% 30%, #fff8, transparent 40%), ${m.hex}` }} /><span className="mt-1.5 block text-[11px] text-mist-soft">{m.name}</span></div>)}</div>
              <p className="mt-4 text-sm"><span className="text-mist-soft">Finish:</span> {s.metals.finish}</p>
              <p className="mt-1 text-sm"><span className="text-mist-soft">Gems:</span> {s.gems.join(", ")}</p>
              <p className="mt-1 text-sm"><span className="text-mist-soft">Undertone:</span> {u.metals}</p>
            </InfoCard>
          </Reveal>
          <Reveal delay={0.08}>
            <InfoCard title="Makeup" eyebrow="Face" link="/for-you/makeup">
              <Shades label="Lips" xs={s.makeup.lips} />
              <Shades label="Blush" xs={s.makeup.blush} />
              <Shades label="Eyes" xs={s.makeup.eyes} />
              <Shades label="Nails" xs={s.makeup.nails} />
              <p className="mt-3 text-xs text-mist-soft">Foundation: {s.makeup.foundation}. Liner: {s.makeup.liner}.</p>
            </InfoCard>
          </Reveal>
          <Reveal delay={0.16}>
            <InfoCard title="Hair colour" eyebrow="Hair" link="/for-you/hairstyles">
              <div className="flex gap-2">{s.hair.best.map((h) => <div key={h.name} className="flex-1 text-center"><span className="block h-16 rounded-2xl" style={{ background: `linear-gradient(170deg, ${h.hex}, ${h.hex}cc)` }} /><span className="mt-1.5 block text-[10px] leading-tight text-mist-soft">{h.name}</span></div>)}</div>
              <p className="mt-4 text-sm">{s.hair.note}</p>
              <p className="mt-2 text-xs text-mist-soft">Skip: {s.hair.avoid.join(", ")}</p>
            </InfoCard>
          </Reveal>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <Reveal><InfoCard title="Prints & patterns" eyebrow="Pattern"><p className="text-sm leading-relaxed">{s.prints}</p></InfoCard></Reveal>
          <Reveal delay={0.08}><InfoCard title="Fabrics & texture" eyebrow="Texture"><p className="text-sm leading-relaxed">{s.fabrics}</p></InfoCard></Reveal>
        </section>

        {/* celebrities */}
        <section>
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Shared season</p>
              <h2 className="display mt-3 text-5xl">Also {s.name}.</h2>
              <p className="mt-2 text-sm text-mist-soft">From our reference set of 278 analyst-verified celebrities.</p>
            </div>
            <GenderToggle value={gender} onChange={setGender} />
          </Reveal>
          <div className="mt-8 flex flex-wrap gap-2">
            {people.map((c, i) => (
              <motion.span key={c.n} initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 12) * 0.03 }} className="rounded-full border border-edge bg-white/[0.06] px-4 py-2 text-sm">
                {c.n} <span className="text-xs text-mist-faint">· {c.u}</span>
              </motion.span>
            ))}
          </div>
        </section>

        {/* sisters + CTA */}
        <section className="grid gap-5 md:grid-cols-[1fr_1.4fr]">
          <Reveal>
            <InfoCard title="Sister seasons" eyebrow="Neighbours">
              <p className="mb-4 text-sm text-mist-soft">Seasons that share a trait with yours — you can borrow their best colours.</p>
              {s.sisters.map((id) => {
                const x = SEASON_BY_ID[id];
                return (
                  <Link key={id} to={`/seasons/${id}`} className="mb-2 flex items-center justify-between rounded-2xl border border-edge p-3 transition hover:bg-white/[0.08]">
                    <span className="flex items-center gap-3"><span className="h-8 w-8 rounded-full" style={{ background: gradientCss(x.gradient) }} /><span className="font-display text-xl">{x.name}</span></span>
                    <span className="flex -space-x-1">{x.palette.slice(0, 4).map((p) => <SwatchDot key={p.hex} s={p} size={16} ring />)}</span>
                  </Link>
                );
              })}
            </InfoCard>
          </Reveal>
          <Reveal delay={0.08}>
            <Link to="/for-you" className="group relative flex h-full min-h-[16rem] flex-col justify-end overflow-hidden rounded-[28px] p-8" style={{ background: gradientCss(s.gradient, 140) }}>
              <div className="absolute inset-0 bg-gradient-to-t from-ink/50 to-transparent" />
              <div className="relative text-night">
                <p className="eyebrow !text-night/80">Lookbook</p>
                <p className="display mt-2 text-5xl">Wear {s.name}.</p>
                <p className="mt-2 flex items-center gap-2 text-sm">Outfits for every occasion <ArrowRight size={15} className="transition group-hover:translate-x-1" /></p>
              </div>
            </Link>
          </Reveal>
        </section>
      </div>
    </div>
  );
}

function InfoCard({ title, eyebrow, link, children }: { title: string; eyebrow: string; link?: string; children: React.ReactNode }) {
  return (
    <div className="panel h-full p-6">
      <div className="mb-5 flex items-start justify-between">
        <div><p className="eyebrow !text-[10px]">{eyebrow}</p><h3 className="mt-1 font-display text-2xl">{title}</h3></div>
        {link && <Link to={link} className="grid h-9 w-9 place-items-center rounded-full border border-edge transition hover:bg-white/[0.08]" aria-label={`Open ${title}`}><ArrowRight size={15} /></Link>}
      </div>
      {children}
    </div>
  );
}

function Shades({ label, xs }: { label: string; xs: Swatch[] }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="w-12 text-xs text-mist-soft">{label}</span>
      <div className="flex flex-wrap gap-1.5">{xs.map((x) => <span key={x.name} title={`${x.name} · ${x.hex}`} className="flex items-center gap-1.5 rounded-full border border-edge bg-white/[0.04] py-0.5 pl-0.5 pr-2 text-[11px]"><span className="h-5 w-5 rounded-full" style={{ background: x.hex }} />{x.name}</span>)}</div>
    </div>
  );
}
