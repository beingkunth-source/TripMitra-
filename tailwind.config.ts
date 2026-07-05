import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",

        // ── Extended gray scale (unchanged) ───────────────────────────────
        gray: {
          150: "#f1f5f9",
          250: "#e2e8f0",
          450: "#94a3b8",
          550: "#64748b",
          650: "#475569",
          850: "#1e293b",
        },

        // ── A1a: Teal — primary brand colour (replaces indigo) ────────────
        teal: {
          50:  "#E1F5EE",
          100: "#9FE1CB",
          200: "#5DCAA5",
          400: "#1D9E75",
          500: "#0F766E",
          600: "#0F6E56",
          650: "#0B5E49", // interpolated for hover/active states
          700: "#0A5242",
          800: "#085041",
          900: "#04342C",
          950: "#022320",
        },

        // ── A1b: Coral — accent colour (replaces pink/magenta) ────────────
        coral: {
          50:  "#FAECE7",
          100: "#F5C4B3",
          200: "#F0997B",
          400: "#D85A30",
          500: "#F97362",
          600: "#993C1D",
          650: "#7E3217", // interpolated
          700: "#6B2A13",
          800: "#712B13",
          900: "#4A1B0C",
        },

        // ── Keep emerald and amber (status colours) ───────────────────────
        emerald: {
          50:  "#ecfdf5",
          100: "#d1fae5",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
        },
        amber: {
          50:  "#fffbeb",
          100: "#fef3c7",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },

        // ── A1d: indigo/pink kept as thin aliases so legacy class names
        //    that survive this refactor don't break in production;
        //    remove after all component refs are cleaned up.
        indigo: {
          50:  "#f0f2ff",
          100: "#e0e4ff",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          950: "#1e1b4b",
        },
        pink: {
          50:  "#fdf2f8",
          500: "#ec4899",
          600: "#db2777",
          700: "#be185d",
        },
      },

      fontFamily: {
        display: ["Outfit", "system-ui", "sans-serif"],
        primary: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
