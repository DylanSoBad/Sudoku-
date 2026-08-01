import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        shelby: {
          bg: "#07080d",
          panel: "#0f1220",
          border: "#1e2338",
          accent: "#6ee7ff",
          accent2: "#a855f7",
          gold: "#fbbf24",
          danger: "#ef4444",
          muted: "#7a83a6",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
