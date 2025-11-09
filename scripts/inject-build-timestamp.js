#!/usr/bin/env node

/**
 * Inject build timestamp into service worker
 * This ensures the service worker cache name updates with each build
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const SW_PATH = path.join(DIST_DIR, 'sw.js');

// Generate timestamp
const buildTimestamp = Date.now();

console.log('[Build] Injecting build timestamp:', buildTimestamp);

// Check if sw.js exists in dist
if (!fs.existsSync(SW_PATH)) {
  console.warn('[Build] sw.js not found in dist, skipping timestamp injection');
  process.exit(0);
}

// Read service worker
let swContent = fs.readFileSync(SW_PATH, 'utf8');

// Replace placeholder with actual timestamp
swContent = swContent.replace('__BUILD_TIMESTAMP__', buildTimestamp);

// Write back
fs.writeFileSync(SW_PATH, swContent, 'utf8');

console.log('[Build] ✅ Build timestamp injected successfully');
