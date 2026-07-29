const fs = require('fs');
const path = require('path');

function readWebpMetadata(assetPath) {
    const bytes = fs.readFileSync(assetPath);
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(bytes.subarray(8, 12).toString('ascii')).toBe('WEBP');

    const vp8xOffset = bytes.indexOf(Buffer.from('VP8X'));
    expect(vp8xOffset).toBeGreaterThanOrEqual(12);

    const dataOffset = vp8xOffset + 8;
    const flags = bytes[dataOffset];
    const readUint24 = (offset) => (
        bytes[offset] |
        (bytes[offset + 1] << 8) |
        (bytes[offset + 2] << 16)
    );

    return {
        bytes,
        hasAlpha: (flags & 0x10) === 0x10,
        width: readUint24(dataOffset + 4) + 1,
        height: readUint24(dataOffset + 7) + 1
    };
}

describe('late-game guardian artwork', () => {
    const guardians = [
        {
            file: 'shadow-phoenix.webp',
            scene: 'AuroraDepthsLevel.js',
            texture: 'shadowPhoenix',
            method: 'ensureShadowPhoenixTexture',
            cloneScale: 'this.bossTargetScale * 0.72'
        },
        {
            file: 'void-empress.webp',
            scene: 'FinalVoidLevel.js',
            texture: 'voidEmpress',
            method: 'ensureVoidEmpressTexture',
            cloneScale: 'this.bossTargetScale * 0.7'
        }
    ];

    test.each(guardians)('$file is a compact square WebP with transparency', ({ file }) => {
        const assetPath = path.join(
            __dirname,
            '../../public/game/guardians',
            file
        );
        const metadata = readWebpMetadata(assetPath);

        expect(metadata.bytes.length).toBeGreaterThan(50_000);
        expect(metadata.bytes.length).toBeLessThan(300_000);
        expect(metadata.hasAlpha).toBe(true);
        expect(metadata.width).toBe(768);
        expect(metadata.height).toBe(768);
    });

    test.each(guardians)(
        '$scene preloads production art and retains a size-independent fallback',
        ({ file, scene, texture, method, cloneScale }) => {
            const source = fs.readFileSync(
                path.join(__dirname, '../scenes/levels', scene),
                'utf8'
            );

            expect(source).toContain(
                `this.load.image(${texture === 'shadowPhoenix'
                    ? 'SHADOW_PHOENIX_TEXTURE, SHADOW_PHOENIX_ASSET'
                    : 'VOID_EMPRESS_TEXTURE, VOID_EMPRESS_ASSET'});`
            );
            expect(source).toContain(`/${file}'`);
            expect(source).toContain(`${method}()`);
            expect(source).toContain('Math.max(1, this.boss.');
            expect(source).toContain(cloneScale);
            expect(source).not.toMatch(/PLACEHOLDER|placeholder texture/);
        }
    );
});
