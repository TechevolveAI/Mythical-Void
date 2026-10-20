const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { parse } = require('@babel/parser');
const GameStateManager = require('../systems/GameState.js');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8').replace(/^import .*;$/gm, '').replace(/^export /gm, '');
const { storyVideoContext, videoNoticeKey } = new Function(`${read('systems/StoryVideoContext.js')};return {storyVideoContext,videoNoticeKey}`)();
const PreparedFilm = new Function(`${read('systems/PreparedFilm.js')};return PreparedFilm`)();
const GeneratedStoryFilm = new Function('PreparedFilm', `${read('systems/GeneratedStoryFilm.js')};return GeneratedStoryFilm`)(PreparedFilm);
const PreparedFilmPlayer = new Function(`${read('ui/PreparedFilmPlayer.js')};return PreparedFilmPlayer`)();
const notices = () => new Function('GeneratedStoryFilm', 'PreparedFilmPlayer', 'storyVideoContext', 'videoNoticeKey',
    `${read('ui/StoryVideoNotice.js')};return {nextStoryVideo,showStoryVideoNotice,openStoryVideo}`
)(GeneratedStoryFilm, PreparedFilmPlayer, storyVideoContext, videoNoticeKey);
const ready = { identityKey: 'test', momentId: 'guardian_rescue_cosmic_titan', stage: 'baby', assetRef: 'video-test' };
const scene = () => {
    let paused = false;
    const events = new EventEmitter();
    return { events, sys: { events, isActive: () => !paused, isPaused: () => paused,
        pause: jest.fn(() => { paused = true; }), resume: jest.fn(() => { paused = false; }) },
        scene: { pause: jest.fn(), resume: jest.fn() } };
};

afterEach(() => { document.body.replaceChildren(); jest.useRealTimers(); });

test.each(['paused-entry', 'pause-menu', 'boss', 'completion'])('film notices never cover %s', state => {
    const source = fs.readFileSync(path.join(__dirname, '../scenes/PlatformerLevelScene.js'), 'utf8');
    const cls = parse(source, { sourceType: 'module' }).program.body.find(n => n.type === 'ClassDeclaration');
    const n = cls.body.body.find(n => n.key?.name === 'updateGeneratedVideoDelivery');
    const update = new Function(`return ({${source.slice(n.start, n.end)}}).updateGeneratedVideoDelivery`)();
    const s = { destroyGeneratedVideoReadyNotice: jest.fn(), generatedVideoDeliveryPending: true };
    if (state === 'paused-entry') s.physics = { world: { isPaused: true } };
    if (state === 'pause-menu') s.pauseMenuActive = true;
    if (state === 'boss') s.bossFightActive = true;
    if (state === 'completion') s.levelCompletionActive = true;
    expect(update.call(s, 1000)).toBe(false);
    expect(s.destroyGeneratedVideoReadyNotice).toHaveBeenCalledTimes(1);
    expect(s.generatedVideoDeliveryPending).toBe(true);
});

test('delivery uses the exact realm, not the newest global film; dismiss and expiry suppress repeat offers', () => {
    jest.useFakeTimers();
    const ui = notices(); const s = scene();
    const service = { getUnviewedGeneratedVideos: () => [ready, { ...ready, momentId: 'first_forest_arrival' }] };
    expect(ui.nextStoryVideo(service, 'crystalCaves')).toBeNull();
    expect(ui.nextStoryVideo(service, 'mythicalForest').momentId).toBe('first_forest_arrival');
    const notice = ui.showStoryVideoNotice(s, service, ready);
    expect(document.body.textContent).toContain('Void Peaks: freedom after the battle');
    expect(document.body.textContent).not.toContain('Mythical Forest');
    document.querySelector('[aria-label="Dismiss film notice"]').click();
    expect(document.querySelector('.story-video-notice')).toBeNull();
    expect(ui.nextStoryVideo(service, 'voidPeaks')).toBeNull();
    expect(s.sys.pause).not.toHaveBeenCalled();
    notice.destroy();
    ui.showStoryVideoNotice(s, service, { ...ready, assetRef: 'another-clip' });
    jest.advanceTimersByTime(7001);
    expect(document.querySelector('.story-video-notice')).toBeNull();
    expect(s.events.listenerCount('shutdown')).toBe(0);
});

test('Watch is a real button and sends the selected film action exactly once', () => {
    const onWatch = jest.fn();
    const ui = notices(); const s = scene();
    ui.showStoryVideoNotice(s, {}, ready, { onWatch });
    const button = document.querySelector('button');
    button.click(); button.click();
    expect(onWatch).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.story-video-notice')).toBeNull();
});

test('closing while resolution is pending restores gameplay and cannot resurrect playback', async () => {
    let resolve;
    window.GameState = { getCreaturePortrait: () => ({ identityKey: 'test' }) };
    const service = { resolveGeneratedVideo: jest.fn(() => new Promise(r => { resolve = r; })), recordAppearance: jest.fn() };
    const s = scene();
    const player = notices().openStoryVideo(s, service, ready);
    expect(s.sys.pause).toHaveBeenCalledTimes(1);
    player.close();
    resolve({ videoUrl: 'https://example.test/film.mp4' });
    await Promise.resolve(); await Promise.resolve();
    expect(player.film.state).toBe('disposed');
    expect(player.film.video).toBeNull();
    expect(service.recordAppearance).not.toHaveBeenCalled();
    expect(s.sys.resume).toHaveBeenCalledTimes(1);
});

test('missing media stays dismissible; shutdown never resumes a destroyed scene', async () => {
    window.GameState = { getCreaturePortrait: () => ({ identityKey: 'test' }) };
    const service = { resolveGeneratedVideo: jest.fn(async () => null), recordAppearance: jest.fn() };
    const s = scene(); const player = notices().openStoryVideo(s, service, ready);
    await player.film.pending;
    expect(player.film.state).toBe('failed');
    expect(player.closeButton.disabled).toBe(false);
    expect(service.recordAppearance).not.toHaveBeenCalled();
    s.events.emit('shutdown');
    expect(s.sys.resume).not.toHaveBeenCalled();
    expect(document.querySelector('.prepared-film-player')).toBeNull();
});

test('a stalled generated-film lookup reaches Retry and still permits Continue', async () => {
    jest.useFakeTimers();
    window.GameState = { getCreaturePortrait: () => ({ identityKey: 'test' }) };
    let resolve;
    const service = { resolveGeneratedVideo: () => new Promise(done => { resolve = done; }), recordAppearance: jest.fn() };
    const s = scene();
    const player = notices().openStoryVideo(s, service, ready);
    try {
        await jest.advanceTimersByTimeAsync(15001);
        expect(player.film.state).toBe('failed');
        expect(player.action.textContent).toBe('Retry');
        expect(player.closeButton.disabled).toBe(false);
        expect(service.recordAppearance).not.toHaveBeenCalled();
    } finally {
        player.close();
        resolve(null);
        await Promise.resolve();
    }
});

test('a creature change during lookup cannot allocate or show the previous creature film', async () => {
    let resolve;
    const portrait = { identityKey: 'test' };
    window.GameState = { getCreaturePortrait: () => portrait };
    const service = { resolveGeneratedVideo: () => new Promise(done => { resolve = done; }), recordAppearance: jest.fn() };
    const film = new GeneratedStoryFilm(service, ready);
    film.options.createVideo = jest.fn(() => { throw new Error('stale_video_allocated'); });
    const pending = film.prepare();
    portrait.identityKey = 'new-creature';
    resolve({ videoUrl: '/game/cinematics/test.mp4' });
    expect(await pending).toBe(false);
    expect(film.error).toBe('identity_changed');
    expect(film.options.createVideo).not.toHaveBeenCalled();
    expect(service.recordAppearance).not.toHaveBeenCalled();
    film.dispose();
});

test('New Game blocks an already prepared film even if the creature identity matches', async () => {
    window.GameState = { getCreaturePortrait: () => ({ identityKey: 'test' }) };
    let currentCampaign = true;
    const service = { captureCampaignGuard: () => () => currentCampaign, recordAppearance: jest.fn() };
    const film = new GeneratedStoryFilm(service, ready);
    const video = { play: jest.fn(), pause: jest.fn(), removeEventListener: jest.fn(),
        removeAttribute: jest.fn(), load: jest.fn(), remove: jest.fn() };
    film.video = video;
    film.state = 'prepared';
    currentCampaign = false;
    expect(await film.play()).toBe(false);
    expect(video.play).not.toHaveBeenCalled();
    expect(film.error).toBe('identity_changed');
    expect(service.recordAppearance).not.toHaveBeenCalled();
    film.dispose();
});

describe('generated film reset boundary', () => {
    let film;
    let gameState;
    let service;
    let video;
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        gameState = new GameStateManager();
        gameState.storageMode = 'memory';
        window.GameState = gameState;
        jest.spyOn(gameState, 'getCreaturePortrait').mockReturnValue({ identityKey: 'test' });
        const story = gameState.get('story');
        service = {
            getMediaSession: () => ({ isCurrent: () => window.GameState === gameState && gameState.get('story') === story }),
            resolveGeneratedVideo: jest.fn(async () => ({ videoUrl: 'https://example.test/synthetic.mp4' })),
            recordAppearance: jest.fn()
        };
        film = new GeneratedStoryFilm(service, ready);
        video = document.createElement('video');
        Object.defineProperties(video, {
            videoWidth: { value: 1280 }, videoHeight: { value: 720 },
            duration: { value: 5 }, readyState: { value: 2 },
            currentTime: { value: 0, writable: true }, paused: { value: true, writable: true }
        });
        video.load = jest.fn(() => { if (video.getAttribute('src')) video.dispatchEvent(new Event('loadeddata')); });
        video.play = jest.fn(async () => { video.paused = false; });
        video.pause = jest.fn(() => { video.paused = true; });
        film.options.createVideo = () => video;
    });
    afterEach(() => {
        film.dispose();
        gameState.stopAutoSave();
        jest.restoreAllMocks();
        delete window.GameState;
    });

    test('a delayed Watch cannot open a film belonging to the previous game', async () => {
        gameState.reset();
        await expect(film.prepare()).resolves.toBe(false);
        expect(service.resolveGeneratedVideo).not.toHaveBeenCalled();
        expect(service.recordAppearance).not.toHaveBeenCalled();
    });

    test('reset during decoding prevents preparation from succeeding', async () => {
        video.load.mockImplementation(() => {});
        const pending = film.prepare();
        await Promise.resolve();
        gameState.reset();
        video.dispatchEvent(new Event('loadeddata'));
        await expect(pending).resolves.toBe(false);
        expect(service.recordAppearance).not.toHaveBeenCalled();
    });

    test('a prepared film cannot start playing after reset', async () => {
        await expect(film.prepare()).resolves.toBe(true);
        gameState.reset();
        video.play.mockImplementation(() => {
            video.paused = false;
            video.currentTime = 1;
            video.dispatchEvent(new Event('timeupdate'));
            return Promise.resolve();
        });
        await expect(film.play()).resolves.toBe(false);
        expect(video.play).not.toHaveBeenCalled();
        expect(service.recordAppearance).not.toHaveBeenCalled();
    });

    test('reset before the first advancing frame cannot mark the old film as watched', async () => {
        await expect(film.prepare()).resolves.toBe(true);
        const playing = film.play();
        gameState.reset();
        video.currentTime = 1;
        video.dispatchEvent(new Event('timeupdate'));
        await expect(playing).resolves.toBe(false);
        expect(service.recordAppearance).not.toHaveBeenCalled();
        expect(video.pause).toHaveBeenCalled();
    });

    test('switching creatures before the first frame cannot record the previous film as watched', async () => {
        await expect(film.prepare()).resolves.toBe(true);
        const playing = film.play();
        gameState.getCreaturePortrait.mockReturnValue({ identityKey: 'another-synthetic-creature' });
        video.currentTime = 1;
        video.dispatchEvent(new Event('timeupdate'));
        await expect(playing).resolves.toBe(false);
        expect(service.recordAppearance).not.toHaveBeenCalled();
        expect(film.state).toBe('disposed');
        expect(video.paused).toBe(true);
    });

    test('campaign invalidation without replacing the story cannot record an old first frame', async () => {
        let current = true;
        film.isCurrentCampaign = () => current;
        await expect(film.prepare()).resolves.toBe(true);
        const playing = film.play();
        current = false;
        video.currentTime = 1;
        video.dispatchEvent(new Event('timeupdate'));
        await expect(playing).resolves.toBe(false);
        expect(service.recordAppearance).not.toHaveBeenCalled();
        expect(video.paused).toBe(true);
    });

    test('closing from a playback subscriber cannot record a view or report successful playback', async () => {
        await expect(film.prepare()).resolves.toBe(true);
        film.subscribe(state => { if (state === 'playing') film.dispose(); });
        const playing = film.play();
        video.currentTime = 1;
        video.dispatchEvent(new Event('timeupdate'));
        await expect(playing).resolves.toBe(false);
        expect(service.recordAppearance).not.toHaveBeenCalled();
        expect(film.state).toBe('disposed');
    });

    test('closing from the fetching notification prevents generated-video resolution', async () => {
        film.subscribe(state => { if (state === 'fetching') film.dispose(); });
        await expect(film.prepare()).resolves.toBe(false);
        expect(service.resolveGeneratedVideo).not.toHaveBeenCalled();
        expect(video.play).not.toHaveBeenCalled();
        expect(service.recordAppearance).not.toHaveBeenCalled();
        expect(film.state).toBe('disposed');
    });

    test('closing from the starting notification cannot play a removed generated video', async () => {
        await expect(film.prepare()).resolves.toBe(true);
        film.subscribe(state => { if (state === 'starting') film.dispose(); });
        await expect(film.play()).resolves.toBe(false);
        expect(video.play).not.toHaveBeenCalled();
        expect(service.recordAppearance).not.toHaveBeenCalled();
        expect(film.state).toBe('disposed');
    });

    test.each(['new-game', 'creature-switch', 'campaign-invalidation'])(
        '%s from the starting notification prevents the old Play call', async change => {
            await expect(film.prepare()).resolves.toBe(true);
            let current = true;
            film.isCurrentCampaign = () => current;
            film.subscribe(state => {
                if (state !== 'starting') return;
                if (change === 'new-game') gameState.reset();
                if (change === 'creature-switch') gameState.getCreaturePortrait.mockReturnValue({ identityKey: 'another-synthetic-creature' });
                if (change === 'campaign-invalidation') current = false;
            });
            const pending = film.play();
            // If the regression starts playback, allow that old wait to settle
            // without a real media device or leaving a timer behind.
            if (video.play.mock.calls.length) {
                video.currentTime = 1;
                video.dispatchEvent(new Event('timeupdate'));
            }
            await expect(pending).resolves.toBe(false);
            expect(video.play).not.toHaveBeenCalled();
            expect(service.recordAppearance).not.toHaveBeenCalled();
            expect(film.state).toBe('disposed');
        }
    );

    test('switching creatures from a playback subscriber cannot write an obsolete view', async () => {
        await expect(film.prepare()).resolves.toBe(true);
        film.subscribe(state => {
            if (state === 'playing') gameState.getCreaturePortrait.mockReturnValue({ identityKey: 'another-synthetic-creature' });
        });
        const playing = film.play();
        video.currentTime = 1;
        video.dispatchEvent(new Event('timeupdate'));
        await expect(playing).resolves.toBe(false);
        expect(service.recordAppearance).not.toHaveBeenCalled();
        expect(film.state).toBe('disposed');
    });

    test('ordinary playback still records one view after frame progress', async () => {
        await expect(film.prepare()).resolves.toBe(true);
        const playing = film.play();
        video.currentTime = 1;
        video.dispatchEvent(new Event('timeupdate'));
        await expect(playing).resolves.toBe(true);
        expect(service.recordAppearance).toHaveBeenCalledTimes(1);
        expect(video.muted).toBe(true);
        expect(video.defaultMuted).toBe(true);
        expect(video.playsInline).toBe(true);
    });
});
