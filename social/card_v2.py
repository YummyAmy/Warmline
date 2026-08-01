#!/usr/bin/env python3
"""Phone on the left with the girl on its screen, copy on the right, light marble."""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

PAPER="#f3efe4"; INK="#1b2a24"; INK_SOFT="#4a5a51"
GREEN="#1d6e4f"; GREEN_DEEP="#0f4d36"; GOLD="#e0a324"
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

def marble(w,h,seed=5,strength=0.55):
    rng=np.random.default_rng(seed); tot=np.zeros((h,w),np.float32); amp=1.
    for o in range(6):
        r=max(2,2**(o+2))
        tot+=np.asarray(Image.fromarray((rng.random((r,r))*255).astype(np.uint8))
                        .resize((w,h),Image.BICUBIC),np.float32)/255.*amp; amp*=.5
    tot=(tot-tot.min())/(tot.max()+1e-9)
    yy,xx=np.mgrid[0:h,0:w].astype(np.float32)
    v=np.sin((xx/w*7+yy/h*4+tot*3.2)*np.pi); v=((v+1)/2)**1.7
    v=np.asarray(Image.fromarray((v*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.4)),np.float32)/255.
    v*=strength
    base=np.array([243,239,228],np.float32); vein=np.array([228,221,204],np.float32)
    img=base[None,None,:]*(1-v[...,None])+vein[None,None,:]*v[...,None]
    return Image.fromarray(np.clip(img,0,255).astype(np.uint8)).convert("RGBA")

GIRL_BOX=(180,1360,1010,2290)
def girl(src,tol=64):
    im=Image.open(src).convert("RGB").crop(GIRL_BOX)
    a=np.asarray(im,np.int16); h,w,_=a.shape
    pts=[(4,4),(4,w-5),(h-5,4),(h-5,w-5),(h//2,4),(4,w//2),(h-5,w//2),(h//3,w-5)]
    m=np.zeros((h,w),bool)
    for y,x in pts: m|=(np.abs(a-a[y,x]).sum(axis=2)<tol)
    al=np.where(m,0,255).astype(np.uint8)
    al=np.asarray(Image.fromarray(al).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.0)))
    im=Image.fromarray(np.dstack([a.astype(np.uint8),al]),"RGBA")
    bb=im.getbbox()
    return im.crop(bb) if bb else im

def phone_with_girl(src,w,h):
    """Phone whose screen is the girl at work, on brand green."""
    bez=max(10,w//26); rad=w//7
    card=Image.new("RGBA",(w,h),(0,0,0,0)); d=ImageDraw.Draw(card)
    d.rounded_rectangle([0,0,w,h],radius=rad,fill="#14201b")
    sw,sh=w-bez*2,h-bez*2

    screen=Image.new("RGBA",(sw,sh),GREEN_DEEP)
    sd=ImageDraw.Draw(screen)
    # a soft lighter pool behind her so the screen isn't a flat slab
    sd.ellipse([-sw*0.3,sh*0.30,sw*1.3,sh*1.25],fill=(29,110,79,255))

    g=girl(src)
    gw=int(sw*0.94); g=g.resize((gw,int(g.height*gw/g.width)),Image.LANCZOS)
    screen.alpha_composite(g,((sw-gw)//2,int(sh*0.62)-g.height//2+int(sh*0.06)))

    # the site's own words, at the top of the screen
    fh=font(SERIF_B,int(sw*0.105))
    y=int(sh*0.10)
    for ln in wrap(sd,"Don't overthink it.",fh,int(sw*0.86)):
        sd.text(((sw-tw(sd,ln,fh))//2,y),ln,font=fh,fill=PAPER); y+=int(sw*0.13)
    for ln in wrap(sd,"Just send it.",fh,int(sw*0.86)):
        sd.text(((sw-tw(sd,ln,fh))//2,y),ln,font=fh,fill=GOLD); y+=int(sw*0.13)
    bw2,bh2=int(sw*0.74),int(sh*0.075)
    bx2,by2=(sw-bw2)//2,y+int(sh*0.02)
    sd.rounded_rectangle([bx2,by2,bx2+bw2,by2+bh2],radius=bh2//2,fill=GOLD)
    fb=font(SERIF_B,int(bh2*0.36))
    sd.text((bx2+bw2//2, by2+bh2//2), "Write my warmline",
            font=fb, fill=INK, anchor="mm")

    m=Image.new("L",(sw,sh),0)
    ImageDraw.Draw(m).rounded_rectangle([0,0,sw,sh],radius=rad-bez//2,fill=255)
    card.paste(screen,(bez,bez),m)
    nw,nh=w//3,max(7,h//85); nx=(w-nw)//2
    d.rounded_rectangle([nx,bez//2,nx+nw,bez//2+nh],radius=nh//2,fill="#14201b")
    return card

def shadow(base,card,xy,blur=34,alpha=95,off=(16,22)):
    s=Image.new("RGBA",base.size,(0,0,0,0))
    s.paste(Image.new("RGBA",card.size,(60,52,36,alpha)),(xy[0]+off[0],xy[1]+off[1]),card)
    base.alpha_composite(s.filter(ImageFilter.GaussianBlur(blur)))

def build(src,out,W=1200,H=630):
    img=marble(W,H); d=ImageDraw.Draw(img)
    d.rectangle([0,0,W,9],fill=GOLD)

    pw=300; ph=int(pw*2.03)
    px,py=86,(H-ph)//2
    c=phone_with_girl(src,pw,ph)
    shadow(img,c,(px,py)); img.alpha_composite(c,(px,py))

    M=px+pw+86; col=W-M-70
    d.text((M,146),"WARM OUTREACH . HUMAN VOICE",font=font(MONO,19),fill=INK_SOFT)
    fh=font(SERIF_B,44); y=186
    for ln in wrap(d,"Where robots don't eat your words.",fh,col):
        d.text((M,y),ln,font=fh,fill=INK); y+=55
    d.rectangle([M,y+14,M+108,y+21],fill=GOLD); y+=54
    for ln in wrap(d,"Write one real detail. Get an opening line a human would send.",font(SERIF,22),col):
        d.text((M,y),ln,font=font(SERIF,22),fill=INK_SOFT); y+=32
    y+=34
    d.text((M,y),"warmline.dataaccordingtome.com",font=font(MONO,20),fill=INK_SOFT); y+=32
    d.text((M,y),"15 FREE WARMLINES . NO SIGNUP",font=font(MONO,19),fill=GREEN)
    img.convert("RGB").save(out,"PNG",optimize=True); return out

if __name__=="__main__":
    print(build(sys.argv[1],sys.argv[2]))
