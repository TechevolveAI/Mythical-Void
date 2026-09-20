const assert = require('node:assert/strict');
const path = require('node:path');

// Uses the existing muted, isolated browser fixture; this is a staged visual
// check of decorations and the real rescue presentation, not a boss-play proof.
module.exports = async function captureFlags(page, { device, output }) {
    for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.mythicalGame.scene.getScene('GameScene').children.list
            .filter(object => object.getData?.('achievementDismissTarget'))
            .forEach(object => object.emit('pointerup')));
        await page.waitForTimeout(350);
    }
    await page.screenshot({ path: path.join(output, `${device}-stall.png`) });
    const initial = await page.evaluate(() => {
        const scene = window.mythicalGame.scene.getScene('GameScene');
        const flags = scene.children.list.filter(object => object.getData?.('decorativeFlag'));
        return flags.map(flag => ({ placement: flag.getData('flagPlacement'), interactive: !!flag.input, physics: !!flag.body }));
    });
    assert.deepEqual(initial.map(flag => flag.placement).sort(), ['repairer-stall', 'ship']);
    assert(initial.every(flag => !flag.interactive && !flag.physics));
    await page.evaluate(() => {
        const scene = window.mythicalGame.scene.getScene('GameScene');
        const flag = scene.children.list.find(object => object.getData?.('flagPlacement') === 'ship');
        scene.cameras.main.centerOn(flag.x, flag.y + 30);
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(output, `${device}-ship-flag.png`) });
    await page.evaluate(() => {
        const scene = window.mythicalGame.scene.getScene('GameScene');
        const result = window.RescuedResidents.recordRescuedResident(window.GameState, 'mythicalForest', { save: false });
        window.RescuedResidents.acknowledgeRescuedResidentArrival(window.GameState, result.resident.id, { save: false });
        scene.worldBuilder.refreshRescuedResidents(scene.signalGarden, window.RescuedResidents.getRescuedResidentSnapshot(window.GameState));
        scene.cameras.main.centerOn(scene.signalGarden.welcomeFlag.x, scene.signalGarden.welcomeFlag.y + 25);
    });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(output, `${device}-welcome-flag.png`) });
    assert.equal(await page.evaluate(() => window.mythicalGame.scene.getScene('GameScene').children.list.filter(o => o.getData?.('flagPlacement') === 'sanctuary-welcome').length), 1);
    await page.evaluate(async () => {
        const game = window.mythicalGame;
        game.scene.stop('GameScene');
        await window.SceneLoader.loadScene(game, 'MythicalForestLevel');
        game.scene.start('MythicalForestLevel');
    });
    await page.waitForFunction(() => window.mythicalGame.scene.getScene('MythicalForestLevel')?.graphicsEngine);
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
        const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
        scene.levelEntryKeyHandler?.({ key: 'Enter', preventDefault() {} });
    });
    await page.waitForTimeout(700);
    const before = await page.evaluate(() => JSON.stringify(window.GameState.get('world.rescuedResidents')));
    await page.evaluate(() => {
        const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
        scene.clearFirstExpeditionDrill();
        scene.enterLevelCompletionState();
        const resident = window.RescuedResidents.getRescuedResidentSnapshot(window.GameState).rescued[0];
        scene.showRescuedResidentReleaseMoment({ ...resident, newlyRescued: true });
    });
    await page.waitForTimeout(1900);
    await page.screenshot({ path: path.join(output, `${device}-rescue-flag.png`) });
    assert.equal(await page.evaluate(() => JSON.stringify(window.GameState.get('world.rescuedResidents'))), before);
    const banner = await page.evaluate(() => {
        const scene = window.mythicalGame.scene.getScene('MythicalForestLevel');
        const flag = scene.children.list.find(o => o.getData?.('flagPlacement') === 'rescue-welcome');
        return { alpha: flag.alpha, x: flag.x, y: flag.y, width: scene.scale.width, height: scene.scale.height,
            interactive: !!flag.input, physics: !!flag.body };
    });
    assert.equal(banner.alpha, 1);
    assert(banner.x > 0 && banner.x + 32 < banner.width && banner.y > 0 && banner.y + 40 < banner.height);
    assert(!banner.interactive && !banner.physics);
    // Shutdown while the rescue is open must clean up the fabric update listener.
    await page.evaluate(() => window.mythicalGame.scene.stop('MythicalForestLevel'));
    await page.waitForTimeout(200);
    return { initialDecorations: initial, welcomeFlag: true, rescueFlag: banner, stagedRescue: true, rescueStateUnchanged: true };
};
