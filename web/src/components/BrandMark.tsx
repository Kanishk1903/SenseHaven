/** BrandMark — the lens-heart app icon as an inline SVG logo (matches favicon.svg and the
 *  Android launcher). Used wherever the mark stands for the PRODUCT (shell, auth, empty
 *  states); the mood orb (OrbMark) stays the mark for child/mood contexts. */
import { useId } from "react";

import { cn } from "@/lib/cn";

export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (name: string) => `sh-${name}-${uid}`;
  const url = (name: string) => `url(#${id(name)})`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="SenseHeaven"
      className={cn("shrink-0", className)}
    >
      <defs>
        <clipPath id={id("rc")}>
          <rect width="64" height="64" rx="14.5" />
        </clipPath>
        <linearGradient id={id("rg")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F0ABFC" />
          <stop offset="0.5" stopColor="#6366F1" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
        <radialGradient id={id("lens")} cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stopColor="#312E81" />
          <stop offset="1" stopColor="#050510" />
        </radialGradient>
        <linearGradient id={id("hg")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FDA4AF" />
          <stop offset="1" stopColor="#F43F5E" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${id("rc")})`}>
        <rect width="64" height="64" fill="#07070F" />
        <circle cx="32" cy="32" r="25" fill={url("rg")} />
        <circle cx="32" cy="32" r="21" fill="#0B0B18" />
        <circle cx="32" cy="32" r="18" fill={url("lens")} />
        <path
          d="M32 43.5 C22 36.5 24.6 27.6 29.4 29.1 C31 29.6 32 31.4 32 31.4 C32 31.4 33 29.6 34.6 29.1 C39.4 27.6 42 36.5 32 43.5 Z"
          fill={url("hg")}
          transform="translate(0 -2.2)"
        />
        <path
          d="M19.5 26 A14 14 0 0 1 28 18.5"
          fill="none"
          stroke="#fff"
          strokeOpacity="0.7"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="45" cy="42.5" r="1.6" fill="#fff" opacity="0.6" />
      </g>
    </svg>
  );
}
