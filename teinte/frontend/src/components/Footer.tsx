import { Link } from "react-router-dom";
import { CATEGORIES, OCCASIONS, STYLE_GUIDES } from "../data/profiles";

export default function Footer() {
  return (
    <footer className="relative mt-32 border-t border-edge">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-10">
        <div>
          <p className="font-display text-4xl">Teinte</p>
          <p className="mt-3 max-w-xs text-sm text-mist-soft">Colour analysis and a personal stylist in one quiet place. Find your colours, then wear them everywhere.</p>
        </div>
        <Col title="Discover" links={[["/analyze", "AI colour analysis"], ["/for-you", "Your edit"], ["/palette", "Your palette"], ["/seasons", "The 12 seasons"], ["/wardrobe", "Wardrobe check"]]} />
        <Col title="Occasions" links={OCCASIONS.slice(0, 5).map((o) => [`/for-you/${o}`, CATEGORIES[o].title])} />
        <Col title="Style" links={[...STYLE_GUIDES.map((c) => [`/for-you/${c}`, CATEGORIES[c].title]), ["/privacy", "Privacy"]]} />
      </div>
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-2 px-4 pb-10 text-[11px] text-mist-faint sm:flex-row sm:px-6 lg:px-10">
        <span>© {new Date().getFullYear()} Teinte · Colour guidance, not a medical or dermatological assessment.</span>
        <span>Photography via <a href="https://unsplash.com/?utm_source=teinte&utm_medium=referral" target="_blank" rel="noreferrer" className="underline decoration-white/20 hover:text-mist-soft">Unsplash</a> , <a href="https://pixabay.com" target="_blank" rel="noreferrer" className="underline decoration-white/20 hover:text-mist-soft">Pixabay</a>, <a href="https://commons.wikimedia.org" target="_blank" rel="noreferrer" className="underline decoration-white/20 hover:text-mist-soft">Wikimedia Commons</a> &amp; <a href="https://www.pexels.com" target="_blank" rel="noreferrer" className="underline decoration-white/20 hover:text-mist-soft">Pexels</a> · photos are never stored.</span>
      </div>
    </footer>
  );
}

function Col({ title, links }: { title: string; links: string[][] }) {
  return (
    <div>
      <p className="eyebrow mb-4">{title}</p>
      <ul className="space-y-2.5 text-sm">
        {links.map(([to, l]) => <li key={to}><Link to={to} className="text-mist-soft transition hover:text-mist">{l}</Link></li>)}
      </ul>
    </div>
  );
}
