import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        shelby: {
          bg: "#0b0d12",
          surface: "#11141b",
          border: "#1f2530",
          accent: "#7b5cff",
          accent2: "#22d3ee",
          muted: "#6b7280",
          "fg-strong": "#f4f4f5",
          success: "#34d399",
          danger: "#f87171",
          warn: "#fbbf24",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Inter", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 40px rgba(123,92,255,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
