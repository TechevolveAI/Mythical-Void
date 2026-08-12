#!/usr/bin/env node
const { spawnSync } = require('child_process');
const result = spawnSync(process.execPath, [require('path').join(__dirname, 'validate-shop-window-truth.cjs')], { encoding: 'utf8' });
if (result.status !== 0) { console.error(result.stderr || result.stdout); process.exit(1); }
const output = JSON.parse(result.stdout);
if (output.valid !== true || output.realGameAssetCount !== 7) process.exit(1);
console.log('Shop-window truth checks passed.');
