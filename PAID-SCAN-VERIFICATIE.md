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

## Open punt — betaalde herkenning NIET bewezen
- Gebruiker moet zelf een geldige Anthropic API-sleutel instellen in atlas-test. Waarde nooit geopend, gekopieerd of in chat gezet.
- Na vervanging: één fictieve scan opnieuw uitvoeren, velden en verwerking in de app vergelijken, daarna pas geschiktheid beoordelen. Snelheid en kosten van succesvolle herkenning zijn nog niet gemeten.
- Geen productie-uitrol voor deze controles slagen.

## Bronnen voor API-vorm en modelkeuze
- https://platform.claude.com/docs/en/build-with-claude/vision
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- https://platform.claude.com/docs/en/models/overview
