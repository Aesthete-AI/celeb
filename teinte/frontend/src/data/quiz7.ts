// The seven questions the Studio's analysis panel asks when someone has no photo to hand.
//
// The wording and the options come from the printed "Personal Colour Analysis" card, so what a
// person sees here is exactly what they would be asked by a human analyst working from that sheet.
// Every option carries a score on one or more of the three axes of the 12-season system:
//
//   t — temperature  (+ warm / golden, − cool / blue)
//   v — value        (+ light, − deep)
//   c — chroma       (+ bright & clear, − soft & muted)
//
// An option with an empty score ("Not sure") says nothing and is simply left out of the averages,
// so skipping a question never drags a person toward neutral.
//
// The older eight-step questionnaire still lives in ./quiz.ts and still runs the stylist panel in
// the Previous interface — both place their answers with the same `placeOnAxes` scorer.
import { placeOnAxes } from "./quiz";
import type { Season, Undertone } from "./seasons";

export type Q7Score = { t?: number; v?: number; c?: number };
export type Q7Option = { label: string; sub?: string; swatch?: string; swatches?: string[]; score: Q7Score };
/** how the option tiles are drawn — a wrist with veins, a metal plate, a skin chip, a hair lock… */
export type Q7Art = "vein" | "metal" | "skin" | "hair" | "eye" | "white" | "mosaic";
export type Q7Question = { id: string; prompt: string; why: string; art: Q7Art; options: Q7Option[] };

export const QUIZ7: Q7Question[] = [
  {
    id: "veins",
    art: "vein",
    prompt: "In natural daylight, what colour do the veins on your inner wrist appear?",
    why: "Vein colour is the quickest honest read on undertone — it shows through skin without makeup.",
    options: [
      { label: "Green / Olive", swatch: "#6B8E4E", score: { t: 1 } },
      { label: "Blue / Purple", swatch: "#4A5FA8", score: { t: -1 } },
      { label: "Blue-Green / Teal", swatch: "#2F7F7A", score: { t: -0.2 } },
      { label: "A Mixture / Hard to Tell", swatch: "#5E7A86", score: { t: 0 } },
      { label: "Not Sure", swatch: "#4A4A52", score: {} },
    ],
  },
  {
    id: "metal",
    art: "metal",
    prompt: "Which metal makes your complexion look most radiant?",
    why: "Warm skin lifts next to gold; cool skin lifts next to silver. It is the oldest test there is.",
    options: [
      { label: "Gold", swatch: "#D4AF37", score: { t: 1 } },
      { label: "Silver / Platinum", swatch: "#C0C4CA", score: { t: -1 } },
      { label: "Rose Gold", swatch: "#C98C7A", score: { t: 0.4 } },
      { label: "Both Gold and Silver", swatch: "#B9A77E", score: { t: 0 } },
      { label: "Most Metals Suit Me", swatch: "#9C9A93", score: { t: 0, c: -0.3 } },
    ],
  },
  {
    id: "depth",
    art: "skin",
    prompt: "How would you describe your natural skin depth?",
    why: "Depth sets the value axis — whether your palette should stay light and airy or go rich and deep.",
    options: [
      { label: "Very Fair / Porcelain", swatch: "#F6E0D2", score: { v: 1 } },
      { label: "Fair / Light", swatch: "#EFCDB6", score: { v: 0.75 } },
      { label: "Light-Medium", swatch: "#E3B695", score: { v: 0.35 } },
      { label: "Medium", swatch: "#CD9B74", score: { v: 0 } },
      { label: "Medium-Deep", swatch: "#AE7A52", score: { v: -0.35 } },
      { label: "Deep", swatch: "#8A5635", score: { v: -0.75 } },
      { label: "Very Deep", swatch: "#5E3722", score: { v: -1 } },
    ],
  },
  {
    id: "hair",
    art: "hair",
    prompt: "What's your natural hair colour (before dyeing)?",
    why: "Hair is the largest block of colour beside your face, so it moves both value and chroma.",
    options: [
      { label: "Blonde", swatch: "#D9BE7F", score: { t: 0.3, v: 1 } },
      { label: "Light / Medium Brown", swatch: "#8B6341", score: { v: 0.4, c: -0.4 } },
      { label: "Dark Brown", swatch: "#4A2C20", score: { t: 0.2, v: -0.6 } },
      { label: "Red / Auburn", swatch: "#A8492A", score: { t: 1, v: 0 } },
      { label: "Black", swatch: "#141822", score: { t: -0.3, v: -1, c: 0.4 } },
      { label: "Grey / White / Mixed", swatch: "#C6C2BC", score: { t: -0.5, v: 0.3, c: -0.3 } },
    ],
  },
  {
    id: "eyes",
    art: "eye",
    prompt: "What is your natural eye colour?",
    why: "Clear, patterned irises read bright; soft, hazy ones read muted.",
    options: [
      { label: "Blue", swatch: "#4E8FC0", score: { t: -0.4, c: 0.6 } },
      { label: "Green", swatch: "#5C8A4E", score: { t: 0.3, c: 0.5 } },
      { label: "Grey", swatch: "#8A9A9A", score: { t: -0.4, c: -0.8 } },
      { label: "Hazel", swatch: "#8E7B3A", score: { t: 0.7, c: -0.3 } },
      { label: "Light Brown", swatch: "#A5753F", score: { t: 0.5, v: 0.1 } },
      { label: "Dark Brown", swatch: "#3A2419", score: { v: -0.8, c: 0.3 } },
      { label: "Amber", swatch: "#C08A2E", score: { t: 0.9, c: 0.2 } },
    ],
  },
  {
    id: "white",
    art: "white",
    prompt: "Next to your face, which shade of white makes your complexion look most balanced?",
    why: "Optic white flatters cool, clear colouring; ivory flatters warm, softer colouring.",
    options: [
      { label: "Crisp Pure White", swatch: "#FFFFFF", score: { t: -0.5, c: 0.6 } },
      { label: "Soft White", swatch: "#F7F2E9", score: { t: -0.1, c: 0 } },
      { label: "Ivory / Cream", swatch: "#F2E3C4", score: { t: 0.6, c: -0.3 } },
      { label: "Both Look Equally Good", swatch: "#E2DDD4", score: { t: 0 } },
      { label: "Neither / Not Sure", swatch: "#D6D2CB", score: {} },
    ],
  },
  {
    id: "clarity",
    art: "mosaic",
    prompt: "Which type of colours do you feel makes your complexion look most vibrant and harmonious?",
    why: "This is the chroma axis directly — clear and saturated, balanced, or soft and dusty.",
    options: [
      {
        label: "Bright, Clear and Saturated Colours",
        swatches: ["#E8192C", "#F57C00", "#FFD400", "#00A651", "#0073CF", "#8E2DE2"],
        score: { c: 1 },
      },
      {
        label: "Moderately Clear Colours",
        swatches: ["#E8827C", "#F3B27A", "#F2DC9B", "#87C9A3", "#7FB0D8", "#B59BD6"],
        score: { c: 0 },
      },
      {
        label: "Soft, Muted and Dusty Colours",
        swatches: ["#9A7D7A", "#B09274", "#C2B591", "#7E9A8B", "#7D8C9E", "#8E8397"],
        score: { c: -1 },
      },
    ],
  },
];

export type Q7Result = {
  season: Season;
  undertone: Undertone;
  confidence: number;
  ranking: { season: string; p: number }[];
  axes: { t: number; v: number; c: number };
};

/** answers: question id → chosen option index. Partial answers score fine. */
export function scoreQuiz7(answers: Record<string, number>): Q7Result {
  let t = 0, v = 0, c = 0, nt = 0, nv = 0, nc = 0;
  for (const q of QUIZ7) {
    const i = answers[q.id];
    if (i === undefined) continue;
    const o = q.options[i];
    if (!o) continue;
    if (o.score.t !== undefined) (t += o.score.t), nt++;
    if (o.score.v !== undefined) (v += o.score.v), nv++;
    if (o.score.c !== undefined) (c += o.score.c), nc++;
  }
  const T = nt ? t / nt : 0, V = nv ? v / nv : 0, C = nc ? c / nc : 0;
  return { ...placeOnAxes(T, V, C), axes: { t: T, v: V, c: C } };
}
