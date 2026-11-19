// Post-build: writes out/sw.js with a precache list of every exported file and a cache name
// that changes whenever any file changes, so phones pick up each release.
import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";

const OUT = process.env.EXP_STUB === "1" ? "out-test" : "out";
const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
})(OUT);

const skip = /(^|\/)(sw\.js|.*\.map|_not-found.*|404.*)$/;
const urls = files.map(f => "/" + relative(OUT, f).split("\\").join("/")).filter(u => !skip.test(u));
// directory index pages are requested as "/"
const list = [...new Set(["/", ...urls.map(u => u.replace(/index\.html$/, ""))])].sort();
const hash = createHash("sha1");
for (const f of files) if (!skip.test(f)) { hash.update(f); hash.update(readFileSync(f)); }
const version = "exp-next-" + hash.digest("hex").slice(0, 10);

const tpl = readFileSync("public/sw.template.js", "utf8");
writeFileSync(join(OUT, "sw.js"), tpl.replace("__VERSION__", version).replace("__PRECACHE__", JSON.stringify(list)));
console.log(`sw.js: ${list.length} files, cache ${version}`);
