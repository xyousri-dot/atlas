# Betaalde scan eerst — uitsluitend Atlas TEST

## Aansluiting
- Nieuwe atlas-scan functie uitsluitend op manikkusokwysmdfhxtu. Productie niet gewijzigd.
- Anthropic Messages API, claude-haiku-5-5, gestructureerde JSON-uitvoer. Geen nieuwe gateway, abonnement of aanvullende provider; bestaande geheime testinstelling wordt alleen op de server gelezen.
- JWT-platformcontrole blijft aan; functie controleert de gebruiker bovendien via Supabase auth.getUser. Vaste testorigin, geen foto-URLs, alleen begrensde JPEG/PNG-invoer.
- Geen beelden of gelezen identiteitsgegevens opgeslagen in de kostenteller of technische logging.
- Testlimiet: gezamenlijk maximaal 20 pogingen per dag en 3 per minuut per account, atomair via databasefunctie. Ook mislukte providerpogingen tellen. Alleen serverrol kan de teller bedienen.
- Browser doet maximaal één betaalde poging per scanhandeling; geen verborgen tweede betaalde herlezing. Bij offline, fout, tijdslimiet of quotum: bestaande lokale reservelezer.
- Tegenstrijdige identiteitsdocumenten niet naar lokale samenvoeging doorzetten; menselijke controle blijft verplicht.

## Uitgevoerd / bewijs
- Migratie met teller en afgeschermde reserveringsfunctie succesvol op atlas-test uitgevoerd.
- atlas-scan testfunctie gedeployed. Ongeldige lege foto-aanvraag van aangemeld account geeft 400 input terug: endpoint en aanmeldcontrole bereikbaar, geen provideroproep.
- Lokale build: 72 tests geslaagd. Browserproef met nagebootste provider: betaald eerst, één poging, storing naar lokaal, correctie behouden en menselijke controle niet automatisch aangevinkt.
- Eén echte provideroproep met een uitsluitend fictief paspoort: endpoint 502, providerStatus 401, circa 1,2 seconde. Anthropic weigert de opgeslagen sleutel. Geen extra betaalde pogingen uitgevoerd na die fout.

## Hertest na sleutelvervanging — 18 oktober 2026
- Echte testdienst geeft nu HTTP 200 met reader anthropic, model claude-haiku-5-5. Alleen een zelfgemaakt fictief paspoort verzonden.
- Naam MARTIN PAUL, nummer 18AB12345, geboortedatum 1978-03-12 en vervaldatum 2029-01-01 correct gelezen. Gebruik bij vastgelegde aanvraag: 2408 invoer- en 173 uitvoertokens; werkelijke factuurkosten niet gemeten.
- Eerste aanvraag gebruikte een verlopen aanmelding; herladen herstelde de sessie. Een volgende browseropdracht liep tegen de bedieningstijdslimiet aan; resultaat daarvan niet vastgelegd. Daarna één aanvullende aanvraag uitgevoerd en bovenstaande 200 vastgelegd.
- Het echte antwoord zonder extra betaalde oproep door de bestaande invulflow gevoerd: MARTIN PAUL en documentnummer zichtbaar; menselijke bevestiging bleef uitgevinkt. Geen contract opgeslagen.
- Gerichte automatische browsertest opnieuw geslaagd: betaald eerst, één poging per handeling, gesimuleerde providerstoring naar lokale reserve, handmatige correcties behouden.
- Dit bewijst een succesvolle fictieve herkenning, niet foutloze herkenning van alle documenten. Fysieke telefoon- en moeilijk leesbare documenten blijven aanvullende acceptatieproeven.
- Alleen testomgeving; productie ongewijzigd. Geen geheime sleutel bekeken of in code opgeslagen.

## Bronnen voor API-vorm en modelkeuze
- https://platform.claude.com/docs/en/build-with-claude/vision
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- https://platform.claude.com/docs/en/models/overview

## Aanvullende vrijgaveproef — 18 oktober 2026
- Fictieve Marokkaanse CIN: eerste proef las EL AMRANI SAMIRA en AB123456, maar liet beide duidelijk afgedrukte datums leeg (HTTP 200, 5672 ms). Niet live vrijgegeven.
- Datum-instructie in de testfunctie verduidelijkt: DD.MM.YYYY voor Marokkaanse CIN met Franse labels; voorbeelden mogen nooit als standaardwaarden worden ingevuld.
- Nieuwe echte providerproef met andere waarden: CD987654, geboortedatum 03.02.1987 en vervaldatum 12.11.2032. Correct teruggegeven als 1987-02-03 en 2032-11-12; HTTP 200, 4339 ms, 2651 invoer- en 177 uitvoertokens. Geen echte persoonsgegevens gebruikt.
- Extra test beveiligt de datum-instructie tegen onbedoelde verwijdering van de niet-verzinnen-regels.
- Productie heeft een eigen bestaande Anthropic-secret (waarde niet bekeken), maar de productiepagina is niet aangemeld. De nieuwe module/backend/build zijn nog test-only; geen preview naar productie promoveren, geen testdatabase aan klanten koppelen.
- Vrijgave nog niet voltooid: afzonderlijke productieconfiguratie, quota, publicatie en controle met een productieaanmelding nodig.

## Twee te gebruiken adressen
- Test en nieuwe functies: https://atlas-phone-pilot-git-atlas-pilot-67456c-xyousri-9529s-projects.vercel.app/
- Bestaande echte site: https://xyousri-dot.github.io/atlas/
- project-taoza.vercel.app en file:// kopieën niet als alternatief aanbieden; die maken onduidelijk welke versie/database gebruikt wordt. Een browser-app installeren is een snelkoppeling naar het gekozen adres, geen HTML-bestand downloaden.
