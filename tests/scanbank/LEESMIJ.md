# Scannertestbank

Voorbeeldkaarten met **verzonnen personen** (geen echte gegevens): 3 Marokkaanse CIN's, 2 Marokkaanse rijbewijzen, 6 paspoorten (MAR, FRA, NLD, ESP, BEL, USA). Strookletter OCR-B, geldige controlecijfers. Van elke kaart 5 telefoonfoto's: goed, scheef, ver, donker, staand.

Opnieuw meten (± 15 min):
```
cd tests/scanbank
curl -sL -o ocrb.zip https://mirrors.ctan.org/fonts/ocr-b-outline.zip && unzip -q ocrb.zip   # vrij lettertype OCR-B
mkdir -p png fotos && node maak.mjs && python3 fotos.py
node scan.mjs "" "-nieuw"      # elke foto door de app, zoals op een telefoon
```
`uitslag-voor.json` = vóór de verbeteringen (4 oktober), `uitslag-na.json` = erna. Telt alleen de **eigen lezer** van de app; de slimme scan (Claude) vraagt een login.
