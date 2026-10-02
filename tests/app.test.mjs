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
  const kaart = await page.evaluate(() => [...document.querySelectorAll("#dayBody .kaartje")].map(k => k.textContent).find(x => /déclaration|التصريح/i.test(x)));
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

test("Borg op maat: één tik past de borg aan, vaste klant krijgt ★", async () => {
  const { page, fouten } = await B.open({ taal: "fr" });
  await page.evaluate(() => { openNew(); const c = CARS.find(x => x.model === "Dacia Logan"); $("nwCar").value = c.id; $("nwCar").dispatchEvent(new Event("change")); tekenAutoTegels(); });
  let knoppen = await page.evaluate(() => [...document.querySelectorAll("#nwBorgen button")].map(b => b.textContent.replace(/\s/g, " ")));
  assert.deepEqual(knoppen.map(k => k.replace(/[\u2066-\u2069]/g, "")), ["1 500", "3 000", "4 500"]);
  await page.evaluate(() => [...document.querySelectorAll("#nwBorgen button")][0].click());
  assert.equal(await page.evaluate(() => $("nwCaution").value), "1500");
  assert.match(await page.evaluate(() => $("nwSom").textContent), /Caution 1\s500 DH/);
  /* vaste klant (2 eerdere verhuren op tijd, geen schade): korting met ster */
  await page.evaluate(() => { const k = CLIENTS.find(x => x.name === "EL AMRANI SANAE"); $("nwClient").value = k.id; $("nwClient").dispatchEvent(new Event("change")); });
  knoppen = await page.evaluate(() => [...document.querySelectorAll("#nwBorgen button")].map(b => b.textContent));
  assert.ok(knoppen.some(k => k.includes("★")), "ster bij vaste klant: " + knoppen);
  await page.evaluate(() => document.getElementById("nwBorgen").scrollIntoView({ block: "center" }));
  await B.foto(page, "fr-borg-op-maat");
  assert.deepEqual(fouten, []);
  await page.close();
});

for (const taal of ["fr", "ar"]) test(`Winst per auto in het wagenpark en vertrouwenspagina via Meer (${taal})`, async () => {
  const { page, fouten } = await B.open({ taal });
  await page.evaluate(() => { view = "vFleet"; render(); });
  const regels = await page.evaluate(() => [...document.querySelectorAll("#flBody .job")].map(j => [j.querySelector("b").textContent, j.querySelector(".winst")?.textContent || ""]));
  const clio = regels.find(r => r[0] === "Renault Clio")[1].replace(/[⁦-⁩]/g, "");
  assert.match(clio, /\+2[\s.]800 DH/, "Clio: 2 x 1400 binnen, geen kosten → " + clio);
  const logan = regels.find(r => r[0] === "Dacia Logan")[1].replace(/[⁦-⁩]/g, "");
  assert.match(logan, /-150 DH/, "Logan: 750 binnen, 900 onderhoud → " + logan);
  await B.foto(page, taal + "-wagenpark-winst");
  await page.evaluate(() => { view = "vDay"; render(); openMeer(); });
  await page.click("#meerTrust");
  assert.ok(await page.evaluate(() => !document.getElementById("vTrust").hidden));
  await B.foto(page, taal + "-vertrouwen");
  assert.deepEqual(fouten, []);
  await page.close();
});

for (const taal of ["fr", "ar"]) test(`Vandaag (${taal}): ochtendstrook, werk eerst, papieren als één regel onderaan`, async () => {
  const { page, fouten } = await B.open({ taal });
  const st = await page.evaluate(() => {
    const kids = [...document.getElementById("dayBody").children];
    const strook = [...document.querySelectorAll(".strook b")].map(b => b.textContent.replace(/[⁦-⁩]/g, "").replace(/\s/g, " "));
    return { eerste: kids[0].className, strook,
      alertsBoven: kids.filter(k => k.className === "alerts" && !k.closest(".onderaan") && !k.hidden).length,
      voet: [...document.querySelectorAll(".onderaan .voetregel")].map(v => v.textContent),
      lijstVerborgen: document.querySelector(".onderaan .alerts")?.hidden };
  });
  assert.equal(st.eerste, "strook");
  assert.equal(st.strook[1].replace(/[.\s]/g, ""), "6000DH", "borg in handen");
  assert.equal(st.strook[2], "2/4", "auto's vrij");
  const libres = await page.evaluate(() => [...document.querySelectorAll(".vrijlijst button")].map(b => b.textContent));
  assert.ok(!libres.includes("Dacia Duster"), "te late auto (nog niet terug) is niet vrij: " + libres);
  assert.equal(st.alertsBoven, 0, "geen papieren bovenaan (niets verlopen)");
  assert.equal(st.voet.length, 2, "papieren + aanmelden onderaan: " + st.voet);
  assert.equal(st.lijstVerborgen, true);
  await page.evaluate(() => document.querySelector(".onderaan .voetregel").click());
  assert.equal(await page.evaluate(() => document.querySelector(".onderaan .alerts").hidden), false, "klapt open");
  await page.evaluate(() => { document.querySelector(".onderaan .voetregel").click(); window.scrollTo(0, 0); });
  await B.foto(page, taal + "-vandaag");
  await page.evaluate(() => document.querySelector(".strook button").click());
  assert.equal(await page.evaluate(() => view), "vCash");
  assert.deepEqual(fouten, []);
  await page.close();
});

test("Terug: contract maken → Photos et dommages → terug = Contrat prêt → terug = Vandaag", async () => {
  const { page, fouten } = await B.open({ taal: "fr" });
  const wacht = (ms = 350) => new Promise(r => setTimeout(r, ms));
  const v = () => page.evaluate(() => view);
  await page.evaluate(() => { pdfFromSheet = async () => {}; });
  await page.click("#newRental"); await wacht();
  await page.evaluate(() => { const i = document.getElementById("snelCam"); if (i) i.value = ""; });
  assert.equal(await v(), "vNew");
  await page.type("#nwName", "KLANT TEST");
  await page.evaluate(() => [...document.querySelectorAll("#nwCarTegels .tegel")].find(b => /Renault Clio/.test(b.textContent)).click());
  await page.click("#bGo"); await wacht(800);
  assert.equal(await v(), "vDone", "na Établir le contrat");
  await page.evaluate(() => [...document.querySelectorAll("#vDone button")].find(b => /Photos et dommages/.test(b.textContent)).click()); await wacht();
  assert.equal(await v(), "vForm");
  await page.click("#bBack"); await wacht();
  assert.equal(await v(), "vDone", "Retour in de app → terug naar Contrat prêt");
  await page.evaluate(() => [...document.querySelectorAll("#vDone button")].find(b => /Photos et dommages/.test(b.textContent)).click()); await wacht();
  await page.goBack(); await wacht();
  assert.equal(await v(), "vDone", "terugknop telefoon → Contrat prêt");
  await page.goBack(); await wacht();
  assert.equal(await v(), "vDay", "nog eens terug → Vandaag, niet het oude formulier");
  assert.deepEqual(fouten, []);
  await page.close();
});

test("Vandaag: één knop per kaart; tik op de kaart = contract", async () => {
  const { page, fouten } = await B.open({ taal: "fr" });
  const kaarten = await page.evaluate(() => [...document.querySelectorAll("#dayBody .kaartje")].map(k => k.querySelectorAll(".knoppen .btn").length));
  assert.ok(kaarten.length >= 3 && kaarten.every(n => n === 1), "één knop per kaart: " + kaarten);
  await page.evaluate(() => [...document.querySelectorAll("#dayBody .kaartje")].find(k => /Dacia Logan/.test(k.textContent)).querySelector(".kaartkop").click());
  assert.equal(await page.evaluate(() => view), "vDone");
  assert.deepEqual(fouten, []);
  await page.close();
});
