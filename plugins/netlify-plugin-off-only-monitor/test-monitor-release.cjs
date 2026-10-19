'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { assess, REQUIRED, MONITOR, SCHEDULE } = require('./check-monitor-release.cjs');
const bytes = Buffer.from('synthetic fixture only; not a deployable ZIP');
const digest = crypto.createHash('sha256').update(bytes).digest('hex');
const good = () => ({ functions: REQUIRED.map(name => name !== MONITOR ? { name } : {
  name, schedule: SCHEDULE, config: { schedule: SCHEDULE }, runtime: 'js', runtimeVersion: 'nodejs22.x',
  runtimeAPIVersion: 2, outputModuleFormat: 'esm', invocationMode: 'stream',
  routes: [], excludedRoutes: [], path: '/synthetic/onboarding-health-monitor.zip'
}) });
let passed = 0;
function check(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function rejected(name, mutate, code) {
  check(name, () => { const m = good(); mutate(m); const r = assess(m, () => bytes, digest);
    assert.equal(r.passed, false); assert(r.failures.includes(code));
    assert.equal(r.deploymentAuthorized, false); assert.equal(r.countingActivationAuthorized, false); });
}
check('reviewed synthetic package passes without granting authority', () => {
  const r = assess(good(), () => bytes, digest); assert(r.passed); assert(!r.deploymentAuthorized); assert(!r.countingActivationAuthorized);
});
check('null input fails closed', () => assert(!assess(null).passed));
check('wrong schema fails closed', () => assert(!assess({ functions: {} }).passed));
rejected('missing monitor', m => m.functions.pop(), 'monitor_missing_or_duplicated');
rejected('duplicate monitor', m => m.functions.push(m.functions.at(-1)), 'duplicate_function');
rejected('existing function removed', m => m.functions.shift(), 'required_function_missing');
rejected('new collector not silently allowed', m => m.functions.push({name:'onboarding-collector'}), 'unreviewed_function_added');
rejected('malformed function', m => m.functions[0] = null, 'invalid_function_name');
rejected('schedule removed', m => delete m.functions.at(-1).schedule, 'monitor_schedule_changed');
rejected('schedule changed', m => m.functions.at(-1).schedule = '0 * * * *', 'monitor_schedule_changed');
rejected('conflicting embedded schedule', m => m.functions.at(-1).config.schedule = '0 * * * *', 'monitor_schedule_changed');
rejected('runtime changed', m => m.functions.at(-1).runtimeVersion = 'nodejs20.x', 'monitor_runtime_changed');
rejected('API generation changed', m => m.functions.at(-1).runtimeAPIVersion = 1, 'monitor_runtime_changed');
rejected('public route added', m => m.functions.at(-1).routes.push({pattern:'/monitor'}), 'monitor_routes_changed');
rejected('route evidence missing', m => delete m.functions.at(-1).routes, 'monitor_routes_changed');
rejected('artifact path missing', m => delete m.functions.at(-1).path, 'monitor_artifact_path_invalid');
check('unreadable artifact is sanitised', () => {
  const r = assess(good(), () => { throw Error('fake-sensitive-detail'); }, digest);
  assert(r.failures.includes('monitor_artifact_unreadable')); assert(!JSON.stringify(r).includes('fake-sensitive-detail'));
});
check('changed ZIP rejected even with unchanged declared hash', () => {
  const m = good(); m.functions.at(-1).sha256 = digest;
  assert(assess(m, () => Buffer.from('changed'), digest).failures.includes('monitor_artifact_changed'));
});
check('empty artifact rejected', () => assert(!assess(good(), () => Buffer.alloc(0), digest).passed));
check('oversized artifact rejected', () => assert(!assess(good(), () => Buffer.alloc(2*1024*1024+1), digest).passed));
check('non-buffer reader rejected', () => assert(!assess(good(), () => 'not bytes', digest).passed));
check('CLI missing input returns nonzero', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'check-monitor-release.cjs')]); assert.equal(r.status, 2);
});
check('CLI absent manifest fails closed without printing path', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'check-monitor-release.cjs'), '/synthetic/missing.json'], {encoding:'utf8'});
  assert.equal(r.status, 1); assert.equal(JSON.parse(r.stdout).passed, false); assert(!r.stdout.includes('/synthetic/'));
});
console.log(JSON.stringify({ passed, networkRequests: 0, deploymentPerformed: false, countingEnabled: false }));
