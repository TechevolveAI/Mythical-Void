export const CREATURE_POWER_PROFILE_SCHEMA_VERSION = 1;

const PERSONALITY_AFFINITY_FALLBACK = Object.freeze({
    curious: 'nebula',
    playful: 'star',
    gentle: 'moon',
    wise: 'crystal',
    energetic: 'star'
});

export const CREATURE_POWER_DEFINITIONS = Object.freeze({
    star: Object.freeze({
        affinity: 'star',
        label: 'Stellar',
        color: 0xFFD54F,
        innateSkillId: 'radiant_pulse',
        affinityPower: Object.freeze({
            id: 'radiant_pulse',
            name: 'Radiant Pulse',
            description: 'Reveals hidden routes and releases concentrated stellar light.',
            icon: '✨',
            type: 'exploration',
            color: 0xFFD54F,
            range: '300px radius',
            displayRange: 'Medium range',
            benefit: 'Expose hidden paths and overwhelm darkness'
        }),
        protectiveResponse: Object.freeze({
            id: 'solar_shelter',
            name: 'Solar Shelter',
            effect: 'Forms a heatless stellar barrier around nearby allies.'
        }),
        partnershipMove: Object.freeze({
            id: 'beacon_flare',
            name: 'Beacon Flare',
            effect: 'Combines the suit scanner and stellar light into a precise rescue signal.'
        }),
        highPowerReveal: Object.freeze({
            id: 'daybreak_event',
            name: 'Daybreak Event',
            effect: 'Turns night into daylight across the visible horizon for several seconds.'
        }),
        earthExpression: 'Can power a rescue zone or create a flare visible across a city.'
    }),
    moon: Object.freeze({
        affinity: 'moon',
        label: 'Lunar',
        color: 0xC7D2E8,
        innateSkillId: 'lunar_sight',
        affinityPower: Object.freeze({
            id: 'lunar_sight',
            name: 'Lunar Sight',
            description: 'Reads concealed movement, rare materials, and danger through reflected light.',
            icon: '🌙',
            type: 'exploration',
            color: 0xC7D2E8,
            range: '400px radius',
            displayRange: 'Long range',
            benefit: 'Reveal threats and valuable traces others cannot see'
        }),
        protectiveResponse: Object.freeze({
            id: 'dream_shield',
            name: 'Dream Shield',
            effect: 'Slows incoming force inside a silent protective field.'
        }),
        partnershipMove: Object.freeze({
            id: 'silent_crossing',
            name: 'Silent Crossing',
            effect: 'Masks the pair from hostile senses while they move together.'
        }),
        highPowerReveal: Object.freeze({
            id: 'stillnight_event',
            name: 'Stillnight Event',
            effect: 'Suspends hostile motion across a large area without harming living beings.'
        }),
        earthExpression: 'Can hide a moving group or stop a public disaster in near silence.'
    }),
    nebula: Object.freeze({
        affinity: 'nebula',
        label: 'Nebula',
        color: 0xB58AE8,
        innateSkillId: 'mist_veil',
        affinityPower: Object.freeze({
            id: 'mist_veil',
            name: 'Mist Veil',
            description: 'Shapes cosmic mist that hides movement and confuses hostile attention.',
            icon: '🌫️',
            type: 'defensive',
            color: 0xB58AE8,
            range: '150px radius',
            displayRange: 'Short range',
            benefit: 'Hide allies, break pursuit, and redirect attention'
        }),
        protectiveResponse: Object.freeze({
            id: 'empathic_screen',
            name: 'Empathic Screen',
            effect: 'Wraps frightened allies in mist that disrupts hostile intent.'
        }),
        partnershipMove: Object.freeze({
            id: 'shared_veil',
            name: 'Shared Veil',
            effect: 'Extends concealment by matching the astronaut and creature breathing rhythm.'
        }),
        highPowerReveal: Object.freeze({
            id: 'skyfold_event',
            name: 'Skyfold Event',
            effect: 'Folds a vast wall of living mist across an entire battlefield.'
        }),
        earthExpression: 'Can conceal streets or blind a surveillance network, but the anomaly is measurable.'
    }),
    crystal: Object.freeze({
        affinity: 'crystal',
        label: 'Crystal',
        color: 0x66C7D4,
        innateSkillId: 'crystal_sense',
        affinityPower: Object.freeze({
            id: 'crystal_sense',
            name: 'Crystal Sense',
            description: 'Reads resonance, stored memory, and structural weakness through crystal matter.',
            icon: '💎',
            type: 'exploration',
            color: 0x66C7D4,
            range: '350px radius',
            displayRange: 'Medium range',
            benefit: 'Find resonance, repair fractures, and redirect energy'
        }),
        protectiveResponse: Object.freeze({
            id: 'resonant_bastion',
            name: 'Resonant Bastion',
            effect: 'Grows a temporary crystal shelter around threatened allies.'
        }),
        partnershipMove: Object.freeze({
            id: 'resonant_edge_link',
            name: 'Resonant Edge Link',
            effect: 'Routes creature resonance through the Earth-forged katana with exact control.'
        }),
        highPowerReveal: Object.freeze({
            id: 'worldglass_event',
            name: 'Worldglass Event',
            effect: 'Raises a crystal lattice capable of stabilizing a collapsing region.'
        }),
        earthExpression: 'Can disable Beacon machinery or hold failing infrastructure together.'
    }),
    void: Object.freeze({
        affinity: 'void',
        label: 'Void',
        color: 0x8C6BD6,
        innateSkillId: 'void_sense',
        affinityPower: Object.freeze({
            id: 'void_sense',
            name: 'Void Sense',
            description: 'Perceives hidden space, sealed routes, and unstable dimensional boundaries.',
            icon: '🌑',
            type: 'exploration',
            color: 0x8C6BD6,
            range: '500px radius',
            displayRange: 'Long range',
            benefit: 'Discover sealed paths and contain spatial danger'
        }),
        protectiveResponse: Object.freeze({
            id: 'rift_refusal',
            name: 'Rift Refusal',
            effect: 'Cancels a dangerous spatial rupture before it reaches nearby life.'
        }),
        partnershipMove: Object.freeze({
            id: 'shadow_step_pair',
            name: 'Paired Shadow Step',
            effect: 'Moves the astronaut and creature together across a sealed boundary.'
        }),
        highPowerReveal: Object.freeze({
            id: 'horizon_lock_event',
            name: 'Horizon Lock',
            effect: 'Holds a massive dimensional breach closed through force of will.'
        }),
        earthExpression: 'Can cross secure structures or contain a breach that human technology cannot reach.'
    })
});

function getValue(gameState, path, fallback = null) {
    const value = gameState?.get?.(path);
    return value === undefined || value === null ? fallback : value;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function normalizeIdentifier(value, fallback = 'unknown', maxLength = 96) {
    if (typeof value !== 'string') {
        return fallback;
    }

    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9:_-]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return normalized ? normalized.slice(0, maxLength) : fallback;
}

export function getCreatureAffinity(gameState) {
    const genes = getValue(gameState, 'creature.genes', null)
        || getValue(gameState, 'creature.genetics', {});
    const affinityValue = genes?.cosmicAffinity;
    const affinity = typeof affinityValue === 'string'
        ? affinityValue
        : affinityValue?.element;

    if (CREATURE_POWER_DEFINITIONS[affinity]) {
        return affinity;
    }

    const personality = getValue(gameState, 'creature.personality.core', null)
        || genes?.personality?.core;
    return PERSONALITY_AFFINITY_FALLBACK[personality] || 'star';
}

export function buildCreaturePowerProfile(gameState, {
    context = 'fend'
} = {}) {
    const genes = getValue(gameState, 'creature.genes', null)
        || getValue(gameState, 'creature.genetics', {});
    const affinity = getCreatureAffinity(gameState);
    const definition = CREATURE_POWER_DEFINITIONS[affinity];
    const powerLevel = clamp(
        Number(genes?.cosmicAffinity?.powerLevel) || 0.5,
        0,
        1
    );
    const bondLevel = clamp(
        Number(getValue(gameState, 'creature.bond.level', 1)) || 1,
        1,
        20
    );
    const expeditionsCompleted = clamp(
        Number(getValue(gameState, 'stats.levelsCompleted', 0)) || 0,
        0,
        6
    );
    const currentControl = clamp(
        Math.round(
            18
            + powerLevel * 32
            + bondLevel * 2
            + expeditionsCompleted * 6
        ),
        20,
        90
    );
    const relationshipState = bondLevel >= 10 || expeditionsCompleted >= 5
        ? 'synchronized'
        : bondLevel >= 5 || expeditionsCompleted >= 3
            ? 'trusting'
            : bondLevel >= 2 || expeditionsCompleted >= 1
                ? 'observing'
                : 'wary';
    const normalizedContext = context === 'earth' ? 'earth' : 'fend';

    return {
        schemaVersion: CREATURE_POWER_PROFILE_SCHEMA_VERSION,
        creatureId: normalizeIdentifier(genes?.id, 'companion'),
        affinity,
        affinityLabel: definition.label,
        color: definition.color,
        magnitudeClass: 'extreme',
        potentialOutput: 100,
        currentControl,
        expeditionsCompleted,
        relationshipState,
        context: normalizedContext,
        universalSense: {
            id: 'living_resonance',
            name: 'Living Resonance',
            effect: 'Senses the Current, nearby danger, and living intent.'
        },
        affinityPower: definition.affinityPower,
        protectiveResponse: definition.protectiveResponse,
        partnershipMove: {
            ...definition.partnershipMove,
            unlocked: bondLevel >= 5 || expeditionsCompleted >= 3
        },
        highPowerReveal: {
            ...definition.highPowerReveal,
            unlocked: bondLevel >= 8 || expeditionsCompleted >= 5
        },
        operatingDoctrine: normalizedContext === 'earth'
            ? {
                strengthReduced: false,
                restraintRequired: true,
                detectionRisk: 'extreme',
                reason: definition.earthExpression
            }
            : {
                strengthReduced: false,
                restraintRequired: false,
                detectionRisk: 'low',
                reason: 'The Current can safely receive and redistribute most of the power.'
            }
    };
}

export function recordCreaturePowerEvent(gameState, {
    eventId,
    powerId,
    context = 'fend',
    magnitude = 'controlled',
    outcome = 'completed',
    occurredAt = new Date().toISOString(),
    save = true
} = {}) {
    if (!gameState?.get || !gameState?.set) {
        return null;
    }

    const normalizedEventId = normalizeIdentifier(eventId, null);
    const normalizedPowerId = normalizeIdentifier(powerId, null);
    if (!normalizedEventId || !normalizedPowerId) {
        return null;
    }

    const existing = getValue(gameState, 'creature.powerHistory', []);
    const history = Array.isArray(existing) ? [...existing] : [];
    const duplicate = history.find(event => event?.eventId === normalizedEventId);
    if (duplicate) {
        return duplicate;
    }

    const record = {
        eventId: normalizedEventId,
        powerId: normalizedPowerId,
        affinity: getCreatureAffinity(gameState),
        context: context === 'earth' ? 'earth' : 'fend',
        magnitude: ['controlled', 'major', 'extreme'].includes(magnitude)
            ? magnitude
            : 'controlled',
        outcome: normalizeIdentifier(outcome, 'completed', 48),
        occurredAt: typeof occurredAt === 'string'
            ? occurredAt.slice(0, 40)
            : new Date().toISOString()
    };

    gameState.set('creature.powerHistory', [...history, record].slice(-40));
    if (save) {
        gameState.save?.();
    }
    gameState.emit?.('creaturePowerWitnessed', record);
    return record;
}
