#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { readVisualPublicationRegister } = require('./visual-publication-policy.cjs');

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
requireValue(page.includes('45-60 min') && page.includes('20-minute discovery sprint'), 'both full and short routes must be clear');
requireValue(page.includes('The aim is not to draw the prettiest alien.'), 'the reason-first design principle is missing');
for (const step of ['Study a real observation', 'Change the rules', 'Build for survival', 'Apply pressure', 'Make the story choice']) {
    requireValue(page.includes(step), `mission step is missing: ${step}`);
}
requireValue(page.includes('/resources/mythical-void-stem-creature-lab.pdf'), 'STEM Creature Lab link is missing');
requireValue(page.includes('/resources/previews/stem-creature-lab-cover.png'), 'accurate activity preview is missing');
requireValue(page.includes('THE ACTIVITY YOU WILL USE.'), 'activity-preview boundary is missing');
requireValue(page.includes('Open Mythical Void together'), 'shared play route is missing');
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
const learningResource = graph.find(item => item?.['@type'] === 'LearningResource');
requireValue(learningResource?.typicalAgeRange === '9-14' && learningResource?.isAccessibleForFree === true, 'free LearningResource structured data is missing');
requireValue(learningResource?.dateModified === '2026-08-27', 'LearningResource updated date is missing');
requireValue(learningResource?.provider?.['@id'] === 'https://mythicalvoid.com/#studio', 'LearningResource provider is missing');
requireValue(learningResource?.encoding?.contentUrl === 'https://mythicalvoid.com/resources/mythical-void-stem-creature-lab.pdf' && learningResource?.encoding?.encodingFormat === 'application/pdf', 'LearningResource PDF information is missing');
requireValue(graph.some(item => item?.['@type'] === 'FAQPage' && item?.mainEntity?.length >= 3), 'FAQ structured data is missing');

for (const [relative, minimumBytes] of [
    ['public/resources/mythical-void-stem-creature-lab.pdf', 500000]
]) {
    const bytes = read(relative);
    requireValue(bytes.subarray(0, 4).toString('ascii') === '%PDF', `${relative} is not a PDF`);
    requireValue(bytes.length > minimumBytes, `${relative} is unexpectedly small`);
}
for (const relative of [
    'public/resources/previews/stem-creature-lab-cover.png'
]) {
    const dimensions = pngDimensions(relative);
    requireValue(dimensions?.width === 794 && dimensions?.height === 1123, `${relative} preview dimensions are incorrect`);
    requireValue(read(relative).length > 100000, `${relative} preview is unexpectedly small`);
}

const visualRegister = readVisualPublicationRegister();
for (const prefix of visualRegister.withdrawnPathFamilies) requireValue(!page.includes(prefix), `educator page republishes withdrawn path family ${prefix}`);
for (const publicPath of visualRegister.withdrawnIndividualPaths) requireValue(!page.includes(publicPath), `educator page republishes withdrawn asset ${publicPath}`);

const previews = json('public/press/mythical-void-social-previews.json');
const preview = previews.pages?.find(item => item.route === '/educators/');
requireValue(preview?.htmlPath === 'public/educators/index.html', 'educator social preview route is missing');
requireValue(preview?.imagePath === 'public/marketing/mythical-void-creature-universe-hero-v2.webp', 'educator social preview is not using the approved temporary fallback');
requireValue(/not gameplay/i.test(preview?.disclosure || ''), 'educator preview lost its artwork boundary');

const press = json('public/press/mythical-void-press-assets.json');
requireValue(press.educatorPageUrl === 'https://mythicalvoid.com/educators/', 'press manifest educator page URL is missing');
requireValue(press.educatorResources?.some(item => item.pageUrl === 'https://mythicalvoid.com/educators/'), 'press manifest does not connect the activity to its guide');

const signals = json('public/updates/releases.json');
const releaseSignal = signals.entries?.find(item => item.id === 'UPDATE-016');
requireValue(releaseSignal?.status === 'live' && releaseSignal?.destination === '/educators/', 'educator Latest News entry is missing or drifted');

for (const [relative, fragment, label] of [
    ['public/sitemap.xml', '<loc>https://mythicalvoid.com/educators/</loc>', 'sitemap'],
    ['public/sitemap.xml', '<loc>https://mythicalvoid.com/educators/</loc>\n    <lastmod>2026-08-27</lastmod>', 'fresh educator sitemap date'],
    ['public/llms.txt', 'https://mythicalvoid.com/educators/', 'machine-readable site guide'],
    ['public/parents/index.html', 'href="/educators/"', 'parent guide'],
    ['public/nasa-space-science/index.html', 'href="/educators/"', 'NASA and STEM page'],
    ['src/site/storefront.js', 'href="/educators/">For groups & educators</a>', 'homepage footer'],
    ['public/updates/index.html', 'href="/educators/"', 'public Latest News'],
    ['public/updates/feed.xml', '/updates/#update-016', 'RSS feed'],
    ['public/updates/feed.json', '/updates/#update-016', 'JSON feed'],
    ['package.json', 'validate:educator-discovery', 'production build']
]) requireValue(text(relative).includes(fragment), `${label} discovery is missing`);

console.log(JSON.stringify({
    valid: failures.length === 0,
    publicUrl: 'https://mythicalvoid.com/educators/',
    fullSessionMinutes: '45-60',
    quickSessionMinutes: 20,
    printableResources: 1,
    studentAccountRequired: false,
    contactCollection: false,
    externalPublicationAuthorized: false,
    failures
}, null, 2));
if (failures.length) process.exit(1);
