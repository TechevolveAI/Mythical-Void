#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag === -1 ? path.resolve(__dirname, '..', '..') : path.resolve(process.argv[rootFlag + 1] || '');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const contract = JSON.parse(read('docs/company/growth/GITHUB_PLAYABLE_RELEASE.json'));
const body = read(contract.release?.bodyPath || '');
const normalizedBody = body.replace(/\s+/g, ' ');
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };

requireValue(contract.schemaVersion === 1 && contract.id === 'GITHUB-PLAYABLE-RELEASE-001', 'release identity is invalid');
requireValue(contract.asOf === '2026-08-31', 'release evidence date is stale');
requireValue(contract.state === 'published_and_verified', 'release state is invalid');
requireValue(typeof contract.purpose === 'string' && contract.purpose.length >= 300, 'release purpose is incomplete');

const release = contract.release || {};
requireValue(release.repository === 'TechevolveAI/Mythical-Void', 'repository is invalid');
requireValue(release.tagName === 'early-access-2026-08-31', 'tag name is invalid');
requireValue(release.title === 'Mythical Void is playable now — Early Access', 'release title is invalid');
requireValue(release.bodyPath === 'docs/company/content/github-release/PLAYABLE_NOW_RELEASE.md', 'release body path is invalid');
requireValue(release.targetBranch === 'main', 'release must target protected main');
requireValue(release.prerelease === true && release.latestRelease === false && release.draft === false, 'release status must remain an honest public prerelease');
requireValue(Array.isArray(release.assets) && release.assets.length === 0, 'release must not attach files or media');
requireValue(release.expectedUrl === 'https://github.com/TechevolveAI/Mythical-Void/releases/tag/early-access-2026-08-31', 'expected release URL is invalid');

for (const phrase of [
    '# Mythical Void is playable now — Early Access',
    '[Play Mythical Void free in your browser](https://mythicalvoid.com/playable-now/)',
    '[Start the game directly](https://mythicalvoid.com/play/)',
    '[Read the family guide](https://mythicalvoid.com/parents/)',
    'No download, account, payment details, game adverts or public chat are needed.',
    'father-and-son project',
    'NASA does not make or endorse Mythical Void.',
    'People remain responsible for the story, safety boundaries, public claims and important choices.',
    'this release contains no gameplay media',
    'Generated universe artwork is never presented as gameplay.'
]) requireValue(normalizedBody.includes(phrase), `release body is missing: ${phrase}`);

requireValue(!/!\[[^\]]*\]\([^)]*\)|<img\b|<video\b|youtube\.com|youtu\.be|utm_|[?&](?:ref|source|campaign)=/i.test(body), 'release body contains media, video or tracking parameters');
requireValue(!/unique creature|no two creatures|infinite creatures|NASA-powered|NASA game|perfect for children|safe for all|award|best game/i.test(body), 'release body contains an unsupported or inflated claim');
requireValue(!/\b(?:nine|9)[ -]year[ -]old\b/i.test(body), 'release body exposes a child\'s exact age');

const truth = contract.truth || {};
for (const field of ['earlyAccessDisclosed', 'freeBrowserPlayClaimed', 'noDownloadClaimed', 'noAccountClaimed', 'noPaymentDetailsClaimed', 'noGameAdsClaimed', 'noPublicChatClaimed']) requireValue(truth[field] === true, `truth.${field} must be true`);
for (const field of ['childExactAgeDisclosed', 'nasaEndorsementClaimed', 'generatedArtworkPresentedAsGameplay', 'gameplayMediaAttached', 'downloadableBuildAttached', 'popularityOrRankingClaimed']) requireValue(truth[field] === false, `truth.${field} must be false`);

const authority = contract.authority || {};
requireValue(authority.ownedPublicRepositoryReleaseAuthorized === true, 'owned GitHub release authority is missing');
for (const field of ['newAccountAuthorized', 'platformTermsAuthorized', 'paidPromotionAuthorized', 'directOutreachAuthorized', 'childContactAuthorized', 'thirdPartyPostingAuthorized']) requireValue(authority[field] === false, `authority.${field} must remain false`);
requireValue(contract.publicationAuthorized === true && contract.publicationCompleted === true, 'publication boundary is invalid after release');
requireValue(Array.isArray(contract.gates) && contract.gates.length === 10, 'ten release gates are required');
for (let index = 0; index < 10; index += 1) {
    const gate = contract.gates?.[index];
    requireValue(gate?.id === `GR-G${String(index + 1).padStart(2, '0')}`, `release gate ${index + 1} id is invalid`);
    requireValue(gate?.satisfied === true, `release gate ${index + 1} state is invalid after publication`);
}
const publicEvidence = contract.publicEvidence || {};
requireValue(publicEvidence.releaseId === 379540846, 'public release id is invalid');
requireValue(publicEvidence.url === release.expectedUrl, 'public release URL is invalid');
requireValue(publicEvidence.tagName === release.tagName, 'public release tag is invalid');
requireValue(publicEvidence.targetCommit === 'eac3b8d202420aa5e2d175addcd3bfca70dfc5ae', 'public release target commit is invalid');
requireValue(publicEvidence.title === release.title, 'public release title is invalid');
requireValue(publicEvidence.publishedAt === '2026-08-31T06:05:48Z', 'public release time is invalid');
requireValue(publicEvidence.prerelease === true && publicEvidence.draft === false && publicEvidence.assetCount === 0, 'public release status is invalid');
requireValue(publicEvidence.bodySha256 === crypto.createHash('sha256').update(body).digest('hex'), 'public release body hash is invalid');
requireValue(typeof contract.measurementBoundary === 'string' && contract.measurementBoundary.length >= 250, 'measurement boundary is incomplete');
requireValue(typeof contract.rollback === 'string' && contract.rollback.length >= 180, 'rollback is incomplete');
requireValue(typeof contract.nextDecision === 'string' && contract.nextDecision.length >= 300, 'next decision is incomplete');

if (failures.length) {
    console.error('GitHub playable release is incomplete or unsafe:\n');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(JSON.stringify({
    valid: true,
    state: contract.state,
    repository: release.repository,
    tagName: release.tagName,
    prerelease: release.prerelease,
    assetCount: release.assets.length,
    satisfiedGateCount: contract.gates.filter(gate => gate.satisfied).length,
    publicationAuthorized: contract.publicationAuthorized,
    publicationCompleted: contract.publicationCompleted,
    publicUrl: publicEvidence.url,
    weakGameplayMediaPublished: false,
    newAccountRequired: false
}, null, 2));
