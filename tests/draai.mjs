/* Draait alle scanner-gevallen tegen een gegeven index.html en geeft de uitkomsten. */
import * as A from "./atlas.mjs";
import { GEVALLEN } from "./gevallen.mjs";

export function vast(v) {
  return JSON.stringify(v, (k, x) =>
    x === undefined ? "__undefined__" :
    typeof x === "number" && !Number.isFinite(x) ? "__" + String(x) + "__" :
    typeof x === "function" ? "__functie__" : x);
}
export async function uitkomsten(html) {
  const src = A.scriptUit(html);
  const uit = [];
  for (const [fn, ...args] of GEVALLEN) {
    const ctx = A.zandbak(src);   /* elk geval in een schone app: geen gedeelde toestand */
    let r;
    if (typeof ctx[fn] !== "function") r = "__ontbreekt__";
    else {
      try { r = await ctx[fn](...JSON.parse(JSON.stringify(args))); r = vast(r); }
      catch (e) { r = "__fout__ " + String(e && e.message); }
    }
    uit.push({ fn, args: vast(args), uitkomst: r });
  }
  return uit;
}
