# Scan en garantie — uitsluitend Atlas TEST

## Uitgevoerd
- Scan bewaart handmatige correcties bij opnieuw lezen; tegenstrijdige documentnummers worden niet stil samengevoegd.
- Onmogelijke kalenderdatums en toekomstige geboortedatums worden geweigerd. Elke nieuwe scan vraagt opnieuw menselijke controle.
- Ontbrekende geavanceerde lezer wordt zichtbaar gemeld; lokale tekstherkenning blijft een hulpmiddel, geen bewezen identiteit.
- Garantie per onderdeel: leverancier, aankoopdatum, afgesproken datum/kilometergrens, bedrag, factuurreferentie en optionele factuur (PDF/JPEG/PNG, maximaal 1 MB).
- Aanpassen behoudt factuur en dossier. Defect en afhandeling worden bewaard; geen automatische boeking of beloofde garantiedekking.
- Bijna verlopen garanties en open claims tellen mee in de bestaande herinneringen, met een koppeling naar het garantiedossier.

## Controle
- Lokale build: 66 tests geslaagd, waaronder 147 bestaande scannergevallen.
- Browsertests: 14 geslaagd, inclusief opslaan, corrigeren, factuur behouden, defect, afhandeling en herladen zonder dubbele kosten.
- Testgegevens zijn fictief; geen echt identiteitsbewijs naar een scandienst verstuurd.

## Niet voltooid / geen garantieclaim
- De testfunctie atlas-scan retourneert HTTP 404 (functie ontbreekt). Een afzonderlijk geconfigureerde testscandienst is nodig voordat verbeterde herkenning in echte foto's kan worden aangetoond.
- Nieuwe garantiewaarschuwingen hebben lokale tests; fysieke telefoonontvangst van deze nieuwe categorie moet na testpublicatie nog worden bevestigd. Eerdere algemene pushontvangst is door de gebruiker bevestigd.
- Productiesite en klantendatabase niet wijzigen voor deze opdracht.
