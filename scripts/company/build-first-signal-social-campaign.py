#!/usr/bin/env python3

from pathlib import Path
from textwrap import wrap

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[2]
PUBLIC_OUTPUT = ROOT / "public" / "marketing" / "social" / "first-signal"
REVIEW_OUTPUT = ROOT / "output" / "social"

WIDTH = 1080
HEIGHT = 1350
INK = "#090711"
PANEL = "#151027"
CREAM = "#FFF8E8"
MUTED = "#C8C0D7"
MINT = "#78E3D0"
GOLD = "#FFD262"
VIOLET = "#8D43F2"
PINK = "#FF79A3"

FONT_HEAVY = "/Library/Fonts/SF-Pro-Rounded-Heavy.otf"
FONT_SEMIBOLD = "/Library/Fonts/SF-Pro-Rounded-Semibold.otf"
FONT_REGULAR = "/Library/Fonts/SF-Pro-Rounded-Regular.otf"

EMBLEM = ROOT / "public" / "marketing" / "mythical-void-emblem-v3.png"


def font(path, size):
    return ImageFont.truetype(path, size)


def hex_rgb(value):
    value = value.lstrip("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4))


def gradient_background(top=INK, bottom="#1B0E33"):
    image = Image.new("RGB", (WIDTH, HEIGHT), top)
    pixels = image.load()
    start = hex_rgb(top)
    end = hex_rgb(bottom)
    for y in range(HEIGHT):
        ratio = y / max(1, HEIGHT - 1)
        colour = tuple(round(start[index] * (1 - ratio) + end[index] * ratio) for index in range(3))
        for x in range(WIDTH):
            pixels[x, y] = colour
    return image


def cover_crop(source, size):
    image = Image.open(source).convert("RGB")
    target_ratio = size[0] / size[1]
    source_ratio = image.width / image.height
    if source_ratio > target_ratio:
        crop_width = round(image.height * target_ratio)
        left = (image.width - crop_width) // 2
        image = image.crop((left, 0, left + crop_width, image.height))
    else:
        crop_height = round(image.width / target_ratio)
        top = (image.height - crop_height) // 2
        image = image.crop((0, top, image.width, top + crop_height))
    return image.resize(size, Image.Resampling.LANCZOS)


def rounded_image(source, size, radius=34):
    image = cover_crop(source, size)
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
    image.putalpha(mask)
    return image


def fit_image(source, size):
    image = Image.open(source).convert("RGBA")
    ratio = min(size[0] / image.width, size[1] / image.height)
    resized = image.resize((round(image.width * ratio), round(image.height * ratio)), Image.Resampling.LANCZOS)
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    layer.alpha_composite(resized, ((size[0] - resized.width) // 2, (size[1] - resized.height) // 2))
    return layer


def draw_rounded(draw, box, fill, outline=None, width=2, radius=28):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_brand(image, badge=None, dark=True):
    draw = ImageDraw.Draw(image)
    emblem = fit_image(EMBLEM, (54, 84))
    image.paste(emblem, (68, 50), emblem)
    draw.text((140, 71), "MYTHICAL VOID", font=font(FONT_HEAVY, 31), fill=CREAM if dark else INK)
    if badge:
        badge_font = font(FONT_HEAVY, 21)
        text_box = draw.textbbox((0, 0), badge, font=badge_font)
        badge_width = text_box[2] - text_box[0] + 46
        draw_rounded(draw, (WIDTH - badge_width - 68, 60, WIDTH - 68, 112), MINT, radius=26, width=0)
        draw.text((WIDTH - badge_width - 45, 75), badge, font=badge_font, fill=INK)


def draw_wrapped(draw, text, box, font_path, size, fill, line_gap=8, max_lines=None):
    chosen_font = font(font_path, size)
    words = text.split()
    lines = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if draw.textlength(candidate, font=chosen_font) <= box[2] - box[0]:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    if max_lines:
        lines = lines[:max_lines]
    y = box[1]
    for line in lines:
        draw.text((box[0], y), line, font=chosen_font, fill=fill)
        line_box = draw.textbbox((box[0], y), line, font=chosen_font)
        y += line_box[3] - line_box[1] + line_gap
    return y


def draw_kicker(draw, text, x, y, colour=MINT):
    draw.text((x, y), text.upper(), font=font(FONT_HEAVY, 24), fill=colour)


def draw_cta(draw, text, y, colour=MINT):
    draw_rounded(draw, (68, y, WIDTH - 68, y + 72), colour, radius=36, width=0)
    label_font = font(FONT_HEAVY, 26)
    text_width = draw.textlength(text, font=label_font)
    draw.text(((WIDTH - text_width) / 2, y + 20), text, font=label_font, fill=INK)


def soft_glow(image, centre, radius, colour):
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.ellipse((centre[0] - radius, centre[1] - radius, centre[0] + radius, centre[1] + radius), fill=(*hex_rgb(colour), 130))
    layer = layer.filter(ImageFilter.GaussianBlur(radius / 2))
    image.paste(layer, (0, 0), layer)


def origin_card():
    image = gradient_background()
    soft_glow(image, (850, 420), 260, VIOLET)
    draw_brand(image, "OUR BEGINNING")
    draw = ImageDraw.Draw(image)
    draw_kicker(draw, "A FATHER-AND-SON PROJECT", 68, 206, GOLD)
    y = draw_wrapped(draw, "A dad. His nine-year-old son. One enormous idea.", (68, 255, 680, 690), FONT_HEAVY, 71, CREAM, 4)
    draw_wrapped(draw, "Imagination led. Generative AI helped them build. People remain responsible for the story, safety and choices.", (68, y + 36, 680, 920), FONT_REGULAR, 34, MUTED, 11)
    emblem = fit_image(EMBLEM, (330, 540))
    image.paste(emblem, (720, 355), emblem)
    draw_rounded(draw, (68, 995, WIDTH - 68, 1198), "#17112C", outline="#4B3B69", width=3, radius=30)
    draw.text((101, 1035), "WHAT IF WE COULD BUILD", font=font(FONT_HEAVY, 27), fill=MINT)
    draw.text((101, 1080), "THE GAME WE IMAGINED TOGETHER?", font=font(FONT_HEAVY, 27), fill=CREAM)
    draw_cta(draw, "PLAY FREE • NO DOWNLOAD • NO ACCOUNT", 1228, MINT)
    return image


def framed_proof_card(source, badge, kicker, headline, body, cta, disclosure, accent=MINT):
    image = gradient_background(bottom="#160F2B")
    draw_brand(image, badge)
    proof = rounded_image(source, (944, 590), 34)
    image.paste(proof, (68, 158), proof)
    draw = ImageDraw.Draw(image)
    draw_rounded(draw, (88, 180, 310, 232), INK, outline=accent, width=2, radius=26)
    draw.text((110, 196), "REAL GAMEPLAY", font=font(FONT_HEAVY, 21), fill=accent)
    draw_kicker(draw, kicker, 68, 800, accent)
    y = draw_wrapped(draw, headline, (68, 848, WIDTH - 68, 1110), FONT_HEAVY, 65, CREAM, 3)
    draw_wrapped(draw, body, (68, y + 28, WIDTH - 68, 1218), FONT_REGULAR, 31, MUTED, 9)
    draw_cta(draw, cta, 1228, accent)
    draw.text((70, 1320), disclosure, font=font(FONT_REGULAR, 17), fill="#9389AA")
    return image


def playable_card():
    return framed_proof_card(
        ROOT / "public" / "press" / "gameplay" / "project-beacon-start.png",
        "PLAYABLE NOW",
        "PROJECT BEACON // FIRST SIGNAL",
        "Wanderer-77 is down. The signal is live.",
        "Recover what survived. Follow the signal. Find out what hatched in the wreckage.",
        "PLAY FREE IN YOUR BROWSER →",
        "Captured from the real Mythical Void browser game.",
    )


def first_contact_card():
    return framed_proof_card(
        ROOT / "public" / "press" / "gameplay" / "creature-cosmic-egg-hatch.png",
        "FIRST CONTACT",
        "THE MISSION CHANGES HERE",
        "The first alien life to trust a human.",
        "A creature hatches in the wreckage. What happens next becomes a question of care, courage and choice.",
        "BEGIN THE STORY →",
        "Captured from the real Mythical Void browser game.",
        GOLD,
    )


def creature_universe_card():
    image = gradient_background(bottom="#15102A")
    draw_brand(image, "CREATURE GENETICS")
    art = cover_crop(ROOT / "public" / "marketing" / "mythical-void-creature-universe-hero-v2.webp", (WIDTH, 750))
    overlay = Image.new("RGBA", art.size, (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    for y in range(art.height):
        alpha = int(max(0, (y - 390) / 360) * 220)
        overlay_draw.line((0, y, WIDTH, y), fill=(9, 7, 17, min(alpha, 220)))
    art = Image.alpha_composite(art.convert("RGBA"), overlay)
    image.paste(art.convert("RGB"), (0, 150))
    draw = ImageDraw.Draw(image)
    draw_rounded(draw, (68, 180, 560, 236), INK, outline=VIOLET, width=2, radius=28)
    draw.text((92, 197), "MARKETING ILLUSTRATION • NOT GAMEPLAY", font=font(FONT_HEAVY, 20), fill="#D3B7FF")
    draw_kicker(draw, "GENETICS OPEN THE POSSIBILITY", 68, 790, MINT)
    y = draw_wrapped(draw, "A universe of creatures.", (68, 840, WIDTH - 68, 1050), FONT_HEAVY, 76, CREAM, 4)
    draw_wrapped(draw, "Form, colour, personality, cosmic affinity and rare mutations combine into strange new possibilities.", (68, y + 26, WIDTH - 68, 1215), FONT_REGULAR, 32, MUTED, 9)
    draw_cta(draw, "DISCOVER WHAT MIGHT HATCH →", 1228, MINT)
    draw.text((70, 1320), "AI-generated marketing illustration inspired by real genetics-engine profiles.", font=font(FONT_REGULAR, 17), fill="#9389AA")
    return image


def stem_card():
    image = gradient_background(bottom="#180F2A")
    soft_glow(image, (280, 650), 250, VIOLET)
    draw_brand(image, "FREE ACTIVITY")
    screenshot = rounded_image(ROOT / "public" / "press" / "gameplay" / "nasa-apollo11-real-space-discovery.png", (400, 865), 42)
    image.paste(screenshot, (68, 180), screenshot)
    draw = ImageDraw.Draw(image)
    draw_kicker(draw, "REAL SPACE • IMAGINED WORLDS", 520, 210, MINT)
    y = draw_wrapped(draw, "Invent an organism from another dimension.", (520, 258, WIDTH - 55, 710), FONT_HEAVY, 59, CREAM, 4)
    y = draw_wrapped(draw, "Start with a real NASA clue. Imagine impossible rules. Test the idea like a scientist and a game designer.", (520, y + 32, WIDTH - 55, 930), FONT_REGULAR, 30, MUTED, 9)
    draw_rounded(draw, (520, y + 40, WIDTH - 55, y + 165), "#211737", outline="#594875", width=2, radius=24)
    draw.text((548, y + 69), "AGES 9-14", font=font(FONT_HEAVY, 25), fill=GOLD)
    draw.text((548, y + 107), "Families • Clubs • Classrooms", font=font(FONT_SEMIBOLD, 23), fill=CREAM)
    draw_cta(draw, "GET THE STEM CREATURE LAB →", 1125, MINT)
    draw.text((68, 1228), "Independent Mythical Void activity.", font=font(FONT_SEMIBOLD, 22), fill=CREAM)
    draw.text((68, 1265), "NASA does not endorse Mythical Void.", font=font(FONT_REGULAR, 22), fill=MUTED)
    draw.text((68, 1312), "The image shown is a real in-game NASA learning moment.", font=font(FONT_REGULAR, 17), fill="#9389AA")
    return image


CARDS = [
    ("01-origin", origin_card),
    ("02-playable-now", playable_card),
    ("03-creature-universe", creature_universe_card),
    ("04-stem-creature-lab", stem_card),
    ("05-first-contact", first_contact_card),
]


def save_card(name, builder):
    image = builder().convert("RGB")
    path = PUBLIC_OUTPUT / f"{name}.jpg"
    image.save(path, "JPEG", quality=92, subsampling=0, optimize=True, progressive=True)
    return path


def contact_sheet(paths):
    sheet = Image.new("RGB", (2040, 2050), INK)
    draw = ImageDraw.Draw(sheet)
    draw.text((80, 55), "MYTHICAL VOID // FIRST SIGNAL", font=font(FONT_HEAVY, 52), fill=CREAM)
    draw.text((80, 122), "Five finished social previews • Kevin approval and an official channel are still required", font=font(FONT_REGULAR, 28), fill=MUTED)
    positions = [(80, 210), (720, 210), (1360, 210), (400, 1120), (1040, 1120)]
    for path, position in zip(paths, positions):
        image = Image.open(path).convert("RGB").resize((600, 750), Image.Resampling.LANCZOS)
        sheet.paste(image, position)
        draw.text((position[0], position[1] + 772), path.stem.upper().replace("-", " "), font=font(FONT_SEMIBOLD, 24), fill=MINT)
    path = REVIEW_OUTPUT / "first-signal-contact-sheet.jpg"
    sheet.save(path, "JPEG", quality=91, subsampling=0, optimize=True, progressive=True)
    return path


def main():
    PUBLIC_OUTPUT.mkdir(parents=True, exist_ok=True)
    REVIEW_OUTPUT.mkdir(parents=True, exist_ok=True)
    paths = [save_card(name, builder) for name, builder in CARDS]
    review = contact_sheet(paths)
    for path in [*paths, review]:
        print(path)


if __name__ == "__main__":
    main()
