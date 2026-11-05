import { Lock } from "lucide-react";
import { Reveal } from "../components/ui";

const ITEMS = [
  { t: "Your full photo never leaves your device", d: "Face detection, photo checks and the colour samples you see on screen all run in your browser. The original photo is never uploaded." },
  { t: "Only a head-and-neck crop is sent", d: "To read your colouring, we need your hair, face and neck together. We crop the photo to that area on your device and send only the crop." },
  { t: "Analysed in memory, then discarded", d: "The crop is decoded in memory, analysed, and dropped as soon as your result returns. It is never written to disk, logged, stored or used for training." },
  { t: "Visible only to you", d: "Nobody else can see your photo or results unless you choose to share them. Draping on the palette page uses a copy kept in this browser tab only; it disappears when you close it." },
  { t: "What we keep on your device", d: "Your season, undertone and look preferences are saved in your browser so the stylist remembers them. Clear your site data to remove them." },
  { t: "The stylist never sees your photo", d: "Chat questions are sent with your season, undertone and palette — never the image." },
];

export default function Privacy() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-10 pt-10 sm:px-6 md:pt-16">
      <Lock size={22} />
      <h1 className="display mt-6 text-[56px] md:text-[80px]">Your photo, your eyes only.</h1>
      <p className="mt-6 text-lg text-mist-soft">Colour analysis needs a picture of you. Here's exactly what happens to it.</p>
      <div className="mt-14 divide-y divide-edge border-y border-edge">
        {ITEMS.map((x, i) => (
          <Reveal key={x.t} delay={i * 0.04} className="grid gap-2 py-7 md:grid-cols-[1fr_1.4fr] md:gap-10">
            <p className="font-display text-2xl">{x.t}</p>
            <p className="text-mist-soft">{x.d}</p>
          </Reveal>
        ))}
      </div>
      <p className="mt-10 text-xs text-mist-faint">Teinte offers colour and style guidance. It is not a medical or dermatological assessment.</p>
    </div>
  );
}
