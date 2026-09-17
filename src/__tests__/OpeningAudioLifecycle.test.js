const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parse } = require('@babel/parser');

const source = fs.readFileSync(path.join(__dirname, '../scenes/HatchingScene.js'), 'utf8');
const declaration = parse(source, { sourceType: 'module' }).program.body
    .find(node => node.type === 'ClassDeclaration' && node.id.name === 'HatchingScene');
function method(name, context) {
    const node = declaration.body.body.find(member => member.key?.name === name);
    return vm.runInNewContext(`({${source.slice(node.start, node.end)}}).${name}`, context);
}

describe('opening soundtrack lifecycle', () => {
    let scene, audio, music, cacheReady, callbacks;
    beforeEach(() => {
        cacheReady = false;
        callbacks = {};
        audio = { isMuted: jest.fn(() => false), getVolumes: () => ({ master: 0.5, music: 0.4 }),
            onPreferencesChange: jest.fn(() => jest.fn()) };
        music = { isPlaying: false, stop: jest.fn(), destroy: jest.fn(), setMute: jest.fn(), setVolume: jest.fn() };
        music.play = jest.fn(() => { music.isPlaying = true; });
        scene = {
            themeMusicWanted: false,
            sys: { isActive: () => true },
            cache: { audio: { exists: () => cacheReady } },
            load: { once: jest.fn((event, callback) => { callbacks[event] = callback; }), audio: jest.fn(), start: jest.fn() },
            sound: { add: jest.fn(() => music) },
            tweens: { add: jest.fn(), killTweensOf: jest.fn() }
        };
        for (const name of ['loadThemeMusicInBackground', 'startThemeMusic', 'getThemeMusicVolume', 'syncThemeMusicPreferences', 'stopThemeMusic']) {
            scene[name] = method(name, { window: { AudioManager: audio }, console: { log() {}, warn() {} } });
        }
    });

    test('a quick Start tap does not discard the late soundtrack during the egg opening', () => {
        scene.loadThemeMusicInBackground();
        scene.isStartingGame = true;
        cacheReady = true;
        callbacks['filecomplete-audio-themeMusic']();
        expect(music.play).toHaveBeenCalledTimes(1);
        expect(scene.tweens.add).toHaveBeenCalledWith(expect.objectContaining({ volume: 0.12 }));
        scene.startThemeMusic();
        expect(scene.sound.add).toHaveBeenCalledTimes(1);
    });

    test('an unmute after the file loads starts the theme and later preferences affect it', () => {
        cacheReady = true;
        audio.isMuted.mockReturnValue(true);
        scene.loadThemeMusicInBackground();
        expect(music.play).not.toHaveBeenCalled();
        audio.isMuted.mockReturnValue(false);
        const changed = audio.onPreferencesChange.mock.calls[0][0];
        changed();
        expect(music.play).toHaveBeenCalledTimes(1);
        audio.isMuted.mockReturnValue(true);
        changed();
        expect(music.setMute).toHaveBeenLastCalledWith(true);
        expect(music.setVolume).toHaveBeenLastCalledWith(0.12);
    });

    test('a late file cannot play after the hatch celebration has ended the intro', () => {
        scene.loadThemeMusicInBackground();
        scene.stopThemeMusic();
        cacheReady = true;
        callbacks['filecomplete-audio-themeMusic']();
        expect(music.play).not.toHaveBeenCalled();
    });

    test('shutdown destroys a paused theme without relying on a scene tween', () => {
        scene.themeMusic = music;
        scene.stopThemeMusic(true);
        expect(music.destroy).toHaveBeenCalledTimes(1);
        expect(scene.themeMusic).toBeNull();
        expect(scene.tweens.add).not.toHaveBeenCalled();
    });

    test('a retiring theme never clears the new theme reference', () => {
        scene.themeMusic = music;
        music.isPlaying = true;
        scene.stopThemeMusic();
        const replacement = {};
        scene.themeMusic = replacement;
        scene.tweens.add.mock.calls[0][0].onComplete();
        expect(music.destroy).toHaveBeenCalledTimes(1);
        expect(scene.themeMusic).toBe(replacement);
    });

    test('the intro ends at hatching, not at Start, and its shutdown is synchronous', () => {
        const body = name => source.slice(...['start', 'end'].map(key => declaration.body.body.find(m => m.key?.name === name)[key]));
        expect(body('handleStartGame')).not.toContain('stopThemeMusic');
        expect(body('completeHatching')).toContain('this.stopThemeMusic();');
        expect(body('showHatchingScreen')).toContain('if (!this.isEggHatch) this.loadThemeMusicInBackground();');
        expect(body('shutdown')).toContain('this.stopThemeMusic(true);');
        expect(body('shutdown')).toContain('this.themeMusicSettingsCleanup?.();');
    });
});
