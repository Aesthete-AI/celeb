import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Camera, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ColourCard, ItemCard, Lightbox } from "../components/ItemCard";
import { ease, GenderToggle, Reveal } from "../components/ui";
import {
  CATEGORIES, DEFAULT_PROFILE, OCCASIONS, PROFILES, STYLE_GUIDES, profileGradient,
  type CategoryId, type ColourProfile, type Gender,
} from "../data/profiles";
import type { Swatch } from "../data/seasons";
import { sized, useCatalog, type Catalog, type CatalogItem } from "../lib/catalog";
import { gendersFor, useProfile } from "../lib/profile";
import NotFound from "./NotFound";

const FAMS = ["Spring", "Summer", "Autumn", "Winter"] as const;
const UTS = ["Warm", "Neutral", "Cool"] as const;

/** Which profile to show: ?p= overrides (browsing), otherwise the user's own, otherwise an example. */
function useShownProfile() {
  const [params, setParams] = useSearchParams();
  const { colour, colourKey, profile } = useProfile();

  // A ?p= left over from browsing used to outrank a newer scan, so a fresh result opened on the
  // previously browsed season. Any scan or quiz finished after that link was followed wins instead.
  const browsedAt = useRef<number>(0);
  const pending = params.get("p");
  const browsing = !!(pending && PROFILES[pending]);
  useEffect(() => { if (browsing) browsedAt.current = Date.now(); }, [browsing, pending]);
  const stale = browsing && !!profile && profile.at > browsedAt.current;
  useEffect(() => {
    if (!stale) return;
    const next = new URLSearchParams(params);
    next.delete("p");
    setParams(next, { replace: true });
  }, [stale, params, setParams]);

  const override = browsing && !stale ? pending! : null;
  const key = override ?? (colour ? colourKey : DEFAULT_PROFILE);
  const setKey = (k: string) => { params.set("p", k); setParams(params, { replace: true }); };
  return { key, p: PROFILES[key], own: !!colour && key === colourKey, example: !colour && !override, setKey, params, setParams };
}

/* ───────────────────────────────────────────────────────── hub */
export function ForYouHub() {
  const { key, p, own, example, setKey } = useShownProfile();
  const { gender, setGender, profile, ask } = useProfile();
  const { catalog } = useCatalog(key);
  const g: Gender = gender === "male" ? "male" : "female";

  return (
    <div className="pb-10">
      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 md:pt-16 lg:px-10">
        <div className="grid items-end gap-12 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="eyebrow">{own ? `Your edit · from your ${profile?.source === "scan" ? "scan" : "quiz"}` : example ? "Example edit" : "Browsing"}</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease }} className="display mt-4 text-[58px] md:text-[96px]">
              {p.family}, <span className="italic text-aura">{p.undertone.toLowerCase()}</span>
              <span className="block text-[0.55em] text-mist-soft">{p.mood}.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease, delay: 0.15 }} className="mt-6 max-w-2xl text-lg leading-relaxed text-mist-soft">{p.rule}</motion.p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <GenderToggle value={gender} onChange={setGender} />
              {example && <Link to="/analyze" className="btn-aura !py-2.5"><Camera size={15} /> Personalise with a selfie</Link>}
              <button onClick={() => ask("Walk me through my colour profile and what to wear first.")} className="btn-ghost !py-2.5"><Sparkles size={14} /> Ask the stylist</button>
            </div>
          </div>
          <Matrix current={key} onPick={setKey} mine={own ? key : undefined} />
        </div>
        <Ribbon p={p} />
      </section>

      <div className="mx-auto max-w-7xl space-y-24 px-4 pt-24 sm:px-6 lg:px-10">
        <CategoryRows title="Style guides" ids={STYLE_GUIDES} p={p} catalog={catalog} g={g} profileKey={key} />
        <CategoryRows title="Occasions" ids={OCCASIONS} p={p} catalog={catalog} g={g} profileKey={key} />
      </div>
    </div>
  );
}

function Matrix({ current, onPick, mine }: { current: string; onPick: (k: string) => void; mine?: string }) {
  return (
    <div className="panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="eyebrow">Season × undertone</p>
        <p className="text-[10px] text-mist-faint">12 profiles</p>
      </div>
      <div className="grid grid-cols-[auto_repeat(4,1fr)] gap-1.5 text-[10px] text-mist-faint">
        <span />
        {FAMS.map((f) => <span key={f} className="pb-1 text-center uppercase tracking-wider">{f}</span>)}
        {UTS.map((u) => (
          <Row key={u} u={u} current={current} onPick={onPick} mine={mine} />
        ))}
      </div>
    </div>
  );
}

function Row({ u, current, onPick, mine }: { u: (typeof UTS)[number]; current: string; onPick: (k: string) => void; mine?: string }) {
  return (
    <>
      <span className="flex items-center pr-2 uppercase tracking-wider">{u}</span>
      {FAMS.map((f) => {
        const k = `${f.toLowerCase()}-${u.toLowerCase()}`;
        const p = PROFILES[k];
        const on = k === current;
        return (
          <button key={k} onClick={() => onPick(k)} title={p.label} className={`relative aspect-[1.4] overflow-hidden rounded-xl transition ${on ? "ring-2 ring-mist ring-offset-2 ring-offset-night" : "opacity-60 hover:opacity-100"}`} style={{ background: profileGradient(p) }}>
            {mine === k && <span className="absolute bottom-1 right-1 rounded-full bg-black/50 px-1.5 text-[8px] text-white">you</span>}
          </button>
        );
      })}
    </>
  );
}

function Ribbon({ p }: { p: ColourProfile }) {
  const groups: [string, Swatch[]][] = [["Wear", p.colours], ["Base", p.neutrals], ["Metals", p.metals], ["Avoid", p.avoid]];
  return (
    <div className="mt-14 grid gap-6 md:grid-cols-[2fr_1fr_0.8fr_1fr]">
      {groups.map(([t, xs], gi) => (
        <div key={t}>
          <p className="eyebrow mb-3">{t}</p>
          <div className="flex flex-wrap gap-2">
            {xs.map((s, i) => (
              <motion.span key={s.hex + s.name} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + gi * 0.1 + i * 0.04, duration: 0.5, ease }}
                className="group relative" title={`${s.name} · ${s.hex}`}>
                <span className={`block h-11 w-11 rounded-full ring-1 ring-white/10 ${t === "Avoid" ? "opacity-70" : ""}`} style={{ background: t === "Metals" ? `radial-gradient(circle at 30% 28%, #ffffffaa, transparent 40%), ${s.hex}` : s.hex }} />
                {t === "Avoid" && <span className="absolute inset-0 rotate-45 before:absolute before:left-1/2 before:top-0 before:h-full before:w-px before:bg-white/70" />}
              </motion.span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CategoryRows({ title, ids, p, catalog, g, profileKey }: { title: string; ids: CategoryId[]; p: ColourProfile; catalog: Catalog | null; g: Gender; profileKey: string }) {
  return (
    <section>
      <Reveal><p className="eyebrow mb-8">{title}</p></Reveal>
      <div className="space-y-5">
        {ids.map((id, i) => {
          const items = catalog?.categories[id]?.[g] ?? [];
          const placeholders = placeholdersFor(p, id).slice(0, 4);
          return (
            <Reveal key={id} delay={i * 0.04}>
              <Link to={`/for-you/${id}?p=${profileKey}`} className="panel panel-hover group grid items-center gap-6 p-4 md:grid-cols-[1fr_2.2fr] md:p-5">
                <div className="px-2">
                  <p className="eyebrow !text-[9.5px]">{CATEGORIES[id].kicker}</p>
                  <p className="mt-2 font-display text-3xl">{CATEGORIES[id].title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-mist-soft">{p.why[id]}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs text-mist transition group-hover:gap-2.5">View the edit <ArrowRight size={13} /></span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {items.length
                    ? items.slice(0, 4).map((it) => (
                        <div key={it.id} className="relative aspect-[3/4] overflow-hidden rounded-2xl" style={{ background: it.avg ?? "#15141B" }}>
                          <img src={sized(it.thumb, 360)} alt={it.alt} loading="lazy" className="h-full w-full object-cover transition duration-[1200ms] group-hover:scale-[1.05]" />
                        </div>
                      ))
                    : placeholders.map((s, k) => (
                        <div key={k} className="relative aspect-[3/4] overflow-hidden rounded-2xl" style={{ background: `radial-gradient(120% 90% at 30% 15%, ${s.hex}, ${s.hex}aa 50%, #0E0D12 125%)` }}>
                          <span className="absolute bottom-2 left-2.5 text-[10px] text-white/85">{s.title}</span>
                        </div>
                      ))}
                </div>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

function placeholdersFor(p: ColourProfile, id: CategoryId): { title: string; hex: string; note: string }[] {
  const map = (xs: Swatch[], note: string) => xs.map((s) => ({ title: s.name, hex: s.hex, note }));
  if (id === "jewellery") return [...map(p.metals, "Your metal"), ...map(p.colours.slice(0, 4), "Stone tone"), ...map(p.neutrals.slice(0, 2), "Pearl & neutral")];
  if (id === "hairstyles") return [...map(p.hair, "Hair colour"), ...map(p.neutrals, "Soft dimension")];
  if (id === "makeup") return [...map(p.lips, "Lips"), ...map(p.blush, "Cheeks"), ...map(p.eyes, "Eyes")];
  if (id === "footwear") return [...map(p.neutrals, "Leather & suede"), ...map(p.colours.slice(0, 3), "Statement pair"), ...map(p.metals.slice(0, 1), "Hardware")];
  return [...map(p.colours, "Near the face"), ...map(p.neutrals, "Your base")];
}

/* ───────────────────────────────────────────────────────── category */
export function ForYouCategory() {
  const { category = "" } = useParams();
  const { key, p, own, example, setKey, params, setParams } = useShownProfile();
  const { gender: saved, setGender, ask } = useProfile();
  const { catalog, loading } = useCatalog(key);
  const [open, setOpen] = useState<CatalogItem | null>(null);
  const id = category as CategoryId;
  // ?g= (set when the stylist infers "my husband…") overrides the view for this page; the toggle clears it
  const pg = params.get("g");
  const gender = pg === "female" || pg === "male" || pg === "all" ? pg : saved;
  const pickGender = (v: Gender | "all") => { setGender(v); params.delete("g"); setParams(params, { replace: true }); };

  if (!(id in CATEGORIES)) return <NotFound />;
  const meta = CATEGORIES[id];

  return (
    <div className="pb-10">
      <Tabs active={id} profileKey={key} />
      <section className="mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6 md:pt-14 lg:px-10">
        <div className="grid items-end gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <motion.p key={id + "k"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="eyebrow">{meta.kicker} · {p.family} {p.undertone}</motion.p>
            <motion.h1 key={id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }} className="display mt-4 text-[54px] md:text-[88px]">{meta.title}</motion.h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-mist-soft">{p.why[id]}</p>
          </div>
          <div className="space-y-4 lg:pb-2">
            <div className="flex flex-wrap gap-1.5">{targetsFor(p, id).map((s) => <span key={s.hex + s.name} className="chip"><span className="h-3.5 w-3.5 rounded-full ring-1 ring-white/20" style={{ background: s.hex }} />{s.name}</span>)}</div>
            <div className="flex flex-wrap items-center gap-3">
              <GenderToggle value={gender} onChange={pickGender} />
              <ProfilePicker current={key} onPick={setKey} />
            </div>
            {example && <p className="text-xs text-mist-faint">Showing an example profile. <Link to="/analyze" className="text-mist underline decoration-white/30">Scan a selfie</Link> to see yours.</p>}
            {!own && !example && <p className="text-xs text-mist-faint">Browsing another profile.</p>}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-16 px-4 sm:px-6 lg:px-10">
        {gendersFor(gender).map((g) => {
          const items = catalog?.categories[id]?.[g] ?? [];
          return (
            <section key={g}>
              {gender === "all" && <h2 className="display mb-6 text-4xl">{g === "female" ? "For her" : "For him"}</h2>}
              {items.length ? (
                // <div className="columns-2 gap-4 md:columns-3 xl:columns-5">
                // Masonry columns gave photos different heights, and Chrome often skipped painting images
                // inside CSS columns until hovered. A uniform grid fixes both: every card the same size.
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
                  {items.map((it, i) => <ItemCard key={it.id} item={it} index={i} onOpen={() => setOpen(it)} />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                  {loading
                    ? Array.from({ length: 8 }, (_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-[22px] bg-white/[0.04]" />)
                    : placeholdersFor(p, id).slice(0, 8).map((s, i) => <ColourCard key={i} index={i} {...s} />)}
                </div>
              )}
              {!loading && !items.length && <p className="mt-2 text-xs text-mist-faint">Curated photography for this edit is being prepared — these colour stories show exactly what it will match.</p>}
            </section>
          );
        })}
        <Reveal>
          <button onClick={() => ask(meta.kind === "occasion" ? `What should I wear for ${meta.title.toLowerCase()}?` : `Give me personalised ${meta.title.toLowerCase()} advice.`)} className="panel panel-hover flex w-full items-center justify-between p-6 text-left">
            <span><span className="eyebrow block">Personal stylist</span><span className="mt-1 block font-display text-2xl">Ask how to wear your {meta.title.toLowerCase()} edit</span></span>
            <Sparkles />
          </button>
        </Reveal>
      </div>
      <Lightbox item={open} onClose={() => setOpen(null)} onAsk={(it) => { setOpen(null); ask(`How should I style this ${it.alt || "piece"}${it.match ? ` (it matches my ${it.match})` : ""}?`); }} />
    </div>
  );
}

function targetsFor(p: ColourProfile, id: CategoryId): Swatch[] {
  if (id === "jewellery") return p.metals;
  if (id === "hairstyles") return p.hair;
  if (id === "makeup") return [...p.lips, p.blush[0]];
  if (id === "office") return [...p.neutrals.slice(0, 2), p.colours[0]];
  if (id === "footwear") return [...p.neutrals.slice(1, 4), p.colours[0], p.metals[0]];
  return p.colours.slice(0, 5);
}

function Tabs({ active, profileKey }: { active: CategoryId; profileKey: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector<HTMLElement>(`[data-id="${active}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); }, [active]);
  const all = useMemo(() => [...STYLE_GUIDES, ...OCCASIONS], []);
  return (
    <div className="sticky top-16 z-30 border-b border-edge bg-night/75 backdrop-blur-2xl">
      <div ref={ref} className="no-scrollbar mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2.5 sm:px-6 lg:px-10">
        <Link to={`/for-you?p=${profileKey}`} className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] text-mist-soft hover:text-mist">Overview</Link>
        {all.map((c, i) => (
          <span key={c} className="flex items-center">
            {i === STYLE_GUIDES.length && <span className="mx-2 h-4 w-px bg-edge" />}
            <Link data-id={c} to={`/for-you/${c}?p=${profileKey}`} className={`relative whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${active === c ? "text-night" : "text-mist-soft hover:text-mist"}`}>
              {active === c && <motion.span layoutId="cat-tab" className="absolute inset-0 -z-10 rounded-full bg-mist" transition={{ type: "spring", stiffness: 380, damping: 34 }} />}
              {CATEGORIES[c].title}
            </Link>
          </span>
        ))}
      </div>
    </div>
  );
}

function ProfilePicker({ current, onPick }: { current: string; onPick: (k: string) => void }) {
  const [open, setOpen] = useState(false);
  const p = PROFILES[current];
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-full border border-edge bg-white/[0.04] py-1.5 pl-1.5 pr-3 text-xs text-mist">
        <span className="h-6 w-6 rounded-full" style={{ background: profileGradient(p) }} />{p.family} · {p.undertone}<ArrowUpRight size={12} className={`transition ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="absolute right-0 top-11 z-20 w-[320px] rounded-3xl border border-edge bg-night-3 p-4 shadow-lift">
          <Matrix current={current} onPick={(k) => { onPick(k); setOpen(false); }} />
        </motion.div>
      )}
    </div>
  );
}
