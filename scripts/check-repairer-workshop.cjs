#!/usr/bin/env node
// Local staged save; actual shop inputs, purchases, practice and scene cleanup.
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.visual-review/repairer-implementation');
const port = 19181;
const origin = `http://127.0.0.1:${port}`;
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
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => { await cleanup(); process.exit(1); });
const timeout = setTimeout(async () => { await cleanup(); process.exit(1); }, 180000);

async function run() {
    fs.mkdirSync(output, { recursive: true });
    const evidence = { sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
        sourceStatus: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(),
        muted: true, stagedSave: true, publicationAuthorized: false, cases: [] };
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
        { cwd: root, env: { ...process.env, BROWSER: 'none' }, stdio: 'ignore' });
    try {
        for (let i = 0; i < 100; i++) {
            if (server.exitCode !== null) throw Error('Preview failed');
            try { if ((await fetch(origin + '/play/')).ok) break; } catch {}
            await delay(100);
        }
        browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
        for (const [device, width, height] of [['phone', 390, 844], ['desktop', 1280, 720]]) {
            const context = await browser.newContext({ viewport: { width, height }, isMobile: device === 'phone', hasTouch: device === 'phone', serviceWorkers: 'block' });
            const page = await context.newPage();
            const result = { device, errors: [], externalRequests: [], failedResponses: [] };
            let portraitRequests = 0;
            page.on('request', request => { if (request.url().endsWith('/game/residents/repairer-portrait.webp')) portraitRequests++; });
            evidence.cases.push(result);
            page.on('pageerror', e => result.errors.push(e.message));
            page.on('console', m => { if (m.type() === 'error') result.errors.push(m.text()); });
            page.on('response', r => { if (r.status() >= 400) result.failedResponses.push([r.url(), r.status()]); });
            await page.route('**/*', route => {
                const url = new URL(route.request().url());
                if (url.origin !== origin) { result.externalRequests.push(url.origin + url.pathname); return route.abort(); }
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
            const tapCanvas = async expression => {
                const point = await page.evaluate(expression => {
                    const object = Function(`return (${expression})`)();
                    const bounds = object.getBounds();
                    const canvas = window.mythicalGame.canvas.getBoundingClientRect();
                    return { x: canvas.x + bounds.centerX * canvas.width / window.mythicalGame.scale.width,
                        y: canvas.y + bounds.centerY * canvas.height / window.mythicalGame.scale.height };
                }, expression);
                if (device === 'phone') await page.touchscreen.tap(point.x, point.y);
                else await page.mouse.click(point.x, point.y);
            };
            await page.goto(origin + '/play/');
            await page.waitForFunction(() => window.GameState && window.mythicalGame?.scene.isActive('HatchingScene'), null, { timeout: 60000 });
            const profile = require('../public/press/gameplay/real-creature-showcase/source-profiles.json').profiles.find(p => p.id === 'MV-0153');
            await page.evaluate(async profile => {
                const game = window.mythicalGame, state = window.GameState;
                game.sound.mute = true;
                const creature = { ...state.get('creature'), id: profile.genes.id, name: profile.id,
                    hatched: true, named: true, genes: profile.genes, genetics: profile.genes, dna: profile.dna,
                    lifecycle: { ...state.get('creature.lifecycle'), stage: 'baby' } };
                state.set('creature', creature); state.set('creatures', [creature]); state.set('activeCreatureIndex', 0);
                for (const flag of ['controlsSeen', 'crashStorySeen', 'livingFormSeen', 'villageHeartArrivalSeen']) state.set(`tutorial.${flag}`, true);
                state.set('session.lastDailyShown', new Date().toISOString().split('T')[0]);
                game.scene.stop('HatchingScene');
                await window.SceneLoader.loadScene(game, 'GameScene');
                game.scene.start('GameScene', { biome: 'nebula' });
            }, profile);
            await page.waitForFunction(() => window.mythicalGame?.scene.getScene('GameScene')?.shop?.repairer, null, { timeout: 60000 });
            await page.evaluate(() => {
                const game = window.mythicalGame, state = window.GameState, scene = game.scene.getScene('GameScene');
                game.sound.mute = true;
                state.set('story.projectBeacon.fieldKit', { recovered: true, katana: { upgradeSlots: 2, installedUpgrades: ['crystal_edge', { id: 'aurora_guard' }] } });
                state.set('player.cosmicCoins', 1000);
                window.InventoryManager.inventory = [];
                state.set('inventory.items', []);
                scene.player.setPosition(scene.shop.x - 140, scene.shop.y + 65);
                scene.cameras.main.stopFollow();
                scene.cameras.main.centerOn(scene.shop.x - 55, scene.shop.y);
            });
            await page.waitForTimeout(6500);
            await page.screenshot({ path: path.join(output, `${device}-stall.png`) });
            const phases = [];
            for (let i = 0; i < 2; i++) {
                phases.push(await page.evaluate(() => window.mythicalGame.scene.getScene('GameScene').shop.repairer.arm.rotation));
                await page.waitForTimeout(200);
            }
            assert.notEqual(phases[0], phases[1], 'resident really works rather than a static portrait on the map');
            await page.evaluate(() => window.mythicalGame.scene.getScene('GameScene').openShop());
            await page.waitForFunction(() => window.mythicalGame.scene.isActive('ShopScene') && window.mythicalGame.scene.getScene('ShopScene').workbenchButton);
            await page.screenshot({ path: path.join(output, `${device}-shop.png`) });
            assert.equal(portraitRequests, 0, 'the portrait adds nothing to the opening download');
            const before = await page.evaluate(() => JSON.stringify({ kit: window.GameState.get('story.projectBeacon.fieldKit'), items: window.GameState.get('inventory.items'), coins: window.GameState.get('player.cosmicCoins') }));
            await tapCanvas("window.mythicalGame.scene.getScene('ShopScene').workbenchButton");
            await page.getByRole('dialog', { name: 'The repairer workbench' }).waitFor();
            await page.locator('.repairer-portrait').evaluate(image => image.decode());
            assert.equal(portraitRequests, 1);
            result.portraitLazyLoaded = true;
            await page.locator('.repairer-katana').evaluate(image => image.decode());
            await page.screenshot({ path: path.join(output, `${device}-workbench.png`) });
            result.layout = await page.evaluate(() => {
                const dialog = document.querySelector('.repairer-shell');
                const close = document.querySelector('.repairer-close').getBoundingClientRect();
                return { horizontalOverflow: dialog.scrollWidth > dialog.clientWidth + 1,
                    closeVisible: close.top >= 0 && close.bottom <= innerHeight,
                    fitted: document.querySelectorAll('.repairer-upgrade.is-fitted').length };
            });
            assert.equal(result.layout.horizontalOverflow, false);
            assert.equal(result.layout.closeVisible, true);
            assert.equal(result.layout.fitted, 2);
            await page.getByRole('button', { name: 'Try a strike' }).click();
            await page.waitForFunction(() => window.mythicalGame.scene.getScene('ShopScene')?.repairerWorkbench?.practice);
            await tapCanvas("window.mythicalGame.scene.getScene('ShopScene').repairerWorkbench.practice.strikeButton");
            result.strike = await page.evaluate(() => window.mythicalGame.scene.getScene('ShopScene').repairerWorkbench.practice.lastStrike);
            assert.deepEqual(result.strike, { hit: true, damage: 3, health: 3 });
            await page.screenshot({ path: path.join(output, `${device}-practice.png`) });
            await page.waitForTimeout(400);
            await tapCanvas("window.mythicalGame.scene.getScene('ShopScene').repairerWorkbench.practice.rangeButton");
            await tapCanvas("window.mythicalGame.scene.getScene('ShopScene').repairerWorkbench.practice.strikeButton");
            result.farStrike = await page.evaluate(() => window.mythicalGame.scene.getScene('ShopScene').repairerWorkbench.practice.lastStrike);
            assert.equal(result.farStrike.hit, true);
            await tapCanvas("window.mythicalGame.scene.getScene('ShopScene').repairerWorkbench.practice.backButton");
            const after = await page.evaluate(() => JSON.stringify({ kit: window.GameState.get('story.projectBeacon.fieldKit'), items: window.GameState.get('inventory.items'), coins: window.GameState.get('player.cosmicCoins') }));
            assert.equal(after, before, 'bench and practice do not alter real rewards, items or coins');
            await page.getByRole('button', { name: 'Browse supplies' }).click();
            assert.equal(await page.evaluate(() => window.mythicalGame.scene.getScene('ShopScene').selectedCategory), 'powerups');
            await tapCanvas("window.mythicalGame.scene.getScene('ShopScene').workbenchButton");
            await page.getByRole('button', { name: 'Back to shop' }).click();
            // Existing purchase path stays usable after the new modal and practice.
            await tapCanvas("window.mythicalGame.scene.getScene('ShopScene').categoryButtons.find(button => button.id === 'food').zone");
            await page.waitForFunction(() => window.mythicalGame.scene.getScene('ShopScene').selectedCategory === 'food');
            // Phaser registers new catalog hit areas at the next frame boundary.
            await page.waitForTimeout(100);
            result.priceClear = await page.evaluate(() => {
                const scene = window.mythicalGame.scene.getScene('ShopScene');
                const price = scene.catalogContainer.list.find(o => o.type === 'Text' && o.text === '20').getBounds();
                const buy = scene.itemButtons[0].zone.getBounds();
                return price.bottom < buy.top || price.right < buy.left;
            });
            assert.equal(result.priceClear, true);
            await tapCanvas("window.mythicalGame.scene.getScene('ShopScene').itemButtons[0].zone");
            await page.waitForFunction(() => window.mythicalGame.scene.getScene('ShopScene').closePurchaseDialog);
            // Find the real confirmation action by its text and adjacent zone.
            await page.screenshot({ path: path.join(output, `${device}-purchase.png`) });
            await tapCanvas("window.mythicalGame.scene.getScene('ShopScene').children.list.find(o => o.type === 'Text' && o.text === 'Confirm')");
            await page.waitForFunction(expectedCoins => window.GameState.get('player.cosmicCoins') === expectedCoins && window.InventoryManager.inventory.some(i => i.id === 'stardust_treat'), JSON.parse(before).coins - 20);
            result.purchasePassed = true;
            await page.waitForTimeout(1200);
            await tapCanvas("window.mythicalGame.scene.getScene('ShopScene').workbenchButton");
            await page.getByRole('dialog', { name: 'The repairer workbench' }).waitFor();
            // CSS dialog survives rotation; practice returns safely to it.
            if (device === 'phone') {
                await page.setViewportSize({ width: 844, height: 390 });
                await page.waitForTimeout(250);
                assert.equal(await page.locator('.repairer-workbench').count(), 1);
                await page.getByRole('button', { name: 'Try a strike' }).click();
                await page.waitForFunction(() => window.mythicalGame.scene.getScene('ShopScene')?.repairerWorkbench?.practice);
                await page.screenshot({ path: path.join(output, 'phone-landscape-practice.png') });
                await page.setViewportSize({ width: 390, height: 844 });
                await page.waitForFunction(() => !document.querySelector('.repairer-workbench')?.hidden);
                result.rotationPassed = true;
            }
            await page.getByRole('button', { name: 'Back to shop' }).click();
            await page.waitForTimeout(250);
            await page.waitForFunction(width => window.mythicalGame.scene.getScene('ShopScene').dims.width === width, width);
            await tapCanvas("window.mythicalGame.scene.getScene('ShopScene').workbenchButton");
            await page.getByRole('dialog', { name: 'The repairer workbench' }).waitFor();
            // A forced scene shutdown while the workbench is open must remove its DOM.
            await page.evaluate(() => {
                window.mythicalGame.scene.stop('ShopScene');
            });
            await page.waitForTimeout(150);
            assert.equal(await page.locator('.repairer-workbench').count(), 0);
            assert.deepEqual(result.errors, []);
            assert.deepEqual(result.failedResponses, []);
            assert.deepEqual(result.externalRequests, []);
            result.passed = true;
            await context.close();
        }
    } finally {
        fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(evidence, null, 2));
    }
    console.log(JSON.stringify(evidence, null, 2));
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { clearTimeout(timeout); await cleanup(); });
