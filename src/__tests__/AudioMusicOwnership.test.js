const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const source = fs.readFileSync(path.join(__dirname, '../systems/AudioManager.js'), 'utf8');
const declaration = parse(source, { sourceType: 'module' }).program.body
    .find(node => node.type === 'ClassDeclaration' && node.id.name === 'AudioManager');

// No AudioContext, game, browser or real timers. Retired callbacks can be forced
// deliberately to exercise a callback already queued before cancellation.
function fixture({ actualLayers = false } = {}) {
    let sequence = 0;
    const active = new Map(), retained = new Map();
    const schedule = interval => (callback, delay) => {
        const id = ++sequence, entry = { callback, delay, interval };
        active.set(id, entry); retained.set(id, entry); return id;
    };
    const clear = jest.fn(id => active.delete(id));
    const document = { hidden: false };
    const Manager = vm.runInNewContext(`(${source.slice(declaration.start, declaration.end)})`, {
        document, window: {}, console: { log() {}, warn() {}, error() {} },
        setTimeout: schedule(false), setInterval: schedule(true), clearTimeout: clear, clearInterval: clear
    });
    const param = () => ({ value: 0, setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn() });
    const node = () => ({ connect: jest.fn(), disconnect: jest.fn(), gain: param() });
    const context = { state: 'running', currentTime: 5, destination: {}, sampleRate: 64,
        createGain: jest.fn(node), createOscillator: jest.fn(() => ({ ...node(),
            frequency: param(), detune: param(), start: jest.fn(), stop: jest.fn() })),
        createBiquadFilter: jest.fn(() => ({ ...node(), frequency: param(), Q: param() })),
        createBuffer: jest.fn((channels, size) => ({ getChannelData: () => new Float32Array(size) })),
        createBufferSource: jest.fn(() => ({ ...node(), start: jest.fn(), stop: jest.fn() })) };
    const manager = new Manager();
    manager.audioContext = context; manager.initialized = true;
    if (!actualLayers) manager.createMusicLayer = jest.fn();
    const fire = id => {
        const entry = active.get(id);
        if (!entry) throw Error('TIMER_NOT_ACTIVE');
        if (!entry.interval) active.delete(id);
        entry.callback();
    };
    return { manager, context, document, active, retained, clear, fire };
}

const layers = ['createArpeggioLayer', 'createBellsLayer', 'createPulseLayer',
    'createSingingBowlLayer', 'createWindChimesLayer'];
function startLayer(f, layer) {
    f.manager.playAreaMusic('sanctuary');
    f.manager[layer](220, layer === 'createPulseLayer' ? 80 : [1, 1.5], 80);
}

describe('procedural music timers belong to one soundtrack', () => {
    test.each(Object.keys(fixture().manager.areaConfigs))('%s retains its actual configured music layers', area => {
        const f = fixture({ actualLayers: true });
        expect(() => f.manager.playAreaMusic(area)).not.toThrow();
        expect(f.manager.musicPlaying).toBe(true);
        for (let cycle = 0; cycle < 5; cycle++) {
            for (const id of [...f.active.keys()]) f.fire(id);
            expect(f.manager.musicPlaying).toBe(true);
            for (const note of f.context.createOscillator.mock.results.map(result => result.value)) note.onended?.();
        }
        for (const result of f.context.createOscillator.mock.results) {
            expect(Number.isFinite(result.value.frequency.value)).toBe(true);
        }
        expect(f.context.createOscillator.mock.calls.length).toBeGreaterThan(0);
        const nodes = f.manager.musicNodes;
        f.manager.stopMusic(false);
        expect(nodes.transientSources.size).toBe(0);
        expect(nodes.oscillators).toHaveLength(0);
        expect(f.active.size).toBe(0);
    });

    test.each(layers)('%s cannot write into a replacement area even if its cancelled callback runs', layer => {
        const f = fixture(); startLayer(f, layer);
        const retired = [...f.active.keys()];
        expect(retired.length).toBeGreaterThan(0);
        f.manager.stopMusic(false);
        expect(f.active.size).toBe(0);
        f.manager.playAreaMusic('gathering');
        const nodes = f.manager.musicNodes, created = f.context.createOscillator.mock.calls.length;
        for (const id of retired) f.retained.get(id).callback();
        expect(f.context.createOscillator).toHaveBeenCalledTimes(created);
        expect(f.active.size).toBe(0);
        expect(f.manager.musicNodes).toBe(nodes);
        expect(nodes.gainNode.disconnect).not.toHaveBeenCalled();
    });

    test.each(layers)('%s skips interrupted/hidden/muted notes without losing its one live schedule', layer => {
        const f = fixture(); startLayer(f, layer);
        for (const state of ['suspended', 'hidden', 'muted']) {
            f.context.state = state === 'suspended' ? 'suspended' : 'running';
            f.document.hidden = state === 'hidden'; f.manager.muted = state === 'muted';
            const created = f.context.createOscillator.mock.calls.length;
            for (const id of [...f.active.keys()]) f.fire(id);
            expect(f.context.createOscillator).toHaveBeenCalledTimes(created);
            expect(f.active.size).toBeGreaterThan(0);
            expect(f.active.size).toBeLessThanOrEqual(2);
        }
        f.context.state = 'running'; f.document.hidden = false; f.manager.muted = false;
        const before = f.context.createOscillator.mock.calls.length;
        for (const id of [...f.active.keys()]) f.fire(id);
        expect(f.context.createOscillator.mock.calls.length).toBeGreaterThan(before);
        f.manager.stopMusic(false);
        expect(f.active.size).toBe(0);
    });

    test('a fading soundtrack retires its schedules immediately, then only its own nodes', () => {
        const f = fixture(); startLayer(f, 'createSingingBowlLayer');
        const oldNodes = f.manager.musicNodes, oldGain = oldNodes.gainNode;
        f.manager.stopMusic(true);
        expect(f.active.size).toBe(1);
        const cleanup = [...f.active.keys()][0];
        f.manager.playAreaMusic('gathering');
        const next = f.manager.musicNodes;
        f.fire(cleanup);
        expect(oldGain.disconnect).toHaveBeenCalledTimes(1);
        expect(next.gainNode.disconnect).not.toHaveBeenCalled();
        expect(f.manager.musicPlaying).toBe(true);
        expect(f.active.size).toBe(0);
    });

    test.each(layers)('%s releases its live short-lived notes when stopped', layer => {
        const f = fixture(); startLayer(f, layer);
        for (const id of [...f.active.keys()]) f.fire(id);
        const oscillators = f.context.createOscillator.mock.results.map(result => result.value);
        expect(oscillators.length).toBeGreaterThan(0);
        f.manager.stopMusic(false);
        for (const osc of oscillators) expect(osc.disconnect).toHaveBeenCalledTimes(1);
        expect(f.active.size).toBe(0);
    });

    test('ended transient notes are removed rather than accumulating for the entire soundtrack', () => {
        const f = fixture(); startLayer(f, 'createSingingBowlLayer');
        const notes = f.context.createOscillator.mock.results.map(result => result.value);
        for (const note of notes) {
            expect(typeof note.onended).toBe('function'); note.onended();
            expect(note.disconnect).toHaveBeenCalledTimes(1);
        }
        expect(f.manager.musicNodes.transientSources.size).toBe(0);
        f.manager.stopMusic(false);
        for (const note of notes) expect(note.disconnect).toHaveBeenCalledTimes(1);
    });

    test('repeated area changes do not retain old schedules or add old music to the next area', () => {
        const f = fixture();
        for (let index = 0; index < 30; index++) {
            startLayer(f, layers[index % layers.length]);
            expect(f.active.size).toBeLessThanOrEqual(2);
            f.manager.stopMusic(false);
            expect(f.active.size).toBe(0);
        }
        f.manager.playAreaMusic('gathering');
        const created = f.context.createOscillator.mock.calls.length;
        for (const entry of [...f.retained.values()]) entry.callback();
        expect(f.context.createOscillator).toHaveBeenCalledTimes(created);
        expect(f.active.size).toBe(0);
    });

    test('interrupted pickup sounds are not replayed as a stale burst after recovery', async () => {
        const f = fixture(); let resolve;
        const pending = new Promise(done => { resolve = done; });
        f.manager.resume = jest.fn(() => pending);
        f.manager.registerSound('coin_collect', [{ frequency: 440, duration: 0.1, volume: 0.1 }]);
        f.context.state = 'suspended';
        for (let i = 0; i < 20; i++) f.manager.playSound('coin_collect');
        f.context.state = 'running'; resolve(true);
        await pending; await Promise.resolve();
        expect(f.context.createOscillator).not.toHaveBeenCalled();
        f.manager.playSound('coin_collect');
        expect(f.context.createOscillator).toHaveBeenCalledTimes(1);
    });

    test.each(['connection', 'layer'])('failed %s setup remains retryable without lying that music is playing', failure => {
        const f = fixture();
        if (failure === 'connection') f.context.createGain.mockImplementationOnce(() => {
            const gain = { gain: { value: 0 }, connect() { throw Error('fictional connection failure'); }, disconnect: jest.fn() };
            return gain;
        });
        else f.manager.createMusicLayer.mockImplementationOnce(() => { throw Error('fictional layer failure'); });
        expect(() => f.manager.playAreaMusic('sanctuary')).not.toThrow();
        expect(f.manager.musicPlaying).toBe(false);
        expect(f.manager.currentArea).toBeNull();
        expect(f.manager.requestedArea).toBe('sanctuary');
        f.manager.playAreaMusic('sanctuary');
        expect(f.manager.musicPlaying).toBe(true);
        expect(f.manager.currentArea).toBe('sanctuary');
    });

    test.each(layers)('%s contains a note-device failure and retires only its own timers', layer => {
        const f = fixture(); startLayer(f, layer);
        f.context.createOscillator.mockImplementationOnce(() => { throw Error('fictional device failure'); });
        for (const id of [...f.active.keys()]) {
            if (f.active.has(id)) expect(() => f.fire(id)).not.toThrow();
        }
        expect(f.manager.musicPlaying).toBe(false);
        expect(f.manager.requestedArea).toBe('sanctuary');
        expect(f.active.size).toBe(0);
        f.manager.playAreaMusic('gathering');
        expect(f.manager.musicPlaying).toBe(true);
    });

    test('a failed fade still stops and disconnects the old music immediately', () => {
        const f = fixture(); startLayer(f, 'createSingingBowlLayer');
        const gain = f.manager.musicNodes.gainNode;
        gain.gain.linearRampToValueAtTime.mockImplementationOnce(() => { throw Error('fictional closed device'); });
        expect(() => f.manager.stopMusic(true)).not.toThrow();
        expect(gain.disconnect).toHaveBeenCalledTimes(1);
        expect(f.active.size).toBe(0);
        expect(f.manager.musicPlaying).toBe(false);
    });

    test('destroy retires current and fading notes/timers even when the context close rejects', async () => {
        const f = fixture(); startLayer(f, 'createSingingBowlLayer');
        f.manager.stopMusic(true);
        startLayer(f, 'createBellsLayer');
        const gains = f.context.createGain.mock.results.map(result => result.value);
        f.context.close = jest.fn(() => Promise.reject(Error('fictional already closed')));
        f.manager.destroy();
        await Promise.resolve();
        expect(f.active.size).toBe(0);
        expect(f.manager.retiringMusic.size).toBe(0);
        expect(f.manager.audioContext).toBeNull();
        const created = f.context.createOscillator.mock.calls.length;
        for (const entry of [...f.retained.values()]) expect(() => entry.callback()).not.toThrow();
        expect(f.context.createOscillator).toHaveBeenCalledTimes(created);
        for (const gain of gains) expect(gain.disconnect).toHaveBeenCalledTimes(1);
    });
});
