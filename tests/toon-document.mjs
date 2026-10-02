/* Hulpje: maakt een afbeelding van een document zoals het in de PDF komt.
   Gebruik: node toon-document.mjs <taal> <naam> '<js die window.__pdf vult>' */
import * as B from "./browser.mjs";
const [taal, naam, code] = process.argv.slice(2);
await B.start();
const { page } = await B.open({ taal, breed: 794, hoog: 1123 });
await page.evaluate(() => { pdfFromSheet = async (h) => { window.__pdf = h; }; });
await page.evaluate(code);
await page.waitForFunction(() => !!window.__pdf);
/* Alleen het blad tonen: de rest van de app weg. */
await page.evaluate(() => { const s = document.getElementById("sheet"); s.innerHTML = window.__pdf; s.dir = "ltr";
  [...document.body.children].forEach(x => { if (x !== s) x.style.display = "none"; });
  s.style.cssText = "position:static;left:0"; document.body.style.cssText = "margin:0;padding:0;background:#fff"; window.scrollTo(0, 0); });
await page.screenshot({ path: B.SCHERMEN + naam + ".png", fullPage: true });
await B.stop();
