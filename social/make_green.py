#!/usr/bin/env python3
"""
Green share card, using the illustration that already lives on the site.

Lifted straight out of a phone screenshot of the green panel, so the girl,
the yellow laptop and the deep green all match what a visitor lands on.
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

PAPER="#f3efe4"; INK="#1b2a24"
GREEN="#1d6e4f"; GREEN_DEEP="#0f4d36"; GOLD="#e0a324"
PALE="#cfe0d6"

F="/usr/share/fonts/truetype/dejavu/"
SERIF,SERIF_B,SERIF_I=F+"DejaVuSerif.ttf",F+"DejaVuSerif-Bold.ttf",F+"DejaVuSerif-Italic.ttf"
MONO,MONO_B=F+"DejaVuSansMono.ttf",F+"DejaVuSansMono-Bold.ttf"
SANS,SANS_B=F+"DejaVuSans.ttf",F+"DejaVuSans-Bold.ttf"

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

# Where the girl sits inside IMG_5005 (1206x2622), measured off the screenshot
GIRL_BOX = (180, 1360, 1010, 2290)

def cut_girl(src, flat="#0f4d36", tol=46):
    """Crop her out and flatten the panel behind her.

    The site layers translucent green blocks over that section, so a raw crop
    carries visible rectangle seams. Any pixel close to one of the background
    greens gets replaced with flat brand green; she survives because her teal,
    skin and yellow are nowhere near those samples."""
    im = Image.open(src).convert("RGB").crop(GIRL_BOX)
    a = np.asarray(im, np.int16)
    h, w, _ = a.shape
    # sample the corners and edges, which are always background
    pts = [(4,4), (4,w-5), (h-5,4), (h-5,w-5), (h//2,4), (4,w//2), (h-5,w//2)]
    samples = [a[y,x] for y,x in pts]
    target = np.array([int(flat[i:i+2],16) for i in (1,3,5)], np.int16)
    mask = np.zeros((h,w), bool)
    for smp in samples:
        mask |= (np.abs(a - smp).sum(axis=2) < tol)
    out = a.copy()
    out[mask] = target
    res = out.astype(np.float32)
    # Darken her skin. Skin reads as the warm, mid-bright pixels (R noticeably
    # above B, not the bright yellow laptop and not the teal outfit). Deepen
    # those toward brown by dropping brightness and nudging red up, green down.
    R,G,B = res[...,0],res[...,1],res[...,2]
    val = (R+G+B)/3
    skin = (~mask) & (R > B+8) & (val > 55) & (val < 150)
    res[...,0][skin] = np.clip(R[skin]*0.82 + 10, 0,255)   # keep red, deepen
    res[...,1][skin] = np.clip(G[skin]*0.66, 0,255)        # pull the green wash out
    res[...,2][skin] = np.clip(B[skin]*0.70, 0,255)        # darker overall
    return Image.fromarray(np.clip(res,0,255).astype(np.uint8))

def green_card(src, out, W=1200, H=630):
    img = Image.new("RGB",(W,H),GREEN_DEEP)
    d = ImageDraw.Draw(img,"RGBA")
    for y in range(0,H,5): d.line([(0,y),(W,y)],fill=(255,255,255,4))
    d = ImageDraw.Draw(img)

    girl = cut_girl(src)
    gw = int(W*0.40)
    sc = gw/girl.width
    girl = girl.resize((gw,int(girl.height*sc)),Image.LANCZOS)
    if girl.height > H: girl = girl.crop((0,girl.height-H,gw,girl.height))
    gx, gy = W-gw-10, H-girl.height

    # feather the left edge so she melts into the panel instead of sitting in a box
    mask = Image.new("L",(gw,girl.height),255)
    md = ImageDraw.Draw(mask)
    for i in range(150): md.line([(i,0),(i,girl.height)],fill=int(255*i/150))
    img.paste(girl,(gx,gy),mask)

    d.rectangle([0,0,W,9],fill=GOLD)

    M=72; col=gx-M-40
    d.text((M,84),"WARM OUTREACH . HUMAN VOICE",font=font(MONO,20),fill=GOLD)
    fh=font(SERIF_B,52); y=132
    for ln in wrap(d,"Where robots don't eat your words.",fh,col):
        d.text((M,y),ln,font=fh,fill=PAPER); y+=64
    d.rectangle([M,y+16,M+118,y+23],fill=GOLD); y+=62
    fb=font(SERIF,23)
    for ln in wrap(d,"Write one real detail. Get an opening line a human would send.",fb,col):
        d.text((M,y),ln,font=fb,fill=PALE); y+=34

    d.text((M,H-94),"warmline.dataaccordingtome.com",font=font(MONO,22),fill=PALE)
    d.text((M,H-58),"15 FREE WARMLINES . NO SIGNUP",font=font(MONO,21),fill=GOLD)
    img.save(out,"PNG",optimize=True); return out

def preview_sim(card, out, note="This is the picture. The white box under it is LinkedIn's, not ours."):
    W,H=1000,880
    bg=Image.new("RGB",(W,H),"#f4f2ee"); d=ImageDraw.Draw(bg)
    d.text((40,34),"How the link shows up when pasted",font=font(SANS_B,24),fill="#3b3b3b")
    d.text((40,68),note,font=font(SANS,17),fill="#7a7a7a")
    cw=760; cx=(W-cw)//2; cy=130
    ih=int(cw*630/1200)
    bg.paste(Image.open(card).convert("RGB").resize((cw,ih),Image.LANCZOS),(cx,cy))
    ph=ih+150
    d.rounded_rectangle([cx-1,cy-1,cx+cw+1,cy+ph+1],radius=10,outline="#dcdcdc",width=2)
    d.rectangle([cx,cy+ih,cx+cw,cy+ph],fill="#ffffff")
    d.line([(cx,cy+ih),(cx+cw,cy+ih)],fill="#e4e4e4")
    ty=cy+ih+22
    d.text((cx+22,ty),"WARMLINE.DATAACCORDINGTOME.COM",font=font(SANS,15),fill="#8b8b8b"); ty+=26
    ft=font(SANS_B,23)
    for ln in wrap(d,"Where robots don't eat your words.",ft,cw-44):
        d.text((cx+22,ty),ln,font=ft,fill="#1a1a1a"); ty+=30
    fd=font(SANS,18)
    for ln in wrap(d,"Write one real detail about someone you want to reach. "
                     "Get an opening line a human would send. Free, no signup.",fd,cw-44)[:2]:
        d.text((cx+22,ty),ln,font=fd,fill="#6b6b6b"); ty+=25
    bg.save(out,"PNG",optimize=True); return out

if __name__=="__main__":
    src,outdir=sys.argv[1],sys.argv[2].rstrip("/")
    c=green_card(src,outdir+"/share-card.png")
    print(c); print(preview_sim(c,outdir+"/what-people-see.png"))
