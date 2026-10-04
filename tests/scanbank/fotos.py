"""Telefoonfoto's van de voorbeeldkaarten: kaart op een tafel, 5 situaties."""
import random, numpy as np
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw
random.seed(7); np.random.seed(7)
W, H = 1600, 1200

def tafel(w, h):
    """houtachtige ondergrond met wat licht en schaduw"""
    y = np.linspace(0, 1, h)[:, None]; x = np.linspace(0, 1, w)[None, :]
    nerf = (np.sin(x * 40 + np.sin(y * 7) * 3) * 12 + np.random.randn(h, w) * 6)
    basis = 120 + 40 * (1 - y) + nerf
    r = np.clip(basis + 35, 0, 255); g = np.clip(basis + 10, 0, 255); b = np.clip(basis - 20, 0, 255)
    return Image.fromarray(np.dstack([r, g, b]).astype("uint8"))

def coeffs(van, naar):
    """perspectief-coëfficiënten voor PIL (naar → van)"""
    m = []
    for (x, y), (u, v) in zip(naar, van):
        m.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); m.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    A = np.array(m, float); B = np.array(van, float).reshape(8)
    return np.linalg.solve(A, B).tolist()

def leg(kaart, breedte, hoek=0.0, kantel=0.0, w=W, h=H, dx=0, dy=0):
    k = kaart.convert("RGBA"); kw, kh = k.size; s = breedte * w / kw
    cw, ch = kw * s, kh * s; cx, cy = w / 2 + dx, h / 2 + dy
    hw, hh = cw / 2, ch / 2
    hoeken = [(-hw * (1 - kantel), -hh), (hw * (1 - kantel), -hh), (hw, hh), (-hw, hh)]
    a = np.radians(hoek); ca, sa = np.cos(a), np.sin(a)
    naar = [(cx + x * ca - y * sa, cy + x * sa + y * ca) for x, y in hoeken]
    van = [(0, 0), (kw, 0), (kw, kh), (0, kh)]
    beeld = k.transform((w, h), Image.PERSPECTIVE, coeffs(van, naar), Image.BICUBIC)
    # zachte schaduw onder de kaart
    sch = Image.new("L", (w, h), 0); ImageDraw.Draw(sch).polygon([(x + 10, y + 14) for x, y in naar], fill=110)
    sch = sch.filter(ImageFilter.GaussianBlur(14))
    t = tafel(w, h); t.paste((25, 20, 15), (0, 0), sch); t.paste(beeld, (0, 0), beeld)
    return t

def donker(img):
    img = ImageEnhance.Brightness(img).enhance(0.55); img = ImageEnhance.Contrast(img).enhance(0.8)
    a = np.asarray(img).astype(float) + np.random.randn(*np.asarray(img).shape) * 11
    return Image.fromarray(np.clip(a, 0, 255).astype("uint8")).filter(ImageFilter.GaussianBlur(1.1))

import json, os
waar = json.load(open("waarheid.json"))
docs = [d for d in waar]  # cin1..3, lic1..2, pas-*
for d in docs:
    bron = f"png/{d}-achter.png" if d.startswith(("cin", "lic")) else f"png/{d}.png"
    k = Image.open(bron)
    var = {
        "goed": leg(k, 0.72, hoek=1.5),
        "scheef": leg(k, 0.66, hoek=-8, kantel=0.12, dx=40),
        "ver": leg(k, 0.36, hoek=3, dx=-180, dy=90),
        "donker": donker(leg(k, 0.68, hoek=-2)),
        "staand": leg(k, 0.84, hoek=90, w=H, h=W),
    }
    for naam, img in var.items():
        img.convert("RGB").save(f"fotos/{d}-{naam}.jpg", quality=88)
print(len(os.listdir("fotos")), "foto's")
