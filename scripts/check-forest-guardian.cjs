#!/usr/bin/env node
// Local, muted encounter proof. Arena positioning/fault injection is staged;
// entrance, attack clocks, collision, buttons, projectiles and victory are real.
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.FOREST_EVIDENCE_DIR || path.join(root, '.visual-review/forest-encounter/verified'));
const port = Number(process.env.FOREST_SMOKE_PORT || 19174);
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
const deadline = setTimeout(async () => { await cleanup(); process.exit(1); }, 360000);

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
        stagedCombat: true, fullPlaythrough: false, muted: true, publicationAuthorized: false, cases: []
    };
    try {
        for (const [device, width, height] of [['phone', 390, 844], ['desktop', 1280, 720]]) {
            browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
            const page = await browser.newPage({ viewport: { width, height }, isMobile: device === 'phone', hasTouch: device === 'phone', serviceWorkers: 'block' });
            const result = { device, errors: [], externalRequests: [], patterns: [] };
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
                await window.SceneLoader.loadScene(game, 'MythicalForestLevel');
                game.scene.start('MythicalForestLevel', { firstExpeditionDrillPreview: true });
            }, profile);
            await page.waitForFunction(() => window.mythicalGame.scene.getScene('MythicalForestLevel')?.player?.active);
            await page.evaluate(() => {
                const s = window.mythicalGame.scene.getScene('MythicalForestLevel');
                s.beaconAnchorsActivated = 3; s.forestRouteAligned = true;
                window.forestAttacks = [];
                const execute = s.executeBossAttack;
                s.executeBossAttack = function (type) {
                    window.forestAttacks.push({ type, time: this.time.now });
                    return execute.call(this, type);
                };
                s.beginAutomaticGuardianAwakening();
            });
            await page.waitForFunction(() => window.mythicalGame.scene.getScene('MythicalForestLevel')?.bossEntranceComplete);
            const snapshot = () => page.evaluate(() => {
                const s = window.mythicalGame.scene.getScene('MythicalForestLevel'), c = s.cameras.main;
                return { health: s.health, bossHealth: s.bossHealth, phase: s.bossPhase, recovering: s.boss?.isRecovering,
                    playerX: s.player.x, playerBottom: s.player.body.bottom, floorTop: s.getForestArenaFloor().top,
                    bossLeft: s.boss.getBounds().left - c.scrollX, bossRight: s.boss.getBounds().right - c.scrollX,
                    defeated: s.bossDefeated, time: s.time.now, hazards: s.bossHazards.size,
                    attacks: [...window.forestAttacks] };
            });
            await page.waitForTimeout(350);
            result.arrival = await snapshot();
            assert(result.arrival.bossLeft > 0 && result.arrival.bossRight < width, 'boss must be fully framed');
            assert(Math.abs(result.arrival.playerBottom - result.arrival.floorTop) < 2, 'arrival feet must meet floor');
            await page.screenshot({ path: path.join(output, `${device}-arrival.png`) });
            await page.waitForFunction(() => window.mythicalGame.scene.getScene('MythicalForestLevel').bossHazards.size > 0, null, { timeout: 8000 });
            await page.waitForTimeout(100);
            result.rootImpact = await snapshot();
            assert(result.rootImpact.health < result.arrival.health, 'standing in roots must cause a real hit');
            await page.screenshot({ path: path.join(output, `${device}-root-impact.png`) });
            await page.waitForFunction(() => window.mythicalGame.scene.getScene('MythicalForestLevel').boss?.isRecovering);
            result.floorRepair = await page.evaluate(() => {
                const s = window.mythicalGame.scene.getScene('MythicalForestLevel');
                s.player.y += 40; s.player.body.updateFromGameObject(); s.keepForestArenaSafe();
                const floorRestored = Math.abs(s.player.body.bottom - s.getForestArenaFloor().top) <= 2;
                s.resetForestPlayerBody(5100, s.player.y); s.keepForestArenaSafe();
                const voidPrevented = s.player.x >= 5270;
                s.health = s.maxHealth; s.updateHealthDisplay();
                return { floorRestored, voidPrevented };
            });
            assert(result.floorRepair.floorRestored && result.floorRepair.voidPrevented, 'arena fault recovery');

            const tap = async id => {
                if (device === 'desktop') return page.keyboard.press({ jump: 'Space', melee: 'x', ranged: 'm' }[id], { delay: 90 });
                const p = await page.evaluate(id => {
                    const s = window.mythicalGame.scene.getScene('MythicalForestLevel');
                    const t = s.mobileControlTargets[id], r = window.mythicalGame.canvas.getBoundingClientRect();
                    return { x: r.left + t.x * r.width / s.scale.width, y: r.top + t.y * r.height / s.scale.height };
                }, id);
                await page.touchscreen.tap(p.x, p.y);
            };
            // Each isolated hazard uses its real warning/attack/recovery clock.
            // Position and health are reset between cases, never the boss's health.
            for (let cycle = 0; cycle < 8 && !(await snapshot()).defeated; cycle++) {
                await page.waitForFunction(() => !window.mythicalGame.scene.getScene('MythicalForestLevel').bossPhaseTransitioning);
                const type = ['vine_whip', 'spore_cloud', 'nature_fury', 'root_slam'][cycle % 4];
                await page.evaluate(type => {
                    const s = window.mythicalGame.scene.getScene('MythicalForestLevel');
                    s.bossAITimer.paused = true; s.clearForestBossPacing();
                    s.boss.isAttacking = false; s.boss.isRecovering = false;
                    s.health = s.maxHealth; s.updateHealthDisplay();
                    const y = s.player.y - (s.player.body.bottom - s.getForestArenaFloor().top) - 1;
                    s.resetForestPlayerBody(s.boss.x - 150, y); s.player.facingRight = true;
                    s.executeBossAttack(type);
                }, type);
                if (type === 'vine_whip' || type === 'root_slam') {
                    await page.waitForTimeout(type === 'vine_whip' ? 1050 : 650);
                    await tap('jump');
                } else {
                    await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(850); await page.keyboard.up('ArrowLeft');
                }
                await page.waitForFunction(() => window.mythicalGame.scene.getScene('MythicalForestLevel').boss?.isRecovering, null, { timeout: 10000 });
                const afterDodge = await snapshot();
                result.patterns.push({ type, healthAfterDodge: afterDodge.health, bossBeforeHits: afterDodge.bossHealth });
                assert(afterDodge.health === 4, `${type} should be avoidable with ordinary controls`);
                await page.evaluate(() => {
                    const s = window.mythicalGame.scene.getScene('MythicalForestLevel');
                    const y = s.player.y - (s.player.body.bottom - s.getForestArenaFloor().top) - 1;
                    s.resetForestPlayerBody(s.boss.x - 90, y); s.player.facingRight = true;
                });
                await page.screenshot({ path: path.join(output, `${device}-${type}-opening.png`) });
                await tap('melee');
                await page.waitForTimeout(100);
                const afterMelee = await snapshot();
                assert(afterMelee.bossHealth < afterDodge.bossHealth, 'ground-level melee must reach the roots');
                for (let hit = 0; hit < 2; hit++) { await page.waitForTimeout(450); await tap('ranged'); }
                await page.waitForTimeout(300);
            }
            result.final = await snapshot();
            assert(result.final.defeated, 'actual ranged projectiles must finish the guardian through its openings');
            assert.equal(result.final.hazards, 0, 'victory cancels live hazards');
            assert.deepEqual(result.errors, []);
            assert.deepEqual(result.externalRequests, []);
            console.log(`PASS ${device}: real hits, dodges, arena recovery, phase change and ranged victory`);
            await browser.close(); browser = null;
        }
        evidence.pass = true;
    } catch (error) { evidence.pass = false; evidence.error = error.message; throw error;
    } finally { fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(evidence, null, 2)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { clearTimeout(deadline); await cleanup(); });
