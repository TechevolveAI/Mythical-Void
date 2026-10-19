const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const CreaturePortraitSpec = require('../systems/CreaturePortraitSpec.js');
const videoMoments = require('../config/companion-video-moments.json');

const gameSource = fs.readFileSync(path.join(__dirname, '../scenes/GameScene.js'), 'utf8');
const gameClass = parse(gameSource, { sourceType: 'module' }).program.body
    .find(node => node.type === 'ClassDeclaration' && node.id.name === 'GameScene');
const mediaSource = fs.readFileSync(path.join(__dirname, '../systems/CompanionMediaService.js'), 'utf8');
const mediaBody = parse(mediaSource, { sourceType: 'module' }).program.body;
const mediaStart = mediaBody.find(node => node.type !== 'ImportDeclaration').start;
const mediaEnd = mediaBody.find(node => node.type === 'ExportNamedDeclaration').start;

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

function portrait(id = 'synthetic-first', stage = 'baby', assetNumber = '1') {
    return {
        identityKey: CreaturePortraitSpec.create({ genes: { id }, stage }).identityKey,
        stage,
        assetRef: `portrait-job-v1:00000000-0000-4000-8000-${assetNumber.padStart(12, '0')}`,
        imageUrl: `https://example.test/${id}-${stage}-${assetNumber}.png`
    };
}

function harness(initial = portrait()) {
    let active = initial;
    const gameState = {
        get: jest.fn(key => key === 'creature.lifecycle.stage' ? active?.stage : null),
        getCreaturePortrait: jest.fn(stage => (
            !stage || active?.stage === stage ? active : null
        )),
        set: jest.fn(),
        save: jest.fn(),
        emit: jest.fn()
    };
    const sceneWindow = { GameState: gameState };
    const media = new Function('window', 'companionVideoMomentsConfig',
        `${mediaSource.slice(mediaStart, mediaEnd)}; return companionMediaService;`
    )(sceneWindow, videoMoments);
    sceneWindow.CompanionMediaService = media;
    media.resolvePortrait = jest.fn(async () => active);
    media.ensureTexture = jest.fn(async () => 'synthetic-texture');
    media.hasAppearance = jest.fn(() => false);

    const panel = { setCompanionPortrait: jest.fn(() => true) };
    const timers = [];
    const scene = {
        _isShuttingDown: false,
        sys: { isActive: jest.fn(() => true) },
        villageCommandPanel: panel,
        isLivingPortraitNoticeBlocked: jest.fn(() => false),
        showLivingPortraitReadyNotice: jest.fn(),
        time: {
            delayedCall: jest.fn((delay, callback) => {
                const timer = { delay, callback, remove: jest.fn() };
                timers.push(timer);
                return timer;
            })
        }
    };
    for (const name of ['hydrateVillageCommandPortrait', 'maybeShowLivingPortraitReadyNotice']) {
        const node = gameClass.body.body.find(method => method.key?.name === name);
        scene[name] = new Function('window', 'companionMediaService',
            `return ({${gameSource.slice(node.start, node.end)}}).${name};`
        )(sceneWindow, media);
    }
    return { scene, panel, media, gameState, timers, setActive: record => { active = record; } };
}

describe('Sanctuary portraits follow the selected creature and life stage', () => {
    test('the current portrait still reaches the panel and ready notice', async () => {
        const record = portrait();
        const h = harness(record);
        await expect(h.scene.hydrateVillageCommandPortrait(h.panel)).resolves.toBe(true);
        await expect(h.scene.maybeShowLivingPortraitReadyNotice(record)).resolves.toBe(true);
        expect(h.panel.setCompanionPortrait).toHaveBeenCalledWith(record);
        expect(h.scene.showLivingPortraitReadyNotice).toHaveBeenCalledWith(record, 'synthetic-texture', { preview: false });
        expect(h.gameState.set).not.toHaveBeenCalled();
        expect(h.gameState.save).not.toHaveBeenCalled();
    });

    test.each([
        ['another creature', portrait('synthetic-second', 'baby', '2')],
        ['adulthood', portrait('synthetic-first', 'adult', '3')],
        ['a replacement portrait', portrait('synthetic-first', 'baby', '4')],
        ['a cleared game', null]
    ])('a late panel response cannot overwrite %s', async (_label, next) => {
        const original = portrait();
        const h = harness(original);
        const loading = deferred();
        h.media.resolvePortrait.mockReturnValue(loading.promise);
        const pending = h.scene.hydrateVillageCommandPortrait(h.panel);
        h.setActive(next);
        loading.resolve(original);
        await expect(pending).resolves.toBe(false);
        expect(h.panel.setCompanionPortrait).not.toHaveBeenCalled();
    });

    test('an already stale ready event is ignored before loading a texture', async () => {
        const h = harness(portrait('synthetic-second', 'baby', '2'));
        await expect(h.scene.maybeShowLivingPortraitReadyNotice(portrait())).resolves.toBe(false);
        expect(h.media.ensureTexture).not.toHaveBeenCalled();
        expect(h.scene.showLivingPortraitReadyNotice).not.toHaveBeenCalled();
    });

    test('a creature switch while resolving the portrait cannot open an old reveal', async () => {
        const original = portrait();
        const h = harness(original);
        const loading = deferred();
        h.media.resolvePortrait.mockReturnValue(loading.promise);
        const pending = h.scene.maybeShowLivingPortraitReadyNotice();
        h.setActive(portrait('synthetic-second', 'baby', '2'));
        loading.resolve(original);
        await expect(pending).resolves.toBe(false);
        expect(h.media.ensureTexture).not.toHaveBeenCalled();
        expect(h.scene.showLivingPortraitReadyNotice).not.toHaveBeenCalled();
    });

    test.each([
        ['a creature switch', portrait('synthetic-second', 'baby', '2')],
        ['adulthood', portrait('synthetic-first', 'adult', '3')]
    ])('a texture finishing after %s cannot show an old portrait', async (_label, next) => {
        const original = portrait();
        const h = harness(original);
        const loading = deferred();
        h.media.ensureTexture.mockReturnValue(loading.promise);
        const pending = h.scene.maybeShowLivingPortraitReadyNotice(original);
        h.setActive(next);
        loading.resolve('old-texture');
        await expect(pending).resolves.toBe(false);
        expect(h.scene.showLivingPortraitReadyNotice).not.toHaveBeenCalled();
    });

    test('a deferred notice is rechecked after the creature has changed', async () => {
        const original = portrait();
        const h = harness(original);
        h.scene.isLivingPortraitNoticeBlocked.mockReturnValue(true);
        await expect(h.scene.maybeShowLivingPortraitReadyNotice(original)).resolves.toBe(false);
        expect(h.timers).toHaveLength(1);
        h.setActive(portrait('synthetic-second', 'baby', '2'));
        h.scene.isLivingPortraitNoticeBlocked.mockReturnValue(false);
        h.timers[0].callback();
        for (let index = 0; index < 5; index += 1) await Promise.resolve();
        expect(h.media.ensureTexture).not.toHaveBeenCalled();
        expect(h.scene.showLivingPortraitReadyNotice).not.toHaveBeenCalled();
    });

    test('an old request cannot clear the newer request deduplication guard', async () => {
        const first = portrait();
        const second = portrait('synthetic-second', 'baby', '2');
        const h = harness(first);
        const firstLoad = deferred();
        const secondLoad = deferred();
        h.media.ensureTexture.mockReturnValueOnce(firstLoad.promise).mockReturnValueOnce(secondLoad.promise);
        const firstNotice = h.scene.maybeShowLivingPortraitReadyNotice(first);
        h.setActive(second);
        const secondNotice = h.scene.maybeShowLivingPortraitReadyNotice(second);
        firstLoad.resolve('first-texture');
        await expect(firstNotice).resolves.toBe(false);
        expect(h.scene.livingPortraitNoticePendingIdentity).toBe(second.identityKey);
        await expect(h.scene.maybeShowLivingPortraitReadyNotice(second)).resolves.toBe(false);
        expect(h.media.ensureTexture).toHaveBeenCalledTimes(2);
        secondLoad.resolve('second-texture');
        await expect(secondNotice).resolves.toBe(true);
        expect(h.scene.showLivingPortraitReadyNotice).toHaveBeenCalledTimes(1);
        expect(h.scene.livingPortraitNoticePendingIdentity).toBeNull();
    });

    test('a still-current result survives switching away and back while it loads', async () => {
        const original = portrait();
        const h = harness(original);
        const loading = deferred();
        h.media.ensureTexture.mockReturnValue(loading.promise);
        const pending = h.scene.maybeShowLivingPortraitReadyNotice(original);
        h.setActive(portrait('synthetic-second', 'baby', '2'));
        h.setActive({ ...original });
        loading.resolve('original-texture');
        await expect(pending).resolves.toBe(true);
        expect(h.scene.showLivingPortraitReadyNotice).toHaveBeenCalledTimes(1);
    });

    test('closed panels and shutting-down scenes stay closed', async () => {
        const h = harness();
        const loading = deferred();
        h.media.resolvePortrait.mockReturnValue(loading.promise);
        const pending = h.scene.hydrateVillageCommandPortrait(h.panel);
        h.scene.villageCommandPanel = null;
        h.scene._isShuttingDown = true;
        loading.resolve(portrait());
        await expect(pending).resolves.toBe(false);
        await expect(h.scene.maybeShowLivingPortraitReadyNotice(portrait())).resolves.toBe(false);
        expect(h.panel.setCompanionPortrait).not.toHaveBeenCalled();
        expect(h.scene.showLivingPortraitReadyNotice).not.toHaveBeenCalled();
    });

    test('the explicit non-saving visual preview does not need a real creature', async () => {
        const h = harness(null);
        const preview = { ...portrait(), storage: 'preview' };
        await expect(h.scene.maybeShowLivingPortraitReadyNotice(preview, { preview: true })).resolves.toBe(true);
        expect(h.gameState.set).not.toHaveBeenCalled();
        expect(h.gameState.save).not.toHaveBeenCalled();
    });
});
