const assert = require('node:assert/strict');
const path = require('node:path');

async function tapControl(page, device, key) {
    if (device !== 'phone') return page.keyboard.press(key === 'jump' ? 'Space' : 'm', { delay: 100 });
    const point = await page.evaluate(key => {
        const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
        const t = s.mobileControlTargets[key], r = window.mythicalGame.canvas.getBoundingClientRect();
        return { x: r.left + t.x * r.width / s.scale.width, y: r.top + t.y * r.height / s.scale.height };
    }, key);
    await page.touchscreen.tap(point.x, point.y);
}

async function runMountainWaveChecks(page, device, output) {
    const ready = () => page.waitForFunction(() => {
        const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
        return !s.isInvincible && s.isGrounded && s.player.body.bottom <= 402;
    }, null, { timeout: 6000 });
    const warn = () => page.evaluate(() => {
        const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
        s.clearBossEncounterTimers(); s.clearBossEncounterEffects();
        s.broadcastTitanWarning('starRain', { x: s.player.x, y: s.player.y });
        return s.health;
    });
    await ready();
    const standingHealth = await warn();
    await page.waitForTimeout(1400);
    const standingAfter = await page.evaluate(() => window.mythicalGame.scene.getScene('VoidPeaksLevel').health);
    assert(standingAfter < standingHealth, 'a grounded player must be hit by the low wave');
    await ready();
    const jumpingHealth = await warn();
    await page.waitForTimeout(450);
    await tapControl(page, device, 'jump');
    await page.waitForTimeout(350);
    const airborne = await page.evaluate(() => {
        const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
        return { feet: s.player.body.bottom, health: s.health, invincible: s.isInvincible };
    });
    assert(airborne.feet < 350 && !airborne.invincible, 'real jump, not invulnerability, clears the wave');
    await page.screenshot({ path: path.join(output, `${device}-wave-jump.png`) });
    await page.waitForFunction(() => {
        const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
        return s.bossSubtitle?.text === 'Your turn! Strike the face' && s.isGrounded;
    }, null, { timeout: 6000 });
    const recovery = await page.evaluate(() => {
        const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
        return { health: s.health, effects: s.bossEncounterEffects.size, feet: s.player.body.bottom };
    });
    assert.equal(recovery.health, jumpingHealth, 'jumping must avoid the low wave');
    assert.equal(recovery.effects, 0, 'recovery invitation must have no lingering damage effects');
    assert(Math.abs(recovery.feet - 400) <= 2, 'jump lands on the visible summit');
    return { stagedAttack: true, standingHealth, standingAfter, jumpingHealth, airborne, recovery };
}

async function runMountainCompletion(page, device, output) {
    await page.waitForFunction(() => window.mythicalGame.scene.getScene('VoidPeaksLevel').peakResultShown);
    const layout = await page.evaluate(() => {
        const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
        return { width: s.scale.width, height: s.scale.height,
            elements: s.peakResultElements.map(e => ({ text: e.text, ...e.getBounds() })),
            reward: s.levelCompletionResult, saved: window.GameState.get('levels.voidPeaks.completed') === true };
    });
    await page.screenshot({ path: path.join(output, `${device}-reward.png`) });
    require('node:fs').writeFileSync(path.join(output, `${device}-reward-layout.json`), JSON.stringify(layout, null, 2));
    assert(layout.saved, 'victory was recorded before the result panel');
    for (const [i, b] of layout.elements.entries()) {
        assert(b.x >= 0 && b.y >= 0 && b.x + b.width <= layout.width && b.y + b.height <= layout.height,
            `${device} result text/button must fit: ${b.text}`);
        if (i) assert(layout.elements[i - 1].y + layout.elements[i - 1].height <= b.y,
            `${device} result elements must not overlap`);
    }
    const button = layout.elements.at(-1);
    assert.equal(button.text, 'CONTINUE');
    assert(button.height >= 44, 'primary continuation keeps a usable phone target');
    async function tapElement(bounds) {
        const point = await page.evaluate(b => {
            const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
            const r = window.mythicalGame.canvas.getBoundingClientRect();
            return { x: r.left + (b.x + b.width / 2) * r.width / s.scale.width,
                y: r.top + (b.y + b.height / 2) * r.height / s.scale.height };
        }, bounds);
        if (device === 'phone') await page.touchscreen.tap(point.x, point.y);
        else await page.mouse.click(point.x, point.y);
    }
    await tapElement(button);
    await page.waitForFunction(() => window.mythicalGame.scene.getScene('VoidPeaksLevel').residentReleaseOpen);
    await page.keyboard.press('Enter');
    assert(await page.evaluate(() => window.mythicalGame.scene.getScene('VoidPeaksLevel').residentReleaseOpen),
        'repeated continuation must not skip or destroy the resident welcome');
    await page.waitForTimeout(1500);
    const welcome = await page.evaluate(() => {
        const s = window.mythicalGame.scene.getScene('VoidPeaksLevel');
        const b = s.residentReleaseElements.find(e => e.text?.startsWith('WELCOME '));
        return { text: b?.text, ...b?.getBounds() };
    });
    assert(welcome.x >= 0 && welcome.x + welcome.width <= layout.width, 'resident continuation must fit');
    await page.screenshot({ path: path.join(output, `${device}-rescue.png`) });
    await tapElement(welcome);
    await page.waitForFunction(() => window.mythicalGame.scene.isActive('HubWorldScene'), null, { timeout: 15000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(output, `${device}-returned.png`) });
    return { ...layout, welcome, returnedToHub: true };
}

module.exports = { runMountainWaveChecks, runMountainCompletion };
