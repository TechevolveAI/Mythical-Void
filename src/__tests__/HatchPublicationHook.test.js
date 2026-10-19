const { readPinnedSource } = require('./support/pinnedSourceFixture.cjs');
const { fixture } = require('./support/hatchPublicationFixture.cjs');

const vm = require('node:vm');
const { parse } = require('@babel/parser');
const before = readPinnedSource('d5579286:src/systems/GameState.js');
const declaration = parse(before, { sourceType: 'script' }).program.body.find(node => node.type === 'ClassDeclaration');
const method = declaration.body.body.find(node => node.key?.name === 'commitHatchSaveDraft');
const loadBefore = () => vm.runInNewContext(`({${before.slice(method.start, method.end)}}).commitHatchSaveDraft`,
    { window, localStorage, console, Date, Math, Promise });

describe('verified hatch adoption publishes prepared volatile progress before observers', () => {
    let f;
    beforeEach(() => {
        jest.useFakeTimers(); jest.setSystemTime(1700000000777);
        localStorage.clear();
        for (const method of ['log', 'warn', 'error']) jest.spyOn(console, method).mockImplementation(() => {});
        delete window.CloudSave; delete window.AchievementSystem;
        f = fixture();
    });
    afterEach(() => {
        f.close(); jest.restoreAllMocks(); jest.clearAllTimers(); jest.useRealTimers();
        delete window.GameState; delete window.CloudSave; delete window.AchievementSystem;
    });

    test('control: an unchanged default draft saves without invoking a publication hook', () => {
        const result = f.commit({ onPublished: undefined });
        expect(result.success).toBe(true); expect(result.isCurrent()).toBe(true);
        expect(JSON.parse(f.raw()).creature.name).toBe('Fictional Publication');
        expect(f.publish).not.toHaveBeenCalled();
    });

    test('the first prepared and saved observers see matching actual achievement progress and claims', () => {
        const observed = [];
        f.state.on('fictionalPrepared', () => observed.push(f.coherent()));
        f.state.on('saved', () => observed.push(f.coherent()));
        const result = f.commit({ notifications: [{ event: 'fictionalPrepared', data: {} }] });
        expect(result.success).toBe(true);
        expect(f.publish).toHaveBeenCalledTimes(1);
        expect(observed).toEqual([true, true]);
        expect(f.prepared.pendingClaims.length).toBeGreaterThan(0);
        expect(JSON.parse(f.raw()).stats.creaturesHatched).toBe(1);
        expect(f.prepared.state.achievements).toBeDefined();
        expect(JSON.parse(f.raw()).achievements).toEqual(f.prepared.state.achievements);
    });

    test('the internal publisher performs no live achievement calculation, save, claim or domain dispatch', () => {
        const live = ['recordEvent', 'checkAchievements', 'saveProgress', 'claimReward']
            .filter(name => typeof f.system[name] === 'function').map(name => jest.spyOn(f.system, name));
        const save = jest.spyOn(f.state, 'save');
        const result = f.commit({ onPublished() {
            const beforeEvents = f.events.length; f.publish(); expect(f.events).toHaveLength(beforeEvents);
        } });
        expect(result.success).toBe(true); expect(save).not.toHaveBeenCalled();
        for (const method of live) expect(method).not.toHaveBeenCalled();
    });

    test('a post-adoption publication exception retains the durable result and protects its current reader', () => {
        const result = f.commit({ onPublished() { throw Error('fictional publication failure'); } });
        expect(result.success).toBe(false);
        expect(f.state.state).toBe(f.staged);
        expect(JSON.parse(f.raw()).creature.name).toBe('Fictional Publication');
        expect(f.state.getSaveAdmission().status).toBe('held');
        expect(f.events.some(item => item.event === 'saved')).toBe(false);
    });

    test.each([
        ['null', null], ['object', {}], ['string', 'publish'], ['false', false],
        ['async', async function () {}], ['generator', function* () {}],
        ['async generator', async function* () {}], ['class', class FictionalPublisher {}]
    ])('%s publisher is refused before storage, state or admission effects', (_label, onPublished) => {
        const memory = JSON.stringify(f.state.state), storage = { ...localStorage };
        const admission = f.state.saveAdmission;
        const get = jest.spyOn(Storage.prototype, 'getItem'), set = jest.spyOn(Storage.prototype, 'setItem');
        const canCommit = jest.spyOn(f.state, 'canCommitHatchSave');
        expect(f.commit({ onPublished })).toEqual({ success: false, reason: 'hatch_save_unavailable' });
        expect(get).not.toHaveBeenCalled(); expect(set).not.toHaveBeenCalled();
        expect(canCommit).not.toHaveBeenCalled(); expect(f.state.saveAdmission).toBe(admission);
        expect(JSON.stringify(f.state.state)).toBe(memory); expect({ ...localStorage }).toEqual(storage);
    });

    test.each(['value', 'promise', 'thenable'])('%s return is protected, never awaited or treated as successful publication', kind => {
        const then = jest.fn();
        const value = kind === 'value' ? 1 : kind === 'promise' ? Promise.reject(Error('fictional rejected work')) :
            Object.defineProperty({}, 'then', { get: then });
        expect(f.commit({ onPublished() { return value; } }).success).toBe(false);
        expect(then).not.toHaveBeenCalled(); expect(f.state.state).toBe(f.staged);
        expect(f.state.getSaveAdmission()).toMatchObject({ status: 'held', reason: 'commit_failed' });
        expect(f.events).toEqual(expect.not.arrayContaining([expect.objectContaining({ event: 'saved' })]));
    });

    test.each([
        ['missing publisher', () => {}, undefined], ['null', null, () => {}], ['object', {}, () => {}],
        ['async', async function () {}, () => {}], ['generator', function* () {}, () => {}],
        ['async generator', async function* () {}, () => {}], ['class', class FictionalDispatch {}, () => {}]
    ])('%s notification dispatcher is refused before effects', (_label, onNotification, onPublished) => {
        const state = JSON.stringify(f.state.state), raw = f.raw();
        const get = jest.spyOn(Storage.prototype, 'getItem'), set = jest.spyOn(Storage.prototype, 'setItem');
        expect(f.commit({ onNotification, onPublished }).success).toBe(false);
        expect(get).not.toHaveBeenCalled(); expect(set).not.toHaveBeenCalled(); expect(f.publish).not.toHaveBeenCalled();
        expect(JSON.stringify(f.state.state)).toBe(state); get.mockRestore(); expect(f.raw()).toBe(raw);
    });

    test.each(['value', 'promise', 'thenable'])('a notification %s return after delivery stays possibly committed and is never replayed', kind => {
        const then = jest.fn(), delivered = [];
        const returned = kind === 'value' ? true : kind === 'promise' ? Promise.reject(Error('fictional rejected dispatch')) :
            Object.defineProperty({}, 'then', { get: then });
        const options = { notifications: [{ event: 'fictionalPrepared' }, { event: 'fictionalLater' }],
            onNotification(packet) { delivered.push(packet.event); return returned; } };
        expect(f.commit(options).success).toBe(false); expect(delivered).toEqual(['fictionalPrepared']);
        expect(then).not.toHaveBeenCalled(); expect(f.state.getSaveAdmission().status).toBe('held');
        expect(JSON.parse(f.raw()).creature.name).toBe('Fictional Publication');
        expect(f.commit(options).success).toBe(false); expect(delivered).toEqual(['fictionalPrepared']);
    });

    test.each([1, 2, 7])('a throw after prepared assignment %s protects the known partial publication without replay', throwAfter => {
        const onPublished = jest.fn(() => { f.publish({ throwAfter }); });
        const result = f.commit({ onPublished, notifications: [{ event: 'fictionalPrepared' }] });
        const heldRaw = f.raw(), heldState = JSON.stringify(f.state.state);
        expect(result.success).toBe(false); expect(f.state.state).toBe(f.staged);
        expect(f.matches(throwAfter)).toBe(true); expect(f.coherent()).toBe(false);
        expect(f.state.getSaveAdmission().status).toBe('held');
        expect(f.events.filter(item => ['fictionalPrepared', 'saved', 'saveError'].includes(item.event))).toEqual([]);
        expect(f.commit({ onPublished }).success).toBe(false);
        expect(onPublished).toHaveBeenCalledTimes(1); expect(f.publish).toHaveBeenCalledTimes(1);
        expect(f.raw()).toBe(heldRaw); expect(JSON.stringify(f.state.state)).toBe(heldState);
    });

    function successor(kind) {
        if (kind === 'manager') f.replaceManager();
        if (kind === 'progress') f.state.set('player.cosmicCoins', 77);
        if (kind === 'epoch') f.state.releaseSaveAdmission();
        if (kind === 'lease') f.state.beginCloudWrite('mutation', f.state.createSaveSnapshot(), () => true);
        if (kind === 'cloud') window.CloudSave = { campaignEpoch: 1 };
        if (kind === 'scene') f.retireScene();
        if (kind === 'achievement manager') window.AchievementSystem = {};
        if (kind === 'achievement progress') {
            const id = Object.keys(f.system.definitions)[0];
            f.system.definitions[id].progress = { ...f.system.definitions[id].progress, fictional: 77 };
        }
        if (kind === 'achievement claims') f.system.pendingClaims = [];
        if (kind === 'raw-only') {
            const other = f.state.createSaveSnapshot(); other.player.cosmicCoins = 77;
            localStorage.setItem(f.state.saveKey, JSON.stringify(other));
        }
    }
    const snapshot = () => ({ memory: JSON.stringify(f.state.state), raw: f.raw(), admission: f.state.saveAdmission,
        lease: f.state.cloudWriteLease, game: window.GameState, cloud: window.CloudSave,
        achievements: window.AchievementSystem,
        progress: JSON.stringify(Object.fromEntries(Object.entries(f.system.definitions)
            .map(([id, definition]) => [id, { progress: definition.progress, claimed: definition.claimed }]))),
        claims: JSON.stringify(f.system.pendingClaims) });

    test.each(['manager', 'progress', 'epoch', 'lease', 'cloud', 'scene', 'achievement manager',
        'achievement progress', 'achievement claims', 'raw-only', 'unreadable'])(
        'post-adoption %s is fenced before volatile publication', kind => {
            const capture = f.state.captureLocalSaveWrite.bind(f.state);
            let calls = 0, next, unreadable;
            const get = Storage.prototype.getItem;
            jest.spyOn(f.state, 'captureLocalSaveWrite').mockImplementation(value => {
                if (++calls !== 2) return capture(value);
                successor(kind); next = snapshot();
                if (kind === 'unreadable') unreadable = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
                    if (key === f.state.saveKey) throw Error('fictional unreadable publication');
                    return get.call(this, key);
                });
                return capture(value);
            });
            expect(f.commit().success).toBe(false); expect(next).toBeDefined();
            expect(f.publish).not.toHaveBeenCalled();
            expect(f.events.filter(item => ['fictionalPrepared', 'saved', 'saveError'].includes(item.event))).toEqual([]);
            unreadable?.mockRestore();
            const after = snapshot();
            if (['raw-only', 'unreadable'].includes(kind)) {
                expect(f.state.getSaveAdmission().status).toBe('held');
                expect({ ...after, admission: next.admission }).toEqual(next);
            } else expect(after).toEqual(next);
        }
    );

    for (const boundary of ['backup', 'primary']) {
        test.each(['achievement manager', 'achievement progress', 'achievement claims', 'scene'])(
            `${boundary} / %s cannot publish or hold a successor`, kind => {
                let next;
                const change = () => { successor(kind); next = snapshot(); };
                if (boundary === 'backup') {
                    const off = f.state.on('saveBackupCreated', () => { off(); change(); });
                } else {
                    const set = Storage.prototype.setItem; let intercepted = false;
                    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
                        const result = set.call(this, key, value);
                        if (key === f.state.saveKey && !intercepted) { intercepted = true; change(); }
                        return result;
                    });
                }
                expect(f.commit().success).toBe(false); expect(next).toBeDefined();
                expect(f.publish).not.toHaveBeenCalled(); expect(snapshot()).toEqual(next);
                expect(f.events.some(item => ['saved', 'saveError'].includes(item.event))).toBe(false);
            }
        );
    }

    test.each(['manager', 'progress', 'scene', 'achievement manager', 'achievement progress', 'achievement claims'])(
        'publisher-triggered %s stops without protecting or overwriting the successor', kind => {
            let next;
            expect(f.commit({ onPublished() { f.publish(); successor(kind); next = snapshot(); } }).success).toBe(false);
            expect(snapshot()).toEqual(next); expect(f.publish).toHaveBeenCalledTimes(1);
            expect(f.events.some(item => ['saved', 'saveError'].includes(item.event))).toBe(false);
        }
    );

    test.each(['throw', 'scene', 'progress', 'achievement manager', 'achievement claims'])(
        'prepared observer / %s cannot continue old publication', kind => {
            const emit = f.state.emit; let next;
            f.state.emit = (event, value) => {
                if (event === 'fictionalPrepared') {
                    expect(f.coherent()).toBe(true);
                    if (kind === 'throw') throw Error('fictional dispatch boundary failure');
                    successor(kind); next = snapshot();
                }
                return emit(event, value);
            };
            expect(f.commit({ notifications: [{ event: 'fictionalPrepared' }, { event: 'fictionalLater' }] }).success).toBe(false);
            expect(f.publish).toHaveBeenCalledTimes(1);
            expect(f.events.some(item => ['fictionalLater', 'saved', 'saveError'].includes(item.event))).toBe(false);
            if (kind === 'throw') expect(f.state.getSaveAdmission().status).toBe('held');
            else expect(snapshot()).toEqual(next);
        }
    );

    test('an ordinary listener exception retains the existing caught-listener event contract', () => {
        f.state.on('fictionalPrepared', () => { expect(f.coherent()).toBe(true); throw Error('fictional listener failure'); });
        const result = f.commit({ notifications: [{ event: 'fictionalPrepared' }] });
        expect(result.success).toBe(true); expect(result.isCurrent()).toBe(true);
        expect(f.state.getSaveAdmission().status).toBe('ready'); expect(f.publish).toHaveBeenCalledTimes(1);
    });

    test.each(['throw', 'scene', 'progress'])('saved observer / %s has post-adoption failure ownership', kind => {
        const emit = f.state.emit; let next;
        f.state.emit = (event, value) => {
            if (event === 'saved') {
                expect(f.coherent()).toBe(true);
                if (kind === 'throw') throw Error('fictional saved dispatch failure');
                successor(kind); next = snapshot();
            }
            return emit(event, value);
        };
        expect(f.commit().success).toBe(false); expect(f.publish).toHaveBeenCalledTimes(1);
        if (kind === 'throw') expect(f.state.getSaveAdmission().status).toBe('held');
        else expect(snapshot()).toEqual(next);
        expect(f.events.some(item => item.event === 'saveError')).toBe(false);
    });

    test('a protective admission callback cannot re-hold or notify a successor', () => {
        let next;
        const off = f.state.on('saveAdmissionChanged', admission => {
            if (admission.status !== 'held') return;
            off(); f.state.releaseSaveAdmission(); successor('progress'); next = snapshot();
        });
        expect(f.commit({ onPublished() { throw Error('fictional publisher failure'); } }).success).toBe(false);
        expect(next).toBeDefined(); expect(snapshot()).toEqual(next);
        expect(f.state.getSaveAdmission().status).toBe('ready');
        expect(f.events.some(item => ['saved', 'saveError'].includes(item.event))).toBe(false);
    });

    test.each(['owned', 'unowned', 'wrong-payload', 'mutation'])(
        '%s later lease keeps the existing read-only upload policy without republishing', kind => {
            f.close(); f = fixture({ withCloud: true }); let lease;
            const result = f.commit({ isCurrentUpload: candidate => kind !== 'unowned' &&
                candidate === lease && f.cloud.activeCloudWrite === candidate });
            expect(result.success).toBe(true);
            const payload = f.state.createSaveSnapshot();
            if (kind === 'wrong-payload') payload.player.cosmicCoins = 77;
            lease = f.state.beginCloudWrite(kind === 'mutation' ? 'mutation' : 'upload', payload, f.cloud.captureCampaignGuard());
            expect(lease).toBeTruthy(); f.cloud.activeCloudWrite = lease;
            expect(f.state.canCommitHatchSave()).toBe(false);
            expect(result.isCurrent()).toBe(kind === 'owned'); expect(f.publish).toHaveBeenCalledTimes(1);
        }
    );

    test.each(['exact', 'mismatch', 'unreadable'])('%s write-then-throw requires positive proof before publication', kind => {
        const set = Storage.prototype.setItem, get = Storage.prototype.getItem; let wrote = false, attempted;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            const result = set.call(this, key, value);
            if (key === f.state.saveKey) {
                attempted = String(value); wrote = true;
                if (kind === 'mismatch') {
                    const other = JSON.parse(value); other.player.cosmicCoins = 99;
                    set.call(this, key, JSON.stringify(other));
                }
                throw Error('fictional lost acknowledgement');
            }
            return result;
        });
        if (kind === 'unreadable') jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
            if (wrote && key === f.state.saveKey) throw Error('fictional unreadable primary');
            return get.call(this, key);
        });
        const result = f.commit();
        expect(result.success).toBe(kind === 'exact');
        expect(f.publish).toHaveBeenCalledTimes(kind === 'exact' ? 1 : 0);
        if (kind === 'exact') {
            expect(result.isCurrent()).toBe(true); expect(f.coherent()).toBe(true);
            expect(get.call(localStorage, f.state.saveKey)).toBe(attempted);
        } else {
            expect(f.state.state).not.toBe(f.staged); expect(f.state.getSaveAdmission().status).toBe('held');
        }
    });

    test('the returned read-only capability never reruns publication or accepts a replaced achievement owner', () => {
        const result = f.commit(); expect(result.success).toBe(true);
        expect(result.isCurrent()).toBe(true); expect(result.isCurrent()).toBe(true);
        expect(f.commit().success).toBe(false); expect(f.publish).toHaveBeenCalledTimes(1);
        successor('achievement manager'); const next = snapshot();
        expect(result.isCurrent()).toBe(false); expect(snapshot()).toEqual(next);
    });

    test.each(['normal', 'refusal', 'write-then-throw', 'observer-throw'])(
        'unused option retains exact parent %s payload, result, storage, events and clock/RNG trace', mode => {
            const execute = old => {
                f.close(); localStorage.clear(); delete window.CloudSave; delete window.AchievementSystem;
                f = fixture();
                const trace = [], options = { ...f.options, onPublished: undefined,
                    notifications: [{ event: 'fictionalPrepared', data: { fictional: true } }] };
                const random = jest.spyOn(Math, 'random').mockImplementation(() => { trace.push('random'); return 0.375; });
                const clock = jest.spyOn(Date, 'now').mockImplementation(() => { trace.push('clock'); return 1700000000777; });
                const set = Storage.prototype.setItem;
                const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
                    if (key === f.state.saveKey && mode === 'refusal') throw Error('fictional refusal');
                    const result = set.call(this, key, value);
                    if (key === f.state.saveKey && mode === 'write-then-throw') throw Error('fictional acknowledgement');
                    return result;
                });
                if (mode === 'observer-throw') {
                    const emit = f.state.emit;
                    f.state.emit = (event, value) => {
                        if (event === 'fictionalPrepared') throw Error('fictional observer boundary');
                        return emit(event, value);
                    };
                }
                const result = (old ? loadBefore() : f.state.commitHatchSaveDraft).call(f.state, f.staged, options);
                const current = result.isCurrent?.();
                const observed = JSON.parse(JSON.stringify({ result: { ...result, isCurrent: typeof result.isCurrent, current },
                    state: f.state.state, storage: { ...localStorage }, admission: f.state.saveAdmission,
                    events: f.events.map(({ event, value }) => ({ event, value: event === 'saveError' ? value.type : value })), trace }));
                write.mockRestore(); random.mockRestore(); clock.mockRestore();
                return observed;
            };
            expect(execute(false)).toEqual(execute(true));
        }
    );
});
