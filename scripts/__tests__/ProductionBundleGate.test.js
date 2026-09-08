const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    inspectProductionBundle,
    verifyProductionBundle
} = require('../verify-production-bundle.cjs');

const rootDir = path.resolve(__dirname, '../..');

function createFixture(files) {
    const distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-bundle-'));
    const assetsDir = path.join(distDir, 'assets');
    fs.mkdirSync(assetsDir);
    Object.entries(files).forEach(([fileName, source]) => {
        fs.writeFileSync(path.join(assetsDir, fileName), source);
    });
    const playDir = path.join(distDir, 'play');
    fs.mkdirSync(playDir);
    fs.writeFileSync(
        path.join(playDir, 'index.html'),
        '<meta name="mythical-entry" content="direct-play">' +
        '<link rel="canonical" href="https://mythicalvoid.com/play/">' +
        '<meta property="og:url" content="https://mythicalvoid.com/play/">' +
        '<meta property="og:image" content="https://mythicalvoid.com/marketing/mythical-void-brand-link-card-v1.png">' +
        '<meta property="og:image:alt" content="Mythical Void brand art, not gameplay">'
    );
    return distDir;
}

describe('production bundle logging gate', () => {
    test('production builds strip non-actionable logs without stripping warnings or errors', () => {
        const config = fs.readFileSync(
            path.join(rootDir, 'vite.config.mjs'),
            'utf8'
        );

        expect(config).toContain("command === 'build'");
        expect(config).toContain(
            "pure: ['console.log', 'console.info', 'console.debug']"
        );
        expect(config).not.toMatch(/pure:\s*\[[^\]]*console\.(?:warn|error)/);
    });

    test('accepts clean application chunks and ignores third-party vendor logging', () => {
        const distDir = createFixture({
            'game-clean.js': 'console.warn("recoverable");console.error("fatal");',
            'vendor-library.js': 'console.log("third-party diagnostic");'
        });

        expect(verifyProductionBundle(distDir)).toEqual({
            applicationChunkCount: 1,
            removableConsoleCallCount: 0,
            directPlayEntryPresent: true,
            directPlayMetadataValid: true,
            failures: []
        });
    });

    test('rejects a build whose direct game URL identifies itself as the homepage', () => {
        const distDir = createFixture({ 'game-clean.js': 'console.warn("recoverable");' });
        fs.writeFileSync(
            path.join(distDir, 'play', 'index.html'),
            '<link rel="canonical" href="https://mythicalvoid.com/">' +
            '<meta property="og:url" content="https://mythicalvoid.com/">'
        );

        expect(() => verifyProductionBundle(distDir)).toThrow(
            'Production direct Play metadata is missing or misleading'
        );
    });

    test.each([
        'console.log("noise")',
        'console.info("noise")',
        'console.debug("noise")'
    ])('rejects an application chunk containing %s', source => {
        const distDir = createFixture({ 'game-noisy.js': source });
        const result = inspectProductionBundle(distDir);

        expect(result.removableConsoleCallCount).toBe(1);
        expect(() => verifyProductionBundle(distDir)).toThrow(
            'Production bundle retained console.log/info/debug calls'
        );
    });
});
