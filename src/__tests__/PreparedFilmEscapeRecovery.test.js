const fs = require('node:fs');
const path = require('node:path');
const EventEmitter = require('eventemitter3');

function load(file, name, dependencies = {}) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
        .replace(/^import .*;$/gm, '').replace(`export class ${name}`, `class ${name}`);
    return new Function(...Object.keys(dependencies), `${source}\nreturn ${name};`)(...Object.values(dependencies));
}
const PreparedFilm = load('systems/PreparedFilm.js', 'PreparedFilm');
const GeneratedStoryFilm = load('systems/GeneratedStoryFilm.js', 'GeneratedStoryFilm', { PreparedFilm });
const Player = load('ui/PreparedFilmPlayer.js', 'PreparedFilmPlayer');
const FinaleFilms = load('systems/FinaleFilms.js', 'FinaleFilms', {
    manifest: {}, PreparedFilm, PreparedFilmPlayer: Player
});
const Arrival = load('ui/TrumptopusArrival.js', 'TrumptopusArrival');
const Result = load('ui/TrumptopusResult.js', 'TrumptopusResult');

// Actual film/player classes with DOM media methods replaced by inert doubles.
// No preparation, fetch, provider, decoding, native playback or audio runs.
function fixture(kind = 'shared', mountPlayer = true) {
    const service = { recordAppearance: jest.fn(), resolveGeneratedVideo: jest.fn() };
    const film = kind === 'shared'
        ? new PreparedFilm(null, { revokeURL: jest.fn() })
        : new GeneratedStoryFilm(service, { identityKey: 'synthetic_film', stage: 'baby', momentId: 'first_forest_arrival' });
    const video = document.createElement('video');
    video.muted = false;
    video.volume = 1;
    video.pause = jest.fn(); video.load = jest.fn(); video.play = jest.fn(() => Promise.resolve());
    const remove = video.remove.bind(video), removeAttribute = video.removeAttribute.bind(video);
    video.remove = jest.fn(remove); video.removeAttribute = jest.fn(removeAttribute);
    film.video = video; film.state = 'prepared';
    if (kind === 'shared') film.url = 'blob:synthetic-owned-film';
    const events = new EventEmitter();
    let paused = false;
    const scene = { events, sys: { isActive: () => !paused, isPaused: () => paused },
        clearInput: jest.fn(), setPrototypePaused: jest.fn(), hidePlatformerMobileControls: jest.fn(),
        scene: { pause: jest.fn(() => { paused = true; }), resume: jest.fn(() => { paused = false; }) } };
    const onClose = jest.fn();
    const player = mountPlayer ? new Player({ film, scene, title: 'Synthetic scene', onClose }) : null;
    return { film, video, service, events, scene, onClose, player,
        close() {
            jest.restoreAllMocks();
            video.pause = () => {}; video.load = () => {};
            video.remove = remove; video.removeAttribute = removeAttribute;
            film.options.revokeURL = () => {};
            film.listeners.clear();
            try { player?.close({ resume: false }); } catch { /* Clean up failed before diagnostics. */ }
            try { film.releaseMedia(); } catch { /* No real media was allocated. */ }
            events.removeAllListeners(); document.body.replaceChildren();
        } };
}

describe('optional film cleanup cannot trap Continue behind a closed overlay', () => {
    afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

    for (const kind of ['shared', 'generated']) {
        const failures = ['pause', 'load', 'removeAttribute', 'remove', 'observer', 'detach-listener'];
        if (kind === 'shared') failures.push('revokeURL');
        test.each(failures)(`${kind} film still exits after failed %s cleanup`, failure => {
            const f = fixture(kind);
            try {
                const fail = () => { throw Error('SYNTHETIC_MEDIA_CLEANUP_FAILURE'); };
                if (['pause', 'load', 'removeAttribute', 'remove'].includes(failure)) f.video[failure].mockImplementation(fail);
                if (failure === 'revokeURL') f.film.options.revokeURL.mockImplementation(fail);
                if (failure === 'observer') f.film.subscribe(state => { if (state === 'disposed') fail(); });
                if (failure === 'detach-listener') {
                    const remove = f.video.removeEventListener.bind(f.video);
                    jest.spyOn(f.video, 'removeEventListener').mockImplementation((type, callback) => {
                        if (type === 'ended') fail();
                        return remove(type, callback);
                    });
                }
                expect(() => f.player.close()).not.toThrow();
                expect(f.player.closed).toBe(true); expect(f.player.root.isConnected).toBe(false);
                expect(f.video.isConnected).toBe(false); expect(f.film.state).toBe('disposed');
                expect(f.film.video).toBeNull(); expect(f.film.url).toBeNull();
                expect(f.film.listeners.size).toBe(0); expect(f.player.attachedVideo).toBeNull();
                expect(f.video.muted).toBe(true); expect(f.video.volume).toBe(0);
                expect(f.scene.scene.resume).toHaveBeenCalledTimes(1); expect(f.onClose).toHaveBeenCalledTimes(1);
                expect(f.events.listenerCount('shutdown')).toBe(0); expect(f.events.listenerCount('destroy')).toBe(0);
                expect(f.service.recordAppearance).not.toHaveBeenCalled(); expect(f.service.resolveGeneratedVideo).not.toHaveBeenCalled();
                f.player.close(); expect(f.onClose).toHaveBeenCalledTimes(1);
                if (kind === 'shared') expect(f.film.options.revokeURL).toHaveBeenCalledTimes(1);
            } finally { f.close(); }
        });

        test(`${kind} normal Continue retains its existing pause/callback behaviour`, () => {
            const f = fixture(kind);
            try {
                f.player.close(); f.player.close();
                expect(f.onClose).toHaveBeenCalledTimes(1); expect(f.scene.scene.resume).toHaveBeenCalledTimes(1);
                expect(f.player.root.isConnected).toBe(false); expect(f.film.video).toBeNull();
                expect(f.film.state).toBe('disposed'); expect(f.film.listeners.size).toBe(0);
            } finally { f.close(); }
        });
    }

    test('shutdown still removes the overlay and never resumes after failed media pause', () => {
        const f = fixture();
        try {
            f.video.pause.mockImplementation(() => { throw Error('SYNTHETIC_PAUSE_FAILURE'); });
            expect(() => f.events.emit('shutdown')).not.toThrow();
            expect(f.player.root.isConnected).toBe(false); expect(f.scene.scene.resume).not.toHaveBeenCalled();
            expect(f.onClose).toHaveBeenCalledTimes(1); expect(f.film.video).toBeNull();
        } finally { f.close(); }
    });

    test('a failed observer cannot prevent remaining media resources being released', () => {
        const f = fixture();
        try {
            f.player.unsubscribe();
            f.film.subscribe(() => { throw Error('SYNTHETIC_DISPOSE_OBSERVER'); });
            expect(() => f.film.dispose()).not.toThrow();
            expect(f.film.video).toBeNull(); expect(f.film.url).toBeNull();
            expect(f.film.listeners.size).toBe(0); expect(f.video.pause).toHaveBeenCalledTimes(1);
            expect(f.film.options.revokeURL).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test('scene shutdown inside disposal cannot resume a retired scene after cleanup', () => {
        const f = fixture();
        try {
            f.film.subscribe(state => { if (state === 'disposed') f.events.emit('shutdown'); });
            f.player.close();
            expect(f.player.root.isConnected).toBe(false); expect(f.player.sceneRetired).toBe(true);
            expect(f.scene.scene.resume).not.toHaveBeenCalled(); expect(f.onClose).toHaveBeenCalledTimes(1);
            expect(f.film.video).toBeNull();
        } finally { f.close(); }
    });

    test('cancelling a pending first-frame wait settles false even if listener cleanup fails', async () => {
        jest.useFakeTimers();
        const f = fixture();
        try {
            Object.defineProperties(f.video, { currentTime: { value: 0, writable: true },
                paused: { value: true, writable: true }, readyState: { value: 2 } });
            f.video.play = jest.fn(() => Promise.resolve());
            const remove = f.video.removeEventListener.bind(f.video);
            jest.spyOn(f.video, 'removeEventListener').mockImplementation((type, callback) => {
                if (type === 'timeupdate') throw Error('SYNTHETIC_LISTENER_FAILURE');
                return remove(type, callback);
            });
            let settled;
            const pending = f.film.play().then(value => { settled = value; });
            expect(f.film.state).toBe('starting');
            expect(() => f.player.close()).not.toThrow();
            await Promise.resolve(); await Promise.resolve();
            expect(settled).toBe(false); await pending;
            expect(f.film.stopPlaybackWait).toBeNull(); expect(f.film.playbackAttempt).toBeNull();
            expect(jest.getTimerCount()).toBe(0); expect(f.film.video).toBeNull();
        } finally { f.close(); }
    });

    test('resource callbacks cannot clear a newer media object installed during old release', () => {
        const f = fixture();
        try {
            const replacement = document.createElement('video');
            replacement.pause = jest.fn(); replacement.load = jest.fn();
            const nextURL = 'blob:synthetic-next-film';
            f.film.options.revokeURL.mockImplementation(() => {
                f.film.video = replacement; f.film.url = nextURL;
            });
            f.film.releaseMedia();
            expect(f.film.video).toBe(replacement); expect(f.film.url).toBe(nextURL);
        } finally { f.close(); }
    });

    test('a closed player cannot invoke old playback actions', () => {
        const f = fixture();
        try {
            f.player.close(); const play = jest.spyOn(f.film, 'play');
            expect(() => f.player.act()).not.toThrow(); expect(play).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('required host continuation errors remain visible after optional cleanup', () => {
        const f = fixture();
        try {
            f.player.onClose = () => { throw Error('SYNTHETIC_HOST_CONTINUATION_FAILURE'); };
            expect(() => f.player.close()).toThrow('SYNTHETIC_HOST_CONTINUATION_FAILURE');
            expect(f.player.root.isConnected).toBe(false); expect(f.film.video).toBeNull();
        } finally { f.close(); }
    });

    test.each(['arrival', 'victory'])('actual %s Watch retains its host exit after media cleanup fails', beat => {
        const f = fixture('shared', false), next = jest.fn();
        const films = new FinaleFilms(f.scene, { encounterId: 'trumptopus', createFilm: () => f.film,
            config: { enabled: true, encounterId: 'trumptopus', films: {
                [beat]: { approved: true, title: 'Synthetic scene', asset: { url: '/game/cinematics/synthetic.mp4' } }
            } } });
        let host;
        try {
            if (beat === 'arrival') {
                host = new Arrival(f.scene, { films, onContinue: next }); host.offer();
            } else {
                host = new Result({ films, onContinue: next, primaryLabel: 'Return to Sanctuary', persisted: true,
                    receipt: { partAwarded: true, coinsAwarded: 2500,
                        powerup: { name: 'Super Blast', resultText: 'Ready', queued: false } } });
            }
            host.watch.click();
            const player = films.player;
            expect(player).toBeTruthy(); expect(host.root.hidden).toBe(true);
            f.video.pause.mockImplementation(() => { throw Error('SYNTHETIC_MEDIA_PAUSE_FAILURE'); });
            expect(() => player.close()).not.toThrow();
            expect(player.root.isConnected).toBe(false); expect(films.player).toBeNull();
            expect(f.film.state).toBe('disposed');
            if (beat === 'victory') {
                expect(host.root.hidden).toBe(false); expect(host.primary.disabled).toBe(false);
                host.primary.click();
            }
            expect(next).toHaveBeenCalledTimes(1);
            expect(f.service.recordAppearance).not.toHaveBeenCalled(); expect(f.service.resolveGeneratedVideo).not.toHaveBeenCalled();
        } finally { host?.close(); films.dispose(); f.close(); }
    });
});
