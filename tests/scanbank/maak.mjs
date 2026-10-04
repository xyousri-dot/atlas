/* Voorbeeldkaarten met verzonnen personen: Marokkaanse CIN (voor/achter), Marokkaans
   rijbewijs (voor/achter), paspoorten. Strookletter OCR-B, geldige controlecijfers. */
import puppeteer from "/Users/youss/Projects/xyousri-dot_atlas/tests/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js";
import { readFileSync, writeFileSync } from "node:fs";
const MAP = new URL("./", import.meta.url).pathname;   /* in tests/scanbank */
const OCRB = readFileSync(MAP + "ocr-b-outline/opentype/ocrb10.otf").toString("base64");
const chk = s => { const w = [7, 3, 1]; let t = 0; for (let i = 0; i < s.length; i++) { const c = s[i]; t += (c >= "0" && c <= "9" ? +c : c >= "A" && c <= "Z" ? c.charCodeAt(0) - 55 : 0) * w[i % 3]; } return String(t % 10); };
const pad = (s, n) => (s + "<".repeat(n)).slice(0, n);
const ymd = d => d.slice(2, 4) + d.slice(5, 7) + d.slice(8, 10);           /* 2031-05-12 → 310512 */
const H = s => String(s).replace(/</g, "&lt;");
const dmy = d => d.slice(8, 10) + "." + d.slice(5, 7) + "." + d.slice(0, 4);
function td1(p) {
  const l1 = "IDMAR" + pad(p.kaartnr, 9) + chk(pad(p.kaartnr, 9)) + pad(p.cin, 15);
  const a = ymd(p.geb) + chk(ymd(p.geb)) + p.sex + ymd(p.tot) + chk(ymd(p.tot)) + "MAR" + "<".repeat(11);
  const comp = l1.slice(5, 30) + a.slice(0, 7) + a.slice(8, 15) + a.slice(18, 29);
  return [l1, a + chk(comp), pad(p.mrznaam, 30)];
}
function td3(p) {
  const a = pad("P<" + p.land + p.mrznaam, 44), no = pad(p.nr, 9), per = "<".repeat(14);
  const b0 = no + chk(no) + p.land + ymd(p.geb) + chk(ymd(p.geb)) + p.sex + ymd(p.tot) + chk(ymd(p.tot)) + per + "<";
  return [a, b0 + chk(no + chk(no) + ymd(p.geb) + chk(ymd(p.geb)) + ymd(p.tot) + chk(ymd(p.tot)) + per + "<")];
}
function d1(p) { const nm = pad(p.mrznaam.replace(/<<.*/, "").replace(/<$/, ""), 9).slice(0, 9); const b = "D1AMA" + p.lic.replace("/", "<") + p.lafg.slice(8, 10) + p.lafg.slice(5, 7) + p.lafg.slice(2, 4) + nm; return b + chk(b); }

export const CIN = [
  { id: "cin1", naam: "EL FASSI SAMIRA", nom: "EL FASSI", prenom: "SAMIRA", ar: "سميرة الفاسي", mrznaam: "EL<FASSI<<SAMIRA", sex: "F", geb: "1993-09-30", tot: "2031-05-12", kaartnr: "JF0123456", cin: "BK123456", stad: "RABAT", adres: "HAY RIAD RUE 4 N 12 RABAT" },
  { id: "cin2", naam: "BENNANI YOUSSEF", nom: "BENNANI", prenom: "YOUSSEF", ar: "يوسف بناني", mrznaam: "BENNANI<<YOUSSEF", sex: "M", geb: "1988-04-12", tot: "2029-11-03", kaartnr: "JK7654321", cin: "JE987654", stad: "KENITRA", adres: "LOT AL WAHDA NR 7 KENITRA" },
  { id: "cin3", naam: "AIT TALEB KARIM", nom: "AIT TALEB", prenom: "KARIM", ar: "كريم آيت الطالب", mrznaam: "AIT<TALEB<<KARIM", sex: "M", geb: "1975-01-22", tot: "2027-02-14", kaartnr: "JA1122334", cin: "G456789", stad: "MARRAKECH", adres: "DOUAR AIT OURIR MARRAKECH" },
];
export const RIJBEWIJS = [
  { id: "lic1", naam: "EL FASSI SAMIRA", nom: "EL FASSI", prenom: "SAMIRA", mrznaam: "ELFASSI<<SAMIRA", geb: "1993-09-30", stad: "RABAT", lic: "07/182101", lafg: "2015-03-15", ltot: "2035-03-14" },
  { id: "lic2", naam: "BENNANI YOUSSEF", nom: "BENNANI", prenom: "YOUSSEF", mrznaam: "BENNANI<<YOUSSEF", geb: "1988-04-12", stad: "KENITRA", lic: "12/204571", lafg: "2010-06-02", ltot: "2030-06-01" },
];
export const PASPOORT = [
  { id: "pas-mar", land: "MAR", landnaam: "ROYAUME DU MAROC", naam: "BENNANI YOUSSEF", mrznaam: "BENNANI<<YOUSSEF", nr: "QK1234567", sex: "M", geb: "1988-04-12", tot: "2030-08-19" },
  { id: "pas-fra", land: "FRA", landnaam: "RÉPUBLIQUE FRANÇAISE", naam: "MARTIN PAUL", mrznaam: "MARTIN<<PAUL", nr: "18AB12345", sex: "M", geb: "1978-03-12", tot: "2029-01-01" },
  { id: "pas-nld", land: "NLD", landnaam: "KONINKRIJK DER NEDERLANDEN", naam: "DE VRIES SARAH", mrznaam: "DE<VRIES<<SARAH", nr: "NX3K9L2P7", sex: "F", geb: "1990-07-02", tot: "2032-04-30" },
  { id: "pas-esp", land: "ESP", landnaam: "REINO DE ESPAÑA", naam: "GARCIA LOPEZ MARIA", mrznaam: "GARCIA<LOPEZ<<MARIA", nr: "PAA123456", sex: "F", geb: "1985-11-23", tot: "2028-06-15" },
  { id: "pas-bel", land: "BEL", landnaam: "ROYAUME DE BELGIQUE", naam: "PEETERS LUC", mrznaam: "PEETERS<<LUC", nr: "EH1234567", sex: "M", geb: "1969-02-05", tot: "2027-12-01" },
  { id: "pas-usa", land: "USA", landnaam: "UNITED STATES OF AMERICA", naam: "SMITH JOHN", mrznaam: "SMITH<<JOHN", nr: "545612345", sex: "M", geb: "1982-10-10", tot: "2031-03-03" },
];

const STIJL = `@font-face{font-family:OCRB;src:url(data:font/otf;base64,${OCRB})}
body{margin:0;background:#fff;font-family:Arial,Helvetica,sans-serif}
.kaart{width:856px;height:540px;border-radius:34px;position:relative;overflow:hidden;color:#1c2430}
.mrz{position:absolute;left:34px;right:34px;bottom:26px;font-family:OCRB;font-size:32px;line-height:44px;letter-spacing:1px;white-space:pre;color:#111}
.pp{width:1250px;height:880px;position:relative;overflow:hidden;color:#1c2430;background:linear-gradient(135deg,#efe6d8,#e3ecf1);border-radius:10px}
.pp .mrz{left:40px;right:40px;bottom:40px;font-size:35px;line-height:54px;letter-spacing:1px}
.foto{position:absolute;background:linear-gradient(#c9c2b8,#a69d91);border-radius:8px}
.k{font-size:15px;color:#5b6573;margin:0} .v{font-size:24px;font-weight:700;margin:0 0 10px}`;
const achtergrond = kleur => `background:radial-gradient(circle at 20% 20%,${kleur},#f4f1ea 60%),repeating-linear-gradient(45deg,rgba(0,0,0,.03) 0 2px,transparent 2px 7px)`;

function cinAchter(p) { const m = td1(p); return `<div class="kaart" style="${achtergrond("#d9ecf3")}">
 <div style="position:absolute;left:34px;top:26px;right:34px">
  <p class="k">Fils / Fille de</p><p class="v" style="font-size:20px">MOHAMED ET FATIMA</p>
  <p class="k">Adresse · العنوان</p><p class="v" style="font-size:22px">${p.adres}</p>
  <p class="k">N° état civil</p><p class="v" style="font-size:20px">123/${p.geb.slice(0, 4)}</p></div>
 <div class="mrz">${H(m.join("\n"))}</div></div>`; }
function cinVoor(p) { return `<div class="kaart" style="${achtergrond("#f3e3d3")}">
 <p style="position:absolute;left:34px;top:18px;font-weight:800;font-size:22px;margin:0">ROYAUME DU MAROC</p>
 <p style="position:absolute;right:34px;top:18px;font-weight:800;font-size:22px;margin:0">المملكة المغربية</p>
 <p style="position:absolute;left:34px;top:50px;font-size:16px;margin:0">CARTE NATIONALE D'IDENTITE</p>
 <div class="foto" style="left:34px;top:110px;width:200px;height:260px"></div>
 <div style="position:absolute;left:270px;top:105px">
  <p class="v" style="font-size:30px;margin:0">${p.prenom}</p><p class="v" style="font-size:30px">${p.nom}</p>
  <p class="v" style="font-size:24px">${p.ar}</p>
  <p class="k">Né(e) le ${dmy(p.geb)} à ${p.stad}</p>
  <p class="k" style="margin-top:8px">Valable jusqu'au ${dmy(p.tot)}</p></div>
 <p style="position:absolute;left:270px;bottom:40px;font-size:34px;font-weight:800;margin:0;letter-spacing:2px">${p.cin}</p></div>`; }
function licVoor(p) { return `<div class="kaart" style="${achtergrond("#f6d9e0")}">
 <p style="position:absolute;left:34px;top:18px;font-weight:800;font-size:22px;margin:0">ROYAUME DU MAROC · PERMIS DE CONDUIRE</p>
 <div class="foto" style="left:34px;top:80px;width:190px;height:250px"></div>
 <div style="position:absolute;left:255px;top:76px;font-size:22px;line-height:1.55;font-weight:600">
  1. ${p.nom}<br>2. ${p.prenom}<br>3. ${dmy(p.geb)} ${p.stad}<br>4a. ${dmy(p.lafg)}  4b. ${dmy(p.ltot)}<br>4c. ROYAUME DU MAROC<br>5. ${p.lic}<br>9. B</div></div>`; }
function licAchter(p) { return `<div class="kaart" style="${achtergrond("#f6d9e0")}">
 <table style="position:absolute;left:34px;top:24px;border-collapse:collapse;font-size:16px">
  <tr><th style="border:1px solid #889;padding:3px 10px">9</th><th style="border:1px solid #889;padding:3px 10px">10</th><th style="border:1px solid #889;padding:3px 10px">11</th></tr>
  <tr><td style="border:1px solid #889;padding:3px 10px">B</td><td style="border:1px solid #889;padding:3px 10px">${dmy(p.lafg)}</td><td style="border:1px solid #889;padding:3px 10px">${dmy(p.ltot)}</td></tr>
  <tr><td style="border:1px solid #889;padding:3px 10px">A1</td><td style="border:1px solid #889;padding:3px 10px">—</td><td style="border:1px solid #889;padding:3px 10px">—</td></tr></table>
 <div class="mrz" style="font-size:33px">${H(d1(p))}</div></div>`; }
function paspoort(p) { const m = td3(p); return `<div class="pp">
 <p style="position:absolute;left:40px;top:24px;font-weight:800;font-size:28px;margin:0">${p.landnaam} · PASSPORT</p>
 <div class="foto" style="left:40px;top:90px;width:300px;height:390px"></div>
 <div style="position:absolute;left:380px;top:90px;font-size:24px;line-height:1.5">
  <p class="k">Surname</p><p class="v">${p.mrznaam.split("<<")[0].replace(/</g, " ")}</p>
  <p class="k">Given names</p><p class="v">${p.mrznaam.split("<<")[1].replace(/</g, " ")}</p>
  <p class="k">Nationality · Date of birth · Sex</p><p class="v">${p.land} · ${dmy(p.geb)} · ${p.sex}</p>
  <p class="k">Date of expiry · Passport No.</p><p class="v">${dmy(p.tot)} · ${p.nr}</p></div>
 <div class="mrz">${H(m.join("\n"))}</div></div>`; }

const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const page = await b.newPage(); await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 2 });
async function render(naam, html) {
  await page.setContent(`<!doctype html><meta charset=utf-8><style>${STIJL}</style>${html}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const el = await page.$("body > div"); await el.screenshot({ path: MAP + "png/" + naam + ".png", omitBackground: true });
}
const waarheid = {};
for (const p of CIN) { await render(p.id + "-achter", cinAchter(p)); await render(p.id + "-voor", cinVoor(p));
  waarheid[p.id] = { name: p.naam, docType: "cin", docNumber: p.cin, birth: p.geb, docExpiry: p.tot, nationality: "MAR", address: p.adres, mrz: td1(p) }; }
for (const p of RIJBEWIJS) { await render(p.id + "-achter", licAchter(p)); await render(p.id + "-voor", licVoor(p));
  waarheid[p.id] = { name: p.naam, licenceNumber: p.lic, licenceIssue: p.lafg, licenceExpiry: p.ltot, d1: d1(p) }; }
for (const p of PASPOORT) { await render(p.id, paspoort(p));
  waarheid[p.id] = { name: p.naam, docType: "passport", docNumber: p.nr, birth: p.geb, docExpiry: p.tot, nationality: p.land, mrz: td3(p) }; }
writeFileSync(MAP + "waarheid.json", JSON.stringify(waarheid, null, 1));
await b.close();
console.log("kaarten:", Object.keys(waarheid).length);

/* controle: past elke strookregel binnen de kaart? */
