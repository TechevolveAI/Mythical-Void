const assert = require('node:assert/strict');

// Exercise real native pointer/touch ownership, not synthetic Phaser drag events.
// The caller owns a muted Chromium browser and closes it in finally.
async function verifyHeldTouch(page, context, { full = true } = {}) {
    const cdp = await context.newCDPSession(page);
    const viewport = page.viewportSize();
    const cases = [];
    try {
        for (const mode of full ? ['refresh', 'height'] : ['refresh']) {
            for (const [direction, dx, dy] of full
                ? [['right', 38, 0], ['left', -38, 0], ['down', 0, 38], ['up', 0, -38]]
                : [['right', 38, 0]]) {
                console.log(`[held-touch] ${mode} ${direction}`);
                const start = await page.evaluate(() => {
                    const s = mythicalGame.scene.keys.GameScene;
                    s.player.body.reset(1100, 900);
                    const c = s.mobileControls, rect = mythicalGame.canvas.getBoundingClientRect();
                    window.heldTouchTrace = [];
                    if (!c.heldTouchTraced) {
                        c.heldTouchTraced = true;
                        for (const name of ['resetJoystick', 'handleResize', 'hide', 'show', 'suspend', 'refresh', 'finishJoystickInput']) {
                            const original = c[name];
                            c[name] = function (...args) {
                                heldTouchTrace.push({ name, active: this.joystickActive, previous: this.controlViewport,
                                    next: this.getControlViewport(), stack: new Error().stack });
                                return original.apply(this, args);
                            };
                        }
                    }
                    return {
                        x: rect.x + c.joystickCenterX * rect.width / mythicalGame.scale.width,
                        y: rect.y + c.joystickCenterY * rect.height / mythicalGame.scale.height
                    };
                });
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] });
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + dx, y: start.y + dy, id: 1 }] });
                if (mode === 'refresh') {
                    for (let i = 0; i < 4; i += 1) {
                        await page.evaluate(() => mythicalGame.scale.refresh());
                        await page.waitForTimeout(100);
                    }
                } else {
                    await page.setViewportSize({ width: viewport.width, height: viewport.height - 44 });
                }
                await page.waitForTimeout(750);
                const held = await page.evaluate(() => {
                    const s = mythicalGame.scene.keys.GameScene, c = s.mobileControls;
                    return { active: c.joystickActive, source: c.joystickInputSource,
                        vector: [s.joystickX, s.joystickY], player: { x: s.player.x, y: s.player.y }, trace: heldTouchTrace };
                });
                if (!held.active) console.error(JSON.stringify(held, null, 2));
                assert(held.active, `${mode}: ${direction} lost the held finger`);
                const axis = dx ? 0 : 1;
                const sign = Math.sign(dx || dy);
                assert(held.vector[axis] * sign > 0.7, `${mode}: ${direction} movement reset`);
                const movement = dx ? held.player.x - 1100 : held.player.y - 900;
                assert(movement * sign > 40, `${mode}: ${direction} did not move the player`);
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                await page.waitForFunction(() => {
                    const s = mythicalGame.scene.keys.GameScene;
                    return !s.mobileControls.joystickActive && s.joystickX === 0 && s.joystickY === 0;
                }, null, { timeout: 8000 });
                cases.push({ mode, direction, ...held, releaseStopped: true });
                await page.setViewportSize(viewport);
                await page.waitForTimeout(250);
            }
        }
        return cases;
    } finally {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => {});
        await cdp.detach();
        await page.setViewportSize(viewport);
    }
}

module.exports = { verifyHeldTouch };
