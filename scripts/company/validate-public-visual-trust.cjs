#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { isWithdrawnPublicVisual, readVisualPublicationRegister } = require('./visual-publication-policy.cjs');

const root = path.resolve(__dirname, '../..');
const register = readVisualPublicationRegister();
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const storefront = read('src/site/storefront.js');
const storefrontCss = read('src/site/storefront.css');

const visiblePages = [
    'index.html',
    'public/playable-now/index.html',
    'public/story/index.html',
    'public/parents/index.html',
    'public/nasa-space-science/index.html',
    'public/educators/index.html',
    'public/creature-genetics/index.html',
    'public/creature-field-guide/index.html',
    'public/studio/index.html',
    'public/updates/index.html'
];

for (const relative of visiblePages) {
    const html = read(relative);
    for (const prefix of register.withdrawnPathFamilies) {
        requireValue(!html.includes(prefix), `${relative} republishes withdrawn path family ${prefix}`);
    }
    for (const publicPath of register.withdrawnIndividualPaths) {
        requireValue(!html.includes(publicPath), `${relative} republishes withdrawn asset ${publicPath}`);
    }
    requireValue(!/<video\b/i.test(html), `${relative} embeds video before replacement review`);
    requireValue(!/\bcompanions?\b/i.test(html), `${relative} uses retired companion wording`);
    if (html.includes('src="/marketing/mythical-void-creature-universe-hero-v2.webp"')) {
        requireValue(/AI-generated marketing art/i.test(html) && /not gameplay/i.test(html), `${relative} uses imagined-universe art without a visible boundary`);
    }
}

requireValue(storefront.includes('class="hero-mobile-window"'), 'homepage has no dedicated phone-size creature-universe view');
requireValue(storefront.includes('Artwork inspired by real creature hatches — not gameplay.'), 'phone-size creature-universe view lacks a visible not-gameplay boundary');
requireValue(/@media \(max-width: 620px\)[\s\S]*?\.hero-mobile-window\s*\{[\s\S]*?display:\s*block/.test(storefrontCss), 'phone-size creature-universe view is not exposed at the mobile breakpoint');

for (const relative of ['public/updates/feed.xml', 'public/updates/feed.json']) {
    const feed = read(relative);
    for (const prefix of register.withdrawnPathFamilies) requireValue(!feed.includes(prefix), `${relative} republishes withdrawn path family ${prefix}`);
    for (const publicPath of register.withdrawnIndividualPaths) requireValue(!feed.includes(publicPath), `${relative} republishes withdrawn asset ${publicPath}`);
}

const previews = JSON.parse(read('public/press/mythical-void-social-previews.json'));
for (const preview of previews.pages || []) {
    requireValue(!isWithdrawnPublicVisual(preview.imageUrl || preview.imagePath, register), `${preview.route} social preview uses withdrawn media`);
    requireValue(/not gameplay/i.test(preview.disclosure || ''), `${preview.route} social preview lacks a not-gameplay boundary`);
    requireValue(fs.existsSync(path.join(root, preview.imagePath)), `${preview.route} social preview file is missing`);
}

const founderStoryPack = JSON.parse(read('docs/company/content/generated/father-son-story-social-release.json'));
requireValue(founderStoryPack.state === 'withdrawn_visual_quality_failed_do_not_publish', 'old founder-story social pack is not withdrawn');
requireValue(founderStoryPack.identityBoundary?.childExactAgeUsed === false, 'old founder-story social pack permits the child exact age');
requireValue(!/(?:nine[- ]year[- ]old|nine years old|son was nine|\bage\s+9\b)/i.test(JSON.stringify(founderStoryPack)), 'old founder-story social pack exposes the child exact age');
requireValue((founderStoryPack.assets || []).every(asset => asset.state === 'withdrawn_visual_quality_failed_do_not_publish'), 'old founder-story artwork is not fully withdrawn');
requireValue((founderStoryPack.drafts && Object.values(founderStoryPack.drafts) || []).every(draft => draft.state === 'withdrawn_do_not_publish'), 'old founder-story drafts are not fully withdrawn');

const playable = read('public/playable-now/index.html');
requireValue(playable.includes('previous gameplay media pack is withdrawn'), 'Playable Now does not explain the current media decision');
requireValue(playable.includes('creature stays visible') && playable.includes('watched every frame'), 'Playable Now does not state the replacement quality bar');

const fieldGuide = read('public/creature-field-guide/index.html');
requireValue(!fieldGuide.includes('<img src="/press/'), 'field guide still displays a withdrawn capture');
requireValue((fieldGuide.match(/field-sighting-glyph/g) || []).length === 12, 'field guide must use twelve non-deceptive profile signals while images are withheld');

const signalLog = read('public/updates/index.html');
requireValue((signalLog.match(/signal-entry-no-media/g) || []).length >= 1, 'Latest News does not visibly mark withdrawn historical media');

console.log(JSON.stringify({
    valid: failures.length === 0,
    publicPagesChecked: visiblePages.length,
    withdrawnPathFamilies: register.withdrawnPathFamilies.length,
    withdrawnIndividualAssets: register.withdrawnIndividualPaths.length,
    socialPreviewsChecked: (previews.pages || []).length,
    videoEmbedded: false,
    failures
}, null, 2));
if (failures.length) process.exit(1);
