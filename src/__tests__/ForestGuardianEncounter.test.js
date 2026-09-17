const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');

const source = fs.readFileSync(path.join(__dirname, '../scenes/levels/MythicalForestLevel.js'), 'utf8');
const declaration = parse(source, { sourceType: 'module' }).program.body.find(n => n.type === 'ClassDeclaration');
const Phaser = { Math: { Clamp: (v, min, max) => Math.min(max, Math.max(min, v)) } };
function method(name, dependencies = {}) {
    const node = declaration.body.body.find(n => n.key?.name === name);
    const scope = { Phaser, window: {}, ...dependencies };
    return new Function(...Object.keys(scope), `return ({${source.slice(node.start, node.end)}}).${name};`)(...Object.values(scope));
}

function graphic() {
    const g = { active: true };
    for (const name of ['fillStyle', 'fillCircle', 'fillTriangle', 'fillRoundedRect', 'lineStyle', 'lineBetween', 'setDepth', 'setAlpha']) {
        g[name] = jest.fn(() => g);
    }
    g.setPosition = jest.fn((x, y) => { g.x = x; g.y = y; return g; });
    g.destroy = jest.fn(() => { g.active = false; });
    return g;
}

function arena() {
    const body = { enable: true, left: 5500, right: 5540, top: 1040, bottom: 1100, reset: jest.fn() };
    return {
        time: { now: 1000 }, physics: { world: { isPaused: false } },
        player: { x: 5520, y: 1049, body, setVelocity: jest.fn() },
        boss: { active: true, isRecovering: true }, bossFightActive: true,
        bossEntranceComplete: true, bossPhaseAttackCount: 1, bossPhase: 1,
        bossHealth: 18, bossMaxHealth: 18, forestBossNextHitAt: 0, forestBossHits: 0,
        getForestArenaFloor: () => ({ top: 1100, left: 5200, right: 8000 }),
        resetJoystick: jest.fn(), clearVirtualJumpInput: jest.fn(),
        resetForestPlayerBody: body.reset,
        updateBossHealthBar: jest.fn(), requestForestBossPhase2: jest.fn(), onBossDefeated: jest.fn(),
        combatJuice: { registerHit: jest.fn(), screenShake: jest.fn(), hitFlash: jest.fn(), hitStop: jest.fn(), hapticFeedback: jest.fn() },
        showFloatingText: jest.fn(), bossHazards: new Set(), bossTelegraphs: new Set(),
        handlePlayerDamage: jest.fn(), tweens: { add: jest.fn(), killTweensOf: jest.fn() }
    };
}

test('body placement retains hitbox offset and synchronizes all three physics history vectors', () => {
    const events = [];
    const body = {
        position: { x: 0, y: 0 },
        reset: () => { events.push('reset'); },
        updateFromGameObject: () => { body.position = { x: 5524, y: 1040 }; events.push('offset'); }
    };
    for (const key of ['prev', 'prevFrame', 'autoFrame']) body[key] = { copy: jest.fn(() => events.push(key)) };
    method('resetForestPlayerBody').call({ player: { body } }, 5520, 1049);
    expect(events).toEqual(['reset', 'offset', 'prev', 'prevFrame', 'autoFrame']);
    for (const key of ['prev', 'prevFrame', 'autoFrame']) expect(body[key].copy).toHaveBeenCalledWith({ x: 5524, y: 1040 });
});

test('teleport resets Arcade history, held input and drop-through before the entrance', () => {
    const s = arena();
    s.player.active = true;
    s.player.setPosition = jest.fn();
    s.player.body.setAllowGravity = jest.fn();
    s.lockForestGuardianEntryInput = jest.fn();
    s.getTraversalSupportCheckpoint = jest.fn(() => ({ x: 5520, y: 1049 }));
    expect(method('stageForestGuardianEntry', { FOREST_GUARDIAN_ENTRY_X: 5520 }).call(s)).toEqual({ x: 5520, y: 1049 });
    expect(s.player.body.reset).toHaveBeenCalledWith(5520, 1049);
    expect(s.lockForestGuardianEntryInput).toHaveBeenCalledTimes(1);
    expect(s.lastSafePosition).toEqual({ x: 5520, y: 1049 });
});

test.each(['under-floor', 'left-edge', 'right-edge'])('arena repairs %s without a death or new reward', fault => {
    const s = arena();
    if (fault === 'under-floor') { s.player.body.bottom = 1130; s.player.y = 1079; }
    if (fault === 'left-edge') s.player.x = 5100;
    if (fault === 'right-edge') s.player.x = 8100;
    method('keepForestArenaSafe').call(s);
    expect(s.player.body.reset).toHaveBeenCalledWith(
        fault === 'left-edge' ? 5270 : fault === 'right-edge' ? 7930 : 5520,
        fault === 'under-floor' ? 1048 : 1049
    );
    expect(s.resetJoystick).toHaveBeenCalled();
    expect(s.handlePlayerDamage).not.toHaveBeenCalled();
});

test('arena does not flatten a legitimate jump or affect ordinary traversal', () => {
    const s = arena();
    s.player.body.bottom = 1010;
    method('keepForestArenaSafe').call(s);
    s.bossFightActive = false;
    s.player.body.bottom = 1300;
    method('keepForestArenaSafe').call(s);
    expect(s.player.body.reset).not.toHaveBeenCalled();
});

test.each(['entrance', 'attacking', 'phase-change', 'not-attacked', 'cooldown', 'defeated'])('rejects damage during %s', state => {
    const s = arena();
    if (state === 'entrance') s.bossEntranceComplete = false;
    if (state === 'attacking') s.boss.isRecovering = false;
    if (state === 'phase-change') s.bossPhaseTransitioning = true;
    if (state === 'not-attacked') s.bossPhaseAttackCount = 0;
    if (state === 'cooldown') s.forestBossNextHitAt = 1001;
    if (state === 'defeated') s.bossDefeated = true;
    expect(method('damageBoss').call(s, 100)).toBe(false);
    expect(s.bossHealth).toBe(18);
});

test('openings reward upgraded hits without allowing frame spam or skipping both phases', () => {
    const s = arena();
    const damage = method('damageBoss');
    expect(damage.call(s, 3)).toBe(true);
    expect(s.bossHealth).toBe(14);
    expect(damage.call(s, 3)).toBe(false);
    s.time.now += 400;
    expect(damage.call(s, 1)).toBe(true);
    expect(s.bossHealth).toBe(12);
    s.time.now += 400;
    damage.call(s, 100);
    expect(s.bossHealth).toBe(8);
    expect(s.requestForestBossPhase2).toHaveBeenCalledTimes(1);
    expect(s.forestBossHits).toBe(3);
    expect(s.onBossDefeated).not.toHaveBeenCalled();
});

test.each([NaN, Infinity, 0, -1])('rejects invalid damage %s', damage => {
    const s = arena();
    expect(method('damageBoss').call(s, damage)).toBe(false);
    expect(s.bossHealth).toBe(18);
});

test('teaches roots then vines; phase two adds spores and marked falling leaves', () => {
    const s = arena();
    s.boss.setFlipX = jest.fn();
    s.forestBossAttackIndex = 0;
    s.executeBossAttack = jest.fn();
    const tick = method('bossAITick');
    tick.call(s); tick.call(s); tick.call(s);
    expect(s.executeBossAttack.mock.calls.flat()).toEqual(['root_slam', 'vine_whip', 'root_slam']);
    s.executeBossAttack.mockClear();
    s.bossPhase = 2; s.forestBossAttackIndex = 0;
    for (let i = 0; i < 4; i++) tick.call(s);
    expect(s.executeBossAttack.mock.calls.flat()).toEqual(['spore_cloud', 'vine_whip', 'nature_fury', 'root_slam']);
    s.boss.isAttacking = true;
    tick.call(s);
    expect(s.forestBossAttackIndex).toBe(4);
});

test('moving hazards hit the body in flight, not only at a tween endpoint; jumping clears a low vine', () => {
    const s = arena();
    const vine = graphic(); vine.x = 5520;
    s.addForestBossHazard = method('addForestBossHazard');
    s.destroyForestBossTelegraph = method('destroyForestBossTelegraph');
    s.addForestBossHazard(vine, () => ({ left: vine.x - 24, right: vine.x + 24, top: 1062, bottom: 1086 }), 1050);
    const update = method('updateForestBossHazards');
    update.call(s);
    expect(s.handlePlayerDamage).toHaveBeenCalledTimes(1);
    update.call(s);
    expect(s.handlePlayerDamage).toHaveBeenCalledTimes(1);
    s.player.body.bottom = 1060;
    s.time.now += 1000;
    update.call(s);
    expect(s.handlePlayerDamage).toHaveBeenCalledTimes(1);
    s.time.now += 51;
    update.call(s);
    expect(s.bossHazards.size).toBe(0);
    expect(vine.destroy).toHaveBeenCalled();
});

test('spores stay at the warned position when the player moves', () => {
    const s = arena();
    const cloud = graphic();
    s.add = { graphics: () => cloud };
    s.addForestBossHazard = method('addForestBossHazard');
    s.forestBossAttackTarget = { x: 5480, y: 1070 };
    s.player.x = 5640;
    method('bossSporeCloud').call(s);
    expect(cloud.setPosition).toHaveBeenCalledWith(5480, 1070);
    expect([...s.bossHazards][0].bounds()).toEqual({ left: 5438, right: 5522, top: 1028, bottom: 1112 });
});

test('root impact uses the warned ground and retracts before a normal jump lands', () => {
    const s = arena();
    s.add = { graphics: graphic };
    s.addForestBossHazard = method('addForestBossHazard');
    s.forestBossAttackTarget = { x: 5520, groundY: 1100 };
    method('bossRootSlam').call(s);
    expect(s.bossHazards.size).toBe(5);
    for (const hazard of s.bossHazards) {
        expect(hazard.expiresAt - s.time.now).toBe(350);
        expect(hazard.bounds().bottom).toBe(1100);
        expect(hazard.bounds().top).toBe(1052);
        expect(hazard.bounds().left).toBeGreaterThanOrEqual(5430);
        expect(hazard.bounds().right).toBeLessThanOrEqual(5610);
    }
});

test('phase change, victory and shutdown remove active hazard shapes and their tweens', () => {
    const s = arena();
    const g = graphic();
    method('addForestBossHazard').call(s, g, () => ({}), 1000);
    method('clearForestBossPacing').call(s, { includePhase: true });
    expect(s.bossHazards.size).toBe(0);
    expect(s.bossTelegraphs.size).toBe(0);
    expect(s.tweens.killTweensOf).toHaveBeenCalledWith(g);
    expect(g.destroy).toHaveBeenCalled();
});

test('defeat freezes controls/physics before any withdrawal or celebration animation', () => {
    const node = declaration.body.body.find(n => n.key?.name === 'onBossDefeated');
    const defeat = source.slice(node.start, node.end);
    expect(defeat.indexOf('this.enterLevelCompletionState();')).toBeGreaterThan(0);
    expect(defeat.indexOf('this.enterLevelCompletionState();')).toBeLessThan(defeat.indexOf('this.player?.setVelocity'));
    expect(defeat).toContain('if (this.bossDefeated || !this.boss?.active) return;');
});

test.each([true, false])('victory measures wrapped rewards and keeps the exit reachable (first completion: %s)', firstCompletion => {
    const layoutSource = fs.readFileSync(path.join(__dirname, '../systems/MobileControlLayout.js'), 'utf8');
    const getCampaignEntryStackLayout = new Function(
        `${layoutSource.replace(/export /g, '')}; return getCampaignEntryStackLayout;`
    )();
    const texts = [];
    const s = {
        bindLevelCompletionReturn: jest.fn(), syncCampaignObjectiveDisplay: jest.fn(),
        completeLevelProgression: jest.fn(() => ({ firstCompletion, coinsAwarded: 600 })),
        forestBossDuration: 6500, forestBossHits: 1,
        getBossPowerupRewardCopy: () => 'Energy Crystal SAVED\nRestores 3 crystal energy\nCLEAR A SLOT // RESTOCK LATER IN THE SHOP',
        getGuardianSanctuaryArrivalCopy: () => 'Bloom FREED -> SANCTUARY // Forager',
        getVillageCompletionCopy: () => 'SANCTUARY // Coins +20%\nGuard +1',
        getLevelModalLayout: () => ({ width: 390, panelWidth: 350, panelHeight: 600, panelX: 20, panelY: 122,
            contentWidth: 302, y: offset => 122 + offset, font: (_, compact) => `${compact}px`, buttonPadding: { x: 16, y: 10 } }),
        tweens: { add: jest.fn() },
        add: {
            graphics: () => {
                const g = graphic();
                for (const name of ['setScrollFactor', 'strokeRoundedRect']) g[name] = jest.fn(() => g);
                return g;
            },
            text: (x, y, text) => {
                const t = { x, y, text, height: text.includes("Guardian's Gift") ? 130 : text.includes('COMPLETE') ? 58 : 44 };
                for (const name of ['setOrigin', 'setScrollFactor', 'setDepth', 'setAlpha', 'setInteractive', 'on']) t[name] = () => t;
                t.setName = name => { t.name = name; return t; };
                t.setY = value => { t.y = value; return t; };
                texts.push(t);
                return t;
            }
        }
    };
    const victory = method('showBossVictory', { getCampaignEntryStackLayout });
    expect(victory.call(s)).toBe(true);
    expect(victory.call(s)).toBe(false);
    expect(s.completeLevelProgression).toHaveBeenCalledTimes(1);
    expect(texts.some(t => t.text.endsWith('1 successful strike'))).toBe(true);
    expect(texts.at(-1).text).toBe('[ ENTER SANCTUARY ]');
    expect(texts.length).toBe(firstCompletion ? 8 : 7);
    for (const [index, text] of texts.entries()) {
        expect(text.y - text.height / 2).toBeGreaterThanOrEqual(122);
        expect(text.y + text.height / 2).toBeLessThanOrEqual(722);
        if (index) expect(text.y - text.height / 2).toBeGreaterThan(texts[index - 1].y + texts[index - 1].height / 2);
    }
});
