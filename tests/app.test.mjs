/* De app in een echte browser: opent zonder fouten, in elke taal, op elk hoofdscherm. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import * as B from "./browser.mjs";

before(B.start);
after(B.stop);

const SCHERMEN = ["vDay", "vPlan", "vClients", "vFleet", "vLed", "vCash", "vSet"];

for (const taal of ["fr", "nl"]) {
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
