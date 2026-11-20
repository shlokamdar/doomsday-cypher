/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#07090D",
        gunmetal: "#1B2028",
        plate: "#12161C",
        reactor: "#2BD67B",
        gold: "#F2B33D",
        breach: "#E0408A",
        steel: "#C9D2DC",
      },
      fontFamily: {
        display: ['"Bebas Neue"', "Impact", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        reactor: "0 0 24px rgba(43,214,123,0.35)",
        gold: "0 0 24px rgba(242,179,61,0.35)",
        breach: "0 0 24px rgba(224,64,138,0.4)",
      },
    },
  },
  plugins: [],
};
