/* Echte browser (headless Chrome) met de app en verzonnen testgegevens. */
import { createServer } from "node:http";
import { readFileSync, mkdirSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { ROOT } from "./atlas.mjs";

export const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const SCHERMEN = new URL("./schermen/", import.meta.url).pathname;
mkdirSync(SCHERMEN, { recursive: true });

const d = n => { const t = new Date(); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const nu = () => new Date().toISOString();

/* Verzonnen zaak, geen echte klanten. */
export function testgegevens() {
  const L = {};
  L["settings/agency"] = { name: "Atlas Kenitra", city: "Kenitra", init: "AK", caution: 3000, window: 30, promise: true, loyal: true };
  const autos = [
    ["c1", "Dacia Logan", "12345", "أ", "6", 250, 3000],
    ["c2", "Hyundai i10", "88221", "ب", "1", 200, 2500],
    ["c3", "Renault Clio", "45678", "د", "2", 280, 3000],
    ["c4", "Dacia Duster", "77104", "أ", "5", 450, 5000],
  ];
  for (const [id, model, n, l, r, rate, caution] of autos)
    L["vehicles/" + id] = { model, plateNum: n, plateLtr: l, plateReg: r, km: 40000, rate, caution,
      insuranceUntil: d(200), inspectionUntil: d(20), vignetteUntil: d(120), purchasePrice: 140000, purchaseDate: d(-400), loanMonthly: 2900, loanMonthsLeft: 20 };
  L["clients/k1"] = { name: "BADAOUI ADNANE", tel: "+212 600 000 001", docType: "cin", docNumber: "GI4599", birth: "2000-07-01", licenceNumber: "07/182101", address: "HAY EL KHEIR RUE 12 KENITRA", flag: "ok", note: "", scans: {}, createdAt: nu() };
  L["clients/k2"] = { name: "EL AMRANI SANAE", tel: "+212 600 000 002", docType: "passport", docNumber: "RX1234567", flag: "ok", note: "", scans: {}, createdAt: nu() };
  const vertrek = (dag) => ({ marks: [], shots: {}, km: 40000, fuel: "100", sig: null, at: dag + "T09:30:00.000Z", snel: true });
  /* onderweg, komt vandaag terug */
  L["rentals/r1"] = { code: "AT-10001", clientId: "k1", clientName: "BADAOUI ADNANE", clientTel: "+212 600 000 001", vehicleId: "c1", from: d(-3), to: d(0), days: 3, rate: 250, total: 750, caution: 3000,
    depart: vertrek(d(-3)), retour: null, released: false, limit: d(30), payments: [{ id: "p1", amount: 750, kind: "rent", method: "cash", date: d(-3) }, { id: "p2", amount: 3000, kind: "caution", method: "cash", date: d(-3) }], createdAt: nu() };
  /* gereserveerd, vertrekt vandaag */
  L["rentals/r2"] = { code: "AT-10002", clientId: "k2", clientName: "EL AMRANI SANAE", clientTel: "+212 600 000 002", vehicleId: "c2", from: d(0), to: d(4), days: 4, rate: 200, total: 800, caution: 2500,
    depart: null, retour: null, released: false, payments: [], createdAt: nu() };
  /* te laat */
  L["rentals/r3"] = { code: "AT-10003", clientId: "k1", clientName: "BADAOUI ADNANE", clientTel: "+212 600 000 001", vehicleId: "c4", from: d(-6), to: d(-1), days: 5, rate: 450, total: 2250, caution: 5000,
    depart: vertrek(d(-6)), retour: null, released: false, limit: d(29), payments: [{ id: "p3", amount: 1000, kind: "rent", method: "cash", date: d(-6) }], createdAt: nu() };
  /* teruggebracht, borg nog vast */
  L["rentals/r4"] = { code: "AT-10004", clientId: "k2", clientName: "EL AMRANI SANAE", clientTel: "+212 600 000 002", vehicleId: "c3", from: d(-20), to: d(-15), days: 5, rate: 280, total: 1400, caution: 3000,
    depart: vertrek(d(-20)), retour: { marks: [], shots: {}, km: 40800, fuel: "100", sig: null, at: d(-15) + "T18:00:00.000Z" }, released: false, limit: d(15),
    payments: [{ id: "p4", amount: 1400, kind: "rent", method: "card", date: d(-20) }, { id: "p5", amount: 3000, kind: "caution", method: "cash", date: d(-20) }], createdAt: nu() };
  /* afgerond, borg terug na 2 dagen: voor de vertrouwenscijfers */
  L["rentals/r5"] = { code: "AT-10005", clientId: "k1", clientName: "BADAOUI ADNANE", clientTel: "+212 600 000 001", vehicleId: "c3", from: d(-40), to: d(-35), days: 5, rate: 280, total: 1400, caution: 3000,
    depart: vertrek(d(-40)), retour: { marks: [], shots: {}, km: 39500, fuel: "100", sig: null, at: d(-35) + "T18:00:00.000Z" }, released: true, releasedAt: d(-33), cautionReturned: 3000, limit: d(-5),
    payments: [{ id: "p6", amount: 1400, kind: "rent", method: "cash", date: d(-40) }, { id: "p7", amount: 3000, kind: "caution", method: "cash", date: d(-40) }], createdAt: nu() };
  L["expenses/e1"] = { vehicleId: "c1", cat: "service", amount: 900, date: d(-60), note: "vidange" };
  return L;
}

let server, browser, poort;
export async function start() {
  server = createServer((req, res) => {
    const pad = decodeURIComponent(req.url.split("?")[0]);
    if (pad === "/" || pad === "/index.html") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(readFileSync(process.env.ATLAS_HTML || ROOT + "index.html")); return; }
    res.writeHead(404); res.end();
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  poort = server.address().port;
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--lang=fr-FR"] });
}
export async function stop() { await browser?.close(); await new Promise(r => server ? server.close(r) : r()); }

/* Opent de app in een telefoonvenster. Geeft pagina + lijst met JS-fouten. */
export async function open({ taal = "fr", gegevens = testgegevens(), breed = 390, hoog = 844 } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: breed, height: hoog, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const fouten = [];
  page.on("pageerror", e => fouten.push(String(e.message || e)));
  page.on("console", m => { if (m.type() === "error" && !/fonts\.g|cdnjs|Failed to load resource/.test(m.text())) fouten.push(m.text()); });
  /* Geen netwerk naar Supabase in tests: aanmelden staat uit, dus er gaat niets heen. */
  await page.evaluateOnNewDocument((taal, gegevens) => {
    localStorage.setItem("atlas-lang", taal);
    localStorage.setItem("atlas-local-2", JSON.stringify(gegevens));
  }, taal, gegevens);
  await page.goto(`http://127.0.0.1:${poort}/`, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForFunction(() => document.getElementById("dayBody")?.children.length > 0, { timeout: 10000 });
  return { page, fouten };
}
export const foto = (page, naam) => page.screenshot({ path: SCHERMEN + naam + ".png", fullPage: false });
