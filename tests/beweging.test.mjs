/* De bewegingen: spelen af als het toestel beweging toelaat, eindigen netjes,
   geen fouten in de console, en niets als "minder beweging" aan staat.
   Per beweging drie beelden (begin, midden, eind) in tests/schermen/beweging/. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import * as B from "./browser.mjs";

before(B.start);
after(B.stop);
const MAP = B.SCHERMEN + "beweging/";
mkdirSync(MAP, { recursive: true });
const wacht = (ms) => new Promise(r => setTimeout(r, ms));
export const TALEN = ["fr", "ar", "nl"];
/* Drie beelden; de animaties lopen 5x trager zodat het midden te zien is. */
async function drieBeelden(page, naam, tijden) {
  const t0 = Date.now();
  for (const [deel, ms] of tijden) { const rest = ms - (Date.now() - t0); if (rest > 0) await wacht(rest); await page.screenshot({ path: `${MAP}${naam}-${deel}.png` }); }
}
const animaties = (page, sel) => page.evaluate(sel => [...document.querySelectorAll(sel)].flatMap(x => x.getAnimations().map(a => a.animationName)), sel);

for (const taal of TALEN) test(`1. Rise (${taal}): kaarten komen kort na elkaar binnen en eindigen zichtbaar`, async () => {
  const { page, fouten } = await B.open({ taal, beweging: true, traag: 0.2 });
  await page.evaluate(() => { view = "vFleet"; render(); });
  const namen = await animaties(page, "#vFleet .job");
  assert.ok(namen.length >= 3 && namen.every(n => n === "rise"), "rise op de autolijst: " + namen);
  const vertraging = await page.evaluate(() => [...document.querySelectorAll("#vFleet .job")].map(x => x.style.getPropertyValue("--rise-delay")));
  assert.deepEqual(vertraging.slice(0, 3), ["0s", "0.05s", "0.1s"], "stagger 0,05 s");
  await drieBeelden(page, `1-rise-${taal}`, [["begin", 40], ["midden", 900], ["eind", 3800]]);
  assert.equal((await animaties(page, "#vFleet .job")).length, 0, "klaar: geen animatie meer");
  const zicht = await page.evaluate(() => [...document.querySelectorAll("#vFleet .job")].map(x => getComputedStyle(x).opacity));
  assert.ok(zicht.every(o => o === "1"));
  /* een verversing op hetzelfde scherm speelt niet opnieuw */
  await page.evaluate(() => render());
  assert.equal((await animaties(page, "#vFleet .job")).length, 0, "geen rise bij verversen");
  assert.deepEqual(fouten, []);
  await page.close();
});

test("Minder beweging aan: geen enkele animatie", async () => {
  const { page, fouten } = await B.open({ taal: "fr", beweging: false });
  await page.evaluate(() => { view = "vFleet"; render(); });
  assert.equal((await page.evaluate(() => document.getAnimations().length)), 0);
  assert.deepEqual(fouten, []);
  await page.close();
});
