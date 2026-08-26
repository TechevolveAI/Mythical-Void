#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const pagePath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'public/educators/index.html');
const page = fs.readFileSync(pagePath, 'utf8');
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };
const read = relative => fs.readFileSync(path.join(root, relative));
const text = relative => read(relative).toString('utf8');
const json = relative => JSON.parse(text(relative));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function pngDimensions(relative) {
    const bytes = read(relative);
    if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

requireValue(page.includes('<link rel="canonical" href="https://mythicalvoid.com/educators/">'), 'canonical educator URL is missing');
requireValue((page.match(/<h1(?:\s[^>]*)?>/g) || []).length === 1, 'page must have exactly one main heading');
requireValue(page.includes('Turn one real space clue into a whole new life-form.'), 'plain first-screen promise is missing');
requireValue(page.includes('families, classrooms, libraries and clubs'), 'the intended adult-led audiences are not clear');
requireValue(page.includes('No signup · No student accounts · No contact collection'), 'first-screen privacy boundary is missing');
requireValue(page.includes('45-60 min') && page.includes('20-minute signal sprint'), 'both full and short routes must be clear');
requireValue(page.includes('The aim is not to draw the prettiest alien.'), 'the reason-first design principle is missing');
for (const step of ['Observe a real signal', 'Change the rules', 'Build for survival', 'Apply pressure', 'Make the story choice']) {
    requireValue(page.includes(step), `mission step is missing: ${step}`);
}
requireValue(page.includes('/resources/mythical-void-stem-creature-lab.pdf'), 'STEM Creature Lab link is missing');
requireValue(page.includes('/resources/mythical-void-play-share-card.pdf'), 'play-and-share card link is missing');
requireValue(page.includes('/press/social/nasa-stem-discovery-wide.png'), 'reviewed NASA and real-game sharing visual is missing');
requireValue(page.includes('REAL GAME + REAL NASA IMAGE.'), 'the real-game and real-space boundary is missing');
requireValue((page.match(/NASA does not endorse Mythical Void\./g) || []).length >= 2, 'NASA non-endorsement must be unmistakable');
requireValue(page.includes('Children are not asked to use a generative AI service.'), 'child AI-use boundary is missing');
requireValue(page.includes('do not need to leave the room'), 'student-work privacy guidance is missing');
requireValue(!/<form\b/i.test(page), 'educator page must not collect contact or student details');
requireValue(!/[?&](?:utm_|fbclid|gclid)/i.test(page), 'educator page contains a tracking parameter');
requireValue(!/\bcompanions?\b/i.test(page), 'retired companion wording is present');
requireValue(!/no two creatures|every creature is unique|infinite unique/i.test(page), 'unsupported creature uniqueness promise is present');
requireValue(!/NASA (?:made|makes|endorses|partners with) Mythical Void/i.test(page), 'page implies a NASA relationship');

let structured;
try { structured = JSON.parse(page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1]); }
catch (error) { failures.push(`structured data is invalid: ${error.message}`); }
const graph = structured?.['@graph'] || [];
requireValue(graph.some(item => item?.['@type'] === 'LearningResource' && item?.typicalAgeRange === '9-14' && item?.isAccessibleForFree === true), 'free LearningResource structured data is missing');
requireValue(graph.some(item => item?.['@type'] === 'FAQPage' && item?.mainEntity?.length >= 3), 'FAQ structured data is missing');

for (const [relative, minimumBytes] of [
    ['public/resources/mythical-void-stem-creature-lab.pdf', 500000],
    ['public/resources/mythical-void-play-share-card.pdf', 500000]
]) {
    const bytes = read(relative);
    requireValue(bytes.subarray(0, 4).toString('ascii') === '%PDF', `${relative} is not a PDF`);
    requireValue(bytes.length > minimumBytes, `${relative} is unexpectedly small`);
}
for (const relative of [
    'public/resources/previews/stem-creature-lab-cover.png',
    'public/resources/previews/play-share-card.png'
]) {
    const dimensions = pngDimensions(relative);
    requireValue(dimensions?.width === 794 && dimensions?.height === 1123, `${relative} preview dimensions are incorrect`);
    requireValue(read(relative).length > 100000, `${relative} preview is unexpectedly small`);
}

const gameplay = json('public/press/gameplay/manifest.json');
const proof = gameplay.captures?.find(item => item.publicPath === '/press/gameplay/nasa-apollo11-real-space-discovery.png');
requireValue(Boolean(proof), 'NASA discovery screen is missing from the gameplay manifest');
if (proof) requireValue(proof.sha256 === sha256(read('public/press/gameplay/nasa-apollo11-real-space-discovery.png')), 'NASA discovery screen fingerprint has drifted');

const previews = json('public/press/mythical-void-social-previews.json');
const preview = previews.pages?.find(item => item.route === '/educators/');
requireValue(preview?.htmlPath === 'public/educators/index.html', 'educator social preview route is missing');
requireValue(preview?.imagePath === 'public/press/social/nasa-stem-discovery-wide.png', 'educator social preview is not using the reviewed NASA/STEM card');
requireValue(/NASA does not endorse Mythical Void/i.test(preview?.disclosure || ''), 'educator preview lost the NASA boundary');

const press = json('public/press/mythical-void-press-assets.json');
requireValue(press.educatorPageUrl === 'https://mythicalvoid.com/educators/', 'press manifest educator page URL is missing');
requireValue(press.educatorResources?.some(item => item.pageUrl === 'https://mythicalvoid.com/educators/'), 'press manifest does not connect the activity to its guide');

const signals = json('public/updates/releases.json');
const releaseSignal = signals.entries?.find(item => item.id === 'SIGNAL-016');
requireValue(releaseSignal?.status === 'live' && releaseSignal?.destination === '/educators/' && releaseSignal?.image === '/press/social/nasa-stem-discovery-wide.png', 'educator Signal Log entry is missing or drifted');

for (const [relative, fragment, label] of [
    ['public/sitemap.xml', '<loc>https://mythicalvoid.com/educators/</loc>', 'sitemap'],
    ['public/llms.txt', 'https://mythicalvoid.com/educators/', 'machine-readable site guide'],
    ['public/parents/index.html', 'href="/educators/"', 'parent guide'],
    ['public/nasa-space-science/index.html', 'href="/educators/"', 'NASA and STEM page'],
    ['src/site/storefront.js', 'href="/educators/">For groups & educators</a>', 'homepage footer'],
    ['public/updates/index.html', 'href="/educators/"', 'public Signal Log'],
    ['public/updates/feed.xml', '/updates/#signal-016', 'RSS feed'],
    ['public/updates/feed.json', '/updates/#signal-016', 'JSON feed'],
    ['package.json', 'validate:educator-discovery', 'production build']
]) requireValue(text(relative).includes(fragment), `${label} discovery is missing`);

console.log(JSON.stringify({
    valid: failures.length === 0,
    publicUrl: 'https://mythicalvoid.com/educators/',
    fullSessionMinutes: '45-60',
    quickSessionMinutes: 20,
    printableResources: 2,
    studentAccountRequired: false,
    contactCollection: false,
    externalPublicationAuthorized: false,
    failures
}, null, 2));
if (failures.length) process.exit(1);
