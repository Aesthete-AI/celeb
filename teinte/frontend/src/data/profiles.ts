// Typed view of profiles.json — exported by backend/catalog/build.py from catalog/rules.py, the single source
// of truth for the 12 colour profiles (4 seasons × 3 undertones) and the 11 recommendation categories.
import raw from "./profiles.json";
import type { Swatch } from "./seasons";

export type CategoryId =
  | "jewellery" | "hairstyles" | "makeup" | "clothing" | "footwear"
  | "office" | "party" | "festive" | "date-night" | "casual" | "vacation" | "black-tie";
export type Gender = "female" | "male";

export type ColourProfile = {
  key: string;
  family: "Spring" | "Summer" | "Autumn" | "Winter";
  undertone: "Warm" | "Neutral" | "Cool";
  label: string;
  mood: string;
  rule: string;
  colours: Swatch[];
  neutrals: Swatch[];
  avoid: Swatch[];
  metals: Swatch[];
  gems: string[];
  lips: Swatch[];
  blush: Swatch[];
  eyes: Swatch[];
  hair: Swatch[];
  why: Record<CategoryId, string>;
};
export type CategoryMeta = { title: string; kicker: string; kind: "category" | "occasion" };

const data = raw as unknown as {
  profiles: Record<string, ColourProfile>;
  categories: Record<CategoryId, CategoryMeta>;
  seasonFamily: Record<string, string>;
  undertoneRule: Record<string, string>;
  familyRule: Record<string, string>;
};

export const PROFILES = data.profiles;
export const CATEGORIES = data.categories;
export const CATEGORY_IDS = Object.keys(CATEGORIES) as CategoryId[];
export const STYLE_GUIDES = CATEGORY_IDS.filter((c) => CATEGORIES[c].kind === "category");
export const OCCASIONS = CATEGORY_IDS.filter((c) => CATEGORIES[c].kind === "occasion");
export const UNDERTONE_RULE = data.undertoneRule;
export const FAMILY_RULE = data.familyRule;
export const PROFILE_KEYS = Object.keys(PROFILES);
export const DEFAULT_PROFILE = "autumn-warm";

/** 12-season result + undertone → catalogue profile key. */
export const profileKeyOf = (season: string, undertone: string) =>
  `${(data.seasonFamily[season] ?? season.split(" ").pop() ?? "Autumn").toLowerCase()}-${undertone.toLowerCase()}`;

/** A gradient that represents a profile (signature colours, deepened slightly for the dark theme). */
export const profileGradient = (p: ColourProfile, angle = 135) =>
  `linear-gradient(${angle}deg, ${p.colours[0].hex}, ${p.colours[3].hex} 50%, ${p.colours[5].hex})`;

/** Words that point a free-text question at a category (used by the stylist to move the page). */
export const CATEGORY_KEYWORDS: Record<CategoryId, string[]> = {
  office: ["office", "work", "workwear", "interview", "meeting", "corporate", "professional", "business", "presentation", "boardroom", "job", "conference", "client"],
  party: ["party", "office party", "work party", "christmas party", "cocktail", "birthday", "club", "night out", "occasion", "occasional", "celebration", "new year", "event", "evening", "drinks", "nightout"],
  festive: ["wedding", "sangeet", "mehendi", "mehndi", "haldi", "diwali", "eid", "festive", "festival", "ethnic", "saree", "sari", "lehenga", "sherwani", "kurta", "reception", "engagement", "puja", "pooja", "navratri", "garba", "traditional", "shaadi", "bride", "groom", "bridesmaid", "holi", "onam"],
  "date-night": ["date", "dinner", "anniversary", "romantic", "valentine", "first date", "candlelight"],
  casual: ["casual", "weekend", "everyday", "brunch", "college", "university", "errands", "coffee", "day out", "shopping", "relaxed", "campus", "movie"],
  vacation: ["vacation", "holiday", "beach", "resort", "travel", "trip", "airport", "goa", "maldives", "cruise", "pool", "honeymoon"],
  "black-tie": ["black tie", "gala", "formal", "ball", "red carpet", "award", "awards", "opera", "tuxedo", "prom", "banquet", "gown"],
  clothing: ["colours", "colors", "palette", "wardrobe", "clothes", "clothing", "capsule", "what colour", "what color", "best colours", "which colour", "which color", "shirt", "dress colour", "suit colour"],
  makeup: ["makeup", "make-up", "make up", "lipstick", "lip", "lips", "blush", "foundation", "eyeshadow", "eyeliner", "liner", "mascara", "concealer", "highlighter", "bronzer", "nail", "nails", "grooming", "skincare", "kajal"],
  hairstyles: ["hair", "hairstyle", "hairstyles", "haircut", "hair colour", "hair color", "dye", "highlights", "balayage", "fringe", "bangs", "bun", "updo", "curls", "beard", "fade"],
  footwear: ["shoe", "shoes", "footwear", "heels", "heel", "high heels", "stilettos", "pumps", "boots", "boot", "ankle boots", "chelsea boots", "sneakers", "sneaker", "trainers", "loafers", "loafer", "sandals", "sandal", "flats", "ballet flats", "mules", "oxfords", "oxford", "brogues", "derby", "espadrilles", "juttis", "jutti", "mojari", "mojaris", "kolhapuri"],
  jewellery: ["jewellery", "jewelry", "earrings", "necklace", "ring", "rings", "bracelet", "bangles", "watch", "gold", "silver", "metal", "metals", "gemstone", "gemstones", "pearls", "pearl", "accessories", "jhumka", "chain", "rose gold", "platinum"],
};
