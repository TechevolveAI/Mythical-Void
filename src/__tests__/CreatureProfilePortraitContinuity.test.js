const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { parse } = require('@babel/parser');
const CreaturePortraitSpec = require('../systems/CreaturePortraitSpec.js');

const source = fs.readFileSync(path.join(__dirname, '../scenes/CreatureProfileScene.js'), 'utf8');
const declaration = parse(source, { sourceType: 'module' }).program.body
    .find(node => node.type === 'ExportDefaultDeclaration').declaration;
const mediaSource = fs.readFileSync(path.join(__dirname, '../systems/CompanionMediaService.js'), 'utf8');
const mediaDeclaration = parse(mediaSource, { sourceType: 'module' }).program.body
    .find(node => node.type === 'ClassDeclaration' && node.id.name === 'CompanionMediaService');

const first = { name: 'Synthetic One', genes: { id: 'synthetic-one' }, stage: 'baby' };
const second = { name: 'Synthetic Two', genes: { id: 'synthetic-two' }, stage: 'baby' };
const portraitFor = (creature, suffix = '1') => ({
    identityKey: CreaturePortraitSpec.create(creature).identityKey,
    stage: creature.stage,
    assetRef: `portrait-job-v1:00000000-0000-4000-8000-${suffix.padStart(12, '0')}`,
    imageUrl: `https://example.test/${creature.genes.id}-${creature.stage}-${suffix}.png`
});
const flush = async () => {
    for (let index = 0; index < 20; index += 1) await Promise.resolve();
};
function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}
function displayObject() {
    const object = Object.assign(new EventEmitter(), { active: true, scaleX: 1, scaleY: 1 });
    for (const method of ['fillStyle', 'fillRoundedRect', 'lineStyle', 'strokeRoundedRect',
        'setDepth', 'setOrigin', 'setDisplaySize', 'setPadding', 'setInteractive', 'disableInteractive']) {
        object[method] = jest.fn(() => object);
    }
    object.setText = jest.fn(value => { object.text = value; return object; });
    object.destroy = jest.fn(() => { object.active = false; });
    return object;
}

function harness(initial = portraitFor(first)) {
    let activeRecord = initial;
    const events = new EventEmitter();
    const gameState = {
        getCreaturePortrait: jest.fn(stage => !stage || activeRecord?.stage === stage ? activeRecord : null),
        on: jest.fn((event, callback) => {
            events.on(event, callback);
            return () => events.off(event, callback);
        }),
        set: jest.fn(),
        save: jest.fn()
    };
    const media = {
        resolvePortrait: jest.fn(async () => activeRecord),
        ensureTexture: jest.fn(async (_scene, record) => record.identityKey),
        recordAppearance: jest.fn()
    };
    const service = {
        getActiveJob: jest.fn(() => null),
        getEligibility: jest.fn(() => ({ eligible: false })),
        generate: jest.fn(async () => activeRecord)
    };
    const sceneWindow = {
        GameState: gameState, CompanionMediaService: media,
        LivingPortraitService: service, CreaturePortraitSpec,
        setTimeout
    };
    const activeMatcher = mediaDeclaration.body.body.find(node => node.key?.name === 'isActivePortrait');
    media.isActivePortrait = new Function('window',
        `return ({${mediaSource.slice(activeMatcher.start, activeMatcher.end)}}).isActivePortrait;`
    )(sceneWindow);
    const texts = [];
    const scene = {
        elements: [], profilePortraitRequest: 0, profilePortraitPreview: false,
        scene: { isActive: jest.fn(() => true) },
        add: {
            graphics: jest.fn(displayObject),
            text: jest.fn((_x, _y, text) => {
                const object = displayObject();
                object.text = text;
                texts.push(object);
                return object;
            }),
            image: jest.fn(displayObject)
        },
        tweens: { add: jest.fn() }
    };
    for (const node of declaration.body.body) {
        if (!['createProfilePortraitMatcher', 'waitForProfilePortrait', 'createLivingPortraitFrame'].includes(node.key?.name)) continue;
        scene[node.key.name] = new Function('window', 'companionMediaService', 'devLog',
            `return ({${source.slice(node.start, node.end)}}).${node.key.name};`
        )(sceneWindow, media, jest.fn());
    }
    const open = (record = initial, creature = first) => scene.createLivingPortraitFrame({
        x: 120, y: 160, size: 108, record, stage: creature.stage, creatureData: creature
    });
    return {
        scene, media, service, events, gameState, texts, open,
        setActive: record => { activeRecord = record; }
    };
}

describe('Creature Profile asynchronous portrait ownership', () => {
    afterEach(() => jest.useRealTimers());

    test('a matching saved portrait displays and records only its own identity', async () => {
        const record = portraitFor(first);
        const h = harness(record);
        h.open();
        await flush();
        expect(h.scene.add.image).toHaveBeenCalledWith(120, 160, record.identityKey);
        expect(h.media.recordAppearance).toHaveBeenCalledWith('companion_profile', record, 'motion_still');
        expect(h.service.generate).not.toHaveBeenCalled();
    });

    test('a ready event for another creature cannot steal the pending frame', async () => {
        const record = portraitFor(first);
        const wrong = portraitFor(second, '2');
        const h = harness(record);
        const loading = deferred();
        h.media.resolvePortrait.mockReturnValue(loading.promise);
        h.open();
        h.events.emit('creaturePortraitReady', wrong);
        await flush();
        expect(h.media.ensureTexture).not.toHaveBeenCalled();
        expect(h.scene.add.image).not.toHaveBeenCalled();
        loading.resolve(record);
        await flush();
        expect(h.scene.add.image).toHaveBeenCalledTimes(1);
        expect(h.scene.add.image).toHaveBeenCalledWith(120, 160, record.identityKey);
    });

    test('a ready event for the selected creature still cannot replace another creature profile', async () => {
        const original = portraitFor(first);
        const next = portraitFor(second, '2');
        const h = harness(original);
        h.media.resolvePortrait.mockReturnValue(new Promise(() => {}));
        h.open();
        h.setActive(next);
        h.events.emit('creaturePortraitReady', next);
        await flush();
        expect(h.scene.add.image).not.toHaveBeenCalled();
        expect(h.media.recordAppearance).not.toHaveBeenCalled();
    });

    test.each([
        ['another creature', portraitFor(second, '2')],
        ['adulthood', portraitFor({ ...first, stage: 'adult' }, '3')],
        ['a cleared game', null]
    ])('texture completion after %s cannot insert a stale portrait', async (_label, next) => {
        const h = harness();
        const loading = deferred();
        h.media.ensureTexture.mockReturnValue(loading.promise);
        h.open();
        await flush();
        h.setActive(next);
        loading.resolve('stale-texture');
        await flush();
        expect(h.scene.add.image).not.toHaveBeenCalled();
        expect(h.media.recordAppearance).not.toHaveBeenCalled();
        expect(h.texts[0].text).toBe('LIVING FORM\nTAP TO RETRY');
    });

    test('a valid older portrait identity is not replaced just because the prompt has changed', async () => {
        const legacy = { ...portraitFor(first), identityKey: 'synthetic-one:baby:legacy-prompt' };
        const h = harness(legacy);
        h.open();
        await flush();
        expect(h.scene.add.image).toHaveBeenCalledWith(120, 160, legacy.identityKey);
        expect(h.service.generate).not.toHaveBeenCalled();
        expect(h.gameState.set).not.toHaveBeenCalled();
    });

    test('a failed texture offers a working retry instead of an endless resolving state', async () => {
        const record = portraitFor(first);
        const h = harness(record);
        h.media.ensureTexture.mockResolvedValueOnce(null);
        h.open();
        await flush();
        expect(h.texts[0].text).toBe('LIVING FORM\nTAP TO RETRY');
        expect(h.scene.add.image).not.toHaveBeenCalled();
        h.texts[0].emit('pointerup');
        await flush();
        expect(h.scene.add.image).toHaveBeenCalledWith(120, 160, record.identityKey);
        expect(h.service.generate).not.toHaveBeenCalled();
    });

    test('an unrelated job appearing during polling is ignored until the matching portrait arrives', async () => {
        jest.useFakeTimers();
        const correct = portraitFor(first);
        const wrong = portraitFor(second, '2');
        const h = harness(null);
        let settled = false;
        const pending = h.scene.waitForProfilePortrait('baby', null, first);
        pending.finally(() => { settled = true; });
        h.service.getActiveJob.mockReturnValue({ ...wrong, promise: Promise.resolve(wrong) });
        await jest.advanceTimersByTimeAsync(750);
        expect(settled).toBe(false);
        h.setActive(correct);
        await jest.advanceTimersByTimeAsync(750);
        await expect(pending).resolves.toEqual(correct);
    });

    test('an unrelated saved portrait found by polling is not returned for this profile', async () => {
        jest.useFakeTimers();
        const correct = portraitFor(first);
        const h = harness(null);
        let settled = false;
        const pending = h.scene.waitForProfilePortrait('baby', null, first);
        pending.finally(() => { settled = true; });
        h.setActive(portraitFor(second, '2'));
        await jest.advanceTimersByTimeAsync(750);
        expect(settled).toBe(false);
        h.setActive(correct);
        await jest.advanceTimersByTimeAsync(750);
        await expect(pending).resolves.toEqual(correct);
    });

    test('the resolved job result is checked rather than trusting only the job label', async () => {
        const h = harness();
        h.service.getActiveJob.mockReturnValue({ ...portraitFor(first), promise: Promise.resolve(portraitFor(second, '2')) });
        await expect(h.scene.waitForProfilePortrait('baby', null, first)).rejects.toThrow();
        expect(h.service.generate).not.toHaveBeenCalled();
    });

    test('a matching in-flight job is reused without resolving or generating another portrait', async () => {
        const record = portraitFor(first);
        const h = harness();
        h.service.getActiveJob.mockReturnValue({ ...record, promise: Promise.resolve(record) });
        h.service.getEligibility.mockReturnValue({ eligible: true });
        await expect(h.scene.waitForProfilePortrait('baby', null, first)).resolves.toEqual(record);
        expect(h.service.generate).not.toHaveBeenCalled();
        expect(h.media.resolvePortrait).not.toHaveBeenCalled();
    });

    test('a missing portrait can still use the existing generation recovery path', async () => {
        const h = harness(null);
        const record = portraitFor(first);
        h.service.getEligibility.mockReturnValue({ eligible: true });
        h.service.generate.mockImplementation(async () => { h.setActive(record); return record; });
        h.open(null);
        await flush();
        expect(h.service.generate).toHaveBeenCalledTimes(1);
        expect(h.service.generate).toHaveBeenCalledWith(expect.objectContaining({
            creatureData: expect.objectContaining({ genes: first.genes, stage: 'baby' }),
            source: 'profile_recovery'
        }));
        expect(h.scene.add.image).toHaveBeenCalledWith(120, 160, record.identityKey);
    });

    test('a failed durable job can still be recovered while its profile is open', async () => {
        const legacy = { ...portraitFor(first), identityKey: 'synthetic-one:baby:legacy-prompt' };
        const current = portraitFor(first, '3');
        const h = harness(legacy);
        h.media.resolvePortrait.mockRejectedValue(Object.assign(new Error('Synthetic failed job'), { code: 'generation_failed' }));
        h.service.getEligibility.mockReturnValue({ eligible: true });
        h.service.generate.mockImplementation(async () => { h.setActive(current); return current; });
        h.open();
        await flush();
        expect(h.service.generate).toHaveBeenCalledTimes(1);
        expect(h.scene.add.image).toHaveBeenCalledWith(120, 160, current.identityKey);
        expect(h.media.recordAppearance).toHaveBeenCalledWith('companion_profile', current, 'motion_still');
    });

    test('a retry cannot generate for a creature that is no longer selected', async () => {
        const h = harness(null);
        h.service.getEligibility.mockReturnValue({ eligible: true });
        h.service.isCurrentCreaturePortrait = jest.fn(() => false);
        await expect(h.scene.waitForProfilePortrait('baby', null, first)).resolves.toBeNull();
        expect(h.service.generate).not.toHaveBeenCalled();
    });

    test('a retry cannot generate an old stage after the selected creature grows', async () => {
        const h = harness(portraitFor({ ...first, stage: 'adult' }));
        h.gameState.get = jest.fn(() => 'adult');
        h.service.getEligibility.mockReturnValue({ eligible: true });
        h.service.isCurrentCreaturePortrait = jest.fn(() => true);
        await expect(h.scene.waitForProfilePortrait('baby', null, first)).resolves.toBeNull();
        expect(h.service.generate).not.toHaveBeenCalled();
    });

    test('superseding a profile cancels its polling even while the scene remains active', async () => {
        jest.useFakeTimers();
        const h = harness(null);
        const pending = h.scene.waitForProfilePortrait('baby', null, first);
        h.scene.profilePortraitRequest += 1;
        h.setActive(portraitFor(first));
        await jest.advanceTimersByTimeAsync(750);
        await expect(pending).resolves.toBeNull();
        expect(h.media.resolvePortrait).not.toHaveBeenCalled();
    });

    test('a failed old request cannot start replacement generation after the profile closes', async () => {
        const h = harness();
        const loading = deferred();
        h.media.resolvePortrait.mockReturnValue(loading.promise.then(() => {
            throw Object.assign(new Error('Synthetic failed job'), { code: 'generation_failed' });
        }));
        h.service.getEligibility.mockReturnValue({ eligible: true });
        const pending = h.scene.waitForProfilePortrait('baby', portraitFor(first), first);
        h.scene.scene.isActive.mockReturnValue(false);
        loading.resolve();
        await expect(pending).resolves.toBeNull();
        expect(h.service.generate).not.toHaveBeenCalled();
    });

    test('the explicit preview can display without an active saved creature', async () => {
        const h = harness(null);
        h.scene.profilePortraitPreview = true;
        h.open({ ...portraitFor(first), storage: 'preview' });
        await flush();
        expect(h.scene.add.image).toHaveBeenCalledTimes(1);
        expect(h.media.recordAppearance).not.toHaveBeenCalled();
        expect(h.service.generate).not.toHaveBeenCalled();
    });
});
