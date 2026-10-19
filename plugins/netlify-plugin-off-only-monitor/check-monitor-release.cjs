#!/usr/bin/env node
'use strict';
// Offline, read-only preflight for preserving the reviewed OFF-only monitor.
// This is not a deploy command, privacy approval or automatic CI protection.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const MONITOR = 'onboarding-health-monitor';
const REQUIRED = Object.freeze(['adult-feedback', 'generate-ai-art', 'generate-companion-video',
  'live-presence', 'nasa-image', 'observability-events', 'space-discovery', MONITOR]);
const APPROVED_SHA256 = 'c68def67ef68caa3c3c74b912385e09ee1b0c22a1b4985e94d01751250f7250e';
const SCHEDULE = '*/15 * * * *';
const MAX_BUNDLE_BYTES = 2 * 1024 * 1024;

function assess(manifest, readBundle, expectedDigest = APPROVED_SHA256) {
  const failures = [];
  const fail = code => { if (!failures.includes(code)) failures.push(code); };
  if (!manifest || !Array.isArray(manifest.functions) || manifest.functions.length > 32) {
    fail('invalid_manifest');
  } else {
    const functions = manifest.functions;
    const names = functions.map(f => f?.name);
    if (names.some(n => typeof n !== 'string')) fail('invalid_function_name');
    if (new Set(names).size !== names.length) fail('duplicate_function');
    if (REQUIRED.some(n => !names.includes(n))) fail('required_function_missing');
    if (names.some(n => !REQUIRED.includes(n))) fail('unreviewed_function_added');
    const monitors = functions.filter(f => f?.name === MONITOR);
    if (monitors.length !== 1) fail('monitor_missing_or_duplicated');
    else {
      const m = monitors[0];
      if (m.schedule !== SCHEDULE || m.config?.schedule !== SCHEDULE) fail('monitor_schedule_changed');
      if (m.runtime !== 'js' || m.runtimeVersion !== 'nodejs22.x' || m.runtimeAPIVersion !== 2 ||
          m.outputModuleFormat !== 'esm' || m.invocationMode !== 'stream') fail('monitor_runtime_changed');
      if (!Array.isArray(m.routes) || m.routes.length ||
          !Array.isArray(m.excludedRoutes) || m.excludedRoutes.length) fail('monitor_routes_changed');
      if (typeof m.path !== 'string' || !m.path.endsWith('/' + MONITOR + '.zip') && m.path !== MONITOR + '.zip') {
        fail('monitor_artifact_path_invalid');
      } else {
        try {
          const bytes = readBundle(m.path);
          if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_BUNDLE_BYTES) fail('monitor_artifact_size_invalid');
          else if (crypto.createHash('sha256').update(bytes).digest('hex') !== expectedDigest) fail('monitor_artifact_changed');
        } catch { fail('monitor_artifact_unreadable'); }
      }
    }
  }
  return {
    schemaVersion: 1,
    check: 'off-only-monitor-release-preservation',
    passed: failures.length === 0,
    failures,
    deploymentAuthorized: false,
    countingActivationAuthorized: false,
    scope: 'Packaged monitor identity, schedule and existing function names only. Does not verify website files, other function code, production environment, live schedule, credentials or privacy readiness.'
  };
}

function checkFile(file) {
  try {
    if (fs.statSync(file).size > 1024 * 1024) throw Error('too large');
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    return assess(manifest, bundlePath => {
      const resolved = path.resolve(path.dirname(file), bundlePath);
      const stat = fs.statSync(resolved);
      if (!stat.isFile() || stat.size > MAX_BUNDLE_BYTES) throw Error('invalid artifact');
      return fs.readFileSync(resolved);
    });
  } catch {
    return assess(null, () => { throw Error('unavailable'); });
  }
}

if (require.main === module) {
  if (process.argv.length !== 3) {
    console.error('Usage: node check-monitor-release.cjs /absolute/path/to/bundle-manifest.json');
    process.exitCode = 2;
  } else {
    const result = checkFile(path.resolve(process.argv[2]));
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.passed ? 0 : 1;
  }
}
module.exports = { assess, checkFile, REQUIRED, MONITOR, APPROVED_SHA256, SCHEDULE };
