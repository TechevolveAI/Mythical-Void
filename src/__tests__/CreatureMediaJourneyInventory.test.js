const fs = require('node:fs');
const path = require('node:path');
const contract = require('../../docs/planning/CREATURE_MEDIA_PROMPT_CONTRACT.json');
const portraitSpec = require('../systems/CreaturePortraitSpec.js');
const { POLICY_VERSION } = require('../../netlify/lib/portrait-prompt-traits.cjs');
const { _internal: portrait } = require('../../netlify/lib/generate-ai-art-core.cjs');
const { _internal: video } = require('../../netlify/lib/generate-companion-video-core.cjs');
const moments = require('../config/companion-video-moments.json');
const contextSource = fs.readFileSync(path.join(__dirname, '../systems/StoryVideoContext.js'), 'utf8');
const storyVideoContext = new Function(contextSource.replace(/^export /gm, '') + '\nreturn storyVideoContext;')();
const root = path.resolve(__dirname, '../..');

function sourceExists(reference) {
    const file = reference.split('#')[0];
    expect(fs.existsSync(path.join(root, file))).toBe(true);
}

test('portrait contract documents the current identity, prompt and provider projection versions', () => {
    expect(contract.portrait.schemaVersion).toBe(portraitSpec.SCHEMA_VERSION);
    expect(contract.portrait.promptVersion).toBe(portraitSpec.PROMPT_VERSION);
    expect(contract.portrait.artDirectionVersion).toBe(portrait.CREATURE_ART_DIRECTION);
    expect(contract.portrait.providerTraitPolicy).toBe(POLICY_VERSION);
    for (const field of ['clientIdentitySource', 'providerTraitVocabulary', 'authoredPromptBuilder', 'jobOwner']) {
        sourceExists(contract.portrait[field]);
    }
    expect(typeof portrait[contract.portrait.authoredPromptBuilder.split('#')[1]]).toBe('function');
});

test('video contract documents the current source versions and template/builder ownership', () => {
    expect(contract.video.promptVersion).toBe(moments.promptVersion);
    expect(contract.video.shotVersion).toBe(moments.shotVersion);
    for (const field of ['authoredTemplates', 'authoredPromptBuilder', 'jobOwner']) sourceExists(contract.video[field]);
    expect(typeof video[contract.video.authoredPromptBuilder.split('#')[1]]).toBe('function');
});

test('each authored moment is resolvable without interpolating a private suffix into its prompt', () => {
    expect(new Set(moments.moments.map(moment => moment.key)).size).toBe(moments.moments.length);
    for (const moment of moments.moments) {
        const id = moment.match === 'exact' ? moment.key : moment.prefix + 'SYNTHETIC_PRIVATE_SUFFIX';
        for (const field of ['playerLabel', 'location', 'action', 'trigger', 'fallback']) {
            expect(typeof moment[field]).toBe('string');
            expect(moment[field].length).toBeGreaterThan(0);
        }
        expect(video.resolveMomentDefinition(id)).toMatchObject({ key: moment.key });
        const prompt = video.buildPrompt(id, 'baby');
        expect(prompt).toContain(moments.promptVersion);
        expect(prompt).toContain(moment.location);
        expect(prompt).toContain(moment.action);
        expect(prompt).not.toContain('SYNTHETIC_PRIVATE_SUFFIX');
    }
});

test.each([
    ['elder_treant', 'mythicalForest', 'Mythical Forest'],
    ['crystal_golem', 'crystalCaves', 'Crystal Caves'],
    ['nyxvoral', 'cosmicReef', 'Stellar Reef'],
    ['cosmic_titan', 'voidPeaks', 'Void Peaks'],
    ['shadow_phoenix', 'auroraDepths', 'Aurora Depths'],
    ['void_empress', 'finalVoid', 'Final Void']
])('%s rescue uses its authored region in both the provider prompt and the player notice', (id, levelId, label) => {
    const momentId = `guardian_rescue_${id}`;
    expect(storyVideoContext(momentId)).toEqual({ levelId, label: `${label}: freedom after the battle` });
    expect(video.buildPrompt(momentId, 'adult')).toContain(moments.rescueLocations[id]);
});
