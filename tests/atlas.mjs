/* Hulpjes voor de tests: index.html lezen, het script ontleden en de
   onderdelen vinden die NIET mogen veranderen (scanner, cloud, contract). */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import * as acorn from "acorn";

export const ROOT = new URL("..", import.meta.url).pathname;

export function leesHtml(pad = process.env.ATLAS_HTML || ROOT + "index.html") { return readFileSync(pad, "utf8"); }

/* Het grote inline-script (het laatste <script> zonder src). */
export function scriptUit(html) {
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m, laatste = null;
  while ((m = re.exec(html))) laatste = m[1];
  if (!laatste) throw new Error("geen inline script gevonden");
  return laatste;
}

export function statements(src) {
  const ast = acorn.parse(src, { ecmaVersion: "latest", sourceType: "script", allowAwaitOutsideFunction: false });
  return ast.body.map(n => ({ node: n, src: src.slice(n.start, n.end), start: n.start }));
}

export const hash = s => createHash("sha256").update(s).digest("hex").slice(0, 16);

/* De bevroren stukken, aangeduid met de kopjes die al in de code staan.
   Alles tussen begin en einde valt eronder. */
export const BEVROREN = [
  { naam: "opslag (bestaande gegevens)", van: "/* ============ opslag ============ */", tot: "/* ============ cloudopslag ============" },
  { naam: "cloudopslag (Supabase, bestaande gegevens)", van: "/* ============ cloudopslag ============", tot: "/* ============ state ============ */" },
  { naam: "scanner: velden, MRZ, beeld, lezers, camera, rijbewijs", van: "/* ============ WAT KOMT VAN DE SCANNER", tot: "/* ============ NIEUWE VERHUUR ============ */" },
  { naam: "scanner: snel contract en slimme scan (Supabase-functie)", van: "/* ============ SNEL CONTRACT", tot: "function zetKm(" },
  { naam: "scanner: bibliotheken, OCR, adres, barcode", van: "/* ============ BIBLIOTHEKEN", tot: "/* ============ SYSTEEMCHECK" },
  { naam: "contract in KENI-CAR-vorm", van: "/* ============ CONTRACT ============ */", tot: "/* ============ BETALINGEN EN KAS" },
];
/* Losse functies van de scanner buiten die blokken. */
export const BEVROREN_LOS = ["recheckScan", "kaartVoorOcr"];

function naamVan(n) {
  if (n.type === "FunctionDeclaration") return n.id.name;
  if (n.type === "VariableDeclaration") return n.declarations.map(d => d.id.name || "?").join(",");
  return n.type;
}

export function bevrorenDelen(src) {
  const st = statements(src);
  const uit = [];
  for (const b of BEVROREN) {
    const a = src.indexOf(b.van), z = src.indexOf(b.tot, a + 1);
    if (a < 0 || z < 0) throw new Error("kopje niet gevonden: " + b.naam);
    for (const s of st) if (s.start >= a && s.start < z) uit.push({ blok: b.naam, naam: naamVan(s.node), hash: hash(s.src), src: s.src });
  }
  for (const s of st) if (s.node.type === "FunctionDeclaration" && BEVROREN_LOS.includes(s.node.id.name))
    uit.push({ blok: "los", naam: s.node.id.name, hash: hash(s.src), src: s.src });
  return uit;
}

/* Alle element-id's waar code naar vraagt met $("...") of getElementById("..."). */
export function idsIn(code) {
  const ids = new Set();
  for (const m of code.matchAll(/(?:\$|getElementById)\(\s*"([A-Za-z0-9_-]+)"\s*\)/g)) ids.add(m[1]);
  return ids;
}
export function idsInHtml(html) {
  const ids = new Set();
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) ids.add(m[1]);
  return ids;
}

/* Het hele script draaien in een zandbak met nep-DOM, zodat de pure functies
   aanroepbaar zijn. Elke opdracht apart, fouten van DOM-werk worden genegeerd. */
export function zandbak(src, { taal = "fr", nu = "2026-10-02T10:00:00Z" } = {}) {
  const nep = () => new Proxy(function () {}, {
    get: (t, k) => k === Symbol.toPrimitive ? () => "" : k === "then" ? undefined : nep(),
    apply: () => nep(), construct: () => nep(), set: () => true,
  });
  const opslag = { "atlas-lang": taal };
  const VasteDatum = class extends Date {
    constructor(...a) { a.length ? super(...a) : super(nu); }
    static now() { return Date.parse(nu); }
  };
  const ctx = {
    console: { log() {}, warn() {}, error() {}, info() {} },
    document: nep(), window: {}, navigator: { userAgent: "test" }, location: { protocol: "https:" },
    history: { pushState() {}, replaceState() {}, back() {}, go() {} },
    localStorage: { getItem: k => (k in opslag ? opslag[k] : null), setItem: (k, v) => { opslag[k] = String(v); }, removeItem: k => { delete opslag[k]; } },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    MutationObserver: class { observe() {} disconnect() {} },
    URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} }, Blob: class {},
    Date: VasteDatum, Math, JSON, Promise, Intl, Array, Object, String, Number, RegExp, Error, Map, Set,
    Uint8Array, Uint8ClampedArray, Int32Array, Float32Array, Float64Array, Uint16Array, Uint32Array, Int16Array, Int8Array,
    parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent, escape, unescape,
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  ctx.scrollTo = () => {}; ctx.addEventListener = () => {}; ctx.removeEventListener = () => {};
  vm.createContext(ctx);
  /* Eerst alle functies (hoisting), daarna de rest in volgorde. */
  const st = statements(src);
  const fouten = [];
  const code = st.map(s => s.src);
  const isF = i => st[i].node.type === "FunctionDeclaration";
  const eerst = code.map((c, i) => isF(i) ? `try{ ${wrap(st[i], c)} }catch(e){ __f.push(${i}); }` : "").join("\n");
  /* De opstartroutine (async boot) laat de echte app draaien: niet nodig voor de tests. */
  const isBoot = i => /^\(async function boot\(/.test(code[i]);
  const dan = code.map((c, i) => isF(i) || isBoot(i) ? "" : `try{ ${wrap(st[i], c)} }catch(e){ __f.push(${i}); }`).join("\n");
  const prog = "\"use strict\";\n" + eerst + "\n" + dan;
  ctx.__f = fouten;
  vm.runInContext(prog, ctx, { timeout: 20000 });
  return ctx;
}
/* var/let/const in een try-blok zou lokaal worden: maak ze globaal. */
function wrap(s, c) {
  const n = s.node;
  if (n.type === "VariableDeclaration") {
    return n.declarations.map(d => {
      const naam = d.id.name;
      const init = d.init ? c.slice(d.init.start - n.start, d.init.end - n.start) : "undefined";
      return `globalThis.${naam} = (${init});`;
    }).join(" ");
  }
  if (n.type === "FunctionDeclaration") return `globalThis.${n.id.name} = ${c};`;
  return c;
}
