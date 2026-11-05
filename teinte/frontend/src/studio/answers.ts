// The Studio's answer format: a one-line verdict, then an organised body whose shape fits the question —
// labelled "Key: value" rows for a full look, a ranked list for one item, a table for a choice, numbered
// steps for a routine. The LLM is asked for this (format: "structured" on /api/chat); the offline answer
// below writes the same building blocks from the rules database, so both render identically.
import type { CategoryId, ColourProfile, Gender } from "../data/profiles";
import type { Swatch } from "../data/seasons";
import { followupsFor } from "../lib/stylist";

// ── v1: every answer was one fixed shape (sections of "Key: value" rows) ──────────────────────────
// export type Row = { key?: string; value: string };
// export type Section = { label: string; rows: Row[] };
// export type Parsed = { lead: string; sections: Section[] };
//
// export function parseStructuredV1(text: string): Parsed | null {
//   const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
//   const lead: string[] = [];
//   const sections: Section[] = [];
//   for (const raw of lines) {
//     const l = raw.replace(/^\*\*(.+?)\*\*:?$/, "## $1"); // tolerate **Outfit** headings
//     const h = l.match(/^#{1,4}\s+(.+?):?$/);
//     if (h) { sections.push({ label: h[1].replace(/\*\*/g, ""), rows: [] }); continue; }
//     const b = l.replace(/^([-*•]|\d+\.)\s+/, "");
//     if (!sections.length) { lead.push(b); continue; }
//     const m = b.match(/^\**([^:*]{1,28}?)\**:\s*(.+)$/);
//     sections[sections.length - 1].rows.push(m && m[1].split(/\s+/).length <= 4 ? { key: m[1].trim(), value: m[2] } : { value: b });
//   }
//   if (!sections.length) return null;
//   return { lead: lead.join(" "), sections };
// }

// ── v2: the shape follows the question. A section (optionally labelled with "## ") holds blocks:
//   rows   "- Key: value"           → key / value lines
//   list   "- text" or "1. text"     → bullets or a ranked / numbered list
//   table  "| | A | B |" lines       → a comparison table (first row is the header)
//   tip    "> Tip: text"             → a highlighted note
export type Row = { key?: string; value: string };
export type Block =
  | { kind: "rows"; rows: Row[] }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "tip"; text: string };
export type Section = { label?: string; blocks: Block[] };
export type Parsed = { lead: string; sections: Section[] };

const cells = (l: string) => l.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim().replace(/\*\*/g, ""));

export function parseStructured(text: string): Parsed | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const lead: string[] = [];
  const sections: Section[] = [];
  const cur = () => {
    if (!sections.length) sections.push({ blocks: [] });
    return sections[sections.length - 1];
  };
  const add = (b: Block) => {
    const sec = cur();
    const last = sec.blocks[sec.blocks.length - 1];
    if (last && last.kind === b.kind) {
      if (last.kind === "rows" && b.kind === "rows") return void last.rows.push(...b.rows);
      if (last.kind === "list" && b.kind === "list" && last.ordered === b.ordered) return void last.items.push(...b.items);
      if (last.kind === "table" && b.kind === "table") return void last.rows.push(...b.rows);
    }
    sec.blocks.push(b);
  };
  for (const raw of lines) {
    const l = raw.replace(/^\*\*([^*]{1,40})\*\*:?$/, "## $1"); // tolerate **Outfit** headings
    const h = l.match(/^#{1,4}\s+(.+?):?$/);
    if (h) { sections.push({ label: h[1].replace(/\*\*/g, ""), blocks: [] }); continue; }
    if (l.startsWith("|")) {
      if (/^\|?[\s:|-]+\|?$/.test(l)) continue; // the |---|---| separator
      const c = cells(l);
      const sec = cur();
      const last = sec.blocks[sec.blocks.length - 1];
      if (last?.kind === "table") last.rows.push(c);
      else sec.blocks.push({ kind: "table", head: c, rows: [] });
      continue;
    }
    if (l.startsWith(">")) { add({ kind: "tip", text: l.replace(/^>\s*/, "") }); continue; }
    const num = l.match(/^\d+[.)]\s+(.+)$/);
    if (num) { add({ kind: "list", ordered: true, items: [num[1]] }); continue; }
    const bul = l.match(/^[-*•]\s+(.+)$/);
    if (bul) {
      const kv = bul[1].match(/^\**([^:*]{1,28}?)\**:\s*(.+)$/);
      if (kv && kv[1].split(/\s+/).length <= 4) add({ kind: "rows", rows: [{ key: kv[1].trim(), value: kv[2] }] });
      else add({ kind: "list", ordered: false, items: [bul[1]] });
      continue;
    }
    // plain text: the verdict before anything structured, otherwise a line in the current section
    if (!sections.length) lead.push(l);
    else add({ kind: "list", ordered: false, items: [l] });
  }
  if (!sections.some((x) => x.blocks.length)) return null;
  return { lead: lead.join(" "), sections: sections.filter((x) => x.blocks.length || x.label) };
}

const h = (s: Swatch) => `${s.name.toLowerCase()} (${s.hex})`;

/** Offline answer when the stylist AI is unavailable. Like the AI's answers, its shape follows the
 *  question — a comparison table, a ranked list, steps or a palette — before falling back to the
 *  category's look. */
export function structuredLocal(p: ColourProfile, section: CategoryId | null, gender: Gender | "all", question = "") {
  const q = question.toLowerCase();
  const g0: Gender = gender === "male" ? "male" : "female";
  const warm = p.undertone === "Warm", cool = p.undertone === "Cool";
  // a choice between metals → comparison table
  if (/\bgold\b/.test(q) && /\bsilver\b/.test(q)) {
    const win = warm ? "Gold" : cool ? "Silver" : "Both";
    return {
      text: [
        win === "Both" ? `Both work for you — your ${p.undertone.toLowerCase()} undertone sits between them.` : `${win} — it echoes your ${p.undertone.toLowerCase()} undertone.`,
        "| | Gold | Silver |", "|---|---|---|",
        `| Undertone fit | ${warm ? "Lifts warm skin" : cool ? "Can look brassy" : "Soft, warm glow"} | ${cool ? "Brightens cool skin" : warm ? "Can look grey" : "Clean, crisp lift"} |`,
        `| Best finish | ${warm ? "Polished yellow gold" : "Brushed or rose gold"} | ${cool ? "High-shine platinum" : "Satin silver"} |`,
        `| Wear it for | Evening, festive | Day, office |`,
        `> Tip: Your best metals are ${p.metals.map(h).join(", ")}.`,
      ].join("\n"),
      followups: followupsFor("jewellery", g0),
    };
  }
  // one item or shade → ranked list
  if (/lipstick|lip colou?r|lip shade|lips\b/.test(q) && g0 === "female") {
    return { text: [`These ${p.lips.length} shades suit your ${p.family} colouring best.`, ...p.lips.map((s, i) => `${i + 1}. ${h(s)} — ${["everyday", "evening", "statement"][i] ?? "occasional"}`)].join("\n"), followups: followupsFor("makeup", g0) };
  }
  // a routine → numbered steps
  if (/routine|step|how (do|to|should)/.test(q) && (section === "makeup" || /makeup|groom/.test(q))) {
    const steps = g0 === "male"
      ? ["Cleanse and moisturise", `Spot-conceal with a ${p.undertone.toLowerCase()}-toned concealer`, "Brush brows up", `Finish with a balm close to ${h(p.lips[1] ?? p.lips[0])}`]
      : [`Skin tint with a ${p.undertone.toLowerCase()} undertone`, `Blush in ${h(p.blush[0])} on the apples`, `Eyes in ${h(p.eyes[0])}, softly blended`, `Lips in ${h(p.lips[0])}`];
    return { text: ["A quick routine built on your palette.", ...steps.map((t, i) => `${i + 1}. ${t}`), `> Tip: Keep anything close to ${h(p.avoid[0])} away from your face.`].join("\n"), followups: followupsFor("makeup", g0) };
  }
  // which colours suit me → palette groups
  if (/colou?rs? (suit|for|work)|my colou?rs|my palette|best colou?rs|which colou?r/.test(q)) {
    return {
      text: [p.why.clothing, "## Wear most", ...p.colours.slice(0, 4).map((s) => `- ${h(s)}`), "## Neutrals", ...p.neutrals.slice(0, 3).map((s) => `- ${h(s)}`), "## Keep away", ...p.avoid.slice(0, 3).map((s) => `- ${h(s)}`)].join("\n"),
      followups: followupsFor("clothing", g0),
    };
  }
  return structuredLocalLook(p, section, gender);
}

/** The category's look — rows of key: value under labelled sections. */
function structuredLocalLook(p: ColourProfile, section: CategoryId | null, gender: Gender | "all") {
  const id: CategoryId = section ?? "clothing";
  const g: Gender = gender === "male" ? "male" : "female";
  const c = p.colours, n = p.neutrals, m = p.metals[0];
  const out: string[] = [p.why[id]];
  if (id === "makeup") {
    if (g === "male") out.push("## Grooming", `- Concealer: matched to a ${p.undertone.toLowerCase()} undertone`, `- Lip balm: tinted, close to ${h(p.lips[1] ?? p.lips[0])}`, "- Brows: brushed up, softly defined");
    else out.push("## Lips", ...p.lips.slice(0, 2).map((s, i) => `- ${i ? "Evening" : "Everyday"}: ${h(s)}`), "## Cheeks & eyes", `- Blush: ${h(p.blush[0])}`, `- Eyes: ${p.eyes.slice(0, 2).map(h).join(", ")}`);
  } else if (id === "hairstyles") {
    out.push("## Hair colour", `- Best: ${h(p.hair[0])}`, ...(p.hair[1] ? [`- Also: ${h(p.hair[1])}`] : []), "## Avoid", `- Near your face: ${p.avoid.slice(0, 2).map(h).join(", ")}`);
  } else if (id === "footwear") {
    out.push("## Everyday", `- Leather: ${h(n[2] ?? n[0])}`, `- Suede: ${h(n[3] ?? n[1])}`, "## Statement pair", `- Colour: ${h(c[0])}`, `- Hardware: ${h(m)}`,
      g === "male" ? "## Styles\n- Work: oxfords or derbies\n- Weekend: loafers or clean leather sneakers" : "## Styles\n- Evening: strappy sandals or pumps\n- Day: ankle boots, ballet flats or sneakers");
  } else if (id === "jewellery") {
    out.push("## Jewellery", `- Metal: ${h(m)}${p.metals[1] ? `, ${h(p.metals[1])}` : ""}`, `- Stones: ${p.gems.slice(0, 3).join(", ")}`, g === "male" ? `- Pieces: ${m.name.toLowerCase()} watch, signet ring` : `- Pieces: ${m.name.toLowerCase()} hoops, fine layered chain`);
  } else {
    out.push("## Outfit", `- Hero colour: ${h(c[0])}`, `- Second colour: ${h(c[1])}`, `- Base: ${h(n[0])}, ${h(n[3] ?? n[1])}`, "## Finish", `- Metal: ${h(m)}`, "## Avoid", `- Colours: ${p.avoid.slice(0, 3).map(h).join(", ")}`);
  }
  return { text: out.join("\n"), followups: followupsFor(id, g) };
}
