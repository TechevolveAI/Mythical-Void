const fs = require('fs');
const path = require('path');

describe('Project Beacon opening backdrop', () => {
    const sceneSource = fs.readFileSync(
        path.join(__dirname, '../scenes/HatchingScene.js'),
        'utf8'
    );
    const backdropPath = path.join(
        __dirname,
        '../../public/game/project-beacon-crash-site.webp'
    );
    const backdrop = fs.readFileSync(backdropPath);
    const backgroundStart = sceneSource.lastIndexOf(
        'createEnhancedBackground()'
    );
    const backgroundFunction = sceneSource.slice(
        backgroundStart,
        sceneSource.indexOf('createStardustParticles()', backgroundStart)
    );

    test('ships a compact square WebP game asset', () => {
        expect(backdrop.length).toBeGreaterThan(50_000);
        expect(backdrop.length).toBeLessThan(500_000);
        expect(backdrop.subarray(0, 4).toString('ascii')).toBe('RIFF');
        expect(backdrop.subarray(8, 12).toString('ascii')).toBe('WEBP');
    });

    test('loads the asset from the nested play route safely', () => {
        expect(sceneSource).toContain(
            "'/game/project-beacon-crash-site.webp'"
        );
        expect(sceneSource).toContain(
            "this.textures?.exists('projectBeaconCrashSite')"
        );
        expect(backgroundFunction).toContain(
            'const coverScale = Math.max('
        );
        expect(backgroundFunction).toContain(
            'this.projectBeaconBackgroundFallback = fallback'
        );
    });

    test('replaces the generic purple orb treatment', () => {
        expect(backgroundFunction).not.toContain('fillGradientStyle');
        expect(backgroundFunction).not.toContain('fillCircle');
        expect(backgroundFunction).not.toContain('0x9C27B0');
        expect(backgroundFunction).toContain('0x061116');
        expect(backgroundFunction).toContain('0x02080B');
    });
});
