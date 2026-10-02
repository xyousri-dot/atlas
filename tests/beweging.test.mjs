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

for (const taal of TALEN) test(`4. Pop (${taal}): hoofdknop wordt kleiner bij indrukken en veert terug`, async () => {
  const { page, fouten } = await B.open({ taal, beweging: true, traag: 0.2 });
  /* de knop mag hier niets openen: we kijken alleen naar de beweging */
  await page.evaluate(() => { $("newRental").click = function () {}; });
  await wacht(2500);
  const knop = await page.$("#heldNieuw"); const box = await knop.boundingBox();
  const schaal = () => page.evaluate(() => { const m = getComputedStyle(document.getElementById("heldNieuw")).transform; return m === "none" ? 1 : Number(m.match(/matrix\(([^,]+)/)[1]); });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await wacht(700);
  await page.screenshot({ path: `${MAP}4-pop-${taal}-begin.png`, clip: { x: 0, y: box.y - 40, width: 390, height: box.height + 80 } });
  const ingedrukt = await schaal();
  await page.mouse.up(); await wacht(350);
  const tussen = await schaal();
  await page.screenshot({ path: `${MAP}4-pop-${taal}-midden.png`, clip: { x: 0, y: box.y - 40, width: 390, height: box.height + 80 } });
  await wacht(2000);
  const los = await schaal();
  await page.screenshot({ path: `${MAP}4-pop-${taal}-eind.png`, clip: { x: 0, y: box.y - 40, width: 390, height: box.height + 80 } });
  assert.ok(Math.abs(ingedrukt - 0.96) < 0.005, "ingedrukt 0,96: " + ingedrukt);
  assert.ok(tussen > 0.96, "veert terug: " + tussen);
  assert.equal(los, 1, "eindigt op 1");
  assert.deepEqual(fouten, []);
  await page.close();
});

const verschuiving = (page, sel) => page.evaluate(sel => { const m = new DOMMatrix(getComputedStyle(document.querySelector(sel)).transform); return m.m41; }, sel);
for (const taal of TALEN) test(`5. Slide-in (${taal}): nieuw scherm van ${taal === "ar" ? "links" : "rechts"}, terug van de andere kant; ook per stap`, async () => {
  const { page, fouten } = await B.open({ taal, beweging: true, traag: 0.2 });
  await wacht(2500);
  const teken = taal === "ar" ? -1 : 1;
  await page.evaluate(() => { view = "vFleet"; render(); });
  await wacht(40);
  const vooruit = await verschuiving(page, "#vFleet");
  await page.screenshot({ path: `${MAP}5-slide-${taal}-begin.png` });
  await wacht(500); await page.screenshot({ path: `${MAP}5-slide-${taal}-midden.png` });
  await wacht(1800); await page.screenshot({ path: `${MAP}5-slide-${taal}-eind.png` });
  assert.ok(vooruit * teken > 5, "vooruit komt van " + (teken > 0 ? "rechts" : "links") + ": " + vooruit);
  assert.equal(await verschuiving(page, "#vFleet"), 0, "eindigt op zijn plek");
  await page.goBack(); await wacht(40);
  const terug = await verschuiving(page, "#vDay");
  assert.ok(terug * teken < -5, "terug komt van de andere kant: " + terug);
  await wacht(2200);
  /* stap voor stap in een nieuw contract */
  await page.click("#heldNieuw"); await wacht(2400);
  await page.type("#nwName", "TEST"); await page.click("#bGo"); await wacht(40);
  const stap = await page.evaluate(() => document.querySelectorAll("#vNew section.vstap")[1].getAnimations().map(a => a.animationName));
  assert.deepEqual(stap, ["slideIn"], "stap 2 schuift binnen");
  assert.deepEqual(fouten, []);
  await page.close();
});

const vullingen = page => page.evaluate(() => document.getAnimations().filter(a => a.animationName === "vul" && a.playState !== "finished").length);
for (const taal of TALEN) test(`6. Bar fill (${taal}): het stuk dat groen wordt vult zich, bij contract en bij vertrek`, async () => {
  const { page, fouten } = await B.open({ taal, beweging: true, traag: 0.2 });
  await wacht(2500);
  /* nieuw contract: stap 1 → 2 */
  await page.click("#heldNieuw"); await wacht(2400);
  await page.type("#nwName", "TEST"); await page.click("#bGo"); await wacht(30);
  assert.equal(await vullingen(page), 1, "contract: één stuk vult zich");
  await page.screenshot({ path: `${MAP}6-vul-${taal}-begin.png`, clip: { x: 0, y: 0, width: 390, height: 180 } });
  await wacht(700); await page.screenshot({ path: `${MAP}6-vul-${taal}-midden.png`, clip: { x: 0, y: 0, width: 390, height: 180 } });
  await wacht(1800); await page.screenshot({ path: `${MAP}6-vul-${taal}-eind.png`, clip: { x: 0, y: 0, width: 390, height: 180 } });
  assert.equal(await vullingen(page), 0, "klaar");
  /* vertrek: stap 1 bevestigen en verder */
  await page.evaluate(() => openForm(RENTALS.find(r => r.code === "AT-10002"), "depart")); await wacht(2500);
  assert.equal(await vullingen(page), 0, "openen vult niets");
  await page.evaluate(() => document.querySelectorAll("#vForm .confirm")[0].click()); await wacht(100);
  await page.click("#bGo"); await wacht(30);
  assert.ok(await vullingen(page) >= 1, "vertrek: volgend stuk vult zich");
  await wacht(2500);
  /* gewoon verversen (bv. km typen) vult niets opnieuw */
  await page.evaluate(() => refresh()); await wacht(30);
  assert.equal(await vullingen(page), 0, "verversen vult niets opnieuw");
  assert.deepEqual(fouten, []);
  await page.close();
});

for (const taal of TALEN) test(`7. Blur-in (${taal}): contract klaar komt van wazig naar scherp, vinkje als laatste`, async () => {
  const { page, fouten } = await B.open({ taal, beweging: true, traag: 0.2 });
  await page.evaluate(() => { pdfFromSheet = async () => {}; });
  await wacht(2500);
  await page.click("#heldNieuw"); await wacht(2400);
  await page.type("#nwName", "KLANT TEST"); await page.click("#bGo"); await wacht(2400);
  await page.evaluate(() => [...document.querySelectorAll("#nwCarTegels .tegel")].find(b => /Renault Clio/.test(b.textContent)).click()); await wacht(2600);
  await page.click("#bGo"); await wacht(60);
  assert.equal(await page.evaluate(() => view), "vDone");
  const anim = await page.evaluate(() => document.getAnimations().filter(a => ["blurIn", "tickpop"].includes(a.animationName)).map(a => ({ n: a.animationName, delay: a.effect.getTiming().delay, pseudo: a.effect.pseudoElement || "" })));
  const blur = anim.find(a => a.n === "blurIn"), vink = anim.find(a => a.n === "tickpop" && a.pseudo === "::before");
  assert.ok(blur, "blur-in op het klaar-scherm");
  assert.ok(vink && vink.delay >= 300, "vinkje start pas na de blur: " + JSON.stringify(vink));
  const wazig = await page.evaluate(() => getComputedStyle(document.getElementById("vDone")).filter);
  assert.match(wazig, /blur\((?!0px)/, "begint wazig: " + wazig);
  await page.screenshot({ path: `${MAP}7-blur-${taal}-begin.png` });
  await wacht(1500); await page.screenshot({ path: `${MAP}7-blur-${taal}-midden.png` });
  await wacht(2400); await page.screenshot({ path: `${MAP}7-blur-${taal}-eind.png` });
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("vDone")).filter), "none", "eindigt scherp");
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("vDone")).opacity), "1");
  assert.deepEqual(fouten, []);
  await page.close();
});
