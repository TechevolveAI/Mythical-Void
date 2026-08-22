/**
 * GameScene - The main gameplay scene with an explorable world
 * Features: player movement, large world, environment objects, collision detection, interactions, AI chat
 */

import EconomyHudManager from '../systems/ui/EconomyHudManager.js';
import { getSanctuaryCheckInCopy } from '../systems/SanctuaryCheckIn.js';
import CarePanelManager from '../systems/ui/CarePanelManager.js';
import WorldBuilder from '../systems/world/WorldBuilder.js';
import SanctuaryInteractionDirector from '../systems/world/SanctuaryInteractionDirector.js';
import { SANCTUARY_WORLD_ART } from '../systems/world/SanctuaryWorldArt.js';
import ChatOverlay from '../ui/ChatOverlay.js';
import MobileHUD from '../systems/ui/MobileHUD.js';
import {
    getMobileControlLayout,
    getSafeAreaInsets
} from '../systems/MobileControlLayout.js';
import QuestTracker from '../systems/ui/QuestTracker.js';
import ControlsTutorialOverlay from '../ui/ControlsTutorialOverlay.js';
import ControlsHintPanel from '../ui/ControlsHintPanel.js';
import FloatingChatBubble from '../ui/FloatingChatBubble.js';
import CreatureSwitcherModal from '../ui/CreatureSwitcherModal.js';
import HamburgerMenu from '../ui/HamburgerMenu.js';
import NASAContentModal from '../ui/NASAContentModal.js';
import AchievementNotification from '../ui/AchievementNotification.js';
import CreatureRadialMenu from '../ui/CreatureRadialMenu.js';
import AbilityHUD from '../ui/AbilityHUD.js';
import AIArtModal from '../ui/AIArtModal.js';
import LivingFormHandoff from '../ui/LivingFormHandoff.js';
import { createCanvasTapBridge } from '../utils/CanvasTapBridge.js';
import GameSceneSceneRouter from './controllers/GameSceneSceneRouter.js';
import GameSceneHudController from './controllers/GameSceneHudController.js';
import projectBeacon from '../config/project-beacon.json';
import { recoverProjectBeaconFieldKit as recoverFieldKitState, getProjectBeaconKatanaUpgradeIds } from '../systems/ProjectBeaconFieldKit.js';
import { normalizeSignalGardenState, tendSignalGarden } from '../systems/SignalGarden.js';
import { LIVING_SIGNAL_DEFINITIONS, normalizeLivingSignalState, observeLivingSignal } from '../systems/LivingSignalSurvey.js';
import { recordCurrentSignalObservation } from '../systems/CurrentEcology.js';
import {
    FEND_COMMUNITY_PROJECTS,
    advanceFendCommunityProject,
    formatFendCommunityObjective,
    getFendCommunitySnapshot
} from '../systems/FendCommunity.js';
import {
    FEND_RESIDENT_DEFINITIONS,
    formatFendResidentObjective,
    getFendResidentsSnapshot,
    interactWithFendResident
} from '../systems/FendResidents.js';
import {
    assistGuardianRoutine,
    createGuardianExpeditionDebrief,
    formatGuardianRoutineRecovery,
    GUARDIAN_RESIDENT_DEFINITIONS,
    GUARDIAN_ROUTINE_RECOVERY_MS,
    GUARDIAN_SYNERGY_ASSISTS,
    getGuardianResidentsSnapshot,
    interactWithGuardianResident,
    recordGuardianActivity
} from '../systems/GuardianResidents.js';
import {
    getGuardianCompanionRecognition
} from '../systems/GuardianCompanionRecognition.js';
import {
    getRescuedResidentSnapshot,
    interactWithRescuedResident
} from '../systems/RescuedResidents.js';
import { companionMediaService } from '../systems/CompanionMediaService.js';
import {
    FEND_COMMONS_PRIORITIES,
    formatFendCultureObjective,
    getFendCultureResidentResponse,
    getFendCultureSnapshot,
    recordFirstListeningDecision
} from '../systems/FendCulture.js';
import ExpeditionAstronaut from '../systems/ExpeditionAstronaut.js';
import ProjectBeaconWaypoint from '../systems/ui/ProjectBeaconWaypoint.js';
import ProjectBeaconLogModal from '../ui/ProjectBeaconLogModal.js';
import SettingsModal from '../ui/SettingsModal.js';
import KatanaArtifactModal, { prefetchKatanaArtifactArtwork } from '../ui/KatanaArtifactModal.js';
import CompanionConsentModal from '../ui/CompanionConsentModal.js';
import CompanionEarthMemoryModal from '../ui/CompanionEarthMemoryModal.js';
import SenseiMemoryModal from '../ui/SenseiMemoryModal.js';
import ShipEvidenceBoardModal from '../ui/ShipEvidenceBoardModal.js';
import CurrentVeilModal from '../ui/CurrentVeilModal.js';
import VillageCommandPanel from '../ui/VillageCommandPanel.js';
import { recordCampaignLegacyCapsule } from '../systems/CampaignLegacy.js';
import { getHomecomingHandoffSnapshot } from '../systems/HomecomingHandoff.js';
import {
    COMPANION_BOUNDARY_TOPICS,
    getCompanionConsentSnapshot,
    recordCompanionBoundaryTopic
} from '../systems/CompanionConsent.js';
import {
    EARTH_MEMORY_DEFINITIONS,
    getCompanionEarthMemorySnapshot,
    shareCompanionEarthMemory
} from '../systems/CompanionEarthMemory.js';
import {
    SENSEI_MEMORY_DEFINITIONS,
    getSenseiMemorySnapshot,
    recordSenseiMemory
} from '../systems/SenseiMemory.js';
import {
    getShipEvidenceSnapshot,
    recordShipEvidenceSection
} from '../systems/ShipEvidence.js';
import {
    getShipReconstructionSnapshot,
    installShipReconstructionStep,
    serviceCompanionAtPoweredBerth
} from '../systems/ShipReconstruction.js';
import {
    applyProtectedReturnStep,
    getProtectedReturnSnapshot
} from '../systems/ProtectedReturnProtocol.js';
import {
    formatCurrentVeilObjective,
    getCurrentVeilSnapshot,
    stabilizeCurrentVeilAnchor,
    startCurrentVeilMission,
    verifyCurrentVeilPacket
} from '../systems/CurrentVeilMission.js';
import {
    getRemainAndDefendSnapshot
} from '../systems/RemainAndDefendCampaign.js';
import {
    getFusionPodLandmarkSnapshot
} from '../systems/FusionPodLandmark.js';
import {
    assignCreatureToVillageBuilding,
    getVillageCommunityMoment,
    getVillageHeartMemory,
    getVillageSnapshot,
    getVillageWorkerCheckIn,
    initializeVillageSettlement,
    markVillageGuidanceSeen,
    placeVillageBuilding,
    reconcileVillageSettlement,
    resolveVillageHeartDecision,
    VILLAGE_BUILDING_ARTWORK,
    VILLAGE_RESOURCE_DEFINITIONS,
    VILLAGE_WORLD_ARTWORK
} from '../systems/VillageSettlement.js';
// MapNavigationButtons removed - redundant with HamburgerMenu navigation

const Phaser = typeof window !== 'undefined' ? window.Phaser : undefined;

function requireGlobal(name) {
    if (typeof window === 'undefined' || !window[name]) {
        throw new Error(`${name} system not ready`);
    }
    return window[name];
}

const getGameState = () => requireGlobal('GameState');
const getGraphicsEngine = () => requireGlobal('GraphicsEngine');
const getCreatureAI = () => requireGlobal('CreatureAI');
const POSITION_PERSIST_INTERVAL_MS = 500;
const POSITION_PERSIST_DISTANCE = 24;

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.player = null;
        this.astronautFollower = null;
        this.cursors = null;
        this.wasdKeys = null;
        this.spaceKey = null;
        this.chatKey = null;
        this.feedKey = null;
        this.playKey = null;
        this.restKey = null;
        this.careKey = null;
        this.worldWidth = 2400;   // Expanded sanctuary for more exploration
        this.worldHeight = 1800;  // Larger peaceful space to roam
        this.trees = null;
        this.rocks = null;
        this.flowers = null;
        this.creatureAI = null;
        this.chatUI = null;
        this.isChatOpen = false;
        this.chatOverlay = null;
        this.careSystem = null;
        this.carePanelManager = null;
        this.coins = null;
        this.coinRespawnTimers = [];
        this.enemies = null;
        this.projectiles = null;
        this.shop = null;
        this.nearShop = false;
        this.crashedShip = null;
        this.hubPortal = null;
        this.voidPortal = null;
        this.campfire = null;
        this.signalGarden = null;
        this.villageHeartLandmark = null;
        this.nearVillageHeart = false;
        this.villageCommunityMomentIndex = 0;
        this.lastVillageCommunityMomentAt = 0;
        this.villageHeartMemoryIndex = 0;
        this.lastVillageHeartMemoryAt = 0;
        this.sanctuaryPresentationMode = 'ambient';
        this.villageCommunityMomentPending = false;
        this.villageDecisionMomentPending = null;
        this.villageCommandPanel = null;
        this.villageReconcileTimer = null;
        this.villageRenderSignature = null;
        this.fusionPodLandmark = null;
        this.sanctuaryKeepsakes = null;
        this.livingSignals = [];
        this.activeLivingSignalId = null;
        this.livingSignalDwellMs = 0;
        this.livingSignalApproachHintShown = false;
        this.livingSignalMomentElements = [];
        this.livingSignalMomentTimer = null;
        this.sanctuaryZones = null;
        this.sanctuaryDistricts = null;
        this.sanctuaryInteractionDirector = null;
        this.sanctuaryPromptOwnerId = null;
        this.targetRange = null;
        this.nearTargetRange = false;
        this.targetRangeScore = 0;
        this.targetRangeScoreText = null;
        this.nearHubPortal = false;
        this.nearVoidPortal = false;
        this.nearCampfire = false;
        this.nearSignalGarden = false;
        this.nearFusionPod = false;
        this.fusionPodIndicator = null;
        this.fusionPodIndicatorTween = null;
        this.fusionDiscoveryIntroductionTimer = null;
        this.nearFendResidentId = null;
        this.fendResidentOverlapColliders = [];
        this.nearGuardianResidentId = null;
        this.guardianResidentOverlapColliders = [];
        this.nearRescuedResidentId = null;
        this.rescuedResidentOverlapColliders = [];
        this.rescuedResidentExchangeElements = [];
        this.rescuedResidentExchangeOpen = false;
        this.guardianExchangeElements = [];
        this.guardianExchangeOpen = false;
        this.guardianCareActivityElements = [];
        this.guardianCareActivityOpen = false;
        this.guardianCareActivityTimer = null;
        this.guardianRecognitionCooldowns = new Map();
        this.guardianRecognitionElements = [];
        this.guardianRecognitionTimer = null;
        this.guardianTrustCinematic = null;
        this.guardianTrustCinematicRequest = 0;
        this.livingPortraitReadyNotice = null;
        this.livingPortraitNoticeTimer = null;
        this.livingPortraitNoticePendingIdentity = null;
        this.nearCurrentVeilAnchorId = null;
        this.currentVeilOverlapColliders = [];
        this.residentExchangeElements = [];
        this.residentExchangeOpen = false;
        this.fendListeningElements = [];
        this.fendListeningOpen = false;
        this.companionConsentModal = null;
        this.companionEarthMemoryModal = null;
        this.senseiMemoryModal = null;
        this.shipEvidenceBoardModal = null;
        this.currentVeilModal = null;
        this.recoveryLogModal = null;
        this.shipEvidencePreview = null;
        this.shipEvidencePreviewSize = null;
        this.currentVeilPreview = null;
        this.currentVeilPreviewSize = null;
        this.senseiMemoryPreview = null;
        this.senseiMemoryPreviewSize = null;
        this.companionEarthMemoryPreview = null;
        this.companionEarthMemoryPreviewSize = null;
        // Time-slow tool state (unlocked after 3 campfire rest sessions)
        this.timeSlowActive = false;
        this.timeSlowCooldown = false;
        this.timeSlowDuration = 5000; // 5 seconds of slow-mo
        this.timeSlowCooldownTime = 30000; // 30 second cooldown
        this.timeSlowFactor = 0.3; // 30% speed
        this.timeSlowOverlay = null;
        this.voidPullActive = false;
        this.voidPullProgress = 0;
        this.voidPullTimer = null;
        this.voidPullBar = null;
        this.voidPullText = null;
        this.nearCrashedShip = false;
        this.fieldKitCase = null;
        this.fieldKitCaseTween = null;
        this.fieldKitModalElements = [];
        this.isFieldKitModalOpen = false;
        this.katanaArtifactModal = null;
        this.nearReturnPortal = false;
        this.returnPortal = null;
        this.dailyGreetingShown = false;
        this.mobileControls = null;
        this.mobileHUD = null;
        this.forceMobileControls = false;
        this.questTracker = null;
        this.projectBeaconWaypoint = null;
        this.waypointPreview = null;
        this.missionBriefingPreview = null;
        this.missionBriefingPreviewSize = null;
        this.mapRecoveryPreview = false;
        this.interactionPromptPreview = false;
        this.mapRecoveryStatusText = null;
        this.mapRecoveryActors = [];
        this.carePanelPreview = false;
        this.signalGardenPreview = null;
        this.guardianResidentPreview = null;
        this.guardianExchangePreview = null;
        this.guardianRecognitionPreview = null;
        this.guardianTaskPreview = null;
        this.communityPreview = null;
        this.communityMomentPreview = null;
        this.fendCulturePreview = null;
        this.sanctuaryDecorationPreview = null;
        this.fusionStoryPreview = false;
        this.fusionStoryPreviewSize = null;
        this.kinshipBeaconPreview = null;
        this.signalGardenPreviewElements = [];
        this.livingSignalPreview = null;
        this.livingSignalPreviewSize = null;
        this.livingSignalProgressPreview = null;
        this.livingSignalPreviewElements = [];
        this.waypointPreviewElements = [];
        this.collectibles = [];
        this.currentBiome = 'nebula';
        this.currentSanctuaryZoneId = null;
        this.controlsTutorial = null;
        this.controlsHintPanel = null;
        this.floatingChatBubble = null;
        this.creatureRadialMenu = null;
        this.abilityHUD = null;
        this.aiArtModal = null;
        this.creatureSwitcher = null;
        this.hamburgerMenu = null;
        // mapNavButtons removed - redundant with hamburgerMenu
        this.profileKey = null;
        this.economyHud = null;
        this.worldBuilder = null;
        this.currentCameraZoom = 1;
        this.gameStateUnsubscribers = [];
        this._sceneLifecycleRegistered = false;
        this._isShuttingDown = false;
        this.kidModeActionHandler = null;
        this.kidModeHelpContainer = null;
        this.sanctuaryFocusModeActive = false;
        this.joystickX = 0;
        this.joystickY = 0;
        this.virtualJoystickHandler = null;
        this.virtualKeyHandler = null;
        this.positionText = null;
        this.lastPositionPersistedAt = Number.NEGATIVE_INFINITY;
        this.statsText = null;
        this.statsPulseAnimation = null;
        this.interactionText = null;
        this.interactionHintTimer = null;
        this.interactionTextResizeHandler = null;
        this.portalIndicator = null;
        this.portalPulseAnim = null;
        this.signalGardenIndicator = null;
        this.signalGardenIndicatorTween = null;
        this.cosmicMiniMap = null;
        this.miniMapPlayerDot = null;
        this.statBarGraphics = null;
        this.statBars = [];
        this.floatingParticles = [];
        this.enemyManagerListeners = [];
        this.combatCooldown = 0;
        this.combatCooldownMax = 1200;
        this.combatCooldownText = null;
        this.combatButton = null;
        this.combatBg = null;
        this.combatText = null;
        this.dailyBonusButton = null;
        this.dailyBonusGlow = null;
        this.isShowingTutorial = false;
        this.welcomeToastDisplayed = false;
        this.shownDepartureWarning = false;
        this.welcomeBackChecked = false;
        this.interactionDistance = {
            signal: { enter: 150, clear: 190 },
            signalApproach: { enter: 82, clear: 120 },
            shop: { enter: 220, clear: 270 },
            hubPortal: { enter: 190, clear: 230 },
            returnPortal: { enter: 170, clear: 210 },
            campfire: { enter: 110, clear: 140 },
            signalGarden: { enter: 130, clear: 150 },
            villageHeart: { enter: 135, clear: 165 },
            fusionPod: { enter: 130, clear: 155 },
            fendResident: { enter: 88, clear: 108 },
            guardianResident: { enter: 92, clear: 112 },
            rescuedResident: { enter: 92, clear: 112 },
            currentVeilAnchor: { enter: 92, clear: 112 },
            crashShip: { enter: 170, clear: 210 },
            flower: { enter: 95, clear: 125 }
        };
        this.interactionGraceToleranceMs = 240;
        this.interactionGraceById = new Map();

        // Achievement notification UI
        this.achievementNotification = null;
        this.achievementUnlockHandler = null;

        // ParallaxBiome for layered space-fantasy backgrounds
        this.parallaxBiome = null;

        // Cosmic affinity effect modifiers
        this.cosmicAffinityEffects = {
            healthRegenRate: 1.0,
            energyDrainRate: 1.0,
            explorationXPBonus: 1.0,
            coinFindBonus: 1.0,
            damageBonus: 1.0
        };

        // Personality mood tracking
        this.lastMoodEmoji = null;
        this.moodIndicator = null;
        this.personalityPanel = null;
        this.personalityPanelVisible = false;
        this.sceneRouter = null;
        this.hudController = null;
    }

    preload() {
        const previewCount = Number.isFinite(this.guardianResidentPreview)
            ? this.guardianResidentPreview
            : null;
        const rescuedIds = previewCount !== null
            ? new Set(
                GUARDIAN_RESIDENT_DEFINITIONS
                    .slice(0, previewCount)
                    .map(resident => resident.id)
            )
            : new Set(
                getGuardianResidentsSnapshot(window.GameState)
                    .rescuedResidents
                    .map(resident => resident.id)
            );

        GUARDIAN_RESIDENT_DEFINITIONS.forEach(resident => {
            if (
                rescuedIds.has(resident.id) &&
                !this.textures.exists(resident.textureKey)
            ) {
                this.load.image(resident.textureKey, resident.artwork);
            }
        });

        Object.values(VILLAGE_BUILDING_ARTWORK).forEach(artwork => {
            if (!this.textures.exists(artwork.key)) {
                this.load.image(artwork.key, artwork.url);
            }
        });
        Object.values(VILLAGE_WORLD_ARTWORK).forEach(artwork => {
            if (!this.textures.exists(artwork.key)) {
                this.load.image(artwork.key, artwork.url);
            }
        });
        Object.values(SANCTUARY_WORLD_ART).forEach(artwork => {
            if (!this.textures.exists(artwork.key)) {
                this.load.image(artwork.key, artwork.url);
            }
        });
    }

    /**
     * Receive data from scene transitions (e.g., from HubWorldScene)
     * @param {object} data - Scene transition data
     */
    init(data) {
        // Reset shutdown flag for fresh scene
        this._isShuttingDown = false;
        this.forceMobileControls = data?.forceMobileControls === true;
        this.fieldKitPreview = data?.fieldKitPreview === true;
        this.fieldKitPreviewSize = data?.fieldKitPreviewSize || null;
        this.fieldKitPreviewStage = ['earth', 'crystal', 'aurora'].includes(
            data?.fieldKitPreviewStage
        ) ? data.fieldKitPreviewStage : 'earth';
        this.waypointPreview = data?.waypointPreview || null;
        this.missionBriefingPreview = data?.missionBriefingPreview || null;
        this.missionBriefingPreviewSize = data?.missionBriefingPreviewSize || null;
        this.carePanelPreview = data?.carePanelPreview === true;
        this.checkInPreview = [
            'curious',
            'playful',
            'gentle',
            'wise',
            'energetic'
        ].includes(data?.checkInPreview) ? data.checkInPreview : null;
        this.checkInBonusPreview = data?.checkInBonusPreview === true;
        this.communityMomentPreview = Number.isFinite(
            Number(data?.communityMomentPreview)
        )
            ? Math.max(
                1,
                Math.min(4, Math.floor(Number(data.communityMomentPreview)))
            )
            : null;
        this.fendCulturePreview = [
            'ready',
            ...FEND_COMMONS_PRIORITIES.map(priority => priority.id)
        ].includes(data?.fendCulturePreview)
            ? data.fendCulturePreview
            : null;
        this.residentExchangePreview = Number.isFinite(
            Number(data?.residentExchangePreview)
        )
            ? Math.max(
                1,
                Math.min(4, Math.floor(Number(data.residentExchangePreview)))
            )
            : null;
        this.residentPreview = Number.isFinite(Number(data?.residentPreview))
            ? Math.max(
                0,
                Math.min(4, Math.floor(Number(data.residentPreview)))
            )
            : this.residentExchangePreview
                ?? (this.fendCulturePreview ? 4 : null);
        this.guardianResidentPreview = Number.isFinite(
            Number(data?.guardianResidentPreview)
        )
            ? Math.max(
                0,
                Math.min(
                    GUARDIAN_RESIDENT_DEFINITIONS.length,
                    Math.floor(Number(data.guardianResidentPreview))
                )
            )
            : null;
        this.guardianExchangePreview = Number.isFinite(
            Number(data?.guardianExchangePreview)
        )
            ? Math.max(
                1,
                Math.min(
                    GUARDIAN_RESIDENT_DEFINITIONS.length,
                    Math.floor(Number(data.guardianExchangePreview))
                )
            )
            : null;
        this.guardianRecognitionPreview = Number.isFinite(
            Number(data?.guardianRecognitionPreview)
        )
            ? Math.max(
                1,
                Math.min(
                    GUARDIAN_RESIDENT_DEFINITIONS.length,
                    Math.floor(Number(data.guardianRecognitionPreview))
                )
            )
            : null;
        this.guardianTaskPreview = [
            'accepted',
            'ready',
            'completed',
            'selected',
            'synergy',
            'debrief'
        ].includes(data?.guardianTaskPreview)
            ? data.guardianTaskPreview
            : null;
        this.livingPortraitReadyPreview = data?.livingPortraitReadyPreview === true;
        if (
            this.guardianResidentPreview === null &&
            (
                this.guardianExchangePreview !== null ||
                this.guardianRecognitionPreview !== null
            )
        ) {
            this.guardianResidentPreview = GUARDIAN_RESIDENT_DEFINITIONS.length;
        }
        const requestedCommunityPreview = this.communityMomentPreview
            ?? (this.fendCulturePreview ? 4 : null)
            ?? this.residentPreview
            ?? data?.communityPreview;
        this.communityPreview = Number.isFinite(Number(requestedCommunityPreview))
            ? Math.max(
                0,
                Math.min(4, Math.floor(Number(requestedCommunityPreview)))
            )
            : null;
        this.signalGardenPreview = data?.signalGardenPreview
            || (
                this.communityPreview !== null ||
                this.guardianResidentPreview !== null
                    ? 'bloom'
                    : null
            );
        this.villageCommandPreview = [
            'empty',
            'building',
            'active',
            'complete'
        ].includes(data?.villageCommandPreview)
            ? data.villageCommandPreview
            : null;
        this.sanctuaryDecorationPreview = Number.isFinite(Number(data?.sanctuaryDecorationPreview))
            ? Math.max(0, Math.min(3, Math.floor(Number(data.sanctuaryDecorationPreview))))
            : null;
        this.fusionStoryPreview = data?.fusionStoryPreview === true;
        this.fusionStoryPreviewSize = data?.fusionStoryPreviewSize || null;
        this.fusionLandmarkPreview = [
            'dormant',
            'calibrating',
            'maturing',
            'ready'
        ].includes(data?.fusionLandmarkPreview)
            ? data.fusionLandmarkPreview
            : null;
        this.kinshipBeaconPreview = [
            true,
            'local',
            'shared'
        ].includes(data?.kinshipBeaconPreview)
            ? (
                data.kinshipBeaconPreview === 'shared'
                    ? 'shared'
                    : 'local'
            )
            : null;
        this.livingSignalPreview = data?.livingSignalPreview || null;
        this.livingSignalPreviewSize = data?.livingSignalPreviewSize === 'mobile'
            ? 'mobile'
            : null;
        const hasLivingSignalProgressPreview =
            data?.livingSignalProgressPreview !== null &&
            data?.livingSignalProgressPreview !== undefined;
        this.livingSignalProgressPreview = hasLivingSignalProgressPreview &&
            Number.isFinite(Number(data.livingSignalProgressPreview))
            ? Phaser.Math.Clamp(Number(data.livingSignalProgressPreview), 0, 1)
            : null;
        this.controlsPreview = data?.controlsPreview === true;
        this.storyPreview = data?.storyPreview === true;
        this.beaconLogPreview = [
            'mission',
            'recovery',
            'archive',
            'memory'
        ].includes(
            data?.beaconLogPreview
        )
            ? data.beaconLogPreview
            : null;
        this.beaconLogPreviewSize =
            data?.beaconLogPreviewSize === 'mobile'
                ? 'mobile'
                : null;
        this.companionConsentPreview = [
            'menu',
            'route',
            'evidence',
            'power',
            'complete'
        ].includes(data?.companionConsentPreview)
            ? data.companionConsentPreview
            : null;
        this.companionEarthMemoryPreview = [
            'menu',
            'dojo',
            'ocean',
            'city',
            'shared'
        ].includes(data?.companionEarthMemoryPreview)
            ? data.companionEarthMemoryPreview
            : null;
        this.companionEarthMemoryPreviewSize =
            data?.companionEarthMemoryPreviewSize === 'mobile'
                ? 'mobile'
                : null;
        this.senseiMemoryPreview = [
            'footing',
            'trust',
            'restraint',
            'confirmed'
        ].includes(data?.senseiMemoryPreview)
            ? data.senseiMemoryPreview
            : null;
        this.senseiMemoryPreviewSize =
            data?.senseiMemoryPreviewSize === 'mobile'
                ? 'mobile'
                : null;
        this.shipEvidencePreview = [
            'berth',
            'repair_0',
            'repair_3',
            'repair_final',
            'repair_complete',
            'systems',
            'evidence',
            'boundaries',
            'complete',
            'protocol_0',
            'protocol_3',
            'protocol_complete',
            'handoff'
        ].includes(data?.shipEvidencePreview)
            ? data.shipEvidencePreview
            : null;
        this.shipEvidencePreviewSize =
            data?.shipEvidencePreviewSize === 'mobile'
                ? 'mobile'
                : null;
        this.continueFinaleAfterRepair =
            data?.continueFinaleAfterRepair === true;
        this.shipReconstructionHandoff =
            data?.shipReconstructionHandoff === true;
        this.shipReconstructionNextGateLabel =
            typeof data?.shipReconstructionNextGateLabel === 'string'
                ? data.shipReconstructionNextGateLabel
                    .trim()
                    .replace(/\s+/g, ' ')
                    .slice(0, 40)
                : null;
        this.currentVeilPreview = [
            'available',
            'active',
            'verification',
            'complete'
        ].includes(data?.currentVeilPreview)
            ? data.currentVeilPreview
            : null;
        this.currentVeilPreviewSize =
            data?.currentVeilPreviewSize === 'mobile'
                ? 'mobile'
                : null;
        this.settingsPreview = data?.settingsPreview === true;
        this.mapRecoveryPreview = data?.mapRecoveryPreview === true;
        this.interactionPromptPreview = data?.interactionPromptPreview === true;
        this.openVillageHeartOnCreate = data?.openVillageHeart === true;

        // Handle biome data from HubWorldScene
        if (data?.biome) {
            this.currentBiome = data.biome;
            console.log(`[GameScene] Entering biome: ${this.currentBiome}`);
        } else {
            this.currentBiome = 'nebula'; // Default biome
        }
        this.nearVillageHeart = false;
        this.villageRenderSignature = null;
        this.villageCommunityMomentIndex = 0;
        this.lastVillageCommunityMomentAt = 0;
        this.villageHeartMemoryIndex = 0;
        this.lastVillageHeartMemoryAt = 0;
        this.sanctuaryPresentationMode = 'ambient';
        this.villageCommunityMomentPending = false;
        this.villageDecisionMomentPending = null;

        // Transition spawn data must not leak across scene restarts.
        this.spawnPosition = data?.spawnPosition || null;

        // Handle return from Void mini-game
        if (data?.returnFromVoid) {
            this.returningFromVoid = true;
            this.voidScore = data.voidScore || 0;
            this.spawnPosition = data.returnPosition || this.spawnPosition;
            console.log(`[GameScene] Returning from Void with score: ${this.voidScore}`);
            this.voidEntryCooldown = true;
            this.voidPullActive = false;
            this.nearVoidPortal = false;
            this.cancelVoidPull();
        } else {
            this.returningFromVoid = false;
            this.voidScore = 0;
        }

        if (!data?.returnFromVoid) {
            this.voidEntryCooldown = false;
        }
    }

    create() {
        console.log('[GameScene] ===== CREATE() STARTING =====');
        try {
            // A native Start control protects onboarding when WebGL input fails.
            // Scene changes triggered by recovery tools or restored saves can skip
            // its normal owner cleanup, so gameplay also enforces the boundary.
            if (typeof document !== 'undefined') {
                document
                    .querySelectorAll('[data-mythical-home-start="true"]')
                    .forEach(element => element.remove());
            }
            this.removeStaleAuxiliaryCameras();
            prefetchKatanaArtifactArtwork();
            console.log('[GameScene] Initializing lifecycle tracking...');
            this.initializeLifecycleTracking();
            this.registerSceneLifecycleEvents();
            this.sceneRouter = new GameSceneSceneRouter(this);
            this.hudController = new GameSceneHudController(this);

            if (this.interactionPromptPreview) {
                this.createInteractionPromptPreview();
                console.log('[GameScene] Interaction prompt preview created successfully');
                return;
            }

            if (this.mapRecoveryPreview) {
                this.createMapRecoveryPreview();
                console.log('[GameScene] Map recovery preview created successfully');
                return;
            }

            if (this.settingsPreview) {
                this.createSettingsPreview();
                console.log('[GameScene] Settings preview created successfully');
                return;
            }

            if (this.beaconLogPreview) {
                this.createBeaconLogPreview();
                console.log('[GameScene] Project Beacon log preview created successfully');
                return;
            }

            if (this.companionConsentPreview) {
                this.createCompanionConsentPreview();
                console.log('[GameScene] Companion consent preview created successfully');
                return;
            }

            if (this.companionEarthMemoryPreview) {
                this.createCompanionEarthMemoryPreview();
                console.log('[GameScene] Companion Earth memory preview created successfully');
                return;
            }

            if (this.senseiMemoryPreview) {
                this.createSenseiMemoryPreview();
                console.log('[GameScene] Sensei memory preview created successfully');
                return;
            }

            if (this.shipEvidencePreview) {
                this.createShipEvidencePreview();
                console.log('[GameScene] Ship evidence preview created successfully');
                return;
            }

            if (this.currentVeilPreview) {
                this.createCurrentVeilPreview();
                console.log('[GameScene] Quiet Current preview created successfully');
                return;
            }

            if (this.controlsPreview) {
                this.controlsTutorial = new ControlsTutorialOverlay(this);
                this.controlsTutorial.show({ force: true });
                console.log('[GameScene] Field controls preview created successfully');
                return;
            }

            if (this.storyPreview) {
                this.showShipMemories();
                console.log('[GameScene] Opening story preview created successfully');
                return;
            }

            if (this.checkInPreview) {
                this.createFieldKitPreviewBackdrop();
                this.showDailyGreetingOverlay(
                    'Nova',
                    {
                        available: this.checkInBonusPreview,
                        streak: 23,
                        rewards: { xp: 25, stardust: 12 }
                    },
                    null,
                    this.checkInPreview
                );
                console.log('[GameScene] Sanctuary check-in preview created successfully');
                return;
            }

            if (this.carePanelPreview) {
                this.createCarePanelPreview();
                console.log('[GameScene] Care Corner preview created successfully');
                return;
            }

            if (this.villageCommandPreview) {
                this.createVillageCommandPreview();
                console.log('[GameScene] Village command preview created successfully');
                return;
            }

            if (this.signalGardenPreview) {
                this.createSignalGardenPreview();
                console.log('[GameScene] Signal Garden preview created successfully');
                return;
            }

            if (this.sanctuaryDecorationPreview !== null) {
                this.createSanctuaryDecorationPreview();
                console.log('[GameScene] Sanctuary decoration preview created successfully');
                return;
            }

            if (this.kinshipBeaconPreview) {
                this.createKinshipBeaconPreview();
                console.log('[GameScene] Kinship Beacon preview created successfully');
                return;
            }

            if (this.fusionLandmarkPreview) {
                this.createFusionLandmarkPreview();
                console.log('[GameScene] Fusion Pod landmark preview created successfully');
                return;
            }

            if (this.fusionStoryPreview) {
                this.createFusionStoryPreview();
                console.log('[GameScene] Fusion story preview created successfully');
                return;
            }

            if (this.livingSignalPreview) {
                this.createLivingSignalPreview();
                console.log('[GameScene] Living Signal preview created successfully');
                return;
            }

            if (this.missionBriefingPreview) {
                this.createMissionBriefingPreview();
                console.log('[GameScene] Project Beacon mission briefing preview created successfully');
                return;
            }

            if (this.waypointPreview) {
                this.createWaypointPreview();
                console.log('[GameScene] Project Beacon waypoint preview created successfully');
                return;
            }

            if (this.fieldKitPreview) {
                this.createFieldKitPreviewBackdrop();
                const previewUpgrades = {
                    crystal: [{ id: 'crystal_edge', name: 'Resonant Edge' }],
                    aurora: [
                        { id: 'crystal_edge', name: 'Resonant Edge' },
                        { id: 'aurora_guard', name: 'Aurora Guard' }
                    ]
                }[this.fieldKitPreviewStage] || [];
                this.showFieldKitRecoveryModal(
                    {
                        katana: {
                            name: 'Earth-forged Field Katana',
                            material: 'Titanium-ceramic laminate',
                            upgradeSlots: 2,
                            installedUpgrades: previewUpgrades
                        }
                    },
                    {
                        context: this.fieldKitPreviewStage === 'earth'
                            ? 'recovery'
                            : 'upgrade'
                    }
                );
                console.log('[GameScene] Field-kit preview created successfully');
                return;
            }

            // Set current scene in GameState
            console.log('[GameScene] Setting current scene in GameState...');
            getGameState().set('session.currentScene', 'GameScene');

            // Emit session started event for PersonalitySystem
            getGameState().emit('sessionStarted', {
                scene: 'GameScene',
                timestamp: Date.now()
            });

            // Check for offline activities (Welcome Back feature)
            if (!this.welcomeBackChecked) {
                this.checkOfflineActivities();
            }

            // Initialize CreatureAI for chat functionality
            const CreatureAI = getCreatureAI();
            this.creatureAI = new CreatureAI();
            this.creatureAI.initialize();

            // Initialize CareSystem for creature care mechanics
            if (typeof window.CareSystem !== 'undefined' && window.CareSystem) {
                this.careSystem = window.CareSystem;
                // Initialize if not already done
                if (typeof this.careSystem.initialize === 'function' && !this.careSystem.initialized) {
                    this.careSystem.initialize();
                }
                console.log('[GameScene] CareSystem ready');
            } else {
                console.error('CareSystem not available, care features will be disabled');
                this.careSystem = null;
            }

            this.carePanelManager = new CarePanelManager(this, {
                careSystem: this.careSystem,
                playerProvider: () => this.player,
                geneticsProvider: () => this.playerGenetics || getGameState().get('creature.genetics')
            });

            // Initialize AchievementSystem for basic achievements
            if (typeof window.AchievementSystem !== 'undefined' && window.AchievementSystem) {
                this.achievementSystem = window.AchievementSystem;
                // Call initialize if it exists and hasn't been called
                if (typeof this.achievementSystem.initialize === 'function' && !this.achievementSystem.initialized) {
                    this.achievementSystem.initialize();
                }

                // Create achievement notification UI
                this.achievementNotification = new AchievementNotification(this);

                // Listen for achievement unlocks
                this.achievementUnlockHandler = (unlock) => {
                    if (this.achievementNotification && !this._isShuttingDown) {
                        this.achievementNotification.show(unlock);
                    }
                };
                this.achievementSystem.on('achievement:unlocked', this.achievementUnlockHandler, this);

                console.log('[GameScene] AchievementSystem and notification ready');
            } else {
                console.error('AchievementSystem not available, achievement features will be disabled');
                this.achievementSystem = null;
            }

            // Initialize TutorialSystem for progressive onboarding
            if (typeof window.TutorialSystem !== 'undefined' && window.TutorialSystem) {
                this.tutorialSystem = window.TutorialSystem;
                // Call initialize if it exists and hasn't been called
                if (typeof this.tutorialSystem.initialize === 'function' && !this.tutorialSystem.initialized) {
                    this.tutorialSystem.initialize();
                }
                console.log('[GameScene] TutorialSystem ready');
            } else {
                console.error('TutorialSystem not available, tutorial features will be disabled');
                this.tutorialSystem = null;
            }

            // Initialize enhanced graphics engine
            const GraphicsEngine = getGraphicsEngine();
            this.graphicsEngine = new GraphicsEngine(this);
            
            // Create enhanced sprites programmatically
            this.createEnhancedEnvironmentSprites();
            
            // Set world bounds for the large explorable area
            this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
            
            this.worldBuilder = new WorldBuilder(this, this.graphicsEngine, {
                worldWidth: this.worldWidth,
                worldHeight: this.worldHeight
            });
            if (this.currentBiome === 'nebula') {
                initializeVillageSettlement(window.GameState);
            }
            const worldPieces = this.worldBuilder.build();
            this.worldBackground = worldPieces.background;
            this.trees = worldPieces.trees;
            this.rocks = worldPieces.rocks;
            this.flowers = worldPieces.flowers;
            this.shop = worldPieces.shop;

            // Sanctuary landmarks (only in nebula/main biome)
            this.crashedShip = worldPieces.crashedShip || null;
            this.hubPortal = worldPieces.hubPortal || null;
            this.voidPortal = worldPieces.voidPortal || null;
            this.campfire = worldPieces.campfire || null;
            this.signalGarden = worldPieces.signalGarden || null;
            this.sanctuaryCommons = worldPieces.sanctuaryCommons || null;
            this.villageHeartLandmark =
                worldPieces.villageHeartLandmark || null;
            this.fusionPodLandmark =
                worldPieces.fusionPodLandmark || null;
            this.sanctuaryKeepsakes = worldPieces.sanctuaryKeepsakes || null;
            this.kinshipBeacon = worldPieces.kinshipBeacon || null;
            this.sanctuaryZones = worldPieces.sanctuaryZones || null;
            this.sanctuaryDistricts = worldPieces.sanctuaryDistricts || null;
            this.targetRange = worldPieces.targetRange || null;
            if (this.currentBiome === 'nebula') {
                this.sanctuaryInteractionDirector?.destroy?.();
                this.sanctuaryInteractionDirector =
                    new SanctuaryInteractionDirector(this);
            }

            this.setupSanctuaryDecorationListener();

            // Return portal (only in non-sanctuary biomes)
            this.returnPortal = worldPieces.returnPortal || null;

            // Cave-specific elements (Crystal Caves biome)
            this.caveTunnels = worldPieces.caveTunnels || null;
            this.caveElements = worldPieces.caveElements || null;

            // Update spawn point for cave biome
            if (this.caveTunnels && this.caveTunnels.spawnPoint) {
                this.caveSpawnPoint = this.caveTunnels.spawnPoint;
            }
            
            // Create the player (hatched creature)
            this.createPlayer();
            this.createExpeditionAstronaut();
            this.createLivingSignals();
            this.trackWorldArrival();
            
            // Set up camera to follow player
            this.setupCamera();

            // Set up parallax background layers (after camera setup)
            this.setupParallaxBiome();

            // Create navigation guide paths for new users (glowing trails to key locations)
            this.createNavigationPaths();

            // Initialize space weather effects (real NASA data)
            this.setupSpaceWeather();

            // Apply cosmic affinity passive effects
            this.applyCosmicAffinityEffects();

            if (this.player) {
                this.physics.add.collider(this.player, this.trees);
                this.physics.add.collider(this.player, this.rocks);
                this.physics.add.overlap(this.player, this.flowers, this.handleFlowerInteraction, null, this);

                // Shop only exists in non-cave biomes
                if (this.shop) {
                    this.physics.add.overlap(this.player, this.shop, this.handleShopProximity, null, this);
                }

                // Cave tunnel wall collisions (Crystal Caves)
                if (this.caveTunnels && this.caveTunnels.walls) {
                    this.physics.add.collider(this.player, this.caveTunnels.walls);
                    console.log('[GameScene] Cave tunnel collisions enabled');
                }

                // Sanctuary landmark interactions
                if (this.hubPortal) {
                    this.physics.add.overlap(this.player, this.hubPortal, this.handleHubPortalProximity, null, this);
                }
                if (this.voidPortal) {
                    this.physics.add.overlap(this.player, this.voidPortal, this.handleVoidPortalProximity, null, this);
                }
                if (this.crashedShip) {
                    this.physics.add.overlap(this.player, this.crashedShip, this.handleCrashedShipProximity, null, this);
                    // Create "Read Story" sign near the crashed ship
                    this.createReadStorySign();
                    this.createFieldKitCase();
                }
                if (this.campfire) {
                    this.physics.add.overlap(this.player, this.campfire, this.handleCampfireProximity, null, this);
                }
                if (this.signalGarden?.zone) {
                    this.physics.add.overlap(
                        this.player,
                        this.signalGarden.zone,
                        this.handleSignalGardenProximity,
                        null,
                        this
                    );
                }
                if (this.villageHeartLandmark?.zone) {
                    this.physics.add.overlap(
                        this.player,
                        this.villageHeartLandmark.zone,
                        this.handleVillageHeartProximity,
                        null,
                        this
                    );
                }
                if (this.fusionPodLandmark?.zone) {
                    this.physics.add.overlap(
                        this.player,
                        this.fusionPodLandmark.zone,
                        this.handleFusionPodProximity,
                        null,
                        this
                    );
                }
                this.setupFendResidentOverlaps();
                this.setupGuardianResidentOverlaps();
                this.setupRescuedResidentOverlaps();
                this.setupCurrentVeilAnchorOverlaps();

                // Target range interactions
                if (this.targetRange && this.targetRange.allTargets) {
                    this.setupTargetRangeCollisions();
                }

                // Return portal for non-sanctuary biomes
                if (this.returnPortal) {
                    this.physics.add.overlap(this.player, this.returnPortal, this.handleReturnPortalProximity, null, this);
                }
            }

            this.startVillageReconciliation();

            // Create cosmic coins for collection
            this.createCosmicCoins();

            // Create enemies
            this.createEnemies();

            // Set up input controls
            this.setupInput();
            
            // Create UI elements
            this.createUI();

            // Touch players open this through the creature radial menu; keyboard players use TAB.
            this.carePanelManager?.init();

            this.showWelcomeToastIfNeeded();

            // Initialize mobile controls and HUD if on mobile device
            if (window.MobileControls) {
                this.mobileControls = new window.MobileControls(this);
                this.mobileControls.show(this.forceMobileControls);
                this.hudController?.layoutInteractionText?.(
                    this.scale.width,
                    this.scale.height
                );
                console.log('[GameScene] Mobile controls initialized');
            }

            // Initialize mobile-optimized HUD
            this.mobileHUD = new MobileHUD(this);
            this.mobileHUD.init();
            if (this.mobileHUD.isVisible) {
                console.log('[GameScene] Mobile HUD initialized');
                // Hide desktop-oriented UI elements on mobile
                this.hideDesktopUIOnMobile();
            }

            // Initialize Quest Tracker UI
            this.questTracker = new QuestTracker(this);
            this.questTracker.create();
            window.QuestManager?.ensureProjectBeaconQuest?.();
            this.updateFirstContactFocusMode();
            ['questProgressUpdated', 'questCompleted', 'questRewardClaimed']
                .forEach(event => {
                    const unsubscribe = window.QuestManager?.on?.(
                        event,
                        () => this.updateFirstContactFocusMode()
                    );
                    if (typeof unsubscribe === 'function') {
                        this.gameStateUnsubscribers.push(unsubscribe);
                    }
                });
            console.log('[GameScene] Quest Tracker initialized');

            // Initialize floating chat bubble (follows player)
            this.floatingChatBubble = new FloatingChatBubble(this);
            this.floatingChatBubble.init(this.player);
            this.events.on('openChat', () => this.openChat());
            console.log('[GameScene] Floating chat bubble initialized');

            // Initialize creature radial menu (shown when tapping creature)
            this.creatureRadialMenu = new CreatureRadialMenu(this);
            this.events.on('radialMenuSelect', (itemId) => this.handleRadialMenuSelect(itemId));
            console.log('[GameScene] Creature radial menu initialized');

            // Ability slots duplicate the mobile radial menu and collide with the
            // movement dock, so they remain a desktop HUD.
            if (!this.mobileHUD.isVisible) {
                this.abilityHUD = new AbilityHUD(this);
                this.abilityHUD.create();
            }
            this.events.on('openAbilitySelection', (slotNumber) => {
                // Prevent launching if already running
                if (this.scene.isActive('AbilitySelectionScene')) {
                    console.log('[GameScene] AbilitySelectionScene already active, skipping');
                    return;
                }
                this.sceneRouter.launchScene('AbilitySelectionScene', { slot: slotNumber }, { bringToTop: true });
            });
            console.log('[GameScene] Ability HUD initialized for desktop layout');

            // Initialize NASA content system for daily space content
            this.setupNASAContent();

            // DEV ONLY: Listen for force creature refresh (from stage selector)
            if (import.meta.env.DEV) {
                this.events.on('forceCreatureRefresh', () => {
                    console.log('[GameScene] DEV: Force refreshing creature display');
                    this.refreshCreatureDisplay();
                });
            }

            // Initialize hamburger menu for navigation
            this.hamburgerMenu = new HamburgerMenu(this);
            this.hamburgerMenu.create();
            console.log('[GameScene] Hamburger menu initialized');

            if (this.openVillageHeartOnCreate) {
                this.time.delayedCall(180, () => {
                    if (!this._isShuttingDown) this.openVillageCommand();
                });
            }

            // MapNavigationButtons removed - redundant with HamburgerMenu
            // Mobile users can access all navigation via the hamburger menu

            // C key for Creature selection modal
            this.input.keyboard?.on('keydown-C', () => {
                if (!this.creatureSwitcher?.isVisible) {
                    this.showCreatureSwitcher();
                }
            });

            // Set up profile keyboard shortcut (P key)
            this.input.keyboard?.on('keydown-P', () => {
                this.openCreatureProfile();
            });

            // Spawn collectibles in the world
            this.spawnWorldCollectibles();
            this.projectBeaconWaypoint = new ProjectBeaconWaypoint(this);
            this.projectBeaconWaypoint.create();

            // Initialize Kid Mode features if enabled
            this.initializeKidMode();
            
            // Listen for GameState events
            this.setupGameStateListeners();
            this.time.delayedCall(700, () => {
                void this.recoverLivingPortraitAfterArrival();
            });
            this.time.delayedCall(1400, () => {
                if (this.livingPortraitReadyPreview) {
                    void this.maybeShowLivingPortraitReadyNotice({
                        identityKey: 'preview_companion_23:baby:portrait',
                        stage: 'baby',
                        imageUrl: '/marketing/nova.webp',
                        assetRef: null,
                        storage: 'preview'
                    }, { preview: true });
                    return;
                }
                void this.maybeShowLivingPortraitReadyNotice();
            });

            // Set up periodic timers for achievements and tutorials
            this.setupPeriodicTimers();

            // Initialize controls tutorial (used by OnboardingManager)
            this.controlsTutorial = new ControlsTutorialOverlay(this);

            // Use OnboardingManager to sequence all popups properly
            // This replaces the scattered delayed calls for controls, story, greeting, and NASA content
            this.time.delayedCall(500, () => {
                if (
                    this.continueFinaleAfterRepair ||
                    this.shipReconstructionHandoff
                ) return;
                if (window.OnboardingManager) {
                    window.OnboardingManager.initialize(this);
                    window.OnboardingManager.onQueueComplete = ({ firstSanctuaryVisit } = {}) => {
                        if (!firstSanctuaryVisit || this._isShuttingDown) return;
                        const storyQuest = window.QuestManager?.getQuestsByType?.('story')?.[0];
                        this.questTracker?.showStoryMissionBriefing?.(storyQuest);
                    };
                    window.OnboardingManager.startOnboardingFlow();
                }
            });

            // Initialize Secret Abilities for current creature
            this.initializeSecretAbilities();

            // Check for Ancient Lineage reveal
            this.time.delayedCall(2000, () => this.checkAncientLineageReveal());

            // Hide loading overlay (shown by HubWorldScene or other transition sources)
            if (window.UXEnhancements) {
                window.UXEnhancements.hideLoading();
            }

            // Controls hint panel (desktop helper - toggleable with H key)
            // NOTE: showOnStart is false because OnboardingManager handles first-time tutorial
            this.controlsHintPanel = new ControlsHintPanel(this, {
                showOnStart: false, // OnboardingManager handles first-time tutorial
                autoHideDelay: 8000 // Auto-hide after 8 seconds when manually toggled
            });
            this.controlsHintPanel.init();
            console.log('[GameScene] Controls hint panel initialized (press H to toggle)');

            // Initialize FeedbackManager for haptics and screen shake
            if (window.FeedbackManager) {
                this.feedbackManager = window.FeedbackManager;
                console.log('[GameScene] FeedbackManager ready');
            }

            // Initialize CreatureAnimationController for idle animations
            if (window.CreatureAnimationController && this.player) {
                // Get genetics from active creature in collection or from creature.genes
                const genetics = getGameState().get('creature.genes') ||
                                getGameState().getActiveCreature()?.genes ||
                                { personality: { core: 'curious' } };
                this.creatureAnimationController = new window.CreatureAnimationController(this, this.player, genetics);
                console.log('[GameScene] CreatureAnimationController initialized');

                // Set up creature intelligence integrations
                this.setupCreatureIntelligence();
            }

            // Stop any theme music from HatchingScene that might still be playing
            if (this.sound?.getAll) {
                const themeSounds = this.sound.getAll('themeMusic');
                themeSounds.forEach(sound => {
                    if (sound.isPlaying) {
                        this.tweens.add({
                            targets: sound,
                            volume: 0,
                            duration: 1000,
                            onComplete: () => {
                                sound.stop();
                                sound.destroy();
                            }
                        });
                    }
                });
            }

            // Also check if HatchingScene still has music playing and stop it
            const hatchingScene = this.scene.get('HatchingScene');
            if (hatchingScene?.themeMusic?.isPlaying) {
                hatchingScene.stopThemeMusic();
            }

            // Play sanctuary area background music (tranquil, meditative ambience)
            if (window.AudioManager?.playAreaMusic) {
                window.AudioManager.playAreaMusic('sanctuary');
                console.log('[GameScene] Started tranquil sanctuary music');
            }

            // Start creature idle sounds based on stage and personality
            this.startCreatureIdleSounds();

            // Show Void return feedback if applicable
            if (this.returningFromVoid) {
                this.time.delayedCall(1800, () => {
                    this.voidEntryCooldown = false;
                    this.nearVoidPortal = false;
                });
                this.time.delayedCall(500, () => {
                    this.showVoidReturnToast(this.voidScore);
                });
                this.returningFromVoid = false;
            }

            if (this.continueFinaleAfterRepair) {
                this.time.delayedCall(700, () => {
                    if (this._isShuttingDown) return;
                    const reconstruction = getShipReconstructionSnapshot(
                        window.GameState
                    );
                    if (reconstruction.complete) {
                        this.finishFinaleAfterCommandRepair();
                        return;
                    }
                    this.showShipEvidenceBoard();
                });
            } else if (this.shipReconstructionHandoff) {
                this.time.delayedCall(700, () => {
                    if (this._isShuttingDown) return;
                    this.showInteractionHint(
                        'WANDERER-77 // RECOVERED SYSTEM READY TO INSTALL'
                    );
                    this.showShipEvidenceBoard();
                });
            }

            console.log('[GameScene] Scene created successfully');
        } catch (error) {
            console.error('[GameScene] Error during scene creation:', error);
            console.error('[GameScene] Error stack:', error.stack);

            // Hide loading overlay even on error
            if (window.UXEnhancements) {
                window.UXEnhancements.hideLoading();
            }

            // Try to recover by showing a simple error message
            const errorText = this.add.text(400, 300, 'Error loading game scene.\nPlease refresh the page.', {
                fontSize: '20px',
                color: '#FF0000',
                stroke: '#FFFFFF',
                strokeThickness: 2,
                align: 'center'
            });
            errorText.setOrigin(0.5);

            // Still throw the error so it gets properly logged
            throw error;
        }
    }

    removeStaleAuxiliaryCameras() {
        const mainCamera = this.cameras?.main;
        const cameras = [...(this.cameras?.cameras || [])];
        cameras.forEach(camera => {
            if (camera !== mainCamera) {
                this.cameras.remove(camera);
            }
        });
    }

    createFieldKitPreviewBackdrop() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor('#081018');

        const backdrop = this.add.graphics();
        backdrop.fillStyle(0x081018, 1);
        backdrop.fillRect(0, 0, width, height);
        backdrop.fillStyle(0x172A32, 1);
        backdrop.fillRect(0, height * 0.68, width, height * 0.32);

        for (let index = 0; index < 36; index++) {
            const starX = (index * 97) % width;
            const starY = (index * 53) % Math.max(1, height * 0.64);
            backdrop.fillStyle(index % 4 === 0 ? 0x6FE7DD : 0xDCE8ED, 0.45);
            backdrop.fillCircle(starX, starY, index % 5 === 0 ? 2 : 1);
        }

        const ship = this.add.graphics();
        ship.fillStyle(0x26343E, 1);
        ship.fillRoundedRect(width * 0.08, height * 0.52, width * 0.26, height * 0.12, 8);
        ship.lineStyle(2, 0x6FE7DD, 0.55);
        ship.strokeRoundedRect(width * 0.08, height * 0.52, width * 0.26, height * 0.12, 8);
        ship.setRotation(-0.08);

        this.fieldKitPreviewElements = [backdrop, ship];
    }

    createCarePanelPreview() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor('#071017');

        const backdrop = this.add.graphics();
        backdrop.fillStyle(0x071017, 1);
        backdrop.fillRect(0, 0, width, height);
        backdrop.fillStyle(0x17383A, 1);
        backdrop.fillRect(0, height * 0.68, width, height * 0.32);
        for (let index = 0; index < 28; index++) {
            backdrop.fillStyle(index % 3 === 0 ? 0x6FE7DD : 0xDCE8ED, 0.45);
            backdrop.fillCircle((index * 83) % width, (index * 47) % (height * 0.62), index % 4 === 0 ? 2 : 1);
        }

        const companionX = Math.max(480, width * 0.68);
        const companionY = height * 0.55;
        const companion = this.add.graphics();
        companion.fillStyle(0x8FE3CF, 0.18);
        companion.fillCircle(companionX, companionY, 92);
        companion.fillStyle(0x9370DB, 1);
        companion.fillCircle(companionX, companionY, 54);
        companion.fillStyle(0xFFFFFF, 1);
        companion.fillCircle(companionX - 18, companionY - 10, 9);
        companion.fillCircle(companionX + 18, companionY - 10, 9);
        companion.fillStyle(0x17212A, 1);
        companion.fillCircle(companionX - 16, companionY - 10, 4);
        companion.fillCircle(companionX + 20, companionY - 10, 4);

        const heading = this.add.text(companionX, Math.max(70, height * 0.2), 'PROJECT BEACON // COMPANION CARE', {
            fontSize: '20px',
            color: '#8FE3CF',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        heading.setVisible(width >= 900);

        const actionInfo = {
            feed: { icon: '🍎', name: 'Feed', currentCount: 0, limit: 3, canPerform: true, isPreferred: false },
            play: { icon: '🎾', name: 'Play', currentCount: 0, limit: 2, canPerform: true, isPreferred: false },
            rest: { icon: '😴', name: 'Rest', currentCount: 0, limit: -1, isUnlimited: true, canPerform: true, isPreferred: false },
            pet: { icon: '◇', name: 'Connect', currentCount: 0, limit: -1, isUnlimited: true, canPerform: true, isPreferred: true }
        };
        const previewCareSystem = {
            careActions: { pet: { name: 'Connect' } },
            getAllCareActionsInfo: () => actionInfo,
            getCareSignal: () => ({
                label: 'Steady presence',
                preferredAction: 'pet'
            }),
            getCareStatus: () => ({
                dailyCare: { feedCount: 0, playCount: 0, petCount: 0, restCount: 0 }
            })
        };

        this.carePanelManager = new CarePanelManager(this, {
            careSystem: previewCareSystem,
            playerProvider: () => ({ x: companionX, y: companionY }),
            geneticsProvider: () => ({ personality: { core: 'gentle' } })
        });
        this.carePanelManager.init();
        this.carePanelManager.togglePanel();
        this.waypointPreviewElements.push(backdrop, companion, heading);
    }

    createVillageCommandPreview() {
        this.createFieldKitPreviewBackdrop();
        const now = Date.now();
        const companions = [
            {
                id: 'preview-nova',
                name: 'Nova',
                stats: { energy: 92, happiness: 86 },
                personalityState: { axes: { curiosity: 42, energy: 38 } },
                cosmicAffinity: 'nebula'
            },
            {
                id: 'preview-ember',
                name: 'Ember',
                stats: { energy: 88, happiness: 75 },
                personalityState: { axes: { energy: 44, temperament: 35 } },
                cosmicAffinity: 'star'
            },
            {
                id: 'preview-lumen',
                name: 'Lumen',
                stats: { energy: 74, happiness: 90 },
                personalityState: { axes: { temperament: -18 } },
                cosmicAffinity: 'crystal'
            }
        ];
        const previewData = {
            world: {
                fendCommunity: {
                    builtProjectIds: ['trailhead_shelter'],
                    contributionHistory: []
                },
                village: {}
            },
            creature: {
                ...companions[0],
                hatched: true
            },
            creatures: companions
        };
        const getPath = path => String(path)
            .split('.')
            .reduce((value, key) => value?.[key], previewData);
        const setPath = (path, value) => {
            const keys = String(path).split('.');
            const finalKey = keys.pop();
            const parent = keys.reduce((target, key) => {
                if (!target[key] || typeof target[key] !== 'object') target[key] = {};
                return target[key];
            }, previewData);
            parent[finalKey] = value;
        };
        const previewState = {
            get: getPath,
            set: setPath,
            save: () => {},
            emit: () => {},
            getActiveCreature: () => previewData.creature
        };
        initializeVillageSettlement(previewState, { now, save: false });

        if (this.villageCommandPreview === 'building') {
            placeVillageBuilding(previewState, {
                definitionId: 'forager_hut',
                plotId: 'root_01',
                now,
                save: false
            });
        }

        if (['active', 'complete'].includes(this.villageCommandPreview)) {
            if (this.villageCommandPreview === 'complete') {
                const village = previewState.get('world.village');
                previewState.set('world.village', {
                    ...village,
                    resources: { wood: 200, stone: 200, food: 200 }
                });
            }
            const previewBuildings = [
                ['forager_hut', 'root_01', companions[0].id],
                ['sawmill', 'root_02', companions[1].id],
                ['current_masonry', 'root_03', companions[2].id]
            ];
            if (this.villageCommandPreview === 'complete') {
                previewBuildings.push(
                    ['habitat', 'root_04', null],
                    ['workshop', 'root_05', null]
                );
            }
            previewBuildings.forEach(([definitionId, plotId, creatureId], index) => {
                const startedAt = now - 30000 + index;
                const placed = placeVillageBuilding(previewState, {
                    definitionId,
                    plotId,
                    now: startedAt,
                    save: false
                });
                reconcileVillageSettlement(previewState, { now, save: false });
                if (creatureId) {
                    assignCreatureToVillageBuilding(previewState, {
                        buildingId: placed.buildingId,
                        creatureId,
                        now,
                        save: false
                    });
                }
            });
        }

        const previewSnapshot = getVillageSnapshot(previewState);
        this.worldBuilder = new WorldBuilder(this, this.graphicsEngine, {
            worldWidth: this.scale.width,
            worldHeight: this.scale.height
        });
        this.villageHeartLandmark = this.worldBuilder.createVillageHeart({
            position: {
                x: Math.max(130, this.scale.width * 0.5),
                y: Math.max(150, this.scale.height * 0.54)
            },
            size: { width: 150, height: 130 }
        }, previewSnapshot);

        this.villageCommandPanel = new VillageCommandPanel(this);
        const previewPanelOptions = {
            getSnapshot: () => getVillageSnapshot(previewState),
            onPlace: request => {
                const result = placeVillageBuilding(previewState, {
                    ...request,
                    save: false
                });
                this.worldBuilder.refreshVillageSettlement(
                    this.villageHeartLandmark,
                    result.snapshot
                );
                if (result.changed) {
                    const building = result.snapshot.buildings.find(
                        entry => entry.id === result.buildingId
                    );
                    this.worldBuilder.playVillageBuildingMoment(
                        this.villageHeartLandmark,
                        building,
                        { stage: 'construction' }
                    );
                }
                return result;
            },
            onAssign: request => {
                const result = assignCreatureToVillageBuilding(previewState, {
                    ...request,
                    save: false
                });
                this.worldBuilder.refreshVillageSettlement(
                    this.villageHeartLandmark,
                    result.snapshot
                );
                return result;
            },
            onDecision: request => {
                const result = resolveVillageHeartDecision(previewState, {
                    ...request,
                    save: false
                });
                this.worldBuilder.refreshVillageSettlement(
                    this.villageHeartLandmark,
                    result.snapshot
                );
                if (result.changed) this.villageDecisionMomentPending = result;
                return result;
            },
            onTick: () => {
                const previous = getVillageSnapshot(previewState);
                const snapshot = reconcileVillageSettlement(previewState, {
                    save: false
                });
                this.worldBuilder.refreshVillageSettlement(
                    this.villageHeartLandmark,
                    snapshot
                );
                this.notifyVillageProgress(previous, snapshot);
                return snapshot;
            },
            onClose: () => {
                if (!this.villageDecisionMomentPending) return;
                this.worldBuilder.playVillageDecisionMoment(
                    this.villageHeartLandmark,
                    this.villageDecisionMomentPending
                );
                this.villageDecisionMomentPending = null;
            }
        };
        this.openVillageCommand = ({
            plotId = null,
            guided = plotId === null
        } = {}) => (
            this.villageCommandPanel.show({
                plotId,
                guided,
                ...previewPanelOptions
            })
        );
        this.openVillageWorkerCheckIn = ({ creatureId } = {}) => (
            this.showVillageWorkerCheckIn({ creatureId, snapshot: getVillageSnapshot(previewState) })
        );
        this.sanctuaryInteractionDirector?.destroy?.();
        this.sanctuaryInteractionDirector = new SanctuaryInteractionDirector(this);
        this.nearVillageHeart = true;
        this.offerVillageHeartInteraction(previewSnapshot);
        this.openVillageCommand({ guided: false });
    }

    createSignalGardenPreview() {
        const { width, height } = this.scale;
        this.cameras.main.stopFollow();
        this.cameras.main.setScroll(0, 0);
        this.cameras.main.setZoom(1);
        this.cameras.main.setBackgroundColor('#071411');

        const backdrop = this.add.graphics();
        backdrop.fillStyle(0x071411, 1);
        backdrop.fillRect(0, 0, width, height);
        backdrop.fillStyle(0x173B35, 1);
        backdrop.fillRect(0, height * 0.58, width, height * 0.42);
        backdrop.fillStyle(0x244E47, 0.78);
        for (let x = 16; x < width; x += 72) {
            const plantY = height * 0.62 + ((x / 72) % 3) * 24;
            backdrop.fillCircle(x, plantY, 13);
            backdrop.fillCircle(x + 12, plantY + 5, 10);
        }
        for (let index = 0; index < 30; index++) {
            backdrop.fillStyle(index % 4 === 0 ? 0x71E6B1 : 0xD8FFF0, 0.35);
            backdrop.fillCircle(
                (index * 83) % width,
                (index * 47) % Math.max(1, height * 0.52),
                index % 5 === 0 ? 2 : 1
            );
        }

        const heading = this.add.text(width / 2, Math.max(42, height * 0.12), 'PROJECT BEACON // SIGNAL GARDEN', {
            fontSize: width < 600 ? '16px' : '20px',
            fontFamily: 'Arial, sans-serif',
            color: '#D8FFF0',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        const stageLabel = this.add.text(
            width / 2,
            heading.y + 32,
            this.communityPreview !== null
                ? this.fendCulturePreview
                    ? 'LIVING COMMONS // FIRST LISTENING'
                    : `COMMUNITY STAGE ${this.communityPreview}/4`
                : this.signalGardenPreview.toUpperCase(),
            {
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
            color: '#F2C86B'
            }
        ).setOrigin(0.5);

        const GraphicsEngine = getGraphicsEngine();
        this.graphicsEngine = new GraphicsEngine(this);
        this.worldBuilder = new WorldBuilder(this, this.graphicsEngine, {
            worldWidth: width,
            worldHeight: height
        });
        this.signalGarden = this.worldBuilder.createSignalGarden({
            position: {
                x: width / 2,
                y: Math.min(height - 105, height * 0.68)
            },
            name: 'Signal Garden',
            description: 'Nurture a living signal with your companion.',
            interactRadius: 115
        }, this.signalGardenPreview);
        if (this.communityPreview !== null) {
            this.worldBuilder.refreshFendCommunity(
                this.signalGarden,
                this.communityPreview
            );
        }
        if (this.residentPreview !== null) {
            const residentSnapshot = this.createFendResidentPreviewSnapshot(
                this.residentPreview
            );
            this.worldBuilder.refreshFendResidents(
                this.signalGarden,
                residentSnapshot
            );
            if (this.residentExchangePreview !== null) {
                this.time.delayedCall(250, () => {
                    this.showFendResidentExchange({
                        changed: true,
                        reason: 'request_accepted',
                        resident: residentSnapshot.activeResident,
                        snapshot: residentSnapshot
                    });
                });
            }
        }
        if (this.guardianResidentPreview !== null) {
            const guardianSnapshot = this.createGuardianResidentPreviewSnapshot(
                this.guardianResidentPreview,
                this.guardianTaskPreview,
                this.guardianExchangePreview
            );
            this.worldBuilder.refreshGuardianResidents(
                this.signalGarden,
                guardianSnapshot
            );
            if (this.guardianExchangePreview !== null) {
                const resident = guardianSnapshot.rescuedResidents[
                    this.guardianExchangePreview - 1
                ];
                this.time.delayedCall(250, () => {
                    const previewReason = {
                        accepted: 'guardian_task_accepted',
                        ready: 'guardian_task_progress',
                        completed: 'guardian_task_completed',
                        selected: 'guardian_team_selected',
                        synergy: 'guardian_synergy_unlocked',
                        debrief: 'guardian_expedition_debrief'
                    }[this.guardianTaskPreview] || 'guardian_first_meeting';
                    const previewMessage = {
                        accepted: resident.task.briefing,
                        ready: resident.task.objective,
                        completed: resident.task.completionLine,
                        selected: resident.teamAbility.activationLine,
                        synergy: resident.synergy.memory,
                        debrief: createGuardianExpeditionDebrief(
                            { get: path => path === 'creature.name' ? 'Kira' : null },
                            resident,
                            {
                                levelId: 'crystalCaves',
                                interventionCount: 1
                            }
                        )
                    }[this.guardianTaskPreview] || resident.rescueMemory;
                    this.showGuardianResidentExchange({
                        changed: true,
                        reason: previewReason,
                        resident,
                        message: previewMessage,
                        snapshot: guardianSnapshot
                    });
                });
            }
            if (this.guardianRecognitionPreview !== null) {
                const resident = guardianSnapshot.rescuedResidents[
                    this.guardianRecognitionPreview - 1
                ];
                const recognitionPreviewState = {
                    get(path) {
                        const state = {
                            creature: {
                                name: 'Kira',
                                personality: 'curious',
                                genes: {
                                    id: 'preview_kira_23',
                                    personality: { core: 'curious' },
                                    cosmicAffinity: { element: 'nebula' },
                                    traits: {
                                        bodyShape: { type: 'serpentine' },
                                        features: {
                                            wackyMutations: [
                                                { type: 'extra_eyes' }
                                            ],
                                            specialFeatures: [
                                                { type: 'bioluminescent_spots' }
                                            ]
                                        }
                                    }
                                },
                                dna: {
                                    id: 'preview_kira_dna_23',
                                    bodyArchetype: 'serpentine',
                                    hybridTag: 'single-species'
                                }
                            }
                        };
                        return path.split('.').reduce(
                            (value, key) => value?.[key],
                            state
                        );
                    }
                };
                const recognition = getGuardianCompanionRecognition(
                    recognitionPreviewState,
                    resident.id
                );
                this.time.delayedCall(500, () => {
                    this.showGuardianCompanionRecognitionMoment(
                        recognition,
                        resident,
                        { duration: 6000 }
                    );
                });
            }
        }
        if (this.livingPortraitReadyPreview) {
            this.time.delayedCall(350, () => {
                void this.maybeShowLivingPortraitReadyNotice({
                    identityKey: 'preview_companion_23:baby:portrait',
                    stage: 'baby',
                    imageUrl: '/marketing/nova.webp',
                    assetRef: null,
                    storage: 'preview'
                }, { preview: true });
            });
        }
        if (this.fendCulturePreview) {
            const cultureSnapshot = this.createFendCulturePreviewSnapshot(
                this.fendCulturePreview
            );
            this.worldBuilder.refreshFendCulture(
                this.signalGarden,
                cultureSnapshot
            );
            this.time.delayedCall(250, () => {
                this.showFendCommonsListening({
                    previewPriority: this.fendCulturePreview === 'ready'
                        ? null
                        : this.fendCulturePreview
                });
            });
        }

        this.signalGardenPreviewElements = [backdrop, heading, stageLabel];
        if (this.communityMomentPreview !== null) {
            this.time.delayedCall(250, () => {
                const project = FEND_COMMUNITY_PROJECTS[
                    this.communityMomentPreview - 1
                ];
                this.showFendCommunityProjectMoment({
                    project,
                    snapshot: {
                        stage: this.communityMomentPreview
                    }
                });
            });
        }
    }

    createFendResidentPreviewSnapshot(stage) {
        const boundedStage = Math.max(
            0,
            Math.min(FEND_RESIDENT_DEFINITIONS.length, Number(stage) || 0)
        );
        const activeIndex = Math.max(0, boundedStage - 1);
        const residents = FEND_RESIDENT_DEFINITIONS.map((definition, index) => {
            const available = index < boundedStage;
            const completed = available && index < activeIndex;
            const active = available && index === activeIndex;
            return {
                ...definition,
                available,
                met: available,
                completed,
                active,
                ready: false,
                status: completed
                    ? 'completed'
                    : active
                        ? 'active'
                        : 'locked'
            };
        });
        const activeResident = residents.find(resident => resident.active) || null;
        return {
            state: {
                metResidentIds: residents
                    .filter(resident => resident.met)
                    .map(resident => resident.id),
                completedRequestIds: residents
                    .filter(resident => resident.completed)
                    .map(resident => resident.request.id),
                activeRequestId: activeResident?.request.id || null
            },
            residents,
            availableResidents: residents.filter(resident => resident.available),
            activeResident,
            nextResident: activeResident,
            metCount: boundedStage,
            completedCount: Math.max(0, boundedStage - 1),
            totalResidents: FEND_RESIDENT_DEFINITIONS.length,
            complete: false
        };
    }

    createGuardianResidentPreviewSnapshot(count, taskState = null, taskResidentIndex = null) {
        const activePreviewId = Number.isFinite(Number(taskResidentIndex))
            ? GUARDIAN_RESIDENT_DEFINITIONS[
                Math.max(0, Math.min(
                    GUARDIAN_RESIDENT_DEFINITIONS.length - 1,
                    Number(taskResidentIndex) - 1
                ))
            ]?.id
            : null;
        const rescuedResidents = GUARDIAN_RESIDENT_DEFINITIONS
            .slice(0, count)
            .map(resident => {
                const isTaskResident = resident.id === activePreviewId;
                const taskAccepted = isTaskResident && Boolean(taskState);
                const ready = isTaskResident && [
                    'ready', 'completed', 'selected', 'synergy', 'debrief'
                ].includes(taskState);
                const completed = isTaskResident && [
                    'completed', 'selected', 'synergy', 'debrief'
                ].includes(taskState);
                const activeTeam = isTaskResident && [
                    'selected', 'synergy', 'debrief'
                ].includes(taskState);
                const synergyUnlocked = isTaskResident && taskState === 'synergy';
                const routineAssistCount = synergyUnlocked
                    ? GUARDIAN_SYNERGY_ASSISTS
                    : completed ? 1 : 0;
                return {
                    ...resident,
                    rescued: true,
                    met: taskAccepted,
                    interactionCount: taskAccepted ? 2 : 0,
                    taskAccepted,
                    taskStatus: activeTeam
                        ? 'selected'
                        : completed
                            ? 'completed'
                            : ready
                                ? 'ready'
                                : taskAccepted
                                    ? 'active'
                                    : 'locked',
                    taskProgress: {
                        progress: ready ? resident.task.target : 0,
                        target: resident.task.target,
                        ready,
                        completed
                    },
                    teamAbilityUnlocked: completed,
                    activeTeam,
                    routineAssistCount,
                    routineSupported: completed,
                    lastRoutineAssistAt: null,
                    routineReadyAt: null,
                    routineReady: taskAccepted,
                    routineWaitMs: 0,
                    routineStatus: taskAccepted ? 'ready' : 'locked',
                    trustProgress: Math.min(GUARDIAN_SYNERGY_ASSISTS, routineAssistCount),
                    trustTarget: GUARDIAN_SYNERGY_ASSISTS,
                    synergyUnlocked,
                    expeditionCount: taskState === 'debrief' ? 1 : 0,
                    lastExpedition: taskState === 'debrief'
                        ? {
                            guardianId: resident.id,
                            levelId: 'crystalCaves',
                            interventionCount: 1,
                            noDamage: false
                        }
                        : null,
                    expeditionDebriefReady: taskState === 'debrief',
                    dialogueLine: resident.rescueMemory
                };
            });
        return {
            residents: GUARDIAN_RESIDENT_DEFINITIONS.map(resident => (
                rescuedResidents.find(entry => entry.id === resident.id) || {
                    ...resident,
                    rescued: false,
                    met: false,
                    taskAccepted: false,
                    taskStatus: 'locked',
                    taskProgress: {
                        progress: 0,
                        target: resident.task.target,
                        ready: false,
                        completed: false
                    },
                    teamAbilityUnlocked: false,
                    activeTeam: false,
                    routineAssistCount: 0,
                    routineSupported: false,
                    lastRoutineAssistAt: null,
                    routineReadyAt: null,
                    routineReady: false,
                    routineWaitMs: 0,
                    routineStatus: 'locked',
                    trustProgress: 0,
                    trustTarget: GUARDIAN_SYNERGY_ASSISTS,
                    synergyUnlocked: false,
                    expeditionCount: 0,
                    lastExpedition: null,
                    expeditionDebriefReady: false
                }
            )),
            rescuedResidents,
            rescuedCount: rescuedResidents.length,
            totalResidents: GUARDIAN_RESIDENT_DEFINITIONS.length,
            completedTaskCount: rescuedResidents.filter(
                resident => resident.teamAbilityUnlocked
            ).length,
            routineAssistCount: rescuedResidents.reduce(
                (total, resident) => total + resident.routineAssistCount,
                0
            ),
            supportedResidentCount: rescuedResidents.filter(
                resident => resident.routineSupported
            ).length,
            synergyCount: rescuedResidents.filter(
                resident => resident.synergyUnlocked
            ).length,
            activeTeamResident: rescuedResidents.find(
                resident => resident.activeTeam
            ) || null,
            careFocusResident: rescuedResidents.find(
                resident => resident.routineReady
            ) || null
        };
    }

    createFendCulturePreviewSnapshot(priorityId = 'ready') {
        const selectedPriority = FEND_COMMONS_PRIORITIES.find(
            priority => priority.id === priorityId
        ) || null;
        return {
            ready: !selectedPriority,
            complete: Boolean(selectedPriority),
            selectedPriority,
            priorities: FEND_COMMONS_PRIORITIES,
            state: {
                firstListening: {
                    status: selectedPriority ? 'complete' : 'ready',
                    selectedPriority: selectedPriority?.id || null
                }
            }
        };
    }

    createLivingSignalPreview() {
        const { width, height } = this.scale;
        const definition = LIVING_SIGNAL_DEFINITIONS.find(
            signal => signal.id === this.livingSignalPreview
        ) || LIVING_SIGNAL_DEFINITIONS[0];

        this.cameras.main.setBackgroundColor('#071017');
        const backdrop = this.add.graphics();
        backdrop.fillStyle(0x071017, 1);
        backdrop.fillRect(0, 0, width, height);
        backdrop.fillStyle(0x173936, 1);
        backdrop.fillRect(0, height * 0.52, width, height * 0.48);
        backdrop.fillStyle(0x214D46, 0.8);
        for (let x = 18; x < width; x += 78) {
            backdrop.fillCircle(x, height * 0.58 + ((x / 78) % 3) * 18, 14);
        }
        for (let index = 0; index < 28; index++) {
            backdrop.fillStyle(index % 4 === 0 ? 0x8FE3CF : 0xD6EEF2, 0.38);
            backdrop.fillCircle(
                (index * 89) % width,
                (index * 43) % Math.max(1, height * 0.46),
                index % 5 === 0 ? 2 : 1
            );
        }

        const heading = this.add.text(
            width / 2,
            Math.max(34, height * 0.08),
            'PROJECT BEACON // LIVING SIGNAL',
            {
                fontSize: width < 600 ? '15px' : '20px',
                fontFamily: 'Arial, sans-serif',
                color: '#D8FFF0',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);
        const previewSignal = this.createLivingSignalVisual({
            ...definition,
            position: {
                x: width / 2,
                y: Math.min(
                    height * (width < 600 ? 0.38 : 0.46),
                    height - 370
                )
            }
        }, false, { showLabel: true });
        this.livingSignals = [previewSignal];
        if (this.livingSignalProgressPreview !== null) {
            this.setLivingSignalListeningProgress(
                previewSignal,
                this.livingSignalProgressPreview
            );
        } else {
            const previewProgress = LIVING_SIGNAL_DEFINITIONS.findIndex(
                signal => signal.id === definition.id
            ) + 1;
            this.setLivingSignalLinkedState(
                previewSignal,
                previewProgress,
                LIVING_SIGNAL_DEFINITIONS.length
            );
            this.showLivingSignalMoment({
                signal: definition,
                progress: previewProgress,
                total: LIVING_SIGNAL_DEFINITIONS.length,
                completed: definition.id ===
                    LIVING_SIGNAL_DEFINITIONS[LIVING_SIGNAL_DEFINITIONS.length - 1].id
            }, { preview: true });
        }
        this.livingSignalPreviewElements = [backdrop, heading];
    }

    createLivingSignals() {
        if (this.currentBiome !== 'nebula') {
            this.livingSignals = [];
            return;
        }

        const state = normalizeLivingSignalState(
            window.GameState?.get('world.livingSignals')
        );
        this.livingSignals = LIVING_SIGNAL_DEFINITIONS.map(definition => {
            const observedIndex = state.observedIds.indexOf(definition.id);
            return this.createLivingSignalVisual(
                definition,
                observedIndex >= 0,
                {
                    progress: observedIndex + 1,
                    total: LIVING_SIGNAL_DEFINITIONS.length
                }
            );
        });
    }

    createLivingSignalVisual(
        definition,
        observed = false,
        {
            progress = 0,
            total = LIVING_SIGNAL_DEFINITIONS.length,
            showLabel = false
        } = {}
    ) {
        const { x, y } = definition.position;
        const container = this.add.container(x, y).setDepth(y + 4);
        const aura = this.add.graphics();
        aura.fillStyle(definition.color, observed ? 0.16 : 0.18);
        aura.fillCircle(0, 0, 42);
        aura.lineStyle(2, definition.color, observed ? 0.68 : 0.75);
        aura.strokeCircle(0, 0, 33);
        aura.lineStyle(1, definition.accent, observed ? 0.52 : 0.55);
        aura.strokeCircle(0, 0, 22);

        const form = this.add.graphics();
        if (definition.id === 'echo_bloom') {
            form.lineStyle(4, 0x71E6B1, 1);
            form.lineBetween(0, 18, 0, -7);
            form.fillStyle(definition.color, 1);
            form.fillCircle(-9, -10, 9);
            form.fillCircle(9, -10, 9);
            form.fillStyle(definition.accent, 1);
            form.fillCircle(0, -10, 7);
        } else if (definition.id === 'memory_stone') {
            form.fillStyle(0x263C48, 1);
            form.fillTriangle(-16, 17, 16, 17, 8, -20);
            form.lineStyle(3, definition.color, 0.95);
            form.lineBetween(-7, 8, 5, -9);
            form.lineBetween(5, -9, 10, 5);
            form.fillStyle(definition.accent, 1);
            form.fillCircle(5, -9, 4);
        } else {
            form.lineStyle(5, definition.color, 1);
            form.lineBetween(0, 18, 0, -13);
            form.lineStyle(3, definition.accent, 0.9);
            form.lineBetween(0, 4, -15, -4);
            form.lineBetween(0, -3, 15, -12);
            form.fillStyle(0xD8FFF0, 1);
            form.fillCircle(-15, -4, 5);
            form.fillCircle(15, -12, 5);
            form.fillCircle(0, -17, 6);
        }

        const listeningProgress = this.add.graphics();
        listeningProgress.setVisible(false);

        const label = this.add.text(
            0,
            51,
            observed
                ? `CURRENT LINKED // ${progress}/${total}`
                : 'LIVING SIGNAL // LISTEN TOGETHER',
            {
                fontSize: '10px',
                fontFamily: 'Arial, sans-serif',
                color: observed ? '#829B96' : '#D8FFF0',
                fontStyle: 'bold',
                backgroundColor: 'rgba(5, 18, 17, 0.78)',
                padding: { x: 5, y: 3 }
            }
        ).setOrigin(0.5).setVisible(showLabel);
        container.add([aura, listeningProgress, form, label]);

        const pulseTween = this.tweens.add({
            targets: aura,
            alpha: { from: observed ? 0.35 : 0.68, to: observed ? 0.5 : 1 },
            scale: { from: 0.92, to: 1.1 },
            duration: observed ? 2100 : 1150,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        const visual = {
            id: definition.id,
            signalId: definition.id,
            signalData: definition,
            x,
            y,
            active: true,
            observed,
            container,
            aura,
            form,
            label,
            listeningProgress,
            labelAlwaysVisible: showLabel,
            pulseTween
        };
        if (observed) {
            this.setLivingSignalLinkedState(visual, progress, total);
        }
        return visual;
    }

    setLivingSignalLinkedState(
        signal,
        progress = 1,
        total = LIVING_SIGNAL_DEFINITIONS.length
    ) {
        if (!signal) return;

        signal.observed = true;
        signal.listeningProgress?.clear?.();
        signal.listeningProgress?.setVisible?.(false);
        signal.label?.setText(`CURRENT LINKED // ${progress}/${total}`);
        signal.label?.setColor('#8FE3CF');
        signal.container?.setAlpha?.(0.96);

        if (!signal.linkVisual) {
            const linkVisual = this.add.graphics();
            const color = signal.signalData?.color || 0x8FE3CF;
            const accent = signal.signalData?.accent || 0xF2C14E;
            linkVisual.lineStyle(2, color, 0.58);
            linkVisual.lineBetween(0, 17, -34, 31);
            linkVisual.lineBetween(0, 17, 34, 27);
            linkVisual.lineBetween(0, 17, 0, 42);
            linkVisual.fillStyle(accent, 0.9);
            linkVisual.fillCircle(-34, 31, 4);
            linkVisual.fillCircle(34, 27, 4);
            linkVisual.fillCircle(0, 42, 4);
            signal.container?.addAt?.(linkVisual, 0);
            signal.linkVisual = linkVisual;
        }

        signal.pulseTween?.stop?.();
        signal.linkTween?.stop?.();
        signal.linkTween = this.tweens.add({
            targets: [signal.aura, signal.linkVisual].filter(Boolean),
            alpha: { from: 0.62, to: 0.96 },
            duration: 1800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    setLivingSignalListeningProgress(signal, progress = 0) {
        if (!signal || signal.observed) return;

        const boundedProgress = Phaser.Math.Clamp(Number(progress) || 0, 0, 1);
        const percent = Math.round(boundedProgress * 100);
        signal.listeningProgress?.clear?.();

        if (boundedProgress > 0) {
            signal.listeningProgress
                ?.lineStyle?.(5, signal.signalData?.accent || 0xF2C14E, 1);
            signal.listeningProgress?.beginPath?.();
            signal.listeningProgress?.arc?.(
                0,
                0,
                38,
                -Math.PI / 2,
                -Math.PI / 2 + (Math.PI * 2 * boundedProgress),
                false
            );
            signal.listeningProgress?.strokePath?.();
            signal.listeningProgress?.setVisible?.(true);
            signal.label?.setText(`LISTENING ${percent}% // HOLD STILL`);
            signal.label?.setColor('#F2C14E');
            return;
        }

        signal.listeningProgress?.setVisible?.(false);
        signal.label?.setText('LIVING SIGNAL // LISTEN TOGETHER');
        signal.label?.setColor('#D8FFF0');
    }

    setLivingSignalLabelFocus(signalId = null) {
        this.livingSignals?.forEach(signal => {
            signal?.label?.setVisible?.(
                signal.labelAlwaysVisible === true || signal.signalId === signalId
            );
        });
    }

    resetActiveLivingSignalListening() {
        if (!this.activeLivingSignalId) return;
        const activeSignal = this.livingSignals.find(
            signal => signal?.signalId === this.activeLivingSignalId
        );
        this.setLivingSignalListeningProgress(activeSignal, 0);
        this.activeLivingSignalId = null;
        this.livingSignalDwellMs = 0;
    }

    refreshLivingSignalVisual(
        signal,
        progress = 1,
        total = LIVING_SIGNAL_DEFINITIONS.length
    ) {
        if (!signal) return;
        this.setLivingSignalLinkedState(signal, progress, total);
    }

    createWaypointPreview() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor('#071017');

        const backdrop = this.add.graphics();
        backdrop.fillStyle(0x071017, 1);
        backdrop.fillRect(0, 0, width, height);
        backdrop.fillStyle(0x142A31, 1);
        backdrop.fillRect(0, height * 0.66, width, height * 0.34);
        backdrop.lineStyle(1, 0x29434A, 0.5);
        for (let x = 0; x < width; x += 80) {
            backdrop.lineBetween(x, height * 0.66, x + 45, height);
        }

        const playerX = width * 0.3;
        const playerY = height * 0.66;
        const playerVisual = this.add.graphics();
        playerVisual.fillStyle(0x8FE3CF, 0.2);
        playerVisual.fillCircle(playerX, playerY, 52);
        playerVisual.fillStyle(0x9370DB, 1);
        playerVisual.fillCircle(playerX, playerY, 25);
        playerVisual.fillStyle(0xFFFFFF, 1);
        playerVisual.fillCircle(playerX - 8, playerY - 6, 5);
        playerVisual.fillCircle(playerX + 8, playerY - 6, 5);
        playerVisual.fillStyle(0x17212A, 1);
        playerVisual.fillCircle(playerX - 7, playerY - 6, 2);
        playerVisual.fillCircle(playerX + 9, playerY - 6, 2);

        this.player = {
            x: playerX,
            y: playerY,
            active: true,
            flipX: false
        };

        const isSignalPreview = this.waypointPreview === 'signals';
        const targetX = isSignalPreview ? width + 450 : width * 0.77;
        const targetY = isSignalPreview ? height * 0.34 : height * 0.46;
        const target = { x: targetX, y: targetY, active: true, collected: false };
        this.crashedShip = target;
        this.hubPortal = target;
        this.collectibles = [];
        this.livingSignals = isSignalPreview
            ? [{ ...target, observed: false, signalId: 'preview_signal' }]
            : [];

        if (!isSignalPreview) {
            const ship = this.add.graphics();
            ship.fillStyle(0xBFCBD0, 1);
            ship.fillRoundedRect(targetX - 65, targetY - 22, 130, 44, 12);
            ship.fillStyle(0x3978B8, 0.85);
            ship.fillRoundedRect(targetX - 35, targetY - 34, 52, 19, 8);
            ship.lineStyle(3, 0xC74B50, 1);
            ship.lineBetween(targetX + 12, targetY - 20, targetX + 46, targetY + 16);
            this.waypointPreviewElements.push(ship);
        }

        const mission = {
            id: isSignalPreview ? 'beacon_living_signals' : 'beacon_field_kit',
            type: 'story',
            completed: false,
            claimed: false
        };
        this.projectBeaconWaypoint = new ProjectBeaconWaypoint(this, {
            questProvider: () => mission
        });
        this.projectBeaconWaypoint.create();
        this.projectBeaconWaypoint.update(16.67);
        this.waypointPreviewElements.push(backdrop, playerVisual);
    }

    createBeaconLogPreview() {
        if (this.beaconLogPreviewSize === 'mobile') {
            const viewportWidth = Math.min(390, this.scale.width);
            const viewportHeight = Math.min(720, this.scale.height);
            this.cameras.main.setViewport(
                (this.scale.width - viewportWidth) / 2,
                (this.scale.height - viewportHeight) / 2,
                viewportWidth,
                viewportHeight
            );
        }
        const { width, height } = this.cameras.main;
        this.cameras.main.setBackgroundColor('#061019');

        const backdrop = this.add.graphics();
        backdrop.fillStyle(0x061019, 1);
        backdrop.fillRect(0, 0, width, height);
        backdrop.fillStyle(0x102B30, 0.9);
        backdrop.fillRect(0, height * 0.68, width, height * 0.32);
        backdrop.lineStyle(2, 0x2E5960, 0.35);
        for (let x = -height; x < width; x += 70) {
            backdrop.lineBetween(x, height, x + height * 0.35, height * 0.68);
        }

        const recoveryPreview = this.beaconLogPreview === 'recovery';
        const previewCompanionId = 'preview_companion_23';
        const previewState = {
            creature: {
                name: 'Luma',
                bond: { level: 5 },
                genes: { id: previewCompanionId },
                agencyHistory: recoveryPreview
                    ? [{ type: 'high_power_rescue' }]
                    : []
            },
            quests: {
                completed: projectBeacon.fieldMissions.map(mission => mission.id)
            },
            story: {
                projectBeacon: {
                    currentMission: 'field_sequence_complete',
                    pendingDebriefs: [{ id: 'beacon_debrief_3' }],
                    debriefsSeen: ['beacon_debrief_1', 'beacon_debrief_2'],
                    fieldKit: {
                        recovered: [
                            'memory',
                            'recovery'
                        ].includes(this.beaconLogPreview)
                    },
                    missionLogSeen: [
                        'memory',
                        'recovery'
                    ].includes(this.beaconLogPreview),
                    companionConsent: recoveryPreview
                        ? {
                            schemaVersion: 2,
                            activeCompanionId: previewCompanionId,
                            records: [{
                                companionId: previewCompanionId,
                                travelStatus: 'decision_deferred',
                                disclosureStatus:
                                    'astronaut_survival_only',
                                locationBoundary:
                                    'coordinates_withheld',
                                informedRisks: true,
                                willingPassenger: null,
                                vetoRecognized: true,
                                powerBoundary:
                                    'emergency_life_first',
                                reviewedTopicIds: [
                                    'route',
                                    'evidence',
                                    'power'
                                ],
                                history: []
                            }]
                        }
                        : {},
                    sensei: {
                        memoryLedger: recoveryPreview
                            ? {
                                schemaVersion: 1,
                                recalledMemoryIds: [
                                    'begin_with_your_footing',
                                    'trust_begins_with_how_you_enter',
                                    'power_is_knowing_what_not_to_take'
                                ],
                                lesson: {
                                    id: 'centering_stance',
                                    status: 'available',
                                    practiceCount: 0
                                },
                                history: []
                            }
                            : {}
                    },
                    lastRouteUnlocked: {
                        gateId: 'void_peaks',
                        label: 'Void Peaks'
                    },
                    uplinkRestored: recoveryPreview,
                    finale: recoveryPreview
                        ? { priority: 'prepare_homecoming' }
                        : { priority: null },
                    shipArchive: recoveryPreview
                        ? {
                            reviewedSectionIds: [
                                'systems',
                                'evidence',
                                'boundaries'
                            ]
                        }
                        : {},
                    protectedReturnProtocol: recoveryPreview
                        ? {
                            completedStepIds: [
                                'survival_packet',
                                'route_quarantine',
                                'living_witness_seal',
                                'uplink_hold'
                            ],
                            packetStatus: 'sealed_ready_not_sent'
                        }
                        : {},
                    shipCapabilities: recoveryPreview
                        ? {
                            passengerCapacity: 1,
                            secureReturnVector: 'sealed'
                        }
                        : {},
                    endingChoice: null
                }
            },
            world: recoveryPreview
                ? {
                    currentEcology: {
                        restoredRegionIds: [
                            'mythical_forest',
                            'crystal_caves',
                            'stellar_reef',
                            'void_peaks',
                            'aurora_depths',
                            'current_heart'
                        ]
                    },
                    signalGarden: {
                        tendCount: 3,
                        stage: 'bloom'
                    },
                    fendCommunity: {
                        builtProjectIds: [
                            'trailhead_shelter',
                            'current_well',
                            'wayfinder_relay',
                            'living_commons'
                        ]
                    },
                    fendResidents: {
                        metResidentIds: [
                            'kiri',
                            'mara',
                            'tovan',
                            'ilyra'
                        ],
                        completedRequestIds: [
                            'shelter_calibration',
                            'well_return_flow',
                            'relay_three_signals',
                            'commons_witness'
                        ]
                    },
                    guardianResidents: {
                        schemaVersion: 4,
                        rescuedIds: [
                            'elder_treant',
                            'crystal_golem',
                            'nyxvoral',
                            'shadow_phoenix',
                            'cosmic_titan'
                        ],
                        metIds: ['cosmic_titan'],
                        interactions: { cosmic_titan: 2 },
                        acceptedTaskIds: ['cosmic_titan'],
                        completedTaskIds: [],
                        taskBaselines: { cosmic_titan: 0 },
                        activityEvidence: {
                            gardenVisits: 0,
                            campfireRests: 0,
                            targetHits: 3
                        },
                        expeditionHistory: [],
                        pendingExpeditionDebrief: null,
                        activeTeamGuardianId: null
                    },
                    fendCulture: {
                        firstListening: {
                            selectedPriority: 'restoration'
                        }
                    },
                    currentVeilMission: {
                        status: 'complete',
                        stabilizedAnchorIds: [
                            'root_echo',
                            'well_echo',
                            'relay_echo'
                        ]
                    }
                }
                : {},
            hubWorld: {
                shipParts: {
                    collected: recoveryPreview
                        ? projectBeacon.shipSystems.map(system => system.id)
                        : [
                            'forest_core',
                            'crystal_core',
                            'dimensional_drive'
                        ]
                }
            }
        };
        const previewGameState = {
            get(path) {
                return path.split('.').reduce(
                    (value, key) => value?.[key],
                    previewState
                );
            },
            set(path, value) {
                const keys = path.split('.');
                const finalKey = keys.pop();
                const target = keys.reduce((current, key) => {
                    current[key] ||= {};
                    return current[key];
                }, previewState);
                target[finalKey] = value;
            },
            save() {},
            emit() {}
        };

        this.beaconLogModal = new ProjectBeaconLogModal(this, {
            getGameState: () => previewGameState
        });
        this.beaconLogModal.show(
            this.beaconLogPreview === 'memory'
                ? 'mission'
                : this.beaconLogPreview
        );
    }

    createCompanionConsentPreviewSnapshot() {
        const complete = this.companionConsentPreview === 'complete';
        const reviewedTopicIds = complete
            ? COMPANION_BOUNDARY_TOPICS.map(topic => topic.id)
            : [...(this.companionConsentPreviewReviewedIds || [])];
        const topics = COMPANION_BOUNDARY_TOPICS.map(topic => ({
            ...topic,
            reviewed: reviewedTopicIds.includes(topic.id)
        }));
        return {
            record: {
                companionId: 'preview_companion_23',
                travelStatus: complete ||
                    reviewedTopicIds.length === topics.length
                    ? 'decision_deferred'
                    : 'not_yet_asked',
                disclosureStatus: reviewedTopicIds.includes('evidence')
                    ? 'astronaut_survival_only'
                    : 'withheld',
                locationBoundary: reviewedTopicIds.includes('route')
                    ? 'coordinates_withheld'
                    : 'not_discussed',
                informedRisks: complete ||
                    reviewedTopicIds.length === topics.length,
                willingPassenger: null,
                vetoRecognized: true,
                powerBoundary: reviewedTopicIds.includes('power')
                    ? 'emergency_life_first'
                    : 'not_discussed',
                reviewedTopicIds
            },
            unlocked: true,
            ready: !complete && reviewedTopicIds.length < topics.length,
            complete: complete || reviewedTopicIds.length === topics.length,
            reviewedCount: reviewedTopicIds.length,
            totalTopics: topics.length,
            topics,
            nextTopic: topics.find(topic => !topic.reviewed) || null
        };
    }

    createCompanionConsentPreview() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor('#061019');
        const backdrop = this.add.graphics();
        backdrop.fillStyle(0x061019, 1);
        backdrop.fillRect(0, 0, width, height);
        backdrop.fillStyle(0x17252D, 1);
        backdrop.fillRoundedRect(
            width * 0.1,
            height * 0.52,
            width * 0.8,
            height * 0.23,
            12
        );
        backdrop.lineStyle(2, 0x66C7D4, 0.55);
        backdrop.strokeRoundedRect(
            width * 0.1,
            height * 0.52,
            width * 0.8,
            height * 0.23,
            12
        );
        for (let index = 0; index < 32; index++) {
            backdrop.fillStyle(
                index % 4 === 0 ? 0x8FE3CF : 0xDCE8ED,
                0.42
            );
            backdrop.fillCircle(
                (index * 97) % width,
                (index * 53) % Math.max(1, height * 0.48),
                index % 5 === 0 ? 2 : 1
            );
        }
        this.waypointPreviewElements.push(backdrop);

        this.companionConsentPreviewReviewedIds =
            this.companionConsentPreview === 'complete'
                ? COMPANION_BOUNDARY_TOPICS.map(topic => topic.id)
                : [];
        this.companionConsentModal = new CompanionConsentModal(this, {
            snapshotProvider: () => (
                this.createCompanionConsentPreviewSnapshot()
            ),
            onReview: topicId => {
                if (
                    !this.companionConsentPreviewReviewedIds.includes(topicId)
                ) {
                    this.companionConsentPreviewReviewedIds.push(topicId);
                }
                const topic = COMPANION_BOUNDARY_TOPICS.find(
                    entry => entry.id === topicId
                );
                return {
                    changed: true,
                    reason: this.companionConsentPreviewReviewedIds.length ===
                        COMPANION_BOUNDARY_TOPICS.length
                        ? 'boundary_review_complete'
                        : 'boundary_reviewed',
                    topic,
                    snapshot: this.createCompanionConsentPreviewSnapshot()
                };
            },
            onClose: () => {
                this.companionConsentModal = null;
            }
        });
        this.companionConsentModal.show(
            this.companionConsentPreview === 'complete'
                ? 'complete'
                : this.companionConsentPreview === 'menu'
                    ? 'menu'
                    : 'topic',
            COMPANION_BOUNDARY_TOPICS.some(
                topic => topic.id === this.companionConsentPreview
            )
                ? this.companionConsentPreview
                : null
        );
    }

    createCompanionEarthMemoryPreviewSnapshot() {
        const selectedId = this.companionEarthMemoryPreviewSelectedId;
        const selectedMemory = EARTH_MEMORY_DEFINITIONS.find(
            memory => memory.id === selectedId
        ) || null;
        return {
            record: {
                companionId: 'preview_companion_23',
                status: selectedMemory ? 'shared' : 'not_shared',
                selectedMemoryId: selectedMemory?.id || null,
                invitationStatus: 'not_offered',
                travelConsentRecorded: false,
                transmissionStatus: 'not_sent'
            },
            companionId: 'preview_companion_23',
            unlocked: true,
            ready: !selectedMemory,
            complete: Boolean(selectedMemory),
            memories: EARTH_MEMORY_DEFINITIONS,
            selectedMemory,
            companionInitiated: true,
            invitationStatus: 'not_offered',
            travelConsentRecorded: false,
            transmissionStatus: 'not_sent'
        };
    }

    createCompanionEarthMemoryPreview() {
        if (this.companionEarthMemoryPreviewSize === 'mobile') {
            const viewportWidth = Math.min(390, this.scale.width);
            const viewportHeight = Math.min(720, this.scale.height);
            this.cameras.main.setViewport(
                (this.scale.width - viewportWidth) / 2,
                (this.scale.height - viewportHeight) / 2,
                viewportWidth,
                viewportHeight
            );
        }
        const { width, height } = this.cameras.main;
        this.cameras.main.setBackgroundColor('#061019');
        const backdrop = this.add.graphics();
        backdrop.fillStyle(0x061019, 1);
        backdrop.fillRect(0, 0, width, height);
        backdrop.fillStyle(0x17252D, 1);
        backdrop.fillRect(0, height * 0.57, width, height * 0.22);
        for (let index = 0; index < 36; index++) {
            backdrop.fillStyle(
                index % 4 === 0 ? 0x8FE3CF : 0xDCE8ED,
                0.45
            );
            backdrop.fillCircle(
                (index * 89) % width,
                (index * 47) % Math.max(1, height * 0.54),
                index % 6 === 0 ? 2 : 1
            );
        }
        this.waypointPreviewElements.push(backdrop);

        const previewMemoryId = {
            dojo: 'dojo_dawn',
            ocean: 'ocean_after_storm',
            city: 'city_lights',
            shared: 'ocean_after_storm'
        }[this.companionEarthMemoryPreview];
        this.companionEarthMemoryPreviewSelectedId = previewMemoryId || null;
        this.companionEarthMemoryModal = new CompanionEarthMemoryModal(this, {
            snapshotProvider: () => (
                this.createCompanionEarthMemoryPreviewSnapshot()
            ),
            onShare: memoryId => {
                const memory = EARTH_MEMORY_DEFINITIONS.find(
                    entry => entry.id === memoryId
                );
                if (!memory) return null;
                this.companionEarthMemoryPreviewSelectedId = memory.id;
                return {
                    changed: true,
                    reason: 'earth_memory_shared',
                    memory,
                    snapshot: this.createCompanionEarthMemoryPreviewSnapshot()
                };
            },
            onClose: () => {
                this.companionEarthMemoryModal = null;
            }
        });
        this.companionEarthMemoryModal.show(
            previewMemoryId ? 'shared' : 'menu'
        );
    }

    createSenseiMemoryPreviewSnapshot({ recalled = false } = {}) {
        const previewId = {
            footing: 'begin_with_your_footing',
            trust: 'trust_begins_with_how_you_enter',
            restraint: 'power_is_knowing_what_not_to_take',
            confirmed: 'begin_with_your_footing'
        }[this.senseiMemoryPreview];
        const activeMemory = SENSEI_MEMORY_DEFINITIONS.find(
            memory => memory.id === previewId
        ) || SENSEI_MEMORY_DEFINITIONS[0];
        const recalledCount = Math.min(
            SENSEI_MEMORY_DEFINITIONS.length,
            activeMemory.order - 1 + (recalled ? 1 : 0)
        );
        const recalledIds = SENSEI_MEMORY_DEFINITIONS
            .slice(0, recalledCount)
            .map(memory => memory.id);
        const memories = SENSEI_MEMORY_DEFINITIONS.map(memory => ({
            ...memory,
            unlocked: memory.order <= activeMemory.order,
            recalled: recalledIds.includes(memory.id)
        }));

        return {
            memories,
            nextMemory: recalled ? null : activeMemory,
            ready: !recalled,
            complete:
                recalledCount === SENSEI_MEMORY_DEFINITIONS.length,
            recalledCount,
            totalMemories: SENSEI_MEMORY_DEFINITIONS.length,
            lesson: {
                id: 'centering_stance',
                status: recalledCount > 0 ? 'available' : 'locked',
                unlocked: recalledCount > 0,
                durationMs: 1250
            }
        };
    }

    createSenseiMemoryPreview() {
        const { width, height } = this.scale;
        if (this.senseiMemoryPreviewSize === 'mobile') {
            const viewportWidth = Math.min(390, width);
            const viewportHeight = Math.min(720, height);
            this.cameras.main.setViewport(
                (width - viewportWidth) / 2,
                (height - viewportHeight) / 2,
                viewportWidth,
                viewportHeight
            );
        }
        this.cameras.main.setBackgroundColor('#060A0B');
        const backdrop = this.add.graphics();
        backdrop.fillStyle(0x060A0B, 1);
        backdrop.fillRect(0, 0, width, height);
        backdrop.fillStyle(0x111819, 1);
        backdrop.fillRoundedRect(
            width * 0.12,
            height * 0.56,
            width * 0.76,
            height * 0.2,
            8
        );
        backdrop.lineStyle(2, 0xF4F4F4, 0.35);
        backdrop.strokeRoundedRect(
            width * 0.12,
            height * 0.56,
            width * 0.76,
            height * 0.2,
            8
        );
        this.waypointPreviewElements.push(backdrop);

        let previewRecalled = this.senseiMemoryPreview === 'confirmed';
        this.senseiMemoryModal = new SenseiMemoryModal(this, {
            snapshotProvider: () => (
                this.createSenseiMemoryPreviewSnapshot({
                    recalled: previewRecalled
                })
            ),
            onRecall: memoryId => {
                const memory = SENSEI_MEMORY_DEFINITIONS.find(
                    entry => entry.id === memoryId
                );
                previewRecalled = true;
                return {
                    changed: true,
                    reason: memory?.lessonId
                        ? 'lesson_unlocked'
                        : 'memory_recalled',
                    memory,
                    snapshot: this.createSenseiMemoryPreviewSnapshot({
                        recalled: true
                    })
                };
            },
            onClose: () => {
                this.senseiMemoryModal = null;
            }
        });
        const activeMemoryId = {
            footing: 'begin_with_your_footing',
            trust: 'trust_begins_with_how_you_enter',
            restraint: 'power_is_knowing_what_not_to_take',
            confirmed: 'begin_with_your_footing'
        }[this.senseiMemoryPreview];
        this.senseiMemoryModal.show(
            activeMemoryId,
            this.senseiMemoryPreview === 'confirmed'
                ? 'confirmed'
                : 'memory'
        );
    }

    createShipEvidencePreview() {
        const { width, height } = this.scale;
        if (this.shipEvidencePreviewSize === 'mobile') {
            const viewportWidth = Math.min(390, width);
            const viewportHeight = Math.min(720, height);
            this.cameras.main.setViewport(
                (width - viewportWidth) / 2,
                (height - viewportHeight) / 2,
                viewportWidth,
                viewportHeight
            );
        }
        this.cameras.main.setBackgroundColor('#04090B');
        const backdrop = this.add.graphics();
        backdrop.fillStyle(0x04090B, 1);
        backdrop.fillRect(0, 0, width, height);
        backdrop.fillStyle(0x101A20, 1);
        backdrop.fillRect(0, height * 0.58, width, height * 0.42);
        backdrop.lineStyle(2, 0x8FE3CF, 0.32);
        backdrop.lineBetween(0, height * 0.58, width, height * 0.58);
        this.waypointPreviewElements.push(backdrop);

        const reviewedByMode = {
            berth: ['systems', 'evidence', 'boundaries'],
            repair_0: [],
            repair_3: ['systems', 'evidence', 'boundaries'],
            repair_final: ['systems', 'evidence', 'boundaries'],
            repair_complete: ['systems', 'evidence', 'boundaries'],
            systems: [],
            evidence: ['systems'],
            boundaries: ['systems', 'evidence'],
            complete: ['systems', 'evidence', 'boundaries'],
            protocol_0: ['systems', 'evidence', 'boundaries'],
            protocol_3: ['systems', 'evidence', 'boundaries'],
            protocol_complete: ['systems', 'evidence', 'boundaries'],
            handoff: ['systems', 'evidence', 'boundaries']
        };
        const protocolStepsByMode = {
            protocol_0: [],
            protocol_3: [
                'survival_packet',
                'route_quarantine',
                'living_witness_seal'
            ],
            protocol_complete: [
                'survival_packet',
                'route_quarantine',
                'living_witness_seal',
                'uplink_hold'
            ],
            handoff: [
                'survival_packet',
                'route_quarantine',
                'living_witness_seal',
                'uplink_hold'
            ]
        };
        const protocolPreview =
            this.shipEvidencePreview.startsWith('protocol_');
        const reconstructionCompletedByMode = {
            berth: ['living_power_lattice'],
            repair_0: [],
            repair_3: [
                'living_power_lattice',
                'propulsion_control',
                'sealed_return_vector'
            ],
            repair_final: [
                'living_power_lattice',
                'propulsion_control',
                'sealed_return_vector',
                'resonance_hull',
                'uplink_hold'
            ],
            repair_complete: [
                'living_power_lattice',
                'propulsion_control',
                'sealed_return_vector',
                'resonance_hull',
                'uplink_hold',
                'black_box_recovery'
            ],
            handoff: [
                'living_power_lattice',
                'propulsion_control',
                'sealed_return_vector',
                'resonance_hull',
                'uplink_hold',
                'black_box_recovery'
            ]
        };
        const reconstructionPartsByMode = {
            berth: ['forest_core'],
            repair_0: ['forest_core'],
            repair_3: [
                'forest_core',
                'crystal_core',
                'dimensional_drive',
                'hull_plating'
            ],
            repair_final: [
                'forest_core',
                'crystal_core',
                'dimensional_drive',
                'hull_plating',
                'aurora_reactor',
                'command_module'
            ],
            repair_complete: [
                'forest_core',
                'crystal_core',
                'dimensional_drive',
                'hull_plating',
                'aurora_reactor',
                'command_module'
            ],
            handoff: [
                'forest_core',
                'crystal_core',
                'dimensional_drive',
                'hull_plating',
                'aurora_reactor',
                'command_module'
            ]
        };
        const previewState = {
            stats: { levelsCompleted: 3 },
            levels: {
                mythicalForest: { completed: true },
                crystalCaves: { completed: true }
            },
            creature: {
                hatched: true,
                name: 'Aster',
                genes: { id: 'preview_companion_23' },
                stats: this.shipEvidencePreview === 'berth'
                    ? {
                        health: 48,
                        energy: 32,
                        happiness: 84
                    }
                    : {
                        health: 100,
                        energy: 100,
                        happiness: 100
                    },
                agencyHistory: [
                    { type: 'high_power_rescue' }
                ]
            },
            hubWorld: {
                shipParts: {
                    collected:
                        reconstructionPartsByMode[
                            this.shipEvidencePreview
                        ] || [
                            'forest_core',
                            'crystal_core',
                            'dimensional_drive'
                        ]
                }
            },
            world: {
                currentEcology: {
                    schemaVersion: 2,
                    observedSignalIds: ['echo_bloom', 'memory_stone'],
                    restoredRegionIds: [
                        'mythical_forest',
                        'crystal_caves'
                    ],
                    regions: {},
                    history: []
                },
                fendCulture: {
                    schemaVersion: 1,
                    firstListening: {
                        status: 'complete',
                        heldAt: '2026-07-31T00:23:00.000Z',
                        operationId: 'preview_first_listening_23',
                        selectedPriority: 'restoration'
                    },
                    history: []
                }
            },
            story: {
                projectBeacon: {
                    missionLogSeen: true,
                    fieldKit: { recovered: true },
                    sensei: {
                        encryptedContact: {
                            contactAttempted: false,
                            contactEstablished: false
                        }
                    },
                    shipCapabilities: {
                        stealthDescent: 'repaired',
                        secureReturnVector: 'sealed',
                        manualLanding: 'available',
                        blackBoxProof: 'recovered',
                        passengerCapacity: 1,
                        creatureLifeSupport: 'prototype_required',
                        longRangeUplink: 'held_exposure_risk'
                    },
                    shipReconstruction: {
                        schemaVersion: 1,
                        completedStepIds:
                            reconstructionCompletedByMode[
                                this.shipEvidencePreview
                            ] || [],
                        firstInstalledAt: null,
                        completedAt: null,
                        history: []
                    },
                    shipFieldSupport: {
                        schemaVersion: 1,
                        lastServicedLevel: 0,
                        serviceCount: 0,
                        lastServicedAt: null,
                        history: []
                    },
                    shipArchive: {
                        schemaVersion: 1,
                        reviewedSectionIds: [
                            ...reviewedByMode[this.shipEvidencePreview]
                        ],
                        firstReviewedAt: null,
                        completedAt: null,
                        history: []
                    },
                    protectedReturnProtocol: {
                        schemaVersion: 1,
                        completedStepIds:
                            protocolStepsByMode[
                                this.shipEvidencePreview
                            ] || [],
                        packetStatus: 'not_prepared',
                        transmissionStatus: 'not_sent',
                        firstAppliedAt: null,
                        completedAt: null,
                        history: []
                    },
                    companionConsent: {
                        schemaVersion: 2,
                        activeCompanionId: 'preview_companion_23',
                        records: protocolPreview
                            ? [{
                                companionId: 'preview_companion_23',
                                travelStatus: 'decision_deferred',
                                disclosureStatus:
                                    'astronaut_survival_only',
                                locationBoundary:
                                    'coordinates_withheld',
                                informedRisks: true,
                                willingPassenger: null,
                                vetoRecognized: true,
                                powerBoundary:
                                    'emergency_life_first',
                                reviewedTopicIds: [
                                    'route',
                                    'evidence',
                                    'power'
                                ],
                                history: [],
                                recordedAt:
                                    '2026-07-31T00:23:00.000Z',
                                lastReviewedAt:
                                    '2026-07-31T00:23:00.000Z'
                            }]
                            : []
                    }
                }
            }
        };
        const previewGameState = {
            get(path) {
                return path.split('.').reduce(
                    (value, key) => value?.[key],
                    previewState
                );
            },
            set(path, value) {
                const keys = path.split('.');
                const finalKey = keys.pop();
                const parent = keys.reduce((target, key) => {
                    target[key] = target[key] || {};
                    return target[key];
                }, previewState);
                parent[finalKey] = value;
            },
            save() {}
        };

        this.shipEvidenceBoardModal = new ShipEvidenceBoardModal(this, {
            snapshotProvider: () => (
                getShipEvidenceSnapshot(previewGameState)
            ),
            onReview: sectionId => (
                recordShipEvidenceSection(
                    previewGameState,
                    sectionId,
                    { save: false }
                )
            ),
            reconstructionSnapshotProvider: () => (
                getShipReconstructionSnapshot(previewGameState)
            ),
            onReconstructionStep: stepId => (
                installShipReconstructionStep(
                    previewGameState,
                    stepId,
                    { save: false }
                )
            ),
            onCompanionService: () => (
                serviceCompanionAtPoweredBerth(
                    previewGameState,
                    { save: false }
                )
            ),
            protocolSnapshotProvider: () => (
                getProtectedReturnSnapshot(previewGameState)
            ),
            handoffSnapshotProvider: () => (
                this.shipEvidencePreview === 'handoff'
                    ? {
                        available: true,
                        readyForHomecoming: false,
                        completedCount: 5,
                        totalRequirements: 6,
                        rows: [
                            {
                                id: 'companion_continuity',
                                label: 'COMPANION CONTINUITY',
                                status: 'VERIFIED',
                                tone: 'protected',
                                detail:
                                    'Aster\'s identity, lineage, bond, and powers are portable.'
                            },
                            {
                                id: 'living_world_record',
                                label: 'LIVING WORLD RECORD',
                                status: 'VERIFIED',
                                tone: 'protected',
                                detail:
                                    'All six living regions and their Current history are preserved.'
                            },
                            {
                                id: 'earth_equipment',
                                label: 'EARTH EQUIPMENT',
                                status: 'VERIFIED',
                                tone: 'protected',
                                detail:
                                    'The Earth-forged katana and five recovered ship systems are recorded.'
                            },
                            {
                                id: 'remain_and_defend',
                                label: 'REMAIN AND DEFEND',
                                status: 'VERIFIED',
                                tone: 'protected',
                                detail:
                                    'The Fend recovery chapter is complete before any Earth return.'
                            },
                            {
                                id: 'protected_return',
                                label: 'PROTECTED RETURN',
                                status: 'PENDING',
                                tone: 'pending',
                                detail:
                                    'Repair concealed descent before a secret Earth landing can be safe.'
                            },
                            {
                                id: 'consent_and_contact',
                                label: 'CONSENT & SENSEI SEED',
                                status: 'VERIFIED',
                                tone: 'protected',
                                detail:
                                    'The companion keeps veto power and the unused Sensei route is recoverable.'
                            }
                        ]
                    }
                    : getHomecomingHandoffSnapshot(
                        previewGameState
                    )
            ),
            onProtocolStep: stepId => (
                applyProtectedReturnStep(
                    previewGameState,
                    stepId,
                    { save: false }
                )
            ),
            onClose: () => {
                this.shipEvidenceBoardModal = null;
            }
        });
        this.shipEvidenceBoardModal.show(
            this.shipEvidencePreview === 'handoff'
                ? 'handoff'
            : this.shipEvidencePreview === 'berth'
                ? 'reconstruction'
            : this.shipEvidencePreview.startsWith('repair_')
                ? 'reconstruction'
            : protocolPreview
                ? 'protocol'
                : this.shipEvidencePreview === 'complete'
                ? 'boundaries'
                : this.shipEvidencePreview
        );
    }

    createCurrentVeilPreview() {
        const { width, height } = this.scale;
        if (this.currentVeilPreviewSize === 'mobile') {
            const viewportWidth = Math.min(390, width);
            const viewportHeight = Math.min(720, height);
            this.cameras.main.setViewport(
                (width - viewportWidth) / 2,
                (height - viewportHeight) / 2,
                viewportWidth,
                viewportHeight
            );
        }
        this.cameras.main.setBackgroundColor('#04090B');
        const backdrop = this.add.graphics();
        backdrop.fillStyle(0x04090B, 1);
        backdrop.fillRect(0, 0, width, height);
        backdrop.fillStyle(0x10231F, 1);
        backdrop.fillRect(0, height * 0.62, width, height * 0.38);
        backdrop.lineStyle(2, 0x71E6B1, 0.34);
        backdrop.lineBetween(
            0,
            height * 0.62,
            width,
            height * 0.62
        );
        this.waypointPreviewElements.push(backdrop);

        const stabilizedByMode = {
            available: [],
            active: ['root_echo'],
            verification: [
                'root_echo',
                'well_echo',
                'relay_echo'
            ],
            complete: [
                'root_echo',
                'well_echo',
                'relay_echo'
            ]
        };
        const statusByMode = {
            available: 'not_started',
            active: 'active',
            verification: 'verification_ready',
            complete: 'complete'
        };
        const previewState = {
            creature: {
                hatched: true,
                name: 'Aster',
                genes: { id: 'preview_companion_23' }
            },
            stats: { levelsCompleted: 6 },
            world: {
                signalGarden: {
                    stage: 'bloom',
                    tendCount: 4
                },
                livingSignals: {
                    observedIds: [
                        'echo_bloom',
                        'memory_stone',
                        'rootlight'
                    ]
                },
                currentEcology: {
                    schemaVersion: 2,
                    observedSignalIds: [
                        'echo_bloom',
                        'memory_stone',
                        'rootlight'
                    ],
                    restoredRegionIds: [
                        'mythical_forest',
                        'crystal_caves'
                    ],
                    regions: {},
                    history: []
                },
                fendCommunity: {
                    schemaVersion: 1,
                    builtProjectIds: FEND_COMMUNITY_PROJECTS.map(
                        project => project.id
                    ),
                    contributionHistory: [],
                    foundedAt: '2026-07-31T00:23:00.000Z',
                    lastContributionAt:
                        '2026-07-31T00:23:00.000Z'
                },
                fendResidents: {
                    schemaVersion: 1,
                    metResidentIds: FEND_RESIDENT_DEFINITIONS.map(
                        resident => resident.id
                    ),
                    activeRequestId: null,
                    activeRequestBaseline: null,
                    completedRequestIds:
                        FEND_RESIDENT_DEFINITIONS.map(
                            resident => resident.request.id
                        ),
                    history: [],
                    firstMetAt:
                        '2026-07-31T00:23:00.000Z',
                    lastInteractionAt:
                        '2026-07-31T00:23:00.000Z'
                },
                fendCulture: {
                    schemaVersion: 1,
                    firstListening: {
                        status: 'complete',
                        heldAt: '2026-07-31T00:23:00.000Z',
                        operationId:
                            'preview_first_listening_23',
                        selectedPriority:
                            FEND_COMMONS_PRIORITIES[0].id
                    },
                    history: []
                },
                currentVeilMission: {
                    schemaVersion: 1,
                    status: statusByMode[
                        this.currentVeilPreview
                    ],
                    stabilizedAnchorIds: [
                        ...stabilizedByMode[
                            this.currentVeilPreview
                        ]
                    ],
                    maskStatus: 'inactive',
                    transmissionStatus: 'not_sent',
                    startedAt:
                        this.currentVeilPreview === 'available'
                            ? null
                            : '2026-07-31T01:23:00.000Z',
                    completedAt:
                        this.currentVeilPreview === 'complete'
                            ? '2026-07-31T01:27:00.000Z'
                            : null,
                    history: []
                }
            },
            story: {
                projectBeacon: {
                    fieldKit: { recovered: true },
                    finale: {
                        priority: 'remain_and_defend'
                    },
                    shipCapabilities: {
                        stealthDescent: 'repaired',
                        secureReturnVector: 'sealed',
                        manualLanding: 'available',
                        blackBoxProof: 'recovered',
                        passengerCapacity: 1,
                        creatureLifeSupport:
                            'prototype_required',
                        longRangeUplink:
                            'held_exposure_risk'
                    },
                    shipArchive: {
                        schemaVersion: 1,
                        reviewedSectionIds: [
                            'systems',
                            'evidence',
                            'boundaries'
                        ],
                        history: []
                    },
                    protectedReturnProtocol: {
                        schemaVersion: 1,
                        completedStepIds: [
                            'survival_packet',
                            'route_quarantine',
                            'living_witness_seal',
                            'uplink_hold'
                        ],
                        packetStatus:
                            'sealed_ready_not_sent',
                        transmissionStatus: 'not_sent',
                        history: []
                    },
                    companionConsent: {
                        schemaVersion: 2,
                        activeCompanionId:
                            'preview_companion_23',
                        records: [{
                            companionId:
                                'preview_companion_23',
                            travelStatus:
                                'decision_deferred',
                            disclosureStatus:
                                'astronaut_survival_only',
                            locationBoundary:
                                'coordinates_withheld',
                            informedRisks: true,
                            willingPassenger: null,
                            vetoRecognized: true,
                            powerBoundary:
                                'emergency_life_first',
                            reviewedTopicIds: [
                                'route',
                                'evidence',
                                'power'
                            ],
                            history: []
                        }]
                    }
                }
            }
        };
        const previewGameState = {
            get(path) {
                return path.split('.').reduce(
                    (value, key) => value?.[key],
                    previewState
                );
            },
            set(path, value) {
                const keys = path.split('.');
                const finalKey = keys.pop();
                const parent = keys.reduce((target, key) => {
                    target[key] = target[key] || {};
                    return target[key];
                }, previewState);
                parent[finalKey] = value;
            },
            save() {},
            emit() {}
        };

        if (
            this.currentVeilPreview !== 'available' &&
            this.currentVeilPreviewSize !== 'mobile'
        ) {
            const gardenX = width / 2 - 150;
            const gardenY = height / 2;
            const gardenBase = this.add.graphics()
                .setDepth(gardenY - 3);
            gardenBase.fillStyle(0x142D2A, 0.96);
            gardenBase.fillRoundedRect(
                gardenX - 86,
                gardenY - 38,
                172,
                76,
                22
            );
            gardenBase.lineStyle(3, 0x71E6B1, 0.72);
            gardenBase.strokeRoundedRect(
                gardenX - 86,
                gardenY - 38,
                172,
                76,
                22
            );
            const gardenZone = this.add.zone(
                gardenX,
                gardenY,
                180,
                140
            );
            this.physics.add.existing(gardenZone, true);
            gardenZone.setDepth(gardenY);
            this.signalGarden = {
                zone: gardenZone,
                currentVeilAnchors: [],
                currentVeilNetwork: null
            };
            this.worldBuilder = new WorldBuilder(this, null, {
                worldWidth: width,
                worldHeight: height
            });
            this.worldBuilder.refreshCurrentVeilMission(
                this.signalGarden,
                getCurrentVeilSnapshot(previewGameState)
            );
            this.waypointPreviewElements.push(
                gardenBase,
                gardenZone
            );
        }

        this.currentVeilModal = new CurrentVeilModal(this, {
            snapshotProvider: () => (
                getCurrentVeilSnapshot(previewGameState)
            ),
            onStart: () => (
                startCurrentVeilMission(
                    previewGameState,
                    { save: false }
                )
            ),
            onClose: () => {
                this.currentVeilModal = null;
            }
        });
        this.currentVeilModal.show();
    }

    createSettingsPreview() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor('#061019');

        const backdrop = this.add.graphics();
        backdrop.fillStyle(0x061019, 1);
        backdrop.fillRect(0, 0, width, height);
        backdrop.fillStyle(0x133038, 1);
        backdrop.fillRect(0, height * 0.7, width, height * 0.3);

        const previewVolumes = {
            master: 0.8,
            music: 0.6,
            sfx: 0.7
        };
        const previewAudio = {
            muted: false,
            getVolumes: () => ({ ...previewVolumes }),
            isMuted() {
                return this.muted;
            },
            toggleMute() {
                this.muted = !this.muted;
                return this.muted;
            },
            setMasterVolume(value) {
                previewVolumes.master = value;
            },
            setMusicVolume(value) {
                previewVolumes.music = value;
            },
            setSFXVolume(value) {
                previewVolumes.sfx = value;
            }
        };
        const previewFeedback = {
            screenShakeEnabled: true,
            hapticEnabled: true,
            reducedMotionEnabled: false,
            getSettings() {
                return {
                    screenShakeEnabled: this.screenShakeEnabled,
                    hapticEnabled: this.hapticEnabled,
                    hapticSupported: true,
                    reducedMotionEnabled: this.reducedMotionEnabled
                };
            },
            toggleScreenShake() {
                this.screenShakeEnabled = !this.screenShakeEnabled;
            },
            toggleHaptic() {
                this.hapticEnabled = !this.hapticEnabled;
            },
            toggleReducedMotion() {
                this.reducedMotionEnabled = !this.reducedMotionEnabled;
            }
        };

        this.settingsModal = new SettingsModal(this, {
            getAudioManager: () => previewAudio,
            getFeedbackManager: () => previewFeedback
        });
        this.settingsModal.show();
    }

    createMissionBriefingPreview() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor('#071017');

        const backdrop = this.add.graphics();
        backdrop.fillStyle(0x071017, 1);
        backdrop.fillRect(0, 0, width, height);
        backdrop.fillStyle(0x19363A, 1);
        backdrop.fillRect(0, height * 0.62, width, height * 0.38);
        backdrop.fillStyle(0x244E47, 0.75);
        for (let x = 20; x < width; x += 95) {
            backdrop.fillCircle(x, height * 0.66 + ((x / 95) % 2) * 26, 18);
        }

        const missionIds = {
            care: 'beacon_first_contact',
            fieldKit: 'beacon_field_kit',
            signals: 'beacon_living_signals',
            gate: 'beacon_world_gate'
        };
        const missionId = missionIds[this.missionBriefingPreview] || missionIds.care;
        const mission = projectBeacon.fieldMissions.find(({ id }) => id === missionId);

        this.questTracker = new QuestTracker(this);
        this.questTracker.showStoryMissionBriefing({
            ...mission,
            questId: mission.id,
            progress: 0,
            completed: false,
            claimed: false
        }, {
            forceMobile: this.missionBriefingPreviewSize === 'mobile'
        });
        this.waypointPreviewElements.push(backdrop);
    }

    initializeLifecycleTracking() {
        this._isShuttingDown = false;
        this._sceneLifecycleRegistered = false;
        this.gameStateUnsubscribers = [];
        this.enemyManagerListeners = [];
        this.virtualJoystickHandler = null;
        this.virtualKeyHandler = null;
        this.joystickX = 0;
        this.joystickY = 0;
        this.lastPositionPersistedAt = Number.NEGATIVE_INFINITY;
        this.isShowingTutorial = false;
        this.welcomeToastDisplayed = false;
        this.combatCooldown = 0;
        this.floatingParticles = [];
        this.statBars = [];
        this.statBarGraphics = null;
        this.cosmicMiniMap = null;
        this.miniMapPlayerDot = null;

        if (this.kidModeActionHandler && this.events?.off) {
            this.events.off('kid_mode_action', this.kidModeActionHandler, this);
        }
        this.kidModeActionHandler = null;

        // Creature intelligence integrations
        this.spaceWeatherHandler = null;
        this.lastSpaceWeatherCheck = 0;
        this.currentTimeOfDay = null;
    }

    /**
     * Set up creature intelligence integrations
     * Connects CreatureAnimationController with:
     * - ThoughtBubbleSystem for visual thoughts
     * - SpaceWeatherSystem for NASA weather reactions
     * - Time-of-day awareness
     * - Game event reactions
     */
    setupCreatureIntelligence() {
        if (!this.creatureAnimationController) {
            console.warn('[GameScene] Cannot setup creature intelligence - no animation controller');
            return;
        }

        console.log('[GameScene] Setting up creature intelligence integrations');

        // 1. Set up thought bubble handler
        if (window.ThoughtBubbleSystem) {
            window.ThoughtBubbleSystem.initialize();

            this.creatureAnimationController.setThoughtBubbleHandler((thoughtType, context) => {
                if (this.player && !this._isShuttingDown) {
                    window.ThoughtBubbleSystem.showThoughtBubble(
                        this,
                        this.player,
                        thoughtType,
                        context,
                        { duration: 4000 }
                    );
                }
            });

            console.log('[GameScene] ThoughtBubbleSystem connected');
        }

        // 2. Set up space weather reactions
        if (window.SpaceWeatherSystem) {
            this.spaceWeatherHandler = (weatherData) => {
                if (this.creatureAnimationController && !this._isShuttingDown) {
                    this.creatureAnimationController.reactToSpaceWeather(weatherData);

                    // Also apply visual effects
                    this.applySpaceWeatherVisuals(weatherData);
                }
            };

            window.SpaceWeatherSystem.on('weatherUpdated', this.spaceWeatherHandler);

            // Apply current weather immediately
            const currentWeather = window.SpaceWeatherSystem.getWeather();
            if (currentWeather) {
                this.applySpaceWeatherVisuals(currentWeather);
            }

            console.log('[GameScene] SpaceWeatherSystem connected');
        }

        // 3. Set up time-of-day awareness
        this.setupTimeOfDayAwareness();

        // 4. Listen for game state events that should trigger creature reactions
        this.setupCreatureEventListeners();

        console.log('[GameScene] Creature intelligence setup complete');
    }

    /**
     * Apply visual effects based on space weather
     */
    applySpaceWeatherVisuals(weatherData) {
        if (!weatherData || this._isShuttingDown) return;

        // Aurora effect
        if (weatherData.auroraActive && window.FXLibrary) {
            // Only create aurora if we don't have one
            if (!this.activeAuroraEffect) {
                this.activeAuroraEffect = window.FXLibrary.createAurora(
                    this,
                    weatherData.auroraIntensity,
                    { colors: [0x00FF88, 0x88FF00, 0x00FFCC] }
                );
                console.log('[GameScene] Aurora effect activated, intensity:', weatherData.auroraIntensity);
            }
        } else if (this.activeAuroraEffect) {
            this.activeAuroraEffect.destroy();
            this.activeAuroraEffect = null;
        }

        // Sky tint for solar activity
        if (weatherData.skyTint && window.FXLibrary) {
            if (!this.activeSkyTint) {
                const tintAlpha = weatherData.solarActivity === 'intense' ? 0.2 : 0.12;
                this.activeSkyTint = window.FXLibrary.createSkyTint(this, weatherData.skyTint, tintAlpha);
                console.log('[GameScene] Sky tint activated');
            }
        } else if (this.activeSkyTint) {
            this.activeSkyTint.destroy();
            this.activeSkyTint = null;
        }
    }

    /**
     * Set up time-of-day awareness for creature reactions
     */
    setupTimeOfDayAwareness() {
        // Check time of day every 5 minutes
        this.time.addEvent({
            delay: 5 * 60 * 1000,
            callback: () => this.checkTimeOfDay(),
            loop: true
        });

        // Initial check
        this.checkTimeOfDay();
    }

    /**
     * Check current time of day and notify creature
     */
    checkTimeOfDay() {
        const hour = new Date().getHours();
        let timeOfDay;

        if (hour >= 5 && hour < 12) {
            timeOfDay = 'morning';
        } else if (hour >= 12 && hour < 17) {
            timeOfDay = 'day';
        } else if (hour >= 17 && hour < 21) {
            timeOfDay = 'evening';
        } else {
            timeOfDay = 'night';
        }

        // Only notify if time changed
        if (timeOfDay !== this.currentTimeOfDay) {
            this.currentTimeOfDay = timeOfDay;

            if (this.creatureAnimationController) {
                this.creatureAnimationController.reactToTimeOfDay(timeOfDay);
            }
        }
    }

    /**
     * Set up listeners for game events that should trigger creature reactions
     */
    setupCreatureEventListeners() {
        // Listen for stat changes
        if (window.GameState) {
            const happinessHandler = (happiness) => {
                if (happiness > 85 && this.creatureAnimationController) {
                    this.creatureAnimationController.setEmotion('happy', 0.8);
                } else if (happiness < 30 && this.creatureAnimationController) {
                    this.creatureAnimationController.setEmotion('shy', 0.6);
                }
            };

            window.GameState.on('changed:creature.stats.happiness', happinessHandler);

            // Store for cleanup
            this.gameStateUnsubscribers.push(() => {
                window.GameState?.off('changed:creature.stats.happiness', happinessHandler);
            });
        }
    }

    setupSanctuaryDecorationListener() {
        if (
            this.currentBiome !== 'nebula' ||
            !this.worldBuilder ||
            !window.InventoryManager
        ) {
            return;
        }

        const placementHandler = ({ item, count }) => {
            if (
                this._isShuttingDown ||
                item?.id !== 'void_crystal'
            ) {
                return;
            }

            this.sanctuaryKeepsakes = this.worldBuilder.refreshSanctuaryKeepsakes(
                this.sanctuaryKeepsakes,
                count
            );
        };

        window.InventoryManager.on('utilityUsed', placementHandler, this);
        this.gameStateUnsubscribers.push(() => {
            window.InventoryManager?.off('utilityUsed', placementHandler, this);
        });
    }

    trackWorldArrival() {
        const realmId = this.currentBiome === 'nebula'
            ? 'main'
            : this.currentBiome;
        getGameState().visitArea?.(`realm:${realmId}`);
        this.trackSanctuaryZoneVisit();
    }

    trackSanctuaryZoneVisit() {
        if (
            this.currentBiome !== 'nebula' ||
            !this.player ||
            !this.sanctuaryZones?.getZoneAt
        ) {
            return;
        }

        const zone = this.sanctuaryZones.getZoneAt(this.player.x, this.player.y);
        if (!zone || zone.id === this.currentSanctuaryZoneId) {
            return;
        }

        this.currentSanctuaryZoneId = zone.id;
        getGameState().visitArea?.(`sanctuary:${zone.id}`);
        this.worldBuilder?.setSanctuaryDistrictFocus?.(
            this.sanctuaryDistricts,
            zone.id
        );
    }

    createSanctuaryDecorationPreview() {
        const camera = this.cameras.main;
        camera.setBackgroundColor('#102329');
        camera.setBounds(0, 0, this.worldWidth, this.worldHeight);
        camera.centerOn(1100, 1045);
        camera.setZoom(Math.min(camera.width / 700, camera.height / 560));

        const ground = this.add.graphics();
        ground.fillStyle(0x102329, 1);
        ground.fillRect(700, 690, 800, 700);
        ground.fillStyle(0x193B3B, 1);
        ground.fillEllipse(1100, 1050, 620, 410);
        ground.lineStyle(4, 0x44746E, 0.65);
        ground.strokeEllipse(1100, 1050, 620, 410);
        ground.setDepth(680);

        const fire = this.add.graphics().setPosition(1100, 950);
        fire.fillStyle(0x27363C, 1);
        fire.fillEllipse(0, 22, 92, 32);
        fire.fillStyle(0xF2C86B, 1);
        fire.fillTriangle(-24, 18, 0, -55, 24, 18);
        fire.fillStyle(0xFF8A5B, 1);
        fire.fillTriangle(-13, 17, 0, -32, 13, 17);
        fire.setDepth(951);

        this.worldBuilder = new WorldBuilder(this, null, {
            worldWidth: this.worldWidth,
            worldHeight: this.worldHeight
        });
        this.sanctuaryKeepsakes = this.worldBuilder.createSanctuaryKeepsakes(
            this.sanctuaryDecorationPreview
        );

        this.add.text(1100, 800, 'SANCTUARY KEEPSAKES', {
            fontSize: camera.width < 600 ? '20px' : '26px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold',
            stroke: '#081514',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(2000);
    }

    createKinshipBeaconPreview() {
        const camera = this.cameras.main;
        const isShared = this.kinshipBeaconPreview === 'shared';
        camera.setBackgroundColor('#102329');
        camera.setBounds(0, 0, this.worldWidth, this.worldHeight);
        camera.centerOn(520, 1015);
        camera.setZoom(Math.min(camera.width / 700, camera.height / 560));

        const ground = this.add.graphics();
        ground.fillStyle(0x102329, 1);
        ground.fillRect(100, 680, 850, 700);
        ground.fillStyle(0x193B3B, 1);
        ground.fillEllipse(520, 1040, 620, 410);
        ground.lineStyle(4, 0x44746E, 0.65);
        ground.strokeEllipse(520, 1040, 620, 410);
        ground.setDepth(680);

        this.worldBuilder = new WorldBuilder(this, null, {
            worldWidth: this.worldWidth,
            worldHeight: this.worldHeight
        });
        this.kinshipBeacon = this.worldBuilder.createKinshipBeacon({
            schemaVersion: 2,
            unlocked: true,
            lineageCount: isShared ? 2 : 1,
            sharedLineageCount: isShared ? 1 : 0
        });

        this.add.text(
            520,
            800,
            isShared
                ? 'SHARED LINEAGE // TWO SANCTUARIES'
                : 'FIRST LINEAGE // SANCTUARY RECORD',
            {
            fontSize: camera.width < 600 ? '19px' : '25px',
            fontFamily: 'Arial, sans-serif',
            color: '#F4F4F4',
            fontStyle: 'bold',
            stroke: '#081514',
            strokeThickness: 5
            }
        ).setOrigin(0.5).setDepth(2000);
    }

    createFusionLandmarkPreview() {
        const camera = this.cameras.main;
        const state = this.fusionLandmarkPreview;
        const x = 1200;
        const y = 900;
        const snapshots = {
            dormant: {
                state: 'dormant',
                tone: 'dormant',
                statusLabel: 'TWO LIVING SIGNALS REQUIRED'
            },
            calibrating: {
                state: 'calibrating',
                tone: 'calibrating',
                statusLabel: 'FIELD CALIBRATION 3/5'
            },
            maturing: {
                state: 'maturing',
                tone: 'calibrating',
                statusLabel: 'ADULT SIGNALS 1/2'
            },
            ready: {
                state: 'ready',
                tone: 'ready',
                statusLabel: 'TWO ADULT SIGNALS READY'
            }
        };

        camera.setBackgroundColor('#102329');
        camera.setBounds(0, 0, this.worldWidth, this.worldHeight);
        camera.centerOn(x, y);
        camera.setZoom(Math.min(camera.width / 700, camera.height / 560));

        const ground = this.add.graphics();
        ground.fillStyle(0x102329, 1);
        ground.fillRect(x - 430, y - 350, 860, 700);
        ground.fillStyle(0x193B3B, 1);
        ground.fillEllipse(x, y + 28, 610, 365);
        ground.lineStyle(4, 0x44746E, 0.65);
        ground.strokeEllipse(x, y + 28, 610, 365);
        ground.setDepth(y - 300);

        this.worldBuilder = new WorldBuilder(this, null, {
            worldWidth: this.worldWidth,
            worldHeight: this.worldHeight
        });
        this.fusionPodLandmark =
            this.worldBuilder.createFusionPodLandmark(
                {
                    position: { x, y },
                    size: { width: 150, height: 150 },
                    interactable: true,
                    interactRadius: 118,
                    name: 'Fusion Pod',
                    onInteract: 'openFusionPod'
                },
                snapshots[state]
            );

        const figure = (offsetX, color) => {
            const companion = this.add.graphics()
                .setPosition(x + offsetX, y + 38)
                .setDepth(y + 3);
            companion.fillStyle(0x101616, 0.95);
            companion.fillEllipse(0, 24, 42, 14);
            companion.fillStyle(color, 1);
            companion.fillRoundedRect(-14, -4, 28, 32, 9);
            companion.fillStyle(0xF4F4F4, 1);
            companion.fillCircle(0, -14, 16);
            companion.fillStyle(0x101616, 1);
            companion.fillCircle(-5, -15, 3);
            companion.fillCircle(5, -15, 3);
            return companion;
        };
        figure(-118, 0xC73A3A);
        if (state !== 'dormant') {
            figure(118, 0x3FAE62);
        }

        this.add.text(
            x,
            y - 170,
            'FEND CURRENT ARCHIVE // FUSION POD',
            {
                fontSize: camera.width < 600 ? '18px' : '24px',
                fontFamily: 'Arial, sans-serif',
                color: '#F4F4F4',
                fontStyle: 'bold',
                stroke: '#081514',
                strokeThickness: 5
            }
        ).setOrigin(0.5).setDepth(2000);
        this.add.text(
            x,
            y - 135,
            snapshots[state].statusLabel,
            {
                fontSize: '13px',
                fontFamily: 'Arial, sans-serif',
                color: state === 'ready' ? '#71E6B1' : '#F2C14E',
                fontStyle: 'bold',
                stroke: '#081514',
                strokeThickness: 4
            }
        ).setOrigin(0.5).setDepth(2000);
    }

    createFusionStoryPreview() {
        const camera = this.cameras.main;
        if (this.fusionStoryPreviewSize === 'mobile') {
            const viewportWidth = Math.min(390, this.scale.width);
            const viewportHeight = Math.min(720, this.scale.height);
            camera.setViewport(
                (this.scale.width - viewportWidth) / 2,
                (this.scale.height - viewportHeight) / 2,
                viewportWidth,
                viewportHeight
            );
        }
        const { width, height } = camera;
        camera.setBackgroundColor('#071514');
        const backdrop = this.add.graphics();
        backdrop.fillStyle(0x071514, 1);
        backdrop.fillRect(0, 0, width, height);
        backdrop.fillStyle(0x153A34, 1);
        backdrop.fillRect(0, height * 0.68, width, height * 0.32);
        backdrop.lineStyle(2, 0x71E6B1, 0.28);
        for (let x = -height; x < width; x += 70) {
            backdrop.lineBetween(x, height, x + height * 0.3, height * 0.68);
        }

        this.showBreedingUnlockTutorial({
            preview: true,
            creatures: [
                { id: 'preview_alpha', name: 'Luma' },
                { id: 'preview_beta', name: 'Sola' }
            ],
            discovery: {
                state: 'two_signals',
                introductionAcknowledged: false
            }
        });
    }

    /**
     * Notify creature of game events (call from other systems)
     * @param {string} eventType - 'level_complete', 'level_failed', 'boss_defeated', etc.
     * @param {Object} eventData - Event-specific data
     */
    notifyCreatureOfEvent(eventType, eventData = {}) {
        if (this.creatureAnimationController && !this._isShuttingDown) {
            this.creatureAnimationController.reactToGameEvent(eventType, eventData);
        }
    }

    registerSceneLifecycleEvents() {
        if (!this.events || this._sceneLifecycleRegistered) {
            return;
        }

        if (typeof Phaser !== 'undefined' && Phaser?.Scenes?.Events) {
            this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
            this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);
            this.events.on(Phaser.Scenes.Events.RESUME, this.handleSceneResume, this);
        }

        this._sceneLifecycleRegistered = true;
    }

    handleSceneResume() {
        this.joystickX = 0;
        this.joystickY = 0;
        this.player?.setVelocity?.(0, 0);
        this.physics?.resume?.();

        if (this.input) {
            this.input.enabled = true;
        }
        if (this.input?.keyboard) {
            this.input.keyboard.enabled = true;
            this.input.keyboard.resetKeys?.();
        }

        window.UXEnhancements?.hideLoading?.();

        if (this.mapRecoveryPreview && this.mapRecoveryStatusText) {
            this.mapRecoveryStatusText
                .setText('MAP CONTROL RESTORED')
                .setColor('#8FE3CF');
            this.tweens?.add?.({
                targets: this.mapRecoveryActors,
                x: '+=64',
                duration: 450,
                ease: 'Sine.easeOut'
            });
        }
    }

    createMapRecoveryPreview() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor('#071017');

        const backdrop = this.add.graphics();
        backdrop.fillStyle(0x071017, 1);
        backdrop.fillRect(0, 0, width, height);
        backdrop.fillStyle(0x173B3B, 1);
        backdrop.fillRect(0, height * 0.65, width, height * 0.35);

        for (let x = 30; x < width; x += 90) {
            backdrop.fillStyle(x % 180 === 30 ? 0x8FE3CF : 0xBFA6FF, 0.45);
            backdrop.fillCircle(x, height * 0.62 + (x % 3) * 8, 12);
        }

        const astronaut = this.add.text(width * 0.43, height * 0.57, '🧑‍🚀', {
            fontSize: width < 600 ? '42px' : '58px'
        }).setOrigin(0.5).setDepth(5);
        const companion = this.add.text(width * 0.55, height * 0.58, '✨', {
            fontSize: width < 600 ? '34px' : '46px',
            color: '#BFA6FF'
        }).setOrigin(0.5).setDepth(5);

        this.mapRecoveryActors = [astronaut, companion];
        this.player = { setVelocity: () => {} };

        this.add.text(width / 2, height * 0.16, 'SHOP RETURN CHECK', {
            fontSize: width < 600 ? '20px' : '28px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(6);

        this.mapRecoveryStatusText = this.add.text(
            width / 2,
            height * 0.24,
            'OPENING SHOP...',
            {
                fontSize: width < 600 ? '14px' : '18px',
                color: '#F2C14E',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setDepth(6);

        this.time.delayedCall(350, () => {
            this.sceneRouter.pauseAndLaunchScene('ShopScene', {
                initialCategory: 'utilities'
            }, {
                loadingMessage: 'Opening Cosmic Shop...'
            });
        });
    }

    createInteractionPromptPreview() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor('#08141B');

        const backdrop = this.add.graphics();
        backdrop.fillStyle(0x08141B, 1);
        backdrop.fillRect(0, 0, width, height);
        backdrop.fillStyle(0x173A3C, 0.8);
        backdrop.fillRect(0, height * 0.58, width, height * 0.42);
        backdrop.setDepth(-10);

        if (window.MobileControls) {
            this.mobileControls = new window.MobileControls(this);
            this.mobileControls.show(true);
        }
        this.getHudController().createInteractionPrompt(width, height);
        this.showInteractionHint(
            'Press SPACE to visit the Cozy Cosmic Boutique'
        );
    }

    setupCamera() {
        const camera = this.cameras?.main;

        if (!camera) {
            console.warn('[GameScene] Camera not ready yet, skipping setup');
            return;
        }

        if (this.player) {
            camera.startFollow(this.player, true, 0.12, 0.12);
            camera.setDeadzone(
                Math.round(camera.width * 0.15),
                Math.round(camera.height * 0.2)
            );
        }

        const responsiveManager = window.responsiveManager;
        const isMobile = responsiveManager?.isMobile ?? window.innerWidth < 768;
        const controlDockVisible = Boolean(this.forceMobileControls);
        const zoom = isMobile || controlDockVisible ? 0.85 : 1.0;

        camera.setZoom(zoom);
        this.applyMobileCameraBounds(camera, isMobile, zoom, controlDockVisible);
        camera.setRoundPixels(true);
        camera.setBackgroundColor('#050214');

        this.currentCameraZoom = zoom;

        if (!this.mobileCameraResizeHandler) {
            this.mobileCameraResizeHandler = () => {
                const mobile = window.responsiveManager?.isMobile ??
                    window.innerWidth < 768;
                const dockVisible = this.hasVisibleTouchControls();
                const nextZoom = mobile || dockVisible ? 0.85 : 1.0;
                camera.setZoom(nextZoom);
                this.applyMobileCameraBounds(
                    camera,
                    mobile,
                    nextZoom,
                    dockVisible
                );
                this.currentCameraZoom = nextZoom;
                if (this.sanctuaryFocusModeActive) {
                    this.applySanctuaryCameraFocus({ immediate: true });
                }
            };
            this.scale.on('resize', this.mobileCameraResizeHandler);
        }
    }

    applyMobileCameraBounds(
        camera,
        isMobile,
        zoom,
        controlDockVisible = this.hasVisibleTouchControls()
    ) {
        let reservedWorldHeight = 0;
        if (isMobile || controlDockVisible) {
            const layout = getMobileControlLayout({
                width: this.scale.width,
                height: this.scale.height,
                safeArea: getSafeAreaInsets()
            });
            const playerClearance = 28;
            reservedWorldHeight = Math.ceil(
                (layout.dockHeight + playerClearance) / Math.max(zoom, 0.1)
            );
        }

        camera.setBounds(
            0,
            0,
            this.worldWidth,
            this.worldHeight + reservedWorldHeight
        );
        this.mobileControlDockWorldReserve = reservedWorldHeight;
    }

    hasVisibleTouchControls() {
        return Boolean(this.mobileControls?.isVisible);
    }

    handleMobileControlsVisibilityChange(visible) {
        const camera = this.cameras?.main;
        if (!camera) return;
        const isMobile = window.responsiveManager?.isMobile ?? window.innerWidth < 768;
        const controlDockVisible = Boolean(visible);
        const zoom = isMobile || controlDockVisible ? 0.85 : 1;
        camera.setZoom(zoom);
        this.applyMobileCameraBounds(
            camera,
            isMobile,
            zoom,
            controlDockVisible
        );
        this.currentCameraZoom = zoom;
        this.hudController?.layoutInteractionText?.(
            this.scale.width,
            this.scale.height
        );
        if (this.sanctuaryFocusModeActive) {
            this.applySanctuaryCameraFocus({ immediate: true });
        }
    }

    applySanctuaryCameraFocus({ immediate = false } = {}) {
        const camera = this.cameras?.main;
        const heart = this.villageHeartLandmark?.zone;
        if (!camera || !heart) return false;
        const touchControlsVisible = this.hasVisibleTouchControls();
        const compact = this.scale.width <= 600;
        const zoom = Math.max(0.1, camera.zoom || 1);
        const controlLayout = touchControlsVisible
            ? getMobileControlLayout({
                width: this.scale.width,
                height: this.scale.height,
                safeArea: getSafeAreaInsets()
            })
            : null;
        const target = {
            x: heart.x + (compact ? 0 : 230),
            y: heart.y + (
                touchControlsVisible
                    ? Math.round((controlLayout.dockHeight * 0.52) / zoom) + 20
                    : 0
            )
        };

        camera.stopFollow();
        if (immediate || !camera.pan) {
            camera.centerOn(target.x, target.y);
        } else {
            camera.pan(target.x, target.y, 360, 'Sine.easeInOut');
        }
        this.sanctuaryCameraFocusTarget = target;
        return true;
    }

    restorePlayerCameraFollow() {
        const camera = this.cameras?.main;
        if (!camera || !this.player || this.player.active === false) return false;
        camera.startFollow(this.player, true, 0.12, 0.12);
        camera.setDeadzone(
            Math.round(camera.width * 0.15),
            Math.round(camera.height * 0.2)
        );
        this.sanctuaryCameraFocusTarget = null;
        return true;
    }

    /**
     * Set up parallax background biome for immersive space-fantasy atmosphere
     * Uses current biome from init() data or defaults to nebula
     */
    setupParallaxBiome() {
        if (!window.ParallaxBiome) {
            console.warn('[GameScene] ParallaxBiome system not available');
            return;
        }

        try {
            this.parallaxBiome = window.ParallaxBiome;

            // Initialize with current biome ID from scene data
            const biomeId = this.currentBiome || 'nebula';
            this.parallaxBiome.initialize(this, biomeId);

            // Create all biome layers with biome-specific visuals
            this.parallaxBiome.createBiome();

            console.log(`[GameScene] ParallaxBiome activated for "${biomeId}" with`, this.parallaxBiome.getLayerCount(), 'layers');
        } catch (error) {
            console.error('[GameScene] Failed to setup ParallaxBiome:', error);
        }
    }

    /**
     * Create glowing navigation paths to guide users to key locations
     * Subtle cosmic dust trails that lead to: Ship (story), Hub Portal (levels), Shop
     * Only shows on first few visits to help new players navigate
     */
    createNavigationPaths() {
        // Only show in main sanctuary (nebula biome)
        if (this.currentBiome !== 'nebula') return;

        // Check if user has seen enough to disable navigation hints
        const timesVisited = window.GameState?.get('session.sanctuaryVisits') || 0;
        const villageSnapshot = getVillageSnapshot(window.GameState);
        const villageNeedsGuidance = villageSnapshot.unlock.unlocked &&
            !villageSnapshot.state.guidanceSeen;
        const showNavigation = timesVisited < 2 || villageNeedsGuidance;

        // Track visit
        window.GameState?.set('session.sanctuaryVisits', timesVisited + 1);

        if (!showNavigation) {
            console.log('[GameScene] Navigation paths disabled (user experienced)');
            return;
        }

        // Define key destinations with their info
        const destinations = [];

        if (this.crashedShip && !villageNeedsGuidance) {
            destinations.push({
                name: 'Story & Void',
                icon: '🚀',
                x: this.crashedShip.x,
                y: this.crashedShip.y,
                color: 0x4A90A4,
                description: 'Your ship\'s story'
            });
        }

        if (this.hubPortal && !villageNeedsGuidance) {
            destinations.push({
                name: 'Adventure Portal',
                icon: '⭐',
                x: this.hubPortal.x,
                y: this.hubPortal.y,
                color: 0x9370DB,
                description: 'Enter levels'
            });
        }

        if (this.villageHeartLandmark && villageSnapshot.unlock.unlocked) {
            destinations.push({
                name: villageNeedsGuidance ? 'Village Heart: New' : 'Village Heart',
                icon: '+',
                x: this.villageHeartLandmark.zone.x,
                y: this.villageHeartLandmark.zone.y,
                color: 0x71E6B1,
                description: 'Plan the shared settlement',
                showMarker: villageNeedsGuidance
            });
        }

        // Physical district paths now carry wayfinding. Floating callouts only
        // identify the first two global anchors, or the newly awakened Heart.
        destinations
            .filter(dest => dest.showMarker !== false)
            .forEach(dest => this.createFloatingMarker(dest));

        console.log(`[GameScene] Navigation paths created for ${destinations.length} destinations`);
    }

    /**
     * Create a glowing path from start to end point
     * Uses pulsing particle dots along the path
     */
    createGlowingPath(startX, startY, endX, endY, color) {
        const distance = Phaser.Math.Distance.Between(startX, startY, endX, endY);
        const numDots = Math.floor(distance / 80); // Dot every 80 pixels
        const angle = Phaser.Math.Angle.Between(startX, startY, endX, endY);

        for (let i = 1; i < numDots; i++) {
            const t = i / numDots;
            const x = startX + (endX - startX) * t;
            const y = startY + (endY - startY) * t;

            // Create glowing dot
            const dot = this.add.graphics();
            dot.fillStyle(color, 0.3);
            dot.fillCircle(0, 0, 8);
            dot.fillStyle(color, 0.5);
            dot.fillCircle(0, 0, 5);
            dot.fillStyle(0xFFFFFF, 0.3);
            dot.fillCircle(0, 0, 2);
            dot.setPosition(x, y);
            dot.setDepth(5); // Below most objects

            // Pulsing animation (staggered for wave effect)
            this.tweens.add({
                targets: dot,
                alpha: { from: 0.2, to: 0.6 },
                scale: { from: 0.8, to: 1.2 },
                duration: 1500,
                delay: i * 100, // Staggered
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            // Store for cleanup
            if (!this.navigationPathDots) this.navigationPathDots = [];
            this.navigationPathDots.push(dot);
        }
    }

    /**
     * Create a floating marker above a destination point
     * Shows icon and name label that bobs gently
     */
    createFloatingMarker(dest) {
        const markerY = dest.y - 80;

        // Create background glow
        const glow = this.add.graphics();
        glow.fillStyle(dest.color, 0.2);
        glow.fillCircle(0, 0, 30);
        glow.setPosition(dest.x, markerY);
        glow.setDepth(100);

        // Create icon text
        const icon = this.add.text(dest.x, markerY - 5, dest.icon, {
            fontSize: '32px'
        }).setOrigin(0.5).setDepth(101);

        // Create name label below icon
        const label = this.add.text(dest.x, markerY + 30, dest.name, {
            fontSize: '12px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3,
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(101);

        // One arrival flare establishes the landmark without permanent motion.
        [glow, icon, label].forEach(element => element.setAlpha(0));
        this.tweens.add({
            targets: [glow, icon, label],
            alpha: 1,
            duration: 420,
            ease: 'Cubic.easeOut'
        });

        // Store for cleanup
        if (!this.navigationMarkers) this.navigationMarkers = [];
        this.navigationMarkers.push(glow, icon, label);

        // Fade out markers after player approaches
        const zone = this.add.zone(dest.x, dest.y, 200, 200);
        zone.setInteractive();

        this.physics.add.overlap(this.player, zone, () => {
            // First visit - fade out this marker
            if (!glow.fading) {
                glow.fading = true;
                this.tweens.add({
                    targets: [glow, icon, label],
                    alpha: 0,
                    duration: 1000,
                    onComplete: () => {
                        glow.destroy();
                        icon.destroy();
                        label.destroy();
                        zone.destroy();
                    }
                });
            }
        });
    }

    /**
     * Set up space weather effects based on real NASA data
     * Creates aurora and sky tint when geomagnetic storms or solar flares are active
     */
    async setupSpaceWeather() {
        if (!window.SpaceWeatherSystem) {
            console.warn('[GameScene] SpaceWeatherSystem not available');
            return;
        }

        try {
            // Initialize space weather system if not already done
            if (!window.SpaceWeatherSystem.isInitialized) {
                await window.SpaceWeatherSystem.initialize();
            }

            // Apply current space weather effects
            this.applySpaceWeatherEffects();

            // Listen for weather updates
            window.SpaceWeatherSystem.on('weatherUpdated', (weather) => {
                this.applySpaceWeatherEffects(weather);
            });

            console.log('[GameScene] Space weather system connected');
        } catch (error) {
            console.warn('[GameScene] Failed to setup space weather:', error.message);
        }
    }

    /**
     * Apply visual effects based on current space weather
     */
    applySpaceWeatherEffects(weather = null) {
        if (!window.SpaceWeatherSystem || !window.FXLibrary) return;

        weather = weather || window.SpaceWeatherSystem.getWeather();

        // Clean up existing effects
        if (this.auroraEffect) {
            this.auroraEffect.destroy();
            this.auroraEffect = null;
        }
        if (this.skyTintEffect) {
            this.skyTintEffect.destroy();
            this.skyTintEffect = null;
        }

        // Apply aurora if geomagnetic storm is active
        if (weather.auroraActive && weather.auroraIntensity > 0) {
            this.auroraEffect = window.FXLibrary.createAurora(
                this,
                weather.auroraIntensity,
                { alpha: weather.auroraIntensity * 0.5 }
            );
            console.log('[GameScene] Aurora effect active, intensity:', weather.auroraIntensity);
        }

        // Apply sky tint for solar flares
        if (weather.skyTint) {
            this.skyTintEffect = window.FXLibrary.createSkyTint(
                this,
                weather.skyTint,
                weather.solarActivity === 'intense' ? 0.2 : 0.1
            );
            console.log('[GameScene] Sky tint active for solar activity:', weather.solarActivity);
        }

        // Store cosmic energy for creature mood effects
        this.cosmicEnergyLevel = weather.cosmicEnergy;
    }

    /**
     * Set up NASA daily content system
     * Shows APOD and Mars photos on first daily login, ISS alerts during gameplay
     */
    async setupNASAContent() {
        if (!window.NASAContentSystem) {
            console.warn('[GameScene] NASAContentSystem not available');
            return;
        }

        try {
            // Initialize NASA content system if not already done
            if (!window.NASAContentSystem.isInitialized) {
                await window.NASAContentSystem.initialize();
            }

            // Set up ISS overhead alert listener
            window.NASAContentSystem.on('issOverhead', (data) => {
                this.showCreatureSpeechBubble(data.message, 8000);
            });

            // Try to get player's approximate location for ISS tracking
            this.requestLocationForISS();

            // NASA daily content is now handled by OnboardingManager
            // to ensure proper sequencing with other popups

            console.log('[GameScene] NASA content system connected');
        } catch (error) {
            console.warn('[GameScene] Failed to setup NASA content:', error.message);
        }
    }

    /**
     * Request location permission for ISS tracking
     */
    requestLocationForISS() {
        if (!navigator.geolocation) return;

        // Check if we already have stored location
        const storedLat = localStorage.getItem('player_lat');
        const storedLon = localStorage.getItem('player_lon');

        if (storedLat && storedLon) {
            window.NASAContentSystem?.setPlayerLocation(
                parseFloat(storedLat),
                parseFloat(storedLon)
            );
            return;
        }

        // Request location (non-blocking, user can decline)
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                localStorage.setItem('player_lat', latitude.toString());
                localStorage.setItem('player_lon', longitude.toString());
                window.NASAContentSystem?.setPlayerLocation(latitude, longitude);
                console.log('[GameScene] Location set for ISS tracking');
            },
            () => {
                // User declined - that's fine, ISS alerts just won't work
                console.log('[GameScene] Location permission declined, ISS alerts disabled');
            },
            { enableHighAccuracy: false, timeout: 10000 }
        );
    }

    /**
     * Check and show daily NASA content (APOD, Mars postcards)
     */
    async checkAndShowDailyNASAContent() {
        console.log('[GameScene] Checking NASA daily content...');

        if (!window.NASAContentSystem?.shouldShowDailyContent()) {
            console.log('[GameScene] NASA content already shown today - to reset, run: window.NASAContentSystem.resetDailyContent()');
            return;
        }

        try {
            const contentQueue = await window.NASAContentSystem.getDailyContentQueue();
            console.log('[GameScene] NASA content queue:', contentQueue.length, 'items');

            if (contentQueue.length > 0) {
                // Create and show modal
                console.log('[GameScene] Showing NASA content modal');
                this.nasaModal = new NASAContentModal(this);
                this.nasaModal.show(contentQueue, () => {
                    // Mark content as shown when user dismisses
                    window.NASAContentSystem?.markDailyContentShown();
                    this.nasaModal = null;
                });
            } else {
                console.log('[GameScene] No NASA content available in queue');
            }
        } catch (error) {
            console.warn('[GameScene] Failed to show NASA content:', error.message);
        }
    }

    /**
     * Show temporary speech bubble from creature
     * Used for ISS alerts and other creature announcements
     */
    showCreatureSpeechBubble(message, duration = 5000) {
        if (!this.player) return;

        // Clean up existing bubble
        if (this.creatureSpeechBubble) {
            this.creatureSpeechBubble.forEach(el => el?.destroy());
        }
        this.creatureSpeechBubble = [];

        const { width } = this.cameras.main;
        const bubbleWidth = Math.min(350, width - 40);
        const padding = 15;

        // Position above player
        const bubbleX = this.player.x;
        const bubbleY = this.player.y - 120;

        // Create bubble background
        const bubble = this.add.graphics();
        bubble.setDepth(3000);

        // Measure text to size bubble
        const tempText = this.add.text(0, 0, message, {
            fontSize: '14px',
            wordWrap: { width: bubbleWidth - padding * 2 }
        });
        const textHeight = tempText.height;
        tempText.destroy();

        const bubbleHeight = textHeight + padding * 2;

        // Draw speech bubble with pointer
        bubble.fillStyle(0xFFFFFF, 0.95);
        bubble.fillRoundedRect(
            bubbleX - bubbleWidth / 2,
            bubbleY - bubbleHeight,
            bubbleWidth,
            bubbleHeight,
            12
        );

        // Pointer triangle
        bubble.fillTriangle(
            bubbleX - 10, bubbleY,
            bubbleX + 10, bubbleY,
            bubbleX, bubbleY + 15
        );

        // Border
        bubble.lineStyle(2, 0x7B68EE);
        bubble.strokeRoundedRect(
            bubbleX - bubbleWidth / 2,
            bubbleY - bubbleHeight,
            bubbleWidth,
            bubbleHeight,
            12
        );

        this.creatureSpeechBubble.push(bubble);

        // Add text
        const text = this.add.text(bubbleX, bubbleY - bubbleHeight / 2, message, {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: '#333333',
            wordWrap: { width: bubbleWidth - padding * 2 },
            align: 'center'
        }).setOrigin(0.5).setDepth(3001);

        this.creatureSpeechBubble.push(text);

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        // Auto-dismiss after duration
        this.time.delayedCall(duration, () => {
            this.creatureSpeechBubble?.forEach(el => {
                if (el && el.destroy) {
                    this.tweens.add({
                        targets: el,
                        alpha: 0,
                        duration: 500,
                        onComplete: () => el.destroy()
                    });
                }
            });
            this.creatureSpeechBubble = null;
        });
    }

    /**
     * Initialize secret abilities for the current creature
     * Applies passive abilities and sets up combat/utility modifiers
     */
    initializeSecretAbilities() {
        const genes = getGameState().get('creature.genes');
        const creature = {
            x: this.player?.x,
            y: this.player?.y,
            generation: genes?.metadata?.generation || 1,
            secretAbilities: genes?.secretAbilities || []
        };

        if (window.SecretAbilityManager) {
            const activeAbilities = window.SecretAbilityManager.initializeForCreature(creature, this);

            if (activeAbilities.length > 0) {
                console.log(`[GameScene] Initialized ${activeAbilities.length} secret abilities`);

                // Show ability notification after a short delay
                this.time.delayedCall(3000, () => {
                    activeAbilities.forEach((ability, index) => {
                        this.time.delayedCall(index * 1500, () => {
                            this.showAbilityNotification(ability);
                        });
                    });
                });
            }
        }
    }

    /**
     * Show notification for an active secret ability
     */
    showAbilityNotification(ability) {
        const width = this.scale.width;
        const height = this.scale.height;

        // Create notification panel
        const panelX = width / 2;
        const panelY = height * 0.2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 0.9);
        panel.fillRoundedRect(panelX - 150, panelY - 30, 300, 60, 10);
        panel.lineStyle(2, 0x9C27B0);
        panel.strokeRoundedRect(panelX - 150, panelY - 30, 300, 60, 10);
        panel.setDepth(1500);
        panel.setScrollFactor(0);

        const text = this.add.text(panelX, panelY,
            `${ability.icon || '✨'} ${ability.name}\n${ability.handler?.getDescription?.() || ''}`, {
            fontSize: '14px',
            color: '#FFFFFF',
            align: 'center'
        }).setOrigin(0.5).setDepth(1501).setScrollFactor(0);

        // Animate in and out
        panel.setAlpha(0);
        text.setAlpha(0);

        this.tweens.add({
            targets: [panel, text],
            alpha: 1,
            duration: 500,
            onComplete: () => {
                this.time.delayedCall(2500, () => {
                    this.tweens.add({
                        targets: [panel, text],
                        alpha: 0,
                        duration: 500,
                        onComplete: () => {
                            panel.destroy();
                            text.destroy();
                        }
                    });
                });
            }
        });

        // Sound effect
        window.AudioManager?.playAchievement?.();
    }

    /**
     * Check for pending Ancient Lineage reveal and show dramatic notification
     * Ancient Lineage is an extremely rare birth event for max generation creatures
     */
    checkAncientLineageReveal() {
        const pendingLineage = getGameState().get('session.pendingAncientLineage');

        if (!pendingLineage) return;

        console.log('[GameScene] Ancient Lineage reveal triggered!');

        // Clear the pending flag
        getGameState().set('session.pendingAncientLineage', null);

        // Show dramatic Ancient Lineage reveal
        this.showAncientLineageReveal(pendingLineage);
    }

    /**
     * Show dramatic Ancient Lineage reveal with full-screen celebration
     */
    showAncientLineageReveal(lineageData) {
        const width = this.scale.width;
        const height = this.scale.height;

        // Create dark overlay for dramatic effect
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(2000);
        overlay.setScrollFactor(0);
        overlay.setAlpha(0);

        // Fade in the overlay
        this.tweens.add({
            targets: overlay,
            alpha: 0.9,
            duration: 1000
        });

        // Create golden border effect
        const border = this.add.graphics();
        border.setDepth(2001);
        border.setScrollFactor(0);
        border.setAlpha(0);

        this.time.delayedCall(1000, () => {
            // Draw ornate golden border
            border.lineStyle(4, 0xFFD700);
            border.strokeRoundedRect(width * 0.1, height * 0.15, width * 0.8, height * 0.7, 20);
            border.lineStyle(2, 0xFFA500);
            border.strokeRoundedRect(width * 0.1 + 5, height * 0.15 + 5, width * 0.8 - 10, height * 0.7 - 10, 18);

            this.tweens.add({
                targets: border,
                alpha: 1,
                duration: 500
            });
        });

        // Title text - "ANCIENT LINEAGE"
        const titleText = this.add.text(width / 2, height * 0.25, '👑 ANCIENT LINEAGE 👑', {
            fontSize: '32px',
            fontFamily: 'Georgia, serif',
            color: '#FFD700',
            stroke: '#8B4513',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(2002).setScrollFactor(0).setAlpha(0);

        // Subtitle
        const subtitleText = this.add.text(width / 2, height * 0.35,
            `Generation ${lineageData.generation} • ${lineageData.ancestors} Ancestral Spirits`, {
            fontSize: '18px',
            color: '#FFA500',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(2002).setScrollFactor(0).setAlpha(0);

        // Lore text
        const loreText = this.add.text(width / 2, height * 0.48,
            '"Through countless generations,\nancient wisdom flows through this creature.\nThe ancestors have blessed this birth\nwith powers beyond mortal comprehension."', {
            fontSize: '14px',
            fontStyle: 'italic',
            color: '#E0E0E0',
            align: 'center',
            lineSpacing: 8
        }).setOrigin(0.5).setDepth(2002).setScrollFactor(0).setAlpha(0);

        // Bonus text
        const bonusText = this.add.text(width / 2, height * 0.68,
            `✨ All Stats +${lineageData.statBonus}%\n🛡️ Ancient Protection Active\n⚡ ${lineageData.uniqueAbility || 'Ancestral Blessing'} Unlocked`, {
            fontSize: '16px',
            color: '#90EE90',
            align: 'center',
            lineSpacing: 6
        }).setOrigin(0.5).setDepth(2002).setScrollFactor(0).setAlpha(0);

        // Animate text reveals
        this.time.delayedCall(1500, () => {
            // Play dramatic sound
            window.AudioManager?.playVisionReveal?.();

            this.tweens.add({ targets: titleText, alpha: 1, scale: { from: 0.5, to: 1 }, duration: 800, ease: 'Back.easeOut' });
        });

        this.time.delayedCall(2300, () => {
            this.tweens.add({ targets: subtitleText, alpha: 1, y: { from: height * 0.32, to: height * 0.35 }, duration: 600 });
        });

        this.time.delayedCall(3000, () => {
            this.tweens.add({ targets: loreText, alpha: 1, duration: 800 });
        });

        this.time.delayedCall(4000, () => {
            window.AudioManager?.playLevelUp?.();
            this.tweens.add({ targets: bonusText, alpha: 1, scale: { from: 0.8, to: 1 }, duration: 600, ease: 'Back.easeOut' });
        });

        // Golden particle effects
        this.time.delayedCall(1500, () => {
            if (window.FXLibrary) {
                // Continuous golden particles
                const particleTimer = this.time.addEvent({
                    delay: 200,
                    callback: () => {
                        const px = Phaser.Math.Between(width * 0.15, width * 0.85);
                        const py = Phaser.Math.Between(height * 0.2, height * 0.8);
                        window.FXLibrary.stardustBurst(this, px, py, {
                            count: 5,
                            color: [0xFFD700, 0xFFA500, 0xFFFF00],
                            duration: 1500
                        });
                    },
                    repeat: 20
                });
            }
        });

        // Close button after animation
        this.time.delayedCall(5500, () => {
            const closeBtn = this.add.text(width / 2, height * 0.82, '[ Acknowledge Your Destiny ]', {
                fontSize: '18px',
                color: '#FFD700',
                backgroundColor: 'rgba(26, 26, 62, 0.9)',
                padding: { x: 20, y: 10 }
            }).setOrigin(0.5).setDepth(2003).setScrollFactor(0).setInteractive({ useHandCursor: true });

            closeBtn.on('pointerover', () => closeBtn.setColor('#FFFFFF'));
            closeBtn.on('pointerout', () => closeBtn.setColor('#FFD700'));
            closeBtn.on('pointerdown', () => {
                window.AudioManager?.playButtonClick?.();

                // Fade out everything
                this.tweens.add({
                    targets: [overlay, border, titleText, subtitleText, loreText, bonusText, closeBtn],
                    alpha: 0,
                    duration: 500,
                    onComplete: () => {
                        overlay.destroy();
                        border.destroy();
                        titleText.destroy();
                        subtitleText.destroy();
                        loreText.destroy();
                        bonusText.destroy();
                        closeBtn.destroy();
                    }
                });
            });

            // Pulsing animation on button
            this.tweens.add({
                targets: closeBtn,
                scale: { from: 1, to: 1.05 },
                duration: 800,
                yoyo: true,
                repeat: -1
            });
        });
    }

    /**
     * Apply cosmic affinity passive effects based on creature genetics
     * Each cosmic element provides unique gameplay bonuses
     */
    applyCosmicAffinityEffects() {
        const genes = getGameState().get('creature.genes');
        const affinity = genes?.cosmicAffinity;

        if (!affinity) {
            console.log('[GameScene] No cosmic affinity found, using default modifiers');
            return;
        }

        const element = affinity.element;
        const powerLevel = affinity.powerLevel || 0.5;

        console.log(`[GameScene] Applying ${element} cosmic affinity (power: ${powerLevel.toFixed(2)})`);

        switch (element) {
            case 'star':
                // Star affinity: Enhanced health regeneration
                this.cosmicAffinityEffects.healthRegenRate = 1.0 + (powerLevel * 0.5);
                break;
            case 'moon':
                // Moon affinity: Reduced energy drain (calmer creature)
                this.cosmicAffinityEffects.energyDrainRate = 1.0 - (powerLevel * 0.3);
                break;
            case 'nebula':
                // Nebula affinity: Bonus XP from exploration
                this.cosmicAffinityEffects.explorationXPBonus = 1.0 + (powerLevel * 0.25);
                break;
            case 'crystal':
                // Crystal affinity: Find more coins
                this.cosmicAffinityEffects.coinFindBonus = 1.0 + (powerLevel * 0.2);
                break;
            case 'void':
                // Void affinity: Deal more damage in combat
                this.cosmicAffinityEffects.damageBonus = 1.0 + (powerLevel * 0.4);
                break;
            default:
                console.log('[GameScene] Unknown cosmic affinity:', element);
        }

        // Show affinity notification to player
        this.showCosmicAffinityNotification(element, powerLevel);
    }

    /**
     * Show cosmic affinity effect notification
     */
    showCosmicAffinityNotification(element, powerLevel) {
        const affinityInfo = {
            star: { color: 0xF2C14E, effect: 'Health recovers faster' },
            moon: { color: 0xC9D6FF, effect: 'Energy lasts longer' },
            nebula: { color: 0xD89CFF, effect: 'Exploration discoveries earn bonus XP' },
            crystal: { color: 0x71E6DB, effect: 'Valuable finds appear more often' },
            void: { color: 0xC58BE2, effect: 'Combat attacks deal more damage' }
        };

        const info = affinityInfo[element];
        if (!info) return;

        // Only show on first visit or after level up
        const hasShownAffinity = getGameState().get('session.shownCosmicAffinity');
        if (hasShownAffinity) return;

        getGameState().set('session.shownCosmicAffinity', true);

        // World interactions own the player's attention. The resonance remains
        // recorded in the creature profile, so it does not need to compete with
        // an active Sanctuary landmark.
        if (this.sanctuaryFocusModeActive || this.nearVillageHeart) return;

        this.dismissCosmicAffinityNotice(0);
        this.dailyBonusButton?.setVisible?.(false);

        const camera = this.cameras.main;
        const compactNotice = camera.width <= 600;
        const noticeLeft = compactNotice ? 88 : 16;
        const noticeRight = 16;
        const noticeWidth = Math.min(
            300,
            Math.max(200, camera.width - noticeLeft - noticeRight)
        );
        const noticeX = compactNotice
            ? noticeLeft + noticeWidth / 2
            : camera.width / 2;
        const notice = this.add.container(noticeX, 24)
            .setScrollFactor(0)
            .setDepth(1500)
            .setAlpha(0)
            .setData('affinity', element)
            .setData('powerLevel', powerLevel)
            .setData('sanctuaryNotice', true);
        const panel = this.add.graphics();
        panel.fillStyle(0x071411, 0.88);
        panel.fillRoundedRect(-noticeWidth / 2, 0, noticeWidth, 48, 6);
        panel.fillStyle(info.color, 0.92);
        panel.fillRoundedRect(-noticeWidth / 2, 0, 4, 48, 2);

        const title = this.add.text(
            -noticeWidth / 2 + 16,
            9,
            `${element.toUpperCase()} RESONANCE`,
            {
                fontSize: '10px',
                fontFamily: 'Arial, sans-serif',
                fontStyle: 'bold',
                color: '#F4F4F4'
            }
        );
        const effect = this.add.text(
            -noticeWidth / 2 + 16,
            25,
            info.effect,
            {
                fontSize: '11px',
                fontFamily: 'Arial, sans-serif',
                color: '#D7E2DE'
            }
        );
        notice.add([panel, title, effect]);
        this.cosmicAffinityNotice = notice;

        this.tweens.add({
            targets: notice,
            alpha: 1,
            y: 32,
            duration: 220,
            ease: 'Quad.easeOut',
            onComplete: () => {
                this.cosmicAffinityNoticeTimer = this.time.delayedCall(
                    2400,
                    () => this.dismissCosmicAffinityNotice()
                );
            }
        });
    }

    dismissCosmicAffinityNotice(duration = 180) {
        this.cosmicAffinityNoticeTimer?.remove?.(false);
        this.cosmicAffinityNoticeTimer = null;
        const notice = this.cosmicAffinityNotice;
        this.cosmicAffinityNotice = null;
        if (!notice?.active) return;

        const restoreDailyGift = () => {
            if (!this.sanctuaryFocusModeActive) {
                this.getHudController().updateDailyBonusButton();
            }
        };

        this.tweens.killTweensOf(notice);
        if (duration <= 0) {
            notice.destroy(true);
            restoreDailyGift();
            return;
        }
        this.tweens.add({
            targets: notice,
            alpha: 0,
            y: notice.y - 6,
            duration,
            ease: 'Quad.easeIn',
            onComplete: () => {
                notice.destroy(true);
                restoreDailyGift();
            }
        });
    }

    /**
     * Trigger atmospheric parallax effect for major events
     */
    triggerAtmosphericEffect(effectType, x, y, intensity = 1.0) {
        if (this.parallaxBiome?.triggerAtmosphericEffect) {
            this.parallaxBiome.triggerAtmosphericEffect(effectType, x, y, intensity);
        }
    }

    createEnhancedEnvironmentSprites() {
        // Get creature colors from GameState or use defaults
        const creatureColors = getGameState().get('creature.colors') || {
            body: 0x9370DB,  // Default purple
            head: 0xDDA0DD,  // Default plum
            wings: 0x8A2BE2  // Default blue violet
        };

        // Create enhanced player creature sprites (4 frames for walking animation)
        // Note: This is now handled in createPlayer() using genetics, but kept for compatibility
        for (let i = 0; i < 4; i++) {
            this.graphicsEngine.createEnhancedCreature(
                creatureColors.body, 
                creatureColors.head, 
                creatureColors.wings, 
                i
            );
        }

        // Create enhanced environment objects with variations
        this.createEnvironmentVariations();
    }

    createEnvironmentVariations() {
        // Create multiple tree variations (different seasons/ages)
        this.graphicsEngine.createEnhancedTree(1.0, 'summer');
        this.graphicsEngine.createEnhancedTree(0.8, 'spring');
        this.graphicsEngine.createEnhancedTree(1.2, 'autumn');

        // Create rock variations with different moss levels
        for (let i = 0; i < 3; i++) {
            const mossiness = i * 0.3;
            this.graphicsEngine.createEnhancedRock(1.0, mossiness);
        }

        // Create flower variations with different colors
        const flowerColors = [
            { petal: 0xFF69B4, center: 0xFFD700 },
            { petal: 0x9370DB, center: 0xFFA500 },
            { petal: 0xFF6347, center: 0xFFFFE0 },
            { petal: 0x4169E1, center: 0xFFF8DC },
            { petal: 0xFFB6C1, center: 0xFF69B4 }
        ];

        flowerColors.forEach((color) => {
            this.graphicsEngine.createEnhancedFlower(color.petal, color.center, 1.0);
        });

        // Create magical sparkle for interactions
        this.graphicsEngine.createMagicalSparkle(0x00FFFF, 0.8);
    }

    createPlayer() {
        // Check for a scene-transition spawn before persisted world positions.
        const transitionSpawn = this.spawnPosition;
        const spawnPos = getGameState().get('creature.spawnPosition');
        const savedPos = getGameState().get('world.currentPosition');

        let startX, startY;

        if (transitionSpawn) {
            startX = Number(transitionSpawn.x);
            startY = Number(transitionSpawn.y);
            this.spawnPosition = null;
        } else if (spawnPos) {
            // Use spawn position from egg hatching (where old creature was)
            startX = spawnPos.x;
            startY = spawnPos.y;
            console.log('game:info [GameScene] Using egg spawn position:', spawnPos);
            // Clear the spawn position after using it
            getGameState().set('creature.spawnPosition', null);
        } else if (savedPos) {
            // Use saved position
            startX = savedPos.x;
            startY = savedPos.y;
        } else if (this.caveSpawnPoint) {
            // Use cave tunnel spawn point for Crystal Caves biome
            startX = this.caveSpawnPoint.x;
            startY = this.caveSpawnPoint.y;
            console.log('game:info [GameScene] Using cave spawn point:', this.caveSpawnPoint);
        } else {
            // Default to center of world
            startX = this.worldWidth / 2;
            startY = this.worldHeight / 2;
        }

        if (
            this.currentBiome === 'nebula' &&
            this.sanctuaryZones?.getSafeSpawnPosition
        ) {
            const safePosition = this.sanctuaryZones.getSafeSpawnPosition({
                x: startX,
                y: startY
            });
            const recovered = safePosition.x !== Number(startX) ||
                safePosition.y !== Number(startY);
            startX = safePosition.x;
            startY = safePosition.y;
            if (recovered) {
                console.warn(
                    '[GameScene] Recovered player from unsafe Sanctuary perimeter'
                );
                getGameState().updateWorldExploration({ x: startX, y: startY });
            }
        }
        
        // Get creature genetics for proper sprite creation
        console.log('game:info [GameScene] Creating player creature');

        // Use unified creature animation loading method
        let creatureTextures = [];

        try {
            creatureTextures = this.graphicsEngine.createCreatureAnimationFrames();
            console.log('game:info [GameScene] Successfully created creature animation frames:', creatureTextures);
        } catch (error) {
            console.error('game:error [GameScene] Error creating creature frames:', error);
            // Fallback to default creature frames
            console.warn('game:warn [GameScene] Using fallback creature frames');
            for (let frame = 0; frame < 4; frame++) {
                this.graphicsEngine.createEnhancedCreature(0x9370DB, 0xDDA0DD, 0x8A2BE2, frame, null);
            }
            creatureTextures = ['enhancedCreature0', 'enhancedCreature1', 'enhancedCreature2', 'enhancedCreature3'];
        }

        // Store genetics reference for later use
        // Priority: active creature from collection, then creature slot
        const activeCreature = getGameState().getActiveCreature?.();
        if (activeCreature && (activeCreature.genes || activeCreature.dna)) {
            this.playerGenetics = activeCreature.genes || activeCreature.dna;
            console.log('game:info [GameScene] Using genetics from active creature in collection');
        } else {
            const creatureData = getGameState().get('creature');
            if (creatureData && (creatureData.genetics || creatureData.genes)) {
                this.playerGenetics = creatureData.genetics || creatureData.genes;
                console.log('game:info [GameScene] Using genetics from creature slot (fallback)');
            }
        }
        
        // Create physics sprite with the first texture
        this.player = this.physics.add.sprite(startX, startY, creatureTextures[0]);
        this.player.setScale(1.0);

        // Enable collision with world bounds
        this.player.setCollideWorldBounds(true);

        // Set player collision body size (slightly smaller than sprite for better gameplay)
        this.player.body.setSize(40, 60);
        this.player.body.setOffset(10, 10);

        console.log(`game:info [GameScene] Player created at (${startX}, ${startY}) with world bounds: ${this.worldWidth}x${this.worldHeight}`);
        
        // Make creature clickable for radial menu
        this.player.setInteractive({ cursor: 'pointer' });
        this.player.on('pointerdown', () => {
            this.showCreatureRadialMenu();
        });

        // Add breathing/idle animation to make creature feel alive
        this.addBreathingAnimation(this.player, 1.0);
    }

    createExpeditionAstronaut() {
        this.astronautFollower?.destroy();
        this.astronautFollower = new ExpeditionAstronaut(this, this.player, {
            mode: 'topDown',
            fieldKitRecovered: this.hasRecoveredProjectBeaconFieldKit(),
            katanaUpgradeIds: getProjectBeaconKatanaUpgradeIds(
                window.GameState
            )
        });
    }

    /**
     * Add breathing/idle animation to make creature feel alive
     * Based on cartoon animation principles: subtle breathing effect
     * @param {Phaser.GameObjects.Sprite} creature - The creature sprite
     * @param {number} baseScale - The base scale of the creature
     */
    addBreathingAnimation(creature, baseScale) {
        if (!creature) return;

        // Clean up any existing breathing tweens before adding new ones
        if (this.breathingTweens) {
            this.breathingTweens.forEach(tween => {
                if (tween && tween.isPlaying) {
                    tween.stop();
                }
            });
        }
        this.breathingTweens = [];

        // Get lifecycle stage for animation intensity
        const stage = window.GameState?.get('creature.lifecycle.stage') || 'adult';
        const isBaby = stage === 'baby';
        const isJuvenile = stage === 'juvenile';

        // Babies breathe faster and more noticeably, adults are subtler
        const breathingIntensity = isBaby ? 0.04 : (isJuvenile ? 0.03 : 0.02);
        const breathingDuration = isBaby ? 1600 : (isJuvenile ? 2000 : 2500);

        console.log('game:info [GameScene] Adding breathing animation for stage:', stage);

        // Store the base Y position for bobbing
        const baseY = creature.y;

        // Breathing animation - gentle scale oscillation (squash/stretch)
        const breathingTween = this.tweens.add({
            targets: creature,
            scaleX: baseScale * (1 + breathingIntensity),
            scaleY: baseScale * (1 - breathingIntensity * 0.5),
            duration: breathingDuration,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
        this.breathingTweens.push(breathingTween);

        // Subtle bobbing animation - only when not moving
        const bobbingAmplitude = isBaby ? 4 : (isJuvenile ? 3 : 2);
        const bobbingTween = this.tweens.add({
            targets: creature,
            y: baseY - bobbingAmplitude,
            duration: breathingDuration * 1.2,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
            delay: 150, // Slight offset from breathing for natural feel
            onUpdate: () => {
                // Pause bobbing if player is moving significantly
                if (creature.body && (Math.abs(creature.body.velocity.x) > 10 || Math.abs(creature.body.velocity.y) > 10)) {
                    if (bobbingTween.isPlaying()) {
                        bobbingTween.pause();
                    }
                } else {
                    if (bobbingTween.isPaused()) {
                        bobbingTween.resume();
                    }
                }
            }
        });
        this.breathingTweens.push(bobbingTween);

        // Setup generation-based visual effects for bred creatures
        this.setupGenerationEffects();
    }

    /**
     * Setup generation-based visual effects for bred creatures
     * Higher generation creatures get progressively more impressive effects
     * Gen 1: No effects (normal hatched)
     * Gen 2: Subtle aura glow
     * Gen 3: Stronger glow + particle trail
     * Gen 4+: Prismatic shimmer + orbiting cosmic particles
     */
    setupGenerationEffects() {
        // Clean up any existing generation effects
        this.cleanupGenerationEffects();

        // Get creature generation
        const generation = getGameState().get('creature.generation') || 1;
        const isOffspring = getGameState().get('creature.isOffspring') || false;

        // Only apply effects to bred creatures (gen 2+)
        if (generation < 2 || !isOffspring) {
            console.log('game:debug [GameScene] No generation effects for gen', generation);
            return;
        }

        console.log('game:info [GameScene] Setting up generation effects for Gen', generation, 'creature');

        // Get creature's cosmic affinity for color theming
        const affinity = getGameState().get('creature.cosmicAffinity');
        const affinityColors = {
            star: { primary: 0xFFD700, secondary: 0xFFA500 },
            moon: { primary: 0xC0C0C0, secondary: 0x87CEEB },
            nebula: { primary: 0xFF69B4, secondary: 0x9370DB },
            crystal: { primary: 0x00CED1, secondary: 0x40E0D0 },
            void: { primary: 0x8B00FF, secondary: 0x4B0082 }
        };
        const colors = affinityColors[affinity?.element] || affinityColors.star;

        // Create aura glow (Gen 2+)
        this.createGenerationAura(generation, colors);

        // Create particle effects (Gen 3+)
        if (generation >= 3) {
            this.createGenerationParticles(generation, colors);
        }

        // Create orbiting particles (Gen 4+)
        if (generation >= 4) {
            this.createOrbitingParticles(generation, colors);
        }
    }

    /**
     * Create aura glow effect around creature
     */
    createGenerationAura(generation, colors) {
        if (!this.player) return;

        // Aura intensity scales with generation
        const intensity = Math.min(0.15 + (generation - 2) * 0.1, 0.5);
        const size = 40 + (generation - 2) * 10;

        // Create aura graphics
        this.generationAura = this.add.graphics();
        this.generationAura.setDepth(this.player.depth - 1);

        // Update aura position to follow player
        this.generationAuraTimer = this.time.addEvent({
            delay: 16, // ~60fps
            callback: () => {
                if (!this.player || !this.generationAura) return;

                this.generationAura.clear();

                // Pulsing effect
                const pulse = Math.sin(this.time.now / 500) * 0.1 + 1;
                const currentSize = size * pulse;

                // Outer glow
                this.generationAura.fillStyle(colors.primary, intensity * 0.3);
                this.generationAura.fillCircle(this.player.x, this.player.y + 10, currentSize * 1.5);

                // Inner glow
                this.generationAura.fillStyle(colors.secondary, intensity * 0.5);
                this.generationAura.fillCircle(this.player.x, this.player.y + 10, currentSize);

                // Core glow (Gen 4+ gets extra bright core)
                if (generation >= 4) {
                    this.generationAura.fillStyle(0xFFFFFF, intensity * 0.3);
                    this.generationAura.fillCircle(this.player.x, this.player.y + 10, currentSize * 0.5);
                }
            },
            loop: true
        });
    }

    /**
     * Create trailing particle effect for moving creatures (Gen 3+)
     */
    createGenerationParticles(generation, colors) {
        if (!this.player) return;

        this.generationParticles = [];
        const particleCount = 3 + (generation - 3) * 2; // More particles for higher gen

        this.generationParticleTimer = this.time.addEvent({
            delay: 100, // Spawn particle every 100ms when moving
            callback: () => {
                if (!this.player || !this.player.body) return;

                // Only spawn particles when moving
                const isMoving = Math.abs(this.player.body.velocity.x) > 20 ||
                                Math.abs(this.player.body.velocity.y) > 20;

                if (!isMoving) return;

                // Create trailing particle
                const particle = this.add.graphics();
                const offsetX = (Math.random() - 0.5) * 20;
                const offsetY = (Math.random() - 0.5) * 20;
                const size = 3 + Math.random() * 4;
                const color = Math.random() > 0.5 ? colors.primary : colors.secondary;

                particle.fillStyle(color, 0.8);
                particle.fillCircle(this.player.x + offsetX, this.player.y + 20 + offsetY, size);
                particle.setDepth(this.player.depth - 2);

                this.generationParticles.push(particle);

                // Fade out and remove
                this.tweens.add({
                    targets: particle,
                    alpha: 0,
                    scale: 0.5,
                    duration: 500,
                    onComplete: () => {
                        const idx = this.generationParticles.indexOf(particle);
                        if (idx > -1) this.generationParticles.splice(idx, 1);
                        particle.destroy();
                    }
                });

                // Limit active particles
                while (this.generationParticles.length > particleCount * 3) {
                    const old = this.generationParticles.shift();
                    if (old) old.destroy();
                }
            },
            loop: true
        });
    }

    /**
     * Create orbiting cosmic particles (Gen 4+)
     */
    createOrbitingParticles(generation, colors) {
        if (!this.player) return;

        const orbitCount = Math.min(generation - 3, 4); // 1-4 orbiting particles
        this.orbitingParticles = [];

        for (let i = 0; i < orbitCount; i++) {
            const orbit = {
                graphics: this.add.graphics(),
                angle: (i / orbitCount) * Math.PI * 2,
                radius: 35 + i * 8,
                speed: 0.02 + (i * 0.005),
                size: 4 + i,
                color: i % 2 === 0 ? colors.primary : colors.secondary
            };
            orbit.graphics.setDepth(this.player.depth + 1);
            this.orbitingParticles.push(orbit);
        }

        // Prismatic color shift for very high gen
        const isPrismatic = generation >= 5;
        let hueShift = 0;

        this.orbitingParticleTimer = this.time.addEvent({
            delay: 16,
            callback: () => {
                if (!this.player) return;

                if (isPrismatic) hueShift = (hueShift + 2) % 360;

                this.orbitingParticles.forEach((orbit, idx) => {
                    orbit.angle += orbit.speed;
                    const x = this.player.x + Math.cos(orbit.angle) * orbit.radius;
                    const y = this.player.y + Math.sin(orbit.angle) * orbit.radius * 0.6; // Slight ellipse

                    orbit.graphics.clear();

                    // Prismatic color effect for gen 5+
                    let color = orbit.color;
                    if (isPrismatic) {
                        const h = (hueShift + idx * 60) % 360;
                        color = Phaser.Display.Color.HSLToColor(h / 360, 0.8, 0.6).color;
                    }

                    // Glowing orb
                    orbit.graphics.fillStyle(color, 0.4);
                    orbit.graphics.fillCircle(x, y, orbit.size * 1.5);
                    orbit.graphics.fillStyle(color, 0.8);
                    orbit.graphics.fillCircle(x, y, orbit.size);
                    orbit.graphics.fillStyle(0xFFFFFF, 0.5);
                    orbit.graphics.fillCircle(x, y, orbit.size * 0.4);
                });
            },
            loop: true
        });
    }

    /**
     * Clean up generation effects
     */
    cleanupGenerationEffects() {
        if (this.generationAuraTimer) {
            this.generationAuraTimer.destroy();
            this.generationAuraTimer = null;
        }
        if (this.generationAura) {
            this.generationAura.destroy();
            this.generationAura = null;
        }
        if (this.generationParticleTimer) {
            this.generationParticleTimer.destroy();
            this.generationParticleTimer = null;
        }
        if (this.generationParticles) {
            this.generationParticles.forEach(p => p.destroy());
            this.generationParticles = [];
        }
        if (this.orbitingParticleTimer) {
            this.orbitingParticleTimer.destroy();
            this.orbitingParticleTimer = null;
        }
        if (this.orbitingParticles) {
            this.orbitingParticles.forEach(o => o.graphics.destroy());
            this.orbitingParticles = [];
        }
    }

    createCosmicCoins() {
        console.log('game:info [GameScene] Creating cosmic coins for collection');

        this.graphicsEngine?.createCosmicCoin();

        // Clear existing coins if they exist and are still valid
        if (this.coins && this.coins.scene) {
            try {
                this.coins.clear(true, true);
            } catch (e) {
                console.warn('[GameScene] Could not clear old coins group:', e.message);
            }
        }
        this.coins = null;  // Reset reference

        this.coins = this.physics.add.group({
            defaultKey: 'cosmicCoin',
            maxSize: 20
        });

        this.coinRespawnTimers = [];

        const coinCount = 18;
        for (let i = 0; i < coinCount; i++) {
            this.spawnCoin();
        }

        if (this.player) {
            this.physics.add.overlap(this.player, this.coins, this.handleCoinCollection, null, this);
        }

        console.log(`game:info [GameScene] Spawned ${coinCount} cosmic coins`);
    }

    spawnCoin(x = null, y = null) {
        if (!this.coins) return null;

        const coinX = x ?? Phaser.Math.Between(200, this.worldWidth - 200);
        const coinY = y ?? Phaser.Math.Between(200, this.worldHeight - 200);

        const centerX = this.worldWidth / 2;
        const centerY = this.worldHeight / 2;
        const distance = Phaser.Math.Distance.Between(coinX, coinY, centerX, centerY);

        if (distance < 150 && x === null && y === null) {
            return this.spawnCoin();
        }

        const coin = this.coins.get(coinX, coinY, 'cosmicCoin');
        if (!coin) {
            console.warn('game:warn [GameScene] Could not create coin (group full)');
            return null;
        }

        coin.setActive(true);
        coin.setVisible(true);
        coin.setScale(1.0);
        coin.setDepth(1000);

        coin.setData('originalX', coinX);
        coin.setData('originalY', coinY);
        coin.setData('value', 10);

        this.tweens.add({
            targets: coin,
            y: coinY - 8,
            duration: 1500,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        this.tweens.add({
            targets: coin,
            angle: 360,
            duration: 4000,
            repeat: -1
        });

        this.tweens.add({
            targets: coin,
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        return coin;
    }

    handleCoinCollection(player, coin) {
        if (!coin?.active) return;

        const coinValue = coin.getData('value') ?? 10;

        this.tweens.add({
            targets: coin,
            x: player.x,
            y: player.y,
            scaleX: 0.5,
            scaleY: 0.5,
            alpha: 1,
            duration: 200,
            ease: 'Power2',
            onComplete: () => {
                window.EconomyManager?.addCoins?.(coinValue, 'collection');
                this.createCollectionParticles(coin.x, coin.y);
                window.AudioManager?.playCoinCollect?.();
                window.FeedbackManager?.trigger?.('coin', this);

                coin.setActive(false);
                coin.setVisible(false);
                this.tweens.killTweensOf(coin);

                const respawnTime = Phaser.Math.Between(45000, 60000);
                const timer = this.time.delayedCall(respawnTime, () => {
                    this.respawnCoin(coin);
                });

                this.coinRespawnTimers.push(timer);
                console.log(`game:info [GameScene] Collected ${coinValue} cosmic coins. Respawn in ${respawnTime / 1000}s`);
            }
        });
    }

    respawnCoin(coin) {
        if (!coin) return;

        const originalX = coin.getData('originalX');
        const originalY = coin.getData('originalY');

        coin.setPosition(originalX, originalY);
        coin.setActive(true);
        coin.setVisible(true);
        coin.setAlpha(0);
        coin.setScale(0.5);

        this.tweens.add({
            targets: coin,
            alpha: 1,
            scaleX: 1.0,
            scaleY: 1.0,
            duration: 500,
            ease: 'Back.easeOut'
        });

        this.tweens.add({
            targets: coin,
            y: originalY - 8,
            duration: 1500,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        this.tweens.add({
            targets: coin,
            angle: 360,
            duration: 4000,
            repeat: -1
        });

        this.tweens.add({
            targets: coin,
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        console.log('game:info [GameScene] Coin respawned at', originalX, originalY);
    }

    createCollectionParticles(x, y) {
        const particles = this.add.particles(x, y, 'cosmicCoin', {
            speed: { min: 50, max: 150 },
            scale: { start: 0.4, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 600,
            gravityY: -100,
            quantity: 8,
            blendMode: 'ADD'
        });

        this.time.delayedCall(700, () => particles.destroy());
    }

    registerEnemyManagerListener(event, handler) {
        if (!window.EnemyManager || typeof window.EnemyManager.on !== 'function' || typeof handler !== 'function') {
            return;
        }
        window.EnemyManager.on(event, handler);
        this.enemyManagerListeners.push({ event, handler });
    }

    createEnemies() {
        console.log('game:info [GameScene] Initializing friendly enemies');

        this.graphicsEngine?.createVoidWisp?.();
        this.graphicsEngine?.createShadowSprite?.();

        this.enemies = this.physics.add.group({ maxSize: 6 });
        this.projectiles = this.physics.add.group({ maxSize: 20 });

        if (window.ProjectileManager) {
            window.ProjectileManager.setup(this, this.projectiles, this.enemies);
        }

        if (window.EnemyManager) {
            window.EnemyManager.startSpawning(this, this.enemies, this.player, this.worldWidth, this.worldHeight);
            const calmHandler = (data) => this.handleEnemyCalmed(data);
            this.registerEnemyManagerListener('wispCalmed', calmHandler);
        } else {
            console.warn('[GameScene] EnemyManager not available');
        }

        if (this.player && this.enemies) {
            this.physics.add.collider(this.player, this.enemies, () => {
                if (window.UXEnhancements) {
                    window.UXEnhancements.announce('Stay cozy! Use gentle attacks to calm wisps.', 'polite');
                }
            });
        }
    }

    handleEnemyCalmed(data = {}) {
        const x = data.x ?? this.player?.x ?? 0;
        const y = data.y ?? this.player?.y ?? 0;
        const type = data.type ?? 'voidWisp';
        this.createEnemyCalmParticles(x, y, type);

        if (data.coinDrop && this.economyHud?.showFloatingCoinText) {
            this.economyHud.showFloatingCoinText(data.coinDrop);
        }
    }

    createEnemyCalmParticles(x, y, enemyType) {
        const particleColor = enemyType === 'shadowSprite' ? 0x6A5ACD : 0x8B00D9;
        const textureKey = `enemyParticle_${enemyType}`;

        if (!this.textures.exists(textureKey)) {
            const graphics = this.add.graphics();
            graphics.fillStyle(particleColor, 1);
            graphics.fillCircle(4, 4, 4);
            graphics.generateTexture(textureKey, 8, 8);
            graphics.destroy();
        }

        const particles = this.add.particles(x, y, textureKey, {
            speed: { min: 80, max: 170 },
            scale: { start: 1.0, end: 0 },
            alpha: { start: 0.8, end: 0 },
            lifespan: 900,
            gravityY: 40,
            quantity: 12,
            blendMode: 'ADD',
            angle: { min: 0, max: 360 }
        });

        this.time.delayedCall(1000, () => particles.destroy());
    }

    setupInput() {
        if (!this.input || !this.input.keyboard) {
            console.warn('[GameScene] Keyboard input not ready');
            return;
        }

        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasdKeys = this.input.keyboard.addKeys('W,S,A,D');
        this.chatKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T); // T for Talk (AI chat)
        this.feedKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
        this.playKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Y); // Y for plaY (P is for Profile)
        this.restKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        this.careKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.inventoryKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I);
        this.combatKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
        this.shopKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.breedingKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);
        this.hubKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H);
        this.timeSlowKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q); // Q for time-slow ability

        // DEV MODE: Add coins with backtick key (`) for testing
        if (import.meta.env.DEV) {
            this.input.keyboard.on('keydown-BACK_QUOTE', () => {
                if (window.EconomyManager) {
                    window.EconomyManager.addCoins(1000, 'dev_cheat');
                    console.log('[DEV] Added 1000 coins for testing');
                    // Show floating text near player
                    const devText = this.add.text(this.player.x, this.player.y - 50, '+1000 DEV', {
                        fontSize: '20px',
                        color: '#00FF00',
                        fontStyle: 'bold',
                        stroke: '#000000',
                        strokeThickness: 3
                    }).setOrigin(0.5).setDepth(2000);
                    this.tweens.add({
                        targets: devText,
                        y: devText.y - 60,
                        alpha: 0,
                        duration: 1500,
                        onComplete: () => devText.destroy()
                    });
                }
            });
            // Also add with = key as backup
            this.input.keyboard.on('keydown-PLUS', () => {
                if (window.EconomyManager) {
                    window.EconomyManager.addCoins(500, 'dev_cheat');
                    console.log('[DEV] Added 500 coins for testing');
                }
            });

            // DEV MODE: Cycle lifecycle stages with L key (QA tool for testing)
            this.devStageIndex = 0;
            const stageOrder = ['baby', 'juvenile', 'adult', 'elder'];
            const stageDaysL = { baby: 0, juvenile: 1, adult: 2, elder: 9 };
            this.input.keyboard.on('keydown-L', () => {
                // Cycle to next stage
                this.devStageIndex = (this.devStageIndex + 1) % stageOrder.length;
                const newStage = stageOrder[this.devStageIndex];
                const now = Date.now();
                const newBirthDate = now - (stageDaysL[newStage] * 24 * 60 * 60 * 1000);

                // Update GameState lifecycle stage
                if (window.GameState) {
                    window.GameState.set('creature.lifecycle.stage', newStage);
                    window.GameState.set('creature.lifecycle.birthDate', newBirthDate);
                    window.GameState.set('creature.lifecycle.lastStageChange', now);

                    // ALSO update the creature in the creatures array (for FusionPod eligibility)
                    const creatures = window.GameState.get('creatures') || [];
                    const activeIndex = window.GameState.get('activeCreatureIndex') || 0;
                    if (creatures[activeIndex]) {
                        if (!creatures[activeIndex].lifecycle) {
                            creatures[activeIndex].lifecycle = { evolutionHistory: [] };
                        }
                        creatures[activeIndex].lifecycle.stage = newStage;
                        creatures[activeIndex].lifecycle.birthDate = newBirthDate;
                        creatures[activeIndex].lifecycle.lastStageChange = now;
                        window.GameState.set('creatures', creatures);
                    }

                    console.log(`[DEV QA] Switched lifecycle stage to: ${newStage}`);

                    // Force creature refresh with new stage
                    this.refreshCreatureDisplay();

                    // Show visual feedback
                    const stageIcons = { baby: '🐣', juvenile: '🌱', adult: '✨', elder: '👑' };
                    const stageText = this.add.text(this.player.x, this.player.y - 60,
                        `${stageIcons[newStage]} ${newStage.toUpperCase()}`, {
                        fontSize: '24px',
                        color: '#FFD700',
                        fontStyle: 'bold',
                        stroke: '#000000',
                        strokeThickness: 4
                    }).setOrigin(0.5).setDepth(2000);

                    this.tweens.add({
                        targets: stageText,
                        y: stageText.y - 80,
                        alpha: 0,
                        scale: 1.5,
                        duration: 2000,
                        onComplete: () => stageText.destroy()
                    });

                    if (window.AudioManager) {
                        window.AudioManager.playLevelUp?.();
                    }
                }
            });

            console.log('[DEV MODE] Press ` (backtick) for +1000 coins, + for +500 coins, L for lifecycle stage cycle');
        }

        // === SECRET OWNER CHEATS (work in production) ===
        // These are hidden cheats for game owners/testers - not documented publicly
        // Key combos are obscure enough that players won't accidentally trigger them
        this.setupSecretCheats();

        this.joystickX = 0;
        this.joystickY = 0;

        this.virtualJoystickHandler = (data = {}) => {
            this.joystickX = data.x ?? 0;
            this.joystickY = data.y ?? 0;
        };

        this.virtualKeyHandler = (data = {}) => {
            if (data.key === 'space' && data.type === 'down') {
                this.handleSpaceInteraction();
            }
            if (data.key === 'care' && data.type === 'down') {
                this.toggleCarePanel();
            }
        };

        if (this.game?.events) {
            this.game.events.on('virtual-joystick', this.virtualJoystickHandler, this);
            this.game.events.on('virtual-key', this.virtualKeyHandler, this);
        }

        const resumeAudio = () => {
            try {
                window.AudioManager?.resume?.();
            } catch (error) {
                console.warn('[GameScene] Audio resume failed', error);
            }
        };

        this.input.once('pointerdown', resumeAudio);
        this.input.keyboard.once('keydown', resumeAudio);
    }

    getHudController() {
        if (!this.hudController) {
            this.hudController = new GameSceneHudController(this);
        }

        return this.hudController;
    }

    createResetButton() {
        return this.getHudController().createResetButton();
    }

    createDailyBonusButton() {
        return this.getHudController().createDailyBonusButton();
    }

    updateDailyBonusButton() {
        return this.getHudController().updateDailyBonusButton();
    }

    claimDailyBonus() {
        return this.getHudController().claimDailyBonus();
    }

    createCombatButton() {
        return this.getHudController().createCombatButton();
    }

    showWelcomeToastIfNeeded() {
        return this.getHudController().showWelcomeToastIfNeeded();
    }

    showVoidReturnToast(voidScore) {
        return this.getHudController().showVoidReturnToast(voidScore);
    }

    createCosmicMiniMap() {
        return this.getHudController().createCosmicMiniMap();
    }

    updateCosmicMiniMap() {
        return this.getHudController().updateCosmicMiniMap();
    }

    createGlowingStatBars() {
        return this.getHudController().createGlowingStatBars();
    }

    updateGlowingStatBars() {
        return this.getHudController().updateGlowingStatBars();
    }

    hideDesktopUIOnMobile() {
        return this.getHudController().hideDesktopUIOnMobile();
    }

    toggleCarePanel() {
        this.carePanelManager?.togglePanel();
    }

    createFloatingParticles() {
        this.floatingParticles.forEach((particle) => particle.destroy());
        this.floatingParticles = [];

        if (!this.textures.exists('magicalSparkle')) {
            return;
        }

        const emitter = this.add.particles(0, 0, 'magicalSparkle', {
            x: { min: 0, max: this.scale.width },
            y: { min: 0, max: 200 },
            lifespan: 4000,
            speedY: { min: 10, max: 40 },
            scale: { start: 0.4, end: 0 },
            alpha: { start: 0.8, end: 0 },
            quantity: 1,
            frequency: 600,
            tint: [0x00CED1, 0xFFD700, 0x9370DB],
            blendMode: 'ADD'
        });
        emitter.setScrollFactor(0);
        emitter.setDepth(200);
        this.floatingParticles.push(emitter);
    }

    createUI() {
        this.getHudController().createUI();

        // Skill bar disabled - using AbilityHUD (bond-based) instead
        // The SkillBar (affinity-based skills) created duplicate UI with AbilityHUD
        // TODO: Consider merging or differentiating these systems in the future
        // this.createSkillBar();

        // Create the remaining lightweight overlays that stay local to GameScene
        this.createFloatingParticles();

        // Only show personality display on mobile (desktop UI is simplified)
        const isMobileDevice = 'ontouchstart' in window && window.innerWidth < 768;
        if (isMobileDevice) {
            this.createPersonalityDisplay();
        }

        // Create roster indicator
        this.createRosterIndicator();
    }

    /**
     * Create the skill bar UI for creature abilities
     */
    createSkillBar() {
        if (!window.CreatureSkills) return;

        const { width, height } = this.scale;
        const skills = window.CreatureSkills.getCurrentCreatureSkills();

        if (skills.length === 0) return;

        // Position skill bar at bottom center
        const barY = height - 100;
        const skillSize = 50;
        const spacing = 10;
        const totalWidth = skills.length * (skillSize + spacing) - spacing;
        const startX = (width - totalWidth) / 2;

        this.skillBarElements = [];

        skills.forEach((skill, index) => {
            const x = startX + index * (skillSize + spacing) + skillSize / 2;

            // Skill background
            const bg = this.add.graphics();
            bg.fillStyle(skill.isUnlocked ? 0x2A2A4E : 0x1A1A2E, 0.9);
            bg.fillRoundedRect(x - skillSize / 2, barY - skillSize / 2, skillSize, skillSize, 8);
            bg.lineStyle(2, skill.isUnlocked ? skill.affinityColor : 0x555555);
            bg.strokeRoundedRect(x - skillSize / 2, barY - skillSize / 2, skillSize, skillSize, 8);
            bg.setScrollFactor(0);
            bg.setDepth(3500);

            // Skill icon
            const icon = this.add.text(x, barY - 5, skill.icon, {
                fontSize: skill.isUnlocked ? '24px' : '18px',
                color: skill.isUnlocked ? '#FFFFFF' : '#555555'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(3501);

            // Key binding text (1, 2, 3)
            const keyText = this.add.text(x, barY + 18, `${index + 1}`, {
                fontSize: '12px',
                color: skill.isUnlocked ? '#FFD700' : '#555555',
                fontStyle: 'bold'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(3501);

            // Cooldown overlay
            const cooldownOverlay = this.add.graphics();
            cooldownOverlay.setScrollFactor(0);
            cooldownOverlay.setDepth(3502);
            cooldownOverlay.setVisible(false);

            // Lock icon for locked skills
            let lockIcon = null;
            if (!skill.isUnlocked) {
                lockIcon = this.add.text(x, barY - 5, '🔒', {
                    fontSize: '14px'
                }).setOrigin(0.5).setScrollFactor(0).setDepth(3503);
            }

            // Make interactive
            const hitArea = this.add.zone(x, barY, skillSize, skillSize);
            hitArea.setScrollFactor(0);
            hitArea.setDepth(3504);
            hitArea.setInteractive({ useHandCursor: skill.isUnlocked });

            hitArea.on('pointerdown', () => {
                if (skill.isUnlocked) {
                    this.useSkill(skill.id);
                } else {
                    this.showInteractionHint(`🔒 Unlocks at Level ${skill.unlockLevel}`);
                }
            });

            hitArea.on('pointerover', () => {
                this.showSkillTooltip(skill, x, barY - skillSize);
            });

            hitArea.on('pointerout', () => {
                this.hideSkillTooltip();
            });

            this.skillBarElements.push({
                skill,
                bg,
                icon,
                keyText,
                cooldownOverlay,
                lockIcon,
                hitArea,
                x,
                y: barY
            });
        });

        // Set up keyboard shortcuts (1, 2, 3)
        this.input.keyboard.on('keydown-ONE', () => this.useSkillByIndex(0));
        this.input.keyboard.on('keydown-TWO', () => this.useSkillByIndex(1));
        this.input.keyboard.on('keydown-THREE', () => this.useSkillByIndex(2));
    }

    /**
     * Use a skill by its index in the skill bar
     */
    useSkillByIndex(index) {
        const skills = window.CreatureSkills?.getCurrentCreatureSkills();
        if (!skills || index >= skills.length) return;

        const skill = skills[index];
        if (skill.isUnlocked) {
            this.useSkill(skill.id);
        } else {
            this.showInteractionHint(`🔒 Unlocks at Level ${skill.unlockLevel}`);
        }
    }

    /**
     * Use a creature skill
     */
    useSkill(skillId) {
        if (!window.CreatureSkills) return;

        const result = window.CreatureSkills.useSkill(this, skillId);

        if (result.success) {
            this.showInteractionHint(result.message);
            this.updateSkillBarCooldowns();
        } else if (result.reason === 'cooldown') {
            const seconds = Math.ceil(result.remaining / 1000);
            this.showInteractionHint(`⏳ Skill on cooldown: ${seconds}s`);
        }
    }

    /**
     * Update skill bar cooldown displays
     */
    updateSkillBarCooldowns() {
        if (!this.skillBarElements || !window.CreatureSkills) return;

        this.skillBarElements.forEach(element => {
            const remaining = window.CreatureSkills.getCooldownRemaining(element.skill.id);

            if (remaining > 0) {
                // Show cooldown overlay
                const progress = remaining / element.skill.cooldown;
                element.cooldownOverlay.clear();
                element.cooldownOverlay.fillStyle(0x000000, 0.7);
                element.cooldownOverlay.fillRect(
                    element.x - 25,
                    element.y - 25,
                    50,
                    50 * progress
                );
                element.cooldownOverlay.setVisible(true);
            } else {
                element.cooldownOverlay.setVisible(false);
            }
        });
    }

    /**
     * Show skill tooltip
     */
    showSkillTooltip(skill, x, y) {
        this.hideSkillTooltip();

        const tooltipWidth = 200;
        const tooltipHeight = 100;

        this.skillTooltipBg = this.add.graphics();
        this.skillTooltipBg.fillStyle(0x1A1A3E, 0.95);
        this.skillTooltipBg.fillRoundedRect(x - tooltipWidth / 2, y - tooltipHeight - 10, tooltipWidth, tooltipHeight, 8);
        this.skillTooltipBg.lineStyle(2, skill.affinityColor);
        this.skillTooltipBg.strokeRoundedRect(x - tooltipWidth / 2, y - tooltipHeight - 10, tooltipWidth, tooltipHeight, 8);
        this.skillTooltipBg.setScrollFactor(0);
        this.skillTooltipBg.setDepth(4000);

        this.skillTooltipText = this.add.text(x, y - tooltipHeight + 10,
            `${skill.icon} ${skill.name}\n\n${skill.description}\n\nCooldown: ${skill.cooldown / 1000}s`, {
            fontSize: '12px',
            color: '#FFFFFF',
            align: 'center',
            wordWrap: { width: tooltipWidth - 20 }
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(4001);
    }

    /**
     * Hide skill tooltip
     */
    hideSkillTooltip() {
        this.skillTooltipBg?.destroy();
        this.skillTooltipText?.destroy();
        this.skillTooltipBg = null;
        this.skillTooltipText = null;
    }

    /**
     * Cleanup skill bar elements
     */
    cleanupSkillBar() {
        if (this.skillBarElements) {
            this.skillBarElements.forEach(element => {
                element.bg?.destroy();
                element.icon?.destroy();
                element.keyText?.destroy();
                element.cooldownOverlay?.destroy();
                element.lockIcon?.destroy();
                element.hitArea?.removeAllListeners();
                element.hitArea?.destroy();
            });
            this.skillBarElements = null;
        }
        this.hideSkillTooltip();

        // Remove keyboard listeners (will be re-added in createSkillBar)
        if (this.input?.keyboard) {
            this.input.keyboard.off('keydown-ONE');
            this.input.keyboard.off('keydown-TWO');
            this.input.keyboard.off('keydown-THREE');
        }
    }

    /**
     * Refresh skill bar (for creature switching)
     */
    refreshSkillBar() {
        this.cleanupSkillBar();
        this.createSkillBar();
    }

    /**
     * Create roster indicator UI
     */
    createRosterIndicator() {
        const { width, height } = this.scale;
        const status = window.GameState?.getCollectionStatus() || { count: 1, max: 8, activeIndex: 0 };
        const creatures = window.GameState?.getCreatureCollection() || [];
        const isMobile = this.isMobile();

        this.rosterElements = [];
        this.rosterCountText = null;
        if (creatures.length < 2) {
            return;
        }

        // Position: On mobile, position below hamburger menu area (~120px from top)
        // On desktop, position in top-left below header
        const baseX = 16;
        const baseY = isMobile ? 120 : 85;

        // Background panel
        const panelWidth = isMobile ? 160 : 180;
        const panelHeight = 32;
        const rosterBg = this.add.graphics();
        rosterBg.fillStyle(0x1A1A3E, 0.85);
        rosterBg.fillRoundedRect(baseX, baseY, panelWidth, panelHeight, 8);
        rosterBg.lineStyle(2, 0x7B68EE);
        rosterBg.strokeRoundedRect(baseX, baseY, panelWidth, panelHeight, 8);
        rosterBg.setScrollFactor(0);
        rosterBg.setDepth(1000);
        this.rosterElements.push(rosterBg);

        // Creature icon
        const creatureIcon = this.add.text(baseX + 12, baseY + 16, '🐾', {
            fontSize: '16px'
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(1001);
        this.rosterElements.push(creatureIcon);

        // Roster count text
        this.rosterCountText = this.add.text(baseX + 35, baseY + 16, `${status.count}/${status.max}`, {
            fontSize: '14px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(1001);
        this.rosterElements.push(this.rosterCountText);

        // Switch button (only show if more than 1 creature)
        if (creatures.length > 1) {
            const switchBtn = this.add.text(baseX + panelWidth - 10, baseY + 16, `[Tab] Switch`, {
                fontSize: '11px',
                color: '#88FFCC',
                fontStyle: 'bold'
            }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(1001);
            this.rosterElements.push(switchBtn);

            // Make the panel interactive
            const hitArea = this.add.zone(baseX + panelWidth / 2, baseY + panelHeight / 2, panelWidth, panelHeight);
            hitArea.setScrollFactor(0);
            hitArea.setDepth(1002);
            hitArea.setInteractive({ useHandCursor: true });
            hitArea.on('pointerdown', () => this.showCreatureSwitcher());
            hitArea.on('pointerover', () => {
                rosterBg.clear();
                rosterBg.fillStyle(0x2A2A5E, 0.95);
                rosterBg.fillRoundedRect(baseX, baseY, panelWidth, panelHeight, 8);
                rosterBg.lineStyle(2, 0xFFD700);
                rosterBg.strokeRoundedRect(baseX, baseY, panelWidth, panelHeight, 8);
            });
            hitArea.on('pointerout', () => {
                rosterBg.clear();
                rosterBg.fillStyle(0x1A1A3E, 0.85);
                rosterBg.fillRoundedRect(baseX, baseY, panelWidth, panelHeight, 8);
                rosterBg.lineStyle(2, 0x7B68EE);
                rosterBg.strokeRoundedRect(baseX, baseY, panelWidth, panelHeight, 8);
            });
            this.rosterElements.push(hitArea);
        }
    }

    /**
     * Refresh roster indicator display
     */
    refreshRosterIndicator() {
        // Cleanup existing
        if (this.rosterElements) {
            this.rosterElements.forEach(el => {
                el?.removeAllListeners?.();
                el?.destroy?.();
            });
            this.rosterElements = null;
        }
        this.createRosterIndicator();
    }

    /**
     * Helper to check if running on mobile device
     */
    isMobile() {
        return 'ontouchstart' in window && window.innerWidth < 768;
    }

    /**
     * Show creature switcher modal
     */
    showCreatureSwitcher() {
        if (!this.creatureSwitcher) {
            this.creatureSwitcher = new CreatureSwitcherModal(this);
        }

        this.creatureSwitcher.show((newIndex) => {
            // Callback when creature is switched
            this.refreshCreatureDisplay();
            console.log('[GameScene] Switched to creature index:', newIndex);
        });
    }

    /**
     * Cycle to next creature in roster (Tab key)
     */
    cycleToNextCreature() {
        const creatures = window.GameState?.getCreatureCollection() || [];
        if (creatures.length <= 1) {
            this.showInteractionHint('Only one creature in roster');
            return;
        }

        const currentIndex = window.GameState?.get('activeCreatureIndex') || 0;
        const nextIndex = (currentIndex + 1) % creatures.length;
        const nextCreature = creatures[nextIndex];

        if (window.GameState?.switchActiveCreature(nextIndex)) {
            this.refreshCreatureDisplay();
            this.showInteractionHint(`Switched to ${nextCreature.name}`);

            if (window.AudioManager) {
                window.AudioManager.playButtonClick?.();
            }
            console.log(`[GameScene] Cycled to creature ${nextIndex}: ${nextCreature.name}`);
        }
    }

    /**
     * Regenerate player texture if corrupted or missing
     * @param {Object} genes - Creature genetics
     * @param {Object} gameState - GameState instance
     */
    regeneratePlayerTexture(genes, gameState) {
        if (!genes) {
            console.error('[GameScene] Cannot regenerate texture without genes');
            return;
        }

        console.log('[GameScene] Regenerating player texture...');

        try {
            // Use loadCreatureFromGameState for consistency
            const result = this.graphicsEngine.loadCreatureFromGameState(0);

            if (result && result.textureName && this.textures.exists(result.textureName)) {
                this.player.setTexture(result.textureName);
                console.log('[GameScene] Successfully regenerated texture:', result.textureName);
                this.playerGenetics = genes;
            } else {
                console.error('[GameScene] Failed to regenerate texture');
            }
        } catch (error) {
            console.error('[GameScene] Error during texture regeneration:', error);
        }
    }

    /**
     * Refresh creature display after switching
     * Includes visual transition animation
     */
    refreshCreatureDisplay() {
        const gameState = getGameState();

        // Use getActiveCreature for reliable data from collection
        const activeCreature = gameState.getActiveCreature?.();
        const genes = activeCreature?.genes || activeCreature?.dna || gameState.get('creature.genes');
        const creatureName = activeCreature?.name || gameState.get('creature.name');

        console.log('[GameScene] refreshCreatureDisplay called for:', creatureName);

        if (!this.player) {
            console.warn('[GameScene] Cannot refresh - player sprite not found');
            return;
        }

        if (!this.graphicsEngine) {
            console.warn('[GameScene] Cannot refresh - graphicsEngine not available');
            return;
        }

        // Store player position for animation
        const playerX = this.player.x;
        const playerY = this.player.y;

        // Phase 1: Fade out old creature with shrink effect
        this.tweens.add({
            targets: this.player,
            alpha: 0,
            scaleX: 0.5,
            scaleY: 0.5,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
                // Generate new texture with CORRECT LIFECYCLE STAGE
                let newTextureName = null;

                // Get creature's current lifecycle stage (baby/juvenile/adult/elder)
                const lifecycle = gameState.get('creature.lifecycle');
                const currentStage = lifecycle?.stage || 'baby';

                if (genes) {
                    try {
                        // Try DNA-based rendering first WITH STAGE
                        if (activeCreature?.dna) {
                            const result = this.graphicsEngine.createCreatureFromDNA(activeCreature.dna, 0, currentStage);
                            if (result?.textureName) {
                                newTextureName = result.textureName;
                            }
                        }
                        // Fall back to genes-based rendering WITH STAGE
                        if (!newTextureName) {
                            const result = this.graphicsEngine.createRandomizedSpaceMythicCreature(genes, 0, currentStage);
                            if (result?.textureName) {
                                newTextureName = result.textureName;
                            }
                        }
                    } catch (error) {
                        console.error('[GameScene] Error generating creature texture:', error);
                    }
                }

                // Fallback to stored texture
                if (!newTextureName) {
                    const storedTexture = activeCreature?.textureName || gameState.get('creature.textureName');
                    if (storedTexture && this.textures.exists(storedTexture)) {
                        newTextureName = storedTexture;
                    }
                }

                if (newTextureName) {
                    // CRITICAL: Verify texture exists and is valid before setting
                    if (this.textures.exists(newTextureName)) {
                        try {
                            const texture = this.textures.get(newTextureName);
                            // Verify texture has valid source
                            if (texture && texture.source && texture.source.length > 0) {
                                this.player.setTexture(newTextureName);
                                console.log('[GameScene] Creature texture updated to:', newTextureName);

                                // Update stored genetics
                                this.playerGenetics = genes;
                            } else {
                                console.error('[GameScene] Texture exists but has invalid source:', newTextureName);
                                // Regenerate texture
                                this.regeneratePlayerTexture(genes, gameState);
                            }
                        } catch (error) {
                            console.error('[GameScene] Error setting texture:', error);
                            this.regeneratePlayerTexture(genes, gameState);
                        }
                    } else {
                        console.warn('[GameScene] Texture does not exist:', newTextureName);
                        // Try to regenerate
                        this.regeneratePlayerTexture(genes, gameState);
                    }
                } else {
                    console.warn('[GameScene] No valid texture found for creature');
                    this.regeneratePlayerTexture(genes, gameState);
                }

                // Phase 2: Fade in new creature with grow effect
                this.player.setScale(0.5);
                this.tweens.add({
                    targets: this.player,
                    alpha: 1,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 300,
                    ease: 'Back.easeOut',
                    onComplete: () => {
                        // Create sparkle effect to celebrate the switch
                        if (window.FXLibrary) {
                            window.FXLibrary.stardustBurst(this, playerX, playerY - 30, {
                                count: 15,
                                color: [0x7B68EE, 0xFFD700, 0x00FFFF],
                                duration: 1000
                            });
                        }
                    }
                });
            }
        });

        // Update all displays (don't wait for animation)
        this.updateStatsDisplay();
        this.mobileHUD?.updateStats();

        // Update creature name display if it exists
        if (this.creatureNameText) {
            this.creatureNameText.setText(creatureName || 'Your Creature');
        }

        // Refresh skill bar for new creature's abilities
        this.refreshSkillBar();

        // Refresh roster indicator
        this.refreshRosterIndicator();

        // Play switch sound
        if (window.AudioManager) {
            window.AudioManager.playLevelUp?.(); // Use level up sound for more celebratory feel
        }

        // CRITICAL: Refresh mobile controls to fix joystick responsiveness after creature switch
        // This recreates event handlers that may have become orphaned
        if (this.mobileControls) {
            this.mobileControls.refresh();
        }

        console.log('[GameScene] Creature display refreshed with animation - skills and roster updated');
    }

    /**
     * Create personality traits display
     * Shows current personality traits based on player behavior
     */
    createPersonalityDisplay() {
        const { width } = this.scale;
        const isMobile = this.isMobile();

        // On mobile, position below top bar and right-aligned
        // On desktop, position in upper right
        const yPos = isMobile ? 65 : 100;

        // Create compact personality panel
        this.personalityText = this.add.text(width - 16, yPos, '', {
            fontSize: isMobile ? '11px' : '12px',
            color: '#88FFCC',
            stroke: '#000000',
            strokeThickness: 2,
            backgroundColor: 'rgba(0, 30, 30, 0.75)',
            padding: { x: 6, y: 3 },
            align: 'right',
            lineSpacing: 2
        });
        this.personalityText.setOrigin(1, 0);
        this.personalityText.setScrollFactor(0);
        this.personalityText.setDepth(1000);

        // Update personality display
        this.updatePersonalityDisplay();

        // Set up periodic updates (every 5 seconds)
        this.time.addEvent({
            delay: 5000,
            callback: () => this.updatePersonalityDisplay(),
            loop: true
        });

        // Listen for personality shifts
        if (window.GameState && typeof window.GameState.on === 'function') {
            window.GameState.on('personality/shift', (data) => {
                this.showPersonalityShiftNotification(data);
            });
        }
    }

    /**
     * Show personality shift notification
     * Displays a toast when creature's personality traits change
     */
    showPersonalityShiftNotification(data) {
        if (!data || !data.shifts || data.shifts.length === 0) return;

        const shift = data.shifts[0]; // Show first shift
        const { width, height } = this.scale;

        // Create floating notification
        const notification = this.add.graphics();
        notification.fillStyle(0x1A1A3E, 0.95);
        notification.fillRoundedRect(0, 0, 300, 80, 10);
        notification.lineStyle(3, 0x88FFCC);
        notification.strokeRoundedRect(0, 0, 300, 80, 10);
        notification.setScrollFactor(0);
        notification.setDepth(5000);

        // Position at center of screen
        notification.setPosition(width / 2 - 150, height / 2 - 100);
        notification.setAlpha(0);

        // Title text
        const titleText = this.add.text(width / 2, height / 2 - 85, '🌟 Personality Shift!', {
            fontSize: '18px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        });
        titleText.setOrigin(0.5);
        titleText.setScrollFactor(0);
        titleText.setDepth(5001);
        titleText.setAlpha(0);

        // Shift details
        const detailsText = this.add.text(width / 2, height / 2 - 55,
            `${this.capitalizeFirst(shift.traitType)}:\n${shift.from} → ${shift.to}`,
            {
                fontSize: '16px',
                color: '#88FFCC',
                align: 'center',
                stroke: '#000000',
                strokeThickness: 2,
                lineSpacing: 4
            }
        );
        detailsText.setOrigin(0.5);
        detailsText.setScrollFactor(0);
        detailsText.setDepth(5001);
        detailsText.setAlpha(0);

        // Fade in animation
        this.tweens.add({
            targets: [notification, titleText, detailsText],
            alpha: 1,
            duration: 500,
            ease: 'Power2'
        });

        // Update personality display immediately
        this.updatePersonalityDisplay();

        // Play sound effect
        if (window.AudioManager) {
            window.AudioManager.playLevelUp?.(); // Reuse level up sound for personality shifts
        }

        // Fade out and destroy after 3 seconds
        this.time.delayedCall(3000, () => {
            this.tweens.add({
                targets: [notification, titleText, detailsText],
                alpha: 0,
                duration: 500,
                ease: 'Power2',
                onComplete: () => {
                    notification.destroy();
                    titleText.destroy();
                    detailsText.destroy();
                }
            });
        });

        console.log('[GameScene] Personality shift notification shown:', shift);
    }

    /**
     * Capitalize first letter of a string
     */
    capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Show floating text animation (for XP gains, level ups, etc.)
     */
    showFloatingText(text, x, y, color = '#FFD700') {
        const floatingText = this.add.text(x, y, text, {
            fontSize: '24px',
            color: color,
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(5000);

        // Convert world position to screen position if player exists
        if (this.player) {
            const camera = this.cameras.main;
            floatingText.setScrollFactor(0);
            floatingText.setPosition(
                x - camera.scrollX,
                y - camera.scrollY
            );
        }

        this.tweens.add({
            targets: floatingText,
            y: floatingText.y - 80,
            alpha: { from: 1, to: 0 },
            scale: { from: 1, to: 1.5 },
            duration: 1500,
            ease: 'Power2',
            onComplete: () => floatingText.destroy()
        });
    }

    /**
     * Show level up celebration with visual effects
     */
    showLevelUpCelebration(data) {
        const { width, height } = this.scale;
        const newLevel = data?.newLevel || window.GameState?.get('creature.level') || 1;
        const creatureName = window.GameState?.get('creature.name') || 'Your creature';

        // Trigger haptic feedback and screen shake
        if (window.FeedbackManager) {
            window.FeedbackManager.vibrate('levelUp');
        }

        // Screen flash
        const flash = this.add.graphics();
        flash.fillStyle(0xFFD700, 0.4);
        flash.fillRect(0, 0, width, height);
        flash.setScrollFactor(0);
        flash.setDepth(4500);

        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 600,
            onComplete: () => flash.destroy()
        });

        // Level up text
        const levelText = this.add.text(width / 2, height / 2 - 50, `⭐ LEVEL UP! ⭐`, {
            fontSize: '36px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5).setScrollFactor(0).setDepth(4600).setAlpha(0).setScale(0.5);

        const detailText = this.add.text(width / 2, height / 2 + 10, `${creatureName} is now Level ${newLevel}!`, {
            fontSize: '20px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(4600).setAlpha(0);

        // Check for newly unlocked skills
        const skills = window.CreatureSkills?.getCurrentCreatureSkills() || [];
        const newSkills = skills.filter(s => s.unlockLevel === newLevel);
        let skillUnlockText = null;

        if (newSkills.length > 0) {
            const skillNames = newSkills.map(s => `${s.icon} ${s.name}`).join(', ');
            skillUnlockText = this.add.text(width / 2, height / 2 + 50, `🔓 New Skill: ${skillNames}`, {
                fontSize: '18px',
                color: '#88FFCC',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5).setScrollFactor(0).setDepth(4600).setAlpha(0);
        }

        // Animate in
        this.tweens.add({
            targets: levelText,
            alpha: 1,
            scale: 1,
            duration: 400,
            ease: 'Back.easeOut'
        });

        this.tweens.add({
            targets: detailText,
            alpha: 1,
            duration: 400,
            delay: 200
        });

        if (skillUnlockText) {
            this.tweens.add({
                targets: skillUnlockText,
                alpha: 1,
                duration: 400,
                delay: 400
            });
        }

        // Particle burst effect
        if (window.FXLibrary) {
            const playerX = this.player?.x || width / 2;
            const playerY = this.player?.y || height / 2;
            window.FXLibrary.stardustBurst?.(this, playerX, playerY, {
                count: 30,
                color: [0xFFD700, 0xFFA500, 0xFFFFFF],
                duration: 2000
            });
        }

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playLevelUp?.();
        }

        // Refresh skill bar to show newly unlocked skills
        this.refreshSkillBar();

        // Fade out after 3 seconds
        this.time.delayedCall(3000, () => {
            const elementsToFade = [levelText, detailText];
            if (skillUnlockText) elementsToFade.push(skillUnlockText);

            this.tweens.add({
                targets: elementsToFade,
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    levelText.destroy();
                    detailText.destroy();
                    skillUnlockText?.destroy();
                }
            });
        });

        console.log(`[GameScene] Level up celebration shown for level ${newLevel}`);
    }

    /**
     * Update personality traits display
     */
    updatePersonalityDisplay() {
        if (!this.personalityText) return;

        const summary = window.PersonalitySystem?.getPersonalitySummary();
        if (!summary || !summary.traits) {
            this.personalityText.setVisible(false);
            return;
        }

        const { traits } = summary;

        // Build compact display string
        const lines = ['🧬 Personality'];

        if (traits.temperament) {
            lines.push(`💫 ${traits.temperament.label}`);
        }
        if (traits.energyLevel) {
            lines.push(`⚡ ${traits.energyLevel.label}`);
        }
        if (traits.curiosity) {
            lines.push(`🔍 ${traits.curiosity.label}`);
        }
        if (traits.attachmentStyle) {
            lines.push(`💛 ${traits.attachmentStyle.label}`);
        }

        this.personalityText.setText(lines.join('\n'));
        this.personalityText.setVisible(true);
    }

    fireCombatProjectile() {
        if (this.combatCooldown > 0) {
            return;
        }

        // Check if player is in target range - prioritize targets over enemies
        let target = null;
        let isTargetPractice = false;

        if (this.nearTargetRange && this.targetRange?.allTargets) {
            target = this.findNearestTarget();
            isTargetPractice = !!target;
        }

        // Fall back to enemies if not in range or no targets found
        if (!target) {
            target = this.findNearestEnemy();
        }

        if (!target) {
            if (this.nearTargetRange) {
                this.showInteractionHint('🎯 All targets hit! Wait for respawn.');
            } else {
                this.showInteractionHint('All calm! Explore or care for your buddy.');
            }
            return;
        }

        const genes = getGameState().get('creature.genes');
        const rarity = genes?.rarity || 'common';

        // Skip special abilities in target practice mode
        if (!isTargetPractice) {
            // Check for Nova Blast ability (AOE attack)
            if (window.SecretAbilityManager?.hasAbility('novaBlast')) {
                const novaResult = window.SecretAbilityManager.triggerAbility(
                    'novaBlast',
                    { x: this.player.x, y: this.player.y },
                    this,
                    target.x,
                    target.y
                );
                if (novaResult) {
                    // Nova blast triggered, skip normal projectile
                    this.combatCooldown = this.combatCooldownMax;
                    getGameState().emit('combatEngaged', {
                        targetX: target.x,
                        targetY: target.y,
                        timestamp: Date.now(),
                        ability: 'novaBlast'
                    });
                    return;
                }
            }

            // Check for Crystal Shield ability (defensive trigger on combat)
            if (window.SecretAbilityManager?.hasAbility('crystalShield')) {
                window.SecretAbilityManager.triggerAbility(
                    'crystalShield',
                    this.player,
                    this
                );
            }
        }

        window.AudioManager?.playAttack?.();
        window.ProjectileManager?.fireProjectile(
            this,
            this.player.x,
            this.player.y,
            target.x,
            target.y,
            rarity
        );

        // Track combat for personality shaping (skip for target practice)
        if (!isTargetPractice) {
            getGameState().emit('combatEngaged', {
                targetX: target.x,
                targetY: target.y,
                timestamp: Date.now()
            });
        }

        // Apply cooldown with potential reduction from abilities
        let cooldown = this.combatCooldownMax;
        if (window.SecretAbilityManager) {
            const passiveMods = window.SecretAbilityManager.getPassiveModifiers();
            cooldown = cooldown * (passiveMods.cooldownReduction || 1);
        }
        this.combatCooldown = cooldown;
        if (this.combatText) {
            this.tweens.add({
                targets: this.combatText,
                scale: { from: 1, to: 1.2 },
                duration: 100,
                yoyo: true
            });
        }
    }

    findNearestEnemy() {
        if (!this.enemies || !this.player) return null;
        const activeEnemies = this.enemies.getChildren().filter((enemy) => enemy.active);
        if (!activeEnemies.length) return null;

        let closest = null;
        let minDist = Infinity;
        activeEnemies.forEach((enemy) => {
            const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
            if (distance < minDist) {
                minDist = distance;
                closest = enemy;
            }
        });
        return closest;
    }

    /**
     * Find the nearest active target in the target practice range
     * @returns {Phaser.GameObjects.Sprite|null} Nearest target or null
     */
    findNearestTarget() {
        if (!this.targetRange?.allTargets || !this.player) return null;

        const activeTargets = this.targetRange.allTargets.filter(target =>
            target.active && target.visible
        );

        if (!activeTargets.length) return null;

        let closest = null;
        let minDist = Infinity;

        activeTargets.forEach(target => {
            const distance = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                target.x, target.y
            );
            if (distance < minDist) {
                minDist = distance;
                closest = target;
            }
        });

        return closest;
    }

    updateCombatCooldown(delta) {
        if (!this.combatCooldown || this.combatCooldown <= 0) {
            this.combatCooldown = 0;
            this.combatCooldownText?.setVisible(false);
            return;
        }

        this.combatCooldown = Math.max(0, this.combatCooldown - delta);
        if (this.combatCooldownText && this.combatCooldown > 0) {
            const seconds = (this.combatCooldown / 1000).toFixed(1);
            this.combatCooldownText.setText(`${seconds}s`);
            this.combatCooldownText.setVisible(true);
        }
    }

    showBonusClaimedMessage() {
        const bonusText = this.add.text(400, 100, '🎉 Daily Bonus Claimed!', {
            fontSize: '20px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: { x: 16, y: 8 }
        });
        bonusText.setOrigin(0.5);
        bonusText.setScrollFactor(0);

        // Announce to screen reader
        if (window.UXEnhancements) {
            window.UXEnhancements.announce('Daily bonus claimed successfully!', 'assertive');
        }

        this.tweens.add({
            targets: bonusText,
            scale: { from: 0.8, to: 1.2 },
            alpha: { from: 0, to: 1 },
            duration: 500,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.time.delayedCall(2000, () => {
                    this.tweens.add({
                        targets: bonusText,
                        alpha: 0,
                        duration: 500,
                        onComplete: () => bonusText.destroy()
                    });
                });
            }
        });
    }

    handleFlowerInteraction(player, flower) {
        // Only show hint once per flower interaction to prevent spam
        if (this.nearbyFlower !== flower) {
            if (this.currentBiome === 'nebula') {
                this.withdrawSanctuaryInteraction('flower');
                this.offerSanctuaryInteraction({
                    id: 'flower',
                    target: flower,
                    message: 'Press SPACE · Smell the flower',
                    icon: '🌸',
                    tone: 0x8FE3CF,
                    priority: 8,
                    action: () => this.smellNearbyFlower()
                });
            } else {
                this.showInteractionHint('Press SPACE to smell the flower');
                this.mobileControls?.updateInteractIcon('🌸');
            }

            // Track flower interaction for personality shaping
            // (Peaceful, gentle activity)
            if (window.PersonalitySystem && typeof window.PersonalitySystem.trackFlowerInteraction === 'function') {
                window.PersonalitySystem.trackFlowerInteraction();
            }
        }

        // Store reference to current flower for space key interaction
        this.nearbyFlower = flower;
    }

    isPlayerAtInteractionDistance(target, maxDistance = 150) {
        if (!this.player || !target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) {
            return false;
        }
        const distance = Phaser.Math.Distance.Between(
            this.player.x,
            this.player.y,
            target.x,
            target.y
        );
        return distance <= maxDistance;
    }

    isPlayerInInteractionRange(interactionType, target) {
        const interactionConfig = this.getInteractionDistance(interactionType);
        return this.isPlayerAtInteractionDistance(target, interactionConfig.enter);
    }

    shouldTreatInteractionAsAvailable(interactionType, target, interactionFlag) {
        if (!interactionType || !target) {
            if (interactionFlag && Object.prototype.hasOwnProperty.call(this, interactionFlag)) {
                this[interactionFlag] = false;
            }
            return false;
        }

        const inRange = this.isPlayerInInteractionRange(interactionType, target);
        if (Object.prototype.hasOwnProperty.call(this, interactionFlag)) {
            if (inRange) {
                this[interactionFlag] = true;
            } else if (this[interactionFlag]) {
                this[interactionFlag] = false;
            }
        }

        return inRange;
    }

    getInteractionDistance(interactionType, fallbackEnter = 150, fallbackClear = 180) {
        const config = this.interactionDistance?.[interactionType];
        if (!config) {
            return {
                enter: fallbackEnter,
                clear: fallbackClear
            };
        }

        return {
            enter: Number.isFinite(config.enter) && config.enter > 0
                ? config.enter
                : fallbackEnter,
            clear: Number.isFinite(config.clear) && config.clear > 0
                ? config.clear
                : (Number.isFinite(config.enter) && config.enter > 0
                    ? config.enter + 30
                    : fallbackClear)
        };
    }

    isPlayerNear(interactionType, target, useClearDistance = false) {
        const { enter, clear } = this.getInteractionDistance(interactionType);
        return this.isPlayerAtInteractionDistance(target, useClearDistance ? clear : enter);
    }

    shouldClearInteractionState(interactionType, target, interactionFlag) {
        if (!this.player || !target || !this.interactionGraceById) {
            return true;
        }

        const { clear } = this.getInteractionDistance(interactionType);
        const playerDistance = Phaser.Math.Distance.Between(
            this.player.x,
            this.player.y,
            target.x,
            target.y
        );

        const now = Date.now();
        const graceState = this.interactionGraceById.get(interactionType) || {
            lastEnteredAt: 0,
            lastTargetKey: null
        };

        const targetX = Number.isFinite(target.x) ? target.x.toFixed(1) : 'na';
        const targetY = Number.isFinite(target.y) ? target.y.toFixed(1) : 'na';
        const targetKey = `${targetX}:${targetY}:${interactionFlag || ''}`;

        if (graceState.lastTargetKey !== targetKey) {
            graceState.lastTargetKey = targetKey;
            graceState.lastEnteredAt = now;
        }

        if (playerDistance <= clear) {
            graceState.lastEnteredAt = now;
            this.interactionGraceById.set(interactionType, graceState);
            return false;
        }

        this.interactionGraceById.set(interactionType, graceState);
        if (now - graceState.lastEnteredAt < this.interactionGraceToleranceMs) {
            return false;
        }

        return true;
    }

    handleShopProximity(player, shop) {
        // Only execute once per shop proximity to prevent performance issues
        if (!this.nearShop) {
            this.nearShop = true;
            console.log('[GameScene] Player near shop - showing interaction hint');

            this.offerSanctuaryInteraction({
                id: 'shop',
                target: shop,
                message: 'Press SPACE · Visit the Cosmic Shop',
                icon: '🛍',
                tone: 0xF2C14E,
                priority: 20,
                action: () => this.enterShop()
            });
        }
    }

    offerSanctuaryInteraction(candidate) {
        if (this.currentBiome !== 'nebula') return null;
        return this.sanctuaryInteractionDirector?.offer(candidate) || null;
    }

    withdrawSanctuaryInteraction(id) {
        if (this.currentBiome !== 'nebula') return null;
        return this.sanctuaryInteractionDirector?.withdraw(id) || null;
    }

    enterShop() {
        console.log('[GameScene] Entering Cosmic Shop');

        // Check cooldown to prevent rapid scene transitions
        if (this.shopEntryCooldown) {
            console.log('[GameScene] Shop entry on cooldown');
            return;
        }

        if (!this.player || !this.shop || !this.isPlayerAtInteractionDistance(this.shop, this.getInteractionDistance('shop').enter)) {
            console.log('[GameScene] Shop entry blocked - player not in range');
            this.showInteractionHint('Move closer to the Cosmic Shop first.');
            if (this.mobileControls) {
                this.mobileControls.updateInteractIcon('👆');
            }
            return;
        }

        // Set cooldown flag
        this.shopEntryCooldown = true;
        this.time.delayedCall(1000, () => {
            this.shopEntryCooldown = false;
        });

        // Reset nearShop flag before entering
        this.nearShop = false;
        this.withdrawSanctuaryInteraction('shop');

        // Save current player position before entering shop
        getGameState().set('world.lastPosition', {
            x: this.player.x,
            y: this.player.y
        });
        console.log('[GameScene] Saved player position:', this.player.x, this.player.y);

        this.sceneRouter.pauseAndLaunchScene('ShopScene', undefined, {
            loadingMessage: 'Opening Cosmic Shop...',
            sound: 'buttonClick'
        });
    }

    /**
     * Handle player proximity to Hub Portal (mystical gate to other worlds)
     */
    handleHubPortalProximity(player, portal) {
        if (!this.nearHubPortal) {
            this.nearHubPortal = true;
            console.log('[GameScene] Player near Hub Portal');

            this.offerSanctuaryInteraction({
                id: 'hubPortal',
                target: portal,
                message: 'Press SPACE · Begin an expedition',
                icon: '⭐',
                tone: 0xBFA6FF,
                priority: 35,
                action: () => this.enterHubWorld()
            });
        }
    }

    /**
     * Handle player proximity to Campfire (rest and bonding)
     */
    handleCampfireProximity(player, campfire) {
        if (!this.nearCampfire) {
            this.nearCampfire = true;
            console.log('[GameScene] Player near Campfire');

            this.offerSanctuaryInteraction({
                id: 'campfire',
                target: campfire,
                message: 'Press SPACE · Rest together',
                icon: '🔥',
                tone: 0xF2C14E,
                priority: 28,
                action: () => this.startCampfireRest()
            });
        }
    }

    /**
     * Handle player proximity to the Signal Garden.
     */
    getFusionPodWorldSnapshot() {
        const sharedAvailable = window.SharedFusionInvitation
            ?.getSharedFusionAvailability?.(
                window.CloudSave
            )?.available === true;
        return getFusionPodLandmarkSnapshot(
            window.GameState,
            { sharedAvailable }
        );
    }

    refreshFusionPodWorldLandmark() {
        if (
            this.currentBiome !== 'nebula' ||
            !this.worldBuilder ||
            !this.fusionPodLandmark
        ) {
            return null;
        }
        const snapshot = this.getFusionPodWorldSnapshot();
        this.worldBuilder.refreshFusionPodLandmark(
            this.fusionPodLandmark,
            snapshot
        );
        if (this.nearFusionPod) {
            this.offerSanctuaryInteraction({
                id: 'fusionPod',
                target: this.fusionPodLandmark?.zone,
                message: `Press SPACE · ${snapshot.interactionLabel}`,
                icon: '🧬',
                tone: snapshot.tone === 'ready' ? 0x71E6B1 : 0xF2C14E,
                priority: 24,
                action: () => this.openFusionPod()
            });
        }
        return snapshot;
    }

    handleFusionPodProximity() {
        if (this.nearFusionPod) return;

        this.nearFusionPod = true;
        const snapshot = this.refreshFusionPodWorldLandmark() ||
            this.getFusionPodWorldSnapshot();
        this.offerSanctuaryInteraction({
            id: 'fusionPod',
            target: this.fusionPodLandmark?.zone,
            message: `Press SPACE · ${snapshot.interactionLabel}`,
            icon: '🧬',
            tone: snapshot.tone === 'ready' ? 0x71E6B1 : 0xF2C14E,
            priority: 24,
            action: () => this.openFusionPod()
        });
    }

    handleSignalGardenProximity() {
        if (this.nearSignalGarden) return;

        this.nearSignalGarden = true;
        console.log('[GameScene] Player near Signal Garden');
        const community = getFendCommunitySnapshot(window.GameState);
        const culture = getFendCultureSnapshot(window.GameState);
        const action = culture.ready
            ? 'Hold the First Listening'
            : community.nextProject?.ready
                ? `Build ${community.nextProject.shortLabel}`
                : culture.complete
                    ? culture.selectedPriority.shortLabel
                    : community.complete
                        ? 'Tend the Living Commons'
                        : 'Tend garden';
        this.offerSanctuaryInteraction({
            id: 'signalGarden',
            target: this.signalGarden?.zone,
            message: `Press SPACE · ${action}`,
            icon: '🌱',
            tone: 0x71E6B1,
            priority: 32,
            action: () => this.tendSignalGarden()
        });
    }

    handleVillageHeartProximity() {
        if (this.nearVillageHeart) return;
        this.nearVillageHeart = true;
        this.updateSanctuaryFocusMode(true);
        const snapshot = reconcileVillageSettlement(window.GameState)
            || getVillageSnapshot(window.GameState);
        const needsGuidance = snapshot.unlock.unlocked &&
            !snapshot.state.guidanceSeen;
        if (needsGuidance) {
            markVillageGuidanceSeen(window.GameState);
        }
        this.offerVillageHeartInteraction(snapshot, {
            includeGuidance: needsGuidance
        });
        const nextAction = snapshot.worldState?.nextAction;
        const memoryPlayed = this.maybePlayVillageHeartMemory(snapshot);
        const quietArrival = ['review', 'supplies'].includes(nextAction?.type);
        if (!memoryPlayed && quietArrival) {
            this.maybePlayVillageCommunityMoment(snapshot);
        }
    }

    offerVillageHeartInteraction(snapshot, { includeGuidance = false } = {}) {
        if (!snapshot || !this.villageHeartLandmark?.zone) return null;
        const touchControlsVisible = this.hasVisibleTouchControls();
        const nextAction = snapshot.worldState?.nextAction;
        const interactionPresentation = this.getVillageHeartInteractionPresentation(snapshot);
        return this.offerSanctuaryInteraction({
            id: 'villageHeart',
            target: this.villageHeartLandmark?.zone,
            message: this.getVillageHeartInteractionPrompt(snapshot, {
                includeGuidance,
                touchControlsVisible
            }),
            ...interactionPresentation,
            hintMode: touchControlsVisible ? 'world' : 'hud',
            ariaLabel: `${interactionPresentation.verb} ${interactionPresentation.label}`,
            tone: nextAction?.type === 'decision' ? 0xF2C14E : 0x71E6B1,
            priority: 48,
            action: () => this.openVillageCommand(),
            presentation: () => {
                const liveSnapshot = this.villageHeartLandmark?.snapshot ||
                    getVillageSnapshot(window.GameState);
                const livePresentation = this.getVillageHeartInteractionPresentation(
                    liveSnapshot
                );
                return {
                    ...livePresentation,
                    message: this.getVillageHeartInteractionPrompt(liveSnapshot),
                    hintMode: this.hasVisibleTouchControls() ? 'world' : 'hud',
                    ariaLabel: `${livePresentation.verb} ${livePresentation.label}`
                };
            }
        });
    }

    getVillageHeartInteractionPresentation(snapshot) {
        if (!snapshot?.unlock?.unlocked) {
            return {
                verb: 'DORMANT',
                label: 'HATCH A COMPANION',
                icon: '·'
            };
        }

        const nextAction = snapshot.worldState?.nextAction || {};
        const targetPlot = snapshot.plots?.find(plot => plot.id === nextAction.plotId);
        const presentationByType = {
            decision: {
                verb: 'DECIDE',
                label: 'TOGETHER',
                icon: '?'
            },
            build: {
                verb: 'BUILD NEXT',
                label: targetPlot?.label || 'HIGHLIGHTED ROOT',
                icon: '+'
            },
            assign: {
                verb: 'INVITE HELP',
                label: targetPlot?.label || 'READY STRUCTURE',
                icon: '+'
            },
            supplies: {
                verb: 'GATHER',
                label: 'SUPPLIES',
                icon: '↗'
            },
            review: {
                verb: 'REVIEW',
                label: 'VILLAGE PLAN',
                icon: '✦'
            }
        };
        return presentationByType[nextAction.type] || {
            verb: 'OPEN',
            label: 'VILLAGE PLAN',
            icon: '✦'
        };
    }

    getVillageHeartInteractionPrompt(
        snapshot,
        {
            includeGuidance = false,
            touchControlsVisible = this.hasVisibleTouchControls()
        } = {}
    ) {
        if (!snapshot?.unlock?.unlocked) {
            return `Village Heart offline · ${snapshot?.unlock?.reason || 'Hatch a companion first'}`;
        }

        const nextAction = snapshot.worldState?.nextAction;
        const targetPlot = snapshot.plots?.find(plot => plot.id === nextAction?.plotId);
        const actionPrompts = {
            decision: touchControlsVisible
                ? 'Tap the Village Heart · Decide together'
                : 'Press SPACE at the Heart · Decide together',
            build: touchControlsVisible
                ? `Tap ${targetPlot?.label || 'the highlighted foundation'} · ${nextAction?.label}`
                : `Click ${targetPlot?.label || 'the highlighted foundation'} · ${nextAction?.label}`,
            assign: touchControlsVisible
                ? `Tap ${targetPlot?.label || 'the highlighted structure'} · Invite a helper`
                : `Click ${targetPlot?.label || 'the highlighted structure'} · Invite a helper`,
            supplies: `${nextAction?.label || 'Gather supplies'} · The village keeps working`,
            review: touchControlsVisible
                ? 'Tap the Village Heart · Review your Sanctuary'
                : 'Press SPACE at the Heart · Review your Sanctuary'
        };
        const prompt = actionPrompts[nextAction?.type] || (
            touchControlsVisible
                ? 'Tap the Village Heart · Open Village Plan'
                : 'Press SPACE at the Heart · Open Village Plan'
        );
        return includeGuidance ? `Village Heart awakened · ${prompt}` : prompt;
    }

    setSanctuaryMomentFocus(active, { kind = null, plotId = null } = {}) {
        if (!this.villageHeartLandmark || !this.worldBuilder) return false;
        const nextMode = active ? 'story' : this.nearVillageHeart ? 'action' : 'ambient';
        this.sanctuaryPresentationMode = nextMode;
        this.sanctuaryInteractionDirector?.update({ force: true });
        this.worldBuilder.setVillageFocusMode(
            this.villageHeartLandmark,
            active || this.nearVillageHeart,
            {
                immediate: !active,
                presentationMode: nextMode,
                focusPlotIdOverride: active ? plotId : undefined
            }
        );
        this.villageHeartLandmark.zone
            ?.setData('sanctuaryPresentationMode', nextMode)
            .setData('sanctuaryMomentKind', active ? kind : null);

        if (active) {
            this.hideInteractionHint();
            this.mobileControls?.updateInteractIcon('✦');
            return true;
        }

        if (this.nearVillageHeart) {
            const snapshot = this.villageHeartLandmark.snapshot ||
                getVillageSnapshot(window.GameState);
            this.showInteractionHint(
                this.getVillageHeartInteractionPrompt(snapshot),
                { persistent: true }
            );
            this.mobileControls?.updateInteractIcon(
                snapshot.worldState?.nextAction?.type === 'decision' ? '?' : '🏗'
            );
        }
        return true;
    }

    getVillageRenderSignature(snapshot) {
        return JSON.stringify({
            unlocked: snapshot?.unlock?.unlocked === true,
            buildings: snapshot?.buildings?.map(building => ({
                id: building.id,
                status: building.status,
                creatureId: building.assignedCreatureId,
                multiplier: building.workProfile?.multiplier || null
            })) || [],
            homeResidents: snapshot?.home?.residents?.map(resident => ({
                id: resident.id,
                atWork: resident.atWork,
                workBuildingId: resident.workBuildingId
            })) || [],
            heartDecisions: snapshot?.heartDecision?.completed?.map(choice => ({
                decisionId: choice.decisionId,
                optionId: choice.optionId
            })) || []
        });
    }

    refreshVillageSettlementWorld(snapshot = null, { force = false } = {}) {
        if (!this.villageHeartLandmark || !this.worldBuilder) return null;
        const nextSnapshot = snapshot || getVillageSnapshot(window.GameState);
        const signature = this.getVillageRenderSignature(nextSnapshot);
        if (!force && signature === this.villageRenderSignature) {
            return nextSnapshot;
        }
        this.villageRenderSignature = signature;
        this.worldBuilder.refreshVillageSettlement(
            this.villageHeartLandmark,
            nextSnapshot
        );
        return nextSnapshot;
    }

    notifyVillageProgress(previous, next) {
        if (!previous || !next) return;
        const previousComplete = new Set(
            previous.buildings
                .filter(building => building.status === 'complete')
                .map(building => building.id)
        );
        const completed = next.buildings.find(building => (
            building.status === 'complete' && !previousComplete.has(building.id)
        ));
        if (completed) {
            this.worldBuilder?.playVillageBuildingMoment?.(
                this.villageHeartLandmark,
                completed,
                { stage: 'complete' }
            );
            this.showVillageCompletionMoment(completed);
            this.showInteractionHint(
                `${completed.definition.shortLabel} online · ${completed.definition.immediateImpact}`
            );
            window.AudioManager?.playAchievement?.();
            return;
        }

        if (!this.nearVillageHeart) return;
        const gains = VILLAGE_RESOURCE_DEFINITIONS
            .map(resource => ({
                id: resource.id,
                label: resource.label,
                amount: Math.max(
                    0,
                    (next.resources[resource.id] || 0) -
                    (previous.resources[resource.id] || 0)
                )
            }))
            .filter(gain => gain.amount > 0);
        if (gains.length > 0) {
            this.worldBuilder?.playVillageProductionMoment?.(
                this.villageHeartLandmark,
                next,
                gains
            );
            this.showInteractionHint(
                `Village production · ${gains.map(gain => `+${gain.amount} ${gain.label}`).join(' · ')}`
            );
            window.AudioManager?.playCoin?.();
        }
    }

    maybePlayVillageCommunityMoment(snapshot, { force = false } = {}) {
        if (
            this._isShuttingDown ||
            !this.nearVillageHeart ||
            !this.villageHeartLandmark ||
            !snapshot
        ) {
            return false;
        }
        const now = this.time?.now || Date.now();
        if (
            !force &&
            this.lastVillageCommunityMomentAt > 0 &&
            now - this.lastVillageCommunityMomentAt < 14000
        ) {
            return false;
        }
        const moment = getVillageCommunityMoment(snapshot, {
            cycle: this.villageCommunityMomentIndex
        });
        if (!moment) return false;
        const played = this.worldBuilder?.playVillageCommunityMoment?.(
            this.villageHeartLandmark,
            moment
        ) === true;
        if (!played) return false;
        this.villageCommunityMomentIndex += 1;
        this.lastVillageCommunityMomentAt = now;
        return true;
    }

    maybePlayVillageHeartMemory(snapshot, { force = false } = {}) {
        if (
            this._isShuttingDown ||
            !this.nearVillageHeart ||
            !this.villageHeartLandmark ||
            !snapshot
        ) {
            return false;
        }
        const now = this.time?.now || Date.now();
        if (
            !force &&
            this.lastVillageHeartMemoryAt > 0 &&
            now - this.lastVillageHeartMemoryAt < 18000
        ) {
            return false;
        }
        const memory = getVillageHeartMemory(snapshot, {
            cycle: this.villageHeartMemoryIndex
        });
        if (!memory) return false;
        const played = this.worldBuilder?.playVillageHeartMemory?.(
            this.villageHeartLandmark,
            memory
        ) === true;
        if (!played) return false;
        this.villageHeartMemoryIndex += 1;
        this.lastVillageHeartMemoryAt = now;
        return true;
    }

    showVillageWorkerCheckIn({ creatureId, snapshot = null } = {}) {
        const checkIn = getVillageWorkerCheckIn(
            snapshot || getVillageSnapshot(window.GameState),
            { creatureId }
        );
        if (!checkIn) return false;
        const played = this.worldBuilder?.playVillageWorkerCheckIn?.(
            this.villageHeartLandmark,
            checkIn
        ) === true;
        if (!played) return false;
        this.showInteractionHint(`${checkIn.name} · ${checkIn.routineCue}`);
        window.AudioManager?.playButtonClick?.();
        window.AchievementSystem?.recordEvent?.('story_interaction', {
            event: 'village_worker_check_in',
            creatureId: checkIn.creatureId,
            buildingId: checkIn.definitionId
        });
        return true;
    }

    openVillageWorkerCheckIn({ creatureId, snapshot = null } = {}) {
        return this.showVillageWorkerCheckIn({ creatureId, snapshot });
    }

    showVillageCompletionMoment(building) {
        if (
            this.currentBiome !== 'nebula' ||
            !building?.definition ||
            this.sys?.isActive?.() === false
        ) {
            return false;
        }

        this.villageCompletionMoment?.destroy?.(true);
        const { width } = this.cameras.main;
        const compact = width < 600;
        const panelWidth = Math.min(width - (compact ? 24 : 48), compact ? 350 : 480);
        const panelHeight = compact ? 142 : 150;
        const x = width / 2;
        const y = compact ? 116 : 96;
        const container = this.add.container(x, y)
            .setScrollFactor(0)
            .setDepth(1750)
            .setAlpha(0);
        const panel = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x07100F, 0.96)
            .setStrokeStyle(2, 0x71E6B1, 0.9);
        const signal = this.add.rectangle(-panelWidth / 2 + 4, 0, 5, panelHeight - 10, 0xF2C14E, 1);
        const art = VILLAGE_BUILDING_ARTWORK[building.definitionId];
        const artwork = art && this.textures.exists(art.key)
            ? this.add.image(-panelWidth / 2 + 58, 0, art.key)
                .setDisplaySize(compact ? 92 : 108, compact ? 58 : 68)
            : null;
        const textX = -panelWidth / 2 + (artwork ? (compact ? 116 : 132) : 20);
        const heading = this.add.text(textX, -panelHeight / 2 + 17, 'VILLAGE HEART // STRUCTURE ONLINE', {
            fontFamily: 'Arial, sans-serif',
            fontSize: compact ? '10px' : '11px',
            fontStyle: 'bold',
            color: '#F2C14E'
        });
        const title = this.add.text(textX, -panelHeight / 2 + 37, building.definition.label, {
            fontFamily: 'Arial, sans-serif',
            fontSize: compact ? '17px' : '21px',
            fontStyle: 'bold',
            color: '#F4F4F4'
        });
        const story = this.add.text(textX, -panelHeight / 2 + 64, building.definition.completionCopy, {
            fontFamily: 'Arial, sans-serif',
            fontSize: compact ? '10px' : '11px',
            color: '#F4F4F4',
            wordWrap: { width: panelWidth - (artwork ? (compact ? 136 : 154) : 40) }
        });
        const impact = this.add.text(textX, -panelHeight / 2 + (compact ? 105 : 108), building.definition.worldEffectLabel, {
            fontFamily: 'Arial, sans-serif',
            fontSize: compact ? '10px' : '11px',
            fontStyle: 'bold',
            color: '#8FE3CF'
        });
        container.add([panel, signal, ...(artwork ? [artwork] : []), heading, title, story, impact]);
        this.villageCompletionMoment = container;

        this.tweens.add({
            targets: container,
            alpha: 1,
            y: y + 8,
            duration: 260,
            ease: 'Sine.easeOut'
        });
        this.time.delayedCall(4200, () => {
            if (this.villageCompletionMoment !== container) return;
            this.tweens.add({
                targets: container,
                alpha: 0,
                duration: 320,
                onComplete: () => {
                    container.destroy(true);
                    if (this.villageCompletionMoment === container) {
                        this.villageCompletionMoment = null;
                    }
                }
            });
        });
        return true;
    }

    startVillageReconciliation() {
        this.villageReconcileTimer?.remove?.();
        this.villageReconcileTimer = null;
        if (this.currentBiome !== 'nebula' || !this.villageHeartLandmark) return;
        this.refreshVillageSettlementWorld(getVillageSnapshot(window.GameState), {
            force: true
        });
        this.villageReconcileTimer = this.time.addEvent({
            delay: 5000,
            loop: true,
            callback: () => {
                if (this._isShuttingDown) return;
                this.reconcileVillageSettlementNow();
            }
        });
    }

    reconcileVillageSettlementNow({ notify = true } = {}) {
        if (this._isShuttingDown || !this.villageHeartLandmark) return null;
        const previous = getVillageSnapshot(window.GameState);
        const snapshot = reconcileVillageSettlement(window.GameState);
        this.refreshVillageSettlementWorld(snapshot);
        if (notify) {
            this.notifyVillageProgress(previous, snapshot);
            this.maybePlayVillageCommunityMoment(snapshot);
        }
        return snapshot;
    }

    openVillageCommand({ plotId = null } = {}) {
        const snapshot = initializeVillageSettlement(window.GameState);
        this.refreshVillageSettlementWorld(snapshot, { force: true });
        if (!snapshot?.unlock?.unlocked) {
            this.showInteractionHint(snapshot?.unlock?.reason || 'Village Heart is offline');
            window.AudioManager?.playError?.();
            return false;
        }
        if (!this.villageCommandPanel) {
            this.villageCommandPanel = new VillageCommandPanel(this);
        }
        return this.villageCommandPanel.show({
            plotId,
            guided: plotId === null,
            getSnapshot: () => getVillageSnapshot(window.GameState),
            onPlace: request => {
                const result = placeVillageBuilding(window.GameState, request);
                this.refreshVillageSettlementWorld(result.snapshot, { force: true });
                if (result.changed) {
                    const building = result.snapshot?.buildings?.find(
                        entry => entry.id === result.buildingId
                    );
                    this.worldBuilder?.playVillageBuildingMoment?.(
                        this.villageHeartLandmark,
                        building,
                        { stage: 'construction' }
                    );
                    window.AudioManager?.playAchievement?.();
                    window.AchievementSystem?.recordEvent?.('story_interaction', {
                        event: 'village_construction_started',
                        buildingId: result.buildingId
                    });
                } else {
                    window.AudioManager?.playError?.();
                }
                return result;
            },
            onAssign: request => {
                const result = assignCreatureToVillageBuilding(
                    window.GameState,
                    request
                );
                this.refreshVillageSettlementWorld(result.snapshot, { force: true });
                if (result.changed) {
                    this.recordBondActivity('community');
                    this.villageCommunityMomentPending = true;
                    window.AudioManager?.playButtonClick?.();
                } else {
                    window.AudioManager?.playError?.();
                }
                return result;
            },
            onDecision: request => {
                const result = resolveVillageHeartDecision(
                    window.GameState,
                    request
                );
                this.refreshVillageSettlementWorld(result.snapshot, { force: true });
                if (result.changed) {
                    this.villageDecisionMomentPending = result;
                    this.recordBondActivity('community');
                    window.AudioManager?.playAchievement?.();
                    window.AchievementSystem?.recordEvent?.('story_interaction', {
                        event: 'village_heart_decision',
                        decisionId: result.decision.id,
                        optionId: result.option.id
                    });
                } else {
                    window.AudioManager?.playError?.();
                }
                return result;
            },
            onTick: () => {
                const previous = getVillageSnapshot(window.GameState);
                const next = reconcileVillageSettlement(window.GameState);
                this.refreshVillageSettlementWorld(next);
                this.notifyVillageProgress(previous, next);
                return next;
            },
            onClose: () => {
                const closeSnapshot = getVillageSnapshot(window.GameState);
                if (this.nearVillageHeart) {
                    this.offerVillageHeartInteraction(closeSnapshot);
                } else {
                    this.showInteractionHint('Village Heart plan saved');
                }
                if (this.villageCommunityMomentPending) {
                    this.villageCommunityMomentPending = false;
                    this.maybePlayVillageCommunityMoment(
                        closeSnapshot,
                        { force: true }
                    );
                }
                if (this.villageDecisionMomentPending) {
                    this.worldBuilder?.playVillageDecisionMoment?.(
                        this.villageHeartLandmark,
                        this.villageDecisionMomentPending
                    );
                    this.villageDecisionMomentPending = null;
                }
            }
        });
    }

    handleFendResidentProximity(_player, zone) {
        const residentId = zone?.residentId;
        if (!residentId || this.nearFendResidentId === residentId) return;

        const snapshot = getFendResidentsSnapshot(window.GameState);
        const resident = snapshot.residents.find(entry => entry.id === residentId);
        if (!resident?.available) return;

        if (this.nearFendResidentId) {
            this.withdrawSanctuaryInteraction(
                `fendResident:${this.nearFendResidentId}`
            );
        }
        this.nearFendResidentId = residentId;
        const currentVeil = getCurrentVeilSnapshot(window.GameState);
        const recovery = getRemainAndDefendSnapshot(window.GameState);
        let action;
        if (residentId === 'ilyra' && recovery.councilReady) {
            action = 'Hold Commons Council';
        } else if (residentId === 'ilyra' && recovery.complete) {
            action = 'Review recovery chapter';
        } else if (residentId === 'ilyra' && currentVeil.available) {
            action = 'Begin Quiet Current';
        } else if (residentId === 'ilyra' && currentVeil.active) {
            action =
                `Quiet Current ${currentVeil.stabilizedCount}/` +
                `${currentVeil.totalAnchors}`;
        } else if (
            residentId === 'ilyra' &&
            currentVeil.verificationReady
        ) {
            action = 'Review living mask';
        } else if (residentId === 'ilyra' && currentVeil.complete) {
            action = 'Review protected route';
        } else if (resident.completed) {
            action = `Speak with ${resident.name}`;
        } else if (resident.ready) {
            action = `Complete ${resident.request.title}`;
        } else if (resident.active) {
            action = `Review ${resident.request.title}`;
        } else {
            action = `Meet ${resident.name}`;
        }
        this.offerSanctuaryInteraction({
            id: `fendResident:${residentId}`,
            target: zone,
            message: `Press SPACE · ${action}`,
            icon: '💬',
            tone: resident.accent || 0x8FE3CF,
            priority: 56,
            action: () => this.interactWithFendResident()
        });
    }

    setupFendResidentOverlaps() {
        this.fendResidentOverlapColliders?.forEach(collider => {
            collider?.destroy?.();
        });
        this.fendResidentOverlapColliders = [];
        if (!this.player) return;

        this.signalGarden?.residents?.forEach(resident => {
            if (!resident?.zone) return;
            const collider = this.physics.add.overlap(
                this.player,
                resident.zone,
                this.handleFendResidentProximity,
                null,
                this
            );
            this.fendResidentOverlapColliders.push(collider);
        });
    }

    handleGuardianResidentProximity(_player, zone) {
        const guardianId = zone?.guardianResidentId;
        if (!guardianId || this.nearGuardianResidentId === guardianId) return;
        const resident = getGuardianResidentsSnapshot(window.GameState)
            .rescuedResidents
            .find(entry => entry.id === guardianId);
        if (!resident) return;

        if (this.nearGuardianResidentId) {
            this.withdrawSanctuaryInteraction(
                `guardianResident:${this.nearGuardianResidentId}`
            );
        }
        this.nearGuardianResidentId = guardianId;
        const lastRecognitionAt = this.guardianRecognitionCooldowns.get(
            guardianId
        ) || 0;
        if (Date.now() - lastRecognitionAt >= 23000) {
            const recognition = getGuardianCompanionRecognition(
                window.GameState,
                guardianId
            );
            if (recognition?.line) {
                this.guardianRecognitionCooldowns.set(guardianId, Date.now());
                this.showGuardianCompanionRecognitionMoment(
                    recognition,
                    resident
                );
            }
        }
        const action = resident.taskStatus === 'ready'
            ? `Complete ${resident.task.title}`
            : resident.expeditionDebriefReady
                ? 'Debrief shared expedition'
            : resident.routineReady
                ? `Check in: ${resident.routineCare.action}`
            : resident.taskStatus === 'available'
                ? `Ask about ${resident.task.title}`
                : resident.taskStatus === 'completed'
                    ? `Choose ${resident.teamAbility.name}`
                    : resident.activeTeam
                        ? `Assist: ${resident.routineCare.action}`
                        : `Speak with ${resident.name}`;
        this.offerSanctuaryInteraction({
            id: `guardianResident:${guardianId}`,
            target: zone,
            message: `Press SPACE · ${action}`,
            icon: '💬',
            tone: resident.accent || 0xBFA6FF,
            priority: 58,
            action: () => this.interactWithGuardianResident()
        });
    }

    setupGuardianResidentOverlaps() {
        this.guardianResidentOverlapColliders?.forEach(collider => {
            collider?.destroy?.();
        });
        this.guardianResidentOverlapColliders = [];
        if (!this.player) return;

        this.signalGarden?.guardianResidents?.forEach(resident => {
            if (!resident?.zone) return;
            const collider = this.physics.add.overlap(
                this.player,
                resident.zone,
                this.handleGuardianResidentProximity,
                null,
                this
            );
            this.guardianResidentOverlapColliders.push(collider);
        });
    }

    handleRescuedResidentProximity(_player, zone) {
        const residentId = zone?.rescuedResidentId;
        if (!residentId || this.nearRescuedResidentId === residentId) return;
        const resident = getRescuedResidentSnapshot(window.GameState)
            .rescued
            .find(entry => entry.id === residentId);
        if (!resident) return;

        if (this.nearRescuedResidentId) {
            this.withdrawSanctuaryInteraction(
                `rescuedResident:${this.nearRescuedResidentId}`
            );
        }
        this.nearRescuedResidentId = residentId;
        this.offerSanctuaryInteraction({
            id: `rescuedResident:${residentId}`,
            target: zone,
            message: `Press SPACE · Check supplies with ${resident.name}`,
            icon: '💬',
            tone: resident.accent || 0xF2C14E,
            priority: 54,
            action: () => this.interactWithRescuedResident()
        });
    }

    setupRescuedResidentOverlaps() {
        this.rescuedResidentOverlapColliders?.forEach(collider => {
            collider?.destroy?.();
        });
        this.rescuedResidentOverlapColliders = [];
        if (!this.player) return;

        this.signalGarden?.rescuedResidents?.forEach(resident => {
            if (!resident?.zone) return;
            const collider = this.physics.add.overlap(
                this.player,
                resident.zone,
                this.handleRescuedResidentProximity,
                null,
                this
            );
            this.rescuedResidentOverlapColliders.push(collider);
        });
    }

    interactWithRescuedResident() {
        if (!this.nearRescuedResidentId || !window.GameState) return;
        const result = interactWithRescuedResident(
            window.GameState,
            this.nearRescuedResidentId
        );
        if (!result?.resident) return;

        this.recordBondActivity('community');
        window.AchievementSystem?.recordEvent?.('story_interaction', {
            event: 'rescued_resident_check_in',
            residentId: result.resident.id,
            interactionCount: result.interactionCount
        });
        window.AudioManager?.playButtonClick?.();
        this.showRescuedResidentExchange(result);
    }

    showRescuedResidentExchange(result) {
        if (!result?.resident || this.rescuedResidentExchangeOpen) return;

        this.rescuedResidentExchangeOpen = true;
        this.player?.body?.setVelocity?.(0, 0);
        const { width, height } = this.scale;
        const compact = width < 620 || height < 650;
        const resident = result.resident;
        const bandHeight = Math.min(compact ? 390 : 430, height - 28);
        const top = (height - bandHeight) / 2;
        const depth = 16100;
        const elements = [];

        const overlay = this.add.graphics()
            .setScrollFactor(0)
            .setDepth(depth)
            .setInteractive(
                new Phaser.Geom.Rectangle(0, 0, width, height),
                Phaser.Geom.Rectangle.Contains
            );
        overlay.fillStyle(0x020807, 0.95);
        overlay.fillRect(0, 0, width, height);
        overlay.fillStyle(0x101616, 1);
        overlay.fillRect(0, top, width, bandHeight);
        overlay.lineStyle(3, resident.accent, 0.95);
        overlay.lineBetween(0, top, width, top);
        overlay.lineBetween(0, top + bandHeight, width, top + bandHeight);
        elements.push(overlay);

        const addText = (y, value, style = {}) => {
            const entry = this.add.text(width / 2, y, value, {
                fontFamily: 'Arial, sans-serif',
                align: 'center',
                wordWrap: { width: Math.min(width - 38, 700) },
                color: '#EAF7F4',
                ...style
            }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2);
            elements.push(entry);
            return entry;
        };

        addText(top + 32, 'SANCTUARY // RESCUED RESIDENT', {
            fontSize: compact ? '11px' : '13px',
            color: '#8FE3CF',
            fontStyle: 'bold'
        });
        addText(top + 73, `${resident.name.toUpperCase()} // ${resident.role.toUpperCase()}`, {
            fontSize: compact ? '21px' : '28px',
            color: '#F2C14E',
            fontStyle: 'bold'
        });
        addText(top + (compact ? 145 : 154), `"${result.line}"`, {
            fontSize: compact ? '15px' : '18px',
            color: '#F4F4F4',
            fontStyle: 'italic',
            lineSpacing: 5
        });
        addText(top + (compact ? 238 : 260), result.supportLabel.toUpperCase(), {
            fontSize: compact ? '12px' : '14px',
            color: '#8FE3CF',
            fontStyle: 'bold'
        });
        addText(
            top + (compact ? 290 : 320),
            `SUPPLY CHECK ${result.interactionCount} // SUPPORT APPLIES ON THE NEXT EXPEDITION`,
            {
                fontSize: compact ? '10px' : '12px',
                color: '#AFC3CF'
            }
        );
        const continueButton = addText(top + bandHeight - 38, '[ RETURN TO SANCTUARY ]', {
            fontSize: compact ? '15px' : '17px',
            color: '#101616',
            backgroundColor: '#8FE3CF',
            fontStyle: 'bold',
            padding: { x: compact ? 16 : 24, y: 10 }
        }).setInteractive({ useHandCursor: true });

        const close = () => {
            if (!this.rescuedResidentExchangeOpen) return;
            this.rescuedResidentExchangeOpen = false;
            elements.forEach(element => element?.destroy?.());
            this.rescuedResidentExchangeElements = [];
            this.input.keyboard?.off?.('keydown-ENTER', close);
            this.input.keyboard?.off?.('keydown-SPACE', close);
        };
        overlay.once('pointerup', close);
        continueButton.once('pointerup', close);
        this.input.keyboard?.once?.('keydown-ENTER', close);
        this.input.keyboard?.once?.('keydown-SPACE', close);
        this.rescuedResidentExchangeElements = elements;
    }

    interactWithGuardianResident() {
        if (!this.nearGuardianResidentId || !window.GameState) return;
        const result = interactWithGuardianResident(
            window.GameState,
            this.nearGuardianResidentId
        );
        if (!result || result.reason === 'guardian_not_rescued') return;
        this.recordBondActivity('community');
        window.AchievementSystem?.recordEvent?.('story_interaction', {
            event: 'guardian_resident_conversation',
            guardianId: result.resident.id,
            interactionCount: result.resident.interactionCount,
            outcome: result.reason
        });
        if (result.reason === 'guardian_task_completed') {
            window.AudioManager?.playAchievement?.();
        } else {
            window.AudioManager?.playButtonClick?.();
        }
        this.worldBuilder?.refreshGuardianResidents(
            this.signalGarden,
            result.snapshot
        );
        this.setupGuardianResidentOverlaps();
        this.showGuardianResidentExchange(result);
    }

    assistGuardianResidentRoutine(guardianId) {
        if (!guardianId || !window.GameState) return;
        const previewing = this.guardianExchangePreview !== null;
        const result = previewing
            ? this.createGuardianRoutineAssistPreviewResult(guardianId)
            : assistGuardianRoutine(window.GameState, guardianId);
        if (!result?.resident) return;
        if (result.changed && !previewing) {
            this.recordBondActivity('community');
            window.AchievementSystem?.recordEvent?.('care_action', {
                type: 'guardian_routine',
                guardianId,
                routineAssistCount: result.resident.routineAssistCount
            });
        }
        if (result.reason === 'guardian_synergy_unlocked') {
            window.AudioManager?.playAchievement?.();
        } else {
            window.AudioManager?.playButtonClick?.();
        }
        if (result.changed) {
            this.worldBuilder?.refreshGuardianResidents(
                this.signalGarden,
                result.snapshot
            );
            this.setupGuardianResidentOverlaps();
        }
        this.showGuardianResidentExchange(result);
    }

    createGuardianRoutineAssistPreviewResult(guardianId) {
        const residentIndex = GUARDIAN_RESIDENT_DEFINITIONS.findIndex(
            resident => resident.id === guardianId
        ) + 1;
        if (residentIndex <= 0) return null;
        const snapshot = this.createGuardianResidentPreviewSnapshot(
            GUARDIAN_RESIDENT_DEFINITIONS.length,
            this.guardianTaskPreview || 'accepted',
            residentIndex
        );
        const resident = snapshot.residents.find(entry => entry.id === guardianId);
        if (!resident) return null;
        const routineAssistCount = resident.routineAssistCount + 1;
        const updatedResident = {
            ...resident,
            routineAssistCount,
            routineSupported: true,
            routineReady: false,
            routineWaitMs: GUARDIAN_ROUTINE_RECOVERY_MS,
            routineStatus: 'recovering',
            trustProgress: Math.min(GUARDIAN_SYNERGY_ASSISTS, routineAssistCount)
        };
        const replaceResident = entry => (
            entry.id === guardianId ? updatedResident : entry
        );
        const updatedSnapshot = {
            ...snapshot,
            residents: snapshot.residents.map(replaceResident),
            rescuedResidents: snapshot.rescuedResidents.map(replaceResident),
            routineAssistCount: snapshot.routineAssistCount + 1,
            supportedResidentCount: Math.max(1, snapshot.supportedResidentCount)
        };
        return {
            changed: true,
            reason: 'guardian_routine_assisted',
            message: resident.routineCare.responses[0],
            resident: updatedResident,
            snapshot: updatedSnapshot
        };
    }

    showGuardianResidentExchange(result) {
        if (!result?.resident || this.guardianExchangeOpen) return;
        this.guardianExchangeOpen = true;
        this.player?.body?.setVelocity?.(0, 0);
        const { width, height } = this.scale;
        const compact = width < 620 || height < 650;
        const bandHeight = Math.min(compact ? 470 : 500, height - 24);
        const top = (height - bandHeight) / 2;
        const depth = 16200;
        const elements = [];
        const trustMemory = result.reason === 'guardian_synergy_unlocked';
        const expeditionDebrief =
            result.reason === 'guardian_expedition_debrief';
        const companionFieldMemory = trustMemory || expeditionDebrief;
        const cinematicRequest = ++this.guardianTrustCinematicRequest;
        this.guardianTrustCinematic?.destroy?.();
        this.guardianTrustCinematic = null;
        if (companionFieldMemory) {
            const mediaService = window.CompanionMediaService || companionMediaService;
            const previewRecord = this.guardianExchangePreview !== null
                ? {
                    identityKey: 'preview_companion_23:baby:portrait',
                    stage: 'baby',
                    imageUrl: '/marketing/nova.webp',
                    assetRef: null,
                    storage: 'preview'
                }
                : null;
            Promise.resolve(mediaService?.createCinematicStill?.(this, {
                momentId: expeditionDebrief
                    ? `guardian_debrief_${result.resident.id}`
                    : `guardian_trust_${result.resident.id}`,
                stage: window.GameState?.get?.('creature.lifecycle.stage') || 'baby',
                record: previewRecord,
                depth: depth - 10,
                alpha: expeditionDebrief ? 0.9 : 0.82,
                veilAlpha: expeditionDebrief ? 0.14 : 0.3,
                duration: 7200,
                isCurrent: () => (
                    this.guardianExchangeOpen &&
                    this.guardianTrustCinematicRequest === cinematicRequest &&
                    this.sys?.isActive?.() !== false
                )
            })).then(cinematic => {
                if (!cinematic) return;
                if (
                    !this.guardianExchangeOpen ||
                    this.guardianTrustCinematicRequest !== cinematicRequest
                ) {
                    cinematic.destroy?.();
                    return;
                }
                this.guardianTrustCinematic = cinematic;
            }).catch(() => {
                // Stored portrait continuity is an enhancement, never a blocker.
            });
        }
        const overlay = this.add.graphics()
            .setScrollFactor(0)
            .setDepth(depth)
            .setInteractive(
                new Phaser.Geom.Rectangle(0, 0, width, height),
                Phaser.Geom.Rectangle.Contains
            );
        overlay.fillStyle(0x020807, companionFieldMemory
            ? expeditionDebrief ? 0.18 : 0.28
            : 0.95);
        overlay.fillRect(0, 0, width, height);
        overlay.fillStyle(0x101616, companionFieldMemory
            ? expeditionDebrief ? 0.56 : 0.64
            : 0.99);
        overlay.fillRect(0, top, width, bandHeight);
        overlay.lineStyle(2, result.resident.accent, 1);
        overlay.lineBetween(0, top, width, top);
        overlay.lineBetween(0, top + bandHeight, width, top + bandHeight);
        elements.push(overlay);

        const textWidth = Math.min(width - 40, 720);
        const addText = (
            y,
            value,
            style = {},
            x = width / 2,
            wrapWidth = textWidth
        ) => {
            const text = this.add.text(x, y, value, {
                fontFamily: 'Arial, sans-serif',
                color: '#F4F4F4',
                align: 'center',
                wordWrap: { width: wrapWidth },
                ...style
            }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
            elements.push(text);
            return text;
        };
        addText(top + 30, trustMemory
            ? 'FIRST ALLIANCE // TRUST MEMORY UNLOCKED'
            : expeditionDebrief
                ? 'ALLIANCE DEBRIEF // SHARED EXPEDITION MEMORY'
                : 'SANCTUARY RESIDENT // RESTORED GUARDIAN', {
            fontSize: compact ? '12px' : '14px',
            fontStyle: 'bold',
            color: '#8FE3CF'
        });
        addText(top + 66, result.resident.name.toUpperCase(), {
            fontSize: compact ? '23px' : '29px',
            fontStyle: 'bold',
            color: '#F4F4F4'
        });
        addText(top + 96, `${result.resident.role}  //  ${result.resident.routine}`, {
            fontSize: compact ? '12px' : '14px',
            color: '#F2C14E'
        });
        const portraitBounds = compact
            ? { x: 16, y: top + 112, width: 92, height: 100 }
            : { x: (width / 2) - 360, y: top + 108, width: 120, height: 122 };
        const portraitFrame = this.add.graphics()
            .setScrollFactor(0)
            .setDepth(depth + 1);
        portraitFrame.fillStyle(0x08100F, 0.96);
        portraitFrame.fillRoundedRect(
            portraitBounds.x,
            portraitBounds.y,
            portraitBounds.width,
            portraitBounds.height,
            6
        );
        portraitFrame.lineStyle(2, result.resident.accent, 0.9);
        portraitFrame.strokeRoundedRect(
            portraitBounds.x,
            portraitBounds.y,
            portraitBounds.width,
            portraitBounds.height,
            6
        );
        elements.push(portraitFrame);

        if (this.textures.exists(result.resident.textureKey)) {
            const portrait = this.add.image(
                portraitBounds.x + (portraitBounds.width / 2),
                portraitBounds.y + (portraitBounds.height / 2),
                result.resident.textureKey
            ).setScrollFactor(0).setDepth(depth + 2);
            const portraitScale = Math.min(
                (portraitBounds.width - 10) / portrait.width,
                (portraitBounds.height - 10) / portrait.height
            );
            portrait.setScale(portraitScale);
            elements.push(portrait);
        }

        addText(top + (compact ? 161 : 168), `“${result.message || result.resident.dialogueLine || result.resident.rescueMemory}”`, {
            fontSize: compact ? '15px' : '17px',
            fontStyle: 'italic',
            lineSpacing: 5
        }, compact ? (width / 2) + 56 : (width / 2) + 74,
        compact ? width - 152 : 500);
        const taskProgress = result.resident.taskProgress;
        const taskStatusLabel = result.resident.taskStatus === 'selected'
            ? 'COMPLETE'
            : result.resident.taskStatus.toUpperCase();
        addText(
            top + (compact ? 260 : 274),
            `COOPERATIVE TASK // ${result.resident.task.title.toUpperCase()} // ${taskStatusLabel}`,
            {
                fontSize: compact ? '11px' : '13px',
                fontStyle: 'bold',
                color: taskProgress.ready ? '#F2C14E' : '#8FE3CF'
            }
        );
        addText(
            top + (compact ? 301 : 317),
            `${result.resident.task.objective}\nPROGRESS ${taskProgress.progress}/${taskProgress.target}`,
            {
                fontSize: compact ? '12px' : '14px',
                color: '#D8FFF0',
                lineSpacing: 4
            }
        );
        const careStatus = result.resident.routineReady
            ? 'CARE READY'
            : result.resident.routineStatus === 'recovering'
                ? `CARE RECOVERING ${formatGuardianRoutineRecovery(result.resident.routineWaitMs)}`
                : 'CARE AVAILABLE AFTER FIRST MEETING';
        addText(top + (compact ? 346 : 356),
            `${careStatus} // ${result.resident.routineCare.action.toUpperCase()}\n` +
            (result.resident.synergyUnlocked
                ? `TRUST ${result.resident.trustProgress}/${result.resident.trustTarget} // ${result.resident.synergy.name.toUpperCase()}`
                : `TRUST ${result.resident.trustProgress}/${result.resident.trustTarget} // HELP WITH THREE SANCTUARY ROUTINES`), {
                fontSize: compact ? '10px' : '12px',
                fontStyle: 'bold',
                color: result.resident.routineReady ? '#F2C14E' : '#D8FFF0',
                lineSpacing: 3
            });
        const abilityPrefix = result.resident.activeTeam
            ? expeditionDebrief
                ? `EXPEDITIONS TOGETHER ${result.resident.expeditionCount}`
                : 'ACTIVE EXPEDITION ALLY'
            : result.resident.teamAbilityUnlocked
                ? 'TEAM ABILITY UNLOCKED'
                : 'TEAM ABILITY LOCKED';
        addText(top + bandHeight - 86, `${abilityPrefix} // ${result.resident.teamAbility.name}`, {
            fontSize: compact ? '12px' : '14px',
            fontStyle: 'bold',
            color: result.resident.activeTeam ? '#F2C14E' : '#8FE3CF'
        });
        const close = addText(top + bandHeight - 42, '[ CONTINUE ]', {
            fontSize: compact ? '16px' : '18px',
            fontStyle: 'bold',
            color: '#101616',
            backgroundColor: '#8FE3CF',
            padding: { x: compact ? 15 : 26, y: 11 }
        }).setInteractive({ useHandCursor: true });
        let assist = null;
        if (result.resident.met) {
            close.setX(width * 0.72);
            const assistLabel = result.resident.routineReady
                ? '[ ASSIST ROUTINE ]'
                : `[ RECOVERING ${formatGuardianRoutineRecovery(result.resident.routineWaitMs)} ]`;
            assist = addText(top + bandHeight - 42, assistLabel, {
                fontSize: compact ? '12px' : '16px',
                fontStyle: 'bold',
                color: result.resident.routineReady ? '#F4F4F4' : '#A7B7B3',
                backgroundColor: result.resident.routineReady ? '#1D5961' : '#28302F',
                padding: { x: compact ? 9 : 18, y: 11 }
            }).setX(width * 0.29);
            if (result.resident.routineReady) {
                assist.setInteractive({ useHandCursor: true });
            }
        }

        const dismiss = () => {
            if (!this.guardianExchangeOpen) return;
            this.guardianExchangeOpen = false;
            this.guardianTrustCinematicRequest += 1;
            this.guardianTrustCinematic?.destroy?.();
            this.guardianTrustCinematic = null;
            elements.forEach(element => element?.destroy?.());
            this.guardianExchangeElements = [];
            this.input.keyboard?.off?.('keydown-ENTER', dismiss);
            this.input.keyboard?.off?.('keydown-SPACE', dismiss);
        };
        close.on('pointerup', dismiss);
        assist?.on?.('pointerup', () => {
            if (!result.resident.routineReady) return;
            const resident = result.resident;
            dismiss();
            this.time.delayedCall(0, () => {
                this.showGuardianCareActivity(resident);
            });
        });
        overlay.on('pointerup', dismiss);
        this.input.keyboard?.once?.('keydown-ENTER', dismiss);
        this.input.keyboard?.once?.('keydown-SPACE', dismiss);
        this.guardianExchangeElements = elements;
    }

    destroyGuardianCareActivity() {
        this.guardianCareActivityTimer?.remove?.();
        this.guardianCareActivityTimer = null;
        this.guardianCareActivityElements?.forEach(element => element?.destroy?.());
        this.guardianCareActivityElements = [];
        this.guardianCareActivityOpen = false;
        this.input.keyboard?.off?.('keydown-ESC', this.guardianCareCancelHandler);
        this.guardianCareCancelHandler = null;
    }

    destroyGuardianCompanionRecognitionMoment() {
        this.guardianRecognitionTimer?.remove?.();
        this.guardianRecognitionTimer = null;
        this.guardianRecognitionElements?.forEach(
            element => element?.destroy?.()
        );
        this.guardianRecognitionElements = [];
    }

    showGuardianCompanionRecognitionMoment(recognition, resident, {
        duration = 4200
    } = {}) {
        if (!recognition?.line || !resident) return;
        this.destroyGuardianCompanionRecognitionMoment();
        const { width, height } = this.scale;
        const compact = width < 620;
        const panelWidth = Math.min(width - 24, compact ? 366 : 540);
        const panelHeight = compact ? 136 : 116;
        const top = compact
            ? Math.max(124, Math.min(height * 0.16, 154))
            : 76;
        const depth = 15850;
        const panel = this.add.rectangle(
            0,
            panelHeight / 2,
            panelWidth,
            panelHeight,
            0x101616,
            0.97
        )
            .setStrokeStyle(2, resident.accent || 0x8FE3CF, 1);
        const children = [panel];

        const addText = (y, value, style = {}) => {
            const text = this.add.text(0, y, value, {
                fontFamily: 'Arial, sans-serif',
                color: '#F4F4F4',
                align: 'center',
                ...style
            }).setOrigin(0.5);
            children.push(text);
            return text;
        };
        addText(
            21,
            `COMPANION RECOGNITION // ${resident.name.toUpperCase()}`,
            {
                fontSize: compact ? '10px' : '12px',
                fontStyle: 'bold',
                color: '#8FE3CF'
            }
        );
        addText(47, recognition.cue, {
            fontSize: compact ? '10px' : '11px',
            fontStyle: 'bold',
            color: '#F2C14E',
            wordWrap: { width: panelWidth - 26 }
        });
        addText(compact ? 92 : 84, `“${recognition.line}”`, {
            fontSize: compact ? '13px' : '14px',
            fontStyle: 'italic',
            lineSpacing: 3,
            wordWrap: { width: panelWidth - 30 }
        });
        const container = this.add.container(width / 2, top, children)
            .setScrollFactor(0)
            .setDepth(depth);
        this.guardianRecognitionElements = [container];
        this.guardianRecognitionTimer = this.time.delayedCall(
            duration,
            () => this.destroyGuardianCompanionRecognitionMoment()
        );
    }

    showGuardianCareActivity(resident) {
        const steps = resident?.routineCare?.steps;
        if (
            !resident?.routineReady ||
            !Array.isArray(steps) ||
            steps.length === 0 ||
            this.guardianCareActivityOpen
        ) {
            return;
        }

        this.destroyGuardianCareActivity();
        this.guardianCareActivityOpen = true;
        this.player?.body?.setVelocity?.(0, 0);
        const { width, height } = this.scale;
        const compact = width < 620 || height < 700;
        const bandHeight = Math.min(compact ? 650 : 620, height - 24);
        const top = (height - bandHeight) / 2;
        const depth = 16300;
        const elements = [];
        let currentStep = 0;
        let inputLocked = false;

        const overlay = this.add.graphics()
            .setScrollFactor(0)
            .setDepth(depth)
            .setInteractive(
                new Phaser.Geom.Rectangle(0, 0, width, height),
                Phaser.Geom.Rectangle.Contains
            );
        overlay.fillStyle(0x020807, 0.97);
        overlay.fillRect(0, 0, width, height);
        overlay.fillStyle(0x101616, 1);
        overlay.fillRect(0, top, width, bandHeight);
        overlay.lineStyle(2, resident.accent, 1);
        overlay.lineBetween(0, top, width, top);
        overlay.lineBetween(0, top + bandHeight, width, top + bandHeight);
        elements.push(overlay);

        const addText = (x, y, value, style = {}) => {
            const text = this.add.text(x, y, value, {
                fontFamily: 'Arial, sans-serif',
                color: '#F4F4F4',
                align: 'center',
                ...style
            }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2);
            elements.push(text);
            return text;
        };

        addText(width / 2, top + 27, 'SANCTUARY CARE // LIVING ROUTINE', {
            fontSize: compact ? '11px' : '14px',
            fontStyle: 'bold',
            color: '#8FE3CF'
        });
        addText(width / 2, top + 58, resident.name.toUpperCase(), {
            fontSize: compact ? '22px' : '28px',
            fontStyle: 'bold'
        });

        const portraitX = compact ? 52 : (width / 2) - 330;
        const portraitY = top + (compact ? 124 : 166);
        const portraitSize = compact ? 76 : 126;
        if (this.textures.exists(resident.textureKey)) {
            const portrait = this.add.image(portraitX, portraitY, resident.textureKey)
                .setScrollFactor(0)
                .setDepth(depth + 2);
            const portraitScale = Math.min(
                portraitSize / Math.max(1, portrait.width),
                portraitSize / Math.max(1, portrait.height)
            );
            portrait.setScale(portraitScale);
            elements.push(portrait);
        }

        const promptX = compact ? (width / 2) + 42 : (width / 2) + 52;
        const promptWidth = compact ? Math.max(190, width - 130) : 610;
        addText(promptX, top + (compact ? 119 : 105), resident.routineCare.prompt, {
            fontSize: compact ? '13px' : '15px',
            color: '#D8FFF0',
            lineSpacing: compact ? 3 : 5,
            wordWrap: { width: promptWidth }
        });

        const progress = addText(
            compact ? promptX : (width / 2) + 52,
            top + (compact ? 191 : 156),
            `STEP 1/${steps.length}`,
            {
                fontSize: compact ? '12px' : '13px',
                fontStyle: 'bold',
                color: '#F2C14E'
            }
        );
        const feedback = addText(width / 2, top + (compact ? 229 : 207),
            'Move carefully. The guardian will respond after each step.', {
                fontSize: compact ? '12px' : '14px',
                fontStyle: 'italic',
                color: '#A7B7B3',
                lineSpacing: 3,
                wordWrap: { width: Math.min(width - 40, 720) }
            });

        const rowWidth = Math.min(compact ? width - 32 : 620, 620);
        const rowHeight = compact ? 54 : 58;
        const rowStartY = top + (compact ? 294 : 286);
        const rowGap = compact ? 64 : 72;
        const rows = steps.map((step, index) => {
            const y = rowStartY + (index * rowGap);
            const background = this.add.graphics()
                .setScrollFactor(0)
                .setDepth(depth + 1)
                .setInteractive(
                    new Phaser.Geom.Rectangle(
                        (width - rowWidth) / 2,
                        y - (rowHeight / 2),
                        rowWidth,
                        rowHeight
                    ),
                    Phaser.Geom.Rectangle.Contains
                );
            const label = addText(width / 2, y, '', {
                fontSize: compact ? '13px' : '15px',
                fontStyle: 'bold',
                wordWrap: { width: rowWidth - 28 }
            });
            elements.push(background);
            return { background, label, step, index, y };
        });

        const renderRows = () => {
            rows.forEach(row => {
                const complete = row.index < currentStep;
                const active = row.index === currentStep && currentStep < steps.length;
                row.background.clear();
                row.background.fillStyle(
                    complete ? 0x163A31 : active ? 0x1D5961 : 0x1A2221,
                    1
                );
                row.background.fillRect(
                    (width - rowWidth) / 2,
                    row.y - (rowHeight / 2),
                    rowWidth,
                    rowHeight
                );
                row.background.lineStyle(2, complete ? 0x8FE3CF : active ? resident.accent : 0x3A4744, active ? 1 : 0.7);
                row.background.strokeRect(
                    (width - rowWidth) / 2,
                    row.y - (rowHeight / 2),
                    rowWidth,
                    rowHeight
                );
                row.label.setText(
                    `${complete ? 'DONE' : `0${row.index + 1}`}  //  ${row.step.action.toUpperCase()}`
                );
                row.label.setColor(complete ? '#8FE3CF' : active ? '#F4F4F4' : '#778582');
                if (active && !inputLocked) {
                    row.background.setInteractive();
                } else {
                    row.background.disableInteractive();
                }
            });
        };

        const cancel = addText(width / 2, top + bandHeight - 30, '[ CANCEL CARE ]', {
            fontSize: compact ? '13px' : '15px',
            fontStyle: 'bold',
            color: '#D8FFF0',
            backgroundColor: '#28302F',
            padding: { x: 20, y: 13 }
        }).setInteractive({ useHandCursor: true });

        const finishActivity = () => {
            if (!this.guardianCareActivityOpen) return;
            const guardianId = resident.id;
            this.destroyGuardianCareActivity();
            this.assistGuardianResidentRoutine(guardianId);
        };
        const selectStep = index => {
            if (
                !this.guardianCareActivityOpen ||
                inputLocked ||
                index !== currentStep
            ) {
                return;
            }
            inputLocked = true;
            window.AudioManager?.playButtonClick?.();
            window.navigator?.vibrate?.(18);
            feedback.setText(steps[index].feedback).setColor('#F4F4F4');
            currentStep += 1;
            progress.setText(
                currentStep >= steps.length
                    ? 'CARE COMPLETE // ROUTINE STABLE'
                    : `STEP ${currentStep + 1}/${steps.length}`
            );
            renderRows();
            this.guardianCareActivityTimer?.remove?.();
            this.guardianCareActivityTimer = this.time.delayedCall(
                currentStep >= steps.length ? 750 : 260,
                () => {
                    this.guardianCareActivityTimer = null;
                    if (currentStep >= steps.length) {
                        finishActivity();
                        return;
                    }
                    inputLocked = false;
                    renderRows();
                }
            );
        };

        rows.forEach(row => {
            row.background.on('pointerup', () => selectStep(row.index));
        });
        cancel.on('pointerup', () => this.destroyGuardianCareActivity());
        this.guardianCareCancelHandler = () => this.destroyGuardianCareActivity();
        this.input.keyboard?.once?.('keydown-ESC', this.guardianCareCancelHandler);
        renderRows();
        this.guardianCareActivityElements = elements;
    }

    handleCurrentVeilAnchorProximity(_player, zone) {
        const anchorId = zone?.currentVeilAnchorId;
        if (
            !anchorId ||
            this.nearCurrentVeilAnchorId === anchorId
        ) {
            return;
        }
        const snapshot = getCurrentVeilSnapshot(window.GameState);
        const anchor = snapshot.anchors.find(
            entry => entry.id === anchorId
        );
        if (!snapshot.active || !anchor || anchor.stabilized) return;

        this.nearCurrentVeilAnchorId = anchorId;
        this.offerSanctuaryInteraction({
            id: `currentVeilAnchor:${anchorId}`,
            target: zone,
            message: `Press SPACE · Stabilize ${anchor.label}`,
            icon: '◉',
            tone: 0x8FE3CF,
            priority: 68,
            action: () => this.interactWithCurrentVeilAnchor()
        });
    }

    setupCurrentVeilAnchorOverlaps() {
        this.currentVeilOverlapColliders?.forEach(collider => {
            collider?.destroy?.();
        });
        this.currentVeilOverlapColliders = [];
        if (!this.player) return;

        this.signalGarden?.currentVeilAnchors?.forEach(anchor => {
            if (!anchor?.zone || anchor.stabilized) return;
            const collider = this.physics.add.overlap(
                this.player,
                anchor.zone,
                this.handleCurrentVeilAnchorProximity,
                null,
                this
            );
            this.currentVeilOverlapColliders.push(collider);
        });
    }

    refreshCurrentVeilWorld() {
        if (!window.GameState || !this.signalGarden) return;
        this.worldBuilder?.refreshCurrentVeilMission(
            this.signalGarden,
            getCurrentVeilSnapshot(window.GameState)
        );
        this.setupCurrentVeilAnchorOverlaps();
    }

    showCurrentVeilMission({ verifyPacket = false } = {}) {
        if (
            this.currentVeilModal?.isVisible ||
            !window.GameState
        ) {
            return;
        }

        if (verifyPacket) {
            const result = verifyCurrentVeilPacket(window.GameState);
            if (result?.changed) {
                this.recordBondActivity('community');
                window.AchievementSystem?.recordEvent?.(
                    'story_interaction',
                    {
                        event: 'current_veil_packet_verified',
                        transmissionStatus: 'not_sent'
                    }
                );
                recordCampaignLegacyCapsule(window.GameState, {
                    intent: window.GameState.get(
                        'story.projectBeacon.finale.priority'
                    ),
                    recordedAt:
                        result.snapshot.state.completedAt ||
                        new Date().toISOString()
                });
                window.AudioManager?.playAchievement?.();
                this.refreshCurrentVeilWorld();
            } else if (
                result &&
                result.reason !== 'mission_complete'
            ) {
                window.AudioManager?.playError?.();
            }
        }

        const snapshot = getCurrentVeilSnapshot(window.GameState);
        if (!snapshot.prerequisitesMet) return;
        this.currentVeilModal = new CurrentVeilModal(this, {
            snapshotProvider: () => (
                getCurrentVeilSnapshot(window.GameState)
            ),
            onStart: () => {
                const result = startCurrentVeilMission(
                    window.GameState
                );
                if (!result?.changed) {
                    window.AudioManager?.playError?.();
                    return result;
                }
                window.AchievementSystem?.recordEvent?.(
                    'story_interaction',
                    {
                        event: 'current_veil_started',
                        anchorCount: result.snapshot.totalAnchors
                    }
                );
                recordCampaignLegacyCapsule(window.GameState, {
                    intent: window.GameState.get(
                        'story.projectBeacon.finale.priority'
                    ),
                    recordedAt:
                        result.snapshot.state.startedAt ||
                        new Date().toISOString()
                });
                window.AudioManager?.playButtonClick?.();
                this.refreshCurrentVeilWorld();
                return result;
            },
            onClose: () => {
                this.currentVeilModal = null;
                const current = getCurrentVeilSnapshot(
                    window.GameState
                );
                this.showInteractionHint(
                    formatCurrentVeilObjective(current)
                );
            }
        });
        this.currentVeilModal.show();
    }

    showRemainAndDefendCampaign() {
        if (!window.GameState) return;
        if (!this.recoveryLogModal) {
            this.recoveryLogModal = new ProjectBeaconLogModal(this);
        }
        this.recoveryLogModal.show('recovery');
    }

    interactWithCurrentVeilAnchor() {
        if (
            !this.nearCurrentVeilAnchorId ||
            !window.GameState
        ) {
            return;
        }
        const result = stabilizeCurrentVeilAnchor(
            window.GameState,
            this.nearCurrentVeilAnchorId
        );
        if (!result?.changed) {
            window.AudioManager?.playError?.();
            return;
        }
        this.withdrawSanctuaryInteraction(
            `currentVeilAnchor:${this.nearCurrentVeilAnchorId}`
        );
        this.nearCurrentVeilAnchorId = null;
        this.recordBondActivity('community');
        window.AchievementSystem?.recordEvent?.(
            'story_interaction',
            {
                event: 'current_veil_anchor_stabilized',
                anchorId: result.anchor.id,
                verificationReady:
                    result.snapshot.verificationReady
            }
        );
        recordCampaignLegacyCapsule(window.GameState, {
            intent: window.GameState.get(
                'story.projectBeacon.finale.priority'
            ),
            recordedAt: new Date().toISOString()
        });
        window.AudioManager?.playAchievement?.();
        this.refreshCurrentVeilWorld();
        this.showCurrentVeilMission();
    }

    interactWithFendResident() {
        if (!this.nearFendResidentId || !window.GameState) return;

        const residentId = this.nearFendResidentId;
        const currentVeil = getCurrentVeilSnapshot(window.GameState);
        const recovery = getRemainAndDefendSnapshot(window.GameState);
        if (
            residentId === 'ilyra' &&
            (recovery.councilReady || recovery.complete)
        ) {
            this.showRemainAndDefendCampaign();
            return;
        }
        if (
            residentId === 'ilyra' &&
            (
                currentVeil.available ||
                currentVeil.active ||
                currentVeil.verificationReady ||
                currentVeil.complete
            )
        ) {
            this.showCurrentVeilMission();
            return;
        }
        const result = interactWithFendResident(
            window.GameState,
            residentId
        );
        if (!result) return;

        if (result.reason === 'other_request_active') {
            this.showInteractionHint(
                formatFendResidentObjective(result.snapshot)
            );
            window.AudioManager?.playError?.();
            return;
        }

        if (result.reason === 'duplicate_operation') {
            const current = getFendResidentsSnapshot(window.GameState);
            this.showFendResidentExchange({
                changed: false,
                reason: 'request_in_progress',
                resident: current.activeResident || result.resident,
                snapshot: current
            });
            return;
        }

        this.worldBuilder?.refreshFendResidents(
            this.signalGarden,
            result.snapshot || getFendResidentsSnapshot(window.GameState)
        );
        this.setupFendResidentOverlaps();

        if (result.changed && result.reason === 'request_completed') {
            this.recordBondActivity('community');
            window.AchievementSystem?.recordEvent?.('story_interaction', {
                event: 'fend_resident_request_completed',
                residentId,
                requestId: result.resident.request.id
            });
            window.AudioManager?.playAchievement?.();
        }

        this.showFendResidentExchange(result);
    }

    showFendResidentExchange(result) {
        if (!result?.resident || this.residentExchangeOpen) return;

        this.residentExchangeOpen = true;
        this.player?.body?.setVelocity?.(0, 0);
        const { width, height } = this.scale;
        const compact = width < 620 || height < 650;
        const resident = result.resident;
        const completed =
            result.changed && result.reason === 'request_completed';
        const alreadyCompleted =
            !result.changed && result.reason === 'request_completed';
        const returning = result.reason === 'request_completed'
            || result.reason === 'request_in_progress';
        const activeSnapshot = result.snapshot
            || getFendResidentsSnapshot(window.GameState);
        const cultureSnapshot = getFendCultureSnapshot(window.GameState);
        const cultureResponse = alreadyCompleted && cultureSnapshot.complete
            ? getFendCultureResidentResponse(
                resident.id,
                cultureSnapshot.selectedPriority.id
            )
            : null;
        const currentResident = activeSnapshot.residents.find(
            entry => entry.id === resident.id
        ) || resident;
        const centerY = height / 2;
        const bandHeight = Math.min(
            compact ? 430 : 470,
            Math.max(350, height - 32)
        );
        const top = centerY - (bandHeight / 2);
        const depth = 16000;
        const elements = [];

        const overlay = this.add.graphics()
            .setScrollFactor(0)
            .setDepth(depth)
            .setInteractive(
                new Phaser.Geom.Rectangle(0, 0, width, height),
                Phaser.Geom.Rectangle.Contains
            );
        overlay.fillStyle(0x020807, 0.95);
        overlay.fillRect(0, 0, width, height);
        overlay.fillStyle(0x101616, 0.99);
        overlay.fillRect(0, top, width, bandHeight);
        overlay.lineStyle(2, resident.accent, 0.95);
        overlay.lineBetween(0, top, width, top);
        overlay.lineBetween(0, top + bandHeight, width, top + bandHeight);
        elements.push(overlay);

        const textWidth = Math.min(width - 40, 720);
        const addText = (y, value, style = {}) => {
            const text = this.add.text(width / 2, y, value, {
                fontFamily: 'Arial, sans-serif',
                align: 'center',
                wordWrap: { width: textWidth },
                color: '#EAF7F4',
                ...style
            }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
            elements.push(text);
            return text;
        };

        addText(
            top + 34,
            completed
                ? 'FEND COMMONS // REQUEST COMPLETE'
                : cultureResponse
                    ? 'FEND COMMONS // AFTER THE LISTENING'
                : alreadyCompleted
                    ? 'FEND COMMONS // FIELD EXCHANGE'
                : 'FEND COMMONS // COOPERATIVE REQUEST',
            {
                fontSize: compact ? '11px' : '13px',
                color: '#8FE3CF',
                fontStyle: 'bold'
            }
        );
        addText(
            top + 72,
            `${resident.name.toUpperCase()} // ${resident.role.toUpperCase()}`,
            {
                fontSize: compact ? '21px' : '27px',
                color: '#F2C14E',
                fontStyle: 'bold'
            }
        );
        addText(
            top + 109,
            resident.request.title.toUpperCase(),
            {
                fontSize: compact ? '14px' : '17px',
                color: '#D8FFF0',
                fontStyle: 'bold'
            }
        );

        const primaryLine = completed
            ? resident.request.completionLine
            : cultureResponse
                ? cultureResponse
            : alreadyCompleted
                ? resident.request.completionLine
            : !returning
                ? resident.introduction
                : resident.request.briefing;
        addText(
            top + (compact ? 166 : 173),
            `“${primaryLine}”`,
            {
                fontSize: compact ? '14px' : '17px',
                color: '#F4F4F4',
                fontStyle: 'italic',
                lineSpacing: 5
            }
        );
        addText(
            top + (compact ? 244 : 258),
            completed
                ? resident.request.actionLine
                : cultureResponse
                    ? formatFendCultureObjective(cultureSnapshot)
                : alreadyCompleted
                    ? resident.request.actionLine
                : resident.request.briefing,
            {
                fontSize: compact ? '13px' : '15px',
                color: '#BFD8D2',
                lineSpacing: 4
            }
        );

        const objective = completed
            ? 'TRUST +8  //  COMMUNITY MEMORY RECORDED'
            : cultureResponse
                ? `${cultureSnapshot.selectedPriority.shortLabel}  //  ALL VOICES REMAIN`
            : alreadyCompleted
                ? 'SHARED WORK REMAINS IN THE COMMONS RECORD'
            : currentResident.ready
                ? `READY // RETURN TO ${resident.name.toUpperCase()}`
                : resident.request.objective.toUpperCase();
        addText(
            top + (compact ? 318 : 342),
            objective,
            {
                fontSize: compact ? '11px' : '13px',
                color: completed || currentResident.ready
                    ? '#F2C14E'
                    : '#8FE3CF',
                fontStyle: 'bold'
            }
        );
        addText(
            top + bandHeight - 28,
            'TAP TO RETURN',
            {
                fontSize: '11px',
                color: '#AFC3CF'
            }
        );

        const close = () => {
            if (!this.residentExchangeOpen) return;
            this.residentExchangeOpen = false;
            elements.forEach(element => element?.destroy?.());
            this.residentExchangeElements = [];
        };
        overlay.once('pointerup', close);
        this.residentExchangeElements = elements;
    }

    showFendCommonsListening({
        result = null,
        previewPriority = undefined
    } = {}) {
        if (this.fendListeningOpen) return;

        const previewMode = previewPriority !== undefined;
        const snapshot = result?.snapshot || (
            previewMode
                ? this.createFendCulturePreviewSnapshot(
                    previewPriority || 'ready'
                )
                : getFendCultureSnapshot(window.GameState)
        );
        const selectedPriority = result?.priority
            || snapshot.selectedPriority
            || null;
        const confirmation = Boolean(selectedPriority);
        if (!confirmation && !snapshot.ready) return;

        this.fendListeningOpen = true;
        this.player?.body?.setVelocity?.(0, 0);
        const { width, height } = this.scale;
        const compact = width < 620 || height < 680;
        const centerX = width / 2;
        const centerY = height / 2;
        const bandHeight = Math.min(
            confirmation ? (compact ? 390 : 430) : (compact ? 570 : 600),
            height - 24
        );
        const top = centerY - (bandHeight / 2);
        const depth = 16400;
        const elements = [];

        const overlay = this.add.graphics()
            .setScrollFactor(0)
            .setDepth(depth)
            .setInteractive(
                new Phaser.Geom.Rectangle(0, 0, width, height),
                Phaser.Geom.Rectangle.Contains
            );
        overlay.fillStyle(0x020807, 0.96);
        overlay.fillRect(0, 0, width, height);
        overlay.fillStyle(0x101616, 1);
        overlay.fillRect(0, top, width, bandHeight);
        overlay.lineStyle(2, 0xF4F4F4, 0.9);
        overlay.lineBetween(0, top, width, top);
        overlay.lineBetween(0, top + bandHeight, width, top + bandHeight);
        elements.push(overlay);

        const colors = [0xD94B4B, 0x101616, 0xF4F4F4, 0x3FAE62];
        const colorBar = this.add.graphics()
            .setScrollFactor(0)
            .setDepth(depth + 1);
        const segmentWidth = width / colors.length;
        colors.forEach((color, index) => {
            colorBar.fillStyle(color, 1);
            colorBar.fillRect(index * segmentWidth, top, segmentWidth, 5);
        });
        elements.push(colorBar);

        const textWidth = Math.min(width - 36, 720);
        const addText = (y, value, style = {}) => {
            const text = this.add.text(centerX, y, value, {
                fontFamily: 'Arial, sans-serif',
                align: 'center',
                wordWrap: { width: textWidth },
                color: '#EAF7F4',
                ...style
            }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 3);
            elements.push(text);
            return text;
        };

        addText(top + 30, 'FEND COMMONS // THE FIRST LISTENING', {
            fontSize: compact ? '11px' : '13px',
            color: '#8FE3CF',
            fontStyle: 'bold'
        });
        addText(
            top + 63,
            confirmation
                ? selectedPriority.shortLabel
                : 'NO ONE SPEAKS TWICE UNTIL EVERY VOICE HAS BEEN HEARD',
            {
                fontSize: compact ? '17px' : '22px',
                color: '#F2C14E',
                fontStyle: 'bold'
            }
        );

        if (confirmation) {
            addText(top + (compact ? 126 : 142), `“${selectedPriority.decisionLine}”`, {
                fontSize: compact ? '15px' : '18px',
                color: '#F4F4F4',
                fontStyle: 'italic',
                lineSpacing: 5
            });
            addText(top + (compact ? 220 : 247), selectedPriority.companionLine, {
                fontSize: compact ? '13px' : '15px',
                color: '#BFD8D2',
                lineSpacing: 4
            });
            addText(
                top + bandHeight - 72,
                'THIS SETS WHAT BEGINS FIRST. REFUGE, RESTORATION, AND WARNING ALL REMAIN.',
                {
                    fontSize: compact ? '10px' : '12px',
                    color: '#8FE3CF',
                    fontStyle: 'bold'
                }
            );
            addText(top + bandHeight - 28, 'TAP TO RETURN', {
                fontSize: '11px',
                color: '#AFC3CF'
            });
        } else {
            addText(
                top + (compact ? 104 : 110),
                'Kiri, Mara, and Tovan name three urgent needs. Ilyra asks you and your companion to choose what the Commons begins first.',
                {
                    fontSize: compact ? '12px' : '14px',
                    color: '#BFD8D2',
                    lineSpacing: 4
                }
            );

            const buttonWidth = Math.min(width - 32, 690);
            const buttonHeight = compact ? 82 : 88;
            const buttonStartY = top + (compact ? 160 : 170);
            FEND_COMMONS_PRIORITIES.forEach((priority, index) => {
                const buttonY = buttonStartY + (index * (buttonHeight + 8));
                const button = this.add.graphics()
                    .setScrollFactor(0)
                    .setDepth(depth + 1);
                button.fillStyle(index === 0 ? 0x162B27 : 0x0A1716, 1);
                button.fillRoundedRect(
                    centerX - (buttonWidth / 2),
                    buttonY,
                    buttonWidth,
                    buttonHeight,
                    6
                );
                button.lineStyle(
                    2,
                    index === 0 ? 0xD94B4B : index === 1 ? 0x3FAE62 : 0xF4F4F4,
                    0.95
                );
                button.strokeRoundedRect(
                    centerX - (buttonWidth / 2),
                    buttonY,
                    buttonWidth,
                    buttonHeight,
                    6
                );
                button.setInteractive(
                    new Phaser.Geom.Rectangle(
                        centerX - (buttonWidth / 2),
                        buttonY,
                        buttonWidth,
                        buttonHeight
                    ),
                    Phaser.Geom.Rectangle.Contains
                );
                elements.push(button);

                const optionText = this.add.text(
                    centerX - (buttonWidth / 2) + 16,
                    buttonY + 12,
                    priority.label,
                    {
                        fontFamily: 'Arial, sans-serif',
                        fontSize: compact ? '13px' : '15px',
                        color: '#F2C14E',
                        fontStyle: 'bold'
                    }
                ).setScrollFactor(0).setDepth(depth + 2);
                elements.push(optionText);

                const caseText = this.add.text(
                    centerX - (buttonWidth / 2) + 16,
                    buttonY + 37,
                    priority.caseLine,
                    {
                        fontFamily: 'Arial, sans-serif',
                        fontSize: compact ? '10px' : '12px',
                        color: '#D8E4E0',
                        wordWrap: { width: buttonWidth - 32 },
                        lineSpacing: 2
                    }
                ).setScrollFactor(0).setDepth(depth + 2);
                elements.push(caseText);

                button.on('pointerover', () => button.setAlpha(0.82));
                button.on('pointerout', () => button.setAlpha(1));
                button.once('pointerup', () => {
                    const recorded = previewMode
                        ? {
                            changed: true,
                            reason: 'first_listening_completed',
                            priority,
                            snapshot: this.createFendCulturePreviewSnapshot(
                                priority.id
                            )
                        }
                        : recordFirstListeningDecision(
                            window.GameState,
                            priority.id
                        );
                    if (!recorded?.priority) {
                        window.AudioManager?.playError?.();
                        return;
                    }

                    this.closeFendCommonsListening();
                    this.worldBuilder?.refreshFendCulture(
                        this.signalGarden,
                        recorded.snapshot
                    );
                    if (!previewMode && recorded.changed) {
                        this.recordBondActivity('community');
                        window.AchievementSystem?.recordEvent?.(
                            'story_interaction',
                            {
                                event: 'fend_first_listening_completed',
                                priorityId: priority.id
                            }
                        );
                        window.AudioManager?.playAchievement?.();
                    }
                    this.showFendCommonsListening({
                        result: recorded,
                        previewPriority: previewMode ? priority.id : undefined
                    });
                });
            });

            addText(top + bandHeight - 25, 'CHOOSE WHAT BEGINS FIRST', {
                fontSize: '10px',
                color: '#AFC3CF'
            });
        }

        if (confirmation) {
            overlay.once('pointerup', () => {
                this.closeFendCommonsListening();
                this.showInteractionHint(
                    formatFendCultureObjective(
                        result?.snapshot || snapshot
                    )
                );
            });
        }
        this.fendListeningElements = elements;
    }

    closeFendCommonsListening() {
        if (!this.fendListeningOpen) return;
        this.fendListeningOpen = false;
        this.fendListeningElements?.forEach(element => element?.destroy?.());
        this.fendListeningElements = [];
    }

    tendSignalGarden() {
        if (!window.GameState || !this.signalGarden) return;

        const guardianActivity = recordGuardianActivity(
            window.GameState,
            'gardenVisits'
        );
        if (guardianActivity?.changed) {
            this.worldBuilder?.refreshGuardianResidents(
                this.signalGarden,
                guardianActivity.snapshot
            );
            this.setupGuardianResidentOverlaps();
        }

        const cultureBefore = getFendCultureSnapshot(window.GameState);
        if (cultureBefore.ready) {
            this.showFendCommonsListening();
            return;
        }

        const communityBefore = getFendCommunitySnapshot(window.GameState);
        if (communityBefore.nextProject?.ready) {
            const contribution = advanceFendCommunityProject(window.GameState);
            if (contribution?.changed) {
                this.worldBuilder?.refreshFendCommunity(
                    this.signalGarden,
                    contribution.snapshot.stage
                );
                this.worldBuilder?.refreshFendResidents(
                    this.signalGarden,
                    getFendResidentsSnapshot(window.GameState)
                );
                this.setupFendResidentOverlaps();
                this.showFendCommunityProjectMoment(contribution);
                window.AchievementSystem?.recordEvent?.('story_interaction', {
                    event: 'fend_community_project_completed',
                    projectId: contribution.project.id,
                    stage: contribution.snapshot.stage
                });
                return;
            }
        }

        const currentState = normalizeSignalGardenState(
            window.GameState.get('world.signalGarden')
        );
        const result = tendSignalGarden(currentState);

        if (!result.success) {
            const community = getFendCommunitySnapshot(window.GameState);
            this.showInteractionHint(
                community.complete
                    ? result.message
                    : formatFendCommunityObjective(community)
            );
            window.AudioManager?.playError?.();
            return;
        }

        window.GameState.set('world.signalGarden', result.state);
        this.worldBuilder?.refreshSignalGarden(this.signalGarden, result.stage);

        const happiness = Number(window.GameState.get('creature.stats.happiness')) || 0;
        window.GameState.set('creature.stats.happiness', Math.min(100, happiness + 5));
        this.recordBondActivity('garden');
        this.updateStatsDisplay();

        window.GameState.emit('signalGardenTended', {
            stage: result.stage,
            tendCount: result.state.tendCount,
            isNewStage: result.isNewStage,
            timestamp: result.state.lastTendedAt
        });
        window.AchievementSystem?.recordEvent?.('story_interaction', {
            event: 'signal_garden_tended',
            stage: result.stage
        });

        const gardenZone = this.signalGarden.zone;
        this.showFloatingText(
            result.isNewStage ? `${result.stage.toUpperCase()} +5 Happiness` : '+5 Happiness',
            gardenZone.x,
            gardenZone.y - 70,
            '#71E6B1'
        );
        this.showCreatureResponse(result.companionLine);
        const communityAfter = getFendCommunitySnapshot(window.GameState);
        if (communityAfter.nextProject?.ready) {
            this.time.delayedCall(900, () => {
                this.showInteractionHint(
                    `${communityAfter.nextProject.label} is ready · press SPACE`
                );
            });
        }

        if (window.FXLibrary?.stardustBurst) {
            window.FXLibrary.stardustBurst(this, gardenZone.x, gardenZone.y - 30, {
                count: result.isNewStage ? 18 : 10,
                color: [0x71E6B1, 0xF2C86B, 0xBFA6FF],
                duration: 1400
            });
        }
        window.AudioManager?.playAchievement?.();
    }

    showFendCommunityProjectMoment(contribution) {
        if (!contribution?.project || this.communityMomentOpen) return;

        this.communityMomentOpen = true;
        const { width, height } = this.scale;
        const compact = width < 620 || height < 600;
        const centerX = width / 2;
        const centerY = height / 2;
        const elements = [];
        const overlay = this.add.graphics()
            .setScrollFactor(0)
            .setDepth(9000)
            .setInteractive(
                new Phaser.Geom.Rectangle(0, 0, width, height),
                Phaser.Geom.Rectangle.Contains
            );
        overlay.fillStyle(0x020807, 0.93);
        overlay.fillRect(0, 0, width, height);
        overlay.fillStyle(0x12352C, 0.94);
        overlay.fillRect(0, centerY - (compact ? 170 : 210), width, compact ? 340 : 420);
        overlay.lineStyle(2, 0x71E6B1, 0.85);
        overlay.lineBetween(0, centerY - (compact ? 170 : 210), width, centerY - (compact ? 170 : 210));
        overlay.lineBetween(0, centerY + (compact ? 170 : 210), width, centerY + (compact ? 170 : 210));
        elements.push(overlay);

        const addCenteredText = (y, value, style) => {
            const text = this.add.text(centerX, y, value, {
                fontFamily: 'Arial, sans-serif',
                align: 'center',
                wordWrap: { width: Math.min(width - 40, 680) },
                ...style
            }).setOrigin(0.5).setScrollFactor(0).setDepth(9001);
            elements.push(text);
            return text;
        };

        addCenteredText(
            centerY - (compact ? 130 : 158),
            `PROJECT BEACON // COMMUNITY ${contribution.snapshot.stage}/4`,
            {
                fontSize: compact ? '11px' : '13px',
                color: '#8FE3CF',
                fontStyle: 'bold'
            }
        );

        const sigil = this.add.graphics().setScrollFactor(0).setDepth(9001);
        sigil.lineStyle(3, 0xF4F4F4, 0.9);
        sigil.strokeCircle(centerX, centerY - (compact ? 79 : 93), compact ? 27 : 34);
        sigil.lineStyle(4, 0x3FAE62, 1);
        sigil.lineBetween(
            centerX - 17,
            centerY - (compact ? 79 : 93),
            centerX,
            centerY - (compact ? 62 : 76)
        );
        sigil.lineBetween(
            centerX,
            centerY - (compact ? 62 : 76),
            centerX + 20,
            centerY - (compact ? 101 : 115)
        );
        sigil.fillStyle(0xD94B4B, 1);
        sigil.fillCircle(centerX + 20, centerY - (compact ? 101 : 115), 5);
        elements.push(sigil);

        addCenteredText(
            centerY - (compact ? 22 : 22),
            contribution.project.label,
            {
                fontSize: compact ? '25px' : '34px',
                color: '#F2C14E',
                fontStyle: 'bold'
            }
        );
        addCenteredText(
            centerY + (compact ? 28 : 42),
            contribution.project.description,
            {
                fontSize: compact ? '14px' : '17px',
                color: '#EAF7F4',
                lineSpacing: 5
            }
        );
        addCenteredText(
            centerY + (compact ? 91 : 112),
            contribution.project.supportLine.toUpperCase(),
            {
                fontSize: compact ? '12px' : '14px',
                color: '#8FE3CF',
                fontStyle: 'bold'
            }
        );
        addCenteredText(
            centerY + (compact ? 137 : 169),
            'TAP TO RETURN',
            {
                fontSize: '11px',
                color: '#AFC3CF'
            }
        );

        const close = () => {
            if (!this.communityMomentOpen) return;
            this.communityMomentOpen = false;
            elements.forEach(element => element?.destroy?.());
            this.communityMomentElements = [];
            this.showInteractionHint(this.communityMomentPreview !== null
                ? `Community stage ${this.communityMomentPreview}/4 preview`
                : formatFendCommunityObjective(contribution.snapshot)
            );
        };
        this.communityMomentElements = elements;
        overlay.once('pointerdown', close);
        this.time.delayedCall(6000, close);
        window.AudioManager?.playAchievement?.();
    }

    /**
     * Start the campfire rest experience
     * Opens the CampfireRestSystem overlay for meditation and stat recovery
     */
    startCampfireRest() {
        if (window.CampfireRestSystem) {
            // Get creature genetics for rendering
            const creatureGenes = window.GameState?.get('creature.genes') ||
                                  window.GameState?.get('creature.genetics');

            // Get campfire position for the overlay
            const campfirePos = this.campfire
                ? { x: this.campfire.x, y: this.campfire.y }
                : { x: this.scale.width / 2, y: this.scale.height / 2 };

            // Start the rest session
            window.CampfireRestSystem.startRest(this, campfirePos, creatureGenes);

            // Clear proximity state
            this.nearCampfire = false;

            // Clean up glow indicator
            if (this.campfireIndicator) {
                this.campfireIndicator.destroy();
                this.campfireIndicator = null;
            }
            if (this.campfireGlowAnim) {
                this.campfireGlowAnim.stop();
                this.campfireGlowAnim = null;
            }

            // Hide interaction hint
            this.hideInteractionHint();

            // Reset mobile controls interact icon
            if (this.mobileControls) {
                this.mobileControls.updateInteractIcon('👆');
            }

            console.log('[GameScene] Started campfire rest session');
        } else {
            console.warn('[GameScene] CampfireRestSystem not available');
        }
    }

    /**
     * Set up collision detection for the target practice range
     * Projectiles hitting targets award points and trigger effects
     */
    setupTargetRangeCollisions() {
        if (!this.targetRange || !this.targetRange.allTargets) {
            console.warn('[GameScene] Cannot setup target range collisions - no targets');
            return;
        }

        // Create a group for the targets
        this.targetGroup = this.physics.add.staticGroup();
        this.targetRange.allTargets.forEach(target => {
            this.targetGroup.add(target);
        });

        // Set up collision between projectiles and targets (after enemies are created)
        this.time.delayedCall(500, () => {
            if (this.projectiles && this.targetGroup) {
                this.physics.add.overlap(
                    this.projectiles,
                    this.targetGroup,
                    this.handleTargetHit,
                    null,
                    this
                );
                console.log('[GameScene] Target range collisions enabled');
            }
        });

        // Create score display for target range
        this.createTargetRangeScoreDisplay();

        console.log('[GameScene] Target Practice Range initialized');
    }

    /**
     * Create the score display for target practice
     */
    createTargetRangeScoreDisplay() {
        if (!this.targetRange) return;

        const zoneCenter = this.sanctuaryZones?.zones?.trainingGrounds?.center;
        if (!zoneCenter) return;

        // Score background
        this.targetRangeScoreBg = this.add.graphics();
        this.targetRangeScoreBg.fillStyle(0x1A1A3E, 0.8);
        this.targetRangeScoreBg.fillRoundedRect(zoneCenter.x - 80, zoneCenter.y - 150, 160, 40, 10);
        this.targetRangeScoreBg.lineStyle(2, 0xFF6B6B, 0.8);
        this.targetRangeScoreBg.strokeRoundedRect(zoneCenter.x - 80, zoneCenter.y - 150, 160, 40, 10);
        this.targetRangeScoreBg.setDepth(100);
        this.targetRangeScoreBg.setScrollFactor(1);

        // Score text
        this.targetRangeScoreText = this.add.text(
            zoneCenter.x,
            zoneCenter.y - 130,
            '🎯 Score: 0',
            {
                fontSize: '18px',
                fontFamily: 'Arial, sans-serif',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setDepth(101).setScrollFactor(1);

        // Initially hidden until player enters range
        this.targetRangeScoreBg.setVisible(false);
        this.targetRangeScoreText.setVisible(false);
    }

    /**
     * Handle projectile hitting a target in the practice range
     * @param {Phaser.GameObjects.Sprite} projectile - The projectile that hit
     * @param {Phaser.GameObjects.Sprite} target - The target that was hit
     */
    handleTargetHit(projectile, target) {
        if (!projectile.active || !target.active) return;

        const targetType = target.getData('type');
        const points = target.getData('points') || 10;
        const explodes = target.getData('explodes');

        // Disable projectile
        projectile.setActive(false);
        projectile.setVisible(false);

        // Add points
        this.targetRangeScore += points;
        recordGuardianActivity(window.GameState, 'targetHits');
        if (this.targetRangeScoreText) {
            this.targetRangeScoreText.setText(`🎯 Score: ${this.targetRangeScore}`);
        }

        // Play hit sound
        if (window.AudioManager) {
            if (explodes) {
                window.AudioManager.playError?.(); // Explosion sound
            } else {
                window.AudioManager.playCoinCollect?.(); // Hit sound
            }
        }

        // Create hit effect based on target type
        this.createTargetHitEffect(target.x, target.y, targetType, explodes);

        // Show floating points
        this.showFloatingText(`+${points}`, target.x, target.y - 30, '#FFD700');

        // Handle target response
        if (explodes) {
            // Barrels explode and respawn
            this.explodeTarget(target);
        } else if (targetType === 'moving') {
            // Moving targets flash and keep moving
            this.flashTarget(target);
        } else {
            // Static targets wobble and reset
            this.wobbleTarget(target);
        }

        console.log(`[GameScene] Target hit! Type: ${targetType}, Points: ${points}, Total: ${this.targetRangeScore}`);
    }

    /**
     * Create visual effect when target is hit
     */
    createTargetHitEffect(x, y, targetType, explodes) {
        const color = explodes ? 0xFF6600 : targetType === 'moving' ? 0xFFD700 : 0xFF6B6B;
        const particleCount = explodes ? 20 : 8;

        // Create particle texture if needed
        const textureKey = `targetHitParticle_${targetType}`;
        if (!this.textures.exists(textureKey)) {
            const graphics = this.add.graphics();
            graphics.fillStyle(color, 1);
            graphics.fillCircle(4, 4, 4);
            graphics.generateTexture(textureKey, 8, 8);
            graphics.destroy();
        }

        // Create particle burst
        const particles = this.add.particles(x, y, textureKey, {
            speed: { min: explodes ? 100 : 50, max: explodes ? 250 : 120 },
            scale: { start: explodes ? 1.5 : 0.8, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: explodes ? 800 : 400,
            quantity: particleCount,
            blendMode: 'ADD',
            angle: { min: 0, max: 360 }
        });

        // Clean up
        this.time.delayedCall(explodes ? 1000 : 500, () => {
            particles.destroy();
        });
    }

    /**
     * Explode a barrel target (temporary removal + respawn)
     */
    explodeTarget(target) {
        const originalX = target.x;
        const originalY = target.y;

        // Hide target
        target.setVisible(false);
        target.setActive(false);
        target.body.enable = false;

        // Screen shake for explosion
        window.FeedbackManager?.cameraShake?.(this, 200, 0.01);

        // Respawn after 3 seconds
        this.time.delayedCall(3000, () => {
            if (target && target.scene) {
                target.setPosition(originalX, originalY);
                target.setVisible(true);
                target.setActive(true);
                target.body.enable = true;
                target.setAlpha(0);
                this.tweens.add({
                    targets: target,
                    alpha: 1,
                    duration: 500
                });
            }
        });
    }

    /**
     * Flash effect for moving target hit
     */
    flashTarget(target) {
        // Quick flash sequence
        this.tweens.add({
            targets: target,
            alpha: { from: 1, to: 0.2 },
            duration: 100,
            yoyo: true,
            repeat: 3
        });
    }

    /**
     * Wobble effect for static target hit
     */
    wobbleTarget(target) {
        // Store original position
        const originalX = target.x;

        // Wobble animation
        this.tweens.add({
            targets: target,
            x: { from: originalX - 5, to: originalX + 5 },
            duration: 50,
            yoyo: true,
            repeat: 4,
            onComplete: () => {
                target.x = originalX;
            }
        });
    }

    /**
     * Check if player is in target range area
     */
    checkTargetRangeProximity() {
        if (!this.player || !this.sanctuaryZones) return;

        const zone = this.sanctuaryZones.zones?.trainingGrounds;
        if (!zone) return;

        const inRange = this.player.x >= zone.bounds.x &&
                        this.player.x <= zone.bounds.x + zone.bounds.width &&
                        this.player.y >= zone.bounds.y &&
                        this.player.y <= zone.bounds.y + zone.bounds.height;

        if (inRange !== this.nearTargetRange) {
            this.nearTargetRange = inRange;

            // Show/hide score display
            if (this.targetRangeScoreBg) {
                this.targetRangeScoreBg.setVisible(inRange);
            }
            if (this.targetRangeScoreText) {
                this.targetRangeScoreText.setVisible(inRange);
            }

            if (inRange) {
                // Show hint when entering
                this.showInteractionHint('🎯 Fire at targets to practice! Use attack button.');
            }
        }
    }

    /**
     * Activate time-slow ability (unlocked via campfire bonding sessions)
     * Slows game time to 30% for 5 seconds, with 30-second cooldown
     */
    activateTimeSlow() {
        // Check if ability is unlocked
        const isUnlocked = window.GameState?.get('bonding.timeSlowUnlocked') || false;

        if (!isUnlocked) {
            // Show hint that ability isn't unlocked yet
            this.showFloatingText('Rest by the campfire to unlock!', this.player.x, this.player.y - 50, '#FFAA00');
            if (window.AudioManager) {
                window.AudioManager.playError?.();
            }
            return;
        }

        // Check cooldown
        if (this.timeSlowCooldown) {
            this.showFloatingText('Time-Slow recharging...', this.player.x, this.player.y - 50, '#888888');
            return;
        }

        // Check if already active
        if (this.timeSlowActive) {
            return;
        }

        console.log('[GameScene] Activating time-slow ability');
        this.timeSlowActive = true;

        // Play activation sound
        if (window.AudioManager) {
            window.AudioManager.playVisionReveal?.();
        }

        // Visual effect - purple overlay with time ripple
        this.createTimeSlowOverlay();

        // Slow down game physics
        const originalTimeScale = this.physics.world.timeScale;
        this.physics.world.timeScale = 1 / this.timeSlowFactor; // Inverse because timeScale > 1 means slower

        // Slow down tweens
        this.tweens.timeScale = this.timeSlowFactor;

        // Show activation text
        this.showFloatingText('⏱️ TIME SLOW', this.player.x, this.player.y - 80, '#AA00FF');

        // End time-slow after duration
        this.time.delayedCall(this.timeSlowDuration, () => {
            this.deactivateTimeSlow(originalTimeScale);
        });
    }

    /**
     * Create visual overlay for time-slow effect
     */
    createTimeSlowOverlay() {
        const { width, height } = this.scale;

        // Purple tinted overlay
        this.timeSlowOverlay = this.add.graphics();
        this.timeSlowOverlay.fillStyle(0x6600AA, 0.15);
        this.timeSlowOverlay.fillRect(0, 0, width, height);
        this.timeSlowOverlay.setScrollFactor(0);
        this.timeSlowOverlay.setDepth(500);

        // Ripple effect from player position
        const ripple = this.add.graphics();
        ripple.setScrollFactor(0);
        ripple.setDepth(499);
        this.timeSlowOverlay.ripple = ripple;

        // Animate ripple expanding
        let rippleSize = 0;
        const rippleAnim = this.tweens.add({
            targets: { size: 0 },
            size: Math.max(width, height),
            duration: 2000,
            repeat: -1,
            onUpdate: (tween, target) => {
                if (!ripple.active) return;
                ripple.clear();
                ripple.lineStyle(3, 0xAA00FF, Math.max(0, 0.5 - target.size / Math.max(width, height) * 0.5));
                const centerX = width / 2;
                const centerY = height / 2;
                ripple.strokeCircle(centerX, centerY, target.size);
            }
        });
        this.timeSlowOverlay.rippleAnim = rippleAnim;

        // Edge vignette effect
        const vignette = this.add.graphics();
        const vignetteGradient = vignette.createGeometryMask ? null : null; // Simplified
        for (let i = 0; i < 5; i++) {
            const alpha = 0.1 - i * 0.02;
            const offset = i * 30;
            vignette.lineStyle(30, 0x6600AA, alpha);
            vignette.strokeRect(offset, offset, width - offset * 2, height - offset * 2);
        }
        vignette.setScrollFactor(0);
        vignette.setDepth(501);
        this.timeSlowOverlay.vignette = vignette;

        // Pulsing glow animation on overlay
        this.tweens.add({
            targets: this.timeSlowOverlay,
            alpha: { from: 1, to: 0.6 },
            duration: 500,
            yoyo: true,
            repeat: -1
        });
    }

    /**
     * Deactivate time-slow and restore normal speed
     */
    deactivateTimeSlow(originalTimeScale = 1) {
        console.log('[GameScene] Deactivating time-slow');
        this.timeSlowActive = false;

        // Restore physics speed
        this.physics.world.timeScale = originalTimeScale;
        this.tweens.timeScale = 1;

        // Clean up overlay
        if (this.timeSlowOverlay) {
            if (this.timeSlowOverlay.rippleAnim) {
                this.timeSlowOverlay.rippleAnim.stop();
            }
            if (this.timeSlowOverlay.ripple) {
                this.timeSlowOverlay.ripple.destroy();
            }
            if (this.timeSlowOverlay.vignette) {
                this.timeSlowOverlay.vignette.destroy();
            }
            this.tweens.killTweensOf(this.timeSlowOverlay);
            this.timeSlowOverlay.destroy();
            this.timeSlowOverlay = null;
        }

        // Start cooldown
        this.timeSlowCooldown = true;
        this.showFloatingText('Time-Slow ended', this.player.x, this.player.y - 50, '#888888');

        // Reset cooldown after cooldown period
        this.time.delayedCall(this.timeSlowCooldownTime, () => {
            this.timeSlowCooldown = false;
            this.showFloatingText('⏱️ Time-Slow ready!', this.player.x, this.player.y - 50, '#AA00FF');
        });
    }

    /**
     * Handle void portal proximity - automatic pull-in mechanic
     * Player gets sucked in after being too close for too long
     * This creates a clear distinction from spacebar-based ship interaction
     *
     * IMPORTANT: Ship interaction takes priority over void pull.
     * If player is near the ship, they can safely examine it with spacebar.
     */
    handleVoidPortalProximity(player, portal) {
        if (this.voidEntryCooldown) {
            return;
        }

        // Calculate distance to void portal
        const distToPortal = portal && player
            ? Phaser.Math.Distance.Between(player.x, player.y, portal.x, portal.y)
            : Infinity;

        // If player is DIRECTLY on the void portal (within 70px), void pull activates
        // regardless of ship proximity - this is intentional dangerous territory
        const onVoidPortal = distToPortal <= 70;

        // PRIORITY CHECK: If player is near the crashed ship AND not directly on void portal
        // This allows safe ship examination with spacebar while avoiding accidental void pulls
        if (!onVoidPortal && this.nearCrashedShip) {
            // Player is examining the ship - void pull deferred
            return;
        }

        // Also check distance to ship as a safety measure (only if not on void portal)
        if (!onVoidPortal && this.crashedShip && player) {
            const distToShip = Phaser.Math.Distance.Between(
                player.x, player.y,
                this.crashedShip.x, this.crashedShip.y
            );
            // If within ship interaction range (100px, reduced from 150 to allow void portal access),
            // don't start void pull
            if (distToShip <= 100) {
                return;
            }
        }

        if (!this.nearVoidPortal) {
            this.nearVoidPortal = true;
            console.log('[GameScene] Player entering void portal danger zone');

            // Show warning instead of interaction hint - no spacebar needed!
            this.showInteractionHint('⚠️ DANGER! Move away! ⚠️');

            // Start the pull-in sequence
            this.startVoidPullSequence(portal);
        }
    }

    /**
     * Start the void portal pull-in sequence
     * Player has ~2 seconds to escape before being pulled in
     */
    startVoidPullSequence(portal) {
        // Don't start if already in sequence or on cooldown
        if (this.voidPullActive || this.voidEntryCooldown) {
            return;
        }

        this.voidPullActive = true;
        this.voidPullProgress = 0;

        // Create visual pull effect
        if (!this.voidPortalIndicator && portal) {
            this.voidPortalIndicator = this.add.graphics();
            this.voidPortalIndicator.setDepth(portal.depth + 100);
        }

        // Create pull progress bar above player
        if (!this.voidPullBar) {
            this.voidPullBar = this.add.graphics();
            this.voidPullBar.setDepth(2000);
        }

        // Create "Being pulled in!" text
        if (!this.voidPullText) {
            this.voidPullText = this.add.text(portal.x, portal.y - 80, '🌀 BEING PULLED IN! 🌀', {
                fontSize: '14px',
                fontFamily: 'Arial, sans-serif',
                color: '#FF4444',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5).setDepth(2001);

            // Pulsing warning text
            this.tweens.add({
                targets: this.voidPullText,
                scale: { from: 1, to: 1.15 },
                alpha: { from: 1, to: 0.7 },
                duration: 300,
                yoyo: true,
                repeat: -1
            });
        }

        // Haptic warning
        if (window.FeedbackManager) {
            window.FeedbackManager.vibrate('error');
        }

        // Sound warning
        if (window.AudioManager) {
            window.AudioManager.playError();
        }

        // Pull timer - 2 seconds to escape
        const PULL_DURATION = 2000;
        const startTime = this.time.now;

        // Create the pull animation/timer
        this.voidPullTimer = this.time.addEvent({
            delay: 50, // Update every 50ms
            callback: () => {
                if (!this.voidPullActive) {
                    return;
                }

                const elapsed = this.time.now - startTime;
                this.voidPullProgress = Math.min(elapsed / PULL_DURATION, 1);

                // Update visual effects
                this.updateVoidPullEffects(portal);

                // Check if player escaped (moved far enough away)
                if (this.player && portal) {
                    const distance = Phaser.Math.Distance.Between(
                        this.player.x, this.player.y,
                        portal.x, portal.y
                    );

                    // Escape threshold - player must move > 120 pixels away
                    if (distance > 120) {
                        console.log('[GameScene] Player escaped void pull!');
                        this.cancelVoidPull();
                        this.showInteractionHint('💨 Escaped the void!');
                        return;
                    }

                    // Pull player toward the void center slightly
                    const pullStrength = 0.3 + (this.voidPullProgress * 0.5); // Increases as time runs out
                    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, portal.x, portal.y);
                    this.player.x += Math.cos(angle) * pullStrength;
                    this.player.y += Math.sin(angle) * pullStrength;
                }

                // Time's up - enter the void!
                if (this.voidPullProgress >= 1) {
                    console.log('[GameScene] Player pulled into the void!');
                    this.cancelVoidPull();
                    this.enterVoidMiniGame();
                }
            },
            loop: true
        });
    }

    /**
     * Update void pull visual effects
     */
    updateVoidPullEffects(portal) {
        if (!portal) return;

        // Update pull indicator circles (swirling effect)
        if (this.voidPortalIndicator) {
            this.voidPortalIndicator.clear();

            // Outer danger zone - pulsing red
            const outerRadius = 80 - (this.voidPullProgress * 20);
            this.voidPortalIndicator.lineStyle(3, 0xFF0000, 0.5 + this.voidPullProgress * 0.3);
            this.voidPortalIndicator.strokeCircle(portal.x, portal.y, outerRadius);

            // Inner pull spiral - purple, rotating
            const rotation = this.time.now * 0.005;
            for (let i = 0; i < 4; i++) {
                const spiralAngle = rotation + (i * Math.PI / 2);
                const spiralRadius = 40 * (1 - this.voidPullProgress * 0.3);
                const sx = portal.x + Math.cos(spiralAngle) * spiralRadius;
                const sy = portal.y + Math.sin(spiralAngle) * spiralRadius;
                this.voidPortalIndicator.fillStyle(0x9900FF, 0.6);
                this.voidPortalIndicator.fillCircle(sx, sy, 5);
            }

            // Event horizon - shrinking as player gets pulled in
            this.voidPortalIndicator.lineStyle(2, 0x6600FF, 0.8);
            this.voidPortalIndicator.strokeCircle(portal.x, portal.y, 30 * (1 - this.voidPullProgress * 0.5));
        }

        // Update progress bar above player
        if (this.voidPullBar && this.player) {
            this.voidPullBar.clear();

            const barWidth = 60;
            const barHeight = 8;
            const barX = this.player.x - barWidth / 2;
            const barY = this.player.y - 50;

            // Background
            this.voidPullBar.fillStyle(0x333333, 0.8);
            this.voidPullBar.fillRoundedRect(barX, barY, barWidth, barHeight, 4);

            // Fill - red, fills as player is being pulled
            const fillWidth = barWidth * this.voidPullProgress;
            if (fillWidth > 0) {
                // Color transitions from yellow to red
                const color = this.voidPullProgress > 0.6 ? 0xFF0000 : 0xFFAA00;
                this.voidPullBar.fillStyle(color, 1);
                this.voidPullBar.fillRoundedRect(barX, barY, fillWidth, barHeight, 4);
            }

            // Border
            this.voidPullBar.lineStyle(2, 0xFF0000, 0.8);
            this.voidPullBar.strokeRoundedRect(barX, barY, barWidth, barHeight, 4);
        }
    }

    /**
     * Cancel void pull sequence (player escaped or scene changing)
     */
    cancelVoidPull() {
        this.voidPullActive = false;
        this.voidPullProgress = 0;
        this.nearVoidPortal = false;

        // Stop pull timer
        if (this.voidPullTimer) {
            this.voidPullTimer.destroy();
            this.voidPullTimer = null;
        }

        // Clean up visuals
        if (this.voidPortalIndicator) {
            this.voidPortalIndicator.clear();
            this.voidPortalIndicator.destroy();
            this.voidPortalIndicator = null;
        }

        if (this.voidPullBar) {
            this.voidPullBar.clear();
            this.voidPullBar.destroy();
            this.voidPullBar = null;
        }

        if (this.voidPullText) {
            this.voidPullText.destroy();
            this.voidPullText = null;
        }

        // Hide the interaction hint
        this.hideInteractionHint();
        this.sanctuaryInteractionDirector?.update({ force: true });
    }

    /**
     * Enter the Hub World - Travel to other worlds/levels
     */
    enterHubWorld() {
        console.log('[GameScene] Entering Hub World');

        if (this.hubEntryCooldown) {
            console.log('[GameScene] Hub entry on cooldown');
            return;
        }
        if (!this.player || !this.hubPortal || !this.isPlayerAtInteractionDistance(this.hubPortal, this.getInteractionDistance('hubPortal').enter)) {
            console.log('[GameScene] Hub entry blocked - player not in range');
            this.showInteractionHint('Move closer to the hub portal first.');
            if (this.mobileControls) {
                this.mobileControls.updateInteractIcon('👆');
            }
            return;
        }

        this.hubEntryCooldown = true;
        this.time.delayedCall(1000, () => {
            this.hubEntryCooldown = false;
        });

        this.nearHubPortal = false;
        window.QuestManager?.trackProgress('landmark_visit', { landmark: 'hub_gate' });

        // Save player position for return
        getGameState().set('world.lastPosition', {
            x: this.player.x,
            y: this.player.y
        });

        this.sceneRouter.playSound('visionReveal');

        this.sceneRouter.showLoading('Traveling to the Hub...');

        // Screen effect - magical transition
        window.FeedbackManager?.cameraFlash?.(this, 300, 147, 112, 219); // Purple flash

        // Fade out and transition to hub
        this.cameras.main.fadeOut(500, 0, 0, 0);

        this.cameras.main.once('camerafadeoutcomplete', () => {
            // Get the current creature texture for the hub
            const creatureTexture = this.creatureTextureName || getGameState().get('creature.textureName');

            // Start hub world scene
            this.sceneRouter.startScene('HubWorldScene', {
                creatureTexture: creatureTexture,
                returnPosition: {
                    x: this.player.x,
                    y: this.player.y
                }
            }, { sound: null });
        });
    }

    /**
     * Enter the Void Mini-Game
     * Player enters the black hole for a coin collection challenge
     */
    enterVoidMiniGame() {
        console.log('[GameScene] Entering Void Mini-Game');

        if (this.voidEntryCooldown) {
            console.log('[GameScene] Void entry on cooldown');
            return;
        }

        this.voidEntryCooldown = true;
        this.time.delayedCall(1000, () => {
            this.voidEntryCooldown = false;
        });

        this.nearVoidPortal = false;

        // Return outside the rift's activation radius so this portal remains
        // repeatable without immediately pulling the player back in.
        const returnPosition = this.sanctuaryZones?.getVoidExitPosition?.() || {
            x: this.player.x,
            y: this.player.y
        };
        getGameState().set('world.lastPosition', {
            x: returnPosition.x,
            y: returnPosition.y
        });

        this.sceneRouter.playSound('visionReveal');
        this.sceneRouter.showLoading('Entering the Void...');

        // Screen effect - get sucked into the void
        window.FeedbackManager?.cameraShake?.(this, 500, 0.015);

        // Fade to black and start void mini-game
        this.cameras.main.fadeOut(600, 0, 0, 0);

        this.cameras.main.once('camerafadeoutcomplete', () => {
            // Get the current creature texture for the mini-game
            const creatureTexture = this.creatureTextureName || getGameState().get('creature.textureName');

            // Start void mini-game scene
            this.sceneRouter.startScene('VoidMiniGameScene', {
                creatureTexture: creatureTexture,
                returnPosition
            });
        });
    }

    /**
     * Handle player proximity to Crashed Ship
     */
    hasRecoveredProjectBeaconFieldKit() {
        return Boolean(getGameState().get('story.projectBeacon.fieldKit.recovered'));
    }

    createFieldKitCase() {
        if (!this.crashedShip || this.hasRecoveredProjectBeaconFieldKit()) {
            return;
        }

        const caseX = this.crashedShip.x - 125;
        const caseY = this.crashedShip.y + 55;
        const container = this.add.container(caseX, caseY).setDepth(caseY + 2);
        const glow = this.add.graphics();
        glow.fillStyle(0x6FE7DD, 0.15);
        glow.fillRoundedRect(-50, -28, 100, 56, 8);

        const caseBody = this.add.graphics();
        caseBody.fillStyle(0x161C24, 1);
        caseBody.fillRoundedRect(-44, -23, 88, 46, 5);
        caseBody.lineStyle(2, 0xA8B3BD, 1);
        caseBody.strokeRoundedRect(-44, -23, 88, 46, 5);
        caseBody.fillStyle(0x303B46, 1);
        caseBody.fillRoundedRect(-14, -31, 28, 9, 3);
        caseBody.fillStyle(0xD8B65C, 1);
        caseBody.fillRect(-3, -16, 6, 15);
        caseBody.fillRect(-10, -10, 20, 4);

        const label = this.add.text(0, 13, 'FIELD KIT', {
            fontSize: '10px',
            color: '#D7E3EA',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        container.add([glow, caseBody, label]);
        this.fieldKitCase = container;
        this.fieldKitCaseTween = this.tweens.add({
            targets: glow,
            alpha: { from: 0.45, to: 1 },
            duration: 1100,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    recoverProjectBeaconFieldKit() {
        const result = recoverFieldKitState(getGameState());
        if (!result.changed) {
            this.showShipMemories();
            return;
        }

        window.QuestManager?.trackProgress?.('story_interaction', {
            event: 'field_kit_recovered'
        });
        this.astronautFollower?.setFieldKitRecovered(true);

        this.fieldKitCaseTween?.stop();
        this.fieldKitCaseTween = null;

        if (this.fieldKitCase) {
            this.tweens.add({
                targets: this.fieldKitCase,
                alpha: 0,
                scale: 0.85,
                duration: 260,
                ease: 'Power2',
                onComplete: () => {
                    this.fieldKitCase?.destroy(true);
                    this.fieldKitCase = null;
                }
            });
        }

        window.AudioManager?.playButtonClick?.();
        this.showFieldKitRecoveryModal(result.fieldKit);
    }

    showFieldKitRecoveryModal(fieldKit, { context = 'recovery' } = {}) {
        if (this.isFieldKitModalOpen || !fieldKit?.katana) {
            return;
        }

        this.isFieldKitModalOpen = true;
        const creatureName = getGameState().get('creature.name') || 'Your companion';
        this.katanaArtifactModal = new KatanaArtifactModal(this);
        const shown = this.katanaArtifactModal.show({
            fieldKit,
            creatureName,
            context,
            onClose: () => {
                this.katanaArtifactModal = null;
                this.fieldKitModalElements = [];
                this.closeFieldKitModal = null;
                this.isFieldKitModalOpen = false;
                this.nearCrashedShip = false;
            }
        });
        if (!shown) {
            this.katanaArtifactModal = null;
            this.isFieldKitModalOpen = false;
            return;
        }
        this.closeFieldKitModal = () => {
            if (!this.isFieldKitModalOpen) return;
            this.katanaArtifactModal?.destroy?.();
            this.katanaArtifactModal = null;
            this.isFieldKitModalOpen = false;
        };
    }

    handleCrashedShipProximity(player, ship) {
        if (!this.nearCrashedShip) {
            this.nearCrashedShip = true;
            console.log('[GameScene] Player near Crashed Ship');
            const descriptor = this.getCrashedShipInteractionDescriptor();
            this.offerSanctuaryInteraction({
                id: 'crashedShip',
                target: ship,
                message: descriptor.message,
                icon: descriptor.icon,
                tone: 0x90A4AE,
                priority: 62,
                presentation: () => (
                    this.getCrashedShipInteractionDescriptor()
                ),
                action: () => this.interactWithCrashedShip()
            });
        }
    }

    getCrashedShipInteractionDescriptor() {
        const fieldKitRecovered = this.hasRecoveredProjectBeaconFieldKit();
        const senseiMemory = getSenseiMemorySnapshot(window.GameState);
        const shipEvidence = getShipEvidenceSnapshot(window.GameState);
        const shipReconstruction = getShipReconstructionSnapshot(
            window.GameState
        );
        const consent = getCompanionConsentSnapshot(window.GameState);
        const earthMemory = getCompanionEarthMemorySnapshot(window.GameState);
        const protectedReturn = getProtectedReturnSnapshot(window.GameState);
        const currentVeil = getCurrentVeilSnapshot(window.GameState);
        const message = fieldKitRecovered && senseiMemory.ready
            ? `Press SPACE · Personal memory ${senseiMemory.recalledCount + 1}/${senseiMemory.totalMemories}`
            : fieldKitRecovered && shipReconstruction.ready
                ? `Press SPACE · Install ${shipReconstruction.readyStep.partName}`
            : fieldKitRecovered && shipReconstruction.fieldSupport.ready
                ? 'Press SPACE · Powered berth ready'
            : fieldKitRecovered && shipEvidence.ready
                ? `Press SPACE · Ship archive ${shipEvidence.reviewedCount}/${shipEvidence.totalSections}`
            : fieldKitRecovered && consent.ready
                ? `Press SPACE · Earth boundaries ${consent.reviewedCount}/${consent.totalTopics}`
            : fieldKitRecovered && earthMemory.ready
                ? 'Press SPACE · Your companion has an Earth question'
            : fieldKitRecovered && earthMemory.complete
                ? 'Press SPACE · Review your shared Earth memory'
            : fieldKitRecovered && protectedReturn.ready
                ? `Press SPACE · Return safeguards ${protectedReturn.completedCount}/${protectedReturn.totalSteps}`
            : fieldKitRecovered && protectedReturn.complete
                ? currentVeil.verificationReady
                    ? 'Press SPACE · Verify living mask'
                    : currentVeil.active
                        ? `Press SPACE · Quiet Current ${currentVeil.stabilizedCount}/${currentVeil.totalAnchors}`
                        : currentVeil.complete
                            ? 'Press SPACE · Living mask verified'
                            : 'Press SPACE · Protected return sealed'
            : fieldKitRecovered && shipEvidence.available
                ? 'Press SPACE · Open ship and evidence board'
            : fieldKitRecovered
                ? 'Press SPACE · Examine Wanderer-77'
                : 'Press SPACE · Recover the Earth field kit';
        return {
            message,
            icon: fieldKitRecovered ? '🚀' : '🥋'
        };
    }

    interactWithCrashedShip() {
        if (!this.nearCrashedShip) return false;
        if (!this.hasRecoveredProjectBeaconFieldKit()) {
            console.log('[GameScene] Recovering field kit from ship interaction');
            this.recoverProjectBeaconFieldKit();
            return true;
        }

        const senseiMemory = getSenseiMemorySnapshot(window.GameState);
        const shipEvidence = getShipEvidenceSnapshot(window.GameState);
        const shipReconstruction = getShipReconstructionSnapshot(
            window.GameState
        );
        const consent = getCompanionConsentSnapshot(window.GameState);
        const earthMemory = getCompanionEarthMemorySnapshot(window.GameState);
        const protectedReturn = getProtectedReturnSnapshot(window.GameState);
        const currentVeil = getCurrentVeilSnapshot(window.GameState);
        if (senseiMemory.ready) {
            this.showSenseiMemory();
        } else if (
            shipReconstruction.ready ||
            shipReconstruction.fieldSupport.ready ||
            shipEvidence.ready
        ) {
            this.showShipEvidenceBoard();
        } else if (consent.ready) {
            this.showCompanionBoundaryReview();
        } else if (earthMemory.ready || earthMemory.complete) {
            this.showCompanionEarthMemory();
        } else if (
            protectedReturn.ready ||
            (protectedReturn.available && !protectedReturn.complete)
        ) {
            this.showShipEvidenceBoard();
        } else if (currentVeil.verificationReady) {
            this.showCurrentVeilMission({ verifyPacket: true });
        } else if (currentVeil.active) {
            this.showCurrentVeilMission();
        } else if (shipEvidence.available) {
            this.showShipEvidenceBoard();
        } else {
            this.showShipMemories();
        }
        return true;
    }

    showSenseiMemory() {
        if (
            this.senseiMemoryModal?.isVisible ||
            !window.GameState
        ) {
            return;
        }
        const snapshot = getSenseiMemorySnapshot(window.GameState);
        if (!snapshot.ready || !snapshot.nextMemory) return;

        this.senseiMemoryModal = new SenseiMemoryModal(this, {
            snapshotProvider: () => (
                getSenseiMemorySnapshot(window.GameState)
            ),
            onRecall: memoryId => {
                const result = recordSenseiMemory(
                    window.GameState,
                    memoryId
                );
                if (!result?.changed) {
                    window.AudioManager?.playError?.();
                    return result;
                }
                window.AchievementSystem?.recordEvent?.(
                    'story_interaction',
                    {
                        event: 'sensei_memory_recalled',
                        memoryId,
                        lessonUnlocked:
                            result.reason === 'lesson_unlocked'
                    }
                );
                recordCampaignLegacyCapsule(window.GameState, {
                    intent: window.GameState.get(
                        'story.projectBeacon.finale.priority'
                    ),
                    recordedAt: new Date().toISOString()
                });
                window.AudioManager?.playAchievement?.();
                return result;
            },
            onClose: () => {
                this.senseiMemoryModal = null;
                const current = getSenseiMemorySnapshot(
                    window.GameState
                );
                this.showInteractionHint(
                    current.lesson.unlocked
                        ? 'Centering Stance · release movement after a hit'
                        : `Personal archive ${current.recalledCount}/${current.totalMemories}`
                );
            }
        });
        this.senseiMemoryModal.show(snapshot.nextMemory.id);
    }

    showShipEvidenceBoard() {
        if (
            this.shipEvidenceBoardModal?.isVisible ||
            !window.GameState
        ) {
            return;
        }
        const snapshot = getShipEvidenceSnapshot(window.GameState);
        const reconstruction = getShipReconstructionSnapshot(
            window.GameState
        );
        const protocol = getProtectedReturnSnapshot(window.GameState);
        if (!snapshot.available && !reconstruction.available) return;

        this.shipEvidenceBoardModal = new ShipEvidenceBoardModal(this, {
            snapshotProvider: () => (
                getShipEvidenceSnapshot(window.GameState)
            ),
            reconstructionSnapshotProvider: () => (
                getShipReconstructionSnapshot(window.GameState)
            ),
            onReconstructionStep: stepId => {
                const result = installShipReconstructionStep(
                    window.GameState,
                    stepId
                );
                if (!result?.changed) {
                    window.AudioManager?.playError?.();
                    return result;
                }
                window.AchievementSystem?.recordEvent?.(
                    'story_interaction',
                    {
                        event: 'ship_system_installed',
                        stepId,
                        complete: result.snapshot.complete
                    }
                );
                recordCampaignLegacyCapsule(window.GameState, {
                    intent: window.GameState.get(
                        'story.projectBeacon.finale.priority'
                    ),
                    recordedAt:
                        result.snapshot.state.completedAt ||
                        new Date().toISOString()
                });
                if (result.snapshot.complete) {
                    window.AudioManager?.playAchievement?.();
                } else {
                    window.AudioManager?.playButtonClick?.();
                }
                if (
                    this.continueFinaleAfterRepair ||
                    this.shipReconstructionHandoff
                ) {
                    this.time.delayedCall(900, () => {
                        this.shipEvidenceBoardModal?.hide?.();
                    });
                }
                return result;
            },
            onCompanionService: () => {
                const result = serviceCompanionAtPoweredBerth(
                    window.GameState
                );
                if (!result?.changed) {
                    window.AudioManager?.playError?.();
                    return result;
                }
                window.AchievementSystem?.recordEvent?.(
                    'story_interaction',
                    {
                        event: 'powered_berth_service',
                        levelMilestone:
                            result.snapshot.fieldSupport.state
                                .lastServicedLevel,
                        energyRestored: result.energyRestored,
                        healthRestored: result.healthRestored
                    }
                );
                this.updateStatsDisplay?.();
                window.AudioManager?.playAchievement?.();
                return result;
            },
            onReview: sectionId => {
                const result = recordShipEvidenceSection(
                    window.GameState,
                    sectionId
                );
                if (!result?.changed) {
                    window.AudioManager?.playError?.();
                    return result;
                }
                window.AchievementSystem?.recordEvent?.(
                    'story_interaction',
                    {
                        event: 'ship_archive_reviewed',
                        sectionId,
                        complete: result.snapshot.complete
                    }
                );
                if (result.snapshot.complete) {
                    recordCampaignLegacyCapsule(window.GameState, {
                        intent: window.GameState.get(
                            'story.projectBeacon.finale.priority'
                        ),
                        recordedAt:
                            result.snapshot.state.completedAt ||
                            new Date().toISOString()
                    });
                    window.AudioManager?.playAchievement?.();
                } else {
                    window.AudioManager?.playButtonClick?.();
                }
                return result;
            },
            protocolSnapshotProvider: () => (
                getProtectedReturnSnapshot(window.GameState)
            ),
            handoffSnapshotProvider: () => (
                getHomecomingHandoffSnapshot(window.GameState)
            ),
            onProtocolStep: stepId => {
                const result = applyProtectedReturnStep(
                    window.GameState,
                    stepId
                );
                if (!result?.changed) {
                    window.AudioManager?.playError?.();
                    return result;
                }
                window.AchievementSystem?.recordEvent?.(
                    'story_interaction',
                    {
                        event: 'protected_return_safeguard',
                        stepId,
                        complete: result.snapshot.complete
                    }
                );
                recordCampaignLegacyCapsule(window.GameState, {
                    intent: window.GameState.get(
                        'story.projectBeacon.finale.priority'
                    ),
                    recordedAt:
                        result.snapshot.state.completedAt ||
                        new Date().toISOString()
                });
                if (result.snapshot.complete) {
                    window.AudioManager?.playAchievement?.();
                } else {
                    window.AudioManager?.playButtonClick?.();
                }
                return result;
            },
            onClose: () => {
                this.shipEvidenceBoardModal = null;
                if (
                    this.continueFinaleAfterRepair &&
                    !this._isShuttingDown &&
                    getShipReconstructionSnapshot(window.GameState).complete
                ) {
                    this.finishFinaleAfterCommandRepair();
                    return;
                }
                const current = getShipEvidenceSnapshot(
                    window.GameState
                );
                const currentReconstruction =
                    getShipReconstructionSnapshot(window.GameState);
                const currentProtocol =
                    getProtectedReturnSnapshot(window.GameState);
                const currentHandoff =
                    getHomecomingHandoffSnapshot(window.GameState);
                if (this.shipReconstructionHandoff) {
                    const nextRoute = this.shipReconstructionNextGateLabel
                        ? ` // HUB ROUTE: ${this.shipReconstructionNextGateLabel.toUpperCase()}`
                        : '';
                    this.shipReconstructionHandoff = false;
                    if (
                        currentReconstruction.finalVoidReady &&
                        this.shipReconstructionNextGateLabel === 'The Final Void'
                    ) {
                        this.showInteractionHint(
                            'FIVE SYSTEMS ONLINE // RETURNING TO THE FINAL ROUTE'
                        );
                        this.time.delayedCall(420, () => {
                            if (!this._isShuttingDown) {
                                this.scene.start('HubWorldScene');
                            }
                        });
                        return;
                    }
                    this.showInteractionHint(
                        currentReconstruction.ready
                            ? `INSTALL ${currentReconstruction.readyStep.partName.toUpperCase()} BEFORE THE NEXT EXPEDITION`
                            : `WANDERER-77 SYSTEM ONLINE${nextRoute}`
                    );
                    this.time.delayedCall(420, () => {
                        if (!this._isShuttingDown) {
                            this.scene.start('HubWorldScene');
                        }
                    });
                    return;
                }
                this.showInteractionHint(
                    currentHandoff.readyForHomecoming
                        ? 'Homecoming record verified · no transmission'
                    : currentReconstruction.ready
                        ? `Ship reconstruction ${currentReconstruction.completedCount}/${currentReconstruction.totalSteps}`
                    : currentReconstruction.fieldSupport.ready
                        ? 'Powered berth ready · companion service available'
                    : currentProtocol.complete
                        ? 'Protected return sealed · report held'
                        : currentProtocol.available
                            ? `Return safeguards ${currentProtocol.completedCount}/${currentProtocol.totalSteps}`
                        : current.complete
                            ? 'Ship archive reviewed · no transmission'
                        : `Ship archive ${current.reviewedCount}/${current.totalSections}`
                );
            }
        });
        this.shipEvidenceBoardModal.show(
            reconstruction.ready ||
                reconstruction.fieldSupport.ready
                ? 'reconstruction'
                : snapshot.nextSection?.id ||
                (protocol.available ? 'protocol' : 'systems')
        );
    }

    finishFinaleAfterCommandRepair() {
        if (!this.continueFinaleAfterRepair || this._isShuttingDown) {
            return false;
        }
        this.continueFinaleAfterRepair = false;
        window.AchievementSystem?.recordEvent?.('game_complete', {});
        this.time.delayedCall(180, () => {
            if (!this._isShuttingDown) {
                this.scene.start('VictoryScene');
            }
        });
        return true;
    }

    showCompanionBoundaryReview() {
        if (
            this.companionConsentModal?.isVisible ||
            !window.GameState
        ) {
            return;
        }
        const snapshot = getCompanionConsentSnapshot(window.GameState);
        if (!snapshot.ready && !snapshot.complete) return;

        this.companionConsentModal = new CompanionConsentModal(this, {
            snapshotProvider: () => (
                getCompanionConsentSnapshot(window.GameState)
            ),
            onReview: topicId => {
                const result = recordCompanionBoundaryTopic(
                    window.GameState,
                    topicId
                );
                if (!result?.changed) {
                    window.AudioManager?.playError?.();
                    return result;
                }

                this.recordBondActivity('community');
                window.AchievementSystem?.recordEvent?.(
                    'story_interaction',
                    {
                        event: 'companion_boundary_reviewed',
                        companionId: result.snapshot.companionId,
                        topicId,
                        complete: result.snapshot.complete
                    }
                );
                if (result.snapshot.complete) {
                    recordCampaignLegacyCapsule(window.GameState, {
                        intent: result.snapshot.priority,
                        recordedAt:
                            result.record.recordedAt ||
                            new Date().toISOString()
                    });
                    window.AudioManager?.playAchievement?.();
                } else {
                    window.AudioManager?.playButtonClick?.();
                }
                return result;
            },
            onClose: () => {
                this.companionConsentModal = null;
                const current = getCompanionConsentSnapshot(
                    window.GameState
                );
                if (current.complete) {
                    this.showInteractionHint(
                        'Earth boundaries recorded · travel remains undecided'
                    );
                }
            }
        });
        this.companionConsentModal.show(
            snapshot.complete ? 'complete' : 'menu'
        );
    }

    showCompanionEarthMemory() {
        if (
            this.companionEarthMemoryModal?.isVisible ||
            !window.GameState
        ) {
            return;
        }
        const snapshot = getCompanionEarthMemorySnapshot(window.GameState);
        if (!snapshot.ready && !snapshot.complete) return;

        this.companionEarthMemoryModal = new CompanionEarthMemoryModal(this, {
            snapshotProvider: () => (
                getCompanionEarthMemorySnapshot(window.GameState)
            ),
            onShare: memoryId => {
                const result = shareCompanionEarthMemory(
                    window.GameState,
                    memoryId
                );
                if (!result?.changed) {
                    window.AudioManager?.playError?.();
                    return result;
                }
                this.recordBondActivity('community');
                window.AchievementSystem?.recordEvent?.(
                    'story_interaction',
                    {
                        event: 'companion_earth_memory_shared',
                        companionId: result.snapshot.companionId,
                        memoryId,
                        invitationStatus: 'not_offered',
                        transmissionStatus: 'not_sent'
                    }
                );
                recordCampaignLegacyCapsule(window.GameState, {
                    intent: window.GameState.get(
                        'story.projectBeacon.finale.priority'
                    ),
                    recordedAt:
                        result.record.sharedAt || new Date().toISOString()
                });
                window.AudioManager?.playAchievement?.();
                return result;
            },
            onClose: () => {
                this.companionEarthMemoryModal = null;
                const current = getCompanionEarthMemorySnapshot(
                    window.GameState
                );
                if (current.complete) {
                    this.showInteractionHint(
                        'Earth memory shared · no invitation or transmission'
                    );
                }
            }
        });
        this.companionEarthMemoryModal.show(
            snapshot.complete ? 'shared' : 'menu'
        );
    }

    /**
     * Handle player proximity to Return Portal
     */
    handleReturnPortalProximity(player, portal) {
        if (!this.nearReturnPortal) {
            this.nearReturnPortal = true;
            console.log('[GameScene] Player near Return Portal');

            this.showInteractionHint('Press SPACE to return home 🏠');

            if (this.mobileControls) {
                this.mobileControls.updateInteractIcon('🏠');
            }
        }
    }

    /**
     * Return to Sanctuary from another biome
     */
    returnToSanctuary() {
        console.log('[GameScene] Returning to Sanctuary');

        if (!this.player || !this.returnPortal || !this.isPlayerAtInteractionDistance(this.returnPortal, this.getInteractionDistance('returnPortal').enter)) {
            console.log('[GameScene] Return sanctuary blocked - player not in range');
            if (this.mobileControls) {
                this.mobileControls.updateInteractIcon('👆');
            }
            return;
        }

        this.sceneRouter.showLoading('Returning home...');
        this.sceneRouter.playSound('purchase');

        // Flash transition effect
        const { width, height } = this.scale;
        const flash = this.add.graphics();
        flash.fillStyle(0xFFD700, 0);
        flash.fillRect(0, 0, width, height);
        flash.setScrollFactor(0);
        flash.setDepth(5000);

        this.tweens.add({
            targets: flash,
            alpha: 1,
            duration: 500,
            ease: 'Power2',
            onComplete: () => {
                // Return to nebula biome (Sanctuary)
                this.sceneRouter.startScene('GameScene', { biome: 'nebula' });
            }
        });
    }

    /**
     * Show first-time story modal if player hasn't seen it before
     * This automatically shows the crash story on first entry to GameScene
     */
    showFirstTimeStoryIfNeeded() {
        // Check if story has been seen
        const hasSeenStory = window.GameState?.get('tutorial.crashStorySeen');
        if (hasSeenStory) {
            console.log('[GameScene] Crash story already seen, skipping');
            return;
        }

        // Check if controls tutorial is still showing - if so, wait
        if (this.controlsTutorial?.isVisible) {
            console.log('[GameScene] Controls tutorial still showing, delaying story');
            this.time.delayedCall(1000, () => this.showFirstTimeStoryIfNeeded());
            return;
        }

        console.log('[GameScene] Showing first-time crash story');

        // Mark as seen before showing (prevents double-show)
        window.GameState?.set('tutorial.crashStorySeen', true);
        window.GameState?.save();

        // Show the story modal
        this.showShipMemories();
    }

    /**
     * Create "Read Story" sign near the crashed ship for manual access
     */
    createReadStorySign() {
        if (!this.crashedShip) return;

        // Position the sign to the right and below the crashed ship
        const signX = this.crashedShip.x + 130;
        const signY = this.crashedShip.y + 50;

        // Create sign post graphic
        const signPost = this.add.graphics();
        signPost.setDepth(signY + 1);

        // Post
        signPost.fillStyle(0x8B4513, 1); // Brown
        signPost.fillRect(signX - 4, signY - 10, 8, 50);

        // Sign board background
        signPost.fillStyle(0x5D3A1A, 1); // Darker brown
        signPost.fillRoundedRect(signX - 50, signY - 45, 100, 40, 5);
        signPost.lineStyle(2, 0x3D2A0A);
        signPost.strokeRoundedRect(signX - 50, signY - 45, 100, 40, 5);

        // Sign text
        const signText = this.add.text(signX, signY - 25, '📖 Read Story', {
            fontSize: '14px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(signY + 2);

        // Create interactive zone for the sign
        const signZone = this.add.zone(signX, signY - 25, 100, 50);
        signZone.setInteractive({ useHandCursor: true });
        signZone.setDepth(signY + 3);

        // Hover effect
        signZone.on('pointerover', () => {
            signText.setColor('#FFFFFF');
            signText.setScale(1.1);
        });

        signZone.on('pointerout', () => {
            signText.setColor('#FFD700');
            signText.setScale(1.0);
        });

        // Click to show story
        signZone.on('pointerdown', () => {
            if (window.AudioManager) {
                window.AudioManager.playButtonClick();
            }
            this.showShipMemories();
        });

        // Store references for cleanup
        this.readStorySign = { post: signPost, text: signText, zone: signZone };

        console.log('[GameScene] Read Story sign created near crashed ship');
    }

    /**
     * Show ship memories/narrative when interacting with crashed ship
     * Enhanced with multi-page storyline and repair progress
     */
    /**
     * Show ship memories with optional callback when dismissed
     * @param {Function} onComplete - Optional callback when story is dismissed
     */
    showShipMemoriesWithCallback(onComplete = null) {
        this.showShipMemories(onComplete);
    }

    showShipMemories(onComplete = null) {
        if (this.storyModalElements?.length) {
            return;
        }
        console.log('[GameScene] Showing ship memories');

        const { width, height } = this.scale;
        const elements = [];
        // Store elements on this so OnboardingManager can detect dismissal
        this.storyModalElements = elements;
        const restoreMobileControls = this.mobileControls?.suspend?.() === true;
        const physicsWasPaused = Boolean(this.physics?.world?.isPaused);
        if (!physicsWasPaused) {
            this.physics?.pause?.();
        }

        const storyPages = projectBeacon.openingPages;

        let currentPage = 0;
        let nativeNextButton = null;
        let nativeNextDom = null;
        let nativeBackButton = null;
        let nativeBackDom = null;
        const domContainer = this.game?.domContainer || null;
        const previousDomContainerStyles = domContainer ? {
            zIndex: domContainer.style.zIndex,
            pointerEvents: domContainer.style.pointerEvents
        } : null;
        if (domContainer) {
            domContainer.style.zIndex = '12010';
            domContainer.style.pointerEvents = 'auto';
        }

        // Create overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.85);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(12000);
        elements.push(overlay);

        const inputShield = this.add.zone(width / 2, height / 2, width, height)
            .setScrollFactor(0)
            .setDepth(12001)
            .setInteractive();
        elements.push(inputShield);

        // Memory panel
        const isNarrow = width < 500;
        const panelWidth = Math.min(550, width - (isNarrow ? 16 : 32));
        const panelHeight = Math.min(isNarrow ? 500 : 540, height - 24);
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x0D0D1E, 0.98);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
        panel.lineStyle(2, 0x4A90A4);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
        panel.setScrollFactor(0);
        panel.setDepth(12002);
        elements.push(panel);

        // Header background
        const headerBg = this.add.graphics();
        headerBg.fillStyle(0x1A2040, 1);
        headerBg.fillRoundedRect(panelX, panelY, panelWidth, 70, { tl: 8, tr: 8, bl: 0, br: 0 });
        headerBg.setScrollFactor(0);
        headerBg.setDepth(12002);
        elements.push(headerBg);

        // Dynamic content elements
        const iconText = this.add.text(panelX + 25, panelY + 35, storyPages[0].icon, {
            fontSize: isNarrow ? '25px' : '32px',
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(12003);
        elements.push(iconText);

        const titleText = this.add.text(panelX + 75, panelY + 25, storyPages[0].title, {
            fontSize: isNarrow ? '17px' : '22px',
            fontFamily: 'Arial, sans-serif',
            color: storyPages[0].color,
            fontStyle: 'bold'
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(12003);
        elements.push(titleText);

        const subtitleText = this.add.text(panelX + 75, panelY + 50, storyPages[0].subtitle, {
            fontSize: isNarrow ? '12px' : '14px',
            fontFamily: 'Arial, sans-serif',
            color: '#AEB8C2'
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(12003);
        elements.push(subtitleText);

        const contentText = this.add.text(panelX + 24, panelY + 104, storyPages[0].content, {
            fontSize: isNarrow ? '15px' : '16px',
            fontFamily: 'Arial, sans-serif',
            color: '#E4EAF0',
            align: 'left',
            lineSpacing: isNarrow ? 6 : 8,
            wordWrap: { width: panelWidth - 48 }
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(12003);
        elements.push(contentText);

        // Page indicator
        const pageIndicator = this.add.text(width / 2, panelY + panelHeight - 85,
            `Page ${currentPage + 1} of ${storyPages.length}`, {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            color: '#AEB8C2'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(12003);
        elements.push(pageIndicator);

        // Navigation dots
        const dotsY = panelY + panelHeight - 110;
        const dots = [];
        for (let i = 0; i < storyPages.length; i++) {
            const dot = this.add.graphics();
            const dotX = width / 2 + (i - (storyPages.length - 1) / 2) * 18;
            dot.fillStyle(i === 0 ? 0x4A90A4 : 0x444444, 1);
            dot.fillCircle(dotX, dotsY, 5);
            dot.setScrollFactor(0);
            dot.setDepth(12003);
            dots.push(dot);
            elements.push(dot);
        }

        // Update page function
        const updatePage = (pageIndex) => {
            const page = storyPages[pageIndex];
            iconText.setText(page.icon);
            titleText.setText(page.title);
            titleText.setColor(page.color);
            subtitleText.setText(page.subtitle);
            contentText.setText(page.content);
            pageIndicator.setText(`Page ${pageIndex + 1} of ${storyPages.length}`);

            // Update dots
            dots.forEach((dot, i) => {
                dot.clear();
                const dotX = width / 2 + (i - (storyPages.length - 1) / 2) * 18;
                dot.fillStyle(i === pageIndex ? 0x4A90A4 : 0x444444, 1);
                dot.fillCircle(dotX, dotsY, 5);
            });

            // Update button visibility
            prevBtn.setAlpha(pageIndex > 0 ? 1 : 0.3);
            if (nativeBackButton) {
                nativeBackButton.disabled = pageIndex === 0;
                nativeBackButton.setAttribute(
                    'aria-label',
                    pageIndex === 0
                        ? 'No previous briefing page'
                        : `Return to briefing page ${pageIndex}`
                );
            }
            nextBtn.setText(pageIndex === storyPages.length - 1 ? 'Close' : 'Next →');
            if (nativeNextButton) {
                nativeNextButton.textContent = pageIndex === storyPages.length - 1
                    ? 'CLOSE'
                    : 'NEXT';
                nativeNextButton.setAttribute(
                    'aria-label',
                    pageIndex === storyPages.length - 1
                        ? 'Close Project Beacon briefing'
                        : `Continue to briefing page ${pageIndex + 2}`
                );
            }
        };

        // Previous button
        const prevBtn = this.add.text(panelX + 24, panelY + panelHeight - 38, 'Back', {
            fontSize: '15px',
            fontFamily: 'Arial, sans-serif',
            color: '#AAAAAA',
            backgroundColor: '#2A2A4E',
            padding: { x: 18, y: 10 }
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(12003);
        prevBtn.setAlpha(0.3);
        elements.push(prevBtn);

        const prevZone = this.add.zone(
            panelX + 68,
            panelY + panelHeight - 38,
            96,
            48
        ).setScrollFactor(0).setDepth(12004).setInteractive({ useHandCursor: true });
        elements.push(prevZone);
        prevZone.on('pointerover', () => {
            if (currentPage > 0) prevBtn.setColor('#FFFFFF');
        });
        prevZone.on('pointerout', () => prevBtn.setColor('#AAAAAA'));
        prevZone.on('pointerdown', () => {
            if (currentPage > 0) {
                currentPage--;
                updatePage(currentPage);
                if (window.AudioManager) window.AudioManager.playButtonClick();
            }
        });

        // Next/Close button
        const nextBtn = this.add.text(panelX + panelWidth - 24, panelY + panelHeight - 38, 'Next', {
            fontSize: '15px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            backgroundColor: '#4A90A4',
            padding: { x: 20, y: 10 }
        }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(12003);
        elements.push(nextBtn);

        const nextZoneWidth = isNarrow ? 136 : 120;
        const nextZone = this.add.zone(
            panelX + panelWidth - (nextZoneWidth / 2) - 12,
            panelY + panelHeight - 38,
            nextZoneWidth,
            56
        ).setScrollFactor(0).setDepth(12004).setInteractive({ useHandCursor: true });
        elements.push(nextZone);
        nextZone.on('pointerover', () => nextBtn.setStyle({ backgroundColor: '#5AA0B4' }));
        nextZone.on('pointerout', () => nextBtn.setStyle({ backgroundColor: '#4A90A4' }));
        let nextTapBridge = null;
        let storyClosed = false;
        let lastNextActivationAt = Number.NEGATIVE_INFINITY;
        let lastBackActivationAt = Number.NEGATIVE_INFINITY;
        const destroyNextTapBridge = () => {
            nextTapBridge?.destroy?.();
            nextTapBridge = null;
        };
        const restoreStoryDomLayer = () => {
            nativeNextDom?.destroy?.();
            nativeNextDom = null;
            nativeNextButton = null;
            nativeBackDom?.destroy?.();
            nativeBackDom = null;
            nativeBackButton = null;
            if (domContainer && previousDomContainerStyles) {
                domContainer.style.zIndex = previousDomContainerStyles.zIndex;
                domContainer.style.pointerEvents =
                    previousDomContainerStyles.pointerEvents || 'none';
            }
        };
        const cleanupStoryInput = () => {
            destroyNextTapBridge();
            restoreStoryDomLayer();
        };
        this.events?.once?.('shutdown', cleanupStoryInput);
        const closeStory = () => {
            if (storyClosed) return;
            storyClosed = true;
            this.events?.off?.('shutdown', cleanupStoryInput);
            cleanupStoryInput();
            elements.forEach(el => {
                el?.removeAllListeners?.();
                el?.destroy?.();
            });
            this.storyModalElements = [];
            this.nearCrashedShip = false;
            this.input.keyboard.off('keydown', escHandler);
            this.input.keyboard.off('keydown', arrowHandler);
            if (!physicsWasPaused) {
                this.physics?.resume?.();
            }
            if (restoreMobileControls) {
                this.mobileControls?.resume?.();
            }
            window.GameState?.set('story.projectBeacon.missionLogSeen', true);
            window.GameState?.save?.();
            window.QuestManager?.ensureProjectBeaconQuest?.();
            if (onComplete) onComplete();
        };

        const activateNext = () => {
            if (storyClosed) return;
            if (currentPage < storyPages.length - 1) {
                currentPage++;
                updatePage(currentPage);
                if (window.AudioManager) window.AudioManager.playButtonClick();
            } else {
                closeStory();
            }
        };
        const requestNext = event => {
            event?.preventDefault?.();
            event?.stopPropagation?.();
            const activatedAt = performance.now();
            if (activatedAt - lastNextActivationAt < 180) return;
            lastNextActivationAt = activatedAt;
            activateNext();
        };
        const requestPrevious = event => {
            event?.preventDefault?.();
            event?.stopPropagation?.();
            if (storyClosed || currentPage === 0) return;
            const activatedAt = performance.now();
            if (activatedAt - lastBackActivationAt < 180) return;
            lastBackActivationAt = activatedAt;
            currentPage--;
            updatePage(currentPage);
            window.AudioManager?.playButtonClick?.();
        };
        const nextBounds = () => ({
            x: nextZone.x - (nextZone.displayWidth / 2),
            y: nextZone.y - (nextZone.displayHeight / 2),
            width: nextZone.displayWidth,
            height: nextZone.displayHeight
        });
        nextTapBridge = createCanvasTapBridge({
            canvas: this.game?.canvas,
            getGameSize: () => ({
                width: this.scale.width,
                height: this.scale.height
            }),
            getBounds: nextBounds,
            onActivate: requestNext
        });
        nextZone.on('pointerup', pointer => {
            nextTapBridge?.activateGamePoint?.(
                pointer?.x,
                pointer?.y,
                pointer?.event
            );
        });

        // Keep the critical story action on the browser input layer. Physical
        // iPhones can lose the first canvas release after the living-form DOM
        // reveal, while a native button remains a reliable tap target.
        if (domContainer) {
            nativeBackButton = document.createElement('button');
            nativeBackButton.type = 'button';
            nativeBackButton.className = 'project-beacon-story-back';
            nativeBackButton.textContent = 'BACK';
            nativeBackButton.disabled = true;
            nativeBackButton.setAttribute('aria-label', 'No previous briefing page');
            nativeBackButton.setAttribute('data-testid', 'project-beacon-story-back');
            nativeBackButton.addEventListener('pointerup', requestPrevious);
            nativeBackButton.addEventListener('touchend', requestPrevious, {
                passive: false
            });
            nativeBackButton.addEventListener('click', requestPrevious);
            nativeBackDom = this.add.dom(
                prevZone.x,
                prevZone.y,
                nativeBackButton
            ).setOrigin(0.5).setScrollFactor(0).setDepth(12005);

            nativeNextButton = document.createElement('button');
            nativeNextButton.type = 'button';
            nativeNextButton.className = 'project-beacon-story-next';
            nativeNextButton.textContent = 'NEXT';
            nativeNextButton.setAttribute('aria-label', 'Continue to briefing page 2');
            nativeNextButton.setAttribute('data-testid', 'project-beacon-story-next');
            nativeNextButton.addEventListener('pointerup', requestNext);
            nativeNextButton.addEventListener('touchend', requestNext, {
                passive: false
            });
            nativeNextButton.addEventListener('click', requestNext);
            nativeNextDom = this.add.dom(
                nextZone.x,
                nextZone.y,
                nativeNextButton
            ).setOrigin(0.5).setScrollFactor(0).setDepth(12005);
        }

        // Recovery progress uses the same ship-part state as campaign completion.
        const repairY = panelY + panelHeight - 155;
        const repairBg = this.add.graphics();
        repairBg.fillStyle(0x1A1A3E, 0.8);
        repairBg.fillRoundedRect(panelX + 20, repairY, panelWidth - 40, 35, 8);
        repairBg.setScrollFactor(0);
        repairBg.setDepth(12002);
        elements.push(repairBg);

        const repairLabel = this.add.text(panelX + 30, repairY + 17, isNarrow ? '🔧 Recovery:' : '🔧 Beacon Recovery:', {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            color: '#AEB8C2'
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(12003);
        elements.push(repairLabel);

        // Progress bar
        const progressBarX = panelX + (isNarrow ? 125 : 185);
        const progressBarWidth = panelWidth - (isNarrow ? 170 : 230);
        const progressBarBg = this.add.graphics();
        progressBarBg.fillStyle(0x333344, 1);
        progressBarBg.fillRoundedRect(progressBarX, repairY + 10, progressBarWidth, 14, 4);
        progressBarBg.setScrollFactor(0);
        progressBarBg.setDepth(12003);
        elements.push(progressBarBg);

        const collectedParts = window.GameState?.get('hubWorld.shipParts.collected') || [];
        const totalRequired = window.GameState?.get('hubWorld.shipParts.totalRequired') || 5;
        const repairProgress = Math.min(100, Math.round((collectedParts.length / totalRequired) * 100));
        const progressBarFill = this.add.graphics();
        if (repairProgress > 0) {
            progressBarFill.fillStyle(0x4CAF50, 1);
            progressBarFill.fillRoundedRect(progressBarX, repairY + 10, progressBarWidth * (repairProgress / 100), 14, 4);
        }
        progressBarFill.setScrollFactor(0);
        progressBarFill.setDepth(12004);
        elements.push(progressBarFill);

        const progressText = this.add.text(progressBarX + progressBarWidth + 10, repairY + 17,
            `${Math.min(collectedParts.length, totalRequired)}/${totalRequired}`, {
            fontSize: '11px',
            fontFamily: 'Arial, sans-serif',
            color: repairProgress > 0 ? '#4CAF50' : '#AAAAAA'
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(12003);
        elements.push(progressText);

        // ESC to close
        const escHandler = (event) => {
            if (event.key === 'Escape') {
                closeStory();
            }
        };
        this.input.keyboard.on('keydown', escHandler);

        // Left/Right arrow navigation
        const arrowHandler = (event) => {
            if (event.key === 'ArrowRight' && currentPage < storyPages.length - 1) {
                currentPage++;
                updatePage(currentPage);
                if (window.AudioManager) window.AudioManager.playButtonClick();
            } else if (event.key === 'ArrowLeft' && currentPage > 0) {
                currentPage--;
                updatePage(currentPage);
                if (window.AudioManager) window.AudioManager.playButtonClick();
            }
        };
        this.input.keyboard.on('keydown', arrowHandler);

        if (window.AudioManager) {
            window.AudioManager.playVisionReveal();
        }
    }

    /**
     * Check if this is a new day and show creature greeting
     */
    checkDailyGreeting() {
        const gameState = getGameState();
        if (!gameState) return;

        // Check if daily bonus is available
        const dailyBonus = gameState.getDailyLoginBonus();
        const creatureName = gameState.get('creature.name') || 'Your creature';
        const creatureHatched = gameState.get('creature.hatched');

        // Only show greeting if creature is hatched
        if (!creatureHatched) return;

        // Check if we've shown the greeting this session
        if (this.dailyGreetingShown) return;
        this.dailyGreetingShown = true;

        console.log('[GameScene] Checking daily greeting. Bonus available:', dailyBonus.available);

        // Show the greeting overlay
        this.showDailyGreetingOverlay(creatureName, dailyBonus);
    }

    /**
     * Display the daily greeting overlay with optional callback
     * @param {string} creatureName - The creature's name
     * @param {Object} dailyBonus - Daily bonus info
     * @param {Function} onComplete - Optional callback when dismissed
     */
    showDailyGreetingWithCallback(creatureName, dailyBonus, onComplete = null) {
        this.showDailyGreetingOverlay(creatureName, dailyBonus, onComplete);
    }

    /**
     * Display the daily greeting overlay
     * @param {string} creatureName - The creature's name
     * @param {Object} dailyBonus - Daily bonus info
     * @param {Function} onComplete - Optional callback when dismissed
     */
    showDailyGreetingOverlay(
        creatureName,
        dailyBonus,
        onComplete = null,
        personalityCoreOverride = null
    ) {
        const { width, height } = this.scale;

        // Create overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(5000);

        // Greeting panel
        const panelWidth = Math.min(400, width - 40);
        const panelHeight = dailyBonus.available ? 330 : 240;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 0.95);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.lineStyle(3, 0x7B68EE);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.setScrollFactor(0);
        panel.setDepth(5001);

        const personalityCore = personalityCoreOverride || window.GameState?.get(
            'creature.genes.personality.core'
        ) || window.GameState?.get(
            'creature.genetics.personality.core'
        ) || 'curious';
        const checkIn = getSanctuaryCheckInCopy({
            name: creatureName,
            personalityCore
        });
        const greeting = `${checkIn.statusLine}\n${checkIn.line}`;

        // Title
        const title = this.add.text(width / 2, panelY + 25, checkIn.title, {
            fontSize: '20px',
            color: '#8FE3CF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(5002);

        // Greeting text
        const greetingText = this.add.text(width / 2, panelY + 70, greeting, {
            fontSize: '16px',
            color: '#FFFFFF',
            align: 'center',
            lineSpacing: 6,
            wordWrap: { width: panelWidth - 48 }
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(5002);

        const elements = [overlay, panel, title, greetingText];
        // Store elements so OnboardingManager can detect dismissal
        this.greetingElements = elements;

        // Helper to close and cleanup
        const closeGreeting = () => {
            elements.forEach(el => el.destroy());
            this.greetingElements = [];
            if (onComplete) onComplete();
        };

        // If daily bonus available, show it
        if (dailyBonus.available) {
            const bonusText = this.add.text(width / 2, panelY + 180,
                `SUPPLY CACHE // CYCLE ${dailyBonus.streak}\n+${dailyBonus.rewards.xp} XP  //  +${dailyBonus.rewards.stardust} STARDUST`,
                {
                    fontSize: '15px',
                    color: '#90EE90',
                    align: 'center',
                    lineSpacing: 4
                }
            ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(5002);
            elements.push(bonusText);

            // Claim button
            const claimBtn = this.add.text(width / 2, panelY + panelHeight - 45, 'LOG SUPPLIES', {
                fontSize: '16px',
                color: '#FFFFFF',
                backgroundColor: '#4CAF50',
                padding: { x: 20, y: 10 }
            }).setOrigin(0.5).setScrollFactor(0).setDepth(5002);
            claimBtn.setInteractive({ useHandCursor: true });
            elements.push(claimBtn);

            claimBtn.on('pointerdown', () => {
                const claimed = getGameState().claimDailyLoginBonus();
                if (claimed) {
                    // Play celebration
                    if (window.AudioManager) {
                        window.AudioManager.playLevelUp();
                    }

                    // Update stats display
                    this.updateStatsDisplay();

                    // Show floating text
                    this.showFloatingText(`+${dailyBonus.rewards.xp} XP!`, this.player.x, this.player.y - 60, '#90EE90');
                }
                closeGreeting();
            });

            claimBtn.on('pointerover', () => claimBtn.setStyle({ backgroundColor: '#45a049' }));
            claimBtn.on('pointerout', () => claimBtn.setStyle({ backgroundColor: '#4CAF50' }));
        } else {
            // Just show a close button
            const closeBtn = this.add.text(width / 2, panelY + panelHeight - 35, 'RETURN TO SANCTUARY', {
                fontSize: '15px',
                color: '#FFFFFF',
                backgroundColor: '#7B68EE',
                padding: { x: 25, y: 10 }
            }).setOrigin(0.5).setScrollFactor(0).setDepth(5002);
            closeBtn.setInteractive({ useHandCursor: true });
            elements.push(closeBtn);

            closeBtn.on('pointerdown', () => {
                closeGreeting();
            });

            closeBtn.on('pointerover', () => closeBtn.setStyle({ backgroundColor: '#6a5acd' }));
            closeBtn.on('pointerout', () => closeBtn.setStyle({ backgroundColor: '#7B68EE' }));
        }

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playPet();
        }

        // Creature bounce animation on player sprite
        if (this.player) {
            this.tweens.add({
                targets: this.player,
                scaleX: { from: 1, to: 1.15 },
                scaleY: { from: 1, to: 1.15 },
                duration: 300,
                yoyo: true,
                ease: 'Bounce.easeOut'
            });
        }
    }

    openInventory() {
        console.log('[GameScene] Opening Inventory');

        this.sceneRouter.pauseAndLaunchScene('InventoryScene', undefined, {
            loadingMessage: 'Opening Inventory...',
            sound: 'buttonClick'
        });
    }

    openShop() {
        console.log('[GameScene] Opening Shop via keyboard');

        this.sceneRouter.pauseAndLaunchScene('ShopScene', undefined, {
            loadingMessage: 'Opening Cosmic Shop...',
            sound: 'buttonClick'
        });
    }

    openFusionPod() {
        // Guard against multiple calls while fusion pod is loading/open
        if (this._fusionPodOpening || this.scene.isActive('FusionPodScene')) {
            console.log('[GameScene] Fusion pod already opening or open, ignoring');
            return;
        }

        // Check if fusion pod is unlocked (level 5+)
        const fusionStatus = getGameState().getBreedingShrineStatus?.();

        if (!fusionStatus?.unlocked) {
            const landmark = this.getFusionPodWorldSnapshot();
            this.showInteractionHint(landmark.statusLabel);
            window.AudioManager?.playError?.();
            return;
        }

        // Set guard flag
        this._fusionPodOpening = true;

        console.log('[GameScene] Opening Fusion Pod');

        this.sceneRouter.pauseAndLaunchScene('FusionPodScene', undefined, {
            loadingMessage: 'Opening Fusion Pod...',
            sound: 'buttonClick'
        });

        // Clear guard flag after a delay (FusionPodScene.create() will hide loading)
        this.time.delayedCall(1000, () => {
            this._fusionPodOpening = false;
        });
    }

    // Backward-compatible route for the original Breeding Shrine shortcut.
    openBreedingShrine() {
        return this.openFusionPod();
    }

    openHubWorld() {
        console.log('[GameScene] Opening Hub World');

        this.sceneRouter.startScene('HubWorldScene', undefined, {
            loadingMessage: 'Traveling to Hub World...',
            sound: 'buttonClick'
        });
    }

    /**
     * Spawn collectibles in the game world
     */
    spawnWorldCollectibles() {
        if (!window.CollectibleManager) {
            console.warn('[GameScene] CollectibleManager not available');
            return;
        }

        // Pre-generate all collectible sprite textures
        if (this.graphicsEngine) {
            this.graphicsEngine.createAllCollectibleSprites();
        }

        // Clear existing collectibles
        window.CollectibleManager.clearCollectibles();

        // Get current biome (from scene data or default)
        const biome = this.currentBiome || 'nebula';

        // Spawn collectibles based on world size
        const collectibleCount = 15; // Base number of collectibles

        this.collectibles = window.CollectibleManager.spawnCollectibles(
            this,
            biome,
            collectibleCount
        );

        console.log(`[GameScene] Spawned ${this.collectibles.length} collectibles in ${biome} biome`);
    }

    /**
     * Check proximity to collectibles for auto-collection
     */
    checkCollectibleProximity() {
        if (!window.CollectibleManager || !this.player) return;

        const creatureX = this.player.x;
        const creatureY = this.player.y;

        window.CollectibleManager.checkProximityCollection(
            this,
            creatureX,
            creatureY,
            60 // Collection radius
        );
    }

    checkLivingSignalProximity(delta = 16.67) {
        if (!this.player || !Array.isArray(this.livingSignals)) return;
        const signalSearchDistance = this.getInteractionDistance('signal', 150, 190).enter;
        const signalApproachDistance = this.getInteractionDistance('signalApproach', 82, 120).enter;
        const nearbySignals = this.livingSignals.filter(
            signal => signal?.active !== false
        );
        const nearest = nearbySignals.reduce((closest, signal) => {
            const distance = Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                signal.x,
                signal.y
            );
            if (!closest || distance < closest.distance) {
                return { signal, distance };
            }
            return closest;
        }, null);

        // Keep this legacy threshold text for contract compatibility:
        // nearest.distance > 150.
        if (!nearest || nearest.distance > signalSearchDistance || nearest.distance > 150) {
            this.setLivingSignalLabelFocus();
            this.resetActiveLivingSignalListening();
            return;
        }

        this.setLivingSignalLabelFocus(nearest.signal.signalId);

        if (nearest.signal.observed) {
            this.resetActiveLivingSignalListening();
            return;
        }

        if (!this.livingSignalApproachHintShown) {
            this.livingSignalApproachHintShown = true;
            this.showInteractionHint(
                'Not an Earth transmission. Move into the pulse with your companion.'
            );
        }

        if (nearest.distance > signalApproachDistance) {
            this.resetActiveLivingSignalListening();
            return;
        }

        if (this.activeLivingSignalId !== nearest.signal.signalId) {
            this.resetActiveLivingSignalListening();
            this.activeLivingSignalId = nearest.signal.signalId;
            this.livingSignalDwellMs = 0;
            this.showInteractionHint('Hold position. Your companion is listening.');
        }

        this.livingSignalDwellMs += Math.min(Number(delta) || 16.67, 100);
        this.setLivingSignalListeningProgress(
            nearest.signal,
            this.livingSignalDwellMs / 800
        );
        if (this.livingSignalDwellMs >= 800) {
            this.activeLivingSignalId = null;
            this.livingSignalDwellMs = 0;
            this.recordLivingSignalObservation(nearest.signal);
        }
    }

    recordLivingSignalObservation(signal) {
        if (!signal || signal.observed || !window.GameState) return false;

        const result = observeLivingSignal(
            window.GameState.get('world.livingSignals'),
            signal.signalId
        );
        if (!result.success) {
            this.refreshLivingSignalVisual(
                signal,
                result.progress,
                result.total
            );
            return false;
        }

        window.GameState.set('world.livingSignals', result.state);
        const ecologyResult = recordCurrentSignalObservation(
            window.GameState,
            signal.signalId,
            { save: false }
        );
        window.GameState.visitArea?.(`signal:${signal.signalId}`);
        this.refreshLivingSignalVisual(signal, result.progress, result.total);
        window.QuestManager?.trackProgress?.('observe_living_signal', {
            signalId: signal.signalId
        });
        this.recordBondActivity('signal');
        window.GameState.emit('livingSignalObserved', {
            signalId: signal.signalId,
            progress: result.progress,
            total: result.total,
            completed: result.completed,
            timestamp: result.state.lastObservedAt
        });
        window.AchievementSystem?.recordEvent?.('story_interaction', {
            event: 'living_signal_observed',
            signalId: signal.signalId
        });

        window.GameState.save?.();
        this.showLivingSignalMoment({
            ...result,
            ecology: ecologyResult?.summary || null
        });
        this.showCreatureResponse(result.signal.companionLine);
        this.showFloatingText(
            `SIGNAL ${result.progress}/${result.total} +4 Bond`,
            signal.x,
            signal.y - 55,
            '#8FE3CF'
        );
        window.AudioManager?.playAchievementMinor?.();
        window.FXLibrary?.stardustBurst?.(this, signal.x, signal.y, {
            count: 14,
            color: [result.signal.color, result.signal.accent, 0xFFFFFF],
            duration: 1500
        });

        return true;
    }

    showLivingSignalMoment(result, { preview = false } = {}) {
        if (!result?.signal) return;
        this.clearLivingSignalMoment();

        const { width, height } = this.scale;
        const isMobile = width < 600 || this.livingSignalPreviewSize === 'mobile';
        const mobileViewportWidth = this.livingSignalPreviewSize === 'mobile'
            ? 390
            : width;
        const panelWidth = Math.min(
            isMobile ? mobileViewportWidth - 24 : 520,
            width - 24
        );
        const panelHeight = isMobile ? 232 : 188;
        const panelX = (width - panelWidth) / 2;
        const mobileYLimit = Math.max(12, height - panelHeight - 150);
        const panelY = isMobile
            ? Math.min(Math.max(230, height * 0.52), mobileYLimit)
            : height - panelHeight - 24;
        const depth = 15100;

        const panel = this.add.graphics();
        panel.fillStyle(0x07151A, 0.97);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
        panel.lineStyle(2, result.signal.color, 0.95);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
        panel.setScrollFactor(0).setDepth(depth);

        const currentStatus = result.ecology?.awarenessLabel || (
            result.completed ? 'NETWORK CONFIRMED' : 'LINK ESTABLISHED'
        );
        const eyebrow = this.add.text(
            panelX + 16,
            panelY + 13,
            `CURRENT NETWORK // ${currentStatus} // ${result.progress}/${result.total}`,
            {
                fontSize: isMobile ? '10px' : '11px',
                fontFamily: 'Arial, sans-serif',
                color: '#8FE3CF',
                fontStyle: 'bold'
            }
        ).setScrollFactor(0).setDepth(depth + 1);
        const title = this.add.text(panelX + 16, panelY + 36, result.signal.name, {
            fontSize: isMobile ? '18px' : '20px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setScrollFactor(0).setDepth(depth + 1);
        const response = this.add.text(panelX + 16, panelY + 67, result.signal.response, {
            fontSize: isMobile ? '12px' : '13px',
            fontFamily: 'Arial, sans-serif',
            color: '#D6EEF2',
            lineSpacing: 3,
            wordWrap: { width: panelWidth - 32 }
        }).setScrollFactor(0).setDepth(depth + 1);
        const companion = this.add.text(
            panelX + 16,
            panelY + (isMobile ? 112 : 98),
            `COMPANION // ${result.signal.companionLine}`,
            {
                fontSize: isMobile ? '10px' : '11px',
                fontFamily: 'Arial, sans-serif',
                color: '#BFA6FF',
                fontStyle: 'bold',
                wordWrap: { width: panelWidth - 32 }
            }
        ).setScrollFactor(0).setDepth(depth + 1);
        const fieldNote = this.add.text(
            panelX + 16,
            panelY + (isMobile ? 154 : 132),
            `FIELD NOTE // ${result.signal.fieldNote}`,
            {
                fontSize: isMobile ? '10px' : '11px',
                fontFamily: 'Arial, sans-serif',
                color: '#F2C14E',
                fontStyle: 'bold',
                wordWrap: { width: panelWidth - 32 }
            }
        ).setScrollFactor(0).setDepth(depth + 1);
        const nextInstruction = result.completed
            ? 'NEXT // Follow your companion toward the World Gate.'
            : `NEXT // Follow the marked pulse. Listen ${result.progress}/${result.total}.`;
        const next = this.add.text(
            panelX + 16,
            panelY + panelHeight - 14,
            nextInstruction,
            {
                fontSize: isMobile ? '11px' : '12px',
                fontFamily: 'Arial, sans-serif',
                color: '#8FE3CF',
                fontStyle: 'bold',
                wordWrap: { width: panelWidth - 32 }
            }
        ).setOrigin(0, 1).setScrollFactor(0).setDepth(depth + 1);
        const close = this.add.text(panelX + panelWidth - 16, panelY + 17, '×', {
            fontSize: '22px',
            color: '#A8C2C7'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2)
            .setInteractive({ useHandCursor: true });
        close.on('pointerdown', () => this.clearLivingSignalMoment());

        this.livingSignalMomentElements = [
            panel,
            eyebrow,
            title,
            response,
            companion,
            fieldNote,
            next,
            close
        ];

        if (!preview) {
            const duration = result.completed ? 3600 : 5200;
            this.livingSignalMomentTimer = this.time.delayedCall(
                duration,
                () => this.clearLivingSignalMoment()
            );
        }
    }

    clearLivingSignalMoment() {
        this.livingSignalMomentTimer?.remove?.();
        this.livingSignalMomentTimer = null;
        this.livingSignalMomentElements.forEach(element => {
            element?.removeAllListeners?.();
            element?.destroy?.();
        });
        this.livingSignalMomentElements = [];
    }

    /**
     * Track enemy defeat for quests
     */
    onEnemyDefeated(enemyData = {}) {
        if (!window.QuestManager) return;

        // Track for quest progress
        window.QuestManager.trackProgress('defeat_enemies', {
            count: 1,
            biome: this.currentBiome || 'nebula'
        });

        // Also grant some XP for quests
        window.QuestManager.trackProgress('gain_xp', { amount: 10 });
    }

    openChat() {
        // Don't open chat if already open
        if (this.chatOverlay?.getIsVisible()) {
            return;
        }

        console.log('[GameScene] Opening Chat');

        // Create chat overlay if not exists
        if (!this.chatOverlay) {
            this.chatOverlay = new ChatOverlay(this);
        }

        // Show the chat overlay
        this.chatOverlay.show();
    }

    /**
     * Show radial menu when creature is tapped
     */
    showCreatureRadialMenu() {
        if (!this.player || !this.creatureRadialMenu) return;

        // Don't show if already visible or if chat is open
        if (this.creatureRadialMenu.isVisible || this.chatOverlay?.getIsVisible()) {
            return;
        }

        // Hide floating chat bubble while radial menu is open
        this.floatingChatBubble?.hide();

        // Show radial menu at creature position
        this.creatureRadialMenu.show(this.player.x, this.player.y);

        if (window.AudioManager) {
            window.AudioManager.playButtonClick?.();
        }

        console.log('[GameScene] Showing creature radial menu');
    }

    /**
     * Handle radial menu item selection
     * @param {string} itemId - The selected menu item ID
     */
    handleRadialMenuSelect(itemId) {
        console.log('[GameScene] Radial menu selected:', itemId);

        // Show floating chat bubble again
        this.floatingChatBubble?.show();

        switch (itemId) {
            case 'profile':
                this.openCreatureProfile();
                break;
            case 'chat':
                this.openChat();
                break;
            case 'pet':
                this.petCreature();
                break;
            case 'care':
                this.toggleCarePanel();
                break;
            case 'abilities':
                this.openAbilitiesOverlay();
                break;
            case 'ai_art':
                this.openAIArt();
                break;
            default:
                console.warn('[GameScene] Unknown radial menu item:', itemId);
        }
    }

    /**
     * Present a late-arriving living portrait without stopping Sanctuary play.
     * The hatch and naming scenes get first claim; this is the guaranteed
     * background-generation handoff for players who continue quickly.
     */
    async maybeShowLivingPortraitReadyNotice(record = null, {
        attempt = 0,
        preview = false
    } = {}) {
        if (this._isShuttingDown || !this.sys?.isActive?.()) return false;
        const mediaService = window.CompanionMediaService || companionMediaService;
        let portrait = record;
        if (!portrait?.imageUrl && !preview) {
            portrait = await mediaService?.resolvePortrait?.(
                window.GameState?.get?.('creature.lifecycle.stage') || 'baby'
            ).catch?.(() => null);
        }
        if (!portrait?.identityKey || !portrait?.imageUrl) return false;
        if (
            !preview &&
            mediaService?.hasAppearance?.('first_living_form', portrait.identityKey)
        ) {
            return false;
        }
        if (
            this.livingPortraitReadyNotice?.identityKey === portrait.identityKey ||
            this.livingPortraitNoticePendingIdentity === portrait.identityKey
        ) {
            return false;
        }
        if (this.isLivingPortraitNoticeBlocked()) {
            if (attempt < 20) {
                this.livingPortraitNoticeTimer?.remove?.();
                this.livingPortraitNoticeTimer = this.time.delayedCall(
                    1500,
                    () => void this.maybeShowLivingPortraitReadyNotice(
                        portrait,
                        { attempt: attempt + 1, preview }
                    )
                );
            }
            return false;
        }

        this.livingPortraitNoticePendingIdentity = portrait.identityKey;
        try {
            const textureKey = await mediaService?.ensureTexture?.(this, portrait);
            if (
                !textureKey ||
                this._isShuttingDown ||
                !this.sys?.isActive?.()
            ) {
                return false;
            }
            if (this.isLivingPortraitNoticeBlocked()) {
                this.livingPortraitNoticePendingIdentity = null;
                this.livingPortraitNoticeTimer?.remove?.();
                this.livingPortraitNoticeTimer = this.time.delayedCall(
                    1500,
                    () => void this.maybeShowLivingPortraitReadyNotice(
                        portrait,
                        { attempt: attempt + 1, preview }
                    )
                );
                return false;
            }
            this.showLivingPortraitReadyNotice(portrait, textureKey, { preview });
            return true;
        } finally {
            this.livingPortraitNoticePendingIdentity = null;
        }
    }

    async recoverLivingPortraitAfterArrival() {
        if (this._isShuttingDown || !this.sys?.isActive?.()) return null;
        const portraitService = window.LivingPortraitService;
        if (!portraitService?.getEligibility?.().eligible) return null;

        const stage = window.GameState?.get?.('creature.lifecycle.stage') || 'baby';
        const existing = window.GameState?.getCreaturePortrait?.(stage);
        if (existing?.assetRef) {
            const resolved = await portraitService.resolve(existing)
                .catch(() => null);
            if (resolved?.imageUrl) {
                await this.maybeShowLivingPortraitReadyNotice(resolved);
            }
            return resolved;
        }

        const genes = window.GameState?.get?.('creature.genes');
        const dna = window.GameState?.get?.('creature.dna');
        if (!genes || !dna) return null;
        const creatureData = {
            name: window.GameState?.get?.('creature.name') || 'Companion',
            stage,
            genes,
            dna,
            personality: window.GameState?.get?.('creature.personality')
        };
        const job = portraitService.prewarm?.({
            creatureData,
            sprite: this.player,
            source: 'sanctuary_recovery'
        });
        if (!job?.then) return null;
        const record = await job.catch(() => null);
        if (record?.imageUrl) {
            await this.maybeShowLivingPortraitReadyNotice(record);
        }
        return record;
    }

    isLivingPortraitNoticeBlocked() {
        return Boolean(
            this.guardianExchangeOpen ||
            this.guardianCareActivityOpen ||
            this.residentExchangeOpen ||
            this.fendListeningOpen ||
            this.controlsTutorial?.isVisible ||
            this.storyModalElements?.length ||
            this.greetingElements?.length ||
            this.livingSignalMomentElements?.length ||
            this.isFieldKitModalOpen ||
            this.fusionDiscoveryModalOpen ||
            this.hamburgerMenu?.isOpen ||
            this.carePanelManager?.panelVisible ||
            this.creatureRadialMenu?.isVisible
        );
    }

    showLivingPortraitReadyNotice(record, textureKey, { preview = false } = {}) {
        this.destroyLivingPortraitReadyNotice();
        if (!preview && this.showLivingPortraitReveal(record)) {
            return;
        }
        const { width, height } = this.scale;
        const compact = width < 620;
        const panelWidth = Math.min(compact ? width - 24 : 430, 430);
        const panelHeight = compact ? 104 : 112;
        const noticeY = Math.max(160, Math.min(height * 0.24, 200));
        const depth = 15900;
        const container = this.add.container(width / 2, noticeY)
            .setScrollFactor(0)
            .setDepth(depth)
            .setAlpha(0);
        const panel = this.add.graphics();
        panel.fillStyle(0x081312, 0.97);
        panel.fillRoundedRect(
            -panelWidth / 2,
            -panelHeight / 2,
            panelWidth,
            panelHeight,
            7
        );
        panel.lineStyle(2, 0x8FE3CF, 1);
        panel.strokeRoundedRect(
            -panelWidth / 2,
            -panelHeight / 2,
            panelWidth,
            panelHeight,
            7
        );
        panel.setInteractive(
            new Phaser.Geom.Rectangle(
                -panelWidth / 2,
                -panelHeight / 2,
                panelWidth,
                panelHeight
            ),
            Phaser.Geom.Rectangle.Contains
        );
        const portrait = this.add.image(
            (-panelWidth / 2) + 54,
            0,
            textureKey
        );
        const portraitScale = Math.min(
            76 / Math.max(1, portrait.width),
            76 / Math.max(1, portrait.height)
        );
        portrait.setScale(portraitScale);
        const copyX = (-panelWidth / 2) + 105;
        const copyWidth = panelWidth - 124;
        const title = this.add.text(copyX, -30, 'LIVING FORM READY', {
            fontFamily: 'Arial, sans-serif',
            fontSize: compact ? '14px' : '16px',
            fontStyle: 'bold',
            color: '#F2C14E'
        });
        const companionName = window.GameState?.get?.('creature.name') || 'Your companion';
        const copy = this.add.text(
            copyX,
            -5,
            `${companionName}'s protected field portrait has arrived.`,
            {
                fontFamily: 'Arial, sans-serif',
                fontSize: compact ? '12px' : '13px',
                color: '#F4F4F4',
                wordWrap: { width: copyWidth }
            }
        );
        const action = this.add.text(copyX, 31, 'TAP TO VIEW COMPANION PROFILE', {
            fontFamily: 'Arial, sans-serif',
            fontSize: compact ? '9px' : '10px',
            fontStyle: 'bold',
            color: '#8FE3CF'
        });
        container.add([panel, portrait, title, copy, action]);

        let dismissed = false;
        let timer = null;
        const dismiss = ({ openProfile = false } = {}) => {
            if (dismissed) return;
            dismissed = true;
            timer?.remove?.();
            this.tweens.killTweensOf(container);
            container.destroy?.(true);
            if (this.livingPortraitReadyNotice?.container === container) {
                this.livingPortraitReadyNotice = null;
            }
            if (openProfile && this.sceneRouter) this.openCreatureProfile();
        };
        panel.on('pointerup', () => dismiss({ openProfile: true }));
        this.tweens.add({
            targets: container,
            alpha: 1,
            y: noticeY + 8,
            duration: 320,
            ease: 'Sine.easeOut'
        });
        timer = this.time.delayedCall(9000, () => {
            this.tweens.add({
                targets: container,
                alpha: 0,
                y: container.y - 8,
                duration: 300,
                onComplete: () => dismiss()
            });
        });
        this.livingPortraitReadyNotice = {
            identityKey: record.identityKey,
            container,
            destroy: dismiss
        };
        if (!preview) {
            (window.CompanionMediaService || companionMediaService)
                ?.recordAppearance?.('first_living_form', record);
        }
        window.AudioManager?.playAchievement?.();
    }

    showLivingPortraitReveal(record) {
        if (!record?.imageUrl || !this.game?.domContainer) return false;
        const domContainer = this.game.domContainer;
        const previousStyles = {
            zIndex: domContainer.style.zIndex,
            pointerEvents: domContainer.style.pointerEvents
        };
        domContainer.style.zIndex = '110';
        domContainer.style.pointerEvents = 'auto';

        const reveal = new LivingFormHandoff(this);
        const restore = () => {
            domContainer.style.zIndex = previousStyles.zIndex;
            domContainer.style.pointerEvents = previousStyles.pointerEvents;
            if (this.livingPortraitReadyNotice?.reveal === reveal) {
                this.livingPortraitReadyNotice = null;
            }
        };
        const shown = reveal.show({
            name: window.GameState?.get?.('creature.name') || 'Companion',
            species: window.GameState?.get?.('creature.genes.species'),
            stage: record.stage || window.GameState?.get?.(
                'creature.lifecycle.stage'
            ) || 'baby',
            affinity: window.GameState?.get?.(
                'creature.genes.cosmicAffinity.element'
            ) || 'star',
            portraitPromise: Promise.resolve(record),
            mode: 'late_reveal',
            onContinue: restore
        });
        if (!shown) {
            restore();
            return false;
        }

        this.livingPortraitReadyNotice = {
            identityKey: record.identityKey,
            reveal,
            destroy: () => {
                reveal.destroy?.();
                restore();
            }
        };
        window.AudioManager?.playAchievement?.();
        return true;
    }

    destroyLivingPortraitReadyNotice() {
        this.livingPortraitNoticeTimer?.remove?.();
        this.livingPortraitNoticeTimer = null;
        this.livingPortraitReadyNotice?.destroy?.();
        this.livingPortraitReadyNotice = null;
        this.livingPortraitNoticePendingIdentity = null;
    }

    /**
     * Open creature profile scene
     */
    openCreatureProfile() {
        console.log('[GameScene] Opening creature profile');
        this.sceneRouter.pauseAndLaunchScene('CreatureProfileScene', undefined, {
            loadingMessage: 'Opening companion profile...',
            sound: 'buttonClick'
        });
    }

    /**
     * Open AI Art generator modal
     */
    openAIArt() {
        const ageGroup = localStorage.getItem('mythical_void_age_group');
        if (!window.CloudSaveManager?.isAgeGroupEligible?.(ageGroup)) {
            this.showFloatingText(
                'Living Portraits require the 16+ privacy setting',
                this.player?.x || this.scale.width / 2,
                (this.player?.y || this.scale.height / 2) - 70,
                '#FFCC66'
            );
            return;
        }
        if (!window.APIConfig?.isEnabled?.()) {
            console.warn('[GameScene] AI Art is unavailable in this build');
            if (this.player) {
                this.showFloatingText(
                    'AI Art is unavailable in this build',
                    this.player.x,
                    this.player.y - 70,
                    '#FFCC66'
                );
            }
            return;
        }

        console.log('[GameScene] Opening AI Art generator');

        // Create modal if needed
        if (!this.aiArtModal) {
            this.aiArtModal = new AIArtModal(this);
        }

        // Get creature data
        const creatureData = {
            name: window.GameState?.get('creature.name') || 'Mythical Creature',
            stage: window.GameState?.get('creature.lifecycle.stage') || 'baby',
            genes: window.GameState?.get('creature.genes')
        };

        // Show the modal with creature data and sprite
        this.aiArtModal.show(creatureData, this.player);
    }

    /**
     * Quick pet action from radial menu
     */
    petCreature() {
        console.log('[GameScene] Petting creature');

        // Get creature genetics for personality bonus
        const genetics = window.GameState?.get('creature.genes');

        // Perform pet care action
        if (this.careSystem && typeof this.careSystem.performCareAction === 'function') {
            this.careSystem.performCareAction('pet', genetics).then(result => {
                if (result && result.success) {
                    // Show floating feedback
                    this.showCareEffect(result.message || '💜 +5 Happiness', 0xE040FB);

                    // Record for bond progression
                    this.recordBondActivity('pet');

                    // Record for achievements
                    if (window.AchievementSystem?.recordEvent) {
                        window.AchievementSystem.recordEvent('care_action', { type: 'pet' });
                    }

                    // Show heart particles
                    if (window.FXLibrary) {
                        window.FXLibrary.emotionHappy?.(this, this.player.x, this.player.y);
                    }
                }
            }).catch(err => {
                console.warn('[GameScene] Pet action failed:', err);
                // Fallback simple feedback
                this.showCareEffect('💜 Petted!', 0xE040FB);
            });
        } else {
            // Fallback if CareSystem not available
            this.showCareEffect('💜 Petted!', 0xE040FB);
        }

        // Play pet sound
        if (window.AudioManager) {
            window.AudioManager.playPet?.();
        }
    }

    /**
     * Open abilities overlay/selector
     */
    openAbilitiesOverlay() {
        console.log('[GameScene] Opening abilities overlay');

        // Check if creature has any abilities
        const abilities = window.GameState?.get('creature.secretAbilities') || [];

        if (abilities.length === 0) {
            // Show message if no abilities
            this.showInteractionHint('✨ No abilities unlocked yet. Bond with your creature!');
            return;
        }

        // Launch ability selection scene (to be created)
        this.sceneRouter.launchScene('AbilitySelectionScene', undefined, {
            bringToTop: true
        });
    }

    /**
     * Record bond activity for relationship progression
     * @param {string} activityType - Type of activity (pet, chat, care, level_complete)
     */
    recordBondActivity(activityType) {
        if (!window.GameState) return;

        // Get current bond data
        const bondData = window.GameState.get('creature.bond') || {
            level: 1,
            experience: 0,
            totalInteractions: 0,
            careActions: 0,
            conversations: 0,
            levelsCompleted: 0
        };

        // Award bond XP based on activity
        const bondXPRewards = {
            pet: 2,
            feed: 3,
            play: 3,
            rest: 1,
            clean: 2,
            photo: 2,
            garden: 5,
            signal: 4,
            community: 8,
            chat: 4,
            level_complete: 10
        };

        const xpGain = bondXPRewards[activityType] || 1;
        bondData.experience += xpGain;
        bondData.totalInteractions++;

        // Track specific activities
        if (['pet', 'feed', 'play', 'rest', 'clean', 'photo', 'garden'].includes(activityType)) {
            bondData.careActions++;
        } else if (activityType === 'chat') {
            bondData.conversations++;
        } else if (activityType === 'level_complete') {
            bondData.levelsCompleted++;
        }

        // Ensure abilitySlots exists
        if (!bondData.abilitySlots) {
            bondData.abilitySlots = { slot1: true, slot2: false, slot3: false };
        }
        if (!bondData.equippedAbilities) {
            bondData.equippedAbilities = { slot1: null, slot2: null, slot3: null };
        }

        // Track timestamps
        if (!bondData.firstInteraction) {
            bondData.firstInteraction = Date.now();
        }
        bondData.lastInteraction = Date.now();

        // Check for level up (every 50 XP)
        const xpPerLevel = 50;
        const newLevel = Math.floor(bondData.experience / xpPerLevel) + 1;

        if (newLevel > bondData.level) {
            bondData.level = newLevel;
            console.log('[GameScene] Bond level up!', bondData.level);

            // Show celebration
            this.showCareEffect(`💜 Bond Level ${bondData.level}!`, 0xFFD700);

            if (window.AudioManager) {
                window.AudioManager.playLevelUp?.();
            }

            // FX celebration
            if (window.FXLibrary) {
                window.FXLibrary.stardustBurst?.(this, this.player.x, this.player.y, {
                    count: 15,
                    color: [0xE040FB, 0xFFD700],
                    duration: 1500
                });
            }

            // Check for ability slot unlocks
            if (bondData.level >= 5 && !bondData.abilitySlots.slot2) {
                bondData.abilitySlots.slot2 = true;
                this.showInteractionHint('✨ Ability Slot 2 Unlocked!');
                window.GameState.emit('abilitySlotUnlocked', { slot: 2, level: bondData.level });
            }
            if (bondData.level >= 10 && !bondData.abilitySlots.slot3) {
                bondData.abilitySlots.slot3 = true;
                this.showInteractionHint('✨ Ability Slot 3 Unlocked!');
                window.GameState.emit('abilitySlotUnlocked', { slot: 3, level: bondData.level });
            }
        }

        // Save updated bond data
        window.GameState.set('creature.bond', bondData);

        // Emit bond progress event for UI updates
        window.GameState.emit('bondProgress', {
            level: bondData.level,
            experience: bondData.experience,
            activity: activityType
        });
    }

    showInteractionHint(
        message,
        { persistent = false, ownerId = null, force = false } = {}
    ) {
        if (!this.interactionText?.active) return;
        const isProximityPrompt = persistent || /^\s*Press SPACE\b/i.test(message);
        if (
            !force &&
            isProximityPrompt &&
            this.sanctuaryPromptOwnerId &&
            ownerId !== this.sanctuaryPromptOwnerId
        ) {
            return;
        }
        const touchControlsActive = Boolean(
            this.hasVisibleTouchControls() ||
            this.mobileHUD?.isVisible ||
            window.responsiveManager?.isMobile
        );
        const displayMessage = touchControlsActive
            ? message
                .replace(/^\s*Press SPACE\s*·\s*/i, 'Tap ✋ · ')
                .replace(/^\s*Press SPACE\s+to\s+/i, 'Tap ✋ to ')
                .replace(/^\s*Press SPACE\s+/i, 'Tap ✋ ')
            : message;

        this.interactionHintTimer?.remove?.(false);
        this.interactionHintTimer = null;
        this.interactionText.setText(displayMessage);
        this.interactionText.setVisible(true);

        // Proximity prompts remain available until the player leaves the zone.
        if (isProximityPrompt) return;

        this.interactionHintTimer = this.time.delayedCall(3000, () => {
            this.interactionHintTimer = null;
            this.interactionText?.setVisible(false);
        });
    }

    hideInteractionHint() {
        this.interactionHintTimer?.remove?.(false);
        this.interactionHintTimer = null;
        this.interactionText?.setVisible(false);
    }


    showCareEffect(message, color) {
        // Create floating message
        const effectText = this.add.text(this.player.x, this.player.y - 50, message, {
            fontSize: '14px',
            color: `#${color.toString(16).padStart(6, '0')}`,
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Animate the message
        this.tweens.add({
            targets: effectText,
            y: effectText.y - 30,
            alpha: { from: 1, to: 0 },
            duration: 2000,
            ease: 'Power2',
            onComplete: () => {
                effectText.destroy();
            }
        });

        // Creature happiness animation
        this.tweens.add({
            targets: this.player,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 200,
            ease: 'Back.easeOut',
            yoyo: true
        });
    }

    handleSpaceInteraction() {
        console.log('[GameScene] SPACE pressed - nearShop:', this.nearShop, 'nearHubPortal:', this.nearHubPortal, 'nearCampfire:', this.nearCampfire, 'nearFendResidentId:', this.nearFendResidentId, 'nearCurrentVeilAnchorId:', this.nearCurrentVeilAnchorId, 'nearSignalGarden:', this.nearSignalGarden, 'nearVillageHeart:', this.nearVillageHeart, 'nearFusionPod:', this.nearFusionPod, 'nearCrashedShip:', this.nearCrashedShip, 'nearReturnPortal:', this.nearReturnPortal, 'nearbyFlower:', !!this.nearbyFlower);

        if (
            this.isFieldKitModalOpen ||
            this.residentExchangeOpen ||
            this.guardianExchangeOpen ||
            this.rescuedResidentExchangeOpen ||
            this.guardianCareActivityOpen ||
            this.fendListeningOpen ||
            this.senseiMemoryModal?.isVisible ||
            this.shipEvidenceBoardModal?.isVisible ||
            this.companionConsentModal?.isVisible ||
            this.companionEarthMemoryModal?.isVisible ||
            this.currentVeilModal?.isVisible ||
            this.villageCommandPanel?.domElement
        ) {
            return;
        }

        if (
            this.currentBiome === 'nebula' &&
            this.sanctuaryInteractionDirector?.activate()
        ) {
            return;
        }

        // Distance-based fallback for portals (in case overlap detection missed)
        // Note: Void portal uses automatic pull-in, not spacebar - so no check needed here
        const { enter: HUB_PORTAL_INTERACT_DISTANCE } = this.getInteractionDistance('hubPortal', 170, 210);
        const { enter: RETURN_PORTAL_INTERACT_DISTANCE } = this.getInteractionDistance('returnPortal', 170, 210);

        if (!this.nearHubPortal && this.hubPortal && this.player) {
            const distToHub = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                this.hubPortal.x, this.hubPortal.y
            );
            if (distToHub <= HUB_PORTAL_INTERACT_DISTANCE) {
                console.log('[GameScene] Distance fallback: Player within range of hub portal');
                this.nearHubPortal = true;
            }
        }

        if (!this.nearReturnPortal && this.returnPortal && this.player) {
            const distToReturn = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                this.returnPortal.x, this.returnPortal.y
            );
            if (distToReturn <= RETURN_PORTAL_INTERACT_DISTANCE) {
                console.log('[GameScene] Distance fallback: Player within range of return portal');
                this.nearReturnPortal = true;
            }
        }

        // Distance-based fallback for campfire (CRITICAL for mobile touch input)
        const { enter: CAMPFIRE_INTERACT_DISTANCE } = this.getInteractionDistance('campfire');
        if (!this.nearCampfire && this.campfire && this.player) {
            const distToCampfire = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                this.campfire.x, this.campfire.y
            );
            if (distToCampfire <= CAMPFIRE_INTERACT_DISTANCE) {
                console.log('[GameScene] Distance fallback: Player within range of campfire, distance:', distToCampfire);
                this.nearCampfire = true;
            }
        }

        const { enter: GARDEN_INTERACT_DISTANCE } = this.getInteractionDistance('signalGarden');
        if (!this.nearSignalGarden && this.signalGarden?.zone && this.player) {
            const distToGarden = Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                this.signalGarden.zone.x,
                this.signalGarden.zone.y
            );
            if (distToGarden <= GARDEN_INTERACT_DISTANCE) {
                console.log('[GameScene] Distance fallback: Player within range of Signal Garden');
                this.nearSignalGarden = true;
            }
        }

        const { enter: VILLAGE_HEART_INTERACT_DISTANCE } = this.getInteractionDistance('villageHeart');
        if (
            !this.nearVillageHeart &&
            this.villageHeartLandmark?.zone &&
            this.player
        ) {
            const distance = Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                this.villageHeartLandmark.zone.x,
                this.villageHeartLandmark.zone.y
            );
            if (distance <= VILLAGE_HEART_INTERACT_DISTANCE) {
                this.nearVillageHeart = true;
            }
        }

        const { enter: FUSION_POD_INTERACT_DISTANCE } = this.getInteractionDistance('fusionPod');
        if (
            !this.nearFusionPod &&
            this.fusionPodLandmark?.zone &&
            this.player
        ) {
            const distToFusionPod = Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                this.fusionPodLandmark.zone.x,
                this.fusionPodLandmark.zone.y
            );
            if (distToFusionPod <= FUSION_POD_INTERACT_DISTANCE) {
                console.log(
                    '[GameScene] Distance fallback: Player within range of Fusion Pod'
                );
                this.nearFusionPod = true;
            }
        }

        if (
            !this.nearGuardianResidentId &&
            this.signalGarden?.guardianResidents &&
            this.player
        ) {
            const nearestGuardian = this.signalGarden.guardianResidents
                .map(resident => ({
                    resident,
                    distance: Phaser.Math.Distance.Between(
                        this.player.x,
                        this.player.y,
                        resident.zone.x,
                        resident.zone.y
                    )
                }))
                .sort((left, right) => left.distance - right.distance)[0];
            if (nearestGuardian?.distance <= this.getInteractionDistance('guardianResident').enter) {
                this.nearGuardianResidentId = nearestGuardian.resident.id;
            }
        }

        if (
            !this.nearRescuedResidentId &&
            this.signalGarden?.rescuedResidents &&
            this.player
        ) {
            const nearestRescuedResident = this.signalGarden.rescuedResidents
                .map(resident => ({
                    resident,
                    distance: Phaser.Math.Distance.Between(
                        this.player.x,
                        this.player.y,
                        resident.zone.x,
                        resident.zone.y
                    )
                }))
                .sort((left, right) => left.distance - right.distance)[0];
            if (nearestRescuedResident?.distance <= this.getInteractionDistance('rescuedResident').enter) {
                this.nearRescuedResidentId =
                    nearestRescuedResident.resident.id;
            }
        }

        if (!this.nearFendResidentId && this.signalGarden?.residents && this.player) {
            const nearestResident = this.signalGarden.residents
                .map(resident => ({
                    resident,
                    distance: Phaser.Math.Distance.Between(
                        this.player.x,
                        this.player.y,
                        resident.zone.x,
                        resident.zone.y
                    )
                }))
                .sort((left, right) => left.distance - right.distance)[0];
            if (nearestResident?.distance <= this.getInteractionDistance('fendResident').enter) {
                this.nearFendResidentId = nearestResident.resident.id;
            }
        }

        if (
            !this.nearCurrentVeilAnchorId &&
            this.signalGarden?.currentVeilAnchors &&
            this.player
        ) {
            const snapshot = getCurrentVeilSnapshot(window.GameState);
            if (snapshot.active) {
                const nearestAnchor = this.signalGarden
                    .currentVeilAnchors
                    .filter(anchor => !anchor.stabilized)
                    .map(anchor => ({
                        anchor,
                        distance: Phaser.Math.Distance.Between(
                            this.player.x,
                            this.player.y,
                            anchor.zone.x,
                            anchor.zone.y
                        )
                    }))
                    .sort(
                        (left, right) =>
                            left.distance - right.distance
                    )[0];
                if (nearestAnchor?.distance <= this.getInteractionDistance('currentVeilAnchor').enter) {
                    this.nearCurrentVeilAnchorId =
                        nearestAnchor.anchor.id;
                }
            }
        }

        if (this.shouldTreatInteractionAsAvailable('shop', this.shop, 'nearShop')) {
            console.log('[GameScene] Entering shop from SPACE handler');
            this.enterShop();
            this.nearShop = false;
            return;
        }

        // Note: Void portal entry is now automatic (pull-in mechanic) - no spacebar interaction

        // Check for hub portal entry (travel to other worlds)
        if (this.shouldTreatInteractionAsAvailable('hubPortal', this.hubPortal, 'nearHubPortal')) {
            console.log('[GameScene] Entering hub world from SPACE handler');
            this.enterHubWorld();
            this.nearHubPortal = false;
            return;
        }

        // Check for campfire rest interaction
        if (this.shouldTreatInteractionAsAvailable('campfire', this.campfire, 'nearCampfire')) {
            console.log('[GameScene] Starting campfire rest from SPACE handler');
            this.startCampfireRest();
            return;
        }

        if (this.nearRescuedResidentId) {
            console.log('[GameScene] Checking in with rescued resident');
            this.interactWithRescuedResident();
            return;
        }

        if (this.nearGuardianResidentId) {
            console.log('[GameScene] Speaking with restored guardian from SPACE handler');
            this.interactWithGuardianResident();
            return;
        }

        if (this.nearFendResidentId) {
            console.log('[GameScene] Speaking with Fend resident from SPACE handler');
            this.interactWithFendResident();
            return;
        }

        if (this.nearCurrentVeilAnchorId) {
            console.log('[GameScene] Stabilizing Quiet Current anchor from SPACE handler');
            this.interactWithCurrentVeilAnchor();
            return;
        }

        if (this.nearVillageHeart) {
            console.log('[GameScene] Opening Village Heart from SPACE handler');
            this.openVillageCommand();
            return;
        }

        if (this.nearSignalGarden) {
            console.log('[GameScene] Tending Signal Garden from SPACE handler');
            this.tendSignalGarden();
            return;
        }

        if (this.nearFusionPod) {
            console.log('[GameScene] Inspecting Fusion Pod from SPACE handler');
            this.openFusionPod();
            return;
        }

        // Check for crashed ship interaction
        if (this.nearCrashedShip) {
            this.interactWithCrashedShip();
            return;
        }

        // Check for return portal interaction
        if (this.shouldTreatInteractionAsAvailable('returnPortal', this.returnPortal, 'nearReturnPortal')) {
            console.log('[GameScene] Returning to Sanctuary from SPACE handler');
            this.returnToSanctuary();
            this.nearReturnPortal = false;
            return;
        }

        if (this.nearbyFlower) {
            this.smellNearbyFlower();
        }
    }

    smellNearbyFlower() {
        if (!this.nearbyFlower) return false;
        const flower = this.nearbyFlower;
        if (window.NatureAttunementSystem) {
            const result = window.NatureAttunementSystem.recordInteraction(
                'flower',
                this,
                flower.x,
                flower.y
            );

            if (result.success) {
                getGameState().updateWorldExploration(
                    { x: this.player.x, y: this.player.y },
                    'flowers'
                );

                if (this.textures.exists('magicalSparkle')) {
                    const sparkle = this.add.image(
                        flower.x,
                        flower.y - 20,
                        'magicalSparkle'
                    );
                    sparkle.setScale(0.6);
                    this.tweens.add({
                        targets: sparkle,
                        y: sparkle.y - 30,
                        alpha: { from: 1, to: 0 },
                        scale: { from: 0.5, to: 1 },
                        duration: 1000,
                        onComplete: () => sparkle.destroy()
                    });
                } else {
                    console.warn(
                        '[GameScene] magicalSparkle texture not found, recreating'
                    );
                    this.graphicsEngine?.createMagicalSparkle(0x00FFFF, 0.8);
                }

                const natureBonus = window.NatureAttunementSystem
                    .getStatBonus('happiness');
                const happinessGain = Math.round(2 * (1 + natureBonus / 100));
                getGameState().updateCreature({
                    stats: {
                        happiness: getGameState().get('creature.stats.happiness') +
                            happinessGain
                    }
                });
                const dailyLeft = result.dailyRemaining;
                this.showInteractionHint(
                    `*sniff* Nature attunement +${result.pointsEarned}! ` +
                    `(${dailyLeft} flowers left today)`
                );
                if (result.milestoneUnlocked) {
                    console.log(
                        `[GameScene] Nature milestone unlocked: ${result.milestoneName}`
                    );
                }
                this.updateStatsDisplay();
                const responseRequest = window.CreatureAIController
                    ?.respondToExploration?.('flower');
                responseRequest
                    ?.then(response => this.showCreatureResponse(response))
                    ?.catch(error => {
                        console.warn('[GameScene] AI response failed:', error);
                    });
                this.time.delayedCall(500, () => this.checkAndUnlockAchievements());
            } else {
                this.showInteractionHint(
                    result.message || 'You\'ve enjoyed enough flowers today!'
                );
            }
        } else {
            getGameState().updateCreature({
                stats: {
                    happiness: getGameState().get('creature.stats.happiness') + 2
                }
            });
            this.showInteractionHint('*sniff* What a lovely smell! (+2 Happiness)');
        }

        this.nearbyFlower = null;
        if (this.currentBiome === 'nebula') {
            this.withdrawSanctuaryInteraction('flower');
        } else {
            this.mobileControls?.updateInteractIcon('👆');
        }
        return true;
    }

    /**
     * Show creature's chat response
     * Helper for displaying AI-generated responses in the game world
     */
    showCreatureResponse(response) {
        if (!response) return;

        const x = this.player.x;
        const y = this.player.y - 80; // Above player

        const bubble = this.add.text(x, y, response, {
            fontSize: '14px',
            color: '#FFFFFF',
            backgroundColor: 'rgba(123, 104, 238, 0.95)',
            padding: { x: 12, y: 9 },
            borderRadius: 12,
            align: 'center',
            wordWrap: { width: 280 },
            fontFamily: 'Arial, sans-serif',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        bubble.setDepth(5000);
        bubble.setScrollFactor(1); // Move with camera

        // Fade in and bounce
        bubble.setAlpha(0);
        bubble.setScale(0.8);
        this.tweens.add({
            targets: bubble,
            alpha: 1,
            scale: 1,
            duration: 400,
            ease: 'Back.easeOut'
        });

        // Auto-dismiss after 4 seconds
        this.time.delayedCall(4000, () => {
            this.tweens.add({
                targets: bubble,
                alpha: 0,
                y: y - 30,
                scale: 0.9,
                duration: 500,
                ease: 'Power2',
                onComplete: () => bubble.destroy()
            });
        });
    }

    update(time, delta) {
        // Guard: Skip update if scene is shutting down or not ready
        if (this._isShuttingDown || !this.player?.active || !this.player.body?.enable) {
            return;
        }

        if (this.waypointPreview) {
            this.projectBeaconWaypoint?.update(delta || 16.67);
            return;
        }

        if (this.mapRecoveryPreview) {
            return;
        }

        if (
            this.residentExchangeOpen ||
            this.guardianExchangeOpen ||
            this.guardianCareActivityOpen ||
            this.fendListeningOpen
        ) {
            this.player?.body?.setVelocity?.(0, 0);
            return;
        }

        // Handle player movement
        this.handleMovement();
        this.trackSanctuaryZoneVisit();
        this.astronautFollower?.update(delta || this.game?.loop?.delta || 16.67);
        this.projectBeaconWaypoint?.update(delta || this.game?.loop?.delta || 16.67);

        // Update position display
        this.updatePositionDisplay(time);

        // Update cosmic UI elements
        this.updateCosmicMiniMap();
        this.updateGlowingStatBars();

        // Update floating chat bubble position
        this.floatingChatBubble?.update();

        // Update enemy AI
        if (this.enemies && window.EnemyManager) {
            this.enemies.getChildren().forEach(enemy => {
                if (enemy.active) {
                    window.EnemyManager.updateEnemyAI(enemy, this.game.loop.delta);
                }
            });
        }

        // Update combat cooldown
        this.updateCombatCooldown(this.game.loop.delta);

        // Check collectible proximity for auto-collection
        this.checkCollectibleProximity();
        this.checkLivingSignalProximity(delta || this.game?.loop?.delta || 16.67);

        // Check shop proximity distance
        if (this.nearShop && this.shop && this.player) {
            const distance = Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                this.shop.x,
                this.shop.y
            );

            // Reset nearShop flag if player moved away
            if (this.shouldClearInteractionState('shop', this.shop, 'nearShop')) {
                if (distance > this.getInteractionDistance('shop').clear) {
                    console.log('[GameScene] Player moved away from shop, distance:', distance);
                    this.nearShop = false;
                    const replacement = this.withdrawSanctuaryInteraction('shop');
                    if (!replacement) this.hideInteractionHint();
                }
            }
        }

        // Check hub portal proximity distance
        if (this.nearHubPortal && this.hubPortal && this.player) {
            const distance = Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                this.hubPortal.x,
                this.hubPortal.y
            );

            // Reset nearHubPortal flag if player moved away
            if (this.shouldClearInteractionState('hubPortal', this.hubPortal, 'nearHubPortal')) {
                if (distance > this.getInteractionDistance('hubPortal').clear) {
                    console.log('[GameScene] Player moved away from hub portal, distance:', distance);
                    this.nearHubPortal = false;
                    const replacement = this.withdrawSanctuaryInteraction('hubPortal');
                    if (!replacement) this.hideInteractionHint();

                    // Clean up portal indicator
                    if (this.portalIndicator) {
                        if (this.portalPulseAnim) {
                            this.portalPulseAnim.stop();
                            this.portalPulseAnim = null;
                        }
                        this.portalIndicator.destroy();
                        this.portalIndicator = null;
                    }
                }
            }
        }

        // Note: Void portal proximity is now handled by the automatic pull-in sequence
        // The startVoidPullSequence() and cancelVoidPull() methods manage escape detection

        // Check crashed ship proximity distance
        if (this.nearCrashedShip && this.crashedShip && this.player) {
            const distance = Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                this.crashedShip.x,
                this.crashedShip.y
            );

            // Reset nearCrashedShip flag if player moved away
            if (this.shouldClearInteractionState('crashShip', this.crashedShip, 'nearCrashedShip')) {
                if (distance > this.getInteractionDistance('crashShip').clear) {
                    console.log('[GameScene] Player moved away from crashed ship, distance:', distance);
                    this.nearCrashedShip = false;
                    const replacement = this.withdrawSanctuaryInteraction(
                        'crashedShip'
                    );
                    if (!replacement) this.hideInteractionHint();

                }
            }
        }

        // Check return portal proximity distance
        if (this.nearReturnPortal && this.returnPortal && this.player) {
            const distance = Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                this.returnPortal.x,
                this.returnPortal.y
            );

            // Reset nearReturnPortal flag if player moved away
            if (this.shouldClearInteractionState('returnPortal', this.returnPortal, 'nearReturnPortal')) {
                if (distance > this.getInteractionDistance('returnPortal').clear) {
                    console.log('[GameScene] Player moved away from return portal, distance:', distance);
                    this.nearReturnPortal = false;
                    this.hideInteractionHint();

                    if (this.mobileControls && !this.nearbyFlower && !this.nearShop && !this.nearHubPortal && !this.nearCrashedShip) {
                        this.mobileControls.updateInteractIcon('👆');
                    }
                }
            }
        }

        // Check campfire proximity distance
        if (this.nearCampfire && this.campfire && this.player) {
            const distance = Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                this.campfire.x,
                this.campfire.y
            );

            // Reset nearCampfire flag if player moved away
            if (this.shouldClearInteractionState('campfire', this.campfire, 'nearCampfire')) {
                if (distance > this.getInteractionDistance('campfire').clear) {
                    console.log('[GameScene] Player moved away from campfire, distance:', distance);
                    this.nearCampfire = false;
                    const replacement = this.withdrawSanctuaryInteraction('campfire');
                    if (!replacement) this.hideInteractionHint();

                    // Clean up campfire indicator
                    if (this.campfireIndicator) {
                        this.campfireIndicator.destroy();
                        this.campfireIndicator = null;
                    }
                    if (this.campfireGlowAnim) {
                        this.campfireGlowAnim.stop();
                        this.campfireGlowAnim = null;
                    }
                }
            }
        }

        if (this.nearSignalGarden && this.signalGarden?.zone && this.player) {
            const distance = Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                this.signalGarden.zone.x,
                this.signalGarden.zone.y
            );

            if (this.shouldClearInteractionState(
                'signalGarden',
                this.signalGarden?.zone || { x: NaN, y: NaN },
                'nearSignalGarden'
            )) {
                if (distance > this.getInteractionDistance('signalGarden').clear) {
                    console.log('[GameScene] Player moved away from Signal Garden, distance:', distance);
                    this.nearSignalGarden = false;
                    const replacement = this.withdrawSanctuaryInteraction('signalGarden');
                    if (!replacement) this.hideInteractionHint();
                    this.signalGardenIndicatorTween?.stop();
                    this.signalGardenIndicatorTween = null;
                    this.signalGardenIndicator?.destroy();
                    this.signalGardenIndicator = null;
                }
            }
        }

        if (
            this.nearVillageHeart &&
            this.villageHeartLandmark?.zone &&
            this.player
        ) {
            if (!this.sanctuaryInteractionDirector?.candidates?.has('villageHeart')) {
                this.offerVillageHeartInteraction(
                    this.villageHeartLandmark.snapshot ||
                        getVillageSnapshot(window.GameState)
                );
            }
            const distance = Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                this.villageHeartLandmark.zone.x,
                this.villageHeartLandmark.zone.y
            );
            if (this.shouldClearInteractionState(
                'villageHeart',
                this.villageHeartLandmark?.zone || { x: NaN, y: NaN },
                'nearVillageHeart'
            )) {
                if (distance > this.getInteractionDistance('villageHeart').clear) {
                    this.nearVillageHeart = false;
                    this.updateSanctuaryFocusMode(false);
                    const replacement = this.withdrawSanctuaryInteraction('villageHeart');
                    if (!replacement) this.hideInteractionHint();
                }
            }
        }

        if (
            this.nearFusionPod &&
            this.fusionPodLandmark?.zone &&
            this.player
        ) {
            const distance = Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                this.fusionPodLandmark.zone.x,
                this.fusionPodLandmark.zone.y
            );
            if (this.shouldClearInteractionState(
                'fusionPod',
                this.fusionPodLandmark?.zone || { x: NaN, y: NaN },
                'nearFusionPod'
            )) {
                if (distance > this.getInteractionDistance('fusionPod').clear) {
                    console.log(
                        '[GameScene] Player moved away from Fusion Pod, distance:',
                        distance
                    );
                    this.nearFusionPod = false;
                    const replacement = this.withdrawSanctuaryInteraction('fusionPod');
                    if (!replacement) this.hideInteractionHint();
                    this.fusionPodIndicatorTween?.stop?.();
                    this.fusionPodIndicatorTween = null;
                    this.fusionPodIndicator?.destroy?.();
                    this.fusionPodIndicator = null;
                }
            }
        }

        if (this.nearFendResidentId && this.signalGarden?.residents && this.player) {
            const resident = this.signalGarden.residents.find(
                entry => entry.id === this.nearFendResidentId
            );
            const distance = resident
                ? Phaser.Math.Distance.Between(
                    this.player.x,
                    this.player.y,
                    resident.zone.x,
                    resident.zone.y
                )
                : Number.POSITIVE_INFINITY;
            if (distance > this.getInteractionDistance('fendResident').clear) {
                const previousId = this.nearFendResidentId;
                this.nearFendResidentId = null;
                const replacement = this.withdrawSanctuaryInteraction(
                    `fendResident:${previousId}`
                );
                if (!replacement) this.hideInteractionHint();
            }
        }

        if (
            this.nearGuardianResidentId &&
            this.signalGarden?.guardianResidents &&
            this.player
        ) {
            const resident = this.signalGarden.guardianResidents.find(
                entry => entry.id === this.nearGuardianResidentId
            );
            const distance = resident
                ? Phaser.Math.Distance.Between(
                    this.player.x,
                    this.player.y,
                    resident.zone.x,
                    resident.zone.y
                )
                : Number.POSITIVE_INFINITY;
            if (distance > this.getInteractionDistance('guardianResident').clear) {
                const previousId = this.nearGuardianResidentId;
                this.nearGuardianResidentId = null;
                const replacement = this.withdrawSanctuaryInteraction(
                    `guardianResident:${previousId}`
                );
                if (!replacement) this.hideInteractionHint();
            }
        }

        if (
            this.nearRescuedResidentId &&
            this.signalGarden?.rescuedResidents &&
            this.player
        ) {
            const resident = this.signalGarden.rescuedResidents.find(
                entry => entry.id === this.nearRescuedResidentId
            );
            const distance = resident
                ? Phaser.Math.Distance.Between(
                    this.player.x,
                    this.player.y,
                    resident.zone.x,
                    resident.zone.y
                )
                : Number.POSITIVE_INFINITY;
            if (distance > this.getInteractionDistance('rescuedResident').clear) {
                const previousId = this.nearRescuedResidentId;
                this.nearRescuedResidentId = null;
                const replacement = this.withdrawSanctuaryInteraction(
                    `rescuedResident:${previousId}`
                );
                if (!replacement) this.hideInteractionHint();
            }
        }

        if (
            this.nearCurrentVeilAnchorId &&
            this.signalGarden?.currentVeilAnchors &&
            this.player
        ) {
            const anchor = this.signalGarden.currentVeilAnchors.find(
                entry => entry.id === this.nearCurrentVeilAnchorId
            );
            const distance = anchor
                ? Phaser.Math.Distance.Between(
                    this.player.x,
                    this.player.y,
                    anchor.zone.x,
                    anchor.zone.y
                )
                : Number.POSITIVE_INFINITY;
            if (distance > this.getInteractionDistance('currentVeilAnchor').clear) {
                const previousId = this.nearCurrentVeilAnchorId;
                this.nearCurrentVeilAnchorId = null;
                const replacement = this.withdrawSanctuaryInteraction(
                    `currentVeilAnchor:${previousId}`
                );
                if (!replacement) this.hideInteractionHint();
            }
        }

        // Check target range proximity (zone-based check)
        this.checkTargetRangeProximity();
        this.sanctuaryInteractionDirector?.update();

        // Handle care keys (only if care system is available)
        if (this.carePanelManager) {
            if (Phaser.Input.Keyboard.JustDown(this.feedKey)) {
                this.carePanelManager.performAction('feed');
            }
            if (Phaser.Input.Keyboard.JustDown(this.playKey)) {
                this.carePanelManager.performAction('play');
            }
            if (Phaser.Input.Keyboard.JustDown(this.restKey)) {
                this.carePanelManager.performAction('rest');
            }
            if (Phaser.Input.Keyboard.JustDown(this.careKey)) {
                this.carePanelManager.togglePanel();
            }
        }

        // Handle space key for interactions
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.handleSpaceInteraction();
        }

        // Handle I key for inventory
        if (Phaser.Input.Keyboard.JustDown(this.inventoryKey)) {
            this.openInventory();
        }

        // Handle S key for shop
        if (this.shopKey && Phaser.Input.Keyboard.JustDown(this.shopKey)) {
            this.openShop();
        }

        // Handle B key for the Fusion Pod (formerly called the Breeding Shrine)
        if (this.breedingKey && Phaser.Input.Keyboard.JustDown(this.breedingKey)) {
            this.openFusionPod();
        }

        // Handle H key for Hub World
        if (this.hubKey && Phaser.Input.Keyboard.JustDown(this.hubKey)) {
            this.openHubWorld();
        }

        // Handle M key for combat (desktop)
        if (Phaser.Input.Keyboard.JustDown(this.combatKey)) {
            this.fireCombatProjectile();
        }

        // Handle T key for Talk/AI chat (desktop)
        if (Phaser.Input.Keyboard.JustDown(this.chatKey)) {
            this.openChat();
        }

        // Handle Q key for time-slow ability (unlocked via campfire bonding)
        if (this.timeSlowKey && Phaser.Input.Keyboard.JustDown(this.timeSlowKey)) {
            this.activateTimeSlow();
        }

        // Periodic checks for achievements and tutorials are now handled by timers
        // in setupPeriodicTimers() to improve performance

        // Reset nearby flower when moving away
        if (!this.physics.overlap(this.player, this.flowers)) {
            if (this.nearbyFlower) {
                this.nearbyFlower = null;
                if (this.currentBiome === 'nebula') {
                    const replacement = this.withdrawSanctuaryInteraction('flower');
                    if (!replacement) this.hideInteractionHint();
                } else {
                    this.mobileControls?.updateInteractIcon('👆');
                }
            }
        }
    }

    handleMovement() {
        // Guard: Ensure player and cursors exist
        if (
            !this.player?.active ||
            !this.player.body?.enable ||
            !this.cursors ||
            !this.wasdKeys
        ) {
            return;
        }

        // Base speed with ability modifiers (Swift Paws, etc.)
        // Increased from 200 to 320 for smoother, faster movement across sanctuary
        let speed = 320;
        if (window.SecretAbilityManager) {
            speed = window.SecretAbilityManager.getModifiedSpeed(320);
        }
        let velocityX = 0;
        let velocityY = 0;
        let isMoving = false;

        // Check for virtual joystick input (mobile)
        const joystickThreshold = 0.1; // Ignore very small joystick movements
        if (Math.abs(this.joystickX) > joystickThreshold || Math.abs(this.joystickY) > joystickThreshold) {
            velocityX = this.joystickX * speed;
            velocityY = this.joystickY * speed;
            isMoving = true;
        } else {
            // Check for input from arrow keys and WASD (desktop)
            if (this.cursors.left.isDown || this.wasdKeys.A.isDown) {
                velocityX = -speed;
                isMoving = true;
            } else if (this.cursors.right.isDown || this.wasdKeys.D.isDown) {
                velocityX = speed;
                isMoving = true;
            }

            if (this.cursors.up.isDown || this.wasdKeys.W.isDown) {
                velocityY = -speed;
                isMoving = true;
            } else if (this.cursors.down.isDown || this.wasdKeys.S.isDown) {
                velocityY = speed;
                isMoving = true;
            }
        }

        // Normalize diagonal movement for keyboard (joystick already normalized)
        if (this.joystickX === 0 && this.joystickY === 0 && velocityX !== 0 && velocityY !== 0) {
            velocityX *= 0.707; // 1/√2 for normalized diagonal movement
            velocityY *= 0.707;
        }

        // Apply velocity to player
        this.player.setVelocity(velocityX, velocityY);

        // Handle animations (with fallback if animations not created)
        try {
            if (isMoving) {
                if (this.anims.exists('walk')) {
                    this.player.anims.play('walk', true);
                }
            } else {
                if (this.anims.exists('idle')) {
                    this.player.anims.play('idle', true);
                }
            }
        } catch (e) {
            // Animations not available - sprite will use static texture
        }

        // Flip player sprite based on movement direction
        if (velocityX < 0) {
            this.player.setFlipX(true);
        } else if (velocityX > 0) {
            this.player.setFlipX(false);
        }
    }

    updatePositionDisplay(time = 0) {
        if (!this.player) return;

        const x = Math.round(this.player.x);
        const y = Math.round(this.player.y);
        this.positionText?.setText?.(`Position: (${x}, ${y})`);

        const savedPosition = getGameState().get('world.currentPosition') || {};
        const movedEnough =
            Math.abs(x - (Number(savedPosition.x) || 0)) >= POSITION_PERSIST_DISTANCE ||
            Math.abs(y - (Number(savedPosition.y) || 0)) >= POSITION_PERSIST_DISTANCE;
        const updateTime = Number.isFinite(time) ? time : Date.now();
        const intervalElapsed =
            updateTime - this.lastPositionPersistedAt >= POSITION_PERSIST_INTERVAL_MS;

        if (movedEnough && intervalElapsed) {
            getGameState().updateWorldExploration({ x, y });
            this.lastPositionPersistedAt = updateTime;
        }
    }

    updateStatsDisplay() {
        const creature = getGameState().get('creature');
        if (!creature || !creature.stats) return;

        const stats = creature.stats;

        // Check for low/critical stat values and add warnings
        const healthWarning = this.getStatWarning(stats.health, 100);
        const happinessWarning = this.getStatWarning(stats.happiness, 100);
        const energyWarning = this.getStatWarning(stats.energy, 100);

        const hasCriticalStats = healthWarning.critical || happinessWarning.critical || energyWarning.critical;
        const displayStat = value => Number.isFinite(Number(value))
            ? Math.round(Number(value))
            : '--';

        const displayText = [
            `${creature.name.toUpperCase()} · LV ${creature.level}`,
            `HP ${displayStat(stats.health)} · JOY ${displayStat(stats.happiness)} · ENERGY ${displayStat(stats.energy)}`
        ].join('\n');

        this.statsText.setText(displayText);

        // Change background color based on stat levels
        if (hasCriticalStats) {
            this.statsText.setBackgroundColor('rgba(139, 0, 0, 0.8)'); // Dark red for critical

            // Add pulsing animation for critical stats
            if (!this.statsPulseAnimation) {
                this.statsPulseAnimation = this.tweens.add({
                    targets: this.statsText,
                    alpha: 0.7,
                    duration: 500,
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1
                });
            }
        } else if (healthWarning.warning || happinessWarning.warning || energyWarning.warning) {
            this.statsText.setBackgroundColor('rgba(139, 69, 0, 0.8)'); // Dark orange for warning

            // Stop critical pulse if it exists
            if (this.statsPulseAnimation) {
                this.statsPulseAnimation.stop();
                this.statsPulseAnimation = null;
                this.statsText.setAlpha(1);
            }
        } else {
            this.statsText.setBackgroundColor('rgba(0, 0, 0, 0.7)'); // Normal

            // Stop pulse if it exists
            if (this.statsPulseAnimation) {
                this.statsPulseAnimation.stop();
                this.statsPulseAnimation = null;
                this.statsText.setAlpha(1);
            }
        }

        this.updateGlowingStatBars();
    }

    /**
     * Get warning indicator for a stat value
     * @param {number} value - Current stat value
     * @param {number} max - Maximum stat value
     * @returns {Object} Warning info {icon, warning, critical}
     */
    getStatWarning(value, max) {
        const percentage = (value / max) * 100;

        if (percentage <= 20) {
            // Critical - show red warning
            return { icon: '🔴', warning: true, critical: true };
        } else if (percentage <= 40) {
            // Low - show yellow warning
            return { icon: '🟡', warning: true, critical: false };
        } else {
            // Good - show normal icon
            if (value === 100) {
                return { icon: '❤️', warning: false, critical: false }; // Health
            }
            return { icon: '✅', warning: false, critical: false };
        }
    }

    getAchievementProgressText() {
        if (!this.achievementSystem) {
            return 'Achievements: N/A';
        }
        const unlocked = this.achievementSystem.getUnlockedAchievements?.().length ?? 0;
        const total = Object.keys(this.achievementSystem.achievements || {}).length || 0;
        const percent = typeof this.achievementSystem.getProgressPercentage === 'function'
            ? this.achievementSystem.getProgressPercentage()
            : (total ? Math.round((unlocked / total) * 100) : 0);
        return `Achievements: ${unlocked}/${total || '?'} (${percent}%)`;
    }

    getTutorialProgressText() {
        if (!this.tutorialSystem) {
            return 'Tutorials: Cozy hints ready';
        }
        if (typeof this.tutorialSystem.getProgressSummary === 'function') {
            return this.tutorialSystem.getProgressSummary();
        }

        const tutorialState = getGameState().get('tutorial') || {};
        const completedCount = Object.values(tutorialState).filter(Boolean).length;
        return `Tutorials: ${completedCount} tips learned`;
    }

    checkAndUnlockAchievements() {
        if (!this.achievementSystem?.checkAchievements) {
            return;
        }
        // Check achievements - notifications are handled by the event listener
        this.achievementSystem.checkAchievements();
    }

    /**
     * Show achievement toast (legacy method - now handled by AchievementNotification)
     * @deprecated Use AchievementNotification instead
     */
    showAchievementToast(achievement) {
        if (!achievement) return;

        // Trigger haptic feedback for achievement
        window.FeedbackManager?.trigger?.('success', this);

        // If we have the new notification system, use it
        if (this.achievementNotification) {
            this.achievementNotification.show(achievement);
            return;
        }

        // Fallback to simple toast for backward compatibility
        const toast = this.add.text(this.scale.width / 2, 180, `⭐ Achievement: ${achievement.name}`, {
            fontSize: '18px',
            color: '#FFD700',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: { x: 18, y: 8 },
            align: 'center'
        }).setOrigin(0.5);
        toast.setScrollFactor(0);
        toast.setDepth(4100);

        this.tweens.add({
            targets: toast,
            alpha: 0,
            delay: 2000,
            duration: 600,
            onComplete: () => toast.destroy()
        });
    }

    checkAndCompleteTutorials() {
        if (!this.tutorialSystem?.checkTutorials) {
            return;
        }
        const completed = this.tutorialSystem.checkTutorials(getGameState().get(), this) || [];
        completed.forEach((tutorial) => this.showTutorialCompletion(tutorial));
    }

    showTutorialHintIfNeeded() {
        if (!this.tutorialSystem?.getNextTutorial || this.isShowingTutorial) {
            return;
        }
        const next = this.tutorialSystem.getNextTutorial(getGameState().get(), this);
        if (next) {
            this.showTutorialHint(next);
        }
    }

    showTutorialHint(tutorial) {
        this.isShowingTutorial = true;
        const { width } = this.scale;
        const isMobile = width < 600;
        const message = isMobile && tutorial.messageMobile
            ? tutorial.messageMobile
            : tutorial.message;
        const hint = this.add.text(width / 2, isMobile ? 185 : 140, message, {
            fontSize: isMobile ? '13px' : '16px',
            color: '#87CEEB',
            stroke: '#000000',
            strokeThickness: 2,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: { x: isMobile ? 10 : 16, y: 8 },
            align: 'center',
            wordWrap: { width: Math.max(250, width - 36) }
        }).setOrigin(0.5);
        hint.setScrollFactor(0);
        hint.setDepth(4050);

        this.tweens.add({
            targets: hint,
            alpha: 0,
            delay: 4500,
            duration: 600,
            onComplete: () => {
                hint.destroy();
                this.isShowingTutorial = false;
            }
        });
    }

    showTutorialCompletion(tutorial) {
        if (!tutorial) return;
        const completion = this.add.text(this.scale.width / 2, 170, `✅ ${tutorial.title} complete`, {
            fontSize: '16px',
            color: '#98FB98',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            padding: { x: 16, y: 6 },
            align: 'center'
        }).setOrigin(0.5);
        completion.setScrollFactor(0);
        completion.setDepth(4060);

        this.tweens.add({
            targets: completion,
            alpha: 0,
            delay: 2000,
            duration: 500,
            onComplete: () => completion.destroy()
        });
    }

    /**
     * Show controls hint for desktop users on first visit
     */
    showControlsHintIfNeeded() {
        // Only show on desktop
        const isMobile = window.innerWidth < 768;
        if (isMobile) return;

        // Check if already seen
        const hasSeen = window.GameState?.get('tutorial.controlsSeen');
        if (hasSeen) return;

        // Mark as seen
        window.GameState?.set('tutorial.controlsSeen', true);

        // Create controls hint panel
        const { width, height } = this.scale;
        const panelWidth = 280;
        const panelHeight = 180;
        const panelX = width - panelWidth - 20;
        const panelY = 80;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 0.9);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 12);
        panel.lineStyle(2, 0x7B68EE);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 12);
        panel.setScrollFactor(0);
        panel.setDepth(4000);

        const title = this.add.text(panelX + panelWidth / 2, panelY + 15, 'Controls', {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(4001);

        const controlsText = [
            'WASD / Arrows - Move',
            'Space - Interact',
            'I - Inventory',
            'M - Attack',
            'C - Chat with creature',
            'Click creature - Chat'
        ].join('\n');

        const controls = this.add.text(panelX + 15, panelY + 40, controlsText, {
            fontSize: '13px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            lineSpacing: 6
        }).setScrollFactor(0).setDepth(4001);

        // Fade out after 8 seconds
        this.tweens.add({
            targets: [panel, title, controls],
            alpha: 0,
            delay: 8000,
            duration: 1000,
            onComplete: () => {
                panel.destroy();
                title.destroy();
                controls.destroy();
            }
        });
    }

    registerGameStateListener(event, handler) {
        try {
            const gameState = getGameState();
            if (!gameState || typeof gameState.on !== 'function') {
                return null;
            }

            const unsubscribe = gameState.on(event, handler);
            if (typeof unsubscribe === 'function') {
                this.gameStateUnsubscribers.push(unsubscribe);
            }

            return unsubscribe;
        } catch (error) {
            console.warn(`[GameScene] Failed to register GameState listener for ${event}`, error);
            return null;
        }
    }

    setupGameStateListeners() {
        // Listen for level up events
        this.registerGameStateListener('levelUp', (data) => {
            console.log('[GameScene] Level up celebration triggered!', data);

            // Trigger level up celebration animation
            this.showLevelUpCelebration(data);

            this.updateStatsDisplay();
            // Check achievements after level up
            this.time.delayedCall(500, () => this.checkAndUnlockAchievements());
        });

        // Listen for care action events
        this.registerGameStateListener('careActionPerformed', (data) => {
            // Trigger haptic feedback for care actions
            window.FeedbackManager?.trigger?.('tap', this);
            this.carePanelManager?.handleCareEvent(data);
            this.updateStatsDisplay();

            // Record care action for achievement tracking
            if (window.AchievementSystem?.recordEvent) {
                window.AchievementSystem.recordEvent('care_action', data);
            }
        });

        // Listen for daily bonus events
        this.registerGameStateListener('dailyBonusClaimed', () => {
            // Trigger haptic feedback for bonus claim
            window.FeedbackManager?.trigger?.('success', this);
            this.showBonusClaimedMessage();
            this.updateDailyBonusButton();
        });

        // Listen for state changes to update UI
        this.registerGameStateListener('stateChanged', (data) => {
            const path = String(data?.path || '');
            if (path.startsWith('creature.stats') ||
                path.startsWith('creature.care') ||
                path.startsWith('world.discoveredObjects') ||
                path.startsWith('dailyBonus')) {
                this.updateStatsDisplay();
                this.carePanelManager?.updateHint();
                this.carePanelManager?.updateButtons();
                this.updateDailyBonusButton();
            }
            if (
                path === 'creature.level' ||
                path.startsWith('creatures') ||
                path.startsWith('breedingShrine')
            ) {
                this.refreshFusionPodWorldLandmark();
            }
        });

        // Listen for personality shift events
        this.registerGameStateListener('personality/shift', (data) => {
            this.showPersonalityShiftCelebration(data);
        });

        // The second companion reveals a Fend kinship protocol. Readiness is a
        // later level/lifecycle gate, so discovery and operation stay distinct.
        this.registerGameStateListener('fusionPodDiscovered', (data) => {
            this.refreshFusionPodWorldLandmark();
            this.scheduleFusionDiscoveryIntroduction(data);
        });
        this.registerGameStateListener('breedingCompleted', (data) => {
            this.refreshFusionPodWorldLandmark();
            if (
                this.currentBiome === 'nebula' &&
                this.worldBuilder &&
                data?.kinshipBeacon
            ) {
                this.kinshipBeacon = this.worldBuilder.refreshKinshipBeacon(
                    this.kinshipBeacon,
                    data.kinshipBeacon
                );
            }
        });

        this.registerGameStateListener(
            'creaturePortraitGenerationSucceeded',
            data => {
                const record = window.GameState?.getCreaturePortrait?.(
                    data?.stage || 'baby'
                );
                void this.maybeShowLivingPortraitReadyNotice(record);
            }
        );

        const pendingDiscovery = window.GameState?.syncFusionDiscovery?.();
        if (pendingDiscovery?.shouldIntroduce) {
            this.scheduleFusionDiscoveryIntroduction(null, {
                initialDelay: 900
            });
        }

        // Listen for scene events from MobileHUD
        if (this.events) {
            this.events.on('showPersonalityPanel', () => this.showPersonalityPanel());
        }
    }

    /**
     * Set up periodic timers for achievements and tutorials
     * Replaces inefficient modulo checks in update loop
     */
    setupPeriodicTimers() {
        // Check achievements every 5 seconds
        this.time.addEvent({
            delay: 5000,
            callback: () => this.checkAndUnlockAchievements(),
            loop: true
        });

        // Check tutorials every 3 seconds
        this.time.addEvent({
            delay: 3000,
            callback: () => this.checkAndCompleteTutorials(),
            loop: true
        });

        // Show tutorial hints every 8 seconds
        this.time.addEvent({
            delay: 8000,
            callback: () => this.showTutorialHintIfNeeded(),
            loop: true
        });

        // Check creature lifecycle (evolution, warnings, etc) every 10 seconds
        this.time.addEvent({
            delay: 10000,
            callback: () => this.checkCreatureLifecycle(),
            loop: true
        });

        // Also check lifecycle immediately on scene start
        this.time.delayedCall(1000, () => this.checkCreatureLifecycle());

        // Update skill cooldown displays every 500ms
        this.time.addEvent({
            delay: 500,
            callback: () => this.updateSkillBarCooldowns(),
            loop: true
        });

        console.log('[GameScene] Periodic timers set up');
    }

    isFusionDiscoveryIntroductionBlocked() {
        const activeStoryQuest = window.QuestManager
            ?.getQuestsByType?.('story')?.[0];
        const establishingTrust = activeStoryQuest?.id ===
            'beacon_first_contact' &&
            !activeStoryQuest.completed &&
            !activeStoryQuest.claimed;

        return Boolean(
            establishingTrust ||
            window.OnboardingManager?.isProcessing ||
            this.controlsTutorial?.isVisible ||
            this.storyModalElements?.length ||
            this.greetingElements?.length ||
            this.livingSignalMomentElements?.length ||
            this.questTracker?.storyBannerElements?.length ||
            this.isFieldKitModalOpen ||
            this.fusionDiscoveryModalOpen ||
            this.hamburgerMenu?.isOpen ||
            this.carePanelManager?.panelVisible ||
            this.creatureRadialMenu?.isVisible
        );
    }

    updateFirstContactFocusMode() {
        const activeStoryQuest = window.QuestManager
            ?.getQuestsByType?.('story')?.[0];
        const firstContactActive = activeStoryQuest?.id ===
            'beacon_first_contact' &&
            !activeStoryQuest.completed &&
            !activeStoryQuest.claimed;
        const interfaceFocusActive = Boolean(
            firstContactActive || this.sanctuaryFocusModeActive
        );
        const mobileFocusActive = Boolean(
            this.mobileHUD?.isVisible && interfaceFocusActive
        );

        this.mobileHUD?.setFocusMode?.(mobileFocusActive);
        this.questTracker?.container?.setVisible?.(!interfaceFocusActive);
        this.firstContactFocusModeActive = Boolean(firstContactActive);
    }

    updateSanctuaryFocusMode(active = this.nearVillageHeart) {
        const nextActive = Boolean(active);
        if (this.sanctuaryFocusModeActive === nextActive) return;
        this.sanctuaryFocusModeActive = nextActive;
        this.sanctuaryPresentationMode = nextActive ? 'action' : 'ambient';
        this.worldBuilder?.setVillageFocusMode?.(
            this.villageHeartLandmark,
            nextActive
        );

        if (nextActive) {
            this.applySanctuaryCameraFocus();
            this.dismissCosmicAffinityNotice();
            this.kidModeHelpContainer?.destroy?.(true);
            this.kidModeHelpContainer = null;
            this.dailyBonusButton?.setVisible?.(false);
        } else {
            this.worldBuilder?.clearVillageCommunityMoment?.(this.villageHeartLandmark);
            this.worldBuilder?.clearVillageDecisionMoment?.(this.villageHeartLandmark);
            this.worldBuilder?.clearVillageWorkerCheckIn?.(this.villageHeartLandmark);
            this.restorePlayerCameraFollow();
            this.getHudController().updateDailyBonusButton();
        }

        if (!this.mobileHUD?.isVisible) {
            this.statsText?.setVisible?.(!nextActive);
            this.resetButton?.setVisible?.(!nextActive);
        }
        this.getHudController().setSanctuaryFocusMode(nextActive);
        this.updateFirstContactFocusMode();
    }

    scheduleFusionDiscoveryIntroduction(
        _payload = null,
        { initialDelay = 650, retryDelay = 900 } = {}
    ) {
        this.fusionDiscoveryIntroductionTimer?.remove?.();
        this.fusionDiscoveryIntroductionTimer = null;

        const attemptIntroduction = () => {
            this.fusionDiscoveryIntroductionTimer = null;
            if (this._isShuttingDown) return;

            const pending = window.GameState?.syncFusionDiscovery?.();
            if (!pending?.shouldIntroduce) return;

            if (this.isFusionDiscoveryIntroductionBlocked()) {
                this.fusionDiscoveryIntroductionTimer =
                    this.time.delayedCall(retryDelay, attemptIntroduction);
                return;
            }

            const creatures = (window.GameState?.get('creatures') || [])
                .map(creature => ({
                    id: creature.id,
                    name: creature.name
                }));
            this.showBreedingUnlockTutorial({
                creatureCount: creatures.length,
                creatures,
                discovery: pending.discovery
            });
        };

        this.fusionDiscoveryIntroductionTimer = this.time.delayedCall(
            initialDelay,
            attemptIntroduction
        );
    }

    /**
     * Check creature lifecycle for evolution, abandonment, and departure warnings
     */
    checkCreatureLifecycle() {
        if (!window.CreatureLifecycle || !window.GameState) {
            return;
        }

        const lifecycle = window.CreatureLifecycle;

        // Check for abandonment first (player was away)
        const abandonmentResult = lifecycle.checkForAbandonment();
        if (abandonmentResult.wasAbandoned) {
            this.handleReturnFromAbandonment(abandonmentResult);
            return;
        }

        // Check for evolution
        const evolutionResult = lifecycle.checkForEvolution();
        if (evolutionResult.shouldEvolve) {
            this.handleEvolution(evolutionResult);
            return;
        }

        // Check for departure warnings
        const status = lifecycle.getLifecycleStatus();
        if (status.departureWarning && !this.shownDepartureWarning) {
            this.showDepartureWarning(status.departureWarning);
            this.shownDepartureWarning = true;
        }
    }

    /**
     * Handle creature evolution - update visuals and play celebration
     */
    handleEvolution(evolutionResult) {
        console.log('[GameScene] Evolution triggered:', evolutionResult);

        const { fromStage, toStage, celebrationConfig } = evolutionResult;

        // Update GameState with new stage
        const now = Date.now();
        window.GameState.set('creature.lifecycle.stage', toStage);
        window.GameState.set('creature.lifecycle.lastStageChange', now);

        // Add to evolution history
        const history = window.GameState.get('creature.lifecycle.evolutionHistory') || [];
        history.push({
            from: fromStage,
            to: toStage,
            timestamp: now
        });
        window.GameState.set('creature.lifecycle.evolutionHistory', history);

        // ALSO update the creature in the creatures array (for FusionPod eligibility)
        const creatures = window.GameState.get('creatures') || [];
        const activeIndex = window.GameState.get('activeCreatureIndex') || 0;
        if (creatures[activeIndex]) {
            if (!creatures[activeIndex].lifecycle) {
                creatures[activeIndex].lifecycle = { evolutionHistory: [] };
            }
            creatures[activeIndex].lifecycle.stage = toStage;
            creatures[activeIndex].lifecycle.lastStageChange = now;
            creatures[activeIndex].lifecycle.evolutionHistory = [...history];
            window.GameState.set('creatures', creatures);
            console.log(`[GameScene] Evolution: Synced stage '${toStage}' to collection index ${activeIndex}`);
        }

        // Emit evolution event for other systems
        window.GameState.emit('creature:evolved', { fromStage, toStage });
        window.AchievementSystem?.recordEvent?.('stage_reached', {
            stage: toStage
        });

        // Play evolution celebration
        this.playEvolutionCelebration(fromStage, toStage, celebrationConfig);

        // Regenerate creature texture with new stage
        this.regenerateCreatureTexture(toStage);
    }

    /**
     * Play evolution celebration sequence - spectacular celebration with modal
     */
    async playEvolutionCelebration(fromStage, toStage, config) {
        console.log(`[GameScene] Playing spectacular evolution celebration: ${fromStage} → ${toStage}`);

        // Use the dedicated EvolutionCelebration system for full spectacle
        if (window.EvolutionCelebration) {
            const creatureData = window.GameState?.get('creature');
            await window.EvolutionCelebration.playCelebration(this, fromStage, toStage, creatureData);
        } else {
            // Fallback to basic celebration if system not loaded
            this.playBasicEvolutionCelebration(fromStage, toStage, config);
        }
    }

    /**
     * Basic fallback evolution celebration (if EvolutionCelebration system unavailable)
     */
    playBasicEvolutionCelebration(fromStage, toStage, config) {
        const { width, height } = this.scale;
        const centerX = width / 2;

        // Play stage-specific evolution audio
        if (window.AudioManager) {
            switch (toStage) {
                case 'juvenile':
                    window.AudioManager.playEvolutionSmall?.();
                    break;
                case 'adult':
                    window.AudioManager.playEvolutionMajor?.();
                    break;
                case 'elder':
                    window.AudioManager.playEvolutionElder?.();
                    break;
                default:
                    window.AudioManager.playLevelUp?.();
            }
        }

        // Screen flash
        window.FeedbackManager?.cameraFlash?.(this, 300, 255, 215, 0);

        // Show celebration message
        const message = this.add.text(centerX, height * 0.2, config?.message || `Your creature evolved!`, {
            fontSize: '28px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(4600).setAlpha(0).setScale(0.5);

        // Animate message
        this.tweens.add({
            targets: message,
            alpha: 1,
            scale: 1,
            duration: 500,
            ease: 'Back.easeOut'
        });

        // Auto-dismiss
        this.time.delayedCall(3000, () => {
            this.tweens.add({
                targets: message,
                alpha: 0,
                y: '-=30',
                duration: 500,
                onComplete: () => message.destroy()
            });
        });
    }

    /**
     * Regenerate creature texture with new lifecycle stage
     */
    regenerateCreatureTexture(stage) {
        if (!this.graphicsEngine || !this.player) {
            console.warn('[GameScene] Cannot regenerate creature - missing graphics engine or player');
            return;
        }

        const genes = window.GameState?.get('creature.genes');
        if (!genes) {
            console.warn('[GameScene] Cannot regenerate creature - no genetics');
            return;
        }

        try {
            // Generate new texture with the new stage
            const result = this.graphicsEngine.createRandomizedSpaceMythicCreature(genes, 0, stage);

            if (result?.textureName && this.textures.exists(result.textureName)) {
                // Update player texture
                this.player.setTexture(result.textureName);

                // Store new texture name
                window.GameState.set('creature.textureName', result.textureName);

                console.log('[GameScene] Creature texture regenerated for stage:', stage);
            }
        } catch (error) {
            console.error('[GameScene] Error regenerating creature texture:', error);
        }
    }

    /**
     * Handle return from abandonment
     */
    handleReturnFromAbandonment(result) {
        console.log('[GameScene] Handling return from abandonment:', result);

        // Show welcome back message with sad creature
        const { width, height } = this.scale;

        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(5000);

        const creatureName = window.GameState?.get('creature.name') || 'Your creature';
        const daysAway = result.daysAway;

        const title = this.add.text(width / 2, height * 0.25, 'SANCTUARY RETURN', {
            fontSize: '28px',
            color: '#8FE3CF',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(5001);

        const message = this.add.text(width / 2, height * 0.4, `${creatureName} stayed close to the crash site for ${daysAway} day${daysAway > 1 ? 's' : ''}.\nTheir care rhythm now needs attention.`, {
            fontSize: '18px',
            color: '#FFFFFF',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 2,
            wordWrap: { width: width - 48 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(5001);

        const hint = this.add.text(width / 2, height * 0.55, 'Begin with food, rest, or quiet play. Progress is never lost.', {
            fontSize: '14px',
            color: '#FFD700',
            align: 'center',
            wordWrap: { width: width - 48 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(5001);

        // Close button
        const closeBtn = this.add.text(width / 2, height * 0.7, 'RECONNECT', {
            fontSize: '18px',
            color: '#FFFFFF',
            backgroundColor: '#4A4A8E',
            padding: { x: 30, y: 12 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(5001);

        closeBtn.setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => {
            // Play hopeful welcome back sound when dismissing
            if (window.AudioManager) {
                window.AudioManager.playReturnWelcome();
            }
            overlay.destroy();
            title.destroy();
            message.destroy();
            hint.destroy();
            closeBtn.destroy();
        });

        window.AudioManager?.playReturnWelcome?.();
    }

    /**
     * Show departure warning
     */
    showDepartureWarning(warning) {
        const { width, height } = this.scale;

        const warningText = this.add.text(width / 2, height * 0.15, `${warning.icon} ${warning.title}`, {
            fontSize: '20px',
            color: '#E6E6FA',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(4500).setAlpha(0);

        const messageText = this.add.text(width / 2, height * 0.15 + 30, warning.message, {
            fontSize: '14px',
            color: '#FFFFFF',
            align: 'center',
            wordWrap: { width: width * 0.8 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(4500).setAlpha(0);

        this.tweens.add({
            targets: [warningText, messageText],
            alpha: 1,
            duration: 1000,
            hold: 5000,
            onComplete: () => {
                this.tweens.add({
                    targets: [warningText, messageText],
                    alpha: 0,
                    duration: 1000,
                    onComplete: () => {
                        warningText.destroy();
                        messageText.destroy();
                    }
                });
            }
        });

        // Play gentle sad sound for departure warning
        if (window.AudioManager) {
            window.AudioManager.playSad();
        }
    }

    /**
     * Show personality panel popup with full trait details
     */
    showPersonalityPanel() {
        if (this.personalityPanelVisible) {
            this.hidePersonalityPanel();
            return;
        }

        const { width, height } = this.cameras.main;
        const personalityState = getGameState().get('creature.personalityState');
        const creatureName = getGameState().get('creature.name') || 'Your Creature';

        if (!personalityState) {
            console.warn('[GameScene] No personality state available');
            return;
        }

        // Get current traits
        let traits = null;
        if (window.PersonalitySystem?.getCurrentTraits) {
            traits = window.PersonalitySystem.getCurrentTraits(personalityState);
        }

        // Create overlay
        this.personalityPanelOverlay = this.add.graphics();
        this.personalityPanelOverlay.fillStyle(0x000000, 0.7);
        this.personalityPanelOverlay.fillRect(0, 0, width, height);
        this.personalityPanelOverlay.setScrollFactor(0).setDepth(2000);
        this.personalityPanelOverlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        this.personalityPanelOverlay.on('pointerdown', () => this.hidePersonalityPanel());

        // Create panel
        const panelWidth = Math.min(320, width - 40);
        const panelHeight = 280;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        this.personalityPanel = this.add.graphics();
        this.personalityPanel.fillStyle(0x1A1A3E, 0.95);
        this.personalityPanel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        this.personalityPanel.lineStyle(3, 0x9370DB, 1);
        this.personalityPanel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        this.personalityPanel.setScrollFactor(0).setDepth(2001);

        // Title
        this.personalityTitle = this.add.text(width / 2, panelY + 25, `${creatureName}'s Personality`, {
            fontSize: '18px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2002);

        // Personality traits display
        const traitInfo = [
            { label: 'Temperament', value: traits?.temperament?.label || 'Unknown', emoji: '💫', color: '#FF69B4' },
            { label: 'Energy', value: traits?.energyLevel?.label || 'Unknown', emoji: '⚡', color: '#00FFFF' },
            { label: 'Curiosity', value: traits?.curiosity?.label || 'Unknown', emoji: '🔍', color: '#90EE90' },
            { label: 'Attachment', value: traits?.attachment?.label || 'Unknown', emoji: '💛', color: '#FFD700' }
        ];

        this.personalityTexts = [];
        traitInfo.forEach((trait, index) => {
            const y = panelY + 70 + (index * 45);

            const text = this.add.text(panelX + 20, y, `${trait.emoji} ${trait.label}:`, {
                fontSize: '14px',
                color: '#AAAAAA'
            }).setScrollFactor(0).setDepth(2002);
            this.personalityTexts.push(text);

            const valueText = this.add.text(panelX + panelWidth - 20, y, trait.value.toUpperCase(), {
                fontSize: '14px',
                color: trait.color,
                fontStyle: 'bold'
            }).setOrigin(1, 0).setScrollFactor(0).setDepth(2002);
            this.personalityTexts.push(valueText);

            // Progress bar showing axis position
            const axisValue = personalityState[trait.label.toLowerCase()] || 0;
            const barX = panelX + 20;
            const barY = y + 22;
            const barWidth = panelWidth - 40;
            const barHeight = 6;

            const barBg = this.add.graphics();
            barBg.fillStyle(0x333333, 1);
            barBg.fillRoundedRect(barX, barY, barWidth, barHeight, 3);
            barBg.setScrollFactor(0).setDepth(2002);
            this.personalityTexts.push(barBg);

            // Fill based on axis (-100 to +100, mapped to 0-100%)
            const fillPercent = (axisValue + 100) / 200;
            const fillColor = parseInt(trait.color.replace('#', ''), 16);
            const barFill = this.add.graphics();
            barFill.fillStyle(fillColor, 0.8);
            barFill.fillRoundedRect(barX, barY, barWidth * fillPercent, barHeight, 3);
            barFill.setScrollFactor(0).setDepth(2003);
            this.personalityTexts.push(barFill);
        });

        // Close hint
        this.closeHint = this.add.text(width / 2, panelY + panelHeight - 20, 'Tap anywhere to close', {
            fontSize: '12px',
            color: '#666666'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2002);

        this.personalityPanelVisible = true;

        // Play sound
        window.AudioManager?.playButtonClick?.();
    }

    /**
     * Hide personality panel
     */
    hidePersonalityPanel() {
        if (!this.personalityPanelVisible) return;

        this.personalityPanelOverlay?.destroy();
        this.personalityPanel?.destroy();
        this.personalityTitle?.destroy();
        this.closeHint?.destroy();
        this.personalityTexts?.forEach(t => t?.destroy());

        this.personalityPanelOverlay = null;
        this.personalityPanel = null;
        this.personalityTitle = null;
        this.closeHint = null;
        this.personalityTexts = [];
        this.personalityPanelVisible = false;
    }

    /**
     * Show celebration for personality shift with particles and sound
     */
    showPersonalityShiftCelebration(data) {
        if (!data?.shifts || data.shifts.length === 0) return;

        const { width, height } = this.cameras.main;

        data.shifts.forEach((shift, index) => {
            // Stagger multiple shifts
            this.time.delayedCall(index * 500, () => {
                // Create floating notification
                const message = `${shift.from} → ${shift.to}`;
                const title = `Personality Shift!`;

                // Background panel
                const panelWidth = 220;
                const panelHeight = 70;
                const panelX = (width - panelWidth) / 2;
                const panelY = 80;

                const panel = this.add.graphics();
                panel.fillStyle(0x4B0082, 0.9);
                panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 10);
                panel.lineStyle(2, 0xFFD700, 1);
                panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 10);
                panel.setScrollFactor(0).setDepth(2500).setAlpha(0);

                const titleText = this.add.text(width / 2, panelY + 20, `✨ ${title} ✨`, {
                    fontSize: '14px',
                    color: '#FFD700',
                    fontStyle: 'bold'
                }).setOrigin(0.5).setScrollFactor(0).setDepth(2501).setAlpha(0);

                const shiftText = this.add.text(width / 2, panelY + 45, message, {
                    fontSize: '16px',
                    color: '#FFFFFF'
                }).setOrigin(0.5).setScrollFactor(0).setDepth(2501).setAlpha(0);

                // Animate in
                this.tweens.add({
                    targets: [panel, titleText, shiftText],
                    alpha: 1,
                    duration: 300,
                    onComplete: () => {
                        // Hold and then fade out
                        this.time.delayedCall(2500, () => {
                            this.tweens.add({
                                targets: [panel, titleText, shiftText],
                                alpha: 0,
                                y: '-=30',
                                duration: 500,
                                onComplete: () => {
                                    panel.destroy();
                                    titleText.destroy();
                                    shiftText.destroy();
                                }
                            });
                        });
                    }
                });

                // Trigger atmospheric effect if parallax biome is active
                if (this.parallaxBiome && this.player) {
                    this.triggerAtmosphericEffect('stardust_burst', this.player.x, this.player.y, 1.2);
                }

                // Particle burst using FXLibrary
                if (window.FXLibrary) {
                    window.FXLibrary.stardustBurst(this, width / 2, panelY + panelHeight / 2, {
                        count: 12,
                        color: [0xFFD700, 0x9370DB, 0xFF69B4],
                        duration: 1500
                    });
                }

                // Play sound
                window.AudioManager?.playAchievement?.();
            });
        });
    }

    /**
     * Show breeding unlock tutorial when player gets their second creature
     * @param {Object} data - Event data with creature info
     */
    showBreedingUnlockTutorial(data) {
        const preview = data?.preview === true;
        const discovery = preview
            ? data.discovery
            : window.GameState?.syncFusionDiscovery?.().discovery;
        if (
            (!preview && this.fusionDiscoveryModalOpen) ||
            discovery?.introductionAcknowledged
        ) {
            return;
        }

        this.fusionDiscoveryModalOpen = true;
        const restoreMobileControls =
            this.mobileControls?.suspend?.() === true;
        console.log('[GameScene] Showing Fend Fusion discovery');
        const { width, height } = this.cameras.main;
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.78);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0).setDepth(3000);
        const inputShield = this.add.zone(
            width / 2,
            height / 2,
            width,
            height
        ).setScrollFactor(0).setDepth(3000).setInteractive();

        const compact = width < 430;
        const panelWidth = Math.min(380, width - 32);
        const panelHeight = Math.min(420, height - 32);
        const shortPanel = panelHeight < 390;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;
        const panel = this.add.graphics();
        panel.fillStyle(0x101616, 0.98);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
        panel.lineStyle(3, 0x71E6B1, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
        panel.setScrollFactor(0).setDepth(3001);
        const contentX = panelX + 22;
        const contentWidth = panelWidth - 44;

        const maraKnown = (
            window.GameState?.get('world.fendResidents.metResidentIds') || []
        ).includes('mara');
        const title = this.add.text(
            contentX,
            panelY + 20,
            maraKnown ? 'MARA // CURRENT LISTENER' : 'FEND CURRENT ARCHIVE',
            {
            fontSize: compact ? '14px' : '16px',
            color: '#F4F4F4',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(3002);

        const subtitle = this.add.text(
            contentX,
            panelY + (shortPanel ? 42 : 48),
            'TWO SIGNALS // KINSHIP PROTOCOL',
            {
            fontSize: compact || shortPanel ? '11px' : '12px',
            color: '#71E6B1',
            fontStyle: 'bold'
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(3002);

        const names = (data?.creatures || [])
            .map(creature => creature?.name)
            .filter(Boolean)
            .slice(0, 2);
        const companionLine = names.length === 2
            ? `${names[0]} and ${names[1]} are both secure in the Sanctuary.`
            : 'Both companions are secure in the Sanctuary.';
        const discoveryLine =
            'A dormant Fend record has answered their two living signatures.';
        const intro = this.add.text(
            contentX,
            panelY + (shortPanel ? 66 : 76),
            shortPanel
                ? `${companionLine}\n${discoveryLine}`
                : `${companionLine}\n\n${discoveryLine}`,
            {
                fontSize: compact || shortPanel ? '12px' : '13px',
                color: '#FFFFFF',
                align: 'left',
                lineSpacing: 5,
                wordWrap: { width: contentWidth }
            }
        ).setOrigin(0, 0).setScrollFactor(0).setDepth(3002);

        const principle = this.add.text(
            contentX,
            panelY + (shortPanel ? 132 : 176),
            'FUSION PRESERVES BOTH PARENTS',
            {
            fontSize: compact || shortPanel ? '11px' : '12px',
            color: '#F2C14E',
            fontStyle: 'bold'
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(3002);

        const status = discovery?.state === 'stable'
            ? 'POD STATUS // STABLE'
            : 'POD STATUS // DORMANT INTERFACE FOUND';
        const requirements = this.add.text(
            contentX,
            panelY + (shortPanel ? 156 : 207),
            `${status}\n\nCalibrate at field level 5.\nWait until both companions are adults.\nPreview inherited traits before confirming.`,
            {
                fontSize: compact || shortPanel ? '11px' : '12px',
                color: '#D7DEE0',
                align: 'left',
                lineSpacing: 4,
                wordWrap: { width: contentWidth }
            }
        ).setOrigin(0, 0).setScrollFactor(0).setDepth(3002);

        const consequence = this.add.text(
            width / 2,
            panelY + panelHeight - (shortPanel ? 76 : 96),
            'Your first lineage will light a permanent Kinship Beacon here.',
            {
                fontSize: compact ? '11px' : '12px',
                color: '#8FE3CF',
                align: 'center',
                wordWrap: { width: panelWidth - 40 }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        const btnY = panelY + panelHeight - (shortPanel ? 30 : 42);
        const btn = this.add.text(width / 2, btnY, 'LOG SIGNAL', {
            fontSize: compact ? '15px' : '16px',
            color: '#FFFFFF',
            backgroundColor: '#3FAE62',
            padding: { x: 38, y: 11 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002).setInteractive();

        btn.on('pointerdown', () => {
            if (!preview) {
                window.GameState?.acknowledgeFusionDiscovery?.();
            }
            [
                overlay,
                inputShield,
                panel,
                title,
                subtitle,
                intro,
                principle,
                requirements,
                consequence,
                btn
            ].forEach(element => element?.destroy?.());
            this.fusionDiscoveryModalOpen = false;
            if (restoreMobileControls) {
                this.mobileControls?.resume?.();
            }
            window.AudioManager?.playButtonClick?.();
        });

        btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#2E8B57' }));
        btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#3FAE62' }));
        window.AudioManager?.playLevelUp?.();

        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, width / 2, height / 2, {
                count: 18,
                color: [0xF4F4F4, 0x3FAE62, 0xC73A3A],
                duration: 1777
            });
        }
    }

    /**
     * Start periodic creature idle sounds
     * Sound varies based on creature stage and personality
     */
    startCreatureIdleSounds() {
        if (!window.AudioManager?.startCreatureIdleSounds) {
            return;
        }

        // Get creature stage and personality
        const stage = getGameState().get('creature.lifecycle.stage') || 'adult';
        const personality = getGameState().get('creature.personality') || 'playful';

        console.log(`[GameScene] Starting idle sounds for ${stage} ${personality} creature`);

        // Start idle sounds and store controller for cleanup
        this.creatureIdleSoundsController = window.AudioManager.startCreatureIdleSounds(
            this,
            stage,
            personality
        );
    }

    /**
     * Initialize Kid Mode UI components
     */
    initializeKidMode() {
        if (!window.KidMode || !window.KidMode.isKidMode()) {
            return;
        }

        console.log('ui:info [GameScene] Initializing Kid Mode UI');

        // Create Kid Mode HUD elements
        this.createKidModeHUD();

        // Set up Kid Mode event handlers
        this.setupKidModeEvents();

        // Update creature interaction for Kid Mode
        this.enhanceCreatureInteraction();
    }

    /**
     * Create Kid Mode HUD with status bars and CTA buttons
     */
    createKidModeHUD() {
        const creatureStats = getGameState().get('creature.stats') || { happiness: 80, energy: 60, health: 90 };
        // Kid Mode keeps larger touch targets, but care status belongs in the
        // radial care panel rather than a second persistent Sanctuary HUD.
        const emotion = this.determineCreatureEmotion(creatureStats);
        this.lastEmotion = emotion;
    }

    /**
     * Determine creature's current emotion based on stats
     * @param {Object} stats - Creature stats object
     * @returns {string} Emotion string
     */
    determineCreatureEmotion(stats) {
        const { happiness, energy, health } = stats;

        // Prioritize critical needs
        if (happiness < 30) return 'hungry';
        if (energy < 30) return 'sleepy'; 
        if (health < 50) return 'dirty';
        
        // Secondary states
        if (happiness < 60) return 'bored';
        if (happiness > 80 && energy > 70) return 'excited';
        
        return 'default'; // Happy/content
    }

    /**
     * Set up Kid Mode event handlers
     */
    setupKidModeEvents() {
        // Listen for Kid Mode actions from UI
        if (this.events && !this.kidModeActionHandler) {
            this.kidModeActionHandler = (action) => this.handleKidModeAction(action);
            this.events.on('kid_mode_action', this.kidModeActionHandler);
        }

        // Update HUD when stats change
        this.registerGameStateListener('stateChanged', (data) => {
            if (data.path.startsWith('creature.stats') && window.KidMode && window.KidMode.isKidMode()) {
                this.updateKidModeHUD();
            }
        });
    }

    /**
     * Handle Kid Mode action buttons
     * @param {string} action - Action to perform
     */
    handleKidModeAction(action) {
        console.log(`ui:info [GameScene] Kid Mode action: ${action}`);

        switch (action) {
            case 'feed':
                this.carePanelManager?.performAction('feed');
                break;
            case 'play':
                this.carePanelManager?.performAction('play');
                break;
            case 'rest':
                this.carePanelManager?.performAction('rest');
                break;
            case 'pet':
                this.carePanelManager?.performAction('pet');
                break;
            case 'clean':
                this.carePanelManager?.performAction('clean');
                break;
            case 'photo':
                this.takeCreaturePhoto();
                break;
            default:
                console.log(`ui:warn [GameScene] Unknown Kid Mode action: ${action}`);
        }

        // Refresh HUD after action
        this.time.delayedCall(500, () => {
            this.updateKidModeHUD();
        });
    }

    /**
     * Take a photo of the creature (Kid Mode feature)
     */
    takeCreaturePhoto() {
        console.log('ui:info [GameScene] Taking creature photo');

        // Create camera flash effect
        const flash = this.add.graphics();
        flash.fillStyle(0xFFFFFF, 0.8);
        flash.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
        flash.setScrollFactor(0);

        // Flash animation
        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 300,
            onComplete: () => flash.destroy()
        });

        // Show photo feedback
        window.KidMode.showHelpMessage(this, '📸 Photo saved! Your creature looks adorable!', 2000);

        // Play camera sound
        window.KidMode.playButtonSound(this);

        // Update stats slightly (creatures like attention)
        if (this.careSystem && typeof this.careSystem.performCareAction === 'function') {
            this.careSystem.performCareAction('pet', 0.5); // Small happiness boost
        }
    }

    /**
     * Update Kid Mode HUD elements
     */
    updateKidModeHUD() {
        if (!window.KidMode || !window.KidMode.isKidMode()) {
            return;
        }

        // Get current stats
        const creatureStats = getGameState().get('creature.stats') || { happiness: 80, energy: 60, health: 90 };
        
        // Determine new best action
        const emotion = this.determineCreatureEmotion(creatureStats);
        const bestAction = window.KidMode.getNextBestAction(emotion);

        const criticalEmotion = ['hungry', 'sleepy', 'dirty'].includes(emotion);
        // Care guidance appears only when the creature needs help, never as a
        // competing arrival banner beside a world interaction.
        if (
            criticalEmotion &&
            this.lastEmotion !== emotion &&
            !this.sanctuaryFocusModeActive
        ) {
            window.KidMode.showHelpMessage(this, bestAction.message);
        }
        this.lastEmotion = emotion;
    }

    /**
     * Enhance creature interaction for Kid Mode (larger click target)
     */
    enhanceCreatureInteraction() {
        if (this.player && window.KidMode && window.KidMode.isKidMode()) {
            // Make creature more clickable in Kid Mode
            this.player.setInteractive(new Phaser.Geom.Circle(0, 0, 60), Phaser.Geom.Circle.Contains);
            
            // Visual feedback for Kid Mode
            this.player.on('pointerover', () => {
                this.tweens.add({
                    targets: this.player,
                    scaleX: 1.1,
                    scaleY: 1.1,
                    duration: 200,
                    ease: 'Power2'
                });
            });

            this.player.on('pointerout', () => {
                this.tweens.add({
                    targets: this.player,
                    scaleX: 1.0,
                    scaleY: 1.0,
                    duration: 200,
                    ease: 'Power2'
                });
            });
        }
    }

    /**
     * Check for offline activities when returning to game
     * Shows WelcomeBackScene if significant offline time passed
     */
    checkOfflineActivities() {
        this.welcomeBackChecked = true;

        try {
            // Get last session timestamp
            const lastSession = window.GameState?.get('session.lastActivityTime') || Date.now();
            const now = Date.now();
            const offlineMs = now - lastSession;
            const offlineMinutes = offlineMs / (1000 * 60);

            // Only show welcome back if offline for more than 30 minutes
            // and creature has been hatched
            const creatureHatched = window.GameState?.get('creature.hatched');
            const minOfflineMinutes = 30;

            console.log(`[GameScene] Offline time: ${Math.round(offlineMinutes)} minutes`);

            if (offlineMinutes >= minOfflineMinutes && creatureHatched && window.CreatureAgent) {
                console.log('[GameScene] Significant offline time detected, simulating activities...');

                // Run offline simulation
                const results = window.CreatureAgent.simulateOfflineActivities(offlineMinutes);

                // Only show WelcomeBackScene if there were notable events
                if (results.events && results.events.length > 0) {
                    console.log(`[GameScene] ${results.events.length} events occurred while away, showing welcome back screen`);

                    // Stop this scene and show WelcomeBackScene
                    this.scene.stop('GameScene');
                    this.scene.start('WelcomeBackScene', {
                        events: results.events,
                        offlineMinutes: offlineMinutes,
                        returnScene: 'GameScene'
                    });
                    return;
                }
            }

            // Update last activity time
            window.GameState?.set('session.lastActivityTime', now);

        } catch (error) {
            console.error('[GameScene] Error checking offline activities:', error);
        }
    }

    /**
     * Shutdown and cleanup
     * Called when scene is stopped/destroyed
     */
    shutdown() {
        if (this._isShuttingDown) {
            return;
        }
        this._isShuttingDown = true;
        console.log('[GameScene] Shutting down - cleaning up event listeners');

        // Emit session ended event for PersonalitySystem
        if (window.GameState && typeof window.GameState.emit === 'function') {
            window.GameState.emit('sessionEnded', {
                scene: 'GameScene',
                timestamp: Date.now()
            });
        }

        // Remove global enemy listeners
        if (window.EnemyManager) {
            if (Array.isArray(this.enemyManagerListeners)) {
                this.enemyManagerListeners.forEach(({ event, handler }) => {
                    try {
                        window.EnemyManager.off(event, handler);
                    } catch (error) {
                        console.warn(`[GameScene] Failed to remove EnemyManager listener for ${event}`, error);
                    }
                });
            }
            this.enemyManagerListeners = [];
            window.EnemyManager.stopSpawning?.();
        }

        // Unsubscribe GameState listeners
        if (Array.isArray(this.gameStateUnsubscribers)) {
            this.gameStateUnsubscribers.forEach((unsubscribe, index) => {
                try {
                    if (typeof unsubscribe === 'function') {
                        unsubscribe();
                    }
                } catch (error) {
                    console.warn(`[GameScene] Failed to unsubscribe GameState listener #${index}`, error);
                }
            });
            this.gameStateUnsubscribers = [];
        }

        // Remove scene event listeners
        if (this.events) {
            this.events.off('openChat');
            this.events.off('radialMenuSelect');
            if (typeof Phaser !== 'undefined' && Phaser?.Scenes?.Events) {
                this.events.off(Phaser.Scenes.Events.RESUME, this.handleSceneResume, this);
            }
            if (import.meta.env.DEV) {
                this.events.off('forceCreatureRefresh');
            }
        }

        // Clean up radial menu
        if (this.creatureRadialMenu) {
            this.creatureRadialMenu.destroy();
            this.creatureRadialMenu = null;
        }

        // Clean up AI Art modal
        if (this.aiArtModal) {
            this.aiArtModal.cleanup();
            this.aiArtModal = null;
        }
        this.companionConsentModal?.destroy?.();
        this.companionConsentModal = null;
        this.companionEarthMemoryModal?.destroy?.();
        this.companionEarthMemoryModal = null;
        this.senseiMemoryModal?.destroy?.();
        this.senseiMemoryModal = null;
        this.shipEvidenceBoardModal?.destroy?.();
        this.shipEvidenceBoardModal = null;
        this.currentVeilModal?.destroy?.();
        this.currentVeilModal = null;
        this.villageCommandPanel?.destroy?.();
        this.villageCommandPanel = null;
        this.villageReconcileTimer?.remove?.();
        this.villageReconcileTimer = null;
        this.villageHeartLandmark = null;
        this.nearVillageHeart = false;
        this.sanctuaryInteractionDirector?.destroy?.();
        this.sanctuaryInteractionDirector = null;
        this.sanctuaryPromptOwnerId = null;
        this.villageCommunityMomentIndex = 0;
        this.lastVillageCommunityMomentAt = 0;
        this.villageHeartMemoryIndex = 0;
        this.lastVillageHeartMemoryAt = 0;
        this.villageCommunityMomentPending = false;
        this.villageDecisionMomentPending = null;
        this.recoveryLogModal?.destroy?.();
        this.recoveryLogModal = null;

        this.closeFieldKitModal?.();
        this.closeFieldKitModal = null;
        this.fieldKitModalElements = [];
        this.fieldKitCaseTween?.stop();
        this.fieldKitCaseTween = null;
        this.fieldKitCase?.destroy?.(true);
        this.fieldKitCase = null;
        this.fieldKitPreviewElements?.forEach(element => element?.destroy?.());
        this.fieldKitPreviewElements = [];
        this.waypointPreviewElements?.forEach(element => element?.destroy?.());
        this.waypointPreviewElements = [];
        this.signalGardenPreviewElements?.forEach(element => element?.destroy?.());
        this.signalGardenPreviewElements = [];
        this.communityMomentElements?.forEach(element => element?.destroy?.());
        this.communityMomentElements = [];
        this.communityMomentOpen = false;
        this.residentExchangeElements?.forEach(element => element?.destroy?.());
        this.residentExchangeElements = [];
        this.residentExchangeOpen = false;
        this.guardianExchangeElements?.forEach(element => element?.destroy?.());
        this.guardianExchangeElements = [];
        this.guardianExchangeOpen = false;
        this.rescuedResidentExchangeElements?.forEach(
            element => element?.destroy?.()
        );
        this.rescuedResidentExchangeElements = [];
        this.rescuedResidentExchangeOpen = false;
        this.destroyGuardianCareActivity();
        this.guardianRecognitionCooldowns?.clear?.();
        this.destroyGuardianCompanionRecognitionMoment();
        this.guardianTrustCinematicRequest += 1;
        this.guardianTrustCinematic?.destroy?.();
        this.guardianTrustCinematic = null;
        this.destroyLivingPortraitReadyNotice();
        this.closeFendCommonsListening?.();
        this.fendListeningElements = [];
        this.fendListeningOpen = false;
        this.fendResidentOverlapColliders?.forEach(collider => {
            collider?.destroy?.();
        });
        this.fendResidentOverlapColliders = [];
        this.guardianResidentOverlapColliders?.forEach(collider => {
            collider?.destroy?.();
        });
        this.guardianResidentOverlapColliders = [];
        this.nearGuardianResidentId = null;
        this.rescuedResidentOverlapColliders?.forEach(collider => {
            collider?.destroy?.();
        });
        this.rescuedResidentOverlapColliders = [];
        this.nearRescuedResidentId = null;
        this.currentVeilOverlapColliders?.forEach(collider => {
            collider?.destroy?.();
        });
        this.currentVeilOverlapColliders = [];
        this.nearCurrentVeilAnchorId = null;
        this.clearLivingSignalMoment();
        this.livingSignalPreviewElements?.forEach(element => element?.destroy?.());
        this.livingSignalPreviewElements = [];
        this.livingSignals.forEach(signal => {
            signal?.pulseTween?.stop?.();
            signal?.container?.destroy?.(true);
        });
        this.livingSignals = [];
        this.signalGardenIndicatorTween?.stop();
        this.signalGardenIndicatorTween = null;
        this.signalGardenIndicator?.destroy();
        this.signalGardenIndicator = null;
        this.astronautFollower?.destroy();
        this.astronautFollower = null;

        // Clean up ability HUD
        if (this.abilityHUD) {
            this.abilityHUD.destroy();
            this.abilityHUD = null;
        }

        // Remove ability selection event
        if (this.events) {
            this.events.off('openAbilitySelection');
        }

        // Remove game event listeners
        if (this.game && this.game.events) {
            if (this.virtualJoystickHandler) {
                this.game.events.off('virtual-joystick', this.virtualJoystickHandler, this);
                this.virtualJoystickHandler = null;
            }
            if (this.virtualKeyHandler) {
                this.game.events.off('virtual-key', this.virtualKeyHandler, this);
                this.virtualKeyHandler = null;
            }
        }

        if (this.mobileCameraResizeHandler) {
            this.scale?.off?.('resize', this.mobileCameraResizeHandler);
            this.mobileCameraResizeHandler = null;
        }
        if (this.interactionTextResizeHandler) {
            this.scale?.off?.('resize', this.interactionTextResizeHandler);
            this.interactionTextResizeHandler = null;
        }

        // Remove scene event listeners
        if (this.events && this.kidModeActionHandler) {
            this.events.off('kid_mode_action', this.kidModeActionHandler, this);
            this.kidModeActionHandler = null;
        }
        this.kidModeHelpContainer?.destroy?.(true);
        this.kidModeHelpContainer = null;

        // Clean up space weather effects
        if (this.auroraEffect) {
            this.auroraEffect.destroy();
            this.auroraEffect = null;
        }
        if (this.skyTintEffect) {
            this.skyTintEffect.destroy();
            this.skyTintEffect = null;
        }
        if (window.SpaceWeatherSystem) {
            window.SpaceWeatherSystem.off('weatherUpdated', this.applySpaceWeatherEffects);
        }

        // Clean up NASA content
        if (window.NASAContentSystem) {
            window.NASAContentSystem.off('issOverhead');
        }
        if (this.nasaModal) {
            this.nasaModal.cleanup();
            this.nasaModal = null;
        }
        if (this.creatureSpeechBubble) {
            this.creatureSpeechBubble.forEach(el => el?.destroy());
            this.creatureSpeechBubble = null;
        }

        // Remove input event listeners
        if (this.input) {
            this.input.off('pointerdown');
            if (this.input.keyboard) {
                this.input.keyboard.off('keydown');
            }
        }

        // Clean up breathing animation tweens
        if (this.breathingTweens && Array.isArray(this.breathingTweens)) {
            this.breathingTweens.forEach(tween => {
                try {
                    if (tween && tween.stop) {
                        tween.stop();
                    }
                } catch (e) {
                    // Tween may already be destroyed
                }
            });
            this.breathingTweens = [];
        }

        // Clean up portal indicator
        if (this.portalPulseAnim) {
            this.portalPulseAnim.stop();
            this.portalPulseAnim = null;
        }

        // Stop creature idle sounds
        if (this.creatureIdleSoundsController?.stop) {
            this.creatureIdleSoundsController.stop();
            this.creatureIdleSoundsController = null;
        }
        if (this.portalIndicator) {
            this.portalIndicator.destroy();
            this.portalIndicator = null;
        }

        // Clean up void pull sequence if active
        this.cancelVoidPull();

        // Clean up achievement notification and listener
        if (this.achievementSystem && this.achievementUnlockHandler) {
            this.achievementSystem.off('achievement:unlocked', this.achievementUnlockHandler, this);
            this.achievementUnlockHandler = null;
        }
        if (this.achievementNotification) {
            this.achievementNotification.destroy();
            this.achievementNotification = null;
        }

        this.economyHud?.destroy();
        this.economyHud = null;
        this.mobileHUD?.destroy();
        this.mobileHUD = null;
        this.carePanelManager?.destroy();
        this.carePanelManager = null;
        this.chatOverlay?.cleanup();
        this.chatOverlay = null;
        this.worldBuilder?.destroy();
        this.worldBuilder = null;
        this.questTracker?.destroy();
        this.questTracker = null;
        this.projectBeaconWaypoint?.destroy();
        this.projectBeaconWaypoint = null;
        this.controlsTutorial?.cleanup();
        this.controlsTutorial = null;
        this.controlsHintPanel?.cleanup();
        this.controlsHintPanel = null;
        this.floatingChatBubble?.destroy();
        this.floatingChatBubble = null;
        this.creatureSwitcher?.cleanup();
        this.creatureSwitcher = null;

        // Cleanup CreatureAnimationController
        if (this.creatureAnimationController) {
            this.creatureAnimationController.destroy();
            this.creatureAnimationController = null;
        }

        // Cleanup creature intelligence integrations
        if (this.spaceWeatherHandler && window.SpaceWeatherSystem) {
            window.SpaceWeatherSystem.off('weatherUpdated', this.spaceWeatherHandler);
            this.spaceWeatherHandler = null;
        }

        if (this.activeAuroraEffect) {
            this.activeAuroraEffect.destroy();
            this.activeAuroraEffect = null;
        }

        if (this.activeSkyTint) {
            this.activeSkyTint.destroy();
            this.activeSkyTint = null;
        }

        if (window.ThoughtBubbleSystem) {
            window.ThoughtBubbleSystem.hideThoughtBubble();
        }

        // Stop background music
        if (window.AudioManager?.stopMusic) {
            window.AudioManager.stopMusic();
        }

        // Clear FeedbackManager reference
        this.feedbackManager = null;

        // Cleanup skill bar
        this.cleanupSkillBar();

        // Cleanup target range
        if (this.targetRangeScoreBg) {
            this.targetRangeScoreBg.destroy();
            this.targetRangeScoreBg = null;
        }
        if (this.targetRangeScoreText) {
            this.targetRangeScoreText.destroy();
            this.targetRangeScoreText = null;
        }
        this.targetRange = null;
        this.targetGroup = null;

        // Cleanup roster indicator
        if (this.rosterElements) {
            this.rosterElements.forEach(el => {
                el?.removeAllListeners?.();
                el?.destroy?.();
            });
            this.rosterElements = null;
        }

        this.hamburgerMenu?.destroy();
        this.hamburgerMenu = null;
        // mapNavButtons removed - was redundant with hamburgerMenu

        // Clear collectibles
        if (Array.isArray(this.collectibles)) {
            this.collectibles.forEach(c => c?.destroy?.());
            this.collectibles = [];
        }

        if (this.statBarGraphics) {
            this.statBarGraphics.destroy();
            this.statBarGraphics = null;
        }
        if (this.statBarLabels) {
            this.statBarLabels.forEach(l => l?.destroy());
            this.statBarLabels = null;
        }
        if (this.cosmicMiniMap?.background) {
            this.cosmicMiniMap.background.destroy();
            this.cosmicMiniMap = null;
        }
        if (this.miniMapPlayerDot) {
            this.miniMapPlayerDot.destroy();
            this.miniMapPlayerDot = null;
        }

        // Destroy interactive objects (this removes their listeners)
        const interactiveObjects = [
            this.player,
            this.dailyBonusButton,
            this.chatButtonBg
        ];

        interactiveObjects.forEach(obj => {
            if (obj && obj.removeAllListeners) {
                obj.removeAllListeners();
            }
        });
        this.dailyBonusButton?.destroy();
        this.dailyBonusButton = null;
        this.resetButton?.destroy();
        this.resetButton = null;
        this.positionText?.destroy();
        this.positionText = null;
        this.statsText?.destroy();
        this.statsText = null;
        this.interactionText?.destroy();
        this.interactionText = null;
        this.interactionHintTimer?.remove?.(false);
        this.interactionHintTimer = null;
        if (this.combatButton?.destroy) {
            this.combatButton.destroy(true);
            this.combatButton = null;
        }
        this.combatBg?.destroy();
        this.combatBg = null;
        this.combatText?.destroy();
        this.combatText = null;
        this.combatCooldownText?.destroy();
        this.combatCooldownText = null;

        // Clear timers
        if (this.time) {
            this.time.removeAllEvents();
        }

        if (Array.isArray(this.coinRespawnTimers)) {
            this.coinRespawnTimers.forEach((timer, index) => {
                try {
                    if (timer?.remove) {
                        timer.remove();
                    } else if (timer?.destroy) {
                        timer.destroy();
                    }
                } catch (error) {
                    console.warn(`[GameScene] Failed to clear coin timer #${index}`, error);
                }
            });
            this.coinRespawnTimers = [];
        }

        // Clear physics groups with safety checks
        if (this.coins && this.coins.scene) {
            try {
                this.coins.clear(true, true);
            } catch (e) {
                console.warn('[GameScene] Could not clear coins in shutdown:', e.message);
            }
            this.coins = null;
        }
        if (this.projectiles && this.projectiles.scene) {
            try {
                this.projectiles.clear(true, true);
            } catch (e) {
                console.warn('[GameScene] Could not clear projectiles in shutdown:', e.message);
            }
            this.projectiles = null;
        }
        if (this.enemies && this.enemies.scene) {
            try {
                this.enemies.clear(true, true);
            } catch (e) {
                console.warn('[GameScene] Could not clear enemies in shutdown:', e.message);
            }
            this.enemies = null;
        }

        this.floatingParticles?.forEach((particle) => {
            try {
                particle.destroy();
            } catch (error) {
                console.warn('[GameScene] Failed to destroy floating particle', error);
            }
        });
        this.floatingParticles = [];

        // Clean up mobile controls
        if (this.mobileControls) {
            this.mobileControls.destroy();
            this.mobileControls = null;
            console.log('[GameScene] Mobile controls cleaned up');
        }

        // Clean up graphics engine
        if (this.graphicsEngine) {
            this.graphicsEngine = null;
        }

        // Clean up ParallaxBiome
        if (this.parallaxBiome) {
            try {
                this.parallaxBiome.cleanup();
            } catch (error) {
                console.warn('[GameScene] Failed to cleanup ParallaxBiome:', error);
            }
            this.parallaxBiome = null;
        }

        // Clean up personality UI elements
        this.moodIndicator?.destroy();
        this.moodIndicator = null;
        this.personalityPanel?.destroy();
        this.personalityPanel = null;
        this.hudController = null;

        if (this.cameras?.main) {
            this.cameras.main.stopFollow();
        }

        this.sceneRouter = null;
        this._sceneLifecycleRegistered = false;

        console.log('[GameScene] Cleanup complete');
    }

    /**
     * Setup secret owner cheats that work in production
     * These are hidden key combinations for game owners/testers
     * Players may discover them as easter eggs - that's part of the fun!
     */
    setupSecretCheats() {
        // Track modifier keys
        let shiftHeld = false;
        let ctrlHeld = false;

        // Owner cheat stage index for lifecycle cycling
        this.ownerStageIndex = 0;

        // Listen for modifier keys
        this.input.keyboard.on('keydown-SHIFT', () => { shiftHeld = true; });
        this.input.keyboard.on('keyup-SHIFT', () => { shiftHeld = false; });
        this.input.keyboard.on('keydown-CTRL', () => { ctrlHeld = true; });
        this.input.keyboard.on('keyup-CTRL', () => { ctrlHeld = false; });

        // SECRET: Shift+Ctrl+C = Add 500 coins
        this.input.keyboard.on('keydown-C', () => {
            if (shiftHeld && ctrlHeld && window.EconomyManager) {
                window.EconomyManager.addCoins(500, 'owner_gift');
                this.showSecretCheatFeedback('💰 +500', '#FFD700');
            }
        });

        // SECRET: Shift+Ctrl+L = Cycle lifecycle stages
        this.input.keyboard.on('keydown-L', () => {
            if (shiftHeld && ctrlHeld) {
                this.cheatCycleStage(); // Use shared method that updates creatures array
            }
        });

        // SECRET: Shift+Ctrl+H = Max all stats (Happiness, Energy, Health)
        this.input.keyboard.on('keydown-H', () => {
            if (shiftHeld && ctrlHeld && window.GameState) {
                window.GameState.set('creature.stats.happiness', 100);
                window.GameState.set('creature.stats.energy', 100);
                window.GameState.set('creature.stats.health', 100);
                this.showSecretCheatFeedback('💖 MAX STATS', '#FF69B4');
                window.AudioManager?.playAchievement?.();
            }
        });

        // SECRET: Shift+Ctrl+E = Add experience/level up
        this.input.keyboard.on('keydown-E', () => {
            if (shiftHeld && ctrlHeld && window.GameState) {
                const currentExp = window.GameState.get('creature.experience') || 0;
                const currentLevel = window.GameState.get('creature.level') || 1;
                window.GameState.set('creature.experience', currentExp + 100);
                window.GameState.set('creature.level', currentLevel + 1);
                this.showSecretCheatFeedback(`⬆️ LVL ${currentLevel + 1}`, '#00FF00');
                window.AudioManager?.playLevelUp?.();
            }
        });

        // SECRET: Shift+Ctrl+R = Unlock time-slow ability
        this.input.keyboard.on('keydown-R', () => {
            if (shiftHeld && ctrlHeld && window.GameState) {
                window.GameState.set('abilities.timeSlowUnlocked', true);
                this.showSecretCheatFeedback('⏱️ TIME SLOW', '#00BFFF');
                window.AudioManager?.playAchievement?.();
            }
        });

        // Developer hacks are now accessible via hamburger menu > Developer Hacks
    }

    /**
     * Regenerate creature texture for a given stage
     * Called by hamburger menu Developer Hacks when cycling stages
     */
    regenerateCreatureTexture(newStage) {
        if (window.GameState) {
            const stageOrder = ['baby', 'juvenile', 'adult', 'elder'];
            const stageDays = { baby: 0, juvenile: 1, adult: 2, elder: 9 };

            // Calculate birthDate to match the stage
            const daysNeeded = stageDays[newStage] || 0;
            const newBirthDate = Date.now() - (daysNeeded * 24 * 60 * 60 * 1000);
            const now = Date.now();

            // Update active creature slot with all required lifecycle fields
            window.GameState.set('creature.lifecycle.stage', newStage);
            window.GameState.set('creature.lifecycle.birthDate', newBirthDate);
            window.GameState.set('creature.lifecycle.lastStageChange', now);

            // ALSO update the creature in the creatures array (for breeding eligibility)
            const creatures = window.GameState.get('creatures') || [];
            const activeIndex = window.GameState.get('activeCreatureIndex') || 0;
            if (creatures[activeIndex]) {
                if (!creatures[activeIndex].lifecycle) {
                    creatures[activeIndex].lifecycle = {};
                }
                creatures[activeIndex].lifecycle.stage = newStage;
                creatures[activeIndex].lifecycle.birthDate = newBirthDate;
                creatures[activeIndex].lifecycle.lastStageChange = now;
                window.GameState.set('creatures', creatures);
            }

            // Force save to persist changes
            window.GameState.save?.();

            // Refresh creature display
            this.refreshCreatureDisplay();

            console.log(`[GameScene] Stage cycled to ${newStage}, birthDate set to ${daysNeeded} days ago`);
        }
    }

    /**
     * Show subtle visual feedback for secret cheats
     */
    showSecretCheatFeedback(text, color) {
        if (!this.player) return;

        const feedbackText = this.add.text(this.player.x, this.player.y - 50, text, {
            fontSize: '18px',
            color: color,
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(2000).setAlpha(0.9);

        this.tweens.add({
            targets: feedbackText,
            y: feedbackText.y - 60,
            alpha: 0,
            duration: 1200,
            ease: 'Power2',
            onComplete: () => feedbackText.destroy()
        });
    }
}

export default GameScene;

if (typeof window !== 'undefined') {
    window.GameScene = GameScene;
}
