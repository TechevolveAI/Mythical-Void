const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildContinuityPackage, routeCopies } = require('../company/build-hosting-continuity-package.cjs');
const { validateContinuityPackage } = require('../company/validate-hosting-continuity-package.cjs');

const projectRoot = path.resolve(__dirname, '../..');

function makeFixture() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-continuity-'));
    fs.mkdirSync(path.join(directory, 'updates'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'index.html'), '<html data-hosting-continuity="static"><body>Mythical Void</body></html>');
    fs.writeFileSync(path.join(directory, 'sitemap.xml'), '<urlset></urlset>');
    fs.writeFileSync(path.join(directory, 'robots.txt'), 'User-agent: *');
    fs.writeFileSync(path.join(directory, 'updates/feed.xml'), '<rss></rss>');
    fs.writeFileSync(path.join(directory, 'updates/feed.json'), '{}');
    return directory;
}

describe('hosting continuity package', () => {
    let directory;

    afterEach(() => {
        if (directory) fs.rmSync(directory, { recursive: true, force: true });
    });

    test('builds honest physical routes and a provider-neutral fallback', () => {
        directory = makeFixture();
        const manifest = buildContinuityPackage(directory);
        expect(manifest.externalActionTaken).toBe(false);
        expect(manifest.deploymentAuthorized).toBe(false);
        expect(manifest.capabilities.livePresence).toBe('unavailable');
        routeCopies.forEach(route => {
            expect(fs.existsSync(path.join(directory, route, 'index.html'))).toBe(true);
        });
        expect(fs.readFileSync(path.join(directory, '_redirects'), 'utf8')).not.toContain('/.netlify/functions/:splat');
        expect(validateContinuityPackage(directory)).toMatchObject({ ready: true, failures: [] });
    });

    test('rejects analytics or an invented live-service claim', () => {
        directory = makeFixture();
        buildContinuityPackage(directory);
        fs.writeFileSync(path.join(directory, 'index.html'), '<html data-hosting-continuity="static">googletagmanager.com</html>');
        const manifestPath = path.join(directory, 'hosting-continuity.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        manifest.capabilities.livePresence = 'available';
        fs.writeFileSync(manifestPath, JSON.stringify(manifest));
        const result = validateContinuityPackage(directory);
        expect(result.ready).toBe(false);
        expect(result.failures).toEqual(expect.arrayContaining([
            'Website analytics must be disabled in the emergency copy.',
            'Live presence must not be claimed in static continuity mode.'
        ]));
    });

    test('rejects missing public discovery and player routes', () => {
        directory = makeFixture();
        buildContinuityPackage(directory);
        fs.rmSync(path.join(directory, 'play'), { recursive: true, force: true });
        fs.rmSync(path.join(directory, 'updates/feed.xml'));
        const result = validateContinuityPackage(directory);
        expect(result.ready).toBe(false);
        expect(result.failures).toEqual(expect.arrayContaining([
            'Missing required continuity file: play/index.html',
            'Missing required continuity file: updates/feed.xml'
        ]));
    });

    test('rejects withdrawn visual media in a portable package', () => {
        directory = makeFixture();
        buildContinuityPackage(directory);
        const withdrawn = path.join(directory, 'press/gameplay');
        fs.mkdirSync(withdrawn, { recursive: true });
        fs.writeFileSync(path.join(withdrawn, 'unapproved.png'), 'not public');
        const result = validateContinuityPackage(directory);
        expect(result.ready).toBe(false);
        expect(result.failures).toContain('Withdrawn public media remains in continuity package: press/gameplay');
    });

    test('source disables optional live and NASA requests in continuity mode', () => {
        const main = fs.readFileSync(path.join(projectRoot, 'src/main.js'), 'utf8');
        const presence = fs.readFileSync(path.join(projectRoot, 'src/site/live-presence.js'), 'utf8');
        const nasa = fs.readFileSync(path.join(projectRoot, 'src/systems/NASAContentSystem.js'), 'utf8');
        const smoke = fs.readFileSync(path.join(projectRoot, 'scripts/smoke-secondary-journeys.js'), 'utf8');
        expect(main).toContain('!isStaticContinuityBuild');
        expect(presence).toContain('if (STATIC_CONTINUITY_BUILD) return false;');
        expect(nasa).toContain('if (STATIC_CONTINUITY_BUILD) return null;');
        expect(smoke).toContain("document.documentElement.dataset.hostingContinuity === 'static'");
        expect(smoke).toContain("visible.deliveryUrl.startsWith('data:image/svg+xml')");
    });
});
