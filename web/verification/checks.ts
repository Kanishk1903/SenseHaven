/**
 * Programmatic layout/copy checks for the v2 verification protocol (UI-UX v2 spec §8.3/§8.4).
 * Each export returns a list of human-readable issues; an empty list means the gate passed.
 * Adapted from the spec's reference implementation — do not weaken without recording why
 * in verification/report-v2.md.
 */
import type { Page } from "@playwright/test";

/** G1 — no two text/control elements overlap (bounding-box intersection > 2px, excluding ancestor/descendant). */
export async function findOverlaps(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    // documented adaptation: closed <details> content is UA-hidden yet reports boxes
    const inClosedDetails = (el: Element): boolean => {
  const d = el.closest("details");
  return d !== null && !d.hasAttribute("open");
};
    const lab = (e: Element) =>
      `<${e.tagName.toLowerCase()}> "${(e.textContent || "").trim().slice(0, 30)}"`;
    const els = [
      ...document.querySelectorAll<Element>(
        "h1,h2,h3,h4,p,span,a,button,label,li,dt,dd,td,th,[data-nowrap],svg text",
      ),
    ].filter((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent || "").trim());
      // documented adaptation: .sr-only labels are 1x1 by design (revealed on focus)
      if (el.classList.contains("sr-only")) return false;
      if (inClosedDetails(el)) return false;
      return (
        r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" &&
        (ownText || ["BUTTON", "A"].includes(el.tagName))
      );
    });
    const issues: string[] = [];
    for (let i = 0; i < els.length; i++) {
      for (let j = i + 1; j < els.length; j++) {
        const a = els[i]!, b = els[j]!;
        if (a.contains(b) || b.contains(a)) continue;
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (w > 2 && h > 2) {
          issues.push(`${lab(a)} overlaps ${lab(b)} (${Math.round(w)}x${Math.round(h)}px)`);
        }
      }
    }
    return issues;
  });
}

/** G2 — no horizontal page scroll, no clipped text, nothing past the viewport outside [data-scroll-x]. */
export async function findOverflow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    // documented adaptation: closed <details> content is UA-hidden yet reports boxes
    const inClosedDetails = (el: Element): boolean => {
  const d = el.closest("details");
  return d !== null && !d.hasAttribute("open");
};
    const out: string[] = [];
    const doc = document.documentElement;
    // intra-SVG clipping: an SVG viewport clips by default, so text outside its own
    // <svg> box is invisible to scrollWidth — compare each svg text to its svg's rect
    document.querySelectorAll<SVGTextElement>("svg text").forEach((t) => {
      const svg = t.closest("svg");
      if (!svg) return;
      const tr = t.getBoundingClientRect();
      const sr = svg.getBoundingClientRect();
      if (tr.width === 0 || sr.width === 0) return;
      if (tr.left < sr.left - 0.5 || tr.right > sr.right + 0.5 || tr.top < sr.top - 0.5 || tr.bottom > sr.bottom + 0.5) {
        out.push(`<text> "${(t.textContent || "").trim().slice(0, 24)}" is clipped by its svg viewport`);
      }
    });
    if (doc.scrollWidth > doc.clientWidth + 1) {
      out.push(`page scrolls horizontally (${doc.scrollWidth} > ${doc.clientWidth})`);
    }
    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return;
      // documented adaptation: .sr-only elements clip by design (revealed on focus)
      if (el.closest(".sr-only") || el.classList.contains("sr-only")) return;
      if (inClosedDetails(el)) return;
      const clipX = ["hidden", "clip"].includes(cs.overflowX);
      const clipY = ["hidden", "clip"].includes(cs.overflowY);
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent || "").trim());
      const tag = `<${el.tagName.toLowerCase()}> "${(el.textContent || "").trim().slice(0, 30)}"`;
      if (
        hasText && !el.hasAttribute("data-allow-truncate") &&
        ((clipX && el.scrollWidth > el.clientWidth + 1) || (clipY && el.scrollHeight > el.clientHeight + 1))
      ) {
        out.push(`${tag} is clipped`);
      }
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > window.innerWidth + 1 && !el.closest("[data-scroll-x]")) {
        out.push(`${tag} extends past viewport`);
      }
    });
    return out;
  });
}

/** G3 — every [data-nowrap] stays on one line (height ≤ 1.5 × line-height). */
export async function findWrappedNoWrap(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-nowrap]")].flatMap((el) => {
      const cs = getComputedStyle(el);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
      const r = el.getBoundingClientRect();
      return r.height > lh * 1.5
        ? [`"${(el.textContent || "").trim()}" wrapped (${Math.round(r.height)}px tall)`]
        : [];
    }),
  );
}

/** G12 — tap targets ≥ min px on interactive elements. */
export async function findSmallTargets(page: Page, min: number): Promise<string[]> {
  return page.evaluate((min) =>
    [...document.querySelectorAll<HTMLElement>("button,a[href],[role=button],input,select,textarea,[tabindex]:not([tabindex='-1'])")]
      .flatMap((el) => {
        const dClosed = (() => {
          const d = el.closest("details");
          return d !== null && !d.hasAttribute("open");
        })();
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") return [];
        // documented adaptation: .sr-only targets are 1x1 until focused (skip link)
        if (el.classList.contains("sr-only")) return [];
        if (dClosed) return [];
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.width < min || r.height < min)
          ? [`<${el.tagName.toLowerCase()}> "${(el.textContent || "").trim().slice(0, 20)}" is ${Math.round(r.width)}x${Math.round(r.height)}`]
          : [];
      }),
  min);
}

/** G9 — copy lint on rendered text. */
export function copyLint(text: string): string[] {
  const rules: [RegExp, string][] = [
    [/\b(6\d|[7-9]\d|\d{3,})\s?s ago\b/i, "raw seconds above 59"],
    [/undefined|NaN|\[object/, "leaked value"],
    [/'s parent\b/i, "placeholder greeting"],
    [/!/, "exclamation mark"],
    [/\p{Extended_Pictographic}/u, "emoji"],
  ];
  return rules.filter(([re]) => re.test(text)).map(([, why]) => why);
}

/** G9 (labels) — no ALL-CAPS labels via text-transform. */
export async function findUppercaseLabels(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("h1,h2,h3,h4,p,span,a,button,label,li,dt,dd,td,th")]
      .filter((el) => {
        if (el.textContent === null || el.textContent.trim().length < 2) return false;
        const cs = getComputedStyle(el);
        return cs.textTransform === "uppercase";
      })
      .map((el) => `uppercase label: "${(el.textContent || "").trim().slice(0, 30)}"`),
  );
}

/** G14 — type floor: no rendered text under 12px; letter-spacing tighter than −0.02em. */
export async function findTypeFloorViolations(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const issues: string[] = [];
    const seen = new Set<string>();
    document.querySelectorAll<Element>("body *").forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return;
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent || "").trim());
      if (!hasText) return;
      // SVG <text> inside a scaled viewBox: the rendered size is CSS size x CTM scale
      let ctms = 1;
      if (el instanceof SVGElement && "getScreenCTM" in el) {
        const ctm = (el as SVGGraphicsElement).getScreenCTM();
        if (ctm && ctm.a > 0) ctms = ctm.a;
      }
      const size = parseFloat(cs.fontSize) * ctms;
      if (size < 11.9) {
        const key = `${tag(el)}:${size}`;
        if (!seen.has(key)) {
          seen.add(key);
          issues.push(`${tag(el)} renders at ${size.toFixed(1)}px (floor 12px)`);
        }
      }
      const fs = parseFloat(cs.fontSize) || 16;
      const ls = parseFloat(cs.letterSpacing);
      if (!Number.isNaN(ls) && ls / fs < -0.0201) {
        const key = `${tag(el)}:${ls}`;
        if (!seen.has(key)) {
          seen.add(key);
          issues.push(`${tag(el)} letter-spacing ${cs.letterSpacing} tighter than −0.02em`);
        }
      }
    });
    return issues;

    function tag(el: Element): string {
      return `<${el.tagName.toLowerCase()}> "${(el.textContent || "").trim().slice(0, 30)}"`;
    }
  });
}
