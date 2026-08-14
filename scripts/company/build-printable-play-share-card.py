#!/usr/bin/env python3

from pathlib import Path
import os
import shutil
import sys
import tempfile

try:
    import qrcode
    from PIL import Image
    from reportlab.lib.colors import HexColor
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfbase.pdfmetrics import stringWidth
    from reportlab.pdfgen import canvas
except ImportError as error:
    raise SystemExit(
        "Missing PDF dependencies. Install reportlab and qrcode, then run this builder again. "
        f"Original error: {error}"
    )


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "mythical-void-play-share-card.pdf"
HERO = ROOT / "public" / "marketing" / "mythical-void-creature-universe-hero-v2.webp"
EMBLEM = ROOT / "public" / "marketing" / "mythical-void-emblem-v3.png"
GAMEPLAY = ROOT / "public" / "press" / "gameplay" / "project-beacon-start.png"
PLAY_URL = "https://mythicalvoid.com/"


def cover_image(pdf, image_path, x, y, width, height, anchor_x=0.5, anchor_y=0.5):
    image = ImageReader(str(image_path))
    source_width, source_height = image.getSize()
    scale = max(width / source_width, height / source_height)
    draw_width = source_width * scale
    draw_height = source_height * scale
    draw_x = x - (draw_width - width) * anchor_x
    draw_y = y - (draw_height - height) * anchor_y
    pdf.saveState()
    clip = pdf.beginPath()
    clip.rect(x, y, width, height)
    pdf.clipPath(clip, stroke=0, fill=0)
    pdf.drawImage(image, draw_x, draw_y, draw_width, draw_height, mask="auto")
    pdf.restoreState()


def rounded_image(pdf, image_path, x, y, width, height, radius=12, anchor_x=0.5, anchor_y=0.5):
    image = ImageReader(str(image_path))
    source_width, source_height = image.getSize()
    scale = max(width / source_width, height / source_height)
    draw_width = source_width * scale
    draw_height = source_height * scale
    draw_x = x - (draw_width - width) * anchor_x
    draw_y = y - (draw_height - height) * anchor_y
    pdf.saveState()
    clip = pdf.beginPath()
    clip.roundRect(x, y, width, height, radius)
    pdf.clipPath(clip, stroke=0, fill=0)
    pdf.drawImage(image, draw_x, draw_y, draw_width, draw_height, mask="auto")
    pdf.restoreState()


def draw_tracking(pdf, text, x, y, font="Helvetica-Bold", size=8.5, tracking=1.5, color=HexColor("#7AE4D1")):
    pdf.setFillColor(color)
    pdf.setFont(font, size)
    cursor = x
    for char in text:
        pdf.drawString(cursor, y, char)
        cursor += stringWidth(char, font, size) + tracking


def draw_wrapped(pdf, text, x, y, max_width, font, size, leading, color):
    pdf.setFont(font, size)
    pdf.setFillColor(color)
    words = text.split()
    lines = []
    current = []
    for word in words:
        candidate = " ".join(current + [word])
        if current and stringWidth(candidate, font, size) > max_width:
            lines.append(" ".join(current))
            current = [word]
        else:
            current.append(word)
    if current:
        lines.append(" ".join(current))
    for line in lines:
        pdf.drawString(x, y, line)
        y -= leading
    return y


def build(output_path=OUTPUT):
    for required in [HERO, EMBLEM, GAMEPLAY]:
        if not required.exists():
            raise FileNotFoundError(required)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    width, height = A4
    dark = HexColor("#090719")
    cream = HexColor("#FFF8E8")
    mint = HexColor("#7AE4D1")
    yellow = HexColor("#FFD66B")
    lavender = HexColor("#BCA9FF")
    quiet = HexColor("#BBB8D0")

    with tempfile.TemporaryDirectory(prefix="mythical-share-card-") as scratch:
        hero_print_path = Path(scratch) / "creature-universe-print.jpg"
        gameplay_print_path = Path(scratch) / "project-beacon-print.jpg"
        Image.open(HERO).convert("RGB").save(hero_print_path, "JPEG", quality=88, optimize=True, progressive=True)
        Image.open(GAMEPLAY).convert("RGB").save(gameplay_print_path, "JPEG", quality=86, optimize=True, progressive=True)
        qr_path = Path(scratch) / "play-qr.png"
        qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_Q, box_size=12, border=3)
        qr.add_data(PLAY_URL)
        qr.make(fit=True)
        qr.make_image(fill_color="#090719", back_color="#FFF8E8").save(qr_path)

        pdf = canvas.Canvas(str(output_path), pagesize=A4, pageCompression=1)
        pdf.setTitle("Mythical Void - Play and Share Card")
        pdf.setAuthor("Mythical")
        pdf.setSubject("A printable, adult-led share card for the free Mythical Void browser game")

        pdf.setFillColor(dark)
        pdf.rect(0, 0, width, height, fill=1, stroke=0)

        hero_height = 335
        cover_image(pdf, hero_print_path, 0, height - hero_height, width, hero_height, anchor_x=0.5, anchor_y=0.5)
        pdf.setFillColor(dark)
        pdf.rect(0, height - 64, width, 64, fill=1, stroke=0)

        pdf.drawImage(ImageReader(str(EMBLEM)), 28, height - 53, 18, 30, preserveAspectRatio=True, mask="auto", anchor="c")
        draw_tracking(pdf, "MYTHICAL VOID", 55, height - 43, size=10, tracking=1.8, color=cream)
        pdf.setFont("Helvetica-Bold", 8)
        pdf.setFillColor(mint)
        pdf.drawRightString(width - 28, height - 43, "FREE BROWSER GAME")

        pdf.setFillColor(dark)
        pdf.rect(0, 0, width, height - hero_height, fill=1, stroke=0)

        draw_tracking(pdf, "THE VOID IS OPEN", 32, 468, size=9, tracking=2.1, color=mint)
        pdf.setFont("Helvetica-Bold", 31)
        pdf.setFillColor(cream)
        pdf.drawString(32, 427, "Hatch a creature.")
        pdf.setFillColor(mint)
        pdf.drawString(32, 392, "Change its world.")

        draw_wrapped(
            pdf,
            "Explore strange realms, restore what the Void changed, and discover real space science along the way.",
            32,
            363,
            330,
            "Helvetica",
            11.5,
            16,
            quiet,
        )

        rounded_image(pdf, gameplay_print_path, 32, 193, 310, 142, radius=13, anchor_x=0.5, anchor_y=0.5)
        pdf.setFillColor(HexColor("#15112B"))
        pdf.roundRect(43, 204, 87, 20, 10, fill=1, stroke=0)
        pdf.setFillColor(cream)
        pdf.setFont("Helvetica-Bold", 7.5)
        pdf.drawCentredString(86.5, 211, "REAL GAMEPLAY")

        card_x, card_y, card_w, card_h = 365, 193, 198, 246
        pdf.setFillColor(cream)
        pdf.roundRect(card_x, card_y, card_w, card_h, 18, fill=1, stroke=0)
        pdf.setFillColor(dark)
        pdf.setFont("Helvetica-Bold", 16)
        pdf.drawCentredString(card_x + card_w / 2, card_y + card_h - 31, "SCAN TO PLAY")
        pdf.drawImage(ImageReader(str(qr_path)), card_x + 31, card_y + 69, 136, 136, mask="auto")
        pdf.linkURL(PLAY_URL, (card_x + 25, card_y + 25, card_x + card_w - 25, card_y + card_h - 20), relative=0)
        pdf.setFillColor(HexColor("#413B59"))
        pdf.setFont("Helvetica-Bold", 9)
        pdf.drawCentredString(card_x + card_w / 2, card_y + 49, "MYTHICALVOID.COM")
        pdf.setFont("Helvetica", 7.5)
        pdf.drawCentredString(card_x + card_w / 2, card_y + 31, "No account. No download. No payment.")

        pdf.setFillColor(HexColor("#18142D"))
        pdf.roundRect(32, 132, 531, 42, 12, fill=1, stroke=0)
        items = [("HATCH", lavender), ("EXPLORE", mint), ("RESTORE", yellow), ("DISCOVER", lavender)]
        x_positions = [65, 190, 323, 454]
        for (label, color), x in zip(items, x_positions):
            pdf.setFillColor(color)
            pdf.circle(x - 13, 153, 3.2, fill=1, stroke=0)
            pdf.setFont("Helvetica-Bold", 8.5)
            pdf.drawString(x, 150, label)

        pdf.setStrokeColor(HexColor("#332D4B"))
        pdf.line(32, 105, 563, 105)
        draw_wrapped(
            pdf,
            "Made in Ireland by a father and son, using imagination and generative AI to see what a small family team could build.",
            32,
            86,
            531,
            "Helvetica-Bold",
            9.5,
            13,
            cream,
        )
        draw_wrapped(
            pdf,
            "Creature-universe artwork is an AI-generated illustration, not gameplay. The framed image is from the current browser game. NASA public data supports optional STEM moments; NASA does not endorse Mythical Void.",
            32,
            50,
            531,
            "Helvetica",
            6.8,
            9,
            quiet,
        )

        pdf.showPage()
        pdf.save()

    return output_path


if __name__ == "__main__":
    requested = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else OUTPUT
    print(build(requested))
