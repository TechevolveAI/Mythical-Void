const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parse } = require('@babel/parser');
const source = fs.readFileSync(path.join(__dirname, '../systems/AudioManager.js'), 'utf8');
const declaration = parse(source, { sourceType: 'module' }).program.body
    .find(node => node.type === 'ClassDeclaration' && node.id.name === 'AudioManager');

function fixture() {
    const document = { hidden: false, visibilityState: 'visible', addEventListener: jest.fn(), removeEventListener: jest.fn() };
    const timers = [];
    const Manager = vm.runInNewContext(`(${source.slice(declaration.start, declaration.end)})`, {
        document, window: { addEventListener: jest.fn() },
        console: { log() {}, warn() {} }, setTimeout: callback => timers.push(callback), clearInterval: jest.fn()
    });
    const manager = new Manager();
    manager.initialized = true;
    const context = { state: 'running', currentTime: 0, destination: {}, suspend: jest.fn(async () => { context.state = 'suspended'; }),
        resume: jest.fn(async () => { context.state = 'running'; }) };
    context.createGain = () => ({ gain: { value: 0, linearRampToValueAtTime: jest.fn() }, connect: jest.fn(), disconnect: jest.fn() });
    manager.audioContext = context;
    manager.createMusicLayer = jest.fn();
    return { manager, context, document, timers };
}

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
