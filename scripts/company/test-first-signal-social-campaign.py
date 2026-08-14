#!/usr/bin/env python3

import copy
import json
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CAMPAIGN = ROOT / "docs" / "company" / "content" / "campaigns" / "first-signal-social.json"
VALIDATOR = ROOT / "scripts" / "company" / "validate-first-signal-social-campaign.py"
PYTHON = Path(__import__("sys").executable)


def run(candidate):
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", encoding="utf-8", delete=False) as handle:
        json.dump(candidate, handle, indent=2)
        path = Path(handle.name)
    try:
        return subprocess.run([str(PYTHON), str(VALIDATOR), "--input", str(path)], cwd=ROOT, capture_output=True, text=True)
    finally:
        path.unlink(missing_ok=True)


campaign = json.loads(CAMPAIGN.read_text(encoding="utf-8"))
baseline = run(campaign)
if baseline.returncode != 0:
    raise SystemExit(f"Valid campaign rejected:\n{baseline.stderr}")

mutations = []

publishing = copy.deepcopy(campaign)
publishing["authority"]["publishingAuthorized"] = True
mutations.append(("publishing authority", publishing))

companion = copy.deepcopy(campaign)
companion["content"][0]["caption"] += " AI companions are waiting."
mutations.append(("retired companion wording", companion))

bad_hash = copy.deepcopy(campaign)
bad_hash["content"][1]["sha256"] = "0" * 64
mutations.append(("changed visual fingerprint", bad_hash))

child_contact = copy.deepcopy(campaign)
child_contact["authority"]["childContactAuthorized"] = True
mutations.append(("child contact authority", child_contact))

missing_disclosure = copy.deepcopy(campaign)
missing_disclosure["content"][2]["disclosure"] = "Marketing art."
mutations.append(("missing marketing disclosure", missing_disclosure))

invented_channel = copy.deepcopy(campaign)
invented_channel["approvalGate"]["channelUrl"] = "https://social.example/mythicalvoid"
mutations.append(("invented official channel", invented_channel))

for label, mutation in mutations:
    result = run(mutation)
    if result.returncode == 0:
        raise SystemExit(f"Unsafe mutation accepted: {label}")

print(f"First Signal campaign tests passed: baseline plus {len(mutations)} unsafe mutations checked.")
