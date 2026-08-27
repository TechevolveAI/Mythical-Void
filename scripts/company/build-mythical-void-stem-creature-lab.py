#!/usr/bin/env python3

from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "mythical-void-stem-creature-lab.pdf"
LOGO = ROOT / "public" / "marketing" / "mythical-void-emblem-v3.png"

PAGE_W, PAGE_H = A4
INK = HexColor("#0D0B24")
PURPLE = HexColor("#6C2BD9")
DEEP_PURPLE = HexColor("#271052")
LILAC = HexColor("#E8DBFF")
MINT = HexColor("#72E1CF")
PALE_MINT = HexColor("#DDF8F2")
GOLD = HexColor("#F4C552")
CREAM = HexColor("#FBF5E6")
PINK = HexColor("#FF8FB1")
GREY = HexColor("#68647A")
PALE_GREY = HexColor("#E3E0E8")


def rounded_box(pdf, x, y, w, h, fill, stroke=PALE_GREY, radius=12, width=1):
    pdf.setLineWidth(width)
    pdf.setStrokeColor(stroke)
    pdf.setFillColor(fill)
    pdf.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def wrap(text, font, size, max_width):
    words = text.split()
    lines = []
    line = ""
    for word in words:
        trial = word if not line else f"{line} {word}"
        if stringWidth(trial, font, size) <= max_width:
            line = trial
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def draw_text(pdf, text, x, y, max_width, size=10, leading=None, font="Helvetica", color=INK, max_lines=None):
    leading = leading or size * 1.3
    lines = wrap(text, font, size, max_width)
    if max_lines:
        lines = lines[:max_lines]
    pdf.setFillColor(color)
    pdf.setFont(font, size)
    for line in lines:
        pdf.drawString(x, y, line)
        y -= leading
    return y


def page_footer(pdf, page_number, dark=False):
    color = HexColor("#C7BEDA") if dark else GREY
    pdf.setFillColor(color)
    pdf.setFont("Helvetica", 7.5)
    pdf.drawString(36, 23, "MYTHICAL VOID  |  INVENT AN ORGANISM FROM ANOTHER DIMENSION")
    pdf.drawRightString(PAGE_W - 36, 23, f"{page_number} / 4")


def checkbox(pdf, x, y, label, width=150, size=8.5):
    pdf.setStrokeColor(GREY)
    pdf.setLineWidth(0.8)
    pdf.rect(x, y - 7, 8, 8, fill=0, stroke=1)
    draw_text(pdf, label, x + 13, y, width - 13, size=size, leading=size + 1.5)


def write_lines(pdf, x, y, width, rows, gap=17):
    pdf.setStrokeColor(HexColor("#BDB8C7"))
    pdf.setLineWidth(0.55)
    for index in range(rows):
        line_y = y - index * gap
        pdf.line(x, line_y, x + width, line_y)


def section_label(pdf, number, title, y):
    pdf.setFillColor(PURPLE)
    pdf.circle(48, y + 3, 13, fill=1, stroke=0)
    pdf.setFillColor(white)
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawCentredString(48, y - 1, str(number))
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 22)
    pdf.drawString(76, y - 5, title)


def cover(pdf):
    pdf.setFillColor(CREAM)
    pdf.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    pdf.setFillColor(LILAC)
    pdf.circle(PAGE_W - 42, PAGE_H - 35, 105, fill=1, stroke=0)
    pdf.setFillColor(PURPLE)
    pdf.circle(PAGE_W - 32, PAGE_H - 26, 58, fill=1, stroke=0)
    pdf.setFillColor(MINT)
    pdf.circle(PAGE_W - 48, PAGE_H - 40, 24, fill=1, stroke=0)
    pdf.setFillColor(GOLD)
    pdf.circle(0, 88, 44, fill=1, stroke=0)

    pdf.setFillColor(PURPLE)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(42, PAGE_H - 55, "MYTHICAL VOID STEM CREATURE LAB")

    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 34)
    pdf.drawString(42, PAGE_H - 118, "Invent an organism")
    pdf.drawString(42, PAGE_H - 158, "from another dimension")

    draw_text(
        pdf,
        "Start with a real space clue. Imagine impossible rules. Design a living system that could survive - then test it like a scientist and a game designer.",
        44,
        PAGE_H - 203,
        360,
        size=12,
        leading=16,
        color=GREY,
    )

    rounded_box(pdf, 44, PAGE_H - 354, 340, 74, white, stroke=LILAC, radius=14)
    pdf.setFillColor(PURPLE)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(60, PAGE_H - 304, "GOOD FOR")
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(60, PAGE_H - 325, "Ages 9-14  |  Families  |  Clubs  |  Classrooms")
    pdf.setFillColor(GREY)
    pdf.setFont("Helvetica", 9)
    pdf.drawString(60, PAGE_H - 343, "Suggested time: 45-60 minutes. Adult-led for younger designers.")

    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(44, 404, "ADULT SETUP")
    draw_text(pdf, "1. Open one credited NASA image or learning page.", 44, 380, 360, size=10.5, leading=14, color=GREY)
    draw_text(pdf, "2. Ask what is visible before anyone invents an explanation.", 44, 350, 360, size=10.5, leading=14, color=GREY)
    draw_text(pdf, "3. Keep the space clue real and let the organism become wonderfully strange.", 44, 320, 360, size=10.5, leading=14, color=GREY)

    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(44, 258, "YOU WILL NEED")
    draw_text(pdf, "A pencil, colours, this activity sheet, and one real NASA image or learning page.", 44, 236, 340, size=10.5, leading=14, color=GREY)
    pdf.setFillColor(PURPLE)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(44, 196, "PRINT TIP")
    draw_text(pdf, "The activity pages are designed to work in colour or black and white.", 44, 179, 320, size=9.5, leading=13, color=GREY)

    if LOGO.exists():
        logo = ImageReader(str(LOGO))
        pdf.drawImage(logo, PAGE_W - 164, 76, width=96, height=155, mask="auto", preserveAspectRatio=True)

    pdf.setFillColor(GREY)
    pdf.setFont("Helvetica", 8.5)
    pdf.drawString(44, 88, "Real space starts the question. Your imagination builds the world.")
    pdf.drawString(44, 72, "Mythical Void is independent and is not endorsed by NASA.")
    page_footer(pdf, 1)
    pdf.showPage()


def signal_page(pdf):
    pdf.setFillColor(CREAM)
    pdf.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    section_label(pdf, 1, "Read a real signal", PAGE_H - 56)
    draw_text(pdf, "Choose one real space source. Look carefully before you invent anything.", 38, PAGE_H - 91, PAGE_W - 76, size=10.5, color=GREY)

    card_y = PAGE_H - 250
    card_w = 164
    gaps = 13
    cards = [
        ("A", "A space image", "Use NASA's Astronomy Picture of the Day. Notice colour, shape, light and scale.", "apod.nasa.gov/apod/astropix.html", LILAC, PURPLE),
        ("B", "A solar signal", "Explore how the Sun, solar wind and magnetic fields can affect a world.", "science.nasa.gov/heliophysics", PALE_MINT, HexColor("#148675")),
        ("C", "A possible world", "Use NASA JPL's alien-life activities to think about environments and survival.", "jpl.nasa.gov/edu", HexColor("#FFF0C9"), HexColor("#9A6500")),
    ]
    for index, (letter, title, body, url, fill, accent) in enumerate(cards):
        x = 38 + index * (card_w + gaps)
        rounded_box(pdf, x, card_y, card_w, 132, fill, stroke=accent, radius=14, width=1.2)
        pdf.setFillColor(accent)
        pdf.circle(x + 22, card_y + 107, 12, fill=1, stroke=0)
        pdf.setFillColor(white)
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawCentredString(x + 22, card_y + 103, letter)
        pdf.setFillColor(INK)
        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(x + 40, card_y + 103, title)
        draw_text(pdf, body, x + 13, card_y + 78, card_w - 26, size=8.5, leading=11, max_lines=4)
        pdf.setFillColor(accent)
        pdf.setFont("Helvetica-Bold", 6.8)
        pdf.drawString(x + 13, card_y + 13, url)

    rounded_box(pdf, 38, 410, PAGE_W - 76, 126, white, stroke=PALE_GREY, radius=14)
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(54, 510, "Observation before invention")
    pdf.setFillColor(PURPLE)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(54, 487, "I OBSERVE")
    write_lines(pdf, 54, 472, 220, 3, 17)
    pdf.setFillColor(HexColor("#148675"))
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(307, 487, "I WONDER")
    write_lines(pdf, 307, 472, 233, 3, 17)

    rounded_box(pdf, 38, 96, PAGE_W - 76, 286, HexColor("#F3EEFF"), stroke=LILAC, radius=14)
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(54, 356, "Give your fictional realm three strange rules")
    draw_text(pdf, "Pick one from each row, or invent a better rule. These are story ideas, not claims about real space.", 54, 336, PAGE_W - 108, size=9, color=GREY)

    groups = [
        ("MATTER", ["Light behaves like a solid", "Sound forms crystals", "Liquid remembers shapes", "Your idea:"]),
        ("TIME AND GRAVITY", ["Gravity points sideways", "Time arrives in waves", "Objects fall toward music", "Your idea:"]),
        ("ENERGY AND WEATHER", ["Storms carry thoughts", "Heat moves as ribbons", "Shadows store energy", "Your idea:"]),
    ]
    y = 299
    for title, choices in groups:
        pdf.setFillColor(PURPLE)
        pdf.setFont("Helvetica-Bold", 8.5)
        pdf.drawString(54, y, title)
        for col, choice in enumerate(choices):
            checkbox(pdf, 54 + col * 126, y - 22, choice, width=116)
        y -= 64

    page_footer(pdf, 2)
    pdf.showPage()


def organism_page(pdf):
    pdf.setFillColor(CREAM)
    pdf.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    section_label(pdf, 2, "Invent the organism", PAGE_H - 56)
    draw_text(pdf, "Avoid starting with a familiar animal. Start with what the organism must do.", 38, PAGE_H - 91, PAGE_W - 76, size=10.5, color=GREY)

    trait_x = 38
    trait_w = 186
    draw_x = 240
    draw_w = PAGE_W - draw_x - 38
    rounded_box(pdf, trait_x, 92, trait_w, 618, white, stroke=PALE_GREY, radius=14)
    rounded_box(pdf, draw_x, 270, draw_w, 440, white, stroke=PURPLE, radius=18, width=1.4)

    pdf.setFillColor(PURPLE)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(54, 680, "ORGANISM NAME OR SYMBOL")
    write_lines(pdf, 54, 663, trait_w - 32, 1)

    prompts = [
        ("BODY ARRANGEMENT", ["Radial", "Liquid", "Colony", "Folded space", "Negative space", "Other:"]),
        ("HOW IT MOVES", ["Flows", "Rearranges", "Teleports in pieces", "Follows fields", "Grows a path", "Other:"]),
        ("WHAT IT SENSES", ["Magnetic change", "Time pressure", "Chemical stories", "Gravity", "Distant light", "Other:"]),
        ("HOW IT GETS ENERGY", ["Light", "Heat", "Motion", "Minerals", "Electric fields", "Unknown exchange"]),
        ("HOW IT COMMUNICATES", ["Colour geometry", "Shared rhythm", "Gravity pulses", "Scent maps", "Dream fragments", "Silence patterns"]),
    ]
    y = 624
    for title, choices in prompts:
        pdf.setFillColor(PURPLE)
        pdf.setFont("Helvetica-Bold", 8.3)
        pdf.drawString(54, y, title)
        y -= 18
        for choice_index, choice in enumerate(choices):
            column = choice_index % 2
            row = choice_index // 2
            checkbox(pdf, 54 + column * 78, y - row * 19, choice, width=74, size=7.4)
        y -= 69

    pdf.setFillColor(PURPLE)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(draw_x + 18, 680, "DRAW THE LIVING SYSTEM - NOT JUST ITS OUTSIDE")
    pdf.setFillColor(GREY)
    pdf.setFont("Helvetica", 8)
    pdf.drawString(draw_x + 18, 662, "Show energy, senses, movement and the part that changes under pressure.")

    pdf.setStrokeColor(HexColor("#BDB8C7"))
    pdf.setDash(2, 4)
    pdf.circle(draw_x + draw_w * 0.50, 478, 100, fill=0, stroke=1)
    pdf.circle(draw_x + draw_w * 0.50, 478, 52, fill=0, stroke=1)
    pdf.setDash()
    pdf.setFillColor(GREY)
    pdf.setFont("Helvetica-Oblique", 9)
    pdf.drawCentredString(draw_x + draw_w * 0.50, 476, "Your impossible organism begins here")

    rounded_box(pdf, draw_x, 92, draw_w, 158, PALE_MINT, stroke=MINT, radius=14)
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(draw_x + 16, 224, "Explain one strange part")
    draw_text(pdf, "This part exists because the realm...", draw_x + 16, 202, draw_w - 32, size=8.8, color=GREY)
    write_lines(pdf, draw_x + 16, 184, draw_w - 32, 3, 18)
    draw_text(pdf, "Its power has a cost or tradeoff:", draw_x + 16, 123, draw_w - 32, size=8.8, color=GREY)
    write_lines(pdf, draw_x + 16, 107, draw_w - 32, 1, 18)

    page_footer(pdf, 3)
    pdf.showPage()


def test_page(pdf):
    pdf.setFillColor(CREAM)
    pdf.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    section_label(pdf, 3, "Test it like a scientist", PAGE_H - 56)
    draw_text(pdf, "A strong idea connects an environment, an adaptation and a tradeoff.", 38, PAGE_H - 91, PAGE_W - 76, size=10.5, color=GREY)

    columns = [
        ("REAL OBSERVATION", "From the NASA source, I noticed...", LILAC, PURPLE),
        ("FICTIONAL IDEA", "In my realm, I imagine...", PALE_MINT, HexColor("#148675")),
        ("TESTABLE PREDICTION", "If this happens, then the organism will...", HexColor("#FFF0C9"), HexColor("#9A6500")),
    ]
    col_w = 164
    for index, (title, prompt, fill, accent) in enumerate(columns):
        x = 38 + index * 177
        rounded_box(pdf, x, 530, col_w, 150, fill, stroke=accent, radius=14)
        pdf.setFillColor(accent)
        pdf.setFont("Helvetica-Bold", 8.5)
        pdf.drawString(x + 13, 651, title)
        draw_text(pdf, prompt, x + 13, 626, col_w - 26, size=9, leading=12)
        write_lines(pdf, x + 13, 590, col_w - 26, 3, 19)

    rounded_box(pdf, 38, 369, PAGE_W - 76, 138, white, stroke=PALE_GREY, radius=14)
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(54, 481, "Choose one pressure test")
    tests = [
        "The star suddenly becomes more active.",
        "The realm's gravity rule reverses.",
        "Its usual energy source disappears.",
    ]
    for index, test in enumerate(tests):
        checkbox(pdf, 54, 452 - index * 25, test, width=240)
    pdf.setFillColor(PURPLE)
    pdf.setFont("Helvetica-Bold", 8.5)
    pdf.drawString(316, 456, "WHAT CHANGES FIRST?")
    write_lines(pdf, 316, 440, 224, 3, 19)

    pdf.setFillColor(PINK)
    pdf.circle(48, 333, 13, fill=1, stroke=0)
    pdf.setFillColor(white)
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawCentredString(48, 329, "4")
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 22)
    pdf.drawString(76, 325, "Make a story choice")

    rounded_box(pdf, 38, 143, PAGE_W - 76, 156, HexColor("#F3EEFF"), stroke=PURPLE, radius=16, width=1.2)
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(54, 270, "The Void has distorted your organism. It is dangerous - but it may also be frightened.")
    draw_text(pdf, "Your task is restoration, not destruction. What does the player need to understand before choosing what to do?", 54, 249, PAGE_W - 108, size=9.2, leading=13, color=GREY)
    pdf.setFillColor(HexColor("#148675"))
    pdf.setFont("Helvetica-Bold", 8.5)
    pdf.drawString(54, 208, "THE CLUE THAT CHANGES THE PLAYER'S MIND")
    write_lines(pdf, 54, 192, 224, 3, 18)
    pdf.setFillColor(HexColor("#9A6500"))
    pdf.setFont("Helvetica-Bold", 8.5)
    pdf.drawString(316, 208, "THE RESTORATION ACTION")
    write_lines(pdf, 316, 192, 224, 3, 18)

    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 9.5)
    pdf.drawString(38, 117, "Share safely")
    draw_text(pdf, "Keep this sheet at home or in class. If a young designer wants Mythical Void to see an idea later, a parent, guardian or teacher must send it without the child's surname, face, voice, school, location or contact details.", 38, 101, PAGE_W - 76, size=7.8, leading=10, color=GREY)

    pdf.setFillColor(GREY)
    pdf.setFont("Helvetica", 6.7)
    pdf.drawString(38, 62, "Sources: NASA Open APIs (api.nasa.gov); NASA JPL Education (jpl.nasa.gov/edu); NASA Heliophysics (science.nasa.gov/heliophysics).")
    pdf.drawString(38, 50, "NASA material starts the science question. The realms, organisms and story choices are fictional. NASA does not endorse Mythical Void.")
    pdf.drawString(38, 38, "Brand emblem created with generative AI and refined for Mythical Void. Activity words and learning design are human-reviewed.")
    page_footer(pdf, 4)
    pdf.showPage()


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(OUTPUT), pagesize=A4, pageCompression=1, invariant=1)
    pdf.setTitle("Mythical Void STEM Creature Lab")
    pdf.setAuthor("Mythical Void")
    pdf.setSubject("Adult-led space science, creature design and storytelling activity for ages 9-14")
    pdf.setKeywords("Mythical Void, STEM, NASA, creature design, game design, space science")
    cover(pdf)
    signal_page(pdf)
    organism_page(pdf)
    test_page(pdf)
    pdf.save()
    print(OUTPUT)


if __name__ == "__main__":
    build()
