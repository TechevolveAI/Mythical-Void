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

    test('explains the game clearly while weak media remains withdrawn', () => {
        expect(page).toContain('Crash. Hatch. Restore. Choose.');
        expect(page).toContain('previous gameplay media pack is withdrawn');
        expect(page).toContain('creature stays visible');
        expect(page.match(/href="\/play\/"/g).length).toBeGreaterThanOrEqual(3);
        expect(page).not.toMatch(/[?&](?:utm_|fbclid|gclid)/i);
        expect(page).not.toContain('/press/gameplay-video/');
        expect(page).not.toContain('/press/gameplay/');
        expect(page).not.toContain('/press/gameplay/creature-cosmic-egg-reveal.png');
    });

    test('keeps public language and claims inside the studio rules', () => {
        expect(page).not.toMatch(/\bcompanions?\b/i);
        expect(page).not.toMatch(/no two creatures|every creature is unique|infinite unique/i);
        expect(page).toContain('NASA does not endorse Mythical Void.');
        expect(page).toContain('AI-generated marketing artwork');
        expect(page).toContain('not gameplay');
    });

    test('lets a visitor pass on one clean game link without contact collection', () => {
        const discovery = fs.readFileSync(path.join(root, 'public/discovery.js'), 'utf8');
        expect(page).toContain('data-share-game');
        expect(page).toContain('data-copy-game');
        expect(page).toContain('never asks for their contact details');
        expect(discovery).toContain('navigator.share(shareData)');
        expect(discovery).toContain('navigator.clipboard.writeText(shareUrl)');
        expect(discovery).toContain("https://mythicalvoid.com/playable-now/");
        expect(`${page} ${discovery}`).not.toMatch(/[?&](?:utm_|fbclid|gclid)/i);
    });

    test('is checked during every production build', () => {
        const scripts = require('../../package.json').scripts;
        expect(scripts.build).toContain('validate:playable-now');
        expect(scripts.build).toContain('validate:public-visual-trust');
        expect(scripts.build).toContain('validate:owned-sharing');
        expect(scripts.build).toContain('validate:social-previews');
        expect(scripts['validate:playable-now']).toContain('validate-playable-now-discovery.cjs');
    });
});
