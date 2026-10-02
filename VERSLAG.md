# Verslag herbouw — nacht van 2 oktober 2026

**Kort:** alle vijf punten uit je lijst staan in de branch `herbouw`, getest en gepusht. Ze zijn nog niet live: de site draait op `main` (v135) en daar heb ik niets aan veranderd. De scanner, de Supabase-functie, je gegevens en het KENI-CAR-contract zijn aantoonbaar ongewijzigd: 20 van 20 tests groen.

**Belangrijkste vondst:** op het contract dat nu live staat (v135) is **het vak "Immatriculation" leeg**. Elk contract dat de app nu maakt, mist het kenteken. Dat komt niet door de herbouw: ik zag het in de PDF van v135 zelf. Een geteste oplossing staat bij "Wat jij moet beslissen", punt 1.

**Afstand tot omzet:** onbekend. Er staat nergens een klant, gesprek of betaling vastgelegd. Dit werk maakt een demo sterker (vooral het Arabisch), maar levert zelf geen dirham op.

---

## Wat ik bouwde (8 commits op `herbouw`)

| Stap | Wat | Commit |
|---|---|---|
| 0 | `PLAN.md` en scannertests **vóór** het bouwen; browsertest in headless Chrome | `23729a4`, `2e1c344` |
| 1 | **Volledig Arabisch**, van rechts naar links. Taalkeuze Français / العربية / Nederlands onder "Meer". Bedragen, km, datums en kentekens blijven goed leesbaar. 14 Franse teksten die nog Nederlands waren, nu Frans. | `4f4ab52` |
| 2 | **Boete → aanwijzing van de bestuurder.** De boetezoeker (Borgen) maakt meteen de verklaring "Désignation du conducteur" als PDF (Frans). De boete staat op Vandaag met de uiterste datum (ontvangst + 30 dagen) tot je op "Verstuurd" tikt. | `968c0da` |
| 3 | **Betalen zonder terminal.** RIB en bank in Instellingen. Op "Contrat prêt" de knop "Demande de paiement sur WhatsApp" met bedrag, RIB en referentie. Na zo'n verzoek boekt "Location reçue" als overschrijving, niet als contant. | `25a5a90` |
| 4 | **Borg op maat in één tik.** Vier borgknoppen onder de prijs: half, de borg van de auto, anderhalf, en de korting voor een vaste klant (★). | `c9b6b2d` |
| 5 | **Winst per auto** zichtbaar in het wagenpark (groen of rood). **Vertrouwenspagina** met één tik onder "Meer". Versie: `136-herbouw`. | `15e64ec` |
| — | Testserver sloot niet netjes af; opgelost | `fd8c208` |

Hoe: ik heb de app **omgebouwd**, niet van nul herschreven. De scanner hangt aan 78 vaste schermelementen; een nieuwe app zou die breken. v135 had de gevraagde vorm al grotendeels: menu onderaan, Vandaag eerst, terugkomst stap voor stap. `index.html`: 682 regels erbij, 16 vervangen. Die 16 heb ik één voor één nagekeken: geen ervan zit in de scanner, de opslag of het contract.

## Welke tests groen zijn (20/20, exitcode 0, twee rondes na elkaar)

Draaien: `cd tests && npm install && npm test` (duurt ongeveer 1 minuut, gebruikt je Chrome).

**Scanner en gegevens (bewijs dat niets veranderde):**
- Elke opdracht uit scanner, cloudopslag, opslag en contract van v135 (286 stuks) staat er letterlijk nog, en er is niets tussen gezet.
- Alle 78 schermelementen waar de scanner aan hangt bestaan nog.
- Supabase-scanfunctie: zelfde adres (`/functions/v1/atlas-scan`).
- 147 vaste scangevallen (CNIE, paspoort, TD2, rijbewijs-D1, OCR-tekst, adressen, AI-antwoorden, ook kapotte stroken) geven **exact** dezelfde uitkomst als v135.
- Getoetst met opzettelijke fouten: één veranderd rekengetal in de scanner maakt 3 tests rood, een hernoemd veld maakt de veldtest rood.

**Contract:** het Franse contract is **byte-gelijk** aan v135. In de Arabische stand komt het contract in het Frans, en daarna staat de app weer in het Arabisch.

**Nieuwe onderdelen in een echte browser:** app opent foutloos in FR, NL en AR en elk hoofdscherm tekent; RTL-menu in het Arabisch; elke tekst vertaald, behalve het contract; boete van zoeken tot verstuurd (FR en AR); betaalverzoek met juiste RIB, bedrag en WhatsApp-link; borgknoppen; winst per auto (Logan −150 DH, Clio +2.800 DH); vertrouwenspagina via Meer.

**Ook met de hand gecontroleerd:** echte PDF's (met de echte bibliotheken, niet nagebootst) van contract en verklaring in de Arabische stand. Beide openen als PDF en zijn Frans en van links naar rechts.

Schermafdrukken: `tests/schermen/` (o.a. `ar-vandaag.png`, `ar-nieuw.png`, `fr-boete-vandaag.png`, `fr-betaalverzoek.png`, `fr-borg-op-maat.png`, `ar-wagenpark-winst.png`, `boete-verklaring.png`).

## Wat niet (of niet getest)

- **Niet getest op een echte telefoon**, ook niet met de camera. De scanner zelf is ongewijzigd en getest op tekst. Hoe het Arabische scherm eruitziet tijdens een echte camerascan, heb ik niet gezien.
- **Cloudsynchronisatie (Supabase) niet live getest.** Ik heb niet ingelogd. De code ervan is niet veranderd (vingerafdruktest), maar het nieuwe veld `boetes` en de RIB gaan via dezelfde weg naar de cloud. Dat heb ik niet zelf gezien.
- **Het Arabisch heb ik zelf vertaald.** Een Marokkaanse lezer moet het nalezen voordat klanten het zien.
- **De boeteverklaring is juridisch niet gecontroleerd.** De 30 dagen en "art. 200" komen uit je strategiedocument. Ik heb het artikelnummer bewust niet op het document gezet. Laat de tekst nakijken.
- **Betaalverzoek:** de WhatsApp-link heb ik niet echt geopend (alleen gecontroleerd dat hij goed is opgebouwd). Geen QR-code: Marokkaanse bankapps lezen een RIB-QR niet als betaling, dus die zou niets doen.
- **Klantdocumenten in het Arabisch als PDF** (bon, klantkaart) heb ik niet als echte PDF bekeken, alleen contract en verklaring.
- De drie documenten **ATLAS-ONTWERP, ATLAS-IDEE-CHECK en ATLAS-SCANNER-STATUS kon ik niet vinden** (niet op deze Mac, niet bij je artifacts). Ik werkte met de strategie van 15 sep en het ontwerpvoorstel van 23 sep.
- Een fout in mijn werkwijze die ik herstelde: bij stap 5 ging de commit door terwijl het testbestand hing. De tests waren wel allemaal geslaagd, maar mijn opdracht keek niet naar de exitcode. Daarna heb ik alleen nog gecommit bij exitcode 0.

## Wat jij moet beslissen

1. **Kenteken op het contract (live fout).** Twee CSS-regels lossen het op, getest in FR en AR (`12345 · أ · 6` verschijnt weer). Ik heb ze niet toegepast omdat je zei: contract niet aanraken. De functie `makeContract` blijft gelijk; dit verandert alleen hoe het kenteken op het blad getekend wordt:
   ```css
   #sheet .plate{display:inline-flex;direction:ltr;unicode-bidi:normal;gap:6px;border:0;padding:0;font-family:inherit;font-size:inherit;background:none}
   #sheet .plate bdi, #sheet .plate i{display:inline-block;unicode-bidi:normal}
   ```
   Opties: (a) **alleen deze fix nu naar `main`**, los van de herbouw. Voordeel: elk nieuw contract klopt vanaf vandaag. Nadeel: een kleine live wijziging zonder dat je het zelf zag. (b) Samen met de herbouw. Voordeel: één moment. Nadeel: blijft fout tot je de herbouw goedkeurt. (c) Laten. **Mijn advies: (a)**, want een contract zonder kenteken is bij een politiecontrole een echt probleem.
2. **Herbouw live zetten?** Bekijk eerst de schermen in `tests/schermen/`, of open de branch lokaal (`git checkout herbouw`, open `index.html` via een webserver). Live zetten = `herbouw` samenvoegen in `main`. Dat doe ik alleen op jouw "ok".
3. **Arabisch laten nalezen** door een Marokkaanse verhuurder of klant. Dat is ook meteen een gesprek met een prospect.
4. **Klopt "betalen zonder terminal" = overschrijving via WhatsApp?** Bedoelde je iets anders (betaallink met kaart, CashPlus, enz.), zeg het. Een kaartbetaallink vraagt een handelaarscontract (CMI of zoiets).
5. **Boeteverklaring laten nakijken** door iemand die de Marokkaanse praktijk kent: welk formulier verwacht NARSA of de politie precies?

## Eigen voorstellen (alleen als ze het eenvoudiger maken, niet gebouwd)

- **Kenteken leesbaar maken in het monospace-lettertype.** In de kentekenvakjes valt de Arabische letter terug op een ander lettertype (te zien in `fr-betaalverzoek.png`). Klein, maar het oog valt erop.
- **Snelkeuze-taal bij het eerste openen** (FR / العربية) in plaats van via "Meer". Eén scherm, één keer.

## Wat ik zou doen voor omzet (eerlijk)

Niets van dit werk wordt omzet zonder een gesprek. Kleinste volgende stap: deze week één verhuurder in Kenitra de app in het Arabisch laten zien, met de vraag uit je strategie: *"wat mist je huidige systeem waar je je écht aan ergert?"* Neem het lege kenteken (punt 1) eerst mee, anders laat je een fout zien.
