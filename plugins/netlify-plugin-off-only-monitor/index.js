'use strict';

// Package the exact, already deployed monitor. Never rebuild it implicitly.
// onPostBuild runs after Netlify's normal bundler and before publication.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const guard = require('./check-monitor-release.cjs');
const NAME = 'onboarding-health-monitor';
const ZIP = `${NAME}.zip`;
const DIGEST = 'c68def67ef68caa3c3c74b912385e09ee1b0c22a1b4985e94d01751250f7250e';
const REQUIRED = ['adult-feedback', 'generate-ai-art', 'generate-companion-video',
  'live-presence', 'nasa-image', 'observability-events', 'space-discovery', NAME];

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function approvedBytes(file) {
  const stat = fs.lstatSync(file);
  ensure(stat.isFile() && stat.size > 0 && stat.size <= 2 * 1024 * 1024, 'Monitor artifact is not a bounded regular file.');
  const bytes = fs.readFileSync(file);
  ensure(crypto.createHash('sha256').update(bytes).digest('hex') === DIGEST,
    'Monitor artifact changed. Review the rebuilt artifact before changing its approval.');
  return bytes;
}

function readManifest(dir) {
  const file = path.join(dir, 'manifest.json');
  ensure(fs.statSync(file).size < 1024 * 1024, 'Functions manifest is too large.');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  ensure(manifest.version === 1 && Array.isArray(manifest.functions), 'Unsupported functions manifest.');
  const names = manifest.functions.map(f => f?.name);
  ensure(new Set(names).size === names.length, 'Duplicate packaged function.');
  ensure(names.every(n => REQUIRED.includes(n)), 'Unreviewed packaged function.');
  ensure(REQUIRED.filter(n => n !== NAME).every(n => names.includes(n)), 'Existing function is missing.');
  return manifest;
}

function monitorEntry(file) {
  return {
    bundler: 'nft', invocationMode: 'stream',
    buildData: { bootstrapVersion: '2.16.0', runtimeAPIVersion: 2 },
    name: NAME, priority: 10, runtimeVersion: 'nodejs22.x',
    path: file, runtime: 'js', schedule: '*/15 * * * *'
  };
}

function verify(dir) {
  dir = fs.realpathSync(dir);
  const manifest = readManifest(dir);
  const monitor = manifest.functions.find(f => f.name === NAME);
  ensure(monitor, 'Monitor is missing from the final manifest.');
  const expected = monitorEntry(path.join(dir, ZIP));
  ensure(JSON.stringify(Object.keys(monitor).sort()) === JSON.stringify(Object.keys(expected).sort()),
    'Monitor metadata has unexpected or missing fields.');
  for (const [key, value] of Object.entries(expected)) {
    ensure(JSON.stringify(monitor[key]) === JSON.stringify(value), `Monitor metadata changed: ${key}.`);
  }
  approvedBytes(monitor.path);
  // This projection is only for the existing packaging-result guard. The final
  // Netlify manifest was checked above; ESM/config properties are bound to the
  // immutable reviewed ZIP, not inferred from untrusted incoming metadata.
  const result = guard.assess({ functions: manifest.functions.map(f => f.name === NAME ? {
    ...f, runtimeAPIVersion: f.buildData.runtimeAPIVersion, outputModuleFormat: 'esm',
    config: { schedule: f.schedule }, routes: [], excludedRoutes: []
  } : f) }, file => fs.readFileSync(file));
  ensure(result.passed, 'Packaged monitor preservation check failed.');
  return { passed: true, functions: manifest.functions.length, monitorDigest: DIGEST,
    schedule: expected.schedule, countingActivationAuthorised: false };
}

function packageMonitor(dir, artifact = path.join(__dirname, ZIP)) {
  dir = fs.realpathSync(dir);
  const bytes = approvedBytes(artifact);
  const manifest = readManifest(dir);
  if (manifest.functions.some(f => f.name === NAME)) return verify(dir);
  const target = path.join(dir, ZIP);
  ensure(!fs.existsSync(target), 'Unreferenced monitor artifact found; refusing to overwrite it.');
  // This is an explicit prebuilt-function packaging step. Seven normal functions
  // remain unchanged; the reviewed eighth artifact and its runtime metadata are
  // added together, then re-read from disk and checked before publication.
  fs.writeFileSync(target, bytes, { flag: 'wx' });
  manifest.functions.push(monitorEntry(target));
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  return verify(dir);
}

module.exports = {
  onPreBuild({ utils }) {
    try { approvedBytes(path.join(__dirname, ZIP)); }
    catch { utils.build.failBuild('The approved OFF-only monitor artifact is missing or changed.'); }
  },
  onPostBuild({ constants, utils }) {
    try {
      ensure(typeof constants.FUNCTIONS_DIST === 'string' && constants.FUNCTIONS_DIST,
        'Functions output directory unavailable.');
      const result = packageMonitor(constants.FUNCTIONS_DIST);
      utils.status.show({ title: 'OFF-only monitor preserved',
        summary: `${result.functions} functions verified. Counting activation is not authorised.` });
    } catch {
      utils.build.failBuild('OFF-only monitor preservation failed. No publication is safe. Check the final functions manifest and reviewed artifact.');
    }
  }
};
// Non-enumerable helpers keep Netlify's plugin event surface limited to hooks.
Object.defineProperty(module.exports, 'testing', { value: { packageMonitor, verify, monitorEntry, approvedBytes, REQUIRED, DIGEST } });
