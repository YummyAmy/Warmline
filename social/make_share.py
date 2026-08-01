#!/usr/bin/env python3
"""
Warmline share card and marble marketing posts.

Marble is generated, not stock, so there's no licence to worry about and the
tones are pulled from the site palette. The browser chrome is drawn fresh and
the screenshot is auto-cropped below your real Chrome bars, so your bookmarks
and tabs never end up in a marketing image.
"""
import sys
import numpy as np
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

def font(p,s): return ImageFont.truetype(p,s)
def tw(d,s,f): return d.textbbox((0,0),s,font=f)[2]

def wrap(d,s,f,w):
    out,cur=[],""
    for word in s.split():
        t=(cur+" "+word).strip()
        if tw(d,t,f)<=w: cur=t
        else:
            if cur: out.append(cur)
            cur=word
    if cur: out.append(cur)
    return out

# ------------------------------------------------------------------- marble
def _fbm(h, w, octaves=6, seed=7):
    """Fractal noise: stack progressively finer random layers."""
    rng = np.random.default_rng(seed)
    total = np.zeros((h, w), np.float32)
    amp = 1.0
    for o in range(octaves):
        res = max(2, 2 ** (o + 2))
        small = rng.random((res, res)).astype(np.float32)
        layer = np.asarray(
            Image.fromarray((small * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC),
            np.float32) / 255.0
        total += layer * amp
        amp *= 0.5
    total -= total.min()
    return total / (total.max() + 1e-9)

def marble(w, h, seed=7, veins=5.0, turb=5.5, warm=True):
    """Cream marble with soft veining, in the site's palette."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    n = _fbm(h, w, seed=seed)
    # diagonal sine bands displaced by noise gives the classic vein look
    v = np.sin((xx / w * veins + yy / h * (veins * 0.6) + n * turb) * np.pi)
    v = (v + 1) / 2
    v = v ** 1.5                      # thin the veins, widen the fields
    v = np.asarray(Image.fromarray((v*255).astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(1.2)), np.float32)/255.0

    base = np.array([243, 239, 228], np.float32)      # paper
    vein = np.array([230, 222, 205], np.float32) if warm else np.array([205,205,205], np.float32)
    deep = np.array([203, 188, 160], np.float32)      # darker mineral streak

    img = base[None,None,:]*(1-v[...,None]) + vein[None,None,:]*v[...,None]
    # a few darker hairline streaks on top of the broad veining
    fine = (v > 0.90).astype(np.float32)
    fine = np.asarray(Image.fromarray((fine*255).astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(0.8)), np.float32)/255.0
    img = img*(1-fine[...,None]*0.34) + deep[None,None,:]*(fine[...,None]*0.34)

    return Image.fromarray(np.clip(img,0,255).astype(np.uint8), "RGB").convert("RGBA")

# ------------------------------------------------------------ browser frame
def auto_crop_chrome(path):
    """Drop the real browser chrome by finding the first mostly-light row."""
    im = Image.open(path).convert("RGB")
    a = np.asarray(im, np.float32).mean(axis=2)
    rows = a.mean(axis=1)
    start = 0
    for i, val in enumerate(rows):
        if val > 200:            # cream page begins
            start = i
            break
    return im.crop((0, start, im.width, im.height))

def browser(shot_path, w, h, radius=18):
    """Clean drawn window: bar, three dots, the page underneath."""
    card = Image.new("RGBA",(w,h),(0,0,0,0))
    d = ImageDraw.Draw(card)
    bar = max(26, h//16)
    d.rounded_rectangle([0,0,w,h], radius=radius, fill="#e8e3d6")
    d.rounded_rectangle([0,0,w,bar+radius], radius=radius, fill="#ded8c8")
    d.rectangle([0,bar,w,bar+2], fill="#cdc5b1")
    for i,c in enumerate(("#e0705f","#e3b34e","#63b177")):
        cx = 18 + i*20
        r = max(4, bar//5)
        d.ellipse([cx-r, bar//2-r, cx+r, bar//2+r], fill=c)

    shot = auto_crop_chrome(shot_path)
    sw, sh = w, h-bar
    scale = sw/shot.width
    shot = shot.resize((sw, max(1,int(shot.height*scale))), Image.LANCZOS)
    shot = shot.crop((0,0,sw,min(sh,shot.height)))
    if shot.height < sh:
        pad = Image.new("RGB",(sw,sh),PAPER); pad.paste(shot,(0,0)); shot = pad

    mask = Image.new("L",(sw,sh),0)
    ImageDraw.Draw(mask).rounded_rectangle([0,-radius,sw,sh], radius=radius, fill=255)
    card.paste(shot,(0,bar),mask)
    return card

def shadow(base, card, xy, blur=30, alpha=90, offset=(12,18)):
    sh = Image.new("RGBA", base.size, (0,0,0,0))
    solid = Image.new("RGBA", card.size, (40,34,24,alpha))
    sh.paste(solid,(xy[0]+offset[0], xy[1]+offset[1]), card)
    base.alpha_composite(sh.filter(ImageFilter.GaussianBlur(blur)))

# ------------------------------------------------------------------- pieces
def share_card(shot, out):
    """1200x630 og:image. Marble, real product, one claim."""
    W,H = 1200,630
    img = marble(W,H,seed=11,veins=9.0,turb=3.0)
    d = ImageDraw.Draw(img)

    bw, bh = 620, 400
    bx, by = W-bw+60, (H-bh)//2
    card = browser(shot, bw, bh)
    shadow(img, card, (bx,by))
    img.alpha_composite(card,(bx,by))

    M = 68
    col = bx - M - 40
    d.text((M,92), "COLD OUTREACH . HUMAN VOICE", font=font(MONO,20), fill=INK_SOFT)
    fh = font(SERIF_B,46); y=140
    for ln in wrap(d,"Don't overthink it.",fh,col):
        d.text((M,y),ln,font=fh,fill=INK); y+=58
    for ln in wrap(d,"Just send it.",fh,col):
        d.text((M,y),ln,font=fh,fill=GREEN); y+=58
    d.rectangle([M,y+14,M+112,y+21], fill=GOLD)
    y+=58
    fb = font(SERIF,23)
    for ln in wrap(d,"Write one real detail. Get a first line that sounds "
                     "like a person wrote it.",fb,col):
        d.text((M,y),ln,font=fb,fill=INK_SOFT); y+=33

    d.text((M,H-92), "warmline.dataaccordingtome.com", font=font(MONO,22), fill=INK_SOFT)
    d.text((M,H-58), "15 FREE WARMLINES", font=font(MONO,21), fill=GREEN)
    img.convert("RGB").save(out,"PNG",optimize=True); return out

def marble_post(shot, out):
    """1080x1080 marble post for LinkedIn and Instagram."""
    W=H=1080
    img = marble(W,H,seed=23,veins=7.0,turb=3.4)
    d = ImageDraw.Draw(img)
    M=84

    d.text((M,110), "WARMLINE", font=font(MONO_B,26), fill=GREEN_DEEP)
    fh=font(SERIF_B,60); y=164
    for ln in wrap(d,"Your cold email dies on the first line.",fh,W-M*2):
        d.text((M,y),ln,font=fh,fill=INK); y+=74
    d.text((M,y+10),"So write that one properly.",font=font(SERIF_I,30),fill=PINK)

    bw,bh = W-M*2, 470
    bx,by = M, y+90
    card = browser(shot,bw,bh)
    shadow(img,card,(bx,by))
    img.alpha_composite(card,(bx,by))

    d.text((M,H-140), "warmline.dataaccordingtome.com", font=font(MONO,26), fill=INK_SOFT)
    d.text((M,H-96), "YOUR FIRST 15 WARMLINES ARE ON US", font=font(MONO,23), fill=GREEN)
    img.convert("RGB").save(out,"PNG",optimize=True); return out

if __name__ == "__main__":
    shot, outdir = sys.argv[1], sys.argv[2].rstrip("/")
    print(share_card(shot, outdir+"/share-card.png"))
    print(marble_post(shot, outdir+"/warmline-marble-post.png"))
