const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { chromium } = require('playwright');
const { smokeRendererArgs } = require('./lib/smoke-renderer-policy.cjs');
const root = path.resolve(__dirname, '..');
const output = path.resolve(root, process.env.HOTFIX_EVIDENCE || '.visual-review/explore-audio');
const profile = JSON.parse(fs.readFileSync(path.join(root, 'public/press/gameplay/real-creature-showcase/source-profiles.json'))).profiles[1];
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const report = { source: git(['rev-parse', 'HEAD']), dirty: !!git(['status', '--porcelain']),
    fixture: 'Local saved-creature/prior-progress fixture and actor positioning. Real touch/keyboard gate input, actual scene loading/return. Chromium mobile emulation, not physical iOS. No provider calls.',
    audioSafety: 'Chromium --mute-audio throughout; game muted during journeys; recovery probe additionally uses zero master/music/SFX and muted Phaser output.', cases: [] };
let browser, server, activePage;
async function cleanup() {
    try { await browser?.close(); } finally { await new Promise(resolve => server?.httpServer ? server.httpServer.close(resolve) : resolve()); }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await cleanup(); process.exit(1); });
async function main() {
    fs.mkdirSync(output, { recursive: true });
    const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
    const entry = html.match(/src="([^"]*\/assets\/index-[^"]+\.js)"/)?.[1];
    assert(entry, 'Built entry missing');
    report.entry = entry;
    report.entrySHA256 = createHash('sha256').update(fs.readFileSync(path.join(root, 'dist', entry))).digest('hex');
    const { preview } = await import('vite');
    server = await preview({ root, preview: { host: '127.0.0.1', port: 0, open: false } });
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ channel: 'chrome', headless: true,
        args: [...smokeRendererArgs(process.env), '--mute-audio', '--enable-webgl', '--ignore-gpu-blocklist'] });
    for (const [name, width, height] of [['phone', 390, 844], ['desktop', 1280, 720]]) {
        const context = await browser.newContext({ viewport: { width, height }, hasTouch: name === 'phone', serviceWorkers: 'block' });
        const page = await context.newPage();
        activePage = page;
        const result = { name, errors: [], outside: [], httpErrors: [], visits: [] }; report.cases.push(result);
        page.on('pageerror', error => result.errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()); });
        page.on('response', response => { if (response.status() >= 400) result.httpErrors.push([response.status(), response.url()]); });
        await page.route('**/*', route => {
            const url = route.request().url();
            if (/^https?:/.test(url) && !url.startsWith(base + '/')) { result.outside.push(url); return route.abort(); }
            return route.continue();
        });
        await page.addInitScript(() => {
            localStorage.setItem('audioMuted', 'true');
            localStorage.setItem('mythical_void_age_confirmed', 'true');
            localStorage.setItem('mythical_void_age_group', 'age_under_13');
            Object.defineProperty(window, 'APIConfig', { configurable: true, set(value) {
                value.isEnabled = () => false; value.isVideoEnabled = () => false;
                Object.defineProperty(window, 'APIConfig', { configurable: true, writable: true, value });
            } });
        });
        await page.goto(base + '/play/');
        await page.waitForFunction(() => window.mythicalGame?.isBooted && window.SceneLoader && window.AudioManager?.phaserSound, null, { timeout: 60000 });
        // Verify actual audio-clock recovery without sending audible output to the host.
        result.audio = await page.evaluate(() => {
            const audio = window.AudioManager;
            audio.muted = true;
            audio.masterVolume = 0; audio.musicVolume = 0; audio.sfxVolume = 0;
            audio.applyMusicGain();
            mythicalGame.sound.setMute(true);
            return { attachedToRealPhaser: audio.phaserSound === mythicalGame.sound,
                separateContexts: audio.audioContext !== mythicalGame.sound.context, recoveries: [] };
        });
        for (const kind of ['procedural', 'recorded', 'both']) {
            await page.evaluate(async kind => {
                const audio = window.AudioManager;
                const contexts = kind === 'procedural' ? [audio.audioContext] : kind === 'recorded' ? [mythicalGame.sound.context] : audio.getAudioContexts();
                await Promise.all(contexts.map(c => c.suspend()));
                audio.muted = false; // Zero gains + Phaser mute + browser mute remain in force.
            }, kind);
            if (name === 'phone') await page.touchscreen.tap(5, height / 2);
            else await page.mouse.click(5, height / 2);
            await page.waitForFunction(() => AudioManager.audioUnlocked && AudioManager.getAudioContexts().every(c => c.state === 'running'));
            const before = await page.evaluate(() => AudioManager.getAudioContexts().map(c => c.currentTime));
            await page.waitForTimeout(120);
            const after = await page.evaluate(() => AudioManager.getAudioContexts().map(c => c.currentTime));
            assert(after.every((time, index) => time > before[index]), 'An audio clock stayed frozen');
            result.audio.recoveries.push({ kind, bothClocksAdvancing: true });
        }
        await page.waitForFunction(() => mythicalGame.cache.audio.exists('themeMusic'), null, { timeout: 20000 });
        result.audio.theme = await page.evaluate(() => {
            const buffer = mythicalGame.cache.audio.get('themeMusic');
            window.hotfixThemeProbe = mythicalGame.sound.add('themeMusic', { volume: 0, mute: true });
            hotfixThemeProbe.play();
            AudioManager.playSound('coin_collect', 0);
            return { decodedSeconds: buffer.duration, sampleRate: buffer.sampleRate };
        });
        await page.waitForFunction(() => hotfixThemeProbe.isPlaying && hotfixThemeProbe.seek > 0.1);
        await page.evaluate(() => { hotfixThemeProbe.stop(); hotfixThemeProbe.destroy(); delete window.hotfixThemeProbe; });
        result.audio.theme.zeroOutputPlaybackAdvanced = true;
        await page.evaluate(() => { AudioManager.muted = true; mythicalGame.sound.setMute(true); });
        await page.evaluate(async profile => {
            const state = window.GameState, game = window.mythicalGame;
            state.saveKey = 'gate_hotfix_fixture'; state.saveBackupKeyPrefix = 'gate_hotfix_backup_'; state.saveBackupIndexKey = 'gate_hotfix_backups';
            const creature = { ...state.get('creature'), id: profile.genes.id, name: 'Aster', genes: profile.genes, dna: profile.dna,
                hatched: true, named: true, lifecycle: { ...state.get('creature.lifecycle'), stage: 'juvenile' } };
            state.set('creature', creature); state.set('creatures', [creature]); state.set('activeCreatureIndex', 0);
            for (const [key, value] of Object.entries({ 'settings.audioMuted': true, 'session.gameStarted': true,
                'tutorial.livingFormSeen': true, 'tutorial.livingFormPending': false, 'tutorial.crashStorySeen': true,
                'tutorial.controlsSeen': true, 'tutorial.villageHeartArrivalSeen': true,
                'story.projectBeacon.fieldKit.recovered': true, 'story.projectBeacon.pendingDebriefs': [],
                'story.projectBeacon.firstExpeditionDrill': { completed: true },
                'story.projectBeacon.firstForestCinematicVersion': 3, 'hubWorld.shipCompletionCutsceneShown': true,
                'levels.mythicalForest.completed': true, 'hubWorld.gates.crystal_caves.unlocked': true
            })) state.set(key, value);
            for (const key of ['GameScene', 'HubWorldScene']) assertLoaded(await SceneLoader.loadScene(game, key), key);
            function assertLoaded(ok, key) { if (!ok) throw Error('Could not load ' + key); }
            for (const s of game.scene.getScenes(false)) if (s.sys.isActive() || s.sys.isPaused()) game.scene.stop(s.sys.settings.key);
            game.scene.start('GameScene', { forceMobileControls: innerWidth < 600 });
            window.hotfixScreenPoint = (scene, object) => {
                const bounds = object.getBounds();
                const camera = scene.cameras.main;
                const point = camera.matrix.transformPoint(
                    bounds.centerX - camera.scrollX * object.scrollFactorX,
                    bounds.centerY - camera.scrollY * object.scrollFactorY
                );
                return { x: point.x, y: point.y };
            };
        }, profile);
        const tap = async point => {
            const rect = await page.locator('canvas').first().boundingBox();
            const size = await page.evaluate(() => ({ width: mythicalGame.scale.width, height: mythicalGame.scale.height }));
            const x = rect.x + point.x * rect.width / size.width, y = rect.y + point.y * rect.height / size.height;
            if (name === 'phone') await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
        };
        for (const [visit, target] of ['back', 'mythical_forest', 'mythical_forest', 'crystal_caves'].entries()) {
            console.log(`[hotfix] ${name} visit ${visit + 1} -> ${target}`);
            await page.waitForFunction(() => mythicalGame.scene.isActive('GameScene') && mythicalGame.scene.keys.GameScene.player?.body);
            await page.waitForTimeout(1200);
            // Close ordinary check-in UI through its existing button, if present.
            const greeting = await page.evaluate(() => {
                const s = mythicalGame.scene.keys.GameScene;
                const button = s.greetingElements?.find(o => o.input?.enabled);
                return button ? hotfixScreenPoint(s, button) : null;
            });
            if (greeting) await tap(greeting);
            const position = await page.evaluate(() => {
                const s = mythicalGame.scene.keys.GameScene;
                s.player.body.reset(s.hubPortal.x, s.hubPortal.y + 45);
                s.player.body.setVelocity(0, 0);
                s.cameras.main.centerOn(s.player.x, s.player.y);
                s.sanctuaryInteractionDirector?.update({ force: true });
                const b = s.mobileControls?.actionButtons?.interact;
                return { cooldown: s.hubEntryCooldown, button: b ? hotfixScreenPoint(s, b.zone) : null };
            });
            assert.equal(position.cooldown, false, 'Gate cooldown survived a return');
            if (visit === 3) await page.evaluate(() => document.getElementById('loading-overlay')?.remove());
            await page.waitForTimeout(200);
            if (name === 'phone') { assert(position.button, 'Touch Explore control missing'); await tap(position.button); }
            else await page.keyboard.press('Space', { delay: 100 });
            await page.waitForFunction(() => mythicalGame.scene.isActive('HubWorldScene') && mythicalGame.scene.keys.HubWorldScene.actionLabel, null, { timeout: 20000 });
            await page.screenshot({ path: path.join(output, `${name}-hub-visit-${visit + 1}.png`) });
            if (target === 'back') {
                const back = await page.evaluate(() => {
                    const s = mythicalGame.scene.keys.HubWorldScene;
                    const b = s.children.list.find(o => o.text === '\u2190 Back');
                    return hotfixScreenPoint(s, b);
                });
                await tap(back);
            } else {
                const action = await page.evaluate(target => {
                    const s = mythicalGame.scene.keys.HubWorldScene;
                    s.selectGate(s.gates.findIndex(g => g.id === target));
                    return hotfixScreenPoint(s, s.actionLabel);
                }, target);
                await tap(action);
                const key = target === 'mythical_forest' ? 'MythicalForestLevel' : 'CrystalCavesLevel';
                await page.waitForFunction(key => mythicalGame.scene.isActive(key) && mythicalGame.scene.keys[key].player?.body, key, { timeout: 25000 });
                await page.screenshot({ path: path.join(output, `${name}-level-visit-${visit + 1}.png`) });
                await page.evaluate(key => mythicalGame.scene.keys[key].returnToSanctuary(), key);
            }
            result.visits.push({ visit: visit + 1, target, entered: true, missingOverlayRecovered: visit === 3 });
        }
        assert.deepEqual(result.errors, []); assert.deepEqual(result.outside, []); assert.deepEqual(result.httpErrors, []);
        await context.close();
    }
    report.passed = true;
}
main().catch(async error => {
    report.error = error.stack; process.exitCode = 1;
    if (activePage && !activePage.isClosed()) {
        await activePage.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
        report.diagnostic = await activePage.evaluate(() => {
            const s = mythicalGame.scene.keys.GameScene;
            return { scenes: mythicalGame.scene.getScenes(true).map(s => s.sys.settings.key),
                cooldown: s.hubEntryCooldown, transition: !!s.hubEntryTransition, nearHub: s.nearHubPortal,
                player: { x: s.player?.x, y: s.player?.y }, portal: { x: s.hubPortal?.x, y: s.hubPortal?.y },
                zoom: s.cameras?.main?.zoom, focus: s.sanctuaryFocusModeActive,
                tutorial: s.controlsTutorial?.isVisible, onboarding: window.OnboardingManager?.currentStep,
                texts: s.children?.list?.filter(o => o.text && o.visible).map(o => o.text).slice(-35) };
        }).catch(() => null);
    }
}).finally(async () => {
    await cleanup();
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
});
