const fs = require('fs');
const path = require('path');
const { buildJsonFeed, buildRssFeed } = require('../../scripts/company/build-signal-feeds.cjs');

const root = path.resolve(__dirname, '../..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'public/updates/releases.json'), 'utf8'));

describe('public Signal feeds', () => {
    test('are rebuilt exactly from the checked Signal Log source', () => {
        expect(fs.readFileSync(path.join(root, 'public/updates/feed.xml'), 'utf8')).toBe(buildRssFeed(source));
        expect(fs.readFileSync(path.join(root, 'public/updates/feed.json'), 'utf8')).toBe(buildJsonFeed(source));
    });

    test('contain every checked live release and only owned clean links', () => {
        const feed = JSON.parse(buildJsonFeed(source));
        expect(feed.items).toHaveLength(source.entries.filter(entry => entry.status === 'live').length);
        for (const item of feed.items) {
            expect(item.external_url).toMatch(/^https:\/\/mythicalvoid\.com\//);
            expect(item.external_url).not.toMatch(/[?&](?:utm_|fbclid|gclid)/i);
            expect(item.content_text).toMatch(/(?:Media note:|Visual note: the earlier media was withheld after human review)/);
        }
    });

    test('ships as part of every production build', () => {
        const packageJson = require('../../package.json');
        expect(packageJson.scripts.build).toContain('build:signal-log');
        expect(packageJson.scripts.build).toContain('validate:signal-feeds');
        expect(packageJson.scripts['build:signal-log']).toContain('build-signal-feeds.cjs');
    });
});
