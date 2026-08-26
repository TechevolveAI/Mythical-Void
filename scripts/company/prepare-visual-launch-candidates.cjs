#!/usr/bin/env node

const { createHash } = require('crypto');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const host = '127.0.0.1';
const port = Number(process.env.MYTHICAL_VISUAL_REVIEW_PORT) || 8151;
const baseUrl = `http://${host}:${port}`;
const shotListPath = path.join(
    root,
    'docs/company/content/visual-launch-moments.json'
);
const smokeScript = path.join(root, 'scripts/smoke-secondary-journeys.js');
const runId = process.env.MYTHICAL_VISUAL_REVIEW_RUN_ID ||
    new Date().toISOString().replace(/[:.]/g, '-');
const candidateRoot = path.join(root, '.visual-review/candidates', runId);
const workingRoot = path.join(candidateRoot, '.working');
const shotList = JSON.parse(fs.readFileSync(shotListPath, 'utf8'));

const viewports = Object.fromEntries(
    shotList.sharedCaptureContract.requiredViewports.map(viewport => [
        viewport.id,
        viewport
    ])
);

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function gitValue(args) {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    return result.status === 0 ? result.stdout.trim() || null : null;
}

function sha256(file) {
    return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function pngDimensions(file) {
    const buffer = fs.readFileSync(file);
    if (
        buffer.length < 24 ||
        buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a'
    ) {
        throw new Error(`${file} is not a PNG`);
    }
    return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20)
    };
}

function inspectVideo(file, expected) {
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
        throw new Error(`ffprobe failed for ${file}: ${result.stderr || result.stdout}`);
    }
    const parsed = JSON.parse(result.stdout);
    const stream = parsed.streams?.[0] || {};
    const durationSeconds = Number(parsed.formats?.duration || parsed.format?.duration);
    const frameCount = Number(stream.nb_read_frames);
    if (
        stream.width !== expected.width ||
        stream.height !== expected.height ||
        !Number.isFinite(durationSeconds) ||
        durationSeconds < 2 ||
        !Number.isFinite(frameCount) ||
        frameCount < 20
    ) {
        throw new Error(
            `Video failed dimensions, duration or frame count: ${JSON.stringify({
                file,
                width: stream.width,
                height: stream.height,
                durationSeconds,
                frameCount
            })}`
        );
    }
    return {
        width: stream.width,
        height: stream.height,
        durationSeconds: Number(durationSeconds.toFixed(2)),
        frameCount
    };
}

async function waitForServer() {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 20000) {
        try {
            const response = await fetch(`${baseUrl}/play/`, { redirect: 'manual' });
            if (response.status >= 200 && response.status < 500) return;
        } catch (error) {
            // Preview startup is asynchronous.
        }
        await delay(200);
    }
    throw new Error(`Preview server did not become ready at ${baseUrl}`);
}

function runSmoke({
    mode,
    viewportId,
    outputDir,
    videoPath = null,
    smokeCase = 'all'
}) {
    const viewport = viewports[viewportId];
    const result = spawnSync(process.execPath, [smokeScript], {
        cwd: root,
        env: {
            ...process.env,
            MYTHICAL_VOID_SMOKE_URL: baseUrl,
            SMOKE_MODE: mode,
            SMOKE_CASE: smokeCase,
            SMOKE_VIEWPORT_WIDTH: String(viewport.width),
            SMOKE_VIEWPORT_HEIGHT: String(viewport.height),
            SMOKE_CAPTURE_DIR: outputDir,
            SMOKE_VIDEO_PATH: videoPath || '',
            SMOKE_VIDEO_FPS: '12',
            SMOKE_SKIP_PREVIEW: mode === 'village-ui' ? '0' : '1'
        },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    });
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    const marker = `[smoke-result] ${mode}:${smokeCase}:pass`;
    if (result.status !== 0 || !result.stdout.includes(marker)) {
        throw new Error(
            `${mode} ${viewportId} failed before candidate preparation completed`
        );
    }
    return {
        mode,
        viewportId,
        marker,
        runtimeExceptionsRejected: true,
        smokeContractPassed: true
    };
}

function copyCandidate(sourceDir, sourceName, candidateName) {
    const source = path.join(sourceDir, sourceName);
    const destination = path.join(candidateRoot, candidateName);
    if (!fs.existsSync(source)) {
        throw new Error(`Expected capture is missing: ${source}`);
    }
    fs.copyFileSync(source, destination);
    return destination;
}

function recordPng(file, momentId, viewportId, role) {
    const viewport = viewports[viewportId];
    const dimensions = pngDimensions(file);
    const bytes = fs.statSync(file).size;
    if (
        dimensions.width !== viewport.width ||
        dimensions.height !== viewport.height ||
        bytes < 12000
    ) {
        throw new Error(
            `PNG failed dimensions or minimum content size: ${JSON.stringify({
                file,
                ...dimensions,
                bytes
            })}`
        );
    }
    return {
        momentId,
        role,
        viewportId,
        filename: path.basename(file),
        sha256: sha256(file),
        bytes,
        ...dimensions,
        automatedScreening: 'passed_obvious_fault_checks_only',
        humanVisualApproval: 'pending'
    };
}

function recordVideo(file, momentId, viewportId) {
    const metadata = inspectVideo(file, viewports[viewportId]);
    return {
        momentId,
        role: 'continuous_normal_play',
        viewportId,
        filename: path.basename(file),
        sha256: sha256(file),
        bytes: fs.statSync(file).size,
        ...metadata,
        automatedScreening: 'passed_obvious_fault_checks_only',
        humanFrameReview: 'pending'
    };
}

async function main() {
    if (!fs.existsSync(path.join(root, 'dist/index.html'))) {
        throw new Error('Production build is missing. Run npm run build first.');
    }
    fs.mkdirSync(workingRoot, { recursive: true });
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

    const smokeEvidence = [];
    try {
        await waitForServer();
        for (const viewportId of ['phone', 'desktop']) {
            const villageDir = path.join(workingRoot, `village-${viewportId}`);
            fs.mkdirSync(villageDir, { recursive: true });
            smokeEvidence.push(runSmoke({
                mode: 'village-ui',
                viewportId,
                outputDir: villageDir,
                smokeCase: 'visual-launch'
            }));

            const movementDir = path.join(workingRoot, `movement-${viewportId}`);
            fs.mkdirSync(movementDir, { recursive: true });
            const movementVideo = path.join(
                movementDir,
                `movement-alive-${viewportId}.mp4`
            );
            smokeEvidence.push(runSmoke({
                mode: 'visual-movement',
                viewportId,
                outputDir: movementDir,
                videoPath: movementVideo
            }));
        }

        const files = [];
        for (const viewportId of ['phone', 'desktop']) {
            const villageDir = path.join(workingRoot, `village-${viewportId}`);
            const movementDir = path.join(workingRoot, `movement-${viewportId}`);
            const mappings = [
                ['VL-001', 'village-worker-check-in-mobile.png', `creature-helps-${viewportId}.png`, 'action_and_result'],
                ['VL-002', 'village-heart-choice-mobile.png', `choice-before-${viewportId}.png`, 'plain_choice'],
                ['VL-002', 'village-sanctuary-district.png', `choice-after-${viewportId}.png`, 'visible_consequence'],
                ['VL-003', 'village-heart-memory-mobile.png', `strange-discovery-${viewportId}.png`, 'living_memory_discovery']
            ];
            for (const [momentId, sourceName, candidateName, role] of mappings) {
                files.push(recordPng(
                    copyCandidate(villageDir, sourceName, candidateName),
                    momentId,
                    viewportId,
                    role
                ));
            }
            files.push(recordPng(
                copyCandidate(
                    movementDir,
                    `movement-alive-${viewportId}.png`,
                    `movement-alive-${viewportId}.png`
                ),
                'VL-004',
                viewportId,
                'movement_poster'
            ));
            files.push(recordVideo(
                copyCandidate(
                    movementDir,
                    `movement-alive-${viewportId}.mp4`,
                    `movement-alive-${viewportId}.mp4`
                ),
                'VL-004',
                viewportId
            ));
        }

        fs.rmSync(workingRoot, { recursive: true, force: true });
        const manifest = {
            schemaVersion: 1,
            runId,
            createdAt: new Date().toISOString(),
            sourceCommit: gitValue(['rev-parse', 'HEAD']),
            sourceBranch: gitValue(['branch', '--show-current']),
            sourceRoute: '/play/',
            sourceProfileId: shotList.sharedCaptureContract.profileId,
            renderer: shotList.sharedCaptureContract.renderer,
            location: '.visual-review/candidates/',
            websiteAccessible: false,
            automatedScreening: {
                state: 'passed_obvious_fault_checks_only',
                approvalGranted: false,
                evidence: smokeEvidence
            },
            adultFrameReview: {
                state: 'pending',
                everyFrameWatched: false,
                reviewer: null,
                decidedAt: null,
                decision: null,
                notes: null
            },
            kevinApproval: {
                state: 'pending',
                exactAssetApproved: false,
                wordingApproved: false,
                channelApproved: false,
                approvedAt: null
            },
            externalPublicationAuthorized: false,
            files
        };
        fs.writeFileSync(
            path.join(candidateRoot, 'manifest.json'),
            `${JSON.stringify(manifest, null, 2)}\n`
        );
        process.stdout.write(
            `Visual launch candidates prepared for human review: ${candidateRoot}\n`
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
