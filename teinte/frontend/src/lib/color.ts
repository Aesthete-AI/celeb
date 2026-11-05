import type { Season, Swatch } from "../data/seasons";

export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgbToHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

/** Relative luminance → whether text on top should be dark. */
export const isLight = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42;
};

export const shade = (hex: string, amt: number) => {
  const [r, g, b] = hexToRgb(hex);
  const f = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  return rgbToHex(r + (f - r) * p, g + (f - g) * p, b + (f - b) * p);
};

export function rgbToLab([r, g, b]: [number, number, number]): [number, number, number] {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

/** CIEDE2000 colour difference. */
export function deltaE(a: [number, number, number], b: [number, number, number]) {
  const [L1, a1, b1] = a, [L2, a2, b2] = b;
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h = (x: number, y: number) => (x === 0 && y === 0 ? 0 : (Math.atan2(y, x) / rad + 360) % 360);
  const h1p = h(a1p, b1), h2p = h(a2p, b2);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = h2p - h1p;
  if (C1p * C2p === 0) dhp = 0;
  else if (dhp > 180) dhp -= 360;
  else if (dhp < -180) dhp += 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) hbp = Math.abs(h1p - h2p) > 180 ? (h1p + h2p + (h1p + h2p < 360 ? 360 : -360)) / 2 : (h1p + h2p) / 2;
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
  const SL = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const SC = 1 + 0.045 * Cbp, SH = 1 + 0.015 * Cbp * T;
  const RT = -2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hbp - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
}

export const dE = (h1: string, h2: string) => deltaE(rgbToLab(hexToRgb(h1)), rgbToLab(hexToRgb(h2)));

export function nearest(hex: string, swatches: Swatch[]) {
  let best = swatches[0], d = Infinity;
  for (const s of swatches) {
    const x = dE(hex, s.hex);
    if (x < d) (d = x), (best = s);
  }
  return { swatch: best, distance: d };
}

/** How well a garment colour sits in a season: 100 = in the palette, 0 = in the avoid list. */
export function paletteScore(hex: string, season: Season) {
  const good = nearest(hex, [...season.palette, ...season.neutrals]);
  const bad = nearest(hex, season.avoid);
  const fit = Math.max(0, 1 - good.distance / 30);
  const clash = Math.max(0, 1 - bad.distance / 22);
  const score = Math.round(Math.max(0, Math.min(100, (fit * 0.85 + (1 - clash) * 0.15) * 100 - clash * 25)));
  return { score, match: good.swatch, matchDistance: good.distance, clash: bad.distance < 12 ? bad.swatch : null };
}

/** k-means on pixels → dominant colours (used by the wardrobe check). */
export function dominantColours(data: Uint8ClampedArray, k = 4): { hex: string; share: number }[] {
  const px: [number, number, number][] = [];
  for (let i = 0; i < data.length; i += 16) if (data[i + 3] > 200) px.push([data[i], data[i + 1], data[i + 2]]);
  if (!px.length) return [];
  let c = Array.from({ length: k }, (_, i) => px[Math.floor(((i + 0.5) / k) * px.length)].slice() as [number, number, number]);
  const assign = new Array(px.length).fill(0);
  for (let it = 0; it < 12; it++) {
    for (let i = 0; i < px.length; i++) {
      let bi = 0, bd = Infinity;
      for (let j = 0; j < k; j++) {
        const d = (px[i][0] - c[j][0]) ** 2 + (px[i][1] - c[j][1]) ** 2 + (px[i][2] - c[j][2]) ** 2;
        if (d < bd) (bd = d), (bi = j);
      }
      assign[i] = bi;
    }
    const sum = Array.from({ length: k }, () => [0, 0, 0, 0]);
    px.forEach((p, i) => { const s = sum[assign[i]]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; });
    c = sum.map((s, j) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : c[j])) as [number, number, number][];
  }
  const counts = new Array(k).fill(0);
  assign.forEach((a) => counts[a]++);
  return c.map((v, j) => ({ hex: rgbToHex(...v), share: counts[j] / px.length })).filter((x) => x.share > 0.04).sort((a, b) => b.share - a.share);
}
