/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        moss: "#2E4036",
        clay: "#CC5833",
        cream: "#F2F0E9",
        charcoal: "#1A1A1A"
      },
      borderRadius: {
        xl2: "2rem",
        xl3: "3rem"
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Outfit", "ui-sans-serif", "system-ui"],
        serif: ["Cormorant Garamond", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "Liberation Mono", "Courier New", "monospace"]
      },
      letterSpacing: { tightish: "-0.02em" },
      boxShadow: { soft: "0 18px 60px rgba(0,0,0,0.12)" },
      backdropBlur: { xxl: "28px" }
    }
  },
  plugins: []
};
