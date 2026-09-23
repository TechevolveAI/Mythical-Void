const fs = require('fs');
const path = require('path');
const { Blob } = require('buffer');
const { createHash, webcrypto } = require('crypto');
const { ReadableStream } = require('stream/web');

function loadClass(relativePath, className, dependencies = {}) {
    const source = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')
        .replace(/^import .*;$/gm, '').replace(`export class ${className}`, `class ${className}`);
    return new Function(...Object.keys(dependencies), `${source}\nreturn ${className};`)(...Object.values(dependencies));
}

const PreparedFilm = loadClass('systems/PreparedFilm.js', 'PreparedFilm', { Blob });
const PreparedFilmPlayer = loadClass('ui/PreparedFilmPlayer.js', 'PreparedFilmPlayer');
const bytes = Uint8Array.from([0, 0, 0, 24, 102, 116, 121, 112]);
const asset = {
    url: '/game/cinematics/example.mp4', bytes: bytes.length, durationSeconds: 8,
    sha256: createHash('sha256').update(bytes).digest('hex')
};

function fakeVideo({ decode = true } = {}) {
    const video = document.createElement('video');
    Object.defineProperties(video, {
        videoWidth: { value: 1280 }, videoHeight: { value: 720 },
        duration: { value: 8 }, readyState: { value: 2 },
        paused: { value: true, writable: true }
    });
    video.load = jest.fn(() => {
        if (decode && video.getAttribute('src')) queueMicrotask(() => video.dispatchEvent(new Event('loadeddata')));
    });
    video.pause = jest.fn(() => { video.paused = true; });
    video.play = jest.fn(() => {
        video.paused = false;
        queueMicrotask(() => {
            video.currentTime += 0.1;
            video.dispatchEvent(new Event('timeupdate'));
        });
        return Promise.resolve();
    });
    return video;
}

function setup({ video = fakeVideo(), overrides = {}, definition = asset } = {}) {
    const options = {
        origin: 'https://game.test',
        fetch: jest.fn(async () => ({
            ok: true, headers: new Map([['content-type', 'video/mp4']]),
            body: new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } })
        })),
        digest: buffer => webcrypto.subtle.digest('SHA-256', buffer),
        createVideo: () => video, createURL: jest.fn(() => 'blob:film-test'), revokeURL: jest.fn(),
        ...overrides
    };
    return { film: new PreparedFilm(definition, options), options, video };
}

describe('PreparedFilm bounded shared media', () => {
    test('deduplicates preparation, verifies bytes and decodes without any playback or credential', async () => {
        const { film, video, options } = setup();
        const pending = film.prepare();
        expect(film.prepare()).toBe(pending);
        expect(await pending).toBe(true);
        expect(film.state).toBe('prepared');
        expect(video.play).not.toHaveBeenCalled();
        expect(video.muted).toBe(true);
        expect(options.fetch).toHaveBeenCalledTimes(1);
        expect(options.fetch.mock.calls[0][1]).toMatchObject({ credentials: 'omit', redirect: 'error' });
        expect(await film.play()).toBe(true);
        expect(film.state).toBe('playing');
        expect(options.fetch).toHaveBeenCalledTimes(1);
        film.dispose();
        film.dispose();
        expect(options.revokeURL).toHaveBeenCalledTimes(1);
    });

    test.each([
        ['external URL', { url: 'https://evil.test/a.mp4' }],
        ['path traversal', { url: '/game/cinematics/../a.mp4' }],
        ['absent digest', { sha256: null }],
        ['over budget', { bytes: 9 * 1024 * 1024 }]
    ])('rejects %s before fetching', async (_, patch) => {
        const { film, options } = setup({ definition: { ...asset, ...patch } });
        expect(await film.prepare()).toBe(false);
        expect(options.fetch).not.toHaveBeenCalled();
        expect(film.error).toBe('invalid_asset');
        film.dispose();
    });

    test.each([
        ['hash mismatch', { sha256: 'a'.repeat(64) }, 'hash_mismatch'],
        ['oversized chunked response', { bytes: 4 }, 'too_large'],
        ['truncated response', { bytes: 12 }, 'size_mismatch']
    ])('rejects %s without allocating a video URL', async (_, patch, error) => {
        const { film, options } = setup({ definition: { ...asset, ...patch } });
        expect(await film.prepare()).toBe(false);
        expect(film.error).toBe(error);
        expect(options.createURL).not.toHaveBeenCalled();
        film.dispose();
    });

    test('dispose during fetch cannot revive a scene or allocate a texture later', async () => {
        let finish;
        const { film, options } = setup({ overrides: { fetch: jest.fn(() => new Promise(resolve => { finish = resolve; })) } });
        const pending = film.prepare();
        film.dispose();
        finish({ ok: false, headers: new Map() });
        expect(await pending).toBe(false);
        expect(film.state).toBe('disposed');
        expect(options.createURL).not.toHaveBeenCalled();
    });

    test('a decoder that never becomes ready has a deadline and releases the Blob', async () => {
        const { film, options } = setup({ video: fakeVideo({ decode: false }), overrides: { prepareMs: 20 } });
        expect(await film.prepare()).toBe(false);
        expect(film.error).toBe('prepare_timeout');
        expect(options.revokeURL).toHaveBeenCalledTimes(1);
        film.dispose();
    });

    test('a rejected play promise is recoverable and never marks the film as playing', async () => {
        const { film, video } = setup();
        await film.prepare();
        video.play.mockRejectedValue(new Error('NotAllowedError'));
        expect(await film.play()).toBe(false);
        expect(film.state).toBe('failed');
        expect(film.error).toBe('play_rejected');
        film.dispose();
    });

    test('a resolved play promise without progressing frames is not success', async () => {
        const { film, video } = setup({ overrides: { startupMs: 20 } });
        await film.prepare();
        video.play.mockResolvedValue();
        expect(await film.play()).toBe(false);
        expect(film.error).toBe('startup_timeout');
        film.dispose();
    });

    test('pause interrupts startup and permits explicit resume', async () => {
        const { film, video } = setup();
        await film.prepare();
        const normalPlay = video.play.getMockImplementation();
        video.play.mockResolvedValueOnce();
        const pending = film.play();
        film.pause();
        expect(await pending).toBe(false);
        expect(film.state).toBe('paused');
        video.play.mockImplementation(normalPlay);
        expect(await film.play()).toBe(true);
        film.dispose();
    });

    test('mid-film stall is bounded', async () => {
        const { film, video } = setup({ overrides: { startupMs: 20 } });
        await film.prepare();
        await film.play();
        video.dispatchEvent(new Event('waiting'));
        await new Promise(resolve => setTimeout(resolve, 35));
        expect(film.error).toBe('playback_stalled');
        film.dispose();
    });
});

describe('PreparedFilmPlayer ownership and escape', () => {
    test('Continue disposes loading media and restores only its own scene pause', async () => {
        const { film } = setup();
        const scene = {
            sys: { isActive: () => true, isPaused: () => true },
            scene: { pause: jest.fn(), resume: jest.fn() }, virtualJoystickX: 1, virtualJoystickY: -1
        };
        const player = new PreparedFilmPlayer({ film, title: 'Test film', scene });
        expect(scene.scene.pause).toHaveBeenCalledTimes(1);
        expect(scene.virtualJoystickX).toBe(0);
        expect(player.closeButton.disabled).toBe(false);
        player.closeButton.click();
        expect(film.state).toBe('disposed');
        expect(scene.scene.resume).toHaveBeenCalledTimes(1);
        player.close();
        expect(scene.scene.resume).toHaveBeenCalledTimes(1);
    });

    test('does not unpause a scene paused before the film; shutdown never resumes', () => {
        for (const previouslyActive of [false, true]) {
            const { film } = setup();
            const scene = {
                sys: { isActive: () => previouslyActive, isPaused: () => true },
                scene: { pause: jest.fn(), resume: jest.fn() }
            };
            const player = new PreparedFilmPlayer({ film, title: 'Test film', scene });
            player.close({ resume: !previouslyActive });
            expect(scene.scene.resume).not.toHaveBeenCalled();
        }
    });

    test('Escape exits without waiting for any media', () => {
        const { film } = setup();
        const player = new PreparedFilmPlayer({ film, title: 'Test film' });
        player.root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(player.closed).toBe(true);
        expect(document.querySelector('[role=dialog]')).toBe(null);
    });
});

describe('FinaleFilms content gates', () => {
    const manifest = require('../config/final-void-films.json');
    const FinaleFilms = loadClass('systems/FinaleFilms.js', 'FinaleFilms', { manifest, PreparedFilm, PreparedFilmPlayer });

    test('missing approved art cannot produce a pretend Watch button or outside request', async () => {
        const createFilm = jest.fn();
        const films = new FinaleFilms(null, { encounterId: 'trumptopus', createFilm,
            config: { enabled: false, encounterId: 'trumptopus', films: {} } });
        expect(await films.prepare('arrival')).toBe(false);
        expect(films.watch('arrival')).toBe(false);
        expect(createFilm).not.toHaveBeenCalled();
        films.dispose();
    });

    test('Trumptopus films cannot be shown for the historical Empress encounter', async () => {
        const createFilm = jest.fn();
        const config = { ...manifest, enabled: true, films: { arrival: { approved: true, asset } } };
        const films = new FinaleFilms(null, { encounterId: 'void_empress', config, createFilm });
        expect(await films.prepare('arrival')).toBe(false);
        expect(createFilm).not.toHaveBeenCalled();
        films.dispose();
    });
});
