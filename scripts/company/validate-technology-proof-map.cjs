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
if (map.approval?.publicationAuthority !== 'Kevin' || map.approval?.externalPublishing !== false) failures.push('approval boundary is invalid');
if (failures.length) { console.error(JSON.stringify({ valid: false, failures }, null, 2)); process.exit(1); }
console.log(JSON.stringify({ valid: true, claimCount: map.claims.length, sourceCount: map.claims.reduce((n, c) => n + c.sources.length, 0) }, null, 2));
