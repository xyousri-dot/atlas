/* De app in een echte browser: opent zonder fouten, in elke taal, op elk hoofdscherm. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import * as B from "./browser.mjs";

before(B.start);
after(B.stop);

const SCHERMEN = ["vDay", "vPlan", "vClients", "vFleet", "vLed", "vCash", "vSet"];

for (const taal of ["fr", "nl", "ar"]) {
  test(`app opent zonder fouten (${taal}) en elk hoofdscherm tekent`, async () => {
    const { page, fouten } = await B.open({ taal });
    for (const v of SCHERMEN) {
      await page.evaluate(v => { view = v; render(); }, v);
      const zichtbaar = await page.evaluate(v => !document.getElementById(v).hidden, v);
      assert.ok(zichtbaar, v + " zichtbaar");
    }
    await page.evaluate(() => { view = "vDay"; render(); });
    await B.foto(page, `${taal}-vandaag`);
    assert.deepEqual(fouten, []);
    await page.close();
  });
}

test("Nieuw contract opent het huurscherm met de scanknop", async () => {
  const { page, fouten } = await B.open({ taal: "fr" });
  await page.evaluate(() => openNew());
  const ok = await page.evaluate(() => !document.getElementById("vNew").hidden && !!document.getElementById("nwScanKaart").textContent);
  assert.ok(ok);
  await B.foto(page, "fr-nieuw");
  assert.deepEqual(fouten, []);
  await page.close();
});

test("Arabisch: hele app van rechts naar links, menu in het Arabisch", async () => {
  const { page, fouten } = await B.open({ taal: "ar" });
  const st = await page.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang,
    tabs: [...document.querySelectorAll("#tabs button")].filter(b => b.offsetParent && getComputedStyle(b).display !== "none").map(b => b.textContent),
    knop: document.querySelector("#dayBody .btn, #dayBody button")?.textContent }));
  assert.equal(st.dir, "rtl"); assert.equal(st.lang, "ar");
  assert.deepEqual(st.tabs, ["اليوم", "التخطيط", "الزبناء", "السيارات", "المزيد"]);
  for (const [v, naam] of [["vFleet", "ar-autos"], ["vLed", "ar-borgen"], ["vCash", "ar-kas"], ["vSet", "ar-instellingen"], ["vPlan", "ar-planning"]]) {
    await page.evaluate(v => { view = v; render(); }, v);
    await B.foto(page, naam);
  }
  await page.evaluate(() => openNew());
  await B.foto(page, "ar-nieuw");
  await page.evaluate(() => { view = "vDay"; render(); openMeer(); });
  await B.foto(page, "ar-meer");
  assert.deepEqual(fouten, []);
  await page.close();
});

test("Arabisch: elke tekst vertaald, behalve het contract (blijft Frans)", async () => {
  const A = await import("./atlas.mjs");
  const c = A.zandbak(A.scriptUit(A.leesHtml()));
  const gelijk = Object.keys(c.TXT.fr).filter(k => String(c.TXT.ar[k]) === String(c.TXT.fr[k]) && JSON.stringify(c.TXT.ar[k]) === JSON.stringify(c.TXT.fr[k]));
  assert.deepEqual(gelijk.sort(), ["ctr", "ctr2", "dayP"]);
});

test("Arabisch: het contract komt in het Frans (KENI-CAR) en de taal springt terug", async () => {
  const { page, fouten } = await B.open({ taal: "ar" });
  const uit = await page.evaluate(async () => {
    let html = "", taalTijdens = "";
    pdfFromSheet = async (h) => { html = h; taalTijdens = L; };
    const r = RENTALS.find(x => x.code === "AT-10001");
    await makeContract(r, document.createElement("button"));
    return { html, taalTijdens, taalNa: L, dir: document.documentElement.dir };
  });
  assert.equal(uit.taalTijdens, "fr");
  assert.equal(uit.taalNa, "ar");
  assert.equal(uit.dir, "rtl");
  for (const woord of ["Le locataire", "Le v\u00e9hicule en location", "Date de naissance", "Permis de conduire N\u00b0", "Facturation"])
    assert.ok(uit.html.includes(woord), "contract mist: " + woord);
  assert.ok(!/[\u0600-\u06FF]{3,}/.test(uit.html.replace(/<bdi>[^<]*<\/bdi>/g, "")), "Arabische tekst in het contract");
  assert.deepEqual(fouten, []);
  await page.close();
});

test("Frans: het contract is ongewijzigd t.o.v. v135", async () => {
  /* Zelfde gegevens, zelfde HTML als de referentieversie op main. */
  const { execSync } = await import("node:child_process");
  const { writeFileSync } = await import("node:fs");
  const ref = B.SCHERMEN + "../.v135.html";
  writeFileSync(ref, execSync("git show 05f63af:index.html", { cwd: (await import("./atlas.mjs")).ROOT, maxBuffer: 5e7 }));
  const maak = async () => {
    const { page } = await B.open({ taal: "fr" });
    const h = await page.evaluate(async () => {
      let html = ""; pdfFromSheet = async (x) => { html = x; };
      await makeContract(RENTALS.find(x => x.code === "AT-10004"), document.createElement("button"));
      return html;
    });
    await page.close(); return h;
  };
  const nu = await maak();
  process.env.ATLAS_HTML = ref;
  const toen = await maak();
  delete process.env.ATLAS_HTML;
  assert.ok(nu.length > 1000);
  assert.equal(nu, toen);
});

for (const taal of ["fr", "ar"]) test(`Boete (${taal}): zoeken → verklaring (Frans) → op Vandaag → verstuurd`, async () => {
  const { page, fouten } = await B.open({ taal });
  const dag = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
  await page.evaluate(() => { view = "vLed"; render(); pdfFromSheet = async (h) => { window.__pdf = h; }; });
  await page.evaluate((dag) => { qP.value = "77104"; qD.value = dag; qT.value = "14:35"; }, dag);
  await page.click("#qGo");
  await page.waitForSelector("#bvGo");
  await page.type("#bvRef", "R-2026-55871");
  await B.foto(page, taal + "-boete-zoeken");
  await page.click("#bvGo");
  await page.waitForFunction(() => !!window.__pdf);
  const pdf = await page.evaluate(() => window.__pdf);
  for (const w of ["DÉSIGNATION DU CONDUCTEUR", "BADAOUI ADNANE", "GI4599", "07/182101", "AT-10003", "R-2026-55871", "14:35", "30 jours"])
    assert.ok(pdf.includes(w), "verklaring mist: " + w);
  assert.ok(!/[؀-ۿ]{3,}/.test(pdf.replace(/<bdi>[^<]*<\/bdi>/g, "").replace(/·\s*[؀-ۿ]\s*·/g, "")), "Arabische tekst in de verklaring");
  const opgeslagen = await page.evaluate(() => RENTALS.find(r => r.code === "AT-10003").boetes);
  assert.equal(opgeslagen.length, 1); assert.equal(opgeslagen[0].ref, "R-2026-55871"); assert.equal(opgeslagen[0].verstuurd, null);
  /* Vandaag toont de termijn */
  await page.evaluate(() => { view = "vDay"; render(); });
  const kaart = await page.evaluate(() => [...document.querySelectorAll("#dayBody .kaartje")].map(k => k.textContent).find(x => /Déclaration|التصريح/.test(x)));
  assert.ok(kaart, "boetekaart op Vandaag");
  await B.foto(page, taal + "-boete-vandaag");
  /* Verstuurd: weg van Vandaag, bewaard bij de verhuur */
  await page.evaluate(() => [...document.querySelectorAll("#dayBody .kaartje button")].find(b => /Envoyée|تم الإرسال/.test(b.textContent)).click());
  await page.waitForFunction(() => RENTALS.find(r => r.code === "AT-10003").boetes[0].verstuurd);
  const nog = await page.evaluate(() => openBoetes().length);
  assert.equal(nog, 0);
  assert.equal(await page.evaluate(() => L), taal);
  assert.deepEqual(fouten, []);
  await page.close();
});

test("Betalen zonder terminal: RIB instellen → betaalverzoek via WhatsApp", async () => {
  const { page, fouten } = await B.open({ taal: "fr" });
  const open = () => page.evaluate(() => receipt(RENTALS.find(r => r.code === "AT-10003"), "depart"));
  await open();
  assert.ok(await page.$("#bzNaarInst"), "zonder RIB: knop naar Instellingen");
  /* RIB invullen in Instellingen en opslaan met de knop onderaan */
  await page.evaluate(() => { AG.extraVeld = "blijft"; view = "vSet"; render(); });
  await page.type("#stRib", "230 780 1234567890123456 78");
  await page.type("#stBank", "CIH");
  await page.click("#bGo");
  await page.waitForFunction(() => AG.rib === "230 780 1234567890123456 78");
  assert.equal(await page.evaluate(() => AG.extraVeld), "blijft", "opslaan gooit geen velden weg");
  await B.foto(page, "fr-instellingen-rib");
  await open();
  const v = await page.evaluate(() => ({ tekst: document.getElementById("bzTekst")?.textContent, wa: document.getElementById("bzWa")?.href }));
  for (const w of ["AT-10003", "230 780 1234567890123456 78", "CIH", "Atlas Kenitra", "6 250 DH"])
    assert.ok(v.tekst.includes(w), "bericht mist: " + w + " in " + v.tekst);
  assert.ok(v.wa.startsWith("https://wa.me/212600000001?text="));
  /* Ook direct onder "Le client a-t-il payé ?", zonder submenu */
  const kort = await page.evaluate(() => document.getElementById("bzWaKort")?.href);
  assert.equal(kort, v.wa);
  await page.evaluate(() => document.getElementById("bzWaKort").scrollIntoView({ block: "center" }));
  await B.foto(page, "fr-betaalverzoek");
  /* Na het verzoek boekt "Location reçue" als overschrijving */
  await page.evaluate(() => { const a = document.getElementById("bzWaKort"); a.removeAttribute("href"); a.click(); });
  await page.waitForFunction(() => RENTALS.find(r => r.code === "AT-10003").betaalVerzoek);
  await open();
  await page.evaluate(() => [...document.querySelectorAll(".betaald button")].find(b => /Location re/.test(b.textContent)).click());
  await page.waitForFunction(() => RENTALS.find(r => r.code === "AT-10003").payments.length === 2);
  assert.equal(await page.evaluate(() => RENTALS.find(r => r.code === "AT-10003").payments[1].method), "transfer");
  assert.deepEqual(fouten, []);
  await page.close();
});
