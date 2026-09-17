#!/usr/bin/env node
// Local, muted completion checks. These use staged combat, not a full playthrough.
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.COMPLETION_SMOKE_PORT || (19000 + process.pid % 20000));
const base = `http://127.0.0.1:${port}`;
const output = path.resolve(process.env.COMPLETION_EVIDENCE_DIR || '/private/tmp/mythical-completion-evidence');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let preview, child, cleaning;

async function stop(process) {
    if (!process || process.exitCode !== null || process.signalCode !== null) return;
    process.kill('SIGTERM');
    for (let i = 0; i < 30 && process.exitCode === null && process.signalCode === null; i++) await delay(100);
    if (process.exitCode === null && process.signalCode === null) process.kill('SIGKILL');
}
function cleanup() {
    return cleaning ||= (async () => { await stop(child); await stop(preview); })();
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await cleanup(); process.exit(1); });

async function runCase(name, mode, testCase, width, height) {
    const capture = path.join(output, name);
    fs.mkdirSync(capture, { recursive: true });
    const logPath = path.join(capture, 'browser.log');
    const log = fs.openSync(logPath, 'w');
    try {
        child = spawn(process.execPath, ['scripts/smoke-secondary-journeys.js'], {
            cwd: root,
            env: { ...process.env, MYTHICAL_VOID_SMOKE_URL: base, SMOKE_MODE: mode, SMOKE_CASE: testCase,
                SMOKE_VIEWPORT_WIDTH: String(width), SMOKE_VIEWPORT_HEIGHT: String(height), SMOKE_CAPTURE_DIR: capture },
            stdio: ['ignore', log, log]
        });
        const timeout = setTimeout(() => { void stop(child); }, 180000);
        const code = await new Promise((resolve, reject) => {
            child.once('error', reject);
            child.once('exit', resolve);
        }).finally(() => clearTimeout(timeout));
        const text = fs.readFileSync(logPath, 'utf8');
        if (code !== 0 || !text.includes(`[smoke-result] ${mode}:${testCase}:pass`)) {
            throw new Error(`${name} failed; ${logPath}\n${text.slice(-5000)}`);
        }
        console.log(`PASS ${name}`);
        return { name, mode, testCase, width, height, logPath };
    } finally {
        await stop(child);
        fs.closeSync(log);
    }
}

async function main() {
    fs.mkdirSync(output, { recursive: true });
    preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, env: { ...process.env, BROWSER: 'none' }, stdio: 'ignore' });
    let entry;
    for (let i = 0; i < 80; i++) {
        if (preview.exitCode !== null) throw new Error('Preview failed to start');
        try {
            const response = await fetch(`${base}/play/`);
            if (response.ok) { entry = await response.text(); break; }
        } catch {}
        await delay(250);
    }
    if (!entry) throw new Error('Preview did not become ready');
    const cases = [
        ['forest-phone', 'guardian-handoff', 'mythicalForest', 390, 844],
        ['finale-phone', 'guardian-handoff', 'finalVoid', 390, 844],
        ['recovery-phone', 'completion-recovery', 'all', 390, 844],
        ['forest-desktop', 'guardian-handoff', 'mythicalForest', 1280, 720],
        ['finale-desktop', 'guardian-handoff', 'finalVoid', 1280, 720],
        ['recovery-desktop', 'completion-recovery', 'all', 1280, 720]
    ];
    const selected = process.env.COMPLETION_CASES?.split(',') || cases.map(item => item[0]);
    if (selected.some(name => !cases.some(item => item[0] === name))) throw new Error('Unknown completion case');
    const evidence = {
        sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
        sourceStatus: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(),
        shippedEntrySha256: createHash('sha256').update(entry).digest('hex'),
        fullPlaythrough: false, stagedCombat: true, muted: true, publicationAuthorized: false, cases: []
    };
    try {
        for (const item of cases.filter(item => selected.includes(item[0]))) evidence.cases.push(await runCase(...item));
        evidence.pass = true;
    } catch (error) {
        evidence.pass = false;
        evidence.error = error.message;
        throw error;
    } finally {
        fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(evidence, null, 2));
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(cleanup);
