#!/usr/bin/env node
// Staged final approach; real keyboard/touch movement, collisions and boss clocks.
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.visual-review/mountain-boss');
const port = Number(process.env.MOUNTAIN_SMOKE_PORT || 19179);
const base = `http://127.0.0.1:${port}`;
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
const deadline = setTimeout(async () => { await cleanup(); process.exit(1); }, 180000);

async function main() {
    fs.mkdirSync(output, { recursive: true });
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
        { cwd: root, env: { ...process.env, BROWSER: 'none' }, stdio: 'ignore' });
    for (let i = 0; i < 100; i++) {
        if (server.exitCode !== null) throw Error('Preview failed');
        try { if ((await fetch(base + '/play/')).ok) break; } catch {}
        await delay(100);
    }
    const evidence = {
        sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
        sourceStatus: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(),
        fullPlaythrough: false, stagedApproach: true, muted: true, publicationAuthorized: false, cases: []
    };
    try {
        for (const [device, width, height] of [['phone', 390, 844], ['desktop', 1280, 720]]) {
            browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
            const page = await browser.newPage({ viewport: { width, height }, isMobile: device === 'phone', hasTouch: device === 'phone', serviceWorkers: 'block' });
            const result = { device, errors: [], externalRequests: [] };
            evidence.cases.push(result);
            page.on('pageerror', e => result.errors.push(e.message));
            page.on('console', m => { if (m.type() === 'error') result.errors.push(m.text()); });
            await page.route('**/*', route => {
                const url = new URL(route.request().url());
                if (url.origin !== base) { result.externalRequests.push(url.origin + url.pathname); return route.abort(); }
                return route.continue();
            });
            await page.addInitScript(() => {
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
                await window.SceneLoader.loadScene(game, 'VoidPeaksLevel');
                game.scene.start('VoidPeaksLevel');
            }, profile);
            await page.waitForFunction(() => window.mythicalGame.scene.getScene('VoidPeaksLevel')?.levelEntryKeyHandler);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(1000);
            await page.evaluate(() => {
                const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
                s.beaconRelaysActivated = 3; s.creatureNetworkReached = true;
                s.retirePeakPatrolsForTitan();
                s.player.setPosition(4300, 700); s.player.body.updateFromGameObject();
                s.player.y += 799 - s.player.body.bottom; s.player.body.updateFromGameObject();
                for (const key of ['prev', 'prevFrame', 'autoFrame']) s.player.body[key]?.copy?.(s.player.body.position);
                s.player.setVelocity(0, 0);
                window.mountainWalkSamples = [];
                window.mountainSampler = s.time.addEvent({ delay: 50, loop: true, callback: () => {
                    window.mountainWalkSamples.push({ x: s.player.x, bottom: s.player.body.bottom, grounded: s.isGrounded });
                }});
            });
            const snapshot = () => page.evaluate(() => {
                const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
                return { x: s.player.x, bottom: s.player.body.bottom, bossHealth: s.bossHealth, health: s.health,
                    active: s.bossFightActive, ready: s.bossCombatReady, awake: s.mountainAwake,
                    name: s.bossNameText?.text, nameBounds: s.bossNameText?.getBounds(),
                    effects: s.bossEncounterEffects.size, displayCount: s.children.list.length,
                    bossX: s.boss?.x, bossY: s.boss?.y, bossScale: s.boss?.scaleX };
            });
            await page.waitForTimeout(500);
            await page.screenshot({ path: path.join(output, `${device}-approach.png`) });
            let touchSession;
            if (device === 'phone') {
                touchSession = await page.context().newCDPSession(page);
                const point = await page.evaluate(() => {
                    const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
                    const t = s.mobileControlTargets.joystick, r = window.mythicalGame.canvas.getBoundingClientRect();
                    return { x: r.left + t.x * r.width / s.scale.width, y: r.top + t.y * r.height / s.scale.height,
                        distance: (t.radius - 6) * r.width / s.scale.width };
                });
                await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y, id: 1 }] });
                await touchSession.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x + point.distance, y: point.y, id: 1 }] });
                result.movementInput = 'real-touch-joystick';
            } else {
                await page.keyboard.down('ArrowRight');
                result.movementInput = 'keyboard';
            }
            try {
                await page.waitForFunction(() => window.mythicalGame.scene.getScene('VoidPeaksLevel').player.x >= 4590, null, { timeout: 10000 });
                await page.screenshot({ path: path.join(output, `${device}-climb.png`) });
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
            assert(result.walk.some(s => s.x > 4600 && s.bottom < 570), 'must walk up solid stairs without jumping');
            assert(result.walk.every(s => s.bottom <= 802), 'must never fall below the recovery floor');
            assert(Math.abs(result.summit.bottom - 400) < 3, 'summit feet must meet the ledge');
            assert.equal(result.summit.name, 'THE PEAK OF THE MOUNTAIN');
            assert(result.summit.nameBounds.x >= 0 && result.summit.nameBounds.x + result.summit.nameBounds.width <= width, 'name fits screen');
            await page.screenshot({ path: path.join(output, `${device}-summit.png`) });
            await page.waitForFunction(() => window.mythicalGame.scene.getScene('VoidPeaksLevel').bossEncounterEffects.size >= 3, null, { timeout: 8000 });
            await page.screenshot({ path: path.join(output, `${device}-lasers.png`) });
            await page.waitForTimeout(1200);
            result.attack = await snapshot();
            assert(result.attack.health < result.summit.health, 'standing on the warned target causes a real laser hit');
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
            await page.evaluate(() => window.mythicalGame.scene.getScene('VoidPeaksLevel').damageBoss(100));
            await page.waitForTimeout(2000);
            result.defeat = await snapshot();
            assert.equal(result.defeat.effects, 0, 'defeat retires lasers and their overlaps');
            await page.evaluate(() => window.mythicalGame.scene.stop('VoidPeaksLevel'));
            await page.waitForTimeout(300);
            assert.deepEqual(result.errors, []);
            assert.deepEqual(result.externalRequests, []);
            console.log(`PASS ${device}: staircase, summit, lasers, real ranged hit and cleanup`);
            await browser.close(); browser = null;
        }
        evidence.pass = true;
    } catch (error) { evidence.pass = false; evidence.error = error.message; throw error;
    } finally { fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(evidence, null, 2)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { clearTimeout(deadline); await cleanup(); });
