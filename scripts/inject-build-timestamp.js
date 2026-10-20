#!/usr/bin/env node

/**
 * Inject build timestamp into service worker
 * This ensures the service worker cache name updates with each build
 */

const fs = require('fs');
const path = require('path');
const { buildDirectPlayHtml } = require('./build-direct-play-entry.cjs');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const WORKER_MARKER = "const BUILD_TIMESTAMP = '__BUILD_TIMESTAMP__';";
const DOCUMENT_MARKER = '<meta name="mythical-void-release" content="__BUILD_TIMESTAMP__">';

function prepareReleaseFiles(distDir = DIST_DIR, buildTimestamp = Date.now()) {
  if (!Number.isSafeInteger(buildTimestamp) || buildTimestamp <= 0) {
    throw new Error('Release timestamp must be a positive safe integer');
  }
  const workerPath = path.join(distDir, 'sw.js');
  const indexPath = path.join(distDir, 'index.html');
  const outputPath = path.join(distDir, 'play', 'index.html');
  let swContent = fs.readFileSync(workerPath, 'utf8');
  let indexContent = fs.readFileSync(indexPath, 'utf8');
  if (swContent.split(WORKER_MARKER).length !== 2
      || !swContent.includes("BUILD_TIMESTAMP !== '__BUILD_TIMESTAMP__'")) {
    throw new Error('Unbound worker release marker not found or ambiguous');
  }
  if (!indexContent.includes(DOCUMENT_MARKER)
      || indexContent.split('__BUILD_TIMESTAMP__').length !== 2) {
    throw new Error('Unbound document release marker not found or ambiguous');
  }
  swContent = swContent.replace(WORKER_MARKER, `const BUILD_TIMESTAMP = '${buildTimestamp}';`);
  indexContent = indexContent.replace('__BUILD_TIMESTAMP__', buildTimestamp);

  // Validate all generated content before modifying any release file.
  const playContent = buildDirectPlayHtml(indexContent);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(workerPath, swContent, 'utf8');
  fs.writeFileSync(indexPath, indexContent, 'utf8');
  fs.writeFileSync(outputPath, playContent, 'utf8');
  return { buildTimestamp, outputPath, bytes: Buffer.byteLength(playContent) };
}

if (require.main === module) {
  try {
    const result = prepareReleaseFiles();
    console.log('[Build] Release timestamp bound:', result.buildTimestamp);
    console.log('[Build] Direct Play entry written:', result.outputPath);
  } catch (error) {
    console.error('[Build] Release packaging failed:', error.message);
    process.exitCode = 1;
  }
}

module.exports = { prepareReleaseFiles };
