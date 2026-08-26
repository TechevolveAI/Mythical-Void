#!/usr/bin/env node

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const host = '127.0.0.1';
const port = Number(process.env.MYTHICAL_SHOWCASE_PORT) || 8131;
const baseUrl = `http://${host}:${port}`;
const captureDir = process.env.MYTHICAL_SHOWCASE_CAPTURE_DIR
    ? path.resolve(process.env.MYTHICAL_SHOWCASE_CAPTURE_DIR)
    : path.join(root, '.visual-review', 'candidates', 'creature-showcase');

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitForPreview() {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 15000) {
        try {
            const response = await fetch(`${baseUrl}/play/`);
            if (response.ok) return;
        } catch (_error) {
            // Preview is still starting.
        }
        await delay(150);
    }
    throw new Error('Timed out waiting for the real-creature showcase preview');
}

async function main() {
    if (!fs.existsSync(path.join(root, 'dist/index.html'))) {
        throw new Error('Production build is missing. Run npm run build before capture.');
    }
    const relativeToPublic = path.relative(path.join(root, 'public'), captureDir);
    if (relativeToPublic === '' || (!relativeToPublic.startsWith('..') && !path.isAbsolute(relativeToPublic))) {
        throw new Error('Creature showcase candidates cannot be captured inside public/.');
    }
    fs.mkdirSync(captureDir, { recursive: true });
    const viteBin = path.join(path.dirname(require.resolve('vite')), 'bin/vite.js');
    const preview = spawn(process.execPath, [
        viteBin,
        'preview',
        '--host',
        host,
        '--port',
        String(port),
        '--strictPort'
    ], {
        cwd: root,
        stdio: ['ignore', 'inherit', 'inherit']
    });

    try {
        await waitForPreview();
        const result = spawnSync(
            process.execPath,
            [path.join(root, 'scripts/smoke-secondary-journeys.js')],
            {
                cwd: root,
                stdio: 'inherit',
                env: {
                    ...process.env,
                    MYTHICAL_VOID_SMOKE_URL: baseUrl,
                    SMOKE_MODE: 'hatch-gallery',
                    SMOKE_CASE: 'showcase',
                    SMOKE_CAPTURE_DIR: captureDir,
                    SMOKE_VIEWPORT_WIDTH: '1440',
                    SMOKE_VIEWPORT_HEIGHT: '900',
                    CHROME_DEBUG_PORT: String(9600 + (process.pid % 250))
                }
            }
        );
        if (result.status !== 0) {
            throw new Error(`Real-creature showcase capture failed (${result.status})`);
        }
        process.stdout.write(
            `Real-creature showcase captured in ${captureDir}\n`
        );
    } finally {
        preview.kill('SIGTERM');
        await delay(300);
        if (preview.exitCode === null) preview.kill('SIGKILL');
    }
}

main().catch(error => {
    console.error(error.stack || error.message);
    process.exit(1);
});
