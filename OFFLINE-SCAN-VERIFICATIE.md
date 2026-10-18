# Offline scan — Atlas TEST

## Werkwijze en grenzen
- Eenmalig met internet: Contract → Offline scannen voorbereiden (ongeveer 34 MB publieke herkenningsbestanden).
- Daarna kunnen JPG/PNG-foto’s op hetzelfde toestel lokaal worden gelezen, ook na herladen zonder verbinding.
- Dit vereist de HTTPS-testsite of localhost. Een los file:// bestand biedt deze offline installatie niet.
- Browsergegevens wissen of opslag die het toestel opruimt kan de voorbereiding verwijderen. Atlas controleert daarom alle benodigde bestanden voordat het “klaar” meldt.
- Geen belofte van perfecte herkenning of gelijkwaardigheid met Google/Claude. Controle van naam, nummers en datums blijft verplicht. PDF en volledige offline boekhouding/synchronisatie vallen niet onder deze fotoproef.

## Techniek en privacy
- Bestaande Tesseract-versie 5.1.1 behouden; engine en Frans/Engelse modellen vastgelegd met SHA-256-controle en op de eigen testsite gehost.
- Alleen expliciet genoemde publieke bestanden worden in de offline bundel bewaard. Geen authenticatie-antwoorden, databaseroutes, klantfoto’s of documentuploads.
- Serviceworker voor push behouden; offline ondersteuning wordt uitsluitend door de testbuild toegevoegd.
- Elke gewijzigde publieke bundel krijgt een eigen versie. Vorige publieke bundels worden pas na een volledig voorbereide vervanging verwijderd.
- Lokale lezer standaard; geen automatische betaalde AI-oproep. Online OCR.space is een bestaande optionele route met een eigen sleutel; offline wordt die niet aangeroepen.
- Snelle eerste poging met Tesseract, daarna bestaande eigen MRZ-lezer als de controlecijfers niet slagen. Namen blijven onzeker; één succesvolle lezing wordt nooit drie onafhankelijke lezingen genoemd.

## Vastgestelde controles
- 66 bestaande/regeltests geslaagd.
- 16 browsertests geslaagd, inclusief downloaden, netwerk uit, volledig herladen, echte lokale tekstherkenning, fictief paspoort en detectie van ontbrekend cachebestand.
- Fictief paspoort: naam, documentnummer, geboorte- en vervaldatum gelijk aan verwachte gegevens. Circa 1,3–1,4 seconde op deze laptop; geen representatieve iPhone- of vlootbenchmark.
- Gesimuleerde netwerkuitval: geen AI- of externe OCR-oproep vanuit de offline routes.
- Ook de volledige fictieve scanhandeling (niet alleen tekstherkenning) is zonder internet doorlopen: naam, nummer en geboortedatum correct, menselijke bevestiging blijft uit. Circa 1,6 seconde op deze laptop.
- Eerste online installatie ontdekte een beveiligingsredirect: publieke bundelbestanden gebruiken nu de bestaande aanmelding van dezelfde site. Beveiliging niet uitgezet. Dit is als nagebootste previewbeveiliging toegevoegd aan de browsertest.
- De Linux-proef ontdekte I/1-verwarring in een Frans paspoortnummer. Gerichte correctie gebruikt uitsluitend het door France Titres beschreven Franse nummerformaat en behoudt controlecijfers en menselijke controle. Deze regel geldt niet voor andere landen.
- Die proef leest ook een controlecijfer soms fout. Er worden geen controlecijfers berekend ter vervanging van de foto. Als de herlezing niet lukt en de oude lezer vervolgens een nummer met een ongeldig Frans formaat teruggeeft, blijft het nummer leeg voor handmatige invoer. Acceptatie: correct lezen óf zichtbaar weigeren, nooit een aangetoond tegenstrijdig nummer invullen. Dit is geen bewijs van perfecte herkenning op Linux.
- Pushbestemmingen, contractschermen, registratie en garantiedossier blijven slagen in de browsertests.

## Open punten
- Fysieke iPhone offline proef nog niet uitgevoerd.
- AI-vergelijking nog niet uitgevoerd: in atlas-test ontbreekt een Anthropic-sleutel en er is nog geen ingestelde testscandienst. De gebruiker is gevraagd om zelf de sleutel te configureren en een proefbudget te kiezen; geen betaalde oproepen uitgevoerd.
- Productie ongewijzigd. Deze wijzigingen mogen niet als geteste productierelease worden behandeld.
