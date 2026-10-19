const { readPinnedSource } = require('./support/pinnedSourceFixture.cjs');
const vm = require('node:vm'), { parse } = require('@babel/parser');
const { fixture, factsFor, clone, epoch } = require('./support/levelCompletionFixture.cjs');
const oldSource = readPinnedSource('6cec867f:src/scenes/levels/CrystalCavesLevel.js');
const cls = parse(oldSource, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
const method = name => { const node = cls.body.body.find(node => node.key?.name === name); return `({${oldSource.slice(node.start, node.end)}}).${name}`; };
const oldDefeat = method('onBossDefeated'), oldComplete = method('onLevelComplete');

describe('Crystal complete packet preserves its actual before-Guardian ordering', () => {
    let owned;
    beforeEach(() => { owned = []; }); afterEach(() => owned.forEach(f => f.close()));
    const create = options => { const f = fixture({ level: 1, ...options }); owned.push(f); return f; };
    const input = () => factsFor(1, { guardianRestoredBefore: true, guardianRestoredAt: epoch });
    function originalScene(f) {
        const scene = new f.api.Completion(factsFor(1), f.effects), boss = { body: { setAllowGravity() {} }, setVelocity() {}, setTint() {} };
        Object.assign(scene, { boss, starFragmentsCollected: 2, clearCrystalPillarWork() {}, clearCrystalBossPacing() {},
            showFloatingText() {}, physics: { pause() {} }, time: { delayedCall() {} }, tweens: { add() {} }, cameras: { main: { zoomTo() {} } } });
        f.selected.AudioManager.playLevelUp = () => {};
        vm.runInContext(oldDefeat, f.context).call(scene); return scene;
    }
    function verify(options = {}, elapsed = 0) {
        const old = create(options), candidate = create(options), scene = originalScene(old);
        if (elapsed) { old.advanceClock(elapsed); candidate.advanceClock(elapsed); }
        const plan = candidate.calculate({ ...input(), now: epoch + elapsed, time: 1000 + elapsed });
        expect(plan.status).toBe('calculated'); vm.runInContext(oldComplete, old.context).call(scene);
        expect(plan.result).toEqual(clone(scene.levelCompletionResult));
        const business = state => { const data = clone(state); delete data.savedAt; delete data.player.playTime; delete data.player.lastPlayed; delete data.session.sessionStart; return data; };
        expect(business(plan.state)).toEqual(business(old.snapshot())); expect(plan.notifications).toEqual(old.notifications);
        expect(plan.effects).toEqual(old.effects); expect(plan.legacySaveRequests).toHaveLength(old.calls.length);
        expect(candidate.calls).toEqual([]); expect(candidate.notifications).toEqual([]); expect(candidate.effects).toEqual([]);
        if (options.mode !== 'fallbacks') {
            const battle = plan.notifications.findIndex(packet => packet.event === 'changed:combat.bossesDefeated');
            const completion = plan.notifications.findIndex(packet => packet.event === 'changed:levels.crystalCaves.completed');
            expect(battle).toBeLessThan(completion); expect(plan.projections.achievements.pendingClaims).toEqual(clone(old.selected.AchievementSystem.pendingClaims));
        }
        return plan;
    }
    test('normal first victory retains the real recipe, badge checks, kit and notifications', () => { verify(); });
    test('absent services retain the actual fallback behaviour', () => { verify({ mode: 'fallbacks' }); });
    test.each(['shared', 'separate', 'mixed'])('warm %s achievement caches keep original alias semantics', kind => {
        verify({ seed: ({ selected }) => {
            const manager = selected.AchievementSystem; manager.recordEvent('guardian_restored', {});
            if (kind !== 'shared') for (const item of Object.values(manager.definitions)) {
                item.progress = clone(item.progress); if (kind === 'separate') item.claimed = clone(item.claimed);
            }
        } });
    });
    test('a legitimate replay keeps existing coins/bond/battle rules without another campaign count', () => {
        const plan = verify({ seed: ({ complete, selected }) => { complete(factsFor(1)); selected.AchievementSystem.recordEvent('guardian_restored', {}); } });
        expect(plan.result.firstCompletion).toBe(false);
    });
    test('original Guardian timestamp and delayed shared-completion time remain distinct', () => {
        const plan = verify({}, 5000);
        expect(plan.result.time).toBe(6000);
        expect(plan.notifications.find(packet => packet.event === 'stateChanged' && packet.data.path === 'combat.bossesDefeated').data.timestamp).toBe(epoch);
        expect(plan.notifications.find(packet => packet.event === 'stateChanged' && packet.data.path === 'story.projectBeacon.expeditionCheckpoint').data.timestamp).toBe(epoch + 5000);
    });
    test.each(['unissued', 'foreign', 'changed-source', 'changed-achievements', 'invalid-event'])(
        '%s cannot continue or bless a new source', kind => {
            const f = create(), source = f.participants.achievements;
            let prefix = f.api.calculateCompletionGuardianPrefix(source, f.state.state, epoch);
            expect(prefix.status).toBe('calculated'); const state = clone(prefix.state), event = { levelId: 'crystalCaves', time: 1000, noDamage: true, speedrunThreshold: 180000 };
            if (kind === 'unissued') prefix = clone(prefix);
            if (kind === 'foreign') { const other = create(); prefix = other.api.calculateCompletionGuardianPrefix(other.participants.achievements, other.state.state, epoch); }
            if (kind === 'changed-source') f.selected.AchievementSystem = {};
            if (kind === 'changed-achievements') state.achievements = {};
            if (kind === 'invalid-event') event.time = '1000';
            const before = f.snapshot(); expect(f.api.continueCompletionLevelDraft(source, prefix, state, event, epoch).status).toBe('unqualified');
            expect(f.snapshot()).toEqual(before); expect(f.calls).toEqual([]);
        });
    test.each([{ guardianRestoredBefore: 1 }, { guardianRestoredAfter: true }, { guardianRestoredAt: epoch + 1 }, { guardianRestoredAt: -1 }, { levelId: 'auroraDepths' }])(
        'invalid before-order facts %j are protected', facts => {
            const f = create(), before = f.snapshot(); expect(f.calculate({ ...input(), ...facts }).status).toBe('unqualified');
            expect(f.snapshot()).toEqual(before); expect(f.calls).toEqual([]);
        });
});
