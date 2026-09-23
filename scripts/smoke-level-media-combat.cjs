const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { smokeRendererArgs } = require('./lib/smoke-renderer-policy.cjs');
const root = path.resolve(__dirname, '..');
const output = path.resolve(root, process.env.REPAIR_EVIDENCE || '.visual-review/media-combat-proof');
const profile = JSON.parse(fs.readFileSync(path.join(root, 'public/press/gameplay/real-creature-showcase/source-profiles.json'))).profiles[1];
let browser, server;
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()),
    fixture: 'Local prior-progress and local video fixture; arena positioning and healing between openings. No hosted generation. Not a physical-device or difficulty test.', cases: [] };
async function cleanup() { try { await browser?.close(); } finally { await new Promise(r => server?.httpServer ? server.httpServer.close(r) : r()); } }
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await cleanup(); process.exit(1); });
async function main() {
    fs.mkdirSync(output, { recursive: true });
    const { preview } = await import('vite');
    server = await preview({ root, preview: { host: '127.0.0.1', port: 0, open: false } });
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ channel: 'chrome', headless: true,
        args: [...smokeRendererArgs(process.env), '--mute-audio', '--enable-webgl', '--ignore-gpu-blocklist'] });
    for (const [name, width, height] of [['phone', 390, 844], ['desktop', 1280, 720]]) {
        console.log('[smoke] ' + name + ': starting');
        const context = await browser.newContext({ viewport: { width, height }, hasTouch: name === 'phone', serviceWorkers: 'block' });
        const page = await context.newPage();
        const result = { name, errors: [], outside: [], responses: [] }; report.cases.push(result);
        page.on('pageerror', error => result.errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()); });
        page.on('response', r => { if (r.status() >= 400) result.responses.push([r.status(), r.url()]); });
        await page.route('**/*', route => {
            const url = route.request().url();
            if (/^https?:/.test(url) && !url.startsWith(base + '/')) { result.outside.push(url); return route.abort(); }
            return route.continue();
        });
        await page.addInitScript(() => {
            localStorage.setItem('audioMuted', 'true');
            localStorage.setItem('mythical_void_age_confirmed', 'true');
            localStorage.setItem('mythical_void_age_group', 'age_under_13');
            for (const name of ['AudioManager', 'APIConfig', 'Phaser']) Object.defineProperty(window, name, {
                configurable: true, set(value) {
                    if (name === 'AudioManager') Object.defineProperty(value, 'muted', { configurable: true, get: () => true, set() {} });
                    if (name === 'APIConfig') { value.isEnabled = () => false; value.isVideoEnabled = () => false; }
                    if (name === 'Phaser') {
                        const Game = value.Game;
                        value.Game = class extends Game { constructor(config) { super({ ...config, audio: { noAudio: true } }); } };
                    }
                    Object.defineProperty(window, name, { configurable: true, writable: true, value });
                }
            });
        });
        await page.goto(base + '/play/?testEnding=repair-fixture');
        await page.waitForFunction(() => window.mythicalGame?.isBooted && window.GameState?.state && window.SceneLoader, null, { timeout: 60000 });
        await page.evaluate(async profile => {
            const state = window.GameState, game = window.mythicalGame;
            window.game = game;
            state.saveKey = 'media_combat_fixture'; state.saveBackupKeyPrefix = 'media_combat_backup_'; state.saveBackupIndexKey = 'media_combat_backups';
            const creature = { ...state.get('creature'), id: profile.genes.id, name: 'Aster', genes: profile.genes, dna: profile.dna,
                hatched: true, named: true, lifecycle: { ...state.get('creature.lifecycle'), stage: 'juvenile' } };
            state.set('creature', creature); state.set('creatures', [creature]); state.set('activeCreatureIndex', 0);
            for (const [key, value] of Object.entries({
                'settings.audioMuted': true, 'session.gameStarted': true, 'tutorial.livingFormSeen': true,
                'tutorial.livingFormPending': false, 'tutorial.crashStorySeen': true, 'tutorial.controlsSeen': true,
                'story.projectBeacon.fieldKit.recovered': true, 'story.projectBeacon.pendingDebriefs': [],
                'story.projectBeacon.firstExpeditionDrill': { completed: true },
                'story.projectBeacon.firstForestCinematicVersion': 3, 'hubWorld.shipCompletionCutsceneShown': true
            })) state.set(key, value);
            for (const key of ['MythicalForestLevel', 'VoidPeaksLevel']) {
                if (!await window.SceneLoader.loadScene(game, key)) throw Error('Cannot load ' + key);
            }
            window.enterFixture = key => {
                for (const scene of game.scene.getScenes(false)) if (scene.sys.isActive() || scene.sys.isPaused()) game.scene.stop(scene.sys.settings.key);
                game.scene.start(key);
                window.testScene = game.scene.keys[key];
            };
            window.exerciseRoute = (s, activation) => {
                s.testMode = false; s.entryPreview = false;
                const property = s.orderedRouteSignalOptions?.activeProperty || 'activated';
                return [2, 0, 1].map(index => {
                    const signals = s.orderedRouteSignals;
                    s[activation](signals[index]);
                    const checkpoint = window.GameState.get('story.projectBeacon.expeditionCheckpoint');
                    const clone = signals.map(signal => ({ ...signal, [property]: false, zone: null, label: null, visual: null }));
                    const restored = {};
                    const ok = s.restoreExpeditionRouteSignals.call(restored, checkpoint, {
                        signals: clone, activeProperty: property, countProperty: 'count', readyProperty: 'ready', drawSignal() {}
                    });
                    return { mask: checkpoint?.routeSignalMask, count: signals.filter(signal => signal[property]).length,
                        restoreOK: ok, restoredMask: clone.reduce((mask, signal, i) => mask | (signal[property] ? 1 << i : 0), 0) };
                });
            };
            enterFixture('VoidPeaksLevel');
        }, profile);
        await page.waitForFunction(() => testScene.player?.body && testScene.orderedRouteSignals?.length === 3);
        await page.waitForFunction(() => typeof testScene.levelEntryKeyHandler === 'function');
        if (name === 'phone') await page.touchscreen.tap(width / 2, height / 2);
        else await page.keyboard.press('Enter');
        await page.waitForFunction(() => !testScene.physics.world.isPaused && !testScene.levelEntryKeyHandler);
        await page.waitForTimeout(1000);
        result.routeOrder = await page.evaluate(() => {
            const s = testScene; const signals = s.orderedRouteSignals;
            return [2, 0, 1].map(index => ({ index, allowed: s.canActivateOrderedRouteSignal(signals[index], signals, 0), alpha: signals[index].visual?.alpha }));
        });
        assert(result.routeOrder.every(r => r.allowed && r.alpha >= 0.7));
        result.peakActivation = await page.evaluate(() => exerciseRoute(testScene, 'activateSignalRelay'));
        assert.deepEqual(result.peakActivation.map(s => s.mask), [4,5,7]);
        assert.deepEqual(result.peakActivation.map(s => s.restoredMask), [4,5,7]);
        await page.evaluate(() => {
            const s = testScene;
            window.fixtureVideos = [{ identityKey: 'video-fixture', stage: 'juvenile', momentId: 'first_forest_arrival', assetRef: 'forest' }];
            window.fixtureWatched = [];
            const media = window.CompanionMediaService;
            media.getUnviewedGeneratedVideos = () => fixtureVideos.filter(r => !fixtureWatched.includes(r.assetRef));
            media.resolveGeneratedVideo = async () => ({ videoUrl: '/game/cinematics/trumptopus-arrival-v1.mp4' });
            media.recordAppearance = () => { fixtureWatched.push('peaks'); };
            window.GameState.getCreaturePortrait = () => ({ identityKey: 'video-fixture', stage: 'juvenile' });
            s.generatedVideoDeliveryPending = true; s.generatedVideoDeliveryCheckAt = 0;
        });
        await page.waitForTimeout(1500);
        assert.equal(await page.locator('.story-video-notice').count(), 0, 'Forest clip leaked into Peaks');
        await page.evaluate(() => {
            fixtureVideos = [{ ...fixtureVideos[0], momentId: 'guardian_rescue_cosmic_titan', assetRef: 'peaks' }];
            testScene.generatedVideoDeliveryPending = true; testScene.generatedVideoDeliveryCheckAt = 0;
        });
        await page.locator('.story-video-notice').waitFor();
        assert((await page.locator('.story-video-notice').innerText()).includes('Void Peaks'));
        await page.screenshot({ path: path.join(output, `${name}-film-notice.png`) });
        await page.locator('.story-video-notice').getByRole('button', { name: 'Watch', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('.prepared-film-player video')?.currentTime > 0.5, null, { timeout: 20000 });
        assert(await page.evaluate(() => testScene.sys.isPaused() && document.querySelector('video').muted));
        await page.waitForFunction(() => document.querySelector('.prepared-film-player video')?.currentTime > 4.8, null, { timeout: 15000 });
        await page.screenshot({ path: path.join(output, `${name}-film-playing.png`) });
        await page.locator('.prepared-film-player').getByRole('button', { name: 'Continue', exact: true }).click();
        await page.waitForFunction(() => testScene.sys.isActive());
        await page.waitForTimeout(1100);
        assert.equal(await page.locator('.story-video-notice').count(), 0);
        result.video = { realmScoped: true, actualMutedPlayback: true, exceededOldCutoff: true, resumed: true, repeatNotice: false };
        await page.evaluate(() => {
            fixtureVideos = [];
            const s = testScene;
            s.creatureNetworkReached = true;
            s.health = s.maxHealth;
            s.startBossFight();
            window.attackTrace = [];
            const execute = s.executeTitanAttack.bind(s);
            s.executeTitanAttack = (kind, target) => { attackTrace.push({ kind, x: s.boss.x, time: s.time.now }); return execute(kind, target); };
        });
        await page.waitForFunction(() => testScene.bossCombatReady, null, { timeout: 15000 });
        result.mountain = await page.evaluate(() => ({
            displayHeight: testScene.boss.displayHeight, depth: testScene.boss.depth,
            terrainDepth: testScene.mountainStone.depth, feetY: testScene.boss.y,
            x: testScene.boss.x, playerX: testScene.player.x, health: testScene.bossHealth,
            bounds: { left: testScene.boss.getBounds().left - testScene.cameras.main.scrollX,
                right: testScene.boss.getBounds().right - testScene.cameras.main.scrollX },
            astronautBounds: {
                left: testScene.astronautFollower.sprite.getBounds().left - testScene.cameras.main.scrollX,
                right: testScene.astronautFollower.sprite.getBounds().right - testScene.cameras.main.scrollX
            },
            entranceDamageRejected: testScene.damageBoss(100) === false
        }));
        assert(result.mountain.displayHeight < 300 && result.mountain.depth > result.mountain.terrainDepth);
        assert(result.mountain.entranceDamageRejected);
        assert(result.mountain.bounds.left >= 0 && result.mountain.bounds.right <= width, 'Mountain entrance is clipped');
        assert(result.mountain.astronautBounds.left >= 0 && result.mountain.astronautBounds.right <= width, 'Astronaut entrance is clipped');
        await page.screenshot({ path: path.join(output, `${name}-mountain-awake.png`) });
        await page.waitForFunction(() => attackTrace.length >= 3, null, { timeout: 45000 });
        await page.waitForTimeout(1100);
        result.mountain.attacks = await page.evaluate(() => attackTrace);
        result.mountain.damageTaken = await page.evaluate(() => testScene.maxHealth - testScene.health);
        assert(new Set(result.mountain.attacks.map(a => a.kind)).size >= 3);
        assert(result.mountain.attacks.some(a => Math.abs(a.x - result.mountain.x) >= 30));
        await page.screenshot({ path: path.join(output, `${name}-mountain-snow-grenade.png`) });
        // Normal katana input against a real body and naturally timed openings.
        // Arena positioning is a fixture, not a traversal or difficulty claim.
        for (let windowIndex = 0; windowIndex < 7; windowIndex++) {
            if (await page.evaluate(() => testScene.bossDefeated)) break;
            await page.evaluate(() => { testScene.health = testScene.maxHealth; });
            await page.waitForFunction(() => testScene.time.now < testScene.titanRecoveryUntil && testScene.titanRecoveryDamage === 0, null, { timeout: 15000 });
            await page.evaluate(() => {
                const s = testScene;
                s.player.setX(s.boss.x + 72); s.player.facingRight = false;
                s.player.body.updateFromGameObject();
                s.player.setVelocity(0, 0);
            });
            for (let hit = 0; hit < 3; hit++) {
                if (name === 'desktop') await page.keyboard.press('KeyX');
                else {
                    const p = await page.evaluate(() => {
                        const s = testScene, t = s.mobileControlTargets.melee, r = game.canvas.getBoundingClientRect();
                        return { x: r.left + t.x * r.width / s.scale.width, y: r.top + t.y * r.height / s.scale.height };
                    });
                    await page.touchscreen.tap(p.x, p.y);
                }
                await page.waitForTimeout(420);
            }
        }
        result.mountain.victory = await page.evaluate(() => ({ defeated: testScene.bossDefeated,
            saved: window.GameState.get('levels.voidPeaks.completed'), attacks: testScene.titanAttacksCompleted }));
        assert(result.mountain.victory.defeated && result.mountain.victory.saved, 'Normal attacks failed to finish and save the mountain battle');
        console.log('[smoke] ' + name + ': mountain victory saved');
        await page.evaluate(() => enterFixture('MythicalForestLevel'));
        await page.waitForFunction(() => testScene.player?.body && testScene.checkpointAnchors?.length === 3);
        await page.waitForFunction(() => testScene.levelEntryElements?.length > 0);
        if (name === 'phone') await page.touchscreen.tap(width / 2, height / 2);
        else await page.keyboard.press('Enter');
        await page.waitForFunction(() => !testScene.levelEntryElements?.length && !testScene.physics.world.isPaused);
        assert(await page.evaluate(() => !testScene.isMobile || testScene.platformerControlsVisible));
        result.forestRoute = await page.evaluate(() => {
            const s = testScene;
            return [2,0,1].map(index => ({ index, allowed: s.canActivateOrderedRouteSignal(s.checkpointAnchors[index], s.checkpointAnchors, 0),
                alpha: s.checkpointAnchors[index].visual.alpha }));
        });
        assert(result.forestRoute.every(r => r.allowed && r.alpha >= 0.7));
        await page.screenshot({ path: path.join(output, `${name}-forest-roots.png`) });
        result.forestActivation = await page.evaluate(() => exerciseRoute(testScene, 'activateBeaconCheckpoint'));
        assert.deepEqual(result.forestActivation.map(s => s.mask), [4,5,7]);
        assert.deepEqual(result.forestActivation.map(s => s.restoredMask), [4,5,7]);
        assert.deepEqual(result.forestActivation.map(s => s.count), [1,2,3]);
        await page.evaluate(() => {
            const s = testScene;
            s.health = s.maxHealth;
            window.forestTrace = [];
            const execute = s.executeBossAttack.bind(s);
            s.executeBossAttack = (...args) => { forestTrace.push(args[0]); return execute(...args); };
        });
        await page.waitForFunction(() => testScene.bossEntranceComplete, null, { timeout: 15000 });
        await page.screenshot({ path: path.join(output, `${name}-forest-battle.png`) });
        for (let opening = 0; opening < 8; opening++) {
            if (await page.evaluate(() => testScene.bossDefeated)) break;
            await page.evaluate(() => { testScene.health = testScene.maxHealth; });
            await page.waitForFunction(() => testScene.boss?.isRecovering && testScene.forestRecoveryDamage === 0 && !testScene.bossPhaseTransitioning, null, { timeout: 18000 });
            await page.evaluate(() => {
                const s = testScene;
                s.player.setX(s.boss.x + 70); s.player.facingRight = false;
                s.player.body.updateFromGameObject(); s.player.setVelocity(0, 0);
            });
            for (let hit = 0; hit < 3; hit++) {
                if (name === 'desktop') await page.keyboard.press('KeyX');
                else {
                    const p = await page.evaluate(() => {
                        const s = testScene, t = s.mobileControlTargets.melee, r = game.canvas.getBoundingClientRect();
                        return { x: r.left + t.x * r.width / s.scale.width, y: r.top + t.y * r.height / s.scale.height };
                    });
                    await page.touchscreen.tap(p.x, p.y);
                }
                await page.waitForTimeout(430);
            }
        }
        await page.waitForFunction(() => window.GameState.get('levels.mythicalForest.completed') === true, null, { timeout: 18000 });
        result.forestBattle = await page.evaluate(() => ({ defeated: testScene.bossDefeated,
            saved: window.GameState.get('levels.mythicalForest.completed'), attacks: forestTrace,
            health: testScene.bossHealth, controlsVisible: testScene.platformerControlsVisible }));
        assert(result.forestBattle.defeated && result.forestBattle.saved, 'Forest normal attacks failed to finish and save');
        assert(new Set(result.forestBattle.attacks).size >= 3, 'Forest skipped its battle patterns');
        console.log('[smoke] ' + name + ': Forest victory saved');
        result.otherRoutes = [];
        for (const [key, activation] of [['CrystalCavesLevel', 'activateCaveBeacon'], ['ReefLevel', 'activateBeaconWaypoint'], ['AuroraDepthsLevel', 'alignSignalPrism']]) {
            await page.evaluate(async key => {
                await window.SceneLoader.loadScene(game, key);
                enterFixture(key);
            }, key);
            await page.waitForFunction(() => testScene.player?.body && testScene.orderedRouteSignals?.length === 3);
            const progress = await page.evaluate(activation => exerciseRoute(testScene, activation), activation);
            assert.deepEqual(progress.map(s => s.mask), [4,5,7], key + ' saved wrong progress');
            assert.deepEqual(progress.map(s => s.restoredMask), [4,5,7], key + ' restored wrong progress');
            result.otherRoutes.push({ key, progress });
        }
        assert.deepEqual(result.errors, []); assert.deepEqual(result.outside, []); assert.deepEqual(result.responses, []);
        await context.close();
    }
}
main().catch(error => { report.failure = error.stack; process.exitCode = 1; }).finally(async () => {
    await cleanup(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
});
