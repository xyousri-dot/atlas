# Atlas TEST — verificatie telefoonmeldingen

Datum: 18 oktober 2026. Alleen de testtak en atlas-test zijn in scope.

## Praktisch bevestigd door eigenaar

- iPhone ontvangt push terwijl Atlas gesloten en de telefoon vergrendeld is.
- De nieuwe herstartproef opent het juiste contract en de betalingssectie.

## Automatische controles

- Alle zeven categorieën: onderhoud, documenten, vertrek, onvolledig dossier,
  open huur, terug te geven borg en te late retour.
- Juiste auto, exacte documentdatum, juiste contract; drie talen.
- Direct openen, koud opstarten, openen vanaf startpagina met bewaarde bestemming.
- Opnieuw aanmelden behoudt bestemming. Verkeerd account en accountwissel tijdens
  laden openen geen dossier van het vorige account.
- Verwijderde en geannuleerde dossiers geven blijvende uitleg.
- Verbindingsfout geeft opnieuw-proberen; online-event probeert dezelfde link opnieuw.
- Een tweede melding tijdens laden krijgt voorrang.
- De echte Edge Function-handler wordt met een nagebootste database en pushdienst
  uitgevoerd: eigenaarscheiding, dagelijkse planning, vertraagde test, dubbele
  verzending, verlopen abonnement, afmelden en weigeren van ongeoorloofde toegang.
- Huurwaarschuwingen tellen terugbetalingen en verrekende borg mee zoals afrekening.

## Hersteld tijdens deze ronde

- Geen vluchtige foutmelding meer bij offline of verwijderd dossier.
- Geannuleerde contracten worden niet als actieve melding geopend.
- Oude netwerkrespons opent geen vorig doel of verkeerd account.
- Borginhouding gebruikt het bestaande veld cautionWithheld.
- Huurbetaling telt refund en cautionAppliedRent mee.
- Technische veldnamen van documenten zijn vervangen door vertaalde labels.

## Grenzen van het bewijs en vrijgave

De automatische controles gebruiken fictieve gegevens en nagebootste externe
diensten. Zij bewijzen de regels en foutafhandeling; zij vervangen geen fysieke
test op elk telefoonmodel. De dagelijkse melding om 09:00 is in de handler getest,
maar de werkelijke dagelijkse iPhone-aflevering is nog niet waargenomen.

De huidige dispatcher is begrensd op 100 apparaten en 1000 rijen per eigenaar.
Bij meer gegevens stopt hij expliciet; schaalvergroting vraagt paginering.

Geen wijzigingen naar GitHub Pages/main of de klantdatabase publiceren op basis
van alleen dit document. Controleer eerst de geslaagde CI-run van de uiteindelijke
commit en de online testomgeving. De klantendienst heeft eigen configuratie en
vraagt een afzonderlijke controle bij vrijgave.
