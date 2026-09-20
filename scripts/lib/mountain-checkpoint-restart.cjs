const assert = require('node:assert/strict');
const path = require('node:path');

async function runMountainCheckpointRestart(page, device, output) {
    const legacy = await page.evaluate(() => {
        const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
        const checkpoint = window.GameState.get('story.projectBeacon.expeditionCheckpoint');
        if (checkpoint?.checkpointId !== 'peaks_relay_3') throw Error('expected the earned summit checkpoint');
        // Protected baseline placed this support at 530; keep the real actor clearance.
        const old = { ...checkpoint, y: checkpoint.y - (s.getTraversalSupport('peak-summit-relay').body.top - 530) };
        window.GameState.set('story.projectBeacon.expeditionCheckpoint', old);
        window.GameState.save();
        s.scene.restart();
        return old;
    });
    await page.waitForFunction(() => {
        const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
        return s.checkpointResumeApplied && s.levelEntryKeyHandler;
    });
    await page.evaluate(() => window.mythicalGame.scene.getScene('VoidPeaksLevel').retirePeakPatrolsForTitan());
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2200);
    const restored = await page.evaluate(() => {
        const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
        return { feet: s.player.body.bottom, grounded: s.isGrounded, checkpoint: s.checkpointPosition,
            stored: window.GameState.get('story.projectBeacon.expeditionCheckpoint'), relays: s.beaconRelaysActivated,
            route: s.getExpeditionRouteState() };
    });
    assert.equal(restored.relays, 3);
    assert(restored.grounded && Math.abs(restored.feet - 900) <= 2, 'old checkpoint must land on the new summit surface');
    assert.equal(restored.checkpoint.id, legacy.checkpointId);
    assert.equal(restored.stored.y, legacy.y, 'reprojection must not rewrite the saved coordinate');
    assert.equal(restored.route.peakRouteChoice, legacy.routeState.peakRouteChoice);
    await page.screenshot({ path: path.join(output, `${device}-old-checkpoint-restored.png`) });
    return { legacy, restored, stagedVersionRestart: true };
}
module.exports = { runMountainCheckpointRestart };
