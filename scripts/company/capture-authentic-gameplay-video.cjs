#!/usr/bin/env node

const { createHash } = require('crypto');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const host = '127.0.0.1';
const port = Number(process.env.MYTHICAL_VIDEO_CAPTURE_PORT) || 8147;
const baseUrl = `http://${host}:${port}`;
const outputDir = process.env.MYTHICAL_VIDEO_CAPTURE_DIR
    ? path.resolve(process.env.MYTHICAL_VIDEO_CAPTURE_DIR)
    : path.join(root, 'public/press/gameplay-video');
const videoFilename = 'mythical-forest-authentic-gameplay.mp4';
const posterFilename = 'mythical-forest-authentic-gameplay-poster.png';
const videoPath = path.join(outputDir, videoFilename);
const posterPath = path.join(outputDir, posterFilename);
const smokeScript = path.join(root, 'scripts/smoke-secondary-journeys.js');

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

function gitValue(args) {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    return result.status === 0 ? result.stdout.trim() || null : null;
}

function sha256(filename) {
    return createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
}

function inspectVideo() {
    const probe = spawnSync('ffprobe', [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height,r_frame_rate',
        '-show_entries', 'format=duration,size',
        '-of', 'json',
        videoPath
    ], { encoding: 'utf8' });
    if (probe.status !== 0) {
        throw new Error(`ffprobe could not inspect gameplay video: ${probe.stderr || probe.stdout}`);
    }
    const parsed = JSON.parse(probe.stdout);
    const stream = parsed.streams?.[0];
    const duration = Number(parsed.format?.duration);
    if (stream?.width !== 390 || stream?.height !== 844) {
        throw new Error(`Gameplay video must be 390x844, got ${stream?.width}x${stream?.height}`);
    }
    if (!Number.isFinite(duration) || duration < 3) {
        throw new Error(`Gameplay video is too short: ${parsed.format?.duration || 'unknown'} seconds`);
    }
    return {
        width: stream.width,
        height: stream.height,
        frameRate: stream.r_frame_rate,
        durationSeconds: Number(duration.toFixed(2)),
        bytes: Number(parsed.format.size)
    };
}

async function main() {
    if (!fs.existsSync(path.join(root, 'dist/index.html'))) {
        throw new Error('Production build is missing. Run npm run build before capturing gameplay video.');
    }
    fs.mkdirSync(outputDir, { recursive: true });
    const viteBin = path.join(path.dirname(require.resolve('vite')), 'bin/vite.js');
    const preview = spawn(process.execPath, [
        viteBin,
        'preview',
        '--host', host,
        '--port', String(port),
        '--strictPort'
    ], {
        cwd: root,
        stdio: ['ignore', 'inherit', 'inherit']
    });

    try {
        await waitForServer();
        const journey = spawnSync(process.execPath, [smokeScript], {
            cwd: root,
            env: {
                ...process.env,
                MYTHICAL_VOID_SMOKE_URL: baseUrl,
                SMOKE_MODE: 'interaction',
                SMOKE_CASE: 'mythicalForest',
                SMOKE_VIEWPORT_WIDTH: '390',
                SMOKE_VIEWPORT_HEIGHT: '844',
                SMOKE_VIDEO_PATH: videoPath,
                SMOKE_VIDEO_FPS: '12',
                SMOKE_SKIP_PREVIEW: '1'
            },
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        });
        process.stdout.write(journey.stdout || '');
        process.stderr.write(journey.stderr || '');
        if (journey.status !== 0) {
            throw new Error(`Authentic gameplay video journey failed with code ${journey.status}`);
        }
        if (!journey.stdout.includes('[smoke-result] interaction:mythicalForest:pass')) {
            throw new Error('Gameplay video journey did not reach its verified completion marker.');
        }
        const captureLine = journey.stdout.split('\n')
            .find(line => line.startsWith('[gameplay-video] {'));
        const journeyCapture = captureLine
            ? JSON.parse(captureLine.slice('[gameplay-video] '.length))
            : null;

        const metadata = inspectVideo();
        const poster = spawnSync('ffmpeg', [
            '-hide_banner',
            '-loglevel', 'error',
            '-y',
            '-ss', '1',
            '-i', videoPath,
            '-frames:v', '1',
            posterPath
        ], { encoding: 'utf8' });
        if (poster.status !== 0 || !fs.existsSync(posterPath)) {
            throw new Error(`Could not create gameplay video poster: ${poster.stderr || poster.stdout}`);
        }

        const manifest = {
            schemaVersion: 1,
            asOf: new Date().toISOString(),
            sourceCommit: gitValue(['rev-parse', 'HEAD']),
            sourceBranch: gitValue(['branch', '--show-current']),
            sourceRoute: '/play/',
            captureMethod: 'First-party automated browser journey recorded directly from the running Mythical Void canvas and interface.',
            privacy: 'A clean invented QA state is used. No player name, child identity, account, message, notification or personal save data appears.',
            presentationBoundary: 'Authentic running-build gameplay. No generated frames, simulated interface, replacement scenery or generated audio.',
            approvalState: 'internal_review_required_before_public_promotion',
            ownedWebsiteProofUseAuthorized: true,
            externalPromotionAuthorized: false,
            kevinApprovalRequiredBeforeExternalPublication: true,
            asset: {
                id: 'GV-001',
                filename: videoFilename,
                publicPath: `/press/gameplay-video/${videoFilename}`,
                posterFilename,
                posterPublicPath: `/press/gameplay-video/${posterFilename}`,
                sha256: sha256(videoPath),
                posterSha256: sha256(posterPath),
                classification: 'authentic_running_build_gameplay_video',
                disclosure: 'Recorded directly from the real Mythical Void browser game; not generated footage.',
                ...metadata,
                capturedFrames: journeyCapture?.frames || null,
                journeyDurationSeconds: journeyCapture?.journeyDurationSeconds || null,
                audio: 'none'
            }
        };
        fs.writeFileSync(
            path.join(outputDir, 'manifest.json'),
            `${JSON.stringify(manifest, null, 2)}\n`
        );
        process.stdout.write(
            `Authentic gameplay video complete: ${metadata.durationSeconds}s, ${metadata.width}x${metadata.height}, ${videoPath}\n`
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
