/**
 * GameScene - The main gameplay scene with an explorable world
 * Features: player movement, large world, environment objects, collision detection, interactions, AI chat
 */

import EconomyHudManager from '../systems/ui/EconomyHudManager.js';
import CarePanelManager from '../systems/ui/CarePanelManager.js';
import WorldBuilder from '../systems/world/WorldBuilder.js';
import ChatOverlay from '../ui/ChatOverlay.js';
import MobileHUD from '../systems/ui/MobileHUD.js';
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
import GameSceneSceneRouter from './controllers/GameSceneSceneRouter.js';
import GameSceneHudController from './controllers/GameSceneHudController.js';
import projectBeacon from '../config/project-beacon.json';
import { recoverProjectBeaconFieldKit as recoverFieldKitState, getProjectBeaconKatanaUpgradeIds } from '../systems/ProjectBeaconFieldKit.js';
import { normalizeSignalGardenState, tendSignalGarden } from '../systems/SignalGarden.js';
import { LIVING_SIGNAL_DEFINITIONS, normalizeLivingSignalState, observeLivingSignal } from '../systems/LivingSignalSurvey.js';
import ExpeditionAstronaut from '../systems/ExpeditionAstronaut.js';
import ProjectBeaconWaypoint from '../systems/ui/ProjectBeaconWaypoint.js';
import ProjectBeaconLogModal from '../ui/ProjectBeaconLogModal.js';
import SettingsModal from '../ui/SettingsModal.js';
import KatanaArtifactModal, { prefetchKatanaArtifactArtwork } from '../ui/KatanaArtifactModal.js';
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
        this.sanctuaryKeepsakes = null;
        this.livingSignals = [];
        this.activeLivingSignalId = null;
        this.livingSignalDwellMs = 0;
        this.livingSignalApproachHintShown = false;
        this.livingSignalMomentElements = [];
        this.livingSignalMomentTimer = null;
        this.sanctuaryZones = null;
        this.targetRange = null;
        this.nearTargetRange = false;
        this.targetRangeScore = 0;
        this.targetRangeScoreText = null;
        this.nearHubPortal = false;
        this.nearVoidPortal = false;
        this.nearCampfire = false;
        this.nearSignalGarden = false;
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
        this.questTracker = null;
        this.projectBeaconWaypoint = null;
        this.waypointPreview = null;
        this.missionBriefingPreview = null;
        this.missionBriefingPreviewSize = null;
        this.mapRecoveryPreview = false;
        this.mapRecoveryStatusText = null;
        this.mapRecoveryActors = [];
        this.carePanelPreview = false;
        this.signalGardenPreview = null;
        this.sanctuaryDecorationPreview = null;
        this.signalGardenPreviewElements = [];
        this.livingSignalPreview = null;
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
        this.joystickX = 0;
        this.joystickY = 0;
        this.virtualJoystickHandler = null;
        this.virtualKeyHandler = null;
        this.positionText = null;
        this.lastPositionPersistedAt = Number.NEGATIVE_INFINITY;
        this.statsText = null;
        this.statsPulseAnimation = null;
        this.interactionText = null;
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
        // Sprites will be created in create() method
    }

    /**
     * Receive data from scene transitions (e.g., from HubWorldScene)
     * @param {object} data - Scene transition data
     */
    init(data) {
        // Reset shutdown flag for fresh scene
        this._isShuttingDown = false;
        this.fieldKitPreview = data?.fieldKitPreview === true;
        this.fieldKitPreviewSize = data?.fieldKitPreviewSize || null;
        this.fieldKitPreviewStage = ['earth', 'crystal', 'aurora'].includes(
            data?.fieldKitPreviewStage
        ) ? data.fieldKitPreviewStage : 'earth';
        this.waypointPreview = data?.waypointPreview || null;
        this.missionBriefingPreview = data?.missionBriefingPreview || null;
        this.missionBriefingPreviewSize = data?.missionBriefingPreviewSize || null;
        this.carePanelPreview = data?.carePanelPreview === true;
        this.signalGardenPreview = data?.signalGardenPreview || null;
        this.sanctuaryDecorationPreview = Number.isFinite(Number(data?.sanctuaryDecorationPreview))
            ? Math.max(0, Math.min(3, Math.floor(Number(data.sanctuaryDecorationPreview))))
            : null;
        this.livingSignalPreview = data?.livingSignalPreview || null;
        this.controlsPreview = data?.controlsPreview === true;
        this.storyPreview = data?.storyPreview === true;
        this.beaconLogPreview = ['mission', 'archive'].includes(data?.beaconLogPreview)
            ? data.beaconLogPreview
            : null;
        this.settingsPreview = data?.settingsPreview === true;
        this.mapRecoveryPreview = data?.mapRecoveryPreview === true;

        // Handle biome data from HubWorldScene
        if (data?.biome) {
            this.currentBiome = data.biome;
            console.log(`[GameScene] Entering biome: ${this.currentBiome}`);
        } else {
            this.currentBiome = 'nebula'; // Default biome
        }

        // Store any spawn position data
        if (data?.spawnPosition) {
            this.spawnPosition = data.spawnPosition;
        }

        // Handle return from Void mini-game
        if (data?.returnFromVoid) {
            this.returningFromVoid = true;
            this.voidScore = data.voidScore || 0;
            console.log(`[GameScene] Returning from Void with score: ${this.voidScore}`);
        } else {
            this.returningFromVoid = false;
            this.voidScore = 0;
        }
    }

    create() {
        console.log('[GameScene] ===== CREATE() STARTING =====');
        try {
            this.removeStaleAuxiliaryCameras();
            prefetchKatanaArtifactArtwork();
            console.log('[GameScene] Initializing lifecycle tracking...');
            this.initializeLifecycleTracking();
            this.registerSceneLifecycleEvents();
            this.sceneRouter = new GameSceneSceneRouter(this);
            this.hudController = new GameSceneHudController(this);

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

            if (this.carePanelPreview) {
                this.createCarePanelPreview();
                console.log('[GameScene] Care Corner preview created successfully');
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
            this.sanctuaryKeepsakes = worldPieces.sanctuaryKeepsakes || null;
            this.sanctuaryZones = worldPieces.sanctuaryZones || null;
            this.targetRange = worldPieces.targetRange || null;

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

                // Target range interactions
                if (this.targetRange && this.targetRange.allTargets) {
                    this.setupTargetRangeCollisions();
                }

                // Return portal for non-sanctuary biomes
                if (this.returnPortal) {
                    this.physics.add.overlap(this.player, this.returnPortal, this.handleReturnPortalProximity, null, this);
                }
            }

            // Create cosmic coins for collection
            this.createCosmicCoins();

            // Create enemies
            this.createEnemies();

            // Set up input controls
            this.setupInput();
            
            // Create UI elements
            this.createUI();

            // The mobile radial menu exposes care directly; keyboard players use Care Corner.
            if (this.scale.width >= 600) {
                this.carePanelManager?.init();
            }

            this.showWelcomeToastIfNeeded();

            // Initialize mobile controls and HUD if on mobile device
            if (window.MobileControls) {
                this.mobileControls = new window.MobileControls(this);
                this.mobileControls.show();
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

            // Set up periodic timers for achievements and tutorials
            this.setupPeriodicTimers();

            // Initialize controls tutorial (used by OnboardingManager)
            this.controlsTutorial = new ControlsTutorialOverlay(this);

            // Use OnboardingManager to sequence all popups properly
            // This replaces the scattered delayed calls for controls, story, greeting, and NASA content
            this.time.delayedCall(500, () => {
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
                this.time.delayedCall(500, () => {
                    this.showVoidReturnToast(this.voidScore);
                });
                this.returningFromVoid = false;
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
            feed: { icon: '🍎', name: 'Feed', currentCount: 0, limit: 3, canPerform: true },
            play: { icon: '🎾', name: 'Play', currentCount: 0, limit: 2, canPerform: true },
            rest: { icon: '😴', name: 'Rest', currentCount: 0, limit: -1, isUnlimited: true, canPerform: true }
        };
        const previewCareSystem = {
            getAllCareActionsInfo: () => actionInfo,
            getCareStatus: () => ({
                dailyCare: { feedCount: 0, playCount: 0, restCount: 0 }
            })
        };

        this.carePanelManager = new CarePanelManager(this, {
            careSystem: previewCareSystem,
            playerProvider: () => ({ x: companionX, y: companionY }),
            geneticsProvider: () => null
        });
        this.carePanelManager.init();
        this.carePanelManager.togglePanel();
        this.waypointPreviewElements.push(backdrop, companion, heading);
    }

    createSignalGardenPreview() {
        const { width, height } = this.scale;
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
        const stageLabel = this.add.text(width / 2, heading.y + 32, this.signalGardenPreview.toUpperCase(), {
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
            color: '#F2C86B'
        }).setOrigin(0.5);

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

        this.signalGardenPreviewElements = [backdrop, heading, stageLabel];
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
        }, false);
        this.livingSignals = [previewSignal];
        this.showLivingSignalMoment({
            signal: definition,
            progress: LIVING_SIGNAL_DEFINITIONS.findIndex(
                signal => signal.id === definition.id
            ) + 1,
            total: LIVING_SIGNAL_DEFINITIONS.length,
            completed: definition.id ===
                LIVING_SIGNAL_DEFINITIONS[LIVING_SIGNAL_DEFINITIONS.length - 1].id
        }, { preview: true });
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
        this.livingSignals = LIVING_SIGNAL_DEFINITIONS.map(definition => (
            this.createLivingSignalVisual(
                definition,
                state.observedIds.includes(definition.id)
            )
        ));
    }

    createLivingSignalVisual(definition, observed = false) {
        const { x, y } = definition.position;
        const container = this.add.container(x, y).setDepth(y + 4);
        const aura = this.add.graphics();
        aura.fillStyle(definition.color, observed ? 0.08 : 0.18);
        aura.fillCircle(0, 0, 42);
        aura.lineStyle(2, definition.color, observed ? 0.25 : 0.75);
        aura.strokeCircle(0, 0, 33);
        aura.lineStyle(1, definition.accent, observed ? 0.18 : 0.55);
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

        const label = this.add.text(
            0,
            51,
            observed ? 'SIGNAL HEARD' : 'LIVING SIGNAL // APPROACH',
            {
                fontSize: '10px',
                fontFamily: 'Arial, sans-serif',
                color: observed ? '#829B96' : '#D8FFF0',
                fontStyle: 'bold',
                backgroundColor: 'rgba(5, 18, 17, 0.78)',
                padding: { x: 5, y: 3 }
            }
        ).setOrigin(0.5);
        container.add([aura, form, label]);

        const pulseTween = this.tweens.add({
            targets: aura,
            alpha: { from: observed ? 0.35 : 0.68, to: observed ? 0.5 : 1 },
            scale: { from: 0.92, to: 1.1 },
            duration: observed ? 2100 : 1150,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        return {
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
            pulseTween
        };
    }

    refreshLivingSignalVisual(signal) {
        if (!signal) return;
        signal.observed = true;
        signal.label?.setText('SIGNAL HEARD');
        signal.label?.setColor('#829B96');
        signal.container?.setAlpha(0.58);
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
        const { width, height } = this.scale;
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

        const previewState = {
            creature: {
                name: 'Luma',
                bond: { level: 5 }
            },
            quests: {
                completed: projectBeacon.fieldMissions.map(mission => mission.id)
            },
            story: {
                projectBeacon: {
                    currentMission: 'field_sequence_complete',
                    pendingDebriefs: [{ id: 'beacon_debrief_3' }],
                    debriefsSeen: ['beacon_debrief_1', 'beacon_debrief_2'],
                    lastRouteUnlocked: {
                        gateId: 'void_peaks',
                        label: 'Void Peaks'
                    },
                    uplinkRestored: false,
                    endingChoice: null
                }
            },
            hubWorld: {
                shipParts: {
                    collected: ['forest_core', 'crystal_core', 'dimensional_drive']
                }
            }
        };
        const previewGameState = {
            get(path) {
                return path.split('.').reduce(
                    (value, key) => value?.[key],
                    previewState
                );
            }
        };

        this.beaconLogModal = new ProjectBeaconLogModal(this, {
            getGameState: () => previewGameState
        });
        this.beaconLogModal.show(this.beaconLogPreview);
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
            getSettings() {
                return {
                    screenShakeEnabled: this.screenShakeEnabled,
                    hapticEnabled: this.hapticEnabled,
                    hapticSupported: true
                };
            },
            toggleScreenShake() {
                this.screenShakeEnabled = !this.screenShakeEnabled;
            },
            toggleHaptic() {
                this.hapticEnabled = !this.hapticEnabled;
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

    setupCamera() {
        const camera = this.cameras?.main;

        if (!camera) {
            console.warn('[GameScene] Camera not ready yet, skipping setup');
            return;
        }

        camera.setBounds(0, 0, this.worldWidth, this.worldHeight);

        if (this.player) {
            camera.startFollow(this.player, true, 0.12, 0.12);
            camera.setDeadzone(
                Math.round(camera.width * 0.15),
                Math.round(camera.height * 0.2)
            );
        }

        const responsiveManager = window.responsiveManager;
        const isMobile = responsiveManager?.isMobile ?? window.innerWidth < 768;
        const zoom = isMobile ? 0.85 : 1.0;

        camera.setZoom(zoom);
        camera.setRoundPixels(true);
        camera.setBackgroundColor('#050214');

        this.currentCameraZoom = zoom;
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
        const showNavigation = timesVisited < 5; // Show for first 5 visits

        // Track visit
        window.GameState?.set('session.sanctuaryVisits', timesVisited + 1);

        if (!showNavigation) {
            console.log('[GameScene] Navigation paths disabled (user experienced)');
            return;
        }

        // Get landmark positions
        const centerX = this.worldWidth / 2;
        const centerY = this.worldHeight / 2;

        // Define key destinations with their info
        const destinations = [];

        if (this.crashedShip) {
            destinations.push({
                name: 'Story & Void',
                icon: '🚀',
                x: this.crashedShip.x,
                y: this.crashedShip.y,
                color: 0x4A90A4,
                description: 'Your ship\'s story'
            });
        }

        if (this.hubPortal) {
            destinations.push({
                name: 'Adventure Portal',
                icon: '⭐',
                x: this.hubPortal.x,
                y: this.hubPortal.y,
                color: 0x9370DB,
                description: 'Enter levels'
            });
        }

        if (this.shop) {
            destinations.push({
                name: 'Cosmic Shop',
                icon: '🏪',
                x: this.shop.x,
                y: this.shop.y,
                color: 0xFFD700,
                description: 'Buy eggs & items'
            });
        }

        // Add Target Range to navigation
        if (this.targetRange && this.sanctuaryZones?.zones?.trainingGrounds) {
            const zone = this.sanctuaryZones.zones.trainingGrounds;
            destinations.push({
                name: 'Target Range',
                icon: '🎯',
                x: zone.center.x,
                y: zone.center.y,
                color: 0xFF6B6B,
                description: 'Practice shooting'
            });
        }

        // Create glowing path trails and floating markers for each destination
        destinations.forEach((dest, index) => {
            this.createGlowingPath(centerX, centerY, dest.x, dest.y, dest.color);
            this.createFloatingMarker(dest);
        });

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

        // Floating animation
        this.tweens.add({
            targets: [glow, icon, label],
            y: '-=10',
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Glow pulsing
        this.tweens.add({
            targets: glow,
            alpha: { from: 0.2, to: 0.5 },
            scale: { from: 1, to: 1.3 },
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
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
            star: { emoji: '⭐', color: '#FFD700', effect: 'Health regeneration enhanced' },
            moon: { emoji: '🌙', color: '#C0C0FF', effect: 'Energy lasts longer' },
            nebula: { emoji: '🌌', color: '#FF69B4', effect: 'Exploration XP bonus' },
            crystal: { emoji: '💎', color: '#00FFFF', effect: 'Find more coins' },
            void: { emoji: '🕳️', color: '#8B008B', effect: 'Combat damage boost' }
        };

        const info = affinityInfo[element];
        if (!info) return;

        // Only show on first visit or after level up
        const hasShownAffinity = getGameState().get('session.shownCosmicAffinity');
        if (hasShownAffinity) return;

        getGameState().set('session.shownCosmicAffinity', true);

        const { width } = this.cameras.main;
        const text = this.add.text(width / 2, 120, `${info.emoji} ${element.toUpperCase()} AFFINITY ${info.emoji}\n${info.effect}`, {
            fontSize: '16px',
            color: info.color,
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1500).setAlpha(0);

        // Fade in, hold, fade out
        this.tweens.add({
            targets: text,
            alpha: 1,
            duration: 500,
            onComplete: () => {
                this.time.delayedCall(2500, () => {
                    this.tweens.add({
                        targets: text,
                        alpha: 0,
                        y: text.y - 20,
                        duration: 500,
                        onComplete: () => text.destroy()
                    });
                });
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
        // Check for spawn position from egg hatching (creature replacement)
        const spawnPos = getGameState().get('creature.spawnPosition');
        const savedPos = getGameState().get('world.currentPosition');

        let startX, startY;

        if (spawnPos) {
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
            const stageDaysL = { baby: 0, juvenile: 1, adult: 3, elder: 10 };
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

        // Position: On mobile, position below hamburger menu area (~120px from top)
        // On desktop, position in top-left below header
        const baseX = 16;
        const baseY = isMobile ? 120 : 85;

        this.rosterElements = [];

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
        if (!this.nearbyFlower) {
            // Show interaction hint when near flowers
            this.showInteractionHint('Press SPACE to smell the flower');

            // Update mobile interact button icon to flower
            if (this.mobileControls) {
                this.mobileControls.updateInteractIcon('🌸');
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

    handleShopProximity(player, shop) {
        // Only execute once per shop proximity to prevent performance issues
        if (!this.nearShop) {
            this.nearShop = true;
            console.log('[GameScene] Player near shop - showing interaction hint');

            // Show shop entry hint
            this.showInteractionHint('Press SPACE to visit the Cozy Cosmic Boutique');

            // Update mobile interact button icon to shop
            if (this.mobileControls) {
                this.mobileControls.updateInteractIcon('🏪');
            }
        }
    }

    enterShop() {
        console.log('[GameScene] Entering Cosmic Shop');

        // Check cooldown to prevent rapid scene transitions
        if (this.shopEntryCooldown) {
            console.log('[GameScene] Shop entry on cooldown');
            return;
        }

        // Set cooldown flag
        this.shopEntryCooldown = true;
        this.time.delayedCall(1000, () => {
            this.shopEntryCooldown = false;
        });

        // Reset nearShop flag before entering
        this.nearShop = false;

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

            this.showInteractionHint('Press SPACE to travel to other worlds ⭐');

            if (this.mobileControls) {
                this.mobileControls.updateInteractIcon('⭐');
            }

            // Add mystical pulsing visual indicator around the hub gate
            if (!this.portalIndicator && portal) {
                this.portalIndicator = this.add.graphics();
                this.portalIndicator.setDepth(portal.depth - 1);

                const pulseAnim = this.tweens.add({
                    targets: { scale: 1 },
                    scale: 1.15,
                    duration: 1500,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut',
                    onUpdate: (tween, target) => {
                        if (this.portalIndicator && portal) {
                            this.portalIndicator.clear();
                            // Mystical purple/cyan glow
                            this.portalIndicator.lineStyle(3, 0x9370DB, 0.5);
                            const radius = 90 * target.scale;
                            this.portalIndicator.strokeCircle(portal.x, portal.y, radius);
                            // Inner glow
                            this.portalIndicator.lineStyle(2, 0x00CED1, 0.4);
                            this.portalIndicator.strokeCircle(portal.x, portal.y, radius * 0.75);
                        }
                    }
                });
                this.portalPulseAnim = pulseAnim;
            }
        }
    }

    /**
     * Handle player proximity to Campfire (rest and bonding)
     */
    handleCampfireProximity(player, campfire) {
        if (!this.nearCampfire) {
            this.nearCampfire = true;
            console.log('[GameScene] Player near Campfire');

            this.showInteractionHint('Press SPACE to rest by the fire 🔥');

            if (this.mobileControls) {
                this.mobileControls.updateInteractIcon('🔥');
            }

            // Add warm glow indicator around campfire
            if (!this.campfireIndicator && campfire) {
                this.campfireIndicator = this.add.graphics();
                this.campfireIndicator.setDepth(campfire.depth - 1);

                const glowAnim = this.tweens.add({
                    targets: { intensity: 1 },
                    intensity: 1.2,
                    duration: 1000,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut',
                    onUpdate: (tween, target) => {
                        if (this.campfireIndicator && campfire) {
                            this.campfireIndicator.clear();
                            // Warm orange glow
                            this.campfireIndicator.lineStyle(3, 0xFF6600, 0.4 * target.intensity);
                            const radius = 60 * target.intensity;
                            this.campfireIndicator.strokeCircle(campfire.x, campfire.y, radius);
                            // Inner warm glow
                            this.campfireIndicator.lineStyle(2, 0xFFAA00, 0.3 * target.intensity);
                            this.campfireIndicator.strokeCircle(campfire.x, campfire.y, radius * 0.6);
                        }
                    }
                });
                this.campfireGlowAnim = glowAnim;
            }
        }
    }

    /**
     * Handle player proximity to the Signal Garden.
     */
    handleSignalGardenProximity() {
        if (this.nearSignalGarden) return;

        this.nearSignalGarden = true;
        console.log('[GameScene] Player near Signal Garden');
        this.showInteractionHint('Press SPACE to tend the Signal Garden 🌱');
        this.mobileControls?.updateInteractIcon('🌱');

        const gardenZone = this.signalGarden?.zone;
        if (!gardenZone || this.signalGardenIndicator) return;

        this.signalGardenIndicator = this.add.graphics();
        this.signalGardenIndicator.setDepth((gardenZone.depth || gardenZone.y) - 1);
        this.signalGardenIndicatorTween = this.tweens.add({
            targets: { scale: 1 },
            scale: 1.12,
            duration: 1300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            onUpdate: (tween, target) => {
                if (!this.signalGardenIndicator || !gardenZone.active) return;
                this.signalGardenIndicator.clear();
                this.signalGardenIndicator.lineStyle(3, 0x71E6B1, 0.42);
                this.signalGardenIndicator.strokeEllipse(
                    gardenZone.x,
                    gardenZone.y + 4,
                    190 * target.scale,
                    92 * target.scale
                );
            }
        });
    }

    tendSignalGarden() {
        if (!window.GameState || !this.signalGarden) return;

        const currentState = normalizeSignalGardenState(
            window.GameState.get('world.signalGarden')
        );
        const result = tendSignalGarden(currentState);

        if (!result.success) {
            this.showInteractionHint(result.message);
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

        if (window.FXLibrary?.stardustBurst) {
            window.FXLibrary.stardustBurst(this, gardenZone.x, gardenZone.y - 30, {
                count: result.isNewStage ? 18 : 10,
                color: [0x71E6B1, 0xF2C86B, 0xBFA6FF],
                duration: 1400
            });
        }
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
        this.cameras.main.shake(200, 0.01);

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
        this.cameras.main.flash(300, 147, 112, 219); // Purple flash

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

        // Save player position for return
        getGameState().set('world.lastPosition', {
            x: this.player.x,
            y: this.player.y
        });

        this.sceneRouter.playSound('visionReveal');
        this.sceneRouter.showLoading('Entering the Void...');

        // Screen effect - get sucked into the void
        this.cameras.main.shake(500, 0.015);

        // Fade to black and start void mini-game
        this.cameras.main.fadeOut(600, 0, 0, 0);

        this.cameras.main.once('camerafadeoutcomplete', () => {
            // Get the current creature texture for the mini-game
            const creatureTexture = this.creatureTextureName || getGameState().get('creature.textureName');

            // Start void mini-game scene
            this.sceneRouter.startScene('VoidMiniGameScene', {
                creatureTexture: creatureTexture,
                returnPosition: {
                    x: this.player.x,
                    y: this.player.y
                }
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

            const fieldKitRecovered = this.hasRecoveredProjectBeaconFieldKit();
            this.showInteractionHint(
                fieldKitRecovered
                    ? 'Press SPACE to examine your ship 🚀'
                    : 'Press SPACE to recover the field kit 🥋'
            );

            if (this.mobileControls) {
                this.mobileControls.updateInteractIcon(fieldKitRecovered ? '🚀' : '🥋');
            }
        }
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
            nextBtn.setText(pageIndex === storyPages.length - 1 ? 'Close' : 'Next →');
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

        const nextZone = this.add.zone(
            panelX + panelWidth - 68,
            panelY + panelHeight - 38,
            104,
            48
        ).setScrollFactor(0).setDepth(12004).setInteractive({ useHandCursor: true });
        elements.push(nextZone);
        nextZone.on('pointerover', () => nextBtn.setStyle({ backgroundColor: '#5AA0B4' }));
        nextZone.on('pointerout', () => nextBtn.setStyle({ backgroundColor: '#4A90A4' }));
        const closeStory = () => {
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

        nextZone.on('pointerdown', () => {
            if (currentPage < storyPages.length - 1) {
                currentPage++;
                updatePage(currentPage);
                if (window.AudioManager) window.AudioManager.playButtonClick();
            } else {
                closeStory();
            }
        });

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
    showDailyGreetingOverlay(creatureName, dailyBonus, onComplete = null) {
        const { width, height } = this.scale;

        // Create overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(5000);

        // Greeting panel
        const panelWidth = Math.min(400, width - 40);
        const panelHeight = dailyBonus.available ? 280 : 200;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 0.95);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.lineStyle(3, 0x7B68EE);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.setScrollFactor(0);
        panel.setDepth(5001);

        // Greeting messages based on time of day
        const hour = new Date().getHours();
        let timeGreeting;
        if (hour < 12) {
            timeGreeting = 'Good morning!';
        } else if (hour < 17) {
            timeGreeting = 'Good afternoon!';
        } else {
            timeGreeting = 'Good evening!';
        }

        // Random greeting variations
        const greetings = [
            `${timeGreeting}\n${creatureName} bounces excitedly to see you!`,
            `${timeGreeting}\n${creatureName} was waiting for you!`,
            `${timeGreeting}\n${creatureName}'s eyes light up!`,
            `${timeGreeting}\n${creatureName} does a happy wiggle!`,
            `${timeGreeting}\n${creatureName} chirps with joy!`
        ];
        const greeting = greetings[Math.floor(Math.random() * greetings.length)];

        // Title
        const title = this.add.text(width / 2, panelY + 25, '✨ Welcome Back! ✨', {
            fontSize: '22px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(5002);

        // Greeting text
        const greetingText = this.add.text(width / 2, panelY + 70, greeting, {
            fontSize: '16px',
            color: '#FFFFFF',
            align: 'center',
            lineSpacing: 6
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
            const bonusText = this.add.text(width / 2, panelY + 130,
                `🎁 Daily Login Bonus: Day ${dailyBonus.streak}\n+${dailyBonus.rewards.xp} XP  +${dailyBonus.rewards.stardust} Stardust`,
                {
                    fontSize: '15px',
                    color: '#90EE90',
                    align: 'center',
                    lineSpacing: 4
                }
            ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(5002);
            elements.push(bonusText);

            // Claim button
            const claimBtn = this.add.text(width / 2, panelY + panelHeight - 45, '🎁 Claim Bonus!', {
                fontSize: '18px',
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
            const closeBtn = this.add.text(width / 2, panelY + panelHeight - 35, 'Continue', {
                fontSize: '18px',
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
            const creatureLevel = getGameState().get('creature.level') || 1;
            this.showInteractionHint(`Fusion Pod unlocks at Level 5 (Current: ${creatureLevel})`);
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
        const availableSignals = this.livingSignals.filter(
            signal => signal?.active !== false && !signal.observed
        );
        const nearest = availableSignals.reduce((closest, signal) => {
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

        if (!nearest || nearest.distance > 150) {
            this.activeLivingSignalId = null;
            this.livingSignalDwellMs = 0;
            return;
        }

        if (!this.livingSignalApproachHintShown) {
            this.livingSignalApproachHintShown = true;
            this.showInteractionHint(
                'Living signal: approach with your companion and stay close.'
            );
        }

        if (nearest.distance > 82) {
            this.activeLivingSignalId = null;
            this.livingSignalDwellMs = 0;
            return;
        }

        if (this.activeLivingSignalId !== nearest.signal.signalId) {
            this.activeLivingSignalId = nearest.signal.signalId;
            this.livingSignalDwellMs = 0;
            this.showInteractionHint('Stay close. Your companion is listening.');
        }

        this.livingSignalDwellMs += Math.min(Number(delta) || 16.67, 100);
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
            this.refreshLivingSignalVisual(signal);
            return false;
        }

        window.GameState.set('world.livingSignals', result.state);
        window.GameState.visitArea?.(`signal:${signal.signalId}`);
        this.refreshLivingSignalVisual(signal);
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

        this.showLivingSignalMoment(result);
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
        const isMobile = width < 600;
        const panelWidth = Math.min(isMobile ? width - 24 : 520, width - 24);
        const panelHeight = isMobile ? 190 : 166;
        const panelX = (width - panelWidth) / 2;
        const mobileYLimit = height - panelHeight - 150;
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

        const eyebrow = this.add.text(
            panelX + 16,
            panelY + 13,
            `PROJECT BEACON // LIVING SIGNAL ${result.progress}/${result.total}`,
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
            panelY + panelHeight - 14,
            `FIELD NOTE // ${result.signal.fieldNote}`,
            {
                fontSize: isMobile ? '10px' : '11px',
                fontFamily: 'Arial, sans-serif',
                color: '#F2C14E',
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
     * Open creature profile scene
     */
    openCreatureProfile() {
        console.log('[GameScene] Opening creature profile');
        this.sceneRouter.launchScene('CreatureProfileScene', undefined, {
            bringToTop: true
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

    showInteractionHint(message) {
        if (!this.interactionText?.active) return;
        this.interactionText.setText(message);
        this.interactionText.setVisible(true);

        // Hide the hint after 3 seconds
        this.time.delayedCall(3000, () => {
            this.interactionText?.setVisible(false);
        });
    }

    hideInteractionHint() {
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
        console.log('[GameScene] SPACE pressed - nearShop:', this.nearShop, 'nearHubPortal:', this.nearHubPortal, 'nearCampfire:', this.nearCampfire, 'nearSignalGarden:', this.nearSignalGarden, 'nearCrashedShip:', this.nearCrashedShip, 'nearReturnPortal:', this.nearReturnPortal, 'nearbyFlower:', !!this.nearbyFlower);

        if (this.isFieldKitModalOpen) {
            return;
        }

        // Distance-based fallback for portals (in case overlap detection missed)
        // Note: Void portal uses automatic pull-in, not spacebar - so no check needed here
        const PORTAL_INTERACT_DISTANCE = 150;

        if (!this.nearHubPortal && this.hubPortal && this.player) {
            const distToHub = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                this.hubPortal.x, this.hubPortal.y
            );
            if (distToHub <= PORTAL_INTERACT_DISTANCE) {
                console.log('[GameScene] Distance fallback: Player within range of hub portal');
                this.nearHubPortal = true;
            }
        }

        if (!this.nearReturnPortal && this.returnPortal && this.player) {
            const distToReturn = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                this.returnPortal.x, this.returnPortal.y
            );
            if (distToReturn <= PORTAL_INTERACT_DISTANCE) {
                console.log('[GameScene] Distance fallback: Player within range of return portal');
                this.nearReturnPortal = true;
            }
        }

        // Distance-based fallback for campfire (CRITICAL for mobile touch input)
        const CAMPFIRE_INTERACT_DISTANCE = 120;
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

        const GARDEN_INTERACT_DISTANCE = 130;
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

        // Check for shop entry first
        if (this.nearShop) {
            console.log('[GameScene] Entering shop from SPACE handler');
            this.enterShop();
            this.nearShop = false;
            return;
        }

        // Note: Void portal entry is now automatic (pull-in mechanic) - no spacebar interaction

        // Check for hub portal entry (travel to other worlds)
        if (this.nearHubPortal) {
            console.log('[GameScene] Entering hub world from SPACE handler');
            this.enterHubWorld();
            this.nearHubPortal = false;
            return;
        }

        // Check for campfire rest interaction
        if (this.nearCampfire) {
            console.log('[GameScene] Starting campfire rest from SPACE handler');
            this.startCampfireRest();
            return;
        }

        if (this.nearSignalGarden) {
            console.log('[GameScene] Tending Signal Garden from SPACE handler');
            this.tendSignalGarden();
            return;
        }

        // Check for crashed ship interaction
        if (this.nearCrashedShip) {
            if (this.hasRecoveredProjectBeaconFieldKit()) {
                console.log('[GameScene] Viewing ship memories from SPACE handler');
                this.showShipMemories();
                this.nearCrashedShip = false;
            } else {
                console.log('[GameScene] Recovering field kit from SPACE handler');
                this.recoverProjectBeaconFieldKit();
            }
            return;
        }

        // Check for return portal interaction
        if (this.nearReturnPortal) {
            console.log('[GameScene] Returning to Sanctuary from SPACE handler');
            this.returnToSanctuary();
            this.nearReturnPortal = false;
            return;
        }

        if (this.nearbyFlower) {
            // Use Nature Attunement System for flower interaction
            if (window.NatureAttunementSystem) {
                const result = window.NatureAttunementSystem.recordInteraction(
                    'flower',
                    this,
                    this.nearbyFlower.x,
                    this.nearbyFlower.y
                );

                if (result.success) {
                    // Track interaction in GameState
                    getGameState().updateWorldExploration(
                        { x: this.player.x, y: this.player.y },
                        'flowers'
                    );

                    // Create a magical sparkle effect on the flower (with defensive texture check)
                    if (this.textures.exists('magicalSparkle')) {
                        const sparkle = this.add.image(this.nearbyFlower.x, this.nearbyFlower.y - 20, 'magicalSparkle');
                        sparkle.setScale(0.6);

                        // Animate the sparkle
                        this.tweens.add({
                            targets: sparkle,
                            y: sparkle.y - 30,
                            alpha: { from: 1, to: 0 },
                            scale: { from: 0.5, to: 1 },
                            duration: 1000,
                            onComplete: () => sparkle.destroy()
                        });
                    } else {
                        // Texture not available - try to recreate it for future use
                        console.warn('[GameScene] magicalSparkle texture not found, recreating');
                        if (this.graphicsEngine) {
                            this.graphicsEngine.createMagicalSparkle(0x00FFFF, 0.8);
                        }
                    }

                    // Update creature happiness (with nature bonus)
                    const natureBonus = window.NatureAttunementSystem.getStatBonus('happiness');
                    const happinessGain = Math.round(2 * (1 + natureBonus / 100));
                    getGameState().updateCreature({
                        stats: { happiness: getGameState().get('creature.stats.happiness') + happinessGain }
                    });

                    // Show interaction message with attunement info
                    const dailyLeft = result.dailyRemaining;
                    this.showInteractionHint(`*sniff* Nature attunement +${result.pointsEarned}! (${dailyLeft} flowers left today)`);

                    // Show milestone unlock if applicable
                    if (result.milestoneUnlocked) {
                        console.log(`[GameScene] Nature milestone unlocked: ${result.milestoneName}`);
                    }

                    // Update stats display
                    this.updateStatsDisplay();

                    // INTEGRATION: Get creature's response via CreatureAIController
                    if (window.CreatureAIController) {
                        window.CreatureAIController.respondToExploration('flower')
                            .then(response => {
                                this.showCreatureResponse(response);
                            })
                            .catch(error => {
                                console.warn('[GameScene] AI response failed:', error);
                            });
                    }

                    // Check achievements after flower interaction
                    this.time.delayedCall(500, () => this.checkAndUnlockAchievements());
                } else {
                    // Daily limit reached
                    this.showInteractionHint(result.message || 'You\'ve enjoyed enough flowers today!');
                }
            } else {
                // Fallback if NatureAttunementSystem not available
                getGameState().updateCreature({
                    stats: { happiness: getGameState().get('creature.stats.happiness') + 2 }
                });
                this.showInteractionHint('*sniff* What a lovely smell! (+2 Happiness)');
            }

            this.nearbyFlower = null;

            // Reset mobile interact button icon to default (unless near shop)
            if (this.mobileControls && !this.nearShop) {
                this.mobileControls.updateInteractIcon('👆');
            }
        }
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
        if (this._isShuttingDown || !this.player) {
            return;
        }

        if (this.waypointPreview) {
            this.projectBeaconWaypoint?.update(delta || 16.67);
            return;
        }

        if (this.mapRecoveryPreview) {
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

            // Reset nearShop flag if player moved away (> 250 pixels - accounts for 200x200 body)
            if (distance > 250) {
                console.log('[GameScene] Player moved away from shop, distance:', distance);
                this.nearShop = false;
                this.hideInteractionHint();

                // Reset mobile interact button icon to default
                if (this.mobileControls && !this.nearbyFlower) {
                    this.mobileControls.updateInteractIcon('👆');
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

            // Reset nearHubPortal flag if player moved away (> 150 pixels)
            if (distance > 150) {
                console.log('[GameScene] Player moved away from hub portal, distance:', distance);
                this.nearHubPortal = false;
                this.hideInteractionHint();

                // Clean up portal indicator
                if (this.portalIndicator) {
                    if (this.portalPulseAnim) {
                        this.portalPulseAnim.stop();
                        this.portalPulseAnim = null;
                    }
                    this.portalIndicator.destroy();
                    this.portalIndicator = null;
                }

                if (this.mobileControls && !this.nearbyFlower && !this.nearShop) {
                    this.mobileControls.updateInteractIcon('👆');
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

            // Reset nearCrashedShip flag if player moved away (> 200 pixels)
            if (distance > 200) {
                console.log('[GameScene] Player moved away from crashed ship, distance:', distance);
                this.nearCrashedShip = false;
                this.hideInteractionHint();

                if (this.mobileControls && !this.nearbyFlower && !this.nearShop && !this.nearHubPortal) {
                    this.mobileControls.updateInteractIcon('👆');
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

            // Reset nearReturnPortal flag if player moved away (> 150 pixels)
            if (distance > 150) {
                console.log('[GameScene] Player moved away from return portal, distance:', distance);
                this.nearReturnPortal = false;
                this.hideInteractionHint();

                if (this.mobileControls && !this.nearbyFlower && !this.nearShop && !this.nearHubPortal && !this.nearCrashedShip) {
                    this.mobileControls.updateInteractIcon('👆');
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

            // Reset nearCampfire flag if player moved away (> 100 pixels)
            if (distance > 100) {
                console.log('[GameScene] Player moved away from campfire, distance:', distance);
                this.nearCampfire = false;
                this.hideInteractionHint();

                // Clean up campfire indicator
                if (this.campfireIndicator) {
                    this.campfireIndicator.destroy();
                    this.campfireIndicator = null;
                }
                if (this.campfireGlowAnim) {
                    this.campfireGlowAnim.stop();
                    this.campfireGlowAnim = null;
                }

                if (this.mobileControls && !this.nearbyFlower && !this.nearShop && !this.nearHubPortal && !this.nearCrashedShip && !this.nearReturnPortal) {
                    this.mobileControls.updateInteractIcon('👆');
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

            if (distance > 130) {
                console.log('[GameScene] Player moved away from Signal Garden, distance:', distance);
                this.nearSignalGarden = false;
                this.hideInteractionHint();
                this.signalGardenIndicatorTween?.stop();
                this.signalGardenIndicatorTween = null;
                this.signalGardenIndicator?.destroy();
                this.signalGardenIndicator = null;

                if (
                    this.mobileControls &&
                    !this.nearbyFlower &&
                    !this.nearShop &&
                    !this.nearHubPortal &&
                    !this.nearCrashedShip &&
                    !this.nearReturnPortal &&
                    !this.nearCampfire
                ) {
                    this.mobileControls.updateInteractIcon('👆');
                }
            }
        }

        // Check target range proximity (zone-based check)
        this.checkTargetRangeProximity();

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

                // Reset mobile interact button icon to default (unless near shop)
                if (this.mobileControls && !this.nearShop) {
                    this.mobileControls.updateInteractIcon('👆');
                }
            }
        }
    }

    handleMovement() {
        // Guard: Ensure player and cursors exist
        if (!this.player || !this.cursors || !this.wasdKeys) {
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

        let careStatus = null;
        let happinessDesc = { level: 'unknown' };

        if (this.careSystem) {
            try {
                if (typeof this.careSystem.getCareStatus === 'function') {
                    careStatus = this.careSystem.getCareStatus();
                }
                if (typeof this.careSystem.getHappinessDescription === 'function') {
                    happinessDesc = this.careSystem.getHappinessDescription(stats.happiness);
                }
            } catch (careError) {
                console.warn('[GameScene] Error getting care status:', careError);
                careStatus = null;
                happinessDesc = { level: 'unknown' };
            }
        }

        const achievementProgress = this.getAchievementProgressText();
        const tutorialProgress = this.getTutorialProgressText();

        // Check for low/critical stat values and add warnings
        const healthWarning = this.getStatWarning(stats.health, 100);
        const happinessWarning = this.getStatWarning(stats.happiness, 100);
        const energyWarning = this.getStatWarning(stats.energy, 100);

        const hasCriticalStats = healthWarning.critical || happinessWarning.critical || energyWarning.critical;

        const displayText = [
            `${creature.name} - Level ${creature.level}`,
            `XP: ${creature.experience}/100`,
            `${healthWarning.icon} ${stats.health} ${happinessWarning.icon} ${stats.happiness} (${happinessDesc.level}) ${energyWarning.icon} ${stats.energy}`,
            `Care Streak: ${careStatus ? careStatus.careStreak : 0} days`,
            `${achievementProgress}`,
            `${tutorialProgress}`,
            `Flowers: ${getGameState().get('world.discoveredObjects.flowers')}`
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
        const hint = this.add.text(this.scale.width / 2, 140, tutorial.message, {
            fontSize: '16px',
            color: '#87CEEB',
            stroke: '#000000',
            strokeThickness: 2,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: { x: 16, y: 8 },
            align: 'center'
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
            if (data.path.startsWith('creature.stats') ||
                data.path.startsWith('creature.care') ||
                data.path.startsWith('world.discoveredObjects') ||
                data.path.startsWith('dailyBonus')) {
                this.updateStatsDisplay();
                this.carePanelManager?.updateHint();
                this.carePanelManager?.updateButtons();
                this.updateDailyBonusButton();
            }
        });

        // Listen for personality shift events
        this.registerGameStateListener('personality/shift', (data) => {
            this.showPersonalityShiftCelebration(data);
        });

        // Listen for breeding unlock event (when player gets 2nd creature)
        this.registerGameStateListener('breedingUnlocked', (data) => {
            this.showBreedingUnlockTutorial(data);
        });

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
        this.cameras.main.flash(300, 255, 215, 0);

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

        const title = this.add.text(width / 2, height * 0.25, 'Welcome Back...', {
            fontSize: '32px',
            color: '#87CEEB',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(5001);

        const message = this.add.text(width / 2, height * 0.4, `${creatureName} missed you!\nYou were away for ${daysAway} day${daysAway > 1 ? 's' : ''}.`, {
            fontSize: '18px',
            color: '#FFFFFF',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5).setScrollFactor(0).setDepth(5001);

        const hint = this.add.text(width / 2, height * 0.55, 'Care for your creature to make them happy again!', {
            fontSize: '14px',
            color: '#FFD700',
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(5001);

        // Close button
        const closeBtn = this.add.text(width / 2, height * 0.7, 'OK', {
            fontSize: '20px',
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

        // Play sad sound when showing the return message
        if (window.AudioManager) {
            window.AudioManager.playSad();
        }
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
        // Check if already seen
        if (window.GameState?.get('tutorial.breedingUnlockSeen')) {
            return;
        }

        console.log('[GameScene] Showing breeding unlock tutorial');

        const { width, height } = this.cameras.main;

        // Create dark overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0).setDepth(3000);

        // Modal panel
        const panelWidth = Math.min(350, width - 40);
        const panelHeight = 380;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 0.98);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.lineStyle(3, 0xFFD700, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.setScrollFactor(0).setDepth(3001);

        // Title
        const title = this.add.text(width / 2, panelY + 35, '🧬 Breeding Unlocked! 🧬', {
            fontSize: '22px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Explanation
        let y = panelY + 80;

        const intro = this.add.text(width / 2, y, 'You now have 2 creatures!', {
            fontSize: '16px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
        y += 35;

        const description = this.add.text(width / 2, y,
            'Visit the Breeding Shrine to combine\nyour creatures and create offspring\nwith traits from both parents!', {
                fontSize: '13px',
                color: '#CCCCCC',
                align: 'center'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
        y += 70;

        // How it works section
        const howItWorks = this.add.text(width / 2, y, 'How Breeding Works:', {
            fontSize: '14px',
            color: '#88CCFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
        y += 25;

        const steps = [
            '1. Both creatures must be Adults (Day 3+)',
            '2. Select two different creatures',
            '3. Higher compatibility = better offspring!',
            '4. Offspring inherit traits from both parents'
        ];

        const stepTexts = [];
        steps.forEach(step => {
            const stepText = this.add.text(width / 2, y, step, {
                fontSize: '11px',
                color: '#AAAAAA'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
            stepTexts.push(stepText);
            y += 20;
        });

        y += 15;

        // Bonus info
        const bonusText = this.add.text(width / 2, y, '✨ Offspring get bonus Cosmic Power!', {
            fontSize: '12px',
            color: '#88FF88'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Got it button
        const btnY = panelY + panelHeight - 50;
        const btn = this.add.text(width / 2, btnY, 'Got it!', {
            fontSize: '18px',
            color: '#FFFFFF',
            backgroundColor: '#4B0082',
            padding: { x: 40, y: 12 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002).setInteractive();

        btn.on('pointerdown', () => {
            // Mark tutorial as seen
            window.GameState?.set('tutorial.breedingUnlockSeen', true);

            // Cleanup
            overlay.destroy();
            panel.destroy();
            title.destroy();
            intro.destroy();
            description.destroy();
            howItWorks.destroy();
            stepTexts.forEach(t => t.destroy());
            bonusText.destroy();
            btn.destroy();

            // Play confirmation sound
            window.AudioManager?.playButtonClick?.();
        });

        btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#6B21A8' }));
        btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#4B0082' }));

        // Play celebration sound
        window.AudioManager?.playLevelUp?.();

        // Particle burst
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, width / 2, height / 2, {
                count: 25,
                color: [0xFFD700, 0x9370DB, 0xFF69B4],
                duration: 2000
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
        // Get creature stats for status bars
        const creatureStats = getGameState().get('creature.stats') || { happiness: 80, energy: 60, health: 90 };
        const needsData = {
            hunger: 100 - creatureStats.happiness,
            energy: 100 - creatureStats.energy, 
            fun: Math.max(0, 100 - creatureStats.happiness - 20)
        };

        // Create status bar at top
        if (window.responsiveManager) {
            this.kidModeStatusBar = window.responsiveManager.createKidModeStatusBar(this, needsData);
        }

        // Get next best action based on creature state
        const emotion = this.determineCreatureEmotion(creatureStats);
        const bestAction = window.KidMode.getNextBestAction(emotion);
        const secondaryActions = window.KidMode.getSecondaryActions(bestAction.action);

        // Show contextual help message
        if (bestAction.message && window.KidMode && window.KidMode.showSpaceHelpMessage) {
            window.KidMode.showSpaceHelpMessage(this, bestAction.message);
        }
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

        // Show new contextual message if emotion changed
        if (this.lastEmotion !== emotion) {
            window.KidMode.showHelpMessage(this, bestAction.message);
            this.lastEmotion = emotion;
        }
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

        // Remove scene event listeners
        if (this.events && this.kidModeActionHandler) {
            this.events.off('kid_mode_action', this.kidModeActionHandler, this);
            this.kidModeActionHandler = null;
        }

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
            const stageDays = { baby: 0, juvenile: 1, adult: 3, elder: 10 };

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
