import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, MessageCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { sized, type CatalogItem } from "../lib/catalog";
import { ease } from "./ui";

/** One ranked photo: blurs up from its average colour, shows the palette colour it matches. */
export function ItemCard({ item, index, onOpen }: { item: CatalogItem; index: number; onOpen: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // const ratio = item.h / item.w;   ← cards used to follow each photo's own shape
  // A photo already in the browser cache can finish before React attaches onLoad, and Chrome's lazy
  // loading is unreliable inside CSS columns — either way the card stayed blank. Check on mount, and
  // never leave a card invisible for more than a few seconds.
  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth) setLoaded(true);
    const t = setTimeout(() => setLoaded(true), 4000);
    return () => clearTimeout(t);
  }, []);
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.7, ease, delay: (index % 4) * 0.06 }}
      // className="group relative mb-4 block w-full break-inside-avoid overflow-hidden rounded-[22px] text-left ring-1 ring-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mist"
      // style={{ background: item.avg ?? "#15141B", aspectRatio: `${1 / Math.min(Math.max(ratio, 0.75), 1.5)}` }}
      // every card is the same 3:4 frame; the photo is cropped to fill it
      className="group relative block aspect-[3/4] w-full overflow-hidden rounded-[22px] text-left ring-1 ring-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mist"
      style={{ background: item.avg ?? "#15141B" }}
    >
      <img
        src={sized(item.thumb, 640)}
        srcSet={`${sized(item.thumb, 420)} 420w, ${sized(item.thumb, 640)} 640w, ${sized(item.thumb, 900)} 900w`}
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        alt={item.alt || "Recommended look"}
        ref={img}
        // loading={index < 4 ? "eager" : "lazy"}   ← lazy images in the masonry columns often never loaded
        loading={index < 15 ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        // className={`h-full w-full object-cover transition duration-[1200ms] ease-out group-hover:scale-[1.04] ${loaded ? "opacity-100 blur-0" : "opacity-0 blur-md"}`}
        // a blur filter that animates away left some photos unpainted until hovered — fade opacity only
        className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-[900ms] ease-out group-hover:scale-[1.04] ${loaded ? "opacity-100" : "opacity-0"}`}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-80 transition group-hover:opacity-100" />
      {item.match && (
        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/45 py-1 pl-1 pr-2.5 text-[10.5px] text-white/90 backdrop-blur-md">
          <span className="h-4 w-4 rounded-full ring-1 ring-white/30" style={{ background: item.matchHex ?? undefined }} />
          {item.match}
        </span>
      )}
      <span className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2 text-[10.5px] text-white/70 opacity-0 transition duration-500 group-hover:opacity-100">
        <span className="truncate">Photo · {item.photographer}</span>
        <ArrowUpRight size={14} />
      </span>
    </motion.button>
  );
}

/** Rule-driven placeholder shown while a slot has no photography yet: a colour story, not an empty box. */
export function ColourCard({ title, hex, note, index }: { title: string; hex: string; note: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, ease, delay: (index % 4) * 0.06 }}
      className="relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-[22px] p-5 ring-1 ring-white/[0.07]"
      style={{ background: `radial-gradient(120% 90% at 20% 10%, ${hex}, ${hex}cc 45%, #0E0D12 120%)` }}
    >
      <span className="absolute right-4 top-4 h-10 w-10 rounded-full ring-1 ring-white/20" style={{ background: `radial-gradient(circle at 30% 30%, #ffffff55, transparent 45%), ${hex}` }} />
      <p className="font-display text-2xl leading-tight text-white drop-shadow">{title}</p>
      <p className="mt-1 text-xs text-white/75">{note}</p>
    </motion.div>
  );
}

export function Lightbox({ item, onClose, onAsk }: { item: CatalogItem | null; onClose: () => void; onAsk: (i: CatalogItem) => void }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [onClose]);
  return (
    <AnimatePresence>
      {item && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] grid place-items-center bg-black/80 p-4 backdrop-blur-xl" onClick={onClose}>
          <motion.div initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, opacity: 0 }} transition={{ duration: 0.45, ease }} onClick={(e) => e.stopPropagation()} className="grid max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[28px] border border-edge bg-night-2 md:grid-cols-[1.3fr_1fr]">
            <div className="relative bg-black" style={{ background: item.avg ?? "#000" }}>
              <img src={sized(item.full, 1400)} alt={item.alt} className="h-full max-h-[90vh] w-full object-contain" />
            </div>
            <div className="flex flex-col p-7">
              <button onClick={onClose} aria-label="Close" className="ml-auto grid h-9 w-9 place-items-center rounded-full border border-edge text-mist-soft hover:text-mist"><X size={16} /></button>
              <p className="eyebrow mt-2">Why it's in your edit</p>
              <p className="mt-3 font-display text-3xl leading-tight">{item.alt ? item.alt.charAt(0).toUpperCase() + item.alt.slice(1) : "Recommended look"}</p>
              {item.match && (
                <p className="mt-4 flex items-center gap-2 text-sm text-mist-soft">
                  <span className="h-5 w-5 rounded-full ring-1 ring-white/20" style={{ background: item.matchHex ?? undefined }} />
                  Its main colour sits right on your <span className="text-mist">{item.match}</span>.
                </p>
              )}
              <div className="mt-5 flex gap-2">
                {item.colours.map((c) => <span key={c} className="h-8 flex-1 rounded-lg ring-1 ring-white/10" style={{ background: c }} title={c} />)}
              </div>
              <div className="mt-auto space-y-3 pt-8">
                <button onClick={() => onAsk(item)} className="btn-light w-full"><MessageCircle size={15} /> Ask the stylist how to wear it</button>
                <a href={item.url} target="_blank" rel="noreferrer" className="block text-center text-[11px] text-mist-faint hover:text-mist-soft">
                  Photo by {item.photographer} on {item.source ?? "Pexels"} ↗
                </a>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
