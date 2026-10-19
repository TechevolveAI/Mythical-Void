const { fixture } = require('./support/hatchingStartFixture.cjs');

describe('actual first-session release saves before continuing and retains its owner', () => {
    const fixtures = [];
    const create = options => { const f = fixture(options); fixtures.push(f); return f; };
    const noHandoff = f => {
        expect(f.scene.scene.restart).not.toHaveBeenCalled(); expect(f.scene.scene.start).not.toHaveBeenCalled();
    };
    beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(1700000000777); localStorage.clear(); });
    afterEach(() => {
        jest.restoreAllMocks(); for (const f of fixtures.splice(0)) f.close();
        document.body.replaceChildren(); jest.useRealTimers();
        delete window.GameState; delete window.CloudSave; delete window.UXEnhancements;
    });

    test('the first native Start click commits once, without waiting for a tween or timer', () => {
        const f = create(), button = f.scene.homeStartFallback;
        button.click(); button.click(); f.release();
        expect(f.scene.scene.restart).toHaveBeenCalledTimes(1);
        expect(JSON.parse(f.snapshot().raw).session.gameStarted).toBe(true);
        expect(f.loading.visible).toBe(false); expect(f.scene.tweens.add).not.toHaveBeenCalled();
    });

    test('every Start notification observes the complete durable result, never an intermediate reset', () => {
        const f = create(), seen = [];
        for (const event of ['stateChanged', 'openingJourneyAdvanced', 'saved']) {
            f.state.on(event, () => {
                const durable = JSON.parse(f.snapshot().raw);
                expect(durable.creature).toMatchObject({ hatched: false, genes: null, dna: null,
                    parentIds: null, generation: null, name: 'Your Creature' });
                expect(durable.session.gameStarted).toBe(true); seen.push(event);
            });
        }
        f.release(); expect(seen.filter(e => e === 'openingJourneyAdvanced')).toHaveLength(1);
        expect(seen.filter(e => e === 'saved')).toHaveLength(1);
        expect(seen.filter(e => e === 'stateChanged')).toHaveLength(22);
        expect(f.scene.scene.restart).toHaveBeenCalledTimes(1);
    });

    test.each(['held', 'memory', 'pending-no-manager', 'damaged-index', 'durable-uncertainty',
        'live-upload', 'live-mutation'])('%s preserves progress and refuses Start', mode => {
        const f = create({ admissionGate: true }), milestone = jest.fn();
        if (mode === 'held') f.state.holdSaveAdmission({ code: 'version_mismatch' }, 'fictional');
        if (mode === 'memory') f.state.storageMode = 'memory';
        if (mode === 'pending-no-manager') {
            expect(f.state.createLocalSaveBackup(f.state.createSaveSnapshot(), 'cloud_write_pending_upload')).not.toBeNull();
        }
        if (mode === 'damaged-index') localStorage.setItem(f.state.saveBackupIndexKey, '{fictional-damage');
        if (mode === 'durable-uncertainty') f.state.cloudRecoveryRequired = true;
        if (mode.startsWith('live-')) {
            const cloud = f.cloud(); cloud.activeCloudWrite = f.state.beginCloudWrite(
                mode === 'live-upload' ? 'upload' : 'mutation', f.state.createSaveSnapshot(), cloud.captureCampaignGuard());
        }
        f.state.on('openingJourneyAdvanced', milestone);
        const before = f.snapshot(); f.release(); const after = f.snapshot();
        noHandoff(f); expect(after.raw).toBe(before.raw); expect(after.memory).toBe(before.memory);
        expect(after.storage).toEqual(before.storage); expect(after.lease).toBe(before.lease);
        expect(milestone).not.toHaveBeenCalled();
        expect(document.querySelector('.save-recovery-gate button')).not.toBeNull();
    });

    test.each(['backup', 'primary', 'quota'])('%s refusal preserves data and its one explicit retry can succeed', mode => {
        const f = create(), before = f.snapshot(), set = Storage.prototype.setItem;
        let refuse = true;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (refuse && (key === f.state.saveKey && mode !== 'backup' ||
                mode === 'backup' && key.startsWith(f.state.saveBackupKeyPrefix) && key !== f.state.saveBackupIndexKey)) {
                const error = Error('FICTIONAL_PRE_WRITE_REFUSAL');
                if (mode === 'quota') error.name = 'QuotaExceededError'; throw error;
            }
            return set.call(this, key, value);
        });
        f.release(); noHandoff(f);
        expect(f.snapshot().raw).toBe(before.raw); expect(f.snapshot().memory).toBe(before.memory);
        expect(f.loading.visible).toBe(false);
        const retry = document.querySelector('[data-mythical-hatch-save] button'); expect(retry).not.toBeNull();
        f.release(); noHandoff(f); // A queued old release is not an explicit retry.
        refuse = false; retry.click(); retry.click();
        expect(f.scene.scene.restart).toHaveBeenCalledTimes(1);
        expect(JSON.parse(f.snapshot().raw).session.gameStarted).toBe(true);
    });

    test('verified exact bytes after write-then-throw may continue under the existing positive-proof policy', () => {
        const f = create(), set = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            const result = set.call(this, key, value);
            if (key === f.state.saveKey) throw Error('FICTIONAL_LOST_ACK'); return result;
        });
        f.release(); expect(f.scene.scene.restart).toHaveBeenCalledTimes(1);
        expect(f.state.getSaveAdmission().status).toBe('ready');
        expect(JSON.parse(f.snapshot().raw).session.gameStarted).toBe(true);
    });

    test('unreadable post-write evidence remains held with existing recovery and no handoff or rollback', () => {
        const f = create({ admissionGate: true }), before = f.snapshot(), set = Storage.prototype.setItem, get = Storage.prototype.getItem;
        let wrote = false, attempted;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            const result = set.call(this, key, value);
            if (key === f.state.saveKey) { attempted = String(value); wrote = true; } return result;
        });
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
            if (wrote && key === f.state.saveKey) throw Error('FICTIONAL_READBACK_FAILURE');
            return get.call(this, key);
        });
        f.release(); noHandoff(f);
        expect(f.state.getSaveAdmission().status).toBe('held');
        expect(get.call(localStorage, f.state.saveKey)).toBe(attempted);
        expect(JSON.stringify(f.state.state)).toBe(before.memory);
        expect(document.querySelector('.save-recovery-gate button')?.textContent).toBe('Try saved game again');
    });

    for (const event of ['stateChanged', 'openingJourneyAdvanced', 'saveBackupCreated', 'saved']) {
        test.each(['new-game', 'saved-progress', 'unsaved-progress', 'admission', 'epoch',
            'raw-successor', 'global-manager', 'cloud-manager', 'scene'])(`${event} / %s retires old continuation`, kind => {
            const f = create(); let successor;
            const off = f.state.on(event, () => { off(); f.replace(kind); successor = f.snapshot(); });
            f.release(); expect(successor).toBeDefined(); noHandoff(f);
            const after = f.snapshot();
            if (kind === 'raw-successor') {
                expect({ ...after, admission: successor.admission }).toEqual(successor);
                expect(after.admission).toMatchObject({ status: 'held', reason: 'commit_failed' });
                expect(f.state.save()).toBe(false); expect(localStorage.getItem(f.state.saveKey)).toBe(successor.raw);
            } else expect(after).toEqual(successor);
        });
    }

    test.each(['saveError', 'saveAdmissionChanged'])('%s can replace the game without an old retry or continuation', event => {
        const f = create(), set = Storage.prototype.setItem; let successor, armed = true;
        const off = f.state.on(event, () => {
            off(); armed = false; expect(f.state.startFreshGame()).toBe(true); successor = f.snapshot();
        });
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (armed && key === f.state.saveKey) {
                if (event === 'saveAdmissionChanged') {
                    const unverified = JSON.parse(value); unverified.player.cosmicCoins = 99;
                    set.call(this, key, JSON.stringify(unverified));
                }
                throw Error('FICTIONAL_ACK_FAILURE');
            }
            return set.call(this, key, value);
        });
        f.release(); expect(successor).toBeDefined(); noHandoff(f); expect(f.snapshot()).toEqual(successor);
        expect(document.querySelector('[data-mythical-hatch-save]')).toBeNull();
    });

    test.each(['removeHomeStartFallback', 'showLoading', 'animateStartRelease', 'hideLoading'])(
        '%s cannot continue after its presentation callback starts New Game', method => {
            const f = create(); let successor;
            const host = method.endsWith('Loading') ? window.UXEnhancements : f.scene;
            const original = jest.isMockFunction(host[method]) ? host[method].getMockImplementation() : host[method];
            jest.spyOn(host, method).mockImplementation(function (...args) {
                original.apply(this, args); f.replace('new-game'); successor = f.snapshot();
            });
            f.release(); expect(successor).toBeDefined(); noHandoff(f); expect(f.snapshot()).toEqual(successor);
        }
    );

    test('an old queued release after actual shutdown does nothing', () => {
        const f = create(); f.scene.shutdown(); const before = f.snapshot();
        f.release(); noHandoff(f); expect(f.snapshot()).toEqual(before);
    });

    test('an unreadable owner capture keeps Start available without an uncaught error', () => {
        const f = create(), canCommit = f.scene.canCommitHatch, get = Storage.prototype.getItem;
        let unreadable = false;
        jest.spyOn(f.scene, 'canCommitHatch').mockImplementation(() => {
            const admitted = canCommit(); unreadable = true; return admitted;
        });
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
            if (unreadable && key === f.state.saveKey) throw Error('FICTIONAL_CAPTURE_READ_FAILURE');
            return get.call(this, key);
        });
        expect(() => f.release()).not.toThrow(); noHandoff(f);
        expect(f.scene.homeStartFallback.isConnected).toBe(true);
        expect(f.scene.openingStartAttempt).toBeNull(); expect(f.loading.shows).toBe(0);
    });

    test('a retired Retry cannot clear or start a replacement scene', () => {
        const f = create(), set = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key === f.state.saveKey) throw Error('FICTIONAL_REFUSAL'); return set.call(this, key, value);
        });
        f.release(); const retry = document.querySelector('[data-mythical-hatch-save] button');
        expect(retry).not.toBeNull(); jest.restoreAllMocks(); f.scene.shutdown(); f.replace('new-game');
        const before = f.snapshot(), hides = f.loading.hides; retry.click();
        noHandoff(f); expect(f.snapshot()).toEqual(before); expect(f.loading.hides).toBe(hides);
    });

    test('shutdown during a throwing restart cannot direct-start or revive controls', () => {
        const f = create(); f.scene.scene.restart.mockImplementation(() => { f.scene.shutdown(); throw Error('FICTIONAL_RETIRED_RESTART'); });
        f.release(); expect(f.scene.scene.restart).toHaveBeenCalledTimes(1);
        expect(f.scene.scene.start).not.toHaveBeenCalled(); expect(f.scene.ensureHomeStartReady).not.toHaveBeenCalled();
    });

    test('failed scene requests retry presentation only, without another reset, save or notification', () => {
        const f = create();
        f.scene.scene.restart.mockImplementationOnce(() => { throw Error('FICTIONAL_RESTART_REFUSAL'); });
        f.scene.scene.start.mockImplementationOnce(() => { throw Error('FICTIONAL_START_REFUSAL'); });
        const saved = jest.fn(); f.state.on('saved', saved); f.release();
        const before = f.snapshot(); expect(saved).toHaveBeenCalledTimes(1);
        const retry = document.querySelector('[data-mythical-hatch-save] button'); expect(retry).not.toBeNull();
        retry.click(); expect(f.scene.scene.restart).toHaveBeenCalledTimes(2);
        expect(saved).toHaveBeenCalledTimes(1); expect(f.snapshot()).toEqual(before);
    });

    test.each(['showLoading', 'hideLoading', 'animateStartRelease'])(
        'optional %s failure does not prevent the durable Start handoff', method => {
            const f = create(), host = method.endsWith('Loading') ? window.UXEnhancements : f.scene;
            jest.spyOn(host, method).mockImplementation(() => { throw Error('FICTIONAL_OPTIONAL_FEEDBACK_FAILURE'); });
            expect(() => f.release()).not.toThrow();
            expect(f.scene.scene.restart).toHaveBeenCalledTimes(1);
            expect(f.scene.scene.start).not.toHaveBeenCalled();
            expect(JSON.parse(f.snapshot().raw).session.gameStarted).toBe(true);
        }
    );

    test('a failed recovery loading effect cannot remove the existing explicit Retry', () => {
        const f = create(), set = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key === f.state.saveKey) throw Error('FICTIONAL_PRE_WRITE_REFUSAL'); return set.call(this, key, value);
        });
        window.UXEnhancements.hideLoading.mockImplementation(() => { throw Error('FICTIONAL_OPTIONAL_HIDE_FAILURE'); });
        expect(() => f.release()).not.toThrow(); noHandoff(f);
        expect(document.querySelector('[data-mythical-hatch-save] button')).not.toBeNull();
    });
});
