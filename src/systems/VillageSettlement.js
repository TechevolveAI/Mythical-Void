import { getFendCommunitySnapshot } from './FendCommunity.js';

export const VILLAGE_SCHEMA_VERSION = 1;
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
        url: '/game/village/world/village-heart.webp'
    }),
    forager_hut: Object.freeze({
        key: 'village-world-forager-hut',
        url: '/game/village/world/forager-hut.webp',
        displaySize: 176
    }),
    sawmill: Object.freeze({
        key: 'village-world-living-sawmill',
        url: '/game/village/world/living-sawmill.webp',
        displaySize: 168
    }),
    current_masonry: Object.freeze({
        key: 'village-world-current-masonry',
        url: '/game/village/world/current-masonry.webp',
        displaySize: 172
    }),
    habitat: Object.freeze({
        key: 'village-world-shared-habitat',
        url: '/game/village/world/shared-habitat.webp',
        displaySize: 178
    }),
    workshop: Object.freeze({
        key: 'village-world-discovery-workshop',
        url: '/game/village/world/discovery-workshop.webp',
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
        extensionImpact: 'Supplies food for habitats, workshops, and future residents.',
        cost: Object.freeze({ wood: 18, stone: 8, food: 0 }),
        constructionMs: 8000,
        production: Object.freeze({ resource: 'food', amount: 2, intervalMs: MINUTE }),
        preferredTraits: Object.freeze(['curious', 'gentle', 'nebula']),
        roleLabel: 'PATHFINDER'
    }),
    Object.freeze({
        id: 'sawmill',
        label: 'LIVING SAWMILL',
        shortLabel: 'SAWMILL',
        description: 'Shapes fallen timber. No healthy tree is marked for cutting.',
        purpose: 'Turns storm-fallen timber into safe paths and repair stock.',
        immediateImpact: '+10 cosmic coins after every expedition victory.',
        worldEffectLabel: 'VICTORY · +10 COINS',
        extensionImpact: 'Supplies wood for bridges, defenses, and village expansion.',
        cost: Object.freeze({ wood: 15, stone: 10, food: 0 }),
        constructionMs: 9000,
        production: Object.freeze({ resource: 'wood', amount: 2, intervalMs: MINUTE }),
        preferredTraits: Object.freeze(['energetic', 'bold', 'star']),
        roleLabel: 'SHAPER'
    }),
    Object.freeze({
        id: 'current_masonry',
        label: 'CURRENT MASONRY',
        shortLabel: 'MASONRY',
        description: 'Recovers loose stone while keeping the Current pathways open.',
        purpose: 'Builds protection without blocking the Current beneath the Fend.',
        immediateImpact: '+1 Current Stone guard charge on every expedition.',
        worldEffectLabel: 'EXPEDITION · +1 GUARD',
        extensionImpact: 'Supplies stone for permanent structures and defenses.',
        cost: Object.freeze({ wood: 15, stone: 8, food: 0 }),
        constructionMs: 10000,
        production: Object.freeze({ resource: 'stone', amount: 2, intervalMs: MINUTE }),
        preferredTraits: Object.freeze(['wise', 'gentle', 'crystal']),
        roleLabel: 'RESONANCE KEEPER'
    }),
    Object.freeze({
        id: 'habitat',
        label: 'SHARED HABITAT',
        shortLabel: 'HABITAT',
        description: 'A sheltered home designed around creature rest and choice.',
        purpose: 'Gives rescued creatures a safe home they can choose to join.',
        immediateImpact: '+2 permanent creature collection capacity.',
        worldEffectLabel: 'HOME · +2 CAPACITY',
        extensionImpact: 'Unlocks resident groups, bonds, and future village districts.',
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
        extensionImpact: 'Enables equipment research, katana upgrades, and new technology.',
        cost: Object.freeze({ wood: 25, stone: 20, food: 6 }),
        constructionMs: 15000,
        production: Object.freeze({ resource: 'stone', amount: 3, intervalMs: MINUTE }),
        preferredTraits: Object.freeze(['curious', 'wise', 'crystal']),
        roleLabel: 'MAKER',
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
        buildings,
        history: normalizeHistory(state?.history),
        lastReconciledAt: normalizeTimestamp(state?.lastReconciledAt)
    };
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
    return {
        feedHappinessBonus: complete.has('forager_hut') ? 5 : 0,
        victoryCoinBonus: complete.has('sawmill') ? 10 : 0,
        guardCharges: complete.has('current_masonry') ? 1 : 0,
        creatureCapacityBonus: complete.has('habitat') ? 2 : 0,
        maxEnergyBonus: complete.has('workshop') ? 1 : 0,
        activeBuildingIds: [...complete]
    };
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
            name: creature.name || 'Unnamed companion'
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

    return {
        state,
        unlock,
        resources: state.resources,
        lifetimeProduced: state.lifetimeProduced,
        buildings,
        roster,
        plots: VILLAGE_PLOTS.map(plot => ({
            ...plot,
            building: occupiedPlots.get(plot.id) || null,
            open: !occupiedPlots.has(plot.id)
        })),
        definitions: VILLAGE_BUILDING_DEFINITIONS.map(definition => ({
            ...definition,
            placement: getPlacementStatus(definition, state, unlock)
        })),
        phase: getVillagePhase(buildings),
        productionRates,
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
