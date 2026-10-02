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
/* lopende (of nog wachtende) animaties; een afgelopen animatie telt niet meer mee */
const animaties = (page, sel) => page.evaluate(sel => [...document.querySelectorAll(sel)].flatMap(x => x.getAnimations().filter(a => a.playState !== "finished").map(a => a.animationName)), sel);

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

for (const taal of TALEN) test(`2. Count-up (${taal}): cijfers in de groene kop tellen op, alleen bij het openen`, async () => {
  const { page, fouten } = await B.open({ taal, beweging: true });
  const borg = () => page.evaluate(() => document.querySelectorAll(".held .strook b")[1].textContent.replace(/[⁦-⁩\s., ]/g, ""));
  /* opnieuw openen: weg en terug naar Vandaag */
  await page.evaluate(() => { view = "vFleet"; render(); view = "vDay"; render(); });
  const t0 = Date.now();
  await page.screenshot({ path: `${MAP}2-countup-${taal}-begin.png` });
  const begin = await borg();
  await wacht(Math.max(0, 260 - (Date.now() - t0)));
  const midden = await borg();
  await page.screenshot({ path: `${MAP}2-countup-${taal}-midden.png` });
  await wacht(900);
  const eind = await borg();
  await page.screenshot({ path: `${MAP}2-countup-${taal}-eind.png` });
  const getal = x => Number(x.replace(/DH/, ""));
  assert.ok(getal(begin) < 6000, "begint laag: " + begin);
  assert.ok(getal(midden) > getal(begin) && getal(midden) < 6000, "loopt op: " + midden);
  assert.equal(getal(eind), 6000, "eindigt op de waarde");
  /* verversen op hetzelfde scherm: meteen de juiste waarde */
  await page.evaluate(() => render());
  assert.equal(getal(await borg()), 6000);
  assert.deepEqual(fouten, []);
  await page.close();
});

for (const taal of TALEN) test(`3. Checklist tick (${taal}): stap klaar = groen vinkje met een pop, terug zonder pop`, async () => {
  const { page, fouten } = await B.open({ taal, beweging: true, traag: 0.2 });
  await page.click("#heldNieuw"); await wacht(300);
  await page.type("#nwName", "SAMIRA EL FASSI");
  await page.click("#bGo");
  const namen = await animaties(page, ".nwvoortgang .punt.klaar i");
  assert.deepEqual(namen, ["tickpop"], "pop op het vinkje van stap 1");
  await drieBeelden(page, `3-tick-${taal}`, [["begin", 30], ["midden", 500], ["eind", 2000]]);
  assert.equal((await animaties(page, ".nwvoortgang .punt.klaar i")).length, 0);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".nwvoortgang .punt.klaar i")).opacity), "1");
  /* terug naar stap 1 en weer vooruit... terug zelf geeft geen pop */
  await page.goBack(); await wacht(200);
  assert.equal((await animaties(page, ".nwvoortgang i")).length, 0, "terug: geen pop");
  assert.deepEqual(fouten, []);
  await page.close();
});
