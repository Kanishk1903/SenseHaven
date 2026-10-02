import type { Config } from "tailwindcss";

// Theme extension generated from design/tokens.json (design/generated/tailwind.tokens.cjs).
// Colors are CSS variables so dark mode swaps values without dark: classes (spec 3.3).
// Spacing intentionally NOT extended: the default Tailwind scale already is the 4-pt grid.
const tokens = require("./design/generated/tailwind.tokens.cjs");

export default {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: tokens.colors,
      fontFamily: tokens.fontFamily,
      fontSize: tokens.fontSize,
      borderRadius: tokens.borderRadius,
      boxShadow: tokens.boxShadow,
      transitionDuration: tokens.transitionDuration,
      transitionTimingFunction: tokens.transitionTimingFunction,
    },
  },
  plugins: [],
} satisfies Config;
