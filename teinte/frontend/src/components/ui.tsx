import { motion, type HTMLMotionProps } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Gender } from "../data/profiles";
import type { Swatch as SwatchT } from "../data/seasons";
import { isLight } from "../lib/color";

export const ease = [0.22, 1, 0.36, 1] as const;

export function Reveal({ children, delay = 0, y = 18, ...rest }: { children: ReactNode; delay?: number; y?: number } & HTMLMotionProps<"div">) {
  return (
    <motion.div initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.8, ease, delay }} {...rest}>
      {children}
    </motion.div>
  );
}

/** Deep, slow-moving colour glows behind every page — tinted by the user's palette after a scan. */
export function Aurora({ colours }: { colours?: string[] }) {
  const c = colours ?? ["#5B2A86", "#8A3B2E", "#0F5C55", "#7A2A55"];
  const blobs = [
    { cls: "-left-[15%] -top-[25%] h-[75vh] w-[75vh]", d: 0, o: 0.42 },
    { cls: "right-[-20%] top-[10%] h-[80vh] w-[80vh]", d: -7, o: 0.32 },
    { cls: "left-[20%] bottom-[-35%] h-[70vh] w-[70vh]", d: -13, o: 0.3 },
    { cls: "right-[15%] bottom-[-15%] h-[45vh] w-[45vh]", d: -4, o: 0.22 },
  ];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-night">
      {blobs.map((b, i) => (
        <div key={i} className={`absolute rounded-full blur-[120px] animate-drift transition-[background] duration-[2000ms] ${b.cls}`} style={{ background: c[i % c.length], opacity: b.o, animationDelay: `${b.d}s` }} />
      ))}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,rgba(8,8,11,.55)_70%)]" />
    </div>
  );
}

export function SwatchDot({ s, size = 40, ring = false }: { s: SwatchT; size?: number; ring?: boolean }) {
  return (
    <span title={`${s.name} · ${s.hex}`} className={`inline-block shrink-0 rounded-full ${ring ? "ring-2 ring-night" : "ring-1 ring-white/10"}`} style={{ width: size, height: size, background: s.hex }} />
  );
}

export function SwatchTile({ s, onPick, crossed = false, active = false }: { s: SwatchT; onPick?: (s: SwatchT) => void; crossed?: boolean; active?: boolean }) {
  const [copied, setCopied] = useState(false);
  const light = isLight(s.hex);
  return (
    <motion.button
      type="button"
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => {
        onPick?.(s);
        navigator.clipboard?.writeText(s.hex).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }, () => {});
      }}
      className={`group relative flex aspect-[4/5] w-full flex-col justify-end overflow-hidden rounded-2xl p-2.5 text-left ring-1 ring-white/10 transition ${active ? "ring-2 ring-mist" : "hover:ring-white/30"}`}
      style={{ background: s.hex, color: light ? "#0E0D12" : "#F4F1EC" }}
    >
      {crossed && <span className="absolute inset-0 bg-[linear-gradient(to_top_right,transparent_calc(50%-1px),rgba(255,255,255,.75)_50%,transparent_calc(50%+1px))]" />}
      <span className="relative text-[11px] font-medium leading-tight">{s.name}</span>
      <span className="relative flex items-center gap-1 text-[10px] opacity-70">
        {copied ? <Check size={10} /> : <Copy size={10} className="opacity-0 transition-opacity group-hover:opacity-100" />}
        {copied ? "Copied" : s.hex.toUpperCase()}
      </span>
    </motion.button>
  );
}

export function GenderToggle({ value, onChange, allowAll = true }: { value: Gender | "all"; onChange: (g: Gender | "all") => void; allowAll?: boolean }) {
  const opts: { v: Gender | "all"; l: string }[] = [{ v: "female", l: "Women" }, { v: "male", l: "Men" }, ...(allowAll ? [{ v: "all" as const, l: "Both" }] : [])];
  return (
    <div className="relative inline-flex rounded-full border border-edge bg-white/[0.04] p-1 backdrop-blur">
      {opts.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} className={`relative z-10 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${value === o.v ? "text-night" : "text-mist-soft hover:text-mist"}`}>
          {value === o.v && <motion.span layoutId="gender-pill" className="absolute inset-0 -z-10 rounded-full bg-mist" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function Meter({ value, label, tint = "#EEEAE4" }: { value: number; label: string; tint?: string }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs"><span className="text-mist-soft">{label}</span><span className="tabular-nums text-mist">{Math.round(value * 100)}%</span></div>
      <div className="h-1 overflow-hidden rounded-full bg-white/[0.07]">
        <motion.div className="h-full rounded-full" style={{ background: tint }} initial={{ width: 0 }} whileInView={{ width: `${value * 100}%` }} viewport={{ once: true }} transition={{ duration: 1.1, ease }} />
      </div>
    </div>
  );
}

/** Tiny markdown: **bold**, _italic_, bullets, paragraphs; hex codes become inline swatches. */
export function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2.5">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l)))
          return (
            <ul key={i} className="space-y-1.5">
              {lines.map((l, j) => (
                <li key={j} className="flex gap-2"><span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-mist/40" /><span>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ""))}</span></li>
              ))}
            </ul>
          );
        if (/^#{1,4}\s/.test(b)) return <p key={i} className="font-display text-lg">{inline(b.replace(/^#+\s/, ""))}</p>;
        return <p key={i}>{lines.map((l, j) => <span key={j}>{inline(l)}{j < lines.length - 1 && <br />}</span>)}</p>;
      })}
    </div>
  );
}

function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_|\*[^*]+\*|\(?#[0-9a-fA-F]{6}\)?)/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) out.push(<strong key={k++} className="font-semibold text-mist">{t.slice(2, -2)}</strong>);
    else if (t.includes("#")) {
      const hex = t.replace(/[()]/g, "");
      out.push(<span key={k++} className="mx-0.5 inline-block h-3 w-3 translate-y-[1px] rounded-full ring-1 ring-white/20 align-baseline" style={{ background: hex }} title={hex} />);
    } else out.push(<em key={k++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
