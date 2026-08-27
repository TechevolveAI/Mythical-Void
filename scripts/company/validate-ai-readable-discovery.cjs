#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const discoveryLink = '<link rel="describedby" type="text/markdown" href="https://mythicalvoid.com/llms.txt">';
const staticPagePaths = [
    'public/playable-now/index.html',
    'public/creature-genetics/index.html',
    'public/creature-field-guide/index.html',
    'public/nasa-space-science/index.html',
    'public/parents/index.html',
    'public/educators/index.html',
    'public/studio/index.html',
    'public/story/index.html',
    'public/updates/index.html'
];

function validateAiReadableDiscovery(inputs) {
    const failures = [];
    const requireValue = (condition, message) => { if (!condition) failures.push(message); };
    const {
        llms, release, rootIndex, staticPages, builderSources, sitemap, packageJson
    } = inputs;
    const sitemapUrls = [...sitemap.matchAll(/<loc>(https:\/\/mythicalvoid\.com\/[^<]*)<\/loc>/g)].map(match => match[1]);
    const sitemapEntries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(match => match[1]);
    const today = new Date().toISOString().slice(0, 10);
    const truthfulLastModifiedCount = sitemapEntries.filter(entry => {
        const dates = [...entry.matchAll(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/g)].map(match => match[1]);
        return dates.length === 1 && dates[0] <= today;
    }).length;

    requireValue(llms.startsWith('# Mythical Void\n'), 'llms.txt must begin with one clear Mythical Void heading');
    requireValue(Buffer.byteLength(llms, 'utf8') <= 12 * 1024, 'llms.txt is too large to remain a concise orientation file');
    requireValue(llms.includes('This file is a concise guide to the canonical public information'), 'llms.txt does not explain its limited purpose');
    requireValue(llms.includes('It is not a permission file, an age rating, a promise of search inclusion'), 'llms.txt overstates what the convention can do');
    requireValue(llms.includes('Last reviewed: 26 August 2026.'), 'llms.txt review date is missing');
    requireValue(llms.includes('NASA does not make or endorse Mythical Void.'), 'NASA non-endorsement is missing');
    requireValue(llms.includes('does not currently claim a formal age rating'), 'formal age-rating boundary is missing');
    requireValue(llms.includes('AI-generated marketing artwork') && llms.includes('must not be described as gameplay'), 'visual-truth boundary is missing');
    requireValue(llms.includes("Do not add the child's name, photograph, quotation, contact route or other identifying detail."), 'child identity boundary is missing');
    requireValue(llms.includes('Call the beings "creatures".'), 'public creature terminology is missing');
    requireValue(!/\bcompanions?\b/i.test(llms), 'retired companion wording is present in llms.txt');
    requireValue(!/every creature is unique|no two creatures|literally infinite|infinite unique/i.test(llms), 'unsupported creature-uniqueness promise is present in llms.txt');
    requireValue(sitemapUrls.length === 13, `expected 13 canonical sitemap URLs, found ${sitemapUrls.length}`);
    requireValue(truthfulLastModifiedCount === 13, `expected truthful lastmod evidence on all 13 sitemap entries, found ${truthfulLastModifiedCount}`);
    for (const url of sitemapUrls) requireValue(llms.includes(`](${url})`), `llms.txt is missing canonical sitemap route ${url}`);
    requireValue(llms.includes('](https://mythicalvoid.com/play/)'), 'llms.txt is missing the direct Play route');

    requireValue(release.id === 'AI-DISCOVERY-001', 'AI-readable release identity is missing');
    requireValue(release.status === 'approved_for_owned_website_release', 'AI-readable release is not approved for the owned website');
    requireValue(release.publicRoute === 'https://mythicalvoid.com/llms.txt', 'AI-readable public route is wrong');
    requireValue(release.convention?.state === 'proposed_convention_not_ratified_standard', 'llms.txt is presented as a ratified standard');
    requireValue(release.convention?.source === 'https://llmstxt.org/', 'llms.txt proposal source is missing');
    requireValue(release.convention?.discoveryLink === discoveryLink, 'the declared discovery link is wrong');
    requireValue(release.convention?.limits?.length === 3, 'the convention limitations are incomplete');
    requireValue(release.claimBoundaries?.length === 7, 'public claim boundaries are incomplete');
    requireValue(release.release?.ownedWebsitePublicationAuthorized === true, 'owned publication approval is missing');
    requireValue(release.release?.indexNowNotificationAuthorizedForMeaningfulOwnedChange === true, 'bounded IndexNow notification approval is missing');
    for (const field of ['searchRankingClaimAuthorized', 'aiCitationClaimAuthorized', 'crawlerPermissionChangeAuthorized', 'externalPostingAuthorized', 'paidPromotionAuthorized']) {
        requireValue(release.release?.[field] === false, `release.${field} must remain false`);
    }

    requireValue(rootIndex.includes(discoveryLink), 'homepage does not advertise the concise site guide');
    for (const [file, source] of Object.entries(staticPages)) requireValue(source.includes(discoveryLink), `${file} does not advertise the concise site guide`);
    for (const [file, source] of Object.entries(builderSources)) requireValue(source.includes(discoveryLink), `${file} will remove the discovery link on rebuild`);
    requireValue(packageJson.scripts?.['validate:ai-discovery'] === 'node scripts/company/validate-ai-readable-discovery.cjs', 'AI discovery validator command is missing');
    requireValue(packageJson.scripts?.['test:ai-discovery'] === 'node scripts/company/test-ai-readable-discovery.cjs', 'AI discovery safeguard command is missing');
    requireValue(packageJson.scripts?.build?.includes('npm run validate:ai-discovery') && packageJson.scripts.build.includes('npm run test:ai-discovery'), 'production build does not enforce AI discovery safeguards');

    return failures;
}

function read(relativePath) {
    return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
}

function run() {
    const release = JSON.parse(read('docs/company/search/ai-readable-discovery-release-2026-08-26.json'));
    const packageJson = JSON.parse(read('package.json'));
    const failures = validateAiReadableDiscovery({
        llms: read('public/llms.txt'),
        release,
        rootIndex: read('index.html'),
        staticPages: Object.fromEntries(staticPagePaths.map(file => [file, read(file)])),
        builderSources: {
            'scripts/company/build-public-signal-log.cjs': read('scripts/company/build-public-signal-log.cjs'),
            'scripts/company/build-creature-field-guide.cjs': read('scripts/company/build-creature-field-guide.cjs')
        },
        sitemap: read('public/sitemap.xml'),
        packageJson
    });
    console.log(JSON.stringify({
        valid: failures.length === 0,
        publicRoute: release.publicRoute,
        conventionState: release.convention?.state,
        canonicalRouteCount: 13,
        rankingClaimAuthorized: release.release?.searchRankingClaimAuthorized,
        externalPostingAuthorized: release.release?.externalPostingAuthorized,
        failures
    }, null, 2));
    if (failures.length) process.exit(1);
}

if (require.main === module) run();

module.exports = { validateAiReadableDiscovery, discoveryLink, staticPagePaths };
