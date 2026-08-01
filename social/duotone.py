#!/usr/bin/env python3
"""
Map the illustration through the Warmline palette.

Hue-shifting a pale watercolour fights you: the colours sit too close together
and everything drifts pastel. Mapping brightness through a colour ramp is the
standard way to bring a donated illustration into a brand, and it lands in one
pass instead of ten.
"""
import sys
import numpy as np
from PIL import Image

def hexrgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i+2],16) for i in (0,2,4)], np.float32)

RAMPS = {
    # dark end -> light end. Shadows take the brand colour, paper stays paper.
    "forest": ["#0f4d36", "#2e6b4f", "#7fa08c", "#ddd9c8", "#f7f4ea"],
    "gold":   ["#6b4a12", "#a9791f", "#d8b museum", "#e8dfc9", "#f7f4ea"],
    "duo":    ["#0f4d36", "#3d7a5c", "#c9b98f", "#ece5d3", "#f7f4ea"],
}
RAMPS["gold"] = ["#6b4a12", "#a9791f", "#d8b46a", "#e8dfc9", "#f7f4ea"]

def apply_ramp(path, out, ramp="forest", keep_colour=0.18):
    im = Image.open(path).convert("RGB")
    a = np.asarray(im, np.float32) / 255.0
    lum = a[...,0]*0.299 + a[...,1]*0.587 + a[...,2]*0.114

    stops = np.array([hexrgb(c) for c in RAMPS[ramp]], np.float32) / 255.0
    pos = np.linspace(0, 1, len(stops))
    out_rgb = np.empty_like(a)
    for c in range(3):
        out_rgb[...,c] = np.interp(lum, pos, stops[:,c])

    # let a whisper of the original colour through so it still feels painted
    out_rgb = out_rgb*(1-keep_colour) + a*keep_colour
    Image.fromarray(np.clip(out_rgb*255,0,255).astype(np.uint8)).save(out,"PNG",optimize=True)
    return out

if __name__ == "__main__":
    src, outdir = sys.argv[1], sys.argv[2].rstrip("/")
    for r in ("forest","gold","duo"):
        print(apply_ramp(src, f"{outdir}/illo-{r}.png", r))
