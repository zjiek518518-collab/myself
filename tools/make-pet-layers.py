"""把 Q 版立绘拆成可动的分层（纸片人做法），生成到 assets/：
  pet-body.png    去掉双腿的主体
  pet-leg-l/r.png 左右腿（各自一层，绕胯部旋转 = 迈腿）
  pet-eyes.png    闭眼贴片（眨眼时叠上去）
  pet-bite-1/2.png 西瓜上「咬一口 / 咬两口」的覆盖层
所有图层都是与原图同尺寸的整幅画布，页面里直接叠放，不用算坐标。
原图 assets/pet.png 保持不动（作为素材与回退）。
"""
import pathlib

from PIL import Image, ImageDraw, ImageFilter

WS = pathlib.Path(__file__).resolve().parent.parent
DEV = WS
A = WS / "assets"

pet = Image.open(A / "pet.png").convert("RGBA")
W, H = pet.size
print("原图:", W, H)

# ---------- 量好的坐标 ----------
EYE_L = (140, 146, 216, 214)
EYE_R = (245, 146, 325, 216)
LEG_L = (168, 336, 215, 449)
LEG_R = (227, 336, 290, 449)

LASH = (42, 36, 56, 255)
SKIN_TOP = (245, 245, 250)      # 上眼睑（很浅）
SKIN_MID = (216, 220, 246)      # 眼下方那点冷色阴影
DRESS = (253, 254, 249)         # 西瓜上方她衣服的颜色（咬口的“背后”）
MELON_INNER = (247, 196, 202)   # 咬口露出的淡粉果肉
MELON_RIM = (196, 120, 130)     # 果肉外缘稍深一点


# ============================================================
# 1. 闭眼贴片
# ============================================================
def eye_patch():
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for box in (EYE_L, EYE_R):
        l, t, r, b = box
        if (l + r) / 2 < W / 2:          # 左眼：外眼角在左
            outer_x, inner_x = l + 6, r - 6
        else:                            # 右眼：外眼角在右
            outer_x, inner_x = r - 6, l + 6

        box2 = (l - 5, t - 8, r + 5, b + 3)      # 多盖住一点上方眼线
        bw, bh = box2[2] - box2[0], box2[3] - box2[1]

        # (a) 皮肤底：上下渐变
        grad = Image.new("RGBA", (bw, bh))
        gd = ImageDraw.Draw(grad)
        for y in range(bh):
            k = y / max(1, bh - 1)
            col = tuple(int(SKIN_TOP[i] + (SKIN_MID[i] - SKIN_TOP[i]) * k) for i in range(3))
            gd.line([(0, y), (bw, y)], fill=col + (255,))
        grad = grad.filter(ImageFilter.GaussianBlur(3))

        # (b) 闭眼弧线（明显向下弯）+ 外眼角挑线
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
        # 外眼角的挑线（睫毛）
        ad.line([p_out, (p_out[0] + (10 if outer_x > inner_x else -10), p_out[1] - 8)], fill=LASH, width=5)
        # 弧线上方一点点阴影，让眼皮有厚度
        ad.line([(x, y - 6) for (x, y) in pts], fill=(226, 222, 236, 150), width=4, joint="curve")

        # (c) 椭圆羽化遮罩，融进周围皮肤（羽化给足，眨眼很快看不出来）
        mask = Image.new("L", (bw, bh), 0)
        ImageDraw.Draw(mask).ellipse([1, 1, bw - 2, bh - 2], fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(7))
        patch = Image.alpha_composite(grad, arc)
        patch.putalpha(Image.composite(patch.split()[3], Image.new("L", (bw, bh), 0), mask))
        layer.alpha_composite(patch, (box2[0], box2[1]))
    return layer


# ============================================================
# 2. 双腿分层
# ============================================================
def leg_layers():
    body = pet.copy()
    d = ImageDraw.Draw(body)
    for box in (LEG_L, LEG_R):
        d.rectangle(box, fill=(0, 0, 0, 0))
    leg_l = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    leg_l.paste(pet.crop(LEG_L), (LEG_L[0], LEG_L[1]))
    leg_r = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    leg_r.paste(pet.crop(LEG_R), (LEG_R[0], LEG_R[1]))
    return body, leg_l, leg_r


# ============================================================
# 3. 咬西瓜的覆盖层（直接在原地画出缺口，不用抠西瓜）
# ============================================================
def bite_layer(bites):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for (cx, cy, r) in bites:
        box = [cx - r, cy - r * 0.92, cx + r, cy + r * 0.92]
        # 缺口本体：她衣服的颜色（上半部分本来就在西瓜外，涂了也看不见）
        d.ellipse(box, fill=DRESS + (255,))
        # 露出来的果肉：沿缺口下缘一圈淡粉
        d.arc(box, start=12, end=168, fill=MELON_INNER + (255,), width=7)
        # 果肉外缘再压一道浅深色，接近原画的描边习惯
        d.arc([box[0] + 1, box[1] + 1, box[2] - 1, box[3] - 1], start=16, end=164, fill=MELON_RIM + (160,), width=2)
    soft = layer.filter(ImageFilter.GaussianBlur(1.2))
    return Image.composite(soft, layer, layer.split()[3].filter(ImageFilter.GaussianBlur(1.0)))


BITE1 = [(168, 261, 12)]
BITE2 = [(168, 261, 12), (191, 264, 13), (216, 268, 12)]


body, leg_l, leg_r = leg_layers()
eyes = eye_patch()
bite1 = bite_layer(BITE1)
bite2 = bite_layer(BITE2)

outputs = {
    "pet-body.png": body,
    "pet-leg-l.png": leg_l,
    "pet-leg-r.png": leg_r,
    "pet-eyes.png": eyes,
    "pet-bite-1.png": bite1,
    "pet-bite-2.png": bite2,
}
total = 0
for name, img in outputs.items():
    path = A / name
    img.save(path, optimize=True)
    kb = path.stat().st_size / 1024
    total += kb
    print(f"{name:22s} {kb:6.0f} KB")
print(f"{'合计':22s} {total:6.0f} KB")


# ---------- 预览：四格（原样 / 闭眼 / 迈腿 / 咬西瓜）----------
def compose(leg_angle=0, eyes_on=False, bite=None):
    base = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for leg, pivot in ((leg_l, (191, 350)), (leg_r, (258, 350))):
        im = leg.rotate(leg_angle, resample=Image.BICUBIC, center=pivot) if leg_angle else leg
        base.alpha_composite(im)
    base.alpha_composite(body)
    if bite is not None:
        base.alpha_composite(bite)
    if eyes_on:
        base.alpha_composite(eyes)
    return base


def on_dark(img, label, zoom=1):
    bg = Image.new("RGB", (img.width * zoom, img.height * zoom), (12, 22, 38))
    im = img.resize((img.width * zoom, img.height * zoom), Image.LANCZOS) if zoom > 1 else img
    bg.paste(im, (0, 0), im)
    ImageDraw.Draw(bg).text((6, 6), label, fill=(150, 220, 255))
    return bg


sheet = Image.new("RGB", (W * 2 + 15, H * 2 + 15), (8, 16, 28))
sheet.paste(on_dark(compose(), "1 original"), (5, 5))
sheet.paste(on_dark(compose(eyes_on=True), "2 blink"), (W + 10, 5))
sheet.paste(on_dark(compose(leg_angle=10, eyes_on=True, bite=bite2), "3 walk + bite"), (5, H + 10))
sheet.paste(on_dark(compose(bite=bite2), "4 bite only"), (W + 10, H + 10))
sheet.save(DEV / "pet-layers-preview.png")

# 脸部放大，检查闭眼贴片
face = Image.new("RGB", (440, 180), (12, 22, 38))
a = compose().crop((120, 120, 340, 240)).resize((440, 240), Image.LANCZOS)
face = Image.new("RGB", (880, 240), (12, 22, 38))
face.paste(a.crop((0, 0, 440, 240)), (0, 0))
b = compose(eyes_on=True).crop((120, 120, 340, 240)).resize((440, 240), Image.LANCZOS)
face.paste(b, (440, 0))
face.save(DEV / "pet-eyes-preview.png")
print("预览:", DEV / "pet-layers-preview.png", DEV / "pet-eyes-preview.png")

