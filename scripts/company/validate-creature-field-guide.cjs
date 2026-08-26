#!/usr/bin/env node

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { buildFieldGuideData, buildFieldGuideHtml } = require('./build-creature-field-guide.cjs');

const root = path.resolve(__dirname, '../..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'src/data/creature-field-guide.json'), 'utf8'));
const profiles = JSON.parse(fs.readFileSync(path.join(root, 'public/press/gameplay/real-creature-showcase/source-profiles.json'), 'utf8'));
const publicDataPath = path.join(root, 'public/creature-field-guide/field-guide.json');
const publicHtmlPath = path.join(root, 'public/creature-field-guide/index.html');
const publicData = JSON.parse(fs.readFileSync(publicDataPath, 'utf8'));
const publicHtml = fs.readFileSync(publicHtmlPath, 'utf8');
const expectedData = buildFieldGuideData(source, profiles);
const expectedHtml = buildFieldGuideHtml(expectedData);
const release = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/generated/creature-field-guide-release.json'), 'utf8'));
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');

const expectedRealms = {
    mythical_forest: ['Mythical Forest', 'Elder Treant', 'Forest Rootwarden'],
    crystal_caves: ['Crystal Caves', 'Crystal Guardian', 'Cavern Resonance Keeper'],
    stellar_reef: ['Stellar Reef', "Nyx'voral", 'Reef Passage Guardian'],
    void_peaks: ['Void Peaks', 'Cosmic Titan', 'Peak Warning Keeper'],
    aurora_depths: ['Aurora Depths', 'Aurora Phoenix', 'Aurora Renewal Guardian'],
    final_void: ['The Final Void', 'Void Empress', 'Void Boundary Guardian']
};

assert.strictEqual(source.schemaVersion, 1);
assert.strictEqual(source.state, 'official_field_guide_stories_source_bound_to_verified_renderer_profiles');
assert.deepStrictEqual(publicData, expectedData, 'Public field-guide data has drifted from its source or real profiles.');
assert.strictEqual(publicHtml, expectedHtml, 'Public field-guide page has drifted from the deterministic builder.');
assert.strictEqual(source.realms.length, 6, 'The guide must cover all six realms.');

const sightings = source.realms.flatMap(realm => realm.sightings);
assert.strictEqual(sightings.length, 12, 'The guide must contain twelve sightings.');
assert.strictEqual(new Set(sightings.map(item => item.creatureId)).size, 12, 'Every field-guide creature must be used once.');
assert.strictEqual(new Set(sightings.map(item => item.name)).size, 12, 'Every field-guide story name must be distinct.');

for (const realm of source.realms) {
    assert.deepStrictEqual([realm.label, realm.guardian, realm.guardianRole], expectedRealms[realm.id], `${realm.id} guardian mapping has drifted.`);
    assert.strictEqual(realm.sightings.length, 2, `${realm.label} must have exactly two sightings.`);
    assert.ok(realm.knownGameTruth.length >= 70, `${realm.label} needs a useful game-truth explanation.`);
    assert.ok(realm.projectBeaconQuestion.endsWith('?'), `${realm.label} needs a Project Beacon question.`);
    assert.ok(realm.sourceRefs.length >= 3 && realm.sourceRefs.every(ref => fs.existsSync(path.join(root, ref))), `${realm.label} needs three real source references.`);
}

const profileById = new Map(profiles.profiles.map(profile => [profile.id, profile]));
for (const sighting of publicData.realms.flatMap(realm => realm.sightings)) {
    const profile = profileById.get(sighting.creatureId);
    assert.ok(profile, `${sighting.creatureId} is not one of the verified renderer profiles.`);
    for (const key of ['id', 'species', 'speciesLabel', 'rarity', 'geneBody', 'body', 'head', 'aura', 'personality', 'affinity', 'shiny', 'shinyType']) {
        assert.deepStrictEqual(sighting.profile[key], profile[key], `${sighting.creatureId} ${key} has drifted from the renderer profile.`);
    }
    assert.deepStrictEqual(sighting.profile.mutations, profile.mutations, `${sighting.creatureId} mutations have drifted.`);
    assert.deepStrictEqual(sighting.profile.specialFeatures, profile.specialFeatures, `${sighting.creatureId} special features have drifted.`);
    assert.deepStrictEqual(sighting.profile.colors, profile.colors, `${sighting.creatureId} colours have drifted.`);
    assert.strictEqual(sighting.storyStatus, 'official_field_guide_story_not_currently_playable_quest');
    assert.ok(fs.existsSync(path.join(root, 'public', sighting.profile.image)), `${sighting.creatureId} real render is missing.`);
}

assert.strictEqual((publicHtml.match(/data-field-realm/g) || []).length, 6, 'HTML needs six marked realm sections.');
assert.strictEqual((publicHtml.match(/class="field-sighting"/g) || []).length, 12, 'HTML needs twelve marked sighting cards.');
assert.ok(/do not claim these twelve creatures or events are already playable quests/i.test(publicHtml), 'The page must make its playable-quest boundary obvious.');
assert.ok(/earlier sprite and realm captures were real but poor at communicating the experience/i.test(publicHtml), 'The visual-withdrawal disclosure is missing.');
assert.ok(!publicHtml.includes('/press/gameplay/'), 'The public field guide republishes withdrawn captures.');
assert.ok(!/\bcompanions?\b/i.test(publicHtml), 'The page uses retired companion language.');
assert.ok(!/no two creatures|every creature is unique|infinite(?:ly)? unique|unlimited unique/i.test(publicHtml), 'The page makes an unsupported uniqueness promise.');
assert.ok(!/sentient|conscious ai|alive ai/i.test(publicHtml), 'The page makes an unsupported intelligence or sentience claim.');
assert.ok(!/NASA/i.test(publicHtml), 'The field guide must not imply a NASA relationship.');

for (const [file, fragment, label] of [
    ['public/sitemap.xml', '<loc>https://mythicalvoid.com/creature-field-guide/</loc>', 'sitemap discovery'],
    ['public/llms.txt', 'https://mythicalvoid.com/creature-field-guide/', 'machine-readable discovery'],
    ['public/story/index.html', 'href="/creature-field-guide/"', 'story-page discovery'],
    ['public/creature-genetics/index.html', 'href="/creature-field-guide/"', 'creature-page discovery'],
    ['src/site/storefront.js', 'href="/creature-field-guide/"', 'homepage and press discovery'],
    ['public/updates/releases.json', '"id": "SIGNAL-014"', 'Signal Log release'],
    ['public/updates/feed.xml', '/updates/#signal-014', 'RSS discovery'],
    ['public/updates/feed.json', '/updates/#signal-014', 'JSON Feed discovery']
]) assert.ok(fs.readFileSync(path.join(root, file), 'utf8').includes(fragment), `${label} is missing.`);

const socialPreviews = JSON.parse(fs.readFileSync(path.join(root, 'public/press/mythical-void-social-previews.json'), 'utf8'));
const socialPreview = socialPreviews.pages.find(page => page.route === '/creature-field-guide/');
assert.strictEqual(socialPreview?.classification, 'ai_generated_marketing_illustration_not_gameplay');
assert.ok(/not gameplay/i.test(socialPreview?.disclosure || ''), 'Field-guide social preview lacks its artwork boundary.');

assert.strictEqual(release.state, 'owned_site_profile_guide_ready_visuals_withdrawn_pending_rebuild');
assert.strictEqual(release.sourceProof.fieldGuideSource.sha256, sha256('src/data/creature-field-guide.json'));
assert.strictEqual(release.sourceProof.rendererProfiles.sha256, sha256('public/press/gameplay/real-creature-showcase/source-profiles.json'));
assert.strictEqual(release.sourceProof.publicData.sha256, sha256('public/creature-field-guide/field-guide.json'));
assert.strictEqual(release.sourceProof.publicPage.sha256, sha256('public/creature-field-guide/index.html'));
assert.deepStrictEqual(release.coverage, { realms: 6, verifiedCreatureProfiles: 12, sightingsPerRealm: 2, guardians: 6, projectBeaconQuestions: 6 });
assert.strictEqual(release.canonBoundary.changesPlayableQuestCanon, false);
assert.strictEqual(release.safeguards.deterministicSourceBoundBuild, true);
assert.strictEqual(release.safeguards.directMinorContactEnabled, false);
assert.strictEqual(release.productionProof.netlifyState, 'pending');
assert.strictEqual(release.productionProof.liveFilesMatchCheckedRelease, false);

assert.strictEqual(source.authority.ownedWebsitePublicationAuthorized, true);
assert.strictEqual(source.authority.changesPlayableQuestCanon, false);
assert.strictEqual(source.authority.externalSocialPublicationAuthorized, false);
assert.strictEqual(source.authority.emailOrOutreachSendingAuthorized, false);
assert.strictEqual(source.authority.paidPromotionAuthorized, false);
assert.strictEqual(source.authority.publicRepliesAuthorized, false);
assert.strictEqual(source.authority.directMinorContactAuthorized, false);
assert.strictEqual(source.authority.kevinApprovalRequiredBeforeExternalPublication, true);
assert.strictEqual(source.authority.externalActionTaken, false);
assert.deepStrictEqual(release.authority, source.authority);

console.log('Creature field guide valid: 6 realms, 12 source-bound renderer sightings, clear canon and publishing boundaries.');
