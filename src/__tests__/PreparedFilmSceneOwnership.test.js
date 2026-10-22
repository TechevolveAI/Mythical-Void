const fs = require('node:fs');
const path = require('node:path');
const EventEmitter = require('eventemitter3');
const Systems = require('phaser/src/scene/Systems');
const ScenePlugin = require('phaser/src/scene/ScenePlugin');
const SceneManager = require('phaser/src/scene/SceneManager');
const Status = require('phaser/src/scene/const');

function load(file, name) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
        .replace(/^import .*;$/gm, '').replace(`export class ${name}`, `class ${name}`);
    return new Function(`${source}\nreturn ${name};`)();
}
const PreparedFilm = load('systems/PreparedFilm.js', 'PreparedFilm');
const Player = load('ui/PreparedFilmPlayer.js', 'PreparedFilmPlayer');

// Native scene lifecycle/operation queue, without booting a Game or renderer.
// No film preparation, media decode/playback, audio, saves or network run.
function fixture() {
    const game = { events: new EventEmitter() };
    const manager = game.scene = new SceneManager(game);
    const events = new EventEmitter();
    const scene = { events, virtualJoystickX: 1, virtualJoystickY: -1,
        input: { keyboard: { resetKeys: jest.fn() } },
        clearVirtualJumpInput: jest.fn(), releaseAllPlatformerActionButtons: jest.fn() };
    const systems = scene.sys = new Systems(scene, { key: 'SyntheticFilmScene' });
    systems.events = events; systems.game = game;
    Object.assign(systems.settings, { status: Status.RUNNING, active: true, visible: true });
    const plugin = scene.scene = new ScenePlugin(scene);
    manager.keys[systems.settings.key] = scene; manager.scenes.push(scene);
    const film = new PreparedFilm(null), onClose = jest.fn();
    let player;
    return { scene, systems, plugin, events, manager, film, onClose,
        mount() { player = new Player({ film, scene, title: 'Synthetic scene', onClose }); return player; },
        replaceSystems() {
            scene.sys = new Systems(scene, { key: systems.settings.key });
            scene.sys.events = scene.events; scene.sys.game = game;
            Object.assign(scene.sys.settings, { status: Status.PAUSED, active: false, visible: true });
            scene.scene = new ScenePlugin(scene);
            return scene.sys;
        },
        close() {
            player?.close({ resume: false });
            film.dispose();
            // Restore only the original native teardown context after assertions.
            scene.sys = systems; scene.scene = plugin; scene.events = events;
            systems.events = events;
            plugin.destroy(); events.removeAllListeners(); game.events.removeAllListeners();
            manager._queue.length = 0; manager.keys = {}; manager.scenes.length = 0;
            document.body.replaceChildren(); jest.restoreAllMocks();
        }
    };
}

describe('film exit owns the exact native scene pause', () => {
    test('control: native ScenePlugin pause/resume really wait for the SceneManager queue', () => {
        const f = fixture();
        try {
            f.plugin.pause(); expect(f.systems.isActive()).toBe(true);
            f.manager.processQueue(); expect(f.systems.isPaused()).toBe(true);
            f.plugin.resume(); expect(f.systems.isPaused()).toBe(true);
            f.manager.processQueue(); expect(f.systems.isActive()).toBe(true);
        } finally { f.close(); }
    });

    test('Continue before the next manager update cannot leave a late pause behind', () => {
        const f = fixture();
        try {
            const player = f.mount(); player.closeButton.click();
            f.manager.processQueue();
            expect(player.closed).toBe(true);
            expect(f.systems.isActive()).toBe(true);
            expect(f.onClose).toHaveBeenCalledTimes(1);
            expect(document.querySelector('.prepared-film-player')).toBeNull();
        } finally { f.close(); }
    });

    test.each(['systems', 'plugin', 'events'])('a replaced %s cannot inherit an old film resume or callback', binding => {
        const f = fixture();
        try {
            const player = f.mount(); f.manager.processQueue();
            if (binding === 'systems') f.replaceSystems();
            if (binding === 'plugin') f.scene.scene = new ScenePlugin(f.scene);
            if (binding === 'events') f.scene.events = f.scene.sys.events = new EventEmitter();
            const current = f.scene.sys;
            player.close(); f.manager.processQueue();
            expect(current.isPaused()).toBe(true);
            expect(f.onClose).not.toHaveBeenCalled();
            expect(f.events.listenerCount('shutdown')).toBe(0);
            expect(f.events.listenerCount('destroy')).toBe(0);
        } finally { f.close(); }
    });

    test('shutdown inside input reset cannot mount or pause a retired player', () => {
        const f = fixture();
        try {
            f.scene.input.keyboard.resetKeys.mockImplementation(() => f.systems.shutdown());
            const player = f.mount();
            expect(player.closed).toBe(true);
            expect(f.systems.getStatus()).toBe(Status.SHUTDOWN);
            expect(document.querySelector('.prepared-film-player')).toBeNull();
            expect(f.film.listeners.size).toBe(0);
            expect(f.manager._queue).toHaveLength(0);
        } finally { f.close(); }
    });

    test('required input-reset failure releases subscribers and leaves gameplay running', () => {
        const f = fixture();
        try {
            const failure = new Error('SYNTHETIC_FILM_INPUT_FAILURE');
            f.scene.input.keyboard.resetKeys.mockImplementation(() => { throw failure; });
            expect(() => f.mount()).toThrow(failure);
            f.manager.processQueue();
            expect(f.systems.isActive()).toBe(true);
            expect(f.film.listeners.size).toBe(0);
            expect(f.film.state).toBe('disposed');
            expect(f.onClose).not.toHaveBeenCalled();
            expect(document.querySelector('.prepared-film-player')).toBeNull();
        } finally { f.close(); }
    });

    test('a native pause-event failure restores the source and keeps the original error visible', () => {
        const f = fixture();
        try {
            const failure = new Error('SYNTHETIC_FILM_PAUSE_FAILURE');
            f.events.on('pause', () => { throw failure; });
            expect(() => f.mount()).toThrow(failure);
            expect(f.systems.isActive()).toBe(true);
            expect(f.film.listeners.size).toBe(0);
            expect(f.onClose).not.toHaveBeenCalled();
            expect(document.querySelector('.prepared-film-player')).toBeNull();
        } finally { f.close(); }
    });

    test('render failure after pause cannot strand the game behind a failed constructor', () => {
        const f = fixture();
        try {
            f.film.state = 'synthetic-invalid-state';
            expect(() => f.mount()).toThrow();
            f.manager.processQueue();
            expect(f.systems.isActive()).toBe(true);
            expect(f.film.listeners.size).toBe(0);
            expect(f.onClose).not.toHaveBeenCalled();
            expect(document.querySelector('.prepared-film-player')).toBeNull();
        } finally { f.close(); }
    });

    test('an external resume followed by another pause cannot be undone by an old film', () => {
        const f = fixture();
        try {
            const player = f.mount(); f.manager.processQueue();
            f.systems.resume(); f.systems.pause();
            player.close(); f.manager.processQueue();
            expect(f.systems.isPaused()).toBe(true);
        } finally { f.close(); }
    });

    test('ordinary mounting pauses synchronously and Continue resumes once without queued operations', () => {
        const f = fixture();
        try {
            const resume = jest.spyOn(f.systems, 'resume');
            const player = f.mount();
            expect(f.systems.isPaused()).toBe(true);
            expect(f.manager._queue).toHaveLength(0);
            expect(f.scene.virtualJoystickX).toBe(0);
            expect(f.scene.virtualJoystickY).toBe(0);
            player.closeButton.click(); player.close();
            expect(f.systems.isActive()).toBe(true);
            expect(resume).toHaveBeenCalledTimes(1);
            expect(f.onClose).toHaveBeenCalledTimes(1);
            expect(f.manager._queue).toHaveLength(0);
        } finally { f.close(); }
    });

    test('a source paused before opening is not resumed by the film', () => {
        const f = fixture();
        try {
            f.systems.pause(); const resume = jest.spyOn(f.systems, 'resume');
            const player = f.mount(); player.close();
            expect(f.systems.isPaused()).toBe(true);
            expect(resume).not.toHaveBeenCalled();
            expect(f.onClose).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test.each(['shutdown', 'destroy'])('native %s closes the film without resuming its stopped source', lifecycle => {
        const f = fixture();
        try {
            const player = f.mount(), resume = jest.spyOn(f.systems, 'resume');
            f.systems[lifecycle]();
            expect(player.closed).toBe(true);
            expect(player.root.isConnected).toBe(false);
            expect(f.systems.isActive()).toBe(false);
            expect(resume).not.toHaveBeenCalled();
            expect(f.film.state).toBe('disposed');
            expect(f.events.listenerCount('shutdown')).toBe(0);
            expect(f.events.listenerCount('destroy')).toBe(0);
        } finally { f.close(); }
    });

    test('an explicit non-resuming close preserves the host pause', () => {
        const f = fixture();
        try {
            const player = f.mount(); player.close({ resume: false });
            expect(f.systems.isPaused()).toBe(true);
            expect(f.onClose).toHaveBeenCalledTimes(1);
            expect(f.manager._queue).toHaveLength(0);
        } finally { f.close(); }
    });

    test('a failed DOM mount releases the acquired pause and cannot invoke host continuation', () => {
        const f = fixture();
        try {
            const failure = new Error('SYNTHETIC_FILM_DOM_FAILURE');
            jest.spyOn(document.body, 'append').mockImplementationOnce(() => { throw failure; });
            expect(() => f.mount()).toThrow(failure);
            expect(f.systems.isActive()).toBe(true);
            expect(f.film.state).toBe('disposed');
            expect(f.film.listeners.size).toBe(0);
            expect(f.onClose).not.toHaveBeenCalled();
            expect(f.events.listenerCount('shutdown')).toBe(0);
        } finally { f.close(); }
    });

    test.each(['prepare', 'play'])('a stale %s button cannot use a replacement scene', action => {
        const f = fixture();
        try {
            f.film.state = action === 'prepare' ? 'absent' : 'prepared';
            const run = jest.spyOn(f.film, action).mockResolvedValue(false);
            const player = f.mount(); f.replaceSystems();
            player.action.click();
            expect(run).not.toHaveBeenCalled();
            expect(player.closed).toBe(true);
            expect(f.scene.sys.isPaused()).toBe(true);
            expect(f.onClose).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('source replacement inside disposal cannot resume or focus the successor', () => {
        const f = fixture();
        const previous = document.createElement('button'); document.body.append(previous); previous.focus();
        try {
            const focus = jest.spyOn(previous, 'focus');
            const player = f.mount();
            f.film.subscribe(state => { if (state === 'disposed') f.replaceSystems(); });
            player.close();
            expect(f.scene.sys.isPaused()).toBe(true);
            expect(f.onClose).not.toHaveBeenCalled();
            expect(focus).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test.each(['systems', 'events'])('replacement %s during input reset cannot be cleared or mounted over', binding => {
        const f = fixture();
        try {
            f.scene.input.keyboard.resetKeys.mockImplementation(() => {
                if (binding === 'systems') f.replaceSystems();
                else f.scene.events = f.scene.sys.events = new EventEmitter();
            });
            const player = f.mount();
            expect(player.closed).toBe(true);
            expect(f.scene.releaseAllPlatformerActionButtons).not.toHaveBeenCalled();
            expect(f.scene.virtualJoystickX).toBe(1);
            expect(f.scene.virtualJoystickY).toBe(-1);
            expect(f.onClose).not.toHaveBeenCalled();
            expect(document.querySelector('.prepared-film-player')).toBeNull();
        } finally { f.close(); }
    });

    test('replacement inside the native pause event cannot mount or resume the successor', () => {
        const f = fixture();
        try {
            f.events.on('pause', () => f.replaceSystems());
            const player = f.mount();
            expect(player.closed).toBe(true);
            expect(f.scene.sys.isPaused()).toBe(true);
            expect(f.onClose).not.toHaveBeenCalled();
            expect(f.film.listeners.size).toBe(0);
        } finally { f.close(); }
    });
});
