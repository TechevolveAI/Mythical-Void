'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const plugin = require('./index.js');
const { packageMonitor, verify, REQUIRED, DIGEST } = plugin.testing;

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-monitor-gate-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const manifest = { version: 1, functions: REQUIRED.filter(n => n !== 'onboarding-health-monitor')
    .map(name => ({ name, path: path.join(dir, `${name}.zip`), runtime: 'js', marker: 'synthetic-existing-config' })) };
  manifest.functions.forEach(f => fs.writeFileSync(f.path, `synthetic-${f.name}`));
  const save = value => fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(value));
  const read = () => JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json')));
  save(manifest);
  return { dir, manifest, save, read };
}

test('packages the exact approved monitor and preserves all existing entries and bytes', t => {
  const f = fixture(t);
  const before = f.manifest.functions.map(e => fs.readFileSync(e.path));
  const result = packageMonitor(f.dir);
  assert.equal(result.functions, 8);
  assert.equal(result.monitorDigest, DIGEST);
  assert.equal(result.countingActivationAuthorised, false);
  assert.deepEqual(f.read().functions.slice(0, 7), f.manifest.functions);
  f.manifest.functions.forEach((e, i) => assert.deepEqual(fs.readFileSync(e.path), before[i]));
  assert.deepEqual(packageMonitor(f.dir), result);
});
test('final check rejects a missing monitor without repairing the omission', t => {
  const f = fixture(t); assert.throws(() => verify(f.dir), /missing/);
  assert.equal(f.read().functions.length, 7);
});
for (const [label, mutate] of [
  ['missing existing function', m => m.functions.shift()],
  ['duplicate function', m => m.functions.push(m.functions[0])],
  ['unreviewed collector', m => m.functions.push({ name: 'onboarding-collector' })],
  ['invalid schema', m => { m.version = 2; }],
  ['malformed entry', m => { m.functions[0] = null; }]
]) test(`refuses ${label} before writing`, t => {
  const f = fixture(t); mutate(f.manifest); f.save(f.manifest);
  assert.throws(() => packageMonitor(f.dir));
  assert(!fs.existsSync(path.join(f.dir, 'onboarding-health-monitor.zip')));
});
for (const [label, mutate] of [
  ['missing schedule', e => { delete e.schedule; }],
  ['changed schedule', e => { e.schedule = '* * * * *'; }],
  ['public route', e => { e.routes = [{ pattern: '/monitor' }]; }],
  ['old runtime', e => { e.runtimeVersion = 'nodejs20.x'; }],
  ['changed API', e => { e.buildData.runtimeAPIVersion = 1; }],
  ['changed bootstrap', e => { e.buildData.bootstrapVersion = '999.0.0'; }],
  ['changed invocation', e => { e.invocationMode = 'buffered'; }],
  ['external artifact', e => { e.path = '/synthetic/elsewhere.zip'; }],
  ['unexpected metadata', e => { e.environment = { SAMPLE_FLAG: 'true' }; }]
]) test(`refuses ${label} in an existing monitor, without silently replacing it`, t => {
  const f = fixture(t); packageMonitor(f.dir);
  const m = f.read(); mutate(m.functions.at(-1)); f.save(m);
  assert.throws(() => verify(f.dir)); assert.throws(() => packageMonitor(f.dir));
  assert.deepEqual(f.read(), m);
});
test('tampered ZIP fails even when manifest is unchanged', t => {
  const f = fixture(t); packageMonitor(f.dir);
  fs.appendFileSync(path.join(f.dir, 'onboarding-health-monitor.zip'), 'changed');
  assert.throws(() => verify(f.dir));
});
test('unreferenced artifact is not overwritten', t => {
  const f = fixture(t); const file = path.join(f.dir, 'onboarding-health-monitor.zip');
  fs.writeFileSync(file, 'existing'); assert.throws(() => packageMonitor(f.dir));
  assert.equal(fs.readFileSync(file, 'utf8'), 'existing');
});
test('missing approved artifact fails closed', t => {
  const f = fixture(t); assert.throws(() => packageMonitor(f.dir, path.join(f.dir, 'missing.zip')));
});
test('symlink artifact fails closed', t => {
  const f = fixture(t); const file = path.join(f.dir, 'link.zip');
  fs.symlinkSync(path.join(__dirname, 'onboarding-health-monitor.zip'), file);
  assert.throws(() => packageMonitor(f.dir, file));
});
test('real plugin hooks preserve the monitor and sanitise errors', t => {
  const f = fixture(t); const messages = [];
  const utils = { build: { failBuild: message => { throw Error(message); } }, status: { show: value => messages.push(value) } };
  plugin.onPreBuild({ utils });
  plugin.onPostBuild({ constants: { FUNCTIONS_DIST: f.dir }, utils });
  assert.equal(messages.length, 1); assert(verify(f.dir).passed);
  assert.throws(() => plugin.onPostBuild({ constants: {}, utils }), /preservation failed/);
});
test('protected release workflow and Netlify config include the safeguard', () => {
  const root = path.resolve(__dirname, '../..');
  assert.match(fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8'), /\[\[plugins\]\][\s\S]*package = "\.\/plugins\/netlify-plugin-off-only-monitor"/);
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/onboarding-regression.yml'), 'utf8');
  assert.match(workflow, /node --test plugins\/netlify-plugin-off-only-monitor\/test-plugin.cjs/);
});
