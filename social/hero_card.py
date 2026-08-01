#!/usr/bin/env python3
"""Hero card = the phone mockup + the girl + faint marble. Nothing else changed."""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

PAPER="#f3efe4"; INK="#1b2a24"; INK_SOFT="#4a5a51"
GREEN="#1d6e4f"; GREEN_DEEP="#0f4d36"; GOLD="#e0a324"; PALE="#cfe0d6"
F="/usr/share/fonts/truetype/dejavu/"
SERIF,SERIF_B=F+"DejaVuSerif.ttf",F+"DejaVuSerif-Bold.ttf"; MONO=F+"DejaVuSansMono.ttf"

def font(p,s): return ImageFont.truetype(p,s)
def tw(d,s,f): return d.textbbox((0,0),s,font=f)[2]
def wrap(d,s,f,w):
    o,c=[],""
    for x in s.split():
        t=(c+" "+x).strip()
        if tw(d,t,f)<=w: c=t
        else:
            if c: o.append(c)
            c=x
    if c: o.append(c)
    return o

def marble(w,h,seed=5):
    rng=np.random.default_rng(seed); tot=np.zeros((h,w),np.float32); amp=1.0
    for o in range(6):
        r=max(2,2**(o+2))
        lay=np.asarray(Image.fromarray((rng.random((r,r))*255).astype(np.uint8))
                       .resize((w,h),Image.BICUBIC),np.float32)/255.
        tot+=lay*amp; amp*=0.5
    tot=(tot-tot.min())/(tot.max()+1e-9)
    yy,xx=np.mgrid[0:h,0:w].astype(np.float32)
    v=np.sin((xx/w*8+yy/h*5+tot*3.0)*np.pi); v=((v+1)/2)**1.6
    v=np.asarray(Image.fromarray((v*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.3)),np.float32)/255.
    base=np.array([243,239,228],np.float32); vein=np.array([236,231,217],np.float32)
    img=base[None,None,:]*(1-v[...,None])+vein[None,None,:]*v[...,None]
    return Image.fromarray(np.clip(img,0,255).astype(np.uint8)).convert("RGBA")

GIRL_BOX=(180,1360,1010,2290)
def girl_cutout(src,tol=64):
    im=Image.open(src).convert("RGB").crop(GIRL_BOX)
    a=np.asarray(im,np.int16); h,w,_=a.shape
    pts=[(4,4),(4,w-5),(h-5,4),(h-5,w-5),(h//2,4),(4,w//2),(h-5,w//2),(h//3,w-5)]
    m=np.zeros((h,w),bool)
    for y,x in pts: m|=(np.abs(a-a[y,x]).sum(axis=2)<tol)
    alpha=np.where(m,0,255).astype(np.uint8)
    alpha=np.asarray(Image.fromarray(alpha).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.0)))
    out=np.dstack([a.astype(np.uint8),alpha])
    im=Image.fromarray(out,"RGBA")
    bb=im.getbbox()
    return im.crop(bb) if bb else im

def phone(shot,w,h,crop_top=0.0,trim=(0.0,0.0)):
    bez=max(9,w//28); rad=w//7
    card=Image.new("RGBA",(w,h),(0,0,0,0)); d=ImageDraw.Draw(card)
    d.rounded_rectangle([0,0,w,h],radius=rad,fill="#14201b")
    sw,sh=w-bez*2,h-bez*2
    im=Image.open(shot).convert("RGB")
    im=im.crop((0,int(im.height*trim[0]),im.width,int(im.height*(1-trim[1]))))
    # a phone screenshot is already phone width: fit by width, slice vertically
    im=im.resize((sw,int(im.height*sw/im.width)),Image.LANCZOS)
    top=min(int(im.height*crop_top),max(0,im.height-sh))
    im=im.crop((0,top,sw,min(im.height,top+sh)))
    if im.height<sh:
        p2=Image.new("RGB",(sw,sh),GREEN_DEEP); p2.paste(im,(0,0)); im=p2
    m=Image.new("L",(sw,sh),0)
    ImageDraw.Draw(m).rounded_rectangle([0,0,sw,sh],radius=rad-bez//2,fill=255)
    card.paste(im,(bez,bez),m)
    nw,nh=w//3,max(6,h//95); nx=(w-nw)//2
    d.rounded_rectangle([nx,bez//2,nx+nw,bez//2+nh],radius=nh//2,fill="#14201b")
    return card

def shadow(base,card,xy,blur=30,alpha=105,off=(12,18)):
    s=Image.new("RGBA",base.size,(0,0,0,0))
    s.paste(Image.new("RGBA",card.size,(8,26,18,alpha)),(xy[0]+off[0],xy[1]+off[1]),card)
    base.alpha_composite(s.filter(ImageFilter.GaussianBlur(blur)))

def build(shot,out,W=1200,H=630):
    img=marble(W,H)
    d=ImageDraw.Draw(img)
    gx0=int(W*0.60)
    d.rectangle([gx0,0,W,H],fill=GREEN_DEEP)
    d.rectangle([0,0,W,9],fill=GOLD)

    # size the phone to the screenshot so the screen is never part empty
    TRIM=(0.085,0.105)
    _sh=Image.open(shot); _bez=max(9,250//28)
    _asp=(_sh.height*(1-TRIM[0]-TRIM[1]))/_sh.width
    pw=250; ph=int((pw-2*_bez)*_asp)+2*_bez
    px,py=gx0+int((W-gx0-pw)/2)+18,(H-ph)//2
    c=phone(shot,pw,ph,crop_top=0.0,trim=TRIM)
    shadow(img,c,(px,py)); img.alpha_composite(c,(px,py))

    g=girl_cutout(shot)
    gh=252; g=g.resize((int(g.width*gh/g.height),gh),Image.LANCZOS)
    img.alpha_composite(g,(gx0-int(g.width*0.62),H-gh-8))

    M=66; col=gx0-M-190
    d.text((M,86),"WARM OUTREACH . HUMAN VOICE",font=font(MONO,19),fill=INK_SOFT)
    fh=font(SERIF_B,46); y=130
    for ln in wrap(d,"Where robots don't eat your words.",fh,col):
        d.text((M,y),ln,font=fh,fill=INK); y+=57
    d.rectangle([M,y+14,M+110,y+21],fill=GOLD); y+=56
    for ln in wrap(d,"Write one real detail. Get an opening line a human would send.",font(SERIF,22),col):
        d.text((M,y),ln,font=font(SERIF,22),fill=INK_SOFT); y+=32
    d.text((M,H-92),"warmline.dataaccordingtome.com",font=font(MONO,21),fill=INK_SOFT)
    d.text((M,H-58),"15 FREE WARMLINES . NO SIGNUP",font=font(MONO,20),fill=GREEN)
    img.convert("RGB").save(out,"PNG",optimize=True); return out

if __name__=="__main__":
    print(build(sys.argv[1],sys.argv[2]))
