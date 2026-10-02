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
