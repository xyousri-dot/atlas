/* De scanner, de Supabase-functie, de opslag en het contract mogen niet veranderen.
   Deze tests vergelijken de huidige index.html met de vastgelegde referentie (v135). */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as A from "./atlas.mjs";
import { uitkomsten } from "./draai.mjs";
import G from "./scanner-golden.json" with { type: "json" };

/* Bewust veranderd, met toestemming van Youss (3 oktober 2026). Al het andere in de
   bevroren blokken (scanner, cloud, opslag, contract) moet letterlijk gelijk blijven. */
const BEWUST = {
  snelTerug: "auto terug: borg terug = alleen wat echt ontvangen is (kas klopte niet); km niet meer vooraf ingevuld",
  nomPrenom: "contract: samengestelde achternamen (EL FASSI, BEN ALI, AIT ...) niet meer gesplitst",
  keurNaam: "scan: naam zonder ruime meerderheid niet meer leeg, maar ingevuld met twijfelvlag (controlekaart)",
  keurAlt: "scan: CIN-nummer pas zeker bij 3 gelijke lezingen, anders twijfelvlag",
  fillFromMRZ: "scan: onzeker nummer wel invullen met twijfelvlag i.p.v. leeg laten (paspoort bleef leeg)",
  adresUitRegelsRuw: "scan: regel na 'Adresse' alleen als adres als het geen strookrommel is",
  soortVanFoto: "scan: rijbewijsregel ook zoeken als de foto staand is genomen",
  adresGeloofwaardig: "scan (nieuw): controle dat een gelezen adres geen strookrommel is",
};
const html = A.leesHtml();
const src = A.scriptUit(html);

test("elke bevroren opdracht staat er nog letterlijk", () => {
  const nu = new Set(A.statements(src).map(s => A.hash(s.src)));
  const weg = G.delen.filter(d => !nu.has(d.hash) && !(d.naam in BEWUST)).map(d => `${d.blok} → ${d.naam}`);
  assert.deepEqual(weg, [], "gewijzigd of verdwenen");
});

test("er is niets bijgezet of weggehaald binnen de bevroren blokken", () => {
  const per = l => l.filter(d => !(d.naam in BEWUST)).reduce((m, d) => (m[d.blok] = [...(m[d.blok] || []), d.hash].sort(), m), {});
  assert.deepEqual(per(A.bevrorenDelen(src)), per(G.delen));
  /* de bewust veranderde functies bestaan nog, op hun plek */
  const namen = A.bevrorenDelen(src).map(d => d.naam);
  for (const n of Object.keys(BEWUST)) assert.ok(namen.includes(n), "bewust veranderd, maar weg: " + n);
});

test("elk schermelement waar de scanner aan hangt bestaat nog", () => {
  const html0 = new Set(G.ids);       /* id's die de bevroren code opvraagt */
  const nu = A.idsInHtml(html);
  const ontbreekt = [...html0].filter(id => !nu.has(id) && !new RegExp(`id\\s*=\\s*["']${id}["']|\\.id\\s*=\\s*"${id}"`).test(src));
  assert.deepEqual(ontbreekt, []);
});

test("Supabase-scanfunctie: zelfde adres", () => {
  assert.match(src, /var AIPAD="\/functions\/v1\/atlas-scan", AIFOUT="";/);
});

test("teksten die de scanner gebruikt bestaan in elke taal", () => {
  const ctx = A.zandbak(src);
  const code = A.bevrorenDelen(src).map(d => d.src).join("\n");
  const sleutels = [...new Set([...code.matchAll(/\b(?:t|T\(\))\.([A-Za-z_][A-Za-z0-9_]*)/g)].map(m => m[1]))]
    .filter(k => k in ctx.TXT.nl || k in ctx.TXT.fr);
  assert.ok(sleutels.length > 20, "te weinig scannerteksten gevonden: " + sleutels.length);
  for (const taal of Object.keys(ctx.TXT)) {
    const mist = sleutels.filter(k => ctx.TXT[taal][k] === undefined);
    assert.deepEqual(mist, [], `taal ${taal} mist scannerteksten`);
  }
});

test(`scanner geeft exact dezelfde uitkomst op ${G.gevallen.length} vaste gevallen`, async () => {
  const nu = await uitkomsten(html);
  const anders = [];
  nu.forEach((x, i) => { if (x.uitkomst !== G.gevallen[i].uitkomst) anders.push(`${x.fn}(${x.args.slice(0, 60)}): ${G.gevallen[i].uitkomst.slice(0, 80)} → ${x.uitkomst.slice(0, 80)}`); });
  assert.equal(nu.length, G.gevallen.length);
  assert.deepEqual(anders, []);
});
