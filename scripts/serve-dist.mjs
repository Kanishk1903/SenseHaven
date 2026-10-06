/** Static server for verification (mirrors the FastAPI rules): "/" serves the
 *  prerendered home.html, files from dist, SPA fallback to index.html. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const DIST = new URL("../web/dist", import.meta.url).pathname;
const PORT = Number(process.env.PORT ?? 4175);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json",
  ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".txt": "text/plain",
};

import { gzipSync } from "node:zlib";

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let path = normalize(url.pathname).replace(/^(\.\.[/\\])+/, "");
  const acceptsGzip = (req.headers["accept-encoding"] ?? "").includes("gzip");
  try {
    // "?__full=1" forces the app shell (used by the prerender to snapshot the full page)
    const wantFullPage = url.searchParams.has("__full");
    let file = path === "/" || path === "" ? (wantFullPage ? "/index.html" : "/home.html") : path;
    let body;
    try {
      body = await readFile(join(DIST, file));
    } catch {
      body = await readFile(join(DIST, path));
    }
    const type = TYPES[extname(file ?? path)] ?? "application/octet-stream";
    const headers = { "content-type": type };
    if (acceptsGzip && body.length > 1024 && /text|javascript|json|svg/.test(type)) {
      body = gzipSync(body);
      headers["content-encoding"] = "gzip";
    }
    res.writeHead(200, headers);
    res.end(body);
  } catch {
    try {
      const body = await readFile(join(DIST, "index.html"));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  }
}).listen(PORT, "127.0.0.1", () => console.log(`serving dist on ${PORT}`));
