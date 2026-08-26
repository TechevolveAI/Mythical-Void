const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const page = fs.readFileSync(path.join(root, 'public/playable-now/index.html'), 'utf8');
const release = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/generated/playable-now-discovery-release.json'), 'utf8'));

describe('Playable Now discovery page', () => {
    test('is bound to the reviewed owned-site release', () => {
        expect(crypto.createHash('sha256').update(page).digest('hex')).toBe(release.page.sha256);
        expect(release.authority.ownedWebsitePublicationAuthorized).toBe(true);
        expect(release.authority.externalSocialPublicationAuthorized).toBe(false);
        expect(release.authority.emailOrOutreachSendingAuthorized).toBe(false);
    });

    test('leads with genuine gameplay and clean play routes', () => {
        expect(page).toContain('/press/gameplay-video/mythical-forest-authentic-gameplay.mp4');
        expect(page).toContain('Recorded directly from the running browser game');
        expect(page.match(/href="\/play\/"/g).length).toBeGreaterThanOrEqual(3);
        expect(page).not.toMatch(/[?&](?:utm_|fbclid|gclid)/i);
    });

    test('keeps public language and claims inside the studio rules', () => {
        expect(page).not.toMatch(/\bcompanions?\b/i);
        expect(page).not.toMatch(/no two creatures|every creature is unique|infinite unique/i);
        expect(page).toContain('NASA does not endorse Mythical Void.');
        expect(page).toContain('AI-generated marketing illustration');
        expect(page).toContain('not gameplay');
    });

    test('is checked during every production build', () => {
        const scripts = require('../../package.json').scripts;
        expect(scripts.build).toContain('validate:playable-now');
        expect(scripts['validate:playable-now']).toContain('validate-playable-now-discovery.cjs');
    });
});
