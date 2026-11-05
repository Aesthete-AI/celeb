/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        night: { DEFAULT: "#08080B", 2: "#0E0D12", 3: "#15141B" },
        mist: { DEFAULT: "#EEEAE4", soft: "#A9A39C", faint: "#6F6A66" },
        edge: "rgba(255,255,255,0.08)",
        aura: { peach: "#F4B39A", lilac: "#C9A7F0", mint: "#9FE0CC", gold: "#E9CF95" },
      },
      fontFamily: {
        display: ['"Instrument Serif"', "Georgia", "serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      letterSpacing: { luxe: "0.24em" },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,.06), 0 20px 60px -20px rgba(0,0,0,.8)",
        lift: "0 30px 80px -30px rgba(0,0,0,.9)",
      },
      keyframes: {
        drift: { "0%,100%": { transform: "translate(0,0) scale(1)" }, "50%": { transform: "translate(5%,-4%) scale(1.1)" } },
        sheen: { "0%": { backgroundPosition: "0% 0" }, "100%": { backgroundPosition: "200% 0" } },
        shimmer: { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(100%)" } },
      },
      animation: { drift: "drift 22s ease-in-out infinite", sheen: "sheen 6s linear infinite", shimmer: "shimmer 1.8s ease-in-out infinite" },
    },
  },
  plugins: [],
};
