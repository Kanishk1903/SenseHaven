import type { Config } from "tailwindcss";

// Theme extension generated from design/tokens.json (design/generated/tailwind.tokens.cjs) —
// never hand-edit the imported values.
const tokens = require("./design/generated/tailwind.tokens.cjs");

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: tokens.colors,
      fontFamily: tokens.fontFamily,
      fontSize: tokens.fontSize,
      spacing: tokens.spacing,
      borderRadius: tokens.borderRadius,
      boxShadow: tokens.boxShadow,
      transitionDuration: tokens.transitionDuration,
      transitionTimingFunction: tokens.transitionTimingFunction,
    },
  },
  plugins: [],
} satisfies Config;
