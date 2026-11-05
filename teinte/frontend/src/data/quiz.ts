// The no-photo route: a short questionnaire scored on the three axes of the 12-season system
// (temperature, value, chroma). Used by the stylist chat and the analyse page.
import { SEASONS, type Season, type Undertone } from "./seasons";
import type { Gender } from "./profiles";

type Score = { t?: number; v?: number; c?: number };
export type QuizOption = { label: string; hint?: string; swatch?: string; score: Score; gender?: Gender | "all" };
export type QuizQuestion = { id: string; prompt: string; why?: string; options: QuizOption[] };

export const QUIZ: QuizQuestion[] = [
  {
    id: "gender",
    prompt: "First — whose looks should I show you?",
    options: [
      { label: "Women's looks", score: {}, gender: "female" },
      { label: "Men's looks", score: {}, gender: "male" },
      { label: "Show me both", score: {}, gender: "all" },
    ],
  },
  {
    id: "veins",
    prompt: "In daylight, what colour are the veins on your inner wrist?",
    why: "Vein colour is a quick read on undertone.",
    options: [
      { label: "Green or olive", swatch: "#6B8E4E", score: { t: 1 } },
      { label: "Blue or purple", swatch: "#4A5FA8", score: { t: -1 } },
      { label: "A mix / hard to tell", swatch: "#5E7A86", score: { t: 0 } },
    ],
  },
  {
    id: "metal",
    prompt: "Which metal makes your skin look healthiest?",
    options: [
      { label: "Gold", swatch: "#D4AF37", score: { t: 1 } },
      { label: "Silver", swatch: "#C0C4CA", score: { t: -1 } },
      { label: "Both work", swatch: "#E1A98C", score: { t: 0 } },
    ],
  },
  {
    id: "sun",
    prompt: "How does your skin react to the sun?",
    options: [
      { label: "Burns easily, rarely tans", score: { t: -0.4, v: 0.8 } },
      { label: "Burns a little, then tans", score: { t: 0, v: 0.2 } },
      { label: "Tans easily to golden", score: { t: 0.7, v: -0.3 } },
      { label: "Deepens easily, rarely burns", score: { t: 0.2, v: -0.9 } },
    ],
  },
  {
    id: "hair",
    prompt: "What's your natural hair colour (before any dye)?",
    options: [
      { label: "Golden or strawberry blonde", swatch: "#D7B06C", score: { t: 0.8, v: 1 } },
      { label: "Ash blonde / light ash brown", swatch: "#B7A58C", score: { t: -0.7, v: 0.7, c: -0.4 } },
      { label: "Red, copper or auburn", swatch: "#A8492A", score: { t: 1, v: 0 } },
      { label: "Medium soft brown", swatch: "#7F6E60", score: { v: 0, c: -0.7 } },
      { label: "Dark chocolate brown", swatch: "#4A2C20", score: { t: 0.3, v: -0.8 } },
      { label: "Black / blue-black", swatch: "#141822", score: { t: -0.3, v: -1, c: 0.4 } },
    ],
  },
  {
    id: "eyes",
    prompt: "And your eyes?",
    options: [
      { label: "Bright blue, green or turquoise", swatch: "#2E8FB3", score: { c: 1 } },
      { label: "Soft grey, grey-blue or grey-green", swatch: "#8A9A9A", score: { t: -0.3, c: -0.8 } },
      { label: "Hazel or green-gold", swatch: "#8E7B3A", score: { t: 0.7, c: -0.3 } },
      { label: "Warm or golden brown", swatch: "#8B5A2B", score: { t: 0.6, v: -0.3 } },
      { label: "Very dark brown / black", swatch: "#2B1E1A", score: { v: -0.8, c: 0.5 } },
    ],
  },
  {
    id: "white",
    prompt: "Next to your face, which looks better?",
    options: [
      { label: "Crisp optic white", swatch: "#FFFFFF", score: { t: -0.5, c: 0.6 } },
      { label: "Soft ivory or cream", swatch: "#F3E6CC", score: { t: 0.5, c: -0.3 } },
      { label: "Not sure", score: {} },
    ],
  },
  {
    id: "contrast",
    prompt: "How would you describe the contrast between your hair, skin and eyes?",
    options: [
      { label: "Soft & blended", hint: "everything is close in depth", score: { c: -0.8 } },
      { label: "Medium", score: { c: 0 } },
      { label: "Striking", hint: "e.g. dark hair, light skin, bright eyes", score: { c: 0.9, v: -0.2 } },
    ],
  },
];

// position of each season on (temperature, value, chroma); + = warm / light / bright
// exported so the Studio's seven-question panel (data/quiz7.ts) places answers on the same map
export const AXES: Record<string, [number, number, number]> = {
  "Light Spring": [0.5, 1, 0.3], "Warm Spring": [1, 0.3, 0.4], "Bright Spring": [0.4, 0.2, 1],
  "Light Summer": [-0.5, 1, -0.3], "Cool Summer": [-1, 0.3, -0.3], "Soft Summer": [-0.4, 0, -1],
  "Soft Autumn": [0.4, 0, -1], "Warm Autumn": [1, -0.3, -0.3], "Deep Autumn": [0.4, -1, 0],
  "Deep Winter": [-0.4, -1, 0.2], "Cool Winter": [-1, -0.4, 0.5], "Bright Winter": [-0.4, -0.2, 1],
};

export type QuizResult = { season: Season; undertone: Undertone; gender: Gender | "all"; confidence: number; ranking: { season: string; p: number }[] };

/** Shared by both questionnaires: averaged axes → nearest season, undertone and a ranking.
 *  Stretch and weight are unchanged from the original scorer, so an identical set of answers
 *  still lands on the identical season. */
export function placeOnAxes(T: number, V: number, C: number) {
  const d = SEASONS.map((s) => {
    const [a, b, cc] = AXES[s.name];
    return { s, d: Math.sqrt(1.4 * (a - T * 1.6) ** 2 + (b - V * 1.4) ** 2 + (cc - C * 1.4) ** 2) };
  }).sort((x, y) => x.d - y.d);
  const w = d.map((x) => Math.exp(-x.d * 2.2));
  const sum = w.reduce((a, b) => a + b, 0);
  const undertone: Undertone = T > 0.25 ? "Warm" : T < -0.25 ? "Cool" : "Neutral";
  return {
    season: d[0].s,
    undertone,
    confidence: w[0] / sum,
    ranking: d.slice(0, 4).map((x, i) => ({ season: x.s.name, p: w[i] / sum })),
  };
}

export function scoreQuiz(answers: Record<string, number>): QuizResult {
  let t = 0, v = 0, c = 0, nt = 0, nv = 0, nc = 0;
  let gender: Gender | "all" = "all";
  for (const q of QUIZ) {
    const i = answers[q.id];
    if (i === undefined) continue;
    const o = q.options[i];
    if (o.gender) gender = o.gender;
    if (o.score.t !== undefined) (t += o.score.t), nt++;
    if (o.score.v !== undefined) (v += o.score.v), nv++;
    if (o.score.c !== undefined) (c += o.score.c), nc++;
  }
  const T = nt ? t / nt : 0, V = nv ? v / nv : 0, C = nc ? c / nc : 0;
  // weight the defining axes: temperature is decided by more questions, so it counts most
  const d = SEASONS.map((s) => {
    const [a, b, cc] = AXES[s.name];
    return { s, d: Math.sqrt(1.4 * (a - T * 1.6) ** 2 + (b - V * 1.4) ** 2 + (cc - C * 1.4) ** 2) };
  }).sort((x, y) => x.d - y.d);
  const w = d.map((x) => Math.exp(-x.d * 2.2));
  const sum = w.reduce((a, b) => a + b, 0);
  const undertone: Undertone = T > 0.25 ? "Warm" : T < -0.25 ? "Cool" : "Neutral";
  return {
    season: d[0].s,
    undertone,
    gender,
    confidence: w[0] / sum,
    ranking: d.slice(0, 4).map((x, i) => ({ season: x.s.name, p: w[i] / sum })),
  };
}
