/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { createClient } from 'npm:@supabase/supabase-js@2';
import { getSupabaseRuntimeKeys } from '../_shared/supabase-keys.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const affinities = ['star', 'moon', 'nebula', 'crystal', 'void'];
const personalities = ['curious', 'gentle', 'brave', 'playful', 'patient'];

type JsonObject = Record<string, unknown>;

function jsonResponse(status: number, body: JsonObject) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
        }
    });
}

function stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }
    const object = value as JsonObject;
    const entries = Object.keys(object)
        .filter(key => object[key] !== undefined)
        .sort()
        .map(key => `${JSON.stringify(key)}:${stableStringify(object[key])}`);
    return `{${entries.join(',')}}`;
}

function fingerprint(value: unknown) {
    const source = stableStringify(value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return `fnv1a32-v1:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function createRandom(seed: string) {
    let state = parseInt(fingerprint(seed).split(':').pop() || '0', 16) >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function asObject(value: unknown): JsonObject {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as JsonObject
        : {};
}

function sharedParticipantResponse(
    invitationId: string,
    operationId: string,
    role: string,
    result: unknown,
    receipt: unknown,
    replay: boolean
) {
    const outcome = asObject(result);
    const offspring = Array.isArray(outcome.offspring)
        ? outcome.offspring as JsonObject[]
        : [];
    const index = role === 'host' ? 0 : 1;
    const selected = asObject(offspring[index]);
    const selectedData = {
        ...asObject(selected.offspringData)
    };
    delete selectedData.parentIds;
    const safeOffspring = {
        offspringGenes: asObject(selected.offspringGenes),
        offspringData: selectedData
    };
    return {
        invitationId,
        operationId,
        status: 'staged',
        role,
        offspring: safeOffspring,
        compatibilityScore: Number(outcome.compatibilityScore) || 0,
        birthEvents: Array.isArray(outcome.birthEvents)
            ? outcome.birthEvents
            : [],
        receipt: asObject(receipt),
        replay
    };
}

function pick<T>(values: T[], random: () => number): T {
    return values[Math.floor(random() * values.length)] || values[0];
}

function affinityElement(parent: JsonObject) {
    const direct = parent.cosmicAffinity;
    const genes = asObject(parent.genes);
    const inherited = genes.cosmicAffinity;
    if (typeof direct === 'string') return direct;
    if (typeof asObject(direct).element === 'string') {
        return String(asObject(direct).element);
    }
    if (typeof inherited === 'string') return inherited;
    if (typeof asObject(inherited).element === 'string') {
        return String(asObject(inherited).element);
    }
    return null;
}

function colorValue(value: unknown, fallback: number) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, Math.min(0xFFFFFF, Math.round(value)));
    }
    const object = asObject(value);
    for (const key of ['color', 'hex', 'value', 'primary']) {
        if (typeof object[key] === 'number') {
            return colorValue(object[key], fallback);
        }
    }
    return fallback;
}

function parentColors(parent: JsonObject) {
    const genes = asObject(parent.genes);
    const traits = asObject(genes.traits);
    return asObject(traits.colorGenome);
}

function parentMutations(parent: JsonObject) {
    const genes = asObject(parent.genes);
    const traits = asObject(genes.traits);
    const features = asObject(traits.features);
    return Array.isArray(features.wackyMutations)
        ? features.wackyMutations.map(asObject)
        : [];
}

function inheritParentMutations(
    parent1: JsonObject,
    parent2: JsonObject,
    rarity: string,
    random: () => number
) {
    const byType = new Map<string, JsonObject>();
    [...parentMutations(parent1), ...parentMutations(parent2)]
        .forEach(mutation => {
            const type = String(mutation.type || '');
            if (!type) return;
            const current = byType.get(type);
            if (
                !current ||
                Number(mutation.dominance) > Number(current.dominance)
            ) {
                byType.set(type, mutation);
            }
        });
    const maxByRarity: Record<string, number> = {
        common: 1,
        uncommon: 2,
        rare: 2,
        epic: 3,
        legendary: 4
    };
    return [...byType.values()]
        .filter(mutation => (
            random() < Math.max(0, Math.min(0.95,
                Number(mutation.dominance || 0.5) * 0.7
            ))
        ))
        .map(mutation => ({
            ...mutation,
            inherited: true,
            intensity: Math.max(0.2, Math.min(0.9,
                Number(mutation.intensity || 0.5) + (random() - 0.5) * 0.2
            )),
            dominance: Math.max(0.2, Math.min(0.95,
                Number(mutation.dominance || 0.5) + (random() - 0.5) * 0.15
            ))
        }))
        .slice(0, maxByRarity[rarity] || 2);
}

function blendHex(first: number, second: number, ratio: number) {
    const mix = (shift: number) => Math.round(
        ((first >> shift) & 0xFF) * (1 - ratio) +
        ((second >> shift) & 0xFF) * ratio
    );
    return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

const mendelianTraits: Record<string, {
    name: string;
    variations: Record<string, { dominant: boolean }>;
}> = {
    bodyShape: {
        name: 'Body Shape',
        variations: {
            slender: { dominant: false },
            normal: { dominant: true },
            stocky: { dominant: false }
        }
    },
    eyeColor: {
        name: 'Eye Color',
        variations: {
            blue: { dominant: false },
            green: { dominant: false },
            amber: { dominant: true },
            violet: { dominant: true }
        }
    },
    pattern: {
        name: 'Pattern',
        variations: {
            solid: { dominant: true },
            spotted: { dominant: false },
            striped: { dominant: false }
        }
    },
    horns: {
        name: 'Horns',
        variations: {
            none: { dominant: false },
            small: { dominant: true },
            large: { dominant: true }
        }
    },
    tail: {
        name: 'Tail',
        variations: {
            short: { dominant: false },
            medium: { dominant: true },
            long: { dominant: false }
        }
    },
    earShape: {
        name: 'Ear Shape',
        variations: {
            rounded: { dominant: true },
            pointed: { dominant: false }
        }
    },
    maneLength: {
        name: 'Mane Length',
        variations: {
            short: { dominant: false },
            medium: { dominant: true },
            long: { dominant: false }
        }
    }
};

function deterministicIndex(seed: string, length: number) {
    const hash = fingerprint(seed).split(':').pop() || '0';
    return length > 0 ? parseInt(hash, 16) % length : 0;
}

function visibleMendelianAllele(
    traitKey: string,
    genes: JsonObject,
    variations: string[]
) {
    const traits = asObject(genes.traits);
    const bodyShape = String(asObject(traits.bodyShape).type || '').toLowerCase();
    const features = asObject(traits.features);
    const mutations = Array.isArray(features.wackyMutations)
        ? features.wackyMutations.map(value => String(asObject(value).type || ''))
        : [];
    if (traitKey === 'bodyShape') {
        if (/slender|serpentine|avian/.test(bodyShape)) return 'slender';
        if (/stocky|sturdy|quadruped/.test(bodyShape)) return 'stocky';
        return 'normal';
    }
    if (traitKey === 'pattern') {
        const markings = asObject(features.markings);
        const pattern = String(markings.pattern || '').toLowerCase();
        if (/spot|speck|dot/.test(pattern)) return 'spotted';
        if (/stripe|band|line/.test(pattern)) return 'striped';
        return 'solid';
    }
    if (traitKey === 'horns') {
        return mutations.includes('cosmic_horns') ? 'large' : 'none';
    }
    if (traitKey === 'tail') {
        if (/serpentine|fish|reptil/.test(bodyShape)) return 'long';
        return mutations.includes('phantom_limbs') ? 'medium' : 'short';
    }
    if (traitKey === 'maneLength' && mutations.includes('feather_mane')) {
        return 'long';
    }
    return variations[deterministicIndex(
        `${stableStringify({
            id: genes.id || null,
            species: genes.species || null,
            rarity: genes.rarity || null,
            bodyShape,
            traits
        })}:${traitKey}:expressed`,
        variations.length
    )];
}

function resolveMendelian(parent: JsonObject) {
    const genes = asObject(parent.genes);
    const stored = asObject(genes.mendelianGenes);
    const seed = stableStringify({
        creatureId: parent.id || null,
        geneticId: genes.id || null,
        species: genes.species || null,
        rarity: genes.rarity || parent.rarity || null,
        traits: genes.traits || null,
        affinity: genes.cosmicAffinity || parent.cosmicAffinity || null,
        personality: genes.personality || parent.personality || null
    });

    return Object.fromEntries(Object.entries(mendelianTraits).map(
        ([traitKey, definition]) => {
            const variations = Object.keys(definition.variations);
            const storedAlleles = Array.isArray(stored[traitKey])
                ? (stored[traitKey] as unknown[])
                    .filter(value => variations.includes(String(value)))
                    .map(String)
                    .slice(0, 2)
                : [];
            const alleles = [...storedAlleles];
            if (alleles.length < 2) {
                alleles.push(visibleMendelianAllele(
                    traitKey,
                    genes,
                    variations
                ));
            }
            if (alleles.length < 2) {
                alleles.push(variations[deterministicIndex(
                    `${seed}:${traitKey}:carrier`,
                    variations.length
                )]);
            }
            return [traitKey, alleles.slice(0, 2).sort()];
        }
    ));
}

function phenotypeFor(genes: Record<string, string[]>) {
    return Object.fromEntries(Object.entries(mendelianTraits).map(
        ([traitKey, definition]) => {
            const variations = Object.keys(definition.variations);
            const alleles = Array.isArray(genes[traitKey])
                ? genes[traitKey]
                : [variations[0], variations[0]];
            const first = variations.includes(alleles[0])
                ? alleles[0]
                : variations[0];
            const second = variations.includes(alleles[1])
                ? alleles[1]
                : variations[0];
            const firstDominant = definition.variations[first].dominant;
            const secondDominant = definition.variations[second].dominant;
            return [traitKey, firstDominant || !secondDominant ? first : second];
        }
    ));
}

function crossoverMendelian(
    parent1: JsonObject,
    parent2: JsonObject,
    random: () => number
) {
    const p1 = resolveMendelian(parent1);
    const p2 = resolveMendelian(parent2);
    const inheritance: Record<string, JsonObject> = {};
    const genes = Object.fromEntries(Object.keys(mendelianTraits).map(key => {
        const parent1Allele = pick(p1[key], random);
        const parent2Allele = pick(p2[key], random);
        const childAlleles = [parent1Allele, parent2Allele].sort();
        const expressedAllele = phenotypeFor({ [key]: childAlleles })[key];
        inheritance[key] = {
            trait: mendelianTraits[key].name,
            parent1Allele,
            parent2Allele,
            expressedAllele,
            expressedFrom: parent1Allele === parent2Allele
                ? 'both'
                : expressedAllele === parent1Allele
                    ? 'parent1'
                    : 'parent2'
        };
        return [key, childAlleles];
    }));
    return { genes, inheritance };
}

const eventDefinitions = [
    { id: 'favoredTrait', name: 'Favored Trait', chance: 0.10, rarity: 'common', message: 'Inherited a strongly expressed trait.' },
    { id: 'healthyBirth', name: 'Healthy Birth', chance: 0.10, rarity: 'common', message: 'Born with exceptional vitality.' },
    { id: 'cosmicBlessing', name: 'Cosmic Blessing', chance: 0.05, rarity: 'uncommon', message: 'The Current amplified this lineage.' },
    { id: 'dualAffinity', name: 'Dual Affinity', chance: 0.03, rarity: 'uncommon', message: 'Both parent affinities remain active.' },
    { id: 'mutationJackpot', name: 'Mutation Jackpot', chance: 0.01, rarity: 'rare', message: 'Three unusual traits stabilized together.' },
    { id: 'ancestralEcho', name: 'Ancestral Echo', chance: 0.01, rarity: 'rare', message: 'An older lineage signal resurfaced.' },
    { id: 'shinyVariant', name: 'Shiny Variant', chance: 0.002, rarity: 'ultraRare', message: 'A rare luminous pattern stabilized.' },
    { id: 'ancientLineage', name: 'Ancient Lineage', chance: 0.001, rarity: 'ultraRare', message: 'The lineage carries a signal older than either parent.' },
    { id: 'prophecyChild', name: 'Child of Prophecy', chance: 0.001, rarity: 'legendary', message: 'Project Beacon cannot classify this Current signature.' }
];

function rollEvents(
    parent1: JsonObject,
    parent2: JsonObject,
    rarity: string,
    offspringCount: number,
    generatedAt: number,
    random: () => number
) {
    const generation = Math.max(
        Number(parent1.generation) || 1,
        Number(parent2.generation) || 1
    );
    const rarityMultiplier = rarity === 'legendary'
        ? 2
        : rarity === 'epic'
            ? 1.5
            : 1;
    const generationMultiplier = generation >= 4
        ? 1.56
        : generation >= 3
            ? 1.2
            : 1;
    const parentAffinities = [
        affinityElement(parent1),
        affinityElement(parent2)
    ];
    const events = eventDefinitions.filter(event => {
        if (
            event.id === 'dualAffinity' &&
            (!parentAffinities[0] ||
                !parentAffinities[1] ||
                parentAffinities[0] === parentAffinities[1])
        ) {
            return false;
        }
        return random() < event.chance * rarityMultiplier * generationMultiplier;
    }).map(event => ({
        ...event,
        triggeredAt: generatedAt
    }));

    if (offspringCount === 2) {
        events.push({
            id: 'twinBirth',
            name: 'Twin Birth',
            chance: 1,
            rarity: 'ultraRare',
            message: 'Two stable Current signatures emerged.',
            triggeredAt: generatedAt
        });
    }
    return events;
}

function secretAbilities(
    creature: JsonObject,
    random: () => number,
    generatedAt: number
) {
    const affinity = String(asObject(creature.cosmicAffinity).element || '');
    const generation = Number(creature.generation) || 1;
    const rarity = String(creature.rarity || 'common');
    const rarityIndex = rarities.indexOf(rarity);
    const candidates = [
        {
            id: 'voidStrike',
            name: 'Void Strike',
            description: 'Phase through enemy defenses',
            chance: 0.15,
            valid: affinity === 'void' && generation >= 3,
            effect: { damageBonus: 1.5, ignoreDefense: true }
        },
        {
            id: 'crystalShield',
            name: 'Crystal Shield',
            description: 'Create a brief protective barrier',
            chance: 0.12,
            valid: affinity === 'crystal' && rarityIndex >= 2,
            effect: { duration: 3000, absorb: 50 }
        },
        {
            id: 'novaBlast',
            name: 'Nova Blast',
            description: 'Release a focused area burst',
            chance: 0.10,
            valid: affinity === 'star' && generation >= 2,
            effect: { aoeRadius: 150, damage: 2 }
        },
        {
            id: 'bloodlineMemory',
            name: 'Bloodline Memory',
            description: 'Retain strength from earlier generations',
            chance: 0.20,
            valid: generation >= 4,
            effect: { statBonusPerGen: 0.05 }
        }
    ];
    return candidates
        .filter(candidate => candidate.valid && random() < candidate.chance)
        .map(({ valid: _valid, ...ability }) => ({
            ...ability,
            unlockedAt: generatedAt
        }));
}

function createOutcome(context: JsonObject) {
    const operationId = String(context.operationId);
    const resultSeed = String(context.resultSeed);
    const parentRecords = context.parentRecords as JsonObject[];
    const parent1 = asObject(parentRecords[0]);
    const parent2 = asObject(parentRecords[1]);
    const offspringIds = context.offspringIds as string[];
    const offspringCount = Number(context.offspringCount);
    const random = createRandom(resultSeed);
    const compatibilityScore = 50 + Math.floor(random() * 41);
    const averageRarity = Math.floor((
        Math.max(0, rarities.indexOf(String(parent1.rarity || 'common'))) +
        Math.max(0, rarities.indexOf(String(parent2.rarity || 'common')))
    ) / 2);
    const upgradeChance = Math.min(
        20 + Math.floor(compatibilityScore / 10),
        40
    ) / 100;
    let rarityIndex = averageRarity;
    if (random() < upgradeChance && rarityIndex < rarities.length - 1) {
        rarityIndex += 1;
    }
    let rarity = rarities[rarityIndex];
    const generatedAt = Number(new Date(String(context.reservedAt)).getTime()) ||
        Date.now();
    const events = rollEvents(
        parent1,
        parent2,
        rarity,
        offspringCount,
        generatedAt,
        random
    );
    if (events.some(event => event.id === 'shinyVariant')) {
        rarity = rarities[Math.min(rarities.indexOf(rarity) + 1, 4)];
    }
    if (events.some(event => event.id === 'prophecyChild')) {
        rarity = 'legendary';
    }

    const p1Colors = parentColors(parent1);
    const p2Colors = parentColors(parent2);
    const p1Affinity = affinityElement(parent1);
    const p2Affinity = affinityElement(parent2);
    const generation = Math.max(
        Number(parent1.generation) || 1,
        Number(parent2.generation) || 1
    ) + 1;

    const offspring = offspringIds.map((creatureId, index) => {
        const individualRandom = createRandom(`${resultSeed}:offspring:${index + 1}`);
        const affinity = p1Affinity && p2Affinity
            ? pick([p1Affinity, p2Affinity], individualRandom)
            : p1Affinity || p2Affinity || pick(affinities, individualRandom);
        const primary = colorValue(p1Colors.primary, 0x4CAF50);
        const secondary = colorValue(p2Colors.secondary, 0x7E57C2);
        const accent = blendHex(
            colorValue(p1Colors.accent, 0xFFEB3B),
            colorValue(p2Colors.accent, 0x80DEEA),
            individualRandom()
        );
        const crossover = crossoverMendelian(
            parent1,
            parent2,
            individualRandom
        );
        const mendelianGenes = crossover.genes;
        const phenotype = phenotypeFor(mendelianGenes);
        const eyeColors: Record<string, number> = {
            blue: 0x4169E1,
            green: 0x228B22,
            amber: 0xFF8C00,
            violet: 0x8A2BE2
        };
        const bodyTypes: Record<string, string> = {
            slender: 'slender',
            normal: 'balanced',
            stocky: 'sturdy'
        };
        const markingPatterns: Record<string, string> = {
            solid: 'none',
            spotted: 'spots',
            striped: 'stripes'
        };
        const inheritedMutations = inheritParentMutations(
            parent1,
            parent2,
            rarity,
            individualRandom
        );
        const genes = {
            id: `genes_${creatureId}`,
            species: 'currentHybrid',
            rarity,
            cosmicAffinity: {
                element: affinity,
                powerLevel: 0.5 + individualRandom() * 0.35
            },
            personality: {
                core: pick(personalities, individualRandom)
            },
            metadata: {
                generatedAt,
                fusionResultSeed: resultSeed,
                authority: 'server_generated',
                executionVersion: 'fusion-outcome-v1'
            },
            traits: {
                colorGenome: {
                    primary: blendHex(primary, secondary, 0.25 + individualRandom() * 0.25),
                    secondary: blendHex(secondary, primary, 0.2 + individualRandom() * 0.3),
                    accent,
                    shimmerIntensity: rarityIndex / 4,
                    colorComplexity: 0.55 + individualRandom() * 0.35
                },
                bodyShape: {
                    type: bodyTypes[String(phenotype.bodyShape)] || 'balanced',
                    intensity: 0.4 + individualRandom() * 0.4
                },
                features: {
                    eyes: {
                        size: 'medium',
                        color: eyeColors[String(phenotype.eyeColor)] || 0x4169E1,
                        glow: 0.7 + individualRandom() * 0.3
                    },
                    wings: {
                        type: individualRandom() < 0.5 ? 'feathered' : 'energy',
                        span: 0.65 + individualRandom() * 0.35,
                        shimmer: 0.5 + individualRandom() * 0.5
                    },
                    markings: {
                        pattern: markingPatterns[String(phenotype.pattern)] || 'none',
                        intensity: phenotype.pattern === 'solid' ? 0 : 0.7,
                        opacity: 0.65,
                        scale: 0.5,
                        distribution: 'balanced'
                    },
                    specialFeatures: [],
                    wackyMutations: inheritedMutations
                },
                breedingVisuals: null
            },
            mendelianGenes,
            phenotype,
            inheritance: crossover.inheritance
        };
        const dualAffinity = events.some(event => event.id === 'dualAffinity') &&
            p1Affinity &&
            p2Affinity &&
            p1Affinity !== p2Affinity
            ? { primary: p1Affinity, secondary: p2Affinity }
            : null;
        const offspringData: JsonObject = {
            creatureId,
            generation,
            rarity,
            inheritedTraits: {
                fromParent1: Object.values(crossover.inheritance)
                    .filter(value => (
                        value.expressedFrom === 'parent1' ||
                        value.expressedFrom === 'both'
                    ))
                    .map(value => String(value.trait)),
                fromParent2: Object.values(crossover.inheritance)
                    .filter(value => (
                        value.expressedFrom === 'parent2' ||
                        value.expressedFrom === 'both'
                    ))
                    .map(value => String(value.trait)),
                details: crossover.inheritance
            },
            parentIds: [String(parent1.id), String(parent2.id)],
            offspringBonus: {
                cosmicPower: (1 + generation * 0.05) *
                    (events.some(event => event.id === 'cosmicBlessing') ? 2 : 1),
                description: `Dual Descent (Gen ${generation})`
            },
            birthEvents: events.map(event => ({
                id: event.id,
                name: event.name,
                message: event.message,
                rarity: event.rarity,
                triggeredAt: event.triggeredAt
            })),
            isShiny: events.some(event => event.id === 'shinyVariant'),
            hasDualAffinity: Boolean(dualAffinity),
            dualAffinity,
            compatibilityScore
        };
        offspringData.secretAbilities = secretAbilities({
            ...offspringData,
            cosmicAffinity: genes.cosmicAffinity
        }, individualRandom, generatedAt);

        return { offspringGenes: genes, offspringData };
    });

    return {
        schemaVersion: 1,
        operationId,
        executionVersion: 'fusion-outcome-v1',
        generatedAt,
        compatibilityScore,
        offspringCount,
        isTwinBirth: offspringCount === 2,
        offspring,
        birthEvents: events,
        hasRareEvent: events.some(event => (
            ['rare', 'ultraRare', 'legendary'].includes(event.rarity)
        ))
    };
}

Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }
    if (request.method !== 'POST') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }

    const authorization = request.headers.get('Authorization');
    if (!authorization) {
        return jsonResponse(401, { error: 'Authentication required' });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const { publishableKey, secretKey } = getSupabaseRuntimeKeys();
    if (!supabaseUrl || !publishableKey || !secretKey) {
        return jsonResponse(500, { error: 'Fusion execution is not configured' });
    }

    let body: JsonObject;
    try {
        body = await request.json();
    } catch {
        return jsonResponse(400, { error: 'Invalid request body' });
    }
    let operationId = typeof body.operationId === 'string'
        ? body.operationId
        : '';
    const invitationId = typeof body.invitationId === 'string'
        ? body.invitationId.toLowerCase()
        : '';
    const hasInvitation = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        invitationId
    );
    if (
        !hasInvitation &&
        !/^fusion_[A-Za-z0-9_-]{1,160}$/.test(operationId)
    ) {
        return jsonResponse(400, { error: 'Invalid Fusion operation' });
    }

    const callerClient = createClient(supabaseUrl, publishableKey, {
        global: {
            headers: { Authorization: authorization }
        },
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    });
    const userResult = await callerClient.auth.getUser();
    if (userResult.error || !userResult.data.user) {
        return jsonResponse(401, { error: 'Cloud identity could not be verified' });
    }
    const serviceClient = createClient(supabaseUrl, secretKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    });
    let operationOwnerId = userResult.data.user.id;
    let sharedRole = '';
    if (hasInvitation) {
        const resolved = await serviceClient.rpc(
            'resolve_shared_fusion_execution',
            {
                p_user_id: userResult.data.user.id,
                p_invitation_id: invitationId
            }
        );
        if (resolved.error) {
            console.error(
                '[execute-fusion] Shared invitation failed:',
                resolved.error.message
            );
            return jsonResponse(409, {
                error: 'Shared Fusion invitation is not executable'
            });
        }
        const resolution = asObject(resolved.data);
        operationOwnerId = String(resolution.operationOwnerId || '');
        operationId = String(resolution.operationId || '');
        sharedRole = String(resolution.role || '');
        if (
            !operationOwnerId ||
            !/^fusion_shared_[A-Za-z0-9_-]{1,160}$/.test(operationId) ||
            !['host', 'guest'].includes(sharedRole)
        ) {
            return jsonResponse(409, {
                error: 'Shared Fusion invitation is invalid'
            });
        }
    }

    const contextResult = await serviceClient.rpc(
        'get_fusion_execution_context',
        {
            p_user_id: operationOwnerId,
            p_operation_id: operationId
        }
    );
    if (contextResult.error) {
        console.error('[execute-fusion] Context failed:', contextResult.error.message);
        return jsonResponse(409, { error: 'Fusion operation is not executable' });
    }
    const context = asObject(contextResult.data);
    if (context.shared === true && !sharedRole) {
        return jsonResponse(403, {
            error: 'Shared Fusion requires its protected invitation'
        });
    }
    if (context.replay === true && context.result && context.receipt) {
        if (sharedRole) {
            return jsonResponse(200, sharedParticipantResponse(
                invitationId,
                operationId,
                sharedRole,
                context.result,
                context.receipt,
                true
            ));
        }
        return jsonResponse(200, {
            operationId,
            outcome: context.result,
            receipt: context.receipt,
            replay: true
        });
    }

    try {
        const outcome = createOutcome(context);
        const receiptBase = {
            schemaVersion: 1,
            operationId,
            authority: 'server_generated',
            executionVersion: 'fusion-outcome-v1',
            requestFingerprint: String(context.requestFingerprint),
            serverFingerprint: String(context.serverFingerprint),
            resultFingerprint: fingerprint(outcome),
            resultSeed: String(context.resultSeed),
            completedAt: outcome.generatedAt
        };
        const receipt = {
            ...receiptBase,
            receiptFingerprint: fingerprint(receiptBase)
        };
        const staged = await serviceClient.rpc(
            'stage_fusion_operation_result',
            {
                p_user_id: operationOwnerId,
                p_operation_id: operationId,
                p_server_fingerprint: context.serverFingerprint,
                p_result: outcome,
                p_receipt: receipt
            }
        );
        if (staged.error) {
            console.error('[execute-fusion] Stage failed:', staged.error.message);
            return jsonResponse(409, { error: 'Fusion result could not be staged' });
        }
        if (sharedRole) {
            return jsonResponse(200, sharedParticipantResponse(
                invitationId,
                operationId,
                sharedRole,
                staged.data.result,
                staged.data.receipt,
                Boolean(staged.data.replay)
            ));
        }
        return jsonResponse(200, {
            operationId,
            outcome: staged.data.result,
            receipt: staged.data.receipt,
            replay: Boolean(staged.data.replay)
        });
    } catch (error) {
        console.error('[execute-fusion] Generation failed:', error);
        return jsonResponse(500, { error: 'Fusion result could not be generated' });
    }
});
