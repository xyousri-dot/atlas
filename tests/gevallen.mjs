/* Vaste invoer voor de scanner. Elke regel: [functie, ...argumenten].
   De uitkomst op main (v135) is vastgelegd in scanner-golden.json; de herbouw
   moet exact hetzelfde teruggeven. Geen echte klantgegevens: alles is verzonnen. */

/* ICAO-controlecijfer, los van de app berekend, om geldige stroken te maken. */
function chk(s) {
  const w = [7, 3, 1]; let t = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const v = c >= "0" && c <= "9" ? +c : c >= "A" && c <= "Z" ? c.charCodeAt(0) - 55 : 0;
    t += v * w[i % 3];
  }
  return String(t % 10);
}
const pad = (s, n) => (s + "<".repeat(n)).slice(0, n);

/* TD1 — Marokkaanse CNIE, 3 regels van 30 */
function td1({ nr = "AB1234567", alt = "GI4599", geb = "000701", sex = "M", vv = "300810", nat = "MAR", naam = "BADAOUI<<ADNANE" } = {}) {
  const l1 = "IDMAR" + pad(nr, 9) + chk(pad(nr, 9)) + pad(alt, 15);
  const l2a = geb + chk(geb) + sex + vv + chk(vv) + nat + "<".repeat(11);
  const comp = l1.slice(5, 30) + l2a.slice(0, 7) + l2a.slice(8, 15) + l2a.slice(18, 29);
  return [l1, l2a + chk(comp), pad(naam, 30)].join("\n");
}
/* TD3 — paspoort, 2 regels van 44 */
function td3({ nr = "RX1234567", nat = "MAR", geb = "851224", sex = "F", vv = "310105", naam = "EL<AMRANI<<SANAE" } = {}) {
  const a = pad("P<" + nat + naam, 44);
  const no = pad(nr, 9), per = "<".repeat(14);
  const b = no + chk(no) + nat + geb + chk(geb) + sex + vv + chk(vv) + per + "<";
  return a + "\n" + b + chk(no + chk(no) + geb + chk(geb) + vv + chk(vv) + per + "<");
}
/* TD2 — 2 regels van 36 */
function td2({ nr = "X4RTBPFW4", nat = "FRA", geb = "780312", sex = "M", vv = "290101", naam = "MARTIN<<PAUL" } = {}) {
  const a = pad("I<" + nat + naam, 36);
  const b0 = pad(nr, 9) + chk(pad(nr, 9)) + nat + geb + chk(geb) + sex + vv + chk(vv) + "<<<<<<<";
  return a + "\n" + b0 + chk(b0.slice(0, 10) + b0.slice(13, 20) + b0.slice(21, 35));
}
/* D1-regel achterop het Marokkaanse rijbewijs (30 tekens) */
function d1({ kop = "D1AMA", nr = "07<182101", dat = "150319", naam = "BADAOUI<A" } = {}) {
  const body = kop + nr + dat + pad(naam, 9);
  return body + chk(body);
}

const TD1 = td1(), TD3 = td3(), TD2 = td2(), D1 = d1();
/* Regels zoals de lezer ze geeft (zelfde vorm als plakRegels in de app). */
const R = (t, score = 0.95) => t.split("\n").map(r => ({ tekst: r.toUpperCase().replace(/\s+/g, " ").trim(), score })).filter(r => r.tekst.length > 1);
const kapot = (s, i, c) => s.slice(0, i) + c + s.slice(i + 1);

const CIN_VOOR = `ROYAUME DU MAROC
CARTE NATIONALE D'IDENTITE
BADAOUI
ADNANE
Né le 01.07.2000
à KENITRA
Valable jusqu'au 10.08.2030
GI4599`;
const CIN_ACHTER = `Fils de MOHAMED
et de FATIMA
Adresse HAY EL KHEIR RUE 12 N 45 KENITRA
N° etat civil 123/2000
${TD1}`;
const PERMIS_VOOR = `ROYAUME DU MAROC
PERMIS DE CONDUIRE
1. BADAOUI
2. ADNANE
3. 01.07.2000 KENITRA
4a. 15.03.2019
4b. 15.03.2029
5. 07/182101
9. B`;
const PERMIS_ACHTER = `B 15.03.2019 15.03.2029
A1
${D1}`;
const PASPOORT = `PASSEPORT
ROYAUME DU MAROC
EL AMRANI
SANAE
${TD3}`;
const ADRESSEN = [
  "Adresse HAY EL KHEIR RUE 12 N 45 KENITRA",
  "ADRESSE: 23 RUE IBN SINA APPT 4 RABAT",
  "العنوان Adresse LOT AL WAHDA NR 7 SALE",
  "Adrese HAY SALAM BLOC C N 12 CASABLANCA",
  "",
  "1234567890",
];

export const GEVALLEN = [
  ["mrzCheck", "AB1234567"], ["mrzCheck", "000701"], ["mrzCheck", "abc"], ["mrzCheck", "<<<<"],
  ["mrzOk", "AB1234567", chk("AB1234567")], ["mrzOk", "AB1234567", "<"], ["mrzOk", "<<<<", "<", true], ["mrzOk", "123", "X"],
  ["mrzDate", "000701", false], ["mrzDate", "300810", true], ["mrzDate", "991301", false], ["mrzDate", "12345", false], ["mrzDate", "850229", false],
  ["mrzName", "BADAOUI<<ADNANE<<<<<<<<"], ["mrzName", "EL<AMRANI<<SANAE<FATIMA"], ["mrzName", ""],
  ["nameTrust", "BADAOUI<<ADNANE<<<<<<", "BADAOUI ADNANE"], ["nameTrust", "BADA0UI<<ADNANE<<<", "BADA0UI ADNANE"], ["nameTrust", "BADAOUIKADNANE", "BADAOUIKADNANE"],
  ["licRegel", D1], ["licRegel", kapot(D1, 29, "0")], ["licRegel", d1({ dat: "150399" })], ["licRegel", d1({ kop: "D1AFR" })],
  ["parseMRZ", TD1], ["parseMRZ", TD3], ["parseMRZ", TD2], ["parseMRZ", D1],
  ["parseMRZ", TD1.toLowerCase()], ["parseMRZ", TD1.replace(/\n/g, "\n  ")], ["parseMRZ", "ruis\n" + TD1 + "\nnog ruis"],
  ["parseMRZ", kapot(TD1, 7, "8")], ["parseMRZ", kapot(TD1, 33, "9")], ["parseMRZ", td1({ geb: "300101" })], ["parseMRZ", td1({ nat: "XYZ" })],
  ["parseMRZ", td1({ naam: "B4DAOUI<<ADNANE" })], ["parseMRZ", td1({ alt: "GI4599<<<YYVY" })], ["parseMRZ", td1({ sex: "F", alt: "BK123456", naam: "EL<IDRISSI<<KHADIJA" })],
  ["parseMRZ", td3({ nat: "NLD", naam: "DE<VRIES<<SARAH" })], ["parseMRZ", kapot(TD3, 50, "X")], ["parseMRZ", td3({ vv: "551231" })],
  ["parseMRZ", "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204159ZE184226B<<<<<10"],
  ["parseMRZ", ""], ["parseMRZ", null], ["parseMRZ", "IDMAR\nNIETS\nHIER"],
  ["mrzSane", { birthDate: "2000-07-01", expiry: "2030-08-10", docNumber: "AB12345", nationality: "MAR", docRaw: "<<<<<<<<", fullName: "X Y Z" }],
  ["mrzSane", { birthDate: "1900-01-01", expiry: "2030-08-10", docNumber: "AB12345", nationality: "MAR" }],
  ["echtLand", "MAR"], ["echtLand", "nld"], ["echtLand", "XYZ"], ["echtLand", ""],
  ["usableDocNo", "id", "AB1234567", "GI4599", "id"], ["usableDocNo", "passport", "RX1234567", "", "passport"], ["usableDocNo", "id", "", "", ""], ["usableDocNo", "licence", "07/182101", "", "licence"],
  ["cijferig", "GI45O9"], ["cijferig", "BOIS"],
  ["datumsUit", "Né le 01.07.2000 valable 10/08/2030 et 2019-03-15"], ["datumsUit", "geen datum"], ["datumsUit", "31.02.2020 01-13-2020"],
  ["nummerInRegel", "5. 07/182101", "5. 07/182101"], ["nummerInRegel", "N 07 182101", "N 07 182101"],
  ["licNummerUit", R(PERMIS_VOOR)], ["licNummerUit", R("niets\nhier")],
  ["rijbewijsUitRegels", R(PERMIS_VOOR)], ["rijbewijsUitRegels", R(PERMIS_ACHTER)], ["rijbewijsUitRegels", []],
  ["voorkantUitRegels", R(CIN_VOOR)], ["voorkantUitRegels", R(PERMIS_VOOR)], ["voorkantUitRegels", []],
  ["soortUitRegels", R(CIN_VOOR)], ["soortUitRegels", R(CIN_ACHTER)], ["soortUitRegels", R(PERMIS_VOOR)], ["soortUitRegels", R(PERMIS_ACHTER)], ["soortUitRegels", R(PASPOORT)], ["soortUitRegels", R("bon de commande")],
  ["mrzRegelsUit", CIN_ACHTER], ["mrzRegelsUit", PASPOORT], ["mrzRegelsUit", "geen strook"],
  ["plakMRZ", CIN_ACHTER], ["plakMRZ", PASPOORT], ["plakMRZ", PERMIS_ACHTER], ["plakMRZ", "onzin"],
  ["plakRegels", CIN_ACHTER], ["adresUitPlak", R(CIN_ACHTER)], ["adresUitPlak", R("niets")],
  ...ADRESSEN.map(a => ["adresAchtig", a]),
  ...ADRESSEN.map(a => ["adresOpschonen", a]),
  ...ADRESSEN.map(a => ["adresUitTekst", a]),
  ["adresUitRegels", R(CIN_ACHTER)], ["adresUitRegels", R(CIN_ACHTER, 0.4)], ["adresUitRegelsRuw", R(CIN_ACHTER)],
  ["afstand1", "ADRESSE", "ADRESE"], ["afstand1", "KENITRA", "KENITRA"], ["afstand1", "A", "XYZ"],
  ["rijbewijsUitTekst", PERMIS_VOOR], ["rijbewijsUitTekst", PERMIS_ACHTER], ["rijbewijsUitTekst", CIN_VOOR], ["rijbewijsUitTekst", ""],
  ["uitBarcode", TD1], ["uitBarcode", "https://example.com"], ["uitBarcode", ""],
  ["mrzOpLengte", TD1.split("\n")[0].replace("<<<<", "<<<"), 30], ["mrzOpLengte", TD1.split("\n")[0] + "<<", 30], ["mrzOpLengte", "ABC", 30],
  ["aiMrz", TD1.split("\n")], ["aiMrz", TD3.split("\n")], ["aiMrz", TD1.split("\n").map(r => r.replace("<<<<<", "<<<<"))], ["aiMrz", ["IDMAR", "X", "Y"]],
  ["aiDatum", "2030-08-10"], ["aiDatum", "10/08/2030"], ["aiDatum", null],
  ["aiSchoon", "  badaoui   adnane "], ["aiSchoon", null],
  ["docNumVariants", "AB1234567"], ["docNumVariants", "OB12S4567"],
  ["bestDocNum", "AB1234567", chk("AB1234567")], ["bestDocNum", "AB12345G7", chk("AB1234567")],
  ["repairLines", TD1.split("\n")], ["repairLines", TD1.split("\n").map(r => r.replace(/0/g, "O"))],
  ["fixWithChecks", TD1.split("\n")], ["fixWithChecks", TD1.split("\n").map(r => r.replace(/0/g, "O"))], ["fixWithChecks", TD3.split("\n")],
  ["naamConsensus", ["BADAOUI ADNANE", "BADAOUI ADNANE", "BADA0UI ADNANE"]], ["naamConsensus", []],
  ["lijstConsensus", ["A", "A", "B"], 2], ["lijstConsensus", ["A", "B", "C"], 2],
  ["naamConsensusStreng", ["BADAOUI ADNANE", "BADAOUI ADNANE", "BADAOUI ADNANE"], 2, 0.6],
  ["naamGeloofwaardig", "BADAOUI ADNANE"], ["naamGeloofwaardig", "XQZ"], ["naamGeloofwaardig", ""],
  ["marokNaam", "ELOVARRAT", null], ["marokNaam", "BADAOUI ADNANE", null],
];
