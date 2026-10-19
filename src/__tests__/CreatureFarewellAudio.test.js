const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const audioSource = read('systems/AudioManager.js');
const audioClass = parse(audioSource, { sourceType: 'module' }).program.body
    .find(node => node.type === 'ClassDeclaration' && node.id.name === 'AudioManager');
const profileSource = read('scenes/CreatureProfileScene.js');
const profileClass = parse(profileSource, { sourceType: 'module' }).program.body
    .find(node => node.type === 'ExportDefaultDeclaration').declaration;

// Actual manager and profile methods with fictional nodes/services only.
// No AudioContext, Phaser Scene, browser, record or audio device is constructed.
function fixture() {
    const document = new EventTarget(); document.hidden = false;
    const window = new EventTarget();
    const Manager = vm.runInNewContext(`(${audioSource.slice(audioClass.start, audioClass.end)})`, {
        window, document, console: { log() {}, warn() {} }, clearTimeout() {}, clearInterval() {}
    });
    const param = () => ({ value: 0, setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() });
    const sources = [], gains = [];
    const context = { state: 'running', currentTime: 10, destination: {},
        resume: jest.fn(async () => { context.state = 'running'; }),
        suspend: jest.fn(async () => { context.state = 'suspended'; }),
        close: jest.fn(async () => { context.state = 'closed'; }),
        createOscillator: jest.fn(() => {
            const source = { frequency: param(), type: null, onended: null,
                connect: jest.fn(), disconnect: jest.fn(), start: jest.fn(), stop: jest.fn() };
            sources.push(source); return source;
        }),
        createGain: jest.fn(() => {
            const gain = { gain: param(), connect: jest.fn(), disconnect: jest.fn() };
            gains.push(gain); return gain;
        }) };
    const manager = new Manager(); manager.initialized = true; manager.audioContext = context;
    manager.registerSound('synthetic-control', [{ frequency: 600, duration: 0.2, volume: 0.2 }]);
    window.AudioManager = manager;
    const profile = { elements: [], profilePortraitRequest: 0,
        destroyCompanionFieldMemoryReplay: jest.fn() };
    for (const name of ['playSadFarewellSound', 'init', 'shutdown']) {
        const node = profileClass.body.body.find(node => node.key.name === name);
        profile[name] = new Function('window', 'console',
            `return ({${profileSource.slice(node.start, node.end)}}).${name};`)(window, { log() {} });
    }
    return { manager, profile, window, document, context, sources, gains,
        close() { profile.shutdown(); manager.destroy(); } };
}

describe('profile farewell uses the ordinary owned audio path', () => {
    test.each(['muted', 'hidden', 'master-zero', 'sfx-zero'])(
        '%s refuses farewell tones before acquiring native nodes', boundary => {
            const f = fixture();
            try {
                if (boundary === 'muted') f.manager.muted = true;
                if (boundary === 'hidden') f.document.hidden = true;
                if (boundary === 'master-zero') f.manager.masterVolume = 0;
                if (boundary === 'sfx-zero') f.manager.sfxVolume = 0;
                f.profile.playSadFarewellSound();
                expect(f.context.createOscillator).not.toHaveBeenCalled();
                expect(f.context.createGain).not.toHaveBeenCalled();
            } finally { f.close(); }
        }
    );

    test.each(['suspended', 'interrupted', 'closed'])(
        '%s cannot queue farewell tones for a later clock recovery', async state => {
            const f = fixture();
            try {
                f.context.state = state; f.profile.playSadFarewellSound();
                await Promise.resolve(); await Promise.resolve();
                expect(f.context.createOscillator).not.toHaveBeenCalled();
            } finally { f.close(); }
        }
    );

    test.each(['shutdown', 'init'])('%s stops only the profile-owned farewell', method => {
        const f = fixture();
        try {
            f.manager.playSound('synthetic-control'); const control = f.sources[0];
            f.profile.playSadFarewellSound(); f.profile[method]();
            for (const source of f.sources.slice(1)) {
                expect(source.disconnect).toHaveBeenCalledTimes(1);
                expect(source.stop).toHaveBeenLastCalledWith();
            }
            expect(control.disconnect).not.toHaveBeenCalled();
            expect(control.stop).toHaveBeenCalledTimes(1);
            expect(control.stop).toHaveBeenCalledWith(10.2);
            expect(f.manager.soundEffects.size).toBe(1);
        } finally { f.close(); }
    });

    test('replacing a farewell retires its notes; an old stop cannot stop the replacement', () => {
        const f = fixture();
        try {
            f.profile.playSadFarewellSound(); const stop = f.profile.farewellSoundStop;
            const first = [...f.sources]; f.profile.playSadFarewellSound();
            first.forEach(source => expect(source.disconnect).toHaveBeenCalledTimes(1));
            stop?.();
            f.sources.slice(first.length).forEach(source => expect(source.disconnect).not.toHaveBeenCalled());
            expect(f.manager.soundEffects.size).toBe(1);
        } finally { f.close(); }
    });

    test.each(['mute', 'background'])('%s cancels scheduled farewell notes through shared ownership', boundary => {
        const f = fixture();
        try {
            f.profile.playSadFarewellSound();
            if (boundary === 'mute') f.manager.toggleMute();
            else f.manager.suspendAudioContexts();
            f.sources.forEach(source => {
                expect(source.disconnect).toHaveBeenCalledTimes(1);
                expect(source.stop).toHaveBeenLastCalledWith();
            });
            expect(f.manager.soundEffects.size).toBe(0);
        } finally { f.close(); }
    });

    test('the five existing notes retain their absolute offsets, attack, lengths and silent tail', () => {
        const f = fixture();
        try {
            f.profile.playSadFarewellSound();
            expect(f.sources).toHaveLength(5);
            const notes = [[440, 0, 0.8], [392, 0.9, 0.8], [349, 1.8, 0.8], [330, 2.7, 1.2], [294, 4, 1.5]];
            notes.forEach(([frequency, at, duration], index) => {
                const source = f.sources[index], gain = f.gains[index].gain;
                expect(source.frequency.value).toBe(frequency); expect(source.type).toBe('sine');
                expect(source.start).toHaveBeenCalledWith(10 + at);
                expect(source.stop.mock.calls[0][0]).toBeCloseTo(10 + at + duration + 0.1);
                expect(gain.setValueAtTime).toHaveBeenCalledWith(0, 10 + at);
                expect(gain.linearRampToValueAtTime.mock.calls[0][1]).toBeCloseTo(10 + at + 0.1);
                expect(gain.linearRampToValueAtTime.mock.calls[1][1]).toBeCloseTo(10 + at + duration);
            });
        } finally { f.close(); }
    });

    test('farewell volume honours both existing master and effects settings', () => {
        const f = fixture();
        try {
            f.manager.masterVolume = 0.4; f.manager.sfxVolume = 0.3;
            f.profile.playSadFarewellSound();
            f.gains.forEach(gain => expect(gain.gain.linearRampToValueAtTime.mock.calls[0][0])
                .toBeCloseTo(0.15 * 0.4 * 0.3));
        } finally { f.close(); }
    });

    test('partial native setup failure cannot escape into the release presentation', () => {
        const f = fixture();
        try {
            const create = f.context.createGain.getMockImplementation(); let calls = 0;
            f.context.createGain.mockImplementation(() => {
                if (++calls === 2) throw Error('SYNTHETIC_GAIN_FAILURE');
                return create();
            });
            expect(() => f.profile.playSadFarewellSound()).not.toThrow();
            f.sources.forEach(source => expect(source.disconnect).toHaveBeenCalledTimes(1));
            expect(f.manager.soundEffects.size).toBe(0);
        } finally { f.close(); }
    });

    test('an unavailable optional audio service leaves the presentation silent', () => {
        const f = fixture();
        try {
            f.window.AudioManager = {};
            expect(() => f.profile.playSadFarewellSound()).not.toThrow();
            expect(f.context.createOscillator).not.toHaveBeenCalled();
        } finally { f.close(); }
    });
});
