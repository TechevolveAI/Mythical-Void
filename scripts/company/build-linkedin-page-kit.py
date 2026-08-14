#!/usr/bin/env python3

"""Build deterministic Mythical Void LinkedIn Company Page artwork."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[2]
YOUTUBE_KIT = ROOT / "public/marketing/channel-kit/youtube"
KIT = ROOT / "public/marketing/channel-kit/linkedin"
BACKGROUND = YOUTUBE_KIT / "youtube-channel-banner-background-v1.png"
MARK = ROOT / "public/marketing/mythical-void-mark-512.png"
COVER_OUTPUT = KIT / "linkedin-page-cover-v1.jpg"
LOGO_OUTPUT = KIT / "linkedin-page-logo-v1.png"

COVER_SIZE = (4200, 700)
LOGO_SIZE = (400, 400)
CENTRAL_DETAIL_AREA = (900, 90, 3300, 610)
FONT_BOLD_CANDIDATES = [
    Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
]
FONT_REGULAR_CANDIDATES = [
    Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
]


def first_available(candidates, label):
    for candidate in candidates:
        if candidate.exists():
            return candidate
    raise SystemExit(f"No supported {label} font found: {', '.join(str(path) for path in candidates)}")


def draw_text_with_shadow(draw, position, text, font, fill, shadow=(3, 4)):
    x, y = position
    draw.text((x + shadow[0], y + shadow[1]), text, font=font, fill=(5, 3, 21, 230))
    draw.text(position, text, font=font, fill=fill)


def require_central(box, label):
    left, top, right, bottom = box
    safe_left, safe_top, safe_right, safe_bottom = CENTRAL_DETAIL_AREA
    if left < safe_left or top < safe_top or right > safe_right or bottom > safe_bottom:
        raise SystemExit(f"{label} leaves the central cover area: {box}")


def build_cover(mark, bold_font_path, regular_font_path):
    background = Image.open(BACKGROUND).convert("RGB")
    cover = ImageOps.fit(background, COVER_SIZE, method=Image.Resampling.LANCZOS, centering=(0.5, 0.52)).convert("RGBA")

    veil = Image.new("RGBA", COVER_SIZE, (0, 0, 0, 0))
    veil_draw = ImageDraw.Draw(veil)
    veil_draw.rounded_rectangle((1150, 92, 3050, 608), radius=58, fill=(4, 3, 19, 92))
    cover = Image.alpha_composite(cover, veil)

    cover_mark = mark.copy()
    cover_mark.thumbnail((310, 430), Image.Resampling.LANCZOS)
    mark_position = (1370, 135)
    require_central(
        (*mark_position, mark_position[0] + cover_mark.width, mark_position[1] + cover_mark.height),
        "LinkedIn cover emblem",
    )
    cover.alpha_composite(cover_mark, mark_position)

    draw = ImageDraw.Draw(cover)
    title_font = ImageFont.truetype(str(bold_font_path), 132)
    promise_font = ImageFont.truetype(str(bold_font_path), 48)
    address_font = ImageFont.truetype(str(regular_font_path), 37)
    text_items = [
        ((1740, 145), "MYTHICAL VOID", title_font, (255, 248, 232, 255)),
        ((1745, 325), "SMALL STUDIO. STRANGE WORLDS. CAREFUL AI.", promise_font, (121, 231, 210, 255)),
        ((1745, 416), "PLAY FREE  •  MYTHICALVOID.COM", address_font, (255, 248, 232, 255)),
    ]
    for position, text, font, fill in text_items:
        require_central(draw.textbbox(position, text, font=font), text)
        draw_text_with_shadow(draw, position, text, font, fill)

    cover.convert("RGB").save(COVER_OUTPUT, "JPEG", quality=91, optimize=True, progressive=True)


def build_logo(mark):
    logo = Image.new("RGBA", LOGO_SIZE, (7, 5, 25, 255))
    glow = Image.new("RGBA", LOGO_SIZE, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((42, 42, 358, 358), fill=(70, 28, 128, 90))
    logo = Image.alpha_composite(logo, glow)

    logo_mark = mark.copy()
    logo_mark.thumbnail((330, 360), Image.Resampling.LANCZOS)
    position = ((LOGO_SIZE[0] - logo_mark.width) // 2, (LOGO_SIZE[1] - logo_mark.height) // 2)
    logo.alpha_composite(logo_mark, position)
    logo.save(LOGO_OUTPUT, "PNG", optimize=True)


def main():
    missing = [str(path) for path in (BACKGROUND, MARK) if not path.exists()]
    if missing:
        raise SystemExit(f"Missing LinkedIn kit inputs: {', '.join(missing)}")
    KIT.mkdir(parents=True, exist_ok=True)
    bold_font = first_available(FONT_BOLD_CANDIDATES, "bold")
    regular_font = first_available(FONT_REGULAR_CANDIDATES, "regular")
    mark = Image.open(MARK).convert("RGBA")
    build_cover(mark, bold_font, regular_font)
    build_logo(mark)
    print(
        {
            "cover": str(COVER_OUTPUT.relative_to(ROOT)),
            "coverDimensions": COVER_SIZE,
            "logo": str(LOGO_OUTPUT.relative_to(ROOT)),
            "logoDimensions": LOGO_SIZE,
            "generatedArtworkDisclosureRequired": True,
        }
    )


if __name__ == "__main__":
    main()
