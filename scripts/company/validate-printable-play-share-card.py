#!/usr/bin/env python3

from pathlib import Path
import sys

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PDF = ROOT / "output" / "pdf" / "mythical-void-play-share-card.pdf"
pdf_path = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_PDF
failures = []

if not pdf_path.exists():
    raise SystemExit(f"Printable share card does not exist: {pdf_path}")

reader = PdfReader(str(pdf_path))
if reader.is_encrypted:
    failures.append("PDF must not be encrypted")
if len(reader.pages) != 1:
    failures.append("PDF must contain exactly one page")

page = reader.pages[0] if reader.pages else None
if page:
    page_width = float(page.mediabox.width)
    page_height = float(page.mediabox.height)
    if not (594 <= page_width <= 596 and 841 <= page_height <= 843):
        failures.append("PDF must use A4 portrait dimensions")
    extracted = page.extract_text() or ""
    for phrase in [
        "FREE BROWSER GAME",
        "Hatch a creature.",
        "Change its world.",
        "REAL GAMEPLAY",
        "SCAN TO PLAY",
        "MYTHICALVOID.COM",
        "No account. No download. No payment.",
        "AI-generated illustration, not gameplay",
        "NASA does not endorse Mythical Void.",
    ]:
        if phrase not in extracted:
            failures.append(f"Required wording is missing: {phrase}")

    links = []
    for reference in page.get("/Annots") or []:
        annotation = reference.get_object()
        action = annotation.get("/A") or {}
        if action.get("/URI"):
            links.append(str(action["/URI"]))
    if links != ["https://mythicalvoid.com/"]:
        failures.append("PDF must contain exactly one clean clickable play URL")

metadata = reader.metadata or {}
if metadata.get("/Title") != "Mythical Void - Play and Share Card":
    failures.append("PDF title metadata is missing")
if "/JavaScript" in (reader.trailer.get("/Root") or {}):
    failures.append("PDF must not contain JavaScript")

print({
    "valid": not failures,
    "pages": len(reader.pages),
    "bytes": pdf_path.stat().st_size,
    "playUrl": "https://mythicalvoid.com/",
    "failures": failures,
})
if failures:
    raise SystemExit(1)
