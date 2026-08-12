#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const storefront = fs.readFileSync(path.join(root, 'src/site/storefront.js'), 'utf8');
const requiredAssets = [
  '/game/project-beacon-crash-site.webp',
  '/game/village/shared-habitat.webp',
  '/game/village/village-heart-command.webp',
  '/game/village/discovery-workshop.webp',
  '/game/guardians/crystal-guardian.webp',
  '/game/guardians/elder-treant.webp',
  '/game/guardians/void-empress.webp'
];
const forbiddenGeneratedAssets = ['/marketing/nova.webp', '/marketing/wisp.webp', '/marketing/pebble.webp', '/marketing/zephyr.webp', '/marketing/luna.webp', '/marketing/bloom.webp'];
const requiredStoryAnchors = ['Wanderer-77', 'Project Beacon', 'The Fend', 'restore', 'choice'];
const failures = [];
for (const asset of requiredAssets) {
  if (!storefront.includes(asset)) failures.push(`missing real game asset ${asset}`);
  if (!fs.existsSync(path.join(root, 'public', asset.slice(1)))) failures.push(`missing file ${asset}`);
}
for (const asset of forbiddenGeneratedAssets) if (storefront.includes(asset)) failures.push(`generated marketing asset still used ${asset}`);
for (const anchor of requiredStoryAnchors) if (!storefront.toLowerCase().includes(anchor.toLowerCase())) failures.push(`missing story anchor ${anchor}`);
if (storefront.includes('MEET THE CREATURES')) failures.push('old creature-poster section label remains');
if (failures.length) { console.error(JSON.stringify({ valid: false, failures }, null, 2)); process.exit(1); }
console.log(JSON.stringify({ valid: true, realGameAssetCount: requiredAssets.length, forbiddenGeneratedAssetCount: forbiddenGeneratedAssets.length, storyAnchorCount: requiredStoryAnchors.length }, null, 2));
