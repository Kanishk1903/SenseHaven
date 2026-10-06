/** H18 — production guard: the rendered Home must not ship unresolved markers,
 *  placeholders or banned copy. Fails the build when found. */
import { readFile, readdir } from "node:fs/promises";

const home = await readFile("dist/home.html", "utf8");
const text = home.replace(/<script[\s\S]*?<\/script>/g, " "); // scripts are code, not copy
const assets = (await readdir("dist/assets")).filter((f) => f.startsWith("home-") && f.endsWith(".js"));
let js = "";
for (const f of assets) js += await readFile(`dist/assets/${f}`, "utf8");

const rules = [
  [/\[CONFIRM/i, "unresolved CONFIRM marker"],
  [/lorem/i, "lorem placeholder"],
  [/\bTODO\b/, "TODO placeholder"],
  [/\$\{?price|pricing-tbd|\bFREE-TIER-PLACEHOLDER\b/i, "placeholder price"],
];
const problems = [];
for (const [re, why] of rules) {
  if (re.test(text)) problems.push(`home.html: ${why}`);
  if (re.test(js)) problems.push(`home bundle: ${why}`);
}
if (problems.length) {
  console.error("H18 guard FAILED:\n" + problems.join("\n"));
  process.exit(1);
}
console.log("H18 guard: home output clean (no CONFIRM/lorem/TODO/placeholder-price)");
