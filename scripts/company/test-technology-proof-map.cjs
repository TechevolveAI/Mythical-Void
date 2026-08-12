#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
const result = spawnSync(process.execPath, [path.join(__dirname, 'validate-technology-proof-map.cjs')], { encoding: 'utf8' });
if (result.status !== 0) { console.error(result.stderr || result.stdout); process.exit(1); }
const output = JSON.parse(result.stdout);
if (!output.valid || output.claimCount !== 4) process.exit(1);
console.log('Technology proof-map checks passed.');
