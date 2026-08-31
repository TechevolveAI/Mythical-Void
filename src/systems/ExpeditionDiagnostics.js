import { getShipReconstructionSnapshot } from './ShipReconstruction.js';
import { getCurrentRegionSnapshot } from './CurrentEcology.js';

export const EXPEDITION_DIAGNOSTICS_SCHEMA_VERSION = 1;

export const EXPEDITION_DIAGNOSTIC_DEFINITIONS = Object.freeze({
    mythical_forest: Object.freeze({
        label: 'Mythical Forest',
        routeLabel: 'ROOTWAY VARIABLE',
        routeRisk: 'variable',
        hazardLabel: 'SPORE PRESSURE'
    }),
    crystal_caves: Object.freeze({
        label: 'Crystal Caves',
        routeLabel: 'ECHO TUNNELS NARROW',
        routeRisk: 'severe',
        hazardLabel: 'RESONANCE SPIKES'
    }),
    stellar_reef: Object.freeze({
        label: 'Stellar Reef',
        routeLabel: 'DRIFT CURRENT SHIFTING',
        routeRisk: 'variable',
        hazardLabel: 'CROSSCURRENT SURGE'
    }),
    void_peaks: Object.freeze({
        label: 'Void Peaks',
        routeLabel: 'RIDGELINE SEVERE',
        routeRisk: 'severe',
        hazardLabel: 'GRAVITY SHEAR'
    }),
    aurora_depths: Object.freeze({
        label: 'Aurora Depths',
        routeLabel: 'PRISM FIELD VOLATILE',
        routeRisk: 'critical',
        hazardLabel: 'AURORA DISCHARGE'
    }),
    final_void: Object.freeze({
        label: 'The Final Void',
        routeLabel: 'RETURN VECTOR UNSTABLE',
        routeRisk: 'critical',
        hazardLabel: 'VOID PRESSURE'
    })
});

const ROUTE_TONES = Object.freeze({
    stable: 'protected',
    variable: 'calibrating',
    severe: 'warning',
    critical: 'critical'
});

function normalizeWeather(weather = null) {
    if (!weather || typeof weather !== 'object') {
        return {
            available: false,
            activity: 'standby',
            activityLabel: 'LOCAL MODEL STANDBY',
            cosmicEnergy: 0,
            auroraActive: false
        };
    }
    const activity = [
        'quiet',
        'moderate',
        'active',
        'intense'
    ].includes(weather.solarActivity)
        ? weather.solarActivity
        : 'quiet';
    const activityLabel = {
        quiet: 'QUIET',
        moderate: 'ELEVATED',
        active: 'ACTIVE',
        intense: 'STELLAR SURGE'
    }[activity];
    return {
        available: true,
        activity,
        activityLabel,
        cosmicEnergy: Math.max(
            0,
            Math.min(100, Math.round(Number(weather.cosmicEnergy) || 0))
        ),
        auroraActive: weather.auroraActive === true
    };
}

function getCompletedStepIds(reconstruction) {
    const ids = reconstruction?.state?.completedStepIds;
    return new Set(Array.isArray(ids) ? ids : []);
}

function getCurrentLine(regionSnapshot) {
    const projection = regionSnapshot?.projection;
    if (!projection) return 'CURRENT // NO LOCAL RECORD';
    const label = String(
        projection.label || projection.nodeState || 'UNKNOWN'
    ).toUpperCase();
    const vitality = Math.max(
        0,
        Math.min(100, Math.round(Number(projection.vitality) || 0))
    );
    const trace = regionSnapshot?.arrivalConsequence
        ?.presentation?.label;
    return trace
        ? `CURRENT // ${label} ${vitality}% // ${String(trace).toUpperCase()}`
        : `CURRENT // ${label} ${vitality}%`;
}

function getDecisionCue(definition, regionSnapshot) {
    const nodeState = regionSnapshot?.projection?.nodeState;
    if (nodeState === 'severed') {
        return 'PRIORITY // CURRENT DISTRESS';
    }
    if (nodeState === 'fading') {
        return 'CAUTION // LIVING NETWORK WEAK';
    }
    if (definition.routeRisk === 'critical') {
        return 'CAUTION // EXTREME ROUTE';
    }
    if (nodeState === 'restored') {
        return 'RETURN // GUARDIAN RESTORED';
    }
    return 'FIELD CHOICE // COMPARE REALMS';
}

export function getExpeditionDiagnosticSnapshot(
    gameState,
    gateId,
    {
        weather = null,
        reconstructionSnapshot = null,
        regionSnapshot = null
    } = {}
) {
    const definition = EXPEDITION_DIAGNOSTIC_DEFINITIONS[gateId];
    if (!definition) {
        return {
            schemaVersion: EXPEDITION_DIAGNOSTICS_SCHEMA_VERSION,
            gateId,
            available: false,
            reason: 'not_expedition',
            lines: []
        };
    }

    const reconstruction = reconstructionSnapshot ||
        getShipReconstructionSnapshot(gameState);
    const completed = getCompletedStepIds(reconstruction);
    const routeAvailable = completed.has('propulsion_control');
    const ecologyAvailable = completed.has('resonance_hull');
    const forecastAvailable = completed.has('uplink_hold');
    const verified = completed.has('black_box_recovery');
    const current = ecologyAvailable
        ? regionSnapshot || getCurrentRegionSnapshot(gameState, gateId)
        : null;
    const stellarWeather = normalizeWeather(weather);
    const routeLine = routeAvailable
        ? `ROUTE // ${definition.routeLabel}`
        : 'ROUTE // INSTALL CRYSTAL CORE';
    const currentLine = ecologyAvailable
        ? getCurrentLine(current)
        : 'CURRENT // INSTALL RESONANCE HULL';
    const forecastLine = forecastAvailable
        ? stellarWeather.available
            ? `STELLAR // ${stellarWeather.activityLabel}` +
                `${stellarWeather.auroraActive ? ' // AURORA' : ''}`
            : 'STELLAR // LOCAL MODEL STANDBY'
        : 'STELLAR // INSTALL AURORA REACTOR';

    return {
        schemaVersion: EXPEDITION_DIAGNOSTICS_SCHEMA_VERSION,
        gateId,
        definition,
        available: routeAvailable,
        routeAvailable,
        ecologyAvailable,
        forecastAvailable,
        verified,
        routeRisk: definition.routeRisk,
        tone: routeAvailable
            ? ROUTE_TONES[definition.routeRisk] || 'calibrating'
            : 'offline',
        hazardLabel: routeAvailable ? definition.hazardLabel : null,
        current: current
            ? {
                nodeState: current.projection?.nodeState || 'unknown',
                vitality: Math.max(
                    0,
                    Math.min(
                        100,
                        Math.round(Number(current.projection?.vitality) || 0)
                    )
                ),
                arrivalClassification:
                    current.arrivalConsequence?.classification || 'quiet'
            }
            : null,
        weather: forecastAvailable ? stellarWeather : null,
        statusLabel: verified
            ? 'WANDERER-77 LOCAL SCAN // VERIFIED'
            : routeAvailable
                ? 'WANDERER-77 LOCAL SCAN // NOTHING SENT TO EARTH'
                : 'WANDERER-77 DIAGNOSTICS OFFLINE',
        decisionCue: routeAvailable
            ? getDecisionCue(definition, current)
            : 'INSTALL CRYSTAL CORE AT WANDERER-77',
        lines: [routeLine, currentLine, forecastLine]
    };
}

if (typeof window !== 'undefined') {
    window.ExpeditionDiagnostics = {
        EXPEDITION_DIAGNOSTICS_SCHEMA_VERSION,
        EXPEDITION_DIAGNOSTIC_DEFINITIONS,
        getExpeditionDiagnosticSnapshot
    };
}
