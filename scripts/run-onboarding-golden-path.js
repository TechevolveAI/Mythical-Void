#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const host = process.env.MYTHICAL_VOID_SMOKE_HOST || '127.0.0.1';
const port = Number(process.env.MYTHICAL_VOID_SMOKE_PORT) || 8126;
const externalUrl = String(process.env.MYTHICAL_VOID_SMOKE_URL || '').trim().replace(/\/+$/, '');
const baseUrl = externalUrl || `http://${host}:${port}`;
const managesPreview = !externalUrl;

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForServer() {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 20000) {
        try {
            const response = await fetch(`${baseUrl}/play/`);
            if (response.status >= 200 && response.status < 500) return;
        } catch {}
        await delay(200);
    }
    throw new Error(`Onboarding preview did not start at ${baseUrl}`);
}

function runCase(name, env) {
    return new Promise((resolve, reject) => {
        const expected = `[smoke-result] ${env.SMOKE_MODE}:${env.SMOKE_CASE || 'all'}:pass`;
        let output = '';
        console.log(`\n[onboarding-gate] ${name}`);
        const child = spawn(process.execPath, [
            path.join(projectRoot, 'scripts', 'smoke-secondary-journeys.js')
        ], {
            cwd: projectRoot,
            env: {
                ...process.env,
                MYTHICAL_VOID_SMOKE_URL: baseUrl,
                ...env
            },
            stdio: ['ignore', 'pipe', 'inherit']
        });
        child.stdout.on('data', chunk => {
            output += chunk.toString();
            process.stdout.write(chunk);
        });
        child.once('error', reject);
        child.once('exit', (code, signal) => {
            if (code === 0 && output.includes(expected)) resolve();
            else reject(new Error(`${name} failed${signal ? ` (${signal})` : ` (exit ${code})`}`));
        });
    });
}

async function main() {
    let preview = null;
    if (managesPreview) {
        const viteBin = path.join(path.dirname(require.resolve('vite')), 'bin/vite.js');
        preview = spawn(process.execPath, [
            viteBin,
            'preview',
            '--host', host,
            '--port', String(port),
            '--strictPort'
        ], { cwd: projectRoot, stdio: ['ignore', 'inherit', 'inherit'] });
    }

    try {
        await waitForServer();
        const cases = [
            ['phone Start-to-egg', { SMOKE_MODE: 'home-entry', SMOKE_CASE: 'phone', SMOKE_VIEWPORT_WIDTH: '375', SMOKE_VIEWPORT_HEIGHT: '667' }],
            ['landscape Start fallback', { SMOKE_MODE: 'home-entry', SMOKE_CASE: 'mobile-landscape', SMOKE_VIEWPORT_WIDTH: '430', SMOKE_VIEWPORT_HEIGHT: '384' }],
            ['portrait success through playable Sanctuary', { SMOKE_MODE: 'first-sanctuary', SMOKE_CASE: 'all', SMOKE_VIEWPORT_WIDTH: '390', SMOKE_VIEWPORT_HEIGHT: '844' }],
            ['portrait still loading but Sanctuary remains available', { SMOKE_MODE: 'first-sanctuary', SMOKE_CASE: 'pending-handoff', SMOKE_VIEWPORT_WIDTH: '390', SMOKE_VIEWPORT_HEIGHT: '844' }],
            ['portrait failure but Sanctuary remains available', { SMOKE_MODE: 'first-sanctuary', SMOKE_CASE: 'failure-handoff', SMOKE_VIEWPORT_WIDTH: '390', SMOKE_VIEWPORT_HEIGHT: '844' }],
            ['reload resumes named-creature handoff', { SMOKE_MODE: 'first-sanctuary', SMOKE_CASE: 'reload-handoff', SMOKE_VIEWPORT_WIDTH: '390', SMOKE_VIEWPORT_HEIGHT: '844' }]
        ];
        for (const [name, env] of cases) await runCase(name, env);
        console.log('\n[onboarding-gate-result] pass');
    } finally {
        if (preview && preview.exitCode === null) preview.kill('SIGTERM');
    }
}

main().catch(error => {
    console.error(error.stack || error.message);
    process.exit(1);
});
