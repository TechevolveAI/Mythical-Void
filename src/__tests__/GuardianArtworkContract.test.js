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

describe('first guardian artwork', () => {
    test('Elder Treant is a compact transparent WebP', () => {
        const assetPath = path.join(
            __dirname,
            '../../public/game/guardians/elder-treant.webp'
        );
        const metadata = readWebpMetadata(assetPath);

        expect(metadata.bytes.length).toBeGreaterThan(50_000);
        expect(metadata.bytes.length).toBeLessThan(200_000);
        expect(metadata.hasAlpha).toBe(true);
        expect(metadata.width).toBe(768);
        expect(metadata.height).toBe(768);
    });

    test('forest level preloads finished art with collision-safe scaling and fallback', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/levels/MythicalForestLevel.js'),
            'utf8'
        );

        expect(source).toContain("const ELDER_TREANT_ASSET = '/game/guardians/elder-treant.webp'");
        expect(source).toContain('this.load.image(ELDER_TREANT_TEXTURE, ELDER_TREANT_ASSET)');
        expect(source).toContain('this.createElderTreantTexture()');
        expect(source).toContain('if (this.textures.exists(textureKey)) return textureKey');
        expect(source).toContain('ELDER_TREANT_DISPLAY_HEIGHT /');
        expect(source).toContain('this.boss.width * 0.48');
        expect(source).toContain('this.boss.height * 0.68');
        expect(source).toContain('this.bossTargetScale * 1.08');
    });
});

describe('mid-campaign guardian artwork', () => {
    const assets = [
        'crystal-guardian.webp',
        'nyxvoral.webp'
    ];

    test.each(assets)('%s is a compact square WebP with transparency', (file) => {
        const assetPath = path.join(
            __dirname,
            '../../public/game/guardians',
            file
        );
        const metadata = readWebpMetadata(assetPath);

        expect(metadata.bytes.length).toBeGreaterThan(50_000);
        expect(metadata.bytes.length).toBeLessThan(180_000);
        expect(metadata.hasAlpha).toBe(true);
        expect(metadata.width).toBe(768);
        expect(metadata.height).toBe(768);
    });

    test('Crystal Caves prefers finished guardian art with a collision-safe fallback', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/levels/CrystalCavesLevel.js'),
            'utf8'
        );

        expect(source).toContain(
            "const CRYSTAL_GUARDIAN_ASSET = '/game/guardians/crystal-guardian.webp'"
        );
        expect(source).toContain(
            'this.load.image(CRYSTAL_GUARDIAN_TEXTURE, CRYSTAL_GUARDIAN_ASSET)'
        );
        expect(source).toContain('this.textures.exists(CRYSTAL_GUARDIAN_TEXTURE)');
        expect(source).toContain(': this.createCrystalGolemTexture()');
        expect(source).toContain('CRYSTAL_GUARDIAN_DISPLAY_HEIGHT / this.boss.height');
        expect(source).toContain('this.boss.width * 0.48');
        expect(source).toContain('this.boss.height * 0.68');
        expect(source).toContain(
            'CRYSTAL_GUARDIAN_MOBILE_DISPLAY_HEIGHT / this.boss.height'
        );
    });

    test('Stellar Reef keeps Nyx\'voral animated, phase-readable, and fallback-safe', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/levels/ReefLevel.js'),
            'utf8'
        );

        expect(source).toContain(
            "const NYXVORAL_ASSET = '/game/guardians/nyxvoral.webp'"
        );
        expect(source).toContain('this.load.image(NYXVORAL_TEXTURE, NYXVORAL_ASSET)');
        expect(source).toContain('this.textures.exists(NYXVORAL_TEXTURE)');
        expect(source).toContain('this.bossUsesArtwork = true');
        expect(source).toContain('this.drawNyxvoral(bossX, bossY, 1)');
        expect(source).toContain('this.boss.setPosition(this.bossBody.x, this.bossBody.y)');
        expect(source).toContain('this.boss.setTint(0xD88AB4)');
        expect(source).toContain('this.boss.setTint(0xD86478)');
        expect(source).toContain('this.bossTargetScale * 0.9');
    });
});
