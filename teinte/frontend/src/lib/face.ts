// Everything here runs in the browser. The full photo never leaves the device: MediaPipe finds the face,
// we check the photo, sample skin colours for the on-screen read-out, and cut the head-to-neck crop with
// exactly the geometry the research pipeline used (croppers.expand):
//   top = face_top − 0.8·face_h, bottom = face_bottom + 0.9·face_h, square, side ≥ 2·face_w.
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { rgbToHex, rgbToLab } from "./color";

const VERSION = "0.10.18";
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarker: Promise<FaceLandmarker> | null = null;

export function loadLandmarker() {
  if (!landmarker) {
    landmarker = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM);
      const make = (delegate: "GPU" | "CPU") =>
        FaceLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: "IMAGE", numFaces: 2 });
      try {
        return await make("GPU");
      } catch {
        return await make("CPU");
      }
    })();
    landmarker.catch(() => (landmarker = null));
  }
  return landmarker;
}

export type Check = { id: string; label: string; ok: boolean; warn?: boolean; detail: string };
export type Sample = { name: string; hex: string; x: number; y: number };
export type FaceRead = {
  ok: boolean;
  checks: Check[];
  samples: Sample[];
  crop: Blob | null;
  cropUrl: string | null;
  cropPoints: [number, number][]; // landmarks in crop coordinates (0–1), for the scan animation
  cropSize: number;
};

const P = { forehead: 151, lCheek: 205, rCheek: 425, chin: 199, nose: 1, lFace: 234, rFace: 454, lEye: 33, rEye: 263, top: 10, bottom: 152 };

export async function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  return img;
}

/** Draw upright, capped at 2000 px so phones' 12 MP photos stay fast. */
function toCanvas(img: HTMLImageElement) {
  const s = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  c.getContext("2d", { willReadFrequently: true })!.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

function patch(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): [number, number, number] | null {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const x0 = Math.max(0, Math.round(x - r)), y0 = Math.max(0, Math.round(y - r));
  const w = Math.min(W - x0, Math.round(2 * r)), h = Math.min(H - y0, Math.round(2 * r));
  if (w < 2 || h < 2) return null;
  const d = ctx.getImageData(x0, y0, w, h).data;
  const ch: number[][] = [[], [], []];
  for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) ch[k].push(d[i + k]);
  const med = (a: number[]) => a.sort((p, q) => p - q)[a.length >> 1];
  return [med(ch[0]), med(ch[1]), med(ch[2])];
}

function sharpness(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number) {
  const s = 256 / Math.max(w, h);
  const c = document.createElement("canvas");
  c.width = Math.max(8, Math.round(w * s));
  c.height = Math.max(8, Math.round(h * s));
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(ctx.canvas, x0, y0, w, h, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const L = (x: number, y: number) => { const i = (y * c.width + x) * 4; return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; };
  let sum = 0, sq = 0, n = 0;
  for (let y = 1; y < c.height - 1; y++)
    for (let x = 1; x < c.width - 1; x++) {
      const v = 4 * L(x, y) - L(x - 1, y) - L(x + 1, y) - L(x, y - 1) - L(x, y + 1);
      sum += v; sq += v * v; n++;
    }
  return sq / n - (sum / n) ** 2;
}

export async function readFace(file: Blob): Promise<FaceRead> {
  const [lm, img] = await Promise.all([loadLandmarker(), loadImage(file)]);
  const canvas = toCanvas(img);
  URL.revokeObjectURL(img.src);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const W = canvas.width, H = canvas.height;
  const res = lm.detect(canvas);
  const faces = res.faceLandmarks ?? [];
  const checks: Check[] = [];
  const fail = (id: string, label: string, detail: string): FaceRead => ({ ok: false, checks: [...checks, { id, label, ok: false, detail }], samples: [], crop: null, cropUrl: null, cropPoints: [], cropSize: 0 });

  if (!faces.length) return fail("face", "Face found", "We couldn't find a face. Try a clear, front-facing photo.");
  // biggest face wins; more than one is only a warning
  const areas = faces.map((f) => { const xs = f.map((p) => p.x), ys = f.map((p) => p.y); return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)); });
  const pts = faces[areas.indexOf(Math.max(...areas))].map((p) => [p.x * W, p.y * H] as [number, number]);
  checks.push({ id: "face", label: "Face found", ok: true, warn: faces.length > 1, detail: faces.length > 1 ? "More than one face — we'll use the largest." : "One clear face detected." });

  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const fx0 = Math.min(...xs), fx1 = Math.max(...xs), fy0 = Math.min(...ys), fy1 = Math.max(...ys);
  const fw = fx1 - fx0, fh = fy1 - fy0;
  if (fw < 60) return fail("size", "Close enough", "Your face is too small in the frame — move closer or crop the photo.");

  // head-to-neck framing (hair top and neck must fit the crop window)
  const top = fy0 - 0.8 * fh, bottom = fy1 + 0.9 * fh;
  const clippedTop = Math.max(0, -top) / (0.8 * fh), clippedBottom = Math.max(0, bottom - H) / (0.9 * fh);
  const framed = clippedTop < 0.35 && clippedBottom < 0.5;
  checks.push({ id: "frame", label: "Hair to neck in frame", ok: framed, warn: !framed, detail: framed ? "Head, hair and neck are all visible." : clippedTop >= 0.35 ? "The top of your hair is cut off — leave space above your head." : "Your neck is cut off — include it in the photo." });

  // pose: yaw from the nose's position between the cheeks, roll from the eye line
  const nose = pts[P.nose], l = pts[P.lFace], r = pts[P.rFace];
  const yaw = Math.abs((nose[0] - l[0]) / Math.max(1, r[0] - nose[0]) - 1);
  const roll = Math.abs((Math.atan2(pts[P.rEye][1] - pts[P.lEye][1], pts[P.rEye][0] - pts[P.lEye][0]) * 180) / Math.PI);
  const frontal = yaw < 0.45 && roll < 14;
  checks.push({ id: "pose", label: "Facing the camera", ok: frontal, warn: !frontal, detail: frontal ? "Straight-on and level." : "Turn to face the camera straight on, head level." });

  // lighting: brightness and left/right balance of the cheeks
  const r0 = Math.max(3, fw * 0.035);
  const named: [string, number][] = [["Forehead", P.forehead], ["Left cheek", P.lCheek], ["Right cheek", P.rCheek], ["Chin", P.chin]];
  const samples: Sample[] = [];
  const labs: number[][] = [];
  for (const [name, i] of named) {
    const c = patch(ctx, pts[i][0], pts[i][1], r0);
    if (c) { samples.push({ name, hex: rgbToHex(...c), x: pts[i][0], y: pts[i][1] }); labs.push(rgbToLab(c)); }
  }
  const hairY = fy0 - 0.32 * fh, neckY = fy1 + 0.3 * fh; // the mesh stops below the hairline
  const hairC = hairY > 0 ? patch(ctx, (fx0 + fx1) / 2, hairY, r0) : null;
  const neckC = neckY < H ? patch(ctx, (fx0 + fx1) / 2, neckY, r0) : null;
  if (hairC) samples.push({ name: "Hair", hex: rgbToHex(...hairC), x: (fx0 + fx1) / 2, y: hairY });
  if (neckC) samples.push({ name: "Neck", hex: rgbToHex(...neckC), x: (fx0 + fx1) / 2, y: neckY });
  const meanL = labs.reduce((a, b) => a + b[0], 0) / Math.max(1, labs.length);
  const balance = labs.length >= 3 ? Math.abs(labs[1][0] - labs[2][0]) : 0;
  const lightOk = meanL > 28 && meanL < 88 && balance < 14;
  checks.push({ id: "light", label: "Even lighting", ok: lightOk, warn: !lightOk, detail: meanL <= 28 ? "The photo is quite dark — face a window." : meanL >= 88 ? "The photo looks overexposed — avoid direct sun or flash." : balance >= 14 ? "One side of your face is in shadow — face the light evenly." : "Soft and even." });

  const sharp = sharpness(ctx, fx0, fy0, fw, fh);
  const sharpOk = sharp > 18;
  checks.push({ id: "sharp", label: "In focus", ok: sharpOk, warn: !sharpOk, detail: sharpOk ? "Nice and sharp." : "The photo looks blurry — hold steady or use a higher-resolution photo." });

  // the crop (croppers.expand)
  const cx = (fx0 + fx1) / 2, side = Math.max(bottom - top, 2 * fw);
  const x0 = Math.max(0, Math.round(cx - side / 2)), x1 = Math.min(W, Math.round(cx + side / 2));
  const y0 = Math.max(0, Math.round(top)), y1 = Math.min(H, Math.round(bottom));
  const cw = x1 - x0, chh = y1 - y0;
  const s = Math.min(1, 768 / Math.max(cw, chh));
  const out = document.createElement("canvas");
  out.width = Math.round(cw * s);
  out.height = Math.round(chh * s);
  out.getContext("2d")!.drawImage(canvas, x0, y0, cw, chh, 0, 0, out.width, out.height);
  const crop = await new Promise<Blob | null>((res) => out.toBlob(res, "image/jpeg", 0.95));
  const cropPoints = pts.filter((_, i) => i % 3 === 0).map(([x, y]) => [(x - x0) / cw, (y - y0) / chh] as [number, number]);
  for (const sm of samples) (sm.x = (sm.x - x0) / cw), (sm.y = (sm.y - y0) / chh);

  return { ok: true, checks, samples, crop, cropUrl: out.toDataURL("image/jpeg", 0.9), cropPoints, cropSize: Math.max(out.width, out.height) };
}
