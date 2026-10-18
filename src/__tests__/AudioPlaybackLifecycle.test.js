const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parse } = require('@babel/parser');
const source = fs.readFileSync(path.join(__dirname, '../systems/AudioManager.js'), 'utf8');
const declaration = parse(source, { sourceType: 'module' }).program.body
    .find(node => node.type === 'ClassDeclaration' && node.id.name === 'AudioManager');

function fixture() {
    const document = new EventTarget();
    document.hidden = false; document.visibilityState = 'visible';
    jest.spyOn(document, 'addEventListener'); jest.spyOn(document, 'removeEventListener');
    const timers = [];
    const Manager = vm.runInNewContext(`(${source.slice(declaration.start, declaration.end)})`, {
        document, window: { addEventListener: jest.fn(), removeEventListener: jest.fn() },
        console: { log() {}, warn() {} }, setTimeout: callback => timers.push(callback), clearInterval: jest.fn()
    });
    const manager = new Manager();
    manager.initialized = true;
    const context = { state: 'running', currentTime: 0, destination: {}, suspend: jest.fn(async () => { context.state = 'suspended'; }),
        resume: jest.fn(async () => { context.state = 'running'; }), close: jest.fn() };
    context.createGain = () => ({ gain: { value: 0, linearRampToValueAtTime: jest.fn() }, connect: jest.fn(), disconnect: jest.fn() });
    manager.audioContext = context;
    manager.createMusicLayer = jest.fn();
    return { manager, context, document, timers };
}

function heldResume(context) {
    context.state = 'suspended';
    let resolve, reject;
    const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
    context.resume.mockImplementationOnce(() => promise);
    return { succeed() { context.state = 'running'; resolve(); },
        fail() { reject(Error('SYNTHETIC_RESUME_FAILURE')); } };
}

describe('audio recovery belongs to the binding that requested it', () => {
    test('an old recovery cannot unlock a replacement Phaser sound manager', async () => {
        const f = fixture();
        try {
            f.manager.attachPhaserSound({ context: { state: 'running' }, locked: true, setMute: jest.fn() });
            const old = heldResume(f.context), pending = f.manager.resume();
            const replacement = { context: { state: 'running' }, locked: true, setMute: jest.fn() };
            f.manager.attachPhaserSound(replacement); old.succeed();
            expect(await pending).toBe(false); expect(replacement.unlocked).not.toBe(true);
        } finally { f.manager.destroy(); }
    });

    test('an old recovery cannot create music in a replacement procedural context', async () => {
        const f = fixture();
        try {
            const old = heldResume(f.context), pending = f.manager.resume();
            f.manager.audioContext = { ...f.context, state: 'running' };
            f.manager.requestedArea = 'gathering'; old.succeed();
            expect(await pending).toBe(false); expect(f.manager.createMusicLayer).not.toHaveBeenCalled();
            expect(f.manager.musicPlaying).not.toBe(true);
        } finally { f.manager.destroy(); }
    });

    test('suspension retires a pending recovery even after a visible return', async () => {
        const f = fixture();
        try {
            f.manager.requestedArea = 'home';
            const old = heldResume(f.context), pending = f.manager.resume();
            f.manager.suspendAudioContexts(); f.document.hidden = false; old.succeed();
            expect(await pending).toBe(false); expect(f.manager.createMusicLayer).not.toHaveBeenCalled();
            expect(f.manager.audioUnlocked).toBe(false);
        } finally { f.manager.destroy(); }
    });

    test('destroyed recovery cannot rearm input listeners', async () => {
        const f = fixture();
        try {
            const rearm = jest.spyOn(f.manager, 'rearmAudioAfterInterruption');
            const old = heldResume(f.context), pending = f.manager.resume();
            f.manager.destroy(); old.succeed();
            expect(await pending).toBe(false); expect(rearm).not.toHaveBeenCalled();
            expect(f.manager.audioUnlocked).toBe(false);
        } finally { f.manager.destroy(); }
    });

    test('detach and reattach cannot make an old recovery current again', async () => {
        const f = fixture();
        try {
            const first = { context: { state: 'running' }, locked: true, setMute: jest.fn() };
            f.manager.attachPhaserSound(first);
            const old = heldResume(f.context), pending = f.manager.resume();
            f.manager.attachPhaserSound(null); f.manager.attachPhaserSound(first); old.succeed();
            expect(await pending).toBe(false); expect(first.unlocked).not.toBe(true);
        } finally { f.manager.destroy(); }
    });

    test('in-place recorded-context replacement rejects the old recovery', async () => {
        const f = fixture();
        try {
            const sound = { context: { state: 'running' }, locked: true, setMute: jest.fn() };
            f.manager.attachPhaserSound(sound);
            const old = heldResume(f.context), pending = f.manager.resume();
            sound.context = { state: 'running' }; f.manager.attachPhaserSound(sound); old.succeed();
            expect(await pending).toBe(false); expect(sound.unlocked).not.toBe(true);
        } finally { f.manager.destroy(); }
    });

    test('reattaching the same sound/context preserves useful pending recovery', async () => {
        const f = fixture();
        try {
            const sound = { context: { state: 'running' }, locked: true, setMute: jest.fn() };
            f.manager.attachPhaserSound(sound);
            const current = heldResume(f.context), pending = f.manager.resume();
            f.manager.attachPhaserSound(sound); current.succeed();
            expect(await pending).toBe(true); expect(sound.unlocked).toBe(true);
        } finally { f.manager.destroy(); }
    });

    test('concurrent current-binding attempts remain useful and start music once', async () => {
        const f = fixture();
        try {
            const first = heldResume(f.context), second = heldResume(f.context);
            f.manager.requestedArea = 'home';
            const music = jest.spyOn(f.manager, 'playAreaMusic');
            const one = f.manager.resume(), two = f.manager.resume();
            second.succeed(); expect(await two).toBe(true);
            first.succeed(); expect(await one).toBe(true);
            expect(music).toHaveBeenCalledTimes(1); expect(f.manager.currentArea).toBe('home');
        } finally { f.manager.destroy(); }
    });

    test('a fresh recovery after suspension owns readiness; old completion cannot overwrite it', async () => {
        const f = fixture();
        try {
            const old = heldResume(f.context), retired = f.manager.resume();
            f.manager.suspendAudioContexts();
            const current = heldResume(f.context), active = f.manager.resume();
            current.succeed(); expect(await active).toBe(true);
            old.succeed(); expect(await retired).toBe(false);
            expect(f.manager.audioUnlocked).toBe(true);
        } finally { f.manager.destroy(); }
    });

    test('retired rejection cannot clear replacement readiness or rearm its listeners', async () => {
        const f = fixture();
        try {
            const rearm = jest.spyOn(f.manager, 'rearmAudioAfterInterruption');
            const old = heldResume(f.context), pending = f.manager.resume();
            f.manager.audioContext = { ...f.context, state: 'running' };
            f.manager.attachPhaserSound({ context: { state: 'running' }, setMute: jest.fn() });
            expect(f.manager.audioUnlocked).toBe(true); old.fail();
            expect(await pending).toBe(false); expect(f.manager.audioUnlocked).toBe(true);
            expect(rearm).not.toHaveBeenCalled();
        } finally { f.manager.destroy(); }
    });
});

test('a fading previous area cannot disconnect the newly selected soundtrack', () => {
    const { manager, timers } = fixture();
    manager.playAreaMusic('sanctuary');
    const old = manager.musicNodes;
    const oldGain = old.gainNode;
    const oldOscillator = { stop: jest.fn(), disconnect: jest.fn() };
    old.oscillators.push(oldOscillator);
    manager.stopMusic();
    manager.playAreaMusic('gathering');
    const next = manager.musicNodes;
    timers[0]();
    expect(oldOscillator.stop).toHaveBeenCalledTimes(1);
    expect(oldGain.disconnect).toHaveBeenCalledTimes(1);
    expect(next.gainNode.disconnect).not.toHaveBeenCalled();
    expect(manager.musicPlaying).toBe(true);
    expect(manager.currentArea).toBe('gathering');
});

test('unmuting starts the requested area but never resurrects a departed scene', () => {
    const { manager } = fixture();
    manager.muted = true;
    manager.playAreaMusic('sanctuary');
    expect(manager.musicPlaying).not.toBe(true);
    manager.toggleMute();
    expect(manager.currentArea).toBe('sanctuary');
    manager.toggleMute();
    manager.stopMusic(false);
    manager.toggleMute();
    expect(manager.musicPlaying).toBe(false);
    expect(manager.requestedArea).toBeNull();
});

test('recorded music subscribers receive mute and volume changes and can unsubscribe', () => {
    const { manager } = fixture();
    const changed = jest.fn();
    const unsubscribe = manager.onPreferencesChange(changed);
    manager.toggleMute();
    manager.setMusicVolume(0.3);
    manager.setMasterVolume(0.4);
    expect(changed).toHaveBeenCalledTimes(3);
    unsubscribe();
    manager.setMasterVolume(0.2);
    expect(changed).toHaveBeenCalledTimes(3);
});

test('backgrounding suspends procedural audio and sound requests cannot restart it', async () => {
    const { manager, context, document } = fixture();
    manager.setupAudioLifecycleRecovery();
    document.hidden = true;
    document.visibilityState = 'hidden';
    manager.audioVisibilityHandler();
    expect(context.suspend).toHaveBeenCalledTimes(1);
    manager.playSound('coin_collect');
    manager.playAreaMusic('sanctuary');
    expect(await manager.resume()).toBe(false);
    expect(context.resume).not.toHaveBeenCalled();
    document.hidden = false;
    document.visibilityState = 'visible';
    manager.audioVisibilityHandler();
    expect(context.resume).not.toHaveBeenCalled();
    manager.unlockHandler();
    await Promise.resolve();
    expect(context.resume).toHaveBeenCalledTimes(1);
});

test('a rejected mobile resume is contained and retriable, not an unhandled rejection', async () => {
    const { manager, context } = fixture();
    context.state = 'interrupted';
    context.resume.mockRejectedValue(new Error('User gesture required'));
    expect(await manager.resume()).toBe(false);
    expect(manager.audioUnlocked).toBe(false);
    expect(typeof manager.unlockHandler).toBe('function');
    manager.playSound('coin_collect');
    await Promise.resolve();
    await Promise.resolve();
});

test('music requested while hidden starts once after foreground gesture recovery', async () => {
    const { manager, context, document } = fixture();
    manager.setupMobileAudioUnlock();
    document.hidden = true;
    context.state = 'suspended';
    manager.playAreaMusic('sanctuary');
    expect(manager.musicPlaying).not.toBe(true);
    document.hidden = false;
    document.dispatchEvent(new Event('touchend'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(manager.musicPlaying).toBe(true);
    expect(manager.currentArea).toBe('sanctuary');
    const nodes = manager.musicNodes;
    await manager.resume();
    expect(manager.musicNodes).toBe(nodes);
});

test('a pending resume cannot restart music after leaving the scene or muting', async () => {
    const { manager, context, document } = fixture();
    document.hidden = true;
    manager.playAreaMusic('sanctuary');
    document.hidden = false;
    let resolve;
    context.state = 'suspended';
    context.resume.mockImplementation(() => new Promise(done => { resolve = done; }));
    const resuming = manager.resume();
    manager.stopMusic(false);
    context.state = 'running';
    resolve();
    await resuming;
    expect(manager.musicPlaying).not.toBe(true);
    manager.muted = true;
    manager.playAreaMusic('sanctuary');
    await manager.resume();
    expect(manager.musicPlaying).not.toBe(true);
});

test('muted gestures do not consume the later audio unlock', async () => {
    const { manager, context, document } = fixture();
    context.state = 'suspended'; manager.muted = true;
    manager.setupMobileAudioUnlock();
    document.dispatchEvent(new Event('touchend'));
    expect(context.resume).not.toHaveBeenCalled();
    manager.muted = false;
    document.dispatchEvent(new Event('touchend'));
    await Promise.resolve();
    expect(context.resume).toHaveBeenCalledTimes(1);
});

test('a resolved but still interrupted context retries on the next gesture', async () => {
    const { manager, context, document } = fixture();
    context.state = 'interrupted';
    context.resume.mockImplementationOnce(async () => {});
    manager.setupMobileAudioUnlock();
    document.dispatchEvent(new Event('touchend'));
    await Promise.resolve(); await Promise.resolve();
    expect(manager.audioUnlocked).toBe(false);
    document.dispatchEvent(new Event('touchend'));
    await Promise.resolve(); await Promise.resolve();
    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(context.state).toBe('running');
});

test('recorded Phaser music and procedural sound both resume in the same gesture', async () => {
    const { manager, context, document } = fixture();
    const recorded = { state: 'suspended', resume: jest.fn(async () => { recorded.state = 'running'; }), suspend: jest.fn() };
    const sound = { context: recorded, locked: true, setMute: jest.fn() };
    manager.attachPhaserSound?.(sound);
    manager.setupMobileAudioUnlock();
    document.dispatchEvent(new Event('touchend'));
    expect(recorded.resume).toHaveBeenCalledTimes(1);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(context.state).toBe('running');
    expect(sound.unlocked).toBe(true);
    manager.toggleMute();
    expect(sound.setMute).toHaveBeenLastCalledWith(true);
});

test('backgrounding suspends both contexts; return waits for interaction and destroy removes recovery', async () => {
    const { manager, context, document } = fixture();
    const recorded = { state: 'running', resume: jest.fn(async () => { recorded.state = 'running'; }),
        suspend: jest.fn(async () => { recorded.state = 'suspended'; }) };
    manager.attachPhaserSound?.({ context: recorded, setMute: jest.fn() });
    manager.setupMobileAudioUnlock(); manager.setupAudioLifecycleRecovery();
    document.hidden = true; document.visibilityState = 'hidden';
    manager.audioVisibilityHandler();
    expect(recorded.suspend).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new Event('touchend'));
    expect(recorded.resume).not.toHaveBeenCalled();
    document.hidden = false; document.visibilityState = 'visible';
    manager.audioVisibilityHandler();
    expect(recorded.resume).not.toHaveBeenCalled();
    document.dispatchEvent(new Event('touchend'));
    await Promise.resolve(); await Promise.resolve();
    expect(recorded.resume).toHaveBeenCalledTimes(1);
    manager.destroy();
    context.resume.mockClear(); recorded.resume.mockClear();
    document.dispatchEvent(new Event('touchend'));
    expect(context.resume).not.toHaveBeenCalled();
    expect(recorded.resume).not.toHaveBeenCalled();
});
