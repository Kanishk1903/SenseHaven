import type { Config } from "tailwindcss";

// Theme extension generated from design/tokens.json (design/generated/tailwind.tokens.cjs) —
// never hand-edit the imported values.
const tokens = require("./design/generated/tailwind.tokens.cjs");

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: tokens.colors,
      // spacing intentionally NOT extended: the default Tailwind scale already is the
      // 4-pt grid, and pixel-valued token keys (8 = 8px) would shadow w-8/h-12 etc.
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
