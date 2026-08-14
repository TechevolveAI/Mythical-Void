#!/usr/bin/env python3

import json
import hashlib
import sys
from pathlib import Path

import pdfplumber
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "docs" / "company" / "content" / "stem-creature-lab-2026-08-14.json"


def fail(message):
    print(f"STEM Creature Lab is not ready: {message}", file=sys.stderr)
    raise SystemExit(1)


manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
pdf_path = ROOT / manifest["outputFile"]
if not pdf_path.exists():
    fail(f"missing {manifest['outputFile']}")

reader = PdfReader(str(pdf_path))
if reader.is_encrypted:
    fail("PDF must not be encrypted")
if len(reader.pages) != 4:
    fail(f"expected 4 pages, found {len(reader.pages)}")

metadata = reader.metadata or {}
if metadata.get("/Title") != manifest["title"]:
    fail("PDF title metadata does not match the release manifest")

with pdfplumber.open(pdf_path) as document:
    text = "\n".join(page.extract_text() or "" for page in document.pages)
    for page_number, page in enumerate(document.pages, start=1):
        for character in page.chars:
            if character["x0"] < -1 or character["x1"] > page.width + 1:
                fail(f"page {page_number} contains text outside the horizontal page boundary")
            if character["top"] < -1 or character["bottom"] > page.height + 1:
                fail(f"page {page_number} contains text outside the vertical page boundary")

normalised_text = " ".join(text.split())

for phrase in [
    "Invent an organism from another dimension",
    "Read a real signal",
    "Invent the organism",
    "Test it like a scientist",
    "Make a story choice",
    "NASA does not endorse Mythical Void",
    "without the child's surname",
    "real observation",
    "fictional idea",
    "testable prediction",
]:
    if phrase.lower() not in normalised_text.lower():
        fail(f"missing required wording: {phrase}")

for forbidden in ["companion", "no two creatures alike", "every creature is unique", "infinite unique creatures"]:
    if forbidden.lower() in normalised_text.lower():
        fail(f"contains forbidden public wording: {forbidden}")

digest = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
if digest != manifest["sha256"]:
    fail("PDF checksum does not match the reviewed release")

if manifest["state"] != "approved_for_owned_website_release":
    fail("release state is not approved for the owned website")
if manifest["boundaries"]["nasaEndorsementClaimed"] is not False:
    fail("NASA endorsement boundary is incorrect")
if manifest["boundaries"]["childContactRequested"] is not False:
    fail("activity must not ask children to contact the studio")

print(json.dumps({
    "valid": True,
    "pages": len(reader.pages),
    "title": metadata.get("/Title"),
    "audience": manifest["audience"],
    "publicPath": manifest["publicPath"],
    "sha256": digest,
    "safetyBoundaries": "present",
    "outOfBoundsCharacters": 0,
}, indent=2))
