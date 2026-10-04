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

---

## Ronde 2 — rustig en duidelijk (2 oktober, overdag)

Je zei: "doe wat jij denkt dat beter is". Gekozen: optie 1, dus geen nieuwe functies, wel rust en duidelijkheid.

| Wat | Was | Is nu |
|---|---|---|
| Vandaag, bovenaan | grote inlogbalk + 4 oranje regels over keuringen over 20 dagen | **3 cijfers**: ontvangen vandaag · borg in handen · auto's vrij (elk cijfer opent het scherm erachter) |
| Vandaag, volgorde | het werk van vandaag pas halverwege | meteen onder "Nouveau contrat" |
| Papieren die binnenkort verlopen | elk een eigen oranje regel bovenaan | één regel onderaan die openklapt. **Verlopen** papieren blijven rood bovenaan |
| Inloggen | groot kader bovenaan | rustige regel onderaan |
| Kas en borgen | rood bij 0 DH | alleen rood als er echt iets openstaat |
| Autoscherm (telefoon) | resultaat pas na lang scrollen; tekst zei "à droite" | **resultaat bovenaan** |
| Ondertitels | lang en uitleggerig | kort (kas, borgen, planning, auto), in FR, AR en NL |
| Opslaanknop auto | afgekapt ("Enregistr…") | "Enregistrer" |

**Tweede fout uit v135 gevonden en opgelost:** een auto die **te laat is en nog niet terug**, stond bij "Libres — touchez pour louer" en telde als vrij. Je kon hem dus opnieuw verhuren terwijl hij nog bij de klant stond. Nu telt hij als bezet tot en met morgen; een reservering vanaf overmorgen kan nog wel. Een auto die vandaag terug moet komen, blijft vrij zoals vroeger.

Niet aangeraakt: het klantscherm (daar zit de scanner) en het contract.

Tests: 22/22 groen, exitcode 0 (nieuw: indeling van Vandaag in FR en AR, en de te late auto). De testopstart breekt nu af na 60 s per test, zodat een fout nooit meer blijft hangen.

**Derde fout uit v135 (door jou gemeld):** contract maken → "Contrat prêt" → "Photos et dommages" → terug bracht je naar Vandaag in plaats van terug naar het contract. Dat gold voor de terugknop van de telefoon en voor de knop "Retour". Oorzaak: de terug-logica kende alleen een vaste lijst schermen, en "Contrat prêt" en de klantkaart stonden daar niet in. Nu onthoudt de app bij welk contract je was. Terug → "Contrat prêt", nog eens terug → Vandaag (niet het oude formulier). Getest met precies jouw route; ook nagespeeld op v135, waar de fout bestaat. Tests: 23/23 groen.

---

## Ronde 3 — voelt als een simpele app (alles blijft)

Jouw punt: alle functies mogen blijven, maar het moet aanvoelen als de simpele apps. Vergeleken: Agencar presenteert zich als groot dashboard met een lange lijst onderdelen. Square en Airbnb doen het andersom: weinig op het scherm, korte woorden, geen uitleg, één knop per ding.

| Wat | Was | Is nu |
|---|---|---|
| Uitleg onder elke titel | een of twee zinnen per scherm | weg (behalve de datum op Vandaag) |
| Kleine lettertjes onderaan (kas, borgen, instellingen) | uitlegalinea's | weg |
| Kopjes en veldnamen | HOOFDLETTERS met spatiëring | gewone zinnen |
| Vandaag, per auto | twee knoppen (bv. "Voiture rendue" + "Contrat") | **één grote knop**; tik op de kaart zelf (›) voor contract of wijzigen |
| Instellingen | één lange lijst velden | groepjes: Votre agence · Location · Paiement sans terminal · Options · Compte |

Niets verwijderd, alleen anders geordend. Het klantscherm (scanner) en het contract zijn niet aangeraakt. Tests: 24/24 groen (nieuw: één knop per kaart, tik op de kaart opent het contract).

---

## Ronde 4 — nieuwe werkwijze en nieuw uiterlijk

Jouw punt: "er is niks veranderd qua werkwijze". Klopt. Nu wel:

**Werkwijze**
- **Nieuw contract in 3 schermen**, één ding per scherm: *Qui loue* → *Quelle voiture* → *Combien de temps*, met een voortgangsbalk en "Suivant". Een tik op een auto gaat meteen door naar stap 3. Zonder naam of scan kom je niet verder dan stap 1. Terug (knop of telefoon) = vorige stap, niet het hele contract kwijt.
- **Grote + midden in het menu**: van elk scherm met één tik een nieuw contract (zoals Square). "Clients" staat nu onder "Plus".
- Een auto die nog bij een klant staat (ook te laat), wordt nooit vooraf gekozen.

**Uiterlijk**
- **Groene kop op Vandaag**: de datum, "4 à faire aujourd'hui", een witte knop "+ Nouveau contrat" en de drie cijfers.
- Kaarten zonder rand met zachte schaduw; de status als gekleurd label (rood te laat, geel vandaag).
- Grote tegels voor de auto's, grote dagknoppen, grote prijs.

Scanner, opslag en contract: ongewijzigd (vingerafdruk en 147 gevallen groen). Wijzigen en verlengen van een bestaande verhuur blijven op één scherm.

Tests: 24/24 groen, met de volledige route in drie stappen, de terugknop per stap en "geen bezette auto vooraf gekozen". Schermafdrukken: `tests/schermen/fr-r4-*.png` en `ar-r4-*.png`.

---

## Ronde 5 — alle schermen in dezelfde stijl, ook op de laptop

Let op: je schermafdrukken van 2 oktober kwamen van de **live site (v131)**. Daar is niets veranderd; de herbouw staat alleen in `herbouw` (lokaal: http://127.0.0.1:8136).

- **Groot scherm:** de app staat nu in één kolom in het midden (zoals WhatsApp Web), met het menu en de knoppen erbij. Niet meer over de volle breedte uitgerekt.
- **Auto meegeven / Auto terug:** dezelfde stappenbalk als het nieuwe contract, grote titel per stap, rustige kaarten, grote bevestigknop.
- **Jouw idee "contract in 2 tikken plus een foto":** na een geslaagde scan gaat de app vanzelf door naar de auto. Een contract is nu: **+ → foto → auto → Établir le contrat**. Vraagt de scan om een nummer na te typen, dan blijft hij staan, zodat je dat vak ziet.
- **Contrat prêt:** groen vinkje als succesmoment.

Tests: 25/25 groen (nieuw: vanzelf door na een zekere scan, blijft staan bij twijfel). Scanner, opslag en contract ongewijzigd.

---

## Ronde 6 — verwijderen, met "Annuler"

- **Contract verwijderen:** onderaan elk contract "Supprimer ce contrat". Na een duidelijke vraag is het contract weg alsof het nooit gebeurde: betalingen, borg en boetes gaan mee (de kas klopt meteen weer), de auto staat weer vrij, de kilometerstand gaat terug als dit contract hem verhoogde, en een klant die alleen voor dit contract werd aangemaakt, verdwijnt ook.
- **10 seconden "Annuler"** (zoals Gmail): zet alles exact terug, ook in de cloud. Getest: het teruggezette contract is byte-gelijk aan het origineel.
- **Hetzelfde voor auto's, klanten, kosten en betalingen.** Belangrijk: een auto of klant werd tot nu toe **meteen en zonder vraag** verwijderd (een tik op de rode knop en weg). Nu eerst een vraag, daarna Annuler.

Tests: 28/28 groen.

---

## Ronde 7 — controle na de scan

Jouw punt: na het scannen komt niet alle informatie, de scanner leest soms verkeerd, en je kunt het nergens aanpassen of controleren.

Oorzaak: de scanner las wél documentnummer, geboortedatum, geldigheid, nationaliteit, adres en rijbewijs, maar dat ging **onzichtbaar** het contract in; op het scherm stonden alleen naam en telefoon.

Nu, na elke scan, in stap 1 een **controlekaart**:
- alle 9 gelezen velden **zichtbaar en aanpasbaar**, met de **foto's** erbij (tik = groot, om te vergelijken);
- per veld een **controle**: ✓ klopt · ! nakijken (niet gelezen, vreemd formaat, of de scanner twijfelde) · ✕ fout (document of rijbewijs **verlopen**, klant **jonger dan 18**);
- bovenaan de samenvatting ("✓ 8 corrects · 1 problème");
- bij een fout vraagt "Suivant" eerst of je toch door wilt;
- wat je verbetert, gaat het contract en de klantfiche in (getest).

De app gaat na een scan niet meer vanzelf door: eerst kijk jij. De scannercode zelf is niet veranderd (vingerafdruk + 147 gevallen groen); de kaart leest en verbetert alleen zijn uitkomst.

Tests: 28/28 groen. **Niet getest met echte kaarten en de camera**: dat kan alleen jij, met de slimme scan aan.

---

## Ronde 8 — beweging (7 bewegingen, alleen CSS + een paar regels JS)

Easing power3.out `cubic-bezier(.22,1,.36,1)`, elke animatie ≤ 0,4 s (alleen het optellen 0,8 s, zoals gevraagd). Bij "minder beweging" op het toestel: niets (getest).

| # | Beweging | Waar | Bewijs (begin · midden · eind) |
|---|---|---|---|
| 1 | Rise: fade + 20px omhoog, stagger 0,05 s | kaarten/tegels bij het openen van een scherm | `tests/schermen/beweging/1-rise-blad.png` |
| 2 | Count-up 0 → waarde in 0,8 s | drie cijfers in de groene kop, alleen bij openen | `2-countup-blad.png` |
| 3 | Checklist tick met pop | voortgangsbalk nieuw contract, alleen vooruit | `3-tick-blad.png` |
| 4 | Pop: 0,96 → 1 met kleine overshoot | +, witte knop, groene hoofdknoppen | `4-pop-blad.png` (gemeten: 0,96 → 1) |
| 5 | Slide-in 24px (terug van links; Arabisch omgekeerd) | elk nieuw scherm + elke stap van contract en vertrek/terugkomst | `5-slide-blad.png` |
| 6 | Bar fill | het stuk van de balk dat groen wordt | `6-vul-blad.png` |
| 7 | Blur-in, vinkje als laatste | "Contrat prêt" | `7-blur-blad.png` |

Geen teksten, kleuren of indeling veranderd; scanner, contract, opslag en de 78 schermelementen onveranderd (vingerafdruktests groen). Bewegingen spelen alleen bij openen/vooruitgaan, niet bij elke verversing.

Tests: **50/50 groen** (22 bewegingstests in FR, AR en NL op 390×844, telkens zonder consolefouten). De gewone tests draaien met "minder beweging", zodat ze niet halverwege een animatie meten. Eén keer brak Chrome halverwege af ("Target closed"); de testbestanden draaien daarom nu na elkaar (± 3,5 min). Daarna twee rondes op rij groen.

---

## Ronde 9 — demo-stand en live

- **Demo-stand** via `…/atlas/?demo=1` (en onder Plus: "Voir la démo"): een volle app met 6 auto's, 5 klanten, contracten en geld van vandaag, om te laten zien of als link naar een verhuurder te sturen. Je echte gegevens en de cloud worden niet aangeraakt (getest: ook na verwijderen en opslaan in de demo staat er in de browser exact hetzelfde en wacht er niets op de cloud). Verversen = demo weer als nieuw.
- De oude knop "Charger un exemple" wist eerst al je gegevens (en met cloud ook daar); die blijft verstopt onder Hulpmiddelen, gebruik hem niet.
- Grote bedragen in de groene kop (bv. 13.500 DH) werden afgekapt: nu kleinere letter, altijd volledig (getest).
- Versie: **136**.

Tests: 53/53 groen, twee rondes.

---

## Ronde 10 — test van begin tot eind, fouten weg, werkwijze A-B-C-D (versie 137)

Doorloop als nieuwe verhuurder (lege browser): eerste keer openen → auto's toevoegen → contract → betaling → auto terug → kas → contract 2 → borgen → boete → alle schermen.

**Opgelost (blokkerend):**
- **A. Naam van de zaak:** stond nergens; het contract had geen verhuurder. Nu vraagt de app hem één keer, vóór het eerste contract.
- **B. Contract:** kenteken stond leeg; samengestelde achternamen (EL FASSI, AIT BEN ALI…) werden gesplitst. Beide opgelost (met jouw toestemming in de bevroren contractcode; de test toont precies welke 2 functies bewust veranderd zijn).
- **C. Kas:** "Tout est en ordre — rendre X" betaalde borg terug die nooit ontvangen was (kas −1 750 DH). Nu alleen wat echt ontvangen is. Km bij terugbrengen niet meer vooraf ingevuld (verplicht in te typen).

**Werkwijze, één ding per stap:** nieuw contract = 1 Qui loue → 2 Quelle voiture → 3 Combien de temps → **4 Paiement** (Espèces · Carte · Virement · Plus tard) → Contrat prêt. Het gemengde betaalblok (terminal, WhatsApp, kopiëren, formulier) is vervangen door die ene keuze; het betaalverzoek via WhatsApp is één knop.

**E.** Nieuwe auto: alleen wat nodig is (documenten en aankoop achter "Plus de détails"); na de eerste auto naar Vandaag; voorbeeldtekst in vakken lichter.

Scanner: ongewijzigd (147 gevallen + vingerafdruk groen). Tests: 54/54 groen, twee rondes. De bewegingstests krijgen één herkansing bij een browserfout van headless Chrome (nooit bij een mislukte controle; in de laatste twee rondes niet nodig geweest).
