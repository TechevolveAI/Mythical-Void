const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const geometry = fs.readFileSync(path.join(__dirname, '../systems/MountainBossAscent.js'), 'utf8');
const { MOUNTAIN_ASCENT, MOUNTAIN_BOSS_NAME, mountainSteps, mountainStepRise, mountainEmitter } = new Function(
    `${geometry.replace(/^export /gm, '')}; return { MOUNTAIN_ASCENT, MOUNTAIN_BOSS_NAME, mountainSteps, mountainStepRise, mountainEmitter };`
)();
const source = fs.readFileSync(path.join(__dirname, '../scenes/levels/VoidPeaksLevel.js'), 'utf8');
const declaration = parse(source, { sourceType: 'module' }).program.body.find(n => n.type === 'ClassDeclaration');
const patterns = fs.readFileSync(path.join(__dirname, '../systems/MountainBossPatterns.js'), 'utf8');
const mountainAttackPlan = new Function(`${patterns.replace(/^export /gm, '')}; return mountainAttackPlan;`)();
function method(name) {
    const n = declaration.body.body.find(n => n.key?.name === name);
    return new Function('MOUNTAIN_ASCENT', 'mountainAttackPlan', `return ({${source.slice(n.start, n.end)}}).${name};`)(MOUNTAIN_ASCENT, mountainAttackPlan);
}

test('25 joined, small stone steps connect the floor exactly to the summit', () => {
    const steps = mountainSteps();
    expect(steps).toHaveLength(25);
    steps.forEach((step, i) => {
        expect(step.y + step.height).toBe(800);
        expect(step.width).toBe(16);
        if (i) {
            expect(steps[i - 1].x + steps[i - 1].width).toBe(step.x);
            expect(steps[i - 1].y - step.y).toBe(16);
        }
    });
    expect(steps.at(-1).x + steps.at(-1).width).toBe(MOUNTAIN_ASCENT.summitX);
    expect(steps.at(-1).y).toBe(MOUNTAIN_ASCENT.summitY);
});

test('walking up a small riser works but walls, rising jumps and under-floor bodies are not snapped', () => {
    const body = { bottom: 800, left: 4360, right: 4390, velocity: { x: 100, y: 0 } };
    const step = { top: 784, left: 4380, right: 4396 };
    expect(mountainStepRise(body, step, true)).toBe(16);
    expect(mountainStepRise(body, step, false)).toBe(0);
    expect(mountainStepRise({ ...body, velocity: { x: 100, y: -30 } }, step, true)).toBe(0);
    expect(mountainStepRise(body, { ...step, top: 768 }, true)).toBe(0);
    expect(mountainStepRise({ ...body, bottom: 820 }, step, true)).toBe(0);
    expect(mountainStepRise({ ...body, velocity: { x: -100, y: 0 } }, step, true)).toBe(0);
});

test('lasers originate at the central snowy peak and both arm tips, not the face centre', () => {
    const sprite = { x: 4660, y: 332, displayWidth: 691.6, displayHeight: 650 };
    const top = mountainEmitter(sprite);
    const left = mountainEmitter(sprite, 'left');
    const right = mountainEmitter(sprite, 'right');
    expect(top.x).toBe(4660);
    expect(top.y).toBeCloseTo(215);
    expect(left.x).toBeLessThan(top.x - 200);
    expect(right.x).toBeGreaterThan(top.x + 200);
    expect(left.y).toBeLessThan(200);
    expect(right.y).toBeLessThan(200);
    expect(method('getMountainAttackEmitters').call({}, 'voidPunch')).toEqual(['left', 'right']);
    expect(method('getMountainAttackEmitters').call({}, 'singularity')).toEqual(['summit']);
    expect(method('getMountainAttackEmitters').call({}, 'starRain')).toEqual([]);
});

test('phase changes cannot move or resize the terrain boss', () => {
    const phase = declaration.body.body.find(n => n.key?.name === 'enterTitanPhase');
    expect(source.slice(phase.start, phase.end)).not.toMatch(/this\.boss\.set(?:Scale|Position|VelocityX)/);
    expect(source).not.toContain('this.boss.setVelocityX(260');
    expect(source).toContain('this.bossTargetScale = MOUNTAIN_ASCENT.displayHeight');
    expect(source).toContain('for (const key of [\'prev\', \'prevFrame\', \'autoFrame\'])');
});

test('summit recovery corrects a late-frame penetration but never cancels a legitimate jump', () => {
    const body = { left: 4800, bottom: 440, position: {}, updateFromGameObject: jest.fn() };
    const s = { player: { y: 390, body, setVelocityY: jest.fn() }, bossFightActive: true, bossCombatReady: true };
    method('keepMountainArenaGrounded').call(s);
    expect(s.player.y).toBe(348);
    body.bottom = 320; s.player.y = 270;
    method('keepMountainArenaGrounded').call(s);
    expect(s.player.y).toBe(270);
    expect(body.updateFromGameObject).toHaveBeenCalledTimes(1);
});

test('new name and art retain progression identifiers and the existing reward', () => {
    expect(MOUNTAIN_BOSS_NAME).toBe('The Peak of the Mountain');
    expect(source).toContain("const COSMIC_TITAN_TEXTURE = 'cosmicTitan'");
    expect(source).toContain("id: 'cosmic_titan'");
    expect(source).toContain("shipPartId: 'hull_plating'");
    expect(source).toContain('MOUNTAIN_BOSS_NAME.toUpperCase()');
    expect(source).toContain('peak-of-the-mountain-cosmic.webp');
    expect(source).toContain('this.releaseBossEffect(overlap)');
    expect(source).toContain('this.mountainSupports?.forEach(platform => platform.destroy())');
});

test('final hit commits rewards before effects, and an interrupted tween cannot lose victory', () => {
    const order = [];
    const s = {
        completeLevelProgression: jest.fn(() => order.push('save')),
        clearBossEncounterTimers: jest.fn(), clearBossEncounterEffects: jest.fn(),
        showFloatingText: jest.fn(),
        scheduleGuardianTransition: jest.fn(),
        tweens: { add: jest.fn(() => order.push('animation')) }
    };
    method('defeatBoss').call(s);
    method('defeatBoss').call(s);
    expect(s.completeLevelProgression).toHaveBeenCalledTimes(1);
    expect(s.completeLevelProgression).toHaveBeenCalledWith({
        achievementLevelId: 'voidPeaks', shipPartId: 'hull_plating',
        speedrunThreshold: 180000, deferPresentation: true
    });
    expect(order[0]).toBe('save');
    expect(s.scheduleGuardianTransition).toHaveBeenCalledWith(
        'peaks-saved-victory', 1800, expect.any(Function)
    );
    expect(s.tweens.add.mock.calls[0][0].onComplete).toBeUndefined();
});
