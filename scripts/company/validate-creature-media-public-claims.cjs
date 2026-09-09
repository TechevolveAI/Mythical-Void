#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const controlledTextFiles = [
    'src/site/storefront.js',
    'public/parents/index.html',
    'public/creature-genetics/index.html',
    'public/press/index.html',
    'public/llms.txt',
    'docs/company/BRAND_AND_CLAIMS_SYSTEM.md',
    'docs/company/STUDIO_TECHNOLOGY_AND_AI_SYSTEM.md',
    'docs/company/content/drafts/MYTHICAL_DIFFERENCE.json'
];
const staleWording = [
    /available only with adult approval/i,
    /unavailable to under-16 profiles/i,
    /age-gated AI layer/i,
    /age-gated services can create AI-generated creature/i,
    /age-gated experimental media/i
];

function validateCreatureMediaClaims(input) {
    const failures = [];
    const requireValue = (condition, message) => { if (!condition) failures.push(message); };
    const allControlledText = Object.values(input.controlledText).join('\n');
    const claim = input.claims.claims?.find(item => item.id === 'CL-009');
    const proof = input.technology.claims?.find(item => item.id === 'TECH-003');
    const release = input.releases.entries?.find(item => item.id === 'UPDATE-031');

    for (const pattern of staleWording) {
        requireValue(!pattern.test(allControlledText), `stale creature-media wording remains: ${pattern}`);
    }

    for (const ageGroup of ['age_under_13', 'age_13_15', 'age_16_17', 'age_18_plus']) {
        requireValue(input.runtimePrivacy.includes(`'${ageGroup}'`), `runtime eligibility is missing ${ageGroup}`);
    }
    requireValue(input.runtimePrivacy.includes('isCreatureMediaAgeGroup(ageGroup)') && !/age_under_13[^\n]+eligible:\s*false/.test(input.runtimePrivacy), 'runtime does not preserve all-age creature-media eligibility');
    requireValue(input.legal.includes('model requests contain no child or player information') && input.legal.includes('selected age range stays on the device and is not sent to an image or video model'), 'legal child and age-range boundary is missing');
    requireValue(input.legal.includes('Cloud Save and friend-linking remain separate and unavailable to profiles that identify as under 16'), 'Cloud Save and friend-linking boundary is not kept separate');

    const homepage = input.controlledText['src/site/storefront.js'];
    requireValue(homepage.includes('fictional creature details') && homepage.includes('not sent to the image or video model'), 'homepage does not explain the creature-only model boundary');
    requireValue(homepage.includes('main adventure keeps working if the extra media is slow or unavailable'), 'homepage does not explain the gameplay fallback');

    const parents = input.controlledText['public/parents/index.html'];
    requireValue(parents.includes('These extras are not about the child') && parents.includes('not sent to the image or video model'), 'family guide does not explain the child and model boundary');
    requireValue(parents.includes('main adventure keeps working'), 'family guide does not explain the gameplay fallback');

    const genetics = input.controlledText['public/creature-genetics/index.html'];
    requireValue(genetics.includes('private Living Portrait or Creature Story Scene') && genetics.includes('not the player’s name, age range'), 'creature genetics page does not explain the private generated-media boundary');

    const press = input.controlledText['public/press/index.html'];
    requireValue(press.includes('private AI-made Living Portrait') && press.includes('without sending information about the player'), 'press page does not carry the current creature-media fact');

    const llms = input.controlledText['public/llms.txt'];
    requireValue(llms.includes('private AI-made Living Portrait or Creature Story Scene') && llms.includes('main game keeps working'), 'machine-readable guide does not carry the current creature-media boundary');

    requireValue(claim?.status === 'qualified' && /every age band/.test(claim?.approvedText || ''), 'CL-009 does not reflect the current all-age creature-only path');
    requireValue(/selected age range and player information are not sent to the model/.test(claim?.conditions || ''), 'CL-009 is missing its provider-data boundary');
    requireValue(proof?.publicStatus === 'approved_with_creature_only_privacy_language' && /every age band/.test(proof?.claim || ''), 'TECH-003 does not reflect the current verified boundary');
    requireValue(proof?.sources?.includes('src/systems/CreatureMediaPrivacy.js') && proof.sources.includes('src/config/legal.json'), 'TECH-003 is missing runtime privacy sources');

    requireValue(release?.status === 'live' && release?.visualKind === 'text_only_release', 'UPDATE-031 is not a live text-only release');
    requireValue(release?.releaseProof?.generatedPortraitObserved === true && release.releaseProof.sanctuaryEntryObserved === true && release.releaseProof.villageHeartRefreshObserved === true, 'UPDATE-031 is missing production-backed feature evidence');
    requireValue(release?.releaseProof?.playerPersonalDataSentToModel === false, 'UPDATE-031 claims player personal data was sent to the model');
    requireValue(release?.releaseProof?.gameplayVisualApproved === false && release.releaseProof.mediaAttached === false, 'UPDATE-031 overstates visual approval or attaches media');
    const releaseBoundary = (release?.releaseProof?.claimBoundary || '').toLowerCase();
    requireValue(
        releaseBoundary.includes('do not prove')
            && ['visual quality', 'play', 'player use', 'enjoyment', 'conversion', 'retention', 'growth'].every(term => releaseBoundary.includes(term)),
        'UPDATE-031 is missing its evidence limits'
    );

    return failures;
}

function read(relativePath) {
    return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
}

function loadCurrent() {
    return {
        controlledText: Object.fromEntries(controlledTextFiles.map(file => [file, read(file)])),
        runtimePrivacy: read('src/systems/CreatureMediaPrivacy.js'),
        legal: read('src/config/legal.json'),
        claims: JSON.parse(read('docs/company/content/claims.json')),
        technology: JSON.parse(read('docs/company/content/technology-proof-map.json')),
        releases: JSON.parse(read('public/updates/releases.json'))
    };
}

function run() {
    const failures = validateCreatureMediaClaims(loadCurrent());
    console.log(JSON.stringify({
        valid: failures.length === 0,
        publicExplanationsChecked: 5,
        allAgeGroupsChecked: 4,
        externalMediaAttached: false,
        visualQualityClaimed: false,
        failures
    }, null, 2));
    if (failures.length) process.exit(1);
}

if (require.main === module) run();

module.exports = { controlledTextFiles, loadCurrent, staleWording, validateCreatureMediaClaims };
