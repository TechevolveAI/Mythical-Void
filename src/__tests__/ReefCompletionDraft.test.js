const { readPinnedSource } = require('./support/pinnedSourceFixture.cjs');
const vm = require('node:vm'), { parse } = require('@babel/parser');
const { fixture, factsFor, clone, epoch } = require('./support/levelCompletionFixture.cjs');
const source = readPinnedSource('99fe0e6d:src/scenes/levels/ReefLevel.js');
const cls = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
const method = name => { const node = cls.body.body.find(node => node.key?.name === name); return `({${source.slice(node.start, node.end)}}).${name}`; };
const defeat = method('defeatBoss'), complete = method('showVictoryScreen');

describe('Reef packet preserves the actual delayed Guardian-before recipe', () => {
    let owned;
    beforeEach(() => { owned = []; }); afterEach(() => owned.forEach(f => f.close()));
    const create = options => { const f = fixture({ level: 2, ...options }); owned.push(f); return f; };
    function originalScene(f) {
        // The real pinned defeat method executes its actual achievement branch.
        // Drawing/timer/sequence ports stay inert, with no progression substitute.
        f.context.ReefVictorySequence = class {
            constructor() {}
            requireCurrent() { return true; }
            present(action) { return action(); }
            later() {} fade() {} fadeUI() {}
        };
        f.context.REEF_GUARDIAN_ARENA = { bossX: 500 };
        const scene = new f.api.Completion(factsFor(2), f.effects);
        Object.assign(scene, { player: { active: true }, boss: { active: true }, bossBody: { body: {} }, bossMinions: [], bossFightActive: true,
            clearReefBossSummons() {}, clearReefBossLunge() {}, clearReefBossTears() {}, showFloatingText() {}, showRegionalVictorySummary() {} });
        f.selected.AudioManager.playLevelUp = () => {};
        vm.runInContext(defeat, f.context).call(scene); return scene;
    }
    function verify(options = {}, elapsed = 2600) {
        const old = create(options), candidate = create(options), scene = originalScene(old);
        old.advanceClock(elapsed); candidate.advanceClock(elapsed);
        const plan = candidate.calculate(factsFor(2, { guardianRestoredBefore: true, guardianRestoredAt: epoch,
            now: epoch + elapsed, time: 1000 + elapsed }));
        expect(plan.status).toBe('calculated'); vm.runInContext(complete, old.context).call(scene);
        const business = state => { const data = clone(state); delete data.savedAt; delete data.player.playTime; delete data.player.lastPlayed; delete data.session.sessionStart; return data; };
        expect(plan.result).toEqual(clone(scene.levelCompletionResult)); expect(business(plan.state)).toEqual(business(old.snapshot()));
        expect(plan.notifications).toEqual(old.notifications); expect(plan.effects).toEqual(old.effects); expect(plan.legacySaveRequests).toHaveLength(old.calls.length);
        expect(candidate.calls).toEqual([]); expect(candidate.notifications).toEqual([]); expect(candidate.effects).toEqual([]);
        return plan;
    }
    test('normal first victory retains rewards, bond, residents, achievement order and event data', () => {
        const plan = verify(); expect(plan.result.time).toBe(3600);
        expect(plan.notifications.find(packet => packet.event === 'stateChanged' && packet.data.path === 'combat.bossesDefeated').data.timestamp).toBe(epoch);
        expect(plan.notifications.find(packet => packet.event === 'stateChanged' && packet.data.path === 'story.projectBeacon.expeditionCheckpoint').data.timestamp).toBe(epoch + 2600);
    });
    test('absent services retain existing fallback semantics', () => { verify({ mode: 'fallbacks' }); });
    test.each(['shared', 'separate', 'mixed'])('warm %s achievement cache keeps original alias semantics', kind => {
        verify({ seed: ({ selected }) => {
            const manager = selected.AchievementSystem; manager.recordEvent('guardian_restored', {});
            if (kind !== 'shared') for (const entry of Object.values(manager.definitions)) {
                entry.progress = clone(entry.progress); if (kind === 'separate') entry.claimed = clone(entry.claimed);
            }
        } });
    });
    test('legitimate replay retains the established repeat reward policy without another campaign completion', () => {
        const plan = verify({ seed: ({ complete, selected }) => { complete(factsFor(2)); selected.AchievementSystem.recordEvent('guardian_restored', {}); } });
        expect(plan.result.firstCompletion).toBe(false);
    });
});
