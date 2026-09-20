const assert = require('node:assert/strict');
const path = require('node:path');

// Isolated collision/input journey. Combat is covered by the mountain boss
// smoke; patrols are explicitly retired here, never health/invulnerability hacks.
async function runMountainAscent(page, device, output) {
    const optional = process.env.MOUNTAIN_ASCENT_ROUTE === 'optional';
    const evidence = { route: optional ? 'optional' : 'main', traversalOnly: true, patrolsRetired: true, teleports: 0, landings: [] };
    await page.evaluate(() => window.mythicalGame.scene.getScene('VoidPeaksLevel').retirePeakPatrolsForTitan());
    let cdp;
    let touches = [];
    let controls;
    if (device === 'phone') {
        cdp = await page.context().newCDPSession(page);
        controls = await page.evaluate(() => {
            const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
            const rect = window.mythicalGame.canvas.getBoundingClientRect();
            const point = key => {
                const t = s.mobileControlTargets[key];
                return { x: rect.left + t.x * rect.width / s.scale.width, y: rect.top + t.y * rect.height / s.scale.height };
            };
            return { joystick: point('joystick'), jump: point('jump'), radius: s.mobileControlTargets.joystick.radius };
        });
    }
    async function direction(active) {
        if (!cdp) return active ? page.keyboard.down('ArrowRight') : page.keyboard.up('ArrowRight');
        if (active && touches.length === 0) {
            touches = [{ ...controls.joystick, id: 1 }];
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches });
            touches[0].x += controls.radius - 6;
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touches });
        } else if (!active && touches.length) {
            touches = [];
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        }
    }
    async function jump() {
        if (!cdp) {
            await page.keyboard.down('Space'); await page.waitForTimeout(130); await page.keyboard.up('Space');
        } else {
            touches = [touches[0], { ...controls.jump, id: 2 }];
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches });
            await page.waitForTimeout(130);
            // CDP touchEnd uses an empty list. Reacquire steering after the tap
            // instead of accidentally ending the joystick and leaving jump held.
            await direction(false);
            await direction(true);
        }
    }
    const targets = [
        ['peak-opening-step', 440], ['peak-opening-rise', 720], ['peak-foothill-turn', 960],
        ['peak-lower-relay-overlook', 1280], ['peak-lower-ascent', 1700], ['peak-ridge-approach', 2110],
        ['peak-warning-lower', 2400],
        ...(optional ? [
            ['peak-relic-launch', 2540], ['peak-relic-ridge-1', 2730], ['peak-relic-ridge-2', 3000],
            ['peak-relic-ridge-3', 3290], ['peak-relic-ridge-4', 3520]
        ] : [
            ['peak-ridge-turn', 2700], ['peak-main-handoff', 2850],
            ['peak-floor-summit', 3070], ['peak-warning-summit', 3360]
        ]), ['peak-summit-relay', 3700],
        ['peak-titan-approach', 4200]
    ];
    try {
        for (const [id, targetX] of targets) {
            let lastJump = 0;
            const started = Date.now();
            let landed = false;
            let last;
            const trace = [];
            while (Date.now() - started < 14000) {
                last = await page.evaluate(id => {
                    const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
                    const b = s.player.body, support = s.getTraversalSupport(id).body;
                    return { x: b.center.x, bottom: b.bottom, grounded: s.isGrounded || b.blocked.down,
                        top: support.top, left: support.left, dead: s.isPlayerDead,
                        relays: s.beaconRelaysActivated, locked: s.time.now < s.recoveryInputLockedUntil,
                        jumpVelocity: s.jumpVelocity, gravity: s.physics.world.gravity.y,
                        velocityY: b.velocity.y, jump: s.lastVirtualJumpResolution,
                        jumpTarget: s.mobileControlTargets.jump && { x: s.mobileControlTargets.jump.x, y: s.mobileControlTargets.jump.y },
                        cameraY: s.cameras.main.scrollY, fps: s.game.loop.actualFps };
                }, id);
                trace.push({ x: last.x, feet: last.bottom, grounded: last.grounded, vy: last.velocityY });
                assert(!last.dead, 'movement route must not kill the player');
                if (last.locked) { await direction(false); await page.waitForTimeout(100); continue; }
                await direction(last.x < targetX - 8);
                if (last.grounded && last.bottom > last.top + 6 && last.x >= last.left - 100 && Date.now() - lastJump > 600) {
                    await direction(true); await jump(); lastJump = Date.now();
                }
                if (last.x >= targetX - 12 && last.grounded && Math.abs(last.bottom - last.top) < 4) {
                    await direction(false); landed = true; break;
                }
                await page.waitForTimeout(80);
            }
            if (!landed) require('node:fs').writeFileSync(path.join(output, `${device}-failed-landing.json`), JSON.stringify({ id, last, trace }, null, 2));
            assert(landed, `${device} could not reach ${id}: ${JSON.stringify(last)}`);
            evidence.landings.push({ id, ...last, elapsedMs: Date.now() - started });
            if (['peak-lower-relay-overlook', 'peak-warning-lower', 'peak-titan-approach'].includes(id)) {
                await page.waitForTimeout(350);
                await page.screenshot({ path: path.join(output, `${device}-${id}.png`) });
            }
        }
        evidence.relays = await page.evaluate(() => window.mythicalGame.scene.getScene('VoidPeaksLevel').beaconRelaysActivated);
        assert.equal(evidence.relays, 3, 'normal landings must activate all three checkpoints without extra input');
        evidence.choice = await page.evaluate(() => window.mythicalGame.scene.getScene('VoidPeaksLevel').getExpeditionRouteState());
        assert.equal(evidence.choice.peakRouteChoice, evidence.route, 'the deliberate route choice must match the path walked');
        assert(optional ? evidence.choice.ridgeGuardCharges > 0 : evidence.choice.titanSurgeCharges > 0,
            'the selected route must give its usable shield or blast');
        return evidence;
    } catch (error) {
        await page.screenshot({ path: path.join(output, `${device}-ascent-failure.png`) });
        throw error;
    } finally {
        await direction(false);
        if (cdp) await cdp.detach();
    }
}
module.exports = { runMountainAscent };
