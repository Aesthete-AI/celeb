import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { ease, Reveal } from "../components/ui";
import { FAMILIES, SEASONS, gradientCss } from "../data/seasons";
import { useProfile } from "../lib/profile";

const FAMILY_COPY = {
  Spring: "Warm and clear — fresh, sunlit colour.",
  Summer: "Cool and soft — misty, blended colour.",
  Autumn: "Warm and muted — rich, earthy colour.",
  Winter: "Cool and clear — crisp, dramatic colour.",
};

export default function Seasons() {
  const { season: mine } = useProfile();
  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 md:pt-14 lg:px-10">
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="eyebrow">The 12-season system</motion.p>
      <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease }} className="display mt-4 max-w-4xl text-[56px] md:text-[96px]">
        Four families. <em className="text-aura">Twelve seasons.</em>
      </motion.h1>
      <p className="mt-6 max-w-2xl text-lg text-mist-soft">
        Every season is defined by three qualities of your natural colouring — <strong className="font-medium text-mist">hue</strong> (warm or cool), <strong className="font-medium text-mist">value</strong> (light or deep) and <strong className="font-medium text-mist">chroma</strong> (bright or soft). Your dominant quality names your season.
      </p>

      <div className="mt-20 space-y-20">
        {FAMILIES.map((f) => (
          <section key={f}>
            <Reveal className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="display text-5xl">{f}</h2>
              <p className="text-mist-soft">{FAMILY_COPY[f]}</p>
            </Reveal>
            <div className="grid gap-4 md:grid-cols-3">
              {SEASONS.filter((s) => s.family === f).map((s, i) => (
                <Reveal key={s.id} delay={i * 0.08}>
                  <Link to={`/seasons/${s.id}`} className="group block overflow-hidden rounded-[28px] border border-edge bg-white/[0.04] transition hover:-translate-y-1 hover:shadow-lift">
                    <div className="relative h-44" style={{ background: gradientCss(s.gradient, 140) }}>
                      {mine?.id === s.id && <span className="absolute left-4 top-4 chip !bg-white/[0.06] !text-mist">Your season</span>}
                      <ArrowUpRight className="absolute right-4 top-4 text-mist/70 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" size={20} />
                    </div>
                    <div className="flex h-3">{s.palette.slice(0, 12).map((p) => <span key={p.hex} className="flex-1" style={{ background: p.hex }} />)}</div>
                    <div className="p-6">
                      <p className="font-display text-3xl">{s.name}</p>
                      <p className="mt-1 text-sm italic text-mist-soft">{s.tagline}</p>
                      <div className="mt-4 flex flex-wrap gap-1.5 text-[11px]">
                        <span className="chip !py-1">{s.dims.hue}</span>
                        <span className="chip !py-1">{s.dims.value}</span>
                        <span className="chip !py-1">{s.dims.chroma}</span>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
