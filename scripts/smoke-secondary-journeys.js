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
        ['mythicalForest', 'crystalCaves', 'reef', 'voidPeaks'].includes(route) &&
        (
            state.enemyCount < 1 ||
            state.combatCueCount !== state.enemyCount
        )
    ) {
        throw new Error(
            `${sceneName} has enemies without combat readability cues: ${JSON.stringify(state)}`
        );
    }
    if (['reef', 'voidPeaks', 'auroraDepths', 'finalVoid'].includes(route)) {
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

    let routeHandoff = null;
    if (['reef', 'voidPeaks', 'auroraDepths', 'finalVoid'].includes(route)) {
        const staged = await evaluate(session, `(() => {
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
    }
    if (exceptions.length) {
        throw new Error(`${sceneName} raised browser exceptions: ${exceptions.join(' | ')}`);
    }
    return {
        ...state,
        jump: { before: beforeJump, during: jumped, released: jumpReleased },
        joystick: { movedRight, movedLeft },
        routeHandoff
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
        await evaluate(session, `(() => {
            const scene = window.mythicalGame?.scene?.getScene('HatchingScene');
            scene.startButton.setAlpha(0).disableInteractive();
            scene.ensureHomeStartReady();
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
            { timeoutMs: 3000, message: 'invisible Start control recovery' }
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
    return { gateEntry, fieldBrief, gameplay };
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
                'Use home-entry, interaction, state-contract, final-priority-journey, save-reload-journey, navigation-lifecycle, hub-forest-transition, village-ui, forest-arrival, or guardian-pacing.'
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
