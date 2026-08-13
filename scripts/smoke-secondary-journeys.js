#!/usr/bin/env node

const { spawn } = require('child_process');
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
let activeTouchPoint = { x: 0, y: 0 };

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
    const result = await session.call('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true
    });
    if (result.exceptionDetails) {
        throw new Error(
            result.exceptionDetails.exception?.description ||
            result.exceptionDetails.text ||
            'Browser evaluation failed'
        );
    }
    return result.result?.value;
}

async function dispatchDomTouch(session, type, x, y) {
    return evaluate(session, `(() => {
        const canvas = window.mythicalGame?.canvas || document.querySelector('canvas');
        if (!canvas) throw new Error('Game canvas unavailable for touch event');
        const point = new Touch({
            identifier: 23,
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

async function navigate(session, url) {
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
    await session.call('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x,
        y,
        button: 'left',
        clickCount: 1
    });
    await session.call('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x,
        y,
        button: 'left',
        clickCount: 1
    });
}

async function touch(session, x, y) {
    await session.call('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x, y, radiusX: 2, radiusY: 2, force: 1 }]
    });
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

async function holdTouchDrag(session, start, end, holdMs = 450) {
    const touchPoint = (x, y) => ({
        x,
        y,
        radiusX: 4,
        radiusY: 4,
        force: 1,
        id: 1
    });

    trace('touchStart', { start, end, protocol: SMOKE_TOUCH_PROTOCOL });
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
        await dispatchDomTouch(session, 'touchstart', start.x, start.y);
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
            await dispatchDomTouch(session, 'touchmove', x, y);
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
            activeTouchPoint.y
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
            start: { x: 2200, y: 740 },
            destinationId: 'peak-warning-lower'
        },
        {
            id: 'peak-return-summit',
            start: { x: 3120, y: 740 },
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
                    { timeoutMs: 2200, message: `${route.id} activation` }
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
            results.push({ id: route.id, activated, landed });
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
        const landed = await waitFor(
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
            { timeoutMs: 3400, message: 'Crystal Core refuge landing' }
        );
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
        const landed = await waitFor(
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
                    return scene.player.body.center.x >= support.body.left + 28
                        ? {
                            playerX: Math.round(scene.player.x),
                            targetLeft: Math.round(support.body.left)
                        }
                        : null;
                })()`),
                { timeoutMs: 1900, message: `${supportId} approach` }
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

async function smokeLevel(session, route, sceneName, exceptions) {
    exceptions.length = 0;
    trace('navigate', { route, sceneName });
    await navigate(session, `${BASE_URL}/play/?reset=true`);
    await waitForScene(session, 'HatchingScene');
    trace('startCampaignScene', { sceneName });
    await startCampaignScene(session, { route, sceneName });
    await delay(400);

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
            mobileControls: Boolean(
                scene?.mobileControls ||
                scene?.platformerMobileControls ||
                scene?.mobileControlElements?.length
            ),
            interactiveCount: scene?.input?._list?.length || 0,
            displayCount: scene?.children?.list?.length || 0,
            enemyCount: scene?.enemies?.getChildren?.()
                ?.filter(enemy => enemy?.active !== false).length || 0,
            combatCueCount: scene?.enemies?.getChildren?.()
                ?.filter(enemy => enemy?.active !== false && enemy?.combatCue?.active).length || 0,
            ambientRendering: scene?.forestAmbientLayers ? {
                layerCount: scene.forestAmbientLayers.filter(
                    layer => layer?.active !== false
                ).length,
                pointCount: Number(scene.forestAmbientPointCount) || 0
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
    if (!state.canvasWidth || !state.canvasHeight) {
        throw new Error(`${sceneName} rendered a blank-sized canvas`);
    }
    if (
        route === 'mythicalForest' &&
        (
            state.displayCount > 475 ||
            state.ambientRendering?.layerCount !== 9 ||
            state.ambientRendering?.pointCount !== 194
        )
    ) {
        throw new Error(
            `${sceneName} exceeded its mobile ambient render budget: ${JSON.stringify(state)}`
        );
    }
    let renderStability = null;
    if (route === 'mythicalForest') {
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
            renderStability.endCount > 475 ||
            renderStability.trailLayerCount !== 1
        ) {
            throw new Error(
                `${sceneName} leaked render objects while idle: ` +
                JSON.stringify(renderStability)
            );
        }
    }
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
                return supported && Number.isFinite(velocityY) && velocityY >= -1;
            })()`),
            { timeoutMs: 5000, message: `${sceneName} grounded before jump` }
        );
    }
    const beforeJump = await evaluate(session, `(() => {
        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
        return {
            playerY: scene?.player?.y,
            velocityY: scene?.player?.body?.velocity?.y
        };
    })()`);
    // A genuine tap can begin and end between two low-FPS Phaser updates.
    // The game must preserve that edge until gameplay consumes it.
    await touch(session, jumpControl.x, jumpControl.y);
    const jumped = await waitFor(
        async () => {
            const response = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                return {
                    playerY: scene?.player?.y,
                    velocityY: scene?.player?.body?.velocity?.y,
                    virtualJumpPressed: scene?.virtualJumpPressed,
                    virtualJumpQueued: scene?.virtualJumpQueued,
                    isSwimmingUp: scene?.isSwimmingUp
                };
            })()`);
            const responded = route === 'reef'
                ? response.velocityY < beforeJump.velocityY - 5 ||
                    response.playerY < beforeJump.playerY - 2
                : response.velocityY < -20 ||
                    response.playerY < beforeJump.playerY - 2;
            return responded ? response : null;
        },
        { timeoutMs: 1500, message: `${sceneName} short jump tap response` }
    );
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
        await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            if (!scene || scene.__smokeMovementWrapped) return false;
            const original = scene.handleMovement;
            scene.__smokeMovementWrapped = true;
            scene.__smokeMovementTrace = { calls: 0, inputCalls: 0, lastBefore: null, lastAfter: null };
            scene.handleMovement = function (...args) {
                const traceState = this.__smokeMovementTrace;
                traceState.calls += 1;
                traceState.lastBefore = {
                    inputX: this.virtualJoystickX,
                    velocityX: this.player?.body?.velocity?.x,
                    playerX: this.player?.x,
                    playerSpeed: this.playerSpeed,
                    acceleration: this.playerAcceleration
                };
                if (Math.abs(this.virtualJoystickX || 0) > 0.2) traceState.inputCalls += 1;
                const result = original.apply(this, args);
                traceState.lastAfter = {
                    inputX: this.virtualJoystickX,
                    velocityX: this.player?.body?.velocity?.x,
                    playerX: this.player?.x
                };
                return result;
            };
            return true;
        })()`);
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
        { x: joystick.centerX + dragDistance, y: joystick.centerY }
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
            ,movementTrace: scene?.__smokeMovementTrace
        };
    })()`);
    await releaseTouch(session);
    await delay(150);
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

    await holdTouchDrag(
        session,
        { x: joystick.centerX, y: joystick.centerY },
        { x: joystick.centerX - dragDistance, y: joystick.centerY },
        700
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
                state.playerHealthAfter = Number(scene.health);
                state.playerVelocityAfter = Number(player?.body?.velocity?.y);
            }
            return result;
        };

        scene.isInvincible = false;
        scene.player.body.reset?.(targetX, playerY);
        scene.player.setPosition?.(targetX, playerY);
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
            !choicePresentation.optionalMarker.includes(choicePresentation.rewardLabel)
        ) {
            throw new Error(
                `${sceneName} route choice is not readable: ${JSON.stringify(choicePresentation)}`
            );
        }

        let rejectedOptionalPickup = null;
        if (route === 'mythicalForest') {
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

                scene.player.setPosition(
                    (choice.mainZone.left + choice.mainZone.right) / 2,
                    (choice.mainZone.top + choice.mainZone.bottom) / 2
                );
                scene.updateOptionalRouteChoices();
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
            if ([
                'auroraDepths',
                'voidPeaks'
            ].includes(${JSON.stringify(route)})) {
                const supportId = ${JSON.stringify(route)} === 'auroraDepths'
                    ? 'aurora-quiet-step-1'
                    : 'peak-relic-ridge-1';
                const support = scene.getTraversalSupport?.(supportId);
                if (!support?.body || !scene.player?.body) return false;
                scene.player.body.reset(
                    support.x,
                    support.body.top - scene.player.body.height - 18
                );
            } else {
                scene.player.setPosition(
                    (zone.left + zone.right) / 2,
                    (zone.top + zone.bottom) / 2
                );
            }
            scene.player.setVelocity?.(0, 0);
            return true;
        })()`);
        const optionalEntry = await waitFor(
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
            { timeoutMs: 2500, message: `${sceneName} optional route entry` }
        );

        await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            const routeState = scene?.optionalRouteRewards?.get?.(
                ${JSON.stringify(optionalRouteId)}
            );
            const zone = routeState?.choice?.rejoinZone;
            if (!scene?.player || !zone) return false;
            if ([
                'auroraDepths',
                'voidPeaks'
            ].includes(${JSON.stringify(route)})) {
                const supportId = ${JSON.stringify(route)} === 'auroraDepths'
                    ? 'aurora-sky-prism'
                    : 'peak-summit-relay';
                const support = scene.getTraversalSupport?.(supportId);
                if (!support?.body || !scene.player?.body) return false;
                scene.player.body.reset(
                    support.x,
                    support.body.top - scene.player.body.height - 18
                );
            } else {
                scene.player.setPosition(
                    (zone.left + zone.right) / 2,
                    (zone.top + zone.bottom) / 2
                );
            }
            scene.player.setVelocity?.(0, 0);
            return true;
        })()`);
        const rejoin = await waitFor(
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
            { timeoutMs: 2500, message: `${sceneName} optional route rejoin` }
        );
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
    let forestForwardHandoffs = null;
    if ([
        'mythicalForest',
        'crystalCaves',
        'reef',
        'voidPeaks',
        'auroraDepths',
        'finalVoid'
    ].includes(route)) {
        outOfOrderGuard = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            const signals = scene?.orderedRouteSignals || [];
            const firstSignal = signals[0];
            const lastSignal = signals[signals.length - 1];
            const activeProperty = scene?.orderedRouteSignalOptions?.activeProperty ||
                'activated';
            if (!scene?.player || !firstSignal || !lastSignal) return null;
            scene.isInvincible = true;
            scene.player.setPosition(lastSignal.x, lastSignal.y);
            scene.player.setVelocity?.(0, 0);
            return new Promise(resolve => {
                scene.time.delayedCall(220, () => resolve({
                    activatedCount: signals.filter(
                        signal => signal?.[activeProperty] === true
                    ).length,
                    lastSignalComplete: lastSignal?.[activeProperty] === true,
                    nextSignalIndex: scene?.getNextOrderedRouteSignal?.()?.index ?? null,
                    checkpointPresent: Boolean(scene?.checkpointPosition),
                    firstSignalIndex: firstSignal.index,
                    hintShown: Number(scene?.routeHintUntil) > Number(scene?.time?.now)
                }));
            });
        })()`);
        if (
            outOfOrderGuard?.activatedCount !== 0 ||
            outOfOrderGuard.lastSignalComplete !== false ||
            outOfOrderGuard.nextSignalIndex !== 0 ||
            outOfOrderGuard.checkpointPresent !== false ||
            outOfOrderGuard.firstSignalIndex !== 0 ||
            outOfOrderGuard.hintShown !== true
        ) {
            throw new Error(
                `${sceneName} accepted an out-of-order route signal: ${JSON.stringify(outOfOrderGuard)}`
            );
        }

        if (route === 'auroraDepths' || route === 'voidPeaks') {
            const airborneRejected = await evaluate(session, `(() => {
                const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                const signal = ${JSON.stringify(route)} === 'auroraDepths'
                    ? scene?.signalPrisms?.[0]
                    : scene?.beaconRelays?.[0];
                if (!scene?.player?.body || !signal?.zone?.active) return null;
                scene.routeHintUntil = 0;
                scene.player.body.reset(signal.x, signal.y - 35);
                scene.player.setVelocity?.(0, -120);
                return new Promise(resolve => {
                    scene.time.delayedCall(180, () => resolve({
                        completed: ${JSON.stringify(route)} === 'auroraDepths'
                            ? signal.aligned === true
                            : signal.activated === true,
                        checkpointPresent: Boolean(scene.checkpointPosition),
                        hintShown: Number(scene.routeHintUntil) > Number(scene.time.now)
                    }));
                });
            })()`);
            if (
                airborneRejected?.completed !== false ||
                airborneRejected.checkpointPresent !== false ||
                airborneRejected.hintShown !== true
            ) {
                throw new Error(
                    `${sceneName} accepted an airborne signal overlap: ${JSON.stringify(airborneRejected)}`
                );
            }
            if (route === 'auroraDepths') {
                auroraGroundedObjectives = { airborneRejected };
            } else {
                peaksGroundedObjectives = { airborneRejected };
            }
        }

        const staged = ['auroraDepths', 'voidPeaks'].includes(route)
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
            const stagedSignal = ['auroraDepths', 'voidPeaks'].includes(route)
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
                scene?.refreshGuardianGateState?.(true);
                const gate = scene?.guardianGateState;
                return gate ? {
                    status: gate.status,
                    ready: gate.ready,
                    label: gate.label?.text || ''
                } : null;
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
                scene?.tendWoundedCrystalGrove?.();
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
                        'voidPeaks'
                    ].includes(${JSON.stringify(route)})) {
                        const supportId = ${JSON.stringify(route)} === 'auroraDepths'
                            ? 'aurora-quiet-step-3'
                            : (Number(item.fragmentIndex) === 2
                                ? 'peak-relic-ridge-1'
                                : 'peak-relic-ridge-2');
                        const support = scene.getTraversalSupport?.(supportId);
                        if (!support?.body || !scene.player?.body) {
                            return { missing: true, supportMissing: true };
                        }
                        scene.player.body.reset(
                            item.x,
                            support.body.top - scene.player.body.height - 18
                        );
                    } else {
                        scene.player.setPosition(item.x, item.y);
                    }
                    scene.player.setVelocity?.(0, 0);
                    return { x: item.x, y: item.y };
                })()`);
                if (!stagedOptional || stagedOptional.missing) {
                    throw new Error(
                        `${sceneName} could not stage optional reward ${optionalIndex + 1}: ` +
                        JSON.stringify(stagedOptional)
                    );
                }
                await waitFor(
                    () => evaluate(session, `(() => {
                        const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
                        const reward = scene?.optionalRouteRewards?.get?.(
                            ${JSON.stringify(optionalRouteId)}
                        );
                        return reward?.progress >= ${optionalIndex + 1};
                    })()`),
                    {
                        timeoutMs: 2500,
                        message: `${sceneName} optional reward ${optionalIndex + 1}`
                    }
                );
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

        const guardianEntrySetup = await evaluate(session, `(() => {
            const scene = window.mythicalGame.scene.getScene(${JSON.stringify(sceneName)});
            const gate = scene?.guardianGateState;
            if (!scene?.player || !gate?.ready) return null;
            const persisted = window.GameState?.get?.(
                'story.projectBeacon.expeditionCheckpoint'
            );
            if ([
                'auroraDepths',
                'voidPeaks'
            ].includes(${JSON.stringify(route)})) {
                const supportId = ${JSON.stringify(route)} === 'auroraDepths'
                    ? 'aurora-phoenix-gate'
                    : 'peak-titan-gate';
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
                stagedSupportId: ${JSON.stringify(route)} === 'auroraDepths'
                    ? 'aurora-phoenix-gate'
                    : (${JSON.stringify(route)} === 'voidPeaks'
                        ? 'peak-titan-gate'
                        : null)
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
            { timeoutMs: 8000, message: `${sceneName} guardian combat start` }
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
    return {
        ...state,
        guardianGate,
        traversalAudit,
        jump: { before: beforeJump, during: jumped, released: jumpReleased },
        joystick: { movedRight, movedLeft, vertical: verticalJoystick },
        returnCurrents,
        reefAscentCurrent,
        finalRiftCrossing,
        auroraQuietLightClimb,
        forestForwardHandoffs,
        crystalCoreLift,
        auroraGroundedObjectives,
        peaksGroundedObjectives,
        renderStability,
        combatFeedback,
        liveStomp,
        routeChoice,
        outOfOrderGuard,
        routeHandoff,
        routeCompletion,
        optionalRouteCompletion,
        guardianRecovery
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
        const finalVoidFlowFailed = route === 'finalVoid' && (
            Number(audit?.flow?.requiredJumpCount) < 4 ||
            audit?.flow?.comfortPassed !== true
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
            (audit?.flow?.uncomfortableTargetIds || []).length > 0
        );
        const crystalCoreFlow = audit?.flow?.targets?.find(
            target => target.id === 'crystal_core'
        );
        const cavesFlowFailed = route === 'crystalCaves' && (
            audit?.flow?.comfortPassed !== true ||
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
        const reefFlowFailed = route === 'reef' && (
            audit?.flow?.comfortPassed !== true ||
            audit?.flow?.optionalComfortPassed !== true ||
            reefTrenchFlow?.reachable !== true ||
            reefTrenchFlow?.pathSupportIds?.at?.(-1) !== 'reef-trench-3' ||
            reefDriveFlow?.reachable !== true
        );
        if (
            !audit?.passed ||
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
                    exceptions,
                    supportGeometry
                })}`
            );
        }

        results[route] = audit;
        process.stdout.write(
            `PASS ${sceneName}Topology ` +
            `${audit.reachableSupportCount}/${audit.supportCount} ` +
            `deadEnds=${audit.flow?.strandingSupportCount || 0}\n`
        );
    }

    return results;
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
        const signal = ${JSON.stringify(route)} === 'auroraDepths'
            ? scene?.signalPrisms?.[${index}]
            : scene?.beaconRelays?.[${index}];
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
            const signal = ${JSON.stringify(route)} === 'auroraDepths'
                ? scene?.signalPrisms?.[${index}]
                : scene?.beaconRelays?.[${index}];
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
    const setup = await evaluate(session, `(() => {
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
                canvasHeight: scene.scale.height
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

    let recovery = null;
    if (SMOKE_CASE === 'wide-touch') {
        // The original home screen only ran one recovery check at 900 ms. Wait
        // for that Phaser timer itself to finish, then prove the ongoing health
        // check can repair a later failure like the production incident.
        await waitFor(
            () => evaluate(session, `(() => {
                const timer = window.mythicalGame?.scene
                    ?.getScene('HatchingScene')?.homeStartRecoveryTimer;
                return Boolean(timer?.hasDispatched || timer?.getProgress?.() >= 1);
            })()`),
            { timeoutMs: 5000, message: 'initial Start recovery window to close' }
        );
        await delay(300);
        await evaluate(session, `(() => {
            const scene = window.mythicalGame?.scene?.getScene('HatchingScene');
            scene.startButton
                .setPosition(-500, -500)
                .setAlpha(0)
                .disableInteractive();
            return true;
        })()`);
        recovery = await waitFor(
            () => evaluate(session, `(() => {
                const scene = window.mythicalGame?.scene?.getScene('HatchingScene');
                const button = scene?.startButton;
                if (!button?.active || !button.visible || button.alpha < 0.8 || !button.input?.enabled) {
                    return null;
                }
                const bounds = button.getBounds();
                return {
                    x: Math.round(bounds.centerX),
                    y: Math.round(bounds.centerY),
                    alpha: button.alpha,
                    inputEnabled: true
                };
            })()`),
            { timeoutMs: 3000, message: 'continuous Start control recovery' }
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
    if (exceptions.length) {
        throw new Error(`Home Start raised browser exceptions: ${exceptions.join(' | ')}`);
    }
    return { start, recovery, advanced };
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
        game.scene.stop('HatchingScene');
        game.scene.start('GameScene', { biome: 'nebula', forceMobileControls: true });
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
        checkpointSetup.checkpointY !== 1000 ||
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
        resumedCheckpoint.checkpointY !== 1000 ||
        resumedCheckpoint.playerX !== 1770 ||
        resumedCheckpoint.playerY !== 1000 ||
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
    const construction = await evaluate(session, `(() => {
        const action = document.querySelector('.village-construct-action:not(:disabled)');
        if (!action) return { clicked: false, text: null };
        const text = action.textContent;
        action.click();
        return { clicked: true, text };
    })()`);
    if (!construction.clicked || !/CONSTRUCT FORAGE AT ROOT 01/.test(construction.text || '')) {
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
            const artworkKeys = (landmark?.buildingElements || []).flatMap(
                container => (container?.list || [])
                    .map(element => element?.texture?.key)
                    .filter(key => String(key || '').startsWith('village-'))
            );
            return new Set(artworkKeys).size >= 3;
        })()`),
        { timeoutMs: 12000, message: 'Village Heart world artwork' }
    );

    const layout = await evaluate(session, `(() => {
        const modal = document.querySelector('.village-command-modal');
        const shell = document.querySelector('.village-command-shell');
        const close = document.querySelector('.village-command-close');
        const body = document.querySelector('.village-command-body');
        const artworks = [...document.querySelectorAll('.village-building-artwork:not(.is-compact)')];
        const milestones = [...document.querySelectorAll('.village-milestone')];
        const scene = window.mythicalGame.scene.getScene('GameScene');
        const landmark = scene.villageHeartLandmark;
        const worldArtworkKeys = (landmark?.buildingElements || []).flatMap(
            container => (container?.list || [])
                .map(element => element?.texture?.key)
                .filter(key => String(key || '').startsWith('village-'))
        );
        const worldArtworkBounds = (landmark?.buildingElements || []).flatMap(
            container => (container?.list || [])
                .filter(element => String(element?.texture?.key || '').startsWith('village-'))
                .map(element => {
                    const rect = element.getBounds();
                    return {
                        left: rect.left,
                        right: rect.right,
                        top: rect.top,
                        bottom: rect.bottom
                    };
                })
        );
        const bounds = element => {
            const rect = element.getBoundingClientRect();
            return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        };
        return {
            innerWidth,
            innerHeight,
            bodyScrollWidth: document.body.scrollWidth,
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
                artworkKeys: worldArtworkKeys,
                artworkBounds: worldArtworkBounds,
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
        new Set(layout.worldPresentation.artworkKeys).size < 3 ||
        layout.worldPresentation.artworkBounds.some(bounds => (
            bounds.left < -1 ||
            bounds.right > layout.innerWidth + 1 ||
            bounds.top < -1 ||
            bounds.bottom > layout.innerHeight + 1
        )) ||
        layout.worldPresentation.animatedElements < 3 ||
        !withinViewport(layout.shell) ||
        !withinViewport(layout.close)
    ) {
        throw new Error(`Village mobile layout overflowed: ${JSON.stringify(layout)}`);
    }

    const placed = await evaluate(session, `(() => {
        const plot = [...document.querySelectorAll('.village-plot')]
            .find(button => button.textContent.includes('ROOT 04'));
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
        return {
            status: document.querySelector('.village-command-status')?.textContent,
            habitatPresent: [...document.querySelectorAll('.village-plot')]
                .some(plot => plot.textContent.includes('HABITAT')),
            inviteVisible: Boolean(rect && rect.left >= 0 && rect.right <= innerWidth),
            closeVisible: Boolean(close && close.getBoundingClientRect().right <= innerWidth)
        };
    })()`);
    if (
        !interaction.habitatPresent ||
        !interaction.inviteVisible ||
        !interaction.closeVisible ||
        exceptions.length
    ) {
        throw new Error(
            `Village mobile interaction failed: ${JSON.stringify({ interaction, exceptions })}`
        );
    }
    return { layout, interaction };
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

        results[sceneName] = {
            attack,
            attackState,
            deferralState,
            recoveryState
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
        '--window-size=390,844',
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
            mobile: true,
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
        } else if (SMOKE_MODE === 'interaction') {
            const knownCases = ['all', 'egg', ...levels.map(([route]) => route)];
            if (!knownCases.includes(SMOKE_CASE)) {
                throw new Error(
                    `Unknown SMOKE_CASE ${JSON.stringify(SMOKE_CASE)}. ` +
                    `Use one of: ${knownCases.join(', ')}.`
                );
            }
            if (['all', 'egg'].includes(SMOKE_CASE)) {
                results.purchasedEgg = await smokePurchasedEgg(session, exceptions);
                process.stdout.write('PASS PurchasedEggHatch\n');
            }
            for (const [route, sceneName] of levels.filter(
                ([route]) => SMOKE_CASE === 'all' || SMOKE_CASE === route
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
                'Use home-entry, interaction, traversal-topology, aurora-route-journey, state-contract, final-priority-journey, save-reload-journey, navigation-lifecycle, hub-forest-transition, village-ui, forest-arrival, or guardian-pacing.'
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
