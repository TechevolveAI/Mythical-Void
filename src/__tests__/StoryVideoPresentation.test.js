const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { parse } = require('@babel/parser');
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
    return { events: new EventEmitter(), sys: { isActive: () => !paused, isPaused: () => paused },
        scene: { pause: jest.fn(() => { paused = true; }), resume: jest.fn(() => { paused = false; }) } };
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
    expect(s.scene.pause).not.toHaveBeenCalled();
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
    expect(s.scene.pause).toHaveBeenCalledTimes(1);
    player.close();
    resolve({ videoUrl: 'https://example.test/film.mp4' });
    await Promise.resolve(); await Promise.resolve();
    expect(player.film.state).toBe('disposed');
    expect(player.film.video).toBeNull();
    expect(service.recordAppearance).not.toHaveBeenCalled();
    expect(s.scene.resume).toHaveBeenCalledTimes(1);
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
    expect(s.scene.resume).not.toHaveBeenCalled();
    expect(document.querySelector('.prepared-film-player')).toBeNull();
});
