const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const source = fs.readFileSync(path.join(__dirname, '../systems/AudioManager.js'), 'utf8');
const declaration = parse(source, { sourceType: 'module' }).program.body
    .find(node => node.type === 'ClassDeclaration' && node.id.name === 'AudioManager');

// Actual manager, fictional contexts/nodes and manually driven timers only.
// Nothing here constructs AudioContext or opens a browser, device or game.
function fixture() {
    let next = 0;
    const active = new Map(), retained = new Map(), trace = [];
    const schedule = (callback, delay) => {
        const id = ++next; active.set(id, { callback, delay }); retained.set(id, { callback, delay }); return id;
    };
    const clear = jest.fn(id => active.delete(id));
    const document = new EventTarget(); document.hidden = false; document.visibilityState = 'visible';
    const window = new EventTarget();
    const Manager = vm.runInNewContext(`(${source.slice(declaration.start, declaration.end)})`, {
        document, window, console: { log() {}, warn() {}, error() {} },
        setTimeout: schedule, clearTimeout: clear, clearInterval: clear
    });
    const param = () => ({ value: 0, setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() });
    const context = { state: 'running', currentTime: 10, destination: {},
        suspend: jest.fn(async () => { context.state = 'suspended'; }),
        resume: jest.fn(async () => { context.state = 'running'; }),
        close: jest.fn(() => { trace.push('close'); context.state = 'closed'; return Promise.resolve(); }),
        createOscillator: jest.fn(() => ({ frequency: param(), type: null, onended: null,
            connect: jest.fn(), disconnect: jest.fn(), start: jest.fn(),
            stop: jest.fn((...args) => trace.push(args.length ? 'scheduled-stop' : 'stop-now')) })),
        createGain: jest.fn(() => ({ gain: param(), connect: jest.fn(), disconnect: jest.fn() })) };
    const manager = new Manager(); manager.initialized = true; manager.audioContext = context;
    manager.registerSound('synthetic', [{ frequency: 440, duration: 0.2, volume: 0.4 },
        { frequency: 660, duration: 0.3, volume: 0.2 }]);
    for (const name of ['feed', 'pet', 'play', 'feed_response', 'pet_response', 'play_response']) {
        manager.registerSound(name, [{ frequency: 500, duration: 0.1, volume: 0.2 }]);
    }
    return { manager, context, document, window, active, retained, clear, trace,
        oscillators: () => context.createOscillator.mock.results.filter(r => r.type === 'return').map(r => r.value),
        gains: () => context.createGain.mock.results.filter(r => r.type === 'return').map(r => r.value),
        fire(id) { const timer = active.get(id); if (!timer) throw Error('TIMER_NOT_ACTIVE'); active.delete(id); timer.callback(); },
        close() { manager.destroy(); active.clear(); } };
}

describe('procedural effects retire before mute, background or destruction', () => {
    test.each(['mute', 'suspend', 'sfx-zero', 'master-zero'])(
        '%s immediately stops and disconnects already-scheduled tones', boundary => {
            const f = fixture();
            try {
                f.manager.playSound('synthetic');
                if (boundary === 'mute') f.manager.toggleMute();
                if (boundary === 'suspend') f.manager.suspendAudioContexts();
                if (boundary === 'sfx-zero') f.manager.setSFXVolume(0);
                if (boundary === 'master-zero') f.manager.setMasterVolume(0);
                for (const oscillator of f.oscillators()) {
                    expect(oscillator.stop).toHaveBeenLastCalledWith();
                    expect(oscillator.disconnect).toHaveBeenCalledTimes(1);
                }
                f.gains().forEach(gain => expect(gain.disconnect).toHaveBeenCalledTimes(1));
            } finally { f.close(); }
        }
    );

    test('destruction disconnects tones before even a rejected context close', async () => {
        const f = fixture();
        try {
            f.context.close.mockImplementation(() => { f.trace.push('close'); return Promise.reject(Error('SYNTHETIC_CLOSE_FAILURE')); });
            f.manager.playSound('synthetic'); f.manager.destroy(); await Promise.resolve();
            expect(f.trace.indexOf('stop-now')).toBeGreaterThanOrEqual(0);
            expect(f.trace.indexOf('stop-now')).toBeLessThan(f.trace.indexOf('close'));
            f.gains().forEach(gain => expect(gain.disconnect).toHaveBeenCalledTimes(1));
        } finally { f.close(); }
    });

    test('normal ended callbacks disconnect only their own source and output', () => {
        const f = fixture();
        try {
            f.manager.playSound('synthetic'); const [first, second] = f.oscillators();
            const ended = first.onended; ended?.(); ended?.();
            expect(first.disconnect).toHaveBeenCalledTimes(1);
            expect(f.gains()[0].disconnect).toHaveBeenCalledTimes(1);
            expect(second.disconnect).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('partial sequence setup failure cleans up earlier tones and the acquired orphan', () => {
        const f = fixture();
        try {
            const create = f.context.createGain.getMockImplementation(); let calls = 0;
            f.context.createGain.mockImplementation(() => {
                if (++calls === 2) throw Error('SYNTHETIC_GAIN_FAILURE');
                return create();
            });
            expect(() => f.manager.playSound('synthetic')).not.toThrow();
            f.oscillators().forEach(oscillator => expect(oscillator.disconnect).toHaveBeenCalledTimes(1));
            expect(f.oscillators()[0].stop).toHaveBeenLastCalledWith();
            expect(f.gains()[0].disconnect).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test.each([['playFeedWithResponse', 300], ['playPetWithResponse', 250], ['playPlayWithResponse', 350]])(
        '%s cannot replay a care response after hide and return', (method, delay) => {
            const f = fixture();
            try {
                f.manager.setupAudioLifecycleRecovery(); f.manager[method]();
                const id = [...f.active.keys()][0]; expect(f.retained.get(id).delay).toBe(delay);
                f.document.hidden = true; f.document.visibilityState = 'hidden'; f.manager.audioVisibilityHandler();
                f.document.hidden = false; f.document.visibilityState = 'visible'; f.context.state = 'running';
                const count = f.context.createOscillator.mock.calls.length;
                f.retained.get(id).callback();
                expect(f.context.createOscillator).toHaveBeenCalledTimes(count);
                expect(f.active.size).toBe(0);
            } finally { f.close(); }
        }
    );

    test('the ordinary sequence retains pitches, timing, envelope and volume calculation', () => {
        const f = fixture();
        try {
            f.manager.playSound('synthetic', 0.5); const [first, second] = f.oscillators();
            expect(first.frequency.value).toBe(440); expect(second.frequency.value).toBe(660);
            expect(first.type).toBe('sine'); expect(second.type).toBe('sine');
            expect(first.start).toHaveBeenCalledWith(10); expect(first.stop).toHaveBeenCalledWith(10.2);
            expect(second.start).toHaveBeenCalledWith(10.2); expect(second.stop).toHaveBeenCalledWith(10.5);
            expect(f.gains()[0].gain.setValueAtTime).toHaveBeenCalledWith(0, 10);
            expect(f.gains()[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.4 * 0.8 * 0.7 * 0.5, 10.01);
            expect(f.gains()[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 10.2);
        } finally { f.close(); }
    });

    test('an ordinary care response retains its brief delay and then plays', () => {
        const f = fixture();
        try {
            f.manager.playFeedWithResponse(); const id = [...f.active.keys()][0];
            expect(f.context.createOscillator).toHaveBeenCalledTimes(1);
            expect(f.active.get(id).delay).toBe(300); f.fire(id);
            expect(f.context.createOscillator).toHaveBeenCalledTimes(2);
            f.retained.get(id).callback();
            expect(f.context.createOscillator).toHaveBeenCalledTimes(2);
        } finally { f.close(); }
    });

    test.each(['mute', 'suspend', 'destroy', 'sfx-zero', 'master-zero'])(
        '%s retires care timers even if a captured old callback is invoked', boundary => {
            const f = fixture();
            try {
                f.manager.playFeedWithResponse(); const callback = [...f.retained.values()][0].callback;
                if (boundary === 'mute') { f.manager.toggleMute(); f.manager.toggleMute(); }
                if (boundary === 'suspend') { f.manager.suspendAudioContexts(); f.context.state = 'running'; }
                if (boundary === 'destroy') { f.manager.destroy(); f.manager.audioContext = f.context; f.context.state = 'running'; }
                if (boundary === 'sfx-zero') { f.manager.setSFXVolume(0); f.manager.setSFXVolume(0.8); }
                if (boundary === 'master-zero') { f.manager.setMasterVolume(0); f.manager.setMasterVolume(0.7); }
                const count = f.context.createOscillator.mock.calls.length; callback(); callback();
                expect(f.context.createOscillator).toHaveBeenCalledTimes(count);
                expect(f.active.size).toBe(0); expect(f.manager.careResponses.size).toBe(0);
            } finally { f.close(); }
        }
    );

    test('pagehide requests immediate effect cancellation even if context suspension rejects', async () => {
        const f = fixture();
        try {
            f.context.suspend.mockRejectedValue(Error('SYNTHETIC_SUSPEND_FAILURE'));
            f.manager.setupAudioLifecycleRecovery(); f.manager.playFeedWithResponse();
            f.window.dispatchEvent(new Event('pagehide')); await Promise.resolve();
            f.oscillators().forEach(node => expect(node.stop).toHaveBeenLastCalledWith());
            f.gains().forEach(node => expect(node.disconnect).toHaveBeenCalledTimes(1));
            expect(f.active.size).toBe(0); expect(f.manager.soundEffects.size).toBe(0);
        } finally { f.close(); }
    });

    test('interruption recovery retires frozen-clock tones before requesting resume', async () => {
        const f = fixture();
        try {
            f.manager.playSound('synthetic'); f.context.state = 'interrupted';
            f.context.resume.mockImplementation(async () => { f.trace.push('resume'); f.context.state = 'running'; });
            expect(await f.manager.resume()).toBe(true);
            expect(f.trace.indexOf('stop-now')).toBeLessThan(f.trace.indexOf('resume'));
            expect(f.manager.soundEffects.size).toBe(0);
            f.manager.playSound('synthetic'); expect(f.context.createOscillator).toHaveBeenCalledTimes(4);
        } finally { f.close(); }
    });

    test('a delayed response cannot create audio in a replacement context', () => {
        const f = fixture();
        try {
            f.manager.playFeedWithResponse(); const id = [...f.active.keys()][0];
            const replacement = { ...f.context, createOscillator: jest.fn() };
            f.manager.audioContext = replacement; f.fire(id);
            expect(replacement.createOscillator).not.toHaveBeenCalled();
            expect(f.manager.careResponses.size).toBe(0);
        } finally { f.close(); }
    });

    test.each(['muted', 'hidden', 'suspended', 'closed', 'sfx-zero', 'master-zero'])(
        '%s care requests do not queue a response for a later audible moment', state => {
            const f = fixture();
            try {
                if (state === 'muted') f.manager.muted = true;
                if (state === 'hidden') f.document.hidden = true;
                if (state === 'suspended' || state === 'closed') f.context.state = state;
                if (state === 'sfx-zero') f.manager.sfxVolume = 0;
                if (state === 'master-zero') f.manager.masterVolume = 0;
                f.manager.playPetWithResponse();
                expect(f.active.size).toBe(0); expect(f.manager.careResponses.size).toBe(0);
                expect(f.context.createOscillator).not.toHaveBeenCalled();
            } finally { f.close(); }
        }
    );

    test.each(['oscillator', 'gain', 'source-connect', 'output-connect', 'envelope', 'start', 'stop'])(
        '%s failure retires all acquired nodes without throwing into gameplay', boundary => {
            const f = fixture();
            try {
                const fail = () => { throw Error('SYNTHETIC_NODE_FAILURE'); };
                if (boundary === 'oscillator') f.context.createOscillator.mockImplementationOnce(fail);
                if (boundary === 'gain') f.context.createGain.mockImplementationOnce(fail);
                const createSource = f.context.createOscillator.getMockImplementation();
                if (['source-connect', 'start', 'stop'].includes(boundary)) {
                    f.context.createOscillator.mockImplementation(() => {
                        const node = createSource();
                        node[boundary === 'source-connect' ? 'connect' : boundary].mockImplementationOnce(fail); return node;
                    });
                }
                const createGain = f.context.createGain.getMockImplementation();
                if (['output-connect', 'envelope'].includes(boundary)) {
                    f.context.createGain.mockImplementation(() => {
                        const node = createGain();
                        if (boundary === 'output-connect') node.connect.mockImplementationOnce(fail);
                        else node.gain.linearRampToValueAtTime.mockImplementationOnce(fail);
                        return node;
                    });
                }
                expect(() => f.manager.playSound('synthetic')).not.toThrow();
                expect(f.manager.soundEffects.size).toBe(0);
                f.oscillators().forEach(node => expect(node.disconnect).toHaveBeenCalledTimes(1));
                f.gains().forEach(node => expect(node.disconnect).toHaveBeenCalledTimes(1));
            } finally { f.close(); }
        }
    );

    test('an old ended callback cannot disconnect later notes', () => {
        const f = fixture();
        try {
            f.manager.playSound('synthetic'); const old = f.oscillators()[0].onended;
            f.manager.toggleMute(); f.manager.toggleMute(); f.manager.playSound('synthetic');
            old(); old();
            f.oscillators().slice(2).forEach(node => expect(node.disconnect).not.toHaveBeenCalled());
            expect(f.manager.soundEffects.size).toBe(1);
        } finally { f.close(); }
    });

    test('one hundred ordinary sequences release their groups and outputs on end', () => {
        const f = fixture();
        try {
            for (let count = 0; count < 100; count++) {
                f.manager.playSound('synthetic');
                f.oscillators().slice(-2).forEach(node => node.onended());
                expect(f.manager.soundEffects.size).toBe(0);
            }
            f.oscillators().forEach(node => { expect(node.disconnect).toHaveBeenCalledTimes(1); expect(node.onended).toBeNull(); });
            f.gains().forEach(node => expect(node.disconnect).toHaveBeenCalledTimes(1));
            expect(f.manager.soundsGenerated).toBe(1);
        } finally { f.close(); }
    });

    test('all actual registered sound recipes still schedule their original tones', () => {
        const f = fixture();
        try {
            f.manager.soundRegistry.clear();
            f.manager.generateCommonSounds();
            const definitions = new Map([...f.manager.soundRegistry, ...f.manager.generatedSounds]);
            expect(definitions.size).toBeGreaterThan(6);
            for (const [name, tones] of definitions) {
                const start = f.context.createOscillator.mock.calls.length;
                f.manager.playSound(name);
                const created = f.oscillators().slice(start);
                expect(created).toHaveLength(tones.length);
                created.forEach((node, index) => { expect(node.frequency.value).toBe(tones[index].frequency); node.onended(); });
                expect(f.manager.soundEffects.size).toBe(0);
            }
        } finally { f.close(); }
    });

    test('effect cleanup does not stop the separate soundtrack nodes', () => {
        const f = fixture();
        try {
            f.manager.initMusicSystem(); const music = { stop: jest.fn(), disconnect: jest.fn() };
            f.manager.musicNodes.oscillators.push(music);
            f.manager.musicNodes.gainNode = f.context.createGain(); f.manager.musicPlaying = true;
            f.manager.playSound('synthetic'); f.manager.cancelSoundEffects();
            expect(music.stop).not.toHaveBeenCalled(); expect(music.disconnect).not.toHaveBeenCalled();
            expect(f.manager.musicPlaying).toBe(true);
        } finally { f.close(); }
    });
});
