#!/usr/bin/env node

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE_URL = process.env.MYTHICAL_VOID_SMOKE_URL || 'http://127.0.0.1:8125';
const CHROME_PATH = process.env.CHROME_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = Number(process.env.CHROME_DEBUG_PORT) ||
    (9300 + (process.pid % 500));
const WAIT_STEP_MS = 100;
const CDP_TIMEOUT_MS = Number(process.env.SMOKE_CDP_TIMEOUT_MS) || 15000;
const SMOKE_MODE = process.env.SMOKE_MODE || 'interaction';
const SMOKE_CASE = process.env.SMOKE_CASE || 'all';
const SMOKE_TRACE = process.env.SMOKE_TRACE === '1';
const SMOKE_BROWSER_TRACE = process.env.SMOKE_BROWSER_TRACE === '1';
const SMOKE_TOUCH_PROBE = process.env.SMOKE_TOUCH_PROBE || '';
const SMOKE_POINTER_PROBE = process.env.SMOKE_POINTER_PROBE || '';
const SMOKE_TOUCH_PROTOCOL = process.env.SMOKE_TOUCH_PROTOCOL || 'dispatch';
const SMOKE_SKIP_PREVIEW = process.env.SMOKE_SKIP_PREVIEW === '1';
const SMOKE_VIEWPORT_WIDTH = Number(process.env.SMOKE_VIEWPORT_WIDTH) || 390;
const SMOKE_VIEWPORT_HEIGHT = Number(process.env.SMOKE_VIEWPORT_HEIGHT) || 844;
const CAMPAIGN_MOBILE_RENDER_BUDGETS = Object.freeze({
    mythicalForest: Object.freeze({
        displayCount: 215,
        activeTweenCount: 18,
        performanceTier: 'mobile'
    }),
    crystalCaves: Object.freeze({
        displayCount: 185,
        activeTweenCount: 12,
        performanceTier: 'mobile'
    }),
    reef: Object.freeze({
        displayCount: 150,
        activeTweenCount: 16,
        performanceTier: 'custom'
    }),
    voidPeaks: Object.freeze({
        displayCount: 165,
        activeTweenCount: 10,
        performanceTier: 'mobile'
    }),
    auroraDepths: Object.freeze({
        displayCount: 160,
        activeTweenCount: 15,
        performanceTier: 'mobile'
    }),
    finalVoid: Object.freeze({
        displayCount: 165,
        activeTweenCount: 12,
        performanceTier: 'mobile'
    })
});
const SMOKE_CAPTURE_DIR = process.env.SMOKE_CAPTURE_DIR
    ? path.resolve(process.env.SMOKE_CAPTURE_DIR)
    : null;
const SMOKE_VIDEO_PATH = process.env.SMOKE_VIDEO_PATH
    ? path.resolve(process.env.SMOKE_VIDEO_PATH)
    : null;
const SMOKE_VIDEO_FPS = Number(process.env.SMOKE_VIDEO_FPS) || 12;
let activeTouchPoint = { x: 0, y: 0 };
let activeTouchIdentifier = null;
let nextTouchIdentifier = 1;
let evaluationSequence = 0;
let activeVideoCapture = null;

function trace(message, details = null) {
    if (!SMOKE_TRACE) return;
    process.stdout.write(`[smoke-trace] ${message}${
        details == null ? '' : ` ${JSON.stringify(details)}`
    }\n`);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(check, {
    timeoutMs = 12000,
    message = 'condition'
} = {}) {
    const startedAt = Date.now();
    let lastError = null;
    while (Date.now() - startedAt < timeoutMs) {
        try {
            const result = await check();
            if (result) return result;
        } catch (error) {
            lastError = error;
        }
        await delay(WAIT_STEP_MS);
    }
    throw new Error(`Timed out waiting for ${message}${
        lastError ? `: ${lastError.message}` : ''
    }`);
}

class CdpSession {
    constructor(url) {
        this.socket = new WebSocket(url);
        this.nextId = 1;
        this.pending = new Map();
        this.events = new Map();
    }

    async connect() {
        await new Promise((resolve, reject) => {
            this.socket.addEventListener('open', resolve, { once: true });
            this.socket.addEventListener('error', reject, { once: true });
        });
        this.socket.addEventListener('message', event => {
            const message = JSON.parse(event.data);
            if (message.id) {
                const pending = this.pending.get(message.id);
                if (!pending) return;
                this.pending.delete(message.id);
                if (message.error) {
                    pending.reject(new Error(message.error.message));
                } else {
                    pending.resolve(message.result);
                }
                return;
            }
            const listeners = this.events.get(message.method) || [];
            listeners.forEach(listener => listener(message.params));
        });
    }

    call(method, params = {}) {
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`CDP command timed out: ${method}`));
            }, CDP_TIMEOUT_MS);
            this.pending.set(id, {
                resolve: value => {
                    clearTimeout(timeout);
                    resolve(value);
                },
                reject: error => {
                    clearTimeout(timeout);
                    reject(error);
                }
            });
            this.socket.send(JSON.stringify({ id, method, params }));
        });
    }

    on(method, listener) {
        const listeners = this.events.get(method) || [];
        listeners.push(listener);
        this.events.set(method, listeners);
    }

    close() {
        this.socket.close();
    }
}

async function evaluate(session, expression) {
    const sequence = ++evaluationSequence;
    const awaitsBrowserPromise = expression.includes('new Promise') ||
        expression.includes('(async () =>');
    if (SMOKE_BROWSER_TRACE) {
        process.stdout.write(`[browser-evaluate:${sequence}] ${
            awaitsBrowserPromise ? 'async' : 'sync'
        } ${expression.trim().slice(0, 100).replace(/\s+/g, ' ')}\n`);
    }
    let result;
    try {
        result = await session.call('Runtime.evaluate', {
            expression,
            awaitPromise: awaitsBrowserPromise,
            returnByValue: true
        });
    } catch (error) {
        if (SMOKE_BROWSER_TRACE) {
            process.stdout.write(
                `[browser-evaluate:${sequence}:error] ${error.message}\n`
            );
        }
        throw error;
    }
    if (result.exceptionDetails) {
        throw new Error(
            result.exceptionDetails.exception?.description ||
            result.exceptionDetails.text ||
            'Browser evaluation failed'
        );
    }
    return result.result?.value;
}

async function sampleFramePacing(session, sceneName, {
    warmupMs = 1200,
    sampleMs = 1800
} = {}) {
    await delay(warmupMs);
    return evaluate(session, `(() => new Promise(resolve => {
        const scene = window.mythicalGame?.scene?.getScene?.(
            ${JSON.stringify(sceneName)}
        );
        const intervals = [];
        const startedAt = performance.now();
        const objectiveTextureRevisionAtStart = Number(
            scene?.campaignObjectiveTextureRevision
        ) || 0;
        const peakEmberDrawCountAtStart = Number(
            scene?.peakEmberDrawCount
        ) || 0;
        const peakEnemyPatrolUpdateCountAtStart = Number(
            scene?.peakEnemyPatrolUpdateCount
        ) || 0;
        const auroraEnemyPatrolUpdateCountAtStart = Number(
            scene?.auroraEnemyPatrolUpdateCount
        ) || 0;
        let previousAt = null;

        const percentile = (sorted, ratio) => {
            if (!sorted.length) return 0;
            const index = Math.min(
                sorted.length - 1,
                Math.max(0, Math.ceil(sorted.length * ratio) - 1)
            );
            return sorted[index];
        };
        const finish = () => {
            const sorted = [...intervals].sort((a, b) => a - b);
            const totalMs = intervals.reduce((sum, value) => sum + value, 0);
            const longFrames = intervals.filter(value => value > 33.4).length;
            const tweenTargets = (scene?.tweens?.getTweens?.() || [])
                .flatMap(tween => tween?.targets || []);
            const biomeManaged = Boolean(
                window.ParallaxBiome?.isActive &&
                window.ParallaxBiome?.scene === scene
            );
            const sharedAmbientFieldObjects = biomeManaged
                ? new Set(
                    (window.ParallaxBiome?.layers || [])
                        .filter(layer => [
                            'nebula',
                            'starField',
                            'rock',
                            'floraField'
                        ].includes(layer?.type))
                        .map(layer => layer?.object)
                        .filter(Boolean)
                )
                : new Set();
            const tweenTargetCounts = tweenTargets.reduce((counts, target) => {
                const key = target?.texture?.key ||
                    target?.type ||
                    target?.constructor?.name ||
                    'unknown';
                counts[key] = (counts[key] || 0) + 1;
                return counts;
            }, {});
            const graphicsTweenDepths = tweenTargets
                .filter(target => target?.type === 'Graphics')
                .reduce((counts, target) => {
                    const key = 'depth:' + (Number(target?.depth) || 0) + ':' +
                        (target?.visible === false ? 'hidden' : 'visible');
                    counts[key] = (counts[key] || 0) + 1;
                    return counts;
                }, {});
            const graphicsTweenProfiles = tweenTargets
                .filter(target => target?.type === 'Graphics')
                .reduce((counts, target) => {
                    const key = [
                        'scene:' + (target?.scene?.scene?.key || 'unknown'),
                        'depth:' + (Number(target?.depth) || 0),
                        'commands:' + (target?.commandBuffer?.length || 0),
                        'scroll:' + (Number(target?.scrollFactorX) || 0),
                        'container:' + Boolean(target?.parentContainer)
                    ].join('|');
                    counts[key] = (counts[key] || 0) + 1;
                    return counts;
                }, {});
            const displayObjects = scene?.children?.list || [];
            const countDisplayTypes = objects => objects.reduce(
                (counts, object) => {
                    const key = object?.type ||
                        object?.constructor?.name ||
                        'unknown';
                    counts[key] = (counts[key] || 0) + 1;
                    return counts;
                },
                {}
            );
            resolve({
                sceneActive: Boolean(scene?.scene?.isActive?.()),
                warmupMs: ${warmupMs},
                sampleMs: Math.round(performance.now() - startedAt),
                frameCount: intervals.length,
                averageFps: totalMs > 0
                    ? Number((intervals.length * 1000 / totalMs).toFixed(2))
                    : 0,
                medianFrameMs: Number(percentile(sorted, 0.5).toFixed(2)),
                p95FrameMs: Number(percentile(sorted, 0.95).toFixed(2)),
                p99FrameMs: Number(percentile(sorted, 0.99).toFixed(2)),
                longFrameCount: longFrames,
                longFrameRatio: intervals.length
                    ? Number((longFrames / intervals.length).toFixed(3))
                    : 1,
                phaserActualFps: Number(
                    (window.mythicalGame?.loop?.actualFps || 0).toFixed(2)
                ),
                displayCount: displayObjects.length,
                displayTypeCounts: countDisplayTypes(displayObjects),
                visibleDisplayTypeCounts: countDisplayTypes(
                    displayObjects.filter(object => object?.visible !== false)
                ),
                hiddenDisplayTypeCounts: countDisplayTypes(
                    displayObjects.filter(object => object?.visible === false)
                ),
                objectiveHudRendering: {
                    textureRevision: Number(
                        scene?.campaignObjectiveTextureRevision
                    ) || 0,
                    rebuildsDuringSample: Math.max(
                        0,
                        (Number(scene?.campaignObjectiveTextureRevision) || 0) -
                            objectiveTextureRevisionAtStart
                    )
                },
                peaksRuntime: scene?.scene?.key === 'VoidPeaksLevel' ? {
                    emberRedrawsDuringSample: Math.max(
                        0,
                        (Number(scene?.peakEmberDrawCount) || 0) -
                            peakEmberDrawCountAtStart
                    ),
                    emberVisibleCount: Number(
                        scene?.peakEmberVisibleCount
                    ) || 0,
                    patrolUpdatesDuringSample: Math.max(
                        0,
                        (Number(scene?.peakEnemyPatrolUpdateCount) || 0) -
                            peakEnemyPatrolUpdateCountAtStart
                    )
                } : null,
                auroraRuntime: scene?.scene?.key === 'AuroraDepthsLevel' ? {
                    patrolUpdatesDuringSample: Math.max(
                        0,
                        (Number(scene?.auroraEnemyPatrolUpdateCount) || 0) -
                            auroraEnemyPatrolUpdateCountAtStart
                    ),
                    runtimeEnemyCount:
                        scene?.getRuntimePatrolEnemies?.().length || 0
                } : null,
                activeTweenCount: scene?.tweens?.getTweens?.().length || 0,
                landingDustTweenCount: (
                    scene?.tweens?.getTweens?.() || []
                ).filter(tween => (tween?.targets || []).some(
                    target => target?.fxRole === 'landingDust'
                )).length,
                landingDustOrphanTweenCount: (
                    scene?.tweens?.getTweens?.() || []
                ).filter(tween => (tween?.targets || []).some(
                    target => target?.fxRole === 'landingDust' &&
                        (target.active === false || !target.scene)
                )).length,
                sharedAmbientFieldTweenCount: tweenTargets.filter(
                    target => sharedAmbientFieldObjects.has(target)
                ).length,
                tweenTargetCounts,
                graphicsTweenDepths,
                graphicsTweenProfiles,
                timerCount: scene?.time?.getAllEvents?.().length || 0,
                forestEnemyOverlapActive:
                    scene?.forestEnemyOverlap?.active !== false &&
                    Boolean(scene?.forestEnemyOverlap),
                renderer: window.mythicalGame?.renderer?.type,
                postPipelineCount:
                    scene?.cameras?.main?.postPipelines?.length || 0,
                performanceTier: biomeManaged
                    ? window.ParallaxBiome?.performanceTier || null
                    : 'custom',
                parallaxLayers: window.ParallaxBiome?.layers?.reduce?.(
                    (counts, layer) => {
                        const key = layer?.type || 'unknown';
                        counts[key] = (counts[key] || 0) + 1;
                        return counts;
                    },
                    {}
                ) || {},
                particleProcessors: Object.entries(
                    window.ParallaxBiome?.particleEmitters || {}
                ).reduce((counts, [key, emitter]) => {
                    if (emitter && emitter.active !== false) counts.push(key);
                    return counts;
                }, [])
            });
        };
        const capture = now => {
            if (previousAt !== null) intervals.push(now - previousAt);
            previousAt = now;
            if (now - startedAt >= ${sampleMs}) {
                finish();
                return;
            }
            requestAnimationFrame(capture);
        };
        requestAnimationFrame(capture);
    }))()`);
}

async function captureGameplayStill(session, filename) {
    if (!SMOKE_CAPTURE_DIR) return null;
    const safeFilename = String(filename || '')
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    if (!safeFilename || !safeFilename.endsWith('.png')) {
        throw new Error(`Invalid gameplay capture filename: ${JSON.stringify(filename)}`);
    }
    fs.mkdirSync(SMOKE_CAPTURE_DIR, { recursive: true });
    await session.call('Page.bringToFront');
    await delay(250);
    const result = await session.call('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false
    });
    const destination = path.join(SMOKE_CAPTURE_DIR, safeFilename);
    fs.writeFileSync(destination, Buffer.from(result.data, 'base64'));
    process.stdout.write(`[gameplay-capture] ${destination}\n`);
    return destination;
}

async function startGameplayVideo(session) {
    if (!SMOKE_VIDEO_PATH || activeVideoCapture) return activeVideoCapture;
    if (!SMOKE_VIDEO_PATH.endsWith('.mp4')) {
        throw new Error('SMOKE_VIDEO_PATH must end in .mp4');
    }
    const framesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-video-frames-'));
    const capture = {
        active: true,
        framesDir,
        frameCount: 0,
        startedAt: Date.now(),
        session
    };
    activeVideoCapture = capture;
    session.on('Page.screencastFrame', params => {
        session.call('Page.screencastFrameAck', {
            sessionId: params.sessionId
        }).catch(() => {});
        if (!capture.active) return;
        capture.frameCount++;
        const filename = `frame-${String(capture.frameCount).padStart(6, '0')}.jpg`;
        fs.writeFileSync(
            path.join(framesDir, filename),
            Buffer.from(params.data, 'base64')
        );
    });
    await session.call('Page.startScreencast', {
        format: 'jpeg',
        quality: 92,
        maxWidth: SMOKE_VIEWPORT_WIDTH,
        maxHeight: SMOKE_VIEWPORT_HEIGHT,
        everyNthFrame: 1
    });
    process.stdout.write(`[gameplay-video] recording ${SMOKE_VIDEO_PATH}\n`);
    await delay(500);
    return capture;
}

async function stopGameplayVideo() {
    const capture = activeVideoCapture;
    if (!capture) return null;
    activeVideoCapture = null;
    await delay(350);
    capture.active = false;
    await capture.session.call('Page.stopScreencast').catch(() => {});
    if (capture.frameCount < 20) {
        throw new Error(`Gameplay video captured too few frames: ${capture.frameCount}`);
    }
    fs.mkdirSync(path.dirname(SMOKE_VIDEO_PATH), { recursive: true });
    const ffmpeg = spawnSync('ffmpeg', [
        '-hide_banner',
        '-loglevel', 'error',
        '-y',
        '-framerate', String(SMOKE_VIDEO_FPS),
        '-i', path.join(capture.framesDir, 'frame-%06d.jpg'),
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '20',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-an',
        SMOKE_VIDEO_PATH
    ], { encoding: 'utf8' });
    fs.rmSync(capture.framesDir, { recursive: true, force: true });
    if (ffmpeg.status !== 0) {
        throw new Error(`ffmpeg could not create gameplay video: ${ffmpeg.stderr || ffmpeg.stdout}`);
    }
    const result = {
        path: SMOKE_VIDEO_PATH,
        frames: capture.frameCount,
        fps: SMOKE_VIDEO_FPS,
        encodedDurationSeconds: Number((capture.frameCount / SMOKE_VIDEO_FPS).toFixed(2)),
        journeyDurationSeconds: Number(((Date.now() - capture.startedAt) / 1000).toFixed(2))
    };
    process.stdout.write(`[gameplay-video] ${JSON.stringify(result)}\n`);
    return result;
}

async function dispatchDomTouch(session, type, x, y, identifier = 23) {
    return evaluate(session, `(() => {
        const canvas = window.mythicalGame?.canvas || document.querySelector('canvas');
        if (!canvas) throw new Error('Game canvas unavailable for touch event');
        const point = new Touch({
            identifier: ${identifier},
            target: canvas,
            clientX: ${Math.round(x)},
            clientY: ${Math.round(y)},
            pageX: ${Math.round(x)},
            pageY: ${Math.round(y)},
            screenX: ${Math.round(x)},
            screenY: ${Math.round(y)},
            radiusX: 4,
            radiusY: 4,
            force: 1
        });
        const ended = ${JSON.stringify(type)} === 'touchend';
        const event = new TouchEvent(${JSON.stringify(type)}, {
            bubbles: true,
            cancelable: true,
            composed: true,
            touches: ended ? [] : [point],
            targetTouches: ended ? [] : [point],
            changedTouches: [point]
        });
        return canvas.dispatchEvent(event);
    })()`);
}

async function smokeForestBatchedCoinPickup(session) {
    const staged = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
        const pickup = scene.coinSprites?.find(
            item => item?.batched && !item.collected && item.x > 4000
        );
        if (!pickup || !scene.player?.body) return null;

        scene.isInvincible = true;
        (scene.enemies?.getChildren?.() || []).forEach(enemy => {
            if (enemy?.body) enemy.body.enable = false;
        });
        const balanceBefore = window.EconomyManager?.getBalance?.() || 0;
        const activeBefore = scene.coinSprites.filter(
            item => item?.batched && !item.collected
        ).length;
        scene.player.body.reset(pickup.x, pickup.y);
        scene.player.setVelocity(0, 0);
        return {
            x: pickup.x,
            y: pickup.y,
            type: pickup.type,
            expectedAward: pickup.type === 'bonus' ? 15 : 10,
            balanceBefore,
            activeBefore
        };
    })()`);
    if (!staged) {
        throw new Error('Forest batched coin pickup could not be staged');
    }

    try {
        const collected = await waitFor(
            () => evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
                const pickup = scene.coinSprites?.find(
                    item => item?.batched && item.x === ${staged.x} && item.y === ${staged.y}
                );
                if (!pickup?.collected) return null;
                return {
                    collected: true,
                    pickupBodyActive: pickup.pickupZone?.body?.enable === true,
                    balanceAfter: window.EconomyManager?.getBalance?.() || 0,
                    activeAfter: scene.coinSprites.filter(
                        item => item?.batched && !item.collected
                    ).length,
                    layerCount: scene.children?.list?.filter(
                        item => item === scene.forestCoinLayer
                    ).length || 0
                };
            })()`),
            { timeoutMs: 1800, message: 'Forest grouped coin overlap' }
        );
        if (
            collected.pickupBodyActive ||
            collected.balanceAfter - staged.balanceBefore !== staged.expectedAward ||
            collected.activeAfter !== staged.activeBefore - 1 ||
            collected.layerCount !== 1
        ) {
            throw new Error(
                `Forest grouped coin did not resolve exactly once: ${JSON.stringify({
                    staged,
                    collected
                })}`
            );
        }
        return { staged, collected };
    } finally {
        await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
            (scene.enemies?.getChildren?.() || []).forEach(enemy => {
                if (enemy?.body && enemy.active !== false) enemy.body.enable = true;
            });
            scene.isInvincible = false;
            scene.player?.body?.reset?.(300, scene.levelHeight - 130);
            scene.player?.setVelocity?.(0, 0);
            scene.updateForestEnemyActivation(true);
            return true;
        })()`);
    }
}

async function smokeForestSharedEnemyScheduler(session) {
    const staged = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
        const chaser = scene.voidSprites?.find(enemy => enemy?.active && enemy?.body);
        const crawler = scene.branchCrawlers?.find(enemy => enemy?.active && enemy?.body);
        if (!scene.player?.body || !chaser || !crawler) return null;
        if (
            !Number.isFinite(chaser.forestPatrolLeft) ||
            !Number.isFinite(chaser.forestPatrolRight)
        ) return null;

        scene.isInvincible = true;
        const playerStart = { x: scene.player.x, y: scene.player.y };
        const chaserStart = { x: chaser.x, y: chaser.y };
        const crawlerStart = { x: crawler.x, y: crawler.y };
        chaser.body.reset(chaser.forestPatrolLeft, chaserStart.y);
        crawler.body.reset(
            (crawler.patrolLeft + crawler.patrolRight) / 2,
            crawlerStart.y
        );
        scene.player.body.reset(
            chaser.forestPatrolRight,
            scene.levelHeight - 130
        );
        scene.updateForestEnemyActivation(true);
        scene.forestProximityEnemies.forEach(enemy => {
            enemy.forestNextAiAt = scene.time.now + 5000;
        });
        chaser.forestNextAiAt = scene.time.now;
        crawler.forestNextAiAt = scene.time.now;
        chaser.setVelocity(0, 0);
        crawler.setVelocity(0, 0);
        scene.player.setVelocity(0, 0);
        return {
            playerStart,
            chaserStart,
            crawlerStart,
            chaserX: chaser.x,
            crawlerX: crawler.x
        };
    })()`);
    if (!staged) {
        throw new Error('Forest shared enemy scheduler could not be staged');
    }

    try {
        const advanced = await waitFor(async () => {
            const state = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
                const chaser = scene.voidSprites?.find(enemy => enemy?.active && enemy?.body);
                const crawler = scene.branchCrawlers?.find(enemy => enemy?.active && enemy?.body);
                return {
                    schedulerActive: Boolean(
                        scene.forestEnemyAISchedulerActive
                    ),
                    chaserIsChasing: chaser?.isChasing === true,
                    chaserVelocityX: chaser?.body?.velocity?.x || 0,
                    chaserNextDelay: (chaser?.forestNextAiAt || 0) - scene.time.now,
                    crawlerVelocityX: crawler?.body?.velocity?.x || 0,
                    crawlerNextDelay: (crawler?.forestNextAiAt || 0) - scene.time.now,
                    crawlerDeltaX: (crawler?.x || 0) - ${staged.crawlerX},
                    individualTimerCount: (
                        scene.enemies?.getChildren?.() || []
                    ).reduce(
                        (total, enemy) => total + (enemy?.runtimeTimers?.size || 0),
                        0
                    )
                };
            })()`);
            return (
                state.schedulerActive === true &&
                state.chaserIsChasing === true &&
                state.chaserNextDelay > 0 &&
                state.crawlerNextDelay > 0 &&
                (
                    Math.abs(state.crawlerDeltaX) >= 1 ||
                    Math.abs(state.crawlerVelocityX) >= 1
                ) &&
                state.individualTimerCount === 0
            ) ? state : null;
        }, {
            timeoutMs: 1200,
            message: 'Forest shared enemy scheduler advance'
        });
        if (
            advanced.schedulerActive !== true ||
            advanced.chaserIsChasing !== true ||
            advanced.chaserNextDelay <= 0 ||
            advanced.crawlerNextDelay <= 0 ||
            (
                Math.abs(advanced.crawlerDeltaX) < 1 &&
                Math.abs(advanced.crawlerVelocityX) < 1
            ) ||
            advanced.individualTimerCount !== 0
        ) {
            throw new Error(
                `Forest shared enemy scheduler did not advance patrol AI: ${JSON.stringify({
                    staged,
                    advanced
                })}`
            );
        }
        return { staged, advanced };
    } finally {
        await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
            const chaser = scene.voidSprites?.find(enemy => enemy?.active && enemy?.body);
            const crawler = scene.branchCrawlers?.find(enemy => enemy?.active && enemy?.body);
            scene.isInvincible = false;
            chaser?.body?.reset?.(
                ${staged.chaserStart.x},
                ${staged.chaserStart.y}
            );
            chaser?.setVelocity?.(0, 0);
            crawler?.body?.reset?.(
                ${staged.crawlerStart.x},
                ${staged.crawlerStart.y}
            );
            crawler?.setVelocity?.(0, 0);
            scene.player?.body?.reset?.(
                ${staged.playerStart.x},
                ${staged.playerStart.y}
            );
            scene.player?.setVelocity?.(0, 0);
            scene.updateForestEnemyActivation(true);
            return true;
        })()`);
    }
}

async function smokeForestEnemyActivationWindow(session) {
    const staged = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
        const target = [...(scene.voidSprites || [])]
            .filter(enemy => enemy?.active && enemy?.body)
            .sort((left, right) => right.x - left.x)[0];
        if (!scene.player?.body || !target?.forestSupportId) return null;

        const camera = scene.cameras.main;
        const playerStart = {
            x: scene.player.x,
            y: scene.player.y,
            invincible: scene.isInvincible === true
        };
        const cameraStart = { x: camera.scrollX, y: camera.scrollY };
        const targetStart = {
            x: target.x,
            y: target.y,
            nextAiAt: target.forestNextAiAt,
            isChasing: target.isChasing === true
        };

        scene.isInvincible = true;
        scene.player.body.reset(300, scene.levelHeight - 130);
        scene.player.setVelocity(0, 0);
        camera.centerOn(scene.player.x, scene.player.y);
        camera.preRender?.();
        scene.updateForestEnemyActivation(true);

        return {
            targetSupportId: target.forestSupportId,
            totalEnemyCount: (scene.enemies?.getChildren?.() || []).filter(
                enemy => enemy?.active
            ).length,
            playerStart,
            cameraStart,
            targetStart,
            far: {
                proximityActive: target.forestProximityActive === true,
                bodyEnabled: target.body.enable === true,
                visible: target.visible === true,
                nearby: scene.forestProximityEnemies.includes(target),
                activeCount: scene.forestProximityEnemies.length
            }
        };
    })()`);
    if (!staged) {
        throw new Error('Forest enemy activation window could not be staged');
    }

    try {
        const awakened = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
            const target = (scene.voidSprites || []).find(
                enemy => enemy?.forestSupportId === ${JSON.stringify(staged.targetSupportId)}
            );
            if (!target?.body || !scene.player?.body) return null;

            scene.player.body.reset(target.x - 180, target.y);
            scene.player.setVelocity(0, 0);
            scene.cameras.main.centerOn(scene.player.x, scene.player.y);
            scene.cameras.main.preRender?.();
            scene.updateForestEnemyActivation(true);
            scene.forestProximityEnemies.forEach(enemy => {
                enemy.forestNextAiAt = scene.time.now + 5000;
            });
            target.forestNextAiAt = scene.time.now;
            scene.updateForestEnemyAI();

            return {
                proximityActive: target.forestProximityActive === true,
                bodyEnabled: target.body.enable === true,
                visible: target.visible === true,
                nearby: scene.forestProximityEnemies.includes(target),
                isChasing: target.isChasing === true,
                velocityX: Number(target.body.velocity?.x) || 0,
                activeCount: scene.forestProximityEnemies.length
            };
        })()`);
        if (
            staged.totalEnemyCount !== 23 ||
            staged.far.proximityActive !== false ||
            staged.far.bodyEnabled !== false ||
            staged.far.visible !== false ||
            staged.far.nearby !== false ||
            awakened?.proximityActive !== true ||
            awakened?.bodyEnabled !== true ||
            awakened?.visible !== true ||
            awakened?.nearby !== true ||
            awakened?.isChasing !== true ||
            Math.abs(awakened?.velocityX || 0) < 1
        ) {
            throw new Error(
                `Forest enemy activation did not wake before contact: ${JSON.stringify({
                    staged,
                    awakened
                })}`
            );
        }

        const slept = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
            const target = (scene.voidSprites || []).find(
                enemy => enemy?.forestSupportId === ${JSON.stringify(staged.targetSupportId)}
            );
            if (!target?.body || !scene.player?.body) return null;

            target.body.reset(${staged.targetStart.x}, ${staged.targetStart.y});
            target.setVelocity(0, 0);
            scene.player.body.reset(300, scene.levelHeight - 130);
            scene.player.setVelocity(0, 0);
            scene.cameras.main.centerOn(scene.player.x, scene.player.y);
            scene.cameras.main.preRender?.();
            scene.updateForestEnemyActivation(true);
            return {
                proximityActive: target.forestProximityActive === true,
                bodyEnabled: target.body.enable === true,
                visible: target.visible === true,
                nearby: scene.forestProximityEnemies.includes(target),
                activeCount: scene.forestProximityEnemies.length
            };
        })()`);
        if (
            slept?.proximityActive !== false ||
            slept?.bodyEnabled !== false ||
            slept?.visible !== false ||
            slept?.nearby !== false
        ) {
            throw new Error(
                `Forest enemy activation did not suspend after departure: ${JSON.stringify({
                    staged,
                    awakened,
                    slept
                })}`
            );
        }
        return { staged, awakened, slept };
    } finally {
        await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
            const target = (scene.voidSprites || []).find(
                enemy => enemy?.forestSupportId === ${JSON.stringify(staged.targetSupportId)}
            );
            target?.body?.reset?.(${staged.targetStart.x}, ${staged.targetStart.y});
            target?.setVelocity?.(0, 0);
            if (target) {
                target.forestNextAiAt = ${Number(staged.targetStart.nextAiAt) || 0};
                target.isChasing = ${staged.targetStart.isChasing === true};
            }
            scene.player?.body?.reset?.(
                ${staged.playerStart.x},
                ${staged.playerStart.y}
            );
            scene.player?.setVelocity?.(0, 0);
            scene.cameras.main.setScroll(
                ${staged.cameraStart.x},
                ${staged.cameraStart.y}
            );
            scene.cameras.main.preRender?.();
            scene.isInvincible = ${staged.playerStart.invincible === true};
            scene.updateForestEnemyActivation(true);
            return true;
        })()`);
    }
}

async function smokeCaveBatchedCoinPickup(session) {
    const staged = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('CrystalCavesLevel');
        const pickup = scene.caveCoinPickups?.find(
            item => item?.batched && !item.collected && item.x >= 4000
        );
        if (!pickup || !scene.player?.body) return null;

        scene.isInvincible = true;
        (scene.enemies?.getChildren?.() || []).forEach(enemy => {
            if (enemy?.body) enemy.body.enable = false;
        });
        const balanceBefore = Number(
            window.GameState?.get?.('player.cosmicCoins')
        ) || 0;
        const activeBefore = scene.caveCoinPickups.filter(
            item => item?.batched && !item.collected
        ).length;
        scene.player.body.reset(pickup.x, pickup.y);
        scene.player.setVelocity(0, 0);
        return {
            x: pickup.x,
            y: pickup.y,
            expectedAward: pickup.value,
            balanceBefore,
            activeBefore
        };
    })()`);
    if (!staged) {
        throw new Error('Crystal Caves batched coin pickup could not be staged');
    }

    try {
        const collected = await waitFor(
            () => evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene('CrystalCavesLevel');
                const pickup = scene.caveCoinPickups?.find(
                    item => item?.batched && item.x === ${staged.x} && item.y === ${staged.y}
                );
                if (!pickup?.collected) return null;
                return {
                    collected: true,
                    balanceAfter: Number(
                        window.GameState?.get?.('player.cosmicCoins')
                    ) || 0,
                    activeAfter: scene.caveCoinPickups.filter(
                        item => item?.batched && !item.collected
                    ).length,
                    layerCount: scene.children?.list?.filter(
                        item => item === scene.caveCoinLayer
                    ).length || 0
                };
            })()`),
            { timeoutMs: 1800, message: 'Crystal Caves batched coin overlap' }
        );
        if (
            collected.balanceAfter - staged.balanceBefore !== staged.expectedAward ||
            collected.activeAfter !== staged.activeBefore - 1 ||
            collected.layerCount !== 1
        ) {
            throw new Error(
                `Crystal Caves batched coin did not resolve exactly once: ${JSON.stringify({
                    staged,
                    collected
                })}`
            );
        }
        return { staged, collected };
    } finally {
        await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('CrystalCavesLevel');
            (scene.enemies?.getChildren?.() || []).forEach(enemy => {
                if (enemy?.body && enemy.active !== false) enemy.body.enable = true;
            });
            scene.isInvincible = false;
            scene.player?.body?.reset?.(200, scene.levelHeight - 130);
            scene.player?.setVelocity?.(0, 0);
            return true;
        })()`);
    }
}

async function smokeReefTrailBudget(session) {
    const result = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('ReefLevel');
        if (!scene?.player?.active) return null;

        const displayBefore = scene.children?.list?.length || 0;
        const tweensBefore = scene.tweens?.getTweens?.().length || 0;
        let acceptedCount = 0;
        for (let index = 0; index < 30; index += 1) {
            scene.reefTrailNextAt = 0;
            if (scene.createPlayerCosmicTrail()) acceptedCount += 1;
        }
        scene.updatePlayerCosmicTrail(16);
        const peak = {
            acceptedCount,
            particleCount: scene.reefTrailParticles?.length || 0,
            layerCount: scene.children?.list?.filter(
                item => item === scene.reefTrailLayer
            ).length || 0,
            displayDelta: (scene.children?.list?.length || 0) - displayBefore,
            tweenDelta: (scene.tweens?.getTweens?.().length || 0) - tweensBefore,
            trailTweenCount: (scene.tweens?.getTweens?.() || []).filter(
                tween => (tween?.targets || []).includes(scene.reefTrailLayer)
            ).length
        };
        for (let index = 0; index < 24; index += 1) {
            scene.updatePlayerCosmicTrail(50);
        }
        return {
            peak,
            settledParticleCount: scene.reefTrailParticles?.length || 0,
            settledLayerCount: scene.children?.list?.filter(
                item => item === scene.reefTrailLayer
            ).length || 0
        };
    })()`);
    if (!result) throw new Error('Reef trail budget could not be staged');
    if (
        result.peak.acceptedCount !== 8 ||
        result.peak.particleCount !== 8 ||
        result.peak.layerCount !== 1 ||
        result.peak.displayDelta !== 1 ||
        result.peak.tweenDelta !== 0 ||
        result.peak.trailTweenCount !== 0 ||
        result.settledParticleCount !== 0 ||
        result.settledLayerCount !== 1
    ) {
        throw new Error(
            `Reef swimming trail exceeded its bounded layer budget: ${JSON.stringify(result)}`
        );
    }
    return result;
}

async function smokeAuroraEnemyActivationWindow(session) {
    const staged = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('AuroraDepthsLevel');
        const target = [...(scene.enemies?.getChildren?.() || [])]
            .filter(enemy => enemy?.active && enemy?.body)
            .sort((left, right) => right.x - left.x)[0];
        if (!scene.player?.body || !target) return null;

        const playerStart = { x: scene.player.x, y: scene.player.y };
        const cameraStart = {
            scrollX: scene.cameras.main.scrollX,
            scrollY: scene.cameras.main.scrollY
        };
        const targetStart = { x: target.x, y: target.y };
        scene.isInvincible = true;
        scene.player.body.reset(300, scene.levelHeight - 130);
        scene.player.setVelocity(0, 0);
        scene.cameras.main.centerOn(scene.player.x, scene.player.y);
        scene.cameras.main.preRender?.();
        scene.updateAuroraEnemyActivation(true);
        return {
            playerStart,
            cameraStart,
            targetStart,
            enemyType: target.enemyType,
            encounterBeat: target.encounterBeat,
            far: {
                proximityActive: target.auroraProximityActive === true,
                bodyEnabled: target.body.enable === true,
                renderAttached: target.displayList === scene.children,
                cueAttached: target.combatCue?.displayList === scene.children,
                runtimeIncludes: scene.getRuntimePatrolEnemies().includes(target)
            }
        };
    })()`);
    if (!staged) throw new Error('Aurora enemy activation window could not be staged');

    try {
        const awakened = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('AuroraDepthsLevel');
            const target = (scene.enemies?.getChildren?.() || []).find(
                enemy => enemy?.encounterBeat === ${JSON.stringify(staged.encounterBeat)}
            );
            if (!target?.body || !scene.player?.body) return null;
            scene.player.body.reset(target.x - 180, target.y);
            scene.player.setVelocity(0, 0);
            scene.cameras.main.centerOn(scene.player.x, scene.player.y);
            scene.cameras.main.preRender?.();
            scene.updateAuroraEnemyActivation(true);
            scene.auroraEnemyPatrolNextAt = 0;
            scene.updatePatrolEnemyMovement();
            return {
                proximityActive: target.auroraProximityActive === true,
                bodyEnabled: target.body.enable === true,
                renderAttached: target.displayList === scene.children,
                cueAttached: target.combatCue?.displayList === scene.children,
                runtimeIncludes: scene.getRuntimePatrolEnemies().includes(target),
                velocityX: Number(target.body.velocity?.x) || 0
            };
        })()`);
        if (
            staged.far.proximityActive !== false ||
            staged.far.bodyEnabled !== false ||
            staged.far.renderAttached !== false ||
            staged.far.cueAttached !== false ||
            staged.far.runtimeIncludes !== false ||
            awakened?.proximityActive !== true ||
            awakened?.bodyEnabled !== true ||
            awakened?.renderAttached !== true ||
            awakened?.cueAttached !== true ||
            awakened?.runtimeIncludes !== true ||
            Math.abs(awakened?.velocityX || 0) < 1
        ) {
            throw new Error(
                `Aurora enemy activation did not wake before contact: ${JSON.stringify({
                    staged,
                    awakened
                })}`
            );
        }

        const slept = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('AuroraDepthsLevel');
            const target = (scene.enemies?.getChildren?.() || []).find(
                enemy => enemy?.encounterBeat === ${JSON.stringify(staged.encounterBeat)}
            );
            if (!target?.body || !scene.player?.body) return null;
            target.body.reset(${staged.targetStart.x}, ${staged.targetStart.y});
            target.setVelocity(0, 0);
            scene.player.body.reset(300, scene.levelHeight - 130);
            scene.player.setVelocity(0, 0);
            scene.cameras.main.centerOn(scene.player.x, scene.player.y);
            scene.cameras.main.preRender?.();
            scene.updateAuroraEnemyActivation(true);
            return {
                proximityActive: target.auroraProximityActive === true,
                bodyEnabled: target.body.enable === true,
                renderAttached: target.displayList === scene.children,
                cueAttached: target.combatCue?.displayList === scene.children,
                runtimeIncludes: scene.getRuntimePatrolEnemies().includes(target)
            };
        })()`);
        if (
            slept?.proximityActive !== false ||
            slept?.bodyEnabled !== false ||
            slept?.renderAttached !== false ||
            slept?.cueAttached !== false ||
            slept?.runtimeIncludes !== false
        ) {
            throw new Error(
                `Aurora enemy activation did not suspend after departure: ${JSON.stringify({
                    staged,
                    awakened,
                    slept
                })}`
            );
        }
        return { staged, awakened, slept };
    } finally {
        await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('AuroraDepthsLevel');
            scene.isInvincible = false;
            scene.player?.body?.reset?.(
                ${staged.playerStart.x},
                ${staged.playerStart.y}
            );
            scene.player?.setVelocity?.(0, 0);
            scene.cameras.main.setScroll(
                ${staged.cameraStart.scrollX},
                ${staged.cameraStart.scrollY}
            );
            scene.cameras.main.preRender?.();
            scene.updateAuroraEnemyActivation(true);
            return true;
        })()`);
        await delay(120);
    }
}

async function smokePeakEnemyActivationWindow(session) {
    const staged = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('VoidPeaksLevel');
        const target = [...(scene.enemies?.getChildren?.() || [])]
            .filter(enemy => enemy?.active && enemy?.body)
            .sort((left, right) => right.x - left.x)[0];
        if (!scene.player?.body || !target) return null;

        const playerStart = { x: scene.player.x, y: scene.player.y };
        const cameraStart = {
            scrollX: scene.cameras.main.scrollX,
            scrollY: scene.cameras.main.scrollY
        };
        const targetStart = { x: target.x, y: target.y };
        scene.isInvincible = true;
        scene.player.body.reset(300, scene.levelHeight - 130);
        scene.player.setVelocity(0, 0);
        scene.cameras.main.centerOn(scene.player.x, scene.player.y);
        scene.cameras.main.preRender?.();
        scene.updatePeakEnemyActivation(true);
        return {
            playerStart,
            cameraStart,
            targetStart,
            encounterBeat: target.encounterBeat,
            far: {
                proximityActive: target.peakProximityActive === true,
                bodyEnabled: target.body.enable === true,
                renderAttached: target.displayList === scene.children,
                cueAttached: target.combatCue?.displayList === scene.children,
                runtimeIncludes: scene.getRuntimePatrolEnemies().includes(target)
            }
        };
    })()`);
    if (!staged) throw new Error('Peaks enemy activation window could not be staged');

    try {
        const awakened = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('VoidPeaksLevel');
            const target = (scene.enemies?.getChildren?.() || []).find(
                enemy => enemy?.encounterBeat === ${JSON.stringify(staged.encounterBeat)}
            );
            if (!target?.body || !scene.player?.body) return null;
            scene.player.body.reset(target.x - 180, target.y);
            scene.player.setVelocity(0, 0);
            scene.cameras.main.centerOn(scene.player.x, scene.player.y);
            scene.cameras.main.preRender?.();
            scene.updatePeakEnemyActivation(true);
            scene.peakEnemyPatrolNextAt = 0;
            scene.updatePatrolEnemyMovement();
            return {
                proximityActive: target.peakProximityActive === true,
                bodyEnabled: target.body.enable === true,
                renderAttached: target.displayList === scene.children,
                cueAttached: target.combatCue?.displayList === scene.children,
                runtimeIncludes: scene.getRuntimePatrolEnemies().includes(target),
                velocityX: Number(target.body.velocity?.x) || 0
            };
        })()`);
        if (
            staged.far.proximityActive !== false ||
            staged.far.bodyEnabled !== false ||
            staged.far.renderAttached !== false ||
            staged.far.cueAttached !== false ||
            staged.far.runtimeIncludes !== false ||
            awakened?.proximityActive !== true ||
            awakened?.bodyEnabled !== true ||
            awakened?.renderAttached !== true ||
            awakened?.cueAttached !== true ||
            awakened?.runtimeIncludes !== true ||
            Math.abs(awakened?.velocityX || 0) < 1
        ) {
            throw new Error(
                `Peaks enemy activation did not wake before contact: ${JSON.stringify({
                    staged,
                    awakened
                })}`
            );
        }

        const slept = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('VoidPeaksLevel');
            const target = (scene.enemies?.getChildren?.() || []).find(
                enemy => enemy?.encounterBeat === ${JSON.stringify(staged.encounterBeat)}
            );
            if (!target?.body || !scene.player?.body) return null;
            target.body.reset(${staged.targetStart.x}, ${staged.targetStart.y});
            target.setVelocity(0, 0);
            scene.player.body.reset(300, scene.levelHeight - 130);
            scene.player.setVelocity(0, 0);
            scene.cameras.main.centerOn(scene.player.x, scene.player.y);
            scene.cameras.main.preRender?.();
            scene.updatePeakEnemyActivation(true);
            return {
                proximityActive: target.peakProximityActive === true,
                bodyEnabled: target.body.enable === true,
                renderAttached: target.displayList === scene.children,
                cueAttached: target.combatCue?.displayList === scene.children,
                runtimeIncludes: scene.getRuntimePatrolEnemies().includes(target)
            };
        })()`);
        if (
            slept?.proximityActive !== false ||
            slept?.bodyEnabled !== false ||
            slept?.renderAttached !== false ||
            slept?.cueAttached !== false ||
            slept?.runtimeIncludes !== false
        ) {
            throw new Error(
                `Peaks enemy activation did not suspend after departure: ${JSON.stringify({
                    staged,
                    awakened,
                    slept
                })}`
            );
        }
        return { staged, awakened, slept };
    } finally {
        await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('VoidPeaksLevel');
            scene.isInvincible = false;
            scene.player?.body?.reset?.(
                ${staged.playerStart.x},
                ${staged.playerStart.y}
            );
            scene.player?.setVelocity?.(0, 0);
            scene.cameras.main.setScroll(
                ${staged.cameraStart.scrollX},
                ${staged.cameraStart.scrollY}
            );
            scene.cameras.main.preRender?.();
            scene.updatePeakEnemyActivation(true);
            return true;
        })()`);
        await delay(120);
    }
}

async function navigate(session, url) {
    // A document navigation ends every browser touch stream. Reusing the
    // previous document's synthetic identifier can make Chromium discard the
    // first tap on the next page even though touchEnd was dispatched.
    activeTouchIdentifier = null;
    activeTouchPoint = { x: 0, y: 0 };
    nextTouchIdentifier = 1;
    await evaluate(session, `(() => {
        const game = window.mythicalGame;
        if (!game?.destroy) return false;
        game.destroy(true);
        window.mythicalGame = null;
        return true;
    })()`).catch(() => false);
    await session.call('HeapProfiler.enable').catch(() => null);
    await session.call('HeapProfiler.collectGarbage').catch(() => null);
    await session.call('Page.navigate', { url });
    await waitFor(
        () => evaluate(session, 'document.readyState === "complete"'),
        { message: `page load ${url}` }
    );
    await waitFor(
        () => evaluate(session, 'Boolean(window.mythicalGame?.scene)'),
        { timeoutMs: 15000, message: 'Phaser game boot' }
    );
}

async function waitForScene(session, sceneName, timeoutMs = 15000) {
    return waitFor(
        () => evaluate(
            session,
            `Boolean(window.mythicalGame?.scene?.isActive?.(${JSON.stringify(sceneName)}))`
        ),
        { timeoutMs, message: `${sceneName} active` }
    );
}

async function tap(session, x, y) {
    await session.call('Page.bringToFront');
    await session.call('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x,
        y,
        button: 'none'
    });
    await session.call('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x,
        y,
        button: 'left',
        clickCount: 1
    });
    await delay(80);
    await session.call('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x,
        y,
        button: 'left',
        clickCount: 1
    });
}

async function touch(session, x, y) {
    await session.call('Page.bringToFront');
    const identifier = nextTouchIdentifier;
    nextTouchIdentifier += 1;
    await session.call('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{
            x,
            y,
            radiusX: 2,
            radiusY: 2,
            force: 1,
            id: identifier
        }]
    });
    await delay(80);
    await session.call('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: []
    });
}

async function touchSceneText(session, text, {
    match = 'exact',
    message = text
} = {}) {
    const point = await waitFor(
        () => evaluate(session, `(() => {
            const scene = window.mythicalGame?.scene?.getScenes(true)
                ?.find(candidate => candidate?.children?.list);
            const matches = (scene?.children?.list || []).filter(item => {
                if (typeof item?.text !== 'string' || item.visible === false) return false;
                return ${JSON.stringify(match)} === 'startsWith'
                    ? item.text.startsWith(${JSON.stringify(text)})
                    : item.text === ${JSON.stringify(text)};
            }).sort((left, right) => (right.depth || 0) - (left.depth || 0));
            const target = matches[0];
            if (!target?.getBounds) return null;
            const bounds = target.getBounds();
            return {
                x: Math.round(bounds.centerX),
                y: Math.round(bounds.centerY),
                text: target.text
            };
        })()`),
        { timeoutMs: 12000, message }
    );
    await touch(session, point.x, point.y);
    return point;
}

async function touchInteractiveSceneText(session, text, {
    match = 'exact',
    message = text,
    timeoutMs = 12000,
    input = 'touch'
} = {}) {
    const point = await waitFor(
        () => evaluate(session, `(() => {
            const scenes = window.mythicalGame?.scene?.getScenes(true) || [];
            const matches = scenes.flatMap(scene => (
                scene?.children?.list || []
            )).filter(item => {
                if (
                    typeof item?.text !== 'string' ||
                    item.visible === false ||
                    item.alpha <= 0
                ) return false;
                const textMatches = ${JSON.stringify(match)} === 'startsWith'
                    ? item.text.startsWith(${JSON.stringify(text)})
                    : item.text === ${JSON.stringify(text)};
                if (!textMatches || !item.getBounds) return false;
                if (item.input?.enabled === true) return true;
                const bounds = item.getBounds();
                const modal = item.scene?.shipEvidenceBoardModal;
                if (
                    modal?.isVisible === true &&
                    modal.pointerRegions?.some(region => (
                        bounds.centerX >= region.left &&
                        bounds.centerX <= region.right &&
                        bounds.centerY >= region.top &&
                        bounds.centerY <= region.bottom
                    ))
                ) return true;
                return (item.scene?.input?._list || []).some(candidate => {
                    if (
                        candidate === item ||
                        candidate?.input?.enabled !== true ||
                        candidate?.visible === false ||
                        !candidate?.getBounds
                    ) return false;
                    const candidateBounds = candidate.getBounds();
                    return candidateBounds.contains(
                        bounds.centerX,
                        bounds.centerY
                    );
                });
            }).sort((left, right) => (right.depth || 0) - (left.depth || 0));
            const target = matches[0];
            if (!target?.getBounds) return null;
            const bounds = target.getBounds();
            const width = target.scene?.scale?.width ||
                document.querySelector('canvas')?.clientWidth || 0;
            const height = target.scene?.scale?.height ||
                document.querySelector('canvas')?.clientHeight || 0;
            if (
                bounds.left < 0 ||
                bounds.top < 0 ||
                bounds.right > width ||
                bounds.bottom > height
            ) return null;
            return {
                x: Math.round(bounds.centerX),
                y: Math.round(bounds.centerY),
                text: target.text,
                depth: target.depth,
                bounds: {
                    left: Math.round(bounds.left),
                    right: Math.round(bounds.right),
                    top: Math.round(bounds.top),
                    bottom: Math.round(bounds.bottom)
                },
                viewport: { width, height }
            };
        })()`),
        { timeoutMs, message }
    );
    if (input === 'mouse') {
        await tap(session, point.x, point.y);
    } else {
        await touch(session, point.x, point.y);
    }
    return point;
}

async function touchDomButton(session, selector, {
    message = selector,
    timeoutMs = 12000
} = {}) {
    const point = await waitFor(
        () => evaluate(session, `(() => {
            const button = document.querySelector(${JSON.stringify(selector)});
            const bounds = button?.getBoundingClientRect?.();
            const style = button ? getComputedStyle(button) : null;
            if (
                !button ||
                !bounds ||
                button.disabled ||
                style?.display === 'none' ||
                style?.visibility === 'hidden' ||
                Number(style?.opacity || 1) <= 0 ||
                bounds.left < 0 ||
                bounds.top < 0 ||
                bounds.right > window.innerWidth ||
                bounds.bottom > window.innerHeight
            ) return null;
            return {
                x: Math.round(bounds.left + bounds.width / 2),
                y: Math.round(bounds.top + bounds.height / 2),
                text: button.textContent?.trim() || '',
                bounds: {
                    left: Math.round(bounds.left),
                    right: Math.round(bounds.right),
                    top: Math.round(bounds.top),
                    bottom: Math.round(bounds.bottom)
                },
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                }
            };
        })()`),
        { timeoutMs, message }
    );
    await touch(session, point.x, point.y);
    return point;
}

async function holdTouchDrag(session, start, end, holdMs = 450) {
    activeTouchIdentifier = nextTouchIdentifier;
    nextTouchIdentifier += 1;
    const touchPoint = (x, y) => ({
        x,
        y,
        radiusX: 4,
        radiusY: 4,
        force: 1,
        id: activeTouchIdentifier
    });

    trace('touchStart', {
        start,
        end,
        identifier: activeTouchIdentifier,
        protocol: SMOKE_TOUCH_PROTOCOL
    });
    activeTouchPoint = { x: Math.round(start.x), y: Math.round(start.y) };
    if (SMOKE_TOUCH_PROTOCOL === 'mouse') {
        await session.call('Input.dispatchMouseEvent', {
            type: 'mousePressed',
            x: activeTouchPoint.x,
            y: activeTouchPoint.y,
            button: 'left',
            clickCount: 1
        });
    } else if (SMOKE_TOUCH_PROTOCOL === 'dom-touch') {
        await dispatchDomTouch(
            session,
            'touchstart',
            start.x,
            start.y,
            activeTouchIdentifier
        );
    } else if (SMOKE_TOUCH_PROTOCOL === 'mouse-touch') {
        await session.call('Emulation.setEmitTouchEventsForMouse', {
            enabled: true,
            configuration: 'mobile'
        });
        await session.call('Input.dispatchMouseEvent', {
            type: 'mousePressed',
            x: activeTouchPoint.x,
            y: activeTouchPoint.y,
            button: 'left',
            clickCount: 1
        });
    } else if (SMOKE_TOUCH_PROTOCOL === 'emulate') {
        await session.call('Input.emulateTouchFromMouseEvent', {
            type: 'mousePressed',
            x: Math.round(start.x),
            y: Math.round(start.y),
            button: 'left',
            clickCount: 1
        });
    } else {
        await session.call('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [touchPoint(start.x, start.y)]
        });
    }

    const moveSteps = 4;
    for (let index = 1; index <= moveSteps; index++) {
        const progress = index / moveSteps;
        trace('touchMove', { index, x: start.x + (end.x - start.x) * progress, y: start.y + (end.y - start.y) * progress });
        const x = start.x + (end.x - start.x) * progress;
        const y = start.y + (end.y - start.y) * progress;
        activeTouchPoint = { x: Math.round(x), y: Math.round(y) };
        if (SMOKE_TOUCH_PROTOCOL === 'mouse') {
            await session.call('Input.dispatchMouseEvent', {
                type: 'mouseMoved',
                x: activeTouchPoint.x,
                y: activeTouchPoint.y,
                button: 'left'
            });
        } else if (SMOKE_TOUCH_PROTOCOL === 'dom-touch') {
            await dispatchDomTouch(
                session,
                'touchmove',
                x,
                y,
                activeTouchIdentifier
            );
        } else if (SMOKE_TOUCH_PROTOCOL === 'mouse-touch') {
            await session.call('Input.dispatchMouseEvent', {
                type: 'mouseMoved',
                x: activeTouchPoint.x,
                y: activeTouchPoint.y,
                button: 'left'
            });
        } else if (SMOKE_TOUCH_PROTOCOL === 'emulate') {
            await session.call('Input.emulateTouchFromMouseEvent', {
                type: 'mouseMoved',
                x: Math.round(x),
                y: Math.round(y),
                button: 'left'
            });
        } else {
            await session.call('Input.dispatchTouchEvent', {
                type: 'touchMove',
                touchPoints: [touchPoint(x, y)]
            });
        }
        await delay(50);
    }
    await delay(holdMs);
}

async function releaseTouch(session) {
    const releasedTouchIdentifier = activeTouchIdentifier;
    if (SMOKE_TOUCH_PROTOCOL === 'mouse') {
        await session.call('Input.dispatchMouseEvent', {
            type: 'mouseReleased',
            x: activeTouchPoint.x,
            y: activeTouchPoint.y,
            button: 'left',
            clickCount: 1
        });
    } else if (SMOKE_TOUCH_PROTOCOL === 'dom-touch') {
        await dispatchDomTouch(
            session,
            'touchend',
            activeTouchPoint.x,
            activeTouchPoint.y,
            releasedTouchIdentifier
        );
    } else if (SMOKE_TOUCH_PROTOCOL === 'mouse-touch') {
        await session.call('Input.dispatchMouseEvent', {
            type: 'mouseReleased',
            x: activeTouchPoint.x,
            y: activeTouchPoint.y,
            button: 'left',
            clickCount: 1
        });
        await session.call('Emulation.setEmitTouchEventsForMouse', {
            enabled: false,
            configuration: 'mobile'
        });
    } else if (SMOKE_TOUCH_PROTOCOL === 'emulate') {
        await session.call('Input.emulateTouchFromMouseEvent', {
            type: 'mouseReleased',
            x: activeTouchPoint.x,
            y: activeTouchPoint.y,
            button: 'left',
            clickCount: 1
        });
    } else {
        await session.call('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: []
        });
    }
    trace('touchEnd', { identifier: releasedTouchIdentifier });
    activeTouchIdentifier = null;
}

async function pressEnter(session) {
    await session.call('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'Enter',
        code: 'Enter',
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13
    });
    await session.call('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'Enter',
        code: 'Enter',
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13
    });
}

async function setKeyboardKey(session, type, {
    key,
    code,
    keyCode
}) {
    await session.call('Input.dispatchKeyEvent', {
        type,
        key,
        code,
        windowsVirtualKeyCode: keyCode,
        nativeVirtualKeyCode: keyCode
    });
}

async function smokeVoidPeaksReturnCurrents(session) {
    const routes = [
        {
            id: 'peak-return-lower',
            start: { x: 2310, y: 740 },
            destinationId: 'peak-warning-lower'
        },
        {
            id: 'peak-return-summit',
            start: { x: 3200, y: 740 },
            destinationId: 'peak-warning-summit'
        }
    ];
    const results = [];

    await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('VoidPeaksLevel');
        (scene.collectibles?.getChildren?.() || []).forEach(item => {
            if (item?.body) item.body.enable = false;
        });
        return true;
    })()`);

    try {
        for (const route of routes) {
            await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene('VoidPeaksLevel');
                scene.isInvincible = true;
                scene.releaseAllPlatformerActionButtons?.();
                scene.resetJoystick?.();
                const current = scene.peakReturnCurrents.find(
                    item => item.id === ${JSON.stringify(route.id)}
                );
                if (current) {
                    current.activations = 0;
                    current.lastLiftAt = Number.NEGATIVE_INFINITY;
                }
                scene.player.body.reset(${route.start.x}, ${route.start.y});
                scene.player.setVelocity(0, 0);
                return true;
            })()`),
            await waitFor(
                () => evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene('VoidPeaksLevel');
                    return Boolean(scene.player?.body?.blocked?.down || scene.isGrounded);
                })()`),
                { timeoutMs: 2500, message: `${route.id} recovery start` }
            );

            await setKeyboardKey(session, 'keyDown', {
                key: 'd',
                code: 'KeyD',
                keyCode: 68
            });
            let activated;
            try {
                activated = await waitFor(
                    () => evaluate(session, `(() => {
                        const scene = window.mythicalGame.scene.getScene('VoidPeaksLevel');
                        const current = scene.peakReturnCurrents.find(
                            item => item.id === ${JSON.stringify(route.id)}
                        );
                        if (!current?.activations) return null;
                        return {
                            activations: current.activations,
                            playerX: Math.round(scene.player.x),
                            playerY: Math.round(scene.player.y),
                            velocityY: Math.round(scene.player.body.velocity.y)
                        };
                    })()`),
                    { timeoutMs: 5000, message: `${route.id} activation` }
                );
            } catch (error) {
                const diagnostics = await evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene('VoidPeaksLevel');
                    const current = scene.peakReturnCurrents.find(
                        item => item.id === ${JSON.stringify(route.id)}
                    );
                    return {
                        playerX: Math.round(scene.player.x),
                        playerY: Math.round(scene.player.y),
                        velocityX: Math.round(scene.player.body.velocity.x),
                        velocityY: Math.round(scene.player.body.velocity.y),
                        activeGuidance: scene.activePeakReturnCurrent,
                        current: current ? {
                            x: current.x,
                            top: current.top,
                            bottom: current.bottom,
                            width: current.width,
                            activations: current.activations
                        } : null
                    };
                })()`);
                throw new Error(`${error.message}: ${JSON.stringify(diagnostics)}`);
            }
            await setKeyboardKey(session, 'keyUp', {
                key: 'd',
                code: 'KeyD',
                keyCode: 68
            });
            let landed;
            try {
                landed = await waitFor(
                    () => evaluate(session, `(() => {
                        const scene = window.mythicalGame.scene.getScene('VoidPeaksLevel');
                        const support = scene.platforms.getChildren().find(
                            item => item.traversalId === ${JSON.stringify(route.destinationId)}
                        );
                        const body = scene.player?.body;
                        if (!support?.body || !body) return null;
                        const onSupport = body.right > support.body.left + 8 &&
                            body.left < support.body.right - 8 &&
                            Math.abs(body.bottom - support.body.top) <= 7 &&
                            (body.blocked.down || scene.isGrounded);
                        return onSupport ? {
                            supportId: support.traversalId,
                            playerX: Math.round(scene.player.x),
                            playerBottom: Math.round(body.bottom),
                            supportTop: Math.round(support.body.top)
                        } : null;
                    })()`),
                    { timeoutMs: 3200, message: `${route.id} warning-line landing` }
                );
            } catch (error) {
                const diagnostics = await evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene('VoidPeaksLevel');
                    const support = scene.platforms.getChildren().find(
                        item => item.traversalId === ${JSON.stringify(route.destinationId)}
                    );
                    const body = scene.player?.body;
                    return {
                        player: body ? {
                            x: Math.round(scene.player.x),
                            y: Math.round(scene.player.y),
                            bottom: Math.round(body.bottom),
                            velocityX: Math.round(body.velocity.x),
                            velocityY: Math.round(body.velocity.y),
                            blockedDown: body.blocked.down,
                            grounded: scene.isGrounded
                        } : null,
                        support: support?.body ? {
                            id: support.traversalId,
                            left: support.body.left,
                            right: support.body.right,
                            top: support.body.top
                        } : null,
                        guidance: scene.activePeakReturnCurrent
                    };
                })()`);
                throw new Error(`${error.message}: ${JSON.stringify(diagnostics)}`);
            }
            await delay(650);
            const settled = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene('VoidPeaksLevel');
                const current = scene.peakReturnCurrents.find(
                    item => item.id === ${JSON.stringify(route.id)}
                );
                const support = scene.platforms.getChildren().find(
                    item => item.traversalId === ${JSON.stringify(route.destinationId)}
                );
                const body = scene.player?.body;
                return body && support?.body && current ? {
                    activations: current.activations,
                    guidanceActive: scene.activePeakReturnCurrent?.id === current.id,
                    playerLeft: Math.round(body.left),
                    playerRight: Math.round(body.right),
                    playerBottom: Math.round(body.bottom),
                    supportLeft: Math.round(support.body.left),
                    supportRight: Math.round(support.body.right),
                    supportTop: Math.round(support.body.top),
                    supportBottom: Math.round(support.body.bottom),
                    velocityY: Math.round(body.velocity.y)
                } : null;
            })()`);
            if (
                !settled ||
                settled.activations !== activated.activations ||
                settled.guidanceActive ||
                settled.playerRight <= settled.supportLeft + 8 ||
                settled.playerLeft >= settled.supportRight - 8 ||
                settled.playerBottom < settled.supportTop - 36 ||
                settled.playerBottom > settled.supportBottom + 4 ||
                settled.velocityY < -140
            ) {
                throw new Error(
                    `${route.id} destabilized after landing: ${JSON.stringify(settled)}`
                );
            }
            results.push({ id: route.id, activated, landed, settled });
        }
    } finally {
        try {
            await setKeyboardKey(session, 'keyUp', {
                key: 'd',
                code: 'KeyD',
                keyCode: 68
            });
        } finally {
            await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene('VoidPeaksLevel');
                (scene.collectibles?.getChildren?.() || []).forEach(item => {
                    if (item?.body && item.active !== false) item.body.enable = true;
                });
                scene.isInvincible = false;
                scene.releaseAllPlatformerActionButtons?.();
                scene.resetJoystick?.();
                return true;
            })()`);
        }
    }

    await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('VoidPeaksLevel');
        scene.isInvincible = false;
        const route = scene.optionalRouteRewards?.get?.('peaks_relic_ridge');
        const choice = route?.choice;
        scene.peakRouteChoice = '';
        if (choice) {
            choice.selectedPath = null;
            choice.mainEntered = false;
            choice.optionalEntered = false;
            choice.rejoined = false;
            choice.sequence = null;
        }
        scene.routeChoiceSequence = 0;
        scene.player.body.reset(2200, scene.levelHeight - 110);
        scene.player.setVelocity(0, 0);
        return true;
    })()`);
    await delay(250);
    return results;
}

async function smokeCrystalCoreLift(session) {
    const setup = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('CrystalCavesLevel');
        const lift = scene?.crystalCoreLift;
        const destination = scene?.platforms?.getChildren?.().find(
            item => item.traversalId === 'caves-core-refuge'
        );
        if (!scene?.player?.body || !lift || !destination?.body) return null;

        scene.isInvincible = true;
        scene.releaseAllPlatformerActionButtons?.();
        scene.resetJoystick?.();
        (scene.enemies?.getChildren?.() || []).forEach(enemy => {
            if (enemy?.body) enemy.body.enable = false;
        });
        (scene.collectibles?.getChildren?.() || []).forEach(item => {
            if (item?.body) item.body.enable = false;
        });
        // The live route intentionally starts the guardian when this landing
        // overlaps the Core. Isolate the lift probe so later gate assertions
        // can exercise the locked and ready states independently.
        if (scene.crystalCore?.body) scene.crystalCore.body.enable = false;
        lift.activations = 0;
        lift.lastLiftAt = Number.NEGATIVE_INFINITY;
        scene.player.body.reset(lift.x, scene.levelHeight - 110);
        scene.player.setVelocity(0, 0);
        return {
            liftLabel: lift.label?.text || '',
            destinationId: lift.destinationId,
            startX: Math.round(scene.player.x),
            destinationTop: Math.round(destination.body.top)
        };
    })()`);
    if (
        setup?.destinationId !== 'caves-core-refuge' ||
        !setup.liftLabel.includes('CORE ASCENT')
    ) {
        throw new Error(`Crystal Core lift was not visibly ready: ${JSON.stringify(setup)}`);
    }

    try {
        const launched = await waitFor(
            () => evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene('CrystalCavesLevel');
                const lift = scene?.crystalCoreLift;
                if (!lift?.activations) return null;
                return {
                    activations: lift.activations,
                    playerX: Math.round(scene.player.x),
                    playerY: Math.round(scene.player.y),
                    velocityY: Math.round(scene.player.body.velocity.y)
                };
            })()`),
            { timeoutMs: 2500, message: 'Crystal Core lift launch' }
        );
        let landed;
        try {
            landed = await waitFor(
                () => evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene('CrystalCavesLevel');
                    const support = scene.platforms.getChildren().find(
                        item => item.traversalId === 'caves-core-refuge'
                    );
                    const body = scene.player?.body;
                    if (!support?.body || !body) return null;
                    const onSupport = body.right > support.body.left + 8 &&
                        body.left < support.body.right - 8 &&
                        Math.abs(body.bottom - support.body.top) <= 7 &&
                        (body.blocked.down || scene.isGrounded);
                    return onSupport ? {
                        supportId: support.traversalId,
                        playerX: Math.round(scene.player.x),
                        playerBottom: Math.round(body.bottom),
                        supportTop: Math.round(support.body.top)
                    } : null;
                })()`),
                { timeoutMs: 6500, message: 'Crystal Core refuge landing' }
            );
        } catch (error) {
            const diagnostics = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene('CrystalCavesLevel');
                const support = scene.platforms.getChildren().find(
                    item => item.traversalId === 'caves-core-refuge'
                );
                const body = scene.player?.body;
                return {
                    activations: scene.crystalCoreLift?.activations,
                    player: body ? {
                        x: Math.round(scene.player.x),
                        y: Math.round(scene.player.y),
                        left: Math.round(body.left),
                        right: Math.round(body.right),
                        bottom: Math.round(body.bottom),
                        velocityX: Math.round(body.velocity.x),
                        velocityY: Math.round(body.velocity.y),
                        blockedDown: body.blocked.down,
                        grounded: scene.isGrounded
                    } : null,
                    destination: support?.body ? {
                        left: Math.round(support.body.left),
                        right: Math.round(support.body.right),
                        top: Math.round(support.body.top),
                        enabled: support.body.enable
                    } : null
                };
            })()`);
            throw new Error(`${error.message}: ${JSON.stringify(diagnostics)}`);
        }
        return { setup, launched, landed };
    } finally {
        await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('CrystalCavesLevel');
            (scene.enemies?.getChildren?.() || []).forEach(enemy => {
                if (enemy?.body && enemy.active !== false) enemy.body.enable = true;
            });
            (scene.collectibles?.getChildren?.() || []).forEach(item => {
                if (item?.body && item.active !== false) item.body.enable = true;
            });
            if (scene.crystalCore?.body && !scene.crystalCoreFound) {
                scene.crystalCore.body.enable = true;
            }
            scene.isInvincible = false;
            scene.player.body.reset(3480, scene.levelHeight - 110);
            scene.player.setVelocity(0, 0);
            return true;
        })()`);
    }
}

async function smokeReefAscentCurrent(session) {
    const setup = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('ReefLevel');
        const current = scene?.abyssAscentCurrent;
        const destination = scene?.platforms?.getChildren?.().find(
            item => item.traversalId === 'reef-drive-step'
        );
        if (!scene?.player?.body || !current?.zone?.body || !destination?.body) {
            return null;
        }

        scene.isInvincible = true;
        scene.releaseAllPlatformerActionButtons?.();
        scene.resetJoystick?.();
        (scene.enemies?.getChildren?.() || []).forEach(enemy => {
            if (enemy?.body) enemy.body.enable = false;
        });
        (scene.collectibles?.getChildren?.() || []).forEach(item => {
            if (item?.body) item.body.enable = false;
        });
        current.activations = 0;
        current.activeUntil = 0;
        scene.player.body.reset(
            current.x + current.width / 2,
            current.bottom - 115
        );
        scene.player.setVelocity(0, 0);
        return {
            id: current.id,
            label: current.label?.text || '',
            destinationId: current.destinationId,
            currentBounds: {
                left: Math.round(current.zone.body.left),
                right: Math.round(current.zone.body.right),
                top: Math.round(current.zone.body.top),
                bottom: Math.round(current.zone.body.bottom)
            },
            authoredBounds: {
                left: current.x,
                right: current.x + current.width,
                top: current.top,
                bottom: current.bottom
            },
            destinationTop: Math.round(destination.body.top),
            oneWay: destination.platformType === 'one-way'
        };
    })()`);
    if (
        setup?.id !== 'reef-star-trench-return' ||
        setup.destinationId !== 'reef-drive-step' ||
        setup.oneWay !== true ||
        !setup.label.includes('STAR TRENCH RETURN') ||
        JSON.stringify(setup.currentBounds) !== JSON.stringify(setup.authoredBounds)
    ) {
        throw new Error(`Reef return current was not mechanically visible: ${JSON.stringify(setup)}`);
    }

    try {
        const lifted = await waitFor(
            () => evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene('ReefLevel');
                const current = scene?.abyssAscentCurrent;
                if (!current?.activations || scene.player.body.velocity.y > -130) return null;
                return {
                    activations: current.activations,
                    playerX: Math.round(scene.player.x),
                    playerY: Math.round(scene.player.y),
                    velocityY: Math.round(scene.player.body.velocity.y)
                };
            })()`),
            { timeoutMs: 2600, message: 'Reef Star Trench current lift' }
        );
        let landed;
        try {
            landed = await waitFor(
                () => evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene('ReefLevel');
                const support = scene.platforms.getChildren().find(
                    item => item.traversalId === 'reef-drive-step'
                );
                const body = scene.player?.body;
                if (!support?.body || !body) return null;
                const onSupport = body.right > support.body.left + 8 &&
                    body.left < support.body.right - 8 &&
                    Math.abs(body.bottom - support.body.top) <= 7 &&
                    (body.blocked.down || scene.isGrounded);
                return onSupport ? {
                    supportId: support.traversalId,
                    playerX: Math.round(scene.player.x),
                    playerBottom: Math.round(body.bottom),
                    supportTop: Math.round(support.body.top),
                    activations: scene.abyssAscentCurrent.activations
                } : null;
                })()`),
                { timeoutMs: 7000, message: 'Reef current landing' }
            );
        } catch (error) {
            const diagnostics = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene('ReefLevel');
                const support = scene.platforms.getChildren().find(
                    item => item.traversalId === 'reef-drive-step'
                );
                const body = scene.player.body;
                return {
                    player: {
                        x: Math.round(scene.player.x),
                        y: Math.round(scene.player.y),
                        left: Math.round(body.left),
                        right: Math.round(body.right),
                        top: Math.round(body.top),
                        bottom: Math.round(body.bottom),
                        velocityX: Math.round(body.velocity.x),
                        velocityY: Math.round(body.velocity.y),
                        blockedDown: body.blocked.down,
                        grounded: scene.isGrounded
                    },
                    support: {
                        left: Math.round(support.body.left),
                        right: Math.round(support.body.right),
                        top: Math.round(support.body.top),
                        bottom: Math.round(support.body.bottom)
                    },
                    current: {
                        activations: scene.abyssAscentCurrent.activations,
                        activeUntil: scene.abyssAscentCurrent.activeUntil,
                        phase: scene.abyssAscentCurrent.phase || null
                    }
                };
            })()`);
            throw new Error(`${error.message}: ${JSON.stringify(diagnostics)}`);
        }
        await delay(650);
        const settled = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('ReefLevel');
            const support = scene.platforms.getChildren().find(
                item => item.traversalId === 'reef-drive-step'
            );
            const body = scene.player.body;
            return {
                playerLeft: Math.round(body.left),
                playerRight: Math.round(body.right),
                playerTop: Math.round(body.top),
                playerBottom: Math.round(body.bottom),
                supportLeft: Math.round(support.body.left),
                supportRight: Math.round(support.body.right),
                supportTop: Math.round(support.body.top),
                supportBottom: Math.round(support.body.bottom),
                velocityY: Math.round(body.velocity.y),
                activations: scene.abyssAscentCurrent.activations
            };
        })()`);
        if (
            settled.playerRight <= settled.supportLeft + 8 ||
            settled.playerLeft >= settled.supportRight - 8 ||
            settled.playerTop >= settled.supportTop ||
            settled.playerBottom < settled.supportTop - 36 ||
            settled.playerBottom > settled.supportBottom + 4 ||
            settled.velocityY < -35 ||
            settled.activations !== landed.activations
        ) {
            throw new Error(`Reef current destabilized its landing: ${JSON.stringify(settled)}`);
        }
        return { setup, lifted, landed, settled };
    } finally {
        await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('ReefLevel');
            (scene.enemies?.getChildren?.() || []).forEach(enemy => {
                if (enemy?.body && enemy.active !== false) enemy.body.enable = true;
            });
            (scene.collectibles?.getChildren?.() || []).forEach(item => {
                if (item?.body && item.active !== false) item.body.enable = true;
            });
            scene.isInvincible = false;
            scene.player.body.reset(2300, 340);
            scene.player.setVelocity(0, 0);
            return true;
        })()`);
    }
}

async function smokeReefForwardCurrent(session, {
    currentProperty,
    sourceId,
    destinationId,
    expectedId,
    expectedLabel
}) {
    const setup = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('ReefLevel');
        const current = scene?.[${JSON.stringify(currentProperty)}];
        const source = scene?.platforms?.getChildren?.().find(
            item => item.traversalId === ${JSON.stringify(sourceId)}
        );
        const destination = scene?.platforms?.getChildren?.().find(
            item => item.traversalId === ${JSON.stringify(destinationId)}
        );
        if (
            !scene?.player?.body ||
            !current?.zone?.body ||
            !source?.body ||
            !destination?.body
        ) {
            return null;
        }

        scene.isInvincible = true;
        scene.releaseAllPlatformerActionButtons?.();
        scene.resetJoystick?.();
        (scene.enemies?.getChildren?.() || []).forEach(enemy => {
            if (enemy?.body) enemy.body.enable = false;
        });
        (scene.collectibles?.getChildren?.() || []).forEach(item => {
            if (item?.body) item.body.enable = false;
        });
        current.activations = 0;
        current.activeUntil = 0;
        scene.player.body.reset(current.x + 55, current.bottom - 90);
        scene.player.setVelocity(0, 0);
        return {
            id: current.id,
            label: current.label?.text || '',
            destinationId: current.destinationId,
            sourceLinks: [...(source.traversalLinks || [])],
            currentBounds: {
                left: Math.round(current.zone.body.left),
                right: Math.round(current.zone.body.right),
                top: Math.round(current.zone.body.top),
                bottom: Math.round(current.zone.body.bottom)
            },
            authoredBounds: {
                left: current.x,
                right: current.x + current.width,
                top: current.top,
                bottom: current.bottom
            },
            destinationTop: Math.round(destination.body.top)
        };
    })()`);
    if (
        setup?.id !== expectedId ||
        setup.destinationId !== destinationId ||
        !setup.sourceLinks.includes(destinationId) ||
        !setup.label.includes(expectedLabel) ||
        JSON.stringify(setup.currentBounds) !== JSON.stringify(setup.authoredBounds)
    ) {
        throw new Error(`Reef forward current was not mechanically visible: ${JSON.stringify(setup)}`);
    }

    try {
        const carried = await waitFor(
            () => evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene('ReefLevel');
                const current = scene?.[${JSON.stringify(currentProperty)}];
                if (
                    !current?.activations ||
                    scene.player.body.velocity.y > -145 ||
                    scene.player.body.velocity.x < 80
                ) return null;
                return {
                    activations: current.activations,
                    playerX: Math.round(scene.player.x),
                    playerY: Math.round(scene.player.y),
                    velocityX: Math.round(scene.player.body.velocity.x),
                    velocityY: Math.round(scene.player.body.velocity.y)
                };
            })()`),
            { timeoutMs: 2600, message: `${expectedLabel} carry` }
        );
        const landed = await waitFor(
            () => evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene('ReefLevel');
                const support = scene.platforms.getChildren().find(
                    item => item.traversalId === ${JSON.stringify(destinationId)}
                );
                const body = scene.player?.body;
                if (!support?.body || !body) return null;
                const onSupport = body.right > support.body.left + 8 &&
                    body.left < support.body.right - 8 &&
                    Math.abs(body.bottom - support.body.top) <= 7 &&
                    (body.blocked.down || scene.isGrounded);
                return onSupport ? {
                    supportId: support.traversalId,
                    playerX: Math.round(scene.player.x),
                    playerBottom: Math.round(body.bottom),
                    supportTop: Math.round(support.body.top),
                    activations: scene[${JSON.stringify(currentProperty)}].activations
                } : null;
            })()`),
            { timeoutMs: 6500, message: `${expectedLabel} landing` }
        );
        return { setup, carried, landed };
    } finally {
        await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('ReefLevel');
            (scene.enemies?.getChildren?.() || []).forEach(enemy => {
                if (enemy?.body && enemy.active !== false) enemy.body.enable = true;
            });
            (scene.collectibles?.getChildren?.() || []).forEach(item => {
                if (item?.body && item.active !== false) item.body.enable = true;
            });
            scene.isInvincible = false;
            scene.player.body.reset(3650, scene.levelHeight - 1030);
            scene.player.setVelocity(0, 0);
            return true;
        })()`);
    }
}

async function smokeReefForwardCurrents(session) {
    const drift = await smokeReefForwardCurrent(session, {
        currentProperty: 'driftAscentCurrent',
        sourceId: 'reef-drift-relay',
        destinationId: 'reef-current-crown',
        expectedId: 'reef-drift-ascent',
        expectedLabel: 'DRIFT CURRENT'
    });
    const traveler = await smokeReefForwardCurrent(session, {
        currentProperty: 'travelerAscentCurrent',
        sourceId: 'reef-traveler-relay',
        destinationId: 'reef-sky-rise',
        expectedId: 'reef-traveler-ascent',
        expectedLabel: 'TRAVELER CURRENT'
    });
    await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('ReefLevel');
        const choice = scene?.optionalRouteRewards?.get?.('reef_star_trench')?.choice;
        if (choice) {
            scene.reefRouteChoice = null;
            choice.selectedPath = null;
            choice.mainEntered = false;
            choice.optionalEntered = false;
            choice.rejoined = false;
            choice.sequence = null;
            scene.routeChoiceSequence = 0;
        }
        return true;
    })()`);
    return { drift, traveler };
}

async function smokeFinalVoidRiftCrossing(session) {
    const supportIds = [
        'final-rift-step-1',
        'final-rift-step-2',
        'final-rift-step-3',
        'final-rift-step-4'
    ];
    const landings = [];

    await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('FinalVoidLevel');
        scene.isInvincible = true;
        scene.releaseAllPlatformerActionButtons?.();
        scene.resetJoystick?.();
        (scene.enemies?.getChildren?.() || []).forEach(enemy => {
            if (enemy?.body) enemy.body.enable = false;
        });
        scene.player.body.reset(1600, scene.levelHeight - 110);
        scene.player.setVelocity(0, 0);
        return true;
    })()`);

    try {
        await waitFor(
            () => evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene('FinalVoidLevel');
                return Boolean(scene.player?.body?.blocked?.down || scene.isGrounded);
            })()`),
            { timeoutMs: 2500, message: 'Final Void rift crossing start' }
        );

        for (const supportId of supportIds) {
            const shouldJump = supportId !== 'final-rift-step-4';
            await setKeyboardKey(session, 'keyDown', {
                key: 'd', code: 'KeyD', keyCode: 68
            });
            let launch = null;
            if (shouldJump) {
                await delay(90);
                await setKeyboardKey(session, 'keyDown', {
                    key: ' ', code: 'Space', keyCode: 32
                });
                try {
                    launch = await waitFor(
                        () => evaluate(session, `(() => {
                            const scene = window.mythicalGame.scene.getScene('FinalVoidLevel');
                            const velocityY = Number(scene.player?.body?.velocity?.y);
                            return velocityY < -20 ? {
                                playerX: Math.round(scene.player.x),
                                playerY: Math.round(scene.player.y),
                                velocityY: Math.round(velocityY)
                            } : null;
                        })()`),
                        { timeoutMs: 800, message: `${supportId} jump launch` }
                    );
                } finally {
                    await setKeyboardKey(session, 'keyUp', {
                        key: ' ', code: 'Space', keyCode: 32
                    });
                }
            }
            await waitFor(
                () => evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene('FinalVoidLevel');
                    const support = scene.platforms.getChildren().find(
                        item => item.traversalId === ${JSON.stringify(supportId)}
                    );
                    if (!support?.body || !scene.player?.body) return null;
                    const approachInset = ${JSON.stringify(supportId)} ===
                        'final-rift-step-4' ? 60 : 28;
                    return scene.player.body.center.x >=
                        support.body.left + approachInset
                        ? {
                            playerX: Math.round(scene.player.x),
                            targetLeft: Math.round(support.body.left)
                        }
                        : null;
                })()`),
                {
                    timeoutMs: supportId === 'final-rift-step-4' ? 3200 : 1900,
                    message: `${supportId} approach`
                }
            );
            await setKeyboardKey(session, 'keyUp', {
                key: 'd', code: 'KeyD', keyCode: 68
            });
            let landing;
            try {
                landing = await waitFor(
                    () => evaluate(session, `(() => {
                        const scene = window.mythicalGame.scene.getScene('FinalVoidLevel');
                        const support = scene.platforms.getChildren().find(
                            item => item.traversalId === ${JSON.stringify(supportId)}
                        );
                        const body = scene.player?.body;
                        if (!support?.body || !body) return null;
                        const onSupport = body.right > support.body.left + 5 &&
                            body.left < support.body.right - 5 &&
                            Math.abs(body.bottom - support.body.top) <= 7 &&
                            (body.blocked.down || scene.isGrounded);
                        return onSupport ? {
                            supportId: support.traversalId,
                            playerX: Math.round(scene.player.x),
                            playerBottom: Math.round(body.bottom),
                            supportTop: Math.round(support.body.top)
                        } : null;
                    })()`),
                    { timeoutMs: 2400, message: `${supportId} grounded landing` }
                );
            } catch (error) {
                const diagnostics = await evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene('FinalVoidLevel');
                    const body = scene.player?.body;
                    return {
                        player: body ? {
                            x: Math.round(scene.player.x),
                            y: Math.round(scene.player.y),
                            left: Math.round(body.left),
                            right: Math.round(body.right),
                            bottom: Math.round(body.bottom),
                            velocityX: Math.round(body.velocity.x),
                            velocityY: Math.round(body.velocity.y),
                            blockedDown: body.blocked.down,
                            grounded: scene.isGrounded
                        } : null,
                        supports: scene.platforms.getChildren()
                            .filter(item => item?.body && body && (
                                body.right > item.body.left - 60 &&
                                body.left < item.body.right + 60
                            ))
                            .map(item => ({
                                id: item.traversalId || null,
                                left: Math.round(item.body.left),
                                right: Math.round(item.body.right),
                                top: Math.round(item.body.top)
                            }))
                    };
                })()`);
                throw new Error(`${error.message}: ${JSON.stringify(diagnostics)}`);
            }
            landings.push({ launch, landing });
            await delay(90);
        }
    } finally {
        await setKeyboardKey(session, 'keyUp', {
            key: ' ', code: 'Space', keyCode: 32
        });
        await setKeyboardKey(session, 'keyUp', {
            key: 'd', code: 'KeyD', keyCode: 68
        });
        await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('FinalVoidLevel');
            (scene.enemies?.getChildren?.() || []).forEach(enemy => {
                if (enemy?.body && enemy.active !== false) enemy.body.enable = true;
            });
            scene.isInvincible = false;
            scene.player.body.reset(600, scene.levelHeight - 110);
            scene.player.setVelocity(0, 0);
            return true;
        })()`);
    }

    return landings;
}

async function smokeAuroraQuietLightClimb(session) {
    const supportIds = [
        'aurora-quiet-step-1',
        'aurora-quiet-step-2',
        'aurora-quiet-step-3'
    ];
    const landings = [];

    await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('AuroraDepthsLevel');
        const launch = scene.platforms.getChildren().find(
            item => item.traversalId === 'aurora-heart-launch'
        );
        if (!scene.player?.body || !launch?.body) return false;
        scene.isInvincible = true;
        scene.releaseAllPlatformerActionButtons?.();
        scene.resetJoystick?.();
        (scene.enemies?.getChildren?.() || []).forEach(enemy => {
            if (enemy?.body) enemy.body.enable = false;
        });
        scene.player.body.reset(2600, launch.body.top - 80);
        scene.player.setVelocity(0, 0);
        return true;
    })()`);

    try {
        await waitFor(
            () => evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene('AuroraDepthsLevel');
                const launch = scene.platforms.getChildren().find(
                    item => item.traversalId === 'aurora-heart-launch'
                );
                const body = scene.player?.body;
                return Boolean(
                    launch?.body && body &&
                    Math.abs(body.bottom - launch.body.top) <= 7 &&
                    (body.blocked.down || scene.isGrounded)
                );
            })()`),
            { timeoutMs: 2500, message: 'Aurora Quiet Light launch ledge' }
        );

        for (const supportId of supportIds) {
            await setKeyboardKey(session, 'keyDown', {
                key: 'd', code: 'KeyD', keyCode: 68
            });
            await delay(90);
            await setKeyboardKey(session, 'keyDown', {
                key: ' ', code: 'Space', keyCode: 32
            });
            let launch;
            try {
                launch = await waitFor(
                    () => evaluate(session, `(() => {
                        const scene = window.mythicalGame.scene.getScene('AuroraDepthsLevel');
                        const velocityY = Number(scene.player?.body?.velocity?.y);
                        return velocityY < -20 ? {
                            playerX: Math.round(scene.player.x),
                            playerY: Math.round(scene.player.y),
                            velocityY: Math.round(velocityY)
                        } : null;
                    })()`),
                    { timeoutMs: 800, message: `${supportId} jump launch` }
                );
            } finally {
                await setKeyboardKey(session, 'keyUp', {
                    key: ' ', code: 'Space', keyCode: 32
                });
            }
            await waitFor(
                () => evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene('AuroraDepthsLevel');
                    const support = scene.platforms.getChildren().find(
                        item => item.traversalId === ${JSON.stringify(supportId)}
                    );
                    return support?.body && scene.player?.body?.center?.x >=
                        support.body.left + 28;
                })()`),
                { timeoutMs: 1900, message: `${supportId} approach` }
            );
            await setKeyboardKey(session, 'keyUp', {
                key: 'd', code: 'KeyD', keyCode: 68
            });
            const landing = await waitFor(
                () => evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene('AuroraDepthsLevel');
                    const support = scene.platforms.getChildren().find(
                        item => item.traversalId === ${JSON.stringify(supportId)}
                    );
                    const body = scene.player?.body;
                    if (!support?.body || !body) return null;
                    const onSupport = body.right > support.body.left + 5 &&
                        body.left < support.body.right - 5 &&
                        Math.abs(body.bottom - support.body.top) <= 7 &&
                        (body.blocked.down || scene.isGrounded);
                    return onSupport ? {
                        supportId: support.traversalId,
                        playerX: Math.round(scene.player.x),
                        playerBottom: Math.round(body.bottom),
                        supportTop: Math.round(support.body.top)
                    } : null;
                })()`),
                { timeoutMs: 2600, message: `${supportId} grounded landing` }
            );
            landings.push({ launch, landing });
            await delay(90);
        }
    } finally {
        await setKeyboardKey(session, 'keyUp', {
            key: ' ', code: 'Space', keyCode: 32
        });
        await setKeyboardKey(session, 'keyUp', {
            key: 'd', code: 'KeyD', keyCode: 68
        });
        await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('AuroraDepthsLevel');
            (scene.enemies?.getChildren?.() || []).forEach(enemy => {
                if (enemy?.body && enemy.active !== false) enemy.body.enable = true;
            });
            scene.isInvincible = false;
            scene.player.body.reset(1150, scene.levelHeight - 130);
            scene.player.setVelocity(0, 0);
            return true;
        })()`);
    }

    return landings;
}

async function smokeForestForwardHandoffs(session) {
    const transitions = [
        {
            id: 'tree-3-to-crown-bridge',
            startId: 'forest-tree-3-branch-4',
            targetId: 'forest-tree-3-handoff',
            jump: true
        },
        {
            id: 'final-bridge-to-guardian-ground',
            startId: 'forest-guardian-handoff',
            targetId: 'forest-ground-6',
            jump: false
        }
    ];
    const landings = [];

    await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
        scene.isInvincible = true;
        scene.releaseAllPlatformerActionButtons?.();
        scene.resetJoystick?.();
        (scene.enemies?.getChildren?.() || []).forEach(enemy => {
            if (enemy?.body) enemy.body.enable = false;
        });
        return true;
    })()`);

    try {
        for (const transition of transitions) {
            const staged = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
                const start = scene.platforms.getChildren().find(
                    item => item.traversalId === ${JSON.stringify(transition.startId)}
                );
                if (!start?.body || !scene.player?.body) return null;
                const inset = ${transition.jump ? 52 : 100};
                scene.player.body.reset(start.body.right - inset, start.body.top - 80);
                scene.player.setVelocity(0, 0);
                return {
                    startId: start.traversalId,
                    startRight: Math.round(start.body.right),
                    startTop: Math.round(start.body.top)
                };
            })()`);
            if (!staged) {
                throw new Error(`Forest handoff support missing: ${transition.startId}`);
            }

            await waitFor(
                () => evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
                    const start = scene.platforms.getChildren().find(
                        item => item.traversalId === ${JSON.stringify(transition.startId)}
                    );
                    const body = scene.player?.body;
                    return Boolean(
                        start?.body && body &&
                        Math.abs(body.bottom - start.body.top) <= 7 &&
                        (body.blocked.down || scene.isGrounded)
                    );
                })()`),
                { timeoutMs: 2500, message: `${transition.id} start` }
            );

            await setKeyboardKey(session, 'keyDown', {
                key: 'd', code: 'KeyD', keyCode: 68
            });
            let launch = null;
            if (transition.jump) {
                await delay(90);
                await setKeyboardKey(session, 'keyDown', {
                    key: ' ', code: 'Space', keyCode: 32
                });
                try {
                    launch = await waitFor(
                        () => evaluate(session, `(() => {
                            const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
                            const velocityY = Number(scene.player?.body?.velocity?.y);
                            return velocityY < -20 ? {
                                playerX: Math.round(scene.player.x),
                                velocityY: Math.round(velocityY)
                            } : null;
                        })()`),
                        { timeoutMs: 800, message: `${transition.id} launch` }
                    );
                } finally {
                    await setKeyboardKey(session, 'keyUp', {
                        key: ' ', code: 'Space', keyCode: 32
                    });
                }
            }

            await waitFor(
                () => evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
                    const target = scene.platforms.getChildren().find(
                        item => item.traversalId === ${JSON.stringify(transition.targetId)}
                    );
                    return target?.body && scene.player?.body?.center?.x >=
                        target.body.left + 28;
                })()`),
                { timeoutMs: 2400, message: `${transition.id} approach` }
            );
            await setKeyboardKey(session, 'keyUp', {
                key: 'd', code: 'KeyD', keyCode: 68
            });

            const landing = await waitFor(
                () => evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
                    const target = scene.platforms.getChildren().find(
                        item => item.traversalId === ${JSON.stringify(transition.targetId)}
                    );
                    const body = scene.player?.body;
                    if (!target?.body || !body) return null;
                    const onTarget = body.right > target.body.left + 5 &&
                        body.left < target.body.right - 5 &&
                        Math.abs(body.bottom - target.body.top) <= 7 &&
                        (body.blocked.down || scene.isGrounded);
                    return onTarget ? {
                        transitionId: ${JSON.stringify(transition.id)},
                        targetId: target.traversalId,
                        playerX: Math.round(scene.player.x),
                        playerBottom: Math.round(body.bottom),
                        targetTop: Math.round(target.body.top)
                    } : null;
                })()`),
                { timeoutMs: 3000, message: `${transition.id} grounded landing` }
            );
            landings.push({ staged, launch, landing });
        }
    } finally {
        await setKeyboardKey(session, 'keyUp', {
            key: ' ', code: 'Space', keyCode: 32
        });
        await setKeyboardKey(session, 'keyUp', {
            key: 'd', code: 'KeyD', keyCode: 68
        });
        await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
            (scene.enemies?.getChildren?.() || []).forEach(enemy => {
                if (enemy?.body && enemy.active !== false) enemy.body.enable = true;
            });
            scene.isInvincible = false;
            scene.player.body.reset(300, scene.levelHeight - 130);
            scene.player.setVelocity(0, 0);
            return true;
        })()`);
    }

    return landings;
}

async function smokeLevel(session, route, sceneName, exceptions, {
    beforeStart = null
} = {}) {
    exceptions.length = 0;
    trace('navigate', { route, sceneName });
    await navigate(session, `${BASE_URL}/play/?reset=true`);
    await waitForScene(session, 'HatchingScene');
    await beforeStart?.();
    trace('startCampaignScene', { sceneName });
    await startCampaignScene(session, { route, sceneName });
    await delay(400);

    if (route === 'mythicalForest') {
        let forestEnemySettlement = null;
        try {
            await waitFor(
                async () => {
                    forestEnemySettlement = await evaluate(session, `(() => {
                const scene = window.mythicalGame?.scene?.getScene?.(
                    'MythicalForestLevel'
                );
                const enemies = scene?.voidSprites || [];
                const enemyStates = enemies.map(enemy => {
                    const support = scene.getTraversalSupport?.(
                        enemy.forestSupportId
                    );
                    const settled = Boolean(
                        enemy?.active &&
                        enemy?.body &&
                        support?.body &&
                        enemy.body.right > support.body.left + 4 &&
                        enemy.body.left < support.body.right - 4 &&
                        Math.abs(enemy.body.bottom - support.body.top) <= 12
                    );
                    return {
                        supportId: enemy?.forestSupportId || null,
                        active: enemy?.active === true,
                        bodyEnabled: enemy?.body?.enable === true,
                        proximityActive: enemy?.forestProximityActive,
                        renderAttached: enemy?.displayList === scene.children,
                        x: enemy?.x,
                        y: enemy?.y,
                        bodyBottom: enemy?.body?.bottom,
                        supportTop: support?.body?.top,
                        blockedDown: enemy?.body?.blocked?.down === true,
                        touchingDown: enemy?.body?.touching?.down === true,
                        settled
                    };
                });
                return {
                    ready: enemyStates.length === 5 &&
                        enemyStates.every(enemy => enemy.settled),
                    enemies: enemyStates
                };
            })()`);
                    return forestEnemySettlement?.ready
                        ? forestEnemySettlement
                        : null;
                },
                {
                    timeoutMs: 3500,
                    message: 'Forest authored enemies settled on their supports'
                }
            );
        } catch (error) {
            throw new Error(
                `${error.message}: ${JSON.stringify({
                    settlement: forestEnemySettlement,
                    exceptions
                })}`
            );
        }
    }

    const state = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
        return {
            active: window.mythicalGame.scene.isActive(${JSON.stringify(sceneName)}),
            playerActive: Boolean(scene?.player?.active),
            physicsPaused: Boolean(scene?.physics?.world?.isPaused),
            scenePaused: Boolean(scene?.scene?.isPaused?.()),
            sceneSleeping: Boolean(scene?.scene?.isSleeping?.()),
            gameLoopSleeping: Boolean(window.mythicalGame?.loop?.sleeping),
            entryAccepted: Boolean(
                scene?.levelEntryDismissing ||
                scene?.levelStarted ||
                scene?.gameStarted
            ),
            mobileControls: scene?.platformerControlsVisible === true,
            interactiveCount: scene?.input?._list?.length || 0,
            displayCount: scene?.children?.list?.length || 0,
            enemyCount: scene?.enemies?.getChildren?.()
                ?.filter(enemy => enemy?.active !== false).length || 0,
            combatCueCount: scene?.enemies?.getChildren?.()
                ?.filter(enemy => enemy?.active !== false && enemy?.combatCue?.active).length || 0,
            encounterRhythm: (() => {
                const encounters = scene?.enemies?.getChildren?.().filter(
                    enemy => enemy?.active !== false && enemy?.encounterBeat
                ) || [];
                if (!encounters.length) return null;
                const unsupported = encounters.filter(enemy => {
                    if (enemy.encounterAirborne) return false;
                    const support = scene.getTraversalSupport?.(
                        enemy.encounterSupportId
                    );
                    const body = enemy.body;
                    const halfWidth = Number(body?.halfWidth) ||
                        (Number(body?.width) || 0) / 2;
                    const halfHeight = Number(body?.halfHeight) ||
                        (Number(body?.height) || 0) / 2;
                    const enemyLeft = body?.enable === false
                        ? enemy.x - halfWidth
                        : body?.left;
                    const enemyRight = body?.enable === false
                        ? enemy.x + halfWidth
                        : body?.right;
                    const enemyBottom = body?.enable === false
                        ? enemy.y + halfHeight
                        : body?.bottom;
                    return !support?.body || !body ||
                        enemyRight <= support.body.left + 4 ||
                        enemyLeft >= support.body.right - 4 ||
                        Math.abs(enemyBottom - support.body.top) > 9;
                }).map(enemy => enemy.encounterBeat);
                return {
                    count: encounters.length,
                    clearCount: encounters.filter(
                        enemy => Number(enemy.maxHealth) === 1
                    ).length,
                    armoredCount: encounters.filter(
                        enemy => enemy.combatRole === 'armored'
                    ).length,
                    heavyCount: encounters.filter(
                        enemy => Number(enemy.maxHealth) >= 3
                    ).length,
                    mainCount: encounters.filter(
                        enemy => enemy.encounterLane === 'main'
                    ).length,
                    optionalCount: encounters.filter(
                        enemy => enemy.encounterLane === 'optional'
                    ).length,
                    beats: encounters.map(enemy => enemy.encounterBeat),
                    supportIds: encounters.map(enemy => enemy.encounterSupportId),
                    unsupported
                };
            })(),
            ambientRendering: scene?.forestAmbientLayers ? {
                layerCount: scene.forestAmbientLayers.filter(
                    layer => layer?.active !== false
                ).length,
                pointCount: Number(scene.forestAmbientPointCount) || 0
            } : null,
            coinRendering: scene?.coinSprites ? {
                batchedCount: scene.coinSprites.filter(
                    coin => coin?.batched && !coin.collected
                ).length,
                legacyVisualCount: scene.coinSprites.filter(
                    coin => coin?.coin?.active
                ).length,
                layerCount: scene.children?.list?.filter(
                    item => item === scene.forestCoinLayer
                ).length || 0,
                pickupCount: scene.coinSprites.filter(
                    coin => coin?.batched && !coin.collected
                ).length,
                pickupBodyCount: scene.coinSprites.filter(
                    coin => coin?.pickupZone?.body
                ).length
            } : null,
            forestEnemyRuntime: scene?.scene?.key === 'MythicalForestLevel' ? {
                scheduledEnemyCount: (
                    scene?.enemies?.getChildren?.() || []
                ).filter(enemy => Number.isFinite(enemy?.forestNextAiAt)).length,
                individualTimerCount: (
                    scene?.enemies?.getChildren?.() || []
                ).reduce(
                    (total, enemy) => total + (enemy?.runtimeTimers?.size || 0),
                    0
                ),
                aiSchedulerActive: Boolean(
                    scene?.forestEnemyAISchedulerActive
                ),
                proximityActiveCount: (
                    scene?.enemies?.getChildren?.() || []
                ).filter(enemy => enemy?.forestProximityActive === true).length,
                sleepingEnemyCount: (
                    scene?.enemies?.getChildren?.() || []
                ).filter(enemy => enemy?.forestProximityActive === false).length,
                enabledBodyCount: (
                    scene?.enemies?.getChildren?.() || []
                ).filter(enemy => enemy?.body?.enable === true).length,
                visibleEnemyCount: (
                    scene?.enemies?.getChildren?.() || []
                ).filter(enemy => enemy?.visible === true).length,
                renderAttachedEnemyCount: (
                    scene?.enemies?.getChildren?.() || []
                ).filter(enemy => enemy?.displayList === scene.children).length,
                renderAttachedCueCount: (
                    scene?.enemies?.getChildren?.() || []
                ).filter(
                    enemy => enemy?.combatCue?.displayList === scene.children
                ).length,
                sleepingDetachedCount: (
                    scene?.enemies?.getChildren?.() || []
                ).filter(enemy => (
                    enemy?.forestProximityActive === false &&
                    enemy?.displayList !== scene.children &&
                    enemy?.combatCue?.displayList !== scene.children
                )).length,
                activationBounds: scene.forestEnemyActivationBounds ? {
                    horizontalMargin:
                        scene.forestEnemyActivationBounds.horizontalMargin,
                    verticalMargin:
                        scene.forestEnemyActivationBounds.verticalMargin
                } : null,
                groundEnemySupportIds: (scene.voidSprites || []).map(
                    enemy => enemy?.forestSupportId || null
                ),
                unsupportedGroundEnemyIds: (scene.voidSprites || [])
                    .filter(enemy => {
                        if (!enemy?.active || !enemy?.body) return false;
                        const support = scene.getTraversalSupport?.(
                            enemy.forestSupportId
                        );
                        return !support?.body ||
                            enemy.body.right <= support.body.left + 4 ||
                            enemy.body.left >= support.body.right - 4 ||
                            Math.abs(enemy.body.bottom - support.body.top) > 12;
                    })
                    .map(enemy => enemy?.forestSupportId || 'missing-support'),
                airborneMotionTweenCount: (
                    scene?.tweens?.getTweens?.() || []
                ).filter(tween => (tween?.targets || []).some(target => (
                    scene.sporeDrifters?.includes?.(target) ||
                    scene.forestWisps?.includes?.(target)
                ))).length
            } : null,
            caveEnemyRuntime: scene?.scene?.key === 'CrystalCavesLevel' ? {
                scheduledEnemyCount: (
                    scene?.enemies?.getChildren?.() || []
                ).filter(enemy => Number.isFinite(enemy?.caveNextAiAt)).length,
                individualTimerCount: (
                    scene?.enemies?.getChildren?.() || []
                ).reduce(
                    (total, enemy) => total + (enemy?.runtimeTimers?.size || 0),
                    0
                ),
                aiSchedulerActive: Boolean(scene.caveEnemyAISchedulerActive),
                proximityActiveCount: (
                    scene?.enemies?.getChildren?.() || []
                ).filter(enemy => enemy?.caveProximityActive === true).length,
                sleepingEnemyCount: (
                    scene?.enemies?.getChildren?.() || []
                ).filter(enemy => enemy?.caveProximityActive === false).length,
                enabledBodyCount: (
                    scene?.enemies?.getChildren?.() || []
                ).filter(enemy => enemy?.body?.enable === true).length,
                renderAttachedEnemyCount: (
                    scene?.enemies?.getChildren?.() || []
                ).filter(enemy => enemy?.displayList === scene.children).length,
                renderAttachedCueCount: (
                    scene?.enemies?.getChildren?.() || []
                ).filter(
                    enemy => enemy?.combatCue?.displayList === scene.children
                ).length,
                sleepingDetachedCount: (
                    scene?.enemies?.getChildren?.() || []
                ).filter(enemy => (
                    enemy?.caveProximityActive === false &&
                    enemy?.displayList !== scene.children &&
                    enemy?.combatCue?.displayList !== scene.children
                )).length,
                activationBounds: scene.caveEnemyActivationBounds ? {
                    horizontalMargin:
                        scene.caveEnemyActivationBounds.horizontalMargin,
                    verticalMargin:
                        scene.caveEnemyActivationBounds.verticalMargin
                } : null,
                spiderTimersPaused: Boolean(
                    scene.crystalSpider?.caveProximityActive === false &&
                    scene.spiderAttackTimer?.paused &&
                    scene.spiderWebSprayTimer?.paused
                ),
                batMotionTweenCount: (
                    scene?.tweens?.getTweens?.() || []
                ).filter(tween => (tween?.targets || []).some(
                    target => target?.enemyType === 'shadowBat'
                )).length
            } : null,
            reefEnemyRuntime: scene?.scene?.key === 'ReefLevel' ? (() => {
                const enemies = scene?.enemies?.getChildren?.() || [];
                const physicsOnlyBodies = [
                    ...(scene?.platforms?.getChildren?.() || []),
                    ...enemies,
                    ...(scene?.starFragments || []),
                    scene?.shipPart
                ].filter(body => body?.reefPhysicsOnly);
                return {
                    scheduledEnemyCount: enemies.filter(
                        enemy => typeof enemy?.reefProximityActive === 'boolean'
                    ).length,
                    aiSchedulerActive: Boolean(scene.reefEnemyAISchedulerActive),
                    proximityActiveCount: enemies.filter(
                        enemy => enemy?.reefProximityActive === true
                    ).length,
                    sleepingEnemyCount: enemies.filter(
                        enemy => enemy?.reefProximityActive === false
                    ).length,
                    enabledBodyCount: enemies.filter(
                        enemy => enemy?.body?.enable === true
                    ).length,
                    renderAttachedGraphicsCount: enemies.filter(
                        enemy => enemy?.graphics?.displayList === scene.children
                    ).length,
                    renderAttachedCueCount: enemies.filter(
                        enemy => enemy?.combatCue?.displayList === scene.children
                    ).length,
                    sleepingDetachedCount: enemies.filter(enemy => (
                        enemy?.reefProximityActive === false &&
                        enemy?.graphics?.displayList !== scene.children &&
                        enemy?.combatCue?.displayList !== scene.children
                    )).length,
                    activationBounds: scene.reefEnemyActivationBounds ? {
                        horizontalMargin:
                            scene.reefEnemyActivationBounds.horizontalMargin,
                        verticalMargin:
                            scene.reefEnemyActivationBounds.verticalMargin
                    } : null,
                    physicsOnlyBodyCount: physicsOnlyBodies.length,
                    physicsOnlyDisplayCount: physicsOnlyBodies.filter(
                        body => body?.displayList === scene.children
                    ).length
                };
            })() : null,
            peakEnemyRuntime:
                scene?.scene?.key === 'VoidPeaksLevel' ? (() => {
                    const enemies = scene?.enemies?.getChildren?.() || [];
                    return {
                        scheduledEnemyCount: enemies.filter(
                            enemy => typeof enemy?.peakProximityActive === 'boolean'
                        ).length,
                        aiSchedulerActive: Boolean(
                            scene.peakEnemyAISchedulerActive
                        ),
                        proximityActiveCount: enemies.filter(
                            enemy => enemy?.peakProximityActive === true
                        ).length,
                        sleepingEnemyCount: enemies.filter(
                            enemy => enemy?.peakProximityActive === false
                        ).length,
                        enabledBodyCount: enemies.filter(
                            enemy => enemy?.body?.enable === true
                        ).length,
                        renderAttachedEnemyCount: enemies.filter(
                            enemy => enemy?.displayList === scene.children
                        ).length,
                        renderAttachedCueCount: enemies.filter(
                            enemy => enemy?.combatCue?.displayList === scene.children
                        ).length,
                        sleepingDetachedCount: enemies.filter(enemy => (
                            enemy?.peakProximityActive === false &&
                            enemy?.displayList !== scene.children &&
                            enemy?.combatCue?.displayList !== scene.children
                        )).length,
                        runtimePatrolCount:
                            scene.getRuntimePatrolEnemies?.().length || 0,
                        activationBounds: scene.peakEnemyActivationBounds ? {
                            horizontalMargin:
                                scene.peakEnemyActivationBounds.horizontalMargin,
                            verticalMargin:
                                scene.peakEnemyActivationBounds.verticalMargin
                        } : null,
                        patrolUpdateCount: Number(
                            scene.peakEnemyPatrolUpdateCount
                        ) || 0
                    };
                })() : null,
            auroraEnemyRuntime:
                scene?.scene?.key === 'AuroraDepthsLevel' ? (() => {
                    const enemies = scene?.enemies?.getChildren?.() || [];
                    return {
                        scheduledEnemyCount: enemies.filter(
                            enemy => typeof enemy?.auroraProximityActive === 'boolean'
                        ).length,
                        aiSchedulerActive: Boolean(
                            scene.auroraEnemyAISchedulerActive
                        ),
                        proximityActiveCount: enemies.filter(
                            enemy => enemy?.auroraProximityActive === true
                        ).length,
                        sleepingEnemyCount: enemies.filter(
                            enemy => enemy?.auroraProximityActive === false
                        ).length,
                        enabledBodyCount: enemies.filter(
                            enemy => enemy?.body?.enable === true
                        ).length,
                        renderAttachedEnemyCount: enemies.filter(
                            enemy => enemy?.displayList === scene.children
                        ).length,
                        renderAttachedCueCount: enemies.filter(
                            enemy => enemy?.combatCue?.displayList === scene.children
                        ).length,
                        sleepingDetachedCount: enemies.filter(enemy => (
                            enemy?.auroraProximityActive === false &&
                            enemy?.displayList !== scene.children &&
                            enemy?.combatCue?.displayList !== scene.children
                        )).length,
                        runtimePatrolCount:
                            scene.getRuntimePatrolEnemies?.().length || 0,
                        activationBounds: scene.auroraEnemyActivationBounds ? {
                            horizontalMargin:
                                scene.auroraEnemyActivationBounds.horizontalMargin,
                            verticalMargin:
                                scene.auroraEnemyActivationBounds.verticalMargin
                        } : null,
                        patrolUpdateCount: Number(
                            scene.auroraEnemyPatrolUpdateCount
                        ) || 0
                    };
                })() : null,
            forestDecorationRendering:
                scene?.scene?.key === 'MythicalForestLevel' ? (() => {
                    const tweens = scene?.tweens?.getTweens?.() || [];
                    const fragmentTargets = new Set(
                        (scene.starFragmentSprites || [])
                            .map(fragment => fragment?.sprite)
                            .filter(Boolean)
                    );
                    const landingGuideTargets = new Set(
                        (scene.checkpointAnchors || [])
                            .map(checkpoint => checkpoint?.landingGuide)
                            .filter(Boolean)
                    );
                    return {
                        starFragmentTweenCount: tweens.filter(
                            tween => (tween?.targets || []).some(
                                target => fragmentTargets.has(target)
                            )
                        ).length,
                        landingGuideTweenCount: tweens.filter(
                            tween => (tween?.targets || []).some(
                                target => landingGuideTargets.has(target)
                            )
                        ).length,
                        voidMoteTweenCount: tweens.filter(
                            tween => (tween?.targets || []).includes(
                                scene.forestVoidMoteLayer
                            )
                        ).length,
                        arenaParticleTweenCount: tweens.filter(
                            tween => (tween?.targets || []).some(
                                target => target?.forestArenaAmbientParticle
                            )
                        ).length,
                        arenaAmbientLayerCount: scene.children?.list?.filter(
                            item => item === scene.forestArenaAmbientLayer
                        ).length || 0,
                        arenaAmbientTimerActive: Boolean(
                            scene.forestArenaAmbientTimer?.active
                        )
                    };
                })() : null,
            caveCoinRendering: Array.isArray(scene?.caveCoinPickups) ? {
                batchedCount: scene.caveCoinPickups.filter(
                    coin => coin?.batched && !coin.collected
                ).length,
                layerCount: scene.children?.list?.filter(
                    item => item === scene.caveCoinLayer
                ).length || 0,
                physicsCoinCount: scene.collectibles?.getChildren?.().filter(
                    item => item?.collectibleType === 'coin' && item?.body
                ).length || 0
            } : null,
            caveCrystalRendering: Array.isArray(scene?.caveCrystalField) ? {
                batchedCount: scene.caveCrystalField.filter(
                    crystal => crystal?.batched && crystal.active !== false
                ).length,
                layerCount: scene.children?.list?.filter(
                    item => item === scene.caveCrystalFieldLayer
                ).length || 0
            } : null,
            caveAmbientRendering: Array.isArray(scene?.caveParallaxLayers) ? {
                parallaxLayerCount: scene.caveParallaxLayers.filter(
                    layer => layer?.active !== false
                ).length,
                storyDecorationTweenCount: (
                    scene?.tweens?.getTweens?.() || []
                ).filter(tween => (tween?.targets || []).some(
                    target => [
                        'brokenLantern',
                        'minerSkeleton'
                    ].includes(target?.caveAmbientRole)
                )).length,
                coinLayerTweenCount: (
                    scene?.tweens?.getTweens?.() || []
                ).filter(tween => (tween?.targets || []).includes(
                    scene.caveCoinLayer
                )).length
            } : null,
            reefAmbientRendering: Array.isArray(scene?.cosmicDustParticles) ? {
                nebulaLayerCount: scene.nebulaParticles?.filter(
                    layer => layer?.active !== false
                ).length || 0,
                riftLayerCount: scene.voidRifts?.filter(
                    layer => layer?.active !== false
                ).length || 0,
                dustLayerCount: scene.children?.list?.filter(
                    item => item === scene.cosmicDustLayer
                ).length || 0,
                dustParticleCount: scene.cosmicDustParticles.length,
                entryLayerCount: scene.children?.list?.filter(
                    item => item === scene.entryCosmicParticleLayer
                ).length || 0,
                decorativeTweenCount: (() => {
                    const routeState = scene.optionalRouteRewards?.get?.(
                        'reef_star_trench'
                    );
                    const targets = new Set([
                        ...(scene.nebulaParticles || []),
                        ...(scene.voidRifts || []),
                        ...(scene.starFragments || []).map(item => item?.graphics),
                        scene.shipPart?.graphics,
                        scene.shipPart?.label,
                        routeState?.marker,
                        routeState?.choice?.mainMarker,
                        scene.abyssAscentCurrent?.visual,
                        scene.abyssAscentCurrent?.label,
                        scene.driftAscentCurrent?.visual,
                        scene.driftAscentCurrent?.label,
                        scene.travelerAscentCurrent?.visual,
                        scene.travelerAscentCurrent?.label
                    ].filter(Boolean));
                    return (scene.tweens?.getTweens?.() || []).filter(
                        tween => (tween?.targets || []).some(target => targets.has(target))
                    ).length;
                })()
            } : null,
            currentEcologyPlacement: scene?.currentEcologyNode ? (() => {
                const node = scene.currentEcologyNode;
                const support = node.supportId
                    ? scene.getTraversalSupport?.(node.supportId)
                    : null;
                return {
                    supportId: node.supportId || null,
                    x: Number(node.x),
                    y: Number(node.y),
                    supportLeft: Number(support?.body?.left),
                    supportRight: Number(support?.body?.right),
                    supportTop: Number(support?.body?.top),
                    spawnDistance: Math.hypot(
                        Number(node.x) - Number(scene.playerSpawnX || 200),
                        Number(node.y) - Number(scene.playerSpawnY || (
                            scene.levelHeight - 290
                        ))
                    )
                };
            })() : null,
            reefOpeningGuidance: scene?.openingSignalCurrent ? {
                departureCueX: Number(
                    scene.openingSignalCurrent.departureCue?.x
                ),
                departureCueY: Number(
                    scene.openingSignalCurrent.departureCue?.y
                ),
                active: scene.openingSignalCurrent.visual?.active !== false
            } : null,
            peaksAmbientRendering: Array.isArray(scene?.peakStarField) ? {
                starCount: scene.peakStarField.filter(
                    star => star?.batched
                ).length,
                starLayerCount: scene.children?.list?.filter(
                    item => item === scene.peakStarLayer
                ).length || 0,
                emberCount: scene.peakEmbers?.filter(
                    ember => ember?.batched
                ).length || 0,
                emberLayerCount: scene.children?.list?.filter(
                    item => item === scene.peakEmberLayer
                ).length || 0,
                emberVisibleCount: Number(scene.peakEmberVisibleCount) || 0,
                emberDrawCount: Number(scene.peakEmberDrawCount) || 0,
                patrolUpdateCount: Number(
                    scene.peakEnemyPatrolUpdateCount
                ) || 0
            } : null,
            auroraAmbientRendering:
                scene?.scene?.key === 'AuroraDepthsLevel' ? {
                    shadowCurrentCount: scene.shadowCurrents?.length || 0,
                    shadowCurrentLabelCount: scene.shadowCurrents?.filter(
                        current => current?.label?.active !== false
                    ).length || 0,
                    shadowPulseTweenCount: (
                        scene.tweens?.getTweens?.() || []
                    ).filter(
                        tween => tween === scene.shadowCurrentPulseTween
                    ).length,
                    fragmentCount: scene.auroraFragments?.getChildren?.()
                        ?.filter(fragment => fragment?.active !== false).length || 0,
                    fragmentPulseTweenCount: (
                        scene.tweens?.getTweens?.() || []
                    ).filter(
                        tween => tween === scene.auroraFragmentTween
                    ).length,
                    landingGuideTweenCount: (() => {
                        const guides = new Set([
                            ...(scene.signalPrisms || []).map(
                                prism => prism?.landingGuide
                            ),
                            scene.phoenixLandingGuide
                        ].filter(Boolean));
                        return (scene.tweens?.getTweens?.() || []).filter(
                            tween => (tween?.targets || []).some(
                                target => guides.has(target)
                            )
                        ).length;
                    })(),
                    quietRouteTweenCount: (
                        scene.tweens?.getTweens?.() || []
                    ).filter(tween => (tween?.targets || []).includes(
                        scene.quietLightRouteVisual
                    )).length,
                    optionalPickupTweenCount: (
                        scene.tweens?.getTweens?.() || []
                    ).filter(
                        tween => tween === scene.optionalRoutePickupTween
                    ).length
                } : null,
            routeGuidance: (() => {
                const nextSignal = scene?.getNextOrderedRouteSignal?.();
                return {
                    supported: Array.isArray(scene?.orderedRouteSignals),
                    compass: scene?.getOrderedRouteCompassText?.() || '',
                    nextSignalIndex: nextSignal?.index,
                    nextSignalVisible: nextSignal?.visual?.visible !== false,
                    nextSignalAlpha: nextSignal?.visual?.alpha,
                    nextSignalEmphasized: Boolean(nextSignal?.guidanceTween)
                };
            })(),
            actualFps: window.mythicalGame?.loop?.actualFps || 0,
            canvasWidth: document.querySelector('canvas')?.width || 0,
            canvasHeight: document.querySelector('canvas')?.height || 0
        };
    })()`);

    if (!state.active || !state.playerActive || state.physicsPaused) {
        throw new Error(`${sceneName} did not enter live gameplay: ${JSON.stringify(state)}`);
    }
    if (!state.entryAccepted) {
        throw new Error(`${sceneName} did not accept entry input: ${JSON.stringify(state)}`);
    }
    if (!state.mobileControls) {
        throw new Error(`${sceneName} entered gameplay without touch controls: ${JSON.stringify(state)}`);
    }
    if (!state.canvasWidth || !state.canvasHeight) {
        throw new Error(`${sceneName} rendered a blank-sized canvas`);
    }
    if (
        route === 'mythicalForest' &&
        (
            state.displayCount > 225 ||
            state.ambientRendering?.layerCount !== 1 ||
            state.ambientRendering?.pointCount !== 164 ||
            state.coinRendering?.batchedCount < 40 ||
            state.coinRendering?.legacyVisualCount !== 0 ||
            state.coinRendering?.layerCount !== 1 ||
            state.coinRendering?.pickupCount !== state.coinRendering?.batchedCount ||
            state.coinRendering?.pickupBodyCount !== 0 ||
            state.forestEnemyRuntime?.scheduledEnemyCount !== 23 ||
            state.forestEnemyRuntime?.individualTimerCount !== 0 ||
            state.forestEnemyRuntime?.aiSchedulerActive !== true ||
            state.forestEnemyRuntime?.proximityActiveCount > 10 ||
            state.forestEnemyRuntime?.sleepingEnemyCount < 13 ||
            state.forestEnemyRuntime?.proximityActiveCount +
                state.forestEnemyRuntime?.sleepingEnemyCount !== 23 ||
            state.forestEnemyRuntime?.enabledBodyCount !==
                state.forestEnemyRuntime?.proximityActiveCount ||
            state.forestEnemyRuntime?.visibleEnemyCount !==
                state.forestEnemyRuntime?.proximityActiveCount ||
            state.forestEnemyRuntime?.renderAttachedEnemyCount !==
                state.forestEnemyRuntime?.proximityActiveCount ||
            state.forestEnemyRuntime?.renderAttachedCueCount !==
                state.forestEnemyRuntime?.proximityActiveCount ||
            state.forestEnemyRuntime?.sleepingDetachedCount !==
                state.forestEnemyRuntime?.sleepingEnemyCount ||
            state.forestEnemyRuntime?.activationBounds?.horizontalMargin !== 520 ||
            state.forestEnemyRuntime?.activationBounds?.verticalMargin !== 280 ||
            state.forestEnemyRuntime?.groundEnemySupportIds?.length !== 5 ||
            new Set(
                state.forestEnemyRuntime?.groundEnemySupportIds || []
            ).size !== 5 ||
            state.forestEnemyRuntime?.unsupportedGroundEnemyIds?.length !== 0 ||
            state.forestEnemyRuntime?.airborneMotionTweenCount !== 0 ||
            state.forestDecorationRendering?.starFragmentTweenCount !== 0 ||
            state.forestDecorationRendering?.landingGuideTweenCount !== 0 ||
            state.forestDecorationRendering?.voidMoteTweenCount !== 0 ||
            state.forestDecorationRendering?.arenaParticleTweenCount !== 0 ||
            state.forestDecorationRendering?.arenaAmbientLayerCount !== 1 ||
            state.forestDecorationRendering?.arenaAmbientTimerActive !== false
        )
    ) {
        throw new Error(
            `${sceneName} exceeded its mobile ambient render budget: ${JSON.stringify(state)}`
        );
    }
    if (
        route === 'crystalCaves' &&
        (
            state.caveCoinRendering?.batchedCount !== 11 ||
            state.caveCoinRendering?.layerCount !== 1 ||
            state.caveCoinRendering?.physicsCoinCount !== 0 ||
            state.caveCrystalRendering?.batchedCount !== 11 ||
            state.caveCrystalRendering?.layerCount !== 1 ||
            state.caveAmbientRendering?.parallaxLayerCount !== 2 ||
            state.caveAmbientRendering?.storyDecorationTweenCount !== 0 ||
            state.caveAmbientRendering?.coinLayerTweenCount !== 0 ||
            state.caveEnemyRuntime?.scheduledEnemyCount !== 8 ||
            state.caveEnemyRuntime?.individualTimerCount !== 2 ||
            state.caveEnemyRuntime?.aiSchedulerActive !== true ||
            state.caveEnemyRuntime?.proximityActiveCount > 3 ||
            state.caveEnemyRuntime?.sleepingEnemyCount < 5 ||
            state.caveEnemyRuntime?.proximityActiveCount +
                state.caveEnemyRuntime?.sleepingEnemyCount !== 8 ||
            state.caveEnemyRuntime?.enabledBodyCount !==
                state.caveEnemyRuntime?.proximityActiveCount ||
            state.caveEnemyRuntime?.renderAttachedEnemyCount !==
                state.caveEnemyRuntime?.proximityActiveCount ||
            state.caveEnemyRuntime?.renderAttachedCueCount !==
                state.caveEnemyRuntime?.proximityActiveCount ||
            state.caveEnemyRuntime?.sleepingDetachedCount !==
                state.caveEnemyRuntime?.sleepingEnemyCount ||
            state.caveEnemyRuntime?.activationBounds?.horizontalMargin !== 520 ||
            state.caveEnemyRuntime?.activationBounds?.verticalMargin !== 280 ||
            state.caveEnemyRuntime?.spiderTimersPaused !== true ||
            state.caveEnemyRuntime?.batMotionTweenCount !== 0 ||
            state.currentEcologyPlacement?.supportId !==
                'caves-chamber-bridge' ||
            state.currentEcologyPlacement?.x <
                state.currentEcologyPlacement?.supportLeft ||
            state.currentEcologyPlacement?.x >
                state.currentEcologyPlacement?.supportRight ||
            Math.abs(
                state.currentEcologyPlacement?.y -
                state.currentEcologyPlacement?.supportTop
            ) > 8 ||
            state.currentEcologyPlacement?.spawnDistance < 1000
        )
    ) {
        throw new Error(
            `${sceneName} did not keep cave ambience batched: ${JSON.stringify(state)}`
        );
    }
    if (
        route === 'reef' &&
        (
            state.reefAmbientRendering?.nebulaLayerCount !== 2 ||
            state.reefAmbientRendering?.riftLayerCount !== 1 ||
            state.reefAmbientRendering?.dustLayerCount !== 1 ||
            state.reefAmbientRendering?.dustParticleCount > 6 ||
            state.reefAmbientRendering?.entryLayerCount > 1 ||
            state.reefAmbientRendering?.decorativeTweenCount !== 0 ||
            state.reefEnemyRuntime?.scheduledEnemyCount !== 8 ||
            state.reefEnemyRuntime?.aiSchedulerActive !== true ||
            state.reefEnemyRuntime?.proximityActiveCount > 2 ||
            state.reefEnemyRuntime?.sleepingEnemyCount < 6 ||
            state.reefEnemyRuntime?.proximityActiveCount +
                state.reefEnemyRuntime?.sleepingEnemyCount !== 8 ||
            state.reefEnemyRuntime?.enabledBodyCount !==
                state.reefEnemyRuntime?.proximityActiveCount ||
            state.reefEnemyRuntime?.renderAttachedGraphicsCount !==
                state.reefEnemyRuntime?.proximityActiveCount ||
            state.reefEnemyRuntime?.renderAttachedCueCount !==
                state.reefEnemyRuntime?.proximityActiveCount ||
            state.reefEnemyRuntime?.sleepingDetachedCount !==
                state.reefEnemyRuntime?.sleepingEnemyCount ||
            state.reefEnemyRuntime?.activationBounds?.horizontalMargin !== 520 ||
            state.reefEnemyRuntime?.activationBounds?.verticalMargin !== 320 ||
            state.reefEnemyRuntime?.physicsOnlyBodyCount !== 34 ||
            state.reefEnemyRuntime?.physicsOnlyDisplayCount !== 0 ||
            state.currentEcologyPlacement?.supportId !== 'reef-opening-3' ||
            state.currentEcologyPlacement?.x <
                state.currentEcologyPlacement?.supportLeft ||
            state.currentEcologyPlacement?.x >
                state.currentEcologyPlacement?.supportRight ||
            Math.abs(
                state.currentEcologyPlacement?.y -
                state.currentEcologyPlacement?.supportTop
            ) > 8 ||
            state.currentEcologyPlacement?.spawnDistance < 450 ||
            state.reefOpeningGuidance?.active !== true ||
            state.reefOpeningGuidance?.departureCueX > 360
        )
    ) {
        throw new Error(
            `${sceneName} did not keep Reef ambience bounded: ${JSON.stringify(state)}`
        );
    }
    if (
        route === 'voidPeaks' &&
        (
            state.peaksAmbientRendering?.starCount !== 35 ||
            state.peaksAmbientRendering?.starLayerCount !== 1 ||
            state.peaksAmbientRendering?.emberCount !== 18 ||
            state.peaksAmbientRendering?.emberLayerCount !== 1 ||
            state.peaksAmbientRendering?.emberVisibleCount > 6 ||
            state.peaksAmbientRendering?.emberDrawCount < 1 ||
            state.peaksAmbientRendering?.patrolUpdateCount < 1 ||
            state.peakEnemyRuntime?.scheduledEnemyCount !== 8 ||
            state.peakEnemyRuntime?.aiSchedulerActive !== true ||
            state.peakEnemyRuntime?.proximityActiveCount > 3 ||
            state.peakEnemyRuntime?.sleepingEnemyCount < 5 ||
            state.peakEnemyRuntime?.proximityActiveCount +
                state.peakEnemyRuntime?.sleepingEnemyCount !== 8 ||
            state.peakEnemyRuntime?.enabledBodyCount !==
                state.peakEnemyRuntime?.proximityActiveCount ||
            state.peakEnemyRuntime?.renderAttachedEnemyCount !==
                state.peakEnemyRuntime?.proximityActiveCount ||
            state.peakEnemyRuntime?.renderAttachedCueCount !==
                state.peakEnemyRuntime?.proximityActiveCount ||
            state.peakEnemyRuntime?.sleepingDetachedCount !==
                state.peakEnemyRuntime?.sleepingEnemyCount ||
            state.peakEnemyRuntime?.runtimePatrolCount !==
                state.peakEnemyRuntime?.proximityActiveCount ||
            state.peakEnemyRuntime?.activationBounds?.horizontalMargin !== 520 ||
            state.peakEnemyRuntime?.activationBounds?.verticalMargin !== 280 ||
            state.peakEnemyRuntime?.patrolUpdateCount < 1 ||
            state.currentEcologyPlacement?.supportId !==
                'peak-ridge-approach' ||
            state.currentEcologyPlacement?.x <
                state.currentEcologyPlacement?.supportLeft ||
            state.currentEcologyPlacement?.x >
                state.currentEcologyPlacement?.supportRight ||
            Math.abs(
                state.currentEcologyPlacement?.y -
                state.currentEcologyPlacement?.supportTop
            ) > 8 ||
            state.currentEcologyPlacement?.spawnDistance < 1200
        )
    ) {
        throw new Error(
            `${sceneName} did not keep Peaks ambience and opening bounded: ` +
            JSON.stringify(state)
        );
    }
    if (
        route === 'auroraDepths' &&
        (
            state.auroraAmbientRendering?.shadowCurrentCount !== 3 ||
            state.auroraAmbientRendering?.shadowCurrentLabelCount !== 3 ||
            state.auroraAmbientRendering?.shadowPulseTweenCount !== 1 ||
            state.auroraAmbientRendering?.fragmentCount !== 5 ||
            state.auroraAmbientRendering?.fragmentPulseTweenCount !== 0 ||
            state.auroraAmbientRendering?.landingGuideTweenCount !== 0 ||
            state.auroraAmbientRendering?.quietRouteTweenCount !== 0 ||
            state.auroraAmbientRendering?.optionalPickupTweenCount !== 0 ||
            state.auroraEnemyRuntime?.scheduledEnemyCount !== 8 ||
            state.auroraEnemyRuntime?.aiSchedulerActive !== true ||
            state.auroraEnemyRuntime?.proximityActiveCount > 3 ||
            state.auroraEnemyRuntime?.sleepingEnemyCount < 5 ||
            state.auroraEnemyRuntime?.proximityActiveCount +
                state.auroraEnemyRuntime?.sleepingEnemyCount !== 8 ||
            state.auroraEnemyRuntime?.enabledBodyCount !==
                state.auroraEnemyRuntime?.proximityActiveCount ||
            state.auroraEnemyRuntime?.renderAttachedEnemyCount !==
                state.auroraEnemyRuntime?.proximityActiveCount ||
            state.auroraEnemyRuntime?.renderAttachedCueCount !==
                state.auroraEnemyRuntime?.proximityActiveCount ||
            state.auroraEnemyRuntime?.sleepingDetachedCount !==
                state.auroraEnemyRuntime?.sleepingEnemyCount ||
            state.auroraEnemyRuntime?.runtimePatrolCount !==
                state.auroraEnemyRuntime?.proximityActiveCount ||
            state.auroraEnemyRuntime?.activationBounds?.horizontalMargin !== 520 ||
            state.auroraEnemyRuntime?.activationBounds?.verticalMargin !== 280 ||
            state.auroraEnemyRuntime?.patrolUpdateCount < 1
        )
    ) {
        throw new Error(
            `${sceneName} did not keep Aurora hazards readable and batched: ` +
            JSON.stringify(state.auroraAmbientRendering)
        );
    }
    if (
        route === 'finalVoid' &&
        (
            state.currentEcologyPlacement?.supportId !==
                'final-return-approach' ||
            state.currentEcologyPlacement?.x <
                state.currentEcologyPlacement?.supportLeft ||
            state.currentEcologyPlacement?.x >
                state.currentEcologyPlacement?.supportRight ||
            Math.abs(
                state.currentEcologyPlacement?.y -
                state.currentEcologyPlacement?.supportTop
            ) > 8 ||
            state.currentEcologyPlacement?.spawnDistance < 850
        )
    ) {
        throw new Error(
            `${sceneName} placed the Current Heart inside its opening viewport: ` +
            JSON.stringify(state.currentEcologyPlacement)
        );
    }
    const renderBudget = CAMPAIGN_MOBILE_RENDER_BUDGETS[route];
    if (!renderBudget) {
        throw new Error(`${sceneName} has no authored mobile render budget`);
    }
    await waitFor(
        () => evaluate(session, `(() => {
            const scene = window.mythicalGame?.scene?.getScene?.(
                ${JSON.stringify(sceneName)}
            );
            if (!scene?.scene?.isActive?.()) return false;
            return (
                (scene.children?.list?.length || 0) <= ${renderBudget.displayCount} &&
                (scene.tweens?.getTweens?.().length || 0) <= ${renderBudget.activeTweenCount}
            );
        })()`),
        {
            timeoutMs: 4500,
            message: `${sceneName} entry effects retired within render budget`
        }
    );
    let renderStability = null;
    const framePacing = await sampleFramePacing(session, sceneName);
    if (!framePacing?.sceneActive || framePacing.frameCount < 12) {
        throw new Error(
            `${sceneName} did not produce a sustained frame sample: ` +
            JSON.stringify(framePacing)
        );
    }
    const framePacingSamples = [framePacing];
    if (SMOKE_CASE !== 'all' && framePacing.p95FrameMs > 100) {
        const confirmation = await sampleFramePacing(session, sceneName, {
            warmupMs: 400
        });
        if (!confirmation?.sceneActive || confirmation.frameCount < 12) {
            throw new Error(
                `${sceneName} did not produce a sustained confirmation frame sample: ` +
                JSON.stringify(confirmation)
            );
        }
        framePacingSamples.push(confirmation);
    }
    const sustainedP95OverBudget =
        SMOKE_CASE !== 'all' &&
        framePacingSamples.every(sample => sample.p95FrameMs > 100);
    process.stdout.write(
        `PERF ${sceneName} ` + JSON.stringify({
            averageFps: framePacing.averageFps,
            p95FrameMs: framePacing.p95FrameMs,
            p95FrameSamples: framePacingSamples.map(
                sample => sample.p95FrameMs
            ),
            phaserActualFps: framePacing.phaserActualFps,
            displayCount: framePacing.displayCount,
            activeTweenCount: framePacing.activeTweenCount,
            timerCount: framePacing.timerCount,
            postPipelineCount: framePacing.postPipelineCount,
            performanceTier: framePacing.performanceTier
        }) + '\n'
    );
    if (
        framePacing.displayCount > renderBudget.displayCount ||
        framePacing.activeTweenCount > renderBudget.activeTweenCount ||
        !Number.isFinite(
            framePacing.objectiveHudRendering?.rebuildsDuringSample
        ) ||
        framePacing.objectiveHudRendering?.rebuildsDuringSample > 2 ||
        (
            framePacing.performanceTier === 'mobile' &&
            framePacing.sharedAmbientFieldTweenCount !== 0
        ) ||
        framePacing.postPipelineCount !== 0 ||
        framePacing.performanceTier !== renderBudget.performanceTier ||
        sustainedP95OverBudget
    ) {
        throw new Error(
            `${sceneName} exceeded its sustained mobile render budget: ` +
            JSON.stringify({ renderBudget, framePacingSamples })
        );
    }
    if (
        route === 'crystalCaves' &&
        (state.canvasWidth <= 480 || state.canvasHeight < 620) &&
        [
            'depth:-5:visible',
            'depth:44:visible',
            'depth:45:visible',
            'depth:84:visible'
        ].some(depth => framePacing.graphicsTweenDepths?.[depth])
    ) {
        throw new Error(
            `${sceneName} kept offscreen cave guidance animating on mobile: ` +
            JSON.stringify(framePacing.graphicsTweenDepths)
        );
    }
    if (route === 'mythicalForest') {
        if (
            !framePacing.forestEnemyOverlapActive ||
            framePacing.parallaxLayers?.nebula !== 3 ||
            framePacing.parallaxLayers?.starField !== 2 ||
            framePacing.parallaxLayers?.rock !== 2 ||
            framePacing.parallaxLayers?.floraField !== 1
        ) {
            throw new Error(
                `${sceneName} exceeded its sustained mobile render budget: ` +
                JSON.stringify(framePacing)
            );
        }
        renderStability = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
            const startCount = scene.children?.list?.length || 0;
            return new Promise(resolve => {
                setTimeout(() => resolve({
                    startCount,
                    endCount: scene.children?.list?.length || 0,
                    trailLayerCount: scene.children?.list?.filter(
                        item => item === scene.forestEnemyTrailLayer
                    ).length || 0
                }), 700);
            });
        })()`);
        if (
            renderStability.endCount > renderStability.startCount + 8 ||
            renderStability.endCount > 345 ||
            renderStability.trailLayerCount !== 1
        ) {
            throw new Error(
                `${sceneName} leaked render objects while idle: ` +
                JSON.stringify(renderStability)
            );
        }
    }
    if (
        route === 'finalVoid' &&
        (state.canvasWidth <= 480 || state.canvasHeight < 620) &&
        [
            'depth:106:visible',
            'depth:115:visible',
            'depth:179:visible'
        ].some(depth => framePacing.graphicsTweenDepths?.[depth])
    ) {
        throw new Error(
            `${sceneName} kept offscreen route decorations animating on mobile: ` +
            JSON.stringify(framePacing.graphicsTweenDepths)
        );
    }
    if (
        framePacing.landingDustTweenCount > 3 ||
        framePacing.landingDustOrphanTweenCount !== 0
    ) {
        throw new Error(
            `${sceneName} leaked landing feedback work after settlement: ` +
            JSON.stringify(framePacing)
        );
    }
    if (
        route === 'voidPeaks' &&
        (
            framePacing.peaksRuntime?.emberRedrawsDuringSample > 4 ||
            framePacing.peaksRuntime?.emberVisibleCount > 6 ||
            framePacing.peaksRuntime?.patrolUpdatesDuringSample < 10 ||
            framePacing.peaksRuntime?.patrolUpdatesDuringSample > 28
        )
    ) {
        throw new Error(
            `${sceneName} did not keep Peaks runtime work bounded: ` +
            JSON.stringify(framePacing.peaksRuntime)
        );
    }
    if (
        route === 'voidPeaks' &&
        (state.canvasWidth <= 480 || state.canvasHeight < 620) &&
        [
            'depth:120:visible',
            'depth:130:visible',
            'depth:179:visible'
        ].some(depth => framePacing.graphicsTweenDepths?.[depth])
    ) {
        throw new Error(
            `${sceneName} kept whole-route scenery animating on mobile: ` +
            JSON.stringify(framePacing.graphicsTweenDepths)
        );
    }
    if (
        route === 'auroraDepths' &&
        (
            framePacing.auroraRuntime?.patrolUpdatesDuringSample < 10 ||
            framePacing.auroraRuntime?.patrolUpdatesDuringSample > 28 ||
            framePacing.auroraRuntime?.runtimeEnemyCount > 3
        )
    ) {
        throw new Error(
            `${sceneName} did not keep Aurora patrol work bounded: ` +
            JSON.stringify(framePacing.auroraRuntime)
        );
    }
    if (
        route === 'auroraDepths' &&
        (state.canvasWidth <= 480 || state.canvasHeight < 620) &&
        [
            'depth:105:visible',
            'depth:179:visible'
        ].some(depth => framePacing.graphicsTweenDepths?.[depth])
    ) {
        throw new Error(
            `${sceneName} kept whole-route Aurora guidance animating on mobile: ` +
            JSON.stringify(framePacing.graphicsTweenDepths)
        );
    }
    const forestEnemyActivation = route === 'mythicalForest'
        ? await smokeForestEnemyActivationWindow(session)
        : null;
    const forestEnemyScheduler = route === 'mythicalForest'
        ? await smokeForestSharedEnemyScheduler(session)
        : null;
    const forestCoinPickup = route === 'mythicalForest'
        ? await smokeForestBatchedCoinPickup(session)
        : null;
    const caveCoinPickup = route === 'crystalCaves'
        ? await smokeCaveBatchedCoinPickup(session)
        : null;
    const reefTrailBudget = route === 'reef'
        ? await smokeReefTrailBudget(session)
        : null;
    const peakEnemyActivation = route === 'voidPeaks'
        ? await smokePeakEnemyActivationWindow(session)
        : null;
    const auroraEnemyActivation = route === 'auroraDepths'
        ? await smokeAuroraEnemyActivationWindow(session)
        : null;
    if (
        [
            'mythicalForest',
            'crystalCaves',
            'reef',
            'voidPeaks',
            'auroraDepths',
            'finalVoid'
        ].includes(route) &&
        (
            state.enemyCount < 1 ||
            state.combatCueCount !== state.enemyCount
        )
    ) {
        throw new Error(
            `${sceneName} has enemies without combat readability cues: ${JSON.stringify(state)}`
        );
    }
    if (
        route === 'voidPeaks' &&
        (
            state.encounterRhythm?.count < 8 ||
            state.encounterRhythm.clearCount < 1 ||
            state.encounterRhythm.armoredCount < 4 ||
            state.encounterRhythm.mainCount < 2 ||
            state.encounterRhythm.optionalCount !== 0 ||
            state.encounterRhythm.unsupported.length > 0
        )
    ) {
        throw new Error(
            `${sceneName} has no deliberate encounter rhythm: ${JSON.stringify(
                state.encounterRhythm
            )}`
        );
    }
    if (
        route === 'crystalCaves' &&
        (
            state.encounterRhythm?.count < 8 ||
            state.encounterRhythm.clearCount < 3 ||
            state.encounterRhythm.armoredCount < 3 ||
            state.encounterRhythm.mainCount < 1 ||
            state.encounterRhythm.optionalCount < 1 ||
            state.encounterRhythm.unsupported.length > 0
        )
    ) {
        throw new Error(
            `${sceneName} has no deliberate encounter rhythm: ${JSON.stringify(
                state.encounterRhythm
            )}`
        );
    }
    if (
        route === 'reef' &&
        (
            state.encounterRhythm?.count !== 8 ||
            state.encounterRhythm.clearCount < 4 ||
            state.encounterRhythm.armoredCount < 2 ||
            state.encounterRhythm.mainCount < 1 ||
            state.encounterRhythm.optionalCount < 1 ||
            state.encounterRhythm.unsupported.length > 0
        )
    ) {
        throw new Error(
            `${sceneName} has no deliberate encounter rhythm: ${JSON.stringify(
                state.encounterRhythm
            )}`
        );
    }
    if (
        route === 'auroraDepths' &&
        (
            state.encounterRhythm?.count < 8 ||
            state.encounterRhythm.clearCount < 1 ||
            state.encounterRhythm.armoredCount < 4 ||
            state.encounterRhythm.mainCount < 2 ||
            state.encounterRhythm.optionalCount !== 0 ||
            state.encounterRhythm.unsupported.length > 0
        )
    ) {
        throw new Error(
            `${sceneName} has no deliberate encounter rhythm: ${JSON.stringify(
                state.encounterRhythm
            )}`
        );
    }
    if (
        route === 'finalVoid' &&
        (
            state.encounterRhythm?.count < 8 ||
            state.encounterRhythm.clearCount < 3 ||
            state.encounterRhythm.heavyCount < 3 ||
            state.encounterRhythm.mainCount < 2 ||
            state.encounterRhythm.optionalCount < 1 ||
            state.encounterRhythm.unsupported.length > 0
        )
    ) {
        throw new Error(
            `${sceneName} has no deliberate encounter rhythm: ${JSON.stringify(
                state.encounterRhythm
            )}`
        );
    }
    const guardianGate = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
        const gate = scene?.guardianGateState;
        if (!gate) return null;
        return {
            title: gate.title,
            status: gate.status,
            ready: gate.ready,
            visible: gate.visual?.visible !== false && gate.label?.visible !== false,
            label: gate.label?.text || ''
        };
    })()`);
    const expectedGateTitle = {
        mythicalForest: 'ELDER GROVE',
        crystalCaves: 'CRYSTAL CORE',
        reef: 'STELLAR PASSAGE',
        voidPeaks: 'TITAN PASS',
        auroraDepths: 'PHOENIX SHIELD',
        finalVoid: 'EMPRESS SEAL'
    }[route];
    if (
        guardianGate?.title !== expectedGateTitle ||
        guardianGate.ready !== false ||
        guardianGate.visible !== true ||
        guardianGate.status === 'READY // ENTER' ||
        !guardianGate.label.includes(expectedGateTitle)
    ) {
        throw new Error(
            `${sceneName} has no readable locked guardian gate: ${JSON.stringify(guardianGate)}`
        );
    }
    if ([
        'mythicalForest',
        'crystalCaves',
        'reef',
        'voidPeaks',
        'auroraDepths',
        'finalVoid'
    ].includes(route)) {
        const guidance = state.routeGuidance;
        if (
            !guidance?.supported ||
            !/^SIGNAL (RIGHT|LEFT|CLOSE)/.test(guidance.compass) ||
            guidance.nextSignalIndex !== 0 ||
            guidance.nextSignalVisible !== true ||
            guidance.nextSignalEmphasized !== true
        ) {
            throw new Error(
                `${sceneName} has no readable opening route guidance: ${JSON.stringify(guidance)}`
            );
        }
    }
    const traversalAudit = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
        const signals = scene?.orderedRouteSignals || [];
        const optionalCandidates = [
            ...(scene?.starFragmentSprites || []).map(entry => entry?.pickupZone),
            ...(scene?.starFragments || []),
            ...(scene?.collectibles?.getChildren?.() || []),
            scene?.optionalRoutePickup
        ].filter(item => item?.active !== false && item?.optionalRouteId);
        const targets = signals.map(signal => ({
            id: \`signal_\${Number(signal?.index) + 1}\`,
            x: signal?.x,
            y: signal?.y
        }));
        optionalCandidates.forEach((item, index) => targets.push({
            id: \`optional_reward_\${index + 1}\`,
            x: item.x,
            y: item.y
        }));
        if (scene?.guardianGateState) {
            targets.push({
                id: 'guardian_entrance',
                x: scene.guardianGateState.x,
                y: scene.guardianGateState.y
            });
        }
        return scene?.getPlatformTraversalAudit?.({ targets }) || null;
    })()`);
    if (
        !traversalAudit ||
        traversalAudit.platformCount < 1 ||
        traversalAudit.startPlatformIndex === null ||
        traversalAudit.unreachableTargets?.length
    ) {
        throw new Error(
            `${sceneName} has unreachable campaign targets: ${JSON.stringify(traversalAudit)}`
        );
    }
    trace('live gameplay verified', state);
    if (SMOKE_VIDEO_PATH) {
        await startGameplayVideo(session);
        await delay(700);
    }
    if (SMOKE_TRACE) {
        const heartbeatBefore = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            return {
                time: scene?.time?.now,
                timePaused: scene?.time?.paused,
                status: scene?.sys?.settings?.status,
                canInput: scene?.sys?.canInput?.(),
                frame: window.mythicalGame?.loop?.frame,
                playerX: scene?.player?.x,
                playerY: scene?.player?.y
            };
        })()`);
        await delay(300);
        const heartbeatAfter = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            return {
                time: scene?.time?.now,
                timePaused: scene?.time?.paused,
                status: scene?.sys?.settings?.status,
                canInput: scene?.sys?.canInput?.(),
                frame: window.mythicalGame?.loop?.frame,
                playerX: scene?.player?.x,
                playerY: scene?.player?.y
            };
        })()`);
        trace('scene heartbeat', { before: heartbeatBefore, after: heartbeatAfter });
    }

    const joystick = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
        return {
            centerX: scene?.joystickCenterX,
            centerY: scene?.joystickCenterY,
            maxDistance: scene?.joystickMaxDistance,
            playerX: scene?.player?.x
        };
    })()`);
    if (![joystick.centerX, joystick.centerY, joystick.maxDistance, joystick.playerX]
        .every(Number.isFinite)) {
        throw new Error(`${sceneName} has no usable mobile joystick: ${JSON.stringify(joystick)}`);
    }

    const jumpControl = await waitFor(
        () => evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            const target = scene?.mobileControlTargets?.jump;
            if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) {
                return null;
            }
            return { x: target.x, y: target.y };
        })()`),
        { timeoutMs: 5000, message: `${sceneName} jump control` }
    );
    if (route !== 'reef') {
        await waitFor(
            () => evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                const supported = Boolean(
                    scene?.isGrounded || scene?.player?.body?.blocked?.down
                );
                const velocityY = scene?.player?.body?.velocity?.y;
                const inputReady = scene?.canJump !== false &&
                    (Number(scene?.recoveryInputLockedUntil) || 0) <= scene.time.now;
                return supported && inputReady &&
                    Number.isFinite(velocityY) && velocityY >= -1;
            })()`),
            { timeoutMs: 5000, message: `${sceneName} jump-ready support` }
        );
    }
    const beforeJump = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
        const body = scene?.player?.body;
        const support = (scene?.platforms?.getChildren?.() || []).find(platform =>
            platform?.body &&
            body?.center?.x >= platform.body.left &&
            body?.center?.x <= platform.body.right &&
            Math.abs(body.bottom - platform.body.top) <= 10
        );
        const supportMargin = Math.min(100, Math.max(30, (support?.body?.width || 0) / 4));
        const steeringX = support?.body
            ? Math.max(
                support.body.left + supportMargin,
                Math.min(support.x, support.body.right - supportMargin)
            )
            : scene?.player?.x;
        return {
            playerX: scene?.player?.x,
            playerY: scene?.player?.y,
            velocityY: scene?.player?.body?.velocity?.y,
            steeringX,
            supportId: support?.traversalId || null
        };
    })()`);
    const jumpProbeStarted = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
        if (!scene?.events || !scene?.player?.body) return false;
        scene.__smokeJumpProbeHandler &&
            scene.events.off('update', scene.__smokeJumpProbeHandler);
        scene.__smokeJumpProbe = {
            minPlayerY: scene.player.y,
            minVelocityY: scene.player.body.velocity.y,
            sampleCount: 0
        };
        scene.__smokeJumpProbeHandler = () => {
            const probe = scene.__smokeJumpProbe;
            if (!probe || !scene.player?.body) return;
            probe.minPlayerY = Math.min(probe.minPlayerY, scene.player.y);
            probe.minVelocityY = Math.min(
                probe.minVelocityY,
                scene.player.body.velocity.y
            );
            probe.sampleCount += 1;
        };
        scene.events.on('update', scene.__smokeJumpProbeHandler);
        scene.__smokeNativeJumpTouches = [];
        scene.__smokeNativeJumpTouchHandler = event => {
            const rect = scene.game.canvas.getBoundingClientRect();
            scene.__smokeNativeJumpTouches.push({
                changed: Array.from(event.changedTouches || []).map(touch => ({
                    id: touch.identifier,
                    clientX: touch.clientX,
                    clientY: touch.clientY
                })),
                canvas: {
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height
                }
            });
        };
        scene.game.canvas.addEventListener(
            'touchstart',
            scene.__smokeNativeJumpTouchHandler,
            { capture: true }
        );
        return true;
    })()`);
    if (!jumpProbeStarted) {
        throw new Error(`${sceneName} could not start jump-frame telemetry`);
    }
    const clearJumpProbe = () => evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
        if (scene?.__smokeJumpProbeHandler) {
            scene.events?.off?.('update', scene.__smokeJumpProbeHandler);
        }
        if (scene?.__smokeNativeJumpTouchHandler) {
            scene.game?.canvas?.removeEventListener(
                'touchstart',
                scene.__smokeNativeJumpTouchHandler,
                true
            );
        }
        delete scene?.__smokeJumpProbeHandler;
        delete scene?.__smokeJumpProbe;
        delete scene?.__smokeNativeJumpTouchHandler;
        delete scene?.__smokeNativeJumpTouches;
        return true;
    })()`);
    // A genuine tap can begin and end between two low-FPS Phaser updates.
    // The game must preserve that edge until gameplay consumes it.
    await touch(session, jumpControl.x, jumpControl.y);
    let jumped = null;
    try {
        jumped = await waitFor(
            async () => {
                const response = await evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                    return {
                        playerY: scene?.player?.y,
                        velocityY: scene?.player?.body?.velocity?.y,
                        virtualJumpPressed: scene?.virtualJumpPressed,
                        virtualJumpQueued: scene?.virtualJumpQueued,
                        isSwimmingUp: scene?.isSwimmingUp,
                        minPlayerY: scene?.__smokeJumpProbe?.minPlayerY,
                        minVelocityY: scene?.__smokeJumpProbe?.minVelocityY,
                        sampleCount: scene?.__smokeJumpProbe?.sampleCount
                    };
                })()`);
                const observedVelocityY = Math.min(
                    response.velocityY,
                    Number(response.minVelocityY) || response.velocityY
                );
                const observedPlayerY = Math.min(
                    response.playerY,
                    Number(response.minPlayerY) || response.playerY
                );
                const responded = route === 'reef'
                    ? observedVelocityY < beforeJump.velocityY - 5 ||
                        observedPlayerY < beforeJump.playerY - 2
                    : observedVelocityY < -20 ||
                        observedPlayerY < beforeJump.playerY - 2;
                return responded ? {
                    ...response,
                    playerY: observedPlayerY,
                    velocityY: observedVelocityY
                } : null;
            },
            // Software-rendered campaign runs can briefly stall while the first
            // level's larger asset set is promoted. Preserve a strict response
            // assertion without making the suite depend on one 1.5s load spike.
            { timeoutMs: 2500, message: `${sceneName} short jump tap response` }
        );
    } catch (error) {
        const diagnostics = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            const target = scene?.mobileControlTargets?.jump;
            return {
                actualFps: window.mythicalGame?.loop?.actualFps,
                gameFrame: window.mythicalGame?.loop?.frame,
                sceneTime: scene?.time?.now,
                playerY: scene?.player?.y,
                velocityY: scene?.player?.body?.velocity?.y,
                isGrounded: scene?.isGrounded,
                blockedDown: scene?.player?.body?.blocked?.down,
                canJump: scene?.canJump,
                isDucking: scene?.isDucking,
                recoveryInputLockedUntil: scene?.recoveryInputLockedUntil,
                virtualJumpPressed: scene?.virtualJumpPressed,
                virtualJumpQueued: scene?.virtualJumpQueued,
                jumpBufferPressed: scene?.jumpBufferPressed,
                jumpBufferTimestamp: scene?.jumpBufferTimestamp,
                lastVirtualJumpResolution: scene?.lastVirtualJumpResolution || null,
                actionPointerCount: scene?.actionButtonPointers?.size,
                actionReleaseCount: scene?.actionButtonReleases?.size,
                jumpProbe: scene?.__smokeJumpProbe || null,
                nativeJumpTouches: scene?.__smokeNativeJumpTouches || [],
                scale: {
                    width: scene?.scale?.width,
                    height: scene?.scale?.height,
                    displayScaleX: scene?.scale?.displayScale?.x,
                    displayScaleY: scene?.scale?.displayScale?.y
                },
                viewport: {
                    innerWidth: window.innerWidth,
                    innerHeight: window.innerHeight,
                    visualWidth: window.visualViewport?.width,
                    visualHeight: window.visualViewport?.height,
                    visualScale: window.visualViewport?.scale
                },
                jumpTarget: target ? {
                    x: target.x,
                    y: target.y,
                    visible: target.zone?.visible,
                    active: target.zone?.active,
                    inputEnabled: target.zone?.input?.enabled
                } : null
            };
        })()`);
        await clearJumpProbe();
        throw new Error(`${error.message}: ${JSON.stringify(diagnostics)}`);
    }
    await clearJumpProbe();
    await delay(120);
    const jumpReleased = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
        return {
            virtualJumpPressed: scene?.virtualJumpPressed,
            virtualJumpQueued: scene?.virtualJumpQueued,
            isSwimmingUp: scene?.isSwimmingUp,
            jumpKeyDown: scene?.jumpKey?.isDown,
            cursorUpDown: scene?.cursors?.up?.isDown,
            wasdUpDown: scene?.wasdKeys?.W?.isDown,
            actionPointers: Array.from(scene?.actionButtonPointers || []),
            actionReleases: Array.from(scene?.actionButtonReleases?.keys?.() || [])
        };
    })()`);
    const jumpResponded = route === 'reef'
        ? jumped.velocityY < beforeJump.velocityY - 5 ||
            jumped.playerY < beforeJump.playerY - 2
        : jumped.velocityY < -20 || jumped.playerY < beforeJump.playerY - 2;
    if (!jumpResponded) {
        throw new Error(`${sceneName} did not respond to jump touch: ${JSON.stringify({
            before: beforeJump,
            during: jumped,
            control: jumpControl
        })}`);
    }
    if (
        jumpReleased.virtualJumpPressed ||
        jumpReleased.virtualJumpQueued ||
        jumpReleased.isSwimmingUp
    ) {
        throw new Error(`${sceneName} retained jump input after touch release: ${JSON.stringify(jumpReleased)}`);
    }

    // Steering is a separate contract from jump recovery. Restore the exact
    // supported pre-jump position so a low-frame-rate run cannot fall below
    // the level and reset the joystick midway through the opposite direction.
    await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
        scene.releaseAllPlatformerActionButtons?.();
        scene.resetJoystick?.();
        scene.player.body.reset(${beforeJump.steeringX}, ${beforeJump.playerY});
        scene.player.setVelocity?.(0, 0);
        return true;
    })()`);
    if (route !== 'reef') {
        await waitFor(
            () => evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                return Boolean(scene?.isGrounded || scene?.player?.body?.blocked?.down);
            })()`),
            { timeoutMs: 2500, message: `${sceneName} grounded before steering` }
        );
    } else {
        await delay(150);
    }
    joystick.playerX = beforeJump.steeringX;

    const dragDistance = Math.max(28, Math.min(joystick.maxDistance, 48));
    trace('right drag ready', { joystick, dragDistance });
    if (SMOKE_TRACE) {
        const inputTargets = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            return (scene?.input?._list || []).map((item, index) => ({
                index,
                type: item.type,
                name: item.name,
                x: item.x,
                y: item.y,
                width: item.width,
                height: item.height,
                depth: item.depth,
                visible: item.visible,
                active: item.active,
                pointerdownListeners: item.listenerCount?.('pointerdown') || 0
            }));
        })()`);
        trace('input targets', inputTargets);
        const touchListeners = await evaluate(session, `(() => {
            if (typeof getEventListeners !== 'function') return null;
            const summarize = target => (getEventListeners(target).touchstart || []).map(item => ({
                passive: item.passive,
                once: item.once,
                source: String(item.listener).slice(0, 240)
            }));
            return {
                document: summarize(document),
                window: summarize(window),
                canvas: summarize(window.mythicalGame?.canvas)
            };
        })()`);
        trace('touch listeners', touchListeners);
    }
    if (SMOKE_TOUCH_PROBE === 'outside') {
        trace('outside touch probe');
        await touch(session, state.canvasWidth - 4, 4);
        return { ...state, probe: 'outside' };
    }
    if (SMOKE_POINTER_PROBE === 'direct') {
        const direct = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            const target = scene?.input?._list?.[0];
            target?.emit?.('pointerdown', {
                id: 23,
                x: ${joystick.centerX},
                y: ${joystick.centerY}
            });
            return {
                joystickActive: scene?.joystickActive,
                pointerId: scene?.joystickPointerId
            };
        })()`);
        trace('direct pointer probe', direct);
        return { ...state, probe: direct };
    }
    await holdTouchDrag(
        session,
        { x: joystick.centerX, y: joystick.centerY },
        { x: joystick.centerX + dragDistance, y: joystick.centerY },
        SMOKE_VIDEO_PATH ? 1500 : 450
    );
    const movedRight = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
        return {
            playerX: scene?.player?.x,
            playerY: scene?.player?.y,
            velocityX: scene?.player?.body?.velocity?.x,
            velocityY: scene?.player?.body?.velocity?.y,
            blocked: scene?.player?.body?.blocked,
            touching: scene?.player?.body?.touching,
            embedded: scene?.player?.body?.embedded,
            inputX: scene?.virtualJoystickX,
            sceneTime: scene?.time?.now,
            recoveryInputLockedUntil: scene?.recoveryInputLockedUntil,
            isDucking: scene?.isDucking,
            isPlayerDead: scene?.isPlayerDead,
            levelCompletionActive: scene?.levelCompletionActive
        };
    })()`);
    await releaseTouch(session);
    await delay(SMOKE_VIDEO_PATH ? 450 : 150);
    const rightReleased = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
        return scene?.virtualJoystickX;
    })()`);
    if (!(movedRight.inputX > 0.2 && movedRight.playerX > joystick.playerX + 2)) {
        throw new Error(`${sceneName} did not move right from touch input: ${JSON.stringify({
            before: joystick,
            during: movedRight
        })}`);
    }
    if (Math.abs(rightReleased || 0) > 0.05) {
        throw new Error(`${sceneName} retained right input after touch release: ${rightReleased}`);
    }
    if (SMOKE_VIDEO_PATH && route !== 'reef') {
        await waitFor(
            () => evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                return Boolean(scene?.isGrounded || scene?.player?.body?.blocked?.down);
            })()`),
            { timeoutMs: 3000, message: `${sceneName} grounded for filmed jump` }
        );
        await touch(session, jumpControl.x, jumpControl.y);
        await delay(850);
    }

    await holdTouchDrag(
        session,
        { x: joystick.centerX, y: joystick.centerY },
        { x: joystick.centerX - dragDistance, y: joystick.centerY },
        SMOKE_VIDEO_PATH ? 950 : 700
    );
    const movedLeft = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
        return {
            playerX: scene?.player?.x,
            velocityX: scene?.player?.body?.velocity?.x,
            inputX: scene?.virtualJoystickX
        };
    })()`);
    await releaseTouch(session);
    await delay(150);
    const leftReleased = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
        return scene?.virtualJoystickX;
    })()`);
    const leftResponse = movedLeft.playerX < movedRight.playerX - 2 ||
        movedLeft.velocityX < -20;
    if (!(movedLeft.inputX < -0.2 && leftResponse)) {
        throw new Error(`${sceneName} did not move left from touch input: ${JSON.stringify({
            afterRight: movedRight,
            duringLeft: movedLeft
        })}`);
    }
    if (Math.abs(leftReleased || 0) > 0.05) {
        throw new Error(`${sceneName} retained left input after touch release: ${leftReleased}`);
    }

    const returnCurrents = route === 'voidPeaks'
        ? await smokeVoidPeaksReturnCurrents(session)
        : null;
    const reefAscentCurrent = route === 'reef'
        ? await smokeReefAscentCurrent(session)
        : null;
    const reefForwardCurrents = route === 'reef'
        ? await smokeReefForwardCurrents(session)
        : null;

    let verticalJoystick = null;
    if (route === 'reef') {
        const verticalStart = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            scene.player.setVelocity?.(0, 0);
            return { y: scene.player.y };
        })()`);
        await holdTouchDrag(
            session,
            { x: joystick.centerX, y: joystick.centerY },
            { x: joystick.centerX, y: joystick.centerY - dragDistance },
            500
        );
        const movedUp = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            return {
                playerY: scene?.player?.y,
                velocityY: scene?.player?.body?.velocity?.y,
                inputY: scene?.virtualJoystickY,
                isSwimmingUp: scene?.isSwimmingUp === true
            };
        })()`);
        await releaseTouch(session);
        await delay(120);
        const upReleased = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            return scene?.virtualJoystickY;
        })()`);
        if (
            !(movedUp.inputY < -0.2) ||
            !(movedUp.velocityY < -20 || movedUp.playerY < verticalStart.y - 2) ||
            Math.abs(upReleased || 0) > 0.05
        ) {
            throw new Error(`${sceneName} did not swim upward from joystick input: ${JSON.stringify({
                verticalStart,
                movedUp,
                upReleased
            })}`);
        }

        const downStart = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            scene.player.setVelocity?.(0, 0);
            return { y: scene.player.y };
        })()`);
        await holdTouchDrag(
            session,
            { x: joystick.centerX, y: joystick.centerY },
            { x: joystick.centerX, y: joystick.centerY + dragDistance },
            500
        );
        const movedDown = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            return {
                playerY: scene?.player?.y,
                velocityY: scene?.player?.body?.velocity?.y,
                inputY: scene?.virtualJoystickY,
                isDucking: scene?.isDucking === true
            };
        })()`);
        await releaseTouch(session);
        await delay(120);
        const downReleased = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            return scene?.virtualJoystickY;
        })()`);
        if (
            !(movedDown.inputY > 0.2) ||
            !(movedDown.velocityY > 20 || movedDown.playerY > downStart.y + 2) ||
            movedDown.isDucking ||
            Math.abs(downReleased || 0) > 0.05
        ) {
            throw new Error(`${sceneName} did not dive from joystick input: ${JSON.stringify({
                downStart,
                movedDown,
                downReleased
            })}`);
        }
        verticalJoystick = { movedUp, movedDown };
    }

    const liveStompSetup = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
        const target = scene?.enemies?.getChildren?.().find(enemy => (
            enemy?.active !== false &&
            enemy?.body &&
            enemy?.combatRole === 'armored' &&
            enemy?.stompable !== false &&
            enemy?.combatImmune !== true &&
            Number(enemy?.health) >= 2
        ));
        if (!scene?.player?.body || !target) return null;

        const targetY = Math.max(320, Math.min(scene.levelHeight - 260, 480));
        const playerHeight = Math.max(1, Number(scene.player.body.height) || 55);
        const targetHeight = Math.max(1, Number(target.body.height) || 50);
        const playerY = targetY - (playerHeight + targetHeight) / 2 - 85;
        const platformBodies = scene.platforms?.getChildren?.()
            .map(platform => platform?.body)
            .filter(Boolean) || [];
        const candidates = [220, 520, 820, 1120, 1420, 1720]
            .filter(x => x < scene.levelWidth - 160);
        const targetX = candidates.find(x => !platformBodies.some(body => (
            x >= Number(body.left) - 55 &&
            x <= Number(body.right) + 55 &&
            Number(body.top) >= playerY - 30 &&
            Number(body.top) <= targetY + targetHeight
        ))) || Math.max(160, Math.min(scene.levelWidth - 160, scene.player.x));

        target.body.setAllowGravity?.(false);
        target.setImmovable?.(true);
        target.setVelocity?.(0, 0);
        target.body.reset?.(targetX, targetY);
        target.setPosition?.(targetX, targetY);
        target.baseX = targetX;
        target.baseY = targetY;
        target.detectionRange = 0;
        target.patrolMin = Number.NEGATIVE_INFINITY;
        target.patrolMax = Number.POSITIVE_INFINITY;
        target.patrolLeft = Number.NEGATIVE_INFINITY;
        target.patrolRight = Number.POSITIVE_INFINITY;
        target.stompContactLockedUntil = 0;
        scene.updateEnemyGraphics?.(target);

        const originalResolve = scene.resolveEnemyContact;
        const state = {
            enemyType: target.enemyType || target.combatRole,
            enemyHealthBefore: Number(target.health),
            cueTotalBefore: target.combatCueTotalStomps,
            cueRemainingBefore: target.combatCueStompsRemaining,
            playerHealthBefore: Number(scene.health),
            contacts: []
        };
        scene.__smokeLiveStomp = { target, originalResolve, state };
        scene.resolveEnemyContact = function (player, enemy, options) {
            const result = originalResolve.call(this, player, enemy, options);
            if (enemy === target) {
                state.contacts.push(result);
                state.enemyHealthAfter = Number(target.health);
                state.enemyActiveAfter = target.active !== false;
                state.cueTotalAfter = target.combatCueTotalStomps;
                state.cueRemainingAfter = target.combatCueStompsRemaining;
                state.playerHealthAfter = Number(scene.health);
                state.playerVelocityAfter = Number(player?.body?.velocity?.y);
            }
            return result;
        };

        scene.player.body.reset?.(targetX, playerY);
        scene.player.setPosition?.(targetX, playerY);
        scene.player.setVelocity?.(0, 0);
        scene.updateForestEnemyActivation?.(true);
        target.body.enable = true;
        target.setVisible?.(true);
        target.forestProximityActive = true;
        target.forestNextAiAt = Number.POSITIVE_INFINITY;
        scene.isInvincible = false;
        scene.player.setVelocity?.(0, 680);
        return { targetX, targetY, playerY, enemyType: state.enemyType };
    })()`);
    if (!liveStompSetup) {
        throw new Error(`${sceneName} has no live armored stomp encounter`);
    }
    const liveStomp = await waitFor(
        () => evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            const probe = scene?.__smokeLiveStomp;
            if (!probe?.state?.contacts?.includes('stomp')) return null;
            scene.resolveEnemyContact = probe.originalResolve;
            const result = { ...probe.state };
            scene.__smokeLiveStomp = null;
            return result;
        })()`),
        { timeoutMs: 3500, message: `${sceneName} live stomp collision` }
    );
    if (
        liveStomp.contacts.filter(contact => contact === 'stomp').length !== 1 ||
        liveStomp.enemyHealthAfter !== liveStomp.enemyHealthBefore - 1 ||
        liveStomp.cueTotalBefore !== liveStomp.enemyHealthBefore ||
        liveStomp.cueRemainingBefore !== liveStomp.enemyHealthBefore ||
        liveStomp.cueTotalAfter !== liveStomp.cueTotalBefore ||
        liveStomp.cueRemainingAfter !== liveStomp.cueRemainingBefore - 1 ||
        liveStomp.playerHealthAfter !== liveStomp.playerHealthBefore ||
        !(liveStomp.playerVelocityAfter < 0)
    ) {
        throw new Error(
            `${sceneName} live stomp was not decisive: ${JSON.stringify(liveStomp)}`
        );
    }

    const optionalRouteId = {
        mythicalForest: 'forest_canopy_run',
        crystalCaves: 'caves_secret_slide',
        reef: 'reef_star_trench',
        voidPeaks: 'peaks_relic_ridge',
        auroraDepths: 'aurora_quiet_light',
        finalVoid: 'final_trust_bridge'
    }[route];
    let routeChoice = null;
    if (optionalRouteId) {
        const choicePresentation = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            const routeState = scene?.optionalRouteRewards?.get?.(
                ${JSON.stringify(optionalRouteId)}
            );
            const choice = routeState?.choice;
            if (!scene?.player || !routeState || !choice) return null;
            return {
                routeTitle: routeState.title,
                rewardLabel: routeState.rewardLabel,
                mainLabel: choice.mainLabel,
                mainTradeoff: choice.mainTradeoff,
                challengeLabel: choice.challengeLabel,
                mainMarker: choice.mainMarker?.text || '',
                optionalMarker: routeState.marker?.text || '',
                mainSupportIds: choice.mainSupportIds,
                optionalSupportIds: choice.optionalSupportIds,
                rejoinSupportIds: choice.rejoinSupportIds,
                supportAudit: scene.auditOptionalRouteChoiceSupports?.()
                    ?.routes?.find(route => route.id === routeState.id),
                optionalCenter: {
                    x: (choice.optionalZone.left + choice.optionalZone.right) / 2,
                    y: (choice.optionalZone.top + choice.optionalZone.bottom) / 2
                },
                rejoinCenter: {
                    x: (choice.rejoinZone.left + choice.rejoinZone.right) / 2,
                    y: (choice.rejoinZone.top + choice.rejoinZone.bottom) / 2
                }
            };
        })()`);
        if (
            !choicePresentation?.mainMarker.includes(choicePresentation.mainLabel) ||
            !choicePresentation.mainMarker.includes(choicePresentation.mainTradeoff) ||
            !choicePresentation.optionalMarker.includes(choicePresentation.routeTitle) ||
            !choicePresentation.optionalMarker.includes(choicePresentation.challengeLabel) ||
            !choicePresentation.optionalMarker.includes(choicePresentation.rewardLabel) ||
            choicePresentation.supportAudit?.passed !== true ||
            choicePresentation.mainSupportIds?.length < 1 ||
            choicePresentation.optionalSupportIds?.length < 1 ||
            choicePresentation.rejoinSupportIds?.length < 1
        ) {
            throw new Error(
                `${sceneName} route choice is not readable: ${JSON.stringify(choicePresentation)}`
            );
        }

        let mainRouteEffect = null;
        if (route === 'auroraDepths') {
            mainRouteEffect = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(
                    'AuroraDepthsLevel'
                );
                const selected = scene.selectAuroraRoute('shadow_current');
                const result = {
                    selected,
                    routeChoice: scene.auroraRouteChoice,
                    currentChargeReady: scene.currentChargeReady === true,
                    auraActive: Boolean(scene.currentChargeAura?.active),
                    objective: scene.getAuroraObjectiveText?.() || ''
                };

                scene.auroraRouteChoice = '';
                scene.currentChargeReady = false;
                scene.clearCurrentChargeAura?.();
                scene.refreshPersistedExpeditionRouteState?.();
                return result;
            })()`);
            if (
                mainRouteEffect?.selected !== true ||
                mainRouteEffect.routeChoice !== 'shadow_current' ||
                mainRouteEffect.currentChargeReady !== true ||
                mainRouteEffect.auraActive !== true ||
                !mainRouteEffect.objective.includes(
                    'YOUR NEXT HIT +2 DAMAGE'
                ) ||
                !choicePresentation.mainTradeoff.includes(
                    'YOUR NEXT HIT +2'
                ) ||
                !choicePresentation.challengeLabel.includes('1-HIT WARD')
            ) {
                throw new Error(
                    `${sceneName} route impact contradicted its promise: ` +
                    JSON.stringify({ choicePresentation, mainRouteEffect })
                );
            }
            await startCampaignScene(session, { route, sceneName });
            await delay(400);
        }
        if (route === 'reef') {
            const mainRouteStaged = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene('ReefLevel');
                const routeState = scene?.optionalRouteRewards?.get?.(
                    'reef_star_trench'
                );
                const support = scene?.getTraversalSupport?.(
                    routeState?.choice?.mainSupportIds?.[0]
                );
                if (!scene?.player?.body || !routeState?.choice || !support?.body) {
                    return null;
                }
                scene.player.body.reset(
                    support.x,
                    support.body.top - scene.player.body.height - 4
                );
                scene.player.setVelocity?.(0, 0);
                return { supportId: support.traversalId };
            })()`);
            if (!mainRouteStaged) {
                throw new Error(`${sceneName} could not stage its Signal Current`);
            }
            mainRouteEffect = await waitFor(
                () => evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene('ReefLevel');
                    const routeState = scene?.optionalRouteRewards?.get?.(
                        'reef_star_trench'
                    );
                    if (routeState?.choice?.selectedPath !== 'main') return null;
                    const target = scene.enemies?.getChildren?.().find(
                        enemy => enemy?.active
                    );
                    if (!target) return null;
                    const optionalAccepted = scene.recordOptionalRouteProgress(
                        'reef_star_trench',
                        { x: scene.player.x, y: scene.player.y }
                    );
                    const objectiveBefore = scene.getReefObjectiveText?.() || '';
                    const persistedBefore = scene.getExpeditionRouteState?.()
                        .reefCurrentEdgeReady;
                    const baseDamage = (
                        Number(scene.katanaCombatProfile?.meleeDamage) || 2
                    ) + 1;
                    scene.enemies.getChildren().forEach(enemy => {
                        enemy.x = -10000;
                        enemy.y = -10000;
                    });
                    scene.player.facingRight = true;
                    target.x = scene.player.x + 70;
                    target.y = scene.player.y;
                    const originalDamageEnemy = scene.damageEnemy;
                    const damageCalls = [];
                    scene.damageEnemy = (_enemy, amount) => {
                        damageCalls.push(amount);
                        return true;
                    };
                    scene.performAttack();
                    scene.damageEnemy = originalDamageEnemy;
                    return {
                        selectedPath: routeState.choice.selectedPath,
                        reefRouteChoice: scene.reefRouteChoice,
                        optionalAccepted,
                        progress: routeState.progress,
                        completed: routeState.completed,
                        objectiveBefore,
                        objective: scene.getReefObjectiveText?.() || '',
                        baseDamage,
                        damageCalls,
                        edgeReadyBefore: persistedBefore,
                        edgeReadyAfter: scene.reefCurrentEdgeReady,
                        persistedAfter: scene.getExpeditionRouteState?.()
                            .reefCurrentEdgeReady
                    };
                })()`),
                { timeoutMs: 2500, message: `${sceneName} Signal Current selection` }
            );
            if (
                mainRouteEffect.selectedPath !== 'main' ||
                mainRouteEffect.reefRouteChoice !== 'main' ||
                mainRouteEffect.optionalAccepted !== false ||
                mainRouteEffect.progress !== 0 ||
                mainRouteEffect.completed !== false ||
                mainRouteEffect.damageCalls?.[0] !==
                    mainRouteEffect.baseDamage + 2 ||
                mainRouteEffect.edgeReadyBefore !== true ||
                mainRouteEffect.edgeReadyAfter !== false ||
                mainRouteEffect.persistedAfter !== false ||
                !mainRouteEffect.objectiveBefore.includes(
                    'NEXT KATANA HIT +2 READY'
                ) ||
                !mainRouteEffect.objective.includes('CURRENT EDGE SPENT') ||
                !choicePresentation.mainTradeoff.includes('KATANA HIT +2') ||
                !choicePresentation.challengeLabel.includes('2 RELICS') ||
                !choicePresentation.rewardLabel.includes('FREE SUPER BLAST')
            ) {
                throw new Error(
                    `${sceneName} route rewards contradicted their promise: ` +
                    JSON.stringify({ choicePresentation, mainRouteEffect })
                );
            }
            // Prove the Star Trench from a clean scene; the Signal Current
            // intentionally commits the route and spends only its own reward.
            await startCampaignScene(session, { route, sceneName });
            await delay(400);
        }
        if (route === 'crystalCaves') {
            const mainRouteStaged = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(
                    'CrystalCavesLevel'
                );
                const routeState = scene?.optionalRouteRewards?.get?.(
                    'caves_secret_slide'
                );
                const support = scene?.getTraversalSupport?.(
                    routeState?.choice?.mainSupportIds?.[0]
                );
                if (!scene?.player?.body || !routeState?.choice || !support?.body) {
                    return null;
                }
                scene.player.body.reset(
                    support.x,
                    support.body.top - scene.player.body.height - 4
                );
                scene.player.setVelocity?.(0, 0);
                return { supportId: support.traversalId };
            })()`);
            if (!mainRouteStaged) {
                throw new Error(`${sceneName} could not stage its lower passage`);
            }
            mainRouteEffect = await waitFor(
                () => evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene(
                        'CrystalCavesLevel'
                    );
                    const routeState = scene?.optionalRouteRewards?.get?.(
                        'caves_secret_slide'
                    );
                    if (routeState?.choice?.selectedPath !== 'main') return null;
                    const optionalAccepted = scene.recordOptionalRouteProgress(
                        'caves_secret_slide',
                        { x: scene.player.x, y: scene.player.y }
                    );
                    const energyBefore = scene.crystalEnergy;
                    const multiplierBefore = scene.nextRangedDamageMultiplier;
                    const objectiveBefore = scene.getCrystalObjectiveText?.() || '';
                    const persistedBefore = scene.getExpeditionRouteState?.()
                        .crystalFocusReady;
                    scene.performRangedAttack();
                    return {
                        selectedPath: routeState.choice.selectedPath,
                        crystalChamberRoute: scene.crystalChamberRoute,
                        optionalAccepted,
                        progress: routeState.progress,
                        completed: routeState.completed,
                        wardPickupActive: scene.crystalWardPickup?.active === true,
                        optionalPickupsRemaining: (
                            scene.collectibles?.getChildren?.() || []
                        ).filter(item => (
                            item?.optionalRouteId === 'caves_secret_slide' &&
                            item.active !== false
                        )).length,
                        objective: scene.getCrystalObjectiveText?.() || '',
                        objectiveBefore,
                        energyBefore,
                        energyAfter: scene.crystalEnergy,
                        multiplierBefore,
                        multiplierAfter: scene.nextRangedDamageMultiplier,
                        persistedBefore,
                        persistedAfter: scene.getExpeditionRouteState?.()
                            .crystalFocusReady
                    };
                })()`),
                { timeoutMs: 2500, message: `${sceneName} lower passage selection` }
            );
            if (
                mainRouteEffect.selectedPath !== 'main' ||
                mainRouteEffect.crystalChamberRoute !== 'main' ||
                mainRouteEffect.optionalAccepted !== false ||
                mainRouteEffect.progress !== 0 ||
                mainRouteEffect.completed !== false ||
                mainRouteEffect.wardPickupActive !== false ||
                mainRouteEffect.optionalPickupsRemaining !== 0 ||
                mainRouteEffect.multiplierBefore !== 2 ||
                mainRouteEffect.multiplierAfter !== 1 ||
                mainRouteEffect.energyAfter !== mainRouteEffect.energyBefore ||
                mainRouteEffect.persistedBefore !== true ||
                mainRouteEffect.persistedAfter !== false ||
                !mainRouteEffect.objectiveBefore.includes(
                    'CRYSTAL FOCUS x2 READY'
                ) ||
                !mainRouteEffect.objective.includes('CRYSTAL FOCUS SPENT') ||
                !choicePresentation.mainTradeoff.includes('NEXT SHOT x2') ||
                !choicePresentation.challengeLabel.includes('1-HIT WARD') ||
                !choicePresentation.rewardLabel.includes('1 HIT')
            ) {
                throw new Error(
                    `${sceneName} route rewards contradicted their promise: ` +
                    JSON.stringify({ choicePresentation, mainRouteEffect })
                );
            }
            // The Spider Walk must be proven from an independent clean scene;
            // choosing the lower passage intentionally retires its Ward.
            await startCampaignScene(session, { route, sceneName });
            await delay(400);
        }
        if (route === 'voidPeaks') {
            const mainRouteStaged = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(
                    'VoidPeaksLevel'
                );
                const routeState = scene?.optionalRouteRewards?.get?.(
                    'peaks_relic_ridge'
                );
                const support = scene?.getTraversalSupport?.(
                    routeState?.choice?.mainSupportIds?.[0]
                );
                if (!scene?.player?.body || !routeState?.choice || !support?.body) {
                    return null;
                }
                scene.player.body.reset(
                    support.x,
                    support.body.top - scene.player.body.height - 4
                );
                scene.player.setVelocity?.(0, 0);
                return { supportId: support.traversalId };
            })()`);
            if (!mainRouteStaged) {
                throw new Error(`${sceneName} could not stage its low warning line`);
            }
            mainRouteEffect = await waitFor(
                () => evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene(
                        'VoidPeaksLevel'
                    );
                    const routeState = scene?.optionalRouteRewards?.get?.(
                        'peaks_relic_ridge'
                    );
                    if (routeState?.choice?.selectedPath !== 'main') return null;
                    const optionalAccepted = scene.recordOptionalRouteProgress(
                        'peaks_relic_ridge',
                        { x: scene.player.x, y: scene.player.y }
                    );
                    const energyBefore = scene.crystalEnergy;
                    const chargesBefore = scene.freeSpecialAttackCharges;
                    const objectiveBefore = scene.getPeakObjectiveText?.() || '';
                    const persistedBefore =
                        scene.getExpeditionRouteState?.().titanSurgeCharges;
                    scene.performSpecialAttack();
                    return {
                        selectedPath: routeState.choice.selectedPath,
                        peakRouteChoice: scene.peakRouteChoice,
                        optionalAccepted,
                        progress: routeState.progress,
                        completed: routeState.completed,
                        optionalFragmentsRemaining: (
                            scene.collectibles?.getChildren?.() || []
                        ).filter(item => (
                            item?.optionalRouteId === 'peaks_relic_ridge' &&
                            item.active !== false
                        )).length,
                        objective: scene.getPeakObjectiveText?.() || '',
                        objectiveBefore,
                        energyBefore,
                        energyAfter: scene.crystalEnergy,
                        chargesBefore,
                        chargesAfter: scene.freeSpecialAttackCharges,
                        persistedBefore,
                        persistedCharges:
                            scene.getExpeditionRouteState?.().titanSurgeCharges
                    };
                })()`),
                { timeoutMs: 2500, message: `${sceneName} low warning line selection` }
            );
            if (
                mainRouteEffect.selectedPath !== 'main' ||
                mainRouteEffect.peakRouteChoice !== 'main' ||
                mainRouteEffect.optionalAccepted !== false ||
                mainRouteEffect.progress !== 0 ||
                mainRouteEffect.completed !== false ||
                mainRouteEffect.optionalFragmentsRemaining !== 0 ||
                mainRouteEffect.chargesBefore !== 1 ||
                mainRouteEffect.chargesAfter !== 0 ||
                mainRouteEffect.energyAfter !== mainRouteEffect.energyBefore ||
                mainRouteEffect.persistedBefore !== 1 ||
                mainRouteEffect.persistedCharges !== 0 ||
                !mainRouteEffect.objectiveBefore.includes('FREE BLAST READY') ||
                !mainRouteEffect.objective.includes('FREE BLAST SPENT') ||
                !choicePresentation.mainTradeoff.includes('1 FREE BLAST') ||
                !choicePresentation.challengeLabel.includes('2 RELICS') ||
                !choicePresentation.rewardLabel.includes('1 HIT')
            ) {
                throw new Error(
                    `${sceneName} route rewards contradicted their promise: ` +
                    JSON.stringify({ choicePresentation, mainRouteEffect })
                );
            }
            // The high ridge must be proven in an independent clean scene;
            // choosing the low line intentionally retires its relics.
            await startCampaignScene(session, { route, sceneName });
            await delay(400);
        }
        if (route === 'finalVoid') {
            const mainRouteStaged = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(
                    'FinalVoidLevel'
                );
                const routeState = scene?.optionalRouteRewards?.get?.(
                    'final_trust_bridge'
                );
                const support = scene?.getTraversalSupport?.(
                    routeState?.choice?.mainSupportIds?.[0]
                );
                if (!scene?.player?.body || !routeState?.choice || !support?.body) {
                    return null;
                }
                scene.player.body.reset(
                    support.x,
                    support.body.top - scene.player.body.height - 4
                );
                scene.player.setVelocity?.(0, 0);
                return { supportId: support.traversalId };
            })()`);
            if (!mainRouteStaged) {
                throw new Error(`${sceneName} could not stage its low crossing`);
            }
            mainRouteEffect = await waitFor(
                () => evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene(
                        'FinalVoidLevel'
                    );
                    const routeState = scene?.optionalRouteRewards?.get?.(
                        'final_trust_bridge'
                    );
                    if (routeState?.choice?.selectedPath !== 'main') return null;
                    const optionalAccepted = scene.recordOptionalRouteProgress(
                        'final_trust_bridge',
                        { x: scene.player.x, y: scene.player.y }
                    );
                    return {
                        selectedPath: routeState.choice.selectedPath,
                        finalRouteChoice: scene.finalRouteChoice,
                        optionalAccepted,
                        progress: routeState.progress,
                        completed: routeState.completed,
                        bondReserveReady: scene.bondReserveReady === true,
                        pickupActive: scene.optionalRoutePickup?.active === true
                    };
                })()`),
                { timeoutMs: 2500, message: `${sceneName} low crossing selection` }
            );
            if (
                mainRouteEffect.selectedPath !== 'main' ||
                mainRouteEffect.finalRouteChoice !== 'main' ||
                mainRouteEffect.optionalAccepted !== false ||
                mainRouteEffect.progress !== 0 ||
                mainRouteEffect.completed !== false ||
                mainRouteEffect.bondReserveReady !== false ||
                mainRouteEffect.pickupActive !== false ||
                !choicePresentation.mainTradeoff.includes(
                    'RIFT DAMAGE + 2 GUARDS'
                ) ||
                !choicePresentation.challengeLabel.includes('EARN RESCUE')
            ) {
                throw new Error(
                    `${sceneName} low crossing failed to lock out its optional rescue: ` +
                    JSON.stringify({ choicePresentation, mainRouteEffect })
                );
            }
            // Trust Bridge must be proven from an independent clean scene;
            // selecting the low crossing intentionally locks out its reward.
            await startCampaignScene(session, { route, sceneName });
            await delay(400);
        }

        let rejectedOptionalPickup = null;
        if (route === 'mythicalForest') {
            const stagedMainRoute = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                const routeState = scene?.optionalRouteRewards?.get?.(
                    ${JSON.stringify(optionalRouteId)}
                );
                const choice = routeState?.choice;
                const fragmentIndex = (scene?.starFragmentSprites || []).findIndex(
                    entry => entry?.optionalRouteId === ${JSON.stringify(optionalRouteId)} &&
                        entry?.pickupZone?.active !== false
                );
                const fragment = scene?.starFragmentSprites?.[fragmentIndex];
                if (!scene?.player || !choice || !fragment?.sprite || !fragment?.pickupZone) {
                    return null;
                }

                const mainSupport = scene.getTraversalSupport?.(
                    choice.mainSupportIds[0]
                );
                if (!mainSupport?.body || !scene.player?.body) return null;
                scene.player.body.reset(
                    mainSupport.x,
                    mainSupport.body.top - scene.player.body.height - 4
                );
                scene.player.setVelocity?.(0, 0);
                return {
                    supportId: mainSupport.traversalId,
                    selectedPath: choice.selectedPath
                };
            })()`);
            if (!stagedMainRoute) {
                throw new Error(`${sceneName} could not stage its main route support`);
            }
            const mainRouteSelection = await waitFor(
                () => evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                    const routeState = scene?.optionalRouteRewards?.get?.(
                        ${JSON.stringify(optionalRouteId)}
                    );
                    const choice = routeState?.choice;
                    if (choice?.selectedPath !== 'main') return null;
                    return {
                        selectedPath: choice.selectedPath,
                        fragmentCount: scene.starFragmentsCollected,
                        fragmentMask: scene.forestCollectedFragmentMask,
                        progress: routeState.progress
                    };
                })()`),
                { timeoutMs: 2500, message: `${sceneName} main route landing` }
            );
            rejectedOptionalPickup = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                const routeState = scene?.optionalRouteRewards?.get?.(
                    ${JSON.stringify(optionalRouteId)}
                );
                const choice = routeState?.choice;
                const fragmentIndex = (scene?.starFragmentSprites || []).findIndex(
                    entry => entry?.optionalRouteId === ${JSON.stringify(optionalRouteId)} &&
                        entry?.pickupZone?.active !== false
                );
                const fragment = scene?.starFragmentSprites?.[fragmentIndex];
                if (!scene?.player || !choice || !fragment?.sprite || !fragment?.pickupZone) {
                    return null;
                }
                const before = {
                    selectedPath: choice.selectedPath,
                    fragmentCount: scene.starFragmentsCollected,
                    fragmentMask: scene.forestCollectedFragmentMask,
                    progress: routeState.progress
                };
                scene.collectStarFragment(
                    fragment.sprite,
                    fragment.pickupZone,
                    fragmentIndex
                );
                const after = {
                    selectedPath: choice.selectedPath,
                    fragmentCount: scene.starFragmentsCollected,
                    fragmentMask: scene.forestCollectedFragmentMask,
                    progress: routeState.progress,
                    pickupActive: fragment.pickupZone?.active !== false,
                    fragmentCollected: fragment.collected === true
                };

                scene.forestRouteChoice = '';
                choice.selectedPath = null;
                choice.mainEntered = false;
                choice.optionalEntered = false;
                choice.rejoined = false;
                choice.sequence = null;
                scene.routeChoiceSequence = 0;
                // Leave both choice volumes before yielding to the next frame;
                // otherwise the main volume immediately reselects itself.
                scene.player.setPosition(2400, scene.levelHeight - 150);
                scene.player.setVelocity?.(0, 0);
                return { before, after };
            })()`);
            if (
                rejectedOptionalPickup?.before?.selectedPath !== 'main' ||
                rejectedOptionalPickup.before.fragmentCount !== 0 ||
                rejectedOptionalPickup.before.fragmentMask !== 0 ||
                rejectedOptionalPickup.before.progress !== 0 ||
                rejectedOptionalPickup.after.selectedPath !== 'main' ||
                rejectedOptionalPickup.after.fragmentCount !== 0 ||
                rejectedOptionalPickup.after.fragmentMask !== 0 ||
                rejectedOptionalPickup.after.progress !== 0 ||
                rejectedOptionalPickup.after.pickupActive !== true ||
                rejectedOptionalPickup.after.fragmentCollected !== false
            ) {
                throw new Error(
                    `${sceneName} mutated a Canopy pickup after the main route was chosen: ` +
                    JSON.stringify(rejectedOptionalPickup)
                );
            }
        }

        await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            const routeState = scene?.optionalRouteRewards?.get?.(
                ${JSON.stringify(optionalRouteId)}
            );
            const zone = routeState?.choice?.optionalZone;
            if (!scene?.player || !zone) return false;
            const choice = routeState.choice;
            choice.selectedPath = null;
            choice.mainEntered = false;
            choice.optionalEntered = false;
            choice.rejoined = false;
            choice.sequence = null;
            scene.routeChoiceSequence = 0;
            if (${JSON.stringify(route)} === 'mythicalForest') scene.forestRouteChoice = '';
            if (${JSON.stringify(route)} === 'crystalCaves') scene.crystalChamberRoute = null;
            if (${JSON.stringify(route)} === 'reef') scene.reefRouteChoice = null;
            if (${JSON.stringify(route)} === 'voidPeaks') scene.peakRouteChoice = '';
            if (${JSON.stringify(route)} === 'auroraDepths') scene.auroraRouteChoice = null;
            if (${JSON.stringify(route)} === 'finalVoid') scene.finalRouteChoice = '';
            const support = scene.getTraversalSupport?.(
                choice.optionalSupportIds[0]
            );
            if (!support?.body || !scene.player?.body) return false;
            scene.player.body.reset(
                support.x,
                support.body.top - scene.player.body.height - 4
            );
            scene.player.setVelocity?.(0, 0);
            return true;
        })()`);
        let optionalEntry;
        try {
            optionalEntry = await waitFor(
                () => evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                    const choice = scene?.optionalRouteRewards?.get?.(
                        ${JSON.stringify(optionalRouteId)}
                    )?.choice;
                    if (!choice?.optionalEntered) return null;
                    return {
                        selectedPath: choice.selectedPath,
                        optionalEntered: choice.optionalEntered,
                        mainEntered: choice.mainEntered,
                        sequence: choice.sequence
                    };
                })()`),
                { timeoutMs: 5000, message: `${sceneName} optional route entry` }
            );
        } catch (error) {
            const diagnostics = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                const choice = scene?.optionalRouteRewards?.get?.(
                    ${JSON.stringify(optionalRouteId)}
                )?.choice;
                const support = scene?.getTraversalSupport?.(
                    choice?.optionalSupportIds?.[0]
                );
                const body = scene?.player?.body;
                return {
                    choice: choice ? {
                        selectedPath: choice.selectedPath,
                        mainEntered: choice.mainEntered,
                        optionalEntered: choice.optionalEntered,
                        optionalSupportIds: choice.optionalSupportIds,
                        optionalZone: choice.optionalZone
                    } : null,
                    player: body ? {
                        left: Math.round(body.left),
                        right: Math.round(body.right),
                        top: Math.round(body.top),
                        bottom: Math.round(body.bottom),
                        velocityX: Math.round(body.velocity.x),
                        velocityY: Math.round(body.velocity.y),
                        blockedDown: body.blocked.down,
                        touchingDown: body.touching.down,
                        grounded: scene.isGrounded
                    } : null,
                    support: support?.body ? {
                        id: support.traversalId,
                        left: Math.round(support.body.left),
                        right: Math.round(support.body.right),
                        top: Math.round(support.body.top),
                        bottom: Math.round(support.body.bottom)
                    } : null,
                    committed: choice ? scene.isPlayerCommittedToRouteChoice(
                        choice.optionalZone,
                        choice.optionalSupportIds
                    ) : false,
                    activeTransport: scene.activePeakReturnCurrent ||
                        scene.activeReefAscentCurrent || null,
                    nearbyEncounters: (scene.enemies?.getChildren?.() || [])
                        .filter(enemy => enemy?.active !== false && body &&
                            Math.abs(enemy.x - body.center.x) < 280)
                        .map(enemy => ({
                            beat: enemy.encounterBeat || null,
                            supportId: enemy.encounterSupportId || null,
                            x: Math.round(enemy.x),
                            y: Math.round(enemy.y)
                        }))
                };
            })()`);
            throw new Error(`${error.message}: ${JSON.stringify(diagnostics)}`);
        }

        await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            const routeState = scene?.optionalRouteRewards?.get?.(
                ${JSON.stringify(optionalRouteId)}
            );
            const zone = routeState?.choice?.rejoinZone;
            if (!scene?.player || !zone) return false;
            const support = scene.getTraversalSupport?.(
                routeState.choice.rejoinSupportIds[0]
            );
            if (!support?.body || !scene.player?.body) return false;
            scene.player.body.reset(
                support.x,
                support.body.top - scene.player.body.height - 4
            );
            scene.player.setVelocity?.(0, 0);
            return true;
        })()`);
        let rejoin;
        try {
            rejoin = await waitFor(
                () => evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                    const choice = scene?.optionalRouteRewards?.get?.(
                        ${JSON.stringify(optionalRouteId)}
                    )?.choice;
                    if (!choice?.rejoined) return null;
                    return {
                        selectedPath: choice.selectedPath,
                        optionalEntered: choice.optionalEntered,
                        rejoined: choice.rejoined,
                        sequence: choice.sequence
                    };
                })()`),
                { timeoutMs: 5000, message: `${sceneName} optional route rejoin` }
            );
        } catch (error) {
            const diagnostics = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                const choice = scene?.optionalRouteRewards?.get?.(
                    ${JSON.stringify(optionalRouteId)}
                )?.choice;
                const support = scene?.getTraversalSupport?.(
                    choice?.rejoinSupportIds?.[0]
                );
                const body = scene?.player?.body;
                return {
                    choice: choice ? {
                        selectedPath: choice.selectedPath,
                        optionalEntered: choice.optionalEntered,
                        rejoined: choice.rejoined,
                        rejoinSupportIds: choice.rejoinSupportIds,
                        rejoinZone: choice.rejoinZone
                    } : null,
                    player: body ? {
                        left: Math.round(body.left),
                        right: Math.round(body.right),
                        top: Math.round(body.top),
                        bottom: Math.round(body.bottom),
                        velocityY: Math.round(body.velocity.y),
                        blockedDown: body.blocked.down,
                        touchingDown: body.touching.down,
                        grounded: scene.isGrounded
                    } : null,
                    support: support?.body ? {
                        id: support.traversalId,
                        left: Math.round(support.body.left),
                        right: Math.round(support.body.right),
                        top: Math.round(support.body.top),
                        bottom: Math.round(support.body.bottom)
                    } : null,
                    committed: choice ? scene.isPlayerCommittedToRouteChoice(
                        choice.rejoinZone,
                        choice.rejoinSupportIds
                    ) : false
                };
            })()`);
            throw new Error(`${error.message}: ${JSON.stringify(diagnostics)}`);
        }
        if (
            optionalEntry.selectedPath !== 'optional' ||
            optionalEntry.optionalEntered !== true ||
            optionalEntry.mainEntered !== false ||
            optionalEntry.sequence !== 1 ||
            rejoin.selectedPath !== 'optional' ||
            rejoin.optionalEntered !== true ||
            rejoin.rejoined !== true ||
            rejoin.sequence !== 1
        ) {
            throw new Error(
                `${sceneName} route choice state was ambiguous: ` +
                JSON.stringify({ optionalEntry, rejoin })
            );
        }
        routeChoice = {
            presentation: choicePresentation,
            mainRouteEffect,
            rejectedOptionalPickup,
            optionalEntry,
            rejoin
        };
    }

    let combatFeedback = null;
    if (['mythicalForest', 'auroraDepths', 'finalVoid'].includes(route)) {
        combatFeedback = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            const enemies = scene?.enemies?.getChildren?.().filter(
                enemy => enemy?.active !== false
            ) || [];
            const clearTarget = enemies.find(enemy => Number(enemy.health) === 1);
            const armoredTarget = enemies.find(enemy => (
                enemy !== clearTarget &&
                enemy?.combatRole === 'armored' &&
                Number(enemy.health) >= 2
            ));
            if (!scene || !clearTarget || !armoredTarget) return null;

            const messages = [];
            const originalFloatingText = scene.showFloatingText;
            scene.showFloatingText = function (text, x, y, color) {
                messages.push({ text, color });
                return originalFloatingText.call(this, text, x, y, color);
            };
            const stomp = enemy => {
                enemy.stompContactLockedUntil = 0;
                return scene.resolveEnemyContact({
                    active: true,
                    x: enemy.x,
                    y: enemy.y - 50,
                    body: {
                        center: { y: enemy.body.center.y - 50 },
                        bottom: enemy.body.top + 2,
                        velocity: { y: 90 }
                    },
                    setVelocityY: () => {}
                }, enemy);
            };
            const clearBefore = clearTarget.health;
            const clearResult = stomp(clearTarget);
            const armoredBefore = armoredTarget.health;
            const armoredResult = stomp(armoredTarget);
            const armoredAfter = armoredTarget.health;
            scene.showFloatingText = originalFloatingText;

            return {
                clearBefore,
                clearResult,
                clearActive: clearTarget.active !== false,
                armoredBefore,
                armoredAfter,
                armoredResult,
                messages
            };
        })()`);
        const texts = combatFeedback?.messages?.map(message => message.text) || [];
        if (
            combatFeedback?.clearBefore !== 1 ||
            combatFeedback.clearResult !== 'stomp' ||
            combatFeedback.clearActive !== false ||
            combatFeedback.armoredResult !== 'stomp' ||
            combatFeedback.armoredAfter !== combatFeedback.armoredBefore - 1 ||
            !texts.includes('STOMP CLEAR') ||
            !texts.includes(
                `STOMP · ${combatFeedback.armoredAfter} HIT${
                    combatFeedback.armoredAfter === 1 ? '' : 'S'
                } LEFT`
            )
        ) {
            throw new Error(
                `${sceneName} did not explain stomp outcomes: ${JSON.stringify(combatFeedback)}`
            );
        }
    }

    let routeHandoff = null;
    let routeCompletion = null;
    let outOfOrderGuard = null;
    let optionalRouteCompletion = null;
    let guardianRecovery = null;
    let crystalCoreLift = null;
    let finalRiftCrossing = null;
    let auroraQuietLightClimb = null;
    let auroraGroundedObjectives = null;
    let peaksGroundedObjectives = null;
    let finalGroundedObjectives = null;
    let cavesGroundedObjectives = null;
    const reefWaypointSupports = [];
    const forestAnchorSupports = [];
    let forestForwardHandoffs = null;
    if ([
        'mythicalForest',
        'crystalCaves',
        'reef',
        'voidPeaks',
        'auroraDepths',
        'finalVoid'
    ].includes(route)) {
        const outOfOrderStage = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            const signals = scene?.orderedRouteSignals || [];
            const firstSignal = signals[0];
            const lastSignal = signals[signals.length - 1];
            if (!scene?.player || !firstSignal || !lastSignal) return null;
            scene.isInvincible = true;
            const checkpointBefore = scene.checkpointPosition
                ? { ...scene.checkpointPosition }
                : null;
            const support = scene.getTraversalSupport?.(
                lastSignal.activationSupportIds?.[0]
            );
            if (support?.body && scene.player?.body) {
                scene.player.body.reset(
                    lastSignal.x,
                    support.body.top - scene.player.body.height - 18
                );
            } else {
                scene.player.setPosition(lastSignal.x, lastSignal.y);
            }
            scene.player.setVelocity?.(0, 0);
            return {
                checkpointBefore,
                firstSignalIndex: firstSignal.index
            };
        })()`);
        await delay(320);
        const outOfOrderResult = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            const signals = scene?.orderedRouteSignals || [];
            const lastSignal = signals[signals.length - 1];
            const activeProperty = scene?.orderedRouteSignalOptions?.activeProperty ||
                'activated';
            const support = scene?.getTraversalSupport?.(
                lastSignal?.activationSupportIds?.[0]
            );
            if (!scene?.player || !lastSignal) return null;
            return {
                activatedCount: signals.filter(
                    signal => signal?.[activeProperty] === true
                ).length,
                lastSignalComplete: lastSignal?.[activeProperty] === true,
                nextSignalIndex: scene?.getNextOrderedRouteSignal?.()?.index ?? null,
                checkpointAfter: scene.checkpointPosition
                    ? { ...scene.checkpointPosition }
                    : null,
                hintShown: Number(scene?.routeHintUntil) > Number(scene?.time?.now),
                playerBody: scene.player?.body ? {
                    left: scene.player.body.left,
                    right: scene.player.body.right,
                    top: scene.player.body.top,
                    bottom: scene.player.body.bottom,
                    velocityY: scene.player.body.velocity?.y
                } : null,
                support: support?.body ? {
                    id: support.traversalId,
                    left: support.body.left,
                    right: support.body.right,
                    top: support.body.top
                } : null,
                trigger: lastSignal.zone?.body ? {
                    left: lastSignal.zone.body.left,
                    right: lastSignal.zone.body.right,
                    top: lastSignal.zone.body.top,
                    bottom: lastSignal.zone.body.bottom
                } : null
            };
        })()`);
        outOfOrderGuard = outOfOrderStage && outOfOrderResult
            ? { ...outOfOrderStage, ...outOfOrderResult }
            : null;
        if (
            outOfOrderGuard?.activatedCount !== 0 ||
            outOfOrderGuard.lastSignalComplete !== false ||
            outOfOrderGuard.nextSignalIndex !== 0 ||
            JSON.stringify(outOfOrderGuard.checkpointAfter) !==
                JSON.stringify(outOfOrderGuard.checkpointBefore) ||
            outOfOrderGuard.firstSignalIndex !== 0 ||
            outOfOrderGuard.hintShown !== true
        ) {
            throw new Error(
                `${sceneName} accepted an out-of-order route signal: ${JSON.stringify(outOfOrderGuard)}`
            );
        }

        if ([
            'crystalCaves',
            'auroraDepths',
            'voidPeaks',
            'finalVoid'
        ].includes(route)) {
            const airborneStage = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                const signal = ${JSON.stringify(route)} === 'auroraDepths'
                    ? scene?.signalPrisms?.[0]
                    : (${JSON.stringify(route)} === 'voidPeaks'
                        ? scene?.beaconRelays?.[0]
                        : (${JSON.stringify(route)} === 'finalVoid'
                            ? scene?.bondAnchors?.[0]
                            : scene?.beaconAnchors?.[0]));
                if (!scene?.player?.body || !signal?.zone?.active) return null;
                scene.routeHintUntil = 0;
                const checkpointBefore = scene.checkpointPosition
                    ? { ...scene.checkpointPosition }
                    : null;
                scene.player.body.reset(signal.x, signal.y - 35);
                scene.player.setVelocity?.(0, -300);
                return { checkpointBefore };
            })()`);
            await delay(180);
            const airborneResult = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                const signal = ${JSON.stringify(route)} === 'auroraDepths'
                    ? scene?.signalPrisms?.[0]
                    : (${JSON.stringify(route)} === 'voidPeaks'
                        ? scene?.beaconRelays?.[0]
                        : (${JSON.stringify(route)} === 'finalVoid'
                            ? scene?.bondAnchors?.[0]
                            : scene?.beaconAnchors?.[0]));
                if (!scene || !signal) return null;
                return {
                    completed: ${JSON.stringify(route)} === 'auroraDepths'
                        ? signal.aligned === true
                        : signal.activated === true,
                    checkpointAfter: scene.checkpointPosition
                        ? { ...scene.checkpointPosition }
                        : null,
                    hintShown: Number(scene.routeHintUntil) > Number(scene.time.now)
                };
            })()`);
            const airborneRejected = airborneStage && airborneResult
                ? { ...airborneStage, ...airborneResult }
                : null;
            if (
                airborneRejected?.completed !== false ||
                JSON.stringify(airborneRejected.checkpointAfter) !==
                    JSON.stringify(airborneRejected.checkpointBefore) ||
                airborneRejected.hintShown !== true
            ) {
                throw new Error(
                    `${sceneName} accepted an airborne signal overlap: ${JSON.stringify(airborneRejected)}`
                );
            }
            if (route === 'auroraDepths') {
                auroraGroundedObjectives = { airborneRejected };
            } else if (route === 'voidPeaks') {
                peaksGroundedObjectives = { airborneRejected };
            } else if (route === 'finalVoid') {
                finalGroundedObjectives = { airborneRejected };
            } else {
                cavesGroundedObjectives = { airborneRejected };
            }
        }

        const staged = [
            'mythicalForest',
            'crystalCaves',
            'reef',
            'auroraDepths',
            'voidPeaks',
            'finalVoid'
        ].includes(route)
            ? await stagePlatformBoundRouteSignal(session, {
                sceneName,
                route,
                index: 0
            })
            : await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                const firstSignal = scene?.getNextOrderedRouteSignal?.();
                if (!scene?.player || !firstSignal) return null;
                scene.isInvincible = true;
                scene.player.setPosition(firstSignal.x, firstSignal.y);
                scene.player.setVelocity?.(0, 0);
                return {
                    firstSignalIndex: firstSignal.index,
                    x: firstSignal.x,
                    y: firstSignal.y
                };
            })()`);
        if (staged?.firstSignalIndex !== 0) {
            throw new Error(
                `${sceneName} could not stage its first route signal: ${JSON.stringify(staged)}`
            );
        }
        if (route === 'reef') {
            reefWaypointSupports.push({
                index: staged.firstSignalIndex,
                supportId: staged.supportId,
                checkpointX: staged.checkpointX,
                checkpointY: staged.checkpointY,
                supportTop: staged.supportTop
            });
        }
        if (route === 'mythicalForest') {
            forestAnchorSupports.push({
                index: staged.firstSignalIndex,
                supportId: staged.supportId,
                checkpointX: staged.checkpointX,
                checkpointY: staged.checkpointY,
                supportTop: staged.supportTop
            });
        }

        routeHandoff = await waitFor(
            () => evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                const signals = scene?.orderedRouteSignals || [];
                const firstSignal = signals[0];
                const nextSignal = scene?.getNextOrderedRouteSignal?.();
                const activeProperty = scene?.orderedRouteSignalOptions?.activeProperty ||
                    'activated';
                if (
                    firstSignal?.[activeProperty] !== true ||
                    nextSignal?.index !== 1
                ) return null;
                return {
                    firstSignalComplete: true,
                    firstSignalEmphasized: Boolean(firstSignal?.guidanceTween),
                    nextSignalIndex: nextSignal.index,
                    nextSignalEmphasized: Boolean(nextSignal?.guidanceTween),
                    compass: scene?.getOrderedRouteCompassText?.() || '',
                    checkpointX: scene?.checkpointPosition?.x,
                    checkpointY: scene?.checkpointPosition?.y,
                    openingCurrentRetired: ${JSON.stringify(route)} === 'reef'
                        ? Boolean(scene?.openingSignalCurrent?.retired)
                        : null
                };
            })()`),
            { timeoutMs: 2500, message: `${sceneName} route signal handoff` }
        );
        if (
            routeHandoff.firstSignalEmphasized ||
            !routeHandoff.nextSignalEmphasized ||
            !/^SIGNAL (RIGHT|LEFT|CLOSE)/.test(routeHandoff.compass) ||
            !Number.isFinite(routeHandoff.checkpointX) ||
            !Number.isFinite(routeHandoff.checkpointY) ||
            (route === 'reef' && routeHandoff.openingCurrentRetired !== true)
        ) {
            throw new Error(
                `${sceneName} did not hand route guidance to signal 2: ${JSON.stringify(routeHandoff)}`
            );
        }

        for (let signalIndex = 1; signalIndex < 3; signalIndex += 1) {
            const stagedSignal = [
                'mythicalForest',
                'crystalCaves',
                'reef',
                'auroraDepths',
                'voidPeaks',
                'finalVoid'
            ].includes(route)
                ? await stagePlatformBoundRouteSignal(session, {
                    sceneName,
                    route,
                    index: signalIndex
                })
                : await evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                    const signal = scene?.getNextOrderedRouteSignal?.();
                    if (!scene?.player || signal?.index !== ${signalIndex}) return null;
                    scene.player.setPosition(signal.x, signal.y);
                    scene.player.setVelocity?.(0, 0);
                    return { index: signal.index, x: signal.x, y: signal.y };
                })()`);
            if (stagedSignal?.index !== signalIndex) {
                throw new Error(
                    `${sceneName} could not stage route signal ${signalIndex + 1}: ` +
                    JSON.stringify(stagedSignal)
                );
            }
            if (route === 'reef') {
                reefWaypointSupports.push({
                    index: stagedSignal.index,
                    supportId: stagedSignal.supportId,
                    checkpointX: stagedSignal.checkpointX,
                    checkpointY: stagedSignal.checkpointY,
                    supportTop: stagedSignal.supportTop
                });
            }
            if (route === 'mythicalForest') {
                forestAnchorSupports.push({
                    index: stagedSignal.index,
                    supportId: stagedSignal.supportId,
                    checkpointX: stagedSignal.checkpointX,
                    checkpointY: stagedSignal.checkpointY,
                    supportTop: stagedSignal.supportTop
                });
            }

            await waitFor(
                () => evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                    const signals = scene?.orderedRouteSignals || [];
                    const activeProperty = scene?.orderedRouteSignalOptions?.activeProperty ||
                        'activated';
                    const signal = signals[${signalIndex}];
                    const nextSignal = scene?.getNextOrderedRouteSignal?.();
                    const expectedNextIndex = ${signalIndex} < signals.length - 1
                        ? ${signalIndex} + 1
                        : null;
                    if (signal?.[activeProperty] !== true) return null;
                    if ((nextSignal?.index ?? null) !== expectedNextIndex) return null;
                    return {
                        completedIndex: signal.index,
                        completedSignalEmphasized: Boolean(signal.guidanceTween),
                        nextSignalIndex: nextSignal?.index ?? null,
                        nextSignalEmphasized: Boolean(nextSignal?.guidanceTween),
                        checkpointIndex: scene?.checkpointPosition?.index,
                        checkpointX: scene?.checkpointPosition?.x,
                        checkpointY: scene?.checkpointPosition?.y
                    };
                })()`),
                {
                    timeoutMs: 2500,
                    message: `${sceneName} route signal ${signalIndex + 1} completion`
                }
            );
        }

        const readyProperty = {
            mythicalForest: 'forestRouteAligned',
            crystalCaves: 'caveRouteAligned',
            reef: 'reefRouteAligned',
            voidPeaks: 'creatureNetworkReached',
            auroraDepths: 'uplinkRiskUnderstood',
            finalVoid: 'finalSignalReady'
        }[route];
        routeCompletion = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            const signals = scene?.orderedRouteSignals || [];
            const activeProperty = scene?.orderedRouteSignalOptions?.activeProperty ||
                'activated';
            const persistedCheckpoint = window.GameState?.get?.(
                'story.projectBeacon.expeditionCheckpoint'
            );
            return {
                completedCount: signals.filter(signal => signal?.[activeProperty] === true).length,
                totalSignals: signals.length,
                routeReady: scene?.[${JSON.stringify(readyProperty)}] === true,
                nextSignalIndex: scene?.getNextOrderedRouteSignal?.()?.index ?? null,
                compass: scene?.getOrderedRouteCompassText?.() || '',
                emphasizedSignals: signals.filter(signal => Boolean(signal?.guidanceTween)).length,
                remainingZones: signals.filter(signal => Boolean(signal?.zone?.active)).length,
                checkpointId: scene?.checkpointPosition?.id,
                checkpointIndex: scene?.checkpointPosition?.index,
                checkpointX: scene?.checkpointPosition?.x,
                checkpointY: scene?.checkpointPosition?.y,
                persistedCheckpoint: persistedCheckpoint ? {
                    sceneKey: persistedCheckpoint.sceneKey,
                    id: persistedCheckpoint.checkpointId,
                    index: persistedCheckpoint.checkpointIndex,
                    x: persistedCheckpoint.x,
                    y: persistedCheckpoint.y
                } : null
            };
        })()`);
        if (
            routeCompletion.completedCount !== 3 ||
            routeCompletion.totalSignals !== 3 ||
            routeCompletion.routeReady !== true ||
            routeCompletion.nextSignalIndex !== null ||
            routeCompletion.compass !== '' ||
            routeCompletion.emphasizedSignals !== 0 ||
            routeCompletion.remainingZones !== 0 ||
            routeCompletion.checkpointIndex !== 2 ||
            !routeCompletion.checkpointId ||
            !Number.isFinite(routeCompletion.checkpointX) ||
            !Number.isFinite(routeCompletion.checkpointY) ||
            routeCompletion.persistedCheckpoint?.sceneKey !== sceneName ||
            routeCompletion.persistedCheckpoint?.id !== routeCompletion.checkpointId ||
            routeCompletion.persistedCheckpoint?.index !== routeCompletion.checkpointIndex ||
            routeCompletion.persistedCheckpoint?.x !== routeCompletion.checkpointX ||
            routeCompletion.persistedCheckpoint?.y !== routeCompletion.checkpointY
        ) {
            throw new Error(
                `${sceneName} did not complete its ordered route: ${JSON.stringify(routeCompletion)}`
            );
        }
        if (
            route === 'reef' &&
            (
                reefWaypointSupports.length !== 3 ||
                reefWaypointSupports[0]?.supportId !== 'reef-drift-relay' ||
                reefWaypointSupports[1]?.supportId !== 'reef-traveler-relay' ||
                reefWaypointSupports[2]?.supportId !== 'reef-passage-vector' ||
                reefWaypointSupports.some(waypoint =>
                    !Number.isFinite(waypoint.checkpointX) ||
                    !Number.isFinite(waypoint.checkpointY) ||
                    waypoint.checkpointY >= waypoint.supportTop ||
                    waypoint.checkpointY < waypoint.supportTop - 100
                )
            )
        ) {
            throw new Error(
                `${sceneName} did not bind its route to distinct Reef relays: ` +
                JSON.stringify(reefWaypointSupports)
            );
        }
        if (
            route === 'mythicalForest' &&
            (
                forestAnchorSupports.length !== 3 ||
                forestAnchorSupports[0]?.supportId !== 'forest-ground-3' ||
                forestAnchorSupports[1]?.supportId !== 'forest-ground-5' ||
                forestAnchorSupports[2]?.supportId !== 'forest-ground-6' ||
                forestAnchorSupports.some(anchor =>
                    !Number.isFinite(anchor.checkpointX) ||
                    !Number.isFinite(anchor.checkpointY) ||
                    anchor.checkpointY >= anchor.supportTop ||
                    anchor.checkpointY < anchor.supportTop - 100
                )
            )
        ) {
            throw new Error(
                `${sceneName} did not bind its route to Forest ground supports: ` +
                JSON.stringify(forestAnchorSupports)
            );
        }

        if (route === 'crystalCaves') {
            crystalCoreLift = await smokeCrystalCoreLift(session);
        }

        if (route === 'reef') {
            const reefDriveGate = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                scene?.refreshGuardianGateState?.(true);
                const gate = scene?.guardianGateState;
                return gate ? {
                    status: gate.status,
                    ready: gate.ready,
                    label: gate.label?.text || ''
                } : null;
            })()`);
            if (
                reefDriveGate?.ready !== false ||
                reefDriveGate.status !== 'RECOVER DIMENSIONAL DRIVE'
            ) {
                throw new Error(
                    `${sceneName} gate did not identify its remaining drive requirement: ` +
                    JSON.stringify(reefDriveGate)
                );
            }
            const reefReadyGate = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                if (!scene?.shipPart?.active) return null;
                scene.collectShipPart(scene.shipPart);
                scene.refreshGuardianGateState(true);
                const gate = scene.guardianGateState;
                return {
                    status: gate?.status,
                    ready: gate?.ready,
                    label: gate?.label?.text || '',
                    shipPartCollected: scene.shipPartCollected
                };
            })()`);
            if (
                reefReadyGate?.shipPartCollected !== true ||
                reefReadyGate.ready !== true ||
                reefReadyGate.status !== 'READY // ENTER' ||
                !reefReadyGate.label.includes('READY // ENTER')
            ) {
                throw new Error(
                    `${sceneName} guardian gate did not visibly unlock: ` +
                    JSON.stringify(reefReadyGate)
                );
            }
        } else if (route === 'crystalCaves') {
            const groveGate = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                const tendedBefore = scene?.crystalWoundTended === true;
                scene.crystalWoundTended = false;
                scene?.refreshGuardianGateState?.(true);
                const gate = scene?.guardianGateState;
                const result = gate ? {
                    status: gate.status,
                    ready: gate.ready,
                    label: gate.label?.text || '',
                    tendedBefore
                } : null;
                scene.crystalWoundTended = tendedBefore;
                scene?.refreshGuardianGateState?.(true);
                return result;
            })()`);
            if (
                groveGate?.ready !== false ||
                groveGate.status !== 'TEND THE FRACTURED GROVE'
            ) {
                throw new Error(
                    `${sceneName} gate did not identify its remaining grove requirement: ` +
                    JSON.stringify(groveGate)
                );
            }
            const crystalReadyGate = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                if (!scene?.crystalWoundTended) {
                    scene?.tendWoundedCrystalGrove?.();
                }
                scene?.refreshGuardianGateState?.(true);
                const gate = scene?.guardianGateState;
                return {
                    status: gate?.status,
                    ready: gate?.ready,
                    label: gate?.label?.text || '',
                    crystalWoundTended: scene?.crystalWoundTended
                };
            })()`);
            if (
                crystalReadyGate?.crystalWoundTended !== true ||
                crystalReadyGate.ready !== true ||
                crystalReadyGate.status !== 'READY // ENTER' ||
                !crystalReadyGate.label.includes('READY // ENTER')
            ) {
                throw new Error(
                    `${sceneName} guardian gate did not visibly unlock after tending the grove: ` +
                    JSON.stringify(crystalReadyGate)
                );
            }
        } else {
            const readyGate = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                scene?.refreshGuardianGateState?.(true);
                const gate = scene?.guardianGateState;
                return gate ? {
                    status: gate.status,
                    ready: gate.ready,
                    label: gate.label?.text || ''
                } : null;
            })()`);
            if (
                readyGate?.ready !== true ||
                readyGate.status !== 'READY // ENTER' ||
                !readyGate.label.includes('READY // ENTER')
            ) {
                throw new Error(
                    `${sceneName} guardian gate did not visibly unlock: ${JSON.stringify(readyGate)}`
                );
            }
        }

        if (optionalRouteId) {
            const optionalRequired = {
                mythicalForest: 2,
                crystalCaves: 1,
                reef: 2,
                voidPeaks: 2,
                auroraDepths: 1,
                finalVoid: 1
            }[route];
            if (route === 'crystalCaves') {
                const wardGate = await evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                    const item = scene?.collectibles?.getChildren?.().find(
                        entry => entry?.active !== false &&
                            entry?.optionalRouteId === ${JSON.stringify(optionalRouteId)}
                    );
                    if (!scene?.player || !item) return null;
                    scene.player.setPosition(item.x, item.y);
                    scene.player.setVelocity?.(0, 0);
                    scene.collectItem(scene.player, item);
                    const reward = scene.optionalRouteRewards?.get?.(
                        ${JSON.stringify(optionalRouteId)}
                    );
                    return {
                        blocked: item.active !== false,
                        progress: reward?.progress,
                        spiderCalmed: scene.crystalSpiderCalmed === true
                    };
                })()`);
                if (
                    wardGate?.blocked !== true ||
                    wardGate.progress !== 0 ||
                    wardGate.spiderCalmed !== false
                ) {
                    throw new Error(
                        `${sceneName} ward was not gated by the Spider: ` +
                        JSON.stringify(wardGate)
                    );
                }
                const spiderCalmed = await evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                    const spider = scene?.crystalSpider;
                    if (!spider?.active) return false;
                    spider.health = 1;
                    scene.damageSpider(1);
                    return scene.crystalSpiderCalmed === true;
                })()`);
                if (!spiderCalmed) {
                    throw new Error(`${sceneName} could not calm the Crystal Spider`);
                }
            }
            for (
                let optionalIndex = 0;
                optionalIndex < optionalRequired;
                optionalIndex += 1
            ) {
                const existingProgress = await evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                    return scene?.optionalRouteRewards?.get?.(
                        ${JSON.stringify(optionalRouteId)}
                    )?.progress || 0;
                })()`);
                if (existingProgress >= optionalIndex + 1) {
                    continue;
                }
                const stagedOptional = await evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                    const collectibles = scene?.optionalRoutePickup?.active !== false &&
                        scene?.optionalRoutePickup
                        ? [scene.optionalRoutePickup]
                        : (${JSON.stringify(route)} === 'mythicalForest'
                            ? (scene?.starFragmentSprites || []).map(entry => entry?.pickupZone)
                            : (${JSON.stringify(route)} === 'reef'
                                ? scene?.starFragments || []
                                : scene?.collectibles?.getChildren?.() || []));
                    const item = collectibles.filter(
                        entry => entry?.active !== false &&
                            entry?.optionalRouteId === ${JSON.stringify(optionalRouteId)}
                    )[0];
                    if (!scene?.player || !item) {
                        const reward = scene?.optionalRouteRewards?.get?.(
                            ${JSON.stringify(optionalRouteId)}
                        );
                        return {
                            missing: true,
                            progress: reward?.progress,
                            completed: reward?.completed,
                            pickupExists: Boolean(scene?.optionalRoutePickup),
                            pickupActive: scene?.optionalRoutePickup?.active,
                            bondReserveReady: scene?.bondReserveReady,
                            selectedPath: reward?.choice?.selectedPath
                        };
                    }
                    if ([
                        'auroraDepths',
                        'voidPeaks',
                        'finalVoid'
                    ].includes(${JSON.stringify(route)})) {
                        const supportId = ${JSON.stringify(route)} === 'auroraDepths'
                            ? 'aurora-quiet-step-3'
                            : (${JSON.stringify(route)} === 'voidPeaks'
                                ? (Number(item.fragmentIndex) === 2
                                    ? 'peak-relic-ridge-1'
                                    : 'peak-relic-ridge-2')
                                : 'final-trust-bridge-1');
                        const support = scene.getTraversalSupport?.(supportId);
                        if (!support?.body || !scene.player?.body) {
                            return { missing: true, supportMissing: true };
                        }
                        const playerY = ${JSON.stringify(route)} === 'voidPeaks'
                            ? item.y
                            : support.body.top - scene.player.body.height - 18;
                        scene.player.body.reset(item.x, playerY);
                    } else {
                        scene.player.setPosition(item.x, item.y);
                    }
                    scene.player.setVelocity?.(0, 0);
                    return { x: item.x, y: item.y };
                })()`);
                if (
                    stagedOptional?.missing &&
                    Number(stagedOptional.progress) >= optionalIndex + 1
                ) {
                    continue;
                }
                if (!stagedOptional || stagedOptional.missing) {
                    throw new Error(
                        `${sceneName} could not stage optional reward ${optionalIndex + 1}: ` +
                        JSON.stringify(stagedOptional)
                    );
                }
                try {
                    await waitFor(
                        () => evaluate(session, `(() => {
                            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                            const reward = scene?.optionalRouteRewards?.get?.(
                                ${JSON.stringify(optionalRouteId)}
                            );
                            return reward?.progress >= ${optionalIndex + 1};
                        })()`),
                        {
                            timeoutMs: 5000,
                            message: `${sceneName} optional reward ${optionalIndex + 1}`
                        }
                    );
                } catch (error) {
                    const diagnostics = await evaluate(session, `(() => {
                        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                        const reward = scene?.optionalRouteRewards?.get?.(
                            ${JSON.stringify(optionalRouteId)}
                        );
                        const collectibles = scene?.optionalRoutePickup?.active !== false &&
                            scene?.optionalRoutePickup
                            ? [scene.optionalRoutePickup]
                            : (${JSON.stringify(route)} === 'mythicalForest'
                                ? (scene?.starFragmentSprites || []).map(entry => entry?.pickupZone)
                                : (${JSON.stringify(route)} === 'reef'
                                    ? scene?.starFragments || []
                                    : scene?.collectibles?.getChildren?.() || []));
                        const item = collectibles.find(entry => (
                            entry?.active !== false &&
                            entry?.optionalRouteId === ${JSON.stringify(optionalRouteId)}
                        ));
                        const body = scene?.player?.body;
                        return {
                            progress: reward?.progress,
                            required: reward?.required,
                            completed: reward?.completed,
                            selectedPath: reward?.choice?.selectedPath,
                            player: body ? {
                                left: Math.round(body.left),
                                right: Math.round(body.right),
                                top: Math.round(body.top),
                                bottom: Math.round(body.bottom),
                                velocityY: Math.round(body.velocity.y)
                            } : null,
                            item: item?.body ? {
                                x: Math.round(item.x),
                                y: Math.round(item.y),
                                left: Math.round(item.body.left),
                                right: Math.round(item.body.right),
                                top: Math.round(item.body.top),
                                bottom: Math.round(item.body.bottom),
                                active: item.active !== false,
                                fragmentIndex: item.fragmentIndex
                            } : null
                        };
                    })()`);
                    throw new Error(`${error.message}: ${JSON.stringify(diagnostics)}`);
                }
            }

            optionalRouteCompletion = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                const reward = scene?.optionalRouteRewards?.get?.(
                    ${JSON.stringify(optionalRouteId)}
                );
                return {
                    progress: reward?.progress,
                    required: reward?.required,
                    completed: reward?.completed === true,
                    marker: reward?.marker?.text || '',
                    objective: ${JSON.stringify(route)} === 'mythicalForest'
                        ? scene?.getForestObjectiveText?.() || ''
                        : (${JSON.stringify(route)} === 'crystalCaves'
                            ? scene?.getCrystalObjectiveText?.() || ''
                            : (${JSON.stringify(route)} === 'reef'
                                ? scene?.getReefObjectiveText?.() || ''
                                : (${JSON.stringify(route)} === 'voidPeaks'
                                    ? scene?.getPeakObjectiveText?.() || ''
                                    : (${JSON.stringify(route)} === 'auroraDepths'
                                        ? scene?.getAuroraObjectiveText?.() || ''
                                        : scene?.getFinalObjectiveText?.() || '')))),
                    freeSpecialAttackCharges: scene?.freeSpecialAttackCharges,
                    optionalRouteGuardCharges: scene?.optionalRouteGuardCharges,
                    bondReserveReady: scene?.bondReserveReady === true,
                    duplicateAccepted: scene?.recordOptionalRouteProgress?.(
                        ${JSON.stringify(optionalRouteId)}
                    )
                };
            })()`);
            const expectedRewardText = {
                mythicalForest: 'CANOPY GUARD // 1 HIT // EARNED',
                crystalCaves: 'CRYSTAL WARD // 1 HIT // EARNED',
                reef: 'FREE SUPER BLAST // EARNED',
                voidPeaks: 'RIDGE GUARD // 1 HIT // EARNED',
                auroraDepths: 'QUIET LIGHT WARD // 1 HIT // EARNED',
                finalVoid: 'BOND RESERVE // 1 RESCUE // EARNED'
            }[route];
            const rewardGranted = route === 'reef'
                ? optionalRouteCompletion.freeSpecialAttackCharges === 1
                : (route === 'finalVoid'
                    ? optionalRouteCompletion.bondReserveReady === true
                    : optionalRouteCompletion.optionalRouteGuardCharges === 1);
            if (
                optionalRouteCompletion.progress !== optionalRequired ||
                optionalRouteCompletion.required !== optionalRequired ||
                optionalRouteCompletion.completed !== true ||
                !optionalRouteCompletion.marker.includes('COMPLETE') ||
                !optionalRouteCompletion.objective.includes(expectedRewardText) ||
                optionalRouteCompletion.duplicateAccepted !== false ||
                !rewardGranted
            ) {
                throw new Error(
                    `${sceneName} optional route did not grant its promised reward: ` +
                    JSON.stringify(optionalRouteCompletion)
                );
            }
            if (route === 'reef') {
                optionalRouteCompletion.reloadState = await evaluate(session, `(async () => {
                    const game = window.mythicalGame;
                    game.scene.stop(${JSON.stringify(sceneName)});
                    game.scene.start(${JSON.stringify(sceneName)}, {
                        forceMobileControls: true,
                        platformerPreviewSize: 'mobile'
                    });
                    return true;
                })()`);
                await waitForScene(session, sceneName);
                const restoredReef = await waitFor(
                    () => evaluate(session, `(() => {
                        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                        if (!scene?.checkpointResumeApplied) return null;
                        const route = scene.optionalRouteRewards?.get?.('reef_star_trench');
                        const remainingOptional = (scene.starFragments || []).filter(
                            fragment => fragment?.active !== false && fragment?.optionalRouteId
                        ).length;
                        return {
                            checkpointId: scene.checkpointPosition?.id,
                            checkpointIndex: scene.checkpointPosition?.index,
                            playerX: scene.player?.x,
                            playerY: scene.player?.y,
                            shipPartCollected: scene.shipPartCollected === true,
                            shipPartActive: scene.shipPart?.active === true,
                            reefRouteChoice: scene.reefRouteChoice,
                            routeProgress: route?.progress,
                            routeCompleted: route?.completed === true,
                            freeSpecialAttackCharges: scene.freeSpecialAttackCharges,
                            remainingOptional
                        };
                    })()`),
                    { timeoutMs: 3500, message: `${sceneName} checkpoint reload state` }
                );
                if (
                    restoredReef.checkpointId !== routeCompletion.checkpointId ||
                    restoredReef.checkpointIndex !== routeCompletion.checkpointIndex ||
                    restoredReef.shipPartCollected !== true ||
                    restoredReef.shipPartActive ||
                    restoredReef.reefRouteChoice !== 'optional' ||
                    restoredReef.routeProgress !== optionalRequired ||
                    restoredReef.routeCompleted !== true ||
                    restoredReef.freeSpecialAttackCharges !== 1 ||
                    restoredReef.remainingOptional !== 0
                ) {
                    throw new Error(
                        `${sceneName} did not restore its collected route state: ` +
                        JSON.stringify(restoredReef)
                    );
                }
                optionalRouteCompletion.reloadState = restoredReef;
                await pressEnter(session);
                await delay(300);
            }
            if (['mythicalForest', 'voidPeaks', 'finalVoid'].includes(route)) {
                await evaluate(session, `(async () => {
                    const game = window.mythicalGame;
                    game.scene.stop(${JSON.stringify(sceneName)});
                    game.scene.start(${JSON.stringify(sceneName)}, {
                        forceMobileControls: true,
                        platformerPreviewSize: 'mobile'
                    });
                    return true;
                })()`);
                await waitForScene(session, sceneName);
                const restoredReward = await waitFor(
                    () => evaluate(session, `(() => {
                        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                        if (!scene?.checkpointResumeApplied) return null;
                        const reward = scene.optionalRouteRewards?.get?.(
                            ${JSON.stringify(optionalRouteId)}
                        );
                        const remainingPickups = ${JSON.stringify(route)} === 'mythicalForest'
                            ? (scene.starFragmentSprites || []).filter(entry => (
                                entry?.pickupZone &&
                                entry.pickupZone.active !== false &&
                                entry.optionalRouteId
                            )).length
                            : (${JSON.stringify(route)} === 'voidPeaks'
                                ? (scene.collectibles?.getChildren?.() || []).filter(
                                    item => item?.active !== false && item?.optionalRouteId
                                ).length
                                : (scene.optionalRoutePickup?.active !== false &&
                                    scene.optionalRoutePickup ? 1 : 0));
                        return {
                            checkpointId: scene.checkpointPosition?.id,
                            checkpointIndex: scene.checkpointPosition?.index,
                            selectedPath: reward?.choice?.selectedPath,
                            progress: reward?.progress,
                            completed: reward?.completed === true,
                            guardCharges: scene.optionalRouteGuardCharges,
                            bondReserveReady: scene.bondReserveReady === true,
                            fragmentMask: ${JSON.stringify(route)} === 'mythicalForest'
                                ? scene.forestCollectedFragmentMask
                                : scene.peakCollectedFragmentMask,
                            fragmentCount: scene.starFragmentsCollected,
                            remainingPickups
                        };
                    })()`),
                    { timeoutMs: 3500, message: `${sceneName} optional reward reload` }
                );
                const restoredProtection = route !== 'finalVoid'
                    ? restoredReward.guardCharges === 1
                    : restoredReward.bondReserveReady === true;
                if (
                    restoredReward.checkpointId !== routeCompletion.checkpointId ||
                    restoredReward.checkpointIndex !== routeCompletion.checkpointIndex ||
                    restoredReward.selectedPath !== 'optional' ||
                    restoredReward.progress !== optionalRequired ||
                    restoredReward.completed !== true ||
                    restoredReward.remainingPickups !== 0 ||
                    !restoredProtection ||
                    (route === 'mythicalForest' && restoredReward.fragmentMask !== 24) ||
                    (route === 'mythicalForest' && restoredReward.fragmentCount !== 2) ||
                    (route === 'voidPeaks' &&
                        (restoredReward.fragmentMask & 12) !== 12) ||
                    (route === 'voidPeaks' && restoredReward.fragmentCount < 2)
                ) {
                    throw new Error(
                        `${sceneName} did not restore its optional reward: ` +
                        JSON.stringify(restoredReward)
                    );
                }
                optionalRouteCompletion.reloadState = restoredReward;

                const consumedReward = await evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                    scene.isInvincible = false;
                    scene.isPlayerDead = false;
                    scene.hasShield = false;
                    scene.powerupShieldHits = 0;
                    scene.guardianGuardCharges = 0;
                    scene.communityGuardCharges = 0;
                    scene.auroraGuardCharges = 0;
                    const healthBefore = ${JSON.stringify(route)} === 'finalVoid'
                        ? 1
                        : scene.health;
                    scene.health = healthBefore;
                    if (${JSON.stringify(route)} === 'finalVoid') {
                        scene.handlePlayerDamage(2);
                    } else {
                        scene.takeDamage(1);
                    }
                    return {
                        healthBefore,
                        healthAfter: scene.health,
                        guardCharges: scene.optionalRouteGuardCharges,
                        bondReserveReady: scene.bondReserveReady === true,
                        reserveEchoActive: scene.bondReserveEcho?.active === true,
                        playerDead: scene.isPlayerDead === true
                    };
                })()`);
                if (
                    consumedReward.healthAfter !== consumedReward.healthBefore ||
                    consumedReward.guardCharges !== 0 ||
                    consumedReward.bondReserveReady !== false ||
                    consumedReward.reserveEchoActive !== false ||
                    consumedReward.playerDead !== false
                ) {
                    throw new Error(
                        `${sceneName} optional protection did not absorb one hit: ` +
                        JSON.stringify(consumedReward)
                    );
                }
                optionalRouteCompletion.consumedState = consumedReward;

                await evaluate(session, `(async () => {
                    const game = window.mythicalGame;
                    game.scene.stop(${JSON.stringify(sceneName)});
                    game.scene.start(${JSON.stringify(sceneName)}, {
                        forceMobileControls: true,
                        platformerPreviewSize: 'mobile'
                    });
                    return true;
                })()`);
                await waitForScene(session, sceneName);
                const restoredConsumed = await waitFor(
                    () => evaluate(session, `(() => {
                        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                        if (!scene?.checkpointResumeApplied) return null;
                        const reward = scene.optionalRouteRewards?.get?.(
                            ${JSON.stringify(optionalRouteId)}
                        );
                        const remainingPickups = ${JSON.stringify(route)} === 'mythicalForest'
                            ? (scene.starFragmentSprites || []).filter(entry => (
                                entry?.pickupZone &&
                                entry.pickupZone.active !== false &&
                                entry.optionalRouteId
                            )).length
                            : (${JSON.stringify(route)} === 'voidPeaks'
                                ? (scene.collectibles?.getChildren?.() || []).filter(
                                    item => item?.active !== false && item?.optionalRouteId
                                ).length
                                : (scene.optionalRoutePickup?.active !== false &&
                                    scene.optionalRoutePickup ? 1 : 0));
                        return {
                            selectedPath: reward?.choice?.selectedPath,
                            progress: reward?.progress,
                            completed: reward?.completed === true,
                            guardCharges: scene.optionalRouteGuardCharges,
                            bondReserveReady: scene.bondReserveReady === true,
                            remainingPickups
                        };
                    })()`),
                    { timeoutMs: 3500, message: `${sceneName} consumed reward reload` }
                );
                if (
                    restoredConsumed.selectedPath !== 'optional' ||
                    restoredConsumed.progress !== optionalRequired ||
                    restoredConsumed.completed !== true ||
                    restoredConsumed.guardCharges !== 0 ||
                    restoredConsumed.bondReserveReady !== false ||
                    restoredConsumed.remainingPickups !== 0
                ) {
                    throw new Error(
                        `${sceneName} respawned a consumed optional reward: ` +
                        JSON.stringify(restoredConsumed)
                    );
                }
                optionalRouteCompletion.consumedReloadState = restoredConsumed;
                await pressEnter(session);
                await delay(300);
            }
        }

        if (route === 'finalVoid') {
            finalRiftCrossing = await smokeFinalVoidRiftCrossing(session);
        }
        if (route === 'auroraDepths') {
            auroraQuietLightClimb = await smokeAuroraQuietLightClimb(session);
        }
        if (route === 'mythicalForest') {
            forestForwardHandoffs = await smokeForestForwardHandoffs(session);
        }

        try {
            await waitFor(
                () => evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                    scene?.refreshGuardianGateState?.(true);
                    return scene?.guardianGateState?.ready === true;
                })()`),
                { timeoutMs: 3500, message: `${sceneName} ready guardian gate` }
            );
        } catch (error) {
            const diagnostics = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                return {
                    gate: scene?.guardianGateState ? {
                        ready: scene.guardianGateState.ready,
                        status: scene.guardianGateState.status
                    } : null,
                    routeAligned: scene?.reefRouteAligned ??
                        scene?.forestRouteAligned ??
                        scene?.caveRouteAligned ??
                        scene?.peakRouteAligned ??
                        scene?.auroraRouteAligned ??
                        scene?.finalRouteAligned ?? null,
                    signalCount: scene?.orderedRouteSignals?.filter(
                        signal => signal?.completed
                    ).length,
                    shipPartCollected: scene?.shipPartCollected,
                    bossFightActive: scene?.bossFightActive,
                    playerDead: scene?.isPlayerDead,
                    persistedRouteState: window.GameState?.get?.(
                        'story.projectBeacon.expeditionCheckpoint.routeState'
                    ) || null
                };
            })()`);
            throw new Error(`${error.message}: ${JSON.stringify(diagnostics)}`);
        }
        const guardianEntrySetup = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            const gate = scene?.guardianGateState;
            if (!scene?.player || !gate?.ready) return null;
            const persisted = window.GameState?.get?.(
                'story.projectBeacon.expeditionCheckpoint'
            );
            let stagedEnemyArtifactCount = 0;
            let stagedEnemyTimerCount = 0;
            if (${JSON.stringify(route)} === 'mythicalForest') {
                const wisp = scene.forestWisps?.find(enemy => enemy?.active);
                if (wisp) {
                    scene.wispShoot?.(wisp);
                    stagedEnemyArtifactCount = wisp.runtimeArtifacts?.size || 0;
                    stagedEnemyTimerCount = wisp.runtimeTimers?.size || 0;
                }
            }
            if (${JSON.stringify(route)} === 'crystalCaves') {
                stagedEnemyTimerCount = (
                    scene.enemies?.getChildren?.() || []
                ).reduce(
                    (total, enemy) => total + (enemy?.runtimeTimers?.size || 0),
                    0
                );
            }
            if ([
                'auroraDepths',
                'voidPeaks',
                'finalVoid'
            ].includes(${JSON.stringify(route)})) {
                const supportId = ${JSON.stringify(route)} === 'auroraDepths'
                    ? 'aurora-phoenix-gate'
                    : (${JSON.stringify(route)} === 'voidPeaks'
                        ? 'peak-titan-gate'
                        : 'final-empress-gate');
                const support = scene.getTraversalSupport?.(supportId);
                if (!support?.body || !scene.player?.body) return null;
                scene.player.body.reset(
                    gate.x,
                    support.body.top - scene.player.body.height - 18
                );
                scene.player.setVelocity?.(0, 0);
            } else {
                scene.player.setPosition(gate.x, gate.y);
                scene.player.setVelocity?.(0, 0);
            }
            return {
                persistedId: persisted?.checkpointId || null,
                persistedIndex: persisted?.checkpointIndex ?? null,
                stagedEnemyArtifactCount,
                stagedEnemyTimerCount,
                stagedSupportId: ${JSON.stringify(route)} === 'auroraDepths'
                    ? 'aurora-phoenix-gate'
                    : (${JSON.stringify(route)} === 'voidPeaks'
                        ? 'peak-titan-gate'
                        : (${JSON.stringify(route)} === 'finalVoid'
                            ? 'final-empress-gate'
                            : null))
            };
        })()`);
        if (!guardianEntrySetup) {
            throw new Error(`${sceneName} could not enter its ready guardian gate`);
        }

        const guardianEntry = await waitFor(
            () => evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                const encounter = scene?.guardianEncounter;
                if (!scene?.bossFightActive || !encounter?.active) return null;
                const persisted = window.GameState?.get?.(
                    'story.projectBeacon.expeditionCheckpoint'
                );
                return {
                    guardianId: encounter.id,
                    checkpointX: scene.checkpointPosition?.x,
                    checkpointY: scene.checkpointPosition?.y,
                    gateCleared: scene.guardianGateState == null,
                    duplicateAccepted: scene.beginGuardianEncounter?.({
                        id: 'duplicate_guardian',
                        checkpoint: { x: 100, y: 100 },
                        start: () => {}
                    }),
                    remainingPatrols: (scene.enemies?.getChildren?.() || [])
                        .filter(enemy => enemy?.active !== false).length,
                    remainingCombatCues: (scene.enemies?.getChildren?.() || [])
                        .filter(enemy => enemy?.active !== false && enemy?.combatCue?.active)
                        .length,
                    retirement: scene.lastRouteEnemyRetirement
                        ? { ...scene.lastRouteEnemyRetirement }
                        : null,
                    runtimeDisposals: scene.enemyRuntimeDisposalTotals
                        ? { ...scene.enemyRuntimeDisposalTotals }
                        : null,
                    forestEnemyAISchedulerActive: Boolean(
                        scene.forestEnemyAISchedulerActive
                    ),
                    caveEnemyAISchedulerActive: Boolean(
                        scene.caveEnemyAISchedulerActive
                    ),
                    peakEnemyAISchedulerActive: Boolean(
                        scene.peakEnemyAISchedulerActive
                    ),
                    auroraEnemyAISchedulerActive: Boolean(
                        scene.auroraEnemyAISchedulerActive
                    ),
                    persistedId: persisted?.checkpointId || null,
                    persistedIndex: persisted?.checkpointIndex ?? null
                };
            })()`),
            { timeoutMs: 3000, message: `${sceneName} guardian entry handoff` }
        );
        if (
            !guardianEntry.guardianId ||
            !Number.isFinite(guardianEntry.checkpointX) ||
            !Number.isFinite(guardianEntry.checkpointY) ||
            guardianEntry.gateCleared !== true ||
            guardianEntry.duplicateAccepted !== false ||
            guardianEntry.remainingPatrols !== 0 ||
            guardianEntry.remainingCombatCues !== 0 ||
            guardianEntry.retirement?.enemyCount < 1 ||
            (route === 'mythicalForest' &&
                guardianEntry.runtimeDisposals?.timerCount <
                    guardianEntrySetup.stagedEnemyTimerCount) ||
            (route === 'mythicalForest' &&
                guardianEntrySetup.stagedEnemyTimerCount < 1) ||
            (route === 'mythicalForest' &&
                guardianEntry.forestEnemyAISchedulerActive !== false) ||
            (route === 'mythicalForest' &&
                guardianEntrySetup.stagedEnemyArtifactCount < 1) ||
            (route === 'mythicalForest' &&
                guardianEntry.runtimeDisposals?.artifactCount <
                    guardianEntrySetup.stagedEnemyArtifactCount) ||
            (route === 'crystalCaves' &&
                guardianEntrySetup.stagedEnemyTimerCount > 2) ||
            (route === 'crystalCaves' &&
                guardianEntry.runtimeDisposals?.timerCount !== 2) ||
            (route === 'crystalCaves' &&
                guardianEntry.caveEnemyAISchedulerActive !== false) ||
            (route === 'voidPeaks' &&
                guardianEntry.peakEnemyAISchedulerActive !== false) ||
            (route === 'auroraDepths' &&
                guardianEntry.auroraEnemyAISchedulerActive !== false) ||
            guardianEntry.persistedId !== guardianEntrySetup.persistedId ||
            guardianEntry.persistedIndex !== guardianEntrySetup.persistedIndex
        ) {
            throw new Error(
                `${sceneName} guardian handoff was not atomic: ` +
                JSON.stringify({ guardianEntrySetup, guardianEntry })
            );
        }

        const guardianCombatReady = await waitFor(
            () => evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                if (
                    !scene?.bossFightActive ||
                    scene?.physics?.world?.isPaused ||
                    !(scene?.boss?.active || scene?.bossBody?.active)
                ) return null;
                return { bossHealth: Number(scene.bossHealth) };
            })()`),
            { timeoutMs: 15000, message: `${sceneName} guardian combat start` }
        );

        const guardianBlast = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            const target = scene?.getBossCombatTarget?.();
            if (!scene?.player || !target || !scene?.bossFightActive) return null;

            scene.bossRecoveryUntil = 0;
            scene.titanRecoveryUntil = 0;
            if (scene.boss) scene.boss.isRecovering = false;
            scene.crystalEnergy = Math.max(3, Number(scene.crystalEnergy) || 0);
            scene.freeSpecialAttackCharges = 0;
            const energyBefore = scene.crystalEnergy;
            const healthBefore = Number(scene.bossHealth);
            const returnPosition = {
                x: scene.checkpointPosition?.x ?? scene.player.x,
                y: scene.checkpointPosition?.y ?? scene.player.y
            };

            scene.player.setPosition(target.x - 140, target.y);
            scene.player.setVelocity?.(0, 0);
            scene.player.facingRight = true;
            scene.performSpecialAttack();

            const result = {
                healthBefore,
                healthAfter: Number(scene.bossHealth),
                energyBefore,
                energyAfter: Number(scene.crystalEnergy),
                targetDistance: Phaser.Math.Distance.Between(
                    scene.player.x,
                    scene.player.y,
                    target.x,
                    target.y
                ),
                bossFightActive: scene.bossFightActive === true,
                bossDefeated: scene.bossDefeated === true
            };
            scene.player.setPosition(returnPosition.x, returnPosition.y);
            scene.player.setVelocity?.(0, 0);
            return result;
        })()`);
        if (
            !guardianBlast ||
            !Number.isFinite(guardianBlast.healthBefore) ||
            !Number.isFinite(guardianBlast.healthAfter) ||
            guardianBlast.healthAfter !== guardianBlast.healthBefore - 3 ||
            guardianBlast.energyAfter !== guardianBlast.energyBefore - 3 ||
            guardianBlast.targetDistance >= 300 ||
            guardianBlast.bossFightActive !== true ||
            guardianBlast.bossDefeated !== false
        ) {
            throw new Error(
                `${sceneName} Super Blast did not damage its guardian predictably: ` +
                JSON.stringify({ guardianCombatReady, guardianBlast })
            );
        }
        await delay(650);

        await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            if (!scene?.player || !scene?.bossFightActive) return false;
            scene.__guardianRecoveryProbe = { value: 0 };
            scene.__guardianRecoveryTween = scene.tweens.add({
                targets: scene.__guardianRecoveryProbe,
                value: 100,
                duration: 1200
            });
            return true;
        })()`);
        await delay(180);

        const deathState = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            if (!scene?.bossFightActive || !scene?.guardianEncounter?.active) return null;
            scene.__guardianRecoveryTimerFired = false;
            scene.__guardianRecoveryTimer = scene.time.delayedCall(120, () => {
                scene.__guardianRecoveryTimerFired = true;
            });
            scene.onPlayerDeath();
            return {
                sceneTime: scene.time.now,
                probeValue: scene.__guardianRecoveryProbe?.value,
                bossHealth: Number(scene.bossHealth),
                timePaused: scene.time.paused === true,
                physicsPaused: scene.physics.world.isPaused === true,
                recoveryCopy: (scene.deathScreenElements || [])
                    .map(element => element?.text || '')
                    .filter(Boolean)
            };
        })()`);
        if (!deathState) {
            throw new Error(`${sceneName} could not stage guardian recovery`);
        }
        await delay(350);
        const frozenState = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            return {
                sceneTime: scene?.time?.now,
                probeValue: scene?.__guardianRecoveryProbe?.value,
                bossHealth: Number(scene?.bossHealth),
                timePaused: scene?.time?.paused === true,
                physicsPaused: scene?.physics?.world?.isPaused === true,
                timerFired: scene?.__guardianRecoveryTimerFired === true,
                playerDead: scene?.isPlayerDead === true
            };
        })()`);
        if (
            deathState.timePaused !== true ||
            deathState.physicsPaused !== true ||
            !deathState.recoveryCopy.includes('RETURN TO GUARDIAN STANCE') ||
            frozenState.timePaused !== true ||
            frozenState.physicsPaused !== true ||
            frozenState.timerFired !== false ||
            frozenState.playerDead !== true ||
            Math.abs(frozenState.probeValue - deathState.probeValue) > 0.01 ||
            frozenState.bossHealth !== deathState.bossHealth
        ) {
            throw new Error(
                `${sceneName} guardian recovery did not freeze safely: ` +
                JSON.stringify({ deathState, frozenState })
            );
        }

        const recovered = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            scene?.retryFromCheckpoint?.();
            const persisted = window.GameState?.get?.(
                'story.projectBeacon.expeditionCheckpoint'
            );
            scene?.__guardianRecoveryTimer?.remove?.();
            scene?.__guardianRecoveryTween?.remove?.();
            delete scene.__guardianRecoveryTimer;
            delete scene.__guardianRecoveryTimerFired;
            delete scene.__guardianRecoveryTween;
            delete scene.__guardianRecoveryProbe;
            return {
                playerX: scene?.player?.x,
                playerY: scene?.player?.y,
                checkpointX: scene?.checkpointPosition?.x,
                checkpointY: scene?.checkpointPosition?.y,
                health: scene?.health,
                maxHealth: scene?.maxHealth,
                playerDead: scene?.isPlayerDead === true,
                timePaused: scene?.time?.paused === true,
                physicsPaused: scene?.physics?.world?.isPaused === true,
                encounterActive: scene?.guardianEncounter?.active === true,
                bossFightActive: scene?.bossFightActive === true,
                bossHealth: Number(scene?.bossHealth),
                persistedId: persisted?.checkpointId || null,
                persistedIndex: persisted?.checkpointIndex ?? null
            };
        })()`);
        if (
            recovered.playerX !== recovered.checkpointX ||
            recovered.playerY !== recovered.checkpointY ||
            recovered.health !== recovered.maxHealth ||
            recovered.playerDead !== false ||
            recovered.timePaused !== false ||
            recovered.physicsPaused !== false ||
            recovered.encounterActive !== true ||
            recovered.bossFightActive !== true ||
            recovered.bossHealth !== guardianBlast.healthAfter ||
            recovered.persistedId !== guardianEntrySetup.persistedId ||
            recovered.persistedIndex !== guardianEntrySetup.persistedIndex
        ) {
            throw new Error(
                `${sceneName} guardian stance did not recover cleanly: ` +
                JSON.stringify({ guardianCombatReady, guardianBlast, recovered })
            );
        }

        await delay(450);
        const settledRecovery = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            return {
                playerX: scene?.player?.x,
                playerY: scene?.player?.y,
                checkpointX: scene?.checkpointPosition?.x,
                checkpointY: scene?.checkpointPosition?.y,
                playerDead: scene?.isPlayerDead === true,
                respawning: scene?.isRespawning === true,
                physicsPaused: scene?.physics?.world?.isPaused === true,
                timePaused: scene?.time?.paused === true
            };
        })()`);
        if (
            Math.abs(settledRecovery.playerX - settledRecovery.checkpointX) > 80 ||
            Math.abs(settledRecovery.playerY - settledRecovery.checkpointY) > 120 ||
            settledRecovery.playerDead !== false ||
            settledRecovery.respawning !== false ||
            settledRecovery.physicsPaused !== false ||
            settledRecovery.timePaused !== false
        ) {
            throw new Error(
                `${sceneName} guardian stance was not stable after recovery: ` +
                JSON.stringify(settledRecovery)
            );
        }
        guardianRecovery = {
            entry: guardianEntry,
            blast: guardianBlast,
            frozen: frozenState,
            recovered,
            settled: settledRecovery
        };
    }
    if (exceptions.length) {
        throw new Error(`${sceneName} raised browser exceptions: ${exceptions.join(' | ')}`);
    }
    const gameplayVideo = await stopGameplayVideo();
    await captureGameplayStill(session, `realm-${route}.png`);
    return {
        ...state,
        guardianGate,
        traversalAudit,
        jump: { before: beforeJump, during: jumped, released: jumpReleased },
        joystick: { movedRight, movedLeft, vertical: verticalJoystick },
        returnCurrents,
        reefAscentCurrent,
        reefForwardCurrents,
        finalRiftCrossing,
        auroraQuietLightClimb,
        forestForwardHandoffs,
        crystalCoreLift,
        auroraGroundedObjectives,
        peaksGroundedObjectives,
        finalGroundedObjectives,
        cavesGroundedObjectives,
        reefWaypointSupports,
        forestAnchorSupports,
        framePacing,
        forestEnemyActivation,
        forestEnemyScheduler,
        forestCoinPickup,
        caveCoinPickup,
        reefTrailBudget,
        peakEnemyActivation,
        auroraEnemyActivation,
        renderStability,
        combatFeedback,
        liveStomp,
        routeChoice,
        outOfOrderGuard,
        routeHandoff,
        routeCompletion,
        optionalRouteCompletion,
        guardianRecovery,
        gameplayVideo
    };
}

async function smokeTraversalTopology(session, levels, exceptions) {
    const results = {};

    for (const [route, sceneName] of levels.filter(
        ([candidate]) => SMOKE_CASE === 'all' || SMOKE_CASE === candidate
    )) {
        exceptions.length = 0;
        await navigate(session, `${BASE_URL}/play/?reset=true`);
        await waitForScene(session, 'HatchingScene');
        await startCampaignScene(session, { route, sceneName });
        await waitFor(
            () => evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                return Boolean(
                    scene?.player?.active &&
                    scene?._levelContentCreated &&
                    scene?.platforms?.getChildren?.().length
                );
            })()`),
            { timeoutMs: 15000, message: `${sceneName} traversal geometry` }
        );

        const audit = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            return scene.auditTraversalTopology();
        })()`);
        const routeChoiceRuntime = await smokeDeclaredRouteChoiceSupports(
            session,
            route,
            sceneName
        );
        const finalVoidFlowFailed = route === 'finalVoid' && (
            Number(audit?.flow?.requiredJumpCount) < 4 ||
            Number(audit?.flow?.backtrackDistance) !== 0 ||
            audit?.flow?.comfortPassed !== true ||
            audit?.flow?.targets?.find(
                target => target.id === 'final_bond_1'
            )?.pathSupportIds?.at?.(-1) !== 'final-opening-step' ||
            audit?.flow?.targets?.find(
                target => target.id === 'final_bond_2'
            )?.pathSupportIds?.at?.(-1) !== 'final-return-route' ||
            audit?.flow?.targets?.find(
                target => target.id === 'final_bond_3'
            )?.pathSupportIds?.at?.(-1) !== 'final-rift-step-4' ||
            audit?.flow?.targets?.find(
                target => target.id === 'empress_seal'
            )?.pathSupportIds?.at?.(-1) !== 'final-empress-gate'
        );
        const auroraFlowFailed = route === 'auroraDepths' && (
            Number(audit?.flow?.requiredJumpCount) < 7 ||
            Number(audit?.flow?.backtrackDistance) !== 0 ||
            audit?.flow?.comfortPassed !== true ||
            audit?.flow?.optionalComfortPassed !== true ||
            (audit?.flow?.uncomfortableOptionalTargetIds || []).length > 0 ||
            audit?.flow?.targets?.find(
                target => target.id === 'aurora_prism_1'
            )?.pathSupportIds?.at?.(-1) !== 'aurora-lower-prism' ||
            audit?.flow?.targets?.find(
                target => target.id === 'aurora_prism_2'
            )?.pathSupportIds?.at?.(-1) !== 'aurora-heart-launch' ||
            audit?.flow?.targets?.find(
                target => target.id === 'aurora_prism_3'
            )?.pathSupportIds?.at?.(-1) !== 'aurora-sky-prism' ||
            audit?.flow?.targets?.find(
                target => target.id === 'aurora_reactor_gate'
            )?.pathSupportIds?.at?.(-1) !== 'aurora-phoenix-gate'
        );
        const peaksFlowFailed = route === 'voidPeaks' && (
            audit?.flow?.comfortPassed !== true ||
            Number(audit?.flow?.backtrackDistance) !== 0 ||
            audit?.flow?.targets?.find(
                target => target.id === 'peaks_relay_1'
            )?.pathSupportIds?.at?.(-1) !== 'peak-lower-relay-overlook' ||
            audit?.flow?.targets?.find(
                target => target.id === 'peaks_relay_2'
            )?.pathSupportIds?.at?.(-1) !== 'peak-warning-lower' ||
            audit?.flow?.targets?.find(
                target => target.id === 'peaks_relay_3'
            )?.pathSupportIds?.at?.(-1) !== 'peak-summit-relay' ||
            audit?.flow?.targets?.find(
                target => target.id === 'titan_pass'
            )?.pathSupportIds?.at?.(-1) !== 'peak-titan-gate'
        );
        const forestFlowFailed = route === 'mythicalForest' && (
            audit?.flow?.comfortPassed !== true ||
            (audit?.flow?.uncomfortableTargetIds || []).length > 0 ||
            Number(audit?.flow?.backtrackDistance) !== 0 ||
            audit?.flow?.routeTargets?.find(
                target => target.id === 'forest_anchor_1'
            )?.pathSupportIds?.at?.(-1) !== 'forest-ground-3' ||
            audit?.flow?.routeTargets?.find(
                target => target.id === 'forest_anchor_2'
            )?.pathSupportIds?.at?.(-1) !== 'forest-ground-5' ||
            audit?.flow?.routeTargets?.find(
                target => target.id === 'forest_anchor_3'
            )?.pathSupportIds?.at?.(-1) !== 'forest-ground-6'
        );
        const crystalCoreFlow = audit?.flow?.targets?.find(
            target => target.id === 'crystal_core'
        );
        const cavesFlowFailed = route === 'crystalCaves' && (
            audit?.flow?.comfortPassed !== true ||
            audit?.flow?.targets?.find(
                target => target.id === 'caves_anchor_1'
            )?.pathSupportIds?.at?.(-1) !== 'caves-echo-upper' ||
            audit?.flow?.targets?.find(
                target => target.id === 'caves_anchor_2'
            )?.pathSupportIds?.at?.(-1) !== 'caves-grove-step' ||
            audit?.flow?.targets?.find(
                target => target.id === 'caves_anchor_3'
            )?.pathSupportIds?.at?.(-1) !== 'caves-guardian-left' ||
            Number(crystalCoreFlow?.jumpCount) > 3 ||
            crystalCoreFlow?.pathSupportIds?.at?.(-2) !== 'caves-guardian-approach' ||
            crystalCoreFlow?.pathSupportIds?.at?.(-1) !== 'caves-core-refuge'
        );
        const reefTrenchFlow = audit?.flow?.targets?.find(
            target => target.id === 'reef_star_trench'
        );
        const reefDriveFlow = audit?.flow?.targets?.find(
            target => target.id === 'dimensional_drive'
        );
        const reefWaypointOneFlow = audit?.flow?.targets?.find(
            target => target.id === 'reef_waypoint_1'
        );
        const reefWaypointTwoFlow = audit?.flow?.targets?.find(
            target => target.id === 'reef_waypoint_2'
        );
        const reefWaypointThreeFlow = audit?.flow?.targets?.find(
            target => target.id === 'reef_waypoint_3'
        );
        const reefFlowFailed = route === 'reef' && (
            audit?.flow?.comfortPassed !== true ||
            audit?.flow?.optionalComfortPassed !== true ||
            Number(audit?.flow?.backtrackDistance) !== 0 ||
            reefWaypointOneFlow?.pathSupportIds?.at?.(-1) !== 'reef-drift-relay' ||
            reefWaypointTwoFlow?.pathSupportIds?.at?.(-1) !== 'reef-traveler-relay' ||
            Number(reefWaypointTwoFlow?.jumpCount) < 1 ||
            reefWaypointThreeFlow?.pathSupportIds?.at?.(-1) !== 'reef-passage-vector' ||
            reefTrenchFlow?.reachable !== true ||
            reefTrenchFlow?.pathSupportIds?.at?.(-1) !== 'reef-trench-3' ||
            reefDriveFlow?.reachable !== true ||
            reefDriveFlow?.pathSupportIds?.at?.(-1) !== 'reef-drive-relic'
        );
        if (
            !audit?.passed ||
            audit?.routeChoices?.passed !== true ||
            Number(audit?.routeChoices?.auditedRouteCount) < 1 ||
            routeChoiceRuntime?.passed !== true ||
            audit?.flow?.strandingSupportCount !== 0 ||
            finalVoidFlowFailed ||
            auroraFlowFailed ||
            peaksFlowFailed ||
            forestFlowFailed ||
            cavesFlowFailed ||
            reefFlowFailed ||
            exceptions.length
        ) {
            const supportGeometry = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                return (scene.platforms?.getChildren?.() || []).map((support, index) => ({
                    id: support.traversalId || ('support-' + index),
                    type: support.platformType || 'solid',
                    left: Math.round(support.body?.left || 0),
                    right: Math.round(support.body?.right || 0),
                    top: Math.round(support.body?.top || 0),
                    bottom: Math.round(support.body?.bottom || 0)
                }));
            })()`);
            throw new Error(
                `${sceneName} failed conservative topology audit: ${JSON.stringify({
                    audit,
                    finalVoidFlowFailed,
                    auroraFlowFailed,
                    peaksFlowFailed,
                    forestFlowFailed,
                    cavesFlowFailed,
                    reefFlowFailed,
                    routeChoiceRuntime,
                    exceptions,
                    supportGeometry
                })}`
            );
        }

        results[route] = { ...audit, routeChoiceRuntime };
        process.stdout.write(
            `PASS ${sceneName}Topology ` +
            `${audit.reachableSupportCount}/${audit.supportCount} ` +
            `deadEnds=${audit.flow?.strandingSupportCount || 0}\n`
        );
    }

    return results;
}

async function smokeDeclaredRouteChoiceSupports(session, route, sceneName) {
    const routeId = {
        mythicalForest: 'forest_canopy_run',
        crystalCaves: 'caves_secret_slide',
        reef: 'reef_star_trench',
        voidPeaks: 'peaks_relic_ridge',
        auroraDepths: 'aurora_quiet_light',
        finalVoid: 'final_trust_bridge'
    }[route];
    const routeProperty = {
        mythicalForest: 'forestRouteChoice',
        crystalCaves: 'crystalChamberRoute',
        reef: 'reefRouteChoice',
        voidPeaks: 'peakRouteChoice',
        auroraDepths: 'auroraRouteChoice',
        finalVoid: 'finalRouteChoice'
    }[route];
    if (!routeId || !routeProperty) return { passed: false, reason: 'mapping' };

    const getLaneSupportIds = lane => {
        const supportProperty = `${lane}SupportIds`;
        return evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            const choice = scene?.optionalRouteRewards?.get?.(
                ${JSON.stringify(routeId)}
            )?.choice;
            return [...(choice?.[${JSON.stringify(supportProperty)}] || [])];
        })()`);
    };

    const stageLane = async (lane, supportId) => {
        return evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            const routeState = scene?.optionalRouteRewards?.get?.(${JSON.stringify(routeId)});
            const choice = routeState?.choice;
            const support = scene?.getTraversalSupport?.(${JSON.stringify(supportId)});
            if (!scene?.player?.body || !choice || !support?.body) return null;
            scene.player.body.reset(
                support.x,
                support.body.top - scene.player.body.height - 18
            );
            scene.player.setVelocity?.(0, 0);
            return {
                lane: ${JSON.stringify(lane)},
                supportId: support.traversalId
            };
        })()`);
    };

    const resetChoice = () => evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
        const choice = scene?.optionalRouteRewards?.get?.(${JSON.stringify(routeId)})?.choice;
        if (!scene?.player || !choice) return false;
        scene[${JSON.stringify(routeProperty)}] = ${route === 'auroraDepths' ? 'null' : "''"};
        choice.selectedPath = null;
        choice.mainEntered = false;
        choice.optionalEntered = false;
        choice.rejoined = false;
        choice.sequence = null;
        scene.routeChoiceSequence = 0;
        scene.player.setPosition(120, 120);
        scene.player.setVelocity?.(0, 0);
        return true;
    })()`);

    const supportIds = {
        main: await getLaneSupportIds('main'),
        optional: await getLaneSupportIds('optional'),
        rejoin: await getLaneSupportIds('rejoin')
    };
    if (Object.values(supportIds).some(ids => !ids?.length)) {
        return { passed: false, reason: 'lane-support-ids', supportIds };
    }

    const waitForLane = lane => waitFor(
        () => evaluate(session, `(() => {
            const choice = window.mythicalGame.scene
                .getScene(${JSON.stringify(sceneName)})
                ?.optionalRouteRewards?.get?.(${JSON.stringify(routeId)})?.choice;
            if (${JSON.stringify(lane)} === 'main') {
                return choice?.selectedPath === 'main' && choice?.mainEntered
                    ? { selectedPath: choice.selectedPath, mainEntered: true }
                    : null;
            }
            if (${JSON.stringify(lane)} === 'optional') {
                return choice?.selectedPath === 'optional' && choice?.optionalEntered
                    ? { selectedPath: choice.selectedPath, optionalEntered: true }
                    : null;
            }
            return choice?.selectedPath === 'optional' && choice?.rejoined
                ? { selectedPath: choice.selectedPath, rejoined: true }
                : null;
        })()`),
        { timeoutMs: 8000, message: `${sceneName} declared ${lane} support landing` }
    ).catch(async error => {
        const diagnostic = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            const choice = scene?.optionalRouteRewards?.get?.(
                ${JSON.stringify(routeId)}
            )?.choice;
            const body = scene?.player?.body;
            const laneSupportIds = ${JSON.stringify(supportIds)}[${JSON.stringify(lane)}];
            return {
                lane: ${JSON.stringify(lane)},
                selectedPath: choice?.selectedPath || null,
                mainEntered: choice?.mainEntered === true,
                optionalEntered: choice?.optionalEntered === true,
                rejoined: choice?.rejoined === true,
                player: body ? {
                    x: scene.player.x,
                    y: scene.player.y,
                    left: body.left,
                    right: body.right,
                    top: body.top,
                    bottom: body.bottom,
                    velocityX: body.velocity?.x,
                    velocityY: body.velocity?.y,
                    blockedDown: body.blocked?.down === true,
                    touchingDown: body.touching?.down === true,
                    isGrounded: scene.isGrounded === true,
                    active: scene.player.active !== false
                } : null,
                supports: laneSupportIds.map(id => {
                    const support = scene?.getTraversalSupport?.(id);
                    return {
                        id,
                        left: support?.body?.left,
                        right: support?.body?.right,
                        top: support?.body?.top
                    };
                }),
                nearbyEnemies: (scene?.enemies?.getChildren?.() || [])
                    .filter(enemy => Math.abs((enemy?.x || 0) - (scene?.player?.x || 0)) < 240)
                    .map(enemy => ({
                        x: enemy.x,
                        y: enemy.y,
                        health: enemy.health,
                        beat: enemy.encounterBeat
                    }))
            };
        })()`);
        throw new Error(`${error.message}: ${JSON.stringify(diagnostic)}`);
    });

    const probeLane = async lane => {
        const results = [];
        for (const supportId of supportIds[lane]) {
            const reset = await resetChoice();
            if (!reset) return null;
            if (lane === 'rejoin') {
                const optionalStage = await stageLane(
                    'optional',
                    supportIds.optional[0]
                );
                if (!optionalStage) return null;
                await waitForLane('optional');
            }
            const staged = await stageLane(lane, supportId);
            if (!staged) return null;
            const state = await waitForLane(lane);
            results.push({ ...state, supportId: staged.supportId });
        }
        return results;
    };

    const main = await probeLane('main');
    const optional = await probeLane('optional');
    const rejoin = await probeLane('rejoin');

    return {
        passed: Boolean(
            main?.length === supportIds.main.length &&
            optional?.length === supportIds.optional.length &&
            rejoin?.length === supportIds.rejoin.length
        ),
        main,
        optional,
        rejoin,
        supportIds
    };
}

async function startAuroraRouteJourney(session) {
    await navigate(session, `${BASE_URL}/play/?reset=true`);
    await waitForScene(session, 'HatchingScene');
    await startCampaignScene(session, {
        route: 'auroraDepths',
        sceneName: 'AuroraDepthsLevel'
    });
    await waitFor(
        () => evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('AuroraDepthsLevel');
            return Boolean(
                scene?.player?.active &&
                scene?._levelContentCreated &&
                scene?.signalPrisms?.length === 3 &&
                scene?.optionalRouteRewards?.get?.('aurora_quiet_light')
            );
        })()`),
        { timeoutMs: 15000, message: 'Aurora route journey gameplay' }
    );
}

async function stagePlatformBoundRouteSignal(session, {
    sceneName,
    route,
    index
}) {
    const staged = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
        const signal = ${JSON.stringify(route)} === 'mythicalForest'
            ? scene?.checkpointAnchors?.[${index}]
            : (${JSON.stringify(route)} === 'auroraDepths'
                ? scene?.signalPrisms?.[${index}]
                : (${JSON.stringify(route)} === 'voidPeaks'
                ? scene?.beaconRelays?.[${index}]
                : (${JSON.stringify(route)} === 'finalVoid'
                    ? scene?.bondAnchors?.[${index}]
                    : scene?.beaconAnchors?.[${index}])));
        const support = scene?.getTraversalSupport?.(
            signal?.activationSupportIds?.[0]
        );
        if (!scene?.player?.body || !signal?.zone?.active || !support?.body) {
            return null;
        }
        scene.player.body.reset(
            signal.x,
            support.body.top - scene.player.body.height - 18
        );
        scene.player.setVelocity?.(0, 0);
        return {
            id: signal.id,
            index: signal.index,
            supportId: support.traversalId,
            supportTop: support.body.top
        };
    })()`);
    if (!staged) {
        throw new Error(`${sceneName} signal ${index + 1} could not be staged`);
    }
    return waitFor(
        () => evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            const signal = ${JSON.stringify(route)} === 'mythicalForest'
                ? scene?.checkpointAnchors?.[${index}]
                : (${JSON.stringify(route)} === 'auroraDepths'
                    ? scene?.signalPrisms?.[${index}]
                    : (${JSON.stringify(route)} === 'voidPeaks'
                    ? scene?.beaconRelays?.[${index}]
                    : (${JSON.stringify(route)} === 'finalVoid'
                        ? scene?.bondAnchors?.[${index}]
                        : scene?.beaconAnchors?.[${index}])));
            const support = scene?.getTraversalSupport?.(
                signal?.activationSupportIds?.[0]
            );
            const body = scene?.player?.body;
            const checkpoint = scene?.checkpointPosition;
            const complete = ${JSON.stringify(route)} === 'auroraDepths'
                ? signal?.aligned === true
                : signal?.activated === true;
            const groundedCheckpoint = complete &&
                checkpoint?.index === ${index} &&
                support?.body && body &&
                checkpoint.x >= support.body.left &&
                checkpoint.x <= support.body.right &&
                checkpoint.y < support.body.top &&
                checkpoint.y >= support.body.top - 100;
            return groundedCheckpoint ? {
                id: signal.id,
                index: signal.index,
                firstSignalIndex: signal.index,
                supportId: support.traversalId,
                checkpointX: checkpoint.x,
                checkpointY: checkpoint.y,
                supportTop: support.body.top
            } : null;
        })()`),
        {
            timeoutMs: 2500,
            message: `${sceneName} signal ${index + 1} grounded landing`
        }
    );
}

async function stageAuroraPrism(session, index) {
    return stagePlatformBoundRouteSignal(session, {
        sceneName: 'AuroraDepthsLevel',
        route: 'auroraDepths',
        index
    });
}

async function restartAuroraFromCheckpoint(session) {
    await evaluate(session, `(() => {
        const game = window.mythicalGame;
        game.scene.stop('AuroraDepthsLevel');
        game.scene.start('AuroraDepthsLevel', {
            forceMobileControls: true,
            platformerPreviewSize: 'mobile'
        });
        return true;
    })()`);
    await waitForScene(session, 'AuroraDepthsLevel');
    return waitFor(
        () => evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('AuroraDepthsLevel');
            return scene?.checkpointResumeApplied === true;
        })()`),
        { timeoutMs: 15000, message: 'Aurora checkpoint restart' }
    );
}

async function smokeAuroraRouteJourney(session, exceptions) {
    exceptions.length = 0;
    await startAuroraRouteJourney(session);
    await stageAuroraPrism(session, 0);
    await stageAuroraPrism(session, 1);

    await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('AuroraDepthsLevel');
        const choice = scene.optionalRouteRewards.get('aurora_quiet_light').choice;
        const support = scene.getTraversalSupport?.('aurora-ground-3');
        if (!scene.player?.body || !support?.body || !choice) return false;
        scene.player.body.reset(
            Math.max(support.body.left + 40, choice.mainZone.left + 40),
            support.body.top - scene.player.body.height - 18
        );
        scene.player.setVelocity?.(0, 0);
        return true;
    })()`);
    const directChoice = await waitFor(
        () => evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('AuroraDepthsLevel');
            const route = scene?.optionalRouteRewards?.get?.('aurora_quiet_light');
            const checkpoint = window.GameState.get(
                'story.projectBeacon.expeditionCheckpoint'
            );
            if (route?.choice?.selectedPath !== 'main') return null;
            return {
                selectedPath: route.choice.selectedPath,
                choice: scene.auroraRouteChoice,
                charge: scene.currentChargeReady,
                auraActive: Boolean(scene.currentChargeAura?.active),
                shelterActive: Boolean(scene.optionalRoutePickup?.active),
                checkpoint
            };
        })()`),
        { timeoutMs: 2500, message: 'Aurora direct route zone selection' }
    );
    if (
        directChoice.choice !== 'shadow_current' ||
        directChoice.charge !== true ||
        directChoice.auraActive !== true ||
        directChoice.shelterActive !== false ||
        directChoice.checkpoint?.routeState?.auroraRouteChoice !== 'shadow_current' ||
        directChoice.checkpoint?.routeState?.currentChargeReady !== true
    ) {
        throw new Error(`Aurora direct route was not persisted: ${JSON.stringify(directChoice)}`);
    }

    await restartAuroraFromCheckpoint(session);
    const directRestore = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('AuroraDepthsLevel');
        scene.bossDefeated = false;
        scene.bossFightActive = true;
        scene.boss = {
            active: true,
            x: scene.player.x + 60,
            y: scene.player.y,
            setTint: () => {},
            clearTint: () => {}
        };
        scene.bossHealth = 12;
        scene.bossMaxHealth = 12;
        scene.bossRecoveryUntil = 0;
        scene.updateBossHealthBar = () => {};
        const auraActiveBefore = Boolean(scene.currentChargeAura?.active);
        scene.damageBoss(1);
        const first = {
            health: scene.bossHealth,
            charge: scene.currentChargeReady,
            checkpointCharge: window.GameState.get(
                'story.projectBeacon.expeditionCheckpoint'
            )?.routeState?.currentChargeReady
        };
        scene.damageBoss(1);
        return {
            choice: scene.auroraRouteChoice,
            auraActiveBefore,
            auraAfter: Boolean(scene.currentChargeAura?.active),
            tweenAfter: Boolean(scene.currentChargeAuraTween),
            first,
            secondHealth: scene.bossHealth
        };
    })()`);
    if (
        directRestore.choice !== 'shadow_current' ||
        directRestore.auraActiveBefore !== true ||
        directRestore.auraAfter !== false ||
        directRestore.tweenAfter !== false ||
        directRestore.first.health !== 9 ||
        directRestore.first.charge !== false ||
        directRestore.first.checkpointCharge !== false ||
        directRestore.secondHealth !== 8
    ) {
        throw new Error(`Aurora Current Charge did not consume once: ${JSON.stringify(directRestore)}`);
    }

    await restartAuroraFromCheckpoint(session);
    const directSpentReload = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('AuroraDepthsLevel');
        return {
            choice: scene.auroraRouteChoice,
            charge: scene.currentChargeReady,
            aura: Boolean(scene.currentChargeAura?.active)
        };
    })()`);
    if (
        directSpentReload.choice !== 'shadow_current' ||
        directSpentReload.charge ||
        directSpentReload.aura
    ) {
        throw new Error(`Aurora charge returned after reload: ${JSON.stringify(directSpentReload)}`);
    }

    await evaluate(session, `(() => {
        const game = window.mythicalGame;
        window.GameState.set('story.projectBeacon.expeditionCheckpoint', null);
        game.scene.stop('AuroraDepthsLevel');
        game.scene.start('AuroraDepthsLevel', {
            entryPreview: true,
            forceMobileControls: true,
            platformerPreviewSize: 'mobile'
        });
        return true;
    })()`);
    await waitForScene(session, 'AuroraDepthsLevel');
    await delay(500);
    await tap(session, 195, 140);
    await waitFor(
        () => evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('AuroraDepthsLevel');
            return scene?._levelContentCreated === true;
        })()`),
        { timeoutMs: 8000, message: 'Aurora quiet route restart' }
    );
    await stageAuroraPrism(session, 0);
    await stageAuroraPrism(session, 1);
    await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('AuroraDepthsLevel');
        const support = scene.getTraversalSupport?.('aurora-quiet-step-1');
        if (!scene.player?.body || !support?.body) return false;
        scene.player.body.reset(
            support.x,
            support.body.top - scene.player.body.height - 18
        );
        scene.player.setVelocity?.(0, 0);
        return true;
    })()`);
    await waitFor(
        () => evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('AuroraDepthsLevel');
            return scene?.auroraRouteChoice === 'quiet_light';
        })()`),
        { timeoutMs: 2500, message: 'Aurora quiet route zone selection' }
    );
    await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('AuroraDepthsLevel');
        const pickup = scene.optionalRoutePickup;
        const support = scene.getTraversalSupport?.('aurora-quiet-step-3');
        if (!scene.player?.body || !pickup?.active || !support?.body) return false;
        scene.player.body.reset(
            pickup.x,
            support.body.top - scene.player.body.height - 18
        );
        scene.player.setVelocity?.(0, 0);
        return true;
    })()`);
    const quietChoice = await waitFor(
        () => evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('AuroraDepthsLevel');
            const route = scene?.optionalRouteRewards?.get?.('aurora_quiet_light');
            const checkpoint = window.GameState.get(
                'story.projectBeacon.expeditionCheckpoint'
            );
            if (!route?.completed) return null;
            return {
                choice: scene.auroraRouteChoice,
                selectedPath: route.choice.selectedPath,
                guardCharges: scene.optionalRouteGuardCharges,
                charge: scene.currentChargeReady,
                checkpoint
            };
        })()`),
        { timeoutMs: 2500, message: 'Aurora Quiet Light pickup collision' }
    );
    if (
        quietChoice.choice !== 'quiet_light' ||
        quietChoice.selectedPath !== 'optional' ||
        quietChoice.guardCharges !== 1 ||
        quietChoice.charge ||
        quietChoice.checkpoint?.routeState?.quietLightGuardCharges !== 1 ||
        quietChoice.checkpoint?.routeState?.quietLightRewardClaimed !== true
    ) {
        throw new Error(`Aurora Quiet Light was not persisted: ${JSON.stringify(quietChoice)}`);
    }

    await restartAuroraFromCheckpoint(session);
    const quietRestore = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('AuroraDepthsLevel');
        const healthBefore = scene.health;
        scene.isInvincible = false;
        scene.takeDamage(1);
        return {
            choice: scene.auroraRouteChoice,
            rewardComplete: scene.optionalRouteRewards.get('aurora_quiet_light').completed,
            pickupActive: Boolean(scene.optionalRoutePickup?.active),
            healthBefore,
            healthAfter: scene.health,
            guardCharges: scene.optionalRouteGuardCharges,
            persistedCharges: window.GameState.get(
                'story.projectBeacon.expeditionCheckpoint'
            )?.routeState?.quietLightGuardCharges
        };
    })()`);
    if (
        quietRestore.choice !== 'quiet_light' ||
        quietRestore.rewardComplete !== true ||
        quietRestore.pickupActive ||
        quietRestore.healthAfter !== quietRestore.healthBefore ||
        quietRestore.guardCharges !== 0 ||
        quietRestore.persistedCharges !== 0
    ) {
        throw new Error(`Aurora Quiet Light did not restore once: ${JSON.stringify(quietRestore)}`);
    }

    await restartAuroraFromCheckpoint(session);
    const quietSpentReload = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('AuroraDepthsLevel');
        return {
            choice: scene.auroraRouteChoice,
            rewardComplete: scene.optionalRouteRewards.get('aurora_quiet_light').completed,
            guardCharges: scene.optionalRouteGuardCharges,
            pickupActive: Boolean(scene.optionalRoutePickup?.active)
        };
    })()`);
    if (
        quietSpentReload.choice !== 'quiet_light' ||
        !quietSpentReload.rewardComplete ||
        quietSpentReload.guardCharges !== 0 ||
        quietSpentReload.pickupActive
    ) {
        throw new Error(`Aurora Quiet Light returned after reload: ${JSON.stringify(quietSpentReload)}`);
    }
    if (exceptions.length) {
        throw new Error(`Aurora route journey raised browser exceptions: ${exceptions.join(' | ')}`);
    }

    return {
        directChoice,
        directRestore,
        directSpentReload,
        quietChoice,
        quietRestore,
        quietSpentReload
    };
}

async function smokePurchasedEgg(session, exceptions) {
    exceptions.length = 0;
    process.stdout.write('EGG boot\n');
    await navigate(session, `${BASE_URL}/play/?reset=true`);
    await waitForScene(session, 'HatchingScene');

    process.stdout.write('EGG seed inventory\n');
    const setup = await evaluate(session, `(async () => {
        const game = window.mythicalGame;
        const inventory = window.InventoryManager;
        inventory.inventory = [];
        inventory.addItem({
            id: 'qa_cosmic_egg_23',
            name: 'Cosmic Egg',
            type: 'egg',
            eggType: 'cosmic',
            quantity: 1,
            rarityOdds: '50% Common, 25% Uncommon, 15% Rare, 8% Epic, 2% Legendary'
        });
        window.GameState.set('creature.name', 'Nova');
        window.GameState.set('creature.named', true);
        window.GameState.set('creature.genes', {
            id: 'qa_existing_companion_23',
            rarity: 'common',
            species: 'nebulaSprite'
        });
        window.GameState.set('creature.hatched', true);
        window.GameState.set('maxCreatures', 8);
        const loaded = await window.SceneLoader?.loadScene?.(
            game,
            'InventoryScene'
        );
        if (loaded === false) return -1;
        game.scene.stop('HatchingScene');
        game.scene.start('InventoryScene');
        return inventory.inventory.length;
    })()`);
    if (setup !== 1) throw new Error('QA egg could not be placed in inventory');
    await waitForScene(session, 'InventoryScene');
    await delay(400);

    process.stdout.write('EGG open confirmation\n');
    const button = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('InventoryScene');
        const item = window.InventoryManager.inventory[0];
        scene.selectedSlot = 0;
        scene.showEggConfirmation(item);
        const { width, height, isMobile } = scene.dims;
        const panelHeight = isMobile ? 420 : 400;
        const panelY = (height - panelHeight) / 2;
        const btnWidth = isMobile ? 110 : 140;
        const btnHeight = isMobile ? 45 : 50;
        const x = width / 2 - btnWidth - 7.5 + btnWidth / 2;
        const y = panelY + panelHeight - btnHeight - 25 + btnHeight / 2;
        return { x, y, width, height };
    })()`);
    process.stdout.write(`EGG touch ${button.x},${button.y}\n`);
    await touch(session, button.x, button.y);
    process.stdout.write('EGG await HatchingScene\n');
    try {
        // The sanctuary reveal intentionally plays a three-second cinematic before
        // scene handoff. Leave enough headroom for software-rendered CI frames.
        await waitForScene(session, 'HatchingScene', 20000);
    } catch (error) {
        const diagnostics = await evaluate(session, `(() => {
            const game = window.mythicalGame;
            const scene = game.scene.getScene('InventoryScene');
            return {
                activeScenes: game.scene.getScenes(true).map(item => item.scene.key),
                inventoryActive: game.scene.isActive('InventoryScene'),
                hatchTransitionInProgress: scene?.hatchTransitionInProgress,
                selectedSlot: scene?.selectedSlot,
                inventoryCount: window.InventoryManager?.inventory?.length,
                button: ${JSON.stringify(button)}
            };
        })()`);
        throw new Error(`${error.message}: ${JSON.stringify(diagnostics)}`);
    }

    const state = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('HatchingScene');
        return {
            active: window.mythicalGame.scene.isActive('HatchingScene'),
            isEggHatch: scene.isEggHatch,
            eggType: scene.eggType,
            inventoryCount: window.InventoryManager.inventory.length
        };
    })()`);
    if (!state.active || !state.isEggHatch || state.eggType !== 'cosmic') {
        throw new Error(`Purchased egg did not reach HatchingScene: ${JSON.stringify(state)}`);
    }
    if (state.inventoryCount !== 0) {
        throw new Error(`Purchased egg was not reserved exactly once: ${JSON.stringify(state)}`);
    }
    await captureGameplayStill(session, 'creature-cosmic-egg-hatch.png');
    if (exceptions.length) {
        throw new Error(`Purchased egg flow raised browser exceptions: ${exceptions.join(' | ')}`);
    }
    return state;
}

async function smokeHomeStart(session, exceptions) {
    exceptions.length = 0;
    await navigate(session, `${BASE_URL}/play/`);
    await waitForScene(session, 'HatchingScene');

    // Reproduce the state immediately before the first gameplay action without
    // coupling this focused test to the independently covered age-gate flow.
    await evaluate(session, `(() => {
        localStorage.setItem('mythical_void_age_confirmed', 'true');
        localStorage.setItem('mythical_void_age_group', 'age_18_plus');
        localStorage.removeItem('mythical_creature_save');
        location.reload();
        return true;
    })()`);
    await waitFor(
        () => evaluate(session, 'document.readyState === "complete"'),
        { message: 'home screen reload' }
    );
    await waitForScene(session, 'HatchingScene');

    const start = await waitFor(
        () => evaluate(session, `(() => {
            const scene = window.mythicalGame?.scene?.getScene('HatchingScene');
            const button = scene?.startButton;
            if (!button?.active || !button?.input?.enabled) return null;
            const bounds = button.getBounds();
            const nativeButton = document.querySelector('[data-mythical-home-start="true"]');
            const nativeBounds = nativeButton?.getBoundingClientRect();
            const nativeStyle = nativeButton ? getComputedStyle(nativeButton) : null;
            return {
                x: Math.round(bounds.centerX),
                y: Math.round(bounds.centerY),
                left: bounds.left,
                right: bounds.right,
                top: bounds.top,
                bottom: bounds.bottom,
                alpha: button.alpha,
                visible: button.visible,
                canvasWidth: scene.scale.width,
                canvasHeight: scene.scale.height,
                native: nativeBounds ? {
                    left: nativeBounds.left,
                    right: nativeBounds.right,
                    top: nativeBounds.top,
                    bottom: nativeBounds.bottom,
                    visible: nativeStyle?.display !== 'none' &&
                        nativeStyle?.visibility !== 'hidden' &&
                        Number(nativeStyle?.opacity || 1) > 0
                } : null
            };
        })()`),
        { timeoutMs: 12000, message: 'visible Project Beacon Start control' }
    );
    if (
        !start.visible ||
        start.alpha < 0.8 ||
        start.left < 0 ||
        start.top < 0 ||
        start.right > start.canvasWidth ||
        start.bottom > start.canvasHeight
    ) {
        throw new Error(`Home Start control is outside the viewport: ${JSON.stringify(start)}`);
    }
    if (
        !start.native?.visible ||
        start.native.left < 0 ||
        start.native.top < 0 ||
        start.native.right > start.canvasWidth ||
        start.native.bottom > start.canvasHeight
    ) {
        throw new Error(`Native Home Start fallback is unavailable: ${JSON.stringify(start)}`);
    }
    await captureGameplayStill(session, 'project-beacon-start.png');

    let recovery = null;
    if (['mobile-landscape', 'wide-touch'].includes(SMOKE_CASE)) {
        // Disable the Phaser control and prove the independent native action
        // still gets the player to the live egg.
        await evaluate(session, `(() => {
            const scene = window.mythicalGame?.scene?.getScene('HatchingScene');
            scene.nextHomeStartHealthCheck = Number.POSITIVE_INFINITY;
            scene.startButton
                .setPosition(-500, -500)
                .setAlpha(0)
                .disableInteractive();
            return true;
        })()`);
        recovery = await waitFor(
            () => evaluate(session, `(() => {
            const button = document.querySelector('[data-mythical-home-start="true"]');
            const bounds = button?.getBoundingClientRect();
            const style = button ? getComputedStyle(button) : null;
            if (
                !button ||
                !bounds ||
                style?.display === 'none' ||
                style?.visibility === 'hidden' ||
                Number(style?.opacity || 1) <= 0
            ) return null;
            return {
                x: Math.round(bounds.left + (bounds.width / 2)),
                y: Math.round(bounds.top + (bounds.height / 2)),
                visible: true
            };
        })()`),
            { timeoutMs: 3000, message: 'native Start fallback after canvas failure' }
        );
    }

    await touch(session, recovery?.x || start.x, recovery?.y || start.y);
    const advanced = await waitFor(
        () => evaluate(session, `(() => {
            const scene = window.mythicalGame?.scene?.getScene('HatchingScene');
            if (!window.mythicalGame?.scene?.isActive?.('HatchingScene')) return null;
            if (window.GameState?.get?.('session.gameStarted') !== true) return null;
            if (!scene?.egg?.active || scene?.startButton?.active) return null;
            return {
                gameStarted: true,
                eggActive: true,
                eggInteractive: Boolean(scene.egg.input?.enabled),
                startActive: Boolean(scene.startButton?.active)
            };
        })()`),
        { timeoutMs: 5000, message: 'Start touch to advance to the live egg' }
    );
    if (!advanced.eggInteractive) {
        throw new Error(`Home Start reached a non-interactive egg: ${JSON.stringify(advanced)}`);
    }
    await captureGameplayStill(session, 'project-beacon-live-egg.png');
    if (exceptions.length) {
        throw new Error(`Home Start raised browser exceptions: ${exceptions.join(' | ')}`);
    }
    return { start, recovery, advanced };
}

async function smokeFirstSanctuaryOnboarding(session, exceptions) {
    exceptions.length = 0;
    await navigate(session, `${BASE_URL}/play/`);
    await waitForScene(session, 'HatchingScene');
    await evaluate(session, `(() => {
        localStorage.setItem('mythical_void_age_confirmed', 'true');
        localStorage.setItem('mythical_void_age_group', 'age_18_plus');
        localStorage.removeItem('mythical_creature_save');
        return true;
    })()`);
    await navigate(session, `${BASE_URL}/play/?testSoulReveal=portrait`);
    await waitForScene(session, 'SoulRevealScene');

    const naming = await waitFor(
        () => evaluate(session, `(() => {
            const input = document.querySelector('[data-testid="creature-name-input"]');
            const submit = document.querySelector('[data-testid="creature-name-submit"]');
            const inputBounds = input?.getBoundingClientRect?.();
            const submitBounds = submit?.getBoundingClientRect?.();
            if (!input || !submit || !inputBounds || !submitBounds) return null;
            if (inputBounds.width < 160 || inputBounds.height < 44) return null;
            if (submitBounds.width < 160 || submitBounds.height < 44) return null;
            return {
                input: {
                    left: Math.round(inputBounds.left),
                    top: Math.round(inputBounds.top),
                    width: Math.round(inputBounds.width),
                    height: Math.round(inputBounds.height)
                },
                submit: {
                    left: Math.round(submitBounds.left),
                    top: Math.round(submitBounds.top),
                    width: Math.round(submitBounds.width),
                    height: Math.round(submitBounds.height)
                }
            };
        })()`),
        { timeoutMs: 12000, message: 'mobile creature naming controls' }
    );
    await evaluate(session, `(() => {
        const input = document.querySelector('[data-testid="creature-name-input"]');
        const setter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value'
        )?.set;
        setter?.call(input, 'Nova');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return input.value;
    })()`);
    await touchDomButton(session, '[data-testid="creature-name-submit"]', {
        message: 'Reveal Living Form action'
    });

    const reveal = await waitFor(
        () => evaluate(session, `(() => {
            const root = document.querySelector('[data-testid="living-form-handoff"]');
            const image = root?.querySelector('.living-form-image.is-ready');
            const source = root?.querySelector('.living-form-source')?.textContent?.trim();
            const button = root?.querySelector('[data-testid="living-form-continue"]');
            const bounds = button?.getBoundingClientRect?.();
            if (
                !root ||
                !image?.complete ||
                image.naturalWidth < 256 ||
                !bounds ||
                bounds.width < 180 ||
                bounds.height < 44
            ) return null;
            return {
                source,
                imageWidth: image.naturalWidth,
                imageHeight: image.naturalHeight,
                action: button.textContent?.trim(),
                actionBounds: {
                    left: Math.round(bounds.left),
                    right: Math.round(bounds.right),
                    top: Math.round(bounds.top),
                    bottom: Math.round(bounds.bottom)
                }
            };
        })()`),
        { timeoutMs: 8000, message: 'high-resolution living-form reveal' }
    );
    if (
        reveal.source !== 'PROTECTED LIVING PORTRAIT' ||
        reveal.action !== 'ENTER SANCTUARY'
    ) {
        throw new Error(`Living-form handoff was incomplete: ${JSON.stringify(reveal)}`);
    }
    await captureGameplayStill(session, 'first-living-form-mobile.png');

    const handoffStartedAt = Date.now();
    await touchDomButton(session, '[data-testid="living-form-continue"]', {
        message: 'Enter Sanctuary action'
    });
    await waitForScene(session, 'GameScene');

    const readStoryState = expectedPage => waitFor(
        () => evaluate(session, `(() => {
            const scene = window.mythicalGame?.scene?.getScene('GameScene');
            const texts = (scene?.children?.list || []).filter(item => (
                typeof item?.text === 'string' &&
                item.visible !== false &&
                item.alpha > 0
            ));
            const indicator = texts.find(item => (
                item.text === ${JSON.stringify(`Page ${expectedPage} of 5`)}
            ));
            const action = texts.find(item => (
                ${expectedPage} === 5
                    ? item.text === 'Close'
                    : item.text === 'Next' || item.text.startsWith('Next')
            ));
            const nativeAction = document.querySelector(
                '[data-testid="project-beacon-story-next"]'
            );
            const nativeBack = document.querySelector(
                '[data-testid="project-beacon-story-back"]'
            );
            const nativeBounds = nativeAction?.getBoundingClientRect?.();
            if (
                !scene?.storyModalElements?.length ||
                !indicator ||
                !action?.getBounds ||
                !nativeBack ||
                !nativeBounds ||
                nativeBounds.width < 120 ||
                nativeBounds.height < 52
            ) {
                return null;
            }
            const bounds = action.getBounds();
            const target = (scene.input?._list || []).find(candidate => {
                if (
                    candidate?.input?.enabled !== true ||
                    candidate?.visible === false ||
                    !candidate?.getBounds
                ) return false;
                return candidate.getBounds().contains(bounds.centerX, bounds.centerY);
            });
            if (!target) return null;
            const targetBounds = target.getBounds();
            return {
                page: ${expectedPage},
                action: action.text,
                x: Math.round(bounds.centerX),
                y: Math.round(bounds.centerY),
                targetWidth: Math.round(targetBounds.width),
                targetHeight: Math.round(targetBounds.height),
                nativeAction: nativeAction.textContent?.trim(),
                nativeBackDisabled: nativeBack.disabled,
                nativeTarget: document.elementFromPoint(
                    nativeBounds.left + nativeBounds.width / 2,
                    nativeBounds.top + nativeBounds.height / 2
                ) === nativeAction,
                controlsSuspended: scene.mobileControls?.isSuspended === true,
                physicsPaused: scene.physics?.world?.isPaused === true
            };
        })()`),
        { timeoutMs: 12000, message: `Project Beacon story page ${expectedPage}` }
    );

    const firstPage = await readStoryState(1);
    const handoffMs = Date.now() - handoffStartedAt;
    if (
        handoffMs > 7000 ||
        firstPage.targetWidth < 120 ||
        firstPage.targetHeight < 52 ||
        firstPage.nativeAction !== 'NEXT' ||
        !firstPage.nativeBackDisabled ||
        !firstPage.nativeTarget ||
        !firstPage.controlsSuspended ||
        !firstPage.physicsPaused
    ) {
        throw new Error(`Sanctuary story was not safely interactive: ${JSON.stringify({
            handoffMs,
            firstPage
        })}`);
    }
    await captureGameplayStill(session, 'first-sanctuary-story-mobile.png');

    await touchDomButton(session, '[data-testid="project-beacon-story-next"]', {
        message: 'Project Beacon story forward check'
    });
    const secondPage = await readStoryState(2);
    if (secondPage.nativeBackDisabled) {
        throw new Error('Project Beacon Back action stayed disabled on page 2');
    }
    await touchDomButton(session, '[data-testid="project-beacon-story-back"]', {
        message: 'Project Beacon story Back action'
    });
    const returnedFirstPage = await readStoryState(1);
    if (!returnedFirstPage.nativeBackDisabled) {
        throw new Error('Project Beacon Back action did not return to page 1');
    }

    const storyAdvanceMs = [];
    let storyPage = returnedFirstPage;
    for (let page = 1; page <= 5; page += 1) {
        const advancedAt = Date.now();
        await touchDomButton(session, '[data-testid="project-beacon-story-next"]', {
            message: `Project Beacon story page ${page} action`
        });
        if (page < 5) {
            storyPage = await readStoryState(page + 1);
        } else {
            await waitFor(
                () => evaluate(session, `(() => {
                    const scene = window.mythicalGame?.scene?.getScene('GameScene');
                    return scene?.storyModalElements?.length === 0;
                })()`),
                { timeoutMs: 1500, message: 'Project Beacon story dismissal' }
            );
        }
        const elapsed = Date.now() - advancedAt;
        storyAdvanceMs.push(elapsed);
        if (elapsed > 1500) {
            throw new Error(`Story page ${page} response exceeded 1500ms: ${elapsed}ms`);
        }
        await delay(220);
    }

    const controlsStartedAt = Date.now();
    const controls = await waitFor(
        () => evaluate(session, `(() => {
            const scene = window.mythicalGame?.scene?.getScene('GameScene');
            const action = (scene?.children?.list || []).find(item => (
                item?.text === 'START FIELDWORK' &&
                item.visible !== false &&
                item.alpha > 0 &&
                item.input?.enabled === true
            ));
            if (!scene?.controlsTutorial?.isVisible || !action?.getBounds) return null;
            const bounds = action.getBounds();
            return {
                x: Math.round(bounds.centerX),
                y: Math.round(bounds.centerY),
                width: Math.round(bounds.width),
                height: Math.round(bounds.height),
                mobileControlsSuspended: scene.mobileControls?.isSuspended === true
            };
        })()`),
        { timeoutMs: 4000, message: 'field controls handoff' }
    );
    const controlsReadyMs = Date.now() - controlsStartedAt;
    if (
        controlsReadyMs > 4000 ||
        controls.width < 180 ||
        controls.height < 44 ||
        !controls.mobileControlsSuspended
    ) {
        throw new Error(`Field controls handoff was not mobile-safe: ${JSON.stringify({
            controlsReadyMs,
            controls
        })}`);
    }
    await captureGameplayStill(session, 'first-sanctuary-controls-mobile.png');
    await touch(session, controls.x, controls.y);

    let gameplay;
    try {
        gameplay = await waitFor(
            () => evaluate(session, `(() => {
                const scene = window.mythicalGame?.scene?.getScene('GameScene');
                if (
                    !scene ||
                    scene.controlsTutorial?.isVisible ||
                    scene.mobileControls?.isSuspended ||
                    scene.physics?.world?.isPaused ||
                    window.OnboardingManager?.isProcessing
                ) return null;
                return {
                    sceneActive: window.mythicalGame.scene.isActive('GameScene'),
                    storySeen: window.GameState?.get?.('tutorial.crashStorySeen') === true,
                    controlsSeen: window.GameState?.get?.('tutorial.controlsSeen') === true,
                    mobileControlsVisible: scene.mobileControls?.isVisible === true,
                    portraitDomCleared: !document.querySelector(
                        '[data-testid="living-form-handoff"]'
                    )
                };
            })()`),
            { timeoutMs: 4000, message: 'playable Sanctuary after onboarding' }
        );
    } catch (error) {
        const diagnostics = await evaluate(session, `(() => {
            const game = window.mythicalGame;
            const scene = game?.scene?.getScene('GameScene');
            const onboarding = window.OnboardingManager;
            return {
                activeScenes: game?.scene?.getScenes?.(true)?.map(item => item.scene.key),
                sceneActive: game?.scene?.isActive?.('GameScene'),
                controlsVisible: scene?.controlsTutorial?.isVisible,
                mobileControls: {
                    isVisible: scene?.mobileControls?.isVisible,
                    isSuspended: scene?.mobileControls?.isSuspended,
                    joystickActive: scene?.mobileControls?.joystickActive
                },
                physicsPaused: scene?.physics?.world?.isPaused,
                storyElements: scene?.storyModalElements?.length,
                storyBannerElements: scene?.questTracker?.storyBannerElements?.length,
                onboarding: {
                    isProcessing: onboarding?.isProcessing,
                    currentPopup: onboarding?.currentPopup?.id,
                    queueLength: onboarding?.popupQueue?.length
                },
                storySeen: window.GameState?.get?.('tutorial.crashStorySeen'),
                controlsSeen: window.GameState?.get?.('tutorial.controlsSeen'),
                portraitDomPresent: Boolean(document.querySelector(
                    '[data-testid="living-form-handoff"]'
                ))
            };
        })()`);
        throw new Error(`${error.message}: ${JSON.stringify(diagnostics)}`);
    }
    if (
        !gameplay.sceneActive ||
        !gameplay.storySeen ||
        !gameplay.controlsSeen ||
        !gameplay.mobileControlsVisible ||
        !gameplay.portraitDomCleared ||
        exceptions.length
    ) {
        throw new Error(`First Sanctuary journey did not reach play: ${JSON.stringify({
            gameplay,
            exceptions
        })}`);
    }

    const movementStart = await evaluate(session, `(() => {
        const scene = window.mythicalGame?.scene?.getScene('GameScene');
        const controls = scene?.mobileControls;
        const canvasBounds = scene?.game?.canvas?.getBoundingClientRect?.();
        if (
            !scene?.player?.body ||
            !controls ||
            !canvasBounds ||
            !Number.isFinite(controls.joystickCenterX) ||
            !Number.isFinite(controls.joystickCenterY)
        ) return null;
        const toClientX = value => canvasBounds.left +
            (value / scene.scale.width) * canvasBounds.width;
        const toClientY = value => canvasBounds.top +
            (value / scene.scale.height) * canvasBounds.height;
        const dragDistance = Math.max(28, Math.min(controls.joystickMaxDistance, 44));
        return {
            start: {
                x: Math.round(toClientX(controls.joystickCenterX)),
                y: Math.round(toClientY(controls.joystickCenterY))
            },
            end: {
                x: Math.round(toClientX(controls.joystickCenterX + dragDistance)),
                y: Math.round(toClientY(controls.joystickCenterY))
            },
            playerX: scene.player.x
        };
    })()`);
    if (!movementStart) {
        throw new Error('Playable Sanctuary did not expose a usable mobile joystick');
    }

    let movement;
    try {
        await holdTouchDrag(session, movementStart.start, movementStart.end, 300);
        movement = await waitFor(
            () => evaluate(session, `(() => {
                const scene = window.mythicalGame?.scene?.getScene('GameScene');
                if (!scene || scene.joystickX <= 0.2) return null;
                return {
                    inputX: scene.joystickX,
                    velocityX: scene.player?.body?.velocity?.x,
                    playerX: scene.player?.x,
                    joystickActive: scene.mobileControls?.joystickActive === true
                };
            })()`),
            { timeoutMs: 1500, message: 'first Sanctuary joystick movement' }
        );
    } finally {
        await releaseTouch(session);
    }

    const movementReleased = await waitFor(
        () => evaluate(session, `(() => {
            const scene = window.mythicalGame?.scene?.getScene('GameScene');
            if (
                !scene ||
                Math.abs(scene.joystickX) > 0.01 ||
                Math.abs(scene.joystickY) > 0.01 ||
                scene.mobileControls?.joystickActive
            ) return null;
            return true;
        })()`),
        { timeoutMs: 1500, message: 'first Sanctuary joystick release' }
    );
    if (
        !movement.joystickActive ||
        movement.velocityX <= 20 ||
        movement.playerX <= movementStart.playerX + 1 ||
        !movementReleased
    ) {
        throw new Error(`First Sanctuary controls did not reach live play: ${JSON.stringify({
            movementStart,
            movement,
            movementReleased
        })}`);
    }

    return {
        naming,
        reveal,
        handoffMs,
        storyAdvanceMs,
        controlsReadyMs,
        gameplay,
        movement
    };
}

async function smokeNASAContent(session, exceptions) {
    exceptions.length = 0;
    const fixture = JSON.parse(fs.readFileSync(
        path.join(__dirname, 'company/fixtures/nasa-apollo11-apod.json'),
        'utf8'
    ));

    await navigate(session, `${BASE_URL}/play/?reset=true`);
    await waitForScene(session, 'HatchingScene');
    await evaluate(session, `(() => {
        localStorage.setItem('mythical_void_age_confirmed', 'true');
        localStorage.setItem('mythical_void_age_group', 'age_18_plus');
        location.reload();
        return true;
    })()`);
    await waitFor(
        () => evaluate(session, 'document.readyState === "complete"'),
        { message: 'NASA capture reload' }
    );
    await waitForScene(session, 'HatchingScene');
    await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('HatchingScene');
        const content = ${JSON.stringify(fixture.content)};
        window.NASAContentSystem.getDailyContentQueue = async () => [content];
        window.OnboardingManager.initialize(scene);
        window.OnboardingManager.showNASAContent(() => {});
        return true;
    })()`);

    const visible = await waitFor(
        () => evaluate(session, `(() => {
            const image = Array.from(document.images).find(candidate =>
                candidate.src.includes('a11pan1040226lftsm.jpg')
            );
            const scene = window.mythicalGame.scene.getScene('HatchingScene');
            const labels = (scene?.children?.list || [])
                .map(item => typeof item?.text === 'string' ? item.text : '')
                .filter(Boolean);
            if (!image?.complete || image.naturalWidth < 1) return null;
            if (!labels.some(label => label.includes('REAL NASA IMAGE'))) return null;
            if (!labels.some(label => label.includes('NASA Astronomy Picture of the Day'))) return null;
            if (!labels.some(label => label.includes('MYTHICAL VOID IMAGINES'))) return null;
            return {
                imageLoaded: true,
                titlePresent: labels.some(label => label.includes('Apollo 11 Landing Panorama')),
                sourcePresent: true,
                boundaryPresent: true,
                sourceUrl: ${JSON.stringify(fixture.content.sourceUrl)}
            };
        })()`),
        { timeoutMs: 20000, message: 'credited NASA discovery presentation' }
    );

    await captureGameplayStill(session, 'nasa-apollo11-real-space-discovery.png');
    if (exceptions.length) {
        throw new Error(`NASA discovery raised browser exceptions: ${exceptions.join(' | ')}`);
    }
    return visible;
}

async function smokeSanctuaryNavigation(session, exceptions) {
    exceptions.length = 0;
    await navigate(session, `${BASE_URL}/play/?reset=true`);
    await waitForScene(session, 'HatchingScene');
    await evaluate(session, `(() => {
        const game = window.mythicalGame;
        const state = window.GameState;
        const creature = {
            ...(state.get('creature') || {}),
            id: 'smoke_navigation_nova',
            name: 'Nova',
            hatched: true,
            named: true,
            genes: {
                id: 'smoke_navigation_genes_23',
                personality: { primary: 'curious' },
                cosmicAffinity: { element: 'nebula' }
            },
            stats: { happiness: 92, energy: 90 }
        };
        state.set('creature', creature);
        state.set('creatures', [creature]);
        state.set('activeCreatureIndex', 0);
        state.save();
        const hatchingScene = game.scene.getScene('HatchingScene');
        hatchingScene.scene.start('GameScene', {
            biome: 'nebula',
            forceMobileControls: true
        });
        return true;
    })()`);
    await waitForScene(session, 'GameScene', 30000);
    await waitFor(
        () => evaluate(session, `Boolean(window.mythicalGame.scene.getScene('GameScene')?.hamburgerMenu)`),
        { timeoutMs: 18000, message: 'Sanctuary navigation controls' }
    );

    const before = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('GameScene');
        return { x: scene?.player?.x, y: scene?.player?.y };
    })()`);
    if (![before.x, before.y].every(Number.isFinite)) {
        throw new Error(`Sanctuary player was unavailable before menu navigation: ${JSON.stringify(before)}`);
    }

    const inventoryOpened = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('GameScene');
        scene.hamburgerMenu.navigateToInventory();
        return true;
    })()`);
    if (!inventoryOpened) throw new Error('Hamburger Inventory route did not open');
    await waitForScene(session, 'InventoryScene');
    const inventoryState = await evaluate(session, `(() => ({
        sanctuaryPaused: window.mythicalGame.scene.isPaused('GameScene'),
        inventoryActive: window.mythicalGame.scene.isActive('InventoryScene')
    }))()`);
    if (!inventoryState.sanctuaryPaused || !inventoryState.inventoryActive) {
        throw new Error(`Inventory did not preserve Sanctuary state: ${JSON.stringify(inventoryState)}`);
    }
    await evaluate(session, `(() => {
        window.mythicalGame.scene.getScene('InventoryScene').exitInventory();
        return true;
    })()`);
    await waitForScene(session, 'GameScene');
    await waitFor(
        () => evaluate(session, `!window.mythicalGame.scene.isActive('InventoryScene')`),
        { message: 'Inventory scene closed' }
    );

    const profileOpened = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('GameScene');
        scene.hamburgerMenu.navigateToProfile();
        return true;
    })()`);
    if (!profileOpened) throw new Error('Hamburger Profile route did not open');
    await waitForScene(session, 'CreatureProfileScene');
    const profileState = await evaluate(session, `(() => ({
        sanctuaryPaused: window.mythicalGame.scene.isPaused('GameScene'),
        profileActive: window.mythicalGame.scene.isActive('CreatureProfileScene')
    }))()`);
    if (!profileState.sanctuaryPaused || !profileState.profileActive) {
        throw new Error(`Profile did not preserve Sanctuary state: ${JSON.stringify(profileState)}`);
    }
    await evaluate(session, `(() => {
        window.mythicalGame.scene.getScene('CreatureProfileScene').goBack();
        return true;
    })()`);
    await waitForScene(session, 'GameScene');
    await waitFor(
        () => evaluate(session, `!window.mythicalGame.scene.isActive('CreatureProfileScene')`),
        { message: 'Creature Profile scene closed' }
    );

    const after = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('GameScene');
        return {
            x: scene?.player?.x,
            y: scene?.player?.y,
            physicsPaused: Boolean(scene?.physics?.world?.isPaused),
            mobileControls: Boolean(scene?.mobileControls),
            hamburgerReady: Boolean(scene?.hamburgerMenu)
        };
    })()`);
    const restoredPosition = Math.abs(after.x - before.x) < 2 &&
        Math.abs(after.y - before.y) < 2;
    if (
        !restoredPosition ||
        after.physicsPaused ||
        !after.mobileControls ||
        !after.hamburgerReady ||
        exceptions.length
    ) {
        throw new Error(
            `Sanctuary navigation did not restore live play: ${JSON.stringify({
                before,
                after,
                exceptions
            })}`
        );
    }
    return { before, after };
}

async function smokeHubForestTransition(session, exceptions) {
    exceptions.length = 0;
    await navigate(session, `${BASE_URL}/play/?reset=true`);
    await waitForScene(session, 'HatchingScene');
    await evaluate(session, `(() => {
        const game = window.mythicalGame;
        const state = window.GameState;
        const creature = {
            ...(state.get('creature') || {}),
            id: 'smoke_hub_forest_nova',
            name: 'Nova',
            hatched: true,
            named: true,
            genes: {
                id: 'smoke_hub_forest_genes_23',
                personality: { primary: 'curious' },
                cosmicAffinity: { element: 'nebula' }
            },
            stats: { happiness: 92, energy: 90 }
        };
        state.set('creature', creature);
        state.set('creatures', [creature]);
        state.set('activeCreatureIndex', 0);
        state.set('story.projectBeacon.firstExpeditionPromptSeen', true);
        state.set('story.projectBeacon.firstForestCinematicSeen', false);
        state.set('story.projectBeacon.firstForestCinematicVersion', 0);
        state.set('story.projectBeacon.firstExpeditionDrill', {
            completed: true,
            completedAt: new Date().toISOString()
        });
        state.save();
        game.scene.stop('HatchingScene');
        game.scene.start('GameScene', { biome: 'nebula', forceMobileControls: true });
        return true;
    })()`);
    await waitForScene(session, 'GameScene', 30000);

    const hubOpened = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('GameScene');
        scene.openHubWorld();
        return true;
    })()`);
    if (!hubOpened) throw new Error('Sanctuary could not open the expedition hub');
    await waitForScene(session, 'HubWorldScene', 30000);

    const gateEntry = await evaluate(session, `(() => {
        const hub = window.mythicalGame.scene.getScene('HubWorldScene');
        const gate = hub?.gates?.find(entry => entry.id === 'mythical_forest');
        if (!gate?.data?.unlocked) {
            return { entered: false, unlocked: gate?.data?.unlocked || false };
        }
        hub.enterGate(gate);
        return { entered: true, unlocked: true };
    })()`);
    if (!gateEntry.entered) {
        throw new Error(`Mythical Forest gate was unavailable from the Hub: ${JSON.stringify(gateEntry)}`);
    }

    await waitForScene(session, 'MythicalForestLevel', 20000);
    await waitFor(
        () => evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
            return Boolean(scene?.forestArrivalElements?.length);
        })()`),
        { timeoutMs: 15000, message: 'Forest field brief after Hub entry' }
    );
    const fieldBrief = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
        return {
            active: window.mythicalGame.scene.isActive('MythicalForestLevel'),
            hubActive: window.mythicalGame.scene.isActive('HubWorldScene'),
            fieldBriefVisible: scene.children.list.some(item => (
                item.text === 'PROJECT BEACON // FIELD BRIEF'
            )),
            physicsPaused: scene.physics.world.isPaused
        };
    })()`);
    if (
        !fieldBrief.active ||
        fieldBrief.hubActive ||
        !fieldBrief.fieldBriefVisible ||
        !fieldBrief.physicsPaused
    ) {
        throw new Error(`Hub-to-Forest handoff failed before gameplay: ${JSON.stringify(fieldBrief)}`);
    }

    await touch(session, 195, 620);
    await waitFor(
        () => evaluate(session, `Boolean(
            window.mythicalGame.scene.getScene('MythicalForestLevel')?.levelEntryElements?.length
        )`),
        { message: 'Forest mission panel after Hub field brief' }
    );
    await pressEnter(session);
    try {
        await waitFor(
            () => evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
                return Boolean(scene?.player?.active) && !scene.physics.world.isPaused &&
                    scene?.platformerControlsVisible === true;
            })()`),
            { timeoutMs: 15000, message: 'Forest live gameplay after Hub entry' }
        );
    } catch (error) {
        const diagnostics = await evaluate(session, `(() => {
            const game = window.mythicalGame;
            const scene = game.scene.getScene('MythicalForestLevel');
            return {
                activeScenes: game.scene.getScenes(true).map(entry => entry.scene.key),
                hubActive: game.scene.isActive('HubWorldScene'),
                forestActive: game.scene.isActive('MythicalForestLevel'),
                forestArrivalCount: scene?.forestArrivalElements?.length,
                levelEntryCount: scene?.levelEntryElements?.length,
                levelEntryDismissing: scene?.levelEntryDismissing,
                levelStarted: scene?.levelStarted,
                playerActive: scene?.player?.active,
                physicsPaused: scene?.physics?.world?.isPaused,
                mobileControls: scene?.platformerControlsVisible === true
            };
        })()`);
        throw new Error(`${error.message}: ${JSON.stringify(diagnostics)}`);
    }
    const gameplay = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
        return {
            playerActive: Boolean(scene?.player?.active),
            physicsPaused: Boolean(scene?.physics?.world?.isPaused),
            mobileControls: scene?.platformerControlsVisible === true,
            fieldBriefCleared: scene?.forestArrivalElements?.length === 0
        };
    })()`);
    if (
        !gameplay.playerActive ||
        gameplay.physicsPaused ||
        !gameplay.mobileControls ||
        !gameplay.fieldBriefCleared ||
        exceptions.length
    ) {
        throw new Error(
            `Hub-to-Forest handoff did not restore live play: ${JSON.stringify({
                fieldBrief,
                gameplay,
                exceptions
            })}`
        );
    }

    const checkpointSetup = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
        const checkpoint = scene?.checkpointAnchors?.[0];
        const route = scene?.optionalRouteRewards?.get?.('forest_canopy_run');
        if (!scene?.player || !checkpoint || !route) return null;

        scene.activateBeaconCheckpoint(checkpoint);
        scene.selectForestRoute('optional');
        [3, 4].forEach(index => {
            const fragment = scene.starFragmentSprites?.[index];
            if (fragment?.sprite && fragment?.pickupZone) {
                scene.collectStarFragment(
                    fragment.sprite,
                    fragment.pickupZone,
                    index
                );
            }
        });
        const persisted = window.GameState.get(
            'story.projectBeacon.expeditionCheckpoint'
        );
        return {
            checkpointId: persisted?.checkpointId,
            checkpointIndex: persisted?.checkpointIndex,
            checkpointX: persisted?.x,
            checkpointY: persisted?.y,
            authoredCheckpointY: checkpoint.respawnY,
            routeState: persisted?.routeState,
            selectedPath: route.choice?.selectedPath,
            progress: route.progress,
            completed: route.completed === true,
            guardCharges: scene.optionalRouteGuardCharges,
            fragmentMask: scene.forestCollectedFragmentMask,
            fragmentCount: scene.starFragmentsCollected
        };
    })()`);
    if (
        checkpointSetup?.checkpointId !== 'forest_anchor_1' ||
        checkpointSetup.checkpointIndex !== 0 ||
        checkpointSetup.checkpointX !== 1770 ||
        checkpointSetup.checkpointY !== checkpointSetup.authoredCheckpointY ||
        checkpointSetup.selectedPath !== 'optional' ||
        checkpointSetup.progress !== 2 ||
        checkpointSetup.completed !== true ||
        checkpointSetup.guardCharges !== 1 ||
        checkpointSetup.fragmentMask !== 24 ||
        checkpointSetup.fragmentCount !== 2 ||
        checkpointSetup.routeState?.forestRouteChoice !== 'optional' ||
        checkpointSetup.routeState?.canopyCompleted !== true ||
        checkpointSetup.routeState?.canopyGuardCharges !== 1
    ) {
        throw new Error(
            `Forest checkpoint did not capture Canopy state: ${JSON.stringify(checkpointSetup)}`
        );
    }

    await evaluate(session, `(() => {
        window.mythicalGame.scene.getScene('MythicalForestLevel').returnToHub();
        return true;
    })()`);
    await waitForScene(session, 'HubWorldScene', 15000);
    const hubResume = await waitFor(
        () => evaluate(session, `(() => {
            const hub = window.mythicalGame.scene.getScene('HubWorldScene');
            const selected = hub?.gates?.[hub?.selectedGateIndex];
            const resume = hub?.getExpeditionResumeForGate?.('mythical_forest');
            if (
                selected?.id !== 'mythical_forest' ||
                hub?.actionLabel?.text !== 'RESUME' ||
                !resume
            ) return null;
            const bounds = hub.actionLabel.getBounds();
            return {
                selectedGateId: selected.id,
                action: hub.actionLabel.text,
                info: hub.infoText?.text || '',
                resume,
                actionX: Math.round(bounds.centerX),
                actionY: Math.round(bounds.centerY)
            };
        })()`),
        { timeoutMs: 5000, message: 'Hub Forest resume action' }
    );
    if (
        hubResume.resume?.checkpointId !== 'forest_anchor_1' ||
        hubResume.resume?.label !== 'Rootway' ||
        hubResume.resume?.current !== 1 ||
        hubResume.resume?.total !== 3 ||
        !hubResume.info.includes('Beacon 1/3') ||
        !hubResume.info.includes('Rootway')
    ) {
        throw new Error(
            `Hub did not explain the resumable Forest checkpoint: ${JSON.stringify(hubResume)}`
        );
    }

    await touch(session, hubResume.actionX, hubResume.actionY);
    await waitForScene(session, 'MythicalForestLevel', 20000);
    const resumedCheckpoint = await waitFor(
        () => evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
            if (!scene?.checkpointResumeApplied || !scene?.levelEntryElements?.length) {
                return null;
            }
            const route = scene.optionalRouteRewards?.get?.('forest_canopy_run');
            const remainingOptional = (scene.starFragmentSprites || []).filter(
                entry => entry?.pickupZone &&
                    entry.pickupZone.active !== false &&
                    entry.optionalRouteId
            ).length;
            return {
                checkpointId: scene.checkpointPosition?.id,
                checkpointIndex: scene.checkpointPosition?.index,
                checkpointX: scene.checkpointPosition?.x,
                checkpointY: scene.checkpointPosition?.y,
                playerX: scene.player?.x,
                playerY: scene.player?.y,
                selectedPath: route?.choice?.selectedPath,
                progress: route?.progress,
                completed: route?.completed === true,
                guardCharges: scene.optionalRouteGuardCharges,
                fragmentMask: scene.forestCollectedFragmentMask,
                fragmentCount: scene.starFragmentsCollected,
                remainingOptional,
                firstArrivalVisible: scene.forestArrivalElements?.length > 0,
                physicsPaused: scene.physics.world.isPaused
            };
        })()`),
        { timeoutMs: 5000, message: 'Forest state restored from Hub' }
    );
    if (
        resumedCheckpoint.checkpointId !== 'forest_anchor_1' ||
        resumedCheckpoint.checkpointIndex !== 0 ||
        resumedCheckpoint.checkpointX !== 1770 ||
        resumedCheckpoint.checkpointY !== checkpointSetup.authoredCheckpointY ||
        resumedCheckpoint.playerX !== 1770 ||
        resumedCheckpoint.playerY !== checkpointSetup.authoredCheckpointY ||
        resumedCheckpoint.selectedPath !== 'optional' ||
        resumedCheckpoint.progress !== 2 ||
        resumedCheckpoint.completed !== true ||
        resumedCheckpoint.guardCharges !== 1 ||
        resumedCheckpoint.fragmentMask !== 24 ||
        resumedCheckpoint.fragmentCount !== 2 ||
        resumedCheckpoint.remainingOptional !== 0 ||
        resumedCheckpoint.firstArrivalVisible ||
        !resumedCheckpoint.physicsPaused
    ) {
        throw new Error(
            `Hub resume did not restore exact Forest state: ${JSON.stringify(resumedCheckpoint)}`
        );
    }

    await pressEnter(session);
    const resumedGameplay = await waitFor(
        () => evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
            if (
                !scene?.player?.active ||
                scene.physics.world.isPaused ||
                scene.platformerControlsVisible !== true
            ) return null;
            return {
                playerActive: true,
                physicsPaused: false,
                mobileControls: true,
                checkpointResumeApplied: scene.checkpointResumeApplied === true
            };
        })()`),
        { timeoutMs: 5000, message: 'Forest live play after Hub resume' }
    );
    if (exceptions.length) {
        throw new Error(
            `Hub Forest resume raised browser exceptions: ${exceptions.join(' | ')}`
        );
    }

    return {
        gateEntry,
        fieldBrief,
        gameplay,
        checkpointSetup,
        hubResume,
        resumedCheckpoint,
        resumedGameplay
    };
}

// State-contract data is intentionally separate from the interaction checks below.
// This suite validates cross-system state wiring; it does not claim that a player
// traversed a level, defeated a guardian, or completed the campaign through UI.
const CAMPAIGN_STATE_STEPS = Object.freeze([
    {
        route: 'mythicalForest',
        sceneName: 'MythicalForestLevel',
        levelId: 'mythicalForest',
        partId: 'forest_core',
        reconstructionStepId: 'living_power_lattice',
        speedrunThreshold: 240000
    },
    {
        route: 'crystalCaves',
        sceneName: 'CrystalCavesLevel',
        levelId: 'crystalCaves',
        partId: 'crystal_core',
        reconstructionStepId: 'propulsion_control',
        katanaUpgradeId: 'crystal_edge',
        speedrunThreshold: 180000
    },
    {
        route: 'reef',
        sceneName: 'ReefLevel',
        levelId: 'cosmicReef',
        partId: 'dimensional_drive',
        reconstructionStepId: 'sealed_return_vector',
        speedrunThreshold: 240000
    },
    {
        route: 'voidPeaks',
        sceneName: 'VoidPeaksLevel',
        levelId: 'voidPeaks',
        partId: 'hull_plating',
        reconstructionStepId: 'resonance_hull',
        speedrunThreshold: 180000
    },
    {
        route: 'auroraDepths',
        sceneName: 'AuroraDepthsLevel',
        levelId: 'auroraDepths',
        partId: 'aurora_reactor',
        reconstructionStepId: 'uplink_hold',
        katanaUpgradeId: 'aurora_guard',
        speedrunThreshold: 300000
    },
    {
        route: 'finalVoid',
        sceneName: 'FinalVoidLevel',
        levelId: 'finalVoid',
        partId: 'command_module',
        reconstructionStepId: 'black_box_recovery',
        speedrunThreshold: 360000
    }
]);

async function startCampaignScene(session, step) {
    await evaluate(session, `(async () => {
        const game = window.mythicalGame;
        game.scene.getScenes(true).forEach(active => {
            game.scene.stop(active.scene.key);
        });
        await window.SceneLoader.loadScene(game, ${JSON.stringify(step.sceneName)});
        game.scene.start(${JSON.stringify(step.sceneName)}, {
            entryPreview: true,
            forceMobileControls: true,
            platformerPreviewSize: 'mobile'
        });
        return true;
    })()`);
    await waitForScene(session, step.sceneName);
    await delay(450);
    // Dismiss from the upper playfield so the same pointer cannot land on a
    // control that becomes interactive while the entry overlay is fading.
    await tap(session, 195, 140);
    await delay(500);
    const entryAccepted = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(step.sceneName)});
        return Boolean(
            scene?.levelEntryDismissing ||
            scene?.levelStarted ||
            scene?.gameStarted
        ) && !scene?.physics?.world?.isPaused;
    })()`);
    if (!entryAccepted) {
        await pressEnter(session);
    }
    await delay(500);
}

async function prepareGuardianHandoffState(session, step) {
    const stepIndex = CAMPAIGN_STATE_STEPS.findIndex(
        candidate => candidate.route === step.route
    );
    if (stepIndex < 0) {
        throw new Error(`Unknown guardian handoff step ${step.route}`);
    }

    return evaluate(session, `(() => {
        const state = window.GameState;
        const campaign = ${JSON.stringify(CAMPAIGN_STATE_STEPS)};
        const currentIndex = ${stepIndex};
        const priorSteps = campaign.slice(0, currentIndex);
        const priorParts = priorSteps.map(candidate => candidate.partId);
        const completedStepIds = priorSteps.map(
            candidate => candidate.reconstructionStepId
        );
        const installedAt = new Date().toISOString();
        const currentFieldKit = state.get('story.projectBeacon.fieldKit') || {};
        const currentKatana = currentFieldKit.katana || {};
        const priorUpgrades = priorSteps
            .filter(candidate => candidate.katanaUpgradeId)
            .map(candidate => ({
                id: candidate.katanaUpgradeId,
                name: candidate.katanaUpgradeId === 'crystal_edge'
                    ? 'Resonant Edge'
                    : 'Aurora Guard',
                sourceLevelId: candidate.levelId,
                installedAt
            }));

        state.set('creature.id', 'guardian_handoff_nova');
        state.set('creature.name', 'Nova');
        state.set('creature.hatched', true);
        state.set('creature.named', true);
        state.set('story.projectBeacon.fieldKit', {
            ...currentFieldKit,
            recovered: true,
            recoveredAt: installedAt,
            katana: {
                ...currentKatana,
                id: currentKatana.id || 'earth_field_katana',
                name: currentKatana.name || 'Earth-forged Field Katana',
                material: currentKatana.material || 'Titanium-ceramic laminate',
                upgradeSlots: 2,
                configuration: priorUpgrades.length
                    ? 'creature_tech_adapted'
                    : 'earth_forged',
                installedUpgrades: priorUpgrades
            }
        });
        state.set('hubWorld.shipParts.collected', priorParts);
        state.set('story.projectBeacon.shipReconstruction', {
            schemaVersion: 1,
            completedStepIds,
            firstInstalledAt: completedStepIds.length ? installedAt : null,
            completedAt: null,
            history: completedStepIds.map((stepId, index) => ({
                operationId: 'guardian_handoff_prior_' + (index + 1),
                type: 'ship_system_installed',
                stepId,
                partId: priorParts[index],
                occurredAt: installedAt
            }))
        });
        campaign.forEach(candidate => {
            state.set(
                'levels.' + candidate.levelId + '.completed',
                priorSteps.some(prior => prior.levelId === candidate.levelId)
            );
        });
        state.set('story.projectBeacon.pendingDebriefs', []);
        state.set('story.projectBeacon.firstForestCinematicVersion', 2);
        state.set('story.projectBeacon.firstExpeditionDrill', {
            completed: true,
            completedAt: installedAt
        });
        state.set(
            'story.projectBeacon.debriefsSeen',
            priorSteps.slice(0, 5).map(
                (_candidate, index) => 'beacon_debrief_' + (index + 1)
            )
        );
        state.set('story.projectBeacon.expeditionCheckpoint', null);
        state.set('hubWorld.shipCompletionCutsceneShown', currentIndex >= 5);
        state.set('stats.levelsCompleted', priorSteps.length);
        state.set('world.rescuedResidents', {});
        state.set('world.guardianResidents', {});
        state.save();

        return {
            priorParts,
            completedStepIds,
            priorDebriefs: priorSteps.slice(0, 5).length,
            currentLevelPreviouslyComplete:
                state.get(
                    'levels.' + campaign[currentIndex].levelId + '.completed'
                ) === true
        };
    })()`);
}

async function startGuardianHandoffEncounter(session, step) {
    await startCampaignScene(session, step);

    await waitFor(
        () => evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(step.sceneName)});
            if (
                !scene?._levelContentCreated ||
                !scene?.player?.active ||
                scene?.time?.paused ||
                scene?.physics?.world?.isPaused
            ) return null;
            return true;
        })()`),
        { timeoutMs: 12000, message: `${step.sceneName} focused level clock` }
    );

    const guardianEntry = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(step.sceneName)});
        if (!scene?.player || typeof scene?.startBossFight !== 'function') {
            return null;
        }

        const route = ${JSON.stringify(step.route)};
        const encounter = {
            mythicalForest: {
                id: 'elder_treant',
                title: 'ELDER TREANT',
                checkpoint: { x: 5380, y: scene.levelHeight - 170 }
            },
            crystalCaves: {
                id: 'crystal_golem',
                title: 'CRYSTAL GOLEM',
                checkpoint: { x: 5050, y: scene.levelHeight - 130 }
            },
            reef: {
                id: 'nyxvoral',
                title: "NYX'VORAL",
                checkpoint: { x: 5420, y: scene.levelHeight - 360 }
            },
            voidPeaks: {
                id: 'cosmic_titan',
                title: 'COSMIC TITAN',
                checkpoint: scene.getTraversalSupportCheckpoint?.(
                    'peak-titan-gate',
                    4680
                )
            },
            auroraDepths: {
                id: 'shadow_phoenix',
                title: 'AURORA PHOENIX',
                checkpoint: scene.getTraversalSupportCheckpoint?.(
                    'aurora-phoenix-gate',
                    4550
                )
            },
            finalVoid: {
                id: 'void_empress',
                title: 'VOID EMPRESS',
                checkpoint: scene.getTraversalSupportCheckpoint?.(
                    'final-empress-gate',
                    5610
                )
            }
        }[route];
        if (!encounter?.checkpoint) return null;

        const accepted = scene.beginGuardianEncounter({
            ...encounter,
            start: () => {
                scene.bossFightActive = true;
                const spawn = {
                    mythicalForest: 'spawnElderTreant',
                    crystalCaves: 'spawnCrystalGolem',
                    reef: 'spawnNyxvoral',
                    voidPeaks: 'spawnCosmicTitan',
                    auroraDepths: 'spawnShadowPhoenix',
                    finalVoid: 'spawnVoidEmpress'
                }[route];
                scene[spawn]();
                scene.physics.resume();
            }
        });
        return {
            accepted,
            guardianId: scene.guardianEncounter?.id || null,
            checkpointX: scene.checkpointPosition?.x,
            checkpointY: scene.checkpointPosition?.y,
            gateCleared: scene.guardianGateState == null,
            duplicateAccepted: scene.beginGuardianEncounter({
                id: 'duplicate_guardian',
                checkpoint: { x: 100, y: 100 },
                start: () => {}
            })
        };
    })()`);
    if (
        guardianEntry?.accepted !== true ||
        !guardianEntry.guardianId ||
        !Number.isFinite(guardianEntry.checkpointX) ||
        !Number.isFinite(guardianEntry.checkpointY) ||
        guardianEntry.gateCleared !== true ||
        guardianEntry.duplicateAccepted !== false
    ) {
        throw new Error(
            `${step.sceneName} rejected focused guardian entry: ` +
            JSON.stringify(guardianEntry)
        );
    }

    await delay(500);
    const combatReady = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(step.sceneName)});
            const target = scene?.getBossCombatTarget?.();
            return {
                guardianId: scene.guardianEncounter?.id || null,
                bossHealth: Number(scene.bossHealth),
                targetActive: target?.active === true,
                bossActive: scene?.boss?.active === true,
                bossBodyActive: scene?.bossBody?.active === true,
                bossFightActive: scene?.bossFightActive === true,
                bossDefeated: scene?.bossDefeated === true,
                physicsPaused: scene?.physics?.world?.isPaused === true,
                sceneTimePaused: scene?.time?.paused === true,
                sceneTime: Number(scene?.time?.now),
                levelStarted: scene?.levelStarted === true,
                levelEntryDismissing: scene?.levelEntryDismissing === true
            };
        })()`);
    if (
        combatReady?.bossFightActive !== true ||
        combatReady.physicsPaused !== false ||
        combatReady.targetActive !== true
    ) {
        throw new Error(
            `${step.sceneName} focused guardian did not become targetable: ` +
            JSON.stringify({ guardianEntry, combatReady })
        );
    }

    return { guardianEntry, combatReady };
}

async function smokeGuardianHandoff(session, step, exceptions) {
    exceptions.length = 0;
    await navigate(session, `${BASE_URL}/play/?reset=true`);
    await waitForScene(session, 'HatchingScene');
    const prepared = await prepareGuardianHandoffState(session, step);
    const interaction = await startGuardianHandoffEncounter(session, step);
    const finalHit = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(step.sceneName)});
        const target = scene?.getBossCombatTarget?.();
        if (!scene?.player || !target || !scene?.bossFightActive) return null;
        scene.bossRecoveryUntil = 0;
        scene.titanRecoveryUntil = 0;
        if (scene.boss) scene.boss.isRecovering = false;
        scene.crystalEnergy = Math.max(3, Number(scene.crystalEnergy) || 0);
        scene.freeSpecialAttackCharges = 0;
        scene.bossHealth = 3;
        if (scene.boss) scene.boss.health = 3;
        scene.player.setPosition(target.x - 140, target.y);
        scene.player.setVelocity?.(0, 0);
        scene.player.facingRight = true;
        const coinsBefore = Number(window.GameState.get('player.cosmicCoins')) || 0;
        const completedBefore = Number(window.GameState.get('stats.levelsCompleted')) || 0;
        scene.performSpecialAttack();
        return {
            coinsBefore,
            completedBefore,
            bossHealth: Number(scene.bossHealth),
            bossDefeated: scene.bossDefeated === true,
            bossFightActive: scene.bossFightActive === true
        };
    })()`);
    if (
        !finalHit ||
        finalHit.bossHealth !== 0 ||
        finalHit.bossDefeated !== true ||
        finalHit.bossFightActive !== false
    ) {
        throw new Error(
            `${step.sceneName} real final Super Blast did not restore its guardian: ` +
            JSON.stringify(finalHit)
        );
    }

    const completion = await waitFor(
        () => evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(step.sceneName)});
            const result = scene?.levelCompletionResult;
            if (!result || !scene?.levelCompletionActive) return null;
            const state = window.GameState;
            return {
                levelId: result.levelId,
                partId: result.shipPartId,
                firstCompletion: result.firstCompletion,
                partAwarded: result.shipPartAwarded,
                katanaAwarded: result.katanaUpgradeAwarded,
                residentId: result.rescuedResident?.id || null,
                guardianId: result.guardianResident?.id || null,
                pendingDebriefs: state.get('story.projectBeacon.pendingDebriefs') || [],
                completedCount: Number(state.get('stats.levelsCompleted')) || 0,
                coins: Number(state.get('player.cosmicCoins')) || 0,
                checkpoint: state.get('story.projectBeacon.expeditionCheckpoint') || null,
                physicsPaused: scene.physics?.world?.isPaused === true,
                controlsHidden: scene.platformerControlsVisible === false
            };
        })()`),
        { timeoutMs: 20000, message: `${step.sceneName} completion record` }
    );
    if (
        completion.levelId !== step.levelId ||
        completion.partId !== step.partId ||
        completion.firstCompletion !== true ||
        completion.partAwarded !== true ||
        !completion.residentId ||
        !completion.guardianId ||
        completion.pendingDebriefs.length !== (step.route === 'finalVoid' ? 0 : 1) ||
        completion.completedCount !== finalHit.completedBefore + 1 ||
        completion.coins <= finalHit.coinsBefore ||
        completion.checkpoint !== null ||
        completion.physicsPaused !== true ||
        completion.controlsHidden !== true
    ) {
        throw new Error(
            `${step.sceneName} did not record one complete guardian outcome: ` +
            JSON.stringify({ prepared, finalHit, completion })
        );
    }

    const residentCta = await touchInteractiveSceneText(
        session,
        'RETURN WITH ',
        {
            match: 'startsWith',
            timeoutMs: 8000,
            message: `${step.sceneName} rescued resident continuation`
        }
    );

    const duplicate = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(step.sceneName)});
        const before = {
            coins: Number(window.GameState.get('player.cosmicCoins')) || 0,
            completed: Number(window.GameState.get('stats.levelsCompleted')) || 0,
            parts: [...(window.GameState.get('hubWorld.shipParts.collected') || [])]
        };
        const result = scene.completeLevelProgression({
            achievementLevelId: ${JSON.stringify(step.levelId)},
            shipPartId: ${JSON.stringify(step.partId)},
            katanaUpgradeId: ${JSON.stringify(step.katanaUpgradeId || null)},
            speedrunThreshold: ${step.speedrunThreshold}
        });
        return {
            sameResult: result === scene.levelCompletionResult,
            before,
            after: {
                coins: Number(window.GameState.get('player.cosmicCoins')) || 0,
                completed: Number(window.GameState.get('stats.levelsCompleted')) || 0,
                parts: [...(window.GameState.get('hubWorld.shipParts.collected') || [])]
            }
        };
    })()`);
    if (
        duplicate.sameResult !== true ||
        JSON.stringify(duplicate.before) !== JSON.stringify(duplicate.after)
    ) {
        throw new Error(
            `${step.sceneName} duplicated guardian rewards: ${JSON.stringify(duplicate)}`
        );
    }

    let katanaCta = null;
    if (step.katanaUpgradeId) {
        katanaCta = await touchDomButton(
            session,
            '.katana-artifact-continue',
            {
                timeoutMs: 16000,
                message: `${step.sceneName} visible katana continuation`
            }
        );
    }

    const returnLabel = {
        mythicalForest: '[ RETURN TO HUB ]',
        crystalCaves: '[ RETURN TO HUB ]',
        reef: '[ RETURN TO HUB ]',
        voidPeaks: '[ RETURN TO HUB ]',
        auroraDepths: '[ INSTALL AURORA REACTOR ]',
        finalVoid: '[ INSTALL AT WANDERER-77 ]'
    }[step.route];
    const returnCta = await touchInteractiveSceneText(
        session,
        returnLabel,
        {
            timeoutMs: 20000,
            message: `${step.sceneName} visible completion action`
        }
    );

    if (step.route === 'finalVoid') {
        await waitForScene(session, 'GameScene', 12000);
    } else {
        await waitForScene(session, 'HubWorldScene', 12000);
        const debriefCta = await touchInteractiveSceneText(
            session,
            `INSTALL ${step.route === 'mythicalForest'
                ? 'FOREST CORE'
                : step.route === 'crystalCaves'
                    ? 'CRYSTAL CORE'
                    : step.route === 'reef'
                        ? 'DIMENSIONAL DRIVE'
                        : step.route === 'voidPeaks'
                            ? 'HULL PLATING'
                            : 'AURORA REACTOR'}`,
            {
                timeoutMs: 12000,
                message: `${step.sceneName} debrief installation action`
            }
        );
        await waitForScene(session, 'GameScene', 12000);
        step.__debriefCta = debriefCta;
    }

    const installLabel = `INSTALL ${step.route === 'mythicalForest'
        ? 'FOREST CORE'
        : step.route === 'crystalCaves'
            ? 'CRYSTAL CORE ENGINE'
            : step.route === 'reef'
                ? 'DIMENSIONAL DRIVE'
                : step.route === 'voidPeaks'
                    ? 'RESONANCE HULL PLATING'
                    : step.route === 'auroraDepths'
                        ? 'AURORA REACTOR'
                        : 'COMMAND MODULE'}`;
    let installationCta;
    try {
        installationCta = await touchInteractiveSceneText(
            session,
            installLabel,
            {
                timeoutMs: 12000,
                message: `${step.sceneName} Wanderer-77 installation action`
            }
        );
    } catch (error) {
        const diagnostics = await evaluate(session, `(() => {
            const activeScenes = window.mythicalGame?.scene?.getScenes(true) || [];
            const gameScene = window.mythicalGame?.scene?.getScene('GameScene');
            const reconstruction = window.ShipReconstruction
                ?.getShipReconstructionSnapshot?.(window.GameState);
            return {
                activeScenes: activeScenes.map(scene => scene.scene?.key),
                gameSceneActive: gameScene?.sys?.isActive?.() === true,
                shuttingDown: gameScene?._isShuttingDown === true,
                handoff: gameScene?.shipReconstructionHandoff === true,
                evidenceVisible:
                    gameScene?.shipEvidenceBoardModal?.isVisible === true,
                reconstruction: reconstruction ? {
                    available: reconstruction.available,
                    ready: reconstruction.ready,
                    readyStep: reconstruction.readyStep?.id || null,
                    completedCount: reconstruction.completedCount
                } : null,
                visibleText: (gameScene?.children?.list || [])
                    .filter(item => typeof item?.text === 'string' && item.visible !== false)
                    .map(item => item.text)
                    .filter(text => /INSTALL|RECOVER|WANDERER|ARCHIVE/.test(text))
                    .slice(0, 20),
                exceptions: ${JSON.stringify(exceptions)}
            };
        })()`);
        throw new Error(
            `${error.message}: ${JSON.stringify(diagnostics)}`
        );
    }
    const installed = await waitFor(
        () => evaluate(session, `(() => {
            const snapshot = window.ShipReconstruction
                ?.getShipReconstructionSnapshot?.(window.GameState);
            if (!snapshot?.state?.completedStepIds?.includes(
                ${JSON.stringify(step.reconstructionStepId)}
            )) return null;
            return {
                completedCount: snapshot.completedCount,
                complete: snapshot.complete,
                installed: true
            };
        })()`),
        { timeoutMs: 5000, message: `${step.sceneName} system installation` }
    );

    let destination = null;
    if (step.route === 'finalVoid') {
        await waitForScene(session, 'VictoryScene', 8000);
        destination = {
            scene: 'VictoryScene'
        };
    } else {
        await waitForScene(session, 'HubWorldScene', 8000);
        destination = {
            scene: 'HubWorldScene',
            debriefCta: step.__debriefCta
        };
    }

    if (exceptions.length) {
        throw new Error(
            `${step.sceneName} guardian handoff raised browser exceptions: ` +
            exceptions.join(' | ')
        );
    }
    return {
        prepared,
        interaction: {
            guardianEntry: interaction.guardianEntry,
            combatReady: interaction.combatReady
        },
        finalHit,
        completion,
        duplicate,
        residentCta,
        katanaCta,
        returnCta,
        installationCta,
        installed,
        destination
    };
}

async function smokeGuardianHandoffs(session, exceptions) {
    const knownRoutes = ['all', ...CAMPAIGN_STATE_STEPS.map(step => step.route)];
    if (!knownRoutes.includes(SMOKE_CASE)) {
        throw new Error(
            `Unknown guardian-handoff SMOKE_CASE ${JSON.stringify(SMOKE_CASE)}. ` +
            `Use one of: ${knownRoutes.join(', ')}.`
        );
    }
    const results = {};
    for (const step of CAMPAIGN_STATE_STEPS.filter(
        candidate => SMOKE_CASE === 'all' || candidate.route === SMOKE_CASE
    )) {
        results[step.route] = await smokeGuardianHandoff(
            session,
            { ...step },
            exceptions
        );
        process.stdout.write(`PASS ${step.sceneName}GuardianHandoff\n`);
    }
    return results;
}

async function smokeCampaignStateContract(session, exceptions) {
    exceptions.length = 0;
    await navigate(session, `${BASE_URL}/play/?reset=true`);
    await waitForScene(session, 'HatchingScene');
    await evaluate(session, `(() => {
        const state = window.GameState;
        state.set('creature.name', 'Nova');
        state.set('creature.hatched', true);
        state.set('creature.named', true);
        state.set('story.projectBeacon.fieldKit.recovered', true);
        state.set('hubWorld.shipParts.collected', []);
        state.set('hubWorld.shipParts.finalBossUnlocked', false);
        state.set('hubWorld.shipCompletionCutsceneShown', false);
        state.set('hubWorld.gates.final_void.unlocked', false);
        state.set('story.projectBeacon.pendingDebriefs', []);
        state.set('story.projectBeacon.debriefsSeen', []);
        state.set('stats.levelsCompleted', 0);
        state.set(
            'story.projectBeacon.shipReconstruction',
            window.ShipReconstruction.createInitialShipReconstructionState()
        );
        state.set('world.rescuedResidents', {});
        state.set('world.guardianResidents', {});
        state.save();
        return true;
    })()`);

    const steps = [];
    for (const step of CAMPAIGN_STATE_STEPS) {
        await startCampaignScene(session, step);
        const result = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(step.sceneName)});
            const completion = scene.completeLevelProgression({
                achievementLevelId: ${JSON.stringify(step.levelId)},
                shipPartId: ${JSON.stringify(step.partId)},
                katanaUpgradeId: ${JSON.stringify(step.katanaUpgradeId || null)},
                speedrunThreshold: ${step.speedrunThreshold}
            });
            const installation = window.ShipReconstruction.installShipReconstructionStep(
                window.GameState,
                ${JSON.stringify(step.reconstructionStepId)},
                { operationId: ${JSON.stringify(`campaign-smoke:${step.reconstructionStepId}`)} }
            );
            const reconstruction = window.ShipReconstruction
                .getShipReconstructionSnapshot(window.GameState);
            return {
                completion: {
                    levelId: completion?.levelId,
                    partId: completion?.shipPartId,
                    residentId: completion?.rescuedResident?.id,
                    guardianId: completion?.guardianResident?.id,
                    firstCompletion: completion?.firstCompletion
                },
                installation: {
                    changed: installation?.changed,
                    reason: installation?.reason,
                    stepId: installation?.step?.id
                },
                reconstruction: {
                    completedCount: reconstruction.completedCount,
                    finalVoidReady: reconstruction.finalVoidReady,
                    complete: reconstruction.complete
                }
            };
        })()`);

        if (
            result.completion.levelId !== step.levelId ||
            result.completion.partId !== step.partId ||
            !result.completion.residentId ||
            !result.completion.guardianId ||
            result.completion.firstCompletion !== true
        ) {
            throw new Error(`Campaign completion failed for ${step.levelId}: ${JSON.stringify(result)}`);
        }
        if (
            result.installation.changed !== true ||
            result.installation.stepId !== step.reconstructionStepId ||
            result.reconstruction.completedCount !== steps.length + 1
        ) {
            throw new Error(`Campaign installation failed for ${step.levelId}: ${JSON.stringify(result)}`);
        }
        if (
            steps.length === 4 &&
            result.reconstruction.finalVoidReady !== true
        ) {
            throw new Error(`Final Void route did not become ready: ${JSON.stringify(result)}`);
        }
        steps.push(result);
        process.stdout.write(`PASS Campaign ${step.levelId}\n`);
    }

    await evaluate(session, `(async () => {
        const game = window.mythicalGame;
        game.scene.stop('FinalVoidLevel');
        game.scene.start('VictoryScene');
        return true;
    })()`);
    await waitForScene(session, 'VictoryScene');
    await delay(300);
    const ending = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('VictoryScene');
        const restorationRecorded = scene.recordCampaignRestoration();
        const priorityRecorded = scene.recordEndingChoice('remain_and_defend');
        const epilogueRecorded = scene.completeEndingEpilogue('remain_and_defend');
        const residents = window.RescuedResidents
            .getRescuedResidentSnapshot(window.GameState);
        const guardians = window.GuardianResidents
            .getGuardianResidentsSnapshot(window.GameState);
        const reconstruction = window.ShipReconstruction
            .getShipReconstructionSnapshot(window.GameState);
        return {
            restorationRecorded,
            priorityRecorded,
            epilogueRecorded,
            priority: window.GameState.get('story.projectBeacon.finale.priority'),
            epilogueSeen: window.GameState.get(
                'story.projectBeacon.finale.epilogueSeen'
            ),
            nextChapter: window.GameState.get(
                'story.projectBeacon.legacyCapsule.nextChapter'
            ),
            rescuedResidents: residents.rescued.map(item => item.id),
            rescuedCount: residents.rescuedCount,
            guardianCount: guardians.rescuedCount,
            reconstructionComplete: reconstruction.complete,
            installedCount: reconstruction.completedCount,
            completedLevels: window.GameState.get('stats.levelsCompleted')
        };
    })()`);
    if (
        ending.priority !== 'remain_and_defend' ||
        ending.epilogueSeen !== true ||
        ending.nextChapter !== 'remain_and_defend' ||
        ending.rescuedCount !== CAMPAIGN_STATE_STEPS.length ||
        ending.guardianCount !== CAMPAIGN_STATE_STEPS.length ||
        ending.reconstructionComplete !== true ||
        ending.installedCount !== CAMPAIGN_STATE_STEPS.length ||
        ending.completedLevels !== CAMPAIGN_STATE_STEPS.length
    ) {
        throw new Error(`Campaign ending state is incomplete: ${JSON.stringify(ending)}`);
    }
    if (exceptions.length) {
        throw new Error(`Campaign raised browser exceptions: ${exceptions.join(' | ')}`);
    }
    return { steps, ending };
}

async function smokeFinalPriorityJourney(session, exceptions) {
    exceptions.length = 0;
    await navigate(session, `${BASE_URL}/play/?reset=true`);
    await waitForScene(session, 'HatchingScene');
    const started = await evaluate(session, `(() => {
        const game = window.mythicalGame;
        const state = window.GameState;
        const creature = {
            ...(state.get('creature') || {}),
            id: 'smoke_finale_nova',
            name: 'Nova',
            hatched: true,
            named: true,
            textureName: state.get('creature.textureName') || null
        };
        state.set('creature', creature);
        state.set('creatures', [creature]);
        state.set('activeCreatureIndex', 0);
        state.set('story.projectBeacon.finale.priority', null);
        state.set('story.projectBeacon.finale.epilogueSeen', false);
        state.set('story.projectBeacon.finale.epilogueCompletedAt', null);
        state.save();
        game.scene.stop('HatchingScene');
        game.scene.start('VictoryScene');
        return true;
    })()`);
    if (!started) throw new Error('Final priority journey could not start VictoryScene');
    await waitForScene(session, 'VictoryScene');

    await touchSceneText(session, 'SKIP >>', {
        message: 'Victory skip control'
    });
    await touchSceneText(session, 'Choose what comes first', {
        message: 'Final priority entry'
    });
    await touchSceneText(session, 'PREPARE HOMECOMING\nPreserve a secret route', {
        message: 'Prepare Homecoming priority'
    });
    await touchSceneText(session, 'PREPARE THE ROUTE', {
        message: 'Final priority confirmation'
    });

    for (let page = 1; page <= 2; page += 1) {
        await touchSceneText(session, 'CONTINUE', {
            message: `Final epilogue continue ${page}`
        });
    }

    const ending = await evaluate(session, `(() => ({
        priority: window.GameState.get('story.projectBeacon.finale.priority'),
        epilogueSeen: window.GameState.get('story.projectBeacon.finale.epilogueSeen'),
        sanctuaryVisible: window.mythicalGame.scene.getScenes(true)
            .some(scene => scene.children?.list?.some(item => item.text === 'SANCTUARY')),
        newGamePlusVisible: window.mythicalGame.scene.getScenes(true)
            .some(scene => scene.children?.list?.some(item => item.text === 'NEW GAME+'))
    }))()`);
    if (
        ending.priority !== 'prepare_homecoming' ||
        ending.epilogueSeen !== true ||
        !ending.sanctuaryVisible ||
        !ending.newGamePlusVisible
    ) {
        throw new Error(`Final priority epilogue did not complete: ${JSON.stringify(ending)}`);
    }

    await touchSceneText(session, 'SANCTUARY', {
        message: 'Final Sanctuary return'
    });
    await waitForScene(session, 'HubWorldScene', 12000);
    const returnState = await evaluate(session, `(() => ({
        hubActive: window.mythicalGame.scene.isActive('HubWorldScene'),
        victoryActive: window.mythicalGame.scene.isActive('VictoryScene'),
        priority: window.GameState.get('story.projectBeacon.finale.priority'),
        epilogueSeen: window.GameState.get('story.projectBeacon.finale.epilogueSeen')
    }))()`);
    if (
        !returnState.hubActive ||
        returnState.victoryActive ||
        returnState.priority !== 'prepare_homecoming' ||
        returnState.epilogueSeen !== true ||
        exceptions.length
    ) {
        throw new Error(`Final priority Sanctuary return failed: ${JSON.stringify({ returnState, exceptions })}`);
    }
    return { ending, returnState };
}

async function smokeSaveReloadJourney(session, exceptions) {
    exceptions.length = 0;
    await navigate(session, `${BASE_URL}/play/?reset=true`);
    await waitForScene(session, 'HatchingScene');
    const seeded = await evaluate(session, `(() => {
        const game = window.mythicalGame;
        const state = window.GameState;
        state.set('session.gameStarted', true);
        state.set('creature.id', 'smoke_reload_nova');
        state.set('creature.name', 'Nova');
        state.set('creature.hatched', true);
        state.set('creature.named', true);
        state.set('creature.genes.id', 'smoke_reload_nova');
        state.set('creature.genes.personality.primary', 'curious');
        state.set('creature.genes.cosmicAffinity.element', 'nebula');
        state.set('creature.stats.happiness', 92);
        state.set('creature.stats.energy', 90);
        state.set('creature.stats.health', 100);
        state.set('creature.lifecycle.stage', 'baby');
        const creature = state.get('creature');
        state.set('creatures', [JSON.parse(JSON.stringify(creature))]);
        state.set('activeCreatureIndex', 0);
        const portraitSaved = state.saveCreaturePortrait({
            identityKey: 'SMOKE-RELOAD-23:baby:reload-proof',
            stage: 'baby',
            style: 'cinematic',
            assetRef: 'portrait-job-v1:11111111-2222-4333-8444-555555555555',
            provider: 'test',
            model: 'test',
            promptVersion: 'reload-smoke',
            storage: 'supabase-private',
            status: 'processing'
        });
        state.save();
        game.scene.stop('HatchingScene');
        game.scene.start('GameScene', { biome: 'nebula', forceMobileControls: true });
        return { portraitSaved };
    })()`);
    if (!seeded?.portraitSaved) throw new Error('Save reload journey could not persist portrait metadata');
    await waitForScene(session, 'GameScene', 30000);

    await evaluate(session, `(() => {
        window.mythicalGame.scene.getScene('GameScene')?.openShop?.();
        return true;
    })()`);
    await waitForScene(session, 'ShopScene');
    const buildTab = await evaluate(session, `(() => {
        const shop = window.mythicalGame.scene.getScene('ShopScene');
        const bounds = shop?.categoryButtons?.find(entry => entry.id === 'base')?.zone?.getBounds?.();
        return bounds ? { x: Math.round(bounds.centerX), y: Math.round(bounds.centerY) } : null;
    })()`);
    if (!buildTab) throw new Error('Save reload journey could not locate the Shop Build tab');
    await touch(session, buildTab.x, buildTab.y);
    await waitFor(
        () => evaluate(session, `window.mythicalGame.scene.getScene('ShopScene')?.selectedCategory === 'base'`),
        { message: 'Save reload Shop Build tab' }
    );
    const buildAction = await evaluate(session, `(() => {
        const shop = window.mythicalGame.scene.getScene('ShopScene');
        const bounds = shop?.itemButtons?.find(entry => entry.item?.id === 'village_heart')?.zone?.getBounds?.();
        return bounds ? { x: Math.round(bounds.centerX), y: Math.round(bounds.centerY) } : null;
    })()`);
    if (!buildAction) throw new Error('Save reload journey could not locate Base Builder');
    await touch(session, buildAction.x, buildAction.y);
    await waitFor(
        () => evaluate(session, `Boolean(document.querySelector('.village-command-modal.is-visible'))`),
        { message: 'Save reload Base Builder' }
    );
    const constructed = await evaluate(session, `(() => {
        const action = document.querySelector('.village-construct-action:not(:disabled)');
        if (!action) return false;
        action.click();
        return true;
    })()`);
    if (!constructed) throw new Error('Save reload journey could not construct a building');
    await waitFor(
        () => evaluate(session, `Boolean(
            window.GameState.get('world.village.buildings')?.some(
                building => building.definitionId === 'forager_hut'
            )
        )`),
        { message: 'Save reload construction persistence before reload' }
    );

    await session.call('Page.reload', { ignoreCache: true });
    await waitFor(
        () => evaluate(session, 'document.readyState === "complete"'),
        { timeoutMs: 20000, message: 'Save reload page load' }
    );
    await waitFor(
        () => evaluate(session, 'Boolean(window.mythicalGame?.scene)'),
        { timeoutMs: 20000, message: 'Save reload Phaser boot' }
    );
    await waitForScene(session, 'GameScene', 30000);

    const restored = await evaluate(session, `(() => {
        const state = window.GameState;
        const portrait = state.getCreaturePortrait('baby');
        const persisted = JSON.parse(localStorage.getItem(state.saveKey) || '{}');
        return {
            gameSceneActive: window.mythicalGame.scene.isActive('GameScene'),
            companion: {
                id: state.get('creature.id'),
                name: state.get('creature.name'),
                hatched: state.get('creature.hatched'),
                collectionCount: state.get('creatures')?.length || 0
            },
            construction: state.get('world.village.buildings')?.map(building => ({
                definitionId: building.definitionId,
                plotId: building.plotId,
                status: building.status
            })) || [],
            portrait: {
                identityKey: portrait?.identityKey || null,
                assetRef: portrait?.assetRef || null,
                storage: portrait?.storage || null
            },
            localSave: {
                companion: persisted.creature?.name || null,
                constructionCount: persisted.world?.village?.buildings?.length || 0,
                portraitRef: persisted.creature?.portraits?.byStage?.baby?.assetRef || null
            }
        };
    })()`);
    if (
        !restored.gameSceneActive ||
        restored.companion.id !== 'smoke_reload_nova' ||
        restored.companion.name !== 'Nova' ||
        !restored.companion.hatched ||
        restored.companion.collectionCount !== 1 ||
        !restored.construction.some(building => building.definitionId === 'forager_hut') ||
        restored.portrait.identityKey !== 'SMOKE-RELOAD-23:baby:reload-proof' ||
        restored.portrait.assetRef !== 'portrait-job-v1:11111111-2222-4333-8444-555555555555' ||
        restored.portrait.storage !== 'supabase-private' ||
        restored.localSave.companion !== 'Nova' ||
        restored.localSave.constructionCount < 1 ||
        restored.localSave.portraitRef !== 'portrait-job-v1:11111111-2222-4333-8444-555555555555' ||
        exceptions.length
    ) {
        throw new Error(`Save reload journey did not restore player state: ${JSON.stringify({ restored, exceptions })}`);
    }
    return restored;
}

async function smokeVillageUi(session, exceptions) {
    exceptions.length = 0;
    // Exercise the player-facing route first. Construction is intentionally
    // housed in the Shop Build tab; the Sanctuary landmark is only a shortcut.
    await navigate(session, `${BASE_URL}/play/?reset=true`);
    await waitForScene(session, 'HatchingScene');
    const publicEntry = await evaluate(session, `(() => {
        const game = window.mythicalGame;
        const state = window.GameState;
        const creature = {
            ...(state.get('creature') || {}),
            id: 'smoke_village_nova',
            name: 'Nova',
            hatched: true,
            named: true,
            genes: {
                id: 'smoke_village_genes_23',
                personality: { primary: 'curious' },
                cosmicAffinity: { element: 'nebula' }
            },
            stats: { happiness: 92, energy: 90 }
        };
        state.set('creature', creature);
        state.set('creatures', [creature]);
        state.set('activeCreatureIndex', 0);
        state.save();
        game.scene.stop('HatchingScene');
        game.scene.start('GameScene', { biome: 'nebula', forceMobileControls: true });
        return true;
    })()`);
    if (!publicEntry) throw new Error('Base Builder production entry could not seed a companion');
    // GameScene generates creature animation frames and builds the Sanctuary
    // before it becomes active. Preserve enough Phaser state to distinguish a
    // slow boot from a lifecycle exception if this release gate ever regresses.
    try {
        await waitForScene(session, 'GameScene', 45000);
    } catch (error) {
        const diagnostics = await evaluate(session, `(() => {
            const game = window.mythicalGame;
            const manager = game?.scene;
            const scene = manager?.getScene?.('GameScene');
            return {
                readyState: document.readyState,
                gamePresent: Boolean(game),
                activeScenes: manager?.getScenes?.(true)?.map(item => item.scene?.key) || [],
                gameSceneStatus: scene?.sys?.settings?.status ?? null,
                gameSceneActive: Boolean(manager?.isActive?.('GameScene')),
                playerPresent: Boolean(scene?.player),
                playerActive: Boolean(scene?.player?.active),
                playerBodyEnabled: Boolean(scene?.player?.body?.enable),
                exceptions: ${JSON.stringify(exceptions)}
            };
        })()`);
        throw new Error(
            `${error.message}; GameScene diagnostics: ${JSON.stringify(diagnostics)}`
        );
    }
    const shopResult = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('GameScene');
        scene.openShop();
        return true;
    })()`);
    if (!shopResult) {
        throw new Error('Shop Build entry could not open the Base Builder route');
    }
    await waitForScene(session, 'ShopScene');
    const buildTab = await evaluate(session, `(() => {
        const shop = window.mythicalGame.scene.getScene('ShopScene');
        const tab = shop?.categoryButtons?.find(entry => entry.id === 'base');
        const bounds = tab?.zone?.getBounds?.();
        if (!bounds) return null;
        return { x: Math.round(bounds.centerX), y: Math.round(bounds.centerY) };
    })()`);
    if (!buildTab) throw new Error('Shop Build tab was not available to touch');
    await touch(session, buildTab.x, buildTab.y);
    await waitFor(
        () => evaluate(session, `window.mythicalGame.scene.getScene('ShopScene')?.selectedCategory === 'base'`),
        { message: 'Shop Build tab selection' }
    );
    const buildAction = await evaluate(session, `(() => {
        const shop = window.mythicalGame.scene.getScene('ShopScene');
        const entry = shop?.itemButtons?.find(item => item.item?.id === 'village_heart');
        const bounds = entry?.zone?.getBounds?.();
        if (!bounds) return null;
        return {
            x: Math.round(bounds.centerX),
            y: Math.round(bounds.centerY),
            item: entry.item?.name
        };
    })()`);
    if (!buildAction) throw new Error('Shop Base Builder action was not available to touch');
    await touch(session, buildAction.x, buildAction.y);
    const baseResult = await evaluate(session, `(() => {
        const shop = window.mythicalGame.scene.getScene('ShopScene');
        return {
            category: shop?.selectedCategory,
            item: ${JSON.stringify('Base Builder')},
            opened: Boolean(document.querySelector('.village-command-modal.is-visible'))
        };
    })()`);
    if (
        baseResult.category !== 'base' ||
        baseResult.item !== 'Base Builder' ||
        baseResult.opened !== true
    ) {
        throw new Error(`Base Builder Shop Build entry failed: ${JSON.stringify(baseResult)}`);
    }
    await waitFor(
        () => evaluate(session, `Boolean(document.querySelector('.village-command-modal.is-visible'))`),
        { timeoutMs: 12000, message: 'Base Builder opened from Shop Build tab' }
    );
    await captureGameplayStill(session, 'village-base-builder.png');
    const construction = await evaluate(session, `(() => {
        const action = document.querySelector('.village-construct-action:not(:disabled)');
        if (!action) return { clicked: false, text: null };
        const text = action.textContent;
        action.click();
        return { clicked: true, text };
    })()`);
    if (!construction.clicked || !/BUILD FORAGE HERE/.test(construction.text || '')) {
        throw new Error(`Base Builder construction action unavailable: ${JSON.stringify(construction)}`);
    }
    await waitFor(
        () => evaluate(session, `Boolean(
            window.GameState.get('world.village.buildings')?.some(
                building => building.definitionId === 'forager_hut'
            )
        )`),
        { timeoutMs: 8000, message: 'Base Builder construction persisted' }
    );
    await captureGameplayStill(session, 'village-first-construction.png');
    const closeResult = await evaluate(session, `(() => {
        document.querySelector('.village-command-close')?.click();
        const shop = window.mythicalGame.scene.getScene('ShopScene');
        return {
            builderClosed: !document.querySelector('.village-command-modal'),
            shopActive: window.mythicalGame.scene.isActive('ShopScene'),
            category: shop?.selectedCategory
        };
    })()`);
    if (
        !closeResult.builderClosed ||
        !closeResult.shopActive ||
        closeResult.category !== 'base'
    ) {
        throw new Error(`Base Builder did not return to Shop Build tab: ${JSON.stringify(closeResult)}`);
    }

    if (SMOKE_SKIP_PREVIEW) {
        if (exceptions.length) {
            throw new Error(`Base Builder route raised browser exceptions: ${exceptions.join(' | ')}`);
        }
        return { shopEntry: baseResult, construction, closeResult };
    }

    await evaluate(session, `(() => {
        const game = window.mythicalGame;
        game.scene.getScenes(true).forEach(active => {
            game.scene.stop(active.scene.key);
        });
        game.scene.start('GameScene', {
            villageCommandPreview: 'active',
            forceMobileControls: true
        });
        return true;
    })()`);
    await waitForScene(session, 'GameScene', 45000);
    await waitFor(
        () => evaluate(session, `Boolean(document.querySelector('.village-command-modal.is-visible'))`),
        { timeoutMs: 45000, message: 'Village Heart command panel' }
    );
    await waitFor(
        () => evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('GameScene');
            const landmark = scene?.villageHeartLandmark;
            return landmark?.plotHitZones?.length === 5 &&
                landmark?.buildingElements?.filter(
                    element => element?.type === 'Container'
                ).length === 5;
        })()`),
        { timeoutMs: 12000, message: 'Village Heart interactive world district' }
    );

    const layout = await evaluate(session, `(() => {
        const modal = document.querySelector('.village-command-modal');
        const shell = document.querySelector('.village-command-shell');
        const close = document.querySelector('.village-command-close');
        const body = document.querySelector('.village-command-body');
        const resources = document.querySelector('.village-resource-ledger');
        const artworks = [...document.querySelectorAll('.village-building-artwork:not(.is-compact)')];
        const milestones = [...document.querySelectorAll('.village-milestone')];
        const scene = window.mythicalGame.scene.getScene('GameScene');
        const landmark = scene.villageHeartLandmark;
        const worldStructures = (landmark?.buildingElements || [])
            .filter(element => element?.type === 'Container');
        const plotHitZones = (landmark?.plotHitZones || []).map(zone => {
            const rect = zone.getBounds();
            return {
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom,
                inputEnabled: zone.input?.enabled === true,
                cursor: zone.input?.cursor || ''
            };
        });
        const bounds = element => {
            const rect = element.getBoundingClientRect();
            return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        };
        return {
            innerWidth,
            innerHeight,
            bodyScrollWidth: document.body.scrollWidth,
            acceptsInput: modal.classList.contains('accepts-input'),
            resourceColumns: getComputedStyle(resources).gridTemplateColumns
                .split(' ')
                .filter(Boolean)
                .length,
            modal: bounds(modal),
            shell: bounds(shell),
            close: bounds(close),
            artworks: artworks.map(artwork => ({
                building: artwork.dataset.building,
                backgroundImage: getComputedStyle(
                    artwork.querySelector('.village-building-artwork-image')
                ).backgroundImage,
                motion: getComputedStyle(
                    artwork.querySelector('.village-building-artwork-current')
                ).animationName
            })),
            phase: {
                title: document.querySelector('.village-phase-title')?.textContent || '',
                milestoneCount: milestones.length,
                completedMilestones: milestones.filter(item => item.classList.contains('is-complete')).length
            },
            worldPresentation: {
                structureCount: worldStructures.length,
                plotHitZones,
                districtTerrainActive: landmark?.districtTerrain?.active === true,
                currentPathsActive: landmark?.currentPaths?.active === true,
                actionLabel: landmark?.actionLabel?.text || '',
                statusLabel: landmark?.statusLabel?.text || '',
                animatedElements: landmark?.buildingTweens?.length || 0
            },
            commandBody: {
                clientWidth: body.clientWidth,
                scrollWidth: body.scrollWidth,
                clientHeight: body.clientHeight,
                scrollHeight: body.scrollHeight
            }
        };
    })()`);
    const withinViewport = rect =>
        rect.left >= -1 && rect.right <= layout.innerWidth + 1 &&
        rect.top >= -1 && rect.bottom <= layout.innerHeight + 1;
    if (
        layout.innerWidth !== 390 ||
        layout.innerHeight !== 844 ||
        layout.bodyScrollWidth > layout.innerWidth ||
        layout.commandBody.scrollWidth > layout.commandBody.clientWidth + 1 ||
        layout.artworks.length !== 5 ||
        layout.artworks.some(artwork => (
            !artwork.backgroundImage.includes('/game/village/') || artwork.motion === 'none'
        )) ||
        new Set(layout.artworks.map(artwork => artwork.backgroundImage)).size !== 5 ||
        layout.phase.milestoneCount !== 4 ||
        !layout.phase.title ||
        layout.worldPresentation.structureCount !== 5 ||
        layout.worldPresentation.plotHitZones.length !== 5 ||
        layout.worldPresentation.plotHitZones.some(bounds => (
            bounds.left < -1 ||
            bounds.right > layout.innerWidth + 1 ||
            bounds.top < -1 ||
            bounds.bottom > layout.innerHeight + 1 ||
            !bounds.inputEnabled
        )) ||
        !layout.worldPresentation.districtTerrainActive ||
        !layout.worldPresentation.currentPathsActive ||
        layout.worldPresentation.actionLabel !== 'OPEN VILLAGE PLAN' ||
        !layout.worldPresentation.statusLabel.includes('RESTORED') ||
        layout.worldPresentation.animatedElements < 8 ||
        !layout.acceptsInput ||
        layout.resourceColumns !== 2 ||
        !withinViewport(layout.shell) ||
        !withinViewport(layout.close) ||
        layout.close.right - layout.close.left < 44 ||
        layout.close.bottom - layout.close.top < 44
    ) {
        throw new Error(`Village mobile layout overflowed: ${JSON.stringify(layout)}`);
    }

    const placed = await evaluate(session, `(() => {
        const habitat = [...document.querySelectorAll('.village-building-card')]
            .find(button => button.textContent.includes('SHARED HABITAT'));
        if (!habitat || habitat.disabled) return false;
        habitat.click();
        const plot = [...document.querySelectorAll('.village-plot')]
            .find(button => button.textContent.includes('SHELTER GROVE'));
        if (!plot || plot.disabled) return false;
        plot.click();
        return true;
    })()`);
    if (!placed) throw new Error('Village habitat foundation was not actionable');
    await waitFor(
        () => evaluate(
            session,
            `document.querySelector('.village-command-status')?.textContent.includes('Construction started')`
        ),
        { message: 'Village construction confirmation' }
    );

    const interaction = await evaluate(session, `(() => {
        const body = document.querySelector('.village-command-body');
        body.scrollTop = body.scrollHeight;
        const invites = [...document.querySelectorAll('.village-invite-button')];
        const lastInvite = invites[invites.length - 1];
        const close = document.querySelector('.village-command-close');
        const rect = lastInvite?.getBoundingClientRect();
        const selectRect = lastInvite?.previousElementSibling?.getBoundingClientRect();
        return {
            status: document.querySelector('.village-command-status')?.textContent,
            habitatPresent: [...document.querySelectorAll('.village-plot')]
                .some(plot => plot.textContent.includes('HABITAT')),
            inviteVisible: Boolean(rect && rect.left >= 0 && rect.right <= innerWidth),
            inviteHeight: rect?.height || 0,
            selectHeight: selectRect?.height || 0,
            closeVisible: Boolean(close && close.getBoundingClientRect().right <= innerWidth)
        };
    })()`);
    if (
        !interaction.habitatPresent ||
        !interaction.inviteVisible ||
        interaction.inviteHeight < 44 ||
        interaction.selectHeight < 44 ||
        !interaction.closeVisible ||
        exceptions.length
    ) {
        throw new Error(
            `Village mobile interaction failed: ${JSON.stringify({ interaction, exceptions })}`
        );
    }

    await evaluate(session, `document.querySelector('.village-command-close')?.click()`);
    await waitFor(
        () => evaluate(session, `!document.querySelector('.village-command-modal')`),
        { message: 'Village world district after closing builder' }
    );
    await captureGameplayStill(session, 'village-sanctuary-district.png');
    const directWorldTap = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('GameScene');
        const openSite = scene?.villageHeartLandmark?.plotHitZones?.[4];
        if (!openSite?.input?.enabled) return false;
        openSite.emit('pointerdown');
        return true;
    })()`);
    if (!directWorldTap) {
        throw new Error('Village world build site was not directly tappable');
    }
    await waitFor(
        () => evaluate(session, `Boolean(document.querySelector('.village-command-modal.accepts-input'))`),
        { message: 'Village Builder reopened from world build site' }
    );

    return { layout, directWorldTap, interaction };
}

async function smokeForestArrival(session, exceptions) {
    exceptions.length = 0;
    await navigate(session, `${BASE_URL}/play/?reset=true`);
    await waitForScene(session, 'HatchingScene');
    await evaluate(session, `(async () => {
        const game = window.mythicalGame;
        window.GameState.set('creature.name', 'Nova');
        window.GameState.set('creature.hatched', true);
        window.GameState.set('creature.named', true);
        // Simulate a save that only saw the retired black-screen sequence.
        // The versioned field brief must still run exactly once after release.
        window.GameState.set('story.projectBeacon.firstForestCinematicSeen', true);
        window.GameState.set('story.projectBeacon.firstForestCinematicVersion', 0);
        game.scene.getScenes(true).forEach(active => game.scene.stop(active.scene.key));
        await window.SceneLoader.loadScene(game, 'MythicalForestLevel');
        game.scene.start('MythicalForestLevel');
        return true;
    })()`);
    await waitForScene(session, 'MythicalForestLevel');
    await waitFor(
        () => evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
            return Boolean(scene?.forestArrivalElements?.length);
        })()`),
        { message: 'permanent Forest field brief' }
    );

    const brief = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
        return {
            active: window.mythicalGame.scene.isActive('MythicalForestLevel'),
            fieldBriefVisible: scene.children.list.some(item => (
                item.text === 'PROJECT BEACON // FIELD BRIEF'
            )),
            permanentBackdropPresent: scene.forestArrivalElements.some(item => (
                item.texture?.key === 'mythicalForestArrival' || item.type === 'Video'
            )),
            physicsPaused: scene.physics.world.isPaused
        };
    })()`);
    if (
        !brief.active ||
        !brief.fieldBriefVisible ||
        !brief.permanentBackdropPresent ||
        !brief.physicsPaused
    ) {
        throw new Error(`Forest field brief did not render: ${JSON.stringify(brief)}`);
    }

    await touch(session, 195, 620);
    await waitFor(
        () => evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
            return Boolean(scene?.levelEntryElements?.length) &&
                scene.forestArrivalElements.every(item => item.depth < 3000);
        })()`),
        { message: 'Forest mission panel above field brief' }
    );
    await pressEnter(session);
    await waitFor(
        () => evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
            return Boolean(scene?.player?.active) && !scene.physics.world.isPaused;
        })()`),
        { timeoutMs: 15000, message: 'Forest gameplay after field brief' }
    );

    const progression = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
        return {
            playerActive: scene.player.active,
            physicsPaused: scene.physics.world.isPaused,
            backdropCleared: scene.forestArrivalElements.length === 0,
            levelContentCreated: scene._levelContentCreated === true
        };
    })()`);
    if (
        !progression.playerActive ||
        progression.physicsPaused ||
        !progression.backdropCleared ||
        !progression.levelContentCreated ||
        exceptions.length
    ) {
        throw new Error(
            `Forest entry could not reach gameplay: ${JSON.stringify({ progression, exceptions })}`
        );
    }
    return { brief, progression };
}

const GUARDIAN_PACING_CASES = Object.freeze([
    {
        sceneName: 'MythicalForestLevel',
        attack: 'root_slam',
        recoveryCheck: 'scene?.boss?.isRecovering === true',
        phaseDeferral: true,
        phaseThreshold: 0.5
    },
    {
        sceneName: 'CrystalCavesLevel',
        attack: 'ground_slam',
        recoveryCheck: 'scene?.boss?.isRecovering === true',
        phaseDeferral: true,
        phaseThreshold: 0.5
    },
    {
        sceneName: 'ReefLevel',
        attack: 'dimensionalTear',
        recoveryCheck: 'scene?.time?.now < scene?.bossRecoveryUntil',
        phaseDeferral: true,
        phaseThreshold: 0.6
    },
    {
        sceneName: 'VoidPeaksLevel',
        attack: 'gravityCrush',
        recoveryCheck: 'scene?.time?.now < scene?.titanRecoveryUntil'
    },
    {
        sceneName: 'AuroraDepthsLevel',
        attack: 'flame_dive',
        recoveryCheck: 'scene?.time?.now < scene?.bossRecoveryUntil'
    },
    {
        sceneName: 'FinalVoidLevel',
        attack: 'void_tendrils',
        recoveryCheck: 'scene?.time?.now < scene?.bossRecoveryUntil',
        triggerManually: true,
        phaseDeferral: true,
        phaseThreshold: 0.75
    }
]);

async function smokeGuardianPacing(session, exceptions) {
    const results = {};
    const knownCases = GUARDIAN_PACING_CASES.map(item => item.sceneName);
    if (SMOKE_CASE !== 'all' && !knownCases.includes(SMOKE_CASE)) {
        throw new Error(
            `Unknown guardian SMOKE_CASE ${JSON.stringify(SMOKE_CASE)}. ` +
            `Use one of: all, ${knownCases.join(', ')}.`
        );
    }

    for (const guardianCase of GUARDIAN_PACING_CASES.filter(
        item => SMOKE_CASE === 'all' || item.sceneName === SMOKE_CASE
    )) {
        exceptions.length = 0;
        const {
            sceneName,
            attack,
            recoveryCheck,
            triggerManually,
            phaseDeferral,
            phaseThreshold
        } = guardianCase;
        await navigate(session, `${BASE_URL}/play/?reset=true`);
        await waitForScene(session, 'HatchingScene');
        await evaluate(session, `(async () => {
            const game = window.mythicalGame;
            game.scene.getScenes(true).forEach(active => {
                game.scene.stop(active.scene.key);
            });
            await window.SceneLoader.loadScene(game, ${JSON.stringify(sceneName)});
            game.scene.start(${JSON.stringify(sceneName)}, {
                testMode: true,
                forceMobileControls: true,
                platformerPreviewSize: 'mobile',
                bossAttackPreview: ${JSON.stringify(attack)}
            });
            return true;
        })()`);
        await waitForScene(session, sceneName);
        await waitFor(
            () => evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                return Boolean(scene?.bossFightActive && scene?.boss?.active);
            })()`),
            { timeoutMs: 15000, message: `${sceneName} guardian spawn` }
        );

        let openingFraming = null;
        if (
            ['CrystalCavesLevel', 'ReefLevel', 'VoidPeaksLevel']
                .includes(sceneName)
        ) {
            openingFraming = await waitFor(
                () => evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                    const camera = scene?.cameras?.main;
                    const player = scene?.player;
                    const boss = ${JSON.stringify(sceneName)} === 'ReefLevel'
                        ? scene?.bossBody
                        : scene?.boss;
                    const view = camera?.worldView;
                    const orientationElapsed = scene?.time?.now -
                        scene?.bossCombatReadyAt;
                    if (
                        !scene?.bossCombatReady ||
                        !Number.isFinite(orientationElapsed) ||
                        orientationElapsed < 900 ||
                        scene?.physics?.world?.isPaused ||
                        scene?.platformerControlsVisible !== true ||
                        !camera || !view || !player?.active || !boss?.active
                    ) return null;
                    return {
                        bossCombatReady: true,
                        controlsVisible: true,
                        physicsPaused: false,
                        orientationElapsed: Math.round(orientationElapsed),
                        zoom: camera.zoom,
                        playerHealth: scene.health,
                        bossHealth: scene.bossHealth,
                        bossMaxHealth: scene.bossMaxHealth,
                        openingAttackPending:
                            Boolean(scene.bossAttackPreviewTimer),
                        contactDamageArmed:
                            ${JSON.stringify(sceneName)} === 'ReefLevel' &&
                                scene.bossContactDamageArmed === true,
                        playerVisible: view.contains(player.x, player.y),
                        bossVisible: view.contains(boss.x, boss.y),
                        playerScreenX: Math.round((player.x - view.x) * camera.zoom),
                        bossScreenX: Math.round((boss.x - view.x) * camera.zoom),
                        viewportWidth: camera.width
                    };
                })()`),
                {
                    timeoutMs: 15000,
                    message: `${sceneName} mobile guardian framing`
                }
            );
            if (
                openingFraming.zoom !== 1 ||
                !openingFraming.playerVisible ||
                !openingFraming.bossVisible ||
                openingFraming.bossHealth !== openingFraming.bossMaxHealth ||
                openingFraming.playerHealth !== 4 ||
                !openingFraming.openingAttackPending ||
                openingFraming.contactDamageArmed ||
                openingFraming.playerScreenX < 24 ||
                openingFraming.bossScreenX > openingFraming.viewportWidth - 24
            ) {
                throw new Error(
                    `${sceneName} guardian opened outside the playable view: ` +
                    JSON.stringify(openingFraming)
                );
            }
        }

        if (triggerManually) {
            await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                scene.executeBossAttack(${JSON.stringify(attack)});
                return true;
            })()`);
        }

        const attackState = await waitFor(
            () => evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                const attackActive = Boolean(
                    scene?.boss?.isAttacking ||
                    scene?.bossAttackLocked ||
                    scene?.titanAttackLocked
                );
                if (!attackActive) return null;
                return {
                    attackActive,
                    bossHealth: scene?.bossHealth,
                    displayCount: scene?.children?.list?.length || 0
                };
            })()`),
            { timeoutMs: 15000, message: `${sceneName} attack telegraph` }
        );

        let deferralState = null;
        if (phaseDeferral) {
            deferralState = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                scene.bossHealth = scene.bossMaxHealth * ${phaseThreshold} + 0.5;
                scene.damageBoss(1);
                scene.updateBoss?.(scene.time.now, 16);
                return {
                    phase: scene.bossPhase,
                    pending: Boolean(
                        scene.bossPhasePending || scene.pendingBossPhase
                    ),
                    attackActive: Boolean(
                        scene?.boss?.isAttacking ||
                        scene?.bossAttackLocked ||
                        scene?.titanAttackLocked
                    )
                };
            })()`);
            if (
                deferralState.phase !== 1 ||
                !deferralState.pending ||
                !deferralState.attackActive
            ) {
                throw new Error(
                    `${sceneName} did not defer its phase during danger: ` +
                    JSON.stringify(deferralState)
                );
            }
        }

        await waitFor(
            () => evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                return Boolean(${recoveryCheck});
            })()`),
            { timeoutMs: 9000, message: `${sceneName} recovery opening` }
        );

        const recoveryState = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            const before = scene.bossHealth;
            scene.damageBoss(1);
            return {
                before,
                after: scene.bossHealth,
                bonusDamage: before - scene.bossHealth,
                recoveryActive: Boolean(${recoveryCheck})
            };
        })()`);
        if (
            recoveryState.bonusDamage !== 2 ||
            !recoveryState.recoveryActive ||
            exceptions.length
        ) {
            throw new Error(
                `${sceneName} guardian pacing failed: ${JSON.stringify({
                    attackState,
                    recoveryState,
                    exceptions
                })}`
            );
        }

        let lungeContact = null;
        if (sceneName === 'ReefLevel') {
            const lungeStarted = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene('ReefLevel');
                if (!scene?.player?.active || !scene?.bossBody?.active) return null;
                scene.health = scene.maxHealth;
                scene.isInvincible = false;
                scene.damageTaken = Number(scene.damageTaken) || 0;
                scene.updateHealthDisplay?.();
                scene.bossContactDamageArmed = false;
                scene.bossContactDamageConsumed = false;
                scene.bossBody.setPosition(5700, scene.levelHeight - 500);
                scene.player.setPosition(5500, scene.levelHeight - 360);
                scene.player.setVelocity?.(0, 0);
                const damageBefore = scene.damageTaken;
                scene.__smokeReefLungeDamageBefore = damageBefore;
                scene.bossVoidLunge();
                return { damageBefore, healthBefore: scene.health };
            })()`);
            if (!lungeStarted) {
                throw new Error('Reef guardian lunge could not be staged');
            }
            lungeContact = await waitFor(
                () => evaluate(session, `(() => {
                    const scene = window.mythicalGame.scene.getScene('ReefLevel');
                    if (!scene?.bossContactDamageConsumed) return null;
                    return {
                        health: scene.health,
                        maxHealth: scene.maxHealth,
                        damageDelta: scene.damageTaken -
                            scene.__smokeReefLungeDamageBefore,
                        contactDamageArmed:
                            scene.bossContactDamageArmed === true,
                        contactDamageConsumed:
                            scene.bossContactDamageConsumed === true
                    };
                })()`),
                { timeoutMs: 5000, message: 'Reef single-hit lunge contact' }
            );
            if (
                lungeContact.health !== lungeContact.maxHealth - 1 ||
                lungeContact.damageDelta !== 1 ||
                lungeContact.contactDamageArmed ||
                !lungeContact.contactDamageConsumed
            ) {
                throw new Error(
                    `Reef lunge applied repeated contact damage: ${JSON.stringify(lungeContact)}`
                );
            }
        }

        results[sceneName] = {
            openingFraming,
            attack,
            attackState,
            deferralState,
            recoveryState,
            lungeContact
        };
        process.stdout.write(`PASS ${sceneName}GuardianPacing\n`);
    }

    return results;
}

async function main() {
    if (!fs.existsSync(CHROME_PATH)) {
        throw new Error(`Chrome was not found at ${CHROME_PATH}`);
    }
    const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-void-cdp-'));
    const chrome = spawn(CHROME_PATH, [
        '--headless=new',
        '--enable-webgl',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--no-sandbox',
        '--hide-scrollbars',
        '--no-first-run',
        '--disable-background-networking',
        `--remote-debugging-port=${DEBUG_PORT}`,
        `--user-data-dir=${profileDir}`,
        `--window-size=${SMOKE_VIEWPORT_WIDTH},${SMOKE_VIEWPORT_HEIGHT}`,
        'about:blank'
    ], { stdio: ['ignore', 'ignore', 'ignore'] });

    let session = null;
    try {
        const target = await waitFor(async () => {
            const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
            const targets = await response.json();
            return targets.find(item => item.type === 'page') || null;
        }, { timeoutMs: 10000, message: 'Chrome DevTools target' });

        session = new CdpSession(target.webSocketDebuggerUrl);
        await session.connect();
        await session.call('Page.enable');
        await session.call('Runtime.enable');
        await session.call('Log.enable');
        await session.call('Page.bringToFront');
        await session.call('Emulation.setFocusEmulationEnabled', {
            enabled: true
        });
        await session.call('Emulation.setDeviceMetricsOverride', {
            width: SMOKE_VIEWPORT_WIDTH,
            height: SMOKE_VIEWPORT_HEIGHT,
            deviceScaleFactor: 1,
            mobile: SMOKE_VIEWPORT_WIDTH <= 600,
            screenWidth: SMOKE_VIEWPORT_WIDTH,
            screenHeight: SMOKE_VIEWPORT_HEIGHT
        });
        await session.call('Emulation.setTouchEmulationEnabled', {
            enabled: true,
            maxTouchPoints: 1
        });

        const exceptions = [];
        session.on('Runtime.exceptionThrown', params => {
            exceptions.push(
                params.exceptionDetails?.exception?.description ||
                params.exceptionDetails?.text ||
                'uncaught browser exception'
            );
        });
        if (SMOKE_BROWSER_TRACE) {
            session.on('Runtime.consoleAPICalled', params => {
                const values = (params.args || []).map(arg => arg.value ?? arg.description);
                trace('browser-console', values);
            });
            session.on('Log.entryAdded', params => {
                trace('browser-log', {
                    level: params.entry?.level,
                    text: params.entry?.text
                });
            });
        }

        const levels = [
            ['mythicalForest', 'MythicalForestLevel'],
            ['crystalCaves', 'CrystalCavesLevel'],
            ['reef', 'ReefLevel'],
            ['voidPeaks', 'VoidPeaksLevel'],
            ['auroraDepths', 'AuroraDepthsLevel'],
            ['finalVoid', 'FinalVoidLevel']
        ];
        const results = {};
        if (SMOKE_MODE === 'home-entry') {
            results.homeEntry = await smokeHomeStart(session, exceptions);
            process.stdout.write('PASS HomeStartToEgg\n');
        } else if (SMOKE_MODE === 'first-sanctuary') {
            results.firstSanctuary = await smokeFirstSanctuaryOnboarding(
                session,
                exceptions
            );
            process.stdout.write('PASS FirstSanctuaryOnboarding\n');
        } else if (SMOKE_MODE === 'nasa-content') {
            results.nasaContent = await smokeNASAContent(session, exceptions);
            process.stdout.write('PASS NASALearningContent\n');
        } else if (SMOKE_MODE === 'interaction') {
            const knownCases = [
                'all',
                'egg',
                'finalVoidWithCreature',
                ...levels.map(([route]) => route)
            ];
            if (!knownCases.includes(SMOKE_CASE)) {
                throw new Error(
                    `Unknown SMOKE_CASE ${JSON.stringify(SMOKE_CASE)}. ` +
                    `Use one of: ${knownCases.join(', ')}.`
                );
            }
            if (['all', 'egg', 'finalVoidWithCreature'].includes(SMOKE_CASE)) {
                results.purchasedEgg = await smokePurchasedEgg(session, exceptions);
                process.stdout.write('PASS PurchasedEggHatch\n');
            }
            for (const [route, sceneName] of levels.filter(
                ([route]) =>
                    SMOKE_CASE === 'all' ||
                    SMOKE_CASE === route ||
                    (
                        SMOKE_CASE === 'finalVoidWithCreature' &&
                        route === 'finalVoid'
                    )
            )) {
                results[route] = await smokeLevel(
                    session,
                    route,
                    sceneName,
                    exceptions
                );
                process.stdout.write(`PASS ${sceneName}\n`);
            }
        } else if (SMOKE_MODE === 'traversal-topology') {
            results.traversalTopology = await smokeTraversalTopology(
                session,
                levels,
                exceptions
            );
        } else if (SMOKE_MODE === 'aurora-route-journey') {
            results.auroraRouteJourney = await smokeAuroraRouteJourney(
                session,
                exceptions
            );
            process.stdout.write('PASS AuroraRouteJourney\n');
        } else if (SMOKE_MODE === 'guardian-handoff') {
            results.guardianHandoffs = await smokeGuardianHandoffs(
                session,
                exceptions
            );
        } else if (SMOKE_MODE === 'state-contract') {
            results.campaignStateContract = await smokeCampaignStateContract(
                session,
                exceptions
            );
            process.stdout.write('PASS CampaignStateContract\n');
        } else if (SMOKE_MODE === 'final-priority-journey') {
            results.finalPriorityJourney = await smokeFinalPriorityJourney(
                session,
                exceptions
            );
            process.stdout.write('PASS FinalPriorityJourney\n');
        } else if (SMOKE_MODE === 'save-reload-journey') {
            results.saveReloadJourney = await smokeSaveReloadJourney(
                session,
                exceptions
            );
            process.stdout.write('PASS SaveReloadJourney\n');
        } else if (SMOKE_MODE === 'navigation-lifecycle') {
            results.navigationLifecycle = await smokeSanctuaryNavigation(
                session,
                exceptions
            );
            process.stdout.write('PASS SanctuaryNavigationLifecycle\n');
        } else if (SMOKE_MODE === 'hub-forest-transition') {
            results.hubForestTransition = await smokeHubForestTransition(
                session,
                exceptions
            );
            process.stdout.write('PASS HubForestTransition\n');
        } else if (SMOKE_MODE === 'village-ui') {
            results.villageUi = await smokeVillageUi(session, exceptions);
            process.stdout.write('PASS VillageMobileUi\n');
        } else if (SMOKE_MODE === 'forest-arrival') {
            results.forestArrival = await smokeForestArrival(session, exceptions);
            process.stdout.write('PASS MythicalForestArrival\n');
        } else if (SMOKE_MODE === 'guardian-pacing') {
            results.guardianPacing = await smokeGuardianPacing(
                session,
                exceptions
            );
        } else {
            throw new Error(
                `Unknown SMOKE_MODE ${JSON.stringify(SMOKE_MODE)}. ` +
                'Use home-entry, first-sanctuary, nasa-content, interaction, traversal-topology, aurora-route-journey, guardian-handoff, state-contract, final-priority-journey, save-reload-journey, navigation-lifecycle, hub-forest-transition, village-ui, forest-arrival, or guardian-pacing.'
            );
        }
        console.log(JSON.stringify({
            success: true,
            suite: SMOKE_MODE,
            case: SMOKE_CASE,
            results
        }, null, 2));
        process.stdout.write(
            `[smoke-result] ${SMOKE_MODE}:${SMOKE_CASE}:pass\n`
        );
    } finally {
        if (activeVideoCapture) {
            await stopGameplayVideo().catch(error => {
                console.error(`[gameplay-video] cleanup failed: ${error.message}`);
            });
        }
        session?.close();
        chrome.kill('SIGKILL');
        chrome.unref();
        await delay(350);
        try {
            fs.rmSync(profileDir, { recursive: true, force: true });
        } catch (error) {
            // Chrome may still release a transient lock after the test result.
        }
    }
}

main().catch(error => {
    console.error(error.stack || error.message);
    process.exit(1);
});
