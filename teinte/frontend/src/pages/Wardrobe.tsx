import { AnimatePresence, motion } from "framer-motion";
import { Camera, ImagePlus, Shirt, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ease, Reveal, SwatchDot } from "../components/ui";
import { SEASON_BY_ID, type Season, type Swatch } from "../data/seasons";
import { dominantColours, paletteScore } from "../lib/color";
import { useProfile } from "../lib/profile";

type Verdict = { hex: string; share: number; score: number; match: Swatch; clash: Swatch | null };

export default function Wardrobe() {
  const { season: mine, ask } = useProfile();
  const season: Season = mine ?? SEASON_BY_ID["soft-autumn"];
  const [img, setImg] = useState<string | null>(null);
  const [res, setRes] = useState<Verdict[] | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const onFile = async (f: File) => {
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.src = url;
    await im.decode();
    const s = 220 / Math.max(im.width, im.height);
    const c = document.createElement("canvas");
    c.width = Math.round(im.width * s);
    c.height = Math.round(im.height * s);
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(im, 0, 0, c.width, c.height);
    // the central 60% is the garment; borders are usually background
    const x0 = Math.round(c.width * 0.2), y0 = Math.round(c.height * 0.2);
    const d = g.getImageData(x0, y0, Math.round(c.width * 0.6), Math.round(c.height * 0.6)).data;
    const cols = dominantColours(d, 4).slice(0, 3);
    setImg(url);
    setRes(cols.map((x) => ({ ...x, ...(({ score, match, clash }) => ({ score, match, clash }))(paletteScore(x.hex, season)) })));
  };

  const main = res?.[0];
  const overall = res ? Math.round(res.reduce((a, b) => a + b.score * b.share, 0) / res.reduce((a, b) => a + b.share, 0)) : 0;
  const verdict = overall >= 75 ? "A beautiful match" : overall >= 50 ? "Works with care" : "Not your colour";

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 md:pt-14 lg:px-10">
      <div className="grid gap-12 lg:grid-cols-2">
        <div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="eyebrow">Wardrobe check</motion.p>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease }} className="display mt-4 text-[56px] md:text-[84px]">
            Will it <em className="text-aura">suit</em> you?
          </motion.h1>
          <p className="mt-6 max-w-lg text-lg text-mist-soft">
            Snap a garment in the shop or from your wardrobe. We find its main colours and score them against your {season.name} palette — right here in your browser.
          </p>
          {!mine && <p className="mt-4 text-sm text-mist-soft">Checking against <strong className="font-medium">Soft Autumn</strong> as an example. <Link to="/analyze" className="underline">Find your season</Link>.</p>}
          <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => input.current?.click()} className="btn-light !px-7 !py-3.5"><Camera size={16} /> Photograph a garment</button>
            <button onClick={() => input.current?.click()} className="btn-ghost !px-7 !py-3.5"><ImagePlus size={16} /> Upload</button>
          </div>
          <ul className="mt-10 space-y-2 text-sm text-mist-soft">
            <li>· Lay the garment flat or hang it against a plain wall.</li>
            <li>· Use daylight — shop lighting is often warm or green.</li>
            <li>· Fill most of the frame with the fabric.</li>
          </ul>
        </div>

        <div>
          <AnimatePresence mode="wait">
            {!res ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid aspect-[4/5] place-items-center rounded-[40px] border border-dashed border-white/20 bg-white/[0.04]">
                <div className="text-center text-mist-faint"><Shirt size={42} strokeWidth={1} className="mx-auto" /><p className="mt-3 text-sm">Your garment will appear here</p></div>
              </motion.div>
            ) : (
              <motion.div key={img} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="panel overflow-hidden">
                <img src={img!} alt="Your garment" className="max-h-[420px] w-full object-cover" />
                <div className="space-y-3 p-6">
                  {/* Verdict banner — season label + score ring */}
                  <div className="flex items-center justify-between rounded-2xl bg-white/[0.06] px-4 py-3">
                    <div>
                      <p className="eyebrow !text-[10px]">{season.name} match</p>
                      <p className="font-display text-2xl">{verdict}</p>
                    </div>
                    <Ring value={overall} />
                  </div>
                  {res.map((v) => (
                    <div key={v.hex} className="flex items-center gap-4 rounded-2xl border border-edge p-3">
                      <span className="h-12 w-12 shrink-0 rounded-xl border border-white/10" style={{ background: v.hex }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{Math.round(v.share * 100)}% of the garment</p>
                        <p className="truncate text-xs text-mist-soft">Closest in your palette: {v.match.name}{v.clash ? ` · close to ${v.clash.name} (avoid)` : ""}</p>
                      </div>
                      <SwatchDot s={v.match} size={22} />
                      <span className="w-10 text-right text-sm tabular-nums">{v.score}</span>
                    </div>
                  ))}
                  {main && (
                    <button onClick={() => ask(`I'm looking at a garment in ${main.hex} (closest to my ${main.match.name}). Is it right for me, and what should I pair it with?`)} className="btn-ghost w-full"><Sparkles size={14} /> Ask the stylist what to pair it with</button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <Reveal className="mt-24">
        <p className="eyebrow">Shop with your palette</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {[...season.palette, ...season.neutrals].map((p) => <span key={p.hex + p.name} className="chip"><span className="h-3.5 w-3.5 rounded-full" style={{ background: p.hex }} />{p.name}</span>)}
        </div>
      </Reveal>
    </div>
  );
}

function Ring({ value }: { value: number }) {
  const r = 22, c = 2 * Math.PI * r;
  const col = value >= 75 ? "#4f9d7e" : value >= 50 ? "#c9a227" : "#d97757";
  return (
    <div className="relative h-14 w-14">
      <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="5" />
        <motion.circle cx="28" cy="28" r={r} fill="none" stroke={col} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value / 100) }} transition={{ duration: 1.2, ease }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-sm font-medium">{value}</span>
    </div>
  );
}
