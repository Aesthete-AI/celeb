// Maps a free-text question to a recommendation category (and a gender if the question implies one), so the
// stylist chat and the page on screen move together.
import { CATEGORIES, CATEGORY_IDS, CATEGORY_KEYWORDS, type CategoryId, type Gender } from "../data/profiles";

export type Intent = { section: CategoryId | null; gender: Gender | null; score: number };

const MALE = /\b(men|man|male|guy|guys|groom|husband|boyfriend|him|his|he|gentleman|sherwani|tuxedo|tux|beard|bandhgala|brother|dad|father|son)\b/i;
const FEMALE = /\b(women|woman|female|girl|girls|bride|wife|girlfriend|her|she|lady|ladies|saree|sari|lehenga|gown|dress|skirt|lipstick|anarkali|bridesmaid|sister|mom|mother|daughter)\b/i;

export function detectIntent(text: string): Intent {
  const q = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ")} `;
  let best: Intent = { section: null, gender: null, score: 0 };
  for (const id of CATEGORY_IDS) {
    let score = 0;
    for (const k of CATEGORY_KEYWORDS[id]) {
      if (q.includes(` ${k} `) || q.includes(` ${k}s `) || (k.length > 5 && q.includes(k))) score += k.includes(" ") ? 2 : 1;
    }
    // occasions outrank style guides when both match ("what jewellery for a wedding" → festive)
    if (score && CATEGORIES[id].kind === "occasion") score += 0.5;
    if (score > best.score) best = { section: id, gender: null, score };
  }
  const m = MALE.test(q), f = FEMALE.test(q);
  best.gender = m && !f ? "male" : f && !m ? "female" : null;
  return best;
}

type Starter = { q: string; section: CategoryId };
type Slot = { female: string; male: string; all: string; section: CategoryId };

// Each slot asks the same thing for every viewer, worded for their gender ("lipstick" never goes to men;
// the men's version asks about grooming). Questions that apply to everyone use one wording.
const SLOTS: Slot[] = [
  { section: "party", female: "What should I wear to a party tonight?", male: "What should I wear to a party tonight?", all: "What should I wear to a party tonight?" },
  { section: "office", female: "What should my office wear look like?", male: "What should my office wear look like?", all: "What should my office wear look like?" },
  { section: "festive", female: "Saree or lehenga for a wedding sangeet?", male: "Sherwani or kurta for a wedding sangeet?", all: "What should I wear to a wedding sangeet?" },
  { section: "makeup", female: "Which lipstick shades suit me?", male: "Which grooming routine suits me?", all: "Which makeup or grooming suits my colouring?" },
  { section: "jewellery", female: "Gold or silver — which jewellery suits me?", male: "Gold or silver — which watch and rings suit me?", all: "Gold or silver — which jewellery suits me?" },
  { section: "hairstyles", female: "Which hairstyle and hair colour suit me?", male: "Which haircut and beard style suit me?", all: "Which hairstyle and hair colour suit me?" },
  { section: "vacation", female: "Plan a beach vacation wardrobe for me", male: "Plan a beach vacation wardrobe for me", all: "Plan a beach vacation wardrobe for me" },
  { section: "date-night", female: "What should I wear on a dinner date?", male: "What should I wear on a dinner date?", all: "What should I wear on a dinner date?" },
];

export function startersFor(gender: Gender | "all"): Starter[] {
  return SLOTS.map((s) => ({ q: s[gender], section: s.section }));
}
