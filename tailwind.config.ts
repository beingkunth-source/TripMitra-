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
        gray: {
          150: "#f1f5f9",
          250: "#e2e8f0",
          450: "#94a3b8",
          850: "#1e293b",
        },
        indigo: {
          50: "#f5f6fc",
          100: "#e9ebf8",
          500: "#636abf",
          600: "#4e55a8",
          700: "#3f458c",
          950: "#1a1c3b",
        },
        pink: {
          50: "#fdf6f9",
          500: "#c7668c",
          600: "#af4d75",
          700: "#8e3a5c",
        },
        teal: {
          500: "#4ca396",
          600: "#3a877b",
        },
        emerald: {
          500: "#50a373",
          600: "#3d855a",
        },
        amber: {
          500: "#cc962d",
          600: "#ad7d20",
        },
      },
    },
  },
  plugins: [],
};
export default config;
