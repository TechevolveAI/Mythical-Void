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
    test('home theme uses a browser-safe MP3 source', () => {
        const sceneSource = fs.readFileSync(
            path.join(__dirname, '../scenes/HatchingScene.js'),
            'utf8'
        );
        const mp3Path = path.join(__dirname, '../../public/audio/theme-music.mp3');
        const mp3 = fs.readFileSync(mp3Path);

        expect(sceneSource).toMatch(
            /this\.load\.audio\('themeMusic',\s*'\/audio\/theme-music\.mp3'\)/
        );
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
