#!/usr/bin/env node

const { createHash } = require('crypto');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const host = '127.0.0.1';
const port = Number(process.env.MYTHICAL_ROOTWAKE_CAPTURE_PORT) || 8154;
const baseUrl = `http://${host}:${port}`;
const runId = process.env.MYTHICAL_ROOTWAKE_RUN_ID ||
    `${new Date().toISOString().replace(/[:.]/g, '-')}-rootwake`;
const candidateRoot = path.join(root, '.visual-review', 'candidates', runId);
const viewports = Object.freeze({
    phone: Object.freeze({ width: 390, height: 844 }),
    desktop: Object.freeze({ width: 1440, height: 810 })
});

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const sha256 = file => createHash('sha256')
    .update(fs.readFileSync(file))
    .digest('hex');

async function waitForPreview() {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 20000) {
        try {
            const response = await fetch(`${baseUrl}/play/`);
            if (response.ok) return;
        } catch (_error) {
            // Preview startup is asynchronous.
        }
        await delay(200);
    }
    throw new Error(`Timed out waiting for ${baseUrl}`);
}

function inspectVideo(file) {
    const result = spawnSync('ffprobe', [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-count_frames',
        '-show_entries', 'stream=width,height,nb_read_frames',
        '-show_entries', 'format=duration,size',
        '-of', 'json',
        file
    ], { encoding: 'utf8' });
    if (result.status !== 0) {
        throw new Error(result.stderr || `ffprobe failed for ${file}`);
    }
    const parsed = JSON.parse(result.stdout);
    const stream = parsed.streams?.[0] || {};
    const format = parsed.format || parsed.formats || {};
    return {
        width: Number(stream.width),
        height: Number(stream.height),
        frames: Number(stream.nb_read_frames),
        durationSeconds: Number(Number(format.duration).toFixed(2)),
        bytes: Number(format.size) || fs.statSync(file).size,
        sha256: sha256(file)
    };
}

function createFrameSheets(viewportId, videoFile, frameCount) {
    const sheetDir = path.join(candidateRoot, 'frame-review', viewportId);
    fs.mkdirSync(sheetDir, { recursive: true });
    const scale = viewportId === 'phone' ? '156:338' : '360:203';
    const tile = viewportId === 'phone' ? '5x4' : '4x3';
    const framesPerSheet = viewportId === 'phone' ? 20 : 12;
    const outputPattern = path.join(sheetDir, 'sheet-%02d.png');
    const result = spawnSync('ffmpeg', [
        '-loglevel', 'error',
        '-y',
        '-i', videoFile,
        '-vf', `scale=${scale},tile=${tile}:nb_frames=${framesPerSheet}`,
        '-fps_mode', 'passthrough',
        outputPattern
    ], { encoding: 'utf8' });
    if (result.status !== 0) {
        throw new Error(result.stderr || `frame sheets failed for ${videoFile}`);
    }
    const sheets = fs.readdirSync(sheetDir)
        .filter(file => file.endsWith('.png'))
        .sort();
    if (sheets.length < Math.ceil(frameCount / framesPerSheet)) {
        throw new Error(`Frame review does not cover ${viewportId} video`);
    }
    return sheets.map(file => ({
        path: path.relative(candidateRoot, path.join(sheetDir, file)),
        sha256: sha256(path.join(sheetDir, file))
    }));
}

function runCapture(viewportId) {
    const viewport = viewports[viewportId];
    const outputDir = path.join(candidateRoot, viewportId);
    const videoFile = path.join(outputDir, `rootwake-sequence-${viewportId}.mp4`);
    fs.mkdirSync(outputDir, { recursive: true });
    const result = spawnSync(
        process.execPath,
        [path.join(root, 'scripts/smoke-secondary-journeys.js')],
        {
            cwd: root,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
                ...process.env,
                MYTHICAL_VOID_SMOKE_URL: baseUrl,
                SMOKE_MODE: 'rootwake-sequence',
                SMOKE_CASE: 'playable',
                SMOKE_VIEWPORT_WIDTH: String(viewport.width),
                SMOKE_VIEWPORT_HEIGHT: String(viewport.height),
                SMOKE_CAPTURE_DIR: outputDir,
                SMOKE_VIDEO_PATH: videoFile,
                SMOKE_VIDEO_FPS: '12',
                SMOKE_HARDWARE_ACCELERATED_CAPTURE: '1',
                SMOKE_ALLOW_LOCAL_STATIC_FUNCTION_404: '1',
                SMOKE_SKIP_PREVIEW: '1',
                CHROME_DEBUG_PORT: String(9700 + (process.pid % 200) + (viewportId === 'phone' ? 0 : 220))
            }
        }
    );
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    if (
        result.status !== 0 ||
        !result.stdout.includes('[smoke-result] rootwake-sequence:playable:pass')
    ) {
        throw new Error(`Rootwake ${viewportId} capture failed`);
    }
    const video = inspectVideo(videoFile);
    if (
        video.width !== viewport.width ||
        video.height !== viewport.height ||
        video.frames < 72 ||
        video.durationSeconds < 6
    ) {
        throw new Error(
            `Rootwake ${viewportId} video missed the review floor: ` +
            JSON.stringify(video)
        );
    }
    return {
        viewportId,
        viewport,
        video: {
            path: path.relative(candidateRoot, videoFile),
            ...video
        },
        stills: fs.readdirSync(outputDir)
            .filter(file => file.endsWith('.png'))
            .sort()
            .map(file => ({
                path: path.relative(candidateRoot, path.join(outputDir, file)),
                bytes: fs.statSync(path.join(outputDir, file)).size,
                sha256: sha256(path.join(outputDir, file))
            })),
        frameReview: createFrameSheets(viewportId, videoFile, video.frames)
    };
}

async function main() {
    if (!fs.existsSync(path.join(root, 'dist/index.html'))) {
        throw new Error('Production build is missing. Run npm run build before capture.');
    }
    if (!path.relative(path.join(root, 'public'), candidateRoot).startsWith('..')) {
        throw new Error('Private Rootwake evidence cannot be written inside public/.');
    }
    fs.mkdirSync(candidateRoot, { recursive: true });
    const viteBin = path.join(path.dirname(require.resolve('vite')), 'bin/vite.js');
    const preview = spawn(process.execPath, [
        viteBin,
        'preview',
        '--host', host,
        '--port', String(port),
        '--strictPort'
    ], { cwd: root, stdio: ['ignore', 'inherit', 'inherit'] });

    try {
        await waitForPreview();
        const captures = ['phone', 'desktop'].map(runCapture);
        const manifest = {
            schemaVersion: 1,
            runId,
            createdAt: new Date().toISOString(),
            sourceCommit: spawnSync('git', ['rev-parse', 'HEAD'], {
                cwd: root,
                encoding: 'utf8'
            }).stdout.trim(),
            playableSequence: 'mythical_forest_rootwake_crossing_v1',
            renderer: 'player_facing_phaser_creature_renderer',
            actualGameSystemsOnly: true,
            generatedInterpretationPresentedAsGameplay: false,
            requiredVisibleStory: {
                creatureAction: 'creature_resonance_slam',
                worldChange: 'five_layer_crossing_raised',
                alienEvent: 'gravity_seed_rain_rises',
                traversal: 'continuous_layered_route_with_creature_and_astronaut'
            },
            automatedDecision: 'passed_obvious_fault_checks_only',
            adultFrameReview: {
                state: 'pending',
                everyFrameWatched: false,
                reviewer: null,
                decision: null
            },
            kevinApproval: 'not_requested',
            publicationAuthorized: false,
            websiteAccessible: false,
            captures
        };
        fs.writeFileSync(
            path.join(candidateRoot, 'manifest.json'),
            `${JSON.stringify(manifest, null, 2)}\n`
        );
        process.stdout.write(`Private Rootwake evidence: ${candidateRoot}\n`);
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
