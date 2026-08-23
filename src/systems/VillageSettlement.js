import { getFendCommunitySnapshot } from './FendCommunity.js';
import { getRescuedResidentSnapshot } from './RescuedResidents.js';
import { getSanctuaryCommunitySnapshot } from './SanctuaryCommunity.js';

export const VILLAGE_SCHEMA_VERSION = 3;
export const VILLAGE_PRODUCTION_CAP_MS = 4 * 60 * 60 * 1000;

export const VILLAGE_BUILDING_ARTWORK = Object.freeze({
    forager_hut: Object.freeze({
        key: 'village-forager-hut',
        url: '/game/village/forager-hut.webp'
    }),
    sawmill: Object.freeze({
        key: 'village-living-sawmill',
        url: '/game/village/living-sawmill.webp'
    }),
    current_masonry: Object.freeze({
        key: 'village-current-masonry',
        url: '/game/village/current-masonry.webp'
    }),
    habitat: Object.freeze({
        key: 'village-shared-habitat',
        url: '/game/village/shared-habitat.webp'
    }),
    workshop: Object.freeze({
        key: 'village-discovery-workshop',
        url: '/game/village/discovery-workshop.webp'
    })
});

export const VILLAGE_WORLD_ARTWORK = Object.freeze({
    heart: Object.freeze({
        key: 'village-world-heart',
        url: '/game/village/world/village-heart.webp',
        compactKey: 'village-world-heart-compact',
        compactUrl: '/game/village/world/compact/village-heart.png'
    }),
    forager_hut: Object.freeze({
        key: 'village-world-forager-hut',
        url: '/game/village/world/forager-hut.webp',
        compactKey: 'village-world-forager-hut-compact',
        compactUrl: '/game/village/world/compact/forager-hut.png',
        displaySize: 176
    }),
    sawmill: Object.freeze({
        key: 'village-world-living-sawmill',
        url: '/game/village/world/living-sawmill.webp',
        compactKey: 'village-world-living-sawmill-compact',
        compactUrl: '/game/village/world/compact/living-sawmill.png',
        displaySize: 168
    }),
    current_masonry: Object.freeze({
        key: 'village-world-current-masonry',
        url: '/game/village/world/current-masonry.webp',
        compactKey: 'village-world-current-masonry-compact',
        compactUrl: '/game/village/world/compact/current-masonry.png',
        displaySize: 172
    }),
    habitat: Object.freeze({
        key: 'village-world-shared-habitat',
        url: '/game/village/world/shared-habitat.webp',
        compactKey: 'village-world-shared-habitat-compact',
        compactUrl: '/game/village/world/compact/shared-habitat.png',
        displaySize: 178
    }),
    workshop: Object.freeze({
        key: 'village-world-discovery-workshop',
        url: '/game/village/world/discovery-workshop.webp',
        compactKey: 'village-world-discovery-workshop-compact',
        compactUrl: '/game/village/world/compact/discovery-workshop.png',
        displaySize: 160
    })
});

export const VILLAGE_RESOURCE_DEFINITIONS = Object.freeze([
    Object.freeze({ id: 'wood', label: 'WOOD', color: '#8FE3CF' }),
    Object.freeze({ id: 'stone', label: 'STONE', color: '#F4F4F4' }),
    Object.freeze({ id: 'food', label: 'FOOD', color: '#F2C14E' })
]);

export const VILLAGE_PLOTS = Object.freeze([
    Object.freeze({ id: 'root_01', label: 'GARDEN EDGE' }),
    Object.freeze({ id: 'root_02', label: 'UPPER GLADE' }),
    Object.freeze({ id: 'root_03', label: 'CURRENT BEND' }),
    Object.freeze({ id: 'root_04', label: 'SHELTER GROVE' }),
    Object.freeze({ id: 'root_05', label: 'FAR ROOT' })
]);

export const VILLAGE_COMMUNITY_MOMENT_DEFINITIONS = Object.freeze([
    Object.freeze({
        id: 'safe_paths',
        buildingIds: Object.freeze(['forager_hut', 'current_masonry']),
        title: 'A ROUTE BOTH CAN TRUST',
        exchange: 'map what can regrow while the Current path stays open.',
        sharedValue: 'TAKE ONLY WHAT RETURNS'
    }),
    Object.freeze({
        id: 'fallen_timber',
        buildingIds: Object.freeze(['sawmill', 'current_masonry']),
        title: 'BUILD WITHOUT BLOCKING LIFE',
        exchange: 'shape what the storms released while loose stone protects the flow.',
        sharedValue: 'BUILD AROUND THE CURRENT'
    }),
    Object.freeze({
        id: 'shared_tools',
        buildingIds: Object.freeze(['forager_hut', 'workshop']),
        title: 'TWO KINDS OF KNOWLEDGE',
        exchange: 'test a human tool against what the living world already knows.',
        sharedValue: 'ASK BEFORE CHANGING'
    }),
    Object.freeze({
        id: 'return_home',
        buildingIds: Object.freeze(['habitat']),
        minimumWorkers: 2,
        title: 'THE WORK PAUSES HERE',
        exchange: 'meet at the shared home and make time to check on each other.',
        sharedValue: 'A HOME IS MORE THAN CAPACITY'
    })
]);

export const VILLAGE_HEART_DECISION_DEFINITIONS = Object.freeze([
    Object.freeze({
        id: 'storm_path',
        title: 'THE STORM LEFT ONE SAFE ROUTE',
        situation: 'Fallen timber can reopen the living Current or reinforce the next field route. There is time for one first.',
        requiredBuildingIds: Object.freeze(['sawmill', 'current_masonry']),
        minimumWorkers: 2,
        options: Object.freeze([
            Object.freeze({
                id: 'current_first',
                label: 'CLEAR THE CURRENT FIRST',
                value: 'care',
                consequence: 'The living route reopens before building work resumes.',
                residentLine: 'The Current is moving again. We built beside it, not over it.'
            }),
            Object.freeze({
                id: 'field_braces',
                label: 'BRACE THE FIELD ROUTE',
                value: 'readiness',
                consequence: 'The next expedition leaves with reinforced footing.',
                residentLine: 'You took the first crossing with us. The route feels safer now.'
            })
        ])
    }),
    Object.freeze({
        id: 'shared_harvest',
        title: 'THE FIRST SHARED HARVEST',
        situation: 'The safe food path has produced a surplus. New arrivals need welcome; the expedition team also needs a reserve.',
        requiredBuildingIds: Object.freeze(['forager_hut', 'habitat']),
        minimumWorkers: 2,
        options: Object.freeze([
            Object.freeze({
                id: 'welcome_table',
                label: 'SET A WELCOME TABLE',
                value: 'care',
                consequence: 'New arrivals eat before the supplies are counted.',
                residentLine: 'They arrived hungry. Now they know this place expected them.'
            }),
            Object.freeze({
                id: 'trail_rations',
                label: 'PACK TRAIL RATIONS',
                value: 'readiness',
                consequence: 'The expedition team carries a protected reserve.',
                residentLine: 'Nobody leaves the Sanctuary carrying only hope anymore.'
            })
        ])
    }),
    Object.freeze({
        id: 'unknown_tool',
        title: 'A TOOL WITH AN UNKNOWN SIGNAL',
        situation: 'The Workshop has combined human hardware with creature knowledge. Nobody yet knows how the Current will answer it.',
        requiredBuildingIds: Object.freeze(['habitat', 'workshop']),
        minimumWorkers: 2,
        options: Object.freeze([
            Object.freeze({
                id: 'listen_first',
                label: 'LISTEN BEFORE TESTING',
                value: 'care',
                consequence: 'Residents decide when the tool is ready to touch the Current.',
                residentLine: 'The tool waited for us. That is how we knew it could belong here.'
            }),
            Object.freeze({
                id: 'wanderer_trial',
                label: 'TEST WITH WANDERER-77',
                value: 'readiness',
                consequence: 'The astronaut takes the first risk and records the result.',
                residentLine: 'You carried the unknown first. Next time, we carry it together.'
            })
        ])
    })
]);

const HEART_DECISION_BY_ID = new Map(
    VILLAGE_HEART_DECISION_DEFINITIONS.map(decision => [decision.id, decision])
);

const MINUTE = 60 * 1000;

export const VILLAGE_BUILDING_DEFINITIONS = Object.freeze([
    Object.freeze({
        id: 'forager_hut',
        label: 'FORAGER HUT',
        shortLabel: 'FORAGE',
        description: 'Maps edible growth without exhausting a living patch.',
        purpose: 'Keeps creatures fed without stripping a living region.',
        immediateImpact: '+5 happiness whenever you feed a creature.',
        worldEffectLabel: 'FEEDING · +5 HAPPINESS',
        worldActionLabel: 'FEED +5',
        purposeGlyph: 'renewing_food',
        worldProfile: Object.freeze({
            identity: 'renewing_garden',
            material: 'regrowth_rows_v1',
            ecologyShape: 'fruit',
            accent: 0xF2C14E,
            secondary: 0x71E6B1,
            motion: 'seed_drift',
            activityCue: 'SAFE PATCHES REGROW',
            worldChange: 'Edible growth returns along marked paths between visits.'
        }),
        completionCopy: 'A safe food path opens without stripping a living patch.',
        extensionImpact: 'Supplies food for habitats, workshops, and future residents.',
        residentNeed: Object.freeze({
            title: 'MARK A SAFE FOOD PATH',
            request: 'Could we mark what grows back before we gather anything?',
            promise: 'We eat today without taking tomorrow from this place.'
        }),
        cost: Object.freeze({ wood: 18, stone: 8, food: 0 }),
        constructionMs: 8000,
        production: Object.freeze({ resource: 'food', amount: 2, intervalMs: MINUTE }),
        preferredTraits: Object.freeze(['curious', 'gentle', 'nebula']),
        roleLabel: 'PATHFINDER',
        workerRoutine: Object.freeze({
            cue: 'MAPS SAFE FOOD PATHS',
            carriedResource: 'food',
            emotionalPurpose: 'Leaves enough living growth for tomorrow.',
            checkInLine: 'I found three patches we can eat from. I marked the fourth so it can recover.'
        })
    }),
    Object.freeze({
        id: 'sawmill',
        label: 'LIVING SAWMILL',
        shortLabel: 'SAWMILL',
        description: 'Shapes fallen timber. No healthy tree is marked for cutting.',
        purpose: 'Turns storm-fallen timber into safe paths and repair stock.',
        immediateImpact: '+10 cosmic coins after every expedition victory.',
        worldEffectLabel: 'VICTORY · +10 COINS',
        worldActionLabel: 'WIN +10',
        purposeGlyph: 'repair_value',
        worldProfile: Object.freeze({
            identity: 'stormwood_yard',
            material: 'fallen_timber_rings_v1',
            ecologyShape: 'leaf',
            accent: 0xC58A52,
            secondary: 0x71E6B1,
            motion: 'stormwood_turn',
            activityCue: 'FALLEN TIMBER SHAPED',
            worldChange: 'Only storm-fallen wood enters the repair yard.'
        }),
        completionCopy: 'Storm-fallen timber becomes shelter. No healthy tree is marked.',
        extensionImpact: 'Supplies wood for bridges, defenses, and village expansion.',
        residentNeed: Object.freeze({
            title: 'USE WHAT THE STORM RELEASED',
            request: 'The storm left enough timber. We do not need to cut a living tree.',
            promise: 'Repairs become possible without clearing the forest.'
        }),
        cost: Object.freeze({ wood: 15, stone: 10, food: 0 }),
        constructionMs: 9000,
        production: Object.freeze({ resource: 'wood', amount: 2, intervalMs: MINUTE }),
        preferredTraits: Object.freeze(['energetic', 'bold', 'star']),
        roleLabel: 'SHAPER',
        workerRoutine: Object.freeze({
            cue: 'SHAPES FALLEN TIMBER',
            carriedResource: 'wood',
            emotionalPurpose: 'Uses what the storms have already released.',
            checkInLine: 'The storm left enough timber for the next repair. No living tree had to fall.'
        })
    }),
    Object.freeze({
        id: 'current_masonry',
        label: 'CURRENT MASONRY',
        shortLabel: 'MASONRY',
        description: 'Recovers loose stone while keeping the Current pathways open.',
        purpose: 'Builds protection without blocking the Current beneath the Fend.',
        immediateImpact: '+1 Current Stone guard charge on every expedition.',
        worldEffectLabel: 'EXPEDITION · +1 GUARD',
        worldActionLabel: 'BLOCK 1 HIT',
        purposeGlyph: 'current_guard',
        worldProfile: Object.freeze({
            identity: 'open_current_buttress',
            material: 'resonant_stone_arc_v1',
            ecologyShape: 'crystal',
            accent: 0xD8E2DF,
            secondary: 0x8FE3CF,
            motion: 'stone_resonance',
            activityCue: 'CURRENT CHANNEL OPEN',
            worldChange: 'Loose stone protects the route without sealing the Current.'
        }),
        completionCopy: 'Loose stone settles around the Current without closing its path.',
        extensionImpact: 'Supplies stone for permanent structures and defenses.',
        residentNeed: Object.freeze({
            title: 'KEEP THE CURRENT OPEN',
            request: 'I can hear which stones the Current has finished with. Let me show you.',
            promise: 'Protection grows around the living route instead of blocking it.'
        }),
        cost: Object.freeze({ wood: 15, stone: 8, food: 0 }),
        constructionMs: 10000,
        production: Object.freeze({ resource: 'stone', amount: 2, intervalMs: MINUTE }),
        preferredTraits: Object.freeze(['wise', 'gentle', 'crystal']),
        roleLabel: 'RESONANCE KEEPER',
        workerRoutine: Object.freeze({
            cue: 'LISTENS FOR SAFE STONE',
            carriedResource: 'stone',
            emotionalPurpose: 'Keeps every Current pathway open.',
            checkInLine: 'The stone hums differently near an open Current. I know which pieces are safe to move.'
        })
    }),
    Object.freeze({
        id: 'habitat',
        label: 'SHARED HABITAT',
        shortLabel: 'HABITAT',
        description: 'A sheltered home designed around creature rest and choice.',
        purpose: 'Gives rescued creatures a safe home they can choose to join.',
        immediateImpact: '+2 permanent creature collection capacity.',
        worldEffectLabel: 'HOME · +2 CAPACITY',
        worldActionLabel: '2 SAFE HOMES',
        purposeGlyph: 'shared_home',
        worldProfile: Object.freeze({
            identity: 'shared_shelter_grove',
            material: 'resting_petals_v1',
            ecologyShape: 'flower',
            accent: 0xE85D5D,
            secondary: 0xF2C14E,
            motion: 'home_lantern_breath',
            activityCue: 'A LIGHT FOR EACH RESIDENT',
            worldChange: 'Resting lights appear for creatures who choose this home.'
        }),
        completionCopy: 'A rescued creature can choose a safe home here.',
        extensionImpact: 'Unlocks resident groups, bonds, and future village districts.',
        residentNeed: Object.freeze({
            title: 'MAKE A HOME THEY CAN CHOOSE',
            request: 'When we rescue someone, they should know a place here can be theirs.',
            promise: 'Two more creatures can belong here without being assigned a job.'
        }),
        cost: Object.freeze({ wood: 20, stone: 14, food: 4 }),
        constructionMs: 12000,
        production: null,
        preferredTraits: Object.freeze([]),
        roleLabel: 'HOME',
        capacityBonus: 2
    }),
    Object.freeze({
        id: 'workshop',
        label: 'DISCOVERY WORKSHOP',
        shortLabel: 'WORKSHOP',
        description: 'Combines human tools with creature knowledge, by invitation.',
        purpose: 'Lets human and creature knowledge solve problems together.',
        immediateImpact: '+1 maximum crystal energy on every expedition.',
        worldEffectLabel: 'EXPEDITION · +1 ENERGY',
        worldActionLabel: 'ENERGY +1',
        purposeGlyph: 'shared_energy',
        worldProfile: Object.freeze({
            identity: 'shared_discovery_bench',
            material: 'consent_circuit_v1',
            ecologyShape: 'spark',
            accent: 0x8FE3CF,
            secondary: 0xD94B4B,
            motion: 'dual_signal_orbit',
            activityCue: 'TWO SIGNALS IN AGREEMENT',
            worldChange: 'Human tools and creature knowledge illuminate the same circuit.'
        }),
        completionCopy: 'Human tools and creature knowledge now share one table.',
        extensionImpact: 'Enables equipment research, katana upgrades, and new technology.',
        residentNeed: Object.freeze({
            title: 'SHARE ONE WORK TABLE',
            request: 'Your tools and our knowledge could help each other if we test them together.',
            promise: 'New equipment begins with consent from both kinds of knowledge.'
        }),
        cost: Object.freeze({ wood: 25, stone: 20, food: 6 }),
        constructionMs: 15000,
        production: Object.freeze({ resource: 'stone', amount: 3, intervalMs: MINUTE }),
        preferredTraits: Object.freeze(['curious', 'wise', 'crystal']),
        roleLabel: 'MAKER',
        workerRoutine: Object.freeze({
            cue: 'TESTS SHARED TOOLS',
            carriedResource: 'crystal',
            emotionalPurpose: 'Builds only when both kinds of knowledge agree.',
            checkInLine: 'Human tools ask fast questions. The Current answers slowly. I am learning both rhythms.'
        }),
        requires: Object.freeze(['forager_hut', 'sawmill', 'current_masonry'])
    })
]);

const RESOURCE_IDS = new Set(VILLAGE_RESOURCE_DEFINITIONS.map(resource => resource.id));
const PLOT_IDS = new Set(VILLAGE_PLOTS.map(plot => plot.id));
const BUILDING_BY_ID = new Map(
    VILLAGE_BUILDING_DEFINITIONS.map(building => [building.id, building])
);
const STARTER_RESOURCES = Object.freeze({ wood: 72, stone: 52, food: 30 });
const MAX_HISTORY = 64;

export const VILLAGE_GROWTH_PROFILES = Object.freeze([
    Object.freeze({
        tier: 0,
        label: 'AWAKENED ROOT',
        worldIdentity: 'signal_seed',
        canopyCount: 0,
        currentNodeCount: 1,
        gatheringCapacity: 0,
        ambientPromise: 'The Heart is awake, but it is still alone.'
    }),
    Object.freeze({
        tier: 1,
        label: 'FIRST ROOT',
        worldIdentity: 'first_shelter',
        canopyCount: 1,
        currentNodeCount: 3,
        gatheringCapacity: 1,
        ambientPromise: 'One safe route now reaches beyond the Heart.'
    }),
    Object.freeze({
        tier: 2,
        label: 'CONNECTED GLADE',
        worldIdentity: 'shared_crossing',
        canopyCount: 2,
        currentNodeCount: 5,
        gatheringCapacity: 2,
        ambientPromise: 'The first shared crossing has become a meeting place.'
    }),
    Object.freeze({
        tier: 3,
        label: 'LIVING SETTLEMENT',
        worldIdentity: 'resident_commons',
        canopyCount: 3,
        currentNodeCount: 7,
        gatheringCapacity: 3,
        ambientPromise: 'Work, rest, and return now share one living rhythm.'
    }),
    Object.freeze({
        tier: 4,
        label: 'SHARED SANCTUARY',
        worldIdentity: 'current_canopy',
        canopyCount: 5,
        currentNodeCount: 9,
        gatheringCapacity: 4,
        ambientPromise: 'Every restored root now answers the whole Sanctuary.'
    })
]);

export function getVillageGrowthProfile(growthTier = 0) {
    const tier = Math.floor(Math.max(
        0,
        Math.min(VILLAGE_GROWTH_PROFILES.length - 1, Number(growthTier) || 0)
    ));
    return VILLAGE_GROWTH_PROFILES[tier];
}

export function getVillageWorldState(snapshot) {
    const restored = snapshot?.buildings?.filter(
        building => building.status === 'complete'
    ).length || 0;
    const choices = snapshot?.heartDecision?.completed?.length || 0;
    const values = snapshot?.heartDecision?.values || { care: 0, readiness: 0 };
    const growthTier = restored >= VILLAGE_PLOTS.length
        ? 4
        : restored >= 4
            ? 3
            : restored >= 2
                ? 2
                : restored >= 1
                    ? 1
                    : 0;
    const growthProfile = getVillageGrowthProfile(growthTier);
    const constructing = snapshot?.buildings?.find(
        building => building.status === 'constructing'
    );
    if (constructing) {
        return {
            restored,
            choices,
            values,
            growthTier,
            growthLabel: growthProfile.label,
            nextAction: {
                type: 'construction',
                plotId: constructing.plotId,
                buildingId: constructing.id,
                definitionId: constructing.definitionId,
                label: `${constructing.definition.shortLabel} GROWING`,
                detail: 'The Current is shaping this foundation.'
            }
        };
    }
    const unstaffed = snapshot?.buildings?.find(building => (
        building.status === 'complete' &&
        building.definition.production &&
        !building.creature
    ));
    if (unstaffed) {
        return {
            restored,
            choices,
            values,
            growthTier,
            growthLabel: growthProfile.label,
            nextAction: {
                type: 'assign',
                plotId: unstaffed.plotId,
                buildingId: unstaffed.id,
                definitionId: unstaffed.definitionId,
                label: `INVITE HELP AT ${unstaffed.definition.shortLabel}`,
                detail: 'Tap this structure and choose a companion.'
            }
        };
    }
    if (snapshot?.heartDecision?.active) {
        return {
            restored,
            choices,
            values,
            growthTier,
            growthLabel: growthProfile.label,
            nextAction: {
                type: 'decision',
                plotId: null,
                buildingId: null,
                definitionId: null,
                label: 'HEART CHOICE READY',
                detail: 'Tap the Village Heart to decide together.'
            }
        };
    }
    const ready = snapshot?.definitions?.find(
        definition => definition.placement.available
    );
    if (ready) {
        const openPlot = snapshot?.plots?.find(plot => plot.open) || null;
        return {
            restored,
            choices,
            values,
            growthTier,
            growthLabel: growthProfile.label,
            nextAction: {
                type: 'build',
                plotId: openPlot?.id || null,
                buildingId: null,
                definitionId: ready.id,
                label: `BUILD ${ready.shortLabel}`,
                detail: openPlot
                    ? `Tap ${openPlot.label.toLowerCase()} to place it.`
                    : 'Open the Village Heart to choose a foundation.'
            }
        };
    }
    const nextDefinition = snapshot?.definitions?.find(
        definition => !definition.placement.alreadyBuilt
    );
    if (nextDefinition) {
        const firstMissing = nextDefinition.placement.missingResources?.[0] || null;
        return {
            restored,
            choices,
            values,
            growthTier,
            growthLabel: growthProfile.label,
            nextAction: {
                type: 'supplies',
                plotId: null,
                buildingId: null,
                definitionId: nextDefinition.id,
                label: firstMissing
                    ? `GATHER ${firstMissing.required - firstMissing.current} ${firstMissing.resource.toUpperCase()}`
                    : `PREPARE ${nextDefinition.shortLabel}`,
                detail: firstMissing
                    ? `${nextDefinition.shortLabel} needs more village supplies.`
                    : 'Complete its required structures first.'
            }
        };
    }
    return {
        restored,
        choices,
        values,
        growthTier,
        growthLabel: growthProfile.label,
        nextAction: {
            type: 'review',
            plotId: null,
            buildingId: null,
            definitionId: null,
            label: choices > 0
                ? `CARE ${values.care} · READY ${values.readiness}`
                : 'SETTLEMENT ONLINE',
            detail: 'Review the village or meet its residents.'
        }
    };
}

export function getVillageWorldGuidance(snapshot) {
    const worldState = snapshot?.worldState || getVillageWorldState(snapshot);
    if (worldState.nextAction.type === 'review') {
        return worldState.nextAction.label;
    }
    return `${worldState.restored}/${VILLAGE_PLOTS.length} RESTORED · ${worldState.nextAction.label}`;
}

function normalizeTimestamp(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
}

function normalizeResourceAmount(value) {
    return Math.max(0, Math.floor(Number(value) || 0));
}

function normalizeResources(value = {}) {
    return Object.fromEntries(
        VILLAGE_RESOURCE_DEFINITIONS.map(resource => [
            resource.id,
            normalizeResourceAmount(value?.[resource.id])
        ])
    );
}

function normalizeParticipantCreatureIds(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value
        .filter(id => typeof id === 'string')
        .map(id => id.trim().slice(0, 80))
        .filter(Boolean)
    )].slice(0, 4);
}

function normalizeParticipantNames(value) {
    if (!Array.isArray(value)) return [];
    return value
        .filter(name => typeof name === 'string')
        .map(name => name.trim().slice(0, 32))
        .filter(Boolean)
        .slice(0, 4);
}

function normalizeHeartDecisions(value) {
    if (!Array.isArray(value)) return [];
    const candidates = value
        .map(entry => {
            const decision = HEART_DECISION_BY_ID.get(entry?.decisionId);
            const option = decision?.options.find(candidate => candidate.id === entry?.optionId);
            if (!decision || !option) return null;
            return {
                decisionId: decision.id,
                optionId: option.id,
                occurredAt: normalizeTimestamp(entry?.occurredAt),
                participantCreatureIds: normalizeParticipantCreatureIds(
                    entry?.participantCreatureIds
                ),
                participantNames: normalizeParticipantNames(entry?.participantNames)
            };
        })
        .filter(Boolean);
    const byDecision = new Map();
    candidates.forEach(choice => {
        if (!byDecision.has(choice.decisionId)) {
            byDecision.set(choice.decisionId, choice);
        }
    });
    const normalized = [];
    for (const definition of VILLAGE_HEART_DECISION_DEFINITIONS) {
        const choice = byDecision.get(definition.id);
        if (!choice) break;
        normalized.push(choice);
    }
    return normalized;
}

function normalizeBuildingInstance(instance, usedPlots, usedDefinitions) {
    const definition = BUILDING_BY_ID.get(instance?.definitionId);
    const plotId = PLOT_IDS.has(instance?.plotId) ? instance.plotId : null;
    if (!definition || !plotId || usedPlots.has(plotId) || usedDefinitions.has(definition.id)) {
        return null;
    }

    const status = instance?.status === 'complete' ? 'complete' : 'constructing';
    const startedAt = normalizeTimestamp(instance?.startedAt) || 0;
    const completesAt = status === 'complete'
        ? normalizeTimestamp(instance?.completesAt) || startedAt
        : Math.max(
            startedAt,
            normalizeTimestamp(instance?.completesAt) || startedAt + definition.constructionMs
        );
    const completedAt = status === 'complete'
        ? normalizeTimestamp(instance?.completedAt) || completesAt
        : null;
    const assignedCreatureId = typeof instance?.assignedCreatureId === 'string'
        ? instance.assignedCreatureId.slice(0, 128)
        : null;

    usedPlots.add(plotId);
    usedDefinitions.add(definition.id);
    return {
        id: `village:${definition.id}:${plotId}`,
        definitionId: definition.id,
        plotId,
        status,
        startedAt,
        completesAt,
        completedAt,
        assignedCreatureId,
        lastProductionAt: normalizeTimestamp(instance?.lastProductionAt) || completedAt,
        totalProduced: normalizeResourceAmount(instance?.totalProduced)
    };
}

function normalizeHistory(value) {
    if (!Array.isArray(value)) return [];
    return value
        .filter(entry => entry && typeof entry.type === 'string')
        .map(entry => ({
            type: entry.type.slice(0, 48),
            buildingId: typeof entry.buildingId === 'string'
                ? entry.buildingId.slice(0, 128)
                : null,
            creatureId: typeof entry.creatureId === 'string'
                ? entry.creatureId.slice(0, 128)
                : null,
            decisionId: HEART_DECISION_BY_ID.has(entry?.decisionId)
                ? entry.decisionId
                : null,
            optionId: typeof entry?.optionId === 'string'
                ? entry.optionId.slice(0, 64)
                : null,
            occurredAt: normalizeTimestamp(entry.occurredAt)
        }))
        .slice(-MAX_HISTORY);
}

export function normalizeVillageState(state = {}) {
    const usedPlots = new Set();
    const usedDefinitions = new Set();
    const buildings = (Array.isArray(state?.buildings) ? state.buildings : [])
        .map(instance => normalizeBuildingInstance(instance, usedPlots, usedDefinitions))
        .filter(Boolean);

    return {
        schemaVersion: VILLAGE_SCHEMA_VERSION,
        foundedAt: normalizeTimestamp(state?.foundedAt),
        starterSuppliesClaimed: state?.starterSuppliesClaimed === true,
        guidanceSeen: state?.guidanceSeen === true,
        resources: normalizeResources(state?.resources),
        lifetimeProduced: normalizeResources(state?.lifetimeProduced),
        heartDecisions: normalizeHeartDecisions(state?.heartDecisions),
        buildings,
        history: normalizeHistory(state?.history),
        lastReconciledAt: normalizeTimestamp(state?.lastReconciledAt)
    };
}

export function getVillageHeartValues(state = {}) {
    const choices = normalizeHeartDecisions(state?.heartDecisions);
    return choices.reduce((values, choice) => {
        const decision = HEART_DECISION_BY_ID.get(choice.decisionId);
        const option = decision?.options.find(candidate => candidate.id === choice.optionId);
        if (option?.value === 'care') values.care += 1;
        if (option?.value === 'readiness') values.readiness += 1;
        return values;
    }, { care: 0, readiness: 0 });
}

export function getVillageGameplayEffects(gameState, { stateOverride = null } = {}) {
    const state = normalizeVillageState(
        stateOverride || gameState?.get?.('world.village') || {}
    );
    const complete = new Set(
        state.buildings
            .filter(building => building.status === 'complete')
            .map(building => building.definitionId)
    );
    const heartValues = getVillageHeartValues(state);
    const heartCareBonus = complete.has('forager_hut') && heartValues.care >= 2 ? 2 : 0;
    const heartReadinessEnergyBonus = complete.has('workshop') &&
        heartValues.readiness >= 2 ? 1 : 0;
    return {
        feedHappinessBonus: (complete.has('forager_hut') ? 5 : 0) + heartCareBonus,
        victoryCoinBonus: complete.has('sawmill') ? 10 : 0,
        guardCharges: complete.has('current_masonry') ? 1 : 0,
        creatureCapacityBonus: complete.has('habitat') ? 2 : 0,
        maxEnergyBonus: (complete.has('workshop') ? 1 : 0) + heartReadinessEnergyBonus,
        heartCareBonus,
        heartReadinessEnergyBonus,
        heartValues,
        activeBuildingIds: [...complete]
    };
}

export function getVillageSupportSummary(effects = {}) {
    const summary = [];
    const feedHappinessBonus = Math.max(0, Number(effects.feedHappinessBonus) || 0);
    const victoryCoinBonus = Math.max(0, Number(effects.victoryCoinBonus) || 0);
    const guardCharges = Math.max(0, Number(effects.guardCharges) || 0);
    const creatureCapacityBonus = Math.max(0, Number(effects.creatureCapacityBonus) || 0);
    const maxEnergyBonus = Math.max(0, Number(effects.maxEnergyBonus) || 0);

    if (feedHappinessBonus > 0) {
        summary.push({
            id: 'feeding_happiness',
            source: 'FORAGER HUT',
            context: 'care',
            contextLabel: 'CREATURE CARE',
            effect: `FEEDING ADDS ${feedHappinessBonus} EXTRA HAPPINESS`,
            compact: `FEED +${feedHappinessBonus} HAPPINESS`,
            detail: 'Safe food gathered here makes every feeding more restorative.'
        });
    }
    if (victoryCoinBonus > 0) {
        summary.push({
            id: 'victory_coins',
            source: 'LIVING SAWMILL',
            context: 'expedition',
            contextLabel: 'LEVEL VICTORY',
            effect: `EVERY WIN RETURNS ${victoryCoinBonus} EXTRA COINS`,
            compact: `WIN +${victoryCoinBonus} COINS`,
            detail: 'Repair stock recovered from fallen timber lowers the cost of each return.'
        });
    }
    if (guardCharges > 0) {
        summary.push({
            id: 'blocked_hits',
            source: 'CURRENT MASONRY',
            context: 'expedition',
            contextLabel: 'EXPEDITION DEFENSE',
            effect: `${guardCharges} INCOMING ${guardCharges === 1 ? 'HIT IS' : 'HITS ARE'} BLOCKED`,
            compact: `BLOCK ${guardCharges} ${guardCharges === 1 ? 'HIT' : 'HITS'}`,
            detail: 'Current-shaped stone protects the team at the start of every expedition.'
        });
    }
    if (creatureCapacityBonus > 0) {
        summary.push({
            id: 'creature_homes',
            source: 'SHARED HABITAT',
            context: 'sanctuary',
            contextLabel: 'SAFE HOME',
            effect: `ROOM FOR ${creatureCapacityBonus} MORE ${creatureCapacityBonus === 1 ? 'CREATURE' : 'CREATURES'}`,
            compact: `HOME +${creatureCapacityBonus} PLACES`,
            detail: 'Rescued creatures can choose a permanent place in the Sanctuary.'
        });
    }
    if (maxEnergyBonus > 0) {
        summary.push({
            id: 'expedition_energy',
            source: effects.heartReadinessEnergyBonus > 0
                ? 'WORKSHOP + VILLAGE HEART'
                : 'DISCOVERY WORKSHOP',
            context: 'expedition',
            contextLabel: 'EXPEDITION ENERGY',
            effect: `START WITH ${maxEnergyBonus} EXTRA ENERGY`,
            compact: `START +${maxEnergyBonus} ENERGY`,
            detail: effects.heartReadinessEnergyBonus > 0
                ? 'Shared tools and readiness decisions reinforce the expedition charge.'
                : 'Shared tools reinforce the expedition charge before departure.'
        });
    }
    return summary;
}

function synchronizeVillageCapacity(gameState, state) {
    const bonus = getVillageGameplayEffects(gameState, {
        stateOverride: state
    }).creatureCapacityBonus;
    const target = 8 + bonus;
    const current = Math.max(0, Math.floor(Number(gameState?.get?.('maxCreatures')) || 0));
    if (!gameState?.set || current >= target) return false;
    gameState.set('maxCreatures', target);
    return true;
}

function statesDiffer(left, right) {
    return JSON.stringify(left) !== JSON.stringify(right);
}

export function getVillageUnlock(gameState) {
    const community = getFendCommunitySnapshot(gameState);
    // The Village Heart is a first-contact base, not a late-game reward. Once a
    // companion is hatched, its living signal can wake the dormant interface.
    // First Light Shelter remains meaningful as the first Fend community project.
    const hasCompanion = Boolean(activeCreatureRecord(gameState));
    const unlocked = hasCompanion || community.stage >= 1;
    return {
        unlocked,
        communityStage: community.stage,
        reason: unlocked
            ? hasCompanion
                ? 'Your companion has awakened the Village Heart'
                : 'First Light Shelter established'
            : 'Hatch a companion to wake the Village Heart'
    };
}

function activeCreatureRecord(gameState) {
    const active = gameState?.getActiveCreature?.();
    if (active) return active;
    if (gameState?.get?.('creature.hatched') !== true) return null;
    return gameState.get('creature');
}

function creatureId(creature, fallback = null) {
    return creature?.id || creature?.genes?.id || creature?.dna?.id || fallback;
}

export function getVillageCreatureRoster(gameState) {
    const collection = Array.isArray(gameState?.get?.('creatures'))
        ? gameState.get('creatures')
        : [];
    const active = activeCreatureRecord(gameState);
    const roster = [];
    const seen = new Set();

    [active, ...collection].forEach((creature, index) => {
        if (!creature) return;
        const id = creatureId(creature, index === 0 ? 'active_companion' : null);
        if (!id || seen.has(id)) return;
        seen.add(id);
        roster.push({
            ...creature,
            id,
            name: creature.name || 'Unnamed companion',
            communityType: index === 0 ? 'player_companion' : 'companion',
            isPlayerCompanion: index === 0,
            villageTraits: Array.isArray(creature.villageTraits)
                ? creature.villageTraits
                : []
        });
    });

    getRescuedResidentSnapshot(gameState).rescued
        .filter(resident => resident.residencyStatus !== 'away')
        .forEach(resident => {
            if (seen.has(resident.id)) return;
            seen.add(resident.id);
            roster.push({
                id: resident.id,
                name: resident.name,
                role: resident.role,
                kind: resident.kind,
                artwork: resident.artwork,
                textureKey: resident.textureKey,
                accent: resident.accent,
                communityType: 'rescued_resident',
                isPlayerCompanion: false,
                residencyStatus: resident.residencyStatus,
                preferredBuildingId: resident.preferredBuildingId,
                villageTraits: resident.villageTraits,
                contributionLine: resident.contributionLine,
                stats: { happiness: 100, energy: 100, health: 100 }
            });
        });

    return roster;
}

function collectTraitLabels(creature) {
    const labels = new Set();
    const add = value => {
        if (typeof value !== 'string') return;
        labels.add(value.trim().toLowerCase());
    };
    const genes = creature?.genes || creature?.genetics || {};
    const dna = creature?.dna || {};
    const personality = creature?.personality || {};
    const axes = creature?.personalityState?.axes || {};

    add(genes?.personality?.primary);
    add(genes?.personality?.type);
    add(genes?.cosmicAffinity?.element);
    add(creature?.cosmicAffinity);
    add(dna?.temperament);
    add(dna?.energyLevel);
    add(dna?.curiosity);
    add(personality?.primary);
    add(personality?.type);
    (Array.isArray(creature?.villageTraits) ? creature.villageTraits : [])
        .forEach(add);

    if (Number(axes.energy) > 30) add('energetic');
    if (Number(axes.curiosity) > 30) add('curious');
    if (Number(axes.temperament) > 30) add('bold');
    if (Number(axes.temperament) < -9) add('gentle');
    return labels;
}

export function getCreatureWorkProfile(creature, buildingDefinition) {
    if (!creature || !buildingDefinition?.production) {
        return { multiplier: 1, matches: [], label: 'COMMUNITY SUPPORT' };
    }
    const labels = collectTraitLabels(creature);
    const matches = buildingDefinition.preferredTraits.filter(trait => labels.has(trait));
    let multiplier = 1 + Math.min(0.3, matches.length * 0.15);
    if (Number(creature?.stats?.energy) >= 80) multiplier += 0.05;
    if (Number(creature?.stats?.happiness) >= 80) multiplier += 0.05;
    multiplier = Math.min(1.4, Math.max(0.8, multiplier));

    return {
        multiplier: Number(multiplier.toFixed(2)),
        matches,
        label: matches.length > 0
            ? `${buildingDefinition.roleLabel} // ${matches[0].toUpperCase()}`
            : buildingDefinition.roleLabel
    };
}

function withHistory(state, entry) {
    return {
        ...state,
        history: [...state.history, entry].slice(-MAX_HISTORY)
    };
}

export function initializeVillageSettlement(gameState, {
    now = Date.now(),
    save = true
} = {}) {
    if (!gameState?.get || !gameState?.set) return null;
    const previous = normalizeVillageState(gameState.get('world.village') || {});
    const unlock = getVillageUnlock(gameState);
    let next = previous;

    if (unlock.unlocked && !previous.starterSuppliesClaimed) {
        next = withHistory({
            ...previous,
            foundedAt: previous.foundedAt || now,
            starterSuppliesClaimed: true,
            resources: {
                wood: previous.resources.wood + STARTER_RESOURCES.wood,
                stone: previous.resources.stone + STARTER_RESOURCES.stone,
                food: previous.resources.food + STARTER_RESOURCES.food
            }
        }, {
            type: 'village_founded',
            buildingId: null,
            creatureId: null,
            occurredAt: now
        });
    }

    const reconciled = reconcileVillageState(next, getVillageCreatureRoster(gameState), now);
    const capacityChanged = synchronizeVillageCapacity(gameState, reconciled);
    if (statesDiffer(previous, reconciled)) {
        gameState.set('world.village', reconciled);
        gameState.emit?.('villageChanged', { type: 'reconciled', snapshot: reconciled });
    }
    if (save && (statesDiffer(previous, reconciled) || capacityChanged)) gameState.save?.();
    return getVillageSnapshot(gameState, { stateOverride: reconciled });
}

export function markVillageGuidanceSeen(gameState, { save = true } = {}) {
    if (!gameState?.get || !gameState?.set) return null;
    const previous = normalizeVillageState(gameState.get('world.village') || {});
    if (previous.guidanceSeen) {
        return getVillageSnapshot(gameState, { stateOverride: previous });
    }

    const next = { ...previous, guidanceSeen: true };
    gameState.set('world.village', next);
    gameState.emit?.('villageChanged', {
        type: 'guidance_seen',
        snapshot: next
    });
    if (save) gameState.save?.();
    return getVillageSnapshot(gameState, { stateOverride: next });
}

export function reconcileVillageState(rawState, roster = [], now = Date.now()) {
    let state = normalizeVillageState(rawState);
    const creatureById = new Map(roster.map(creature => [creature.id, creature]));
    const resources = { ...state.resources };
    const lifetimeProduced = { ...state.lifetimeProduced };
    let history = [...state.history];
    let changed = false;

    const buildings = state.buildings.map(instance => {
        const definition = BUILDING_BY_ID.get(instance.definitionId);
        let next = { ...instance };
        if (next.status === 'constructing' && now >= next.completesAt) {
            changed = true;
            next.status = 'complete';
            next.completedAt = next.completesAt;
            next.lastProductionAt = next.completesAt;
            history.push({
                type: 'construction_completed',
                buildingId: next.id,
                creatureId: null,
                occurredAt: next.completesAt
            });
        }

        if (
            next.status !== 'complete' ||
            !definition?.production ||
            !next.assignedCreatureId ||
            !creatureById.has(next.assignedCreatureId)
        ) {
            return next;
        }

        const production = definition.production;
        const lastProductionAt = next.lastProductionAt || next.completedAt || now;
        const elapsed = Math.max(0, Math.min(
            VILLAGE_PRODUCTION_CAP_MS,
            now - lastProductionAt
        ));
        const cycles = Math.floor(elapsed / production.intervalMs);
        if (cycles <= 0) return next;

        const profile = getCreatureWorkProfile(
            creatureById.get(next.assignedCreatureId),
            definition
        );
        const perCycle = Math.max(1, Math.round(production.amount * profile.multiplier));
        const amount = cycles * perCycle;
        changed = true;
        resources[production.resource] += amount;
        lifetimeProduced[production.resource] += amount;
        next.totalProduced += amount;
        next.lastProductionAt = lastProductionAt + cycles * production.intervalMs;
        return next;
    });

    state = {
        ...state,
        resources,
        lifetimeProduced,
        buildings,
        history: history.slice(-MAX_HISTORY),
        lastReconciledAt: changed ? now : state.lastReconciledAt
    };
    return normalizeVillageState(state);
}

export function reconcileVillageSettlement(gameState, {
    now = Date.now(),
    save = true
} = {}) {
    if (!gameState?.get || !gameState?.set) return null;
    const previous = normalizeVillageState(gameState.get('world.village') || {});
    const next = reconcileVillageState(previous, getVillageCreatureRoster(gameState), now);
    const capacityChanged = synchronizeVillageCapacity(gameState, next);
    if (statesDiffer(previous, next)) {
        gameState.set('world.village', next);
        gameState.emit?.('villageChanged', { type: 'reconciled', snapshot: next });
    }
    if (save && (statesDiffer(previous, next) || capacityChanged)) gameState.save?.();
    return getVillageSnapshot(gameState, { stateOverride: next });
}

function getPlacementStatus(definition, state, unlock) {
    const builtDefinitionIds = new Set(state.buildings.map(building => building.definitionId));
    const missingPrerequisites = (definition.requires || [])
        .filter(requiredId => !builtDefinitionIds.has(requiredId));
    const missingResources = Object.entries(definition.cost)
        .filter(([resource, amount]) => state.resources[resource] < amount)
        .map(([resource, amount]) => ({
            resource,
            required: amount,
            current: state.resources[resource]
        }));
    const alreadyBuilt = builtDefinitionIds.has(definition.id);
    const noOpenPlot = state.buildings.length >= VILLAGE_PLOTS.length;
    return {
        available: unlock.unlocked && !alreadyBuilt && !noOpenPlot &&
            missingPrerequisites.length === 0 && missingResources.length === 0,
        alreadyBuilt,
        noOpenPlot,
        missingPrerequisites,
        missingResources
    };
}

function getVillagePhase(buildings) {
    const completeIds = new Set(
        buildings
            .filter(building => building.status === 'complete')
            .map(building => building.definitionId)
    );
    const producerIds = ['forager_hut', 'sawmill', 'current_masonry'];
    const completedProducers = producerIds.filter(id => completeIds.has(id)).length;
    const assignedProducers = buildings.filter(building => (
        building.status === 'complete' &&
        producerIds.includes(building.definitionId) &&
        building.assignedCreatureId
    )).length;
    const constructing = buildings.filter(building => building.status === 'constructing');
    const milestones = [
        {
            id: 'producer_network',
            label: 'SUPPLY NETWORK',
            current: completedProducers,
            target: producerIds.length,
            complete: completedProducers === producerIds.length
        },
        {
            id: 'creature_crews',
            label: 'CREATURE CREWS',
            current: assignedProducers,
            target: producerIds.length,
            complete: assignedProducers === producerIds.length
        },
        {
            id: 'shared_habitat',
            label: 'SHARED HOME',
            current: completeIds.has('habitat') ? 1 : 0,
            target: 1,
            complete: completeIds.has('habitat')
        },
        {
            id: 'discovery_workshop',
            label: 'DISCOVERY',
            current: completeIds.has('workshop') ? 1 : 0,
            target: 1,
            complete: completeIds.has('workshop')
        }
    ];

    let objective = 'Choose a producer and place it on an open root foundation.';
    let title = 'ESTABLISH A SUPPLY NETWORK';
    if (constructing.length > 0) {
        title = 'CONSTRUCTION IN PROGRESS';
        objective = `${constructing.length} structure${constructing.length === 1 ? '' : 's'} drawing power from the Current.`;
    } else if (completedProducers < producerIds.length) {
        objective = `Complete ${producerIds.length - completedProducers} more producer structure${producerIds.length - completedProducers === 1 ? '' : 's'}.`;
    } else if (assignedProducers < producerIds.length) {
        title = 'INVITE CREATURE CREWS';
        objective = `Invite companions to ${producerIds.length - assignedProducers} unstaffed producer${producerIds.length - assignedProducers === 1 ? '' : 's'}.`;
    } else if (!completeIds.has('habitat')) {
        title = 'BUILD A SHARED HOME';
        objective = 'Use the supply network to complete a habitat chosen by rescued residents.';
    } else if (!completeIds.has('workshop')) {
        title = 'OPEN THE DISCOVERY WORKSHOP';
        objective = 'Gather the remaining supplies, then combine human tools with creature knowledge.';
    } else {
        title = 'PHASE ONE SETTLEMENT ONLINE';
        objective = 'The settlement can now support residents, field equipment, and future districts.';
    }

    return {
        title,
        objective,
        complete: milestones.every(milestone => milestone.complete),
        completedMilestones: milestones.filter(milestone => milestone.complete).length,
        milestones
    };
}

export function getVillageHomeProfile(buildings = [], roster = []) {
    const habitat = buildings.find(building => (
        building.status === 'complete' && building.definitionId === 'habitat'
    ));
    const capacity = habitat?.definition?.capacityBonus || 0;
    const assignmentByCreature = new Map(
        buildings
            .filter(building => (
                building.status === 'complete' && building.assignedCreatureId
            ))
            .map(building => [building.assignedCreatureId, building])
    );
    const residenceCandidates = roster.map((creature, rosterIndex) => {
        const assignment = assignmentByCreature.get(creature.id) || null;
        return {
            id: creature.id,
            name: creature.name,
            communityType: creature.communityType || 'companion',
            role: creature.role || null,
            kind: creature.kind || null,
            artwork: creature.artwork || null,
            textureKey: creature.textureKey || null,
            color: creature.color || null,
            accent: creature.accent || null,
            isPlayerCompanion: creature.isPlayerCompanion === true,
            atWork: Boolean(assignment),
            workBuildingId: assignment?.definitionId || null,
            workLabel: assignment?.definition?.shortLabel || null,
            homePriority: creature.communityType === 'rescued_resident'
                ? 0
                : creature.isPlayerCompanion
                    ? 1
                    : 2,
            rosterIndex
        };
    });
    residenceCandidates.sort((left, right) => (
        Number(left.atWork) - Number(right.atWork) ||
        left.homePriority - right.homePriority ||
        left.rosterIndex - right.rosterIndex
    ));
    const residents = habitat
        ? residenceCandidates.slice(0, capacity).map(({
            rosterIndex,
            homePriority,
            ...resident
        }) => resident)
        : [];

    return {
        unlocked: Boolean(habitat),
        plotId: habitat?.plotId || null,
        capacity,
        residents,
        presentCount: residents.filter(resident => !resident.atWork).length,
        helpingCount: residents.filter(resident => resident.atWork).length
    };
}

export function getVillageResidentRoutinePlan(snapshot = {}) {
    const residents = Array.isArray(snapshot?.home?.residents)
        ? snapshot.home.residents
        : [];
    const profile = getVillageGrowthProfile(
        snapshot?.worldState?.growthTier || 0
    );
    const availableResidents = residents.filter(resident => !resident.atWork);
    const commonsCount = Math.min(
        profile.gatheringCapacity,
        availableResidents.length > 1
            ? availableResidents.length - 1
            : availableResidents.length
    );
    const commonsIds = new Set(
        availableResidents.slice(0, commonsCount).map(resident => resident.id)
    );
    const buildingByDefinition = new Map(
        (snapshot?.buildings || []).map(building => [building.definitionId, building])
    );

    return residents.map((resident, index) => {
        const residentIdentity = {
            communityType: resident.communityType,
            residentRole: resident.role,
            kind: resident.kind,
            artwork: resident.artwork,
            textureKey: resident.textureKey,
            color: resident.color,
            accent: resident.accent,
            isPlayerCompanion: resident.isPlayerCompanion === true
        };
        if (resident.atWork) {
            const building = buildingByDefinition.get(resident.workBuildingId);
            return {
                residentId: resident.id,
                residentName: resident.name,
                location: 'work',
                route: 'building_to_heart',
                destinationId: resident.workBuildingId,
                destinationLabel: resident.workLabel || 'VILLAGE WORK',
                activity: building?.definition?.workerRoutine?.cue || 'HELPS THE SETTLEMENT',
                ...residentIdentity,
                index
            };
        }
        if (commonsIds.has(resident.id)) {
            return {
                residentId: resident.id,
                residentName: resident.name,
                location: 'commons',
                route: 'home_to_commons',
                destinationId: 'village_heart',
                destinationLabel: 'VILLAGE HEART',
                activity: profile.tier >= 3
                    ? 'SHARES THE DAY AT THE HEART'
                    : 'CHECKS IN AT THE HEART',
                greeting: profile.tier >= 4
                    ? 'The paths feel less lonely now. Someone is always coming home.'
                    : profile.tier >= 3
                        ? 'I took the long way to the Heart. It helps me notice what changed.'
                        : 'I am checking the Heart before I rest. It remembers who came home.',
                ...residentIdentity,
                index
            };
        }
        return {
            residentId: resident.id,
            residentName: resident.name,
            location: 'home',
            route: 'resting_at_home',
            destinationId: snapshot?.home?.plotId || null,
            destinationLabel: 'SHARED HABITAT',
            activity: 'RESTS AT HOME',
            ...residentIdentity,
            index
        };
    });
}

export function getVillageResidentWorldPresence(snapshot = {}, residentId = null) {
    if (!residentId) {
        return {
            residentId: null,
            location: 'signal_garden',
            locationLabel: 'SIGNAL GARDEN',
            representedInVillage: false
        };
    }
    const routine = snapshot?.residentRoutines?.find(
        entry => entry.residentId === residentId
    ) || null;
    const assignedBuilding = snapshot?.buildings?.find(building => (
        building.status === 'complete' &&
        building.assignedCreatureId === residentId &&
        building.creature?.id === residentId
    )) || null;
    if (assignedBuilding) {
        return {
            residentId,
            location: 'work',
            locationLabel: assignedBuilding.definition?.shortLabel ||
                assignedBuilding.definition?.label ||
                'VILLAGE WORK',
            representedInVillage: true,
            buildingId: assignedBuilding.id,
            definitionId: assignedBuilding.definitionId,
            plotId: assignedBuilding.plotId
        };
    }
    if (routine?.location === 'commons') {
        return {
            residentId,
            location: 'heart',
            locationLabel: 'VILLAGE HEART',
            representedInVillage: true,
            route: routine.route
        };
    }
    if (routine?.location === 'home') {
        return {
            residentId,
            location: 'home',
            locationLabel: 'SHARED HABITAT',
            representedInVillage: true,
            plotId: snapshot?.home?.plotId || null
        };
    }
    return {
        residentId,
        location: 'signal_garden',
        locationLabel: 'SIGNAL GARDEN',
        representedInVillage: false
    };
}

export function getVillageCommunityMoments({ buildings = [] } = {}) {
    const completeByDefinition = new Map(
        buildings
            .filter(building => building.status === 'complete')
            .map(building => [building.definitionId, building])
    );
    const workers = buildings.filter(building => (
        building.status === 'complete' && building.creature
    ));

    return VILLAGE_COMMUNITY_MOMENT_DEFINITIONS
        .map(definition => {
            const anchor = completeByDefinition.get(definition.buildingIds[0]);
            if (!anchor) return null;
            const participantBuildings = definition.id === 'return_home'
                ? workers.slice(0, Math.max(2, definition.minimumWorkers || 2))
                : definition.buildingIds.map(id => completeByDefinition.get(id));
            if (
                participantBuildings.length < (definition.minimumWorkers || 2) ||
                participantBuildings.some(building => !building?.creature)
            ) {
                return null;
            }
            const participants = participantBuildings.map(building => ({
                creatureId: building.creature.id,
                name: building.creature.name,
                artwork: building.creature.artwork || null,
                communityType: building.creature.communityType || 'companion',
                residentRole: building.creature.role || null,
                buildingId: building.definitionId,
                plotId: building.plotId,
                roleLabel: building.creature.role || building.definition.roleLabel
            }));
            if (new Set(participants.map(participant => participant.creatureId)).size < 2) {
                return null;
            }
            return {
                ...definition,
                participantNames: participants.map(participant => participant.name),
                participants,
                anchorPlotId: definition.id === 'return_home'
                    ? anchor.plotId
                    : participants[0].plotId,
                line: `${participants.map(participant => participant.name).join(' and ')} ${definition.exchange}`
            };
        })
        .filter(Boolean);
}

export function getVillageCommunityMoment(snapshot, { cycle = 0 } = {}) {
    const moments = Array.isArray(snapshot?.communityMoments)
        ? snapshot.communityMoments
        : getVillageCommunityMoments(snapshot);
    if (moments.length === 0) return null;
    const index = Math.abs(Math.floor(Number(cycle) || 0)) % moments.length;
    return moments[index];
}

function getDecisionParticipantBuildings(definition, buildings = []) {
    if (!definition) return [];
    const workers = buildings.filter(building => (
        building.status === 'complete' && building.creature
    ));
    const requiredWorkers = definition.requiredBuildingIds
        .map(id => buildings.find(building => (
            building.definitionId === id &&
            building.status === 'complete' &&
            building.creature
        )))
        .filter(Boolean);
    const requiredWorkerIds = new Set(
        requiredWorkers.map(building => building.creature.id)
    );
    return [
        ...requiredWorkers,
        ...workers.filter(building => !requiredWorkerIds.has(building.creature.id))
    ].slice(0, definition.minimumWorkers);
}

function toHeartParticipant(building) {
    return {
        creatureId: building.creature.id,
        name: building.creature.name,
        artwork: building.creature.artwork || null,
        communityType: building.creature.communityType || 'companion',
        residentRole: building.creature.role || null,
        roleLabel: building.creature.role || building.definition.roleLabel,
        buildingId: building.definitionId,
        plotId: building.plotId
    };
}

export function getVillageHeartDecisionState({ state = {}, buildings = [] } = {}) {
    const choices = normalizeHeartDecisions(state?.heartDecisions);
    const choiceByDecision = new Map(
        choices.map(choice => [choice.decisionId, choice])
    );
    const completeIds = new Set(
        buildings
            .filter(building => building.status === 'complete')
            .map(building => building.definitionId)
    );
    const workers = buildings.filter(building => (
        building.status === 'complete' && building.creature
    ));
    const workerByCreatureId = new Map(
        workers.map(building => [building.creature.id, building])
    );
    const completed = choices.map(choice => {
        const definition = HEART_DECISION_BY_ID.get(choice.decisionId);
        const option = definition.options.find(candidate => candidate.id === choice.optionId);
        const savedParticipantBuildings = choice.participantCreatureIds
            .map(id => workerByCreatureId.get(id))
            .filter(Boolean);
        const participantBuildings = savedParticipantBuildings.length > 0
            ? savedParticipantBuildings
            : getDecisionParticipantBuildings(definition, buildings);
        const participants = participantBuildings.map(toHeartParticipant);
        const rememberedParticipantNames = participants.length > 0
            ? participants.map(participant => participant.name)
            : choice.participantNames;
        return {
            ...choice,
            definition,
            option,
            participants,
            participantNames: rememberedParticipantNames,
            speakerName: rememberedParticipantNames[0] || 'A resident',
            followUpLine: option.residentLine
        };
    });
    const nextDefinition = VILLAGE_HEART_DECISION_DEFINITIONS.find(
        decision => !choiceByDecision.has(decision.id)
    ) || null;
    const missingBuildingIds = nextDefinition
        ? nextDefinition.requiredBuildingIds.filter(id => !completeIds.has(id))
        : [];
    const missingRequiredWorkerIds = nextDefinition
        ? nextDefinition.requiredBuildingIds.filter(id => {
            const building = buildings.find(entry => (
                entry.definitionId === id && entry.status === 'complete'
            ));
            return Boolean(building?.definition?.production && !building.creature);
        })
        : [];
    const missingWorkers = nextDefinition
        ? Math.max(
            missingRequiredWorkerIds.length,
            nextDefinition.minimumWorkers - workers.length,
            0
        )
        : 0;
    const active = nextDefinition && missingBuildingIds.length === 0 && missingWorkers === 0
        ? (() => {
            const participants = getDecisionParticipantBuildings(
                nextDefinition,
                buildings
            ).map(toHeartParticipant);
            return {
                ...nextDefinition,
                participants,
                participantNames: participants.map(participant => participant.name)
            };
        })()
        : null;
    const values = getVillageHeartValues({ heartDecisions: choices });

    return {
        active,
        completed,
        values,
        careBonusReady: values.care >= 2,
        readinessBonusReady: values.readiness >= 2,
        allResolved: choices.length === VILLAGE_HEART_DECISION_DEFINITIONS.length,
        nextLocked: !active && nextDefinition
            ? {
                id: nextDefinition.id,
                title: nextDefinition.title,
                missingBuildingIds,
                missingRequiredWorkerIds,
                missingWorkers
            }
            : null
    };
}

export function getVillageHeartMemory(snapshot, { cycle = 0 } = {}) {
    const completed = Array.isArray(snapshot?.heartDecision?.completed)
        ? snapshot.heartDecision.completed
        : [];
    if (completed.length === 0) return null;
    const index = Math.abs(Math.floor(Number(cycle) || 0)) % completed.length;
    const choice = completed[index];
    return {
        decisionId: choice.decisionId,
        optionId: choice.optionId,
        value: choice.option.value,
        optionLabel: choice.option.label,
        participantNames: choice.participantNames,
        speakerName: choice.speakerName,
        line: choice.followUpLine,
        requiredBuildingIds: choice.definition.requiredBuildingIds
    };
}

export function getVillageWorkerCheckIn(snapshot, { creatureId } = {}) {
    if (!creatureId) return null;
    const building = snapshot?.buildings?.find(entry => (
        entry.status === 'complete' &&
        entry.creature?.id === creatureId &&
        entry.definition?.workerRoutine
    ));
    if (!building) return null;
    const memory = [...(snapshot?.heartDecision?.completed || [])]
        .reverse()
        .find(choice => choice.participants?.some(
            participant => participant.creatureId === creatureId
        )) || null;
    const routine = building.definition.workerRoutine;
    return {
        creatureId,
        name: building.creature.name,
        communityType: building.creature.communityType || 'companion',
        residentRole: building.creature.role || null,
        artwork: building.creature.artwork || null,
        buildingId: building.id,
        definitionId: building.definitionId,
        plotId: building.plotId,
        roleLabel: building.definition.roleLabel,
        routineCue: routine.cue,
        line: routine.checkInLine,
        purpose: routine.emotionalPurpose,
        impact: building.definition.worldEffectLabel,
        memory: memory
            ? {
                decisionId: memory.decisionId,
                optionId: memory.optionId,
                label: memory.option.label,
                value: memory.option.value
            }
            : null
    };
}

export function getVillageResidentProposal(snapshot, { definitionId = null } = {}) {
    const requestedDefinitionId = definitionId ||
        snapshot?.worldState?.nextAction?.definitionId || null;
    const definition = snapshot?.definitions?.find(
        entry => entry.id === requestedDefinitionId
    ) || BUILDING_BY_ID.get(requestedDefinitionId) || null;
    if (!definition?.residentNeed) return null;

    const assignedCreatureIds = new Set(
        snapshot?.buildings
            ?.map(building => building.assignedCreatureId)
            .filter(Boolean) || []
    );
    const prerequisiteWorker = [...(snapshot?.buildings || [])]
        .reverse()
        .find(building => (
            building.status === 'complete' &&
            building.creature &&
            (definition.requires || []).includes(building.definitionId)
        ))?.creature || null;
    const preferredResident = snapshot?.roster?.find(creature => (
        creature.preferredBuildingId === definition.id &&
        !assignedCreatureIds.has(creature.id)
    ));
    const resident = preferredResident || prerequisiteWorker ||
        snapshot?.roster?.find(creature => !assignedCreatureIds.has(creature.id)) ||
        snapshot?.roster?.[0] || null;
    if (!resident) return null;

    return {
        definitionId: definition.id,
        speakerId: resident.id,
        speakerName: resident.name || 'Your companion',
        speakerRole: resident.role || null,
        speakerArtwork: resident.artwork || null,
        speakerCommunityType: resident.communityType || 'companion',
        title: definition.residentNeed.title,
        request: definition.residentNeed.request,
        promise: definition.residentNeed.promise,
        immediateImpact: definition.immediateImpact,
        available: definition.placement?.available === true
    };
}

export function getVillageReturnRitual(snapshot, expedition = {}) {
    const levelLabels = {
        mythicalForest: 'MYTHICAL FOREST',
        crystalCaves: 'CRYSTAL CAVES',
        cosmicReef: 'COSMIC REEF',
        voidPeaks: 'VOID PEAKS',
        auroraDepths: 'AURORA DEPTHS',
        finalVoid: 'FINAL VOID'
    };
    const levelId = typeof expedition?.levelId === 'string'
        ? expedition.levelId
        : null;
    if (!levelId) return null;

    const residentById = new Map(
        (snapshot?.roster || []).map(resident => [resident.id, resident])
    );
    const presentResidents = (snapshot?.home?.residents || [])
        .map(resident => residentById.get(resident.id) || resident);
    const workingResidents = (snapshot?.buildings || [])
        .filter(building => building.status === 'complete' && building.creature)
        .map(building => building.creature);
    const welcomeResidents = [...presentResidents, ...workingResidents, ...(snapshot?.roster || [])]
        .filter((resident, index, residents) => (
            resident?.id && residents.findIndex(entry => entry?.id === resident.id) === index
        ))
        .slice(0, 3);
    const names = welcomeResidents.map(resident => resident.name || 'A resident');
    const speakerCopy = names.length >= 2
        ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
        : names[0] || 'The Village Heart';
    const recovered = typeof expedition?.shipPartId === 'string' && expedition.shipPartId
        ? expedition.shipPartId.replaceAll('_', ' ').toUpperCase()
        : 'FIELD RECORD';
    const restored = snapshot?.worldState?.restored || 0;
    const rootCount = snapshot?.plots?.length || VILLAGE_PLOTS.length;

    return {
        id: expedition.id || `${levelId}:${expedition.completedAt || 'return'}`,
        levelId,
        levelLabel: levelLabels[levelId] || levelId.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase(),
        title: 'THE SANCTUARY ANSWERS YOUR RETURN',
        line: `${speakerCopy} meets you at the Heart. The Sanctuary counts who returned before what they carried.`,
        outcome: `${recovered} RECOVERED`,
        worldChange: `${restored}/${rootCount} ROOTS RESTORED · CURRENT PATHS HOLD`,
        residents: welcomeResidents.map(resident => ({
            id: resident.id,
            name: resident.name || 'Resident'
        }))
    };
}

export function getVillageSnapshot(gameState, { stateOverride = null } = {}) {
    const state = normalizeVillageState(
        stateOverride || gameState?.get?.('world.village') || {}
    );
    const unlock = getVillageUnlock(gameState);
    const roster = getVillageCreatureRoster(gameState);
    const creatureById = new Map(roster.map(creature => [creature.id, creature]));
    const occupiedPlots = new Map(state.buildings.map(building => [building.plotId, building]));
    const buildings = state.buildings.map(instance => {
        const definition = BUILDING_BY_ID.get(instance.definitionId);
        const creature = creatureById.get(instance.assignedCreatureId) || null;
        return {
            ...instance,
            definition,
            creature,
            workProfile: creature && definition?.production
                ? getCreatureWorkProfile(creature, definition)
                : null
        };
    });
    const productionRates = buildings.reduce((rates, building) => {
        const production = building.definition?.production;
        if (building.status !== 'complete' || !production || !building.creature) return rates;
        const cyclesPerMinute = MINUTE / production.intervalMs;
        rates[production.resource] += Math.max(
            1,
            Math.round(production.amount * building.workProfile.multiplier)
        ) * cyclesPerMinute;
        return rates;
    }, { wood: 0, stone: 0, food: 0 });
    const home = getVillageHomeProfile(buildings, roster);
    const communityMoments = getVillageCommunityMoments({ buildings });
    const heartDecision = getVillageHeartDecisionState({ state, buildings });
    const plots = VILLAGE_PLOTS.map(plot => ({
        ...plot,
        building: occupiedPlots.get(plot.id) || null,
        open: !occupiedPlots.has(plot.id)
    }));
    const definitions = VILLAGE_BUILDING_DEFINITIONS.map(definition => ({
        ...definition,
        placement: getPlacementStatus(definition, state, unlock)
    }));
    const snapshot = {
        state,
        unlock,
        resources: state.resources,
        lifetimeProduced: state.lifetimeProduced,
        buildings,
        roster,
        plots,
        definitions,
        phase: getVillagePhase(buildings),
        productionRates,
        home,
        communityMoments,
        heartDecision,
        community: getSanctuaryCommunitySnapshot(gameState),
        effects: getVillageGameplayEffects(gameState, { stateOverride: state }),
        capacity: 1 + buildings.reduce(
            (total, building) => total + (
                building.status === 'complete'
                    ? building.definition?.capacityBonus || 0
                    : 0
            ),
            0
        )
    };
    const worldState = getVillageWorldState(snapshot);
    const residentRoutines = getVillageResidentRoutinePlan({
        ...snapshot,
        worldState
    });
    return {
        ...snapshot,
        worldState,
        residentRoutines,
        residentProposal: getVillageResidentProposal({ ...snapshot, worldState })
    };
}

export function placeVillageBuilding(gameState, {
    definitionId,
    plotId,
    now = Date.now(),
    save = true
} = {}) {
    if (!gameState?.get || !gameState?.set) {
        return { changed: false, reason: 'state_unavailable' };
    }
    const snapshot = getVillageSnapshot(gameState);
    if (!snapshot.unlock.unlocked) {
        return { changed: false, reason: 'village_locked', snapshot };
    }
    const definition = snapshot.definitions.find(entry => entry.id === definitionId);
    if (!definition) return { changed: false, reason: 'unknown_building', snapshot };
    if (!PLOT_IDS.has(plotId)) return { changed: false, reason: 'unknown_plot', snapshot };
    if (snapshot.plots.find(plot => plot.id === plotId)?.open !== true) {
        return { changed: false, reason: 'plot_occupied', snapshot };
    }
    if (!definition.placement.available) {
        const reason = definition.placement.alreadyBuilt
            ? 'already_built'
            : definition.placement.missingPrerequisites.length > 0
                ? 'prerequisites_missing'
                : definition.placement.missingResources.length > 0
                    ? 'resources_missing'
                    : 'placement_unavailable';
        return { changed: false, reason, snapshot };
    }

    const state = normalizeVillageState(snapshot.state);
    const resources = { ...state.resources };
    Object.entries(definition.cost).forEach(([resource, amount]) => {
        if (RESOURCE_IDS.has(resource)) resources[resource] -= amount;
    });
    const id = `village:${definition.id}:${plotId}`;
    const next = withHistory({
        ...state,
        resources,
        buildings: [...state.buildings, {
            id,
            definitionId: definition.id,
            plotId,
            status: 'constructing',
            startedAt: now,
            completesAt: now + definition.constructionMs,
            completedAt: null,
            assignedCreatureId: null,
            lastProductionAt: null,
            totalProduced: 0
        }]
    }, {
        type: 'construction_started',
        buildingId: id,
        creatureId: null,
        occurredAt: now
    });
    gameState.set('world.village', normalizeVillageState(next));
    if (save) gameState.save?.();
    const nextSnapshot = getVillageSnapshot(gameState);
    gameState.emit?.('villageChanged', {
        type: 'construction_started',
        buildingId: id,
        snapshot: nextSnapshot
    });
    return { changed: true, reason: 'construction_started', buildingId: id, snapshot: nextSnapshot };
}

export function assignCreatureToVillageBuilding(gameState, {
    buildingId,
    creatureId: requestedCreatureId,
    now = Date.now(),
    save = true
} = {}) {
    if (!gameState?.get || !gameState?.set) {
        return { changed: false, reason: 'state_unavailable' };
    }
    const snapshot = getVillageSnapshot(gameState);
    const building = snapshot.buildings.find(entry => entry.id === buildingId);
    if (!building) return { changed: false, reason: 'unknown_building', snapshot };
    if (building.status !== 'complete' || !building.definition?.production) {
        return { changed: false, reason: 'building_not_assignable', snapshot };
    }
    const creature = snapshot.roster.find(entry => entry.id === requestedCreatureId);
    if (!creature) return { changed: false, reason: 'unknown_creature', snapshot };

    const state = normalizeVillageState(snapshot.state);
    const buildings = state.buildings.map(instance => ({
        ...instance,
        assignedCreatureId: instance.id === buildingId
            ? creature.id
            : instance.assignedCreatureId === creature.id
                ? null
                : instance.assignedCreatureId,
        lastProductionAt: instance.id === buildingId
            ? now
            : instance.lastProductionAt
    }));
    const next = withHistory({ ...state, buildings }, {
        type: 'creature_assigned',
        buildingId,
        creatureId: creature.id,
        occurredAt: now
    });
    gameState.set('world.village', normalizeVillageState(next));
    if (save) gameState.save?.();
    const nextSnapshot = getVillageSnapshot(gameState);
    gameState.emit?.('villageChanged', {
        type: 'creature_assigned',
        buildingId,
        creatureId: creature.id,
        snapshot: nextSnapshot
    });
    return { changed: true, reason: 'creature_assigned', snapshot: nextSnapshot };
}

export function resolveVillageHeartDecision(gameState, {
    decisionId,
    optionId,
    now = Date.now(),
    save = true
} = {}) {
    if (!gameState?.get || !gameState?.set) {
        return { changed: false, reason: 'state_unavailable' };
    }
    const snapshot = getVillageSnapshot(gameState);
    const active = snapshot.heartDecision.active;
    if (!active || active.id !== decisionId) {
        return { changed: false, reason: 'decision_unavailable', snapshot };
    }
    const option = active.options.find(candidate => candidate.id === optionId);
    if (!option) {
        return { changed: false, reason: 'unknown_decision_option', snapshot };
    }

    const state = normalizeVillageState(snapshot.state);
    const next = withHistory({
        ...state,
        heartDecisions: [
            ...state.heartDecisions,
            {
                decisionId: active.id,
                optionId: option.id,
                occurredAt: now,
                participantCreatureIds: active.participants.map(
                    participant => participant.creatureId
                ),
                participantNames: active.participants.map(
                    participant => participant.name
                )
            }
        ]
    }, {
        type: 'heart_decision_resolved',
        buildingId: null,
        creatureId: null,
        decisionId: active.id,
        optionId: option.id,
        occurredAt: now
    });
    gameState.set('world.village', normalizeVillageState(next));
    if (save) gameState.save?.();
    const nextSnapshot = getVillageSnapshot(gameState);
    gameState.emit?.('villageChanged', {
        type: 'heart_decision_resolved',
        decisionId: active.id,
        optionId: option.id,
        snapshot: nextSnapshot
    });
    return {
        changed: true,
        reason: 'heart_decision_resolved',
        decision: active,
        option,
        snapshot: nextSnapshot
    };
}
