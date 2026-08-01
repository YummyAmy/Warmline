#!/usr/bin/env python3
"""
The ORIGINAL hero mockup, reworked. Nothing moved.
Only two additions: light marble on the cream, and the girl for life.
Phone stays on the right. WARMLINE title stays where it was.
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

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

def marble_panel(w,h,seed=9,strength=0.5):
    """Light marble, cream. ADDITION 1."""
    rng=np.random.default_rng(seed); tot=np.zeros((h,w),np.float32); amp=1.
    for o in range(6):
        r=max(2,2**(o+2))
        tot+=np.asarray(Image.fromarray((rng.random((r,r))*255).astype(np.uint8))
                        .resize((w,h),Image.BICUBIC),np.float32)/255.*amp; amp*=.5
    tot=(tot-tot.min())/(tot.max()+1e-9)
    yy,xx=np.mgrid[0:h,0:w].astype(np.float32)
    v=np.sin((xx/w*6+yy/h*4+tot*3.2)*np.pi); v=((v+1)/2)**1.7
    v=np.asarray(Image.fromarray((v*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)),np.float32)/255.*strength
    base=np.array([243,239,228],np.float32); vein=np.array([227,220,202],np.float32)
    return Image.fromarray(np.clip(base[None,None,:]*(1-v[...,None])+vein[None,None,:]*v[...,None],0,255)
                           .astype(np.uint8)).convert("RGBA")

GIRL_BOX=(180,1360,1010,2290)
def girl_cutout(src,tol=64):
    """The girl, background keyed out. ADDITION 2."""
    im=Image.open(src).convert("RGB").crop(GIRL_BOX)
    a=np.asarray(im,np.int16); h,w,_=a.shape
    pts=[(4,4),(4,w-5),(h-5,4),(h-5,w-5),(h//2,4),(4,w//2),(h-5,w//2),(h//3,w-5)]
    m=np.zeros((h,w),bool)
    for y,x in pts: m|=(np.abs(a-a[y,x]).sum(axis=2)<tol)
    al=np.where(m,0,255).astype(np.uint8)
    al=np.asarray(Image.fromarray(al).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.0)))
    im=Image.fromarray(np.dstack([a.astype(np.uint8),al]),"RGBA")
    # the site lays a translucent green wash over her, which leaves the cutout
    # looking flat once it is sitting on cream. Put the colour and contrast back.
    from PIL import ImageEnhance
    rgb=im.convert("RGB")
    rgb=ImageEnhance.Color(rgb).enhance(1.0)
    rgb=ImageEnhance.Contrast(rgb).enhance(1.0)
    im=Image.merge("RGBA",(*rgb.split(),im.split()[3]))
    bb=im.getbbox()
    return im.crop(bb) if bb else im

def phone(shot,w,h,crop_top=0.0):
    bez=max(10,w//26); rad=w//7
    card=Image.new("RGBA",(w,h),(0,0,0,0)); d=ImageDraw.Draw(card)
    d.rounded_rectangle([0,0,w,h],radius=rad,fill="#14201b")
    sw,sh=w-bez*2,h-bez*2
    im=Image.open(shot).convert("RGB")
    im=im.resize((sw,int(im.height*sw/im.width)),Image.LANCZOS)
    top=min(int(im.height*crop_top),max(0,im.height-sh))
    im=im.crop((0,top,sw,min(im.height,top+sh)))
    if im.height<sh:
        p=Image.new("RGB",(sw,sh),PAPER); p.paste(im,(0,0)); im=p
    m=Image.new("L",(sw,sh),0)
    ImageDraw.Draw(m).rounded_rectangle([0,0,sw,sh],radius=rad-bez//2,fill=255)
    card.paste(im,(bez,bez),m)
    nw,nh=w//3,max(6,h//90); nx=(w-nw)//2
    d.rounded_rectangle([nx,bez//2,nx+nw,bez//2+nh],radius=nh//2,fill="#14201b")
    return card

def shadow(base,card,xy,blur=30,alpha=100,off=(12,18)):
    s=Image.new("RGBA",base.size,(0,0,0,0))
    s.paste(Image.new("RGBA",card.size,(10,28,20,alpha)),(xy[0]+off[0],xy[1]+off[1]),card)
    base.alpha_composite(s.filter(ImageFilter.GaussianBlur(blur)))

def hero(shot,shot2,out,W=1080,H=1080):
    split=int(W*0.52)
    img=Image.new("RGBA",(W,H),GREEN_DEEP)
    img.alpha_composite(marble_panel(split,H),(0,0))   # straight split, as before
    d=ImageDraw.Draw(img)

    M=68
    d.text((M,132),"WARMLINE",font=font(MONO_B,40),fill=GREEN_DEEP)   # title, bolder
    d.text((M,186),"WARM OUTREACH . HUMAN VOICE",font=font(MONO,20),fill=INK_SOFT)
    fh=font(SERIF_B,54); y=238
    for ln in wrap(d,"Don't overthink it.",fh,split-M*2):
        d.text((M,y),ln,font=fh,fill=INK); y+=66
    for ln in wrap(d,"Just send it.",fh,split-M*2):
        d.text((M,y),ln,font=fh,fill=GREEN); y+=66
    d.rectangle([M,y+16,M+112,y+23],fill=GOLD); y+=62
    for ln in wrap(d,"Write one real detail. Get a first line that sounds like a person wrote it.",
                   font(SERIF,25),split-M*2-20):
        d.text((M,y),ln,font=font(SERIF,25),fill=INK_SOFT); y+=36

    g=girl_cutout(shot)
    gh=280; g=g.resize((int(g.width*gh/g.height),gh),Image.LANCZOS)
    img.alpha_composite(g,(M-16,H-gh-196))                 # the girl, in the empty cream

    d.text((M,H-150),"warmline.dataaccordingtome.com",font=font(MONO,22),fill=INK_SOFT)
    d.text((M,H-112),"YOUR FIRST 15 WARMLINES ARE ON US",font=font(MONO,21),fill=GREEN)

    pw,ph=452,924
    px,py=int(W*0.52)+(W-int(W*0.52)-pw)//2,(H-ph)//2
    c=phone(shot2,pw,ph,crop_top=0.0)
    shadow(img,c,(px,py)); img.alpha_composite(c,(px,py))
    img.convert("RGB").save(out,"PNG",optimize=True); return out

if __name__=="__main__":
    shot=sys.argv[1]      # green panel screenshot, for the girl
    shot2=sys.argv[2]     # hero screenshot, for the phone screen
    print(hero(shot,sys.argv[3]))

STEPS=[("01","Drop in who you're reaching","Name, company, and one real detail."),
       ("02","Pick a tone for that person","Warm, Direct, Technical or Executive."),
       ("03","Get your warmline","One or two sentences. Send it.")]

def steps(shot,shot2,out,W=1080,H=1350):
    img=marble_panel(W,H,seed=14)
    d=ImageDraw.Draw(img)
    d.rectangle([0,0,W,12],fill=GOLD)
    M=76
    d.text((M,66),"WARM OUTREACH . HUMAN VOICE",font=font(MONO,23),fill=INK_SOFT)
    fh=font(SERIF_B,60)
    d.text((M,108),"Three steps to a",font=fh,fill=INK)
    d.text((M,176),"warmline.",font=fh,fill=GREEN)
    d.rectangle([M,254,M+128,261],fill=GOLD)

    pw,ph=392,800
    px,py=W-M-pw,300
    c=phone(shot2,pw,ph,crop_top=0.015)
    shadow(img,c,(px,py)); img.alpha_composite(c,(px,py))

    x,y=M,322
    fn=font(SERIF_B,46); ft=font(SERIF_B,29); fb=font(SERIF,24)
    col=px-M-56
    for num,title,body in STEPS:
        d.text((x,y),num,font=fn,fill=GOLD); y+=62
        for ln in wrap(d,title,ft,col): d.text((x,y),ln,font=ft,fill=INK); y+=38
        y+=6
        for ln in wrap(d,body,fb,col): d.text((x,y),ln,font=fb,fill=INK_SOFT); y+=34
        y+=44

    g=girl_cutout(shot)
    gh=300; g=g.resize((int(g.width*gh/g.height),gh),Image.LANCZOS)
    img.alpha_composite(g,(M-14,H-gh-176))

    d.line([(M,H-150),(W-M,H-150)],fill="#d8d1bf",width=2)
    d.text((M,H-118),"warmline.dataaccordingtome.com",font=font(MONO,27),fill=INK_SOFT)
    d.text((M,H-72),"YOUR FIRST 15 WARMLINES ARE ON US",font=font(MONO,23),fill=GREEN)
    img.convert("RGB").save(out,"PNG",optimize=True); return out
