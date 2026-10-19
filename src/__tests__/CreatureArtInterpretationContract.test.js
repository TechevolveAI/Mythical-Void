const CreaturePortraitSpec = require('../systems/CreaturePortraitSpec.js');
const { _internal: portrait } = require('../../netlify/lib/generate-ai-art-core.cjs');
const videoConfig = require('../config/companion-video-moments.json');

const HEADS = ['feline', 'canine', 'avian', 'reptile', 'aquatic', 'simian', 'insectoid', 'rodent', 'cervine'];
const SPECIES = ['stellarWyrm', 'crystalDrake', 'nebulaSprite', 'voidStalker', 'cosmicGuardian', 'auroraPhoenix', 'crystalElemental'];
const STAGES = ['baby', 'juvenile', 'adult', 'elder'];

function createSpec({ head = 'aquatic', species = 'nebulaSprite', stage = 'baby' } = {}) {
    return CreaturePortraitSpec.create({
        name: 'SYNTHETIC_NAME_NEVER_IN_PROMPT',
        stage,
        dna: { id: 'synthetic-dna-private-art', bodyArchetype: 'blob', headArchetype: head,
            hybridTag: 'single-species', elementalAura: 'moon' },
        genes: {
            id: 'synthetic-creature-private-art', species, rarity: 'uncommon',
            traits: {
                bodyShape: { type: 'blob' },
                colorGenome: { primary: 0x336677, secondary: 0xCCAA44, accent: 0x99CCBB },
                features: { eyes: { size: 'medium' }, wings: { type: 'none', span: 0 },
                    markings: { pattern: 'spots', distribution: 'central' },
                    specialFeatures: [], wackyMutations: [] }
            },
            personality: { core: 'gentle' }, cosmicAffinity: { element: 'moon' }
        }
    });
}

describe('sprite-to-art creative interpretation', () => {
    test.each(HEADS)('%s anatomy is an interpretation, not a primitive-shape extrusion', head => {
        const spec = createSpec({ head });
        const prompt = portrait.buildCreaturePrompt(spec, 'cinematic', { hasReferenceImage: true });
        expect(prompt).toContain('NOT A LITERAL ANATOMICAL BLUEPRINT');
        expect(prompt).toContain('not just surface texture');
        expect(prompt).toContain('RECOGNISABLE, NOT LITERAL');
        expect(prompt).toContain('Head biology: Interpret');
        expect(prompt).toContain('Use these as examples only when the actual traits support them');
        expect(prompt).toContain('do not give every creature those features');
        expect(prompt).not.toContain('Keep the rounded cranial');
        expect(prompt).not.toContain('Keep the compact round cranium');
        expect(prompt).not.toContain('gold triangle');
        expect(prompt).not.toContain('mint ovals');
        expect(prompt).toContain('actual limb and wing count');
        expect(prompt).toContain('recorded mutations');
        expect(prompt).toContain(`body ${spec.palette.body}`);
    });

    test.each(SPECIES.flatMap(species => STAGES.map(stage => [species, stage])))(
        '%s at %s stage receives the shared direction in every supported style', (species, stage) => {
            const spec = createSpec({ species, stage });
            for (const style of portrait.ALLOWED_STYLES) {
                const prompt = portrait.buildCreaturePrompt(spec, style, { hasReferenceImage: true });
                expect(prompt).toContain(`ART DIRECTION // ${portrait.CREATURE_ART_DIRECTION}`);
                expect(prompt).toContain(`A ${stage} `);
                expect(prompt).toContain('preserve the recorded stage and recognisable lineage');
                expect(prompt).toContain('no extra creatures');
                expect(prompt).not.toContain(spec.name);
                expect(prompt).not.toContain(spec.creatureId);
                expect(prompt).not.toContain(spec.identityKey);
                expect(prompt).not.toContain(spec.morphology.dnaId);
            }
        }
    );

    test('genetics-only requests do not pretend an image was supplied', () => {
        const prompt = portrait.buildCreaturePrompt(createSpec(), 'cinematic');
        expect(prompt).not.toContain('IMAGE 1');
        expect(prompt).toContain('identity, not literal geometric construction');
        expect(prompt).toContain('without inventing a different species or unsupported appendages');
    });

    test('effects are not interpreted as new anatomy', () => {
        const prompt = portrait.buildCreaturePrompt(createSpec(), 'cosmic', { hasReferenceImage: true });
        expect(prompt).toContain('Ignore freestanding aura discs, selection rings, floating particles');
        expect(prompt).toContain('only attached biological features supported by the reference and bounded traits');
        expect(prompt).not.toContain('Treat any visible head ring');
    });

    test('hybrid and glitch traits stay one coherent individual', () => {
        const spec = createSpec();
        for (const hybridType of ['dual-hybrid', 'triple-hybrid', 'glitchy']) {
            spec.morphology.hybridType = hybridType;
            const prompt = portrait.buildCreaturePrompt(spec, 'cinematic', { hasReferenceImage: true });
            expect(prompt).toContain('fused traits must resolve into one coherent individual');
            expect(prompt).toMatch(/do not create a second head|duplicated faces/);
        }
    });

    test('art wording does not mutate the identity or change saved cache versioning', () => {
        const spec = createSpec();
        const before = JSON.stringify(spec);
        const first = portrait.buildCreaturePrompt(spec, 'cinematic', { hasReferenceImage: true });
        expect(portrait.buildCreaturePrompt(spec, 'cinematic', { hasReferenceImage: true })).toBe(first);
        expect(JSON.stringify(spec)).toBe(before);
        expect(CreaturePortraitSpec.SCHEMA_VERSION).toBe(1);
        expect(CreaturePortraitSpec.PROMPT_VERSION).toBe('living-portrait-v6-alien-field-atlas');
        expect(spec.identityKey).toBe(createSpec().identityKey);
        expect(portrait.validatePortraitSpec(spec)).toBe(true);
    });

    test('videos preserve the established portrait instead of reinterpreting the sprite again', () => {
        expect(videoConfig.promptVersion).toBe('creature-story-video-v3');
        expect(videoConfig.shotVersion).toBe(3);
        expect(videoConfig.sharedPrompt.identity).toContain('exact identity reference');
        expect(videoConfig.sharedPrompt.identity).toContain('without redesigning it');
        expect(videoConfig.sharedPrompt.motion).toContain('no morphing or duplicated parts');
        expect(videoConfig.providerDataContract.prohibited).toEqual(expect.arrayContaining([
            'player_name', 'creature_name', 'account_id', 'user_id', 'age_or_age_band', 'free_text'
        ]));
    });

    test.each(['storybook', 'watercolor'])('%s honours the painted style without a photography override', style => {
        const prompt = portrait.buildCreaturePrompt(createSpec(), style, { hasReferenceImage: true });
        expect(prompt).toContain('PAINTED MATERIAL AND DEPTH');
        expect(prompt).toContain(style === 'storybook'
            ? 'warm hand-painted storybook illustration'
            : 'traditional watercolor and gouache creature portrait');
        expect(prompt).toContain('Interpret living tissue through the selected painting medium');
        expect(prompt).not.toContain('OPTICAL REALISM GATE');
        expect(prompt).not.toContain('captured by a physical camera');
        expect(prompt).not.toContain('first-contact photograph');
        expect(prompt).not.toContain('no flat illustration');
        expect(prompt).not.toContain('restrained sensor grain');
    });

    test.each(['cinematic', 'cosmic'])('%s retains the photographic creature direction', style => {
        const prompt = portrait.buildCreaturePrompt(createSpec(), style, { hasReferenceImage: true });
        expect(prompt).toContain('OPTICAL REALISM GATE // MANDATORY');
        expect(prompt).toContain('captured by a physical camera');
        expect(prompt).toContain('first-contact photograph');
        expect(prompt).toContain('no flat illustration');
        expect(prompt).not.toContain('PAINTED MATERIAL AND DEPTH');
    });

    test.each(['juvenile', 'adult', 'elder'])('%s portraits are not staged as a new hatch', stage => {
        const prompt = portrait.buildCreaturePrompt(createSpec({ stage }), 'cinematic');
        expect(prompt).toContain('SETTING // THE FEND, SANCTUARY ENCOUNTER');
        expect(prompt).toContain('at its recorded life stage');
        expect(prompt).not.toContain('shortly after hatching');
    });

    test.each(STAGES)('%s carries the approved approachable direction without copying the sample identity', stage => {
        const spec = createSpec({ stage });
        const before = JSON.stringify(spec);
        for (const style of portrait.ALLOWED_STYLES) {
            for (const hasReferenceImage of [true, false]) {
                const prompt = portrait.buildCreaturePrompt(spec, style, { hasReferenceImage });
                expect(prompt).toContain('APPEAL AND PERSONALITY // ALIVE, ALIEN AND APPROACHABLE');
                expect(prompt).toContain('do not sacrifice warmth or readable expression to make it stranger');
                expect(prompt).toContain('not a shared mascot body or colour scheme');
                expect(prompt).toContain('Preserve the recorded eye size and placement');
                expect(prompt).toContain(`body ${spec.palette.body}; head ${spec.palette.head}`);
                expect(prompt).toContain('Use the selected medium for believable depth, tissue and ground contact');
                expect(prompt).not.toContain('not by making it chibi, infantile, or generically cute');
                expect(prompt).not.toContain('MV-0794');
                expect(prompt).not.toContain('purple and yellow');
                if (stage === 'baby') {
                    expect(prompt).toContain('Let a hatchling look young and endearing');
                } else {
                    expect(prompt).toContain('without making an older creature look newly hatched');
                    expect(prompt).not.toContain('Let a hatchling look young and endearing');
                }
            }
        }
        expect(JSON.stringify(spec)).toBe(before);
    });

    test.each([...portrait.ALLOWED_STYLES])('%s retains shared identity and safety constraints', style => {
        const prompt = portrait.buildCreaturePrompt(createSpec(), style, { hasReferenceImage: true });
        expect(prompt).toContain('shortly after hatching');
        expect(prompt).toContain('RECOGNISABLE, NOT LITERAL');
        expect(prompt).toContain('actual limb and wing count');
        expect(prompt).toContain('full body and contact with the terrain visible');
        expect(prompt).toContain('no humans, no astronaut, no human clothing');
        expect(prompt).toContain('no text, no logo, no watermark');
        expect(prompt).toContain('no unrecorded eyes, wings, horns, or limbs');
        expect(prompt).toContain('no horror, no weapons');
        expect(prompt).not.toContain('SYNTHETIC_NAME_NEVER_IN_PROMPT');
    });
});
