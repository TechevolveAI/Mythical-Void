#!/usr/bin/env python3

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CAMPAIGN = ROOT / "docs" / "company" / "content" / "campaigns" / "first-signal-social.json"
CLAIMS = ROOT / "docs" / "company" / "content" / "claims.json"
GAMEPLAY = ROOT / "public" / "press" / "gameplay" / "manifest.json"
CALENDAR = ROOT / "docs" / "company" / "content" / "channel-launch" / "FOUR_WEEK_LAUNCH_CALENDAR.json"


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


parser = argparse.ArgumentParser()
parser.add_argument("--input", type=Path, default=DEFAULT_CAMPAIGN)
args = parser.parse_args()

campaign = load_json(args.input)
claims = {item["id"]: item for item in load_json(CLAIMS)["claims"]}
captures = {item["id"]: item for item in load_json(GAMEPLAY)["captures"]}
calendar = load_json(CALENDAR)
errors = []


def require(condition, message):
    if not condition:
        errors.append(message)


require(campaign.get("schemaVersion") == 1, "schemaVersion must be 1")
require(campaign.get("state") == "finished_previews_waiting_for_kevin_and_official_channel", "campaign state is invalid")
require(campaign.get("canonicalUrl") == "https://mythicalvoid.com/", "canonical URL is invalid")
require(len(campaign.get("content", [])) == 5, "campaign must contain exactly five finished previews")

for field in [
    "accountCreationAuthorized",
    "publishingAuthorized",
    "schedulingAuthorized",
    "replyingAuthorized",
    "directMessagingAuthorized",
    "paidPromotionAuthorized",
    "childContactAuthorized",
    "externalActionAuthorized",
]:
    require(campaign.get("authority", {}).get(field) is False, f"authority.{field} must remain false")

standard = campaign.get("visualStandard", {})
require(standard.get("width") == 1080 and standard.get("height") == 1350, "visual standard must be 1080 by 1350")
require(standard.get("format") == "JPEG", "visual standard must be JPEG")

contact_path = ROOT / standard.get("contactSheet", "")
require(contact_path.exists(), "contact sheet is missing")
if contact_path.exists():
    contact_hash = hashlib.sha256(contact_path.read_bytes()).hexdigest()
    require(contact_hash == standard.get("contactSheetSha256"), "contact sheet fingerprint changed")

ids = set()
allowed_destinations = {
    "https://mythicalvoid.com/",
    "https://mythicalvoid.com/press/",
    "https://mythicalvoid.com/nasa-space-science/",
}
forbidden = [
    r"\bcompanions?\b",
    r"\bAI companions?\b",
    r"\bsentient\b",
    r"\bconscious\b",
    r"\bfully autonomous\b",
    r"\bevery creature is unique\b",
    r"\bno two creatures (?:are )?alike\b",
    r"\bNASA (?:partner|partnership|approved|approval)\b",
]

for item in campaign.get("content", []):
    item_id = item.get("id")
    require(bool(re.fullmatch(r"SS-\d{3}", item_id or "")), f"invalid content id {item_id}")
    require(item_id not in ids, f"duplicate content id {item_id}")
    ids.add(item_id)

    visual_path = ROOT / item.get("visual", "")
    require(visual_path.exists(), f"{item_id} visual is missing")
    if visual_path.exists():
        digest = hashlib.sha256(visual_path.read_bytes()).hexdigest()
        require(digest == item.get("sha256"), f"{item_id} visual fingerprint changed")
        with Image.open(visual_path) as image:
            require(image.size == (1080, 1350), f"{item_id} visual is not 1080 by 1350")
            require(image.format == "JPEG", f"{item_id} visual is not JPEG")
            require(image.mode == "RGB", f"{item_id} visual is not RGB")
        require(visual_path.stat().st_size < 1_500_000, f"{item_id} visual is unnecessarily large")

    for source in item.get("sourceAssets", []):
        require((ROOT / source).exists(), f"{item_id} source asset is missing: {source}")

    for claim_id in item.get("claimIds", []):
        require(claim_id in claims, f"{item_id} uses unknown claim {claim_id}")
        if claim_id in claims:
            require(claims[claim_id]["status"] in {"usable", "qualified"}, f"{item_id} uses blocked claim {claim_id}")

    proof_refs = item.get("proofRefs", [])
    for proof_ref in proof_refs:
        require(proof_ref in captures, f"{item_id} uses unknown gameplay proof {proof_ref}")
        if proof_ref in captures:
            capture = captures[proof_ref]
            source_paths = {f"public{capture['publicPath']}"}
            require(bool(source_paths.intersection(item.get("sourceAssets", []))), f"{item_id} proof does not match its source asset")
            require(capture.get("classification") == "authentic_running_build_screenshot", f"{item_id} proof is not an authentic screenshot")

    combined = "\n".join(str(item.get(field, "")) for field in ["caption", "alt", "disclosure"])
    for pattern in forbidden:
        require(not re.search(pattern, combined, flags=re.IGNORECASE), f"{item_id} contains forbidden wording: {pattern}")
    require(len(item.get("alt", "")) >= 60, f"{item_id} alt text is incomplete")
    require(len(item.get("disclosure", "")) >= 45, f"{item_id} disclosure is incomplete")
    require(item.get("destination") in allowed_destinations, f"{item_id} destination is not approved")
    require("utm_" not in item.get("caption", "").lower(), f"{item_id} contains unapproved tracking")
    require(item.get("destination") in item.get("caption", ""), f"{item_id} caption does not contain its destination")
    require(item.get("approvalState") == "waiting_for_kevin_and_official_channel", f"{item_id} is not correctly gated")

    asset_class = item.get("assetClass", "")
    if "authentic_gameplay" in asset_class:
        require(bool(proof_refs), f"{item_id} authentic gameplay card lacks proof")
        require("real Mythical Void browser game" in item.get("disclosure", ""), f"{item_id} does not identify real gameplay")
    if "generated_marketing" in asset_class:
        require("not gameplay footage" in item.get("disclosure", ""), f"{item_id} marketing art is not separated from gameplay")
    if "generated_brand" in asset_class:
        require("generative AI" in item.get("disclosure", ""), f"{item_id} brand art disclosure is incomplete")
    if item_id == "SS-004":
        require("NASA does not endorse Mythical Void" in combined, "STEM card must preserve NASA non-endorsement")
    if item_id == "SS-001":
        require("No image or identifying detail" in item.get("disclosure", ""), "origin card must preserve child privacy")

require(campaign.get("approvalGate", {}).get("approved") is False, "campaign must not be approved before Kevin review")
require(campaign.get("approvalGate", {}).get("channelUrl") is None, "campaign must not invent an official channel")
require(campaign.get("approvalGate", {}).get("changeInvalidatesApproval") is True, "changes must invalidate approval")
require(campaign.get("afterPublication", {}).get("maximumAutomaticReplies") == 0, "automatic replies must remain off")
require(campaign.get("afterPublication", {}).get("directMessagesToChildren") is False, "private child contact must remain off")
require(campaign.get("afterPublication", {}).get("paidBoosting") is False, "paid boosting must remain off")

calendar_releases = [release for week in calendar.get("weeks", []) for release in week.get("releases", [])]
for release in calendar_releases:
    ref = release.get("contentRef")
    if ref in ids:
        item = next(entry for entry in campaign["content"] if entry["id"] == ref)
        require(release.get("asset") == item.get("visual"), f"calendar asset does not match {ref}")

if errors:
    print(f"First Signal campaign is not ready ({len(errors)}):", file=sys.stderr)
    for error in errors:
        print(f"- {error}", file=sys.stderr)
    raise SystemExit(1)

print(json.dumps({
    "valid": True,
    "campaign": campaign["id"],
    "finishedPreviews": len(campaign["content"]),
    "visualSize": "1080x1350",
    "authenticGameplayCards": sum("authentic_gameplay" in item["assetClass"] for item in campaign["content"]),
    "generatedArtCards": sum("generated_" in item["assetClass"] for item in campaign["content"]),
    "externalActionsAuthorized": 0,
    "automaticReplies": 0,
    "waitingFor": ["Kevin review", "official channel URL"],
}, indent=2))
