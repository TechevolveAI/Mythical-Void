#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { isWithdrawnPublicVisual, readVisualPublicationRegister } = require('./visual-publication-policy.cjs');

const root = path.resolve(__dirname, '../..');
const register = readVisualPublicationRegister();
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

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

const playable = read('public/playable-now/index.html');
requireValue(playable.includes('previous gameplay media pack is withdrawn'), 'Playable Now does not explain the current media decision');
requireValue(playable.includes('creature stays visible') && playable.includes('watched every frame'), 'Playable Now does not state the replacement quality bar');

const fieldGuide = read('public/creature-field-guide/index.html');
requireValue(!fieldGuide.includes('<img src="/press/'), 'field guide still displays a withdrawn capture');
requireValue((fieldGuide.match(/field-sighting-glyph/g) || []).length === 12, 'field guide must use twelve non-deceptive profile signals while images are withheld');

const signalLog = read('public/updates/index.html');
requireValue((signalLog.match(/signal-entry-no-media/g) || []).length >= 1, 'Signal Log does not visibly mark withdrawn historical media');

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
