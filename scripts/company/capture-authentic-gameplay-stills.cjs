#!/usr/bin/env node

const { createHash } = require('crypto');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const host = '127.0.0.1';
const port = Number(process.env.MYTHICAL_CAPTURE_PORT) || 8146;
const baseUrl = `http://${host}:${port}`;
const captureDir = process.env.MYTHICAL_CAPTURE_DIR
    ? path.resolve(process.env.MYTHICAL_CAPTURE_DIR)
    : path.join(root, 'public/press/gameplay');
const captureGroup = process.env.MYTHICAL_CAPTURE_GROUP || 'all';
const smokeScript = path.join(root, 'scripts/smoke-secondary-journeys.js');
const expectedFiles = [
    'project-beacon-start.png',
    'project-beacon-live-egg.png',
    'creature-cosmic-egg-hatch.png',
    'realm-mythicalforest.png',
    'realm-crystalcaves.png',
    'realm-reef.png',
    'realm-voidpeaks.png',
    'realm-auroradepths.png',
    'realm-finalvoid.png',
    'village-base-builder.png',
    'village-first-construction.png',
    'nasa-apollo11-real-space-discovery.png',
    'creature-cosmic-egg-reveal.png',
    'guardian-void-empress-corrupted.png',
    'guardian-void-empress-restored.png',
    'project-beacon-priority-choice.png',
    'project-beacon-priority-choice-phone.png'
];

const groupFiles = {
    opening: [...expectedFiles.slice(0, 3), 'creature-cosmic-egg-reveal.png'],
    realms: expectedFiles.slice(3, 9),
    village: expectedFiles.slice(9, 11),
    nasa: expectedFiles.slice(11, 12),
    restoration: expectedFiles.slice(13, 15),
    choice: expectedFiles.slice(15, 17),
    all: expectedFiles
};

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 20000) {
        try {
            const response = await fetch(`${baseUrl}/play/`, { redirect: 'manual' });
            if (response.status >= 200 && response.status < 500) return;
        } catch (error) {
            // The preview server may still be starting.
        }
        await delay(200);
    }
    throw new Error(`Preview server did not become ready at ${baseUrl}`);
}

function runSmoke({ mode, smokeCase, width, height, extraEnv = {} }) {
    const result = spawnSync(process.execPath, [smokeScript], {
        cwd: root,
        env: {
            ...process.env,
            MYTHICAL_VOID_SMOKE_URL: baseUrl,
            SMOKE_MODE: mode,
            SMOKE_CASE: smokeCase,
            SMOKE_VIEWPORT_WIDTH: String(width),
            SMOKE_VIEWPORT_HEIGHT: String(height),
            SMOKE_CAPTURE_DIR: captureDir,
            ...extraEnv
        },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    });
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    if (result.status !== 0) {
        throw new Error(`Capture journey ${mode}:${smokeCase} failed with code ${result.status}`);
    }
    const marker = `[smoke-result] ${mode}:${smokeCase}:pass`;
    if (!result.stdout.includes(marker)) {
        throw new Error(`Capture journey ${mode}:${smokeCase} did not finish with ${marker}`);
    }
}

function readPngDimensions(buffer) {
    if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') {
        throw new Error('Capture is not a valid PNG file');
    }
    return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20)
    };
}

function gitValue(args) {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) return null;
    return result.stdout.trim() || null;
}

function writeManifest() {
    const manifestPath = path.join(captureDir, 'manifest.json');
    let previousManifest = null;
    if (fs.existsSync(manifestPath)) {
        try {
            previousManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        } catch (error) {
            throw new Error(`Existing gameplay manifest is invalid: ${error.message}`);
        }
    }
    const currentSourceCommit = gitValue(['rev-parse', 'HEAD']);
    const capturedNow = new Set(groupFiles[captureGroup]);
    for (const filename of groupFiles[captureGroup]) {
        if (!fs.existsSync(path.join(captureDir, filename))) {
            throw new Error(`Required ${captureGroup} capture is missing: ${filename}`);
        }
    }
    const captures = expectedFiles.filter((filename) => (
        fs.existsSync(path.join(captureDir, filename))
    )).map((filename) => {
        const absolutePath = path.join(captureDir, filename);
        const buffer = fs.readFileSync(absolutePath);
        const dimensions = readPngDimensions(buffer);
        if (dimensions.width < 390 || dimensions.height < 810) {
            throw new Error(`Gameplay capture is too small: ${filename} (${dimensions.width}x${dimensions.height})`);
        }
        const capture = {
            id: `GP-${String(expectedFiles.indexOf(filename) + 1).padStart(3, '0')}`,
            filename,
            publicPath: `/press/gameplay/${filename}`,
            sha256: createHash('sha256').update(buffer).digest('hex'),
            bytes: buffer.length,
            ...dimensions,
            classification: 'authentic_running_build_screenshot',
            fixture: 'company_controlled_qa_state_no_personal_data',
            sourceCommit: capturedNow.has(filename)
                ? currentSourceCommit
                : previousManifest?.captures?.find(item => item.filename === filename)?.sourceCommit ||
                    previousManifest?.sourceCommit ||
                    null,
            disclosure: 'Captured from the real Mythical Void browser game; not a generated mockup.'
        };
        if (filename === 'nasa-apollo11-real-space-discovery.png') {
            capture.embeddedSource = {
                name: 'NASA Astronomy Picture of the Day — Apollo 11 Landing Panorama',
                date: '2024-07-20',
                url: 'https://apod.nasa.gov/apod/ap240720.html',
                imageCredit: 'Neil Armstrong · Apollo 11 · NASA'
            };
            capture.disclosure = 'Captured from the real Mythical Void browser game. The in-game panel contains a credited NASA Apollo 11 image and clearly separates real space material from the creature’s imagined reaction.';
        }
        return capture;
    });
    const manifest = {
        schemaVersion: 1,
        asOf: new Date().toISOString(),
        sourceCommit: currentSourceCommit,
        sourceBranch: gitValue(['branch', '--show-current']),
        sourceRoute: '/play/',
        captureMethod: 'Automated first-party browser journeys using a clean invented QA state.',
        captureSourcePolicy: 'The top-level sourceCommit records the build that last updated this manifest. Each capture has its own sourceCommit, which remains unchanged during partial recaptures.',
        captureSourceCommits: [...new Set(captures.map(capture => capture.sourceCommit).filter(Boolean))],
        rights: 'First-party Mythical Void game capture. Any embedded public NASA material retains the exact source and credit recorded on its capture.',
        privacy: 'No player name, child identity, account, message, notification or personal save data is used.',
        presentationBoundary: 'These are authentic screenshots of a running build. Some in-game art may have its own disclosed production provenance; none of these images is a generated gameplay mockup.',
        approvalState: 'internal_review_required_before_public_promotion',
        captures
    };
    fs.writeFileSync(
        manifestPath,
        `${JSON.stringify(manifest, null, 2)}\n`
    );
    return manifest;
}

async function main() {
    const distIndex = path.join(root, 'dist/index.html');
    if (!fs.existsSync(distIndex)) {
        throw new Error('Production build is missing. Run npm run build before capturing gameplay.');
    }
    fs.mkdirSync(captureDir, { recursive: true });
    if (!['all', 'opening', 'realms', 'village', 'nasa', 'restoration', 'choice'].includes(captureGroup)) {
        throw new Error(`Unknown MYTHICAL_CAPTURE_GROUP: ${captureGroup}`);
    }

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
        await waitForServer();
        if (['all', 'opening'].includes(captureGroup)) {
            runSmoke({ mode: 'home-entry', smokeCase: 'phone', width: 1440, height: 810 });
            runSmoke({ mode: 'interaction', smokeCase: 'egg', width: 1440, height: 810 });
        }
        if (['all', 'realms'].includes(captureGroup)) {
            for (const smokeCase of [
                'mythicalForest',
                'crystalCaves',
                'reef',
                'voidPeaks',
                'auroraDepths',
                'finalVoid'
            ]) {
                // The platforming realms are intentionally phone-first. Capture
                // them in their honest full-frame portrait presentation instead
                // of surrounding the phone playfield with decorative empty space.
                runSmoke({ mode: 'interaction', smokeCase, width: 390, height: 844 });
            }
        }
        if (['all', 'village'].includes(captureGroup)) {
            runSmoke({
                mode: 'village-ui',
                smokeCase: 'all',
                width: 390,
                height: 844,
                extraEnv: { SMOKE_SKIP_PREVIEW: '1' }
            });
        }
        if (['all', 'nasa'].includes(captureGroup)) {
            runSmoke({
                mode: 'nasa-content',
                smokeCase: 'all',
                width: 390,
                height: 844,
                extraEnv: { SMOKE_SKIP_PREVIEW: '1' }
            });
        }
        if (['all', 'restoration'].includes(captureGroup)) {
            runSmoke({
                mode: 'restoration-proof',
                smokeCase: 'finalVoid',
                width: 390,
                height: 844
            });
        }
        if (['all', 'choice'].includes(captureGroup)) {
            runSmoke({
                mode: 'choice-proof',
                smokeCase: 'wide',
                width: 1440,
                height: 810
            });
            runSmoke({
                mode: 'choice-proof',
                smokeCase: 'phone',
                width: 390,
                height: 844
            });
        }
        const manifest = writeManifest();
        process.stdout.write(
            `Authentic gameplay capture complete: ${manifest.captures.length} stills in ${captureDir}\n`
        );
    } finally {
        preview.kill('SIGTERM');
        await delay(300);
        if (preview.exitCode === null) preview.kill('SIGKILL');
    }
}

main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
});
