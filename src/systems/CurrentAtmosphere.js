export const CURRENT_ATMOSPHERE_SCHEMA_VERSION = 1;

const CURRENT_NODE_STATES = Object.freeze({
    LIVING: 'living',
    FADING: 'fading',
    SEVERED: 'severed',
    RESTORED: 'restored'
});
const CURRENT_ARRIVAL_CLASSIFICATIONS = Object.freeze({
    QUIET: 'quiet',
    CARE_RESONANCE: 'care_resonance',
    EXTRACTION_TRACE: 'extraction_trace',
    MIXED_TRACE: 'mixed_trace'
});
const KNOWN_REGION_IDS = new Set([
    'mythical_forest',
    'crystal_caves',
    'stellar_reef',
    'void_peaks',
    'aurora_depths',
    'current_heart'
]);
const KNOWN_NODE_STATES = new Set(Object.values(CURRENT_NODE_STATES));
const KNOWN_ARRIVAL_CLASSIFICATIONS = new Set(
    Object.values(CURRENT_ARRIVAL_CLASSIFICATIONS)
);

const STATE_PROFILES = Object.freeze({
    [CURRENT_NODE_STATES.SEVERED]: Object.freeze({
        lifeFormCount: 1,
        moteCount: 2,
        scarCount: 5,
        motionDurationMs: 5200,
        driftRange: 8,
        cueId: 'current_fracture',
        cueIntervalMs: 9200,
        cueVolume: 0.2,
        behaviorLabel: 'STILL',
        companionLine: 'The Current stops here. Something cut it.'
    }),
    [CURRENT_NODE_STATES.FADING]: Object.freeze({
        lifeFormCount: 3,
        moteCount: 6,
        scarCount: 3,
        motionDurationMs: 4400,
        driftRange: 13,
        cueId: 'current_fading',
        cueIntervalMs: 7800,
        cueVolume: 0.18,
        behaviorLabel: 'WITHDRAWING',
        companionLine: 'Life is pulling away from the weak pulse.'
    }),
    [CURRENT_NODE_STATES.LIVING]: Object.freeze({
        lifeFormCount: 6,
        moteCount: 12,
        scarCount: 1,
        motionDurationMs: 3400,
        driftRange: 19,
        cueId: 'current_life',
        cueIntervalMs: 6200,
        cueVolume: 0.16,
        behaviorLabel: 'RESPONDING',
        companionLine: 'The habitat is answering us.'
    }),
    [CURRENT_NODE_STATES.RESTORED]: Object.freeze({
        lifeFormCount: 10,
        moteCount: 18,
        scarCount: 0,
        motionDurationMs: 2600,
        driftRange: 25,
        cueId: 'current_harmony',
        cueIntervalMs: 4800,
        cueVolume: 0.15,
        behaviorLabel: 'IN HARMONY',
        companionLine: 'Everything here is moving together.'
    })
});

const ARRIVAL_MODIFIERS = Object.freeze({
    [CURRENT_ARRIVAL_CLASSIFICATIONS.QUIET]: Object.freeze({
        lifeForms: 0,
        motes: 0,
        scars: 0,
        motionDurationMs: 0,
        cueId: null,
        traceLabel: 'NO UPSTREAM TRACE'
    }),
    [CURRENT_ARRIVAL_CLASSIFICATIONS.CARE_RESONANCE]: Object.freeze({
        lifeForms: 2,
        motes: 3,
        scars: -1,
        motionDurationMs: -300,
        cueId: 'current_life',
        traceLabel: 'CARE ARRIVED FIRST'
    }),
    [CURRENT_ARRIVAL_CLASSIFICATIONS.EXTRACTION_TRACE]: Object.freeze({
        lifeForms: -2,
        motes: -3,
        scars: 3,
        motionDurationMs: 550,
        cueId: 'current_fracture',
        traceLabel: 'EXTRACTION REACHED HERE'
    }),
    [CURRENT_ARRIVAL_CLASSIFICATIONS.MIXED_TRACE]: Object.freeze({
        lifeForms: -1,
        motes: 0,
        scars: 2,
        motionDurationMs: 250,
        cueId: 'current_crosscurrent',
        traceLabel: 'CARE AND DAMAGE ARRIVED'
    })
});

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function getKnownRegionId(snapshot) {
    const regionId = snapshot?.definition?.id;
    return KNOWN_REGION_IDS.has(regionId) ? regionId : 'unknown';
}

function getNodeState(snapshot) {
    const nodeState = snapshot?.projection?.nodeState;
    return KNOWN_NODE_STATES.has(nodeState)
        ? nodeState
        : CURRENT_NODE_STATES.FADING;
}

function getArrivalClassification(snapshot) {
    const classification = snapshot?.arrivalConsequence?.classification;
    return KNOWN_ARRIVAL_CLASSIFICATIONS.has(classification)
        ? classification
        : CURRENT_ARRIVAL_CLASSIFICATIONS.QUIET;
}

export function getCurrentAtmosphereProjection(snapshot = {}) {
    const regionId = getKnownRegionId(snapshot);
    const nodeState = getNodeState(snapshot);
    const arrivalClassification = getArrivalClassification(snapshot);
    const profile = STATE_PROFILES[nodeState];
    const modifier = ARRIVAL_MODIFIERS[arrivalClassification];
    const vitality = clamp(
        Math.round(Number(snapshot?.projection?.vitality) || 0),
        0,
        100
    );
    const cueId = (
        nodeState === CURRENT_NODE_STATES.RESTORED &&
        arrivalClassification === CURRENT_ARRIVAL_CLASSIFICATIONS.CARE_RESONANCE
    )
        ? 'current_harmony'
        : modifier.cueId || profile.cueId;

    return Object.freeze({
        schemaVersion: CURRENT_ATMOSPHERE_SCHEMA_VERSION,
        regionId,
        nodeState,
        vitality,
        arrivalClassification,
        behaviorLabel: profile.behaviorLabel,
        traceLabel: modifier.traceLabel,
        companionLine: profile.companionLine,
        lifeFormCount: clamp(
            profile.lifeFormCount + modifier.lifeForms,
            0,
            12
        ),
        moteCount: clamp(profile.moteCount + modifier.motes, 0, 24),
        scarCount: clamp(profile.scarCount + modifier.scars, 0, 8),
        motionDurationMs: clamp(
            profile.motionDurationMs + modifier.motionDurationMs,
            1800,
            6500
        ),
        driftRange: clamp(profile.driftRange, 6, 32),
        soundscape: Object.freeze({
            cueId,
            intervalMs: clamp(profile.cueIntervalMs, 3500, 12000),
            volume: clamp(profile.cueVolume, 0.08, 0.35)
        })
    });
}

if (typeof window !== 'undefined') {
    window.CurrentAtmosphere = {
        CURRENT_ATMOSPHERE_SCHEMA_VERSION,
        getCurrentAtmosphereProjection
    };
}
