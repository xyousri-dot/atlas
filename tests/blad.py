"""Zet de bewegingsbeelden per beweging op één blad: rijen = talen, kolommen = begin/midden/eind."""
import sys
from PIL import Image, ImageDraw
naam = sys.argv[1]; map_ = "schermen/beweging/"
talen = ["fr", "ar", "nl"]; delen = ["begin", "midden", "eind"]
W, H = 260, 563
blad = Image.new("RGB", (W * 3 + 40, (H + 26) * 3), "white"); d = ImageDraw.Draw(blad)
for r, t in enumerate(talen):
    for k, dl in enumerate(delen):
        im = Image.open(f"{map_}{naam}-{t}-{dl}.png").convert("RGB").resize((W, H))
        blad.paste(im, (k * (W + 20), r * (H + 26) + 22))
        d.text((k * (W + 20) + 4, r * (H + 26) + 4), f"{t.upper()} · {dl}", fill=(0, 0, 0))
blad.save(f"{map_}{naam}-blad.png")
