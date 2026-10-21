# Atlas: betrouwbaarheid vóór klanten

Grens: alleen atlas-test / previewbranch. Productie niet gewijzigd.
Een geïnstalleerde webapp is geen App Store-app. Geen garantie op iedere
telefooninstelling, internetverbinding of zichtbaarheid van pushmeldingen.

## Meldingsbewaking — implementatie 21 oktober 2026

- Blijvende outbox vóór verzending; bestaande historische pogingen krijgen
  eerlijk `unknown`, zonder verzonnen ontvangstbewijs.
- Eén databaseclaim per poging. 429/5xx maximaal drie pogingen met 1/5 minuten
  wachttijd. Netwerkonzekerheid/afgebroken poging: geen blinde automatische retry.
- Bevestiging van weergaveverzoek en klik zijn afzonderlijk. Een klik is geen
  bewijs dat de eigenaar het onderhoud of de betaling heeft afgehandeld.
- Kleine ontvangstbevestigingen worden bij netwerkuitval lokaal bewaard en bij
  nieuwe ontvangst, openen, appstart of reconnect opnieuw aangeboden.
- Alleen bestaande bevestigde testbeheerder mag monitor en handmatige retry
  gebruiken. Geen abonnementsgegevens, ontvangsttokens of documentinhoud in beheer.
- Ontvangst zonder bevestiging na tien minuten heet onbekend, nooit geslaagd.
- Foutproeven: push-monitor.test.mjs, push.test.mjs, push-monitor-db.sql,
  beheerscherm in ci-browser.test.mjs. De SQL-proef draait in een rollbacktransactie.
- Live geverifieerd: nieuwe testmelding krijgt `Toestel bevestigd` in het echte
  testbeheer. De eerste melding via de oude worker bleef eerlijk onbekend.
  Openbevestiging van de nieuwste melding vraagt nog een fysieke iPhone-klik;
  het worker-/serverpad is daarnaast geïsoleerd getest. Oude appworkers geven
  nog geen bevestiging. Een extra aangemelde-linkbevestiging helpt bij updates.
- Echte SQL-proef geslaagd: claim, dubbele claim, backoff, retrymaximum,
  ontvangsttoken, beheerdersafscherming, verlopen toestel en cron-herhaalplanning.
  De fictieve databasegegevens zijn teruggedraaid. Geen klantomgeving gewijzigd.

## Brede vrijgavecheck — niet automatisch als afgerond beschouwen

| Onderdeel | Vereist bewijs vóór echte klanten |
| --- | --- |
| Inloggen en rechten | Eigen gegevens per account; verlopen sessie en wachtwoordherstel testen |
| Opslag | Geen dubbel schrijven bij opnieuw proberen; terugzetten van back-up echt oefenen |
| Verhuur | Dubbele boeking blokkeren; contract, sleuteloverdracht en afrekening samen testen |
| Geld | Betalingen, borg, kosten en correcties één keer tellen; bedragen herleidbaar |
| Scan | Camera/bestanden, meerdere foto’s, HEIC en paspoort/ID/rijbewijs; menselijke controle |
| Webapp | Heropenen, update zonder herinstallatie, trage/geen verbinding, telefoonbediening |
| Meldingen | Aparte ontvangststatus, fout/retry-proeven, uitgeschakeld/verwijderd toestel |
| Bedrijfsvoering | Kostenlimieten, ondersteuning, incidentprocedure en herstelverantwoordelijke |
| Privacy en voorwaarden | Landen, bewaartermijnen, identiteitsdocumenten, leveranciers en contracten juridisch beoordelen |

Bestaande automatische tests zijn nuttig bewijs, geen volledige certificering of
juridische goedkeuring. Controleer bovenstaande per onderdeel en leg de uitslag
vast. Geen brede herbouw of productiepublicatie zonder gerichte opdracht.
