const { readPinnedSource } = require('./support/pinnedSourceFixture.cjs');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { parse } = require('@babel/parser');
const { livingHandoffFixture } = require('./support/livingHandoffFixture.cjs');

describe('ordinary living-form progress and Continue recovery', () => {
    let f;
    beforeEach(() => {
        jest.useFakeTimers(); jest.setSystemTime(1700000000777);
        localStorage.clear(); document.body.replaceChildren();
        for (const key of ['CloudSave', 'AchievementSystem', 'QuestManager', 'AudioManager', 'BirthEventSystem', 'CompanionMediaService', 'LivingPortraitService']) delete window[key];
        for (const method of ['log', 'warn', 'error']) jest.spyOn(console, method).mockImplementation(() => {});
        f = livingHandoffFixture();
    });
    afterEach(() => {
        f.close(); jest.restoreAllMocks(); jest.clearAllTimers(); jest.useRealTimers();
        for (const key of ['GameState', 'CloudSave', 'AchievementSystem', 'QuestManager', 'AudioManager', 'BirthEventSystem', 'CompanionMediaService', 'LivingPortraitService']) delete window[key];
        document.body.replaceChildren();
    });
    const click = handoff => handoff.mobileContinueButton.dispatchEvent(new Event('pointerup', { bubbles: true, cancelable: true }));
    const primaryWrites = () => {
        const writes = [], set = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key === f.state.saveKey) writes.push(value);
            return set.call(this, key, value);
        });
        return writes;
    };

    test('real mobile Continue writes once, retains normal360ms timing and requests the established destination once', () => {
        const handoff = f.show(), writes = primaryWrites();
        click(handoff); handoff.continueHandler();
        expect(writes).toHaveLength(1); expect(handoff.mobileContinueButton.disabled).toBe(true);
        expect(JSON.parse(f.raw()).tutorial.livingFormPending).toBe(false);
        expect(JSON.parse(f.raw()).tutorial.openingJourney.milestone).toBe('sanctuary_entered');
        jest.advanceTimersByTime(359); expect(f.scene.scene.start).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
        expect(f.scene.scene.start).toHaveBeenCalledTimes(1);
        expect(f.scene.scene.start).toHaveBeenCalledWith('GameScene', { fromSoulReveal: true });
    });

    test('actual primary refusal preserves memory/bytes and both native buttons retry the same prepared draft', () => {
        const handoff = f.show(), before = JSON.stringify(f.state.state), raw = f.raw();
        const set = Storage.prototype.setItem, prepare = jest.spyOn(f.state, 'prepareLivingFormProgressDraft');
        let refuse = true;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key === f.state.saveKey && refuse) throw Error('fictional primary refusal');
            return set.call(this, key, value);
        });
        click(handoff);
        expect(f.raw()).toBe(raw); expect(JSON.stringify(f.state.state)).toBe(before);
        expect(handoff.continueButtons.every(button => !button.disabled)).toBe(true);
        expect(handoff.mobileContinueButton.textContent).toBe('TRY AGAIN');
        expect(f.captured).toHaveLength(0); expect(f.scene.scene.start).not.toHaveBeenCalled();
        const staged = f.scene.livingFormOwner.pendingProgress.prepared;
        jest.advanceTimersByTime(500); refuse = false; handoff.continueButton.click();
        expect(prepare).toHaveBeenCalledTimes(1); expect(f.state.state).toBe(staged.state);
        expect(f.state.get('creatures')).toHaveLength(1);
        jest.advanceTimersByTime(360); expect(f.scene.scene.start).toHaveBeenCalledTimes(1);
    });

    test('failed once-only portrait marker is retained and retried by Continue without another portrait callback or generation', () => {
        const handoff = f.show(), mark = handoff.onPortraitShown, set = Storage.prototype.setItem;
        const media = { prepareGeneratedVideo: jest.fn() }; window.CompanionMediaService = media;
        let refuse = true;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key === f.state.saveKey && refuse) throw Error('fictional portrait refusal');
            return set.call(this, key, value);
        });
        mark({ imageUrl: 'data:image/png;base64,fictional' });
        expect(f.state.get('tutorial.livingFormSeen')).not.toBe(true);
        expect(f.scene.livingFormOwner.pendingProgress.action).toBe('portrait');
        refuse = false; click(handoff);
        const durable = JSON.parse(f.raw());
        expect(durable.tutorial.livingFormSeen).toBe(true);
        expect(durable.tutorial.openingJourney.portrait.status).toBe('ready');
        expect(durable.tutorial.livingFormPending).toBe(false);
        expect(media.prepareGeneratedVideo).not.toHaveBeenCalled();
        jest.advanceTimersByTime(360); expect(f.scene.scene.start).toHaveBeenCalledTimes(1);
    });

    test('successful repeated portrait marker is idempotent and a late marker after Continue cannot write', () => {
        const handoff = f.show(), mark = handoff.onPortraitShown, writes = primaryWrites();
        mark({ imageUrl: 'data:image/png;base64,fictional' });
        mark({ imageUrl: 'data:image/png;base64,fictional' }); expect(writes).toHaveLength(1);
        click(handoff); mark({ imageUrl: 'data:image/png;base64,fictional' });
        expect(writes).toHaveLength(2);
    });

    test('actual once-only image reveal retains a refused marker for native Continue retry without regenerating media', async () => {
        const media = { recordAppearance: jest.fn(), prepareGeneratedVideo: jest.fn(() => Promise.resolve(null)) };
        window.CompanionMediaService = media;
        f.scene.portraitPromise = Promise.resolve({ imageUrl: 'data:image/png;base64,fictional', identityKey: 'fictional:baby', stage: 'baby' });
        const handoff = f.show(), marker = jest.spyOn(handoff, 'onPortraitShown'), set = Storage.prototype.setItem;
        let refuse = true;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key === f.state.saveKey && refuse) throw Error('fictional refusal');
            return set.call(this, key, value);
        });
        await jest.advanceTimersByTimeAsync(0); handoff.image.onload(); handoff.image.onload();
        expect(marker).toHaveBeenCalledTimes(1); expect(handoff.portraitShownIdentity).toBe('fictional:baby');
        expect(f.state.get('tutorial.livingFormSeen')).not.toBe(true);
        expect(handoff.status.textContent).toContain('could not finish saving');
        refuse = false; click(handoff); jest.advanceTimersByTime(360);
        expect(JSON.parse(f.raw()).tutorial.livingFormSeen).toBe(true);
        expect(f.scene.scene.start).toHaveBeenCalledTimes(1); expect(media.prepareGeneratedVideo).toHaveBeenCalledTimes(1);
    });

    test.each([false, true])('retired promise/image completion cannot write, generate or request sound after decoding began=%s', async loaded => {
        let resolve;
        const media = { recordAppearance: jest.fn(), prepareGeneratedVideo: jest.fn(() => Promise.resolve(null)) };
        window.CompanionMediaService = media; window.AudioManager = { playLevelUp: jest.fn() };
        f.scene.portraitPromise = new Promise(yes => { resolve = yes; });
        const handoff = f.show(), record = { imageUrl: 'data:image/png;base64,fictional', identityKey: 'fictional:baby' };
        if (loaded) { resolve(record); await jest.advanceTimersByTimeAsync(0); }
        const onload = handoff.image.onload;
        expect(f.state.startFreshGame()).toBe(true); const memory = JSON.stringify(f.state.state), raw = f.raw();
        if (loaded) onload(); else { resolve(record); await jest.advanceTimersByTimeAsync(0); }
        expect(JSON.stringify(f.state.state)).toBe(memory); expect(f.raw()).toBe(raw);
        expect(media.recordAppearance).not.toHaveBeenCalled(); expect(media.prepareGeneratedVideo).not.toHaveBeenCalled();
        expect(window.AudioManager.playLevelUp).not.toHaveBeenCalled();
    });

    test.each(['manager', 'new-game', 'load', 'epoch', 'cloud', 'identity'])('old UI cannot modify successor after %s changes', kind => {
        const handoff = f.show(), mark = handoff.onPortraitShown, continueAction = handoff.continueHandler;
        if (kind === 'manager') { const next = f.replaceManager(); next.set('session.gameStarted', true); expect(next.save()).toBe(true); }
        if (kind === 'new-game') expect(f.state.startFreshGame()).toBe(true);
        if (kind === 'load') expect(f.state.load()).toBe(true);
        if (kind === 'epoch') f.state.releaseSaveAdmission();
        if (kind === 'cloud') window.CloudSave = { campaignEpoch: 2 };
        if (kind === 'identity') { f.state.set('creature.id', 'fictional-successor'); expect(f.state.save()).toBe(true); }
        const state = window.GameState, memory = JSON.stringify(state.state), raw = localStorage.getItem(state.saveKey);
        mark({ imageUrl: 'data:image/png;base64,fictional' }); continueAction();
        expect(JSON.stringify(state.state)).toBe(memory); expect(localStorage.getItem(state.saveKey)).toBe(raw);
        expect(f.captured).toHaveLength(0);
    });

    test.each(['init', 'shutdown', 'handoff', 'clock', 'camera', 'plugin'])('queued completion rejects %s replacement', kind => {
        const handoff = f.show(); click(handoff); const old = f.captured[0].callback;
        const start = f.scene.scene.start;
        let replacement;
        if (kind === 'init') f.scene.init();
        if (kind === 'shutdown') f.scene.shutdown();
        if (kind === 'handoff') { replacement = { destroy: jest.fn() }; f.scene.livingFormHandoff = replacement; }
        if (kind === 'clock') f.scene.time = {};
        if (kind === 'camera') f.scene.cameras.main = {};
        if (kind === 'plugin') f.scene.scene = { start: jest.fn() };
        old();
        expect(start).not.toHaveBeenCalled(); expect(f.scene.scene.start).not.toHaveBeenCalled();
        if (replacement) { expect(replacement.destroy).not.toHaveBeenCalled(); expect(f.scene.livingFormHandoff).toBe(replacement); }
        if (kind === 'handoff') handoff.destroy();
    });

    test('cleanup failure offers native presentation-only Retry and does not repeat the adopted save', () => {
        const handoff = f.show(), destroy = handoff.destroy.bind(handoff), writes = primaryWrites();
        jest.spyOn(handoff, 'destroy').mockImplementationOnce(() => { destroy(); throw Error('fictional cleanup failure'); }).mockImplementation(destroy);
        click(handoff); jest.advanceTimersByTime(360);
        expect(writes).toHaveLength(1); expect(f.scene.scene.start).not.toHaveBeenCalled();
        const retry = f.scene.livingFormOwner.recovery.querySelector('button');
        retry.click(); expect(writes).toHaveLength(1); expect(f.scene.scene.start).toHaveBeenCalledTimes(1);
        retry.click(); expect(f.scene.scene.start).toHaveBeenCalledTimes(1);
    });

    test('cleanup reentry cannot clear a newly mounted handoff or issue the old destination request', () => {
        const handoff = f.show(), destroy = handoff.destroy.bind(handoff);
        let replacement;
        jest.spyOn(handoff, 'destroy').mockImplementation(() => {
            destroy(); f.scene.livingFormHandoff = { destroy: jest.fn() }; replacement = f.scene.livingFormHandoff;
        });
        click(handoff); jest.advanceTimersByTime(360);
        expect(f.scene.livingFormHandoff).toBe(replacement); expect(replacement.destroy).not.toHaveBeenCalled();
        expect(f.scene.scene.start).not.toHaveBeenCalled();
    });

    test.each([false, true])('timer scheduling failure after enqueue=%s still requests the destination at most once', enqueue => {
        const handoff = f.show(), schedule = f.scene.time.delayedCall;
        f.scene.time.delayedCall = jest.fn((...args) => {
            if (enqueue) schedule(...args); throw Error('fictional scheduler failure');
        });
        click(handoff); jest.advanceTimersByTime(360);
        expect(f.scene.scene.start).toHaveBeenCalledTimes(1);
    });

    test('optional fade failure cannot swallow the verified route', () => {
        const handoff = f.show(); f.scene.cameras.main.fadeOut.mockImplementation(() => { throw Error('fictional fade failure'); });
        click(handoff); jest.advanceTimersByTime(360); expect(f.scene.scene.start).toHaveBeenCalledTimes(1);
    });

    test('exact primary write-then-throw is acknowledged only through verified readback', () => {
        const handoff = f.show(), set = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            set.call(this, key, value); if (key === f.state.saveKey) throw Error('fictional write then throw');
        });
        click(handoff); jest.advanceTimersByTime(360); expect(f.scene.scene.start).toHaveBeenCalledTimes(1);
    });

    test('post-adoption notification failure is protected and never replayed as a definite refusal', () => {
        const handoff = f.show(), writes = primaryWrites(), emit = f.state.emit.bind(f.state);
        f.state.emit = (event, data) => { if (event === 'openingJourneyAdvanced') throw Error('fictional notification failure'); return emit(event, data); };
        click(handoff); handoff.continueHandler(); jest.advanceTimersByTime(360);
        expect(writes).toHaveLength(1); expect(JSON.parse(f.raw()).tutorial.livingFormPending).toBe(false);
        expect(f.state.getSaveAdmission().status).toBe('held'); expect(f.scene.scene.start).not.toHaveBeenCalled();
    });

    test('a saved observer can start New Game without the old Continue proceeding or changing its result', () => {
        const handoff = f.show();
        f.state.on('saved', () => { if (f.state.get('tutorial.livingFormPending') === false) f.state.startFreshGame(); });
        click(handoff); const memory = JSON.stringify(f.state.state), raw = f.raw(); jest.advanceTimersByTime(360);
        expect(f.scene.scene.start).not.toHaveBeenCalled(); expect(JSON.stringify(f.state.state)).toBe(memory); expect(f.raw()).toBe(raw);
    });

    test('new admitted saves before Continue and during its fade are retained, not rejected as an old naming snapshot', () => {
        const handoff = f.show();
        f.state.set('resources.coins', 77); expect(f.state.save()).toBe(true);
        click(handoff);
        f.state.set('resources.coins', 88); expect(f.state.save()).toBe(true);
        jest.advanceTimersByTime(360);
        expect(f.scene.scene.start).toHaveBeenCalledTimes(1); expect(JSON.parse(f.raw()).resources.coins).toBe(88);
    });

    test.each([true, false])('fade permits only an exact healthy owned upload, owned=%s', owned => {
        const cloud = { gameState: f.state, campaignEpoch: 1, currentUser: { id: 'fictional-cloud-owner' } };
        window.CloudSave = cloud;
        const handoff = f.show(); click(handoff);
        const lease = f.state.beginCloudWrite('upload', f.state.createSaveSnapshot(), () => true);
        cloud.activeCloudWrite = owned ? lease : {};
        jest.advanceTimersByTime(360);
        expect(f.scene.scene.start).toHaveBeenCalledTimes(owned ? 1 : 0);
        expect(f.state.cloudWriteLease).toBe(lease);
    });

    test.each([false, true])('review regression: temporary read block after cleanup=%s retains presentation-only native retry', afterCleanup => {
        const cloud = { gameState: f.state, campaignEpoch: 1, currentUser: { id: 'fictional-cloud-owner' } };
        window.CloudSave = cloud;
        const handoff = f.show(), writes = primaryWrites(), emitted = [], emit = f.state.emit.bind(f.state);
        f.state.emit = (event, data) => { emitted.push(event); return emit(event, data); };
        let lease;
        const block = () => {
            lease = f.state.beginCloudWrite('upload', f.state.createSaveSnapshot(), () => true);
            cloud.activeCloudWrite = {};
        };
        if (afterCleanup) {
            const destroy = handoff.destroy.bind(handoff);
            jest.spyOn(handoff, 'destroy').mockImplementationOnce(() => { destroy(); block(); }).mockImplementation(destroy);
        }
        click(handoff); if (!afterCleanup) block(); jest.advanceTimersByTime(360);
        expect(f.scene.scene.start).not.toHaveBeenCalled();
        const retry = afterCleanup ? f.scene.livingFormOwner.recovery?.querySelector('button') : handoff.mobileContinueButton;
        expect(retry).toBeDefined(); expect(retry.disabled).toBe(false);
        expect(f.state.finishCloudWrite(lease)).toBe(true); cloud.activeCloudWrite = null;
        const events = emitted.length; retry.click();
        expect(writes).toHaveLength(1); expect(emitted).toHaveLength(events);
        expect(f.scene.scene.start).toHaveBeenCalledTimes(1);
    });

    test('a prepared refusal cannot rebase over independent later progress', () => {
        const handoff = f.show(), set = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(function (key, value) { return set.call(this, key, value); });
        const commit = f.state.commitHatchSaveDraft.bind(f.state);
        jest.spyOn(f.state, 'commitHatchSaveDraft').mockImplementationOnce(() => ({ success: false })).mockImplementation(commit);
        click(handoff); f.state.set('resources.coins', 77); expect(f.state.save()).toBe(true);
        const memory = JSON.stringify(f.state.state), raw = f.raw(); click(handoff);
        expect(JSON.stringify(f.state.state)).toBe(memory); expect(f.raw()).toBe(raw); expect(f.scene.scene.start).not.toHaveBeenCalled();
    });

    test('a fresh returning-player entry has its own admitted owner without a naming transaction', () => {
        f.close(); f = livingHandoffFixture({ resume: true });
        f.scene.textures = { exists: () => false };
        expect(f.scene.namingAttempt).toBeNull();
        f.scene.resumeLivingFormHandoff(390, 844); jest.advanceTimersByTime(50);
        click(f.scene.livingFormHandoff); jest.advanceTimersByTime(360);
        expect(f.scene.scene.start).toHaveBeenCalledTimes(1);
    });

    test('the retained returning-player entry cannot open after reinitialisation', () => {
        f.close(); f = livingHandoffFixture({ resume: true }); f.scene.textures = { exists: () => false };
        f.scene.resumeLivingFormHandoff(390, 844); const old = f.captured[0].callback;
        f.scene.init(); old(); expect(f.scene.livingFormHandoff).toBeNull();
    });

    test('a retired resume resolver rejection cannot change a newer scene portrait state', async () => {
        f.close(); f = livingHandoffFixture({ resume: true }); f.scene.textures = { exists: () => false };
        jest.spyOn(f.state, 'getCreaturePortrait').mockReturnValue({ assetRef: 'fictional-existing-portrait-reference' });
        let reject;
        window.LivingPortraitService = { resolve: jest.fn(() => new Promise((_resolve, no) => { reject = no; })) };
        f.scene.resumeLivingFormHandoff(390, 844); f.scene.init(); reject(Error('fictional old failure'));
        await Promise.resolve(); expect(f.scene.portraitError).toBeNull();
    });

    test.each(['resolve', 'assimilation'])('review regression: synchronous %s retirement cannot install an old resume promise', async boundary => {
        f.close(); f = livingHandoffFixture({ resume: true }); f.scene.textures = { exists: () => false };
        jest.spyOn(f.state, 'getCreaturePortrait').mockReturnValue({ assetRef: 'fictional-existing-reference' });
        window.LivingPortraitService = { resolve: () => {
            if (boundary === 'resolve') { f.scene.init(); return Promise.resolve(null); }
            return Object.defineProperty({}, 'then', { get() { f.scene.init(); return yes => yes(null); } });
        } };
        f.scene.resumeLivingFormHandoff(390, 844); await jest.advanceTimersByTimeAsync(0);
        expect(f.scene.portraitPromise).toBeNull(); expect(f.scene.portraitError).toBeNull(); expect(f.captured).toHaveLength(0);
    });

    test('review regression: retained image error cannot update a retired live widget', async () => {
        f.scene.portraitPromise = Promise.resolve({ imageUrl: 'data:image/png;base64,fictional', identityKey: 'fictional:baby' });
        const handoff = f.show(); await jest.advanceTimersByTimeAsync(0);
        const error = handoff.image.onerror, unavailable = jest.spyOn(handoff, 'markPortraitUnavailable');
        expect(f.state.startFreshGame()).toBe(true); error();
        expect(unavailable).not.toHaveBeenCalled();
    });

    test('review regression: synchronous video preparation retirement cannot request old sound', async () => {
        window.AudioManager = { playLevelUp: jest.fn() };
        window.CompanionMediaService = { recordAppearance: jest.fn(), prepareGeneratedVideo: jest.fn(() => {
            f.scene.init(); return Promise.resolve(null);
        }) };
        f.scene.portraitPromise = Promise.resolve({ imageUrl: 'data:image/png;base64,fictional', identityKey: 'fictional:baby' });
        const handoff = f.show(); await jest.advanceTimersByTimeAsync(0); handoff.image.onload();
        expect(window.CompanionMediaService.prepareGeneratedVideo).toHaveBeenCalledTimes(1);
        expect(window.AudioManager.playLevelUp).not.toHaveBeenCalled();
    });

    test.each(['portrait', 'continue'])('%s preparation preserves complete pinned successful payload and relative domain events', action => {
        const handoff = f.show(), raw = f.raw(), before = JSON.parse(JSON.stringify(f.state.state));
        const expected = new f.state.constructor(); f.states.push(expected); expected.state = before;
        const events = [], emit = expected.emit.bind(expected);
        expected.emit = (event, data) => { if (!['saved', 'saveBackupCreated'].includes(event)) events.push([event, JSON.parse(JSON.stringify(data))]); return emit(event, data); };
        window.GameState = expected;
        const old = readPinnedSource('b13eb61c:src/scenes/SoulRevealScene.js');
        const declaration = parse(old, { sourceType: 'module' }).program.body.find(node => node.type === 'ExportDefaultDeclaration').declaration;
        if (action === 'continue') {
            const method = declaration.body.body.find(node => node.key?.name === 'transitionToGame');
            vm.runInNewContext(`({${old.slice(method.start, method.end)}}).transitionToGame`, { window }).call({
                cameras: { main: { fadeOut() {} } }, time: { delayedCall() {} }
            });
        } else {
            expected.set('tutorial.livingFormSeen', true); expected.recordOpeningPortraitStatus('ready'); expect(expected.save()).toBe(true);
        }
        const expectedRaw = localStorage.getItem(expected.saveKey); window.GameState = f.state; localStorage.setItem(f.state.saveKey, raw);
        const actual = [], actualEmit = f.state.emit.bind(f.state);
        f.state.emit = (event, data) => { if (!['saved', 'saveBackupCreated'].includes(event)) actual.push([event, JSON.parse(JSON.stringify(data))]); return actualEmit(event, data); };
        if (action === 'portrait') handoff.onPortraitShown({ imageUrl: 'data:image/png;base64,fictional' }); else click(handoff);
        expect(f.raw()).toBe(expectedRaw); expect(actual).toEqual(events);
    });

    test('untouched loaded QuestManager arrays retain their aliases after both progress writes', () => {
        const filename = path.join(__dirname, '../systems/QuestManager.js');
        const source = fs.readFileSync(filename, 'utf8').replace("import projectBeacon from '../config/project-beacon.json';", '')
            .replace('export default questManager;', 'module.exports = questManager;');
        const context = { module: { exports: {} }, window, console, Date, Math, Set, Map, Object, Array,
            projectBeacon: require('../config/project-beacon.json') };
        vm.runInNewContext(source, context, { filename }); const quests = context.module.exports; quests.init();
        const handoff = f.show(), active = quests.activeQuests, completed = quests.completedQuests;
        handoff.onPortraitShown({ imageUrl: 'data:image/png;base64,fictional' }); click(handoff);
        expect(f.state.get('quests.active')).toBe(active); expect(f.state.get('quests.completed')).toBe(completed);
        expect(quests.captureNamingProgressPublication(f.state)).toBeDefined();
    });
});
