const { readPinnedSource } = require('./support/pinnedSourceFixture.cjs');
const vm = require('node:vm'), { parse } = require('@babel/parser');
const { fixture, factsFor, clone, epoch } = require('./support/levelCompletionFixture.cjs');
const source = readPinnedSource('6d84454c:src/scenes/levels/AuroraDepthsLevel.js');
const cls = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
const node = cls.body.body.find(node => node.key?.name === 'showBossVictory');
const originalVictory = `({${source.slice(node.start, node.end)}}).showBossVictory`;

describe('Aurora packet retains the actual completion-then-Guardian ordering', () => {
    let owned;
    beforeEach(() => { owned = []; }); afterEach(() => owned.forEach(f => f.close()));
    const create = options => { const f = fixture({ level: 4, ...options }); owned.push(f); return f; };
    function verify(options = {}, elapsed = 1800) {
        const old = create(options), candidate = create(options), scene = new old.api.Completion(factsFor(4), old.effects);
        const text = { setOrigin() { return this; }, setScrollFactor() { return this; }, setDepth() { return this; }, setAlpha() { return this; } };
        Object.assign(scene, { getLevelModalLayout: () => ({ width: 390, contentWidth: 340, y: value => value, font: (_desktop, phone) => phone }),
            add: { text: () => text }, tweens: { add() {} } });
        old.selected.AudioManager.playLevelUp = () => {};
        old.advanceClock(elapsed); candidate.advanceClock(elapsed);
        const plan = candidate.calculate(factsFor(4, { now: epoch + elapsed, time: 1000 + elapsed, guardianRestoredAfter: true }));
        expect(plan.status).toBe('calculated'); vm.runInContext(originalVictory, old.context).call(scene);
        const business = state => { const data = clone(state); delete data.savedAt; delete data.player.playTime; delete data.player.lastPlayed; delete data.session.sessionStart; return data; };
        expect(plan.result).toEqual(clone(scene.levelCompletionResult)); expect(business(plan.state)).toEqual(business(old.snapshot()));
        expect(plan.notifications).toEqual(old.notifications); expect(plan.effects).toEqual(old.effects); expect(plan.legacySaveRequests).toHaveLength(old.calls.length);
        expect(scene.auroraReactorFound).toBe(true); expect(candidate.calls).toEqual([]); expect(candidate.notifications).toEqual([]);
        if (options.mode !== 'fallbacks') {
            expect(plan.notifications.findIndex(packet => packet.event === 'changed:combat.bossesDefeated'))
                .toBeGreaterThan(plan.notifications.findIndex(packet => packet.event === 'changed:creature.bond'));
        }
        return plan;
    }
    test('first victory keeps the real reward, Aurora Guard, progress and delayed completion time', () => {
        const plan = verify(); expect(plan.result.time).toBe(2800);
        expect(plan.notifications.find(packet => packet.event === 'stateChanged' && packet.data.path === 'combat.bossesDefeated').data.timestamp).toBe(epoch + 1800);
    });
    test('missing services keep the established fallback behaviour', () => { verify({ mode: 'fallbacks' }); });
    test.each(['shared', 'separate', 'mixed'])('warm %s achievement cache retains original alias behaviour', kind => {
        verify({ seed: ({ selected }) => {
            const manager = selected.AchievementSystem; manager.recordEvent('guardian_restored', {});
            if (kind !== 'shared') for (const entry of Object.values(manager.definitions)) {
                entry.progress = clone(entry.progress); if (kind === 'separate') entry.claimed = clone(entry.claimed);
            }
        } });
    });
    test('legitimate replay retains the existing reward and campaign-count rules', () => {
        const plan = verify({ seed: ({ complete, selected }) => { complete(factsFor(4)); selected.AchievementSystem.recordEvent('guardian_restored', {}); } });
        expect(plan.result.firstCompletion).toBe(false);
    });
});
