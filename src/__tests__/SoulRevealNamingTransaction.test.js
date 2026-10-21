const { readPinnedSource } = require('./support/pinnedSourceFixture.cjs');
const { fixture } = require('./support/soulNamingFixture.cjs');
const { loadAchievementSystem } = require('./support/achievementDraftFixture.cjs');

const vm = require('node:vm');
const { parse } = require('@babel/parser');
const { namingRosterFixture } = require('./support/namingRosterFixture.cjs');
const { attach: attachHatching } = require('./support/hatchingStartFixture.cjs');
const CloudSaveManager = require('../systems/CloudSaveManager.js');
const parent = readPinnedSource('9407eab8:src/scenes/SoulRevealScene.js');
const oldClass = parse(parent, { sourceType: 'module' }).program.body.find(node => node.type === 'ExportDefaultDeclaration').declaration;
const oldMethod = oldClass.body.body.find(node => node.key?.name === 'finalizeName');
const loadOld = () => vm.runInNewContext(`({${parent.slice(oldMethod.start, oldMethod.end)}}).finalizeName`,
    { window, localStorage, console, Date, Math, devLog() {} });

describe('naming saves one complete result before handing it to the reveal', () => {
    let f;
    beforeEach(() => {
        jest.useFakeTimers(); jest.setSystemTime(1700000000777);
        localStorage.clear(); document.body.replaceChildren();
        for (const method of ['log', 'warn', 'error']) jest.spyOn(console, method).mockImplementation(() => {});
        for (const key of ['CloudSave', 'AchievementSystem', 'AudioManager', 'BirthEventSystem']) delete window[key];
        f = fixture();
    });
    afterEach(() => {
        f.close(); jest.restoreAllMocks(); jest.clearAllTimers(); jest.useRealTimers();
        for (const key of ['GameState', 'CloudSave', 'AchievementSystem', 'AudioManager', 'BirthEventSystem']) delete window[key];
        document.body.replaceChildren();
    });
    const actualAchievements = () => {
        const { system } = loadAchievementSystem(f.state); window.AchievementSystem = system; return system;
    };

    test('control: the ordinary complete result contains the chosen name, same hatch and soul profile', () => {
        f.scene.finalizeName();
        const durable = JSON.parse(f.raw());
        expect(durable.creature.name).toBe('Fictional Glow'); expect(durable.creature.named).toBe(true);
        expect(durable.creature.genes.id).toBe('fictional-hatched-genes');
        expect(durable.creature.id).toBe(durable.creatures[0].id); expect(durable.creature.soulData).toBeDefined();
        expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
    });

    test.each(['fresh', 'reload', 'retry-protected-save'])(
        '%s opening Start, generated hatch and naming preserve the same creature', mode => {
            f.close();
            f = namingRosterFixture(() => {}, { beforeHatch({ state, scene }) {
                attachHatching(scene, 'createOpeningStartDraft');
                const opening = scene.createOpeningStartDraft(state);
                expect(state.commitHatchSaveDraft(opening.state, {
                    notifications: opening.notifications
                }).success).toBe(true);
            } });
            const emptyLineage = { isOffspring: false, generation: null, parentIds: null,
                offspringBonus: null, hasAncientLineage: false, ancientProphecy: null };
            expect(f.state.get('creature')).toMatchObject(emptyLineage);
            const before = JSON.parse(f.raw());
            if (mode === 'retry-protected-save') {
                f.state.holdSaveAdmission({ code: 'save_unreadable' }, 'local');
            }
            if (mode !== 'fresh') expect(f.state.load()).toBe(true);
            actualAchievements();
            f.button.click();
            expect(f.state.getSaveAdmission().status).toBe('ready');
            expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
            const durable = JSON.parse(f.raw());
            expect(durable.creature.named).toBe(true);
            expect(durable.creature.name).toBe('Fictional Glow');
            expect(durable.creature.genes).toEqual(before.creature.genes);
            expect(durable.creature.dna).toEqual(before.creature.dna);
            expect(durable.creature.care).toEqual(before.creature.care);
            expect(durable.creature.soulData).toBeDefined();
            expect(durable.creatures).toHaveLength(1);
            expect(durable.creatures[0].id).toBe(durable.creature.id);
            expect(durable.stats.creaturesHatched).toBe(1);
        }
    );

    test.each([
        ['isOffspring', true], ['generation', 1], ['parentIds', ['fictional-parent']],
        ['offspringBonus', {}], ['hasAncientLineage', true], ['ancientProphecy', 'fictional prophecy'],
        ['isOffspring', null], ['generation', false], ['parentIds', []],
        ['offspringBonus', false], ['hasAncientLineage', null], ['ancientProphecy', ''],
        ['unrecognisedLineage', null]
    ])('non-default %s=%j remains protected without changing saved progress', (key, value) => {
        f.state.set(`creature.${key}`, value);
        expect(f.state.save()).toBe(true);
        const before = f.raw(), memory = JSON.stringify(f.state.state);
        f.button.click();
        expect(f.state.getSaveAdmission().status).toBe('held');
        expect(f.raw()).toBe(before);
        expect(JSON.stringify(f.state.state)).toBe(memory);
        expect(f.scene.showLivingPortraitHandoff).not.toHaveBeenCalled();
    });

    test('actual achievements do not publish an incomplete intermediate save', () => {
        actualAchievements(); const set = Storage.prototype.setItem, writes = [];
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key === f.state.saveKey) writes.push(JSON.parse(value));
            return set.call(this, key, value);
        });
        f.scene.finalizeName();
        expect(writes).toHaveLength(1); expect(writes[0].creature.soulData).toBeDefined();
        expect(writes[0].stats.creaturesHatched).toBe(1);
    });

    test('a primary refusal keeps memory, controls, achievement progress and the same draft available for retry', () => {
        const achievements = actualAchievements(), before = JSON.stringify(f.state.state), raw = f.raw();
        const progress = JSON.stringify(achievements.definitions), set = Storage.prototype.setItem;
        let refuse = true;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key === f.state.saveKey && refuse) throw Error('fictional refusal');
            return set.call(this, key, value);
        });
        f.button.click();
        expect(JSON.stringify(f.state.state)).toBe(before); expect(f.raw()).toBe(raw);
        expect(JSON.stringify(achievements.definitions)).toBe(progress);
        expect(f.scene.canProceed).toBe(true); expect(f.scene.showLivingPortraitHandoff).not.toHaveBeenCalled();
        refuse = false; f.button.click();
        expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
        expect(f.state.get('stats.creaturesHatched')).toBe(1); expect(f.state.get('creatures')).toHaveLength(1);
    });

    test.each(['full', 'duplicate', 'family'])('%s is protected before consuming controls, changing a name or allocating an ID', kind => {
        if (kind === 'family') f.state.set('creature.parentIds', ['fictional-parent-a', 'fictional-parent-b']);
        else {
            f.state.set('creatures', [{ id: 'fictional-existing', name: 'Fictional existing creature',
                genes: { id: kind === 'duplicate' ? 'fictional-hatched-genes' : 'fictional-other-genes' } }]);
            if (kind === 'full') f.state.set('maxCreatures', 1);
        }
        expect(f.state.save()).toBe(true);
        const memory = JSON.stringify(f.state.state), raw = f.raw(), random = jest.spyOn(Math, 'random');
        f.scene.finalizeName();
        expect(JSON.stringify(f.state.state)).toBe(memory); expect(f.raw()).toBe(raw);
        expect(random).not.toHaveBeenCalled(); expect(f.scene.canProceed).toBe(true);
        expect(f.scene.showLivingPortraitHandoff).not.toHaveBeenCalled();
    });

    test('optional transition audio cannot strand an already saved naming result', () => {
        window.AudioManager = { playLevelUp() { throw Error('fictional audio failure'); } };
        expect(() => f.scene.finalizeName()).not.toThrow();
        expect(JSON.parse(f.raw()).creature.soulData).toBeDefined();
        expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
    });

    test('a failed reveal can retry presentation without another collection allocation or hatch award', () => {
        actualAchievements();
        f.scene.showLivingPortraitHandoff.mockImplementationOnce(() => { throw Error('fictional reveal failure'); });
        expect(() => f.scene.finalizeName()).not.toThrow();
        const raw = f.raw(), random = jest.spyOn(Math, 'random');
        f.scene.retryNamingSave();
        expect(f.raw()).toBe(raw); expect(random).not.toHaveBeenCalled();
        expect(f.state.get('creatures')).toHaveLength(1); expect(f.state.get('stats.creaturesHatched')).toBe(1);
        expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(2);
    });

    test('the first observer sees complete durable name/profile and matching original achievement progress', () => {
        const achievements = actualAchievements(), observed = [];
        const progress = () => Object.fromEntries(Object.entries(achievements.definitions)
            .map(([id, definition]) => [id, { progress: definition.progress, claimed: definition.claimed }]));
        const coherent = () => {
            const raw = JSON.parse(f.raw());
            expect(raw.creature.soulData).toBeDefined(); expect(raw.creature.id).toBe(raw.creatures[0].id);
            expect(raw.stats.creaturesHatched).toBe(1); expect(raw.achievements).toEqual(progress());
            expect(achievements.pendingClaims.length).toBeGreaterThan(0);
        };
        const emit = f.state.emit.bind(f.state);
        f.state.emit = (event, data) => {
            if (!['saveBackupCreated', 'saveAdmissionChanged'].includes(event)) {
                coherent(); observed.push({ kind: 'state', event });
            }
            return emit(event, data);
        };
        achievements.events = { emit(event) { coherent(); observed.push({ kind: 'achievement', event }); return true; } };
        const save = jest.spyOn(f.state, 'save'), record = jest.spyOn(achievements, 'recordEvent');
        const claim = jest.spyOn(achievements, 'claimReward'), check = jest.spyOn(achievements, 'checkAchievements');
        f.scene.finalizeName();
        const packets = f.scene.namingAttempt.prepared.notifications;
        expect(observed).toEqual([...packets.map(({ kind, event }) => ({ kind, event })), { kind: 'state', event: 'saved' }]);
        expect(save).not.toHaveBeenCalled(); expect(record).not.toHaveBeenCalled(); expect(claim).not.toHaveBeenCalled();
        expect(check.mock.contexts.every(context => context !== achievements)).toBe(true);
        expect(Object.isFrozen(packets)).toBe(true); expect(packets.every(Object.isFrozen)).toBe(true);
    });

    test.each([false, true])('inventory=%s actual generated hatch, naming and reconstruction retain selected identity and prior records', inventory => {
        f.close(); f = namingRosterFixture(state => {
            state.set('creature.bond.experience', 77);
            state.set('creature.powerHistory', [{ id: 'fictional-earned-power' }]);
        }, { inventory });
        const previous = JSON.parse(JSON.stringify(f.state.get('creatures'))), care = JSON.parse(JSON.stringify(f.state.get('creature.care')));
        actualAchievements(); f.scene.finalizeName();
        expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
        const restored = new f.state.constructor(); f.states.push(restored); window.GameState = restored;
        expect(restored.load()).toBe(true); const index = restored.get('activeCreatureIndex');
        expect(index).toBe(inventory ? 1 : 0); expect(restored.get('creatures').slice(0, previous.length)).toEqual(previous);
        expect(restored.get('creature.genes')).toEqual(f.genes); expect(restored.get('creature.dna')).toEqual(f.dna);
        expect(restored.get('creature.care')).toEqual(care); expect(restored.get('creature.experience')).toBe(50);
        expect(restored.get('creature.bond.experience')).toBe(77); expect(restored.get('creature.lifecycle.stage')).toBe('baby');
        expect(restored.get('creature.powerHistory')).toEqual([{ id: 'fictional-earned-power' }]);
        expect(restored.get('stats.creaturesHatched')).toBe(1);
    });

    test('write retries retain the same selected draft ID and name through elapsed time and repeated native events', () => {
        actualAchievements(); const set = Storage.prototype.setItem, random = jest.spyOn(Math, 'random');
        let refuse = true;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key === f.state.saveKey && refuse) throw Error('fictional refusal');
            return set.call(this, key, value);
        });
        f.button.dispatchEvent(new Event('pointerup', { bubbles: true, cancelable: true }));
        const draft = f.scene.namingAttempt.prepared, id = draft.creatureId;
        expect(random).toHaveBeenCalledTimes(1); expect(f.input.readOnly).toBe(true);
        f.button.dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }));
        expect(random).toHaveBeenCalledTimes(1); expect(f.scene.namingAttempt.prepared).toBe(draft);
        jest.setSystemTime(1700000005777); refuse = false;
        document.querySelector('[data-mythical-naming-save] button').click();
        expect(JSON.parse(f.raw()).creature.id).toBe(id); expect(f.state.get('creature.name')).toBe('Fictional Glow');
        expect(random).toHaveBeenCalledTimes(1); expect(f.state.get('stats.creaturesHatched')).toBe(1);
        expect(f.state.get('player.playTime')).toBe(5000);
    });

    function change(kind, achievements) {
        if (kind === 'manager') { const next = f.replaceManager(); next.set('player.cosmicCoins', 77); expect(next.save()).toBe(true); }
        if (kind === 'state') f.state.set('player.cosmicCoins', 77);
        if (kind === 'epoch') f.state.releaseSaveAdmission();
        if (kind === 'lease') f.state.beginCloudWrite('mutation', f.state.createSaveSnapshot(), () => true);
        if (kind === 'cloud') window.CloudSave = { campaignEpoch: 1 };
        if (kind === 'scene') f.scene.init({});
        if (kind === 'shutdown') f.scene.shutdown();
        if (kind === 'controls') f.scene.nameSubmitButton = document.createElement('button');
        if (kind === 'achievement manager') window.AchievementSystem = {};
        if (kind === 'achievement progress') achievements.definitions[Object.keys(achievements.definitions)[0]].progress = {};
        if (kind === 'claims') achievements.pendingClaims = [];
        if (kind === 'emitter') achievements.events = { emit() {} };
    }
    const snapshot = achievements => ({ state: JSON.stringify(f.state.state), raw: f.raw(), admission: f.state.saveAdmission,
        lease: f.state.cloudWriteLease, game: window.GameState, cloud: window.CloudSave, system: window.AchievementSystem,
        progress: JSON.stringify(achievements.definitions), claims: JSON.stringify(achievements.pendingClaims), emitter: achievements.events });

    for (const boundary of ['backup', 'primary']) {
        test.each(['manager', 'state', 'epoch', 'lease', 'cloud', 'scene', 'controls', 'achievement manager',
            'achievement progress', 'claims', 'emitter'])(`${boundary} / %s cannot receive an old publication or handoff`, kind => {
            const achievements = actualAchievements(); let next;
            const retire = () => { change(kind, achievements); next = snapshot(achievements); };
            if (boundary === 'backup') {
                const off = f.state.on('saveBackupCreated', () => { off(); retire(); });
            } else {
                const set = Storage.prototype.setItem; let once = false;
                jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
                    const result = set.call(this, key, value);
                    if (key === f.state.saveKey && !once) { once = true; retire(); }
                    return result;
                });
            }
            f.scene.finalizeName(); expect(next).toBeDefined(); expect(snapshot(achievements)).toEqual(next);
            expect(f.scene.showLivingPortraitHandoff).not.toHaveBeenCalled();
        });
    }

    test.each(['exact', 'mismatch', 'unreadable'])('%s write-then-throw is classified by positive bytes, never by the exception alone', kind => {
        actualAchievements(); const set = Storage.prototype.setItem, get = Storage.prototype.getItem;
        let wrote = false, attempted;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            const result = set.call(this, key, value);
            if (key === f.state.saveKey) {
                wrote = true; attempted = String(value);
                if (kind === 'mismatch') {
                    const other = JSON.parse(value); other.player.cosmicCoins = 77; set.call(this, key, JSON.stringify(other));
                }
                throw Error('fictional acknowledgement failure');
            }
            return result;
        });
        if (kind === 'unreadable') jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
            if (wrote && key === f.state.saveKey) throw Error('fictional read failure');
            return get.call(this, key);
        });
        f.scene.finalizeName();
        expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(kind === 'exact' ? 1 : 0);
        if (kind === 'exact') {
            expect(get.call(localStorage, f.state.saveKey)).toBe(attempted);
            expect(f.state.get('stats.creaturesHatched')).toBe(1); f.scene.finalizeName();
            expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
        } else {
            expect(f.state.getSaveAdmission().status).toBe('held');
            expect(f.scene.namingAttempt.phase).toBe('protected');
            const raw = get.call(localStorage, f.state.saveKey); f.scene.retryNamingSave();
            expect(get.call(localStorage, f.state.saveKey)).toBe(raw);
        }
    });

    test('a real partial achievement publication remains held without rollback or replay', () => {
        const achievements = actualAchievements(), first = achievements.definitions[Object.keys(achievements.definitions)[0]];
        const before = first.progress;
        const off = f.state.on('saveBackupCreated', () => {
            off(); Object.defineProperty(first, 'claimed', { writable: false });
        });
        f.scene.finalizeName();
        expect(first.progress).not.toBe(before); expect(f.scene.namingAttempt.publication.isPublished()).toBe(false);
        expect(f.state.getSaveAdmission().status).toBe('held');
        expect(JSON.parse(f.raw()).creature.soulData).toBeDefined();
        expect(f.scene.showLivingPortraitHandoff).not.toHaveBeenCalled();
        const state = JSON.stringify(f.state.state), raw = f.raw(), progress = first.progress;
        f.scene.retryNamingSave();
        expect(JSON.stringify(f.state.state)).toBe(state); expect(f.raw()).toBe(raw); expect(first.progress).toBe(progress);
    });

    test.each(['state dispatch', 'achievement dispatch', 'saved dispatch'])('%s failure after partial delivery cannot replay packets or claim non-commit', kind => {
        const achievements = actualAchievements(), delivered = [];
        achievements.events = { emit(event) { delivered.push(event); if (kind === 'achievement dispatch') throw Error('fictional emitter fault'); } };
        const emit = f.state.emit.bind(f.state);
        f.state.emit = (event, data) => {
            if (event === 'stateChanged' || event === 'saved') delivered.push(event);
            if ((kind === 'state dispatch' && event === 'stateChanged') || (kind === 'saved dispatch' && event === 'saved')) {
                throw Error('fictional dispatch boundary failure');
            }
            return emit(event, data);
        };
        f.scene.finalizeName();
        expect(f.state.getSaveAdmission().status).toBe('held'); expect(delivered.length).toBeGreaterThan(0);
        expect(JSON.parse(f.raw()).creature.soulData).toBeDefined();
        const once = [...delivered], raw = f.raw(); f.scene.retryNamingSave();
        expect(delivered).toEqual(once); expect(f.raw()).toBe(raw);
        expect(f.scene.showLivingPortraitHandoff).not.toHaveBeenCalled();
    });

    test.each(['state', 'scene', 'shutdown', 'achievement progress', 'claims', 'emitter'])(
        'a domain observer adopting %s stops the remaining stream without poisoning that successor', kind => {
            const achievements = actualAchievements(); let next;
            const off = f.state.on('stateChanged', () => {
                off(); change(kind, achievements); next = snapshot(achievements);
            });
            const saved = jest.fn(); f.state.on('saved', saved);
            f.scene.finalizeName();
            expect(next).toBeDefined(); expect(snapshot(achievements)).toEqual(next);
            expect(saved).not.toHaveBeenCalled(); expect(f.scene.showLivingPortraitHandoff).not.toHaveBeenCalled();
        }
    );

    test('ordinary caught GameState listener errors retain their existing semantics', () => {
        actualAchievements(); f.state.on('stateChanged', () => { throw Error('fictional caught listener fault'); });
        f.scene.finalizeName(); expect(f.state.getSaveAdmission().status).toBe('ready');
        expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
    });

    test.each(['parentIds', 'generation', 'isOffspring', 'offspringBonus', 'lineage', 'birthEvents', 'isTwin',
        'fictionalUnknownField'])('%s remains unsupported and protected before allocation rather than silently discarded', field => {
            f.state.set(`creature.${field}`, { fictional: true }); expect(f.state.save()).toBe(true);
            const raw = f.raw(), before = JSON.stringify(f.state.state), random = jest.spyOn(Math, 'random');
            f.scene.finalizeName(); expect(random).not.toHaveBeenCalled();
            expect(f.raw()).toBe(raw); expect(JSON.stringify(f.state.state)).toBe(before);
            expect(f.state.getSaveAdmission().status).toBe('held'); expect(f.scene.canProceed).toBe(true);
        }
    );

    test('a malformed prepared packet plan fails before the primary write or live progress changes', () => {
        const achievements = actualAchievements(), prepare = achievements.prepareHatchEventDraft.bind(achievements);
        const before = JSON.stringify(f.state.state), raw = f.raw();
        jest.spyOn(achievements, 'prepareHatchEventDraft').mockImplementation((state, data) => {
            const result = prepare(state, data); result.events.push({ kind: 'state', event: 'saved', data: {} }); return result;
        });
        const set = jest.spyOn(Storage.prototype, 'setItem'); f.scene.finalizeName();
        expect(set).not.toHaveBeenCalled(); expect(f.raw()).toBe(raw); expect(JSON.stringify(f.state.state)).toBe(before);
        expect(f.state.getSaveAdmission().status).toBe('held');
        expect(f.scene.showLivingPortraitHandoff).not.toHaveBeenCalled();
    });

    test('a same-reader raw replacement during preparation stays protected before any write', () => {
        const achievements = actualAchievements(), prepare = achievements.prepareHatchEventDraft.bind(achievements);
        const memory = JSON.stringify(f.state.state); let replacement;
        jest.spyOn(achievements, 'prepareHatchEventDraft').mockImplementation((state, data) => {
            const result = prepare(state, data), other = JSON.parse(f.raw()); other.player.cosmicCoins = 77;
            replacement = JSON.stringify(other); localStorage.setItem(f.state.saveKey, replacement); return result;
        });
        f.scene.finalizeName(); expect(f.raw()).toBe(replacement); expect(JSON.stringify(f.state.state)).toBe(memory);
        expect(f.state.getSaveAdmission().status).toBe('held'); expect(f.scene.showLivingPortraitHandoff).not.toHaveBeenCalled();
    });

    test('cleanup failure retries its retained owned handle, never its save or award', () => {
        actualAchievements(); f.scene.nameDomElement.destroy.mockImplementationOnce(() => { throw Error('fictional cleanup failure'); });
        f.scene.finalizeName(); const raw = f.raw();
        expect(f.scene.showLivingPortraitHandoff).not.toHaveBeenCalled();
        document.querySelector('[data-mythical-naming-save] button').click();
        expect(f.raw()).toBe(raw); expect(f.state.get('stats.creaturesHatched')).toBe(1);
        expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
    });

    test('a retained presentation retry is inert after scene shutdown', () => {
        actualAchievements(); f.scene.showLivingPortraitHandoff.mockImplementationOnce(() => { throw Error('fictional reveal failure'); });
        f.scene.finalizeName(); const retry = document.querySelector('[data-mythical-naming-save] button'), raw = f.raw();
        f.scene.shutdown(); retry.click();
        expect(f.raw()).toBe(raw); expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
        expect(document.querySelector('[data-mythical-naming-save]')).toBeNull();
    });

    test.each([true, false])('owned upload=%s permits only the already-committed presentation retry without another write', owned => {
        const cloud = new CloudSaveManager({ client: null, gameState: f.state, storage: localStorage, lockManager: null });
        window.CloudSave = cloud; actualAchievements();
        try {
            f.scene.showLivingPortraitHandoff.mockImplementationOnce(() => { throw Error('fictional reveal failure'); });
            f.scene.finalizeName(); const raw = f.raw();
            const lease = f.state.beginCloudWrite('upload', f.state.createSaveSnapshot(), cloud.captureCampaignGuard());
            cloud.activeCloudWrite = owned ? lease : null;
            const write = jest.spyOn(f.state, 'commitHatchSaveDraft'), random = jest.spyOn(Math, 'random');
            f.scene.retryNamingSave();
            expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(owned ? 2 : 1);
            expect(write).not.toHaveBeenCalled(); expect(random).not.toHaveBeenCalled(); expect(f.raw()).toBe(raw);
        } finally { cloud.destroy(); }
    });

    test.each([false, true])('achievements=%s retains the immutable parent complete payload and relative domain-event data', withAchievements => {
        const execute = old => {
            f.close(); localStorage.clear(); delete window.AchievementSystem; f = fixture();
            const achievements = withAchievements ? actualAchievements() : null, events = [];
            if (achievements) achievements.events = { emit: (event, data) => {
                events.push(JSON.parse(JSON.stringify({ kind: 'achievement', event, data })));
            } };
            const emit = f.state.emit.bind(f.state);
            f.state.emit = (event, data) => {
                if (!['saveBackupCreated', 'saved'].includes(event)) events.push(JSON.parse(JSON.stringify({ kind: 'state', event, data })));
                return emit(event, data);
            };
            const random = jest.spyOn(Math, 'random').mockReturnValue(0.375);
            (old ? loadOld() : f.scene.finalizeName).call(f.scene);
            const observed = JSON.parse(JSON.stringify({ state: f.state.state, raw: JSON.parse(f.raw()), events,
                progress: achievements?.definitions, claims: achievements?.pendingClaims, draws: random.mock.calls.length }));
            random.mockRestore(); return observed;
        };
        expect(execute(false)).toEqual(execute(true));
    });
});
