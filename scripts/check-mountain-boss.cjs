#!/usr/bin/env node
// Staged final approach; real keyboard/touch movement, collisions and boss clocks.
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { runMountainAscent } = require('./lib/mountain-ascent-journey.cjs');
const { runMountainWaveChecks, runMountainCompletion } = require('./lib/mountain-completion-journey.cjs');
const { runMountainCheckpointRestart } = require('./lib/mountain-checkpoint-restart.cjs');
const ascentJourney = process.env.MOUNTAIN_ASCENT_JOURNEY === '1';
const jumpToSummit = process.env.MOUNTAIN_SUMMIT_ENTRY === 'jump';
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.MOUNTAIN_EVIDENCE_DIR || path.join(root, '.visual-review/mountain-boss'));
const port = Number(process.env.MOUNTAIN_SMOKE_PORT || 19179);
const externalUrl = String(process.env.MOUNTAIN_SMOKE_URL || '').trim().replace(/\/+$/, '');
const base = externalUrl || `http://127.0.0.1:${port}`;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser, server, cleaning;
async function cleanup() {
    return cleaning ||= (async () => {
        await browser?.close();
        if (server && server.exitCode === null && server.signalCode === null) {
            server.kill('SIGTERM');
            for (let i = 0; i < 30 && server.exitCode === null && server.signalCode === null; i++) await delay(100);
            if (server.exitCode === null && server.signalCode === null) server.kill('SIGKILL');
        }
    })();
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await cleanup(); process.exit(1); });
const deadline = setTimeout(async () => { await cleanup(); process.exit(1); }, ascentJourney ? 420000 : 180000);

async function main() {
    fs.mkdirSync(output, { recursive: true });
    if (!externalUrl) {
        server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
            { cwd: root, env: { ...process.env, BROWSER: 'none' }, stdio: 'ignore' });
    }
    for (let i = 0; i < 100; i++) {
        if (server && server.exitCode !== null) throw Error('Preview failed');
        try { if ((await fetch(base + '/play/')).ok) break; } catch {}
        await delay(100);
    }
    const evidence = {
        sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
        sourceStatus: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(),
        testedUrl: base,
        fullPlaythrough: false, stagedApproach: true, summitEntry: jumpToSummit ? 'jump' : 'walk',
        muted: true, publicationAuthorized: false, cases: []
    };
    try {
        for (const [device, width, height] of [['phone', 390, 844], ['desktop', 1280, 720]]) {
            if (process.env.MOUNTAIN_SMOKE_DEVICE && process.env.MOUNTAIN_SMOKE_DEVICE !== device) continue;
            browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
            const page = await browser.newPage({ viewport: { width, height }, isMobile: device === 'phone', hasTouch: device === 'phone', serviceWorkers: 'block' });
            const result = { device, errors: [], externalRequests: [], previewPanelBlocks: [] };
            evidence.cases.push(result);
            page.on('pageerror', e => result.errors.push(e.message));
            page.on('console', m => {
                if (m.type() !== 'error') return;
                const message = m.text();
                // Match the existing smoke suite's preview-only Netlify panel exception.
                if (/^deploy-preview-\d+--[^.]+\.netlify\.app$/.test(new URL(base).hostname) &&
                    message.startsWith("Framing 'https://app.netlify.com/' violates the following Content Security Policy directive:")) {
                    result.previewPanelBlocks.push(message);
                } else result.errors.push(message);
            });
            await page.route('**/*', route => {
                const url = new URL(route.request().url());
                if (url.origin !== base) { result.externalRequests.push(url.origin + url.pathname); return route.abort(); }
                return route.continue();
            });
            await page.addInitScript(() => {
                if (window !== window.top) return;
                localStorage.setItem('audioMuted', 'true');
                localStorage.setItem('mythical_void_age_confirmed', 'true');
                localStorage.setItem('mythical_void_age_group', 'age_18_plus');
                Object.defineProperty(window, 'APIConfig', { configurable: true, set(value) {
                    value.isEnabled = () => false; value.isVideoEnabled = () => false;
                    Object.defineProperty(window, 'APIConfig', { value, writable: true, configurable: true });
                }});
                Object.defineProperty(window, 'AudioManager', { configurable: true, set(value) {
                    Object.defineProperty(value, 'muted', { get: () => true, set() {}, configurable: true });
                    Object.defineProperty(window, 'AudioManager', { value, writable: true, configurable: true });
                }});
            });
            await page.goto(base + '/play/');
            await page.waitForFunction(() => window.GameState && window.mythicalGame?.scene.getScenes(true).some(s => s.scene.key === 'HatchingScene'), null, { timeout: 60000 });
            const profile = require('../public/press/gameplay/real-creature-showcase/source-profiles.json').profiles.find(p => p.id === 'MV-0153');
            await page.evaluate(async profile => {
                const state = window.GameState, game = window.mythicalGame;
                game.sound.mute = true;
                game.scene.getScenes(true).forEach(s => game.scene.stop(s.scene.key));
                const creature = { ...state.get('creature'), id: profile.genes.id, name: profile.id, hatched: true, named: true,
                    genes: profile.genes, genetics: profile.genes, dna: profile.dna, lifecycle: { ...state.get('creature.lifecycle'), stage: 'adult' } };
                state.set('creature', creature); state.set('creatures', [creature]); state.set('activeCreatureIndex', 0);
                state.set('tutorial.controlsSeen', true); state.set('tutorial.crashStorySeen', true);
                // Ordinary entry comes from the hub, so preserve that scene dependency in this staged fixture.
                await window.SceneLoader.loadScene(game, 'HubWorldScene');
                await window.SceneLoader.loadScene(game, 'VoidPeaksLevel');
                game.scene.start('VoidPeaksLevel');
            }, profile);
            await page.waitForFunction(() => window.mythicalGame.scene.getScene('VoidPeaksLevel')?.levelEntryKeyHandler);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(3600);
            result.opening = await page.evaluate(() => {
                const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
                const source = s.textures.get('peak-meteor-stone').getSourceImage();
                return { displayCount: s.children.list.length, activeTweens: s.tweens.getTweens().length,
                    materialWidth: source.width, materialHeight: source.height, physicsHeight: s.physics.world.bounds.height };
            });
            assert.equal(result.opening.materialWidth, 512);
            assert.equal(result.opening.materialHeight, 512);
            if (device === 'phone') {
                assert(result.opening.displayCount <= 165, 'retain the existing mobile ambient display budget');
                assert(result.opening.activeTweens <= 10, 'retain the existing mobile ambient tween budget');
            }
            if (ascentJourney) {
                result.ascent = await runMountainAscent(page, device, output);
                result.checkpointRestart = await runMountainCheckpointRestart(page, device, output);
            }
            await page.evaluate(() => {
                const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
                s.beaconRelaysActivated = 3; s.creatureNetworkReached = true;
                s.retirePeakPatrolsForTitan();
                s.player.setPosition(4300, 700); s.player.body.updateFromGameObject();
                s.player.y += 799 - s.player.body.bottom; s.player.body.updateFromGameObject();
                for (const key of ['prev', 'prevFrame', 'autoFrame']) s.player.body[key]?.copy?.(s.player.body.position);
                s.player.setVelocity(0, 0);
                // Observe the real attack clock without forcing an attack. A wave
                // can hit the entry position and retire between browser polls.
                window.mountainWaveLaunches = [];
                const fireWave = s.fireMountainGroundWave.bind(s);
                s.fireMountainGroundWave = (...args) => {
                    const wave = fireWave(...args);
                    if (wave?.active && wave.body) window.mountainWaveLaunches.push({
                        attackIndex: s.titanAttackIndex, ready: s.bossCombatReady, active: s.bossFightActive,
                        warning: s.bossSubtitle.text, paused: s.physics.world.isPaused,
                        x: wave.x, y: wave.y, velocityX: wave.body.velocity.x
                    });
                    return wave;
                };
                window.mountainWalkSamples = [];
                window.mountainSampler = s.time.addEvent({ delay: 50, loop: true, callback: () => {
                    window.mountainWalkSamples.push({ x: s.player.x, bottom: s.player.body.bottom,
                        grounded: s.isGrounded, active: s.bossFightActive });
                }});
            });
            const snapshot = () => page.evaluate(() => {
                const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
                return { x: s.player.x, bottom: s.player.body.bottom, bossHealth: s.bossHealth, health: s.health,
                    guardCharges: s.optionalRouteGuardCharges,
                    active: s.bossFightActive, ready: s.bossCombatReady, awake: s.mountainAwake,
                    name: s.bossNameText?.text, nameBounds: s.bossNameText?.getBounds(),
                    bossTexture: { width: s.boss?.width, height: s.boss?.height, displayHeight: s.boss?.displayHeight },
                    effects: s.bossEncounterEffects.size, displayCount: s.children.list.length,
                    bossX: s.boss?.x, bossY: s.boss?.y, bossScale: s.boss?.scaleX };
            });
            await page.waitForTimeout(500);
            await page.screenshot({ path: path.join(output, `${device}-approach.png`) });
            let touchSession;
            let steeringTouch;
            if (device === 'phone') {
                touchSession = await page.context().newCDPSession(page);
                const point = await page.evaluate(() => {
                    const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
                    const t = s.mobileControlTargets.joystick, r = window.mythicalGame.canvas.getBoundingClientRect();
                    return { x: r.left + t.x * r.width / s.scale.width, y: r.top + t.y * r.height / s.scale.height,
                        distance: (t.radius - 6) * r.width / s.scale.width };
                });
                await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y, id: 1 }] });
                steeringTouch = { x: point.x + point.distance, y: point.y, id: 1 };
                await touchSession.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [steeringTouch] });
                result.movementInput = 'real-touch-joystick';
            } else {
                await page.keyboard.down('ArrowRight');
                result.movementInput = 'keyboard';
            }
            try {
                await page.waitForFunction(() => window.mythicalGame.scene.getScene('VoidPeaksLevel').player.x >= 4590, null, { timeout: 10000 });
                await page.screenshot({ path: path.join(output, `${device}-climb.png`) });
                if (jumpToSummit) {
                    await page.waitForFunction(() => window.mythicalGame.scene.getScene('VoidPeaksLevel').player.x >= 4710);
                    if (touchSession) {
                        const jumpTouch = await page.evaluate(() => {
                            const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
                            const t = s.mobileControlTargets.jump, r = window.mythicalGame.canvas.getBoundingClientRect();
                            return { x: r.left + t.x * r.width / s.scale.width, y: r.top + t.y * r.height / s.scale.height, id: 2 };
                        });
                        await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [steeringTouch, jumpTouch] });
                    } else await page.keyboard.down('Space');
                    await page.waitForTimeout(130);
                    if (!touchSession) await page.keyboard.up('Space');
                }
                await page.waitForFunction(() => window.mythicalGame.scene.getScene('VoidPeaksLevel').bossFightActive, null, { timeout: 8000 });
            } catch (error) { result.stuck = await snapshot(); await page.screenshot({ path: path.join(output, `${device}-failure.png`) }); throw error;
            } finally {
                if (touchSession) await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                else await page.keyboard.up('ArrowRight');
            }
            await page.waitForFunction(() => window.mythicalGame.scene.getScene('VoidPeaksLevel').bossCombatReady, null, { timeout: 8000 });
            await page.waitForTimeout(400);
            result.summit = await snapshot();
            result.walk = await page.evaluate(() => { window.mountainSampler.remove(); return window.mountainWalkSamples; });
            if (jumpToSummit) {
                assert(result.walk.some(s => s.x > 4885 && s.bottom < 399 && !s.grounded && !s.active),
                    'the real jump must pass the old entry strip before landing and waking the boss');
            }
            assert(result.walk.some(s => s.x > 4600 && s.bottom < 570), 'must walk up solid stairs without jumping');
            assert(result.walk.every(s => s.bottom <= 802), 'must never fall below the recovery floor');
            assert(Math.abs(result.summit.bottom - 400) < 3, 'summit feet must meet the ledge');
            assert.equal(result.summit.name, 'THE PEAK OF THE MOUNTAIN');
            assert.deepEqual(result.summit.bossTexture, { width: 1064, height: 1000, displayHeight: 650 }, 'cosmic art preserves the physical scale');
            assert(result.summit.nameBounds.x >= 0 && result.summit.nameBounds.x + result.summit.nameBounds.width <= width, 'name fits screen');
            await page.screenshot({ path: path.join(output, `${device}-summit.png`) });
            await page.waitForFunction(() => window.mythicalGame.scene.getScene('VoidPeaksLevel').bossEncounterEffects.size >= 3, null, { timeout: 8000 });
            await page.screenshot({ path: path.join(output, `${device}-lasers.png`) });
            await page.waitForTimeout(1200);
            result.attack = await snapshot();
            assert(result.attack.health < result.summit.health || result.attack.guardCharges < result.summit.guardCharges,
                'standing on the warned target causes real damage or consumes the earned shield');
            await page.waitForFunction(() => window.mountainWaveLaunches.length > 0, null, { timeout: 12000 });
            result.naturalWave = await page.evaluate(() => window.mountainWaveLaunches[0]);
            assert.equal(result.naturalWave.attackIndex, 2, 'the natural attack clock advances from lasers to the ground wave');
            assert.equal(result.naturalWave.paused, false);
            assert.equal(result.naturalWave.velocityX, 235, 'the natural wave has a moving physics body');
            result.repair = await page.evaluate(() => {
                const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
                s.player.y += 40; s.player.body.updateFromGameObject(); s.keepMountainArenaGrounded();
                return { bottom: s.player.body.bottom };
            });
            assert(Math.abs(result.repair.bottom - 400) <= 2, 'late-frame floor recovery');
            await page.evaluate(() => {
                const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
                s.bossAttackTimer?.remove(); s.bossAttackPreviewTimer?.remove();
                s.titanWarningTimer?.remove(); s.clearBossEncounterTimers(); s.clearBossEncounterEffects();
                s.health = s.maxHealth; s.player.facingRight = false;
            });
            result.lowWave = await runMountainWaveChecks(page, device, output);
            const before = (await snapshot()).bossHealth;
            if (device === 'phone') {
                const point = await page.evaluate(() => {
                    const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
                    const t = s.mobileControlTargets.ranged, r = window.mythicalGame.canvas.getBoundingClientRect();
                    return { x: r.left + t.x * r.width / s.scale.width, y: r.top + t.y * r.height / s.scale.height };
                });
                await page.touchscreen.tap(point.x, point.y);
            } else await page.keyboard.press('m');
            await page.waitForTimeout(650);
            result.rangedHit = await snapshot();
            assert(result.rangedHit.bossHealth < before, 'normal projectile reaches the mountain face from the ledge');
            result.finalHit = await page.evaluate(() => {
                const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
                s.damageBoss(100);
                return { completed: window.GameState.get('levels.voidPeaks.completed'),
                    resultShown: s.peakResultShown, reward: s.levelCompletionResult };
            });
            assert.equal(result.finalHit.completed, true, 'final hit records victory before animation');
            assert.equal(result.finalHit.resultShown, false, 'persistence does not wait for the result panel');
            await page.waitForTimeout(2000);
            result.defeat = await snapshot();
            assert.equal(result.defeat.effects, 0, 'defeat retires lasers and their overlaps');
            result.completion = await runMountainCompletion(page, device, output);
            await page.waitForTimeout(300);
            assert.deepEqual(result.errors, []);
            assert.deepEqual(result.externalRequests, []);
            console.log(`PASS ${device}: ascent, summit, lasers, jumpable wave, ranged hit, reward, rescue and return`);
            await browser.close(); browser = null;
        }
        evidence.pass = true;
    } catch (error) { evidence.pass = false; evidence.error = error.message; throw error;
    } finally { fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(evidence, null, 2)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { clearTimeout(deadline); await cleanup(); });
