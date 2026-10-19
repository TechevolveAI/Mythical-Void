const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { parse } = require('@babel/parser');
const { _internal: portrait } = require('../../netlify/lib/generate-ai-art-core.cjs');
const { POLICY_VERSION, projectPortraitPromptTraits: project } = require('../../netlify/lib/portrait-prompt-traits.cjs');
const { KINDS, STAGES, STYLES, createPromptSpec } = require('./support/portraitPromptFixture.cjs');
const baseline = require('./fixtures/portrait-prompt-baseline.json');
const copy = value => JSON.parse(JSON.stringify(value));

function nodes(node) {
    if (!node || typeof node !== 'object') return [];
    return [node, ...Object.values(node).flatMap(value => Array.isArray(value)
        ? value.flatMap(nodes) : nodes(value))];
}
function literal(node) {
    if (node.type === 'ObjectExpression') return Object.fromEntries(node.properties.map(property =>
        [property.key.name || property.key.value, literal(property.value)]));
    if (node.type === 'ArrayExpression') return node.elements.map(literal);
    if (['StringLiteral', 'NumericLiteral', 'BooleanLiteral', 'NullLiteral'].includes(node.type)) return node.value ?? null;
    if (node.type === 'CallExpression' && node.callee.object?.name === 'Object' && node.callee.property?.name === 'freeze') {
        return literal(node.arguments[0]);
    }
    throw Error('Non-literal trait definition: ' + node.type);
}
const genetics = nodes(parse(fs.readFileSync(path.join(__dirname, '../systems/CreatureGenetics.js'), 'utf8')));
const dna = nodes(parse(fs.readFileSync(path.join(__dirname, '../systems/CreatureDNA.js'), 'utf8'), { sourceType: 'module' }));
const variable = (tree, name) => literal(tree.find(node => node.type === 'VariableDeclarator' && node.id.name === name).init);
const assigned = name => literal(genetics.find(node => node.type === 'AssignmentExpression' &&
    node.left.object?.type === 'ThisExpression' && node.left.property.name === name).right);
const setAt = (object, keys, value) => {
    const parts = keys.split('.'); let target = object;
    for (const part of parts.slice(0, -1)) target = target[part];
    target[parts.at(-1)] = value;
};
const getAt = (object, keys) => keys.split('.').reduce((value, key) => value[key], object);

describe('closed provider-facing portrait vocabulary', () => {
    test('policy is separate from save and portrait-cache versions', () => {
        expect(POLICY_VERSION).toBe('portrait-provider-traits-v1');
        const spec = createPromptSpec();
        expect(spec.schemaVersion).toBe(1);
        expect(spec.promptVersion).toBe('living-portrait-v6-alien-field-atlas');
        const before = copy(spec); project(spec);
        expect(spec).toEqual(before);
    });

    test.each([
        'morphology.bodyArchetype', 'morphology.headArchetype', 'morphology.hybridType',
        'morphology.elementalAura', 'silhouette.bodyType', 'silhouette.geneticBodyType',
        'silhouette.wingType', 'eyes.size', 'eyes.unusualPlacement',
        'markings.pattern', 'markings.distribution', 'variants.shinyType'
    ])('does not forward arbitrary request text in %s', field => {
        const spec = createPromptSpec('shiny-mutated');
        setAt(spec, field, 'SYNTHETIC_PRIVATE_SENTINEL');
        const before = copy(spec);
        expect(portrait.validatePortraitSpec(spec)).toBe(true);
        const prompt = portrait.buildCreaturePrompt(spec, 'cinematic');
        expect(prompt).not.toMatch(/SYNTHETIC_PRIVATE_SENTINEL|synthetic private sentinel/i);
        expect(spec).toEqual(before);
    });

    test('names, identifiers, descriptions and arbitrary feature/ability text stay outside the model prompt', () => {
        const spec = createPromptSpec();
        spec.name = spec.creatureId = spec.identityKey = spec.morphology.dnaId = 'SYNTHETIC_PRIVATE_SENTINEL';
        spec.personality.description = 'SYNTHETIC_PRIVATE_SENTINEL';
        spec.personality.quirks = ['SYNTHETIC_PRIVATE_SENTINEL'];
        spec.affinity.description = 'SYNTHETIC_PRIVATE_SENTINEL';
        spec.affinity.visualEffects = spec.affinity.abilities = ['SYNTHETIC_PRIVATE_SENTINEL'];
        for (const field of ['specialFeatures', 'mutations']) spec[field] = [
            { type: 'SYNTHETIC_PRIVATE_SENTINEL', variant: 'standard' },
            { type: 'rock_texture', variant: 'SYNTHETIC_PRIVATE_SENTINEL' },
            { type: '__proto__', variant: 'constructor' }
        ];
        expect(portrait.buildCreaturePrompt(spec, 'cinematic')).not.toMatch(/synthetic[ _]private[ _]sentinel/i);
        expect(project(spec).specialFeatures).toEqual([]);
        expect(project(spec).mutations).toEqual([]);
    });

    test.each([NaN, Infinity, -Infinity, 'SYNTHETIC_PRIVATE_SENTINEL', { private: 'SYNTHETIC_PRIVATE_SENTINEL' }])(
        'uses a bounded numeric wing span for %j', value => {
            const spec = createPromptSpec(); spec.silhouette.wingSpan = value;
            expect(project(spec).silhouette.wingSpan).toBe(1);
            expect(portrait.buildCreaturePrompt(spec, 'cinematic')).not.toContain('SYNTHETIC_PRIVATE_SENTINEL');
        }
    );

    test('all current DNA categories and genetic body/wing/marking/ability choices retain their exact values', () => {
        const traits = variable(dna, 'DNA_TRAITS');
        const domains = {
            'morphology.bodyArchetype': traits.bodyArchetype.values,
            'morphology.headArchetype': traits.headArchetype.values,
            'morphology.hybridType': traits.hybridTag.values,
            'morphology.elementalAura': traits.elementalAura.values,
            'silhouette.geneticBodyType': variable(genetics, 'shapes'),
            'silhouette.wingType': ['none', ...Object.values(assigned('speciesTemplates')).map(value => value.wingType)],
            'eyes.size': ['small', 'medium', 'large'],
            'markings.pattern': ['none', ...Object.values(variable(genetics, 'patternsByRarity')).flat()],
            'markings.distribution': ['none', ...variable(genetics, 'distributions')],
            'variants.shinyType': variable(genetics, 'shinyTypes').map(value => value.type)
        };
        for (const [field, values] of Object.entries(domains)) for (const value of values) {
            const spec = createPromptSpec(); setAt(spec, field, value);
            expect(getAt(project(spec), field)).toBe(value);
        }
        for (const affinity of Object.values(assigned('cosmicAffinities'))) {
            const spec = createPromptSpec(); spec.affinity.abilities = affinity.specialAbilities;
            expect(project(spec).affinity.abilities).toEqual(affinity.specialAbilities);
        }
    });

    test('all current feature and mutation variants survive without being renamed or replaced', () => {
        const featureTypes = Object.values(variable(genetics, 'featuresByRarity')).flatMap(value => value.features);
        const variantMethod = genetics.find(node => node.type === 'ClassMethod' && node.key.name === 'generateFeatureVariant');
        const featureVariants = variable(nodes(variantMethod), 'variants');
        const mutationVariants = variable(genetics, 'mutationVariants');
        const pairs = featureTypes.flatMap(type => (featureVariants[type] || ['standard', 'enhanced', 'unique'])
            .map(variant => ['specialFeatures', { type, variant }]));
        pairs.push(...Object.entries(mutationVariants).flatMap(([type, variants]) => variants
            .map(variant => ['mutations', { type, variant }])));
        for (const [field, value] of pairs) {
            const spec = createPromptSpec(); spec[field] = [value];
            expect(project(spec)[field]).toEqual([value]);
        }
    });

    test('frozen released prompt matrix is complete, not a subset selected after the change', () => {
        expect(baseline.sourceCommit).toBe('c4e3705cdf5773c2bec896d5fe05c3594bdc425a');
        expect(baseline.cases).toHaveLength(KINDS.length * STAGES.length * STYLES.length * 2);
        const keys = values => values.map(value => JSON.stringify([value.kind, value.stage, value.style, value.hasReferenceImage])).sort();
        const expected = KINDS.flatMap(kind => STAGES.flatMap(stage => STYLES.flatMap(style =>
            [false, true].map(hasReferenceImage => ({ kind, stage, style, hasReferenceImage })))));
        expect(keys(baseline.cases)).toEqual(keys(expected));
    });

    test.each(baseline.cases)('preserves released $kind / $stage / $style / reference=$hasReferenceImage prompt bytes', entry => {
        const spec = createPromptSpec(entry.kind, entry.stage), before = copy(spec);
        const prompt = portrait.buildCreaturePrompt(spec, entry.style, { hasReferenceImage: entry.hasReferenceImage });
        expect(createHash('sha256').update(prompt).digest('hex')).toBe(entry.sha256);
        expect(spec).toEqual(before);
    });
});
