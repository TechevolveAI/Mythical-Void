const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const publicAndPreparedCopy = [
    'README.md',
    'src/site/storefront.js',
    'public/playable-now/index.html',
    'public/studio/index.html',
    'public/creature-field-guide/index.html',
    'public/press/mythical-void-fact-sheet.txt',
    'public/press/social-video/authentic-gameplay-caption-pack.json',
    'scripts/company/father-son-story-social-card.html',
    'docs/company/content/channel-launch/FOUNDING_SIGNAL_LAUNCH_PACK.md',
    'docs/company/content/channel-launch/FOUNDING_SIGNAL_LAUNCH_PACK.json',
    'docs/company/content/channel-launch/STEM_CREATURE_LAB_LAUNCH_PACK.md',
    'docs/company/content/channel-launch/STEM_CREATURE_LAB_LAUNCH_PACK.json',
    'docs/company/content/channel-launch/CHANNEL_OPENING_KIT_2026-08-27.md',
    'docs/company/content/channel-launch/CHANNEL_OPENING_KIT_2026-08-27.json',
    'docs/company/content/campaigns/playable-now-launch.json'
];

describe('public founder-story privacy', () => {
    test.each(publicAndPreparedCopy)('%s does not publish the child’s exact age', relative => {
        const source = fs.readFileSync(path.join(root, relative), 'utf8');
        expect(source).not.toMatch(/\b(?:nine|9)[ -]year[ -]old\b/i);
    });

    test('keeps the true father-and-son beginning', () => {
        const storefront = fs.readFileSync(path.join(root, 'src/site/storefront.js'), 'utf8');
        const studio = fs.readFileSync(path.join(root, 'public/studio/index.html'), 'utf8');

        expect(storefront).toMatch(/father-and-son project/i);
        expect(storefront).toMatch(/Kevin and his son/i);
        expect(studio).toMatch(/A dad\. His son\./i);
        expect(studio).toMatch(/father and son/i);
    });

    test('does not put retired signal wording back into the prepared founder post', () => {
        const founderPost = fs.readFileSync(
            path.join(root, 'docs/company/content/channel-launch/FOUNDING_SIGNAL_LAUNCH_PACK.md'),
            'utf8'
        );

        expect(founderPost).not.toMatch(/\bsignal\b/i);
        expect(founderPost).toContain('pass it on');
    });
});
