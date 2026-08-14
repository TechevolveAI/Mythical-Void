#!/usr/bin/env python3

"""Build the deterministic Mythical Void YouTube channel banner."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[2]
KIT = ROOT / "public/marketing/channel-kit/youtube"
BACKGROUND = KIT / "youtube-channel-banner-background-v1.png"
PROFILE = KIT / "youtube-profile-v1.png"
OUTPUT = KIT / "youtube-channel-banner-v1.jpg"
FONT_BOLD_CANDIDATES = [
    Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
]
FONT_REGULAR_CANDIDATES = [
    Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
]

CANVAS = (2560, 1440)
SAFE_AREA = (507, 508, 2053, 931)


def draw_text_with_shadow(draw, position, text, font, fill, shadow_offset):
    x, y = position
    sx, sy = shadow_offset
    draw.text((x + sx, y + sy), text, font=font, fill=(5, 3, 21, 235))
    draw.text((x, y), text, font=font, fill=fill)


def first_available(candidates, label):
    for candidate in candidates:
        if candidate.exists():
            return candidate
    raise SystemExit(f"No supported {label} font found: {', '.join(str(path) for path in candidates)}")


def require_inside_safe_area(box, label):
    left, top, right, bottom = box
    safe_left, safe_top, safe_right, safe_bottom = SAFE_AREA
    if left < safe_left or top < safe_top or right > safe_right or bottom > safe_bottom:
        raise SystemExit(f"{label} leaves the YouTube safe area: {box}")


def main():
    missing = [str(path) for path in (BACKGROUND, PROFILE) if not path.exists()]
    if missing:
        raise SystemExit(f"Missing YouTube kit inputs: {', '.join(missing)}")
    font_bold = first_available(FONT_BOLD_CANDIDATES, "bold")
    font_regular = first_available(FONT_REGULAR_CANDIDATES, "regular")

    background = Image.open(BACKGROUND).convert("RGB")
    banner = ImageOps.fit(background, CANVAS, method=Image.Resampling.LANCZOS)

    veil = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    veil_draw = ImageDraw.Draw(veil)
    veil_draw.rounded_rectangle((640, 545, 1940, 895), radius=54, fill=(4, 3, 19, 82))
    banner = Image.alpha_composite(banner.convert("RGBA"), veil)

    profile = Image.open(PROFILE).convert("RGBA")
    profile.thumbnail((300, 300), Image.Resampling.LANCZOS)
    profile_position = (720, 570)
    require_inside_safe_area(
        (*profile_position, profile_position[0] + profile.width, profile_position[1] + profile.height),
        "Profile emblem",
    )
    banner.alpha_composite(profile, profile_position)

    draw = ImageDraw.Draw(banner)
    title_font = ImageFont.truetype(str(font_bold), 92)
    promise_font = ImageFont.truetype(str(font_bold), 36)
    address_font = ImageFont.truetype(str(font_regular), 30)

    text_items = [
        ((960, 597), "MYTHICAL VOID", title_font),
        ((960, 727), "A UNIVERSE OF CREATURES IS WAITING.", promise_font),
        ((960, 792), "PLAY FREE  •  MYTHICALVOID.COM", address_font),
    ]
    for position, text, font in text_items:
        require_inside_safe_area(draw.textbbox(position, text, font=font), text)

    draw_text_with_shadow(draw, (960, 597), "MYTHICAL VOID", title_font, (255, 248, 232, 255), (4, 5))
    draw_text_with_shadow(
        draw,
        (960, 727),
        "A UNIVERSE OF CREATURES IS WAITING.",
        promise_font,
        (121, 231, 210, 255),
        (3, 3),
    )
    draw_text_with_shadow(
        draw,
        (960, 792),
        "PLAY FREE  •  MYTHICALVOID.COM",
        address_font,
        (255, 248, 232, 255),
        (3, 3),
    )

    banner.convert("RGB").save(OUTPUT, "JPEG", quality=92, optimize=True, progressive=True)
    print(
        {
            "output": str(OUTPUT.relative_to(ROOT)),
            "dimensions": CANVAS,
            "safeArea": SAFE_AREA,
            "generatedArtworkDisclosureRequired": True,
        }
    )


if __name__ == "__main__":
    main()
