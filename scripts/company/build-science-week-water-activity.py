#!/usr/bin/env python3

from pathlib import Path

from reportlab.lib.colors import HexColor, Color
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output/pdf/mythical-void-water-that-isnt-water.pdf"
MARK = ROOT / "public/marketing/mythical-void-mark-512.png"

PAGE_W, PAGE_H = A4
NAVY = HexColor("#090A20")
INK = HexColor("#171938")
CREAM = HexColor("#FFF8E8")
WHITE = HexColor("#FFFFFF")
MINT = HexColor("#76E2D0")
TEAL = HexColor("#1EA9A1")
GOLD = HexColor("#F4C95D")
PURPLE = HexColor("#8357D8")
LILAC = HexColor("#EDE4FF")
BLUE = HexColor("#2B78C5")
PALE_BLUE = HexColor("#E7F4FF")
PALE_MINT = HexColor("#E8FBF7")
PALE_GOLD = HexColor("#FFF3C8")
GREY = HexColor("#626582")
LINE = HexColor("#D6D7E5")


def wrap_lines(text, font, size, width):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        trial = word if not current else f"{current} {word}"
        if stringWidth(trial, font, size) <= width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_wrapped(c, text, x, y, width, font="Helvetica", size=10, color=INK, leading=None, max_lines=None):
    leading = leading or size * 1.3
    lines = wrap_lines(text, font, size, width)
    if max_lines is not None:
        lines = lines[:max_lines]
    c.setFont(font, size)
    c.setFillColor(color)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_header(c, page_number, label):
    c.setFillColor(NAVY)
    c.rect(0, PAGE_H - 25 * mm, PAGE_W, 25 * mm, fill=1, stroke=0)
    if MARK.exists():
        c.drawImage(ImageReader(str(MARK)), 14 * mm, PAGE_H - 21 * mm, 14 * mm, 14 * mm, mask="auto", preserveAspectRatio=True)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(31 * mm, PAGE_H - 13 * mm, "MYTHICAL VOID")
    c.setFillColor(MINT)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawRightString(PAGE_W - 15 * mm, PAGE_H - 13 * mm, f"{label.upper()}  |  {page_number}/3")


def card(c, x, y, w, h, fill, stroke=LINE, radius=5 * mm):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.8)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def label_pill(c, text, x, y, fill, text_color=INK, width=None):
    c.setFont("Helvetica-Bold", 7)
    width = width or stringWidth(text, "Helvetica-Bold", 7) + 8 * mm
    c.setFillColor(fill)
    c.roundRect(x, y, width, 7 * mm, 3.5 * mm, fill=1, stroke=0)
    c.setFillColor(text_color)
    c.drawCentredString(x + width / 2, y + 2.3 * mm, text)
    return width


def line_field(c, x, y, w, label, lines=1):
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x, y, label.upper())
    y -= 5 * mm
    c.setStrokeColor(LINE)
    c.setLineWidth(0.8)
    for _ in range(lines):
        c.line(x, y, x + w, y)
        y -= 7 * mm
    return y


def checkbox(c, x, y, text, width):
    c.setStrokeColor(PURPLE)
    c.setLineWidth(1)
    c.roundRect(x, y - 2.7 * mm, 4.2 * mm, 4.2 * mm, 1 * mm, fill=0, stroke=1)
    draw_wrapped(c, text, x + 6 * mm, y, width - 6 * mm, size=8.5, color=INK, leading=3.8 * mm)


def page_one(c):
    c.setFillColor(CREAM)
    c.rect(0, 0, PAGE_W, PAGE_H - 25 * mm, fill=1, stroke=0)
    draw_header(c, 1, "Explorer sheet")

    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 25)
    c.drawString(15 * mm, PAGE_H - 42 * mm, "WATER THAT ISN'T WATER")
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(TEAL)
    c.drawString(15 * mm, PAGE_H - 51 * mm, "Three real worlds. One impossible realm. Your organism.")
    draw_wrapped(
        c,
        "Start with evidence. Notice what scientists know, what they infer, and what remains unknown. Then cross clearly into fiction.",
        15 * mm,
        PAGE_H - 61 * mm,
        178 * mm,
        size=9.5,
        color=GREY,
        leading=4.5 * mm,
    )

    card_y = PAGE_H - 157 * mm
    card_h = 81 * mm
    gap = 5 * mm
    card_w = (180 * mm - 2 * gap) / 3
    xs = [15 * mm, 15 * mm + card_w + gap, 15 * mm + 2 * (card_w + gap)]
    cards = [
        {
            "title": "EARTH",
            "fill": PALE_BLUE,
            "accent": BLUE,
            "pill": "OBSERVED",
            "big": "Liquid-water oceans",
            "body": "Water covers most of Earth's surface. Life as we know it uses liquid water, energy and useful chemistry.",
            "question": "What does water let living things do?",
        },
        {
            "title": "EUROPA",
            "fill": LILAC,
            "accent": PURPLE,
            "pill": "SCIENTISTS INFER",
            "big": "A salty ocean under ice",
            "body": "Scientists think Europa hides a salty ocean beneath an icy crust. NASA's Europa Clipper is investigating whether it has conditions that could support life.",
            "question": "How could life sense a world above the ice?",
        },
        {
            "title": "TITAN",
            "fill": PALE_GOLD,
            "accent": HexColor("#C68B00"),
            "pill": "OBSERVED",
            "big": "Lakes without water",
            "body": "Titan has rivers, lakes and seas of liquid methane and ethane on its surface. They are not liquid water.",
            "question": "Could a different liquid change the rules of life?",
        },
    ]
    for x, item in zip(xs, cards):
        card(c, x, card_y, card_w, card_h, item["fill"], stroke=Color(item["accent"].red, item["accent"].green, item["accent"].blue, alpha=0.35))
        c.setFillColor(item["accent"])
        c.circle(x + 9 * mm, card_y + card_h - 11 * mm, 5 * mm, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(x + 9 * mm, card_y + card_h - 13.2 * mm, str(cards.index(item) + 1))
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 15)
        c.drawString(x + 7 * mm, card_y + card_h - 24 * mm, item["title"])
        label_pill(c, item["pill"], x + 7 * mm, card_y + card_h - 35 * mm, item["accent"], WHITE)
        y = draw_wrapped(c, item["big"], x + 7 * mm, card_y + card_h - 45 * mm, card_w - 14 * mm, font="Helvetica-Bold", size=10.5, leading=4.8 * mm)
        y -= 2 * mm
        y = draw_wrapped(c, item["body"], x + 7 * mm, y, card_w - 14 * mm, size=7.7, color=GREY, leading=3.3 * mm)
        c.setStrokeColor(item["accent"])
        c.setLineWidth(1.2)
        c.line(x + 7 * mm, card_y + 14 * mm, x + card_w - 7 * mm, card_y + 14 * mm)
        draw_wrapped(c, item["question"], x + 7 * mm, card_y + 9 * mm, card_w - 14 * mm, font="Helvetica-Bold", size=8, color=INK, leading=3.5 * mm)

    lower_y = 28 * mm
    lower_h = 69 * mm
    card(c, 15 * mm, lower_y, 180 * mm, lower_h, WHITE, stroke=MINT, radius=6 * mm)
    label_pill(c, "NOW CROSS INTO FICTION", 23 * mm, lower_y + lower_h - 13 * mm, MINT)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(23 * mm, lower_y + lower_h - 25 * mm, "STELLAR REEF")
    draw_wrapped(c, "In Mythical Void, cosmic energy flows like water. This realm and its organisms are invented.", 23 * mm, lower_y + lower_h - 34 * mm, 160 * mm, size=9, color=GREY, leading=4.2 * mm)
    c.setFillColor(PURPLE)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(23 * mm, lower_y + 23 * mm, "CHOOSE YOUR STARTING RULE")
    checkbox(c, 23 * mm, lower_y + 15 * mm, "It flows around solid islands.", 48 * mm)
    checkbox(c, 78 * mm, lower_y + 15 * mm, "It changes direction when observed.", 52 * mm)
    checkbox(c, 137 * mm, lower_y + 15 * mm, "It carries light instead of heat.", 47 * mm)


def page_two(c):
    c.setFillColor(PALE_MINT)
    c.rect(0, 0, PAGE_W, PAGE_H - 25 * mm, fill=1, stroke=0)
    draw_header(c, 2, "Creature design sheet")

    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 23)
    c.drawString(15 * mm, PAGE_H - 42 * mm, "DESIGN THE ORGANISM")
    label_pill(c, "BEGIN WITH THE PROBLEM - NOT AN EARTH ANIMAL", 15 * mm, PAGE_H - 54 * mm, GOLD, width=83 * mm)
    draw_wrapped(c, "Your organism does not need a face, head, limbs, skin or one permanent body.", 15 * mm, PAGE_H - 63 * mm, 180 * mm, size=9.5, color=GREY)

    left_x = 15 * mm
    left_w = 66 * mm
    right_x = 87 * mm
    right_w = 108 * mm
    start_y = PAGE_H - 79 * mm

    card(c, left_x, 100 * mm, left_w, 110 * mm, WHITE, stroke=TEAL)
    c.setFillColor(TEAL)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(left_x + 7 * mm, 201 * mm, "SURVIVAL RULES")
    y = 191 * mm
    y = line_field(c, left_x + 7 * mm, y, left_w - 14 * mm, "How does it hold together?", 2)
    y -= 2 * mm
    y = line_field(c, left_x + 7 * mm, y, left_w - 14 * mm, "How does it sense change?", 2)
    y -= 2 * mm
    y = line_field(c, left_x + 7 * mm, y, left_w - 14 * mm, "Where does energy come from?", 2)
    y -= 2 * mm
    line_field(c, left_x + 7 * mm, y, left_w - 14 * mm, "How does it move or spread?", 2)

    card(c, right_x, 100 * mm, right_w, 110 * mm, WHITE, stroke=PURPLE)
    c.setFillColor(PURPLE)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(right_x + 7 * mm, 201 * mm, "DRAW THE FORM - AND SHOW HOW IT CAN CHANGE")
    c.setStrokeColor(LILAC)
    c.setLineWidth(0.7)
    for i in range(1, 6):
        c.line(right_x + 7 * mm, (100 + i * 16) * mm, right_x + right_w - 7 * mm, (100 + i * 16) * mm)
    for i in range(1, 6):
        c.line((right_x / mm + 7 + i * 16) * mm, 108 * mm, (right_x / mm + 7 + i * 16) * mm, 193 * mm)
    c.setFillColor(GREY)
    c.setFont("Helvetica-Oblique", 8)
    c.drawCentredString(right_x + right_w / 2, 105 * mm, "Use labels and arrows. The form can be temporary or distributed.")

    card(c, 15 * mm, 54 * mm, 180 * mm, 38 * mm, CREAM, stroke=GOLD)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(22 * mm, 83 * mm, "ONE TESTABLE PREDICTION")
    draw_wrapped(c, "If the Stellar Reef flow changes in this way...", 22 * mm, 75 * mm, 74 * mm, size=8.5, color=GREY)
    c.setStrokeColor(LINE)
    c.line(22 * mm, 66 * mm, 94 * mm, 66 * mm)
    c.line(22 * mm, 59 * mm, 94 * mm, 59 * mm)
    draw_wrapped(c, "...then the organism will respond in this way, because...", 105 * mm, 75 * mm, 76 * mm, size=8.5, color=GREY)
    c.line(105 * mm, 66 * mm, 181 * mm, 66 * mm)
    c.line(105 * mm, 59 * mm, 181 * mm, 59 * mm)

    card(c, 15 * mm, 18 * mm, 180 * mm, 28 * mm, NAVY, stroke=NAVY)
    c.setFillColor(MINT)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(22 * mm, 37 * mm, "RESTORE THE REEF")
    c.setFillColor(WHITE)
    c.setFont("Helvetica", 8.5)
    c.drawString(22 * mm, 29 * mm, "Which damaged part of the habitat should be restored first - and how does that help your organism?")
    c.setStrokeColor(Color(1, 1, 1, alpha=0.45))
    c.line(22 * mm, 23 * mm, 181 * mm, 23 * mm)


def page_three(c):
    c.setFillColor(WHITE)
    c.rect(0, 0, PAGE_W, PAGE_H - 25 * mm, fill=1, stroke=0)
    draw_header(c, 3, "Adult facilitator note")

    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(15 * mm, PAGE_H - 42 * mm, "ADULT FACILITATOR NOTE")
    c.setFillColor(TEAL)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(15 * mm, PAGE_H - 52 * mm, "A 45-60 minute paper-led design lab for ages 9-14")
    draw_wrapped(c, "Aim: help young designers separate observation, scientific inference and fiction while imagining life for a radically unfamiliar environment.", 15 * mm, PAGE_H - 62 * mm, 180 * mm, size=9, color=GREY, leading=4.2 * mm)

    table_x = 15 * mm
    table_y = 129 * mm
    table_w = 180 * mm
    table_h = 88 * mm
    card(c, table_x, table_y, table_w, table_h, CREAM, stroke=LINE)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(table_x + 6 * mm, table_y + table_h - 10 * mm, "RUN THE SESSION")
    steps = [
        ("1", "8 min", "Three strange seas", "Compare Earth, Europa and Titan. Ask what is observed, inferred and unknown."),
        ("2", "7 min", "Cross into fiction", "State clearly that Stellar Reef and cosmic flow are invented."),
        ("3", "18 min", "Design the organism", "Start with survival problems, not an animal name or familiar body."),
        ("4", "10 min", "Make a prediction", "Use the If... then... because... sentence on page 2."),
        ("5", "7 min", "Restore the reef", "Choose one habitat repair and explain its effect on survival."),
    ]
    row_y = table_y + table_h - 20 * mm
    for number, minutes, title, body in steps:
        c.setFillColor(PURPLE)
        c.circle(table_x + 8 * mm, row_y + 1.5 * mm, 3.5 * mm, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 7)
        c.drawCentredString(table_x + 8 * mm, row_y - 0.8 * mm, number)
        c.setFillColor(TEAL)
        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(table_x + 15 * mm, row_y, minutes)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(table_x + 31 * mm, row_y, title)
        draw_wrapped(c, body, table_x + 71 * mm, row_y, 100 * mm, size=7.5, color=GREY, leading=3.2 * mm, max_lines=2)
        row_y -= 14 * mm

    left_x = 15 * mm
    right_x = 108 * mm
    col_w = 87 * mm
    card(c, left_x, 69 * mm, col_w, 51 * mm, PALE_MINT, stroke=MINT)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(left_x + 6 * mm, 111 * mm, "KEEP SCIENCE AND FICTION CLEAR")
    science_points = [
        "Say 'scientists think' for Europa's hidden ocean.",
        "Titan's surface lakes are methane and ethane, not water.",
        "Stellar Reef, cosmic flow and designed organisms are fiction.",
        "A prediction explains what would happen under the invented rules.",
    ]
    y = 103 * mm
    for point in science_points:
        c.setFillColor(TEAL)
        c.circle(left_x + 7 * mm, y + 1 * mm, 1.3 * mm, fill=1, stroke=0)
        y = draw_wrapped(c, point, left_x + 11 * mm, y + 2 * mm, col_w - 17 * mm, size=7.8, color=INK, leading=3.4 * mm)
        y -= 1.8 * mm

    card(c, right_x, 69 * mm, col_w, 51 * mm, LILAC, stroke=PURPLE)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(right_x + 6 * mm, 111 * mm, "SAFETY AND PRIVACY")
    safety_points = [
        "No real methane, ethane or unknown chemicals.",
        "No child account or direct contact with the studio.",
        "Do not collect names, ages, faces, schools or contact details.",
        "Display work only with adult permission and no identifying details.",
    ]
    y = 103 * mm
    for point in safety_points:
        c.setFillColor(PURPLE)
        c.circle(right_x + 7 * mm, y + 1 * mm, 1.3 * mm, fill=1, stroke=0)
        y = draw_wrapped(c, point, right_x + 11 * mm, y + 2 * mm, col_w - 17 * mm, size=7.8, color=INK, leading=3.4 * mm)
        y -= 1.8 * mm

    card(c, 15 * mm, 18 * mm, 180 * mm, 43 * mm, NAVY, stroke=NAVY)
    c.setFillColor(MINT)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(22 * mm, 52 * mm, "REAL-SPACE SOURCES")
    sources = [
        "NASA Ocean Worlds: science.nasa.gov/solar-system/ocean-worlds/",
        "NASA Europa - Ingredients for Life: science.nasa.gov/mission/europa-clipper/why-europa-ingredients-for-life/",
        "NASA Titan Facts: science.nasa.gov/saturn/moons/titan/facts/",
    ]
    y = 44 * mm
    c.setFont("Helvetica", 7.2)
    c.setFillColor(WHITE)
    for source in sources:
        c.drawString(22 * mm, y, source)
        y -= 5 * mm
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 7.3)
    c.drawString(22 * mm, 24 * mm, "Independent Mythical Void activity. NASA does not endorse Mythical Void.")


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=A4, pageCompression=1)
    c.setTitle("Water That Isn't Water - Mythical Void")
    c.setAuthor("Mythical Void")
    c.setSubject("Adult-led ocean worlds and alien organism design activity")
    page_one(c)
    c.showPage()
    page_two(c)
    c.showPage()
    page_three(c)
    c.showPage()
    c.save()
    print(OUTPUT)


if __name__ == "__main__":
    build()
