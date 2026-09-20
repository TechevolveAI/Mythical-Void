const fs = require('fs');
const path = require('path');
const load = (name, exports) => new Function(`${fs.readFileSync(path.join(__dirname, '../systems', name), 'utf8').replace(/^export /gm, '')}; return {${exports}};`)();
const { PEAK_ROUTE, PEAK_RELAYS, PEAK_FRAGMENTS, PEAK_WORLD_HEIGHT, PEAK_RETURN_CURRENTS, peakCheckpointSupport } = load('VoidPeaksRoute.js', 'PEAK_ROUTE, PEAK_RELAYS, PEAK_FRAGMENTS, PEAK_WORLD_HEIGHT, PEAK_RETURN_CURRENTS, peakCheckpointSupport');
const { nextMountainAttack, mountainAttackPlan } = load('MountainBossPatterns.js', 'nextMountainAttack, mountainAttackPlan');
const source = fs.readFileSync(path.join(__dirname, '../scenes/levels/VoidPeaksLevel.js'), 'utf8');
const { parse } = require('@babel/parser');
const declaration = parse(source, { sourceType: 'module' }).program.body.find(n => n.type === 'ClassDeclaration');

test('the mountain gains 1250px before the final 400px staircase, with no floor gaps', () => {
    const solid = PEAK_ROUTE.filter(s => s.type === 'solid');
    let right = 0;
    for (const support of solid) {
        expect(support.x).toBeLessThanOrEqual(right);
        right = Math.max(right, support.x + support.width);
        expect(support.y).toBeLessThan(PEAK_WORLD_HEIGHT);
    }
    expect(right).toBe(5200);
    expect(solid[0].y - solid.at(-1).y).toBe(1250);
});

test('the authored main route rises in achievable jumps with generous landings', () => {
    const ids = ['ground-arrival', 'opening-step', 'opening-rise', 'foothill-turn',
        'lower-relay-overlook', 'lower-ascent', 'ridge-approach', 'warning-lower',
        'ridge-turn', 'main-handoff', 'floor-summit', 'warning-summit', 'summit-relay', 'titan-approach'];
    const route = ids.map(id => PEAK_ROUTE.find(s => s.id === `peak-${id}`));
    for (let i = 1; i < route.length; i++) {
        const from = route[i - 1], to = route[i];
        const rise = from.y - to.y;
        const gap = Math.max(0, to.x - from.x - from.width);
        // 455 launch speed / 500 gravity. Require safety margin from the apex.
        expect(rise).toBeGreaterThanOrEqual(0);
        expect(rise).toBeLessThanOrEqual(130);
        const descendingTime = (455 + Math.sqrt(455 ** 2 - 2 * 500 * rise)) / 500;
        expect(gap + 50).toBeLessThan(195 * descendingTime * 0.82);
        expect(to.width).toBeGreaterThanOrEqual(140);
    }
});

test('all three checkpoint identities reproject to safe current surfaces; rewards remain five', () => {
    expect(PEAK_RELAYS.map(r => r.id)).toEqual(['peaks_relay_1', 'peaks_relay_2', 'peaks_relay_3']);
    PEAK_RELAYS.forEach(relay => {
        const support = PEAK_ROUTE.find(s => s.id === peakCheckpointSupport(relay.id));
        expect(relay.x).toBeGreaterThan(support.x + 32);
        expect(relay.x).toBeLessThan(support.x + support.width - 32);
        expect(relay.y).toBe(support.y - 45);
    });
    expect(peakCheckpointSupport('unknown')).toBeNull();
    expect(PEAK_FRAGMENTS).toHaveLength(5);
    expect(PEAK_FRAGMENTS.filter(f => f[2] === 'peaks_relic_ridge')).toHaveLength(2);
    PEAK_RETURN_CURRENTS.forEach(current => {
        expect(current.bottom - current.top).toBeLessThan(210);
        expect(PEAK_ROUTE.find(s => s.id === current.destinationId).type).toBe('one-way');
    });
});

test('the high ridge needs a deliberate intermediate landing, not an ordinary main-route jump', () => {
    const support = id => PEAK_ROUTE.find(s => s.id === id);
    const lower = support('peak-warning-lower');
    const launch = support('peak-relic-launch');
    const upper = support('peak-relic-ridge-1');
    const jumpHeight = 455 ** 2 / (2 * 500);
    // Include the existing held-key/coyote grace observed in desktop play.
    expect(lower.y - upper.y).toBeGreaterThan(jumpHeight + 55);
    expect(lower.y - launch.y).toBeLessThan(160);
    expect(launch.y - upper.y).toBeLessThan(130);
    expect(launch.x + launch.width).toBeLessThan(upper.x);
    expect(upper.x - launch.x - launch.width).toBeLessThan(80);
});

test('boss teaches aimed, low and alternating attacks in a fixed order before combining them', () => {
    expect([0, 1, 2, 3].map(i => nextMountainAttack(i, 1))).toEqual(['gravityCrush', 'starRain', 'voidPunch', 'gravityCrush']);
    expect(nextMountainAttack(3, 3)).toBe('singularity');
    expect(mountainAttackPlan('starRain')).toEqual([{ at: 0, kind: 'groundWave' }]);
    expect(mountainAttackPlan('voidPunch').map(s => s.kind)).toEqual(['left', 'right', 'left']);
    expect(mountainAttackPlan('singularity')).toEqual([
        { at: 0, kind: 'summit' }, { at: 260, kind: 'summit' }, { at: 1000, kind: 'groundWave' }
    ]);
});

test('old checkpoint coordinates are reprojected in memory, without changing the save or progress', () => {
    const node = declaration.body.body.find(n => n.key?.name === 'restorePersistedExpeditionCheckpoint');
    class Base {
        restorePersistedExpeditionCheckpoint() { return this.accepted; }
    }
    const Candidate = new Function('Base', 'peakCheckpointSupport',
        `return class extends Base { ${source.slice(node.start, node.end)} };`)(Base, peakCheckpointSupport);
    const scene = new Candidate();
    scene.accepted = true;
    const legacy = Object.freeze({ x: 1280, y: 555, id: 'peaks_relay_1', index: 0 });
    scene.checkpointPosition = legacy;
    let bodySynchronized = false;
    scene.getTraversalSupportCheckpoint = jest.fn(() => {
        expect(bodySynchronized).toBe(true);
        return { x: 1280, y: 1550 };
    });
    scene.player = { setPosition: jest.fn(), setVelocity: jest.fn(),
        body: { updateFromGameObject: jest.fn(() => { bodySynchronized = true; }) } };
    expect(scene.restorePersistedExpeditionCheckpoint()).toBe(true);
    expect(scene.checkpointPosition).toEqual({ ...legacy, y: 1550 });
    expect(legacy.y).toBe(555);
    expect(scene.getTraversalSupportCheckpoint).toHaveBeenCalledWith('peak-lower-relay-overlook', 1280);
    expect(scene.player.setPosition).toHaveBeenCalledWith(1280, 1550);
    scene.accepted = false;
    scene.player.setPosition.mockClear();
    expect(scene.restorePersistedExpeditionCheckpoint()).toBe(false);
    expect(scene.player.setPosition).not.toHaveBeenCalled();
});

test('recovery explicitly retires damage effects before inviting the player to attack', () => {
    const n = declaration.body.body.find(n => n.key?.name === 'broadcastTitanWarning');
    const method = source.slice(n.start, n.end);
    expect(method.indexOf('this.clearBossEncounterEffects()')).toBeLessThan(method.indexOf('Your turn! Strike the face'));
    expect(source).toContain("if (kind === 'groundWave') this.fireMountainGroundWave()");
    expect(source).toContain('wave.body.setAllowGravity(false).setVelocityX(235)');
});

test('expired attack callbacks cannot destroy a Phaser collider twice after recovery cleanup', () => {
    const methods = ['releaseBossEffect', 'clearBossEncounterEffects'].map(name => {
        const n = declaration.body.body.find(node => node.key?.name === name);
        return source.slice(n.start, n.end);
    }).join('\n');
    const Candidate = new Function(`return class { ${methods} };`)();
    const scene = new Candidate();
    const effects = [0, 1, 2].map(() => ({ destroy: jest.fn() }));
    scene.bossEncounterEffects = new Set(effects);
    scene.clearBossEncounterEffects();
    effects.forEach(effect => scene.releaseBossEffect(effect));
    scene.clearBossEncounterEffects();
    expect(scene.bossEncounterEffects.size).toBe(0);
    effects.forEach(effect => expect(effect.destroy).toHaveBeenCalledTimes(1));
});

test('restoring the climb does not replay oversized story or control hints', () => {
    expect(source).toContain('if (!this.checkpointResumeApplied) this.showObjectiveToast()');
    expect(source).toContain('this.showDistantReplyNetwork(relay, { announce: false })');
    expect(source).not.toContain('THREE SETTLEMENTS ANSWER');
    expect(source).not.toContain('They are warning you about the Titan. They want it saved.');
});
