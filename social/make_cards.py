#!/usr/bin/env python3
"""
Warmline social graphics.
Brand values pulled straight from index.html custom properties so these
match the live site rather than approximating it.
"""
from PIL import Image, ImageDraw, ImageFont

PAPER      = "#f3efe4"
INK        = "#1b2a24"
INK_SOFT   = "#4a5a51"
GREEN      = "#1d6e4f"
GREEN_DEEP = "#0f4d36"
GOLD       = "#e0a324"
PINK       = "#d85a7a"
LINE       = "#d8d1bf"
CARD       = "#ffffff"

F = "/usr/share/fonts/truetype/dejavu/"
SERIF      = F + "DejaVuSerif.ttf"
SERIF_B    = F + "DejaVuSerif-Bold.ttf"
SERIF_I    = F + "DejaVuSerif-Italic.ttf"
MONO       = F + "DejaVuSansMono.ttf"
MONO_B     = F + "DejaVuSansMono-Bold.ttf"

def font(path, size):
    return ImageFont.truetype(path, size)

def text_w(d, s, f):
    return d.textbbox((0, 0), s, font=f)[2]

def wrap(d, s, f, max_w):
    """Greedy wrap to a pixel width."""
    words, lines, cur = s.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if text_w(d, trial, f) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines

def grain(img, every=4, alpha=6):
    """Faint horizontal texture so the cream doesn't read as flat digital beige."""
    d = ImageDraw.Draw(img, "RGBA")
    for y in range(0, img.height, every):
        d.line([(0, y), (img.width, y)], fill=(27, 42, 36, alpha))
    return img

def logo_pill(d, x, y, size=28, pad_x=22, pad_y=12):
    """The green Warmline chip, same shape as the site header."""
    f = font(MONO_B, size)
    label = "Warmline"
    w = text_w(d, label, f)
    h = size + pad_y * 2
    d.rounded_rectangle([x, y, x + w + pad_x * 2, y + h], radius=h // 2, fill=GREEN_DEEP)
    d.text((x + pad_x, y + pad_y - 2), label, font=f, fill=PAPER)
    return y + h

def footer_url(d, x, y, size=26, color=INK_SOFT):
    f = font(MONO, size)
    d.text((x, y), "warmline.dataaccordingtome.com", font=f, fill=color)


# ---------------------------------------------------------------- share card
def share_card(path):
    """1200x630. This is the og:image, the thing that renders when the
    link is pasted into LinkedIn, WhatsApp, Slack, iMessage or Substack."""
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    grain(img)
    d = ImageDraw.Draw(img)

    # gold rule down the left edge
    d.rectangle([0, 0, 10, H], fill=GOLD)

    M = 74
    y = 58
    y = logo_pill(d, M, y, size=26)

    # kicker
    fk = font(MONO, 22)
    y += 34
    d.text((M, y), "COLD OUTREACH, WITHOUT THE ROBOT", font=fk, fill=INK_SOFT)

    # headline
    fh = font(SERIF_B, 68)
    y += 46
    for line in wrap(d, "First lines that sound like you.", fh, W - M * 2 - 40):
        d.text((M, y), line, font=fh, fill=INK)
        y += 82

    # gold underline accent
    d.rectangle([M, y + 6, M + 132, y + 13], fill=GOLD)

    # subhead
    fs = font(SERIF, 27)
    y += 48
    for line in wrap(d,
                     "Write one real detail about someone. Get an opening line a "
                     "human would send.", fs, W - M * 2 - 60):
        d.text((M, y), line, font=fs, fill=INK_SOFT)
        y += 40

    # bottom bar
    d.line([(M, H - 92), (W - M, H - 92)], fill=LINE, width=2)
    footer_url(d, M, H - 66)
    ff = font(MONO, 24)
    free = "15 FREE WARMLINES"
    d.text((W - M - text_w(d, free, ff), H - 66), free, font=ff, fill=GREEN)

    img.save(path, "PNG", optimize=True)
    return path


# --------------------------------------------------------------- square post
def square(path):
    """1080x1080 for LinkedIn and Instagram. Shows a real opener, because
    the product demonstrating itself beats a claim about the product."""
    W = H = 1080
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    grain(img)
    d = ImageDraw.Draw(img)

    d.rectangle([0, 0, W, 12], fill=GOLD)

    M = 82
    y = 84
    y = logo_pill(d, M, y, size=28)

    fh = font(SERIF_B, 62)
    y += 46
    for line in wrap(d, "Your cold email dies on the first line.", fh, W - M * 2):
        d.text((M, y), line, font=fh, fill=INK)
        y += 76

    fs = font(SERIF_I, 30)
    y += 22
    d.text((M, y), "So write that one properly.", font=fs, fill=PINK)
    y += 96

    # the demo card
    card_top = y
    card_bot = y + 292
    d.rounded_rectangle([M, card_top, W - M, card_bot], radius=20, fill=GREEN_DEEP)

    fl = font(MONO, 21)
    d.text((M + 40, card_top + 34), "WARMLINE . TECHNICAL", font=fl, fill=GOLD)

    fq = font(SERIF_I, 31)
    qy = card_top + 84
    quote = ("I saw the error on your dashboard and I think it's how the "
             "workflows are sequencing. Happy to look at it with you.")
    for line in wrap(d, quote, fq, W - M * 2 - 80):
        d.text((M + 40, qy), line, font=fq, fill=PAPER)
        qy += 46

    # closing line, fills the gap the card used to leave
    fc = font(SERIF_B, 34)
    cy = card_bot + 66
    d.text((M, cy), "Not a template, it's a Warmline.", font=fc, fill=INK)

    # footer
    d.line([(M, H - 132), (W - M, H - 132)], fill=LINE, width=2)
    footer_url(d, M, H - 104, size=28)
    ff = font(MONO, 24)
    d.text((M, H - 62), "YOUR FIRST 15 WARMLINES ARE ON US", font=ff, fill=GREEN)

    img.save(path, "PNG", optimize=True)
    return path


# ---------------------------------------------------------------- story post
def story(path):
    """1080x1920 for Instagram and LinkedIn stories."""
    W, H = 1080, 1920
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    grain(img)
    d = ImageDraw.Draw(img)

    d.rectangle([0, 0, W, 14], fill=GOLD)
    d.rectangle([0, H - 14, W, H], fill=GREEN_DEEP)

    M = 92
    y = 300
    y = logo_pill(d, M, y, size=30)

    fk = font(MONO, 24)
    y += 44
    d.text((M, y), "COLD OUTREACH, WITHOUT THE ROBOT", font=fk, fill=INK_SOFT)

    fh = font(SERIF_B, 78)
    y += 62
    for line in wrap(d, "First lines that sound like you.", fh, W - M * 2):
        d.text((M, y), line, font=fh, fill=INK)
        y += 96

    d.rectangle([M, y + 14, M + 150, y + 22], fill=GOLD)
    y += 82

    fs = font(SERIF, 33)
    for line in wrap(d,
                     "Write one real detail about someone. Get an opening line a "
                     "human would send.", fs, W - M * 2):
        d.text((M, y), line, font=fs, fill=INK_SOFT)
        y += 50

    # demo card
    y += 60
    d.rounded_rectangle([M, y, W - M, y + 330], radius=22, fill=GREEN_DEEP)
    fl = font(MONO, 22)
    d.text((M + 44, y + 38), "WARMLINE . WARM", font=fl, fill=GOLD)
    fq = font(SERIF_I, 33)
    qy = y + 94
    quote = ("I read your piece on intercoder drift and those problems come up "
             "for me too. Do you have a fix already?")
    for line in wrap(d, quote, fq, W - M * 2 - 88):
        d.text((M + 44, qy), line, font=fq, fill=PAPER)
        qy += 50

    footer_url(d, M, H - 220, size=30)
    ff = font(MONO, 26)
    d.text((M, H - 170), "YOUR FIRST 15 ARE ON US", font=ff, fill=GREEN)

    img.save(path, "PNG", optimize=True)
    return path


if __name__ == "__main__":
    import sys
    out = sys.argv[1].rstrip("/")
    for p in (share_card(out + "/share-card.png"),
              square(out + "/warmline-square.png"),
              story(out + "/warmline-story.png")):
        print("wrote", p)
