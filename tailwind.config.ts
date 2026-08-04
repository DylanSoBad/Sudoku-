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
        bg: "var(--bg)",
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
        },
        line: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
        },
        content: {
          DEFAULT: "var(--text)",
          muted: "var(--text-muted)",
          subtle: "var(--text-subtle)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
        },
        success: "var(--success)",
        danger: "var(--danger)",
        // Legacy aliases. Every `shelby-*` class in the tree resolves into the
        // zinc + violet palette above so no view can drift back to the old hues.
        shelby: {
          bg: "var(--bg)",
          surface: "var(--surface)",
          panel: "var(--surface-2)",
          border: "var(--border)",
          accent: "var(--accent)",
          accent2: "var(--accent)",
          gold: "var(--accent)",
          warn: "var(--text-muted)",
          muted: "var(--text-muted)",
          "fg-strong": "var(--text)",
          success: "var(--success)",
          danger: "var(--danger)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        xs: ["12px", "16px"],
        sm: ["14px", "20px"],
        base: ["16px", "24px"],
        lg: ["20px", "28px"],
        xl: ["20px", "28px"],
        "2xl": ["24px", "32px"],
        "3xl": ["32px", "40px"],
        "4xl": ["32px", "40px"],
        "5xl": ["32px", "40px"],
      },
      // Capped at 12px so no leftover `rounded-2xl` / `rounded-full` can exceed it.
      borderRadius: {
        none: "0px",
        sm: "var(--r-sm)",
        DEFAULT: "var(--r-md)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        xl: "var(--r-xl)",
        "2xl": "var(--r-xl)",
        "3xl": "var(--r-xl)",
        full: "var(--r-xl)",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
    },
  },
  plugins: [],
};

export default config;
