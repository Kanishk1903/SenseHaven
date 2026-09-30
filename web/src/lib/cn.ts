import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge our custom font-size scale (design/tokens.json) so colour classes
// like text-on-primary are never mistaken for a conflicting font-size utility.
const customMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display", "h1", "h2", "h3", "body", "secondary", "caption"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return customMerge(clsx(inputs));
}
