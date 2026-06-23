import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // FutureX brand colors (inspired by the brochure design)
        futurex: {
          bg: "#0f0e0c",
          surface: "#161412",
          surface2: "#1c1916",
          ink: "#f0ebe4",
          muted: "#8a8078",
          line: "#2a2520",
          gold: "#c9a66b",
          "gold-soft": "rgba(201,166,107,0.12)",
          "gold-border": "rgba(201,166,107,0.22)",
          cream: "#fffdf8",
        },
      },
      fontFamily: {
        serif: ["DM Serif Display", "serif"],
        sans: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["Space Grotesk", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
