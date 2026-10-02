/* Legt de uitkomsten van de scanner vast op een vaste versie (standaard v135,
   commit 05f63af op main). Alleen opnieuw draaien als je bewust een nieuwe
   referentie wilt — nooit om een rode test groen te maken. */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import * as A from "./atlas.mjs";
import { uitkomsten } from "./draai.mjs";
const ref = process.argv[2] || "05f63af";
const html = execSync(`git show ${ref}:index.html`, { cwd: A.ROOT, maxBuffer: 50e6 }).toString();
const src = A.scriptUit(html);
const delen = A.bevrorenDelen(src).map(d => ({ blok: d.blok, naam: d.naam, hash: d.hash }));
const ids = [...A.idsIn(A.bevrorenDelen(src).map(d => d.src).join("\n"))].sort();
const gevallen = await uitkomsten(html);
writeFileSync(new URL("./scanner-golden.json", import.meta.url),
  JSON.stringify({ referentie: ref, gemaakt: new Date().toISOString(), delen, ids, gevallen }, null, 1));
console.log(`referentie ${ref}: ${delen.length} bevroren opdrachten, ${ids.length} element-id's, ${gevallen.length} gevallen`);
console.log("fouten/ontbrekend:", gevallen.filter(g => /^__(fout|ontbreekt)/.test(g.uitkomst)).map(g => g.fn + " " + g.uitkomst.slice(0, 60)));
