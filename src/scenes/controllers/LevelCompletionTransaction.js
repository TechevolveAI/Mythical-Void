import economy from '../../systems/EconomyManager.js';
import inventory from '../../systems/InventoryManager.js';
import achievements from '../../systems/AchievementSystem.js';
import quests from '../../systems/QuestManager.js';
import * as outcomes from '../../systems/GuardianOutcomes.js';
import * as guardians from '../../systems/GuardianResidents.js';
import * as residents from '../../systems/RescuedResidents.js';
import * as kit from '../../systems/ProjectBeaconFieldKit.js';
import { getCurrentRegionSnapshot, CURRENT_REGION_DEFINITIONS } from '../../systems/CurrentEcology.js';
import bossConfigs from '../../config/bosses.json';
import projectBeacon from '../../config/project-beacon.json';
import { copyDetachedJsonData as copy } from '../../utils/DetachedJsonData.js';
import { captureCompletionAchievementSource } from '../../dev/CompletionAchievementDraft.js';
import { calculateLevelCompletionDraft } from '../../dev/LevelCompletionDraft.js';
import { prepareCompletionPublicationDraft } from '../../dev/CompletionPublicationDraft.js';
import { captureCompletionPacketGuard } from '../../dev/CompletionPacketGuard.js';
import { clearCompletionSaveRecovery, showCompletionSaveRecovery } from '../../ui/CompletionSaveRecovery.js';

function pinData(root) {
    copy(root);
    const nodes = [], seen = new Set();
    const visit = node => {
        if (!node || typeof node !== 'object' || seen.has(node)) return;
        seen.add(node);
        nodes.push({ node, prototype: Object.getPrototypeOf(node), extensible: Object.isExtensible(node),
            fields: Object.getOwnPropertyDescriptors(node), keys: Reflect.ownKeys(node) });
        Object.values(node).forEach(visit);
    };
    visit(root);
    return () => nodes.every(({ node, prototype, extensible, fields, keys }) => {
        const next = Reflect.ownKeys(node), current = Object.getOwnPropertyDescriptors(node);
        return Object.getPrototypeOf(node) === prototype && Object.isExtensible(node) === extensible && next.length === keys.length &&
            keys.every((key, index) => key === next[index] && ['value', 'get', 'set', 'enumerable', 'writable', 'configurable']
                .every(name => Object.is(fields[key][name], current[key]?.[name])));
    });
}
const rewardCatalogueCurrent = pinData(bossConfigs);
const domainCataloguesCurrent = [projectBeacon, CURRENT_REGION_DEFINITIONS, outcomes.GUARDIAN_OUTCOME_DEFINITIONS,
    guardians.GUARDIAN_RESIDENT_DEFINITIONS, residents.RESCUED_RESIDENT_DEFINITIONS,
    kit.PROJECT_BEACON_FIELD_KIT, kit.PROJECT_BEACON_KATANA_UPGRADES].map(pinData);
const attempts = new WeakMap();
const attemptBlueprints = new WeakMap();
const profiles = Object.freeze({
    mythicalForest: Object.freeze({ levelId: 'mythicalForest', sceneLevelId: 'mythical_forest_1', guardianId: 'elder_treant',
        shipPartId: 'forest_core', speedrunThreshold: 240000, rewardBonusField: 'starFragmentsCollected',
        lifetimeSlot: 'forestCompletionLifetime', attemptSlot: 'forestCompletionAttempt', victoryFlags: ['forestVictoryShown'],
        sourceActors: [], afterCommit: null }),
    voidPeaks: Object.freeze({ levelId: 'voidPeaks', sceneLevelId: 'void_peaks_1', guardianId: 'cosmic_titan',
        shipPartId: 'hull_plating', speedrunThreshold: 180000, rewardBonusField: null,
        lifetimeSlot: 'completionSaveLifetime', attemptSlot: 'completionSaveAttempt', victoryFlags: ['peakVictoryShown', 'peakResultShown'],
        sourceActors: ['boss', 'mountainBody', 'bossNameText', 'bossSubtitle', 'bossHealthBar', 'bossPressureText'],
        afterCommit: 'startSavedPeakVictory' }),
    crystalCaves: Object.freeze({ levelId: 'crystalCaves', sceneLevelId: 'crystal_caves_1', guardianId: 'crystal_golem',
        shipPartId: 'crystal_core', katanaUpgradeId: 'crystal_edge', speedrunThreshold: 180000, rewardBonusField: 'starFragmentsCollected',
        lifetimeSlot: 'completionSaveLifetime', attemptSlot: 'completionSaveAttempt', victoryFlags: ['crystalVictoryShown', 'crystalResultShown'],
        sourceActors: ['boss', 'crystalCore'], operationFields: ['completionGuardianAt', 'crystalVictory'],
        guardianBefore: true, afterCommit: 'startSavedCrystalCompletion' }),
    cosmicReef: Object.freeze({ levelId: 'cosmicReef', sceneLevelId: 'reef_1', guardianId: 'nyxvoral',
        shipPartId: 'dimensional_drive', speedrunThreshold: 240000, rewardBonusField: null,
        lifetimeSlot: 'completionSaveLifetime', attemptSlot: 'completionSaveAttempt', victoryFlags: ['reefVictoryShown'],
        physicsActor: 'bossBody', cosmeticBoss: true, sourceActors: ['boss', 'bossBody'],
        operationFields: ['completionGuardianAt', 'reefVictory'], guardianBefore: true, afterCommit: 'startSavedReefCompletion',
        presentAfterCommit: true, requireAfterCommit: true }),
    auroraDepths: Object.freeze({ levelId: 'auroraDepths', sceneLevelId: 'aurora_depths_1', guardianId: 'shadow_phoenix',
        shipPartId: 'aurora_reactor', katanaUpgradeId: 'aurora_guard', speedrunThreshold: 300000, rewardBonusField: null,
        lifetimeSlot: 'completionSaveLifetime', attemptSlot: 'completionSaveAttempt', victoryFlags: ['auroraVictoryShown'],
        physicsActor: 'bossBody', cosmeticBoss: true, sourceActors: ['boss', 'bossBody'], operationFields: ['auroraVictory'],
        afterCommit: 'startSavedAuroraCompletion', requireAfterCommit: true })
});
const safe = callback => {
    try {
        const returned = callback();
        try { Promise.prototype.then.call(returned, undefined, () => {}); } catch { /* Not a native promise. */ }
    } catch { /* Optional feedback cannot undo a verified save. */ }
};
const failureCode = error => /^FOREST_[A-Z_]{1,64}$/.test(error?.message || '')
    ? error.message : 'COMPLETION_UNAVAILABLE';
const sameMethods = (object, names) => {
    const prototype = Object.getPrototypeOf(object);
    const methods = names.map(name => object[name]), inherited = names.map(name => prototype?.[name]);
    return () => Object.getPrototypeOf(object) === prototype && names.every((name, index) =>
        object[name] === methods[index] && prototype?.[name] === inherited[index]);
};

// A complete, retained attempt for a fixed existing level. The blueprint is
// captured by the level module, not rediscovered from a later callback/scene.
export function createLevelCompletionHandler(blueprint, levelId) {
    if (typeof levelId !== 'string' || !Object.hasOwn(profiles, levelId)) throw Error('COMPLETION_PROFILE_UNAVAILABLE');
    const profile = profiles[levelId];
    if (!Object.isFrozen(blueprint) || !Object.isFrozen(blueprint.methods)) throw Error('FOREST_COMPLETION_BLUEPRINT_UNAVAILABLE');
    const handler = scene => {
        const previous = attempts.get(scene);
        if (previous?.lifetime === scene[profile.lifetimeSlot]) return attemptBlueprints.get(previous) === blueprint && previous.run();
        previous?.retire();
        const state = window.GameState, cloud = window.CloudSave, lifetime = scene[profile.lifetimeSlot], completionNow = Date.now();
        const root = state?.state, admission = state?.saveAdmission, epoch = state?.getSaveAdmission?.().epoch;
        const cloudEpoch = cloud?.campaignEpoch, cloudUser = cloud?.currentUser?.id;
        const storage = localStorage, getRaw = storage.getItem, key = state?.saveKey, mode = state?.storageMode;
        const sys = scene.sys, plugin = scene.scene, clock = scene.time, events = scene.events;
        const isActive = sys?.isActive;
        const input = scene.input, keyboard = input?.keyboard, physics = scene.physics, world = physics?.world;
        const camera = scene.cameras?.main, player = scene.player, body = player?.body, encounter = scene.guardianEncounter;
        const registration = sys?.game?.scene, getScene = registration?.getScene, sceneKey = sys?.settings?.key;
        let draft, guard, reader, memory, publications = [], participants, selected = {}, runtimeCurrent = () => false, originalDataCurrent = () => false, originalActorsCurrent = () => false;
        let deferral, offAdmission, offShutdown, notificationSinks, ownedPanel, ownedRelease, resumePreparation;
        const attempt = { lifetime, phase: 'preparing', busy: false, closed: false, verified: false, audioAttempted: false };
        const basic = () => !attempt.closed && scene[profile.attemptSlot] === attempt && scene[profile.lifetimeSlot] === lifetime &&
            window.GameState === state && state?.saveAdmission === admission && state?.getSaveAdmission?.().epoch === epoch &&
            window.CloudSave === cloud && cloud?.campaignEpoch === cloudEpoch && cloud?.currentUser?.id === cloudUser &&
            state?.saveKey === key && state?.storageMode === mode && localStorage === storage && storage.getItem === getRaw &&
            (state?.state === root || state?.state === draft?.state) && scene.sys === sys && scene.scene === plugin && scene.time === clock &&
            scene.events === events && sys?.isActive === isActive && typeof isActive === 'function' && isActive.call(sys) === true && !scene._returningToHub;
        const core = () => basic() && state.getSaveAdmission().status === 'ready';
        const current = () => core() && runtimeCurrent() && guard?.isCurrent() && publications.every(value => value.isCurrent()) &&
            (state.state === root ? originalDataCurrent() && memory.isCurrent() : state.state === draft.state);
        const campaign = () => core() && (state.state === root ? current() : state.state === draft?.state);
        const ownsUpload = lease => window.CloudSave === cloud && cloud?.gameState === state && cloud?.activeCloudWrite === lease &&
            cloud?.campaignEpoch === cloudEpoch && cloud?.currentUser?.id === cloudUser;
        const exit = () => {
            if (!basic()) return;
            try { blueprint.methods.returnToHub.call(scene, { sanctuary: true }); attempt.retire(); }
            catch { recover(); }
        };
        const recover = () => {
            if (!basic() || state.getSaveAdmission().status !== 'ready') return false;
            const retry = attempt.phase === 'waiting' || attempt.phase === 'prepared' && current() && reader.isCurrent() || attempt.phase === 'committed';
            return showCompletionSaveRecovery(scene, { isCurrent: basic, committed: attempt.phase === 'committed',
                waiting: attempt.phase === 'waiting', onRetry: retry ? attempt.run : null, onExit: exit });
        };
        attempt.retire = () => {
            if (attempt.closed) return;
            attempt.closed = true; attempt.phase = 'retired';
            safe(() => offAdmission?.()); safe(() => offShutdown?.()); safe(() => deferral?.release());
            if (scene[profile.attemptSlot] === attempt) {
                clearCompletionSaveRecovery(scene);
                if (ownedPanel && scene.regionalVictoryPanel === ownedPanel) {
                    safe(() => ownedPanel.destroy()); scene.regionalVictoryPanel = null;
                }
                if (ownedRelease && scene.residentReleasePresentation === ownedRelease) safe(() => ownedRelease.retire());
            }
        };
        attempt.ownPanel = panel => { if (attempt.presenting && core()) ownedPanel = panel; };
        attempt.ownRelease = release => { if (attempt.presenting && core()) ownedRelease = release; };
        const presentationCurrent = () => {
            try {
                if (!attempt.verified || !core() || !runtimeCurrent() || state.state !== draft.state ||
                    state.get(`levels.${profile.levelId}.completed`) !== true) return false;
                const raw = getRaw.call(storage, key);
                const lease = state.cloudWriteLease;
                if (lease) {
                    const pending = state.inspectCloudRecovery().pending;
                    if (!ownsUpload(lease) || lease.kind !== 'upload' || lease.admissionEpoch !== epoch || !lease.isCurrentCampaign?.() ||
                        lease.snapshot !== raw || pending.length !== 1 || pending[0].id !== lease.id || pending[0].payload !== lease.snapshot) return false;
                }
                // Read-only UI authority after verified adoption, not a refreshed
                // write source. Normal later media/accounting may already be saved.
                return raw === JSON.stringify(state.createSaveSnapshot());
            } catch { return false; }
        };
        attempt.isPresentationCurrent = presentationCurrent;
        attempt.bindSummaryContinuation = continuation => {
            const release = ownedRelease, result = draft?.result;
            if (!attempt.presenting || !presentationCurrent() || !release || scene.residentReleasePresentation !== release || release.closed) {
                throw Error('FOREST_SUMMARY_HANDOFF_UNAVAILABLE');
            }
            let busy = false;
            const ownedContinuation = () => {
                if (busy || attempt.phase !== 'presented' || !presentationCurrent() || scene.levelCompletionResult !== result ||
                    scene.residentReleasePresentation !== release || release.closed || !release.busy || scene.residentReleaseOpen ||
                    release.continuation !== ownedContinuation || !release.request || release.request.active !== false ||
                    scene.residentReleaseClose !== release.close || scene.pendingResidentReleaseContinuation !== null) return false;
                busy = true; attempt.presenting = true;
                try { return continuation() === true && presentationCurrent(); }
                finally { busy = false; attempt.presenting = false; }
            };
            return ownedContinuation;
        };
        const present = () => {
            if (!presentationCurrent()) { recover(); return false; }
            clearCompletionSaveRecovery(scene);
            scene.levelCompletionResult = draft.result;
            if (!presentationCurrent()) return false;
            scene._levelProgressionRecorded = true;
            for (const field of profile.victoryFlags) { if (!presentationCurrent()) return false; scene[field] = true; }
            const feedback = action => { if (presentationCurrent()) safe(action); };
            feedback(() => blueprint.methods.syncCampaignObjectiveDisplay.call(scene, { visible: false, force: true }));
            feedback(() => scene.combatJuice?.comboDisplay?.setVisible?.(false));
            feedback(() => scene.combatJuice?.comboMultiplierDisplay?.setVisible?.(false));
            if (!presentationCurrent()) return false;
            attempt.presenting = true;
            try {
                if (!blueprint.methods.showRegionalVictorySummary.call(scene)) throw Error('FOREST_REWARDS_NOT_OPEN');
                if (!core() || !runtimeCurrent()) return false;
                attempt.phase = 'presented'; deferral.release();
                if (!attempt.audioAttempted) {
                    attempt.audioAttempted = true; safe(() => selected.AudioManager?.playLevelUp?.());
                }
                return true;
            } catch (error) {
                attempt.failureCode = failureCode(error);
                if (!core()) return false;
                if ((scene.regionalVictoryPanel && scene.regionalVictoryPanel !== ownedPanel) ||
                    (scene.residentReleasePresentation && scene.residentReleasePresentation !== ownedRelease)) {
                    attempt.retire(); return false;
                }
                // Only presentation-owned fields are recoverable. The durable
                // packet/Guardian count is never calculated or granted again.
                if (ownedRelease && scene.residentReleasePresentation === ownedRelease) safe(() => ownedRelease.retire());
                if (ownedPanel && scene.regionalVictoryPanel === ownedPanel) {
                    safe(() => ownedPanel.destroy()); scene.regionalVictoryPanel = null;
                }
                scene.regionalVictorySummaryStarted = false;
                if (!scene.residentReleaseOpen) scene.completionPresentationShown = false;
                recover(); return false;
            } finally { attempt.presenting = false; }
        };
        attempt.showRewards = () => {
            if (attempt.closed || attempt.busy) return false;
            if (attempt.phase === 'presented') return basic();
            if (attempt.phase !== 'committed') return false;
            attempt.busy = true;
            try { return present(); }
            catch { recover(); return false; }
            finally { attempt.busy = false; }
        };
        attempt.run = () => {
            if (attempt.closed || attempt.busy) return false;
            if (attempt.phase === 'presented') return basic();
            if (!['waiting', 'prepared', 'committed'].includes(attempt.phase)) { recover(); return false; }
            attempt.busy = true;
            try {
                if (attempt.phase === 'waiting' && !resumePreparation()) { recover(); return false; }
                if (attempt.phase === 'committed') return present();
                if (!current() || !reader.isCurrent()) { attempt.phase = 'protected'; recover(); return false; }
                if (!state.canCommitHatchSave()) { recover(); return false; }
                const result = state.commitHatchSaveDraft(draft.state, { draftGuard: guard, isCurrentCampaign: campaign, isCurrentUpload: ownsUpload,
                    isCurrentResult: (live, stored, bytes) => live === draft.state &&
                        JSON.stringify(state.createSaveSnapshot({ state: live })) === bytes && JSON.stringify(stored) === bytes,
                    onPublished: () => {
                        for (const publication of publications) {
                            if (!current()) throw Error('FOREST_COMPLETION_RETIRED'); publication.publish();
                        }
                        if (!current()) throw Error('FOREST_COMPLETION_RETIRED');
                    }, notifications: draft.timeline,
                    onNotification: entry => {
                        if (!current() || !publications.every(value => value.isPublished())) throw Error('FOREST_COMPLETION_RETIRED');
                        if (entry.type === 'notification') {
                            const [sink, emit] = notificationSinks[entry.packet.kind] || [];
                            if (!sink || typeof emit !== 'function') throw Error('FOREST_COMPLETION_SINK_UNAVAILABLE');
                            emit.call(sink, entry.packet.event, entry.packet.data);
                        } else if (entry.type === 'effect') {
                            if (entry.kind === 'audio' && ['playCoinCollect', 'playAchievement'].includes(entry.name)) safe(() => selected.AudioManager?.[entry.name]?.());
                            else if (entry.kind === 'scene' && entry.name === 'refreshCurrentEcologyNode') safe(() => blueprint.methods.refreshCurrentEcologyNode.call(scene, { celebrate: true }));
                            else throw Error('FOREST_COMPLETION_EFFECT_UNAVAILABLE');
                        } else if (entry.type !== 'legacy-save-request') throw Error('FOREST_COMPLETION_ENTRY_UNAVAILABLE');
                        if (!current()) throw Error('FOREST_COMPLETION_RETIRED');
                    } });
                if (attempt.closed) return false;
                if (!result.success) {
                    if (!current() || !reader.isCurrent()) attempt.phase = 'protected';
                    recover(); return false;
                }
                if (!current() || !result.isCurrent() || !publications.every(value => value.isPublished())) { attempt.phase = 'protected'; recover(); return false; }
                attempt.verified = true; attempt.phase = 'committed';
                scene.levelCompletionResult = draft.result;
                if (!presentationCurrent()) return false;
                scene._levelProgressionRecorded = true;
                if (!presentationCurrent()) return false;
                if (profile.afterCommit) {
                    if (!originalActorsCurrent()) { recover(); return false; }
                    try {
                        if (blueprint.methods[profile.afterCommit].call(scene, Object.freeze({ isCurrent: presentationCurrent, onUnavailable: recover })) === true) {
                            return profile.presentAfterCommit ? present() : presentationCurrent();
                        }
                    } catch { /* Failed celebration still has a saved, presentation-only exit. */ }
                    if (profile.requireAfterCommit) { recover(); return false; }
                }
                return present();
            } catch (error) {
                attempt.failureCode = failureCode(error);
                if (attempt.closed) return false;
                if (attempt.phase !== 'committed') {
                    attempt.phase = 'protected';
                    if (basic()) reader?.hold({ code: 'commit_failed' }, 'local');
                }
                recover(); return false;
            } finally { attempt.busy = false; }
        };
        attempts.set(scene, attempt); attemptBlueprints.set(attempt, blueprint); scene[profile.attemptSlot] = attempt;
        try {
            if (!core() || Object.getPrototypeOf(scene) !== blueprint.prototype || !lifetime || !root ||
                scene.levelId !== profile.sceneLevelId || !scene.bossDefeated || scene.bossFightActive || scene.levelCompletionActive !== true ||
                (encounter?.id !== profile.guardianId && !(scene.testMode === true && encounter == null)) || !player?.active || player.scene !== scene || body?.gameObject !== player ||
                (profile.afterCommit && ((!profile.cosmeticBoss && (!scene.boss?.active || scene.boss.scene !== scene)) ||
                    !scene[profile.physicsActor || 'boss']?.active || scene[profile.physicsActor || 'boss'].scene !== scene ||
                    scene[profile.physicsActor || 'boss'].body?.world !== world ||
                    scene[profile.physicsActor || 'boss'].body?.gameObject !== scene[profile.physicsActor || 'boss'])) ||
                !world || body.world !== world || world.isPaused !== true || !getScene || getScene.call(registration, sceneKey) !== scene) throw Error('FOREST_SOURCE_UNAVAILABLE');
            const sceneMethods = () => Object.entries(blueprint.methods).every(([name, method]) => scene[name] === method && blueprint.prototype[name] === method);
            if (!sceneMethods()) throw Error('FOREST_SOURCE_UNAVAILABLE');
            selected = Object.fromEntries(['EconomyManager', 'InventoryManager', 'AchievementSystem', 'QuestManager', 'ThoughtBubbleSystem',
                'GuardianOutcomes', 'GuardianResidents', 'RescuedResidents', 'ProjectBeaconFieldKit', 'CurrentEcology', 'AudioManager', 'FeedbackManager', 'FXLibrary']
                .map(name => [name, window[name]]));
            for (const [name, expected] of Object.entries({ EconomyManager: economy, InventoryManager: inventory, AchievementSystem: achievements, QuestManager: quests })) {
                if (selected[name] != null && selected[name] !== expected) throw Error('FOREST_SERVICE_UNAVAILABLE');
            }
            const methods = [sameMethods(state, ['get', 'set', 'emit', 'getSaveAdmission', 'captureSaveAdmissionOwner', 'canCommitHatchSave',
                'commitHatchSaveDraft', 'createSaveSnapshot', 'validateSaveDataStructure', 'prepareSaveCandidate', 'inspectCloudRecovery',
                'getHatchActiveIdentity', 'getCampaignGateAccess', 'syncCanonicalCampaignGates', 'deferAutoSave'])];
            if (selected.EconomyManager) methods.push(sameMethods(economy, ['initialize', 'getBalance', 'addCoins', 'isLevelPickupSource']));
            for (const [name, names] of [
                ['InventoryManager', ['initialize', 'addItem', 'canAcceptItem', 'addShipPart', 'addGuaranteedReward', 'saveInventory',
                    'loadSourceForSceneEntry', 'captureRewardCalculationSource', 'captureCompletionCachePublication']],
                ['AchievementSystem', ['recordEvent', 'recordLevelCompletedEvent', 'recordGuardianRestoredEvent', 'prepareLevelCompletionEventDraft',
                    'prepareGuardianCompletionEventDraft', 'continueCompletionLevelEventDraft', 'continueCompletionEventDraft',
                    'continueCompletionGuardianEventDraft', 'prepareProgressEventDraft', 'checkAchievements', 'saveProgress', 'hasHatchProgressSource',
                    'hasCompletionCalculationCatalogue', 'captureHatchProgressPublication', 'captureProgressTopology']],
                ['QuestManager', ['loadQuestState', 'saveQuestState', 'trackProgress', 'emit', 'captureNamingProgressPublication']],
                ['ThoughtBubbleSystem', ['initialize', 'loadContextFromGameState', 'saveContext', 'recordSuccess', 'recordFailure', 'setBiome',
                    'captureCompletionContextSource', 'captureCompletionContextPublication']]
            ]) if (selected[name]) methods.push(sameMethods(selected[name], names));
            const economyInitialised = selected.EconomyManager?.initialized;
            if (selected.EconomyManager && typeof economyInitialised !== 'boolean') throw Error('FOREST_ECONOMY_UNAVAILABLE');
            const sinks = ['InventoryManager', 'AchievementSystem', 'EconomyManager'].flatMap(name => {
                const manager = selected[name]; return manager ? [[manager, 'events', manager.events], [manager.events, 'emit', manager.events?.emit]] : [];
            });
            notificationSinks = { state: [state, state.emit], inventory: [selected.InventoryManager?.events, selected.InventoryManager?.events?.emit],
                achievement: [selected.AchievementSystem?.events, selected.AchievementSystem?.events?.emit],
                economy: [selected.EconomyManager?.events, selected.EconomyManager?.events?.emit] };
            for (const [name, names] of [['AudioManager', ['playCoinCollect', 'playAchievement', 'playLevelUp']], ['FeedbackManager', ['cameraFlash']], ['FXLibrary', ['stardustBurst']]]) {
                if (selected[name]) methods.push(sameMethods(selected[name], names));
            }
            const domains = {};
            for (const [flag, name, method, expected] of [['outcomes', 'GuardianOutcomes', 'recordGuardianOutcome', outcomes.recordGuardianOutcome],
                ['guardianResidents', 'GuardianResidents', 'recordGuardianExpedition', guardians.recordGuardianExpedition],
                ['rescuedResidents', 'RescuedResidents', 'recordRescuedResident', residents.recordRescuedResident],
                ['fieldKit', 'ProjectBeaconFieldKit', 'installProjectBeaconKatanaUpgrade', kit.installProjectBeaconKatanaUpgrade]]) {
                const value = selected[name]?.[method];
                if (value !== undefined && value !== expected) throw Error('FOREST_DOMAIN_UNAVAILABLE');
                domains[flag] = typeof value === 'function';
                if (selected[name]) methods.push(sameMethods(selected[name], [method]));
            }
            if (selected.CurrentEcology?.getCurrentRegionSnapshot !== undefined && selected.CurrentEcology.getCurrentRegionSnapshot !== getCurrentRegionSnapshot) throw Error('FOREST_ECOLOGY_UNAVAILABLE');
            if (selected.CurrentEcology) methods.push(sameMethods(selected.CurrentEcology, ['getCurrentRegionSnapshot']));
            originalDataCurrent = pinData(root);
            const encounterCurrent = pinData(encounter);
            const identity = state.getHatchActiveIdentity(), creatureId = state.get('creature.id'), timer = state.autoSaveInterval;
            const fields = ['levelId', 'levelStartTime', 'damageTaken', 'starFragmentsCollected', 'guardianInterventions', 'rescuedResidentSupport', 'villageSupport', 'testMode',
                ...(profile.operationFields || [])];
            const values = fields.map(name => scene[name]);
            const actors = profile.sourceActors.map(name => {
                const actor = scene[name], body = actor?.body;
                return { name, actor, body, owner: actor?.scene, active: actor?.active, destroy: actor?.destroy,
                    world: body?.world, gameObject: body?.gameObject, destroyBody: body?.destroy };
            });
            originalActorsCurrent = () => actors.every(({ name, actor, body, owner, active, destroy, world, gameObject, destroyBody }) =>
                scene[name] === actor && actor?.body === body && actor?.scene === owner && actor?.active === active && actor?.destroy === destroy &&
                body?.world === world && body?.gameObject === gameObject && body?.destroy === destroyBody);
            const support = [scene.rescuedResidentSupport, scene.villageSupport].filter(Boolean).map(pinData);
            runtimeCurrent = () => sceneMethods() && rewardCatalogueCurrent() && domainCataloguesCurrent.every(check => check()) && methods.every(check => check()) &&
                Object.entries(selected).every(([name, value]) => window[name] === value) && sinks.every(([owner, name, value]) => owner?.[name] === value) &&
                selected.EconomyManager?.initialized === economyInitialised && state.autoSaveInterval === timer &&
                state.getHatchActiveIdentity() === identity && state.get('creature.id') === creatureId &&
                scene.input === input && input?.keyboard === keyboard && scene.physics === physics && physics.world === world &&
                scene.cameras?.main === camera && scene.player === player && player.active && player.scene === scene && player.body === body &&
                body.gameObject === player && body.world === world && world.isPaused === true && scene.guardianEncounter === encounter && encounterCurrent() &&
                fields.every((name, index) => scene[name] === values[index]) && support.every(check => check()) &&
                (attempt.verified || originalActorsCurrent()) &&
                sys.scene === scene && sys.events === events && sys.settings?.key === sceneKey && sys.game?.scene === registration &&
                registration.getScene === getScene && getScene.call(registration, sceneKey) === scene;
            const originalRaw = getRaw.call(storage, key), initialUpload = state.cloudWriteLease;
            const prepare = () => {
                reader = state.captureSaveAdmissionOwner({ raw: originalRaw }); memory = state.captureSaveAdmissionOwner();
                try {
                    const raw = getRaw.call(storage, key);
                    if (raw === null) throw Error('FOREST_ORIGINAL_SAVE_MISSING');
                    const stored = JSON.parse(raw);
                    state.validateSaveDataStructure(stored, { requireCoreState: true });
                    state.prepareSaveCandidate(stored);
                    if (!reader.isCurrent()) throw Error('FOREST_SOURCE_RETIRED');
                } catch {
                    if (reader.isCurrent()) reader.hold({ code: 'save_unreadable' }, 'local');
                    throw Error('FOREST_ORIGINAL_SAVE_UNAVAILABLE');
                }
                const sourceCurrent = () => core() && runtimeCurrent() && originalDataCurrent() && reader.isCurrent() && memory.isCurrent();
                participants = { isCurrent: sourceCurrent, inventory: selected.InventoryManager?.captureRewardCalculationSource({ state, reader }) || null,
                    achievements: selected.AchievementSystem ? captureCompletionAchievementSource(achievements, state, reader) : null,
                    thought: selected.ThoughtBubbleSystem?.captureCompletionContextSource({ state, reader }) || null,
                    economyMode: !selected.EconomyManager ? 'unavailable' : economyInitialised ? 'initialised' : 'uninitialised',
                    audioAvailable: Boolean(selected.AudioManager), domains,
                    stateMethods: { getCampaignGateAccess: state.getCampaignGateAccess, syncCanonicalCampaignGates: state.syncCanonicalCampaignGates } };
                publications = [selected.QuestManager?.captureNamingProgressPublication(state), selected.AchievementSystem?.captureHatchProgressPublication(),
                    selected.ThoughtBubbleSystem?.captureCompletionContextPublication(state), selected.InventoryManager?.captureCompletionCachePublication(state)].filter(Boolean);
                if (!sourceCurrent()) throw Error('FOREST_SOURCE_RETIRED');
                const now = completionNow;
                const plan = calculateLevelCompletionDraft(root, { levelId: profile.levelId, sceneLevelId: scene.levelId, shipPartId: profile.shipPartId,
                    katanaUpgradeId: profile.katanaUpgradeId || null,
                    now, time: Math.max(0, now - (scene.levelStartTime || now)), noDamage: (scene.damageTaken || 0) === 0, speedrunThreshold: profile.speedrunThreshold,
                    rewardBonusCount: profile.rewardBonusField ? scene[profile.rewardBonusField] || 0 : 0, residentCoinBonus: scene.rescuedResidentSupport?.victoryCoinBonus || 0,
                    villageCoinBonus: scene.villageSupport?.victoryCoinBonus || 0, guardianInterventions: scene.guardianInterventions || 0,
                    guardianRestoredAfter: !profile.guardianBefore, guardianRestoredBefore: Boolean(profile.guardianBefore),
                    guardianRestoredAt: profile.guardianBefore ? scene.completionGuardianAt : null }, participants);
                if (plan.status !== 'calculated' || !sourceCurrent()) throw Error('FOREST_CALCULATION_UNAVAILABLE');
                draft = prepareCompletionPublicationDraft(plan, { inventory: selected.InventoryManager, achievements: selected.AchievementSystem });
                let index = 0;
                if (selected.QuestManager) publications[index++].prepare(draft.state);
                if (selected.AchievementSystem) publications[index++].prepare({ state: draft.state, ...draft.projections.achievements });
                if (selected.ThoughtBubbleSystem) publications[index++].prepare(draft.state, draft.projections.thoughtContext);
                if (selected.InventoryManager) publications[index++].prepare(draft.state, draft.projections);
                guard = captureCompletionPacketGuard(draft, { inventory: selected.InventoryManager, achievements: selected.AchievementSystem });
                if (!sourceCurrent() || !current()) throw Error('FOREST_SOURCE_RETIRED');
                attempt.phase = 'prepared';
            };
            const waitingCurrent = () => core() && runtimeCurrent() && originalDataCurrent() && state.state === root && getRaw.call(storage, key) === originalRaw;
            const initialUploadCurrent = () => {
                const pending = state.inspectCloudRecovery().pending;
                return initialUpload && ownsUpload(initialUpload) && initialUpload.kind === 'upload' && initialUpload.admissionEpoch === epoch &&
                    initialUpload.activeRaw === originalRaw && initialUpload.isCurrentCampaign?.() === true &&
                    pending.length === 1 && pending[0].id === initialUpload.id && pending[0].payload === initialUpload.snapshot;
            };
            // No packet or write reader exists while this one already-owned
            // upload finishes. A prepared packet is never recaptured/rebased.
            resumePreparation = () => {
                if (!waitingCurrent()) throw Error('FOREST_SOURCE_RETIRED');
                if (state.cloudWriteLease === initialUpload && initialUploadCurrent()) return false;
                if (state.cloudWriteLease || cloud?.activeCloudWrite || !state.canCommitHatchSave()) throw Error('FOREST_UPLOAD_NOT_CONFIRMED');
                prepare(); return true;
            };
            if (initialUpload && !initialUploadCurrent()) throw Error('FOREST_UPLOAD_NOT_OWNED');
            deferral = state.deferAutoSave(() => core() && runtimeCurrent());
            offAdmission = state.on('saveAdmissionChanged', () => { if (!basic()) attempt.retire(); });
            const shutdown = () => attempt.retire(); events.once('shutdown', shutdown); offShutdown = () => events.off('shutdown', shutdown);
            if (initialUpload) { attempt.phase = 'waiting'; recover(); return false; }
            prepare();
        } catch (error) {
            attempt.failureCode = failureCode(error);
            attempt.phase = 'protected';
            recover(); return false;
        }
        return attempt.run();
    };
    Object.defineProperty(handler, 'present', { value: scene => {
        const attempt = attempts.get(scene);
        return attemptBlueprints.get(attempt) === blueprint && attempt?.lifetime === scene[profile.lifetimeSlot] && attempt.showRewards();
    } });
    return Object.freeze(handler);
}
