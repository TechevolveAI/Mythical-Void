#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { buildJsonFeed, buildRssFeed, defaultJsonPath, defaultRssPath, defaultSourcePath } = require('./build-signal-feeds.cjs');
const { isWithdrawnPublicVisual, readVisualPublicationRegister } = require('./visual-publication-policy.cjs');

const root = path.resolve(__dirname, '../..');
const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultSourcePath;
const rssPath = process.argv[3] ? path.resolve(process.argv[3]) : defaultRssPath;
const jsonPath = process.argv[4] ? path.resolve(process.argv[4]) : defaultJsonPath;
const releasePath = process.argv[5] ? path.resolve(process.argv[5]) : path.join(root, 'docs/company/content/generated/signal-log-syndication-release.json');
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const rss = fs.readFileSync(rssPath, 'utf8');
const jsonText = fs.readFileSync(jsonPath, 'utf8');
const release = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };
const live = (source.entries || []).filter(entry => entry.status === 'live');
const visualRegister = readVisualPublicationRegister();

requireValue(source.publicationBoundary?.liveItemsOnly === true, 'only checked live items may be published');
for (const [key, expected] of Object.entries({ commentsEnabled: false, contactCollectionEnabled: false, emailSignupEnabled: false, playerProfilesCreated: false, trackingParametersPermitted: false })) {
    requireValue(source.publicationBoundary?.[key] === expected, `publicationBoundary.${key} must be ${expected}`);
}
requireValue(rss === buildRssFeed(source), 'RSS feed is stale or was edited away from its checked source');
requireValue(jsonText === buildJsonFeed(source), 'JSON feed is stale or was edited away from its checked source');
const sourceFingerprint = crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex');
const rssSha256 = crypto.createHash('sha256').update(rss).digest('hex');
const jsonSha256 = crypto.createHash('sha256').update(jsonText).digest('hex');
requireValue(release.source?.fingerprintSha256 === sourceFingerprint, 'release record source fingerprint drifted');
requireValue(release.source?.liveEntryCount === live.length, 'release record live count drifted');
requireValue(release.feeds?.rss?.sha256 === rssSha256 && release.feeds?.rss?.itemCount === live.length, 'release record RSS proof drifted');
requireValue(release.feeds?.json?.sha256 === jsonSha256 && release.feeds?.json?.itemCount === live.length, 'release record JSON proof drifted');
requireValue([
    'owned_site_release_prepared',
    'complete_owned_site_release_production_verified',
    'complete_owned_site_release_alias_verified_from_promoted_preview'
].includes(release.state), 'release state is invalid');
if (release.state === 'owned_site_release_prepared') {
    requireValue(release.productionVerification === null, 'prepared feed release must not invent production proof');
} else {
    const production = release.productionVerification || {};
    const productionCommit = production.commit || production.mergeCommit;
    requireValue(/^[0-9a-f]{40}$/.test(productionCommit || ''), 'live feed production commit is missing');
    requireValue(/^[0-9a-f]{24}$/.test(production.deployId || ''), 'live feed production deploy ID is missing');
    requireValue(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(production.publishedAt || ''), 'live feed production time is missing');
    requireValue(production.updatesPageHttpStatus === 200 && production.playDoorwayHttpStatus === 200, 'live feed public doorways were not both checked');
    requireValue(production.latestEntryId === live[0]?.id && production.latestEntryPresent === true, 'live feed latest entry proof is missing');
    requireValue(production.rssItemCount === live.length && production.jsonItemCount === live.length, 'live feed production counts drifted');
    requireValue(production.productionPresentationReview === 'text_only_no_gameplay_media', 'live feed release must preserve its text-only presentation boundary');
    if (release.state === 'complete_owned_site_release_alias_verified_from_promoted_preview') {
        requireValue(/^[0-9a-f]{40}$/.test(production.sourceCommit || ''), 'promoted preview source commit is missing');
        requireValue(production.mergeTreeMatchesSourceTree === true, 'promoted preview was not proven tree-identical to merged main');
        requireValue(production.deployContextReportedByNetlify === 'deploy-preview', 'promoted preview context must be recorded honestly');
        requireValue(production.promotionMethod === 'tested_pr_preview_restored_to_production_alias_after_main_build_was_skipped_for_account_credit_usage', 'promoted preview method is missing');
        requireValue(production.productionAlias === 'https://mythicalvoid.com', 'production alias proof is missing');
        requireValue(production.liveFilesMatchSourceSha256 === true, 'live promoted files were not proven source-identical');
    }
}
for (const [key, expected] of Object.entries({ ownedWebsitePublicationAuthorized: true, externalSyndicationAuthorized: false, emailSendingAuthorized: false, socialPostingAuthorized: false, externalActionTaken: false })) {
    requireValue(release.authority?.[key] === expected, `release authority.${key} must be ${expected}`);
}

let json;
try { json = JSON.parse(jsonText); } catch (error) { failures.push(`JSON feed is invalid: ${error.message}`); }
requireValue(json?.version === 'https://jsonfeed.org/version/1.1', 'JSON Feed must use version 1.1');
requireValue(json?.feed_url === 'https://mythicalvoid.com/updates/feed.json', 'JSON Feed self URL is wrong');
requireValue(json?.items?.length === live.length, 'JSON Feed count must match checked live releases');
requireValue((rss.match(/<item>/g) || []).length === live.length, 'RSS item count must match checked live releases');
requireValue(rss.includes('type="application/rss+xml"'), 'RSS self-discovery type is missing');
requireValue(rss.includes('<media:description>'), 'RSS image descriptions are missing');

const seenIds = new Set();
for (const [index, entry] of live.entries()) {
    const item = json?.items?.[index];
    requireValue(!seenIds.has(entry.id), `${entry.id} is duplicated`);
    seenIds.add(entry.id);
    requireValue(item?.id === `https://mythicalvoid.com/updates/#${entry.id.toLowerCase()}`, `${entry.id} order or ID drifted`);
    requireValue(item?.summary === entry.summary, `${entry.id} summary drifted`);
    if (entry.image && !isWithdrawnPublicVisual(entry.image, visualRegister)) {
        requireValue(item?.content_text?.includes(entry.disclosure), `${entry.id} lost its media disclosure`);
        requireValue(Boolean(item?.image), `${entry.id} lost its approved image`);
    } else if (entry.visualKind === 'space_discovery' || entry.visualKind === 'text_only_release') {
        requireValue(item?.content_text?.includes(entry.disclosure), `${entry.id} lost its code-native visual disclosure`);
        requireValue(!item?.image, `${entry.id} represents a code-native visual as a feed image`);
    } else {
        requireValue(item?.content_text?.includes('withheld after human review'), `${entry.id} lost its visual-review note`);
        requireValue(!item?.image, `${entry.id} republishes a withdrawn image`);
    }
    requireValue(item?.external_url?.startsWith('https://mythicalvoid.com/'), `${entry.id} points outside Mythical Void`);
    requireValue(!/[?&](?:utm_|fbclid|gclid)/i.test(item?.external_url || ''), `${entry.id} contains tracking`);
}

const combined = `${rss}\n${jsonText}`;
requireValue(!/\bcompanions?\b/i.test(combined), 'feeds use retired companion wording');
requireValue(!/no two creatures|every creature is unique|infinite unique/i.test(combined), 'feeds contain an unsupported uniqueness promise');
requireValue(!/\b\d[\d,.]*\s+(?:players|customers|downloads|followers|visits)\b/i.test(combined), 'feeds contain an unverified audience metric');

for (const file of ['index.html', 'public/playable-now/index.html', 'public/hatch-challenge/index.html', 'public/story/index.html', 'public/creature-genetics/index.html', 'public/creature-field-guide/index.html', 'public/nasa-space-science/index.html', 'public/parents/index.html', 'public/educators/index.html', 'public/studio/index.html', 'public/updates/index.html']) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    requireValue(text.includes('rel="alternate" type="application/rss+xml"'), `${file} does not advertise RSS`);
    requireValue(text.includes('rel="alternate" type="application/feed+json"'), `${file} does not advertise JSON Feed`);
}
for (const [file, fragment, label] of [
    ['public/updates/index.html', 'href="/updates/feed.xml">Follow the news</a>', 'visible follow link'],
    ['src/site/storefront.js', 'href="/updates/feed.xml">News feed</a>', 'press-room feed link'],
    ['public/llms.txt', 'RSS updates feed: https://mythicalvoid.com/updates/feed.xml', 'llms RSS link'],
    ['public/llms.txt', 'JSON updates feed: https://mythicalvoid.com/updates/feed.json', 'llms JSON link'],
    ['public/press/mythical-void-press-assets.json', '"rss": "https://mythicalvoid.com/updates/feed.xml"', 'press manifest RSS link'],
    ['netlify.toml', 'Content-Type = "application/rss+xml; charset=utf-8"', 'Netlify RSS MIME'],
    ['netlify.toml', 'Content-Type = "application/feed+json; charset=utf-8"', 'Netlify JSON MIME'],
    ['vercel.json', '"value": "application/rss+xml; charset=utf-8"', 'Vercel RSS MIME'],
    ['vercel.json', '"value": "application/feed+json; charset=utf-8"', 'Vercel JSON MIME']
]) requireValue(fs.readFileSync(path.join(root, file), 'utf8').includes(fragment), `${label} is missing`);

console.log(JSON.stringify({
    valid: failures.length === 0,
    liveEntryCount: live.length,
    rssSha256,
    jsonSha256,
    accountRequired: false,
    contactCollectionEnabled: false,
    trackingParametersPermitted: false,
    failures
}, null, 2));
if (failures.length) process.exit(1);
