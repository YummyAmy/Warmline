#!/usr/bin/env python3
"""THE share card (og:image), built as the hero design at 1200x630.
This is the file that shows when the link is pasted anywhere."""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

PAPER="#f3efe4"; INK="#1b2a24"; INK_SOFT="#4a5a51"
GREEN="#1d6e4f"; GREEN_DEEP="#0f4d36"; GOLD="#e0a324"
F="/usr/share/fonts/truetype/dejavu/"
SERIF,SERIF_B=F+"DejaVuSerif.ttf",F+"DejaVuSerif-Bold.ttf"
MONO,MONO_B=F+"DejaVuSansMono.ttf",F+"DejaVuSansMono-Bold.ttf"

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

def marble(w,h,seed=9):
    rng=np.random.default_rng(seed); tot=np.zeros((h,w),np.float32); amp=1.
    for o in range(6):
        r=max(2,2**(o+2))
        tot+=np.asarray(Image.fromarray((rng.random((r,r))*255).astype(np.uint8))
                        .resize((w,h),Image.BICUBIC),np.float32)/255.*amp; amp*=.5
    tot=(tot-tot.min())/(tot.max()+1e-9)
    yy,xx=np.mgrid[0:h,0:w].astype(np.float32)
    v=np.sin((xx/w*6+yy/h*4+tot*3.2)*np.pi); v=((v+1)/2)**1.7
    v=np.asarray(Image.fromarray((v*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)),np.float32)/255.*0.5
    base=np.array([243,239,228],np.float32); vein=np.array([227,220,202],np.float32)
    return Image.fromarray(np.clip(base[None,None,:]*(1-v[...,None])+vein[None,None,:]*v[...,None],0,255)
                           .astype(np.uint8)).convert("RGBA")

GIRL_BOX=(180,1360,1010,2290)
def girl_cutout(src,tol=64):
    im=Image.open(src).convert("RGB").crop(GIRL_BOX)
    a=np.asarray(im,np.int16); h,w,_=a.shape
    pts=[(4,4),(4,w-5),(h-5,4),(h-5,w-5),(h//2,4),(4,w//2),(h-5,w//2),(h//3,w-5)]
    m=np.zeros((h,w),bool)
    for y,x in pts: m|=(np.abs(a-a[y,x]).sum(axis=2)<tol)
    # darken skin -> brown
    res=a.astype(np.float32)
    R,G,B=res[...,0],res[...,1],res[...,2]; val=(R+G+B)/3
    skin=(~m)&(R>B+8)&(val>55)&(val<150)
    res[...,0][skin]=np.clip(R[skin]*0.82+10,0,255)
    res[...,1][skin]=np.clip(G[skin]*0.66,0,255)
    res[...,2][skin]=np.clip(B[skin]*0.70,0,255)
    al=np.where(m,0,255).astype(np.uint8)
    al=np.asarray(Image.fromarray(al).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.0)))
    im=Image.fromarray(np.dstack([np.clip(res,0,255).astype(np.uint8),al]),"RGBA")
    bb=im.getbbox()
    return im.crop(bb) if bb else im

def phone(shot,w,h):
    bez=max(9,w//26); rad=w//7
    card=Image.new("RGBA",(w,h),(0,0,0,0)); d=ImageDraw.Draw(card)
    d.rounded_rectangle([0,0,w,h],radius=rad,fill="#14201b")
    sw,sh=w-bez*2,h-bez*2
    im=Image.open(shot).convert("RGB")
    im=im.resize((sw,int(im.height*sw/im.width)),Image.LANCZOS).crop((0,0,sw,min(sh,int(im.height*sw/im.width))))
    if im.height<sh:
        pad=Image.new("RGB",(sw,sh),PAPER); pad.paste(im,(0,0)); im=pad
    m=Image.new("L",(sw,sh),0)
    ImageDraw.Draw(m).rounded_rectangle([0,0,sw,sh],radius=rad-bez//2,fill=255)
    card.paste(im,(bez,bez),m)
    nw,nh=w//3,max(6,h//90); nx=(w-nw)//2
    d.rounded_rectangle([nx,bez//2,nx+nw,bez//2+nh],radius=nh//2,fill="#14201b")
    return card

def shadow(base,card,xy,blur=26,alpha=100,off=(10,15)):
    s=Image.new("RGBA",base.size,(0,0,0,0))
    s.paste(Image.new("RGBA",card.size,(8,26,18,alpha)),(xy[0]+off[0],xy[1]+off[1]),card)
    base.alpha_composite(s.filter(ImageFilter.GaussianBlur(blur)))

def build(shot,out,W=1200,H=630):
    split=580
    img=Image.new("RGBA",(W,H),GREEN_DEEP)
    img.alpha_composite(marble(split,H),(0,0))
    d=ImageDraw.Draw(img)
    d.rectangle([0,0,W,8],fill=GOLD)

    M=54
    d.text((M,58),"WARMLINE",font=font(MONO_B,34),fill=GREEN_DEEP)
    d.text((M,104),"WARM OUTREACH . HUMAN VOICE",font=font(MONO,16),fill=INK_SOFT)
    fh=font(SERIF_B,42); y=140
    d.text((M,y),"Don't overthink it.",font=fh,fill=INK); y+=50
    d.text((M,y),"Just send it.",font=fh,fill=GREEN); y+=58
    d.rectangle([M,y,M+96,y+7],fill=GOLD); y+=26
    for ln in wrap(d,"Write one real detail. Get an opening line a human would send.",font(SERIF,21),split-M-30):
        d.text((M,y),ln,font=font(SERIF,21),fill=INK_SOFT); y+=30

    g=girl_cutout(shot)
    gh=196; g=g.resize((int(g.width*gh/g.height),gh),Image.LANCZOS)
    img.alpha_composite(g,(M-14,H-gh-70))

    d.text((M,H-56),"warmline.dataaccordingtome.com",font=font(MONO,19),fill=INK_SOFT)
    d.text((M,H-32),"15 FREE WARMLINES . NO SIGNUP",font=font(MONO,16),fill=GREEN)

    pw=268; ph=int(pw/0.489)   # ~548
    px=split+(W-split-pw)//2; py=(H-ph)//2
    c=phone(shot2,pw,ph)
    shadow(img,c,(px,py)); img.alpha_composite(c,(px,py))
    img.convert("RGB").save(out,"PNG",optimize=True); return out

if __name__=="__main__":
    shot=sys.argv[1]; global_shot2=None
    shot2=sys.argv[2]
    print(build(sys.argv[1],sys.argv[3]))
