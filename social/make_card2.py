#!/usr/bin/env python3
"""
Share card built around the illustration, plus a simulation of what the link
preview actually looks like when pasted into LinkedIn or WhatsApp.

The simulation exists so the card can be judged the way people will meet it,
small and next to other posts, rather than full width on a screen.
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

PAPER="#f3efe4"; INK="#1b2a24"; INK_SOFT="#4a5a51"
GREEN="#1d6e4f"; GREEN_DEEP="#0f4d36"; GOLD="#e0a324"; LINE="#d8d1bf"

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

def paper(w,h):
    img=Image.new("RGB",(w,h),PAPER)
    d=ImageDraw.Draw(img,"RGBA")
    for y in range(0,h,5): d.line([(0,y),(w,y)],fill=(27,42,36,4))
    return img.convert("RGBA")

def share_card(illo, out):
    """1200x630. Illustration right, one big line left."""
    W,H=1200,630
    img=paper(W,H)
    d=ImageDraw.Draw(img)

    # illustration bleeding off the right edge, softly feathered into the paper
    iw=int(W*0.46)
    im=Image.open(illo).convert("RGB")
    sc=max(iw/im.width, H/im.height)
    im=im.resize((int(im.width*sc)+1,int(im.height*sc)+1),Image.LANCZOS)
    left=(im.width-iw)//2
    im=im.crop((left,0,left+iw,H))
    mask=Image.new("L",(iw,H),255)
    md=ImageDraw.Draw(mask)
    for i in range(140):                       # fade the inner edge
        md.line([(i,0),(i,H)],fill=int(255*i/140))
    img.paste(im,(W-iw,0),mask)

    d.rectangle([0,0,10,H],fill=GOLD)

    M=70; col=W-iw-M-70
    d.text((M,86),"WARM OUTREACH . HUMAN VOICE",font=font(MONO,20),fill=INK_SOFT)
    fh=font(SERIF_B,54); y=134
    for ln in wrap(d,"Where robots don't eat your words.",fh,col):
        d.text((M,y),ln,font=fh,fill=INK); y+=66
    d.rectangle([M,y+14,M+120,y+21],fill=GOLD); y+=60
    fb=font(SERIF,24)
    for ln in wrap(d,"Write one real detail. Get an opening line a human would send.",fb,col):
        d.text((M,y),ln,font=fb,fill=INK_SOFT); y+=35

    d.text((M,H-96),"warmline.dataaccordingtome.com",font=font(MONO,22),fill=INK_SOFT)
    d.text((M,H-60),"15 FREE WARMLINES . NO SIGNUP",font=font(MONO,21),fill=GREEN)
    img.convert("RGB").save(out,"PNG",optimize=True); return out

def preview_sim(card, out):
    """What the link looks like pasted into a feed. Not for publishing."""
    W,H=1000,860
    bg=Image.new("RGB",(W,H),"#f4f2ee")
    d=ImageDraw.Draw(bg)
    d.text((40,34),"This is what people see when you paste the link",
           font=font(SANS_B,24),fill="#3b3b3b")
    d.text((40,68),"LinkedIn, WhatsApp, Slack and iMessage all render it this way",
           font=font(SANS,18),fill="#7a7a7a")

    cw=760; cx=(W-cw)//2; cy=130
    ch_img=int(cw*630/1200)
    card_im=Image.open(card).convert("RGB").resize((cw,ch_img),Image.LANCZOS)

    panel_h=ch_img+150
    d.rounded_rectangle([cx-1,cy-1,cx+cw+1,cy+panel_h+1],radius=10,fill="#dcdcdc")
    d.rounded_rectangle([cx,cy,cx+cw,cy+panel_h],radius=10,fill="#ffffff")
    bg.paste(card_im,(cx,cy))
    d.line([(cx,cy+ch_img),(cx+cw,cy+ch_img)],fill="#e4e4e4")

    ty=cy+ch_img+22
    d.text((cx+22,ty),"WARMLINE.DATAACCORDINGTOME.COM",font=font(SANS,15),fill="#8b8b8b")
    ty+=26
    ft=font(SANS_B,23)
    for ln in wrap(d,"Where robots don't eat your words.",ft,cw-44):
        d.text((cx+22,ty),ln,font=ft,fill="#1a1a1a"); ty+=30
    fd=font(SANS,18)
    for ln in wrap(d,"Write one real detail about someone you want to reach. "
                     "Get an opening line a human would send. Free, no signup.",fd,cw-44)[:2]:
        d.text((cx+22,ty),ln,font=fd,fill="#6b6b6b"); ty+=25

    bg.save(out,"PNG",optimize=True); return out

if __name__=="__main__":
    illo,outdir=sys.argv[1],sys.argv[2].rstrip("/")
    c=share_card(illo,outdir+"/share-card.png")
    print(c); print(preview_sim(c,outdir+"/what-people-see.png"))
