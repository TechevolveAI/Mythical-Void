const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '../systems/TrumptopusEncounter.js'), 'utf8');
const { TrumptopusEncounter, GRIP_TIMINGS } = new Function(`${source.replace(/export /g, '')}\nreturn { TrumptopusEncounter, GRIP_TIMINGS };`)();

function advance(encounter, ms, x = 200) {
    for (let elapsed = 0; elapsed < ms; elapsed += 10) encounter.update(Math.min(10, ms - elapsed), x);
}
function reach(encounter, state, x = 200) {
    for (let i = 0; i < 1500 && encounter.state !== state; i++) encounter.update(10, x);
    expect(encounter.state).toBe(state);
}

describe('private Trumptopus committed-grab exchange', () => {
    test('locks the target for the entire warning, strike and exposure', () => {
        const boss = new TrumptopusEncounter();
        reach(boss, 'windup', 220);
        advance(boss, GRIP_TIMINGS.windup + GRIP_TIMINGS.strike + GRIP_TIMINGS.contact, 600);
        expect(boss.snapshot()).toMatchObject({ state: 'exposed', targetX: 220, health: 2 });
    });
    test.each(['ready', 'windup', 'strike', 'contact', 'recoil', 'released'])('cannot damage during %s', state => {
        const boss = new TrumptopusEncounter();
        if (state === 'released') {
            reach(boss, 'exposed'); boss.hit(2); reach(boss, 'released');
        } else reach(boss, state);
        const health = boss.health;
        expect(boss.hit(2)).toBe(false);
        expect(boss.health).toBe(health);
    });
    test('two normal projectiles break the grip and release only after recoil', () => {
        const boss = new TrumptopusEncounter();
        reach(boss, 'exposed');
        expect(boss.hit(1)).toBe(true);
        expect(boss.snapshot()).toMatchObject({ health: 1, vulnerable: true, routeOpen: false });
        expect(boss.hit(1)).toBe(true);
        expect(boss.snapshot()).toMatchObject({ health: 0, state: 'recoil', routeOpen: false });
        expect(boss.hit(1)).toBe(false);
        reach(boss, 'released');
        advance(boss, 30000);
        expect(boss.snapshot()).toMatchObject({ health: 0, state: 'released', routeOpen: true });
    });
    test('one normal katana strike can break the grip', () => {
        const boss = new TrumptopusEncounter(); reach(boss, 'exposed');
        expect(boss.hit(2)).toBe(true);
        expect(boss.state).toBe('recoil');
    });
    test('missed exposure recovers and commits to a new position without restoring damage', () => {
        const boss = new TrumptopusEncounter(); reach(boss, 'exposed'); boss.hit(1);
        reach(boss, 'ready'); reach(boss, 'windup', 340);
        expect(boss.snapshot()).toMatchObject({ cycle: 2, targetX: 340, health: 1 });
    });
    test('contact damage requires real overlap, occurs once per grab, and never during a warning', () => {
        const boss = new TrumptopusEncounter(); reach(boss, 'windup');
        expect(boss.consumeContact(true)).toBe(false);
        reach(boss, 'contact');
        expect(boss.consumeContact(false)).toBe(false);
        expect(boss.consumeContact(true)).toBe(true);
        expect(boss.consumeContact(true)).toBe(false);
        reach(boss, 'exposed');
        expect(boss.consumeContact(true)).toBe(false);
        reach(boss, 'ready'); reach(boss, 'contact');
        expect(boss.consumeContact(true)).toBe(true);
    });
    test('pause freezes time and disarms both damage directions', () => {
        const boss = new TrumptopusEncounter(); reach(boss, 'exposed'); boss.setPaused(true);
        advance(boss, 10000);
        expect(boss.elapsed).toBe(0);
        expect(boss.hit(2)).toBe(false);
        expect(boss.consumeContact(true)).toBe(false);
        boss.setPaused(false);
        expect(boss.hit(2)).toBe(true);
    });
    test('a delayed frame cannot skip the warning or collide after teardown', () => {
        const boss = new TrumptopusEncounter(); reach(boss, 'windup');
        boss.update(60000, 999);
        expect(boss.snapshot()).toMatchObject({ state: 'windup', elapsed: 50, targetX: 200 });
        boss.dispose(); const snapshot = boss.snapshot();
        advance(boss, 10000);
        expect(boss.snapshot()).toEqual(snapshot);
        expect(boss.hit(2)).toBe(false);
        expect(boss.consumeContact(true)).toBe(false);
    });
    test.each([NaN, Infinity, -1, 0])('rejects invalid damage and delta %s', value => {
        const boss = new TrumptopusEncounter(); reach(boss, 'exposed');
        boss.update(value, 200);
        expect(boss.elapsed).toBe(0);
        expect(boss.hit(value)).toBe(false);
        expect(boss.health).toBe(2);
    });
    test('clamps targets to the arena and rejects invalid geometry', () => {
        const boss = new TrumptopusEncounter({ minX: 90, maxX: 280 });
        advance(boss, 1800, NaN);
        expect(boss.state).toBe('ready');
        boss.update(10, 400);
        expect(boss.targetX).toBe(280);
        expect(() => new TrumptopusEncounter({ minX: 500, maxX: 10 })).toThrow();
    });
    test('fixed inputs produce identical histories and outcomes', () => {
        const runs = Array.from({ length: 2 }, () => {
            const boss = new TrumptopusEncounter();
            reach(boss, 'contact', 220); boss.consumeContact(true);
            reach(boss, 'exposed'); boss.hit(2); reach(boss, 'released');
            return { snapshot: boss.snapshot(), history: boss.history };
        });
        expect(runs[0]).toEqual(runs[1]);
    });
    test('private scene is not registered in production, and new films remain disabled', () => {
        const root = path.join(__dirname, '../..');
        for (const file of ['src/game.js', 'src/utils/SceneLoader.js', 'src/scenes/levels/FinalVoidLevel.js']) {
            expect(fs.readFileSync(path.join(root, file), 'utf8')).not.toMatch(/TrumptopusPrototype|TrumptopusEncounter/);
        }
        expect(require('../config/final-void-films.json').enabled).toBe(false);
        expect(source).not.toMatch(/Math\.random|Date\.|\bwindow[.\[]|\bfetch\s*\(|localStorage/);
    });
});
