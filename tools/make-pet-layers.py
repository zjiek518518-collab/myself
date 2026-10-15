"""把 Q 版立绘拆成可动的分层（纸片人做法），生成到 assets/：
  pet-upper.png      上半身（头/发/手/西瓜），绕腰旋转
  pet-lower.png      下半身（裙摆/胯），绕腰反向轻摆
  pet-leg-l/r.png    左右腿，绕胯部前后摆
  pet-eyes.png       闭眼贴片（眨眼：眼皮从上压下来）
  pet-bite-1/2/3.png 西瓜咬一口 / 三口 / 吃掉大半
所有图层都是与原图同尺寸的整幅画布，页面里直接叠放，不用算坐标。
原图 assets/pet.png 保持不动（素材与回退）。
"""
import pathlib

from PIL import Image, ImageDraw, ImageFilter

WS = pathlib.Path(__file__).resolve().parent.parent
DEV = WS / "_pet-preview"
DEV.mkdir(exist_ok=True)
A = WS / "assets"
A.mkdir(exist_ok=True)

pet = Image.open(A / "pet.png").convert("RGBA")
W, H = pet.size
print("原图:", W, H)

# ---------- 量好的坐标 ----------
EYE_L = (140, 146, 216, 214)
EYE_R = (245, 146, 325, 216)
LEG_L = (168, 336, 215, 449)
LEG_R = (227, 336, 290, 449)

WAIST_Y = 331          # 白裙与深色腰带交界处
WAIST_OVERLAP = 13     # 上半身往下多留一点，旋转时不会露缝
WAIST_X = 230          # 腰部旋转中心的 x

LASH = (42, 36, 56, 255)
SKIN_TOP = (245, 245, 250)
SKIN_MID = (216, 220, 246)
DRESS = (253, 254, 249)
MELON_INNER = (247, 196, 202)
MELON_RIM = (196, 120, 130)


# ============================================================
# 1. 闭眼贴片（眼皮）
# ============================================================
def eye_patch():
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for box in (EYE_L, EYE_R):
        l, t, r, b = box
        if (l + r) / 2 < W / 2:
            outer_x, inner_x = l + 6, r - 6
        else:
            outer_x, inner_x = r - 6, l + 6

        box2 = (l - 5, t - 8, r + 5, b + 3)
        bw, bh = box2[2] - box2[0], box2[3] - box2[1]

        grad = Image.new("RGBA", (bw, bh))
        gd = ImageDraw.Draw(grad)
        for y in range(bh):
            k = y / max(1, bh - 1)
            col = tuple(int(SKIN_TOP[i] + (SKIN_MID[i] - SKIN_TOP[i]) * k) for i in range(3))
            gd.line([(0, y), (bw, y)], fill=col + (255,))
        grad = grad.filter(ImageFilter.GaussianBlur(3))

        arc = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
        ad = ImageDraw.Draw(arc)
        p_in = (inner_x - box2[0], (t + b) / 2 - box2[1] - 2)
        p_out = (outer_x - box2[0], (t + b) / 2 - box2[1] - 6)
        mid = ((p_in[0] + p_out[0]) / 2, (t + b) / 2 + 12 - box2[1])
        pts = []
        for i in range(25):
            u = i / 24
            pts.append((
                (1 - u) ** 2 * p_in[0] + 2 * (1 - u) * u * mid[0] + u ** 2 * p_out[0],
                (1 - u) ** 2 * p_in[1] + 2 * (1 - u) * u * mid[1] + u ** 2 * p_out[1],
            ))
        ad.line(pts, fill=LASH, width=7, joint="curve")
        ad.line([p_out, (p_out[0] + (10 if outer_x > inner_x else -10), p_out[1] - 8)], fill=LASH, width=5)
        ad.line([(x, y - 6) for (x, y) in pts], fill=(226, 222, 236, 150), width=4, joint="curve")

        mask = Image.new("L", (bw, bh), 0)
        ImageDraw.Draw(mask).ellipse([1, 1, bw - 2, bh - 2], fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(7))
        patch = Image.alpha_composite(grad, arc)
        patch.putalpha(Image.composite(patch.split()[3], Image.new("L", (bw, bh), 0), mask))
        layer.alpha_composite(patch, (box2[0], box2[1]))
    return layer


# ============================================================
# 2. 上半身 / 下半身 / 双腿
# ============================================================
def body_layers():
    upper = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    upper.paste(pet.crop((0, 0, W, WAIST_Y + WAIST_OVERLAP)), (0, 0))

    lower = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    lower.paste(pet.crop((0, WAIST_Y, W, H)), (0, WAIST_Y))
    d = ImageDraw.Draw(lower)
    for box in (LEG_L, LEG_R):                    # 腿的位置挖空，让腿层透出来
        d.rectangle(box, fill=(0, 0, 0, 0))

    leg_l = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    leg_l.paste(pet.crop(LEG_L), (LEG_L[0], LEG_L[1]))
    leg_r = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    leg_r.paste(pet.crop(LEG_R), (LEG_R[0], LEG_R[1]))
    return upper, lower, leg_l, leg_r


# ============================================================
# 3. 咬西瓜的覆盖层
# ============================================================
def bite_layer(bites):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for (cx, cy, r) in bites:
        box = [cx - r, cy - r * 0.92, cx + r, cy + r * 0.92]
        d.ellipse(box, fill=DRESS + (255,))
        d.arc(box, start=12, end=168, fill=MELON_INNER + (255,), width=7)
        d.arc([box[0] + 1, box[1] + 1, box[2] - 1, box[3] - 1], start=16, end=164, fill=MELON_RIM + (160,), width=2)
    soft = layer.filter(ImageFilter.GaussianBlur(1.2))
    return Image.composite(soft, layer, layer.split()[3].filter(ImageFilter.GaussianBlur(1.0)))


BITE1 = [(170, 261, 13)]
BITE2 = [(168, 261, 13), (192, 264, 14), (216, 267, 13)]
# 大面积咬掉：一个大的 + 一个小的，留下一整条淡粉果肉边，像被啃掉半个
BITE3 = [(206, 246, 37), (240, 258, 22)]


upper, lower, leg_l, leg_r = body_layers()
eyes = eye_patch()
bite1 = bite_layer(BITE1)
bite2 = bite_layer(BITE2)
bite3 = bite_layer(BITE3)

outputs = {
    "pet-upper.png": upper,
    "pet-lower.png": lower,
    "pet-leg-l.png": leg_l,
    "pet-leg-r.png": leg_r,
    "pet-eyes.png": eyes,
    "pet-bite-1.png": bite1,
    "pet-bite-2.png": bite2,
    "pet-bite-3.png": bite3,
}
total = 0
for name, img in outputs.items():
    path = A / name
    img.save(path, optimize=True)
    kb = path.stat().st_size / 1024
    total += kb
    print(f"{name:22s} {kb:6.0f} KB")
print(f"{'合计':22s} {total:6.0f} KB")


# ---------- 预览 ----------
def compose(leg_angle=0, upper_angle=0, lower_angle=0, eyes_on=False, bite=None):
    base = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    pivots = ((leg_l, (191, 350), leg_angle), (leg_r, (258, 350), leg_angle))
    for im, pivot, ang in pivots:
        base.alpha_composite(im.rotate(ang, resample=Image.BICUBIC, center=pivot) if ang else im)
    if lower_angle:
        base.alpha_composite(lower.rotate(lower_angle, resample=Image.BICUBIC, center=(WAIST_X, WAIST_Y + 18)))
    else:
        base.alpha_composite(lower)
    if upper_angle:
        base.alpha_composite(upper.rotate(upper_angle, resample=Image.BICUBIC, center=(WAIST_X, WAIST_Y)))
    else:
        base.alpha_composite(upper)
    if bite is not None:
        base.alpha_composite(bite)
    if eyes_on:
        base.alpha_composite(eyes)
    return base


def on_dark(img, label):
    bg = Image.new("RGB", img.size, (12, 22, 38))
    bg.paste(img, (0, 0), img)
    ImageDraw.Draw(bg).text((6, 6), label, fill=(150, 220, 255))
    return bg


sheet = Image.new("RGB", (W * 3 + 20, H * 2 + 15), (8, 16, 28))
sheet.paste(on_dark(compose(), "1 rest"), (5, 5))
sheet.paste(on_dark(compose(leg_angle=6, upper_angle=-1.6, lower_angle=1.3), "2 walk: legs + hip + torso"), (W + 10, 5))
sheet.paste(on_dark(compose(eyes_on=True), "3 blink"), (W * 2 + 15, 5))
sheet.paste(on_dark(compose(bite=bite1), "4 bite x1"), (5, H + 10))
sheet.paste(on_dark(compose(bite=bite2, upper_angle=1.4), "5 bite x3 + chomp"), (W + 10, H + 10))
sheet.paste(on_dark(compose(bite=bite3, upper_angle=-1.4), "6 half eaten"), (W * 2 + 15, H + 10))
sheet.save(DEV / "pet-layers-preview.png")
print("预览:", DEV / "pet-layers-preview.png")
