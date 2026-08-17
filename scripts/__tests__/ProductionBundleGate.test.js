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
    return distDir;
}

describe('production bundle logging gate', () => {
    test('production builds strip non-actionable logs without stripping warnings or errors', () => {
        const config = fs.readFileSync(
            path.join(rootDir, 'vite.config.js'),
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
            failures: []
        });
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
