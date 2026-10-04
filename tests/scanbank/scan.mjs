/* Elke foto door de app, zoals op een telefoon: + → foto → scanner. Per veld vergelijken. */
import * as B from "/Users/youss/Projects/xyousri-dot_atlas/tests/browser.mjs";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
const MAP = new URL("./", import.meta.url).pathname;   /* in tests/scanbank */
const waar = JSON.parse(readFileSync(MAP + "waarheid.json"));
const filter = process.argv[2] ? new RegExp(process.argv[2]) : null;
const fotos = readdirSync(MAP + "fotos").filter(f => f.endsWith(".jpg") && (!filter || filter.test(f))).sort();
const VELDEN = { cin: ["name", "docNumber", "birth", "docExpiry", "nationality", "address"], lic: ["licenceNumber", "licenceIssue", "licenceExpiry", "name"], pas: ["name", "docNumber", "birth", "docExpiry", "nationality"] };
const norm = (k, v) => String(v || "").toUpperCase().replace(/\s+/g, " ").trim();
const uit = [];
await B.start();
let nr = 0;
for (const f of fotos) {
  if (nr && nr % 10 === 0) { await B.stop(); await B.start(); }
  nr++;
  try {
  const doc = f.replace(/-(goed|scheef|ver|donker|staand)\.jpg$/, ""), soort = doc.slice(0, 3), variant = f.match(/-(\w+)\.jpg$/)[1];
  const { page, fouten } = await B.open({ taal: "fr", gegevens: { "settings/agency": { name: "Test", city: "Rabat", init: "T" }, "vehicles/a1": { model: "Dacia Logan", plateNum: "1", plateReg: "1", rate: 250, caution: 2500, km: 1 } } });
  const t0 = Date.now();
  await page.click("#heldNieuw"); await new Promise(r => setTimeout(r, 300));
  const input = await page.$("#snelKies"); await input.uploadFile(MAP + "fotos/" + f);
  let klaar = false;
  try { await page.waitForFunction(() => window.SNELBEZIG === null && document.getElementById("nwScanStat") && !/bezig/.test(document.getElementById("nwScanStat").className) && !document.getElementById("nwScanStat").hidden, { timeout: 150000, polling: 500 }); klaar = true; } catch (e) {}
  const gelezen = await page.evaluate(() => Object.assign({}, window.SNELKLANT || {}, { nameScherm: document.getElementById("nwName").value, twijfel: [...document.querySelectorAll("#nwControle .ctl-rij")].filter(r => r.dataset.s !== "ok").map(r => r.querySelector("input").dataset.veld).join(","), stat: document.getElementById("nwScanStat").textContent }));
  const w = waar[doc], velden = VELDEN[soort], score = {};
  for (const v of velden) { const g = v === "name" ? (gelezen.name || gelezen.nameScherm) : gelezen[v]; score[v] = !w[v] ? "-" : (norm(v, g) === norm(v, w[v]) ? "OK" : (g ? "FOUT(" + g + ")" : "leeg")); }
  const regel = { twijfel: gelezen.twijfel, foto: f, doc, variant, sec: Math.round((Date.now() - t0) / 1000), klaar, score, stat: gelezen.stat.slice(0, 120), fouten };
  uit.push(regel); console.log(f.padEnd(26), String(regel.sec).padStart(3) + "s", Object.entries(score).map(([k, v]) => k + ":" + v).join("  "), gelezen.twijfel ? " [twijfel: " + gelezen.twijfel + "]" : "");
  await page.close();
  } catch (e) { console.log(f.padEnd(26), "BROWSERFOUT, opnieuw met verse browser:", String(e.message).slice(0, 60)); uit.push({ foto: f, browserfout: true }); await B.stop().catch(() => {}); await B.start(); }
  writeFileSync(MAP + "uitslag" + (process.argv[3] || "") + ".json", JSON.stringify(uit, null, 1));
}
await B.stop();
