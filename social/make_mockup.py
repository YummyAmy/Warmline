#!/usr/bin/env python3
"""
Warmline device mockup. Real screenshot inside a drawn phone, on brand
background, with the three steps beside it. Same idea as the Canva
"3 easy steps" template, except the screen is the actual product.

Swap SHOT for a fresh screenshot after pushing, and rerun.
"""
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

PAPER      = "#f3efe4"
INK        = "#1b2a24"
INK_SOFT   = "#4a5a51"
GREEN      = "#1d6e4f"
GREEN_DEEP = "#0f4d36"
GOLD       = "#e0a324"
PINK       = "#d85a7a"
LINE       = "#d8d1bf"

F = "/usr/share/fonts/truetype/dejavu/"
SERIF, SERIF_B, SERIF_I = F+"DejaVuSerif.ttf", F+"DejaVuSerif-Bold.ttf", F+"DejaVuSerif-Italic.ttf"
MONO, MONO_B = F+"DejaVuSansMono.ttf", F+"DejaVuSansMono-Bold.ttf"

def font(p, s): return ImageFont.truetype(p, s)
def tw(d, s, f): return d.textbbox((0,0), s, font=f)[2]

def wrap(d, s, f, w):
    out, cur = [], ""
    for word in s.split():
        t = (cur+" "+word).strip()
        if tw(d, t, f) <= w: cur = t
        else:
            if cur: out.append(cur)
            cur = word
    if cur: out.append(cur)
    return out

def canvas(w, h, bg):
    """Cream panel with a faint texture. Built in RGB so the grain blends
    properly, then handed back as RGBA for compositing the phone on top."""
    img = Image.new("RGB", (w, h), bg)
    d = ImageDraw.Draw(img, "RGBA")
    for y in range(0, h, 5):
        d.line([(0,y),(w,y)], fill=(27,42,36,5))
    return img.convert("RGBA")

def phone(shot_path, w, h, crop_top=0.0):
    """Draw a phone with the screenshot inside. Returns an RGBA image."""
    bezel = max(10, w // 26)
    radius = w // 7
    card = Image.new("RGBA", (w, h), (0,0,0,0))
    d = ImageDraw.Draw(card)
    # body
    d.rounded_rectangle([0,0,w,h], radius=radius, fill="#14201b")
    # screen area
    sx0, sy0, sx1, sy1 = bezel, bezel, w-bezel, h-bezel
    sw, sh = sx1-sx0, sy1-sy0

    shot = Image.open(shot_path).convert("RGB")
    # A phone screenshot is already phone width, so fit by WIDTH only and
    # then take a vertical slice. Cover-fitting both axes zooms it to mush.
    scale = sw / shot.width
    shot = shot.resize((sw, max(1, int(shot.height*scale))), Image.LANCZOS)
    top = int(shot.height * crop_top)
    if top + sh > shot.height:
        top = max(0, shot.height - sh)
    shot = shot.crop((0, top, sw, min(shot.height, top+sh)))
    if shot.height < sh:  # short screenshot, pad with page cream
        pad = Image.new("RGB", (sw, sh), PAPER)
        pad.paste(shot, (0,0))
        shot = pad

    mask = Image.new("L", (sw,sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0,0,sw,sh], radius=radius-bezel//2, fill=255)
    card.paste(shot, (sx0,sy0), mask)

    # notch
    nw, nh = w//3, max(8, h//90)
    nx = (w-nw)//2
    d.rounded_rectangle([nx, bezel//2, nx+nw, bezel//2+nh], radius=nh//2, fill="#14201b")
    return card

def shadow(base, card, xy, blur=26, alpha=70, offset=(10,16)):
    sh = Image.new("RGBA", base.size, (0,0,0,0))
    solid = Image.new("RGBA", card.size, (17,30,24,alpha))
    sh.paste(solid, (xy[0]+offset[0], xy[1]+offset[1]), card)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(sh)

STEPS = [
    ("01", "Drop in who you're reaching",
     "Name, company, and one real detail."),
    ("02", "Pick a tone for that person",
     "Warm, Direct, Technical or Executive."),
    ("03", "Get your warmline",
     "One or two sentences. Send it."),
]

def steps_mockup(shot_path, out):
    """1080x1350 portrait. The layout you liked, with your product on screen."""
    W, H = 1080, 1350
    img = canvas(W, H, PAPER)
    d = ImageDraw.Draw(img)
    d.rectangle([0,0,W,12], fill=GOLD)

    M = 76
    # header
    fk = font(MONO, 23)
    d.text((M, 66), "COLD OUTREACH, WITHOUT THE ROBOT", font=fk, fill=INK_SOFT)
    fh = font(SERIF_B, 60)
    d.text((M, 108), "Three steps to a", font=fh, fill=INK)
    d.text((M, 176), "warmline.", font=fh, fill=GREEN)
    d.rectangle([M, 254, M+128, 261], fill=GOLD)

    # phone on the right
    pw, ph = 392, 800
    px, py = W - M - pw, 300
    card = phone(shot_path, pw, ph, crop_top=0.015)
    shadow(img, card, (px,py))
    img.alpha_composite(card, (px,py))

    # steps on the left
    x = M
    y = 322
    fn = font(SERIF_B, 46)
    ft = font(SERIF_B, 29)
    fb = font(SERIF, 24)
    col_w = px - M - 56
    for num, title, body in STEPS:
        d.text((x, y), num, font=fn, fill=GOLD)
        y += 62
        for ln in wrap(d, title, ft, col_w):
            d.text((x, y), ln, font=ft, fill=INK); y += 38
        y += 6
        for ln in wrap(d, body, fb, col_w):
            d.text((x, y), ln, font=fb, fill=INK_SOFT); y += 34
        y += 44

    # footer
    d.line([(M, H-150),(W-M, H-150)], fill=LINE, width=2)
    d.text((M, H-118), "warmline.dataaccordingtome.com", font=font(MONO,27), fill=INK_SOFT)
    d.text((M, H-72), "YOUR FIRST 15 WARMLINES ARE ON US", font=font(MONO,23), fill=GREEN)

    img.convert("RGB").save(out, "PNG", optimize=True)
    return out

def hero_mockup(shot_path, out):
    """1080x1080. One phone, big claim, nothing else."""
    W = H = 1080
    img = canvas(W, H, GREEN_DEEP)
    d = ImageDraw.Draw(img)
    d.rectangle([0,0,int(W*0.52),H], fill=PAPER)

    M = 68
    fk = font(MONO, 21)
    d.text((M, 150), "WARMLINE", font=font(MONO_B,26), fill=GREEN_DEEP)
    fh = font(SERIF_B, 54)
    y = 210
    for ln in wrap(d, "Don't overthink it.", fh, int(W*0.52)-M*2):
        d.text((M,y), ln, font=fh, fill=INK); y += 66
    for ln in wrap(d, "Just send it.", fh, int(W*0.52)-M*2):
        d.text((M,y), ln, font=fh, fill=GREEN); y += 66
    d.rectangle([M, y+16, M+112, y+23], fill=GOLD)
    y += 62
    fb = font(SERIF, 25)
    for ln in wrap(d, "Write one real detail. Get a first line that "
                      "sounds like a person wrote it.", fb, int(W*0.52)-M*2-20):
        d.text((M,y), ln, font=fb, fill=INK_SOFT); y += 36

    d.text((M, H-140), "warmline", font=font(MONO,24), fill=INK_SOFT)
    d.text((M, H-104), ".dataaccordingtome.com", font=font(MONO,24), fill=INK_SOFT)

    pw, ph = 360, 736
    px, py = int(W*0.60), (H-ph)//2
    card = phone(shot_path, pw, ph, crop_top=0.02)
    shadow(img, card, (px,py), alpha=95)
    img.alpha_composite(card, (px,py))

    img.convert("RGB").save(out, "PNG", optimize=True)
    return out

if __name__ == "__main__":
    shot, outdir = sys.argv[1], sys.argv[2].rstrip("/")
    print(steps_mockup(shot, outdir + "/warmline-steps-mockup.png"))
    print(hero_mockup(shot,  outdir + "/warmline-hero-mockup.png"))
