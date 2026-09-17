#!/usr/bin/env node
// Staged local adult fixtures in real scenes, not an end-to-end onboarding proof.
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.CREATURE_EVIDENCE_DIR || path.join(root, '.visual-review/adult-visibility-repair'));
const port = Number(process.env.CREATURE_SMOKE_PORT || 19173);
const base = `http://127.0.0.1:${port}`;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser, server, cleaning;
async function cleanup() {
    return cleaning ||= (async () => {
        await browser?.close();
        if (server && server.exitCode === null && server.signalCode === null) {
            server.kill('SIGTERM');
            for (let i = 0; i < 30 && server.exitCode === null && server.signalCode === null; i++) await wait(100);
            if (server.exitCode === null && server.signalCode === null) server.kill('SIGKILL');
        }
    })();
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await cleanup(); process.exit(1); });

async function main() {
    fs.mkdirSync(output, { recursive: true });
    const log = fs.openSync(path.join(output, 'game-server.log'), 'w');
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
        { cwd: root, env: { ...process.env, BROWSER: 'none' }, stdio: ['ignore', log, log] });
    fs.closeSync(log);
    for (let i = 0; i < 120; i++) {
        if (server.exitCode !== null) throw Error('Owned preview failed to start');
        try { if ((await fetch(`${base}/play/`)).ok) break; } catch {}
        await wait(250);
    }
    const profiles = require('../public/press/gameplay/real-creature-showcase/source-profiles.json').profiles;
    const evidence = { sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
        sourceStatus: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(),
        fixtureState: true, fullPlaythrough: false, muted: true, publicationAuthorized: false, cases: [] };
    try {
        for (const [device, width, height] of [['phone', 390, 844], ['desktop', 1280, 720]]) {
            console.log(`Starting ${device} proof`);
            browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
            const context = await browser.newContext({ viewport: { width, height }, isMobile: device === 'phone', hasTouch: device === 'phone' });
            try {
                const page = await context.newPage();
                const errors = [], externalRequests = [];
                page.on('pageerror', error => errors.push(error.message));
                page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
                await context.route('**/*', route => {
                    const url = new URL(route.request().url());
                    if (url.origin !== base) { externalRequests.push(url.origin + url.pathname); return route.abort(); }
                    return route.continue();
                });
                await context.addInitScript(() => {
                    localStorage.setItem('audioMuted', 'true');
                    localStorage.setItem('mythical_void_age_confirmed', 'true');
                    localStorage.setItem('mythical_void_age_group', 'age_18_plus');
                    Object.defineProperty(window, 'APIConfig', { configurable: true, set(value) {
                        value.isEnabled = () => false;
                        value.isVideoEnabled = () => false;
                        Object.defineProperty(window, 'APIConfig', { configurable: true, writable: true, value });
                    }});
                    Object.defineProperty(window, 'AudioManager', { configurable: true, set(value) {
                        Object.defineProperty(value, 'muted', { configurable: true, get: () => true, set() {} });
                        Object.defineProperty(window, 'AudioManager', { configurable: true, writable: true, value });
                    }});
                });
                await page.goto(`${base}/play/`);
                await page.waitForFunction(() => window.GameState && window.mythicalGame?.scene?.getScenes(true).some(s => s.scene.key === 'HatchingScene'), null, { timeout: 60000 });
                for (const id of ['MV-0153', 'MV-0567']) {
                    const profile = profiles.find(p => p.id === id);
                    await page.evaluate(async ({ profile, phone }) => {
                        const state = window.GameState, game = window.mythicalGame;
                        game.sound.mute = true;
                        game.scene.getScenes(true).forEach(s => game.scene.stop(s.scene.key));
                        const creature = { ...state.get('creature'), id: profile.genes.id, name: profile.id,
                            hatched: true, named: true, genes: profile.genes, genetics: profile.genes, dna: profile.dna,
                            rarity: profile.rarity, species: profile.species, textureName: null,
                            lifecycle: { ...state.get('creature.lifecycle'), stage: 'adult' } };
                        state.set('creature', creature);
                        state.set('creatures', [creature]);
                        state.set('activeCreatureIndex', 0);
                        for (const key of ['crashStorySeen', 'controlsSeen', 'villageHeartArrivalSeen', 'livingFormSeen']) state.set(`tutorial.${key}`, true);
                        state.set('tutorial.livingFormPending', false);
                        state.set('session.lastDailyShown', new Date().toISOString().split('T')[0]);
                        await window.SceneLoader.loadScene(game, 'GameScene');
                        game.scene.start('GameScene', { forceMobileControls: phone });
                    }, { profile, phone: device === 'phone' });
                    await page.waitForFunction(() => window.mythicalGame.scene.getScene('GameScene')?.player?.active);
                    await page.waitForTimeout(800);
                    const read = () => page.evaluate(() => {
                        const s = window.mythicalGame.scene.getScene('GameScene'), p = s.player;
                        return { x: p.x, y: p.y, alpha: p.alpha, texture: p.texture.key, width: p.width, height: p.height,
                            body: { x: p.body.x, y: p.body.y, width: p.body.width, height: p.body.height,
                                sourceWidth: p.body.sourceWidth, sourceHeight: p.body.sourceHeight,
                                offsetX: p.body.offset.x, offsetY: p.body.offset.y }, zoom: s.cameras.main.zoom,
                            stage: GameState.get('creature.lifecycle.stage'), audioMuted: window.AudioManager.isMuted() && s.game.sound.mute };
                    });
                    const before = await read();
                    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(300); await page.keyboard.up('ArrowRight');
                    await page.keyboard.down('ArrowDown'); await page.waitForTimeout(300); await page.keyboard.up('ArrowDown');
                    const after = await read();
                    const file = `game-${device}-${id}-adult.png`;
                    await page.screenshot({ path: path.join(output, file) });
                    evidence.cases.push({ device, id, file, before, after, errors: [...errors], externalRequests: [...externalRequests] });
                    assert.equal(after.stage, 'adult');
                    assert.equal(after.alpha, 1);
                    assert.equal(after.audioMuted, true);
                    assert.ok(after.texture.includes(profile.dna.id));
                    // Breathing scales the live body; its unscaled collision contract stays fixed.
                    assert.equal(after.body.sourceWidth, 40);
                    assert.equal(after.body.sourceHeight, 60);
                    assert.equal(after.body.offsetX, (after.width - 40) / 2);
                    assert.equal(after.body.offsetY, (after.height - 60) / 2);
                    assert.ok(after.x > before.x + 5 && after.y > before.y + 5, `${id} must move right and down`);
                    assert.deepEqual(errors, []);
                    assert.deepEqual(externalRequests, []);
                    console.log(`PASS ${device} ${id}`);
                }
            } finally { await browser.close(); browser = null; }
        }
        evidence.pass = true;
        console.log(`PASS four muted adult Sanctuary cases; ${output}`);
    } finally { fs.writeFileSync(path.join(output, 'game-evidence.json'), JSON.stringify(evidence, null, 2)); }
}
const deadline = setTimeout(async () => { console.error('Game proof exceeded 120 seconds'); await cleanup(); process.exit(1); }, 120000);
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { clearTimeout(deadline); await cleanup(); });
