#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const readJson = value => JSON.parse(fs.readFileSync(path.join(root, value), 'utf8'));
const readText = value => fs.readFileSync(path.join(root, value), 'utf8');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };

const release = readJson('docs/company/content/generated/real-creature-showcase-release.json');
const profiles = readJson('public/press/gameplay/real-creature-showcase/source-profiles.json');
const manifest = readJson('public/press/gameplay/real-creature-showcase/renderer-manifest.json');
const press = readJson('public/press/mythical-void-press-assets.json');
const previews = readJson('public/press/mythical-void-social-previews.json');
const signals = readJson('public/updates/releases.json');
const page = readText('public/creature-genetics/index.html');
const storefront = readText('src/site/storefront.js');
const llms = readText('public/llms.txt');

requireValue(release.schemaVersion === 1, 'release schemaVersion must be 1');
requireValue(release.state === 'owned_site_release_visually_verified_waiting_for_production_verification', 'release state must wait for production verification');
requireValue(release.source?.commit === manifest.sourceCommit && /^[a-f0-9]{40}$/.test(manifest.sourceCommit || ''), 'renderer source commit drifted');
requireValue(profiles.candidatesExplored === 1000 && profiles.profilesSelected === 12 && profiles.profiles?.length === 12, 'profile selection count drifted');
const profileBytes = fs.readFileSync(path.join(root, release.source.profileFile));
requireValue(sha256(profileBytes) === release.source.profileSha256, 'selected profile fingerprint drifted');
requireValue(manifest.selectedFromEngineRuns === 1000 && manifest.creatures?.length === 12, 'renderer manifest count drifted');
requireValue(manifest.generatedMarketingArtworkUsed === false, 'generated marketing art entered the renderer proof');

const species = new Set(profiles.profiles.map(item => item.species));
const rarities = new Set(profiles.profiles.map(item => item.rarity));
const geneBodies = new Set(profiles.profiles.map(item => item.geneBody));
const bodies = new Set(profiles.profiles.map(item => item.body));
const heads = new Set(profiles.profiles.map(item => item.head));
const auras = new Set(profiles.profiles.map(item => item.aura));
const personalities = new Set(profiles.profiles.map(item => item.personality));
const mutated = profiles.profiles.filter(item => item.mutations.length).length;
const shiny = profiles.profiles.filter(item => item.shiny).length;
for (const [actual, expected, label] of [[species.size, 7, 'species'], [rarities.size, 5, 'rarity levels'], [geneBodies.size, 11, 'genetics body families'], [bodies.size, 5, 'rendered body forms'], [heads.size, 9, 'head forms'], [auras.size, 6, 'auras'], [personalities.size, 5, 'personalities'], [mutated, 10, 'mutated creatures'], [shiny, 3, 'shiny creatures']]) {
    requireValue(actual === expected, `${label} coverage drifted`);
}

const galleryPath = path.join(root, 'public/press/gameplay/real-creature-showcase', manifest.gallery.filename);
requireValue(fs.existsSync(galleryPath), 'wide renderer gallery is missing');
if (fs.existsSync(galleryPath)) {
    const gallery = fs.readFileSync(galleryPath);
    requireValue(gallery.length === manifest.gallery.bytes && sha256(gallery) === manifest.gallery.sha256, 'wide gallery fingerprint drifted');
}
for (const creature of manifest.creatures || []) {
    const imagePath = path.join(root, 'public/press/gameplay/real-creature-showcase', creature.filename);
    requireValue(fs.existsSync(imagePath), `${creature.id} renderer export is missing`);
    if (fs.existsSync(imagePath)) {
        const image = fs.readFileSync(imagePath);
        requireValue(image.length === creature.bytes && sha256(image) === creature.sha256, `${creature.id} renderer export fingerprint drifted`);
    }
    requireValue(page.includes(creature.filename) && page.includes(creature.id), `${creature.id} is missing from the public page`);
}

requireValue((page.match(/class="creature-specimen"/g) || []).length === 12, 'public page must show exactly twelve specimen cards');
requireValue(page.includes('1,000 times') && page.includes('not the odds of a random hatch') && page.includes('not a promise of endless mathematical uniqueness'), 'public selection boundary drifted');
requireValue(!storefront.includes('id="real-creature-range"') && !storefront.includes('exact export from the game renderer'), 'withdrawn renderer proof returned to the press room');
requireValue(llms.includes('https://mythicalvoid.com/creature-genetics/#meet-the-twelve') && llms.includes('does not represent normal hatch odds'), 'machine-readable discovery or boundary is missing');

const pressExports = press.assets.filter(item => item.kind === 'authentic_running_game_renderer_export');
requireValue(pressExports.length === 12, 'press manifest must contain twelve renderer exports');
requireValue(press.assets.some(item => item.kind === 'branded_renderer_proof_layout_with_authentic_game_sprite_exports'), 'press manifest is missing the wide proof layout');
requireValue(press.realCreatureShowcase?.selectedFromEngineRuns === 1000 && press.realCreatureShowcase?.selectedCreatures === 12, 'press showcase summary drifted');
requireValue(press.realCreatureShowcase?.state === 'withdrawn_visual_quality_failed_do_not_publish', 'press showcase is not marked as withdrawn from promotion');
const preview = previews.pages.find(item => item.route === '/creature-genetics/');
requireValue(preview?.imagePath.endsWith('real-creature-showcase-wide.png') && preview?.classification === 'branded_renderer_proof_layout_with_authentic_game_sprite_exports', 'creature page social preview is not bound to the real gallery');
const signal = signals.entries.find(item => item.id === 'SIGNAL-013');
requireValue(signal?.status === 'live' && signal?.destination === '/creature-genetics/#meet-the-twelve' && signal?.imageClass === 'branded_renderer_proof_layout_with_authentic_game_sprite_exports', 'SIGNAL-013 is missing or drifted');

for (const [field, expected] of Object.entries({ allImagesAreExactRunningRendererExports: true, galleryFrameIsAPlayableGameScene: false, selectionRepresentsNormalHatchOdds: false, absoluteUniquenessClaimed: false, generatedMarketingArtworkUsed: false, creatureSentienceClaimed: false })) {
    requireValue(release.claimBoundaries?.[field] === expected, `claimBoundaries.${field} must be ${expected}`);
}
for (const [field, expected] of Object.entries({ ownedWebsitePublicationAuthorized: true, externalSocialPublicationAuthorized: false, emailOrOutreachSendingAuthorized: false, paidPromotionAuthorized: false, publicRepliesAuthorized: false, directChildContactAuthorized: false, kevinApprovalRequiredBeforeExternalPublication: true, externalActionTaken: false })) {
    requireValue(release.authority?.[field] === expected, `authority.${field} must be ${expected}`);
}
requireValue(release.verification?.productionUrlVerified === false, 'production verification must not be invented before release');
const publicWords = `${page}\n${storefront}\n${JSON.stringify(signal || {})}`;
requireValue(!/\bcompanions?\b/i.test(publicWords), 'retired companion wording is present');
requireValue(!/no two creatures|every creature is unique|infinite unique/i.test(publicWords), 'unsupported uniqueness wording is present');

console.log(JSON.stringify({ valid: failures.length === 0, selected: profiles.profiles.length, species: species.size, rarities: rarities.size, rendererSourceCommit: manifest.sourceCommit, externalPublicationAuthorized: false, failures }, null, 2));
if (failures.length) process.exit(1);
