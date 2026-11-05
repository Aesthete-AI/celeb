// Virtual draping on the user's own crop. Graphonomy's label map keeps the face, hair and neck; the
// rest becomes the chosen colour, with a fabric collar under the chin — the way analysts drape clients.
import { useEffect, useRef } from "react";
import { shade } from "../lib/color";

export default function Drape({ crop, mask, colour, className = "" }: { crop: string; mask?: string | null; colour: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const person = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let alive = true;
    const load = (src: string) => new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
    (async () => {
      const img = await load(crop);
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d", { willReadFrequently: true })!;
      g.drawImage(img, 0, 0);
      if (mask) {
        const m = await load(mask);
        const mc = document.createElement("canvas");
        mc.width = img.width;
        mc.height = img.height;
        const mg = mc.getContext("2d", { willReadFrequently: true })!;
        // label codes are 0 (background) … 3; a smoothed, slightly blurred upscale feathers the edge
        mg.imageSmoothingEnabled = true;
        mg.imageSmoothingQuality = "high";
        mg.filter = `blur(${Math.max(1, img.width / 400)}px)`;
        mg.drawImage(m, 0, 0, img.width, img.height);
        const md = mg.getImageData(0, 0, img.width, img.height).data;
        const d = g.getImageData(0, 0, img.width, img.height);
        for (let i = 0; i < d.data.length; i += 4) d.data[i + 3] = Math.min(255, md[i] * 340);
        g.putImageData(d, 0, 0);
      } else {
        // no mask (demo mode): an oval vignette around the face
        g.globalCompositeOperation = "destination-in";
        const grd = g.createRadialGradient(c.width / 2, c.height * 0.42, c.width * 0.18, c.width / 2, c.height * 0.42, c.width * 0.42);
        grd.addColorStop(0, "#000");
        grd.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grd;
        g.fillRect(0, 0, c.width, c.height);
      }
      if (alive) {
        person.current = c;
        paint();
      }
    })().catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crop, mask]);

  const paint = () => {
    const out = ref.current, p = person.current;
    if (!out || !p) return;
    out.width = p.width;
    out.height = p.height;
    const g = out.getContext("2d")!;
    const W = out.width, H = out.height;
    g.fillStyle = shade(colour, 0.08);
    g.fillRect(0, 0, W, H);
    g.drawImage(p, 0, 0);
    // fabric collar
    g.beginPath();
    g.moveTo(0, H);
    g.lineTo(0, H * 0.86);
    g.bezierCurveTo(W * 0.22, H * 0.78, W * 0.36, H * 0.86, W * 0.5, H * 0.9);
    g.bezierCurveTo(W * 0.64, H * 0.86, W * 0.78, H * 0.78, W, H * 0.86);
    g.lineTo(W, H);
    g.closePath();
    const fab = g.createLinearGradient(0, 0, W, 0);
    fab.addColorStop(0, shade(colour, -0.12));
    fab.addColorStop(0.45, shade(colour, 0.1));
    fab.addColorStop(1, shade(colour, -0.14));
    g.fillStyle = fab;
    g.fill();
  };

  useEffect(paint, [colour]);

  return <canvas ref={ref} className={className} />;
}
