# Plan — herbouw (branch `herbouw`)

2 oktober 2026, 's nachts, zelfstandig gewerkt. `main` en de live site blijven onaangeroerd.
GitHub Pages bouwt alleen vanuit `main` (gecontroleerd via de GitHub-API), dus een push van `herbouw` verandert niets aan de site.

## Wat ik gelezen heb
- `index.html` (v135, 8670 regels): één bestand met de hele app.
- `~/Projects/atlas/STRATEGIE-OVERSTAP.md` (15 sep, nieuwste versie): vertrouwenspagina, winst per auto, boete art. 200, borg binnen 7 dagen.
- Artifact "Atlas Ontwerpvoorstel" (23 sep): Vandaag-scherm, nieuwe verhuur op één scherm, contract klaar.
- **Niet gevonden:** ATLAS-ONTWERP, ATLAS-IDEE-CHECK, ATLAS-SCANNER-STATUS. Ze staan niet op deze Mac en niet bij je artifacts. Waar ze iets anders zeggen dan ik aanneem, kan dat botsen. Zie "Aannames".

## Wat er al is (v135)
Menu onderaan, Vandaag eerst, Frans standaard, contract via foto, terugkomst stap voor stap, vertrouwenspagina met echte cijfers (in Instellingen › Hulpmiddelen), houden/verkopen per auto (in het autoscherm), borgkorting voor vaste klanten, borgboek, kas, en een boetezoeker (kenteken + datum → klant).

## Wat ontbreekt tegenover jouw opdracht
| Gevraagd | Stand | Wat ik doe |
|---|---|---|
| Volledig Arabisch | ontbreekt: alleen FR en NL | **Stap 1**: Arabisch met rechts-naar-links, taalkeuze FR / العربية / NL |
| Boeteverklaring | alleen opzoeken, geen document | **Stap 2**: uit de boetezoeker meteen de verklaring (art. 200) als PDF, met de 30-dagentermijn op Vandaag |
| Betalen zonder terminal | ontbreekt | **Stap 3**: RIB in Instellingen; bij een openstaand bedrag een betaalverzoek via WhatsApp plus een QR-code met bedrag, RIB en referentie |
| Borg op maat | bestaat (vaste-klantkorting), maar onzichtbaar waarom | **Stap 4**: op het huurscherm zeggen waarom de borg lager is, en hem met één tik aanpassen |
| Vertrouwenspagina, winst per auto | bestaan, maar diep verstopt | **Stap 5**: bereikbaar maken vanuit "Meer" en het wagenpark |

## Hoe (keuze)
- **Ombouwen in plaats van van nul herschrijven.** De scanner is 286 opdrachten groot en hangt aan 78 vaste schermelementen. Een nieuwe app vanaf nul zou die verbindingen breken, en dat mag niet (regel 4). v134/v135 hebben de gevraagde vorm al grotendeels: menu onderaan, Vandaag eerst, terugkomst stap voor stap. Ik vul aan wat ontbreekt.
- Het **contract blijft Frans** in KENI-CAR-vorm, ook als de app in het Arabisch staat. Ik verander niets aan `makeContract`; bij het afdrukken zet ik alleen de taal tijdelijk op Frans.
- Geen nieuwe bibliotheken in de app. Alles blijft in één `index.html`.

## Tests eerst (stap 0)
`tests/` (Node, `npm test`):
1. **Vingerafdruk.** Elke opdracht uit scanner, cloudopslag, opslag en contract van v135 moet letterlijk terugkomen. Niets erbij, niets eraf.
2. **Schermelementen.** Alle 78 element-id's waar de scanner aan hangt moeten nog bestaan.
3. **Supabase-scanfunctie.** Hetzelfde adres (`/functions/v1/atlas-scan`).
4. **Teksten.** Elke tekst die de scanner toont, bestaat in elke taal, dus straks ook in het Arabisch.
5. **Gedrag.** 147 vaste gevallen (geldige en kapotte stroken van CNIE, paspoort, TD2 en rijbewijs-D1, OCR-tekst van voor- en achterkant, adressen, AI-antwoorden) geven exact dezelfde uitkomst als v135.

Getoetst met opzettelijke fouten: één gewijzigd rekengetal in de scanner maakt 3 tests rood, een hernoemd veld maakt de veldtest rood.

Daarnaast een **browsertest** (headless Chrome): de app opent zonder fouten, in elke taal, en de nieuwe onderdelen werken.

## Werkwijze
Na elke stap: tests draaien, committen met uitleg, `herbouw` pushen. Nooit `main`.

## Aannames (te controleren door jou)
- "Betalen zonder terminal" = de klant betaalt per overschrijving of met de bankapp, met een betaalverzoek via WhatsApp. Een echte betaallink (CMI e.d.) vraagt een handelaarscontract en kan ik vannacht niet bouwen.
- De boeteverklaring is in het Frans, zoals de andere officiële documenten.
- Het Arabisch heb ik zelf vertaald. Een Marokkaanse lezer moet het nalezen voordat het voor klanten gebruikt wordt.

## Afstand tot omzet
Onbekend. In de repo of de documenten staat geen klant, gesprek of betaling vastgelegd. Dit werk maakt een demo bij een agency sterker (Arabisch is voor veel verhuurders een voorwaarde), maar levert zelf geen omzet op. Dat doet pas het eerste gesprek.
