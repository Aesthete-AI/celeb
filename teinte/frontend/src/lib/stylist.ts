// The recommendation engine's grounding layer. It (1) builds the context the LLM stylist answers from — the
// user's colour profile rules plus the photos on the matching page — and (2) answers on its own, from the same
// rules database, whenever no LLM is reachable.
import { CATEGORIES, type CategoryId, type ColourProfile, type Gender } from "../data/profiles";
import type { Swatch } from "../data/seasons";
import type { Catalog } from "./catalog";
import type { Profile } from "./profile";

const sw = (x: Swatch) => `${x.name} (${x.hex})`;
const list = (xs: Swatch[], n = 6) => xs.slice(0, n).map(sw).join(", ");
const low = (x: Swatch) => x.name.toLowerCase();

// Stock-library alt text is a raw tag dump — repeated, and padded with SEO words that say nothing about
// the clothes ("hot girl", "attractive", "aesthetic"). Keep the few tags that describe the garment.
// a tag is dropped when any word in it is one of these — "hot girl" and "indian model" go, "evening dress" stays
const TAG_NOISE = /\b(hot|sexy|beautiful|pretty|cute|attractive|glamour|glamorous|beauty|youth|young|girl|boy|woman|women|man|men|male|female|lady|person|people|model|modeling|portrait|pose|posing|photography|photo|studio|exclusive|art|aesthetic|expression|face|adult|indian|asian|caucasian|african|background|copy space)\b/i;

function describe(alt: string | undefined) {
  const tags = (alt || "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  const seen = new Set<string>();
  const kept = tags.filter((t) => !TAG_NOISE.test(t) && !seen.has(t) && (seen.add(t), true)).slice(0, 6);
  return kept.length ? kept.join(", ") : "photo";
}

export function buildContext(profile: Profile | null, p: ColourProfile | null, gender: Gender | "all", section: CategoryId | null, page: string, catalog?: Catalog | null) {
  if (!profile || !p) return `No colour profile yet. The client is browsing: ${page}.`;
  const lines = [
    `Colour profile: ${p.label} — ${p.mood}. 12-season detail: ${profile.season}.`,
    `Source: ${profile.source === "scan" ? `AI photo analysis${profile.confidence ? ` (season confidence ${Math.round(profile.confidence * 100)}%)` : ""}` : "questionnaire"}.`,
    `Rules: ${p.rule}`,
    `Best colours: ${list(p.colours, 8)}. Neutrals: ${list(p.neutrals)}. Avoid: ${list(p.avoid)}.`,
    `Metals: ${p.metals.map((m) => m.name).join(", ")}. Gems: ${p.gems.join(", ")}.`,
    `Makeup: lips ${list(p.lips)}; blush ${list(p.blush)}; eyes ${list(p.eyes)}.`,
    `Hair colours: ${list(p.hair)}.`,
    `Looks requested for: ${gender === "all" ? "women and men" : gender === "male" ? "men" : "women"}.`,
    `The client is viewing: ${page}.`,
  ];
  if (section) {
    lines.push(`Category rule for ${CATEGORIES[section].title}: ${p.why[section]}`);
    const g: Gender = gender === "male" ? "male" : "female";
    const items = catalog?.categories[section]?.[g]?.slice(0, 6) ?? [];
    if (items.length) lines.push(`Photos on screen (refer to them by their matching colour): ${items.map((i, k) => `#${k + 1} ${describe(i.alt)}${i.match ? ` — matches ${i.match}` : ""}`).join("; ")}.`);
  }
  return lines.join("\n");
}

/* ─────────────────────────────── outfits: garments by colour role, per category and gender */
type Roles = { c: Swatch[]; n: Swatch[]; m: Swatch };
const OUTFITS: Partial<Record<CategoryId, Record<Gender, (r: Roles) => string>>> = {
  office: {
    female: ({ c, n, m }) => `a tailored blazer in ${low(n[3])} over a ${low(c[0])} silk shell, ${low(n[0])} wide-leg trousers, ${low(n[1])} loafers and small ${low(m)} hoops`,
    male: ({ c, n, m }) => `a ${low(n[3])} suit with a ${low(n[0])} shirt, a ${low(c[0])} tie or pocket square, ${low(n[3])} oxfords and a ${low(m)} watch`,
  },
  party: {
    female: ({ c, m }) => `a satin slip or wrap dress in ${low(c[0])}, strappy ${low(m)} sandals and statement ${low(m)} drops; swap to ${low(c[5])} if you want more drama`,
    male: ({ c, n, m }) => `a ${low(c[5])} camp-collar shirt or velvet blazer over ${low(n[3])} trousers, suede loafers and a ${low(m)} chain or watch`,
  },
  festive: {
    female: ({ c, m }) => `a silk saree or lehenga in ${low(c[0])} with a ${low(m)} zari border, a ${low(c[1])} dupatta, jhumkas and bangles in ${low(m)}`,
    male: ({ c, n, m }) => `a ${low(c[0])} sherwani or bandhgala with ${low(m)} embroidery over a ${low(n[0])} churidar, mojaris and a ${low(m)} brooch — or a ${low(n[0])} kurta with a ${low(c[3])} Nehru jacket for daytime`,
  },
  "date-night": {
    female: ({ c, n, m }) => `a silk camisole in ${low(c[1])} with dark straight jeans and a ${low(n[1])} blazer, kitten heels and fine ${low(m)} chains`,
    male: ({ c, n, m }) => `a fine-knit polo in ${low(c[1])} under a ${low(n[1])} overshirt, tapered ${low(n[3])} trousers and a ${low(m)} watch`,
  },
  casual: {
    female: ({ c, n }) => `a relaxed knit in ${low(c[2])} with wide-leg jeans, ${low(n[0])} sneakers and a ${low(n[1])} tote`,
    male: ({ c, n }) => `a heavy cotton tee in ${low(n[0])} under a ${low(c[2])} overshirt, straight jeans and clean white sneakers`,
  },
  vacation: {
    female: ({ c, n, m }) => `a ${low(n[0])} linen set or a flowing ${low(c[3])} maxi, flat sandals, a straw tote and ${low(m)} charm jewellery`,
    male: ({ c, n }) => `a ${low(c[3])} linen shirt with ${low(n[0])} tailored shorts, suede espadrilles and sunglasses`,
  },
  "black-tie": {
    female: ({ c, m }) => `a floor-length column gown in ${low(c[7])} or ${low(c[0])}, chandelier earrings in ${low(m)} and a sleek chignon`,
    male: ({ n, c, m }) => `a peak-lapel tuxedo in ${low(n[3])} — or a ${low(c[0])} velvet dinner jacket — with a ${low(n[0])} dress shirt and ${low(m)} cufflinks`,
  },
  clothing: {
    female: ({ c, n }) => `build the base in ${low(n[0])}, ${low(n[1])} and ${low(n[3])}; wear ${low(c[0])}, ${low(c[1])} and ${low(c[2])} on top, near your face`,
    male: ({ c, n }) => `suits and outerwear in ${low(n[3])} and ${low(n[1])}; shirts and knits in ${low(c[0])}, ${low(c[2])} and ${low(n[0])}`,
  },
};

const FOLLOWUPS: Record<CategoryId, Record<Gender, string[]>> = {
  office: { female: ["Make it more relaxed for Fridays", "Which shoes and bag?", "Interview-safe colours?"], male: ["A smart-casual Friday option?", "Which tie colours?", "Interview-safe colours?"] },
  party: { female: ["Something more daring?", "Which lipstick with this?", "What jewellery should I add?"], male: ["Something more daring?", "Blazer or just a shirt?", "Which watch or chain?"] },
  festive: { female: ["Saree or lehenga for me?", "Jewellery for a sangeet?", "Daytime haldi outfit?"], male: ["Sherwani or bandhgala?", "Which kurta colour for haldi?", "Accessories for the groom's side?"] },
  "date-night": { female: ["A more casual date option?", "Which lip colour?", "What should I avoid?"], male: ["A more casual date option?", "Which fragrance vibe?", "What should I avoid?"] },
  casual: { female: ["A smarter weekend option?", "Best denim wash for me?", "Comfy shoes that still look good?"], male: ["A smarter weekend option?", "Best denim wash for me?", "Which sneakers?"] },
  vacation: { female: ["A 5-day packing list?", "Swimwear colours?", "Beach dinner outfit?"], male: ["A 5-day packing list?", "Swim shorts colours?", "Beach dinner outfit?"] },
  "black-tie": { female: ["Gown or jumpsuit?", "Jewellery for a gala?", "Hair for a formal event?"], male: ["Classic or coloured tux?", "Cufflinks and watch?", "Grooming before the event?"] },
  clothing: { female: ["Build me a 10-piece capsule", "Which neutrals replace black?", "Best colours for a dress?"], male: ["Build me a 10-piece capsule", "Which neutrals replace black?", "Best colours for a suit?"] },
  footwear: { female: ["Heels or flats for a wedding?", "Which boots suit my palette?", "Shoes to wear with a saree?"], male: ["Oxfords or loafers for work?", "Which sneakers suit my palette?", "Shoes to wear with a sherwani?"] },
  makeup: { female: ["An everyday 5-minute look?", "Best red lipstick for me?", "Which foundation undertone?"], male: ["A simple grooming routine?", "Concealer for my undertone?", "Beard care tips?"] },
  hairstyles: { female: ["Go lighter or darker?", "A low-maintenance colour?", "A cut for my face shape?"], male: ["Which haircut suits me?", "Should I colour my grey?", "Beard style for my face?"] },
  jewellery: { female: ["Can I mix metals?", "Which gemstones suit me?", "Everyday vs statement pieces?"], male: ["Which watch strap and case?", "Can men mix metals?", "Rings or bracelet?"] },
};
export const followupsFor = (section: CategoryId | null, gender: Gender | "all" = "female") => FOLLOWUPS[section ?? "clothing"][gender === "male" ? "male" : "female"];

const QUESTION: Partial<Record<CategoryId, string>> = {
  office: "Is your workplace more corporate or creative?",
  party: "What kind of party is it — cocktail, house party or club?",
  festive: "Which function is it — sangeet, mehendi, haldi or the reception?",
  "date-night": "Where are you going — a casual café or a fancy dinner?",
  vacation: "Where are you headed, and for how many days?",
  casual: "Is it a relaxed day out or somewhere a little smarter?",
  "black-tie": "Is it a strict black-tie dress code or a creative one?",
};

/** Greetings, thanks and off-topic questions — answered without pretending they were fashion questions. */
const GREETING = /^\s*(hi+|hello+|hey+|hiya|yo|namaste|good (morning|afternoon|evening)|thanks?|thank you|ok(ay)?|cool|great)\b[\s!.?]*$/i;
// const FASHION = /\b(wear|outfit|dress|styl|colou?r|shade|look|cloth|fashion|wardrobe|shirt|suit|jacket|saree|sari|lehenga|kurta|sherwani|makeup|make-up|lip|blush|hair|jewel|ring|necklace|earring|metal|gold|silver|shoe|bag|accessor|match|occasion|palette|season|undertone|party|wedding|sangeet|office|interview|date|brunch|vacation|beach|gala|ties?\b|formal|casual)/i;
// The list above missed everyday garments and colour names, so "Does a mustard yellow sweater work for
// me?" was answered as off-topic. Anything naming a garment, a colour or asking what suits / flatters goes
// through to the stylist (which still redirects genuinely off-topic questions itself).
const FASHION = /\b(wear|outfit|dress|styl|colou?r|shade|tones?\b|look|cloth|fashion|wardrobe|capsule|pack(ing)?\b|shirt|suit|flatter|work for me|go with|pair|jacket|blazer|coat|sweater|jumper|cardigan|knit|hoodie|tops?\b|tees?\b|t-shirt|blouse|jeans|denim|trouser|pant|chino|short|skirt|jumpsuit|gown|scarf|stole|dupatta|kurti|kurta|saree|sari|lehenga|sherwani|bandhgala|nehru|tux|swim|bikini|lingerie|sock|boot|heel|sneaker|loafer|sandal|shoe|bag|clutch|belt|watch|glasses|sunglass|hats?\b|caps?\b|makeup|make-up|lip|blush|foundation|concealer|eyeshadow|eyeliner|kajal|mascara|nail|groom|beard|skin|hair|jewel|ring|necklace|earring|bangle|bracelet|pendant|chain|metal|gold|silver|platinum|pearl|gem|stone|accessor|match|occasion|palette|season|undertone|spring|summer|autumn|winter|party|wedding|sangeet|mehendi|haldi|reception|festive|diwali|eid|office|work|interview|meeting|date|dinner|brunch|vacation|holiday|travel|trip|beach|gala|tie|formal|casual|red\b|orange|yellow|mustard|green|olive|teal|blue|navy|purple|lilac|pink|rose|coral|peach|maroon|burgundy|wine|brown|camel|beige|cream|ivory|white|black|grey|gray|charcoal|khaki|rust|terracotta|emerald|neutral|pastel|neon|bright|muted)/i;

export type SmallTalk = { kind: "greeting" | "offtopic"; text: string; followups: string[] };
export function smallTalk(q: string, p: ColourProfile | null): SmallTalk | null {
  if (GREETING.test(q)) {
    return {
      kind: "greeting",
      text: p ? `Hello! I'm your stylist — I already know you're **${p.label}** (${p.mood.toLowerCase()}). What are we dressing for?` : "Hello! I'm your stylist. Tell me what you're dressing for and I'll take it from there.",
      followups: ["What should I wear to a party?", "Office wear ideas", "Which jewellery suits me?"],
    };
  }
  if (!FASHION.test(q)) {
    return {
      kind: "offtopic",
      text: "That's outside what I can help with — I'm a stylist, so I stick to clothing, colour, makeup, hair and jewellery. Want me to plan an outfit instead?",
      followups: ["What should I wear today?", "Which colours suit me?", "Plan a weekend wardrobe"],
    };
  }
  return null;
}

/** Offline answer composed from the rules database. */
export function localAnswer(p: ColourProfile, section: CategoryId | null, gender: Gender | "all") {
  const id = section ?? "clothing";
  const cat = CATEGORIES[id];
  const g: Gender = gender === "male" ? "male" : "female";
  const roles: Roles = { c: p.colours, n: p.neutrals, m: p.metals[0] };
  const parts: string[] = [`As **${p.label}** — ${p.mood.toLowerCase()} — here's your ${cat.title.toLowerCase()} edit${g === "male" ? " for him" : ""}:`, `**The rule** — ${p.why[id]}`];
  const outfit = OUTFITS[id]?.[g];
  if (id === "makeup") {
    parts.push(
      g === "male" ? `**Grooming** — match concealer to a ${p.undertone.toLowerCase()} undertone; a tinted balm close to ${sw(p.lips[1])}; brows brushed up.` : `**Lips** — ${p.lips.map(sw).join(", ")}.`,
      `**Cheeks** — ${p.blush.map(sw).join(" or ")}. **Eyes** — ${p.eyes.map(sw).join(", ")}.`,
    );
  } else if (id === "hairstyles") {
    parts.push(`**Colour** — ${p.hair.map(sw).join(", ")}.`, `**Skip** — anything close to ${p.avoid.slice(0, 2).map(low).join(" or ")} near your face.`);
  } else if (id === "jewellery") {
    parts.push(`**Metals** — ${p.metals.map(sw).join(", ")}.`, `**Stones** — ${p.gems.join(", ")}.`, g === "male" ? `**Pieces** — a ${low(p.metals[0])} watch case, a signet ring, a fine chain.` : `**Pieces** — ${low(p.metals[0])} hoops or drops, a fine layered necklace, stacking rings.`);
  } else if (outfit) {
    parts.push(`**Outfit** — ${outfit(roles)}.`, `**Keep away from your face** — ${p.avoid.slice(0, 3).map(low).join(", ")}.`);
  }
  parts.push(`The photos on screen are ranked by how closely their colours match your palette.`);
  parts.push(QUESTION[id] ?? "Want me to tailor this to a specific occasion?");
  return { text: parts.join("\n\n"), followups: followupsFor(id, g) };
}

/** Pulls the hidden <<FOLLOWUPS>>[…] trailer off an LLM answer. */
export function splitFollowups(text: string): { body: string; followups: string[] | null } {
  const i = text.indexOf("<<FOLLOWUPS>>");
  if (i < 0) return { body: text.replace(/<<F[A-Z]*$/, ""), followups: null };
  const body = text.slice(0, i).trimEnd();
  try {
    const arr = JSON.parse(text.slice(i + 13).trim().replace(/^```(json)?|```$/g, ""));
    return { body, followups: Array.isArray(arr) ? arr.slice(0, 3).map(String) : null };
  } catch {
    return { body, followups: null };
  }
}
