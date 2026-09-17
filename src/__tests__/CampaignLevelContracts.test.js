/** @jest-environment node */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parse } = require('@babel/parser');
const bossConfigs = require('../config/bosses.json');
const projectBeacon = require('../config/project-beacon.json');

// Execute production declarations, not copied algorithms or source-text assertions.
// AST selection avoids importing Phaser, browser globals, or provider services.
function loadPureHelpers(relativePath, exportedNames, dependencies = null, bindings = {}) {
    const filename = path.join(__dirname, '..', relativePath);
    const source = fs.readFileSync(filename, 'utf8');
    const wanted = dependencies && new Set([...exportedNames, ...dependencies]);
    const declarations = parse(source, { sourceType: 'module' }).program.body
        .map(node => node.type === 'ExportNamedDeclaration' ? node.declaration : node)
        .filter(node => node && ['FunctionDeclaration', 'VariableDeclaration'].includes(node.type))
        .filter(node => !wanted || (node.type === 'FunctionDeclaration'
            ? wanted.has(node.id.name)
            : node.declarations.every(declaration => wanted.has(declaration.id.name))));
    return vm.runInNewContext(
        declarations.map(node => source.slice(node.start, node.end)).join('\n') +
            `\n;({ ${exportedNames.join(', ')} });`,
        bindings,
        { filename }
    );
}

const guide = loadPureHelpers('systems/CampaignJourneyGuide.js', [
    'CAMPAIGN_ROUTE', 'getCampaignRoute', 'getCampaignPrerequisiteState', 'getCampaignJourneyStep'
]);
const access = loadPureHelpers('systems/GameState.js', [
    'CAMPAIGN_ROUTE_SEQUENCE', 'getCampaignGateAccessFromData'
], ['readStatePath']);
const rewards = loadPureHelpers('scenes/PlatformerLevelScene.js', [
    'calculateVictoryCoins', 'getBossPowerupReward', 'CAMPAIGN_LEVEL_BY_SCENE_LEVEL'
], ['BOSS_REWARD_KEY_BY_LEVEL'], { bossConfigs });
const story = loadPureHelpers('systems/ProjectBeaconStory.js', [
    'queueProjectBeaconDebrief', 'unlockProjectBeaconMilestone', 'acknowledgeProjectBeaconDebrief'
], [
    'CAMPAIGN_DEBRIEF_NUMBER_BY_LEVEL', 'resolveCampaignCompletionNumber',
    'getList', 'getProjectBeaconDebrief'
], { projectBeacon });
const ship = loadPureHelpers('systems/ShipReconstruction.js', [
    'SHIP_RECONSTRUCTION_STEPS', 'getShipReconstructionSnapshot', 'installShipReconstructionStep'
]);
const residents = loadPureHelpers('systems/RescuedResidents.js', [
    'recordRescuedResident', 'getRescuedResidentSnapshot'
]);
const guardians = loadPureHelpers('systems/GuardianOutcomes.js', [
    'recordGuardianOutcome', 'getGuardianOutcomeSnapshot'
]);

const LEVELS = [
    ['mythicalForest', 'mythical_forest', 'MythicalForestLevel', 'mythical_forest_1',
        'elderTreant', 'forest_core', 'living_power_lattice', 'elder_treant', 'bloom',
        600, 100, 'energy_crystal'],
    ['crystalCaves', 'crystal_caves', 'CrystalCavesLevel', 'crystal_caves_1',
        'crystalGolem', 'crystal_core', 'propulsion_control', 'crystal_golem', 'pebble',
        500, 100, 'crystal_shield'],
    ['cosmicReef', 'stellar_reef', 'ReefLevel', 'reef_1',
        'voidSerpent', 'dimensional_drive', 'sealed_return_vector', 'nyxvoral', 'zephyr',
        750, 0, 'double_coins'],
    ['voidPeaks', 'void_peaks', 'VoidPeaksLevel', 'void_peaks_1',
        'cosmicTitan', 'hull_plating', 'resonance_hull', 'cosmic_titan', 'wisp',
        1500, 0, 'power_shot'],
    ['auroraDepths', 'aurora_depths', 'AuroraDepthsLevel', 'aurora_depths_1',
        'shadowPhoenix', 'aurora_reactor', 'uplink_hold', 'shadow_phoenix', 'luna',
        1000, 0, 'health_boost'],
    ['finalVoid', 'final_void', 'FinalVoidLevel', 'final_void_1',
        'voidEmpress', 'command_module', 'black_box_recovery', 'void_empress', 'nova',
        2500, 0, 'super_blast']
].map(([
    levelStateId, gateId, sceneKey, runtimeId, bossKey, partId, stepId,
    guardianId, residentId, baseCoins, bonusCoins, powerupId
], index) => ({
    levelStateId, gateId, sceneKey, runtimeId, bossKey, partId, stepId,
    guardianId, residentId, baseCoins, bonusCoins, powerupId, index,
    debriefId: index < 5 ? `beacon_debrief_${index + 1}` : null
}));
const OCCURRED_AT = '2026-09-17T12:00:00.000Z';

function createState() {
    const state = {
        levels: {},
        hubWorld: {
            gates: Object.fromEntries(LEVELS.map(level => [level.gateId, {
                unlocked: level.index === 0
            }])),
            mapsOwned: [],
            shipParts: { collected: [], finalBossUnlocked: false },
            shipCompletionCutsceneShown: false
        },
        story: { projectBeacon: { fieldKit: { recovered: true } } }
    };
    return {
        state,
        get(propertyPath) {
            return propertyPath.split('.').reduce((value, key) => value?.[key], state);
        },
        set(propertyPath, value) {
            const keys = propertyPath.split('.');
            const lastKey = keys.pop();
            const target = keys.reduce((current, key) => (current[key] ||= {}), state);
            target[lastKey] = value;
        },
        getCampaignGateAccess(gateId) {
            return access.getCampaignGateAccessFromData(state, gateId);
        },
        save: jest.fn(),
        emit: jest.fn()
    };
}

function recoverPart(state, level) {
    state.set('hubWorld.shipParts.collected', [
        ...state.get('hubWorld.shipParts.collected'), level.partId
    ]);
}

function installPart(state, level) {
    return ship.installShipReconstructionStep(state, level.stepId, {
        occurredAt: OCCURRED_AT, save: false
    });
}

describe('campaign level contracts across production helpers', () => {
    test('joins the guide, save-state route, runtime identity, and installation registries', () => {
        expect(guide.CAMPAIGN_ROUTE).toHaveLength(LEVELS.length);
        expect(access.CAMPAIGN_ROUTE_SEQUENCE).toHaveLength(LEVELS.length);
        expect(ship.SHIP_RECONSTRUCTION_STEPS).toHaveLength(LEVELS.length);
        expect(Object.keys(rewards.CAMPAIGN_LEVEL_BY_SCENE_LEVEL)).toHaveLength(LEVELS.length);
        LEVELS.forEach(level => {
            const { levelStateId, gateId, sceneKey, debriefId, index, partId, stepId } = level;
            const route = guide.CAMPAIGN_ROUTE[index];
            expect(route).toMatchObject({
                levelStateId, gateId, sceneKey, debriefId, completionNumber: index + 1
            });
            [levelStateId, gateId, sceneKey].forEach(id => {
                expect(guide.getCampaignRoute(id)).toBe(route);
            });
            expect(rewards.CAMPAIGN_LEVEL_BY_SCENE_LEVEL[level.runtimeId]).toBe(levelStateId);
            expect(access.CAMPAIGN_ROUTE_SEQUENCE[index]).toMatchObject({
                levelStateId, gateId, shipPartId: partId, debriefId
            });
            expect(ship.SHIP_RECONSTRUCTION_STEPS[index]).toMatchObject({
                id: stepId, partId, order: index + 1
            });
        });
    });

    test.each(LEVELS)('$levelStateId connects completion, rescue, report, and manual repair', level => {
        const state = createState();
        LEVELS.slice(0, level.index).forEach(previous => {
            state.set(`levels.${previous.levelStateId}.completed`, true);
            recoverPart(state, previous);
            expect(installPart(state, previous).changed).toBe(true);
        });
        state.set(`hubWorld.gates.${level.gateId}.unlocked`, true);
        if (level.index === 5) {
            // These are Hub-owned handoff flags, not effects of the installer.
            state.set('hubWorld.shipParts.finalBossUnlocked', true);
            state.set('hubWorld.shipCompletionCutsceneShown', true);
        }
        expect(state.getCampaignGateAccess(level.gateId).unlocked).toBe(true);
        expect(guide.getCampaignJourneyStep(state)).toMatchObject({
            levelStateId: level.levelStateId, status: 'ready'
        });
        expect(installPart(state, level)).toMatchObject({
            changed: false, reason: 'ship_part_required'
        });

        // Match completion ordering: record rescues before marking the level complete,
        // otherwise legacy backfill can hide a missing first-rescue history entry.
        const guardian = guardians.recordGuardianOutcome(state, level.levelStateId, {
            resolvedAt: OCCURRED_AT, save: false
        });
        const resident = residents.recordRescuedResident(state, level.levelStateId, {
            rescuedAt: OCCURRED_AT, save: false
        });
        expect(guardian).toMatchObject({
            changed: true, record: { guardianId: level.guardianId, outcome: 'restored' }
        });
        expect(resident).toMatchObject({ changed: true, resident: { id: level.residentId } });
        expect(state.get('world.rescuedResidents.rescueHistory')).toContainEqual({
            residentId: level.residentId, levelId: level.levelStateId, rescuedAt: OCCURRED_AT
        });
        state.set(`levels.${level.levelStateId}.completed`, true);
        recoverPart(state, level);
        const reportOptions = {
            levelId: level.levelStateId, shipPartId: level.partId, completedAt: OCCURRED_AT
        };
        const report = story.queueProjectBeaconDebrief(state, reportOptions);
        const unlock = story.unlockProjectBeaconMilestone(state, level.levelStateId);
        if (level.debriefId) {
            expect(report).toEqual({
                id: level.debriefId, levelId: level.levelStateId,
                shipPartId: level.partId, completedAt: OCCURRED_AT
            });
            expect(story.queueProjectBeaconDebrief(state, reportOptions)).toBeNull();
            story.acknowledgeProjectBeaconDebrief(state, report.id);
            expect(story.queueProjectBeaconDebrief(state, reportOptions)).toBeNull();
        } else {
            expect(report).toBeNull();
        }
        if (level.index < 4) {
            expect(unlock).toMatchObject({
                gateId: LEVELS[level.index + 1].gateId, newlyUnlocked: true
            });
            expect(state.getCampaignGateAccess(unlock.gateId).unlocked).toBe(true);
        } else {
            expect(unlock).toBeNull();
        }

        const recovered = ship.getShipReconstructionSnapshot(state);
        expect(recovered).toMatchObject({
            completedCount: level.index, complete: false,
            readyStep: { id: level.stepId, installed: false, recovered: true }
        });
        const installed = installPart(state, level).snapshot;
        expect(installed).toMatchObject({
            completedCount: level.index + 1,
            finalVoidReady: level.index >= 4,
            complete: level.index === 5,
            transmissionStatus: 'not_sent', departureStatus: 'deferred', travelStatus: 'undecided'
        });
        expect(installed.state.completedStepIds).toEqual(
            LEVELS.slice(0, level.index + 1).map(entry => entry.stepId)
        );
        expect(state.get('story.projectBeacon.finale')).toBeUndefined();
        expect(state.get('story.projectBeacon.companionConsent')).toBeUndefined();
        expect(installPart(state, level).reason).toBe('already_installed');
        expect(guardians.recordGuardianOutcome(state, level.levelStateId, { save: false }).changed)
            .toBe(false);
        expect(residents.recordRescuedResident(state, level.levelStateId, { save: false }).changed)
            .toBe(false);
        expect(guardians.getGuardianOutcomeSnapshot(state).resolvedCount).toBe(level.index + 1);
        expect(residents.getRescuedResidentSnapshot(state).rescuedCount).toBe(level.index + 1);
    });

    test.each(LEVELS)('$levelStateId normalizes bonus counts and returns an isolated usable reward', level => {
        const configuredReward = bossConfigs[level.bossKey].rewards.powerup;
        const original = JSON.parse(JSON.stringify(configuredReward));
        expect(rewards.calculateVictoryCoins(level.levelStateId)).toBe(level.baseCoins);
        [-3, 'invalid', NaN, null].forEach(count => {
            expect(rewards.calculateVictoryCoins(level.levelStateId, count)).toBe(level.baseCoins);
        });
        expect(rewards.calculateVictoryCoins(level.levelStateId, '2.9'))
            .toBe(level.baseCoins + 2 * level.bonusCoins);
        const reward = rewards.getBossPowerupReward(level.levelStateId);
        expect(reward).toMatchObject({
            id: level.powerupId, type: 'powerup', usableInLevel: true,
            quantity: 1, rewardSource: `guardian:${level.levelStateId}`, effect: original.effect
        });
        reward.quantity = 99;
        const effectKey = Object.keys(reward.effect)[0];
        reward.effect[effectKey] = -1;
        expect(configuredReward).toEqual(original);
        expect(rewards.getBossPowerupReward(level.levelStateId)).toMatchObject({
            quantity: 1, effect: original.effect
        });
    });

    test('every earlier missing completion blocks a later discovered route, even with ship flags', () => {
        LEVELS.slice(1).forEach(level => {
            LEVELS.slice(0, level.index).forEach(missing => {
                const state = createState();
                LEVELS.forEach(entry => state.set(`levels.${entry.levelStateId}.completed`, true));
                state.set(`levels.${missing.levelStateId}.completed`, false);
                state.set(`hubWorld.gates.${level.gateId}.unlocked`, true);
                state.set('hubWorld.mapsOwned', [level.gateId]);
                state.set('hubWorld.shipParts.finalBossUnlocked', true);
                state.set('hubWorld.shipCompletionCutsceneShown', true);
                const prerequisite = guide.getCampaignPrerequisiteState(state, level.sceneKey);
                expect(prerequisite.prerequisitesMet).toBe(false);
                expect(prerequisite.missingPrerequisites.map(route => route.levelStateId))
                    .toEqual([missing.levelStateId]);
                expect(state.getCampaignGateAccess(level.gateId)).toMatchObject({
                    discovered: true, prerequisitesMet: false, unlocked: false,
                    nextRequiredRoute: { levelStateId: missing.levelStateId }
                });
                if (level.index < 5) {
                    expect(story.unlockProjectBeaconMilestone(
                        state, LEVELS[level.index - 1].levelStateId
                    )).toMatchObject({ blocked: true, newlyUnlocked: false });
                }
            });
        });
    });

    test('final access requires both Hub flags; final completion still leaves a manual repair', () => {
        const state = createState();
        LEVELS.slice(0, 5).forEach(level => {
            state.set(`levels.${level.levelStateId}.completed`, true);
            recoverPart(state, level);
        });
        state.set('hubWorld.gates.final_void.unlocked', true);
        expect(ship.getShipReconstructionSnapshot(state).finalVoidReady).toBe(false);
        LEVELS.slice(0, 5).forEach(level => installPart(state, level));
        expect(ship.getShipReconstructionSnapshot(state).finalVoidReady).toBe(true);
        [false, true].forEach(installedFlag => {
            [false, true].forEach(revealFlag => {
                state.set('hubWorld.shipParts.finalBossUnlocked', installedFlag);
                state.set('hubWorld.shipCompletionCutsceneShown', revealFlag);
                expect(state.getCampaignGateAccess('final_void').unlocked)
                    .toBe(installedFlag && revealFlag);
            });
        });
        state.set('levels.finalVoid.completed', true);
        recoverPart(state, LEVELS[5]);
        expect(guide.getCampaignJourneyStep(state).status).toBe('complete');
        expect(ship.getShipReconstructionSnapshot(state)).toMatchObject({
            complete: false, readyStep: { id: 'black_box_recovery' }
        });
        expect(installPart(state, LEVELS[5]).snapshot.capabilities).toMatchObject({
            blackBoxProof: 'recovered', secureReturnVector: 'sealed',
            longRangeUplink: 'held_exposure_risk', creatureLifeSupport: 'prototype_required'
        });
        expect(state.get('story.projectBeacon.finale')).toBeUndefined();
    });
});

describe('campaign helper hardening regressions', () => {
    test.each(['effective access', 'lightweight fallback'])('Final Void ready/resume respects %s', mode => {
        const state = createState();
        LEVELS.slice(0, 5).forEach(level => state.set(`levels.${level.levelStateId}.completed`, true));
        const guideState = mode === 'effective access' ? state : { get: state.get };
        [false, true].forEach(rawUnlocked => {
            [false, true].forEach(installedFlag => {
                [false, true].forEach(revealFlag => {
                    [false, true].forEach(hasCheckpoint => {
                        state.set('hubWorld.gates.final_void.unlocked', rawUnlocked);
                        state.set('hubWorld.shipParts.finalBossUnlocked', installedFlag);
                        state.set('hubWorld.shipCompletionCutsceneShown', revealFlag);
                        state.set('story.projectBeacon.expeditionCheckpoint', hasCheckpoint
                            ? { sceneKey: 'FinalVoidLevel', label: 'Trust Marker' }
                            : null);
                        const before = JSON.stringify(state.state);
                        const unlocked = rawUnlocked && installedFlag && revealFlag;
                        expect(state.getCampaignGateAccess('final_void').unlocked).toBe(unlocked);
                        expect(guide.getCampaignJourneyStep(guideState)).toMatchObject({
                            levelStateId: 'finalVoid',
                            status: unlocked ? (hasCheckpoint ? 'resume' : 'ready') : 'locked'
                        });
                        expect(JSON.stringify(state.state)).toBe(before);
                    });
                });
            });
        });
    });

    test('effective access is authoritative over raw flags for every route and checkpoint', () => {
        LEVELS.forEach(level => {
            [false, true].forEach(unlocked => {
                const state = createState();
                LEVELS.slice(0, level.index).forEach(previous => {
                    state.set(`levels.${previous.levelStateId}.completed`, true);
                });
                state.set(`hubWorld.gates.${level.gateId}.unlocked`, !unlocked);
                state.getCampaignGateAccess = jest.fn(() => ({
                    unlocked, prerequisitesMet: true, shipRequirementsMet: true
                }));
                expect(guide.getCampaignJourneyStep(state).status).toBe(unlocked ? 'ready' : 'locked');
                state.set('story.projectBeacon.expeditionCheckpoint', { sceneKey: level.sceneKey });
                expect(guide.getCampaignJourneyStep(state).status).toBe(unlocked ? 'resume' : 'locked');
                expect(state.getCampaignGateAccess).toHaveBeenCalledWith(level.gateId);
            });
        });
    });

    test('lightweight states still offer the first Forest route without a gate record', () => {
        expect(guide.getCampaignJourneyStep({ get: () => undefined })).toMatchObject({
            gateId: 'mythical_forest', status: 'ready'
        });
    });

    test.each(LEVELS)('$levelStateId cannot install a new step without the field kit', level => {
        const state = createState();
        LEVELS.slice(0, level.index).forEach(previous => {
            recoverPart(state, previous);
            expect(installPart(state, previous).changed).toBe(true);
        });
        recoverPart(state, level);
        [false, undefined].forEach(recovered => {
            state.set('story.projectBeacon.fieldKit.recovered', recovered);
            const before = JSON.stringify(state.state);
            expect(ship.getShipReconstructionSnapshot(state)).toMatchObject({
                available: false, ready: false
            });
            expect(ship.installShipReconstructionStep(state, level.stepId)).toMatchObject({
                changed: false, reason: 'field_kit_required'
            });
            expect(JSON.stringify(state.state)).toBe(before);
            expect(state.save).not.toHaveBeenCalled();
        });
        state.set('story.projectBeacon.fieldKit.recovered', true);
        expect(installPart(state, level).changed).toBe(true);
    });

    test.each([1, 5, 6])('preserves %i legacy installed steps without field-kit or part records', count => {
        const state = createState();
        state.set('story.projectBeacon.fieldKit', {});
        state.set('story.projectBeacon.shipReconstruction', {
            completedStepIds: LEVELS.slice(0, count).map(level => level.stepId)
        });
        const snapshot = ship.getShipReconstructionSnapshot(state);
        state.set('story.projectBeacon.shipCapabilities', snapshot.capabilities);
        state.set('hubWorld.shipParts.finalBossUnlocked', snapshot.finalVoidReady);
        state.set('hubWorld.gates.final_void.unlocked', snapshot.finalVoidReady);
        const before = JSON.stringify(state.state);
        LEVELS.slice(0, count).forEach(level => {
            expect(ship.installShipReconstructionStep(state, level.stepId)).toMatchObject({
                changed: false, reason: 'already_installed',
                snapshot: {
                    completedCount: count, finalVoidReady: count >= 5, complete: count === 6
                }
            });
        });
        expect(ship.getShipReconstructionSnapshot(state)).toEqual(snapshot);
        expect(JSON.stringify(state.state)).toBe(before);
        expect(state.save).not.toHaveBeenCalled();
    });

    test('non-finite bonus counts award only the configured base coins for every level', () => {
        LEVELS.forEach(level => {
            [Infinity, -Infinity, NaN, 'Infinity', '-Infinity', '1e999'].forEach(count => {
                expect(rewards.calculateVictoryCoins(level.levelStateId, count)).toBe(level.baseCoins);
            });
        });
    });
});
