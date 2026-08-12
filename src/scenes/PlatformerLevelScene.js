import Phaser from 'phaser';
import {
    queueProjectBeaconDebrief,
    unlockProjectBeaconMilestone
} from '../systems/ProjectBeaconStory.js';
import ExpeditionAstronaut from '../systems/ExpeditionAstronaut.js';
import '../systems/ProjectBeaconFieldKit.js';
import { getMobileControlLayout, getSafeAreaInsets } from '../systems/MobileControlLayout.js';
import bossConfigs from '../config/bosses.json';
import KatanaArtifactModal, { prefetchKatanaArtifactArtwork } from '../ui/KatanaArtifactModal.js';
import { getCurrentRegionActionPresentation, recordCurrentRegionRestoration } from '../systems/CurrentEcology.js';
import { getCurrentAtmosphereProjection } from '../systems/CurrentAtmosphere.js';
import {
    CENTERING_STANCE_DURATION_MS,
    getSenseiMemorySnapshot,
    recordCenteringStancePractice
} from '../systems/SenseiMemory.js';
import { companionMediaService } from '../systems/CompanionMediaService.js';
import { getVillageGameplayEffects } from '../systems/VillageSettlement.js';

const BOSS_REWARD_KEY_BY_LEVEL = Object.freeze({
    crystalCaves: 'crystalGolem',
    cosmicReef: 'voidSerpent',
    auroraDepths: 'shadowPhoenix',
    mythicalForest: 'elderTreant',
    voidPeaks: 'cosmicTitan',
    finalVoid: 'voidEmpress'
});

const CAMPAIGN_LEVEL_BY_SCENE_LEVEL = Object.freeze({
    mythical_forest_1: 'mythicalForest',
    crystal_caves_1: 'crystalCaves',
    reef_1: 'cosmicReef',
    void_peaks_1: 'voidPeaks',
    aurora_depths_1: 'auroraDepths',
    final_void_1: 'finalVoid'
});

const ROUTE_SURVEY_SUPPORT_BY_LEVEL = Object.freeze({
    crystal_caves_1: Object.freeze({
        gateId: 'crystal_caves',
        label: 'CRYSTAL CAVES SURVEY',
        maxHealthBonus: 0,
        maxEnergyBonus: 2,
        guardCharges: 0
    }),
    reef_1: Object.freeze({
        gateId: 'stellar_reef',
        label: 'STELLAR REEF SURVEY',
        maxHealthBonus: 1,
        maxEnergyBonus: 0,
        guardCharges: 0
    }),
    void_peaks_1: Object.freeze({
        gateId: 'void_peaks',
        label: 'VOID PEAKS SURVEY',
        maxHealthBonus: 0,
        maxEnergyBonus: 0,
        guardCharges: 1
    }),
    aurora_depths_1: Object.freeze({
        gateId: 'aurora_depths',
        label: 'AURORA DEPTHS SURVEY',
        maxHealthBonus: 1,
        maxEnergyBonus: 1,
        guardCharges: 0
    })
});

function getRouteSurveySupport(gameState, levelId) {
    const definition = ROUTE_SURVEY_SUPPORT_BY_LEVEL[levelId];
    const mapsOwned = gameState?.get?.('hubWorld.mapsOwned');
    if (!definition || !Array.isArray(mapsOwned) || !mapsOwned.includes(definition.gateId)) {
        return {
            active: false,
            gateId: definition?.gateId || null,
            label: definition?.label || null,
            maxHealthBonus: 0,
            maxEnergyBonus: 0,
            guardCharges: 0
        };
    }
    return { ...definition, active: true };
}

const CURRENT_NODE_LEVEL_CONFIG = Object.freeze({
    mythical_forest_1: Object.freeze({
        x: 700,
        groundOffset: 145,
        label: 'ROOT CURRENT'
    }),
    crystal_caves_1: Object.freeze({
        x: 760,
        groundOffset: 125,
        label: 'CRYSTAL CURRENT'
    }),
    reef_1: Object.freeze({
        x: 260,
        groundOffset: 145,
        label: 'REEF CURRENT'
    }),
    void_peaks_1: Object.freeze({
        x: 520,
        groundOffset: 130,
        label: 'RIDGE CURRENT'
    }),
    aurora_depths_1: Object.freeze({
        x: 560,
        groundOffset: 130,
        label: 'AURORA CURRENT'
    }),
    final_void_1: Object.freeze({
        x: 420,
        groundOffset: 130,
        label: 'CURRENT HEART'
    })
});

const EXPEDITION_CHECKPOINT_PATH =
    'story.projectBeacon.expeditionCheckpoint';
const EXPEDITION_CHECKPOINT_VERSION = 1;
const EXPEDITION_CHECKPOINT_PRESENTATION = Object.freeze({
    MythicalForestLevel: {
        levelStateId: 'mythicalForest',
        checkpoints: [
            ['forest_anchor_1', 'Rootway'],
            ['forest_anchor_2', 'Crown Path'],
            ['forest_anchor_3', 'Guardian Approach']
        ]
    },
    CrystalCavesLevel: {
        levelStateId: 'crystalCaves',
        checkpoints: [
            ['caves_anchor_1', 'Echo Pass'],
            ['caves_anchor_2', 'Living Chamber'],
            ['caves_anchor_3', 'Guardian Threshold']
        ]
    },
    ReefLevel: {
        levelStateId: 'cosmicReef',
        checkpoints: [
            ['reef_waypoint_1', 'Drift Signal'],
            ['reef_waypoint_2', 'Traveler Relay'],
            ['reef_waypoint_3', 'Passage Vector']
        ]
    },
    VoidPeaksLevel: {
        levelStateId: 'voidPeaks',
        checkpoints: [
            ['peaks_relay_1', 'Lower Relay'],
            ['peaks_relay_2', 'Ridge Relay'],
            ['peaks_relay_3', 'Summit Relay']
        ]
    },
    AuroraDepthsLevel: {
        levelStateId: 'auroraDepths',
        checkpoints: [
            ['aurora_prism_1', 'Lower Prism'],
            ['aurora_prism_2', 'Heart Prism'],
            ['aurora_prism_3', 'Sky Prism']
        ]
    },
    FinalVoidLevel: {
        levelStateId: 'finalVoid',
        checkpoints: [
            ['final_bond_1', 'Living Systems'],
            ['final_bond_2', 'Return Route'],
            ['final_bond_3', 'Trust Signal']
        ]
    }
});

function calculateVictoryCoins(levelId, bonusCount = 0) {
    const reward = bossConfigs[BOSS_REWARD_KEY_BY_LEVEL[levelId]]?.rewards;
    if (!reward) {
        return 0;
    }

    const normalizedBonusCount = Math.max(0, Math.floor(Number(bonusCount) || 0));
    const bonusPerCollectible = reward.bonusPerRelic || reward.bonusPerFragment || 0;
    return Math.max(0, Number(reward.baseCoins) || 0) +
        (normalizedBonusCount * Math.max(0, Number(bonusPerCollectible) || 0));
}

/**
 * PlatformerLevelScene - Base class for side-scrolling platformer levels
 *
 * Provides core platformer mechanics:
 * - Gravity-based physics
 * - Jump mechanics with grounded detection
 * - Horizontal camera following
 * - Platform collision system
 * - Combat input handling
 *
 * Extend this class for specific levels (CrystalCavesLevel, etc.)
 */
class PlatformerLevelScene extends Phaser.Scene {
    constructor(config = {}) {
        super({ key: config.key || 'PlatformerLevel' });

        // Level configuration
        this.levelId = config.levelId || 'unknown';
        this.biomeId = config.biomeId || 'crystal_caves';
        this.levelWidth = config.levelWidth || 5000;
        this.levelHeight = config.levelHeight || 800;

        // Physics settings
        this.gravityY = 500;
        this.playerSpeed = 180;         // Reduced from 250 for less sensitive movement
        this.jumpVelocity = -420;
        this.playerAcceleration = 0.15; // Smooth acceleration factor
        this.playerDeceleration = 0.75; // Slower deceleration for precise control

        // State
        this.player = null;
        this.astronautFollower = null;
        this.platforms = null;
        this.enemies = null;
        this.collectibles = null;
        this.isGrounded = false;
        this.canJump = true;
        this.jumpCooldown = 100; // ms between jumps
        this.isDucking = false;  // Crouch/duck state
        this.normalBodyHeight = 55; // Normal collision height
        this.duckBodyHeight = 30;   // Ducking collision height

        // Combat
        this.crystalEnergy = 5;
        this.maxCrystalEnergy = 5;
        this.health = 4;
        this.maxHealth = 4;
        this.isPlayerDead = false; // Debounce flag for death handling
        this.isRestarting = false; // Debounce flag for restart handling
        this.isInvincible = false; // Invincibility frames after taking damage
        this.isRespawning = false; // Debounce flag for pit respawn
        this.invincibilityDuration = 1500; // 1.5 seconds of invincibility
        this.invincibilityTween = null; // Reference to flashing tween
        this.deathScreenElements = null; // Track death screen UI for cleanup
        this.deathKeyHandler = null;
        this.katanaCombatProfile = {
            upgradeIds: [],
            meleeDamage: 2,
            enemyMeleeRange: 70,
            bossMeleeRange: 80,
            slashColor: 0xE040FB,
            slashGlowColor: 0x7B68EE,
            guardCharges: 0
        };
        this.katanaEquipped = false;
        this.auroraGuardCharges = 0;
        this.communityGuardCharges = 0;
        this.guardianGuardCharges = 0;
        this.fendCommunitySupport = {
            maxHealthBonus: 0,
            maxEnergyBonus: 0,
            guardCharges: 0,
            commonsNetwork: false
        };
        this.villageSupport = {
            feedHappinessBonus: 0,
            victoryCoinBonus: 0,
            guardCharges: 0,
            creatureCapacityBonus: 0,
            maxEnergyBonus: 0,
            activeBuildingIds: []
        };
        this.routeSurveySupport = {
            active: false,
            gateId: null,
            label: null,
            maxHealthBonus: 0,
            maxEnergyBonus: 0,
            guardCharges: 0
        };
        this.guardianTeamSupport = {
            guardianId: null,
            guardianName: null,
            kind: null,
            artwork: null,
            textureKey: null,
            color: 0x8FE3CF,
            accent: 0xF4F4F4,
            abilityId: null,
            abilityName: null,
            maxHealthBonus: 0,
            maxEnergyBonus: 0,
            guardCharges: 0,
            shieldHits: 0,
            speedMultiplier: 1,
            jumpMultiplier: 1
        };
        this.guardianSupportEcho = null;
        this.guardianSupportPulseTween = null;
        this.guardianSupportAnnouncementTimer = null;
        this.guardianShieldHitsRemaining = 0;
        this.guardianInterventions = 0;
        this.katanaUpgradeDisplay = null;
        this.katanaArtifactModal = null;
        this.nextRangedDamageMultiplier = 1;
        this.powerupShieldHits = 0;
        this.freeSpecialAttackCharges = 0;
        this.levelCoinMultiplier = 1;

        // Checkpoint system
        this.lastSafePosition = null; // Last ground position for respawn
        this.checkpointPosition = null; // Explicit checkpoint if set

        // Movement feel enhancements
        this.coyoteTime = 100; // ms grace period to jump after leaving platform
        this.lastGroundedTime = 0; // Timestamp when last grounded
        this.jumpBufferTime = 100; // ms to buffer jump input before landing
        this.jumpBufferPressed = false; // Whether jump was pressed recently (for buffering)
        this.jumpBufferTimestamp = 0; // When jump buffer was activated
        this.wasGrounded = false; // Track previous grounded state for landing detection
        this.lastLandingY = 0; // Track Y position to calculate fall distance for dust

        // Crystal Shield power-up
        this.hasShield = false; // Whether player has active shield
        this.shieldTimeRemaining = 0; // Time left on shield
        this.shieldDuration = 15000; // 15 seconds of shield
        this.shieldAuraController = null; // FXLibrary shield aura controller

        // Input
        this.cursors = null;
        this.jumpKey = null;
        this.attackKey = null;
        this.specialKey = null;
        this.rangedKey = null;  // M key for ranged attack
        this.duckKey = null;    // Down arrow/S for ducking

        // Graphics
        this.graphicsEngine = null;
        this.platformBuilder = null;

        // Combat juice system for screen shake, haptics, combos
        this.combatJuice = null;

        // UI
        this.hud = null;

        // Mobile controls for platformer
        this.mobileControls = null;
        this.isMobile = false;
        this.virtualJoystickX = 0;  // -1 to 1 from virtual joystick
        this.virtualJumpPressed = false;
        this.mobileControlElements = []; // Track all mobile UI elements for cleanup
        this.mobileControlTargets = {};
        this.mobileControlCoach = null;
        this.mobileControlCoachTween = null;
        this.actionButtonPointers = new Set(); // Track which pointers are on action buttons (prevents joystick reset)

        // Pause menu state
        this.pauseMenuActive = false;
        this.pauseMenuElements = [];
        this.pauseEscHandler = null;
        this.powerupStatusMessage = null;
        this._levelContentCreated = false;
        this._levelProgressionRecorded = false;
        this.levelCompletionResult = null;
        this.levelCompletionActive = false;
        this.levelCompletionKeyHandler = null;
        this.companionMediaRequest = 0;
        this.companionRescueTableau = null;
        this.residentReleaseElements = [];
        this.residentReleaseOpen = false;
        this.residentReleaseTableau = null;
        this._returningToHub = false;
        this.currentEcologyNode = null;
        this.currentAtmosphere = null;
        this.currentAtmosphereProjection = null;
        this.currentEcologyModalElements = [];
        this.currentEcologyModalActionButtons = new Map();
        this.currentEcologyInteractKey = null;
        this.currentEcologyPlayerNearby = false;
        this.currentEcologyOperationSequence = 0;
        this.autonomousRescueMomentElements = [];
        this.autonomousRescueMomentTimer = null;
        this.centeringStanceUnlocked = false;
        this.centeringStanceUsed = false;
        this.centeringStanceArmed = false;
        this.centeringStanceStartedAt = null;
        this.centeringStanceStatusText = null;
        this.centeringStanceRunId = null;
        this.centeringStancePreviewSize = null;
        this.lastCombatActionAt = Number.NEGATIVE_INFINITY;
        this.recoveryInputLockedUntil = 0;
    }

    init(data) {
        // Accept level data from scene transition
        if (data) {
            this.levelId = data.levelId || this.levelId;
            this.biomeId = data.biomeId || this.biomeId;
        }
        this.entryPreview = data?.entryPreview === true;
        this.currentEcologyPreview =
            data?.currentEcologyPreview === true;
        this.currentEcologyPreviewSize =
            data?.currentEcologyPreviewSize === 'mobile'
                ? 'mobile'
                : null;
        this.recoveryPreview = ['checkpoint', 'restart', 'agency'].includes(data?.recoveryPreview)
            ? data.recoveryPreview
            : null;
        this.autonomousRescuePreview = this.recoveryPreview === 'agency';
        this.forceMobileControls = data?.forceMobileControls === true;
        this.platformerPreviewSize =
            data?.platformerPreviewSize === 'mobile'
                ? 'mobile'
                : null;
        this.centeringStancePreview = ['armed', 'complete'].includes(
            data?.centeringStancePreview
        ) ? data.centeringStancePreview : null;
        this.centeringStancePreviewSize =
            data?.centeringStancePreviewSize === 'mobile'
                ? 'mobile'
                : null;
        this.katanaPreview = ['crystal', 'aurora', 'full'].includes(
            data?.katanaPreview
        ) ? data.katanaPreview : null;
        const guardianDefinitions =
            window.GuardianResidents?.GUARDIAN_RESIDENT_DEFINITIONS || [];
        this.guardianAllyPreview = guardianDefinitions.some(
            guardian => guardian.id === data?.guardianAllyPreview
        ) ? data.guardianAllyPreview : null;
        this.rescuePortraitPreview = data?.rescuePortraitPreview === true;

        // CRITICAL: Reset ALL state on init (called on scene.restart())
        // The constructor only runs once when scene is first registered,
        // but init() runs every time the scene starts/restarts
        this.resetGameState();

        console.log(`[PlatformerLevel] Initializing level: ${this.levelId} (biome: ${this.biomeId})`);
    }

    preload() {
        this.preloadGuardianTeamSupportArtwork();
        this.preloadRescuedResidentArtwork();
    }

    preloadRescuedResidentArtwork() {
        const campaignLevelId = CAMPAIGN_LEVEL_BY_SCENE_LEVEL[this.levelId];
        const resident = window.RescuedResidents
            ?.getRescuedResidentByLevel?.(campaignLevelId);
        if (
            !resident?.artwork ||
            !resident.textureKey ||
            this.textures.exists(resident.textureKey)
        ) {
            return false;
        }
        this.load.image(resident.textureKey, resident.artwork);
        return true;
    }

    preloadGuardianTeamSupportArtwork() {
        const support = this.guardianTeamSupport;
        if (
            !support?.guardianId ||
            !support?.textureKey ||
            !support?.artwork ||
            this.textures.exists(support.textureKey)
        ) {
            return false;
        }
        this.load.image(support.textureKey, support.artwork);
        return true;
    }

    /**
     * Return a viewport-safe layout contract for level entry and completion modals.
     * Callers keep their own visual identity while sharing reliable sizing rules.
     */
    getLevelModalLayout({
        maxWidth = 480,
        maxHeight = 400,
        margin = 20
    } = {}) {
        const { width, height } = this.cameras.main;
        const isCompact = width < 600 || height < 620;
        const horizontalMargin = Math.min(margin, Math.max(12, width * 0.05));
        const verticalMargin = Math.min(margin, Math.max(12, height * 0.04));
        const panelWidth = Math.min(maxWidth, Math.max(0, width - horizontalMargin * 2));
        const panelHeight = Math.min(maxHeight, Math.max(0, height - verticalMargin * 2));
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;
        const contentPadding = isCompact ? 24 : 40;
        const contentWidth = Math.max(210, panelWidth - contentPadding * 2);
        const verticalScale = panelHeight / maxHeight;

        return {
            width,
            height,
            isCompact,
            panelWidth,
            panelHeight,
            panelX,
            panelY,
            contentWidth,
            contentLeft: panelX + contentPadding,
            contentRight: panelX + panelWidth - contentPadding,
            y: (offset) => panelY + offset * verticalScale,
            font: (desktop, compact) => `${isCompact ? compact : desktop}px`,
            buttonPadding: isCompact ? { x: 16, y: 10 } : { x: 25, y: 12 }
        };
    }

    /**
     * Reset all game state - called on init() for restart support
     */
    resetGameState() {
        this.playerSpeed = 180;
        this.jumpVelocity = -420;
        const previewUpgradeIds = {
            crystal: ['crystal_edge'],
            aurora: ['aurora_guard'],
            full: ['crystal_edge', 'aurora_guard']
        }[this.katanaPreview] || null;
        this.katanaCombatProfile = window.ProjectBeaconFieldKit
            ?.getProjectBeaconKatanaCombatProfile?.(
                window.GameState,
                { upgradeIds: previewUpgradeIds }
            ) || {
                upgradeIds: [],
                meleeDamage: 2,
                enemyMeleeRange: 70,
                bossMeleeRange: 80,
                slashColor: 0xE040FB,
                slashGlowColor: 0x7B68EE,
                guardCharges: 0
            };
        this.katanaEquipped = Boolean(
            this.katanaPreview ||
            window.GameState?.get?.('story.projectBeacon.fieldKit.recovered')
        );
        this.auroraGuardCharges = this.katanaCombatProfile.guardCharges;
        this.fendCommunitySupport = window.FendCommunity
            ?.getFendCommunitySnapshot?.(window.GameState)?.support || {
                maxHealthBonus: 0,
                maxEnergyBonus: 0,
                guardCharges: 0,
                commonsNetwork: false
            };
        this.villageSupport = getVillageGameplayEffects(window.GameState);
        this.routeSurveySupport = getRouteSurveySupport(
            window.GameState,
            this.levelId
        );
        this.guardianTeamSupport = window.GuardianResidents
            ?.getActiveGuardianTeamSupport?.(window.GameState) || {
                guardianId: null,
                guardianName: null,
                kind: null,
                artwork: null,
                textureKey: null,
                color: 0x8FE3CF,
                accent: 0xF4F4F4,
                abilityId: null,
                abilityName: null,
                maxHealthBonus: 0,
                maxEnergyBonus: 0,
                guardCharges: 0,
                shieldHits: 0,
                speedMultiplier: 1,
                jumpMultiplier: 1
        };
        this.rescuedResidentSupport = window.RescuedResidents
            ?.getRescuedResidentSnapshot?.(window.GameState)?.support || {
                maxHealthBonus: 0,
                maxEnergyBonus: 0,
                guardCharges: 0,
                victoryCoinBonus: 0,
                speedMultiplier: 1,
                jumpMultiplier: 1
            };
        if (this.guardianAllyPreview) {
            this.guardianTeamSupport = window.GuardianResidents
                ?.createGuardianTeamSupport?.(
                window.GuardianResidents.GUARDIAN_RESIDENT_DEFINITIONS.find(
                    guardian => guardian.id === this.guardianAllyPreview
                )
            ) || this.guardianTeamSupport;
        }
        this.playerSpeed *= this.guardianTeamSupport.speedMultiplier *
            this.rescuedResidentSupport.speedMultiplier;
        this.jumpVelocity *= this.guardianTeamSupport.jumpMultiplier *
            this.rescuedResidentSupport.jumpMultiplier;
        this.maxHealth = 4 +
            this.fendCommunitySupport.maxHealthBonus +
            this.guardianTeamSupport.maxHealthBonus +
            this.rescuedResidentSupport.maxHealthBonus +
            this.routeSurveySupport.maxHealthBonus;
        this.maxCrystalEnergy = 5 +
            this.fendCommunitySupport.maxEnergyBonus +
            this.guardianTeamSupport.maxEnergyBonus +
            this.rescuedResidentSupport.maxEnergyBonus +
            this.villageSupport.maxEnergyBonus +
            this.routeSurveySupport.maxEnergyBonus;
        this.communityGuardCharges = this.fendCommunitySupport.guardCharges +
            this.rescuedResidentSupport.guardCharges +
            this.villageSupport.guardCharges +
            this.routeSurveySupport.guardCharges;
        this.guardianGuardCharges = this.guardianTeamSupport.guardCharges;
        this.guardianShieldHitsRemaining = this.guardianTeamSupport.shieldHits;
        this.guardianInterventions = 0;

        // Reset combat state
        this.health = this.maxHealth;
        this.crystalEnergy = this.maxCrystalEnergy;
        this.nextRangedDamageMultiplier = 1;
        this.powerupShieldHits = this.guardianTeamSupport.shieldHits;
        this.freeSpecialAttackCharges = 0;
        this.levelCoinMultiplier = 1;
        window.EconomyManager?.clearLevelCoinMultiplier?.();

        // Reset flags
        this.isGrounded = false;
        this.canJump = true;
        this.isPlayerDead = false;
        this.isRestarting = false;
        this.isDucking = false;
        this.isInvincible = false;
        this.isRespawning = false;
        this.invincibilityTween = null;

        // Reset checkpoint data
        this.lastSafePosition = null;
        this.checkpointPosition = null;
        this.checkpointResumeApplied = false;

        // Reset mobile control state
        this.virtualJoystickX = 0;
        this.virtualJumpPressed = false;
        this.recoveryInputLockedUntil = 0;

        // Reset pause menu state
        this.pauseMenuActive = false;
        this.pauseMenuElements = [];
        this.powerupStatusMessage = null;
        const senseiMemory = getSenseiMemorySnapshot(window.GameState);
        this.centeringStanceUnlocked = Boolean(
            this.centeringStancePreview ||
            senseiMemory.lesson.unlocked
        );
        this.centeringStanceUsed = false;
        this.centeringStanceArmed = false;
        this.centeringStanceStartedAt = null;
        this.centeringStanceStatusText?.destroy?.();
        this.centeringStanceStatusText = null;
        this.centeringStanceRunId = [
            this.levelId || 'expedition',
            Math.max(
                0,
                Number(window.GameState?.get?.('game.newGamePlusCount')) || 0
            ),
            Date.now().toString(36)
        ].join(':');
        this.lastCombatActionAt = Number.NEGATIVE_INFINITY;
        this._levelContentCreated = false;
        this._levelProgressionRecorded = false;
        this.levelCompletionResult = null;
        this.levelCompletionActive = false;
        this.companionMediaRequest += 1;
        this.companionRescueTableau?.destroy?.();
        this.companionRescueTableau = null;
        this.residentReleaseOpen = false;
        this.residentReleaseTableau?.destroy?.();
        this.residentReleaseTableau = null;
        this.residentReleaseElements?.forEach(element => element?.destroy?.());
        this.residentReleaseElements = [];
        this._returningToHub = false;
        this.clearCurrentEcologyModal?.({ resume: false });
        this.clearCurrentEcologyNode?.();
        this.currentEcologyPlayerNearby = false;
        this.currentEcologyOperationSequence = 0;
        this.currentEcologyModalActionButtons = new Map();
        this.clearAutonomousRescueMoment?.();
        if (this.levelCompletionKeyHandler) {
            window.removeEventListener('keydown', this.levelCompletionKeyHandler);
            this.levelCompletionKeyHandler = null;
        }
        if (this.pauseEscHandler) {
            window.removeEventListener('keydown', this.pauseEscHandler);
            this.pauseEscHandler = null;
        }
        if (this.deathKeyHandler) {
            window.removeEventListener('keydown', this.deathKeyHandler);
            this.deathKeyHandler = null;
        }

        // Reset movement feel state
        this.lastGroundedTime = 0;
        this.jumpBufferPressed = false;
        this.jumpBufferTimestamp = 0;
        this.wasGrounded = false;
        this.lastLandingY = 0;

        // Reset Crystal Shield state
        this.hasShield = false;
        this.shieldTimeRemaining = 0;
        if (this.shieldAuraController) {
            this.shieldAuraController.destroy();
            this.shieldAuraController = null;
        }

        // Clear references (will be recreated in create())
        this.astronautFollower?.destroy();
        this.astronautFollower = null;
        this.destroyGuardianTeamSupportEcho?.();
        this.player = null;
        this.platforms = null;
        this.enemies = null;
        this.collectibles = null;
        this.deathScreenElements = null;
        this.katanaUpgradeDisplay = null;

        // Clean up combat juice
        if (this.combatJuice) {
            this.combatJuice.cleanup();
            this.combatJuice = null;
        }

        console.log('[PlatformerLevel] Game state reset for restart');
    }

    create() {
        console.log(`[PlatformerLevel] Creating level: ${this.levelId}`);
        prefetchKatanaArtifactArtwork();

        // CRITICAL: Re-enable keyboard input (disabled on death, must be restored on restart)
        if (this.input && this.input.keyboard) {
            this.input.keyboard.enabled = true;
        }

        // Show loading state
        if (window.UXEnhancements) {
            window.UXEnhancements.showLoading('Entering the caves...');
        }

        try {
            // 1. Set up platformer physics (gravity enabled)
            this.setupPlatformerPhysics();

            // 2. Set world bounds
            this.physics.world.setBounds(0, 0, this.levelWidth, this.levelHeight);

            // 3. Create graphics engine
            if (window.GraphicsEngine) {
                this.graphicsEngine = new window.GraphicsEngine(this);
            }

            // 3b. Initialize combat juice system for exciting feedback
            if (window.CombatJuice) {
                this.combatJuice = new window.CombatJuice(this);
                console.log('[PlatformerLevel] CombatJuice system initialized');
            }

            // 4. Create parallax background
            this.createBackground();

            // 5. Create platforms
            this.createPlatforms();

            // 6. Create player
            this.createPlayer();
            this.createExpeditionAstronaut();
            this.createGuardianTeamSupportEcho();

            // 7. Set up camera
            this.setupCamera();
            if (
                this.centeringStancePreviewSize === 'mobile' ||
                this.currentEcologyPreviewSize === 'mobile' ||
                this.platformerPreviewSize === 'mobile'
            ) {
                const viewportWidth = Math.min(
                    390,
                    this.scale.width
                );
                const viewportHeight = Math.min(
                    720,
                    this.scale.height
                );
                this.scale.resize(viewportWidth, viewportHeight);
                this.cameras.main.setViewport(
                    0,
                    0,
                    viewportWidth,
                    viewportHeight
                );
            }

            // 8. Set up input
            this.setupInput();

            // 9. Create HUD
            this.createHUD();
            this.time.delayedCall(850, () => this.showVillageSupportBriefing());
            this.time.delayedCall(1450, () => this.showRouteSurveyBriefing());

            if (this.centeringStancePreview) {
                this.health = Math.max(1, this.maxHealth - 1);
                this.updateHealthDisplay();
                this.armCenteringStance();
                this.showPlatformerMobileControls();
                if (this.centeringStancePreview === 'complete') {
                    this.time.delayedCall(450, () => {
                        this.completeCenteringStance({
                            commit: false
                        });
                    });
                }
            }

            // 10. Create level-specific content exactly once.
            this.createLevelSpecificContentOnce();
            this.createCurrentEcologyNode();
            if (this.guardianAllyPreview) {
                this.time.delayedCall(250, () => {
                    this.showPlatformerMobileControls();
                });
            }

            // 11. Restore the last authored Project Beacon signal, if this
            // expedition was interrupted by a reload or a return to the hub.
            this.restorePersistedExpeditionCheckpoint();

            // 12. Set up collisions
            this.setupCollisions();

            if (this.recoveryPreview === 'agency') {
                this.health = 1;
                this.checkpointPosition = {
                    x: 340,
                    y: this.levelHeight - 180
                };
                this.showPlatformerMobileControls();
                this.player.setPosition(
                    this.player.x,
                    this.levelHeight + 240
                );
            } else if (this.recoveryPreview) {
                this.checkpointPosition = this.recoveryPreview === 'checkpoint'
                    ? { x: 900, y: this.levelHeight - 160 }
                    : null;
                this.health = 0;
                this.isPlayerDead = true;
                this.input.keyboard.enabled = false;
                this.hidePlatformerMobileControls();
                this.physics.pause();
                this.showDeathScreen();
            }

            // Hide loading
            if (window.UXEnhancements) {
                window.UXEnhancements.hideLoading();
            }

            console.log(`[PlatformerLevel] Level created successfully`);

        } catch (error) {
            console.error('[PlatformerLevel] Error creating level:', error);
            if (window.UXEnhancements) {
                window.UXEnhancements.hideLoading();
            }
        }
    }

    showVillageSupportBriefing() {
        const support = this.villageSupport || {};
        const lines = [];
        if (support.guardCharges > 0) {
            lines.push(`CURRENT MASONRY // ${support.guardCharges} GUARD CHARGE`);
        }
        if (support.maxEnergyBonus > 0) {
            lines.push(`DISCOVERY WORKSHOP // +${support.maxEnergyBonus} CRYSTAL ENERGY`);
        }
        if (support.victoryCoinBonus > 0) {
            lines.push(`LIVING SAWMILL // +${support.victoryCoinBonus} VICTORY COINS`);
        }
        if (lines.length === 0 || this.sys?.isActive?.() === false) return false;

        const width = this.cameras.main.width;
        const compact = width < 600;
        const panelWidth = Math.min(width - 28, compact ? 350 : 470);
        const panelHeight = 38 + lines.length * (compact ? 14 : 16);
        const y = compact ? 130 : 105;
        const container = this.add.container(width / 2, y)
            .setScrollFactor(0)
            .setDepth(1650)
            .setAlpha(0);
        const background = this.add.rectangle(
            0,
            0,
            panelWidth,
            panelHeight,
            0x07100F,
            0.94
        ).setStrokeStyle(1, 0x71E6B1, 0.82);
        const signal = this.add.rectangle(
            -panelWidth / 2 + 3,
            0,
            4,
            panelHeight - 6,
            0x71E6B1,
            1
        );
        const title = this.add.text(
            -panelWidth / 2 + 14,
            -panelHeight / 2 + 9,
            'VILLAGE SUPPORT ONLINE',
            {
                fontFamily: 'Arial, sans-serif',
                fontSize: compact ? '10px' : '11px',
                color: '#F2C14E',
                fontStyle: 'bold'
            }
        );
        const details = this.add.text(
            -panelWidth / 2 + 14,
            -panelHeight / 2 + 25,
            lines.join('\n'),
            {
                fontFamily: 'Arial, sans-serif',
                fontSize: compact ? '8px' : '9px',
                color: '#F4F4F4',
                lineSpacing: compact ? 3 : 5
            }
        );
        container.add([background, signal, title, details]);
        this.tweens.add({
            targets: container,
            alpha: 1,
            y: y + 7,
            duration: 260,
            ease: 'Power2',
            onComplete: () => {
                this.time.delayedCall(3600, () => {
                    if (!container.active) return;
                    this.tweens.add({
                        targets: container,
                        alpha: 0,
                        y: container.y - 6,
                        duration: 360,
                        onComplete: () => container.destroy(true)
                    });
                });
            }
        });
        return true;
    }

    showRouteSurveyBriefing() {
        const support = this.routeSurveySupport || {};
        if (!support.active || this.sys?.isActive?.() === false) return false;

        const lines = [];
        if (support.maxHealthBonus > 0) {
            lines.push(`+${support.maxHealthBonus} MAX HEALTH`);
        }
        if (support.maxEnergyBonus > 0) {
            lines.push(`+${support.maxEnergyBonus} CRYSTAL ENERGY`);
        }
        if (support.guardCharges > 0) {
            lines.push(`+${support.guardCharges} GUARD CHARGE`);
        }

        const width = this.cameras.main.width;
        const compact = width < 600;
        const panelWidth = Math.min(width - 28, compact ? 350 : 470);
        const panelHeight = 52 + lines.length * (compact ? 14 : 16);
        const y = compact ? 184 : 160;
        const container = this.add.container(width / 2, y)
            .setScrollFactor(0)
            .setDepth(1650)
            .setAlpha(0);
        const background = this.add.rectangle(
            0,
            0,
            panelWidth,
            panelHeight,
            0x08131A,
            0.95
        ).setStrokeStyle(1, 0x67E8C7, 0.9);
        const title = this.add.text(
            -panelWidth / 2 + 14,
            -panelHeight / 2 + 9,
            'ROUTE SURVEY ONLINE',
            {
                fontFamily: 'Arial, sans-serif',
                fontSize: compact ? '10px' : '11px',
                color: '#67E8C7',
                fontStyle: 'bold'
            }
        );
        const route = this.add.text(
            -panelWidth / 2 + 14,
            -panelHeight / 2 + 24,
            support.label,
            {
                fontFamily: 'Arial, sans-serif',
                fontSize: compact ? '8px' : '9px',
                color: '#F2C14E',
                fontStyle: 'bold'
            }
        );
        const details = this.add.text(
            -panelWidth / 2 + 14,
            -panelHeight / 2 + 38,
            lines.join('  //  '),
            {
                fontFamily: 'Arial, sans-serif',
                fontSize: compact ? '8px' : '9px',
                color: '#F4F4F4'
            }
        );
        container.add([background, title, route, details]);
        this.tweens.add({
            targets: container,
            alpha: 1,
            y: y + 7,
            duration: 260,
            ease: 'Power2',
            onComplete: () => {
                this.time.delayedCall(3600, () => {
                    if (!container.active) return;
                    this.tweens.add({
                        targets: container,
                        alpha: 0,
                        y: container.y - 6,
                        duration: 360,
                        onComplete: () => container.destroy(true)
                    });
                });
            }
        });
        return true;
    }

    /**
     * Set up platformer physics with gravity
     */
    setupPlatformerPhysics() {
        // Enable gravity for platformer mode
        this.physics.world.gravity.y = this.gravityY;

        console.log(`[PlatformerLevel] Physics: gravity.y = ${this.gravityY}`);
    }

    /**
     * Create parallax background layers
     */
    createBackground() {
        const screenHeight = this.cameras.main.height;
        const screenWidth = this.cameras.main.width;

        // Use ParallaxBiome for biome-themed background
        if (window.ParallaxBiome) {
            window.ParallaxBiome.initialize(this, this.biomeId);
            window.ParallaxBiome.createBiome();
        }

        // Add a base dark layer for the cave - cover full screen
        const bg = this.add.graphics();
        bg.fillStyle(0x050308, 1);
        // Fill extra area in case screen is larger than level
        const bgHeight = Math.max(this.levelHeight, screenHeight) + 200;
        bg.fillRect(0, 0, this.levelWidth, bgHeight);
        bg.setScrollFactor(0);
        bg.setDepth(-1000);

        // Add a ground fill layer that extends below visible platforms
        // This prevents seeing "below the world" on taller screens
        const groundFill = this.add.graphics();
        groundFill.fillStyle(0x0D0818, 1); // Darker ground color
        // Ground starts at levelHeight - 50 (top of ground platform), extends downward
        groundFill.fillRect(0, this.levelHeight - 50, this.levelWidth, 300);
        groundFill.setDepth(-500);
    }

    /**
     * Create platforms - override in subclass for level-specific layout
     */
    createPlatforms() {
        this.platforms = this.physics.add.staticGroup();

        // Default ground platform (full width)
        this.createPlatform(0, this.levelHeight - 50, this.levelWidth, 80, 'solid');

        // Starting platform area (safe zone)
        this.createPlatform(100, this.levelHeight - 200, 300, 30, 'solid');
        this.createPlatform(500, this.levelHeight - 300, 250, 30, 'solid');
        this.createPlatform(850, this.levelHeight - 200, 200, 30, 'solid');

        console.log(`[PlatformerLevel] Created ${this.platforms.getLength()} platforms`);
    }

    /**
     * Create a single platform with organic visuals
     */
    createPlatform(x, y, width, height, type = 'solid') {
        const textureKey = this.generatePlatformTexture(width, height, type);

        const platform = this.platforms.create(x + width / 2, y + height / 2, textureKey);
        platform.setImmovable(true);
        platform.body.setSize(width, height);
        platform.body.setOffset(-width / 2 + (platform.width / 2), -height / 2 + (platform.height / 2));
        platform.setDepth(y);
        platform.platformType = type;

        // One-way platforms allow jumping through from below
        if (type === 'one-way') {
            platform.body.checkCollision.down = false;
            platform.body.checkCollision.left = false;
            platform.body.checkCollision.right = false;
        }

        return platform;
    }

    /**
     * Generate organic platform texture (not sharp triangles)
     */
    generatePlatformTexture(width, height, type) {
        const textureKey = `platform_${width}_${height}_${type}_${this.biomeId}`;

        if (this.textures.exists(textureKey)) {
            return textureKey;
        }

        const graphics = this.make.graphics({ add: false });

        // Color palette based on biome
        const colors = this.getPlatformColors();

        // Draw organic platform shape with rounded edges
        graphics.fillStyle(colors.base, 1);

        // Main body with rounded corners
        const cornerRadius = Math.min(15, height / 2);
        graphics.fillRoundedRect(0, 0, width, height, cornerRadius);

        // Top highlight (lighter edge)
        graphics.fillStyle(colors.highlight, 0.4);
        graphics.fillRoundedRect(2, 2, width - 4, height / 3, cornerRadius - 2);

        // Bottom shadow (darker edge)
        graphics.fillStyle(colors.shadow, 0.5);
        graphics.fillRoundedRect(2, height * 0.7, width - 4, height * 0.28, cornerRadius - 2);

        // Add rock texture variations
        for (let i = 0; i < Math.floor(width / 40); i++) {
            const rx = Phaser.Math.Between(10, width - 30);
            const ry = Phaser.Math.Between(5, height - 15);
            const rw = Phaser.Math.Between(15, 35);
            const rh = Phaser.Math.Between(8, 18);
            graphics.fillStyle(colors.texture, 0.3);
            graphics.fillRoundedRect(rx, ry, rw, rh, 5);
        }

        // Add crystal accents for cave theme
        if (this.biomeId === 'crystal_caves' && type === 'solid') {
            const crystalCount = Math.floor(width / 150);
            for (let i = 0; i < crystalCount; i++) {
                const cx = Phaser.Math.Between(20, width - 20);
                const cy = 0;
                this.drawCrystalAccent(graphics, cx, cy, colors.crystal);
            }
        }

        graphics.generateTexture(textureKey, width, height);
        graphics.destroy();

        return textureKey;
    }

    /**
     * Draw a small crystal accent on platform
     */
    drawCrystalAccent(graphics, x, y, color) {
        const size = Phaser.Math.Between(8, 15);

        // Crystal glow
        graphics.fillStyle(color, 0.3);
        graphics.fillCircle(x, y + size / 2, size);

        // Crystal shape (pointing up)
        graphics.fillStyle(color, 0.8);
        graphics.fillTriangle(
            x - size / 3, y + size,
            x + size / 3, y + size,
            x, y - size / 2
        );
    }

    /**
     * Get platform colors based on biome
     */
    getPlatformColors() {
        const palettes = {
            crystal_caves: {
                base: 0x1A1025,
                highlight: 0x2D1B3D,
                shadow: 0x0D0818,
                texture: 0x3D2B5D,
                crystal: 0x7B68EE
            },
            stellar_reef: {
                base: 0x1A237E,
                highlight: 0x283593,
                shadow: 0x0D1642,
                texture: 0x3949AB,
                crystal: 0x00BCD4
            },
            void_peaks: {
                base: 0x1A1A2E,
                highlight: 0x2F2F4F,
                shadow: 0x0D0D0D,
                texture: 0x483D8B,
                crystal: 0xFF4500
            },
            aurora_depths: {
                base: 0x0A192F,
                highlight: 0x1B4332,
                shadow: 0x051210,
                texture: 0x2D6A4F,
                crystal: 0x00FF7F
            }
        };

        return palettes[this.biomeId] || palettes.crystal_caves;
    }

    /**
     * Create the player creature
     */
    createPlayer() {
        const startX = 200;
        // Ground platform starts at y = levelHeight - 50, with height 80
        // So ground TOP surface is at y = levelHeight - 50
        // Player body is ~55px tall, spawn player well above ground to ensure visibility
        const groundTopY = this.levelHeight - 50;
        const startY = groundTopY - 80; // Player center 80px above ground top (generous buffer)

        // Generate creature texture using existing system
        let textureName = 'platformerCreature';

        if (this.guardianAllyPreview) {
            this.createFallbackCreatureTexture();
        } else if (this.graphicsEngine) {
            try {
                const textures = this.graphicsEngine.createCreatureAnimationFrames();
                if (textures && textures.length > 0) {
                    textureName = textures[0];
                }
            } catch (e) {
                console.warn('[PlatformerLevel] Using fallback creature texture');
                this.createFallbackCreatureTexture();
            }
        } else {
            this.createFallbackCreatureTexture();
        }

        // Create physics sprite
        this.player = this.physics.add.sprite(startX, startY, textureName);
        this.player.setCollideWorldBounds(true);
        this.player.setBounce(0.1);
        this.player.setDrag(100, 0);

        // Get actual texture dimensions for proper physics body sizing
        const textureWidth = this.player.width;
        const textureHeight = this.player.height;

        // MOBILE UX FIX: Physics body aligned to visual "feet" of creature
        // The body should be at the VERY bottom of the sprite so creature
        // visually sits ON TOP of platforms, not floating or embedded
        //
        // Body sizing: small hitbox for precise platforming
        const bodyWidth = Math.min(28, textureWidth * 0.35);  // Narrower for tighter platforming
        const bodyHeight = Math.min(40, textureHeight * 0.40); // Shorter body

        // CRITICAL: Creature textures have significant padding for visual effects
        // (cosmic auras, sparkles, etc). The actual creature visual is centered in the texture.
        // We need to offset the physics body to align with where the creature's FEET appear.
        //
        // For a 220x260 texture with 60x80 creature centered:
        // - The creature visual sits in the center
        // - We need physics body to align with the visual creature's feet
        // - Testing showed 90px was too much (creature below platform), trying ~55-60px
        const estimatedBottomPadding = Math.min(55, textureHeight * 0.22); // Reduced from 90px - creature was below platforms
        const offsetX = (textureWidth - bodyWidth) / 2;
        const offsetY = textureHeight - bodyHeight - estimatedBottomPadding;

        this.player.body.setSize(bodyWidth, bodyHeight);
        this.player.body.setOffset(offsetX, offsetY);

        // Anchor point adjustment for visual grounding
        // Default origin is 0.5, 0.5 (center). Keep this for proper flip behavior.

        // Player properties - depth must be higher than platforms (which use Y position as depth)
        // Platforms at Y=750 (ground) have depth 750, so player needs depth > 800
        this.player.setDepth(900);
        this.player.facingRight = true;

        console.log(`[PlatformerLevel] Player created at (${startX}, ${startY})`);
        console.log(`[PlatformerLevel] Texture size: ${textureWidth}x${textureHeight}, Body: ${bodyWidth}x${bodyHeight}, Offset: (${offsetX}, ${offsetY})`);
    }

    createExpeditionAstronaut() {
        this.astronautFollower?.destroy();
        this.astronautFollower = new ExpeditionAstronaut(this, this.player, {
            mode: 'platformer',
            fieldKitRecovered: Boolean(
                this.katanaPreview ||
                window.GameState?.get?.('story.projectBeacon.fieldKit.recovered')
            ),
            katanaUpgradeIds: this.katanaCombatProfile.upgradeIds
        });
    }

    createGuardianTeamSupportEcho() {
        this.destroyGuardianTeamSupportEcho();
        const support = this.guardianTeamSupport;
        if (!this.player || !support?.guardianId) return null;

        const color = Number(support.color) || 0x8FE3CF;
        const accent = Number(support.accent) || 0xF4F4F4;
        const echo = this.add.container(this.player.x + 52, this.player.y - 68)
            .setDepth(896)
            .setAlpha(0.92);

        const aura = this.add.graphics();
        aura.fillStyle(color, 0.12);
        aura.fillCircle(0, 0, 25);
        aura.lineStyle(2, accent, 0.82);
        aura.strokeCircle(0, 0, 18);
        echo.add(aura);

        const figureMount = this.add.container(0, 0);
        let figure;
        const usesArtwork = Boolean(
            support.textureKey && this.textures.exists(support.textureKey)
        );
        if (usesArtwork) {
            figure = this.add.image(0, 0, support.textureKey);
            const artworkScale = Math.min(
                48 / Math.max(1, figure.width),
                54 / Math.max(1, figure.height)
            );
            figure.setScale(artworkScale).setAlpha(0.98);
        } else {
            figure = this.add.graphics();
            figure.fillStyle(color, 0.95);
            figure.lineStyle(2, accent, 1);
            const drawGlyph = {
                treant: () => {
                    figure.fillRect(-3, -4, 6, 14);
                    figure.strokeCircle(0, -8, 8);
                    figure.lineBetween(-8, -8, -13, -13);
                    figure.lineBetween(8, -8, 13, -13);
                },
                golem: () => {
                    figure.fillPoints([
                        { x: 0, y: -13 }, { x: 11, y: -2 },
                        { x: 7, y: 12 }, { x: -7, y: 12 },
                        { x: -11, y: -2 }
                    ], true);
                    figure.strokeCircle(0, -2, 4);
                },
                serpent: () => {
                    figure.beginPath();
                    figure.moveTo(-10, -10);
                    figure.lineTo(8, -4);
                    figure.lineTo(-7, 3);
                    figure.lineTo(10, 10);
                    figure.strokePath();
                    figure.fillCircle(-10, -10, 3);
                },
                phoenix: () => {
                    figure.fillTriangle(0, -13, -4, 8, 4, 8);
                    figure.fillTriangle(-2, -2, -15, 5, -3, 10);
                    figure.fillTriangle(2, -2, 15, 5, 3, 10);
                },
                titan: () => {
                    figure.fillRect(-10, -9, 20, 18);
                    figure.strokeCircle(0, -2, 5);
                    figure.lineBetween(-7, 10, -11, 14);
                    figure.lineBetween(7, 10, 11, 14);
                },
                empress: () => {
                    figure.strokeCircle(0, 0, 10);
                    figure.fillCircle(0, 0, 4);
                    figure.fillTriangle(-10, -8, 0, -15, 10, -8);
                }
            }[support.kind];
            (drawGlyph || (() => figure.fillCircle(0, 0, 9)))();
        }
        figureMount.add(figure);
        echo.add(figureMount);

        const label = this.add.text(0, -33, support.guardianName.toUpperCase(), {
            fontSize: '9px',
            color: '#F4F4F4',
            fontStyle: 'bold',
            backgroundColor: 'rgba(5, 12, 18, 0.82)',
            padding: { x: 5, y: 2 }
        }).setOrigin(0.5).setAlpha(0.82);
        echo.add(label);

        this.guardianSupportEcho = {
            container: echo,
            aura,
            figure,
            figureMount,
            label,
            usesArtwork
        };
        this.guardianSupportPulseTween = this.tweens.add({
            targets: aura,
            alpha: { from: 0.45, to: 1 },
            scale: { from: 0.9, to: 1.16 },
            duration: 1050,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        this.guardianSupportAnnouncementTimer = this.time.delayedCall(350, () => {
            if (!this.guardianSupportEcho?.container?.active) return;
            this.showFloatingText?.(
                `${support.abilityName.toUpperCase()} ONLINE`,
                echo.x,
                echo.y - 24,
                `#${accent.toString(16).padStart(6, '0')}`
            );
        });
        return echo;
    }

    updateGuardianTeamSupportEcho(delta = 16.67) {
        const echo = this.guardianSupportEcho?.container;
        if (!echo?.active || !this.player?.active) return;
        const followRight = this.player.facingRight !== false;
        const targetX = this.player.x + (followRight ? 52 : -52);
        const targetY = this.player.y - 68 + Math.sin(this.time.now / 320) * 5;
        const response = Math.min(0.18, Math.max(0.05, (Number(delta) || 16.67) / 260));
        echo.x = Phaser.Math.Linear(echo.x, targetX, response);
        echo.y = Phaser.Math.Linear(echo.y, targetY, response);
    }

    pulseGuardianTeamSupportEcho(label = null) {
        const echo = this.guardianSupportEcho;
        if (!echo?.container?.active) return false;
        this.guardianInterventions += 1;
        const accent = Number(this.guardianTeamSupport?.accent) || 0xF4F4F4;
        this.tweens.add({
            targets: echo.figureMount,
            scale: { from: 1, to: 1.65 },
            duration: 220,
            yoyo: true,
            ease: 'Sine.easeOut'
        });
        if (label) {
            this.showFloatingText?.(
                label.toUpperCase(),
                echo.container.x,
                echo.container.y - 36,
                `#${accent.toString(16).padStart(6, '0')}`
            );
        }
        return true;
    }

    destroyGuardianTeamSupportEcho() {
        this.guardianSupportAnnouncementTimer?.remove?.(false);
        this.guardianSupportAnnouncementTimer = null;
        this.guardianSupportPulseTween?.stop?.();
        this.guardianSupportPulseTween = null;
        this.guardianSupportEcho?.container?.destroy?.(true);
        this.guardianSupportEcho = null;
    }

    /**
     * Create fallback creature texture
     */
    createFallbackCreatureTexture() {
        if (this.textures.exists('platformerCreature')) return;

        const graphics = this.make.graphics({ add: false });

        // Simple creature shape
        graphics.fillStyle(0x9370DB, 1);
        graphics.fillEllipse(30, 35, 50, 60);

        // Eyes
        graphics.fillStyle(0xFFFFFF, 1);
        graphics.fillCircle(20, 25, 8);
        graphics.fillCircle(40, 25, 8);
        graphics.fillStyle(0x000000, 1);
        graphics.fillCircle(22, 25, 4);
        graphics.fillCircle(42, 25, 4);

        graphics.generateTexture('platformerCreature', 60, 70);
        graphics.destroy();
    }

    /**
     * Set up horizontal camera following with directional lead
     * MOBILE UX ENHANCEMENT: Camera leads ahead of player movement direction
     */
    setupCamera() {
        const camera = this.cameras.main;
        const screenHeight = camera.height;
        const screenWidth = camera.width;

        // Detect if mobile for camera adjustments
        this.isMobileDevice = this.detectMobile();

        // Calculate camera bounds
        const boundsHeight = this.levelHeight + 50;
        camera.setBounds(0, 0, this.levelWidth, boundsHeight);

        // Follow player with smooth easing
        // Slower horizontal lerp for smoother directional lead
        camera.startFollow(this.player, true, 0.08, 0.1);

        // Set deadzone for smooth scrolling
        // Smaller horizontal deadzone to allow directional lead to work
        camera.setDeadzone(screenWidth * 0.1, screenHeight * 0.35);

        // MOBILE UX: Calculate vertical offset for control safe zone
        // Controls are overlaid at bottom of screen
        // NEGATIVE camera offset = camera ABOVE player = shows more BELOW = player appears HIGHER on screen
        if (this.isMobileDevice) {
            // Get actual safe area for this device (iPhone notch, home indicator, etc.)
            const safeArea = this.getSafeAreaInsets();

            // Mobile control zone is a fixed 120px + bottom safe area
            // This ensures controls don't overlap with home indicator
            this.mobileControlZoneHeight = 120 + safeArea.bottom;

            // NEGATIVE offset pushes gameplay UP (player appears higher on screen)
            // This leaves room for controls at bottom without obscuring gameplay
            // Use 15% of screen height as offset (not 45% which was way too much)
            this.cameraBaseOffsetY = -screenHeight * 0.12;

            console.log(`[PlatformerLevel] Mobile camera: controlZone=${this.mobileControlZoneHeight}px, offsetY=${this.cameraBaseOffsetY}px, safeBottom=${safeArea.bottom}px`);
        } else {
            this.mobileControlZoneHeight = 0;
            this.cameraBaseOffsetY = screenHeight * 0.05; // Slight offset for desktop
        }

        // DIRECTIONAL LEAD: Offset camera based on player facing
        // This shows more of the level AHEAD of the player
        this.cameraLeadAmount = this.isMobileDevice ? screenWidth * 0.15 : screenWidth * 0.1;
        this.currentCameraLeadX = 0;
        this.targetCameraLeadX = 0;

        // Initial camera offset
        camera.setFollowOffset(0, this.cameraBaseOffsetY);

        // Fixed HUD and touch controls share this camera. Keep it at 1x so those
        // controls fill the phone width instead of shrinking into the middle.
        if (this.isMobileDevice) {
            camera.setZoom(1);
            console.log('[PlatformerLevel] Mobile zoom: 1 (full-width HUD and controls)');
        } else {
            camera.setZoom(1.0);
        }

        console.log(`[PlatformerLevel] Camera: bounds ${this.levelWidth}x${boundsHeight}, lead=${this.cameraLeadAmount}px, zoom=${camera.zoom}`);
    }

    /**
     * Update camera directional lead based on player movement
     * Called from update() loop
     */
    updateCameraLead() {
        if (!this.player || !this.cameras.main) return;

        const camera = this.cameras.main;

        // Determine target lead based on facing direction
        // Positive X offset = camera looks RIGHT = shows more of RIGHT side
        // Negative X offset = camera looks LEFT = shows more of LEFT side
        this.targetCameraLeadX = this.player.facingRight ? -this.cameraLeadAmount : this.cameraLeadAmount;

        // Smooth interpolation toward target lead (slower = smoother transition)
        const lerpFactor = 0.03;
        this.currentCameraLeadX += (this.targetCameraLeadX - this.currentCameraLeadX) * lerpFactor;

        // Apply combined offset
        camera.setFollowOffset(this.currentCameraLeadX, this.cameraBaseOffsetY);
    }

    /**
     * Set up input controls
     */
    setupInput() {
        // Arrow keys / WASD
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasdKeys = this.input.keyboard.addKeys('W,A,S,D');

        // Jump key (Space or W or Up)
        this.jumpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // Attack key (X) - melee attack
        this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
        this.attackKey.on('down', () => this.performAttack());

        // Special attack key (Z) - AoE attack
        this.specialKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
        this.specialKey.on('down', () => this.performSpecialAttack());

        // Ranged attack key (M) - projectile attack
        this.rangedKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
        this.rangedKey.on('down', () => this.performRangedAttack());

        // Read or influence a nearby Current node without consuming the jump
        // control. Touch players can tap the node directly.
        this.currentEcologyInteractKey = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.E
        );
        this.currentEcologyInteractKey.on('down', () => {
            if (this.currentEcologyPlayerNearby) {
                this.showCurrentEcologyModal();
            }
        });

        // ESC to pause/return
        this.input.keyboard.on('keydown-ESC', () => this.showPauseMenu());

        console.log('[PlatformerLevel] Input set up: Arrows/WASD, Space=Jump, X=Melee, Z=Special, M=Ranged, Down=Duck');

        // Set up mobile controls for touch devices
        this.setupPlatformerMobileControls();
    }

    /**
     * Detect if device is mobile/touch-capable
     */
    detectMobile() {
        if (this.forceMobileControls) {
            return true;
        }

        const hasOnTouchStart = 'ontouchstart' in window;
        const hasTouchPoints = navigator.maxTouchPoints > 0;
        const isTouchPrimary = window.matchMedia?.('(pointer: coarse)')?.matches;
        const isHoverNone = window.matchMedia?.('(hover: none)')?.matches;
        const userAgent = navigator.userAgent || '';
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(userAgent);

        return (hasOnTouchStart || hasTouchPoints) && (isTouchPrimary || isMobileUA || isHoverNone);
    }

    /**
     * Get safe area insets for devices with notches/home indicators
     */
    getSafeAreaInsets() {
        return getSafeAreaInsets();
    }

    /**
     * Set up platformer-specific mobile controls
     * MOBILE UX REDESIGN: Controls at VERY BOTTOM, gameplay appears ABOVE
     *
     * Layout (at very bottom of screen):
     *   [Joystick]          [Special] [Ranged]
     *                       [Jump]    [Melee]
     *
     * Key improvements:
     * - Controls positioned at VERY BOTTOM of screen (85%+ from top)
     * - Camera offset pushes gameplay UP so it appears ABOVE controls
     * - Smaller, semi-transparent controls
     * - Horizontal joystick-only (no vertical needed for platformer)
     * - Ground level and creatures appear ABOVE the control zone
     */
    setupPlatformerMobileControls() {
        this.isMobile = this.detectMobile();

        if (!this.isMobile) {
            console.log('[PlatformerLevel] Not mobile device, skipping mobile controls');
            return;
        }

        console.log('[PlatformerLevel] Setting up BOTTOM-POSITIONED mobile controls');
        this.clearMobileControlCoach();
        this.mobileControlTargets = {};

        const compactPreview = [
            this.centeringStancePreviewSize,
            this.currentEcologyPreviewSize,
            this.platformerPreviewSize
        ].includes('mobile');
        const width = compactPreview
            ? Math.min(390, this.scale.width)
            : this.scale.width;
        const height = compactPreview
            ? Math.min(720, this.scale.height)
            : this.scale.height;
        const safeArea = this.getSafeAreaInsets();
        const layout = getMobileControlLayout({ width, height, safeArea });
        const bottomSafeMargin = safeArea.bottom;
        const controlZoneHeight = layout.dockHeight;
        const controlZoneTop = layout.dockTop;

        console.log(`[PlatformerLevel] Mobile controls: height=${height}, safeBottom=${safeArea.bottom}, controlZoneTop=${controlZoneTop}`);

        // Responsive button sizes - LARGER for better thumb reach
        const jumpButtonSize = layout.primarySize;
        const meleeButtonSize = layout.primarySize;
        const secondarySize = layout.secondarySize;
        const marginLeft = safeArea.left + layout.edge;

        // Control opacity - semi-transparent to not fully obscure gameplay
        const controlOpacity = 0.85;
        const containerOpacity = 0.45;

        // ============ JOYSTICK (left side, centered in control zone) ============
        // LARGER: 140px diameter for comfortable thumb control
        const joystickBaseRadius = layout.joystick.radius;
        const joystickThumbRadius = layout.joystick.thumbRadius;
        const joystickX = layout.joystick.x;
        const joystickY = layout.joystick.y;

        // Joystick base - semi-transparent for better gameplay visibility
        const joystickBase = this.add.graphics();
        joystickBase.setScrollFactor(0);
        joystickBase.setDepth(10000);
        joystickBase.fillStyle(0x000000, containerOpacity);
        joystickBase.fillCircle(joystickX, joystickY, joystickBaseRadius);
        joystickBase.lineStyle(2, 0xFFFFFF, 0.4);
        joystickBase.strokeCircle(joystickX, joystickY, joystickBaseRadius);
        // Add directional indicators (left/right arrows)
        joystickBase.fillStyle(0xFFFFFF, 0.3);
        joystickBase.fillTriangle(
            joystickX - joystickBaseRadius + 10, joystickY,
            joystickX - joystickBaseRadius + 22, joystickY - 8,
            joystickX - joystickBaseRadius + 22, joystickY + 8
        );
        joystickBase.fillTriangle(
            joystickX + joystickBaseRadius - 10, joystickY,
            joystickX + joystickBaseRadius - 22, joystickY - 8,
            joystickX + joystickBaseRadius - 22, joystickY + 8
        );
        this.mobileControlElements.push(joystickBase);

        // Joystick thumb - more visible for feedback
        const joystickThumb = this.add.graphics();
        joystickThumb.setScrollFactor(0);
        joystickThumb.setDepth(10001);
        joystickThumb.fillStyle(0xFFFFFF, controlOpacity);
        joystickThumb.fillCircle(joystickX, joystickY, joystickThumbRadius);
        joystickThumb.lineStyle(2, 0x00CED1, 0.8);
        joystickThumb.strokeCircle(joystickX, joystickY, joystickThumbRadius);
        this.mobileControlElements.push(joystickThumb);

        // Store joystick state
        this.joystickCenterX = joystickX;
        this.joystickCenterY = joystickY;
        this.joystickMaxDistance = joystickBaseRadius - 5; // Max distance based on base size
        this.joystickActive = false;
        this.joystickPointerId = null;
        this.joystickThumb = joystickThumb;
        this.joystickThumbRadius = joystickThumbRadius;

        // Joystick touch zone - IMPROVED: larger zone that extends higher for easier reach
        const joystickZoneWidth = layout.joystick.zoneWidth;
        const joystickZoneHeight = layout.joystick.zoneHeight;
        const joystickZone = this.add.zone(joystickZoneWidth / 2, joystickY, joystickZoneWidth, joystickZoneHeight)
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(10002)
            .setInteractive({ draggable: true });
        this.mobileControlElements.push(joystickZone);

        // Store joystick base reference for floating joystick feature
        this.joystickBase = joystickBase;
        this.joystickBaseRadius = joystickBaseRadius;
        this.originalJoystickX = joystickX;
        this.originalJoystickY = joystickY;
        this.mobileControlTargets.joystick = {
            x: joystickX,
            y: joystickY,
            radius: joystickBaseRadius
        };

        joystickZone.on('pointerdown', (pointer) => {
            this.joystickActive = true;
            this.joystickPointerId = pointer.id;

            // FLOATING JOYSTICK: Move joystick to where finger touches (within bounds)
            const touchX = Math.max(marginLeft + joystickBaseRadius, Math.min(pointer.x, joystickZoneWidth - joystickBaseRadius));
            const touchY = Math.max(controlZoneTop + joystickBaseRadius, Math.min(pointer.y, height - bottomSafeMargin - joystickBaseRadius));

            // Only move if touch is reasonably close to joystick area
            const distFromOriginal = Math.sqrt(Math.pow(pointer.x - joystickX, 2) + Math.pow(pointer.y - joystickY, 2));
            if (distFromOriginal > joystickBaseRadius * 1.5) {
                // Move joystick center to touch position
                this.joystickCenterX = touchX;
                this.joystickCenterY = touchY;

                // Redraw joystick base at new position
                this.joystickBase.clear();
                this.joystickBase.fillStyle(0x000000, containerOpacity);
                this.joystickBase.fillCircle(touchX, touchY, joystickBaseRadius);
                this.joystickBase.lineStyle(3, 0x00CED1, 0.7); // Brighter border when active
                this.joystickBase.strokeCircle(touchX, touchY, joystickBaseRadius);
                // Redraw directional arrows
                this.joystickBase.fillStyle(0xFFFFFF, 0.4);
                this.joystickBase.fillTriangle(
                    touchX - joystickBaseRadius + 12, touchY,
                    touchX - joystickBaseRadius + 26, touchY - 10,
                    touchX - joystickBaseRadius + 26, touchY + 10
                );
                this.joystickBase.fillTriangle(
                    touchX + joystickBaseRadius - 12, touchY,
                    touchX + joystickBaseRadius - 26, touchY - 10,
                    touchX + joystickBaseRadius - 26, touchY + 10
                );
            }
        });

        joystickZone.on('pointermove', (pointer) => {
            if (!this.joystickActive) return;
            this.updateJoystick(pointer);
        });

        joystickZone.on('pointerup', (pointer) => {
            if (pointer.id === this.joystickPointerId) {
                this.resetJoystick();
            }
        });

        // Scene-level pointer tracking for joystick
        this.input.on('pointermove', (pointer) => {
            if (this.joystickActive && pointer.id === this.joystickPointerId) {
                this.updateJoystick(pointer);
            }
        });

        this.input.on('pointerup', (pointer) => {
            // CRITICAL: Don't reset joystick if this pointer is on an action button
            // This prevents joystick from resetting when pressing jump while moving
            if (this.actionButtonPointers.has(pointer.id)) {
                return;
            }
            if (this.joystickActive && pointer.id === this.joystickPointerId) {
                this.resetJoystick();
            }
        });

        // Native touch end handler for reliability - only reset if no active touches remain on joystick
        this.game.canvas.addEventListener('touchend', (event) => {
            // Only reset if there are no remaining touches OR if the joystick pointer specifically ended
            if (this.joystickActive && event.touches.length === 0) {
                // All touches ended - reset joystick
                this.resetJoystick();
            }
        }, { passive: true });

        const {
            leftX,
            rightX,
            topY,
            bottomY
        } = layout.actions;
        const jumpRadius = jumpButtonSize / 2;
        const jumpX = leftX;
        const jumpY = bottomY;
        const meleeX = rightX;
        const meleeY = bottomY;
        const rangedX = rightX;
        const rangedY = topY;
        const specialX = leftX;
        const specialY = topY;

        // Button configs for platformer - ergonomic arc layout
        const buttons = [
            {
                id: 'special',
                label: '💥',
                x: specialX,
                y: specialY,
                size: secondarySize,
                color: 0x9B59B6, // Purple - special (costs 3 energy)
                action: () => this.performSpecialAttack(),
                energyCost: 3,
                opacity: controlOpacity
            },
            {
                id: 'ranged',
                label: '🔫',
                x: rangedX,
                y: rangedY,
                size: secondarySize,
                color: 0x00CED1, // Cyan - unlimited basic ranged attack
                action: () => this.performRangedAttack(),
                energyCost: 0,
                opacity: controlOpacity
            },
            {
                id: 'melee',
                label: '⚔️',
                x: meleeX,
                y: meleeY,
                size: meleeButtonSize,
                color: 0xE74C3C, // Red - astronaut katana strike
                action: () => this.performAttack(),
                energyCost: 0,
                opacity: controlOpacity
            },
            {
                id: 'jump',
                label: '', // Will be drawn as arrow icon
                x: jumpX,
                y: jumpY,
                size: jumpButtonSize,
                color: 0x27AE60, // Green - jump (free)
                action: () => { this.virtualJumpPressed = true; },
                onRelease: () => { this.virtualJumpPressed = false; },
                energyCost: 0,
                opacity: controlOpacity,
                isJumpButton: true // Flag for special rendering
            }
        ];

        // The near-opaque dock creates a stable boundary below the playable view.
        const controlBg = this.add.graphics();
        controlBg.setScrollFactor(0);
        controlBg.setDepth(9998);
        controlBg.fillStyle(0x080A17, 0.9);
        controlBg.fillRect(0, controlZoneTop, width, controlZoneHeight + bottomSafeMargin);
        // Subtle top border
        controlBg.lineStyle(1, 0xFFFFFF, 0.15);
        controlBg.lineBetween(0, controlZoneTop, width, controlZoneTop);
        this.mobileControlElements.push(controlBg);

        // Create each button
        buttons.forEach(config => {
            this.mobileControlTargets[config.id] =
                this.createPlatformerButton(config);
        });

        // ============ MENU BUTTON (top-left) ============
        this.createMenuButton(layout.menu.x, layout.menu.y);

        console.log('[PlatformerLevel] Mobile controls created: Joystick + 4 action buttons + menu');

        // CRITICAL: Hide controls initially - they'll be shown when intro screen is dismissed
        // This prevents controls from being visible during level entry screens
        this.hidePlatformerMobileControls();
    }

    /**
     * Hide platformer mobile controls (during intro screens)
     */
    hidePlatformerMobileControls() {
        if (!this.mobileControlElements || this.mobileControlElements.length === 0) return;

        this.mobileControlElements.forEach(element => {
            if (element && typeof element.setAlpha === 'function') {
                element.setAlpha(0);
            } else if (element && element.visible !== undefined) {
                element.visible = false;
            }
            if (element?.input) {
                element.input.enabled = false;
            }
        });

        this.platformerControlsVisible = false;
        console.log('[PlatformerLevel] Mobile controls hidden (for intro screen)');
    }

    /**
     * Show platformer mobile controls (after intro screen is dismissed)
     * Call this from subclass when level entry is dismissed
     */
    showPlatformerMobileControls() {
        if (!this.isMobile || !this.mobileControlElements || this.mobileControlElements.length === 0) return;

        this.mobileControlElements.forEach(element => {
            if (element && typeof element.setAlpha === 'function') {
                element.setAlpha(1);
            } else if (element && element.visible !== undefined) {
                element.visible = true;
            }
            if (element?.input) {
                element.input.enabled = true;
            }
        });

        this.platformerControlsVisible = true;
        console.log('[PlatformerLevel] Mobile controls shown (intro dismissed)');
    }

    showMobileControlCoach(controlId) {
        this.clearMobileControlCoach();
        if (!this.isMobile) return false;

        const target = this.mobileControlTargets?.[controlId];
        if (!target) return false;

        const ring = this.add.graphics()
            .setPosition(target.x, target.y)
            .setScrollFactor(0)
            .setDepth(10003);
        ring.lineStyle(4, 0xF3D77B, 0.98);
        ring.strokeCircle(0, 0, target.radius + 9);
        ring.lineStyle(8, 0xF3D77B, 0.18);
        ring.strokeCircle(0, 0, target.radius + 14);

        this.mobileControlCoach = ring;
        this.mobileControlElements.push(ring);
        this.mobileControlCoachTween = this.tweens.add({
            targets: ring,
            alpha: { from: 1, to: 0.42 },
            scaleX: { from: 0.94, to: 1.08 },
            scaleY: { from: 0.94, to: 1.08 },
            duration: 620,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        return true;
    }

    clearMobileControlCoach() {
        this.mobileControlCoachTween?.remove?.();
        this.mobileControlCoachTween = null;
        if (this.mobileControlCoach) {
            const coach = this.mobileControlCoach;
            this.mobileControlElements = this.mobileControlElements.filter(
                element => element !== coach
            );
            coach.destroy?.();
            this.mobileControlCoach = null;
        }
    }

    /**
     * Create the menu/pause button for mobile
     */
    createMenuButton(x, y) {
        const size = 50;

        // Button background
        const bg = this.add.graphics();
        bg.setScrollFactor(0);
        bg.setDepth(10000);
        bg.fillStyle(0x0D0D1A, 0.7);
        bg.fillCircle(x, y, size / 2);
        bg.lineStyle(2, 0xFFFFFF, 0.4);
        bg.strokeCircle(x, y, size / 2);
        this.mobileControlElements.push(bg);

        // Hamburger icon (three lines)
        const icon = this.add.text(x, y, '☰', {
            fontSize: '28px',
            color: '#FFFFFF'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(10001);
        this.mobileControlElements.push(icon);

        // Interactive zone
        const zone = this.add.zone(x, y, size + 20, size + 20)
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(10002)
            .setInteractive({ useHandCursor: false });
        this.mobileControlElements.push(zone);

        zone.on('pointerdown', (pointer) => {
            // Track this pointer as an action button pointer (prevents joystick reset)
            this.actionButtonPointers.add(pointer.id);

            bg.clear();
            bg.fillStyle(0x4B0082, 0.8);
            bg.fillCircle(x, y, size / 2);
            bg.lineStyle(2, 0xE066FF, 0.8);
            bg.strokeCircle(x, y, size / 2);

            if (window.AudioManager) {
                window.AudioManager.playButtonClick();
            }

            this.showPauseMenu();
        });

        zone.on('pointerup', (pointer) => {
            // Remove this pointer from action button tracking
            this.actionButtonPointers.delete(pointer.id);

            bg.clear();
            bg.fillStyle(0x0D0D1A, 0.7);
            bg.fillCircle(x, y, size / 2);
            bg.lineStyle(2, 0xFFFFFF, 0.4);
            bg.strokeCircle(x, y, size / 2);
        });
    }

    /**
     * Create a platformer action button
     */
    createPlatformerButton(config) {
        const { id, label, x, y, size, color, action, onRelease, energyCost = 0, isJumpButton = false } = config;
        const radius = size / 2;

        // Energy ring (for buttons that cost energy)
        let energyRing = null;
        if (energyCost > 0) {
            energyRing = this.add.graphics();
            energyRing.setScrollFactor(0);
            energyRing.setDepth(9999); // Below button
            this.mobileControlElements.push(energyRing);

            // Store reference for updating
            if (!this.energyRingButtons) this.energyRingButtons = {};
            this.energyRingButtons[id] = { ring: energyRing, x, y, radius: radius + 6, cost: energyCost };

            // Initial draw
            this.drawEnergyRing(energyRing, x, y, radius + 6, energyCost);
        }

        // Button background
        const bg = this.add.graphics();
        bg.setScrollFactor(0);
        bg.setDepth(10000);

        // Jump button has special rendering with glow ring
        if (isJumpButton) {
            this.drawJumpButton(bg, x, y, radius, color, false);
        } else {
            this.drawPlatformerButton(bg, x, y, radius, color, false);
        }
        this.mobileControlElements.push(bg);

        // Button icon - jump button uses drawn arrow, others use emoji
        let icon = null;
        let arrowGraphics = null;

        if (isJumpButton) {
            // Draw arrow icon for jump button
            arrowGraphics = this.add.graphics();
            arrowGraphics.setScrollFactor(0);
            arrowGraphics.setDepth(10001);
            this.drawJumpArrow(arrowGraphics, x, y, radius);
            this.mobileControlElements.push(arrowGraphics);

            // "JUMP" label is part of the button itself, not separate
        } else {
            // Standard emoji icon for other buttons
            icon = this.add.text(x, y, label, {
                fontSize: `${size * 0.5}px`,
                color: '#FFFFFF',
                fontStyle: 'bold'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(10001);
            this.mobileControlElements.push(icon);
        }

        // Interactive zone - larger for jump button
        const zoneSize = isJumpButton ? size + 20 : size + 10;
        const zone = this.add.zone(x, y, zoneSize, zoneSize)
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(10002)
            .setInteractive({ useHandCursor: false });
        this.mobileControlElements.push(zone);

        zone.on('pointerdown', (pointer) => {
            // Track this pointer as an action button pointer (prevents joystick reset)
            this.actionButtonPointers.add(pointer.id);

            // Draw pressed state
            if (isJumpButton) {
                this.drawJumpButton(bg, x, y, radius, color, true);
                this.drawJumpArrow(arrowGraphics, x, y, radius, true);
            } else {
                this.drawPlatformerButton(bg, x, y, radius, color, true);
                if (icon) {
                    this.tweens.add({
                        targets: icon,
                        scaleX: 0.85,
                        scaleY: 0.85,
                        duration: 60
                    });
                }
            }

            if (window.AudioManager) {
                window.AudioManager.playButtonClick();
            }

            action();
        });

        zone.on('pointerup', (pointer) => {
            // Remove this pointer from action button tracking
            this.actionButtonPointers.delete(pointer.id);

            // Draw unpressed state
            if (isJumpButton) {
                this.drawJumpButton(bg, x, y, radius, color, false);
                this.drawJumpArrow(arrowGraphics, x, y, radius, false);
            } else {
                this.drawPlatformerButton(bg, x, y, radius, color, false);
                if (icon) {
                    this.tweens.add({
                        targets: icon,
                        scaleX: 1,
                        scaleY: 1,
                        duration: 100,
                        ease: 'Back.easeOut'
                    });
                }
            }

            if (onRelease) {
                onRelease();
            }
        });

        zone.on('pointerout', (pointer) => {
            // Remove this pointer from action button tracking
            this.actionButtonPointers.delete(pointer.id);

            // Draw unpressed state
            if (isJumpButton) {
                this.drawJumpButton(bg, x, y, radius, color, false);
                this.drawJumpArrow(arrowGraphics, x, y, radius, false);
            } else {
                this.drawPlatformerButton(bg, x, y, radius, color, false);
                if (icon) {
                    icon.setScale(1);
                }
            }

            if (onRelease) {
                onRelease();
            }
        });

        return { id, x, y, radius, bg, icon, arrowGraphics, zone };
    }

    /**
     * Draw a platformer button with glass effect
     */
    drawPlatformerButton(graphics, x, y, radius, color, pressed) {
        graphics.clear();

        // Outer shadow
        graphics.fillStyle(0x000000, pressed ? 0.3 : 0.4);
        graphics.fillCircle(x + 2, y + 2, radius);

        // Main button
        graphics.fillStyle(color, pressed ? 0.9 : 0.7);
        graphics.fillCircle(x, y, radius);

        // Inner highlight
        graphics.fillStyle(0xFFFFFF, pressed ? 0.1 : 0.2);
        graphics.fillCircle(x, y - radius * 0.2, radius * 0.7);

        // Border
        graphics.lineStyle(2, 0xFFFFFF, pressed ? 0.3 : 0.5);
        graphics.strokeCircle(x, y, radius);
    }

    /**
     * Draw the jump button with special glow ring and larger visual presence
     */
    drawJumpButton(graphics, x, y, radius, color, pressed) {
        graphics.clear();

        // Outer glow ring (distinctive for jump)
        graphics.lineStyle(pressed ? 3 : 4, 0x2ECC71, pressed ? 0.5 : 0.7);
        graphics.strokeCircle(x, y, radius + 4);

        // Outer shadow
        graphics.fillStyle(0x000000, pressed ? 0.3 : 0.4);
        graphics.fillCircle(x + 2, y + 3, radius);

        // Main button - larger and more prominent
        graphics.fillStyle(color, pressed ? 0.95 : 0.85);
        graphics.fillCircle(x, y, radius);

        // Inner gradient highlight (top)
        graphics.fillStyle(0xFFFFFF, pressed ? 0.1 : 0.25);
        graphics.fillCircle(x, y - radius * 0.25, radius * 0.65);

        // Border with glow
        graphics.lineStyle(3, 0xFFFFFF, pressed ? 0.4 : 0.6);
        graphics.strokeCircle(x, y, radius);

        // "JUMP" label at bottom of button
        // Note: This is drawn as part of the graphics, not as text
        // The actual text will be shown in the arrow graphics
    }

    /**
     * Draw the jump arrow icon (drawn graphics, not emoji)
     */
    drawJumpArrow(graphics, x, y, radius, pressed = false) {
        graphics.clear();

        // Arrow shaft
        const arrowHeight = radius * 0.6;
        const arrowWidth = radius * 0.15;
        const arrowheadWidth = radius * 0.4;
        const arrowheadHeight = radius * 0.3;

        const color = pressed ? 0xE0E0E0 : 0xFFFFFF;
        const alpha = pressed ? 0.8 : 1;

        // Draw arrow pointing up
        graphics.fillStyle(color, alpha);

        // Arrow shaft (vertical rectangle)
        graphics.fillRect(
            x - arrowWidth / 2,
            y - arrowHeight / 2 + arrowheadHeight / 2,
            arrowWidth,
            arrowHeight - arrowheadHeight / 2
        );

        // Arrowhead (triangle pointing up)
        graphics.fillTriangle(
            x, y - arrowHeight / 2 - arrowheadHeight / 3,  // Top point
            x - arrowheadWidth / 2, y - arrowHeight / 2 + arrowheadHeight / 2,  // Bottom left
            x + arrowheadWidth / 2, y - arrowHeight / 2 + arrowheadHeight / 2   // Bottom right
        );

        // Add "JUMP" text below arrow
        // Note: We can't draw text with graphics, so we'll just make the arrow prominent
        // The arrow itself clearly indicates "jump"
    }

    /**
     * Draw energy ring around a button
     * Shows how much energy is available vs required
     */
    drawEnergyRing(graphics, x, y, radius, energyCost) {
        graphics.clear();

        const hasEnough = this.crystalEnergy >= energyCost;
        const energyPercent = Math.min(this.crystalEnergy / energyCost, 1);

        // Background ring (dark, shows what's missing)
        graphics.lineStyle(4, 0x2D2D4D, 0.6);
        graphics.beginPath();
        graphics.arc(x, y, radius, 0, Math.PI * 2);
        graphics.strokePath();

        if (hasEnough) {
            // Full ring when ready (bright cyan glow)
            graphics.lineStyle(4, 0x00FFFF, 0.9);
            graphics.beginPath();
            graphics.arc(x, y, radius, -Math.PI / 2, Math.PI * 1.5);
            graphics.strokePath();

            // Pulsing glow effect
            graphics.lineStyle(8, 0x00FFFF, 0.2);
            graphics.beginPath();
            graphics.arc(x, y, radius, -Math.PI / 2, Math.PI * 1.5);
            graphics.strokePath();
        } else {
            // Partial ring showing energy progress (yellow/orange)
            const angle = -Math.PI / 2 + (Math.PI * 2 * energyPercent);
            graphics.lineStyle(4, 0xFFAA00, 0.8);
            graphics.beginPath();
            graphics.arc(x, y, radius, -Math.PI / 2, angle);
            graphics.strokePath();

            // Small indicator for required energy
            const costText = this.add.text(x + radius - 2, y - radius + 2, `${energyCost}⚡`, {
                fontSize: '10px',
                color: hasEnough ? '#00FFFF' : '#FF6B6B',
                fontStyle: 'bold'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(10003);
            this.mobileControlElements.push(costText);

            // Store for cleanup on redraw
            if (!this.energyCostLabels) this.energyCostLabels = {};
            if (this.energyCostLabels[`${x}_${y}`]) {
                this.energyCostLabels[`${x}_${y}`].destroy();
            }
            this.energyCostLabels[`${x}_${y}`] = costText;
        }
    }

    /**
     * Update all energy ring indicators
     */
    updateEnergyRings() {
        if (!this.energyRingButtons) return;

        Object.values(this.energyRingButtons).forEach(btn => {
            this.drawEnergyRing(btn.ring, btn.x, btn.y, btn.radius, btn.cost);
        });
    }

    /**
     * Update joystick thumb position and calculate input
     * IMPROVED: Larger dead zone, horizontal lock for platformers, better visual feedback
     */
    updateJoystick(pointer) {
        const offsetX = pointer.x - this.joystickCenterX;
        const offsetY = pointer.y - this.joystickCenterY;
        const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
        let angle = Math.atan2(offsetY, offsetX);

        // HORIZONTAL LOCK: For platformers, strongly favor horizontal movement
        // If moving mostly horizontal (within 35 degrees of horizontal), snap to pure horizontal
        const angleDeg = Math.abs(angle * 180 / Math.PI);
        const isNearHorizontal = angleDeg < 35 || angleDeg > 145;
        if (isNearHorizontal && distance > this.joystickMaxDistance * 0.2) {
            // Snap to pure horizontal (left or right)
            angle = offsetX >= 0 ? 0 : Math.PI;
        }

        const clampedDistance = Math.min(distance, this.joystickMaxDistance);
        const thumbX = this.joystickCenterX + Math.cos(angle) * clampedDistance;
        // For horizontal lock, keep thumb on horizontal axis
        const thumbY = isNearHorizontal && distance > this.joystickMaxDistance * 0.2
            ? this.joystickCenterY
            : this.joystickCenterY + Math.sin(angle) * clampedDistance;

        // Update thumb visual with active state
        this.joystickThumb.clear();
        // Brighter when actively moving
        const isMoving = distance > this.joystickMaxDistance * 0.25;
        this.joystickThumb.fillStyle(isMoving ? 0x00CED1 : 0xFFFFFF, 0.9);
        this.joystickThumb.fillCircle(thumbX, thumbY, this.joystickThumbRadius);
        this.joystickThumb.lineStyle(3, isMoving ? 0xFFFFFF : 0x00CED1, 1);
        this.joystickThumb.strokeCircle(thumbX, thumbY, this.joystickThumbRadius);

        // Add direction arrow when moving
        if (isMoving) {
            const arrowDir = offsetX >= 0 ? 1 : -1;
            this.joystickThumb.fillStyle(0xFFFFFF, 0.8);
            this.joystickThumb.fillTriangle(
                thumbX + arrowDir * 8, thumbY,
                thumbX - arrowDir * 4, thumbY - 6,
                thumbX - arrowDir * 4, thumbY + 6
            );
        }

        // Calculate normalized X input (-1 to 1) with LARGER dead zone (25%)
        const deadZone = this.joystickMaxDistance * 0.25; // Was 0.15, now 0.25
        if (distance > deadZone) {
            const effectiveDistance = clampedDistance - deadZone;
            const effectiveMax = this.joystickMaxDistance - deadZone;
            const magnitude = Math.min(1, effectiveDistance / effectiveMax);

            // For horizontal lock, use full magnitude
            if (isNearHorizontal) {
                this.virtualJoystickX = offsetX >= 0 ? magnitude : -magnitude;
            } else {
                this.virtualJoystickX = Math.cos(angle) * magnitude;
            }
        } else {
            this.virtualJoystickX = 0;
        }
    }

    /**
     * Reset joystick to center and original position (for floating joystick)
     */
    resetJoystick() {
        this.joystickActive = false;
        this.joystickPointerId = null;
        this.virtualJoystickX = 0;

        // Reset joystick to original position (floating joystick returns home)
        if (this.originalJoystickX && this.originalJoystickY) {
            this.joystickCenterX = this.originalJoystickX;
            this.joystickCenterY = this.originalJoystickY;

            // Redraw base at original position with inactive styling
            if (this.joystickBase && this.joystickBaseRadius) {
                this.joystickBase.clear();
                this.joystickBase.fillStyle(0x000000, 0.4); // More transparent when inactive
                this.joystickBase.fillCircle(this.joystickCenterX, this.joystickCenterY, this.joystickBaseRadius);
                this.joystickBase.lineStyle(2, 0xFFFFFF, 0.4);
                this.joystickBase.strokeCircle(this.joystickCenterX, this.joystickCenterY, this.joystickBaseRadius);
                // Directional arrows
                this.joystickBase.fillStyle(0xFFFFFF, 0.3);
                this.joystickBase.fillTriangle(
                    this.joystickCenterX - this.joystickBaseRadius + 12, this.joystickCenterY,
                    this.joystickCenterX - this.joystickBaseRadius + 26, this.joystickCenterY - 10,
                    this.joystickCenterX - this.joystickBaseRadius + 26, this.joystickCenterY + 10
                );
                this.joystickBase.fillTriangle(
                    this.joystickCenterX + this.joystickBaseRadius - 12, this.joystickCenterY,
                    this.joystickCenterX + this.joystickBaseRadius - 26, this.joystickCenterY - 10,
                    this.joystickCenterX + this.joystickBaseRadius - 26, this.joystickCenterY + 10
                );
            }
        }

        // Reset thumb to center with inactive styling
        if (this.joystickThumb) {
            this.joystickThumb.clear();
            this.joystickThumb.fillStyle(0xFFFFFF, 0.7);
            this.joystickThumb.fillCircle(this.joystickCenterX, this.joystickCenterY, this.joystickThumbRadius);
            this.joystickThumb.lineStyle(2, 0x00CED1, 0.8);
            this.joystickThumb.strokeCircle(this.joystickCenterX, this.joystickCenterY, this.joystickThumbRadius);
        }
    }

    /**
     * Set up collision handlers
     */
    setupCollisions() {
        if (this.player && this.platforms) {
            this.physics.add.collider(this.player, this.platforms, this.onPlatformCollision, null, this);
        }

        // Enemies collision (to be set up in subclass)
        if (this.enemies) {
            this.physics.add.collider(this.player, this.enemies, this.onEnemyCollision, null, this);
            this.physics.add.collider(this.enemies, this.platforms);
        }
    }

    /**
     * Handle platform collision
     */
    onPlatformCollision(player, platform) {
        // Check if landing on top of platform
        if (player.body.touching.down) {
            this.isGrounded = true;
        }
    }

    /**
     * Handle enemy collision (override in subclass)
     */
    onEnemyCollision(player, enemy) {
        // Skip if enemy is already defeated
        if (!enemy.active) return;

        // Get collision info
        const playerCenterY = player.body.center.y;
        const playerBottom = player.body.bottom;
        const playerVelocityY = player.body.velocity.y;
        const enemyCenterY = enemy.body.center.y;
        const enemyTop = enemy.body.top;

        // Mario-style stomp detection - GENEROUS for better game feel:
        // 1. Player must be falling (positive Y velocity) OR just landed (velocity near 0 but was falling)
        // 2. Player's CENTER must be above enemy's CENTER (player approaching from above)
        // 3. Player's BOTTOM must be in upper portion of enemy (feet hitting head)
        const isFalling = playerVelocityY > -50; // Allow small upward velocity (just bounced)
        const isAboveEnemy = playerCenterY < enemyCenterY; // Player center is higher (lower Y)
        const feetNearTop = playerBottom <= enemyTop + (enemy.body.height * 0.6); // Generous 60%

        const isStomping = isFalling && isAboveEnemy && feetNearTop;

        if (isStomping) {
            console.log('[PlatformerLevel] Enemy stomped! Player Y:', playerCenterY, 'Enemy Y:', enemyCenterY);
            this.defeatEnemy(enemy);
            player.setVelocityY(this.jumpVelocity * 0.6); // Bounce up

            // Satisfying stomp sound
            if (window.AudioManager) {
                window.AudioManager.playEnemyHit();
            }
        } else {
            // Player touched enemy from side/below - take damage
            console.log('[PlatformerLevel] Enemy collision - damage! Player Y:', playerCenterY, 'Enemy Y:', enemyCenterY);
            this.takeDamage(1);
        }
    }

    /**
     * Create HUD - override in subclass for themed HUD
     */
    createHUD() {
        const mobileLayout = this.detectMobile()
            ? getMobileControlLayout({
                width: this.scale.width,
                height: this.scale.height,
                safeArea: this.getSafeAreaInsets()
            })
            : null;
        const hudX = mobileLayout ? mobileLayout.menu.x + 42 : 20;
        const hudY = mobileLayout ? Math.max(12, mobileLayout.safeArea.top + 8) : 20;

        // Health display (hearts)
        this.healthDisplay = this.add.container(hudX, hudY);
        this.healthDisplay.setScrollFactor(0);
        this.healthDisplay.setDepth(1000);
        this.updateHealthDisplay();

        // Crystal energy display
        this.energyDisplay = this.add.container(hudX, hudY + 38);
        this.energyDisplay.setScrollFactor(0);
        this.energyDisplay.setDepth(1000);
        this.updateEnergyDisplay();

        this.katanaUpgradeDisplay = this.add.container(hudX, hudY + 76);
        this.katanaUpgradeDisplay.setScrollFactor(0);
        this.katanaUpgradeDisplay.setDepth(1000);
        this.layoutKatanaUpgradeDisplay();
        this.scale?.on?.('resize', this.layoutKatanaUpgradeDisplay, this);
        this.updateKatanaUpgradeDisplay();
    }

    layoutKatanaUpgradeDisplay(gameSize = this.scale?.gameSize) {
        if (!this.katanaUpgradeDisplay) {
            return;
        }

        const screenWidth = gameSize?.width || this.cameras?.main?.width || 800;
        if (screenWidth <= 480) {
            const layout = getMobileControlLayout({
                width: screenWidth,
                height: gameSize?.height || this.scale?.height || 800,
                safeArea: this.getSafeAreaInsets()
            });
            this.katanaUpgradeDisplay.setPosition(
                layout.menu.x + 42,
                Math.max(88, layout.safeArea.top + 84)
            );
            return;
        }
        this.katanaUpgradeDisplay.setPosition(20, 100);
    }

    updateKatanaUpgradeDisplay() {
        if (!this.katanaUpgradeDisplay) {
            return;
        }

        this.katanaUpgradeDisplay.removeAll(true);
        const upgrades = this.katanaCombatProfile?.upgradeIds || [];
        let row = 0;

        if (this.katanaEquipped && upgrades.length === 0) {
            const blade = this.add.graphics();
            blade.lineStyle(3, 0xDCE8ED, 1);
            blade.lineBetween(2, 15, 18, 2);
            blade.lineStyle(2, 0xF2C14E, 1);
            blade.lineBetween(1, 10, 9, 18);
            const label = this.add.text(26, 2, 'FIELD KATANA  //  MELEE', {
                fontSize: '11px',
                color: '#DCE8ED',
                fontStyle: 'bold'
            });
            this.katanaUpgradeDisplay.add([blade, label]);
            row += 1;
        }

        if (upgrades.includes('crystal_edge')) {
            const edge = this.add.graphics();
            edge.lineStyle(3, 0x8FE3CF, 1);
            edge.lineBetween(2, 14, 18, 2);
            edge.lineStyle(2, 0xF2C14E, 1);
            edge.lineBetween(0, 11, 8, 19);
            const label = this.add.text(26, 2, 'RESONANT EDGE  +1', {
                fontSize: '11px',
                color: '#8FE3CF',
                fontStyle: 'bold'
            });
            edge.setPosition(0, row * 22);
            label.setPosition(26, row * 22 + 2);
            this.katanaUpgradeDisplay.add([edge, label]);
            row += 1;
        }

        if (upgrades.includes('aurora_guard')) {
            const guard = this.add.graphics();
            guard.lineStyle(2, 0xD9B8FF, 1);
            guard.strokeCircle(10, 10, 8);
            guard.fillStyle(
                this.auroraGuardCharges > 0 ? 0xF2C14E : 0x4A4564,
                1
            );
            guard.fillCircle(10, 10, 4);
            const label = this.add.text(
                26,
                2,
                `AURORA GUARD  ${this.auroraGuardCharges}`,
                {
                    fontSize: '11px',
                    color: this.auroraGuardCharges > 0 ? '#D9B8FF' : '#77738C',
                    fontStyle: 'bold'
                }
            );
            guard.setPosition(0, row * 22);
            label.setPosition(26, row * 22 + 2);
            this.katanaUpgradeDisplay.add([guard, label]);
            row += 1;
        }

        if (this.communityGuardCharges > 0 || this.fendCommunitySupport?.guardCharges > 0) {
            const relay = this.add.graphics();
            relay.lineStyle(2, 0xF4F4F4, 0.9);
            relay.lineBetween(10, 3, 10, 18);
            relay.lineStyle(2, 0x71E6B1, 1);
            relay.strokeCircle(10, 5, 6);
            relay.fillStyle(
                this.communityGuardCharges > 0 ? 0xD94B4B : 0x4A5652,
                1
            );
            relay.fillCircle(10, 5, 3);
            const label = this.add.text(
                26,
                2,
                `FEND RELAY  ${this.communityGuardCharges}`,
                {
                    fontSize: '11px',
                    color: this.communityGuardCharges > 0 ? '#8FE3CF' : '#777F7C',
                    fontStyle: 'bold'
                }
            );
            relay.setPosition(0, row * 22);
            label.setPosition(26, row * 22 + 2);
            this.katanaUpgradeDisplay.add([relay, label]);
            row += 1;
        }

        if (this.guardianTeamSupport?.guardianId) {
            const ally = this.add.graphics();
            ally.lineStyle(2, 0xF2C14E, 1);
            ally.strokeCircle(10, 10, 8);
            ally.fillStyle(0x8FE3CF, 1);
            ally.fillCircle(10, 10, 3);
            const chargeSuffix = this.guardianGuardCharges > 0
                ? `  ${this.guardianGuardCharges}`
                : '';
            const label = this.add.text(
                26,
                2,
                `ALLY ${this.guardianTeamSupport.guardianName.toUpperCase()} // ` +
                    `${this.guardianTeamSupport.abilityName.toUpperCase()}${chargeSuffix}`,
                {
                    fontSize: '10px',
                    color: '#F2C14E',
                    fontStyle: 'bold'
                }
            );
            ally.setPosition(0, row * 22);
            label.setPosition(26, row * 22 + 2);
            this.katanaUpgradeDisplay.add([ally, label]);
        }
    }

    /**
     * Update health hearts display
     */
    updateHealthDisplay() {
        this.healthDisplay.removeAll(true);

        for (let i = 0; i < this.maxHealth; i++) {
            const heart = this.add.graphics();
            const filled = i < this.health;

            // Draw heart shape
            heart.fillStyle(filled ? 0xFF6B6B : 0x3D2B5D, 1);
            heart.fillCircle(8, 8, 8);
            heart.fillCircle(18, 8, 8);
            heart.fillTriangle(0, 10, 26, 10, 13, 26);

            heart.setPosition(i * 35, 0);
            this.healthDisplay.add(heart);
        }
    }

    /**
     * Update crystal energy display
     */
    updateEnergyDisplay() {
        this.energyDisplay.removeAll(true);

        for (let i = 0; i < this.maxCrystalEnergy; i++) {
            const crystal = this.add.graphics();
            const filled = i < this.crystalEnergy;

            // Draw crystal diamond shape
            crystal.fillStyle(filled ? 0x7B68EE : 0x3D2B5D, filled ? 1 : 0.5);
            crystal.fillTriangle(10, 0, 0, 12, 10, 24);
            crystal.fillTriangle(10, 0, 20, 12, 10, 24);

            // Glow effect for filled
            if (filled) {
                crystal.fillStyle(0x7B68EE, 0.3);
                crystal.fillCircle(10, 12, 12);
            }

            crystal.setPosition(i * 28, 0);
            this.energyDisplay.add(crystal);
        }

        // Also update mobile button energy rings
        this.updateEnergyRings();
    }

    /**
     * Create level-specific content - override in subclass
     */
    createLevelContent() {
        // Override in subclass to add:
        // - Enemies
        // - Collectibles
        // - Secrets
        // - Boss arena
        console.log('[PlatformerLevel] createLevelContent - override in subclass');
    }

    createLevelSpecificContentOnce() {
        if (this._levelContentCreated) {
            return false;
        }

        this._levelContentCreated = true;
        this.createLevelContent();
        return true;
    }

    /**
     * Main update loop
     */
    update(time, delta) {
        if (!this.player || this.isPlayerDead || this.levelCompletionActive) return;

        // Anti-stuck detection: Check if player is embedded in ground and rescue them
        this.checkAndFixStuckPlayer();

        // Check if grounded
        this.isGrounded = this.player.body.blocked.down || this.player.body.touching.down;

        // Track coyote time - record when we were last grounded
        if (this.isGrounded) {
            this.lastGroundedTime = time;
        }

        // Detect landing (transition from air to ground) for dust effect
        if (this.isGrounded && !this.wasGrounded) {
            this.onLanding(time);
        }
        this.wasGrounded = this.isGrounded;

        // Track last safe position when grounded (for respawn after pit falls)
        if (this.isGrounded && !this.isInvincible) {
            this.updateLastSafePosition();
        }

        // Check for fall out of bounds (kill zone)
        this.checkFallOutOfBounds();

        const recoveryInputLocked = time < this.recoveryInputLockedUntil;
        if (recoveryInputLocked) {
            this.player.setVelocityX(0);
            this.virtualJumpPressed = false;
        } else {
            // Handle ducking (must check before movement)
            this.handleDuck();

            // Handle movement (with smooth acceleration)
            this.handleMovement();
        }
        this.updateCenteringStance(time);

        // Handle jumping (only if not ducking)
        if (!recoveryInputLocked && !this.isDucking) {
            this.handleJump(time);
        }

        // Update player facing direction
        this.updatePlayerFacing();
        this.astronautFollower?.update(delta);
        this.updateGuardianTeamSupportEcho(delta);
        this.updateCurrentEcologyNodeProximity();

        // MOBILE UX: Update camera directional lead
        this.updateCameraLead();

        // Update Crystal Shield if active
        if (this.hasShield) {
            this.updateShield(delta);
        }
    }

    /**
     * Called when player lands on ground
     * Triggers landing dust effect if falling from height
     */
    onLanding(time) {
        const fallDistance = this.player.y - this.lastLandingY;

        // Only show dust if fell a significant distance (not just stepping down)
        if (fallDistance > 50 && window.FXLibrary) {
            window.FXLibrary.landingDust(this, this.player.x, this.player.body.bottom, {
                count: Math.min(15, Math.floor(fallDistance / 30) + 5)
            });
        }

        // Update last landing Y for next comparison
        this.lastLandingY = this.player.y;

        // Check for jump buffer - if player pressed jump while in air near landing
        if (this.jumpBufferPressed && (time - this.jumpBufferTimestamp) < this.jumpBufferTime) {
            // Execute buffered jump immediately
            this.time.delayedCall(20, () => {
                if (this.isGrounded && this.canJump && !this.isDucking) {
                    this.executeJump();
                }
            });
        }
    }

    /**
     * Apply a purchased inventory power-up to this expedition.
     */
    applyPowerupEffect(effect = {}, item = {}) {
        if (effect.crystalEnergy > 0) {
            const previousEnergy = this.crystalEnergy;
            this.crystalEnergy = Math.min(
                this.maxCrystalEnergy,
                this.crystalEnergy + effect.crystalEnergy
            );
            if (this.crystalEnergy === previousEnergy) {
                return { success: false, message: 'Crystal energy is already full' };
            }
            this.updateEnergyDisplay();
            return {
                success: true,
                message: `Crystal energy restored to ${this.crystalEnergy}/${this.maxCrystalEnergy}`
            };
        }

        if (effect.nextRangedDamageMultiplier > 1) {
            if (this.nextRangedDamageMultiplier > 1) {
                return { success: false, message: 'Power Shot is already charged' };
            }
            this.nextRangedDamageMultiplier = Math.floor(effect.nextRangedDamageMultiplier);
            return {
                success: true,
                message: `Next ranged attack deals x${this.nextRangedDamageMultiplier} damage`
            };
        }

        if (effect.shieldHits > 0) {
            this.powerupShieldHits += Math.floor(effect.shieldHits);
            return {
                success: true,
                message: `Crystal Shield can block ${this.powerupShieldHits} hit${
                    this.powerupShieldHits === 1 ? '' : 's'
                }`
            };
        }

        if (effect.freeSpecialAttack > 0) {
            this.freeSpecialAttackCharges += Math.floor(effect.freeSpecialAttack);
            return {
                success: true,
                message: `Free Super Blast charged x${this.freeSpecialAttackCharges}`
            };
        }

        if (effect.fullHealth === true) {
            if (this.health >= this.maxHealth) {
                return { success: false, message: 'Health is already full' };
            }
            this.health = this.maxHealth;
            this.updateHealthDisplay();
            return { success: true, message: 'Health fully restored' };
        }

        if (effect.coinMultiplier > 1) {
            const multiplier = Math.floor(effect.coinMultiplier);
            if (this.levelCoinMultiplier >= multiplier) {
                return { success: false, message: 'Coin Magnet is already active' };
            }
            this.levelCoinMultiplier = multiplier;
            window.EconomyManager?.setLevelCoinMultiplier?.(multiplier);
            return {
                success: true,
                message: `Coin Magnet x${multiplier} active for this expedition`
            };
        }

        console.warn(`[PlatformerLevel] Unsupported power-up effect: ${item.id || 'unknown'}`);
        return { success: false, message: 'This power-up is not supported here' };
    }

    /**
     * Update Crystal Shield power-up
     */
    updateShield(delta) {
        this.shieldTimeRemaining -= delta;

        // Update shield aura visual
        if (this.shieldAuraController) {
            this.shieldAuraController.update(this.player.x, this.player.y);
        }

        // Shield expired
        if (this.shieldTimeRemaining <= 0) {
            this.deactivateShield();
        }
    }

    /**
     * Activate Crystal Shield power-up
     */
    activateShield() {
        console.log('[PlatformerLevel] Crystal Shield activated!');

        this.hasShield = true;
        this.shieldTimeRemaining = this.shieldDuration;

        // Create shield aura visual
        if (window.FXLibrary) {
            this.shieldAuraController = window.FXLibrary.shieldAura(this, this.player, {
                radius: 45,
                color: 0x00FFFF
            });
        }

        // Play activation sound
        if (window.AudioManager) {
            window.AudioManager.playLevelUp();
        }

        // Show floating text
        this.showFloatingText('SHIELD ACTIVE!', this.player.x, this.player.y - 60, '#00FFFF');
    }

    /**
     * Deactivate Crystal Shield
     */
    deactivateShield() {
        console.log('[PlatformerLevel] Crystal Shield expired');

        this.hasShield = false;
        this.shieldTimeRemaining = 0;

        // Destroy shield aura
        if (this.shieldAuraController) {
            this.shieldAuraController.destroy();
            this.shieldAuraController = null;
        }

        // Play expiration sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        // Show floating text
        this.showFloatingText('Shield Faded', this.player.x, this.player.y - 60, '#888888');
    }

    /**
     * Show floating text that rises and fades
     */
    showFloatingText(text, x, y, color = '#FFD700') {
        const floatingText = this.add.text(x, y, text, {
            fontSize: '20px',
            color: color,
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(950);

        this.tweens.add({
            targets: floatingText,
            y: y - 60,
            alpha: { from: 1, to: 0 },
            scale: { from: 1, to: 1.3 },
            duration: 1200,
            onComplete: () => floatingText.destroy()
        });
    }

    /**
     * Handle horizontal movement with smooth acceleration
     * More responsive but less twitchy than instant velocity
     * Supports both keyboard and virtual joystick input
     */
    handleMovement() {
        const leftPressed = this.cursors.left.isDown || this.wasdKeys.A.isDown;
        const rightPressed = this.cursors.right.isDown || this.wasdKeys.D.isDown;

        // Check virtual joystick input (threshold for direction)
        const virtualLeft = this.virtualJoystickX < -0.2;
        const virtualRight = this.virtualJoystickX > 0.2;

        // Reduce speed while ducking
        const currentMaxSpeed = this.isDucking ? this.playerSpeed * 0.4 : this.playerSpeed;

        if (leftPressed || virtualLeft) {
            // For virtual input, scale speed by joystick magnitude
            const speedMultiplier = virtualLeft ? Math.min(1, Math.abs(this.virtualJoystickX) * 1.5) : 1;
            const targetVel = -currentMaxSpeed * speedMultiplier;
            const currentVel = this.player.body.velocity.x;
            const newVel = currentVel + (targetVel - currentVel) * this.playerAcceleration;
            this.player.setVelocityX(newVel);
            this.player.facingRight = false;
        } else if (rightPressed || virtualRight) {
            // For virtual input, scale speed by joystick magnitude
            const speedMultiplier = virtualRight ? Math.min(1, Math.abs(this.virtualJoystickX) * 1.5) : 1;
            const targetVel = currentMaxSpeed * speedMultiplier;
            const currentVel = this.player.body.velocity.x;
            const newVel = currentVel + (targetVel - currentVel) * this.playerAcceleration;
            this.player.setVelocityX(newVel);
            this.player.facingRight = true;
        } else {
            // Smooth deceleration when no input
            this.player.setVelocityX(this.player.body.velocity.x * this.playerDeceleration);

            // Stop completely if very slow (prevents sliding)
            if (Math.abs(this.player.body.velocity.x) < 5) {
                this.player.setVelocityX(0);
            }
        }

        // Speed lines when moving fast (velocity > 150)
        const speed = Math.abs(this.player.body.velocity.x);
        if (speed > 150 && window.FXLibrary && !this.speedLineThrottle) {
            const direction = this.player.body.velocity.x > 0 ? -1 : 1;
            window.FXLibrary.speedLines(this, this.player.x, this.player.y, direction);

            // Throttle speed lines to prevent too many particles
            this.speedLineThrottle = true;
            this.time.delayedCall(80, () => {
                this.speedLineThrottle = false;
            });
        }
    }

    /**
     * Handle duck/crouch mechanic
     * Down arrow or S key to duck - reduces hitbox and slows movement
     * Note: Only requires grounded to START ducking, stays ducked while key held
     */
    handleDuck() {
        const duckPressed = this.cursors.down.isDown || this.wasdKeys.S.isDown;

        if (duckPressed) {
            // Can only START ducking while grounded, but STAY ducked while key held
            if (!this.isDucking && this.isGrounded) {
                this.isDucking = true;

                // Shrink hitbox (lower height, keeping feet planted)
                this.player.body.setSize(40, this.duckBodyHeight);
                this.player.body.setOffset(10, 15 + (this.normalBodyHeight - this.duckBodyHeight));

                // Visual squash for duck
                this.player.setScale(1, 0.6);

                // Play duck sound
                if (window.AudioManager) {
                    window.AudioManager.playButtonClick();
                }
            }
            // If already ducking, stay ducked (don't check grounded again)
        } else {
            // Only stand up when key is released
            if (this.isDucking) {
                this.isDucking = false;

                // Restore normal hitbox
                this.player.body.setSize(40, this.normalBodyHeight);
                this.player.body.setOffset(10, 15);

                // Restore normal scale
                this.player.setScale(1, 1);
            }
        }
    }

    /**
     * Handle jump input with coyote time and jump buffering
     * - Coyote time: 100ms grace period after leaving platform
     * - Jump buffering: Accept jump input 100ms before landing
     * Supports both keyboard and virtual jump button
     */
    handleJump(time) {
        const jumpPressed = this.jumpKey.isDown ||
                           this.cursors.up.isDown ||
                           this.wasdKeys.W.isDown ||
                           this.virtualJumpPressed;  // Mobile virtual jump button

        // Calculate if within coyote time (recently was grounded)
        const timeSinceGrounded = time - this.lastGroundedTime;
        const canCoyoteJump = timeSinceGrounded < this.coyoteTime;

        // Determine if we can jump (grounded OR within coyote time)
        const canJumpNow = (this.isGrounded || canCoyoteJump) && this.canJump;

        if (jumpPressed && canJumpNow) {
            this.executeJump();
        } else if (jumpPressed && !this.isGrounded) {
            // Player pressed jump while in air - buffer it for landing
            this.jumpBufferPressed = true;
            this.jumpBufferTimestamp = time;
        }

        // Clear jump buffer if grounded and no jump pressed
        if (this.isGrounded && !jumpPressed) {
            this.jumpBufferPressed = false;
        }
    }

    /**
     * Execute the actual jump
     * Separated to allow calling from handleJump and jump buffer
     */
    executeJump() {
        // Track Y position before jump for landing dust calculation
        this.lastLandingY = this.player.y;

        this.player.setVelocityY(this.jumpVelocity);
        this.canJump = false;
        this.isGrounded = false;

        // Reset virtual jump to prevent continuous jumping
        this.virtualJumpPressed = false;

        // Clear jump buffer since we just jumped
        this.jumpBufferPressed = false;

        // Play jump sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        // Jump cooldown
        this.time.delayedCall(this.jumpCooldown, () => {
            this.canJump = true;
        });
    }

    /**
     * Update player sprite facing direction
     */
    updatePlayerFacing() {
        if (this.player.facingRight) {
            this.player.setFlipX(false);
        } else {
            this.player.setFlipX(true);
        }
    }

    /**
     * Return the physical target used by shared boss attacks.
     * Some guardians render separately from their collision body.
     */
    getBossCombatTarget() {
        if (this.bossBody?.active) {
            return this.bossBody;
        }
        return this.boss?.active ? this.boss : null;
    }

    /**
     * Perform basic melee attack - override in subclass for creature-specific attacks.
     * Checks both regular enemies and the active guardian target.
     */
    performAttack({ targetXOverride = null, targetYOverride = null } = {}) {
        if (!this.player || this.levelCompletionActive || this.isPlayerDead) return;
        if (
            this.astronautFollower?.fieldKitRecovered &&
            this.astronautFollower?.isStriking
        ) {
            return;
        }

        this.lastCombatActionAt = this.time?.now || 0;
        console.log('[PlatformerLevel] Astronaut katana strike performed');
        const combatProfile = this.katanaCombatProfile || {};
        const meleeDamage = Number(combatProfile.meleeDamage) || 2;
        const enemyMeleeRange = Number(combatProfile.enemyMeleeRange) || 70;
        const bossMeleeRange = Number(combatProfile.bossMeleeRange) || 80;

        // Create basic attack effect
        const attackX = Number.isFinite(targetXOverride)
            ? targetXOverride
            : this.player.facingRight
                ? this.player.x + 50
                : this.player.x - 50;
        const attackY = Number.isFinite(targetYOverride)
            ? targetYOverride
            : this.player.y;
        const astronautStrike = this.astronautFollower?.performKatanaStrike({
            facingRight: this.player.facingRight,
            targetX: attackX,
            targetY: attackY,
            slashColor: combatProfile.slashColor || 0xE040FB,
            slashGlowColor: combatProfile.slashGlowColor || 0x7B68EE
        }) === true;

        if (!astronautStrike) {
            // Fallback for pre-field-kit and reduced-runtime states.
            const attackEffect = this.add.graphics();
            attackEffect.fillStyle(combatProfile.slashGlowColor || 0x7B68EE, 0.8);
            attackEffect.fillCircle(0, 0, 25);
            attackEffect.setPosition(attackX, attackY);
            attackEffect.setDepth(899);

            const slash = this.add.graphics();
            slash.lineStyle(4, combatProfile.slashColor || 0xE040FB, 1);
            slash.beginPath();
            const startAngle = this.player.facingRight ? -Math.PI / 2 : Math.PI / 2;
            slash.arc(0, 0, 40, startAngle - 0.5, startAngle + 1, false);
            slash.strokePath();
            slash.setPosition(attackX, attackY);
            slash.setDepth(899);

            this.tweens.add({
                targets: [attackEffect, slash],
                scaleX: 1.5,
                scaleY: 1.5,
                alpha: 0,
                duration: 200,
                onComplete: () => {
                    attackEffect.destroy();
                    slash.destroy();
                }
            });
        }

        // Check enemy hits. Creature-tech upgrades strengthen the Earth-forged blade.
        if (this.enemies) {
            this.enemies.getChildren().forEach(enemy => {
                const dist = Phaser.Math.Distance.Between(
                    attackX, attackY,
                    enemy.x, enemy.y
                );
                if (dist < enemyMeleeRange) {
                    this.damageEnemy(enemy, meleeDamage);
                }
            });
        }

        // Check boss hit (if boss exists and is active)
        const bossTarget = this.getBossCombatTarget();
        if (bossTarget) {
            const dist = Phaser.Math.Distance.Between(
                attackX, attackY,
                bossTarget.x, bossTarget.y
            );
            if (dist < bossMeleeRange) {
                // Call damageBoss if it exists (implemented in subclass)
                if (typeof this.damageBoss === 'function') {
                    this.damageBoss(meleeDamage);
                    console.log(
                        `[PlatformerLevel] Boss hit by katana strike! (${meleeDamage} damage)`
                    );

                    // Extra combat juice for boss hits
                    if (this.combatJuice) {
                        this.combatJuice.screenShake(5, 150);
                        this.combatJuice.hitStop(40);
                    }
                }
            }
        }

        // Combat feedback for the astronaut's katana strike, even without a hit.
        if (this.combatJuice) {
            this.combatJuice.screenShake(2, 60);
            this.combatJuice.hapticFeedback('light');
        }

        // Play attack sound
        if (window.AudioManager) {
            window.AudioManager.playAttack();
        }
    }

    /**
     * Perform ranged attack (M key) - fires a projectile
     * UNLIMITED AMMO - kids can shoot freely!
     * Crystal energy is now reserved for special attacks only
     */
    performRangedAttack() {
        if (!this.player || this.levelCompletionActive || this.isPlayerDead) return;

        this.lastCombatActionAt = this.time?.now || 0;
        console.log('[PlatformerLevel] Ranged attack performed (unlimited ammo)');
        const rangedDamage = Math.max(
            1,
            Math.floor(Number(this.nextRangedDamageMultiplier) || 1)
        );
        this.nextRangedDamageMultiplier = 1;
        if (rangedDamage > 1) {
            this.showFloatingText(
                `POWER SHOT x${rangedDamage}`,
                this.player.x,
                this.player.y - 60,
                '#FFD700'
            );
        }

        // Create projectile
        const startX = this.player.x;
        const startY = this.player.y - 10;
        const direction = this.player.facingRight ? 1 : -1;

        // Projectile visual (energy bolt)
        const projectile = this.add.graphics();
        projectile.fillStyle(0x00FFFF, 1);
        // Bolt shape
        projectile.fillTriangle(0, 5, 20, 0, 0, -5);
        projectile.fillStyle(0xFFFFFF, 0.8);
        projectile.fillCircle(5, 0, 4);
        projectile.setPosition(startX, startY);
        projectile.setDepth(898);
        projectile.setRotation(direction > 0 ? 0 : Math.PI);

        // Add physics body
        this.physics.add.existing(projectile);
        projectile.body.setAllowGravity(false);
        projectile.body.setSize(20, 10);
        projectile.body.setVelocityX(400 * direction);

        // Trail effect
        const trailInterval = this.time.addEvent({
            delay: 30,
            callback: () => {
                if (!projectile.active) return;
                const trail = this.add.graphics();
                trail.fillStyle(0x00FFFF, 0.4);
                trail.fillCircle(0, 0, 5);
                trail.setPosition(projectile.x, projectile.y);
                trail.setDepth(897);
                this.tweens.add({
                    targets: trail,
                    alpha: 0,
                    scaleX: 0.3,
                    scaleY: 0.3,
                    duration: 150,
                    onComplete: () => trail.destroy()
                });
            },
            repeat: 15
        });

        // Check collisions with enemies
        if (this.enemies) {
            this.physics.add.overlap(projectile, this.enemies, (proj, enemy) => {
                this.damageEnemy(enemy, rangedDamage);
                this.createProjectileImpact(proj.x, proj.y);
                trailInterval.remove();
                proj.destroy();
            });
        }

        // Check collision with boss
        const bossTarget = this.getBossCombatTarget();
        if (bossTarget) {
            this.physics.add.overlap(projectile, bossTarget, (proj) => {
                if (typeof this.damageBoss === 'function') {
                    this.damageBoss(rangedDamage);
                    console.log(
                        `[PlatformerLevel] Boss hit by ranged attack! (${rangedDamage} damage)`
                    );
                }
                this.createProjectileImpact(proj.x, proj.y);
                trailInterval.remove();
                proj.destroy();
            });
        }

        // Destroy after time/distance
        this.time.delayedCall(1500, () => {
            if (projectile.active) {
                trailInterval.remove();
                projectile.destroy();
            }
        });

        // Play ranged attack sound (use a crystal-like sound)
        if (window.AudioManager) {
            window.AudioManager.playBossProjectile(); // Reuse this sound
        }
    }

    /**
     * Create impact effect when projectile hits
     */
    createProjectileImpact(x, y) {
        const impact = this.add.graphics();
        impact.fillStyle(0x00FFFF, 0.8);
        impact.fillCircle(0, 0, 10);
        impact.setPosition(x, y);
        impact.setDepth(898);

        this.tweens.add({
            targets: impact,
            scaleX: 2.5,
            scaleY: 2.5,
            alpha: 0,
            duration: 200,
            onComplete: () => impact.destroy()
        });

        // Particle burst
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, x, y, {
                count: 8,
                color: [0x00FFFF, 0x7B68EE],
                duration: 500
            });
        }
    }

    /**
     * Perform special attack (uses crystal energy)
     */
    performSpecialAttack() {
        if (!this.player || this.levelCompletionActive || this.isPlayerDead) return;

        const useFreeCharge = this.freeSpecialAttackCharges > 0;
        if (!useFreeCharge && this.crystalEnergy < 3) {
            console.log('[PlatformerLevel] Not enough crystal energy');
            return;
        }

        this.lastCombatActionAt = this.time?.now || 0;
        console.log('[PlatformerLevel] Special attack: Super Obliterate!');

        if (useFreeCharge) {
            this.freeSpecialAttackCharges -= 1;
            this.showFloatingText(
                'FREE SUPER BLAST',
                this.player.x,
                this.player.y - 70,
                '#FF9FF3'
            );
        } else {
            this.crystalEnergy -= 3;
        }
        this.updateEnergyDisplay();

        // Epic screen shake and haptic for special attack
        if (this.combatJuice) {
            this.combatJuice.screenShake(8, 300);
            this.combatJuice.hapticFeedback('heavy');
            this.combatJuice.slowMotion(0.4, 400); // Brief slow-mo for impact
        } else {
            window.FeedbackManager?.cameraShake?.(this, 300, 0.02);
        }

        // Massive area effect
        const blast = this.add.graphics();
        blast.fillStyle(0xE040FB, 0.6);
        blast.fillCircle(0, 0, 50);
        blast.setPosition(this.player.x, this.player.y);
        blast.setDepth(895); // Above platforms, below player

        // Expand blast
        this.tweens.add({
            targets: blast,
            scaleX: 4,
            scaleY: 4,
            alpha: 0,
            duration: 500,
            ease: 'Power2',
            onComplete: () => blast.destroy()
        });

        // Damage all nearby enemies
        if (this.enemies) {
            this.enemies.getChildren().forEach(enemy => {
                const dist = Phaser.Math.Distance.Between(
                    this.player.x, this.player.y,
                    enemy.x, enemy.y
                );
                if (dist < 300) {
                    this.defeatEnemy(enemy);
                }
            });
        }

        // Epic sound
        if (window.AudioManager) {
            window.AudioManager.playLevelUp();
        }
    }

    /**
     * Damage an enemy with exciting combat juice!
     */
    damageEnemy(enemy, damage) {
        if (!enemy.health) enemy.health = 2;

        // Register hit with combo system for multiplier
        let finalDamage = damage;
        if (this.combatJuice) {
            const comboResult = this.combatJuice.registerHit(damage);
            finalDamage = damage + comboResult.bonus;

            // Show damage number with combo awareness
            const isCritical = comboResult.multiplier >= 1.5;
            this.combatJuice.showDamageNumber(enemy.x, enemy.y, finalDamage, isCritical);

            // Screen shake and haptic for satisfying hits
            this.combatJuice.screenShake(damage, 80);

            // Hit flash on enemy (white flash)
            this.combatJuice.hitFlash(enemy, 0xFFFFFF, 80);

            // Brief hit stop for heavy hits
            if (damage >= 2) {
                this.combatJuice.hitStop(30);
            }
        } else {
            // Fallback: Flash red
            enemy.setTint(0xFF0000);
            this.time.delayedCall(100, () => {
                if (enemy.active) enemy.clearTint();
            });
        }

        enemy.health -= finalDamage;

        if (enemy.health <= 0) {
            this.defeatEnemy(enemy);
        }
    }

    /**
     * Defeat an enemy with satisfying feedback!
     */
    defeatEnemy(enemy) {
        if (!enemy?.active) {
            return;
        }

        // Combat juice for satisfying defeat
        if (this.combatJuice) {
            // Stronger screen shake for defeat
            this.combatJuice.screenShake(4, 120);
            this.combatJuice.hapticFeedback('medium');

            // Show defeat bonus text
            this.combatJuice.showDamageNumber(enemy.x, enemy.y - 20, '+1⚡', false);
        }

        // Particle burst
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, enemy.x, enemy.y, {
                count: 20, // More particles for defeat
                color: [0x7B68EE, 0xE040FB, 0x00FFFF, 0xFFD700],
                duration: 1200
            });
        }

        // Award crystal energy
        this.crystalEnergy = Math.min(this.crystalEnergy + 1, this.maxCrystalEnergy);
        this.updateEnergyDisplay();

        // Destroy enemy
        enemy.destroy();
        window.AchievementSystem?.recordEvent?.('enemy_defeated', {
            levelId: this.levelId || this.scene?.key || null
        });

        // Sound
        if (window.AudioManager) {
            window.AudioManager.playEnemyHit();
        }
    }

    /**
     * Player takes damage
     * @param {number} amount - Damage amount (1 = 1 heart)
     * @param {boolean} bypassInvincibility - If true, ignore invincibility (for pit falls)
     */
    takeDamage(amount, bypassInvincibility = false) {
        // Crystal Shield blocks all damage
        if (this.hasShield) {
            console.log('[PlatformerLevel] Damage blocked by Crystal Shield!');
            // Visual feedback - shield absorb effect
            if (window.FXLibrary) {
                window.FXLibrary.stardustBurst(this, this.player.x, this.player.y, {
                    count: 8,
                    color: [0x00FFFF, 0xFFFFFF],
                    duration: 400
                });
            }
            return;
        }

        if (this.powerupShieldHits > 0 && !bypassInvincibility) {
            this.powerupShieldHits -= 1;
            const guardianBlock = this.guardianShieldHitsRemaining > 0;
            if (guardianBlock) this.guardianShieldHitsRemaining -= 1;
            const blockLabel = guardianBlock
                ? this.guardianTeamSupport.abilityName
                : 'SHIELD BLOCK';
            this.showFloatingText(
                `${blockLabel.toUpperCase()} · ${this.powerupShieldHits} LEFT`,
                this.player.x,
                this.player.y - 60,
                '#8FEAFF'
            );
            if (guardianBlock) this.pulseGuardianTeamSupportEcho(blockLabel);
            window.FXLibrary?.stardustBurst?.(this, this.player.x, this.player.y, {
                count: 10,
                color: [0x8FEAFF, 0xFFFFFF],
                duration: 500
            });
            window.AudioManager?.playAchievement?.();
            console.log('[PlatformerLevel] Damage blocked by inventory Crystal Shield');
            return;
        }

        if (this.guardianGuardCharges > 0 && !bypassInvincibility) {
            this.guardianGuardCharges -= 1;
            this.updateKatanaUpgradeDisplay();
            this.showFloatingText?.(
                'ROOT BRIDGE',
                this.player.x,
                this.player.y - 55,
                '#B7E36D'
            );
            window.FXLibrary?.stardustBurst?.(this, this.player.x, this.player.y, {
                count: 14,
                color: [0xB7E36D, 0x3F7D44, 0xF4F4F4],
                duration: 650
            });
            window.AudioManager?.playAchievement?.();
            this.pulseGuardianTeamSupportEcho(
                this.guardianTeamSupport.abilityName || 'Root Bridge'
            );
            console.log('[PlatformerLevel] Damage absorbed by Root Bridge');
            return;
        }

        if (this.communityGuardCharges > 0 && !bypassInvincibility) {
            this.communityGuardCharges -= 1;
            this.updateKatanaUpgradeDisplay();
            this.showFloatingText?.(
                'FEND RELAY',
                this.player.x,
                this.player.y - 55,
                '#8FE3CF'
            );
            window.FXLibrary?.stardustBurst?.(this, this.player.x, this.player.y, {
                count: 14,
                color: [0x71E6B1, 0xF4F4F4, 0xD94B4B],
                duration: 650
            });
            window.AudioManager?.playAchievement?.();
            console.log('[PlatformerLevel] Damage absorbed by the Fend Relay');
            return;
        }

        if (this.auroraGuardCharges > 0 && !bypassInvincibility) {
            this.auroraGuardCharges -= 1;
            this.updateKatanaUpgradeDisplay();
            this.showFloatingText?.(
                'AURORA GUARD',
                this.player.x,
                this.player.y - 55,
                '#D9B8FF'
            );
            window.FXLibrary?.stardustBurst?.(this, this.player.x, this.player.y, {
                count: 14,
                color: [0xD9B8FF, 0xF2C14E, 0x8FE3CF],
                duration: 650
            });
            window.AudioManager?.playAchievement?.();
            console.log('[PlatformerLevel] Damage absorbed by Aurora Guard');
            return;
        }

        // Check invincibility - prevents multi-hit from overlapping enemies
        if (this.isInvincible && !bypassInvincibility) {
            return;
        }

        // Check if already dead
        if (this.isPlayerDead) {
            return;
        }

        this.health -= amount;
        this.updateHealthDisplay();

        // Track damage for achievement purposes (no-damage run tracking)
        this.damageTaken = (this.damageTaken || 0) + amount;

        console.log(`[PlatformerLevel] Player took ${amount} damage, health: ${this.health}/${this.maxHealth}`);

        // Combat juice for taking damage - OUCH!
        if (this.combatJuice) {
            this.combatJuice.screenShake(6, 200);
            this.combatJuice.hapticFeedback('heavy');
            this.combatJuice.hitFlash(this.player, 0xFF0000, 150);
            this.combatJuice.showDamageNumber(this.player.x, this.player.y - 40, `-${amount}❤️`, true);
            // Reset combo on taking damage
            this.combatJuice.resetCombo();
        }

        // Check for death first
        if (this.health <= 0) {
            this.onPlayerDeath();
            return;
        }

        this.armCenteringStance();

        // Start invincibility period
        this.isInvincible = true;

        // Flash red initially (if not using combatJuice)
        if (!this.combatJuice) {
            this.player.setTint(0xFF0000);
            this.time.delayedCall(200, () => {
                if (this.player) this.player.clearTint();
            });
        }

        // Knockback
        const knockbackX = this.player.facingRight ? -200 : 200;
        this.player.setVelocity(knockbackX, -150);

        // Flashing effect during invincibility
        this.startInvincibilityFlash();

        // Sound
        if (window.AudioManager) {
            window.AudioManager.playError();
        }

        // End invincibility after duration
        this.time.delayedCall(this.invincibilityDuration, () => {
            this.endInvincibility();
        });
    }

    /**
     * Start flashing effect during invincibility
     */
    startInvincibilityFlash() {
        if (!this.player) return;

        // Create flashing tween
        this.invincibilityTween = this.tweens.add({
            targets: this.player,
            alpha: { from: 1, to: 0.3 },
            duration: 100,
            yoyo: true,
            repeat: -1 // Repeat until stopped
        });
    }

    /**
     * End invincibility period
     */
    endInvincibility() {
        this.isInvincible = false;

        // Stop flashing
        if (this.invincibilityTween) {
            this.invincibilityTween.stop();
            this.invincibilityTween = null;
        }

        // Reset alpha
        if (this.player) {
            this.player.setAlpha(1);
        }
    }

    armCenteringStance() {
        if (
            !this.centeringStanceUnlocked ||
            this.centeringStanceUsed ||
            this.centeringStanceArmed ||
            this.health >= this.maxHealth ||
            this.isPlayerDead
        ) {
            return false;
        }
        this.centeringStanceArmed = true;
        this.centeringStanceStartedAt = null;
        this.updateCenteringStanceStatus(
            'CENTERING STANCE // RELEASE MOVEMENT'
        );
        return true;
    }

    updateCenteringStance(time) {
        if (
            !this.centeringStanceArmed ||
            this.centeringStanceUsed ||
            !this.player?.body ||
            this.isPlayerDead ||
            this.levelCompletionActive
        ) {
            return;
        }
        const directionalInput =
            this.cursors?.left?.isDown ||
            this.cursors?.right?.isDown ||
            this.cursors?.up?.isDown ||
            this.cursors?.down?.isDown ||
            this.wasdKeys?.A?.isDown ||
            this.wasdKeys?.D?.isDown ||
            this.wasdKeys?.W?.isDown ||
            this.wasdKeys?.S?.isDown ||
            Math.abs(this.virtualJoystickX || 0) > 0.2 ||
            this.virtualJumpPressed;
        const stable =
            this.isGrounded &&
            !directionalInput &&
            !this.isDucking &&
            !this.isInvincible &&
            Math.abs(this.player.body.velocity.x) < 8 &&
            Math.abs(this.player.body.velocity.y) < 25 &&
            time - this.lastCombatActionAt > 500;

        if (!stable) {
            this.centeringStanceStartedAt = null;
            this.updateCenteringStanceStatus(
                this.isGrounded
                    ? 'CENTERING STANCE // RELEASE MOVEMENT'
                    : 'CENTERING STANCE // FIND SOLID GROUND'
            );
            return;
        }

        if (this.centeringStanceStartedAt === null) {
            this.centeringStanceStartedAt = time;
        }
        const elapsed = Math.max(0, time - this.centeringStanceStartedAt);
        const remaining = Math.max(
            0,
            CENTERING_STANCE_DURATION_MS - elapsed
        );
        this.updateCenteringStanceStatus(
            `CENTERING STANCE // ${(remaining / 1000).toFixed(1)}s`
        );
        if (elapsed >= CENTERING_STANCE_DURATION_MS) {
            this.completeCenteringStance({
                commit: !this.centeringStancePreview
            });
        }
    }

    updateCenteringStanceStatus(label) {
        if (!this.player) return;
        if (!this.centeringStanceStatusText) {
            this.centeringStanceStatusText = this.add.text(
                this.player.x,
                this.player.y - 78,
                label,
                {
                    fontSize: this.detectMobile() ? '10px' : '12px',
                    color: '#F4F4F4',
                    backgroundColor: 'rgba(8, 16, 16, 0.9)',
                    padding: { x: 9, y: 5 },
                    fontStyle: 'bold',
                    align: 'center'
                }
            ).setOrigin(0.5).setDepth(1100);
        }
        this.centeringStanceStatusText
            .setPosition(this.player.x, this.player.y - 78)
            .setText(label);
    }

    completeCenteringStance({ commit = true } = {}) {
        if (
            this.centeringStanceUsed ||
            !this.centeringStanceArmed ||
            this.isPlayerDead
        ) {
            return false;
        }
        this.centeringStanceUsed = true;
        this.centeringStanceArmed = false;
        this.centeringStanceStartedAt = null;
        this.centeringStanceStatusText?.destroy?.();
        this.centeringStanceStatusText = null;
        this.health = Math.min(this.maxHealth, this.health + 1);
        this.updateHealthDisplay();
        this.showFloatingText(
            'CENTERING STANCE // SUIT RESEALED',
            this.player.x,
            this.player.y - 64,
            '#8FE3CF'
        );
        window.FXLibrary?.stardustBurst?.(
            this,
            this.player.x,
            this.player.y,
            {
                count: 18,
                color: [0xD94B4B, 0x101616, 0xF4F4F4, 0x3FAE62],
                duration: 800
            }
        );
        window.AudioManager?.playAchievement?.();
        const result = commit
            ? recordCenteringStancePractice(window.GameState, {
                levelId: this.levelId,
                operationId:
                    `sensei:centering:${this.centeringStanceRunId}`
            })
            : { changed: true, reason: 'preview' };
        window.AchievementSystem?.recordEvent?.(
            'story_interaction',
            {
                event: 'centering_stance_practiced',
                levelId: this.levelId,
                companionId: window.GameState?.get?.(
                    'creature.genes.id'
                ),
                committed: commit
            }
        );
        return result?.changed === true;
    }

    /**
     * Update last safe position (called when grounded)
     * Only updates if player has moved significantly from last position
     */
    /**
     * Check if player is stuck in the ground and rescue them
     * This handles edge cases where physics collision pushes player into solid geometry
     */
    checkAndFixStuckPlayer() {
        if (!this.player || !this.player.body) return;

        const body = this.player.body;

        // Detect if player is stuck: velocity is zero but they're embedded in ground
        // Signs of being stuck:
        // 1. Very low velocity (can't move)
        // 2. Blocked on multiple sides (embedded)
        // 3. Not recently spawning/respawning
        const isStuck = (
            Math.abs(body.velocity.x) < 5 &&
            Math.abs(body.velocity.y) < 5 &&
            body.blocked.down &&
            (body.blocked.left || body.blocked.right) &&
            !this.isRespawning &&
            !this.isPlayerDead
        );

        // Track stuck frames
        if (!this.stuckFrameCount) {
            this.stuckFrameCount = 0;
        }

        if (isStuck) {
            this.stuckFrameCount++;

            // If stuck for more than 30 frames (~0.5 seconds), rescue the player
            if (this.stuckFrameCount > 30) {
                console.warn('[PlatformerLevel] Player appears stuck - attempting rescue');

                // Push player up and slightly to the side they're not blocked
                const pushX = body.blocked.left ? 50 : (body.blocked.right ? -50 : 0);
                const pushY = -100; // Always push up

                this.player.setPosition(
                    this.player.x + pushX,
                    this.player.y + pushY
                );
                this.player.setVelocity(pushX * 2, pushY);

                // Reset stuck counter
                this.stuckFrameCount = 0;

                // Brief invincibility to prevent immediate re-collision
                this.isInvincible = true;
                this.time.delayedCall(500, () => {
                    this.isInvincible = false;
                });

                console.log('[PlatformerLevel] Player rescued from stuck position');
            }
        } else {
            // Reset counter when not stuck
            this.stuckFrameCount = 0;
        }

        // Also check for embedded in ground (body overlapping with tiles significantly)
        // If player's feet are below the ground level they're standing on
        if (body.blocked.down && body.embedded) {
            console.warn('[PlatformerLevel] Player embedded detected - pushing up');
            this.player.setPosition(this.player.x, this.player.y - 20);
            this.player.setVelocityY(-50);
        }
    }

    updateLastSafePosition() {
        const currentPos = { x: this.player.x, y: this.player.y };

        // Only update if moved more than 50px from last safe position
        // This prevents constant updates while standing still
        if (!this.lastSafePosition ||
            Math.abs(currentPos.x - this.lastSafePosition.x) > 50 ||
            Math.abs(currentPos.y - this.lastSafePosition.y) > 50) {
            this.lastSafePosition = currentPos;
        }
    }

    /**
     * Set an explicit checkpoint (for mid-level checkpoints)
     */
    setCheckpoint(x, y, options = {}) {
        this.checkpointPosition = { x, y };
        console.log(`[PlatformerLevel] Checkpoint set at (${x}, ${y})`);

        if (options.persist === true) {
            this.persistExpeditionCheckpoint({
                checkpointId: options.checkpointId,
                checkpointIndex: options.checkpointIndex,
                x,
                y
            });
        }

        // Visual feedback
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, x, y, {
                count: 15,
                color: [0x00FF00, 0x7CFC00],
                duration: 1000
            });
        }
    }

    persistExpeditionCheckpoint({
        checkpointId,
        checkpointIndex,
        x,
        y
    } = {}) {
        const gameState = window.GameState;
        const sceneKey = this.scene?.key;
        const normalizedIndex = Number(checkpointIndex);
        const normalizedX = Number(x);
        const normalizedY = Number(y);

        if (
            !gameState?.set ||
            !sceneKey ||
            typeof checkpointId !== 'string' ||
            checkpointId.length > 80 ||
            !Number.isInteger(normalizedIndex) ||
            normalizedIndex < 0 ||
            !Number.isFinite(normalizedX) ||
            !Number.isFinite(normalizedY) ||
            normalizedX < 0 ||
            normalizedX > this.levelWidth ||
            normalizedY < 0 ||
            normalizedY > this.levelHeight
        ) {
            console.warn('[PlatformerLevel] Ignoring invalid persistent checkpoint');
            return false;
        }

        gameState.set(EXPEDITION_CHECKPOINT_PATH, {
            version: EXPEDITION_CHECKPOINT_VERSION,
            sceneKey,
            levelId: this.levelId,
            checkpointId,
            checkpointIndex: normalizedIndex,
            x: normalizedX,
            y: normalizedY,
            savedAt: Date.now()
        });
        gameState.save?.();
        return true;
    }

    restorePersistedExpeditionCheckpoint() {
        if (
            this.entryPreview ||
            this.recoveryPreview ||
            this.testMode ||
            this.firstExpeditionDrillPreview
        ) {
            return false;
        }

        const resume = window.GameState?.get?.(EXPEDITION_CHECKPOINT_PATH);
        const sceneKey = this.scene?.key;
        const presentation = EXPEDITION_CHECKPOINT_PRESENTATION[sceneKey];
        const x = Number(resume?.x);
        const y = Number(resume?.y);

        if (
            presentation?.levelStateId &&
            resume?.sceneKey === sceneKey &&
            resume?.levelId === this.levelId &&
            window.GameState?.get?.(
                `levels.${presentation.levelStateId}.completed`
            ) === true
        ) {
            this.clearPersistedExpeditionCheckpoint();
            return false;
        }

        if (
            resume?.version !== EXPEDITION_CHECKPOINT_VERSION ||
            resume?.sceneKey !== sceneKey ||
            resume?.levelId !== this.levelId ||
            typeof resume?.checkpointId !== 'string' ||
            !Number.isInteger(Number(resume?.checkpointIndex)) ||
            !Number.isFinite(x) ||
            !Number.isFinite(y) ||
            x < 0 ||
            x > this.levelWidth ||
            y < 0 ||
            y > this.levelHeight ||
            !this.player
        ) {
            return false;
        }

        if (this.restoreExpeditionRouteState(resume) !== true) {
            return false;
        }

        this.checkpointPosition = { x, y };
        this.player.setPosition(x, y);
        this.player.setVelocity?.(0, 0);
        this.checkpointResumeApplied = true;
        console.log(
            `[PlatformerLevel] Restored ${resume.checkpointId} at (${x}, ${y})`
        );
        return true;
    }

    getExpeditionResumePresentation() {
        if (!this.checkpointResumeApplied) {
            return null;
        }

        const resume = window.GameState?.get?.(EXPEDITION_CHECKPOINT_PATH);
        const presentation =
            EXPEDITION_CHECKPOINT_PRESENTATION[this.scene?.key];
        const checkpointIndex = Number(resume?.checkpointIndex);
        const checkpoint = presentation?.checkpoints?.[checkpointIndex];

        if (
            !checkpoint ||
            checkpoint[0] !== resume?.checkpointId
        ) {
            return null;
        }

        return {
            checkpointId: checkpoint[0],
            label: checkpoint[1],
            current: checkpointIndex + 1,
            total: presentation.checkpoints.length
        };
    }

    restoreExpeditionRouteState() {
        return false;
    }

    restoreExpeditionRouteSignals(resume, {
        signals,
        activeProperty = 'activated',
        countProperty,
        readyProperty,
        labelColor = '#8FE3CF',
        drawSignal,
        onRestored
    } = {}) {
        if (
            !Array.isArray(signals) ||
            signals.length === 0 ||
            !countProperty ||
            !readyProperty ||
            typeof drawSignal !== 'function'
        ) {
            return false;
        }

        const requestedIndex = Number(resume?.checkpointIndex);
        const checkpointIndex =
            signals[requestedIndex]?.id === resume?.checkpointId
                ? requestedIndex
                : signals.findIndex(signal => signal?.id === resume?.checkpointId);

        if (checkpointIndex < 0) {
            return false;
        }

        signals.forEach((signal, index) => {
            if (index > checkpointIndex) return;

            signal[activeProperty] = true;
            signal.zone?.destroy?.();
            signal.zone = null;
            drawSignal(signal);
            signal.label?.setColor?.(labelColor);
        });

        const restoredCount = checkpointIndex + 1;
        this[countProperty] = restoredCount;
        this[readyProperty] = restoredCount === signals.length;
        onRestored?.(signals[checkpointIndex], restoredCount);
        return true;
    }

    clearPersistedExpeditionCheckpoint({ save = true } = {}) {
        const gameState = window.GameState;
        if (!gameState?.set) return false;

        gameState.set(EXPEDITION_CHECKPOINT_PATH, null);
        if (save) {
            gameState.save?.();
        }
        return true;
    }

    /**
     * Check if player has fallen out of bounds (below level)
     */
    checkFallOutOfBounds() {
        if (!this.player || this.isPlayerDead) return;

        // Fall threshold: below level height + buffer
        const fallThreshold = this.levelHeight + 200;

        if (this.player.y > fallThreshold) {
            console.log('[PlatformerLevel] Player fell out of bounds');
            this.onPitFall();
        }
    }

    /**
     * Handle falling into a pit
     * Takes 1 heart of damage and respawns at checkpoint
     */
    onPitFall() {
        // Prevent multiple pit fall triggers
        if (this.isRespawning) return;
        this.isRespawning = true;

        if (this.health <= 1 && this.attemptAutonomousCreatureRescue('lethal_fall')) {
            return;
        }

        // Take 1 heart damage (bypass invincibility since it's a pit)
        this.health -= 1;
        this.updateHealthDisplay();

        console.log(`[PlatformerLevel] Pit fall! Health: ${this.health}/${this.maxHealth}`);

        // Check for death
        if (this.health <= 0) {
            this.isRespawning = false;
            this.onPlayerDeath();
            return;
        }

        // Play fall sound
        if (window.AudioManager) {
            window.AudioManager.playError();
        }

        // Brief screen effect
        const flash = this.add.graphics();
        flash.fillStyle(0x000000, 0.8);
        flash.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
        flash.setScrollFactor(0);
        flash.setDepth(1500);

        // Respawn after short delay
        this.time.delayedCall(300, () => {
            this.respawnAtCheckpoint();
            flash.destroy();
        });
    }

    attemptAutonomousCreatureRescue(trigger = 'lethal_fall') {
        const result = window.CreatureAgency?.attemptAutonomousRescue?.(
            window.GameState,
            {
                levelId: this.levelId,
                trigger,
                commit: !this.autonomousRescuePreview
            }
        );
        if (result?.changed !== true) return false;

        this.health = Math.max(1, this.health);
        this.damageTaken = (this.damageTaken || 0) + 1;
        this.updateHealthDisplay();
        this.respawnAtCheckpoint();
        this.showAutonomousRescueMoment(result);
        return true;
    }

    showAutonomousRescueMoment(result) {
        this.clearAutonomousRescueMoment();
        this.centeringStanceStatusText?.destroy?.();
        this.centeringStanceStatusText = null;
        const { width } = this.cameras.main;
        const safeArea = this.getSafeAreaInsets();
        const companionName = window.GameState?.get?.('creature.name')
            || 'Your companion';
        const powerName = result?.decision?.powerName || 'Protective Response';
        const recoveryOutcome = result?.decision?.trigger === 'lethal_fall'
            ? 'LETHAL FALL PREVENTED  //  1 HEART HELD'
            : 'EXPEDITION LOSS PREVENTED  //  1 HEART HELD';
        const maxWidth = Math.min(380, width - 32);
        const y = Math.max(94, safeArea.top + 82);

        window.FeedbackManager?.cameraFlash?.(this,
            320,
            (result?.profile?.color >> 16) & 0xFF,
            (result?.profile?.color >> 8) & 0xFF,
            result?.profile?.color & 0xFF
        );
        window.FXLibrary?.stardustBurst?.(
            this,
            this.player.x,
            this.player.y,
            {
                count: 28,
                color: [result?.profile?.color || 0x8FE3CF, 0xFFFFFF],
                duration: 1300
            }
        );
        window.AudioManager?.playAchievement?.();

        const heading = this.add.text(
            width / 2,
            y,
            `${String(companionName).slice(0, 24).toUpperCase()} MOVED FIRST`,
            {
                fontSize: width < 520 ? '15px' : '18px',
                color: '#FFFFFF',
                fontStyle: 'bold',
                align: 'center',
                backgroundColor: 'rgba(8, 12, 18, 0.94)',
                padding: { x: 16, y: 8 },
                wordWrap: { width: maxWidth }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(6200);
        const detail = this.add.text(
            width / 2,
            y + 42,
            `${powerName.toUpperCase()}  //  NO COMMAND GIVEN\n${recoveryOutcome}`,
            {
                fontSize: width < 520 ? '11px' : '13px',
                color: '#8FE3CF',
                align: 'center',
                lineSpacing: 4,
                backgroundColor: 'rgba(8, 12, 18, 0.94)',
                padding: { x: 14, y: 7 },
                wordWrap: { width: maxWidth }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(6200);

        this.autonomousRescueMomentElements = [heading, detail];
        this.autonomousRescueMomentTimer = this.time.delayedCall(2600, () => {
            this.clearAutonomousRescueMoment();
        });
    }

    clearAutonomousRescueMoment() {
        this.autonomousRescueMomentTimer?.remove?.(false);
        this.autonomousRescueMomentTimer = null;
        this.autonomousRescueMomentElements?.forEach(element => {
            element?.destroy?.();
        });
        this.autonomousRescueMomentElements = [];
    }

    /**
     * Respawn player at last checkpoint or safe position
     */
    respawnAtCheckpoint() {
        // Use explicit checkpoint if set, otherwise last safe position, otherwise level start
        const respawnPos = this.checkpointPosition ||
                          this.lastSafePosition ||
                          { x: 150, y: this.levelHeight - 200 };

        console.log(`[PlatformerLevel] Respawning at (${respawnPos.x}, ${respawnPos.y})`);

        // Teleport player
        this.player.setPosition(respawnPos.x, respawnPos.y);
        this.player.setVelocity(0, 0);
        this.resetJoystick();
        this.recoveryInputLockedUntil = this.time.now + 550;

        // Brief invincibility after respawn
        this.isInvincible = true;
        this.startInvincibilityFlash();

        this.time.delayedCall(this.invincibilityDuration, () => {
            this.endInvincibility();
        });

        // Reset respawning flag
        this.isRespawning = false;
    }

    /**
     * Handle player death
     */
    onPlayerDeath() {
        // Prevent multiple death calls (debounce)
        if (this.isPlayerDead) {
            return;
        }
        this.isPlayerDead = true;

        console.log('[PlatformerLevel] Player died');
        this.hidePlatformerMobileControls();
        this.physics.pause();

        // Record failure for contextual thoughts
        if (window.ThoughtBubbleSystem) {
            window.ThoughtBubbleSystem.recordFailure(this.levelId || this.scene.key);
        }

        // Disable input
        this.input.keyboard.enabled = false;

        // Death animation
        this.tweens.add({
            targets: this.player,
            alpha: 0,
            scaleX: 0.5,
            scaleY: 0.5,
            duration: 1000,
            onComplete: () => {
                this.showDeathScreen();
            }
        });
    }

    /**
     * Show death/retry screen
     */
    showDeathScreen() {
        const layout = this.getLevelModalLayout({
            maxWidth: 520,
            maxHeight: 440,
            margin: 18
        });
        const {
            width, height, panelWidth, panelHeight, panelX, panelY,
            contentWidth, y, font, buttonPadding
        } = layout;
        const centerX = width / 2;
        const companionName = window.GameState?.get('creature.name') || 'Your companion';
        const hasCheckpoint = Boolean(this.checkpointPosition);
        const recoveryCopy = hasCheckpoint
            ? `${companionName} stayed beside the beacon.\nTake a breath. The expedition can continue.`
            : `${companionName} is waiting at the trailhead.\nNothing important was lost. Begin again together.`;

        // Store death screen elements for cleanup
        this.deathScreenElements = [];

        // Dark overlay keeps the expedition visible without making failure feel punitive.
        const overlay = this.add.graphics();
        overlay.fillStyle(0x02070D, 0.9);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(6000);
        this.deathScreenElements.push(overlay);

        const panel = this.add.graphics();
        panel.fillStyle(0x09151D, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
        panel.lineStyle(2, 0x66C7D4, 0.95);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
        panel.setScrollFactor(0).setDepth(6001);
        this.deathScreenElements.push(panel);

        const beacon = this.add.graphics();
        beacon.lineStyle(2, 0x66C7D4, 0.8);
        beacon.lineBetween(centerX, y(40), centerX, y(72));
        beacon.fillStyle(0xF2C14E, 1);
        beacon.fillCircle(centerX, y(40), 6);
        beacon.lineStyle(2, 0x8FE3CF, 0.75);
        beacon.strokeCircle(centerX, y(40), 13);
        beacon.setScrollFactor(0).setDepth(6002);
        this.deathScreenElements.push(beacon);

        const eyebrow = this.add.text(centerX, y(82), 'PROJECT BEACON // BOND RECOVERY', {
            fontSize: font(11, 9),
            color: '#66C7D4',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(6003);
        this.deathScreenElements.push(eyebrow);

        const title = this.add.text(centerX, y(118), 'THE BOND HOLDS', {
            fontSize: font(32, 24),
            color: '#F2C14E',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(6003);
        this.deathScreenElements.push(title);

        const copy = this.add.text(centerX, y(178), recoveryCopy, {
            fontSize: font(15, 13),
            color: '#E5EEF1',
            align: 'center',
            lineSpacing: 6,
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(6003);
        this.deathScreenElements.push(copy);

        const fieldNote = this.add.text(
            centerX,
            y(230),
            'Sensei called this returning to your stance.',
            {
                fontSize: font(12, 10),
                color: '#9BAEB8',
                fontStyle: 'italic',
                align: 'center',
                wordWrap: { width: contentWidth }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(6003);
        this.deathScreenElements.push(fieldNote);

        // Retry button
        const retryLabel = hasCheckpoint
            ? 'CONTINUE FROM BEACON'
            : 'RESTART EXPEDITION';
        const retryBtn = this.add.text(centerX, y(300), retryLabel, {
            fontSize: font(18, 15),
            color: '#06201D',
            backgroundColor: '#8FE3CF',
            fontStyle: 'bold',
            padding: buttonPadding
        }).setOrigin(0.5).setScrollFactor(0).setDepth(6003).setInteractive({ cursor: 'pointer' });
        this.deathScreenElements.push(retryBtn);

        const recover = () => {
            if (hasCheckpoint) {
                this.retryFromCheckpoint();
            } else {
                this.restartLevel();
            }
        };
        retryBtn.on('pointerover', () => retryBtn.setStyle({
            color: '#FFFFFF',
            backgroundColor: '#287A72'
        }));
        retryBtn.on('pointerout', () => retryBtn.setStyle({
            color: '#06201D',
            backgroundColor: '#8FE3CF'
        }));
        retryBtn.on('pointerdown', recover);

        // Return button
        const returnBtn = this.add.text(centerX, y(356), 'RETURN TO SANCTUARY', {
            fontSize: font(14, 12),
            color: '#A8BAC3'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(6003).setInteractive({ cursor: 'pointer' });
        this.deathScreenElements.push(returnBtn);

        returnBtn.on('pointerover', () => returnBtn.setColor('#FFFFFF'));
        returnBtn.on('pointerout', () => returnBtn.setColor('#A8BAC3'));
        returnBtn.on('pointerdown', () => {
            this.returnToSanctuary();
        });

        const hint = this.add.text(
            centerX,
            y(408),
            'ENTER / SPACE continue  •  ESC sanctuary',
            {
                fontSize: font(10, 9),
                color: '#617682',
                align: 'center',
                wordWrap: { width: contentWidth }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(6003);
        this.deathScreenElements.push(hint);

        if (this.deathKeyHandler) {
            window.removeEventListener('keydown', this.deathKeyHandler);
        }
        this.deathKeyHandler = (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault?.();
                recover();
            } else if (event.key === 'Escape') {
                this.returnToSanctuary();
            }
        };
        window.addEventListener('keydown', this.deathKeyHandler);
    }

    /**
     * Safely restart the level with proper cleanup
     */
    restartLevel() {
        console.log('[PlatformerLevel] Restarting level...');

        // Prevent double-click issues
        if (this.isRestarting) {
            return;
        }
        this.isRestarting = true;
        this.clearPersistedExpeditionCheckpoint();

        this.clearDeathScreen();
        this.physics.resume();

        // Small delay to ensure cleanup completes before restart
        this.time.delayedCall(100, () => {
            this.scene.restart();
        });
    }

    retryFromCheckpoint() {
        if (!this.checkpointPosition || !this.player) {
            this.restartLevel();
            return;
        }

        this.clearDeathScreen();
        this.health = this.maxHealth;
        this.crystalEnergy = this.maxCrystalEnergy;
        this.isPlayerDead = false;
        this.isRestarting = false;
        this.isRespawning = false;
        this.isInvincible = true;

        this.player.setPosition(this.checkpointPosition.x, this.checkpointPosition.y);
        this.player.setVelocity(0, 0);
        this.resetJoystick();
        this.recoveryInputLockedUntil = this.time.now + 550;
        this.player.setAlpha(1);
        this.player.setScale(1);
        this.player.clearTint?.();
        if (this.player.body) {
            this.player.body.enable = true;
        }

        this.input.keyboard.enabled = true;
        this.showPlatformerMobileControls();
        this.updateHealthDisplay();
        this.updateEnergyDisplay();
        this.physics.resume();
        this.startInvincibilityFlash();
        this.showFloatingText(
            'PROJECT BEACON LINK RESTORED',
            this.checkpointPosition.x,
            this.checkpointPosition.y - 60,
            '#8FE3CF'
        );

        this.time.delayedCall(this.invincibilityDuration, () => {
            this.endInvincibility();
        });
    }

    clearDeathScreen() {
        if (this.deathKeyHandler) {
            window.removeEventListener('keydown', this.deathKeyHandler);
            this.deathKeyHandler = null;
        }
        if (!this.deathScreenElements) return;

        this.deathScreenElements.forEach(element => {
            try {
                element?.removeAllListeners?.();
                element?.destroy?.();
            } catch (error) {
                // Scene shutdown may have already removed an element.
            }
        });
        this.deathScreenElements = null;
    }

    /**
     * Show pause menu with resume and exit options
     */
    showPauseMenu() {
        // Prevent multiple pause menus
        if (this.pauseMenuActive || this.levelCompletionActive) return;
        this.pauseMenuActive = true;

        this.hidePlatformerMobileControls();

        // Pause physics but keep rendering
        this.physics.pause();

        const { width, height } = this.cameras.main;
        this.pauseMenuElements = [];

        // Dark overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(5000);
        this.pauseMenuElements.push(overlay);

        // Panel
        const panelWidth = Math.min(350, width - 60);
        const panelHeight = Math.min(350, height - 40);
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1025, 0.98);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.lineStyle(3, 0x9B30FF, 0.8);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.setScrollFactor(0);
        panel.setDepth(5001);
        this.pauseMenuElements.push(panel);

        // Title
        const title = this.add.text(width / 2, panelY + 38, '⏸️ PAUSED', {
            fontSize: '32px',
            color: '#E066FF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(5002);
        this.pauseMenuElements.push(title);

        // Resume button
        const resumeBtn = this.add.text(width / 2, panelY + 105, '▶️  RESUME', {
            fontSize: '20px',
            color: '#00FF88',
            backgroundColor: '#1A3D1A',
            padding: { x: 28, y: 12 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(5002).setInteractive({ useHandCursor: true });
        this.pauseMenuElements.push(resumeBtn);

        resumeBtn.on('pointerover', () => resumeBtn.setColor('#88FF88').setScale(1.05));
        resumeBtn.on('pointerout', () => resumeBtn.setColor('#00FF88').setScale(1.0));
        resumeBtn.on('pointerdown', () => {
            if (window.AudioManager) window.AudioManager.playButtonClick();
            this.hidePauseMenu();
        });

        const powerupBtn = this.add.text(width / 2, panelY + 170, '⚡  POWER-UPS', {
            fontSize: '20px',
            color: '#FFD166',
            backgroundColor: '#3B2C14',
            padding: { x: 24, y: 12 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(5002).setInteractive({ useHandCursor: true });
        this.pauseMenuElements.push(powerupBtn);

        powerupBtn.on('pointerover', () => powerupBtn.setColor('#FFF0A6').setScale(1.05));
        powerupBtn.on('pointerout', () => powerupBtn.setColor('#FFD166').setScale(1));
        powerupBtn.on('pointerdown', () => {
            window.AudioManager?.playButtonClick?.();
            this.powerupStatusMessage = null;
            this.showPowerupMenu();
        });

        // Exit to Hub button
        const exitBtn = this.add.text(width / 2, panelY + 235, '🚪  EXIT TO HUB', {
            fontSize: '20px',
            color: '#FF6666',
            backgroundColor: '#3D1A1A',
            padding: { x: 28, y: 12 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(5002).setInteractive({ useHandCursor: true });
        this.pauseMenuElements.push(exitBtn);

        exitBtn.on('pointerover', () => exitBtn.setColor('#FF9999').setScale(1.05));
        exitBtn.on('pointerout', () => exitBtn.setColor('#FF6666').setScale(1.0));
        exitBtn.on('pointerdown', () => {
            if (window.AudioManager) window.AudioManager.playButtonClick();
            this.hidePauseMenu();
            this.returnToHub();
        });

        // Hint text
        const hint = this.add.text(width / 2, panelY + panelHeight - 30, 'Press ESC to resume', {
            fontSize: '12px',
            color: '#888888'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(5002);
        this.pauseMenuElements.push(hint);

        // ESC to resume while paused
        this.pauseEscHandler = (event) => {
            if (event.key === 'Escape') {
                this.hidePauseMenu();
            }
        };
        window.addEventListener('keydown', this.pauseEscHandler);

        console.log('[PlatformerLevel] Pause menu shown');
    }

    clearPauseMenuElements() {
        if (this.pauseEscHandler) {
            window.removeEventListener('keydown', this.pauseEscHandler);
            this.pauseEscHandler = null;
        }

        this.pauseMenuElements?.forEach(element => {
            try {
                element?.removeAllListeners?.();
                element?.destroy?.();
            } catch (error) {
                // The element was already destroyed during another menu action.
            }
        });
        this.pauseMenuElements = [];
    }

    showPowerupMenu() {
        if (!this.pauseMenuActive || this.levelCompletionActive) return;

        this.clearPauseMenuElements();

        const { width, height } = this.cameras.main;
        const manager = window.InventoryManager;
        const powerups = (manager?.getAllItems?.() || [])
            .map((item, slot) => ({ item, slot }))
            .filter(({ item }) => item.type === 'powerup' && item.usableInLevel)
            .slice(0, 6);
        const rowCount = Math.max(1, powerups.length);
        const panelWidth = Math.min(440, width - 32);
        const panelHeight = Math.min(height - 32, 165 + rowCount * 50);
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.84);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0).setDepth(5000);

        const panel = this.add.graphics();
        panel.fillStyle(0x111827, 0.99);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 14);
        panel.lineStyle(2, 0xD6A94A, 0.95);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 14);
        panel.setScrollFactor(0).setDepth(5001);

        const title = this.add.text(width / 2, panelY + 26, '⚡ EXPEDITION POWER-UPS', {
            fontSize: width < 520 ? '19px' : '23px',
            color: '#FFD166',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(5002);

        const status = this.add.text(
            width / 2,
            panelY + 56,
            this.powerupStatusMessage || 'Activate an item without leaving the expedition.',
            {
                fontSize: width < 520 ? '11px' : '13px',
                color: this.powerupStatusMessage ? '#8FE3CF' : '#AAB6C4',
                align: 'center',
                wordWrap: { width: panelWidth - 36 }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(5002);

        this.pauseMenuElements.push(overlay, panel, title, status);

        const rowStartY = panelY + 82;
        const rowWidth = panelWidth - 28;
        const rowX = panelX + 14;

        if (powerups.length === 0) {
            const empty = this.add.text(
                width / 2,
                rowStartY + 24,
                'No power-ups packed.\nVisit the Sanctuary shop before your next expedition.',
                {
                    fontSize: '14px',
                    color: '#AAB6C4',
                    align: 'center',
                    wordWrap: { width: rowWidth - 30 }
                }
            ).setOrigin(0.5).setScrollFactor(0).setDepth(5002);
            this.pauseMenuElements.push(empty);
        }

        powerups.forEach(({ item, slot }, index) => {
            const rowY = rowStartY + index * 50;
            const row = this.add.graphics();
            row.fillStyle(0x1D2938, 1);
            row.fillRoundedRect(rowX, rowY, rowWidth, 42, 6);
            row.lineStyle(1, 0x40536A, 0.9);
            row.strokeRoundedRect(rowX, rowY, rowWidth, 42, 6);
            row.setScrollFactor(0).setDepth(5002);

            const name = this.add.text(
                rowX + 12,
                rowY + 21,
                `${item.icon || '⚡'} ${item.name}  x${item.quantity || 1}`,
                {
                    fontSize: width < 520 ? '13px' : '15px',
                    color: '#F3F7FA'
                }
            ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(5003);

            const useButton = this.add.text(
                rowX + rowWidth - 10,
                rowY + 21,
                'USE',
                {
                    fontSize: '12px',
                    color: '#111827',
                    backgroundColor: '#FFD166',
                    fontStyle: 'bold',
                    padding: { x: 12, y: 7 }
                }
            ).setOrigin(1, 0.5).setScrollFactor(0).setDepth(5003)
                .setInteractive({ useHandCursor: true });

            useButton.on('pointerdown', () => {
                let activation = null;
                const success = manager.useItem(slot, {
                    applyPowerup: (effect, powerupItem) => {
                        activation = this.applyPowerupEffect(effect, powerupItem);
                        return activation;
                    }
                });
                this.powerupStatusMessage = activation?.message ||
                    (success ? `${item.name} activated` : `${item.name} cannot be used now`);
                window.AudioManager?.[
                    success ? 'playLevelUp' : 'playError'
                ]?.();
                this.showPowerupMenu();
            });

            this.pauseMenuElements.push(row, name, useButton);
        });

        const backButton = this.add.text(
            width / 2,
            panelY + panelHeight - 25,
            '← BACK',
            {
                fontSize: '14px',
                color: '#FFFFFF',
                backgroundColor: '#334155',
                padding: { x: 18, y: 8 }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(5003)
            .setInteractive({ useHandCursor: true });
        backButton.on('pointerdown', () => this.returnToPauseMenu());
        this.pauseMenuElements.push(backButton);

        this.pauseEscHandler = (event) => {
            if (event.key === 'Escape') {
                this.returnToPauseMenu();
            }
        };
        window.addEventListener('keydown', this.pauseEscHandler);
    }

    returnToPauseMenu() {
        if (!this.pauseMenuActive) return;
        this.clearPauseMenuElements();
        this.pauseMenuActive = false;
        this.showPauseMenu();
    }

    /**
     * Hide the pause menu and resume game
     */
    hidePauseMenu() {
        if (!this.pauseMenuActive) return;

        this.clearPauseMenuElements();

        this.pauseMenuActive = false;

        this.showPlatformerMobileControls();

        // Resume physics
        this.physics.resume();
    }

    getCurrentEcologyNodeConfig() {
        return CURRENT_NODE_LEVEL_CONFIG[this.levelId] || null;
    }

    isCurrentEcologyReadOnly() {
        return Boolean(
            this.currentEcologyPreview ||
            this.entryPreview ||
            this.recoveryPreview ||
            this.centeringStancePreview ||
            this.resultPreview ||
            this.highPowerPreview ||
            this.testMode
        );
    }

    prepareCurrentEcologyPreview() {
        if (!this.currentEcologyPreview) return false;
        const node = this.currentEcologyNode;
        if (this.player && node) {
            this.player.setPosition(
                Math.max(80, node.x - 90),
                node.y
            );
            this.currentEcologyPlayerNearby = true;
            node.prompt?.setVisible?.(true);
            this.cameras.main.centerOn(node.x, node.y);
        }
        this.physics?.resume?.();
        this.showPlatformerMobileControls?.();
        this.time.delayedCall(250, () => {
            this.showCurrentEcologyModal();
        });
        return true;
    }

    createCurrentEcologyNode() {
        const config = this.getCurrentEcologyNodeConfig();
        const ecology = window.CurrentEcology;
        if (!config || !ecology?.getCurrentRegionSnapshot || !window.GameState) {
            return null;
        }

        this.clearCurrentEcologyNode();
        if (!this.isCurrentEcologyReadOnly()) {
            ecology.applyCurrentArrivalConsequence?.(
                window.GameState,
                this.levelId
            );
        }
        const snapshot = ecology.getCurrentRegionSnapshot(window.GameState, this.levelId);
        if (!snapshot) return null;

        const x = config.x;
        const y = this.levelHeight - config.groundOffset;
        const compactNodeLayout =
            this.isMobile || this.cameras.main.height < 620;
        const fieldWash = this.add.rectangle(
            this.levelWidth / 2,
            this.levelHeight / 2,
            this.levelWidth,
            this.levelHeight,
            snapshot.projection.primaryColor,
            0
        ).setDepth(-15);
        fieldWash.setBlendMode?.(Phaser.BlendModes.ADD);

        // Platform sprites in some realms use their world Y as depth. Keep this
        // landmark above terrain while leaving the fixed HUD and modals above it.
        const environment = this.add.graphics().setDepth(820);
        const visual = this.add.graphics().setPosition(x, y).setDepth(840);
        const label = this.add.text(
            x,
            y - (compactNodeLayout ? 80 : 78),
            config.label,
            {
            fontSize: '12px',
            color: '#FFFFFF',
            backgroundColor: 'rgba(5, 8, 16, 0.82)',
            padding: { x: 7, y: 4 }
            }
        ).setOrigin(0.5).setDepth(845);
        const status = this.add.text(
            x,
            y + (compactNodeLayout ? -55 : 55),
            '',
            {
            fontSize: '11px',
            color: '#FFFFFF',
            backgroundColor: 'rgba(5, 8, 16, 0.82)',
            padding: { x: 7, y: 4 }
            }
        ).setOrigin(0.5).setDepth(845);
        const echoStatus = this.add.text(
            x,
            y + (compactNodeLayout ? -30 : 80),
            '',
            {
            fontSize: '10px',
            color: '#FFFFFF',
            backgroundColor: 'rgba(5, 8, 16, 0.82)',
            padding: { x: 7, y: 4 },
            align: 'center'
            }
        ).setOrigin(0.5).setDepth(845).setVisible(false);
        const prompt = this.add.text(
            x,
            y - (compactNodeLayout ? 115 : 110),
            'TAP / E  READ CURRENT',
            {
            fontSize: '12px',
            color: '#FFFFFF',
            backgroundColor: 'rgba(5, 8, 16, 0.92)',
            padding: { x: 9, y: 6 }
            }
        ).setOrigin(0.5).setDepth(846).setVisible(false);
        const zone = this.add.zone(x, y, 120, 150)
            .setInteractive({ useHandCursor: true })
            .setDepth(847);
        zone.on('pointerdown', () => this.showCurrentEcologyModal());

        this.currentEcologyNode = {
            config,
            x,
            y,
            snapshot,
            fieldWash,
            environment,
            visual,
            label,
            status,
            echoStatus,
            prompt,
            zone,
            pulseTween: null,
            elements: [
                fieldWash,
                environment,
                visual,
                label,
                status,
                echoStatus,
                prompt,
                zone
            ]
        };
        this.drawCurrentEcologyProjection(snapshot.projection);
        return this.currentEcologyNode;
    }

    drawCurrentEcologyProjection(projection) {
        const node = this.currentEcologyNode;
        if (!node || !projection) return;

        node.snapshot.projection = projection;
        node.visual.clear();
        node.visual.fillStyle(projection.secondaryColor, 0.88);
        node.visual.fillCircle(0, 0, 42);
        node.visual.lineStyle(5, projection.primaryColor, 0.95);
        if (projection.nodeState === 'severed') {
            node.visual.beginPath();
            node.visual.arc(0, 0, 33, -1.2, 1.05);
            node.visual.strokePath();
            node.visual.beginPath();
            node.visual.arc(0, 0, 33, 1.9, 4.1);
            node.visual.strokePath();
            node.visual.lineBetween(-18, -8, -4, 6);
            node.visual.lineBetween(7, -10, 20, 4);
        } else {
            node.visual.strokeCircle(0, 0, 33);
            node.visual.lineStyle(2, projection.accentColor, 0.75);
            node.visual.strokeCircle(0, 0, 22);
        }
        node.visual.fillStyle(projection.primaryColor, 0.9);
        node.visual.fillCircle(0, 0, 10);

        node.environment.clear();
        const visibleLife = Math.round(12 * projection.lifeDensity);
        for (let index = 0; index < 12; index++) {
            const direction = index % 2 === 0 ? -1 : 1;
            const offsetX = direction * (65 + (index % 6) * 24);
            const baseY = node.y + 36 + (index % 3) * 5;
            const alive = index < visibleLife;
            const stemHeight = 18 + (index % 4) * 7;
            node.environment.lineStyle(
                3,
                alive ? projection.primaryColor : 0x3A3138,
                alive ? 0.7 : 0.25
            );
            node.environment.lineBetween(
                node.x + offsetX,
                baseY,
                node.x + offsetX,
                baseY - stemHeight
            );
            node.environment.fillStyle(
                alive ? projection.accentColor : 0x332B31,
                alive ? 0.75 : 0.2
            );
            node.environment.fillCircle(
                node.x + offsetX + direction * 4,
                baseY - stemHeight,
                alive ? 4 : 3
            );
        }

        node.status.setText(
            `${projection.label}  //  ${projection.vitality}% VITALITY`
        );
        node.status.setColor(`#${projection.primaryColor.toString(16).padStart(6, '0')}`);
        const arrivalPresentation =
            node.snapshot.arrivalConsequence?.presentation;
        node.echoStatus.setVisible(Boolean(arrivalPresentation));
        if (arrivalPresentation) {
            node.echoStatus.setText(arrivalPresentation.statusLine);
            node.echoStatus.setColor(
                `#${arrivalPresentation.primaryColor
                    .toString(16)
                    .padStart(6, '0')}`
            );
        }
        node.fieldWash.setFillStyle(
            projection.primaryColor,
            projection.glowAlpha * 0.1
        );

        if (node.pulseTween) {
            node.pulseTween.stop();
        }
        node.visual.setScale(1).setAlpha(1);
        node.pulseTween = this.tweens.add({
            targets: node.visual,
            scaleX: { from: 0.96, to: 1.08 },
            scaleY: { from: 0.96, to: 1.08 },
            alpha: { from: 0.72, to: 1 },
            duration: projection.pulseRate,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        this.renderCurrentAtmosphere(node.snapshot);
    }

    renderCurrentAtmosphere(snapshot) {
        const node = this.currentEcologyNode;
        if (!node || !snapshot) return null;

        this.clearCurrentAtmosphere();
        const atmosphere = getCurrentAtmosphereProjection(snapshot);
        const lifeForms = [];
        const motes = [];
        const tweens = [];
        const elements = [];
        const primaryColor = snapshot.projection.primaryColor;
        const accentColor = snapshot.projection.accentColor;

        for (let index = 0; index < 12; index++) {
            const direction = index % 2 === 0 ? -1 : 1;
            const lane = Math.floor(index / 2);
            const x = node.x + direction * (82 + lane * 31);
            const y = node.y - 12 - ((index * 37) % 92);
            const life = this.add.graphics()
                .setPosition(x, y)
                .setDepth(830)
                .setVisible(index < atmosphere.lifeFormCount);
            life.fillStyle(primaryColor, 0.78);
            life.fillEllipse(0, 0, 12, 7);
            life.fillStyle(accentColor, 0.72);
            life.fillTriangle(
                direction * -4,
                -1,
                direction * -11,
                -5,
                direction * -10,
                4
            );
            life.fillStyle(0xF4F4F4, 0.92);
            life.fillCircle(direction * 3, -1, 1.4);
            lifeForms.push(life);
            elements.push(life);

            if (index < atmosphere.lifeFormCount) {
                tweens.push(this.tweens.add({
                    targets: life,
                    x: x + direction * atmosphere.driftRange,
                    y: y - 4 - (index % 3) * 3,
                    angle: direction * (3 + index % 4),
                    duration:
                        atmosphere.motionDurationMs + index * 47,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                }));
            }
        }

        for (let index = 0; index < 24; index++) {
            const column = index % 8;
            const row = Math.floor(index / 8);
            const x = node.x - 215 + column * 61 + row * 13;
            const y = node.y - 116 + row * 48 + (column % 2) * 15;
            const mote = this.add.circle(
                x,
                y,
                1.5 + (index % 3) * 0.7,
                index % 4 === 0 ? accentColor : primaryColor,
                0.5 + (index % 3) * 0.12
            ).setDepth(828).setVisible(index < atmosphere.moteCount);
            mote.setBlendMode?.(Phaser.BlendModes.ADD);
            motes.push(mote);
            elements.push(mote);

            if (index < atmosphere.moteCount) {
                tweens.push(this.tweens.add({
                    targets: mote,
                    y: y - atmosphere.driftRange,
                    x: x + ((index % 3) - 1) * 7,
                    alpha: { from: 0.35, to: 0.9 },
                    duration:
                        atmosphere.motionDurationMs + index * 31,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                }));
            }
        }

        const scars = this.add.graphics().setDepth(835);
        for (let index = 0; index < atmosphere.scarCount; index++) {
            const direction = index % 2 === 0 ? -1 : 1;
            const startX = node.x + direction * (48 + (index % 4) * 18);
            const startY = node.y - 34 + (index % 3) * 27;
            scars.lineStyle(5, 0x111111, 0.8);
            scars.beginPath();
            scars.moveTo(startX, startY);
            scars.lineTo(startX + direction * 9, startY + 8);
            scars.lineTo(startX + direction * 4, startY + 17);
            scars.lineTo(startX + direction * 14, startY + 25);
            scars.strokePath();
            scars.lineStyle(2, 0xD94B4B, 0.9);
            scars.beginPath();
            scars.moveTo(startX, startY);
            scars.lineTo(startX + direction * 9, startY + 8);
            scars.lineTo(startX + direction * 4, startY + 17);
            scars.lineTo(startX + direction * 14, startY + 25);
            scars.strokePath();
        }
        elements.push(scars);

        const audioTimer = this.time.addEvent({
            delay: atmosphere.soundscape.intervalMs,
            loop: true,
            callback: () => {
                window.AudioManager?.playSound?.(
                    atmosphere.soundscape.cueId,
                    atmosphere.soundscape.volume
                );
            }
        });

        this.currentAtmosphereProjection = atmosphere;
        this.currentAtmosphere = {
            lifeForms,
            motes,
            scars,
            tweens,
            audioTimer,
            elements
        };
        return atmosphere;
    }

    clearCurrentAtmosphere() {
        const atmosphere = this.currentAtmosphere;
        atmosphere?.audioTimer?.remove?.();
        atmosphere?.tweens?.forEach(tween => {
            tween?.stop?.();
            tween?.remove?.();
        });
        atmosphere?.elements?.forEach(element => {
            element?.destroy?.();
        });
        this.currentAtmosphere = null;
        this.currentAtmosphereProjection = null;
    }

    refreshCurrentEcologyNode({ celebrate = false } = {}) {
        const node = this.currentEcologyNode;
        const snapshot = window.CurrentEcology?.getCurrentRegionSnapshot?.(
            window.GameState,
            this.levelId
        );
        if (!node || !snapshot) return null;

        node.snapshot = snapshot;
        this.drawCurrentEcologyProjection(snapshot.projection);
        this.renderCurrentEcologyModalState();
        if (celebrate) {
            window.FeedbackManager?.cameraFlash?.(this, 450, 143, 227, 207);
            window.FXLibrary?.stardustBurst?.(this, node.x, node.y, {
                count: 28,
                color: [
                    snapshot.projection.primaryColor,
                    snapshot.projection.accentColor
                ],
                duration: 1500
            });
        }
        return snapshot;
    }

    updateCurrentEcologyNodeProximity() {
        const node = this.currentEcologyNode;
        if (!node || !this.player || this.currentEcologyModalElements.length > 0) {
            return;
        }

        const distance = Phaser.Math.Distance.Between(
            this.player.x,
            this.player.y,
            node.x,
            node.y
        );
        const nearby = distance <= 165;
        if (nearby !== this.currentEcologyPlayerNearby) {
            this.currentEcologyPlayerNearby = nearby;
            node.prompt.setVisible(nearby);
        }
    }

    hasObservedCurrentEcologyNode() {
        return Boolean(
            this.currentEcologyNode?.snapshot?.region?.actionCounts?.observe > 0
        );
    }

    getCurrentEcologyInstruction() {
        if (!this.hasObservedCurrentEcologyNode()) {
            return 'SCAN FIRST // Observe the living rhythm before Project Beacon changes it.';
        }

        return 'SCAN LOGGED // Protect or Redirect helps this habitat. Siphon gains power by weakening it.';
    }

    getCurrentEcologyActionButtonLabel(actionId) {
        const presentation = getCurrentRegionActionPresentation(actionId);
        if (!presentation) return actionId.toUpperCase();

        const observed = this.hasObservedCurrentEcologyNode();
        if (actionId === 'observe' && observed) {
            return `${presentation.label}\nSCAN LOGGED`;
        }
        if (actionId !== 'observe' && !observed) {
            return `${presentation.label}\nSCAN REQUIRED`;
        }
        return `${presentation.label}\n${presentation.effectLabel.replace(' / ', '\n')}`;
    }

    renderCurrentEcologyActionButtons() {
        const observed = this.hasObservedCurrentEcologyNode();
        this.currentEcologyModalActionButtons?.forEach((button, actionId) => {
            const locked = actionId !== 'observe' && !observed;
            const logged = actionId === 'observe' && observed;
            const backgroundColor = locked || logged
                ? '#343B49'
                : actionId === 'siphon'
                    ? '#7A2525'
                    : actionId === 'observe'
                        ? '#25627A'
                        : '#287A72';
            button
                .setText(this.getCurrentEcologyActionButtonLabel(actionId))
                .setBackgroundColor(backgroundColor)
                .setAlpha(locked || logged ? 0.62 : 1);
        });
    }

    handleCurrentEcologyAction(actionId) {
        const observed = this.hasObservedCurrentEcologyNode();
        if (actionId !== 'observe' && !observed) {
            this.renderCurrentEcologyModalState(
                'SCAN REQUIRED // Observe first. A living system should be understood before it is changed.'
            );
            window.AudioManager?.playError?.();
            return {
                changed: false,
                reason: 'observation_required',
                actionId
            };
        }
        if (actionId === 'observe' && observed) {
            this.renderCurrentEcologyModalState(
                'SCAN LOGGED // The field record already contains this living rhythm.'
            );
            return {
                changed: false,
                reason: 'already_observed',
                actionId
            };
        }
        return this.applyCurrentEcologyAction(actionId);
    }

    showCurrentEcologyModal() {
        const node = this.currentEcologyNode;
        if (!node || this.currentEcologyModalElements.length > 0) return;

        const layout = this.getLevelModalLayout({
            maxWidth: 440,
            maxHeight: 500,
            margin: 16
        });
        const {
            width, height, panelWidth, panelHeight, panelX, panelY,
            contentWidth, y, font
        } = layout;
        this.currentEcologyWasPaused = Boolean(this.physics?.world?.isPaused);
        this.physics?.pause?.();
        this.hidePlatformerMobileControls?.();

        const overlay = this.add.rectangle(0, 0, width, height, 0x050811, 0.88)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(6100);
        const panel = this.add.graphics().setScrollFactor(0).setDepth(6101);
        panel.fillStyle(0x101522, 0.98);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
        panel.lineStyle(3, node.snapshot.projection.primaryColor, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);

        const title = this.add.text(width / 2, y(35), 'CURRENT FIELD INTERFACE', {
            fontSize: font(21, 17),
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(6102);
        const region = this.add.text(
            width / 2,
            y(66),
            `${node.snapshot.definition.label.toUpperCase()}  //  ${node.snapshot.projection.label}`,
            {
                fontSize: font(13, 11),
                fontFamily: 'Arial, sans-serif',
                color: '#8FE3CF'
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(6102);
        const fieldLine = this.add.text(
            width / 2,
            y(103),
            [
                node.snapshot.projection.fieldLine,
                this.currentAtmosphereProjection?.companionLine
            ].filter(Boolean).join('\n'),
            {
                fontSize: font(14, 12),
                fontFamily: 'Arial, sans-serif',
                color: '#D8DEE9',
                align: 'center',
                wordWrap: { width: contentWidth }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(6102);

        const barX = width / 2 - contentWidth / 2;
        const barY = y(145);
        const barBg = this.add.rectangle(
            barX,
            barY,
            contentWidth,
            14,
            0x272D3A,
            1
        ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(6102);
        const barFill = this.add.rectangle(
            barX,
            barY,
            contentWidth * node.snapshot.projection.vitality / 100,
            14,
            node.snapshot.projection.primaryColor,
            1
        ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(6103);
        const vitality = this.add.text(
            width / 2,
            y(170),
            `LOCAL VITALITY ${node.snapshot.projection.vitality}%`,
            {
                fontSize: font(12, 10),
                fontFamily: 'Arial, sans-serif',
                color: '#FFFFFF'
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(6102);
        const resultText = this.add.text(
            width / 2,
            y(220),
            node.snapshot.arrivalConsequence?.presentation
                ? [
                    node.snapshot.arrivalConsequence.presentation.label,
                    node.snapshot.arrivalConsequence.presentation.fieldLine
                ].join(' // ')
                : this.getCurrentEcologyInstruction(),
            {
                fontSize: font(13, 11),
                fontFamily: 'Arial, sans-serif',
                color: '#F2C14E',
                align: 'center',
                wordWrap: { width: contentWidth }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(6102);

        this.currentEcologyModalElements = [
            overlay, panel, title, region, fieldLine, barBg, barFill,
            vitality, resultText
        ];
        this.currentEcologyModalView = {
            panel,
            region,
            fieldLine,
            barFill,
            vitality,
            resultText,
            barWidth: contentWidth
        };

        const actionIds = ['observe', 'protect', 'redirect', 'siphon'];
        this.currentEcologyModalActionButtons = new Map();
        actionIds.forEach((actionId, index) => {
            const column = index % 2;
            const row = Math.floor(index / 2);
            const actionX = width / 2 + (column === 0 ? -contentWidth * 0.26 : contentWidth * 0.26);
            const actionY = y(292 + row * 72);
            const actionWidth = Math.max(96, contentWidth * 0.48);
            const button = this.add.text(
                actionX,
                actionY,
                this.getCurrentEcologyActionButtonLabel(actionId),
                {
                    fontSize: font(13, 11),
                    fontFamily: 'Arial, sans-serif',
                    color: '#FFFFFF',
                    backgroundColor: '#343B49',
                    fontStyle: 'bold',
                    align: 'center',
                    lineSpacing: 3,
                    padding: { x: 8, y: 7 }
                }
            ).setFixedSize(actionWidth, 58)
                .setOrigin(0.5).setScrollFactor(0).setDepth(6103)
                .setInteractive({ useHandCursor: true });
            button.on('pointerdown', () => this.handleCurrentEcologyAction(actionId));
            this.currentEcologyModalActionButtons.set(actionId, button);
            this.currentEcologyModalElements.push(button);
        });
        this.renderCurrentEcologyActionButtons();

        const close = this.add.text(width / 2, y(450), 'RETURN TO EXPEDITION', {
            fontSize: font(14, 12),
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            backgroundColor: '#3A4050',
            padding: { x: 20, y: 12 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(6103)
            .setInteractive({ useHandCursor: true });
        close.on('pointerdown', () => this.clearCurrentEcologyModal());
        this.currentEcologyModalElements.push(close);
    }

    renderCurrentEcologyModalState(message = null) {
        const view = this.currentEcologyModalView;
        const projection = this.currentEcologyNode?.snapshot?.projection;
        if (!view || !projection) return;

        view.panel.clear();
        const layout = this.getLevelModalLayout({
            maxWidth: 440,
            maxHeight: 500,
            margin: 16
        });
        view.panel.fillStyle(0x101522, 0.98);
        view.panel.fillRoundedRect(
            layout.panelX,
            layout.panelY,
            layout.panelWidth,
            layout.panelHeight,
            8
        );
        view.panel.lineStyle(3, projection.primaryColor, 1);
        view.panel.strokeRoundedRect(
            layout.panelX,
            layout.panelY,
            layout.panelWidth,
            layout.panelHeight,
            8
        );
        view.region.setText(
            `${this.currentEcologyNode.snapshot.definition.label.toUpperCase()}  //  ${projection.label}`
        );
        view.fieldLine.setText([
            projection.fieldLine,
            this.currentAtmosphereProjection?.companionLine
        ].filter(Boolean).join('\n'));
        view.barFill.setFillStyle(projection.primaryColor, 1);
        view.barFill.setDisplaySize(
            view.barWidth * projection.vitality / 100,
            view.barFill.height
        );
        view.vitality.setText(`LOCAL VITALITY ${projection.vitality}%`);
        view.resultText.setText(message || this.getCurrentEcologyInstruction());
        this.renderCurrentEcologyActionButtons();
    }

    applyCurrentEcologyAction(actionId) {
        const ecology = window.CurrentEcology;
        if (!ecology?.recordCurrentRegionAction || !window.GameState) return null;
        if (this.isCurrentEcologyReadOnly()) {
            this.renderCurrentEcologyModalState(
                'PREVIEW ONLY // No save data or field resources were changed.'
            );
            return {
                changed: false,
                reason: 'preview_read_only',
                actionId
            };
        }

        const result = ecology.recordCurrentRegionAction(
            window.GameState,
            this.levelId,
            actionId,
            {
                operationId: [
                    'local',
                    this.levelId,
                    Date.now(),
                    this.currentEcologyOperationSequence++
                ].join('_')
            }
        );
        if (!result) return null;

        if (result.changed) {
            this.refreshCurrentEcologyNode();
            if (actionId === 'siphon') {
                this.crystalEnergy = Math.min(
                    this.maxCrystalEnergy || 5,
                    (this.crystalEnergy || 0) + 1
                );
            }
            this.showFloatingText(
                result.action.companionLine,
                this.player.x,
                this.player.y - 75,
                actionId === 'siphon' ? '#F28B82' : '#8FE3CF'
            );
            this.renderCurrentEcologyModalState(
                `${result.action.result}\n${result.beforeVitality}% → ${result.afterVitality}%`
            );
        } else {
            const message = {
                already_observed: 'This rhythm is already in the field record.',
                observation_required: 'SCAN REQUIRED // Observe before influencing this living system.',
                guardian_restored: 'The guardian now protects this node. No extraction permitted.',
                duplicate_operation: 'This field action was already recorded.'
            }[result.reason] || 'The Current does not respond.';
            this.renderCurrentEcologyModalState(message);
        }
        return result;
    }

    clearCurrentEcologyModal({ resume = true } = {}) {
        this.currentEcologyModalElements?.forEach(element => {
            element?.removeAllListeners?.();
            element?.destroy?.();
        });
        this.currentEcologyModalElements = [];
        this.currentEcologyModalActionButtons = new Map();
        this.currentEcologyModalView = null;
        if (
            resume &&
            !this.currentEcologyWasPaused &&
            !this.levelCompletionActive &&
            !this.isPlayerDead
        ) {
            this.physics?.resume?.();
            this.showPlatformerMobileControls?.();
        }
        this.currentEcologyWasPaused = false;
    }

    clearCurrentEcologyNode() {
        this.clearCurrentAtmosphere();
        const node = this.currentEcologyNode;
        if (!node) return;
        node.pulseTween?.stop?.();
        node.elements?.forEach(element => {
            element?.removeAllListeners?.();
            element?.destroy?.();
        });
        this.currentEcologyNode = null;
        this.currentEcologyPlayerNearby = false;
    }

    /**
     * Return to hub world
     */
    returnToHub() {
        if (this._returningToHub) return;
        this._returningToHub = true;

        if (this.levelCompletionKeyHandler) {
            window.removeEventListener('keydown', this.levelCompletionKeyHandler);
            this.levelCompletionKeyHandler = null;
        }

        // Reset physics for hub (top-down)
        this.physics.world.gravity.y = 0;

        // Go to HubWorldScene
        this.scene.start('HubWorldScene');
    }

    /**
     * Return to sanctuary (main hub)
     */
    returnToSanctuary() {
        // Reset physics for sanctuary (top-down)
        this.physics.world.gravity.y = 0;

        // Transition to GameScene
        this.scene.start('GameScene', { biome: 'nebula' });
    }

    /**
     * Clean up on shutdown
     */
    shutdown() {
        console.log('[PlatformerLevel] Shutting down - cleaning up resources');

        this.scale?.off?.('resize', this.layoutKatanaUpgradeDisplay, this);
        window.EconomyManager?.clearLevelCoinMultiplier?.();
        this.katanaArtifactModal?.destroy?.();
        this.katanaArtifactModal = null;
        this.companionMediaRequest += 1;
        this.companionRescueTableau?.destroy?.();
        this.companionRescueTableau = null;
        this.residentReleaseOpen = false;
        this.residentReleaseTableau?.destroy?.();
        this.residentReleaseTableau = null;
        this.residentReleaseElements?.forEach(element => element?.destroy?.());
        this.residentReleaseElements = [];
        this.clearCurrentEcologyModal({ resume: false });
        this.clearCurrentEcologyNode();
        this.clearAutonomousRescueMoment();
        this.clearMobileControlCoach();

        // Remove keyboard listeners
        if (this.input && this.input.keyboard) {
            this.input.keyboard.off('keydown-ESC');
            if (this.attackKey) this.attackKey.off('down');
            if (this.specialKey) this.specialKey.off('down');
            if (this.rangedKey) this.rangedKey.off('down');
            if (this.currentEcologyInteractKey) {
                this.currentEcologyInteractKey.off('down');
            }
        }

        // Clean up mobile controls
        if (this.mobileControlElements && this.mobileControlElements.length > 0) {
            this.mobileControlElements.forEach(element => {
                try {
                    element?.removeAllListeners?.();
                    element?.destroy?.();
                } catch (e) {
                    // Element may already be destroyed
                }
            });
        this.mobileControlElements = [];
        }

        // Reset mobile control state
        this.joystickActive = false;
        this.virtualJoystickX = 0;
        this.virtualJumpPressed = false;
        this.joystickThumb = null;
        this.mobileControlTargets = {};

        // Clean up pause menu
        if (this.pauseEscHandler) {
            window.removeEventListener('keydown', this.pauseEscHandler);
            this.pauseEscHandler = null;
        }
        if (this.deathKeyHandler) {
            window.removeEventListener('keydown', this.deathKeyHandler);
            this.deathKeyHandler = null;
        }
        if (this.levelCompletionKeyHandler) {
            window.removeEventListener('keydown', this.levelCompletionKeyHandler);
            this.levelCompletionKeyHandler = null;
        }
        if (this.pauseMenuElements && this.pauseMenuElements.length > 0) {
            this.pauseMenuElements.forEach(el => {
                try {
                    el?.removeAllListeners?.();
                    el?.destroy?.();
                } catch (e) {
                    // Element already destroyed - safe to ignore during shutdown
                }
            });
            this.pauseMenuElements = [];
        }
        this.pauseMenuActive = false;

        // Clear timers
        if (this.time) {
            this.time.removeAllEvents();
        }

        // Kill tweens
        if (this.tweens) {
            this.tweens.killAll();
        }

        // Reset gravity
        if (this.physics && this.physics.world) {
            this.physics.world.gravity.y = 0;
        }

        // Clean up ParallaxBiome
        if (window.ParallaxBiome) {
            window.ParallaxBiome.cleanup();
        }

        // Clean up death screen elements if they exist
        if (this.deathScreenElements) {
            this.deathScreenElements.forEach(el => {
                try {
                    el?.removeAllListeners?.();
                    el?.destroy?.();
                } catch (e) {
                    // Element may already be destroyed
                }
            });
            this.deathScreenElements = null;
        }

        // Clean up combat juice system
        if (this.combatJuice) {
            this.combatJuice.cleanup();
            this.combatJuice = null;
        }

        // Null references
        this.astronautFollower?.destroy();
        this.astronautFollower = null;
        this.destroyGuardianTeamSupportEcho();
        this.player = null;
        this.platforms = null;
        this.enemies = null;
        this.graphicsEngine = null;
        this.isPlayerDead = false;
        this.isRestarting = false;

        console.log('[PlatformerLevel] Cleanup complete');
    }

    // ==========================================
    // CREATURE INTELLIGENCE HOOKS
    // ==========================================

    /**
     * Record level success for contextual thoughts
     * Call from child classes when level is completed
     */
    recordLevelSuccess() {
        if (window.ThoughtBubbleSystem) {
            window.ThoughtBubbleSystem.recordSuccess(this.levelId || this.scene.key);
        }
    }

    /**
     * Freeze the expedition once its guardian has been restored.
     * Phaser timers and tweens continue so each level can finish its celebration.
     */
    enterLevelCompletionState() {
        if (this.levelCompletionActive) return false;

        this.levelCompletionActive = true;
        this.virtualJoystickX = 0;
        this.virtualJumpPressed = false;
        this.jumpBufferPressed = false;
        this.player?.setVelocity?.(0, 0);
        this.hidePlatformerMobileControls?.();
        this.physics?.pause?.();
        return true;
    }

    /**
     * Add a consistent keyboard route out of every level result screen.
     */
    bindLevelCompletionReturn(returnAction = () => this.returnToHub()) {
        this.enterLevelCompletionState();

        if (this.levelCompletionKeyHandler) {
            window.removeEventListener('keydown', this.levelCompletionKeyHandler);
        }

        this.levelCompletionKeyHandler = (event) => {
            if (!['Enter', ' ', 'Escape'].includes(event.key)) return;
            event.preventDefault?.();
            returnAction();
        };
        window.addEventListener('keydown', this.levelCompletionKeyHandler);
    }

    showKatanaUpgradeReveal({ onClose = null } = {}) {
        if (!this.levelCompletionResult?.katanaUpgradeAwarded) {
            onClose?.();
            return false;
        }

        const fieldKit = window.GameState?.get?.(
            'story.projectBeacon.fieldKit'
        ) || {};
        const creatureName = window.GameState?.get?.('creature.name') || 'Your companion';
        this.katanaArtifactModal?.destroy?.();
        this.katanaArtifactModal = new KatanaArtifactModal(this);
        const shown = this.katanaArtifactModal.show({
            fieldKit,
            creatureName,
            context: 'upgrade',
            onClose: () => {
                this.katanaArtifactModal = null;
                onClose?.();
            }
        });

        if (!shown) {
            this.katanaArtifactModal = null;
            onClose?.();
        }
        return shown;
    }

    /**
     * Keep the rescue payoff connected to the persistent Sanctuary resident.
     */
    getGuardianSanctuaryArrivalCopy({ compact = false } = {}) {
        const guardian = this.levelCompletionResult?.guardianResident;
        const resident = this.levelCompletionResult?.rescuedResident;
        if (resident) {
            return compact
                ? `${resident.name} FREED -> SANCTUARY // ${resident.role}`
                : `LOCAL RESCUED // ${resident.name}\n${resident.role} // ${resident.supportLabel}`;
        }
        if (!guardian) return null;

        if (!guardian.newlyRescued) {
            return compact
                ? `${guardian.name} // SANCTUARY RESIDENT`
                : `SANCTUARY RESIDENT // ${guardian.name}\n${guardian.role} remains on duty near Wanderer-77.`;
        }

        return compact
            ? `${guardian.name} -> SANCTUARY // ${guardian.role}`
            : `SANCTUARY ARRIVAL // ${guardian.name}\n${guardian.role} // ${guardian.routine}`;
    }

    getVillageCompletionCopy({ compact = false } = {}) {
        const support = this.villageSupport || {};
        const lines = [];
        if (support.victoryCoinBonus > 0) {
            lines.push(`SAWMILL +${support.victoryCoinBonus} COINS`);
        }
        if (support.guardCharges > 0) {
            lines.push(`MASONRY ${support.guardCharges} GUARD`);
        }
        if (support.maxEnergyBonus > 0) {
            lines.push(`WORKSHOP +${support.maxEnergyBonus} ENERGY`);
        }
        if (lines.length === 0) return '';
        return compact
            ? `VILLAGE // ${lines.join(' · ')}`
            : `Village support active: ${lines.join(' · ')}`;
    }

    showRescuedResidentReleaseMoment(resident) {
        if (!resident?.newlyRescued || this.residentReleaseOpen) return false;
        this.residentReleaseOpen = true;
        const { width, height } = this.cameras.main;
        const compact = width < 620 || height < 620;
        const depth = 8200;
        const centerX = width / 2;
        const artX = compact ? centerX : width * 0.67;
        const artY = compact ? height * 0.36 : height * 0.47;
        const artSize = Math.min(compact ? width * 0.46 : width * 0.34, height * 0.55);
        const elements = [];

        const overlay = this.add.graphics();
        overlay.fillStyle(0x02080B, 0.97);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0).setDepth(depth).setInteractive(
            new Phaser.Geom.Rectangle(0, 0, width, height),
            Phaser.Geom.Rectangle.Contains
        );
        elements.push(overlay);

        const mediaService = window.CompanionMediaService || companionMediaService;
        Promise.resolve(mediaService?.createCinematicStill?.(this, {
            momentId: `resident_release_${resident.id}`,
            stage: window.GameState?.get?.('creature.lifecycle.stage') || 'baby',
            depth: depth + 1,
            alpha: 0.24,
            veilAlpha: 0.08,
            duration: 60000,
            isCurrent: () => (
                this.residentReleaseOpen &&
                this.sys?.isActive?.() !== false
            )
        })).then(tableau => {
            if (!tableau) return;
            if (!this.residentReleaseOpen || this.sys?.isActive?.() === false) {
                tableau.destroy?.();
                return;
            }
            this.residentReleaseTableau = tableau;
        }).catch(() => null);

        const header = this.add.text(
            compact ? centerX : width * 0.06,
            compact ? 30 : height * 0.12,
            'PROJECT BEACON // LIFE SIGNAL RELEASED',
            {
                fontFamily: 'Arial, sans-serif',
                fontSize: compact ? '12px' : '16px',
                color: '#8FE3CF',
                fontStyle: 'bold'
            }
        ).setOrigin(compact ? 0.5 : 0, 0.5).setScrollFactor(0).setDepth(depth + 3);
        elements.push(header);

        const pixel = this.add.graphics();
        pixel.fillStyle(resident.color, 1);
        pixel.fillRoundedRect(artX - 32, artY - 30, 64, 70, 12);
        pixel.fillStyle(0xF4F4F4, 1);
        pixel.fillCircle(artX - 13, artY - 8, 10);
        pixel.fillCircle(artX + 13, artY - 8, 10);
        pixel.fillStyle(0x101616, 1);
        pixel.fillCircle(artX - 12, artY - 8, 4);
        pixel.fillCircle(artX + 14, artY - 8, 4);
        pixel.setScrollFactor(0).setDepth(depth + 2);
        elements.push(pixel);

        let artwork = null;
        if (this.textures.exists(resident.textureKey)) {
            artwork = this.add.image(artX, artY, resident.textureKey)
                .setScrollFactor(0)
                .setDepth(depth + 2)
                .setAlpha(0);
            const scale = Math.min(
                artSize / Math.max(1, artwork.width),
                artSize / Math.max(1, artwork.height)
            );
            artwork.setScale(scale);
            elements.push(artwork);
        }

        const cage = this.add.graphics();
        cage.lineStyle(compact ? 6 : 8, 0xA7B0B8, 0.95);
        for (let offset = -60; offset <= 60; offset += 30) {
            cage.lineBetween(artX + offset, artY - artSize * 0.42, artX + offset, artY + artSize * 0.42);
        }
        cage.lineBetween(artX - 75, artY - artSize * 0.42, artX + 75, artY - artSize * 0.42);
        cage.lineBetween(artX - 75, artY + artSize * 0.42, artX + 75, artY + artSize * 0.42);
        cage.setScrollFactor(0).setDepth(depth + 4);
        elements.push(cage);

        const titleX = compact ? centerX : width * 0.06;
        const titleY = compact ? height * 0.63 : height * 0.3;
        const title = this.add.text(titleX, titleY, `${resident.name.toUpperCase()} // ${resident.role.toUpperCase()}`, {
            fontFamily: 'Arial, sans-serif',
            fontSize: compact ? '21px' : '32px',
            color: '#F2C14E',
            fontStyle: 'bold',
            align: compact ? 'center' : 'left',
            wordWrap: { width: compact ? width - 32 : width * 0.45 }
        }).setOrigin(compact ? 0.5 : 0, 0.5).setScrollFactor(0).setDepth(depth + 3);
        elements.push(title);

        const story = this.add.text(
            titleX,
            compact ? height * 0.72 : height * 0.46,
            `${resident.releaseLine}\n\nFREE, NOT COLLECTED. ${resident.name} chose to return with you.\n${resident.supportLabel}`,
            {
                fontFamily: 'Arial, sans-serif',
                fontSize: compact ? '12px' : '16px',
                color: '#F4F4F4',
                lineSpacing: compact ? 3 : 7,
                align: compact ? 'center' : 'left',
                wordWrap: { width: compact ? width - 40 : width * 0.42 }
            }
        ).setOrigin(compact ? 0.5 : 0, 0.5).setScrollFactor(0).setDepth(depth + 3);
        elements.push(story);

        const button = this.add.text(
            centerX,
            height - (compact ? 44 : 60),
            `RETURN WITH ${resident.name.toUpperCase()}`,
            {
                fontFamily: 'Arial, sans-serif',
                fontSize: compact ? '15px' : '19px',
                color: '#061116',
                backgroundColor: '#8FE3CF',
                fontStyle: 'bold',
                padding: { x: compact ? 20 : 30, y: 12 }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 5)
            .setInteractive({ useHandCursor: true });
        elements.push(button);

        const close = () => {
            if (!this.residentReleaseOpen) return;
            this.residentReleaseOpen = false;
            this.residentReleaseTableau?.destroy?.();
            this.residentReleaseTableau = null;
            elements.forEach(element => element?.destroy?.());
            this.residentReleaseElements = [];
            window.AudioManager?.playButtonClick?.();
        };
        button.on('pointerup', close);
        this.time.delayedCall(700, () => {
            if (!this.residentReleaseOpen) return;
            this.tweens.add({ targets: cage, alpha: 0, scaleX: 1.35, duration: 500 });
            this.tweens.add({ targets: pixel, alpha: artwork ? 0 : 1, duration: 450 });
            if (artwork) {
                this.tweens.add({ targets: artwork, alpha: 1, duration: 700 });
            }
            window.AudioManager?.playAchievement?.();
        });
        this.residentReleaseElements = elements;
        return true;
    }

    /**
     * Let the player's exact living-form portrait witness each first rescue.
     * This only resolves stored art; it never starts generation or blocks rewards.
     */
    showCompanionGuardianRescueTableau(guardian) {
        const mediaService = window.CompanionMediaService ||
            companionMediaService;
        if (
            !guardian?.newlyRescued ||
            !mediaService?.createCinematicStill
        ) {
            return false;
        }

        this.companionMediaRequest += 1;
        const requestId = this.companionMediaRequest;
        const guardianId = String(guardian.id || 'guardian')
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '_')
            .slice(0, 32);
        const momentId = `guardian_rescue_${guardianId}`;
        this.companionRescueTableau?.destroy?.();
        this.companionRescueTableau = null;

        Promise.resolve(
            mediaService.createCinematicStill(this, {
                momentId,
                stage: window.GameState?.get?.(
                    'creature.lifecycle.stage'
                ) || 'baby',
                record: this.rescuePortraitPreview
                    ? {
                        identityKey: 'preview_companion_23:baby:portrait',
                        stage: 'baby',
                        imageUrl: '/marketing/nova.webp',
                        assetRef: null,
                        storage: 'preview'
                    }
                    : null,
                depth: 1800,
                alpha: 0.62,
                duration: 5600,
                isCurrent: () => (
                    this.levelCompletionActive &&
                    this.companionMediaRequest === requestId &&
                    this.sys?.isActive?.() !== false
                )
            })
        ).then(tableau => {
            if (!tableau) return;
            if (
                this.companionMediaRequest !== requestId ||
                this.sys?.isActive?.() === false
            ) {
                tableau.destroy?.();
                return;
            }
            const width = this.cameras?.main?.width || this.scale.width;
            const height = this.cameras?.main?.height || this.scale.height;
            const companionName = this.rescuePortraitPreview
                ? 'Nova'
                : window.GameState?.get?.('creature.name') || 'Your companion';
            const allianceLabel = this.add.text(
                width / 2,
                height * 0.8,
                `FIRST ALLIANCE // ${companionName.toUpperCase()}`,
                {
                    fontSize: width < 600 ? '13px' : '17px',
                    color: '#F2C14E',
                    fontStyle: 'bold',
                    stroke: '#03040A',
                    strokeThickness: 4,
                    align: 'center'
                }
            ).setOrigin(0.5).setDepth(1995).setScrollFactor(0);
            const arrivalLabel = this.add.text(
                width / 2,
                height * 0.85,
                `${guardian.name} will return to the Sanctuary.`,
                {
                    fontSize: width < 600 ? '11px' : '14px',
                    color: '#B9DAD7',
                    stroke: '#03040A',
                    strokeThickness: 3,
                    align: 'center',
                    wordWrap: { width: width * 0.82 }
                }
            ).setOrigin(0.5).setDepth(1995).setScrollFactor(0);
            tableau.elements.push(allianceLabel, arrivalLabel);
            this.companionRescueTableau = tableau;
        }).catch(error => {
            console.warn(
                '[PlatformerLevel] Companion rescue portrait unavailable:',
                error.message
            );
        });
        return true;
    }

    /**
     * Apply the progression shared by every completed platformer level.
     * This is intentionally idempotent for a single scene run because victory
     * callbacks can overlap while their final animations are still active.
     */
    completeLevelProgression({
        achievementLevelId,
        shipPartId,
        katanaUpgradeId = null,
        speedrunThreshold = 0,
        bondExperience = 10,
        rewardBonusCount = 0
    } = {}) {
        if (!achievementLevelId) {
            console.warn('[PlatformerLevel] Cannot record completion without an achievement level ID');
            return null;
        }

        if (this._levelProgressionRecorded) {
            return this.levelCompletionResult;
        }
        this._levelProgressionRecorded = true;
        this.enterLevelCompletionState();

        const gameState = window.GameState || null;
        this.clearPersistedExpeditionCheckpoint({ save: false });
        const completionPath = `levels.${achievementLevelId}.completed`;
        const wasCompleted = gameState?.get(completionPath) === true;
        const completionTime = Math.max(0, Date.now() - (this.levelStartTime || Date.now()));
        const noDamage = (this.damageTaken || 0) === 0;
        let shipPartAwarded = false;
        let katanaUpgradeAwarded = false;
        let katanaUpgrade = null;
        let nextGateUnlock = null;
        let currentRestoration = null;
        let guardianResident = null;
        let guardianExpedition = null;
        let rescuedResident = null;
        const configuredVictoryCoins = calculateVictoryCoins(
            achievementLevelId,
            rewardBonusCount
        ) + (this.rescuedResidentSupport?.victoryCoinBonus || 0) +
            (this.villageSupport?.victoryCoinBonus || 0);
        let coinsAwarded = 0;

        this.recordLevelSuccess();

        if (configuredVictoryCoins > 0) {
            const economyManager = window.EconomyManager;
            const newBalance = economyManager?.addCoins?.(
                configuredVictoryCoins,
                `boss_victory:${achievementLevelId}`
            );

            if (Number.isFinite(newBalance)) {
                coinsAwarded = configuredVictoryCoins;
            } else if (gameState) {
                const currentCoins = Number(gameState.get('player.cosmicCoins')) || 0;
                gameState.set('player.cosmicCoins', currentCoins + configuredVictoryCoins);
                const coinsCollected = Number(gameState.get('stats.coinsCollected')) || 0;
                gameState.set(
                    'stats.coinsCollected',
                    coinsCollected + configuredVictoryCoins
                );
                coinsAwarded = configuredVictoryCoins;
            }
        }

        if (shipPartId) {
            if (window.InventoryManager?.addShipPart) {
                shipPartAwarded = window.InventoryManager.addShipPart(shipPartId);
            } else if (gameState) {
                const collected = gameState.get('hubWorld.shipParts.collected') || [];
                if (!collected.includes(shipPartId)) {
                    gameState.set('hubWorld.shipParts.collected', [...collected, shipPartId]);
                    shipPartAwarded = true;
                }
            }
        }

        const completionData = {
            levelId: achievementLevelId,
            noDamage,
            time: completionTime,
            speedrunThreshold
        };

        if (gameState) {
            currentRestoration = recordCurrentRegionRestoration(
                gameState,
                achievementLevelId,
                { save: false }
            );
            if (currentRestoration?.changed) {
                this.refreshCurrentEcologyNode({ celebrate: true });
            }
            guardianResident = window.GuardianResidents
                ?.recordGuardianRescue?.(
                    gameState,
                    achievementLevelId,
                    { save: false }
                ) || null;
            guardianExpedition = window.GuardianResidents
                ?.recordGuardianExpedition?.(gameState, {
                    levelId: achievementLevelId,
                    noDamage,
                    interventionCount: this.guardianInterventions,
                    save: false
                }) || null;
            rescuedResident = window.RescuedResidents
                ?.recordRescuedResident?.(
                    gameState,
                    achievementLevelId,
                    { save: false }
                ) || null;
        }

        // Campaign progression is authoritative GameState, not an achievement
        // side effect. Record it first so a badge evaluation failure can never
        // strand a player after they have completed an expedition.
        if (gameState) {
            gameState.set(completionPath, true);
            if (noDamage) {
                gameState.set(`levels.${achievementLevelId}.noDamageRun`, true);
            }
            if (speedrunThreshold > 0 && completionTime < speedrunThreshold) {
                gameState.set(`levels.${achievementLevelId}.speedrun`, true);
            }
        }

        if (window.AchievementSystem?.recordEvent) {
            try {
                window.AchievementSystem.recordEvent('level_completed', completionData);
            } catch (error) {
                console.warn(
                    '[PlatformerLevel] Achievement processing failed after level completion:',
                    error
                );
            }
        }

        if (gameState) {
            if (katanaUpgradeId) {
                const upgradeResult = window.ProjectBeaconFieldKit
                    ?.installProjectBeaconKatanaUpgrade?.(
                        gameState,
                        katanaUpgradeId,
                        { save: false }
                    );
                katanaUpgrade = upgradeResult?.upgrade || null;
                katanaUpgradeAwarded = upgradeResult?.changed === true;
            }

            const bestTimePath = `levels.${achievementLevelId}.bestTime`;
            const previousBestTime = gameState.get(bestTimePath);
            if (!previousBestTime || completionTime < previousBestTime) {
                gameState.set(bestTimePath, completionTime);
            }

            if (!wasCompleted) {
                const completedCount = gameState.get('stats.levelsCompleted') || 0;
                const nextCompletedCount = completedCount + 1;
                gameState.set('stats.levelsCompleted', nextCompletedCount);
                queueProjectBeaconDebrief(gameState, {
                    levelId: achievementLevelId,
                    shipPartId
                });
                nextGateUnlock = unlockProjectBeaconMilestone(
                    gameState,
                    achievementLevelId
                );
                gameState.syncCanonicalCampaignGates?.();
            }

            const bond = gameState.get('creature.bond');
            if (bond) {
                const newExperience = (bond.experience || 0) + bondExperience;
                const newLevel = Math.floor(newExperience / 50) + 1;
                const oldLevel = bond.level || 1;
                const now = Date.now();

                gameState.set('creature.bond', {
                    ...bond,
                    experience: newExperience,
                    level: newLevel,
                    levelsCompleted: (bond.levelsCompleted || 0) + 1,
                    totalInteractions: (bond.totalInteractions || 0) + 1,
                    firstInteraction: bond.firstInteraction || now,
                    lastInteraction: now,
                    abilitySlots: {
                        slot1: true,
                        ...bond.abilitySlots,
                        slot2: newLevel >= 5 || bond.abilitySlots?.slot2 || false,
                        slot3: newLevel >= 10 || bond.abilitySlots?.slot3 || false
                    }
                });

                if (newLevel > oldLevel) {
                    gameState.emit?.('bondLevelUp', { level: newLevel });
                }
            }

            gameState.save?.();
        }

        this.levelCompletionResult = {
            ...completionData,
            shipPartId,
            shipPartAwarded,
            katanaUpgradeId,
            katanaUpgrade,
            katanaUpgradeAwarded,
            coinsAwarded,
            nextGateId: nextGateUnlock?.gateId || null,
            nextGateUnlocked: nextGateUnlock?.newlyUnlocked === true,
            currentEcology: currentRestoration
                ? {
                    changed: currentRestoration.changed,
                    regionId: currentRestoration.regionId,
                    regionLabel: currentRestoration.regionLabel,
                    beforeVitality: currentRestoration.beforeVitality,
                    afterVitality: currentRestoration.afterVitality,
                    networkVitality: currentRestoration.summary.vitality,
                    restoredCount: currentRestoration.summary.restoredCount,
                    totalRegions: currentRestoration.summary.totalRegions,
                    networkStatus: currentRestoration.summary.networkStatus
                }
                : null,
            guardianResident: guardianResident
                ? {
                    id: guardianResident.guardian.id,
                    name: guardianResident.guardian.name,
                    newlyRescued: guardianResident.changed,
                    role: guardianResident.guardian.role,
                    routine: guardianResident.guardian.routine,
                    futureAbility: guardianResident.guardian.futureAbility
                }
                : null,
            guardianExpedition: guardianExpedition?.changed
                ? {
                    guardianId: guardianExpedition.entry.guardianId,
                    levelId: guardianExpedition.entry.levelId,
                    interventionCount:
                        guardianExpedition.entry.interventionCount,
                    noDamage: guardianExpedition.entry.noDamage
                }
                : null,
            rescuedResident: rescuedResident
                ? {
                    id: rescuedResident.resident.id,
                    name: rescuedResident.resident.name,
                    newlyRescued: rescuedResident.changed,
                    role: rescuedResident.resident.role,
                    kind: rescuedResident.resident.kind,
                    artwork: rescuedResident.resident.artwork,
                    textureKey: rescuedResident.resident.textureKey,
                    color: rescuedResident.resident.color,
                    accent: rescuedResident.resident.accent,
                    releaseLine: rescuedResident.resident.releaseLine,
                    sanctuaryLine: rescuedResident.resident.sanctuaryLine,
                    supportLabel: rescuedResident.resident.supportLabel
                }
                : null,
            firstCompletion: !wasCompleted
        };

        const residentReleaseShown = this.showRescuedResidentReleaseMoment(
            this.levelCompletionResult.rescuedResident
        );
        if (!residentReleaseShown) {
            this.showCompanionGuardianRescueTableau(
                this.levelCompletionResult.guardianResident
            );
        }

        return this.levelCompletionResult;
    }

    /**
     * Notify thought system of current biome
     * Call from child classes in create()
     */
    notifyBiomeEntered(biomeType) {
        if (window.ThoughtBubbleSystem) {
            window.ThoughtBubbleSystem.setBiome(biomeType);
        }
    }
}

// Export for module systems
export default PlatformerLevelScene;

// Also expose globally for Phaser scene registration
if (typeof window !== 'undefined') {
    window.PlatformerLevelScene = PlatformerLevelScene;
}
