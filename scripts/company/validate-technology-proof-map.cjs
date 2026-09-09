#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const map = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/technology-proof-map.json'), 'utf8'));
const failures = [];
if (map.schemaVersion !== 1 || !Array.isArray(map.claims) || map.claims.length !== 4) failures.push('technology proof map shape is invalid');
for (const claim of map.claims || []) {
  if (!claim.id || !claim.claim || !Array.isArray(claim.sources) || !claim.sources.length) failures.push(`incomplete claim ${claim.id || 'unknown'}`);
  for (const source of claim.sources || []) if (!fs.existsSync(path.join(root, source))) failures.push(`${claim.id} source is missing: ${source}`);
  if (!claim.limits) failures.push(`${claim.id} has no claim limits`);
}
const creatureMedia = map.claims?.find(claim => claim.id === 'TECH-003');
if (creatureMedia?.publicStatus !== 'approved_with_creature_only_privacy_language') failures.push('TECH-003 public status is stale');
if (!/every age band/.test(creatureMedia?.claim || '')) failures.push('TECH-003 does not describe the current all-age creature-only path');
if (!/selected age range and player information are not sent to the model/.test(creatureMedia?.limits || '')) failures.push('TECH-003 model-data boundary is missing');
if (map.approval?.publicationAuthority !== 'Kevin' || map.approval?.externalPublishing !== false) failures.push('approval boundary is invalid');
if (failures.length) { console.error(JSON.stringify({ valid: false, failures }, null, 2)); process.exit(1); }
console.log(JSON.stringify({ valid: true, claimCount: map.claims.length, sourceCount: map.claims.reduce((n, c) => n + c.sources.length, 0) }, null, 2));
