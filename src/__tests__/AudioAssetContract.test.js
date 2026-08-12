const fs = require('fs');
const path = require('path');

function readSynchsafeInteger(buffer, offset) {
    return (
        ((buffer[offset] & 0x7f) << 21) |
        ((buffer[offset + 1] & 0x7f) << 14) |
        ((buffer[offset + 2] & 0x7f) << 7) |
        (buffer[offset + 3] & 0x7f)
    );
}

describe('file-based audio assets', () => {
    test('home theme loads in the background with browser-safe fallbacks', () => {
        const sceneSource = fs.readFileSync(
            path.join(__dirname, '../scenes/HatchingScene.js'),
            'utf8'
        );
        const mp3Path = path.join(__dirname, '../../public/audio/theme-music.mp3');
        const oggPath = path.join(__dirname, '../../public/audio/theme-music.ogg');
        const mp3 = fs.readFileSync(mp3Path);
        const ogg = fs.readFileSync(oggPath);

        expect(sceneSource).toContain('loadThemeMusicInBackground()');
        expect(sceneSource).toMatch(
            /showHomeContent\(\)[\s\S]*this\.loadThemeMusicInBackground\(\)/
        );
        expect(sceneSource).toContain("'/audio/theme-music.ogg'");
        expect(sceneSource).toContain("'/audio/theme-music.mp3'");
        expect(sceneSource).toContain("'filecomplete-audio-themeMusic'");
        expect(sceneSource).toContain('if (!this.sys.isActive() || this.isStartingGame) return;');
        expect(sceneSource).toContain('if (this.themeMusic?.isPlaying) return;');
        expect(sceneSource).not.toMatch(
            /preload\(\)[\s\S]{0,200}this\.load\.audio\('themeMusic'/
        );
        expect(ogg.length).toBeGreaterThan(1_000_000);
        expect(ogg.subarray(0, 4).toString('ascii')).toBe('OggS');
        expect(sceneSource).not.toContain(
            "this.load.audio('themeMusic', 'audio/theme-music.mp3')"
        );
        expect(mp3.length).toBeGreaterThan(1_000_000);
        expect(mp3.subarray(0, 3).toString('ascii')).toBe('ID3');

        const metadataSize = readSynchsafeInteger(mp3, 6);
        const firstFrameOffset = 10 + metadataSize;
        const metadata = mp3
            .subarray(10, firstFrameOffset)
            .toString('latin1');

        expect(metadataSize).toBeLessThan(64 * 1024);
        expect(metadata).not.toContain('APIC');
        expect(metadata).not.toContain('PIC');
        expect(mp3[firstFrameOffset]).toBe(0xff);
        expect(mp3[firstFrameOffset + 1] & 0xe0).toBe(0xe0);
    });
});
