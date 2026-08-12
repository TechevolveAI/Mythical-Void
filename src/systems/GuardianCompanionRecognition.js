export const GUARDIAN_COMPANION_RECOGNITION_SCHEMA_VERSION = 1;

const KNOWN_PERSONALITIES = new Set([
    'curious',
    'playful',
    'gentle',
    'wise',
    'energetic'
]);

const AFFINITY_LABELS = Object.freeze({
    star: 'Stellar',
    moon: 'Lunar',
    nebula: 'Nebula',
    crystal: 'Crystal',
    void: 'Void'
});

const GUARDIAN_OBSERVATIONS = Object.freeze({
    elder_treant: ({ name, signature }) =>
        `${name}, I can feel your ${signature} in the signal beneath these roots.`,
    crystal_golem: ({ name, signature }) =>
        `${name}, these shards remember the frequency of your ${signature}.`,
    nyxvoral: ({ name, signature }) =>
        `${name}, I can trace your ${signature} along a passage you did not claim.`,
    shadow_phoenix: ({ name, signature }) =>
        `${name}, the warm current bends around your ${signature}.`,
    cosmic_titan: ({ name, signature }) =>
        `${name}, your balance accounts for ${signature} without losing resolve.`,
    void_empress: ({ name, signature }) =>
        `${name}, ${signature} is one voice in you, not your whole meaning.`
});

function getValue(gameState, path, fallback = null) {
    const value = gameState?.get?.(path);
    return value === undefined || value === null ? fallback : value;
}

function cleanText(value, fallback, maxLength = 40) {
    if (typeof value !== 'string') return fallback;
    const normalized = value.replace(/[\r\n\t]+/g, ' ').trim();
    return normalized ? normalized.slice(0, maxLength) : fallback;
}

function humanize(value, fallback = 'unfamiliar signal') {
    const clean = cleanText(value, '', 48)
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return clean || fallback;
}

function titleCase(value) {
    return value.replace(/\b\w/g, letter => letter.toUpperCase());
}

function featureLabels(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map(feature => humanize(
            typeof feature === 'string' ? feature : feature?.type,
            ''
        ))
        .filter(Boolean)
        .slice(0, 8);
}

function hashString(value) {
    let hash = 0x811C9DC5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

function selectSignature({ genes, dna, affinityLabel, identitySeed }) {
    const mutations = featureLabels(
        genes?.traits?.features?.wackyMutations
    );
    const specialFeatures = featureLabels(
        genes?.traits?.features?.specialFeatures
    );
    const hybrid = humanize(dna?.hybridTag, '');
    const body = humanize(
        dna?.bodyArchetype || genes?.traits?.bodyShape?.type,
        ''
    );
    const groups = [
        { kind: 'mutation', values: mutations },
        { kind: 'feature', values: specialFeatures },
        {
            kind: 'hybrid',
            values: hybrid && hybrid !== 'single species' ? [hybrid] : []
        },
        { kind: 'body', values: body ? [`${body} form`] : [] },
        { kind: 'affinity', values: [`${affinityLabel.toLowerCase()} signal`] }
    ];
    const selectedGroup = groups.find(group => group.values.length > 0);
    const index = hashString(identitySeed) % selectedGroup.values.length;
    return {
        kind: selectedGroup.kind,
        label: selectedGroup.values[index]
    };
}

export function getGuardianCompanionRecognition(gameState, guardianId) {
    const observation = GUARDIAN_OBSERVATIONS[guardianId];
    if (!observation) return null;

    const genes = getValue(gameState, 'creature.genes', null)
        || getValue(gameState, 'creature.genetics', {})
        || {};
    const dna = getValue(gameState, 'creature.dna', {}) || {};
    const companionName = cleanText(
        getValue(gameState, 'creature.name', 'Companion'),
        'Companion',
        24
    );
    const storedPersonality = getValue(gameState, 'creature.personality', null);
    const personalityCandidate = typeof storedPersonality === 'string'
        ? storedPersonality
        : storedPersonality?.core || genes?.personality?.core;
    const personality = KNOWN_PERSONALITIES.has(personalityCandidate)
        ? personalityCandidate
        : 'curious';
    const affinityCandidate = typeof genes?.cosmicAffinity === 'string'
        ? genes.cosmicAffinity
        : genes?.cosmicAffinity?.element
            || getValue(gameState, 'creature.cosmicElement', null);
    const affinity = Object.prototype.hasOwnProperty.call(
        AFFINITY_LABELS,
        affinityCandidate
    ) ? affinityCandidate : 'star';
    const affinityLabel = AFFINITY_LABELS[affinity];
    const identitySeed = cleanText(
        genes?.id || dna?.id || companionName,
        'companion',
        96
    );
    const signature = selectSignature({
        genes,
        dna,
        affinityLabel,
        identitySeed
    });

    return Object.freeze({
        schemaVersion: GUARDIAN_COMPANION_RECOGNITION_SCHEMA_VERSION,
        guardianId,
        companionId: identitySeed,
        companionName,
        personality,
        affinity,
        affinityLabel,
        signatureKind: signature.kind,
        signatureTrait: signature.label,
        cue: `${personality.toUpperCase()} // ${affinityLabel.toUpperCase()} // ${titleCase(signature.label).toUpperCase()}`,
        line: observation({
            name: companionName,
            signature: signature.label
        })
    });
}

export { GUARDIAN_OBSERVATIONS };
