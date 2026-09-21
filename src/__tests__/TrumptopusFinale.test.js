const fs = require('fs');
const path = require('path');
const load = file => fs.readFileSync(path.join(__dirname, '../systems', file), 'utf8').replace(/^import .*;$/gm, '').replace(/export /g, '');
const TrumptopusEncounter = new Function(`${load('TrumptopusEncounter.js')}\nreturn TrumptopusEncounter;`)();
const { TrumptopusFinale, resolveTrumptopusCheckpoint } = new Function('TrumptopusEncounter', `${load('TrumptopusFinale.js')}\nreturn { TrumptopusFinale, resolveTrumptopusCheckpoint };`)(TrumptopusEncounter);
const runUntil = (boss, condition) => {
    for (let i = 0; i < 4000 && !condition(boss); i++) boss.update(20, 200);
    expect(condition(boss)).toBe(true);
};
const expose = boss => runUntil(boss, b => b.snapshot().vulnerable);
const winPhase = boss => {
    const phase = boss.phaseIndex;
    for (let guard = 0; guard < 12 && boss.phaseIndex === phase && !boss.defeated; guard++) {
        expose(boss); boss.hit(100);
        runUntil(boss, b => b.state === 'ready' || b.state === 'phase_intro' || b.defeated);
    }
    expect(boss.phaseIndex > phase || boss.defeated).toBe(true);
};

describe('Trumptopus three-phase finale', () => {
    test('three distinct phases cannot be skipped even by an upgraded attack', () => {
        const boss = new TrumptopusFinale();
        expect(boss.snapshot()).toMatchObject({ state: 'phase_intro', health: 24, phaseIndex: 0, dangerous: false });
        expose(boss); boss.hit(10000);
        expect(boss.snapshot()).toMatchObject({ health: 21, phaseIndex: 0, vulnerable: false });
        winPhase(boss);
        expect(boss.snapshot()).toMatchObject({ phaseIndex: 1, phaseHealth: 8, health: 18, causewayRaised: true });
        winPhase(boss);
        expect(boss.snapshot()).toMatchObject({ phaseIndex: 2, phaseHealth: 10, health: 10, creatureAnswered: true });
        winPhase(boss);
        expect(boss.snapshot()).toMatchObject({ state: 'recoil', health: 0, completionReady: true });
        runUntil(boss, b => b.state === 'banishment');
        expect(boss.snapshot()).toMatchObject({ state: 'banishment', health: 0, defeated: true, completionReady: true, dangerous: false, routeOpen: false });
        runUntil(boss, b => b.state === 'aftermath');
        expect(boss.snapshot()).toMatchObject({ routeOpen: true, vulnerable: false });
        const events = boss.drainEvents();
        expect(events.filter(e => e.type === 'final-strike')).toHaveLength(1);
        expect(events.filter(e => e.type === 'banished')).toHaveLength(1);
        for (let i = 0; i < 300; i++) { boss.hit(3); boss.update(50, 200); }
        expect(boss.drainEvents()).toEqual([]);
    });
    test('phase 2 teaches the changed road safely, then alternates sweep and grasp', () => {
        const boss = new TrumptopusFinale({ checkpoint: { schemaVersion: 1, encounterId: 'trumptopus', phaseIndex: 1 } });
        expect(boss.consumeContact(true)).toBe(false);
        expect(boss.hit(2)).toBe(false);
        expect(boss.drainEvents().map(e => e.type)).toEqual(['phase-start', 'causeway-lift']);
        runUntil(boss, b => b.state === 'strike');
        expect(boss.snapshot()).toMatchObject({ attack: 'sweep', dangerous: true });
        expect(boss.consumeContact(true)).toBe(true);
        expect(boss.consumeContact(true)).toBe(false);
        expose(boss); boss.hit(3);
        runUntil(boss, b => b.attack === 'grasp');
        expect(boss.snapshot()).toMatchObject({ phaseIndex: 1, phaseHealth: 5 });
    });
    test('phase retry returns to a safe boundary, not a nearly finished attack', () => {
        const boss = new TrumptopusFinale({ checkpoint: { schemaVersion: 1, encounterId: 'trumptopus', phaseIndex: 2 } });
        expose(boss); boss.hit(1); boss.setPaused(true);
        const checkpoint = boss.checkpoint();
        expect(checkpoint).toEqual({ schemaVersion: 1, encounterId: 'trumptopus', phaseIndex: 2 });
        expect(boss.retry()).toBe(true);
        expect(boss.snapshot()).toMatchObject({ state: 'phase_intro', phaseHealth: 10, health: 10, dangerous: false });
        expect(boss.paused).toBe(false);
        expect(new TrumptopusFinale({ checkpoint }).snapshot()).toMatchObject({ phaseIndex: 2, phaseHealth: 10 });
    });
    test.each([null, {}, { phaseIndex: 2 }, { schemaVersion: 1, encounterId: 'void_empress', phaseIndex: 2 }, { schemaVersion: 9, encounterId: 'trumptopus', phaseIndex: 2 }, { schemaVersion: 1, encounterId: 'trumptopus', phaseIndex: -1 }, { schemaVersion: 1, encounterId: 'trumptopus', phaseIndex: 3 }, { schemaVersion: 1, encounterId: 'trumptopus', phaseIndex: 1.1 }])('incompatible checkpoints restart safely without mutating the input: %p', value => {
        const before = JSON.stringify(value);
        expect(resolveTrumptopusCheckpoint(value)).toBe(0);
        expect(JSON.stringify(value)).toBe(before);
    });
    test('pause and teardown disarm hazards, input and time in every phase', () => {
        const boss = new TrumptopusFinale(); expose(boss); boss.setPaused(true);
        const before = boss.snapshot(); boss.update(1000, 500);
        expect(boss.snapshot()).toEqual(before);
        expect(boss.hit(3)).toBe(false);
        expect(boss.consumeContact(true)).toBe(false);
        boss.setPaused(false); expect(boss.hit(1)).toBe(true);
        boss.dispose(); const closed = boss.snapshot(); boss.update(1000, 100);
        expect(boss.snapshot()).toEqual(closed);
        expect(boss.retry()).toBe(false);
        expect(boss.hit(3)).toBe(false);
        expect(boss.consumeContact(true)).toBe(false);
    });
    test('invalid delta never advances or skips an intro and final strike cannot be retried', () => {
        const boss = new TrumptopusFinale();
        for (const delta of [NaN, Infinity, -1, 0]) boss.update(delta, 200);
        expect(boss.elapsed).toBe(0);
        boss.update(999999, 200); expect(boss.elapsed).toBe(50);
        winPhase(boss); winPhase(boss); winPhase(boss);
        expect(boss.retry()).toBe(false);
    });
});
