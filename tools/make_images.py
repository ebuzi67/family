"""동물 그림 정리 스크립트.

AI가 만든 그림은 '투명 배경'이 회색·검정 바둑판 무늬로 그려져 있어요.
이 스크립트는 바둑판 무늬와 오른쪽 아래 반짝이 표시를 지우고,
캐릭터만 잘라 img/ 폴더에 투명 PNG로 저장해요.

실행: python3 tools/make_images.py   (family 폴더에서)
"""
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "source"
OUT = ROOT / "img"
OUT.mkdir(exist_ok=True)

ANIMALS = ["polarbear", "bear", "bee"]


def is_checker(px):
    r, g, b = px
    mx, mn = max(px), min(px)
    if mx - mn > 22:
        return False
    if mx - mn <= 9:  # 바둑판 칸 사이 경계선(검정과 회색이 섞인 색)도 배경
        return mx < 212
    return mx < 50 or 85 < mx < 212


def cut_character(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGB")
    w, h = im.size
    # 오른쪽 아래 반짝이 표시는 배경 무늬로 칠해서 함께 지워지게 한다
    d = ImageDraw.Draw(im)
    d.rectangle([int(w * 0.83), int(h * 0.83), w - 1, h - 1], fill=(0, 0, 0))
    px = im.load()
    bg = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            q.append((x, y))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if bg[i] or not is_checker(px[x, y]):
            continue
        bg[i] = 1
        if x > 0: q.append((x - 1, y))
        if x < w - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < h - 1: q.append((x, y + 1))
    # 남은 덩어리 중 가장 큰 것(캐릭터)만 남긴다 — 떨어져 있는 바둑판 찌꺼기 제거
    seen = bytearray(w * h)
    best = []
    for start in range(w * h):
        if bg[start] or seen[start]:
            continue
        comp = []
        seen[start] = 1
        q = deque([start])
        while q:
            i = q.popleft()
            comp.append(i)
            x, y = i % w, i // w
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):  # 대각선은 이웃으로 안 봄 (바둑판 칸이 대각선으로 붙음)
                if True:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if not bg[j] and not seen[j]:
                            seen[j] = 1
                            q.append(j)
        if len(comp) > len(best):
            best = comp
    keep = bytearray(w * h)
    for i in best:
        keep[i] = 255
    # 캐릭터에 붙어 남은 바둑판 칸(완전 검정·무채색 회색)을 바깥쪽부터 한 번 더 깎는다
    def strict(p):
        mx, mn = max(p), min(p)
        return (mx < 26 and mx - mn <= 10) or (mx - mn <= 8 and mx < 180)
    q = deque(i for i in range(w * h) if not keep[i])
    while q:
        i = q.popleft()
        x, y = i % w, i // w
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h:
                j = ny * w + nx
                if keep[j] and strict(px[nx, ny]):
                    keep[j] = 0
                    q.append(j)
    alpha = Image.frombytes("L", (w, h), bytes(keep))
    # 가장자리 1px 정도 부드럽게 (바둑판 찌꺼기 테두리 제거)
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    out = im.convert("RGBA")
    out.putalpha(alpha)
    box = alpha.point(lambda v: 255 if v > 40 else 0).getbbox()
    out = out.crop(box)
    # 정사각형 캔버스에 바닥 맞춰 놓기 (여백 4%)
    side = int(max(out.size) * 1.08)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(out, ((side - out.width) // 2, side - out.height - int(side * 0.04)), out)
    return canvas.resize((512, 512), Image.LANCZOS)


def clean_village():
    im = Image.open(SRC / "village.webp").convert("RGB")
    w, h = im.size
    # 오른쪽 아래 반짝이 표시 위를 주변 풀밭 색으로 덮는다
    x0, y0, x1, y1 = int(w * 0.885), int(h * 0.80), int(w * 0.94), int(h * 0.895)
    patch = im.crop((x0 - (x1 - x0), y0, x0, y1))
    im.paste(patch, (x0, y0))
    im = im.resize((1280, int(1280 * h / w)), Image.LANCZOS)
    im.save(OUT / "village.webp", quality=86)


def make_icons():
    face = cut_character(SRC / "polarbear-1.webp")
    for size in (512, 192, 180):
        bg = Image.new("RGBA", (size, size), (207, 234, 246, 255))
        f = face.resize((int(size * 0.86), int(size * 0.86)), Image.LANCZOS)
        bg.paste(f, ((size - f.width) // 2, size - f.height - int(size * 0.02)), f)
        bg.convert("RGB").save(OUT / f"icon-{size}.png")


if __name__ == "__main__":
    for a in ANIMALS:
        for s in (1, 2, 3):
            name = f"{a}-{s}"
            cut_character(SRC / f"{name}.webp").save(OUT / f"{name}.png", optimize=True)
            print("ok", name)
    clean_village()
    make_icons()
    print("done")
