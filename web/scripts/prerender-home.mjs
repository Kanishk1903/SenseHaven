/** Prerender the public Home (spec H15): the SPA renders the full page once ("?__full=1"
 *  forces the app shell instead of the prerendered file); the settled DOM is written to
 *  dist/home.html with the app scripts stripped and the small islands entry injected, so
 *  the page works with JavaScript disabled and never repaints the LCP on hydration. */
import { createServer } from "node:http";
import { readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "@playwright/test";

const DIST = new URL("../dist", import.meta.url).pathname;
const PORT = 4179;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let path = normalize(url.pathname).replace(/^([/\\])+/, "");
  if (path === "/" || path === "\\") path = "/index.html";
  try {
    const body = await readFile(join(DIST, path));
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    // SPA fallback: any route boots the shell, then the router decides
    const body = await readFile(join(DIST, "index.html"));
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(body);
  }
});

await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`http://127.0.0.1:${PORT}/?__full=1`);
await page.getByTestId("home-ready").waitFor({ timeout: 30000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400); // settle ribbon/layout measurement

// fonts the page actually used (for preloading — kills the fallback→webfont swap shift)
const fontPaths = await page.evaluate(() =>
  [...new Set(
    performance
      .getEntriesByType("resource")
      .filter((r) => r.name.endsWith(".woff2"))
      .map((r) => new URL(r.name, location.origin).pathname),
  )],
);
let html = await page.content();

// inline the CSS so first paint needs no stylesheet roundtrip (H13 mobile throttle)
html = await page.evaluate(async (html) => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  await Promise.all(
    [...doc.querySelectorAll('link[rel="stylesheet"]')].map(async (link) => {
      const css = await fetch(link.href).then((r) => r.text());
      const style = doc.createElement("style");
      style.textContent = css;
      link.replaceWith(style);
    }),
  );
  return "<!doctype html>\n" + doc.documentElement.outerHTML;
}, html);

// strip the app scripts — the static page carries the content; the islands entry adds
// the interactive layer (spec §8.4: fully usable with JavaScript disabled)
html = html.replace(/<script type="module"[^>]*><\/script>/g, "");
html = html.replace(/<link rel="modulepreload"[^>]*>/g, "");

// preload the used fonts, budgeted by their real dist sizes (spec: ≤ 120 KB preloaded)
let budget = 100 * 1024; // above-fold faces only; the mono face loads with the page
const preloadLinks = [];
for (const fontPath of fontPaths) {
  const size = (await stat(join(DIST, fontPath))).size;
  if (size <= budget) {
    budget -= size;
    preloadLinks.push(`<link rel="preload" as="font" type="font/woff2" fetchpriority="high" href="${fontPath}" crossorigin>`);
  }
}
html = html.replace("</head>", `${preloadLinks.join("\n")}\n</head>`);

// inject the islands entry (its react/home-shared imports load as modulepreloads)
const manifest = JSON.parse(await readFile(join(DIST, ".vite/manifest.json"), "utf8"));
const islandsKey = Object.keys(manifest).find((k) => k.includes("islands-entry"));
const islands = manifest[islandsKey];
// manifest "imports" are chunk KEYS (prefixed "_"), not URLs — resolve each to its file
const importFiles = (keys, seen = new Set()) => {
  const files = [];
  for (const key of keys ?? []) {
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = manifest[key];
    if (!entry) continue;
    files.push(entry.file);
    for (const nested of importFiles(entry.imports, seen)) files.push(nested);
  }
  return files;
};
const islandTags = [
  `<link rel="modulepreload" href="/${islands.file}" />`,
  ...importFiles(islands.imports).map((file) => `<link rel="modulepreload" href="/${file}" />`),
  `<script type="module" src="/${islands.file}"></script>`,
];
html = html.replace("</body>", `${islandTags.join("\n")}\n</body>`);

// the snapshot is a static document: strip Playwright's injected attributes
await writeFile(new URL("../dist/home.html", import.meta.url), html.replace(/\s+aria-current="page"/g, ""));
console.log("prerendered dist/home.html (islands: /" + islands.file + ")");

await browser.close();
server.close();
