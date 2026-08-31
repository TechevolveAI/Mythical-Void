/**
 * HubWorldScene - Central hub with gates to different biomes
 * Crash Bandicoot-style circular gate layout
 * Features: Gate navigation, creature display, biome selection
 */

import Phaser from 'phaser';
import { getCampaignJourneyStep } from '../systems/CampaignJourneyGuide.js';
import { companionMediaService } from '../systems/CompanionMediaService.js';
import {
    acknowledgeProjectBeaconDebrief,
    getNextProjectBeaconDebrief,
    getProjectBeaconDebrief,
    getProjectBeaconFirstExpeditionHandoff
} from '../systems/ProjectBeaconStory.js';
import { getExpeditionDiagnosticSnapshot } from '../systems/ExpeditionDiagnostics.js';
import { getShipReconstructionSnapshot } from '../systems/ShipReconstruction.js';

const PRE_FINAL_SHIP_PART_IDS = Object.freeze([
    'crystal_core',
    'dimensional_drive',
    'forest_core',
    'hull_plating',
    'aurora_reactor'
]);

const LEVEL_NAMES = Object.freeze({
    crystalCaves: 'Crystal Caves',
    cosmicReef: 'Stellar Reef',
    mythicalForest: 'Mythical Forest',
    voidPeaks: 'Void Peaks',
    auroraDepths: 'Aurora Depths',
    finalVoid: 'The Final Void'
});

const SHIP_PART_NAMES = Object.freeze({
    crystal_core: 'Crystal Core',
    dimensional_drive: 'Dimensional Drive',
    forest_core: 'Forest Core',
    hull_plating: 'Hull Plating',
    aurora_reactor: 'Aurora Reactor',
    command_module: 'Command Module'
});

const GUARDIAN_NAME_BY_LEVEL = Object.freeze({
    mythicalForest: 'Elder Treant',
    crystalCaves: 'Crystal Guardian',
    cosmicReef: "Nyx'voral",
    auroraDepths: 'Aurora Phoenix',
    voidPeaks: 'Cosmic Titan',
    finalVoid: 'Void Empress'
});

const FINAL_VOID_GATE_DEFAULT = Object.freeze({
    unlocked: false,
    name: 'The Final Void',
    biome: 'final_void',
    visits: 0,
    inDevelopment: false,
    unlockCost: 0,
    shipPart: 'Command Module',
    requiresAllParts: true
});

const DEBRIEF_PREVIEW_CONTEXTS = Object.freeze({
    1: { levelId: 'mythicalForest', shipPartId: 'forest_core' },
    2: { levelId: 'crystalCaves', shipPartId: 'crystal_core' },
    3: { levelId: 'cosmicReef', shipPartId: 'dimensional_drive' },
    4: { levelId: 'voidPeaks', shipPartId: 'hull_plating' },
    5: { levelId: 'auroraDepths', shipPartId: 'aurora_reactor' }
});

const EXPEDITION_CHECKPOINT_PATH =
    'story.projectBeacon.expeditionCheckpoint';
const EXPEDITION_CHECKPOINT_VERSION = 1;
const EXPEDITION_CHECKPOINTS_BY_GATE = Object.freeze({
    mythical_forest: {
        sceneKey: 'MythicalForestLevel',
        levelId: 'mythical_forest_1',
        levelStateId: 'mythicalForest',
        checkpoints: [
            ['forest_anchor_1', 'Rootway'],
            ['forest_anchor_2', 'Crown Path'],
            ['forest_anchor_3', 'Guardian Approach']
        ]
    },
    crystal_caves: {
        sceneKey: 'CrystalCavesLevel',
        levelId: 'crystal_caves_1',
        levelStateId: 'crystalCaves',
        checkpoints: [
            ['caves_anchor_1', 'Echo Pass'],
            ['caves_anchor_2', 'Living Chamber'],
            ['caves_anchor_3', 'Guardian Threshold']
        ]
    },
    stellar_reef: {
        sceneKey: 'ReefLevel',
        levelId: 'reef_1',
        levelStateId: 'cosmicReef',
        checkpoints: [
            ['reef_waypoint_1', 'Drift Marker'],
            ['reef_waypoint_2', 'Traveler Relay'],
            ['reef_waypoint_3', 'Passage Vector']
        ]
    },
    void_peaks: {
        sceneKey: 'VoidPeaksLevel',
        levelId: 'void_peaks_1',
        levelStateId: 'voidPeaks',
        checkpoints: [
            ['peaks_relay_1', 'Lower Relay'],
            ['peaks_relay_2', 'Ridge Relay'],
            ['peaks_relay_3', 'Summit Relay']
        ]
    },
    aurora_depths: {
        sceneKey: 'AuroraDepthsLevel',
        levelId: 'aurora_depths_1',
        levelStateId: 'auroraDepths',
        checkpoints: [
            ['aurora_prism_1', 'Lower Prism'],
            ['aurora_prism_2', 'Heart Prism'],
            ['aurora_prism_3', 'Sky Prism']
        ]
    },
    final_void: {
        sceneKey: 'FinalVoidLevel',
        levelId: 'final_void_1',
        levelStateId: 'finalVoid',
        checkpoints: [
            ['final_bond_1', 'Living Systems'],
            ['final_bond_2', 'Return Route'],
            ['final_bond_3', 'Trust Marker']
        ]
    }
});

function countCollectedPreFinalParts(collected = []) {
    return PRE_FINAL_SHIP_PART_IDS.filter(partId => collected.includes(partId)).length;
}

export default class HubWorldScene extends Phaser.Scene {
    constructor() {
        super({ key: 'HubWorldScene' });

        this.graphicsEngine = null;
        this.gates = [];
        this.selectedGateIndex = 0;
        this.creatureSprite = null;
        this.gateElements = [];
        this.isTransitioning = false;
        this._isShuttingDown = false;
        this.firstExpeditionElements = [];
        this.isFirstExpeditionInvitationOpen = false;
        this.gateTransitionStarted = false;
        this.gateTransitionFallback = null;
    }

    /**
     * Reset state on scene start - called before create()
     */
    init(data = {}) {
        // CRITICAL: Reset all state flags on scene start
        this.isTransitioning = false;
        this._isShuttingDown = false;
        this.selectedGateIndex = 0;
        this.gates = [];
        this.gateElements = [];
        this.creatureSprite = null;
        this.graphicsEngine = null;
        this.shipAssemblyElements = [];
        this.portalVortexElements = [];
        this.vortexTimers = [];
        this.parallaxLayers = [];
        this.projectBeaconDebriefElements = [];
        this.isProjectBeaconDebriefOpen = false;
        this.firstExpeditionElements = [];
        this.isFirstExpeditionInvitationOpen = false;
        this.gateTransitionStarted = false;
        if (this.gateTransitionFallback) {
            clearTimeout(this.gateTransitionFallback);
        }
        this.gateTransitionFallback = null;
        this.progressionPreview = data.progressionPreview || null;
        this.progressionPreviewSize = data.previewSize === 'mobile'
            ? 'mobile'
            : null;
        this.shipReconstruction = null;
        console.log('[HubWorldScene] State reset in init()');
    }

    create() {
        console.log('[HubWorldScene] Initializing Hub World');

        this._isShuttingDown = false;
        this.isTransitioning = false; // CRITICAL: Reset transition flag on scene start

        // Initialize graphics engine
        if (window.GraphicsEngine) {
            this.graphicsEngine = new window.GraphicsEngine(this);
        }

        if (this.progressionPreviewSize === 'mobile') {
            const viewportWidth = Math.min(390, this.scale.width);
            const viewportHeight = Math.min(720, this.scale.height);
            this.scale.resize(viewportWidth, viewportHeight);
            this.cameras.main.setViewport(
                0,
                0,
                viewportWidth,
                viewportHeight
            );
        }

        // Calculate dimensions
        this.calculateDimensions();
        this.clearCompletedExpeditionCheckpoint();
        this.shipReconstruction = getShipReconstructionSnapshot(
            window.GameState
        );
        this.syncFinalVoidAccess();

        // Create visuals
        this.createBackground();
        this.createCentralPlatform();
        this.createGates();
        this.createShipAssemblyView(); // Ship visualization above creature
        this.createCreatureDisplay();
        this.createUI();
        this.createCollectionButton();

        // Set up input
        this.setupInput();

        const shouldOfferFirstExpedition = this.shouldShowFirstExpeditionInvitation();
        this.campaignJourneyStep = getCampaignJourneyStep(window.GameState);
        const firstExpeditionIndex = this.gates.findIndex(
            gate => gate.id === 'mythical_forest'
        );
        const routeMapIndex = this.gates.findIndex(
            gate => gate.id === 'stellar_reef'
        );
        const diagnosticsIndex = this.gates.findIndex(
            gate => gate.id === 'aurora_depths'
        );
        const resumeGateIndex = this.gates.findIndex(
            gate => this.getExpeditionResumeForGate(gate.id)
        );
        const recommendedGateIndex = this.gates.findIndex(
            gate => gate.id === this.campaignJourneyStep?.gateId
        );
        this.selectGate(
            this.progressionPreview === 'routeMap' && routeMapIndex >= 0
                ? routeMapIndex
                : this.progressionPreview === 'diagnostics' &&
                    diagnosticsIndex >= 0
                    ? diagnosticsIndex
                : resumeGateIndex >= 0
                ? resumeGateIndex
                : shouldOfferFirstExpedition && firstExpeditionIndex >= 0
                ? firstExpeditionIndex
                : recommendedGateIndex >= 0
                ? recommendedGateIndex
                : 0
        );

        // Hide loading
        if (window.UXEnhancements) {
            window.UXEnhancements.hideLoading();
        }

        // Register shutdown
        if (this.events) {
            this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
            this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);
        }

        // Reveal the final route only after five deliberate ship installations.
        const cutsceneShown = window.GameState?.get('hubWorld.shipCompletionCutsceneShown') || false;
        const shouldShowShipCutscene =
            (
                !this.progressionPreview ||
                this.progressionPreview === 'finalApproach'
            ) &&
            this.isFinalVoidReady() &&
            (
                this.progressionPreview === 'finalApproach' ||
                !cutsceneShown
            );
        const hasPendingDebrief =
            !this.progressionPreview &&
            Boolean(this.getPendingProjectBeaconDebrief());
        if (hasPendingDebrief) {
            this.time.delayedCall(400, () => {
                this.showPendingProjectBeaconDebrief(() => {
                    if (shouldShowShipCutscene && !this._isShuttingDown) {
                        this.showShipCompletionCutscene();
                    }
                });
            });
        } else if (shouldShowShipCutscene) {
            this.time.delayedCall(500, () => this.showShipCompletionCutscene());
        } else if (this.progressionPreview === 'routeMap') {
            this.time.delayedCall(450, () => {
                const routeGate = this.gates.find(
                    gate => gate.id === 'stellar_reef'
                );
                if (routeGate && !this._isShuttingDown) {
                    this.showUnlockConfirmation(routeGate);
                }
            });
        } else if (shouldOfferFirstExpedition) {
            this.time.delayedCall(450, () => {
                if (!this._isShuttingDown && !this.isTransitioning) {
                    this.showFirstExpeditionInvitation();
                }
            });
        }

        console.log('[HubWorldScene] Hub World ready');
    }

    isFinalVoidReady() {
        return ['complete', 'finalApproach'].includes(
            this.progressionPreview
        ) || this.shipReconstruction?.finalVoidReady === true;
    }

    syncFinalVoidAccess() {
        if (this.progressionPreview) return;
        const ready = this.shipReconstruction?.finalVoidReady === true;
        const revealSeen = window.GameState?.get(
            'hubWorld.shipCompletionCutsceneShown'
        ) === true;
        const savedGate = window.GameState?.get(
            'hubWorld.gates.final_void'
        ) || {};
        window.GameState?.set(
            'hubWorld.shipParts.finalBossUnlocked',
            ready
        );
        window.GameState?.set('hubWorld.gates.final_void', {
            ...FINAL_VOID_GATE_DEFAULT,
            ...savedGate,
            unlocked: ready && revealSeen
        });
    }

    shouldShowFirstExpeditionInvitation() {
        if (this.progressionPreview === 'firstRoute') return true;
        if (this.progressionPreview) return false;
        if (window.GameState?.get('story.projectBeacon.firstExpeditionPromptSeen')) {
            return false;
        }

        const forest = window.GameState?.get('levels.mythicalForest') || {};
        if (forest.entered || forest.completed || forest.visited) {
            return false;
        }

        const fieldKitRecovered = Boolean(
            window.GameState?.get('story.projectBeacon.fieldKit.recovered')
        );
        const observedSignals = window.GameState?.get(
            'world.livingSignals.observedIds'
        );

        return fieldKitRecovered &&
            Array.isArray(observedSignals) &&
            observedSignals.length >= 3;
    }

    showFirstExpeditionInvitation() {
        if (
            this._isShuttingDown ||
            this.isTransitioning ||
            this.isFirstExpeditionInvitationOpen
        ) {
            return false;
        }

        const handoff = getProjectBeaconFirstExpeditionHandoff();
        const forestGate = this.gates.find(gate => gate.id === 'mythical_forest');
        if (!handoff || !forestGate?.data?.unlocked) {
            return false;
        }
        const companionName = String(
            window.GameState?.get?.('creature.name') || 'Your companion'
        ).trim().replace(/\s+/g, ' ').slice(0, 20) || 'Your companion';

        (window.CompanionMediaService || companionMediaService)
            ?.prepareCinematic?.(this, {
                momentId: 'first_forest_arrival',
                stage: window.GameState?.get?.('creature.lifecycle.stage') || 'baby'
            });

        this.isFirstExpeditionInvitationOpen = true;
        const { width, height, isMobile } = this.dims;
        const panelWidth = Math.min(isMobile ? width - 28 : 590, width - 28);
        const panelHeight = Math.min(isMobile ? 500 : 410, height - 28);
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;
        const centerX = width / 2;
        const textWidth = panelWidth - (isMobile ? 44 : 72);
        const depth = 620;

        const overlay = this.add.graphics();
        overlay.fillStyle(0x02060A, 0.88);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(depth);
        overlay.setInteractive(
            new Phaser.Geom.Rectangle(0, 0, width, height),
            Phaser.Geom.Rectangle.Contains
        );

        const panel = this.add.graphics();
        panel.fillStyle(0x0B1B18, 0.99);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 10);
        panel.lineStyle(3, 0x71E6B1, 0.95);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 10);
        panel.setDepth(depth + 1);

        const routeHeader = this.add.text(centerX, panelY + panelHeight * 0.08, handoff.route, {
            fontSize: isMobile ? '11px' : '13px',
            fontFamily: 'Arial, sans-serif',
            color: '#8FE3CF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(depth + 2);

        const routeIcon = this.add.text(centerX, panelY + panelHeight * 0.2, '🌿', {
            fontSize: isMobile ? '38px' : '46px'
        }).setOrigin(0.5).setDepth(depth + 2);

        const title = this.add.text(centerX, panelY + panelHeight * 0.31, handoff.title, {
            fontSize: isMobile ? '25px' : '31px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5).setDepth(depth + 2);

        const finding = this.add.text(centerX, panelY + panelHeight * 0.43, handoff.finding, {
            fontSize: isMobile ? '13px' : '15px',
            fontFamily: 'Arial, sans-serif',
            color: '#D6EEF2',
            lineSpacing: 4,
            align: 'center',
            wordWrap: { width: textWidth }
        }).setOrigin(0.5, 0).setDepth(depth + 2);

        const companion = this.add.text(
            centerX,
            panelY + panelHeight * (isMobile ? 0.61 : 0.59),
            `COMPANION // ${companionName}: "${handoff.companionMoment}"`,
            {
                fontSize: isMobile ? '11px' : '12px',
                fontFamily: 'Arial, sans-serif',
                color: '#BFA6FF',
                fontStyle: 'bold',
                align: 'center',
                wordWrap: { width: textWidth }
            }
        ).setOrigin(0.5, 0).setDepth(depth + 2);

        const fieldNote = this.add.text(
            centerX,
            panelY + panelHeight * (isMobile ? 0.7 : 0.68),
            `FIELD NOTE // ${handoff.fieldNote}`,
            {
                fontSize: isMobile ? '10px' : '11px',
                fontFamily: 'Arial, sans-serif',
                color: '#F2C14E',
                fontStyle: 'bold',
                align: 'center',
                wordWrap: { width: textWidth }
            }
        ).setOrigin(0.5, 0).setDepth(depth + 2);

        const primary = this.add.text(
            centerX,
            panelY + panelHeight * 0.84,
            handoff.primaryAction,
            {
                fontSize: isMobile ? '15px' : '17px',
                fontFamily: 'Arial, sans-serif',
                color: '#071411',
                backgroundColor: '#71E6B1',
                fontStyle: 'bold',
                padding: {
                    x: isMobile ? 18 : 24,
                    y: isMobile ? 11 : 12
                }
            }
        ).setOrigin(0.5).setDepth(depth + 3)
            .setInteractive({ useHandCursor: true });

        const secondary = this.add.text(
            centerX,
            panelY + panelHeight * 0.95,
            handoff.secondaryAction,
            {
                fontSize: isMobile ? '12px' : '13px',
                fontFamily: 'Arial, sans-serif',
                color: '#A8C2C7',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setDepth(depth + 3)
            .setInteractive({ useHandCursor: true });

        primary.on('pointerdown', () => {
            this.closeFirstExpeditionInvitation();
            if (this.progressionPreview === 'firstRoute') return;
            this.enterGate(forestGate);
        });
        secondary.on('pointerdown', () => {
            this.closeFirstExpeditionInvitation();
        });
        primary.on('pointerover', () => primary.setBackgroundColor('#A4F5D0'));
        primary.on('pointerout', () => primary.setBackgroundColor('#71E6B1'));

        this.firstExpeditionElements = [
            overlay,
            panel,
            routeHeader,
            routeIcon,
            title,
            finding,
            companion,
            fieldNote,
            primary,
            secondary
        ];

        return true;
    }

    closeFirstExpeditionInvitation({ markSeen = true } = {}) {
        this.firstExpeditionElements.forEach(element => {
            element?.removeAllListeners?.();
            element?.destroy?.();
        });
        this.firstExpeditionElements = [];
        this.isFirstExpeditionInvitationOpen = false;

        if (
            markSeen &&
            this.progressionPreview !== 'firstRoute' &&
            window.GameState
        ) {
            window.GameState.set(
                'story.projectBeacon.firstExpeditionPromptSeen',
                true
            );
            window.GameState.save?.();
        }
    }

    getPendingProjectBeaconDebrief() {
        const params = new URLSearchParams(window.location.search);
        const previewNumber = Number.parseInt(params.get('testDebrief'), 10);
        const isLocalPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        const previewContext = DEBRIEF_PREVIEW_CONTEXTS[previewNumber];

        if (isLocalPreview && previewContext) {
            const debrief = getProjectBeaconDebrief(`beacon_debrief_${previewNumber}`);
            return debrief ? {
                ...previewContext,
                ...debrief,
                completedAt: null,
                isPreview: true
            } : null;
        }

        return getNextProjectBeaconDebrief(window.GameState);
    }

    showPendingProjectBeaconDebrief(onComplete = null) {
        if (this._isShuttingDown || this.isProjectBeaconDebriefOpen) {
            return false;
        }

        const debrief = this.getPendingProjectBeaconDebrief();
        if (!debrief) {
            onComplete?.();
            return false;
        }

        this.isProjectBeaconDebriefOpen = true;
        const { width, height, isMobile } = this.dims;
        const panelWidth = Math.min(isMobile ? width - 32 : 620, width - 32);
        const panelHeight = Math.min(isMobile ? 660 : 520, height - 32);
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;
        const centerX = width / 2;
        const textWidth = panelWidth - (isMobile ? 46 : 80);
        const levelName = LEVEL_NAMES[debrief.levelId] || 'Unknown Realm';
        const partName = SHIP_PART_NAMES[debrief.shipPartId] || 'Ship System';
        const restoredGuardianName =
            GUARDIAN_NAME_BY_LEVEL[debrief.levelId] || null;
        const companionName = String(
            window.GameState?.get?.('creature.name') || 'Your companion'
        ).trim().replace(/\s+/g, ' ').slice(0, 20) || 'Your companion';

        const overlay = this.add.graphics();
        overlay.fillStyle(0x02030A, 0.9);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(500);
        overlay.setInteractive(
            new Phaser.Geom.Rectangle(0, 0, width, height),
            Phaser.Geom.Rectangle.Contains
        );

        const panel = this.add.graphics();
        panel.fillStyle(0x11182A, 0.98);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 12);
        panel.lineStyle(3, Phaser.Display.Color.HexStringToColor(debrief.color).color, 0.95);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 12);
        panel.setDepth(501);

        const header = this.add.text(
            centerX,
            panelY + panelHeight * 0.065,
            `PROJECT BEACON // FIELD LOG ${String(debrief.completionNumber).padStart(2, '0')}`,
            {
                fontSize: isMobile ? '11px' : '13px',
                color: '#91A4C6'
            }
        ).setOrigin(0.5).setDepth(502);

        const icon = this.add.text(centerX, panelY + panelHeight * 0.145, debrief.icon, {
            fontSize: isMobile ? '34px' : '42px'
        }).setOrigin(0.5).setDepth(502);

        const title = this.add.text(centerX, panelY + panelHeight * 0.23, debrief.title, {
            fontSize: isMobile ? '23px' : '30px',
            color: debrief.color,
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: textWidth }
        }).setOrigin(0.5).setDepth(502);

        const routeContext = debrief.nextGate?.label
            ? `\nNEXT EXPEDITION: ${debrief.nextGate.label.toUpperCase()}`
            : '';
        const guardianContext = restoredGuardianName
            ? `\nSANCTUARY RETURN: ${restoredGuardianName.toUpperCase()}`
            : '';
        const context = this.add.text(
            centerX,
            panelY + panelHeight * 0.3,
            `${levelName.toUpperCase()} // ${partName.toUpperCase()} RECOVERED` +
                `${guardianContext}${routeContext}`,
            {
                fontSize: isMobile ? '10px' : '12px',
                color: '#7386A8',
                align: 'center',
                lineSpacing: 4,
                wordWrap: { width: textWidth }
            }
        ).setOrigin(0.5).setDepth(502);

        const findingLabel = this.add.text(
            centerX,
            panelY + panelHeight * 0.365,
            'WHAT THE SCANNER FOUND',
            {
                fontSize: isMobile ? '10px' : '11px',
                color: '#F2C14E',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setDepth(502);

        const finding = this.add.text(centerX, panelY + panelHeight * 0.45, debrief.finding, {
            fontSize: isMobile ? '13px' : '15px',
            color: '#F4F7FF',
            align: 'center',
            lineSpacing: isMobile ? 4 : 6,
            wordWrap: { width: textWidth }
        }).setOrigin(0.5).setDepth(502);

        const companionLabel = this.add.text(
            centerX,
            panelY + panelHeight * 0.575,
            `${companionName.toUpperCase()} // COMPANION RECORD`,
            {
                fontSize: isMobile ? '10px' : '11px',
                color: '#8FE3CF',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setDepth(502);

        const companionMoment = this.add.text(
            centerX,
            panelY + panelHeight * 0.65,
            debrief.companionMoment,
            {
                fontSize: isMobile ? '13px' : '15px',
                color: '#BDEBDD',
                fontStyle: 'italic',
                align: 'center',
                lineSpacing: 4,
                wordWrap: { width: textWidth }
            }
        ).setOrigin(0.5).setDepth(502);

        const noteLabel = this.add.text(
            centerX,
            panelY + panelHeight * 0.735,
            'ASTRONAUT FIELD NOTE',
            {
                fontSize: isMobile ? '10px' : '11px',
                color: '#91A4C6',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setDepth(502);

        const fieldNote = this.add.text(centerX, panelY + panelHeight * 0.81, debrief.fieldNote, {
            fontSize: isMobile ? '12px' : '14px',
            color: '#D7C7F5',
            fontStyle: 'italic',
            align: 'center',
            lineSpacing: 4,
            wordWrap: { width: textWidth }
        }).setOrigin(0.5).setDepth(502);

        const continueBtn = this.add.text(
            centerX,
            panelY + panelHeight * 0.925,
            debrief.shipPartId
                ? `INSTALL ${partName.toUpperCase()}`
                : debrief.nextGate?.label
                    ? `TRACK ${debrief.nextGate.label.toUpperCase()}`
                    : 'CONTINUE',
            {
                fontSize: isMobile ? '13px' : '16px',
                color: '#071018',
                backgroundColor: debrief.color,
                fontStyle: 'bold',
                padding: { x: isMobile ? 28 : 38, y: 12 }
            }
        ).setOrigin(0.5).setDepth(503).setInteractive({ useHandCursor: true });

        this.projectBeaconDebriefElements = [
            overlay,
            panel,
            header,
            icon,
            title,
            context,
            findingLabel,
            finding,
            companionLabel,
            companionMoment,
            noteLabel,
            fieldNote,
            continueBtn
        ];

        continueBtn.on('pointerdown', () => {
            if (!this.isProjectBeaconDebriefOpen) {
                return;
            }

            this.isProjectBeaconDebriefOpen = false;
            if (!debrief.isPreview) {
                acknowledgeProjectBeaconDebrief(window.GameState, debrief.id);
            }
            window.AudioManager?.playButtonClick?.();

            this.tweens.add({
                targets: this.projectBeaconDebriefElements,
                alpha: 0,
                duration: 250,
                onComplete: () => {
                    this.projectBeaconDebriefElements.forEach(element => element?.destroy?.());
                    this.projectBeaconDebriefElements = [];

                    if (!debrief.isPreview && getNextProjectBeaconDebrief(window.GameState)) {
                        this.showPendingProjectBeaconDebrief(onComplete);
                    } else {
                        if (!debrief.isPreview && debrief.shipPartId) {
                            this.scene.start('GameScene', {
                                biome: 'nebula',
                                shipReconstructionHandoff: true,
                                shipReconstructionNextGateLabel:
                                    debrief.nextGate?.label || null
                            });
                            return;
                        }
                        if (!debrief.isPreview) {
                            this.focusProjectBeaconNextRoute(debrief);
                        }
                        onComplete?.();
                    }
                }
            });
        });

        return true;
    }

    focusProjectBeaconNextRoute(debrief) {
        const gateId = debrief?.nextGate?.id;
        const gateIndex = this.gates.findIndex(gate => gate.id === gateId);
        const gate = this.gates[gateIndex];
        if (gateIndex < 0 || !gate?.data?.unlocked) {
            return false;
        }

        this.selectGate(gateIndex);
        const { width, height, isMobile } = this.dims;
        const notice = this.add.text(
            width / 2,
            isMobile ? 74 : 42,
            `NEW ROUTE OPEN // ${gate.data.name.toUpperCase()}`,
            {
                fontSize: isMobile ? '12px' : '15px',
                fontFamily: 'Arial, sans-serif',
                color: '#071411',
                backgroundColor: '#8FE3CF',
                fontStyle: 'bold',
                padding: { x: isMobile ? 12 : 18, y: 9 },
                align: 'center'
            }
        ).setOrigin(0.5).setDepth(490).setAlpha(0);

        this.tweens.add({
            targets: notice,
            alpha: 1,
            y: notice.y + 8,
            duration: 220,
            ease: 'Cubic.easeOut'
        });
        this.time.delayedCall(2400, () => {
            this.tweens.add({
                targets: notice,
                alpha: 0,
                duration: 250,
                onComplete: () => notice.destroy()
            });
        });
        window.AudioManager?.playAchievement?.();
        return true;
    }

    calculateDimensions() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const isMobile = width < 600;

        // For grid layout, position creature in upper portion of screen
        // Gates go below in a 2x3 grid
        const creatureAreaY = isMobile ? height * 0.22 : height * 0.25;

        this.dims = {
            width,
            height,
            isMobile,
            centerX: width / 2,
            centerY: creatureAreaY, // Creature display position
            platformRadius: isMobile ? 55 : 80, // Smaller platform for grid layout
            gateSize: isMobile ? 35 : 45 // Used by completion badge
        };
    }

    createBackground() {
        const { width, height, isMobile } = this.dims;

        // Deep cosmic background gradient
        const bg = this.add.graphics();
        for (let y = 0; y < height; y += 2) {
            const t = y / height;
            const r = Math.floor(15 + t * 10);
            const g = Math.floor(5 + t * 15);
            const b = Math.floor(40 + t * 30);
            const color = (r << 16) | (g << 8) | b;
            bg.fillStyle(color, 1);
            bg.fillRect(0, y, width, 2);
        }
        bg.setDepth(0);

        // Create parallax star layers
        this.createParallaxStars();

        // Floating cosmic particles
        this.createFloatingParticles();

        // Track pointer for parallax effect
        this.lastPointerX = width / 2;
        this.lastPointerY = height / 2;

        this.input.on('pointermove', (pointer) => {
            this.lastPointerX = pointer.x;
            this.lastPointerY = pointer.y;
        });

        // Timer-based parallax update (50ms = 20fps)
        this.parallaxTimer = this.time.addEvent({
            delay: 50,
            callback: () => this.updateParallaxStars(),
            loop: true
        });
    }

    /**
     * Create parallax star layers for depth effect
     */
    createParallaxStars() {
        const { width, height, isMobile } = this.dims;

        // Star layer definitions (reduced on mobile for performance)
        const layers = [
            { count: isMobile ? 60 : 100, parallaxFactor: 0.02, sizeMin: 0.5, sizeMax: 1.5, alpha: 0.3, depth: 1 }, // Far
            { count: isMobile ? 35 : 60, parallaxFactor: 0.05, sizeMin: 1, sizeMax: 2.5, alpha: 0.5, depth: 2 },   // Mid
            { count: isMobile ? 15 : 30, parallaxFactor: 0.1, sizeMin: 2, sizeMax: 4, alpha: 0.8, depth: 3 }       // Near
        ];

        this.parallaxLayers = [];

        layers.forEach(layer => {
            const stars = [];

            for (let i = 0; i < layer.count; i++) {
                const originalX = Phaser.Math.Between(0, width);
                const originalY = Phaser.Math.Between(0, height);
                const size = Phaser.Math.FloatBetween(layer.sizeMin, layer.sizeMax);

                const star = this.add.graphics();
                star.fillStyle(0xFFFFFF, layer.alpha);
                star.fillCircle(0, 0, size);
                star.setPosition(originalX, originalY);
                star.setDepth(layer.depth);

                stars.push({
                    graphics: star,
                    originalX: originalX,
                    originalY: originalY
                });
            }

            this.parallaxLayers.push({
                factor: layer.parallaxFactor,
                stars: stars
            });
        });

        // Add twinkling effect to near stars
        const nearLayer = this.parallaxLayers[2];
        if (nearLayer) {
            nearLayer.stars.forEach((star, i) => {
                // Stagger twinkling
                this.time.delayedCall(i * 100, () => {
                    this.tweens.add({
                        targets: star.graphics,
                        alpha: { from: 0.8, to: 0.4 },
                        duration: Phaser.Math.Between(2000, 4000),
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                });
            });
        }
    }

    /**
     * Update parallax star positions based on pointer
     */
    updateParallaxStars() {
        if (this._isShuttingDown || !this.parallaxLayers) return;

        const { width, height } = this.dims;
        const centerX = width / 2;
        const centerY = height / 2;

        // Calculate offset from center (-1 to 1)
        const offsetX = (this.lastPointerX - centerX) / centerX;
        const offsetY = (this.lastPointerY - centerY) / centerY;

        this.parallaxLayers.forEach(layer => {
            layer.stars.forEach(star => {
                // Apply parallax offset
                const newX = star.originalX - (offsetX * 30 * layer.factor);
                const newY = star.originalY - (offsetY * 20 * layer.factor);
                star.graphics.setPosition(newX, newY);
            });
        });
    }

    createFloatingParticles() {
        const { width, height } = this.dims;

        for (let i = 0; i < 20; i++) {
            const particle = this.add.graphics();
            const size = Phaser.Math.Between(2, 6);
            const color = Phaser.Utils.Array.GetRandom([0x7B68EE, 0x00CED1, 0xFF69B4, 0xFFD700]);

            particle.fillStyle(color, 0.6);
            particle.fillCircle(0, 0, size);
            particle.setPosition(
                Phaser.Math.Between(0, width),
                Phaser.Math.Between(0, height)
            );
            particle.setDepth(1);

            // Float animation
            this.tweens.add({
                targets: particle,
                y: particle.y - Phaser.Math.Between(50, 150),
                x: particle.x + Phaser.Math.Between(-30, 30),
                alpha: { from: 0.6, to: 0 },
                duration: Phaser.Math.Between(4000, 8000),
                repeat: -1,
                onRepeat: () => {
                    particle.setPosition(
                        Phaser.Math.Between(0, width),
                        height + 20
                    );
                    particle.setAlpha(0.6);
                }
            });
        }
    }

    createCentralPlatform() {
        const { centerX, centerY, platformRadius } = this.dims;

        // Platform glow
        const glow = this.add.graphics();
        glow.fillStyle(0x6B00B3, 0.3);
        glow.fillCircle(centerX, centerY, platformRadius + 30);
        glow.setDepth(5);

        // Pulse glow
        this.tweens.add({
            targets: glow,
            alpha: { from: 0.3, to: 0.6 },
            scaleX: { from: 1, to: 1.1 },
            scaleY: { from: 1, to: 1.1 },
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Main platform
        const platform = this.add.graphics();
        platform.fillStyle(0x1A0A2E, 1);
        platform.fillCircle(centerX, centerY, platformRadius);
        platform.lineStyle(4, 0x7B68EE);
        platform.strokeCircle(centerX, centerY, platformRadius);
        platform.setDepth(6);

        // Inner ring decoration
        platform.lineStyle(2, 0x4B0082);
        platform.strokeCircle(centerX, centerY, platformRadius - 15);

        // Cosmic runes
        const runeCount = 8;
        for (let i = 0; i < runeCount; i++) {
            const angle = (i / runeCount) * Math.PI * 2 - Math.PI / 2;
            const x = centerX + Math.cos(angle) * (platformRadius - 30);
            const y = centerY + Math.sin(angle) * (platformRadius - 30);

            platform.fillStyle(0x9370DB, 0.5);
            platform.fillCircle(x, y, 5);
        }
    }

    createGates() {
        const { width, height, centerX, centerY, isMobile } = this.dims;

        // Get gates from GameState
        const savedGates = window.GameState?.getAllGates() || {};
        let allGates = ['complete', 'diagnostics'].includes(
            this.progressionPreview
        )
            ? Object.fromEntries(
                Object.entries(savedGates).map(([gateId, gate]) => [
                    gateId,
                    { ...gate, unlocked: true, inDevelopment: false }
                ])
            )
            : ['firstRoute', 'routeMap'].includes(this.progressionPreview)
                ? Object.fromEntries(
                    Object.entries(savedGates).map(([gateId, gate]) => [
                        gateId,
                        this.progressionPreview === 'firstRoute' &&
                        gateId === 'mythical_forest'
                            ? { ...gate, unlocked: true, inDevelopment: false }
                            : this.progressionPreview === 'routeMap' &&
                                gateId === 'stellar_reef'
                                ? { ...gate, unlocked: false, inDevelopment: false }
                            : gate
                    ])
                )
            : savedGates;
        if (this.isFinalVoidReady()) {
            allGates = {
                ...allGates,
                final_void: {
                    ...FINAL_VOID_GATE_DEFAULT,
                    ...(allGates.final_void || {}),
                    unlocked: this.progressionPreview
                        ? true
                        : allGates.final_void?.unlocked === true
                }
            };
        }
        let gateIds = Object.keys(allGates);

        // Recovery alone is not repair. Five systems must be installed in order.
        if (!this.isFinalVoidReady()) {
            gateIds = gateIds.filter(id => id !== 'final_void');
        }

        // Gate colors and icons
        const gateConfigs = {
            main: { color: 0x7B68EE, icon: '🏠', label: 'Sanctuary' },
            stellar_reef: { color: 0x00CED1, icon: '🐠', label: 'Stellar Reef', shipPart: '⚙️' },
            crystal_caves: { color: 0xE040FB, icon: '💎', label: 'Crystal Caves', shipPart: '🔮' },
            mythical_forest: { color: 0x228B22, icon: '🌳', label: 'Mythical Forest', shipPart: '🌿' },
            void_peaks: { color: 0xFF4500, icon: '⛰️', label: 'Void Peaks', shipPart: '🛡️' },
            aurora_depths: { color: 0x00E676, icon: '🌌', label: 'Aurora Depths', shipPart: '✨' },
            final_void: { color: 0x4B0082, icon: '👑', label: 'The Final Void', shipPart: '🎯', isFinalBoss: true }
        };

        this.gates = [];
        this.gateElements = [];

        const gridLayout = this.getGateGridLayout(gateIds.length);
        const {
            gatesPerRow,
            gateWidth,
            gateHeight,
            gapX,
            gapY,
            startY,
            gateSize
        } = gridLayout;

        gateIds.forEach((gateId, index) => {
            const gateData = allGates[gateId];
            const config = gateConfigs[gateId] || { color: 0x666666, icon: '❓', label: gateId };

            // Center every row, including the partial final row.
            const col = index % gatesPerRow;
            const row = Math.floor(index / gatesPerRow);
            const rowStartIndex = row * gatesPerRow;
            const gatesInRow = Math.min(gatesPerRow, gateIds.length - rowStartIndex);
            const rowWidth = gatesInRow * gateWidth + Math.max(0, gatesInRow - 1) * gapX;
            const rowStartX = (width - rowWidth) / 2 + gateWidth / 2;
            const x = rowStartX + col * (gateWidth + gapX);
            const y = startY + row * (gateHeight + gapY);

            // Gate container
            const gateContainer = this.add.container(x, y);
            gateContainer.setDepth(10);

            // Check if gate is in development
            const isInDevelopment = gateData.inDevelopment === true;

            // Gate glow (for unlocked gates)
            const glow = this.add.graphics();
            if (gateData.unlocked) {
                glow.fillStyle(config.color, 0.3);
                glow.fillCircle(0, 0, gateSize + 15);

                this.tweens.add({
                    targets: glow,
                    alpha: { from: 0.3, to: 0.5 },
                    duration: 1500,
                    yoyo: true,
                    repeat: -1
                });
            }
            gateContainer.add(glow);

            // Gate background
            const gateBg = this.add.graphics();
            if (isInDevelopment) {
                // In Development: Blueprint/wireframe style with construction stripes
                gateBg.fillStyle(0x1A1A2E, 0.9);
                gateBg.fillCircle(0, 0, gateSize);
                gateBg.lineStyle(4, 0xFF9800); // Orange construction border
                gateBg.strokeCircle(0, 0, gateSize);

                // Construction stripes pattern (diagonal lines)
                gateBg.lineStyle(3, 0xFF9800, 0.3);
                for (let i = -gateSize; i < gateSize; i += 15) {
                    gateBg.beginPath();
                    gateBg.moveTo(i, -gateSize);
                    gateBg.lineTo(i + gateSize, gateSize);
                    gateBg.strokePath();
                }
            } else if (gateData.unlocked) {
                gateBg.fillStyle(config.color, 0.9);
                gateBg.fillCircle(0, 0, gateSize);
                gateBg.lineStyle(4, 0xFFD700);
                gateBg.strokeCircle(0, 0, gateSize);
            } else {
                gateBg.fillStyle(0x333333, 0.8);
                gateBg.fillCircle(0, 0, gateSize);
                gateBg.lineStyle(4, 0x555555);
                gateBg.strokeCircle(0, 0, gateSize);
            }
            gateContainer.add(gateBg);

            // Gate content based on state
            if (isInDevelopment) {
                // In Development: Construction icon and label
                const constructionIcon = this.add.text(0, -15, '🚧', {
                    fontSize: isMobile ? '28px' : '36px'
                }).setOrigin(0.5);
                gateContainer.add(constructionIcon);

                const devLabel = this.add.text(0, 20, 'IN DEV', {
                    fontSize: isMobile ? '10px' : '12px',
                    color: '#FF9800',
                    fontStyle: 'bold',
                    stroke: '#000000',
                    strokeThickness: 2
                }).setOrigin(0.5);
                gateContainer.add(devLabel);

                // Pulsing animation for construction icon
                this.tweens.add({
                    targets: constructionIcon,
                    alpha: { from: 1, to: 0.5 },
                    duration: 800,
                    yoyo: true,
                    repeat: -1
                });
            } else if (!gateData.unlocked) {
                const lockIcon = this.add.text(0, -10, '🔒', {
                    fontSize: isMobile ? '28px' : '36px'
                }).setOrigin(0.5);
                gateContainer.add(lockIcon);

                // Cost label
                const costLabel = this.add.text(0, 25, `${gateData.unlockCost}🪙`, {
                    fontSize: isMobile ? '14px' : '18px',
                    color: '#FFD700',
                    stroke: '#000000',
                    strokeThickness: 3
                }).setOrigin(0.5);
                gateContainer.add(costLabel);
            } else {
                // Gate icon
                const icon = this.add.text(0, 0, config.icon, {
                    fontSize: isMobile ? '36px' : '48px'
                }).setOrigin(0.5);
                gateContainer.add(icon);
            }

            // Gate label (below gate)
            const labelColor = isInDevelopment ? '#FF9800' : (gateData.unlocked ? '#FFFFFF' : '#888888');
            const label = this.add.text(0, gateSize + 20, config.label, {
                fontSize: isMobile ? '10px' : '14px',
                color: labelColor,
                stroke: '#000000',
                strokeThickness: 2,
                align: 'center',
                wordWrap: { width: gateWidth }
            }).setOrigin(0.5);
            gateContainer.add(label);

            // Add completion badge for unlocked, non-development gates
            if (gateData.unlocked && !isInDevelopment && gateId !== 'main') {
                this.createCompletionBadge(gateId, gateContainer, gateSize, isMobile);
            }

            // Add portal vortex effect for unlocked, non-development gates
            if (gateData.unlocked && !isInDevelopment) {
                this.createPortalVortex(gateContainer, gateId, gateSize, config.color, isMobile);
            }

            // Interactive zone
            const zone = this.add.zone(0, 0, gateSize * 2, gateSize * 2);
            zone.setInteractive({ useHandCursor: true });
            gateContainer.add(zone);

            // Store gate data
            const gateInfo = {
                id: gateId,
                data: gateData,
                config,
                container: gateContainer,
                glow,
                bg: gateBg,
                zone,
                x,
                y,
                gridIndex: index
            };

            this.gates.push(gateInfo);
            this.gateElements.push(gateContainer);

            // Click handler
            zone.on('pointerdown', () => {
                this.onGateClicked(gateInfo, index);
            });

            // Hover effects
            zone.on('pointerover', () => {
                if (!this.isTransitioning) {
                    this.selectGate(index);
                }
            });
        });
    }

    getGateGridLayout(gateCount) {
        const { width, centerY, isMobile } = this.dims;
        const gatesPerRow = isMobile
            ? (gateCount >= 7 ? 4 : (gateCount >= 5 ? 3 : 2))
            : (gateCount >= 7 ? 4 : (gateCount >= 5 ? 3 : 2));
        const gateWidth = isMobile
            ? Math.min(
                gatesPerRow === 4 ? 78 : 92,
                (width - (gatesPerRow === 4 ? 42 : 60)) / gatesPerRow
            )
            : (gatesPerRow === 4 ? 100 : 110);
        const gateHeight = isMobile ? 84 : 120;
        const gapX = isMobile
            ? (gatesPerRow === 4 ? 8 : 14)
            : (gatesPerRow === 4 ? 24 : 32);
        const gapY = isMobile ? 12 : 16;

        return {
            gatesPerRow,
            gateWidth,
            gateHeight,
            gapX,
            gapY,
            startY: centerY + (isMobile ? 115 : 150),
            gateSize: isMobile ? (gatesPerRow === 4 ? 30 : 32) : 45
        };
    }

    /**
     * Create completion badge for a gate showing star rating
     * @param {string} gateId - Gate identifier
     * @param {Phaser.GameObjects.Container} container - Gate container
     * @param {number} gateSize - Gate circle radius
     * @param {boolean} isMobile - Mobile flag
     */
    createCompletionBadge(gateId, container, gateSize, isMobile) {
        // Map gate IDs to level data paths
        const levelIdMap = {
            crystal_caves: 'crystalCaves',
            stellar_reef: 'cosmicReef',
            void_peaks: 'voidPeaks',
            mythical_forest: 'mythicalForest',
            aurora_depths: 'auroraDepths',
            final_void: 'finalVoid'
        };

        const levelId = levelIdMap[gateId];
        if (!levelId) return;

        // Get level completion data
        const levelData = window.GameState?.get(`levels.${levelId}`) || {};
        const { completed, noDamageRun, speedrun, visited, entered } = levelData;
        const resume = this.getExpeditionResumeForGate(gateId);

        // Calculate star count
        let stars = 0;
        if (completed) stars = 1;
        if (completed && noDamageRun) stars = 2;
        if (completed && noDamageRun && speedrun) stars = 3;

        // Position badge at top-right of gate
        const badgeX = gateSize * 0.7;
        const badgeY = -gateSize * 0.7;
        const badgeRadius = isMobile ? 14 : 18;

        // Only show badge if level has been visited or completed
        if (!visited && !entered && !completed && !resume) return;

        // Badge background
        const badgeBg = this.add.graphics();

        if (stars > 0) {
            // Star badge with gold border
            badgeBg.fillStyle(0x1A0A2E, 1);
            badgeBg.fillCircle(badgeX, badgeY, badgeRadius);
            badgeBg.lineStyle(2, 0xFFD700);
            badgeBg.strokeCircle(badgeX, badgeY, badgeRadius);
        } else {
            // In-progress badge (visited but not completed)
            badgeBg.fillStyle(0x1A0A2E, 1);
            badgeBg.fillCircle(badgeX, badgeY, badgeRadius);
            badgeBg.lineStyle(2, 0x4CAF50);
            badgeBg.strokeCircle(badgeX, badgeY, badgeRadius);
        }
        container.add(badgeBg);

        // Badge content
        if (stars > 0) {
            // Show stars
            const starText = '⭐'.repeat(stars);
            const starDisplay = this.add.text(badgeX, badgeY, starText, {
                fontSize: stars === 3 ? (isMobile ? '8px' : '10px') : (isMobile ? '10px' : '12px')
            }).setOrigin(0.5);
            container.add(starDisplay);

            // Subtle pulse for 3-star completion
            if (stars === 3) {
                this.tweens.add({
                    targets: [badgeBg, starDisplay],
                    alpha: { from: 1, to: 0.7 },
                    duration: 1000,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            }
        } else {
            // A resumable Beacon uses the familiar return arrow; a visited
            // expedition without a durable signal keeps the progress check.
            const checkmark = this.add.text(badgeX, badgeY, resume ? '↻' : '✓', {
                fontSize: isMobile ? '12px' : '16px',
                color: resume ? '#8FE3CF' : '#4CAF50',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            container.add(checkmark);
        }
    }

    /**
     * Create portal vortex effect with swirling particles
     * @param {Phaser.GameObjects.Container} container - Gate container
     * @param {string} gateId - Gate identifier
     * @param {number} gateSize - Gate radius
     * @param {number} color - Gate theme color
     * @param {boolean} isMobile - Mobile flag
     */
    createPortalVortex(container, gateId, gateSize, color, isMobile) {
        // Reduce particle count on mobile for performance
        const particleCount = isMobile ? 10 : 15;
        const vortexRadius = gateSize * 0.8;

        // Create depth glow layers (behind particles)
        const glowGraphics = this.add.graphics();

        // Outer glow
        glowGraphics.fillStyle(color, 0.1);
        glowGraphics.fillCircle(0, 0, vortexRadius * 0.9);

        // Middle glow
        glowGraphics.fillStyle(color, 0.2);
        glowGraphics.fillCircle(0, 0, vortexRadius * 0.6);

        // Inner glow (brightest)
        glowGraphics.fillStyle(color, 0.4);
        glowGraphics.fillCircle(0, 0, vortexRadius * 0.3);

        container.addAt(glowGraphics, 1); // Behind gate icon but above background

        // Create particles
        const particles = [];
        for (let i = 0; i < particleCount; i++) {
            const particle = this.add.graphics();
            const size = Phaser.Math.FloatBetween(isMobile ? 2 : 3, isMobile ? 4 : 6);
            const alpha = Phaser.Math.FloatBetween(0.5, 0.8);

            // Particle color (mix of gate color, gold, and white for variety)
            const particleColors = [color, 0xFFD700, 0xFFFFFF];
            const particleColor = Phaser.Utils.Array.GetRandom(particleColors);

            particle.fillStyle(particleColor, alpha);
            particle.fillCircle(0, 0, size);

            // Initial position in spiral
            const angle = (i / particleCount) * Math.PI * 2;
            const radius = Phaser.Math.FloatBetween(vortexRadius * 0.2, vortexRadius * 0.85);

            particle.setPosition(
                Math.cos(angle) * radius,
                Math.sin(angle) * radius
            );

            container.addAt(particle, 2); // Layer above glow

            particles.push({
                graphics: particle,
                angle: angle,
                radius: radius,
                speed: Phaser.Math.FloatBetween(0.015, 0.03), // Variable rotation speed
                radiusOscillation: Phaser.Math.FloatBetween(0, Math.PI * 2) // Phase offset for radius breathing
            });
        }

        // Store for cleanup
        if (!this.portalVortexElements) this.portalVortexElements = [];
        this.portalVortexElements.push({
            glow: glowGraphics,
            particles: particles,
            container: container
        });

        // Timer-based animation (50ms = 20fps)
        const vortexTimer = this.time.addEvent({
            delay: 50,
            callback: () => this.updatePortalVortex(particles, vortexRadius),
            loop: true
        });

        // Store timer reference for cleanup
        if (!this.vortexTimers) this.vortexTimers = [];
        this.vortexTimers.push(vortexTimer);
    }

    /**
     * Update portal vortex particles (called by timer)
     */
    updatePortalVortex(particles, vortexRadius) {
        if (this._isShuttingDown) return;

        particles.forEach(p => {
            // Update angle (rotation)
            p.angle += p.speed;

            // Subtle radius breathing effect
            p.radiusOscillation += 0.02;
            const breathingOffset = Math.sin(p.radiusOscillation) * 5;
            const effectiveRadius = Math.max(vortexRadius * 0.15, Math.min(vortexRadius * 0.85, p.radius + breathingOffset));

            // Update position
            p.graphics.setPosition(
                Math.cos(p.angle) * effectiveRadius,
                Math.sin(p.angle) * effectiveRadius
            );
        });
    }

    selectGate(index) {
        this.selectedGateIndex = index;

        // Update visual selection
        this.gates.forEach((gate, i) => {
            const scale = i === index ? 1.15 : 1;
            const alpha = i === index ? 1 : 0.7;

            this.tweens.add({
                targets: gate.container,
                scaleX: scale,
                scaleY: scale,
                alpha: alpha,
                duration: 200,
                ease: 'Back.easeOut'
            });
        });

        // Update info panel
        this.updateInfoPanel(this.gates[index]);

        // Show details panel for selected gate
        this.showDetailsPanel(this.gates[index]);

        // Preload the level when player selects its gate
        // This makes entering the level faster (level loads in background)
        const selectedGate = this.gates[index];
        if (selectedGate?.id) {
            this.preloadLevelForGate(selectedGate.id);
        }

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }
    }

    /**
     * Gate details data for hover panel
     */
    getGateDetails() {
        return {
            main: { difficulty: '⭐', boss: 'None', reward: 'Rest & Recovery', desc: 'Safe sanctuary for your creature' },
            stellar_reef: { difficulty: '⭐⭐⭐', boss: "Nyx'voral", reward: 'Dimensional Drive', desc: 'Cosmic underwater realm' },
            crystal_caves: { difficulty: '⭐⭐', boss: 'Crystal Golem', reward: 'Crystal Core', desc: 'Crystalline underground maze' },
            mythical_forest: { difficulty: '⭐⭐', boss: 'Elder Treant', reward: 'Forest Core', desc: 'Ancient woodland between the stars' },
            void_peaks: { difficulty: '⭐⭐⭐⭐', boss: 'Cosmic Titan', reward: 'Hull Plating', desc: 'Treacherous mountain peaks' },
            aurora_depths: { difficulty: '⭐⭐⭐⭐⭐', boss: 'Shadow Phoenix', reward: 'Aurora Reactor', desc: 'Deepest cosmic abyss' },
            final_void: { difficulty: '⭐⭐⭐⭐⭐', boss: 'Void Empress', reward: 'Command Module', desc: 'The final frontier beyond reality' }
        };
    }

    getGateDiagnostics(gateId) {
        if (this.progressionPreview === 'diagnostics') {
            return getExpeditionDiagnosticSnapshot(
                null,
                gateId,
                {
                    reconstructionSnapshot: {
                        state: {
                            completedStepIds: [
                                'living_power_lattice',
                                'propulsion_control',
                                'sealed_return_vector',
                                'resonance_hull',
                                'uplink_hold'
                            ]
                        }
                    },
                    regionSnapshot: {
                        projection: {
                            nodeState: 'fading',
                            label: 'FADING',
                            vitality: 31
                        },
                        arrivalConsequence: {
                            classification: 'mixed_trace',
                            presentation: { label: 'MIXED CURRENT' }
                        }
                    },
                    weather: {
                        solarActivity: 'active',
                        cosmicEnergy: 73,
                        auroraActive: true
                    }
                }
            );
        }
        return getExpeditionDiagnosticSnapshot(
            window.GameState,
            gateId,
            {
                weather: window.SpaceWeatherSystem?.getWeather?.() || null
            }
        );
    }

    /**
     * Show detailed info panel for selected gate
     */
    showDetailsPanel(gate) {
        if (!gate) return;

        // Hide existing panel
        this.hideDetailsPanel();

        const { width, height, isMobile } = this.dims;
        const gateDetails = this.getGateDetails();
        const details = gateDetails[gate.id] || {};
        const diagnostics = this.getGateDiagnostics(gate.id);

        // Get level completion data
        const levelIdMap = {
            crystal_caves: 'crystalCaves',
            stellar_reef: 'cosmicReef',
            void_peaks: 'voidPeaks',
            mythical_forest: 'mythicalForest',
            aurora_depths: 'auroraDepths',
            final_void: 'finalVoid'
        };
        const levelId = levelIdMap[gate.id];
        const levelData = levelId ? (window.GameState?.get(`levels.${levelId}`) || {}) : {};
        const resume = this.getExpeditionResumeForGate(gate.id);

        // Panel dimensions and position
        const panelWidth = isMobile ? width - 40 : 280;
        const panelHeight = isMobile ? 100 : 150;
        const panelX = isMobile ? 20 : width - panelWidth - 20;
        const panelY = isMobile ? height - 280 : 120;

        // Create panel elements
        this.detailsPanelElements = [];

        // Panel background
        const panel = this.add.graphics();
        panel.fillStyle(0x1A0A2E, 0.95);
        panel.fillRoundedRect(panelX, panelY + 20, panelWidth, panelHeight, 12);
        panel.lineStyle(2, gate.config.color, 0.8);
        panel.strokeRoundedRect(panelX, panelY + 20, panelWidth, panelHeight, 12);
        panel.setDepth(100);
        panel.setAlpha(0);
        this.detailsPanelElements.push(panel);

        // Gate icon and name header
        const header = this.add.text(panelX + 15, panelY + 35, `${gate.config.icon} ${gate.data.name}`, {
            fontSize: isMobile ? '16px' : '18px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setDepth(101).setAlpha(0);
        this.detailsPanelElements.push(header);

        const detailStatus = diagnostics.available
            ? diagnostics.statusLabel.replace('WANDERER-77', 'W77')
            : `Difficulty: ${details.difficulty || '?'}`;
        const difficulty = this.add.text(panelX + 15, panelY + 60, detailStatus, {
            fontSize: diagnostics.available
                ? (isMobile ? '9px' : '10px')
                : (isMobile ? '12px' : '14px'),
            color: diagnostics.available ? '#AFC3CF' : '#FFFFFF',
            fontStyle: diagnostics.available ? 'bold' : 'normal',
            wordWrap: { width: panelWidth - 30 }
        }).setDepth(101).setAlpha(0);
        this.detailsPanelElements.push(difficulty);

        // Repaired ship systems replace generic metadata with a local field
        // readout so selecting a gate becomes an informed expedition choice.
        if (gate.id !== 'main' && !gate.data.inDevelopment) {
            if (diagnostics.available) {
                const colors = ['#F2C14E', '#71E6B1', '#8FE3CF'];
                diagnostics.lines.forEach((line, index) => {
                    const diagnosticLine = this.add.text(
                        panelX + 15,
                        panelY + 82 + (index * 22),
                        line,
                        {
                            fontSize: isMobile ? '10px' : '11px',
                            color: colors[index],
                            fontStyle: 'bold',
                            wordWrap: { width: panelWidth - 30 }
                        }
                    ).setDepth(101).setAlpha(0);
                    this.detailsPanelElements.push(diagnosticLine);
                });
            } else {
                const boss = this.add.text(panelX + 15, panelY + 82, `Boss: ${details.boss || 'Unknown'}`, {
                    fontSize: isMobile ? '12px' : '14px',
                    color: '#FF6B6B'
                }).setDepth(101).setAlpha(0);
                this.detailsPanelElements.push(boss);

                const reward = this.add.text(panelX + 15, panelY + 104, `Reward: ${gate.config.shipPart || '🎁'} ${details.reward || '???'}`, {
                    fontSize: isMobile ? '12px' : '14px',
                    color: '#00CED1'
                }).setDepth(101).setAlpha(0);
                this.detailsPanelElements.push(reward);

                if (resume) {
                    const stats = this.add.text(
                        panelX + 15,
                        panelY + 126,
                        `Beacon: ${resume.label}  •  ${resume.current}/${resume.total}`,
                        {
                            fontSize: isMobile ? '10px' : '12px',
                            color: '#8FE3CF'
                        }
                    ).setDepth(101).setAlpha(0);
                    this.detailsPanelElements.push(stats);
                } else if (levelData.visited || levelData.entered || levelData.completed) {
                    const bestTime = levelData.bestTime ? this.formatTime(levelData.bestTime) : 'N/A';
                    const stats = this.add.text(panelX + 15, panelY + 126, `Best Time: ${bestTime}  •  Visits: ${gate.data.visits || 0}`, {
                        fontSize: isMobile ? '10px' : '12px',
                        color: '#AAAAAA'
                    }).setDepth(101).setAlpha(0);
                    this.detailsPanelElements.push(stats);
                }
            }
        } else if (gate.data.inDevelopment) {
            const devNote = this.add.text(panelX + 15, panelY + 82, '🚧 Coming in future update!', {
                fontSize: isMobile ? '12px' : '14px',
                color: '#FF9800'
            }).setDepth(101).setAlpha(0);
            this.detailsPanelElements.push(devNote);

            const teaser = this.add.text(panelX + 15, panelY + 104, details.desc || 'New adventures await...', {
                fontSize: isMobile ? '11px' : '13px',
                color: '#888888',
                fontStyle: 'italic'
            }).setDepth(101).setAlpha(0);
            this.detailsPanelElements.push(teaser);
        } else {
            // Main sanctuary
            const desc = this.add.text(panelX + 15, panelY + 82, details.desc || 'Your creature\'s home', {
                fontSize: isMobile ? '12px' : '14px',
                color: '#9370DB'
            }).setDepth(101).setAlpha(0);
            this.detailsPanelElements.push(desc);
        }

        // Animate in (slide up + fade in)
        this.detailsPanelElements.forEach((el, i) => {
            this.tweens.add({
                targets: el,
                alpha: 1,
                y: el.y - 20,
                duration: 200,
                delay: i * 30,
                ease: 'Power2'
            });
        });
    }

    /**
     * Hide details panel
     */
    hideDetailsPanel() {
        if (!this.detailsPanelElements) return;

        // Animate out and destroy
        this.detailsPanelElements.forEach(el => {
            this.tweens.add({
                targets: el,
                alpha: 0,
                y: el.y + 10,
                duration: 150,
                ease: 'Power2',
                onComplete: () => {
                    if (el && el.destroy) el.destroy();
                }
            });
        });

        this.detailsPanelElements = [];
    }

    /**
     * Format time in mm:ss
     */
    formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    hasRouteMap(gateId) {
        if (
            this.progressionPreview === 'routeMap' &&
            gateId === 'stellar_reef'
        ) {
            return true;
        }
        const mapsOwned = window.GameState?.get('hubWorld.mapsOwned') || [];
        return Array.isArray(mapsOwned) && mapsOwned.includes(gateId);
    }

    clearCompletedExpeditionCheckpoint() {
        if (this.progressionPreview) return false;

        const checkpoint = window.GameState?.get?.(EXPEDITION_CHECKPOINT_PATH);
        const config = Object.values(EXPEDITION_CHECKPOINTS_BY_GATE).find(
            candidate =>
                candidate.sceneKey === checkpoint?.sceneKey &&
                candidate.levelId === checkpoint?.levelId
        );
        if (
            !config ||
            window.GameState?.get?.(
                `levels.${config.levelStateId}.completed`
            ) !== true
        ) {
            return false;
        }

        window.GameState?.set?.(EXPEDITION_CHECKPOINT_PATH, null);
        window.GameState?.save?.();
        return true;
    }

    getExpeditionResumeForGate(gateId) {
        if (this.progressionPreview === 'checkpoint') {
            return gateId === 'mythical_forest'
                ? {
                    gateId,
                    sceneKey: 'MythicalForestLevel',
                    checkpointId: 'forest_anchor_3',
                    label: 'Guardian Approach',
                    current: 3,
                    total: 3
                }
                : null;
        }
        if (this.progressionPreview) return null;

        const checkpoint = window.GameState?.get?.(EXPEDITION_CHECKPOINT_PATH);
        const config = EXPEDITION_CHECKPOINTS_BY_GATE[gateId];
        const checkpointIndex = Number(checkpoint?.checkpointIndex);
        const signal = config?.checkpoints?.[checkpointIndex];

        if (
            checkpoint?.version !== EXPEDITION_CHECKPOINT_VERSION ||
            checkpoint?.sceneKey !== config?.sceneKey ||
            checkpoint?.levelId !== config?.levelId ||
            !signal ||
            signal[0] !== checkpoint?.checkpointId ||
            window.GameState?.get?.(
                `levels.${config.levelStateId}.completed`
            ) === true
        ) {
            return null;
        }

        return {
            gateId,
            sceneKey: config.sceneKey,
            checkpointId: signal[0],
            label: signal[1],
            current: checkpointIndex + 1,
            total: config.checkpoints.length
        };
    }

    updateInfoPanel(gate) {
        if (!gate) return;

        const isInDevelopment = gate.data.inDevelopment === true;
        const hasRouteMap = this.hasRouteMap(gate.id);
        const resume = this.getExpeditionResumeForGate(gate.id);
        const campaignAccess = window.GameState?.getCampaignGateAccess?.(gate.id);
        const isEffectivelyUnlocked = campaignAccess
            ? campaignAccess.unlocked
            : gate.data.unlocked === true;

        // Update info text
        if (this.infoText) {
            let info = `${gate.config.icon} ${gate.data.name}`;
            if (gate.id === this.campaignJourneyStep?.gateId) {
                info += `\nNEXT // ${this.campaignJourneyStep.action}`;
            }
            if (isInDevelopment) {
                info += '\n🚧 In Development';
            } else if (isEffectivelyUnlocked && resume) {
                info += `\nBeacon ${resume.current}/${resume.total} • ${resume.label}`;
            } else if (isEffectivelyUnlocked) {
                info += `\nOpen • ${gate.data.visits || 0} visits`;
                if (hasRouteMap) {
                    info += '\nSurvey support active';
                }
            } else if (hasRouteMap && campaignAccess?.nextRequiredRoute) {
                info += `\nRoute discovered • Complete ${campaignAccess.nextRequiredRoute.label} first`;
            } else if (hasRouteMap) {
                info += '\nRoute discovered • Ready to open';
            } else {
                info += `\n🔒 Locked • ${gate.data.unlockCost} coins`;
            }
            this.infoText.setText(info);
        }

        // Update action button
        if (this.actionButton && this.actionLabel) {
            if (isInDevelopment) {
                // In Development - show disabled state
                this.actionLabel.setText('COMING SOON');
                this.actionButton.clear();
                this.actionButton.fillStyle(0x555555, 1);
                this.actionButton.fillRoundedRect(-70, -25, 140, 50, 10);
                this.actionButton.lineStyle(3, 0xFF9800);
                this.actionButton.strokeRoundedRect(-70, -25, 140, 50, 10);
            } else if (isEffectivelyUnlocked) {
                this.actionLabel.setText(resume ? 'RESUME' : 'ENTER');
                this.actionButton.clear();
                this.actionButton.fillStyle(0x00AA00, 1);
                this.actionButton.fillRoundedRect(-60, -25, 120, 50, 10);
                this.actionButton.lineStyle(3, 0x00FF00);
                this.actionButton.strokeRoundedRect(-60, -25, 120, 50, 10);
            } else {
                this.actionLabel.setText(
                    hasRouteMap && campaignAccess?.nextRequiredRoute
                        ? 'ROUTE FOUND'
                        : hasRouteMap
                            ? 'OPEN ROUTE'
                            : 'UNLOCK'
                );
                this.actionButton.clear();
                this.actionButton.fillStyle(hasRouteMap ? 0x008F7A : 0xFFAA00, 1);
                this.actionButton.fillRoundedRect(-60, -25, 120, 50, 10);
                this.actionButton.lineStyle(3, hasRouteMap ? 0x67E8C7 : 0xFFD700);
                this.actionButton.strokeRoundedRect(-60, -25, 120, 50, 10);
            }
        }
    }

    onGateClicked(gate, index) {
        if (this.isTransitioning) return;

        this.selectGate(index);

        // Check if gate is in development - show coming soon modal instead
        if (gate.data.inDevelopment) {
            this.showComingSoonModal(gate);
            return;
        }

        if (window.GameState?.isGateUnlocked?.(gate.id) || (
            !window.GameState?.isGateUnlocked && gate.data.unlocked
        )) {
            this.enterGate(gate);
        } else {
            this.showUnlockConfirmation(gate);
        }
    }

    showUnlockConfirmation(gate) {
        const { width, height, isMobile } = this.dims;
        const hasRouteMap = this.hasRouteMap(gate.id);
        const campaignAccess = window.GameState?.getCampaignGateAccess?.(gate.id);

        // Create overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(200);

        // Modal panel
        const modalWidth = isMobile ? width - 40 : 400;
        const modalHeight = 250;
        const modalX = (width - modalWidth) / 2;
        const modalY = (height - modalHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 1);
        panel.fillRoundedRect(modalX, modalY, modalWidth, modalHeight, 15);
        panel.lineStyle(3, gate.config.color);
        panel.strokeRoundedRect(modalX, modalY, modalWidth, modalHeight, 15);
        panel.setDepth(201);

        // Title
        const title = this.add.text(
            width / 2,
            modalY + 40,
            `${hasRouteMap ? 'Route found' : 'Unlock'}: ${gate.data.name}`,
            {
            fontSize: isMobile ? '22px' : '28px',
            color: '#FFD700',
            fontStyle: 'bold'
            }
        ).setOrigin(0.5).setDepth(202);

        // Cost info
        const currentCoins = window.GameState?.get('player.cosmicCoins') || 0;
        const canAfford = currentCoins >= gate.data.unlockCost;
        const prerequisitesMet = campaignAccess?.prerequisitesMet !== false;
        const shipRequirementsMet = campaignAccess?.shipRequirementsMet !== false;
        const canUnlock = prerequisitesMet && shipRequirementsMet && (
            hasRouteMap || canAfford
        );
        const unlockMessage = !prerequisitesMet
            ? `ROUTE DISCOVERED\nComplete ${campaignAccess.nextRequiredRoute.label} first`
            : !shipRequirementsMet
                ? 'ROUTE DISCOVERED\nFinish rebuilding Wanderer-77 first'
                : hasRouteMap
                    ? 'ROUTE DISCOVERED\nReady to open at no extra cost'
                    : `Cost: ${gate.data.unlockCost} 🪙\nYou have: ${currentCoins} 🪙`;

        const costText = this.add.text(width / 2, modalY + 100,
            unlockMessage, {
            fontSize: isMobile ? '16px' : '20px',
            color: canUnlock ? '#00FF00' : '#FF6666',
            align: 'center'
        }).setOrigin(0.5).setDepth(202);

        // Buttons
        const btnWidth = 100;
        const btnHeight = 45;
        const btnY = modalY + modalHeight - btnHeight - 25;

        const dialogElements = [overlay, panel, title, costText];

        if (canUnlock) {
            // Confirm button
            const confirmBtnX = modalX + modalWidth / 2 - btnWidth - 20;
            const confirmBtn = this.add.graphics();
            confirmBtn.fillStyle(0x00AA00, 1);
            confirmBtn.fillRoundedRect(confirmBtnX, btnY, btnWidth, btnHeight, 8);
            confirmBtn.setDepth(202);

            const confirmLabel = this.add.text(
                confirmBtnX + btnWidth / 2,
                btnY + btnHeight / 2,
                hasRouteMap ? 'OPEN' : 'UNLOCK',
                {
                fontSize: '16px',
                color: '#FFFFFF',
                fontStyle: 'bold'
                }
            ).setOrigin(0.5).setDepth(202);

            const confirmZone = this.add.zone(confirmBtnX, btnY, btnWidth, btnHeight).setOrigin(0);
            confirmZone.setInteractive({ useHandCursor: true });
            confirmZone.setDepth(203);

            confirmZone.on('pointerdown', () => {
                const result = this.progressionPreview === 'routeMap'
                    ? { success: true, method: 'preview' }
                    : window.GameState.unlockGate(gate.id, true);
                if (result.success) {
                    dialogElements.forEach(el => el.destroy());
                    confirmBtn.destroy();
                    confirmLabel.destroy();
                    confirmZone.destroy();
                    cancelBtn.destroy();
                    cancelLabel.destroy();
                    cancelZone.destroy();

                    if (result.method !== 'preview') {
                        this.showUnlockSuccess(gate);
                        this.refreshGates();
                    }
                }
            });

            dialogElements.push(confirmBtn, confirmLabel, confirmZone);

            // Cancel button
            const cancelBtnX = modalX + modalWidth / 2 + 20;
            const cancelBtn = this.add.graphics();
            cancelBtn.fillStyle(0xAA0000, 1);
            cancelBtn.fillRoundedRect(cancelBtnX, btnY, btnWidth, btnHeight, 8);
            cancelBtn.setDepth(202);

            const cancelLabel = this.add.text(cancelBtnX + btnWidth / 2, btnY + btnHeight / 2, 'CANCEL', {
                fontSize: '16px',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(202);

            const cancelZone = this.add.zone(cancelBtnX, btnY, btnWidth, btnHeight).setOrigin(0);
            cancelZone.setInteractive({ useHandCursor: true });
            cancelZone.setDepth(203);

            cancelZone.on('pointerdown', () => {
                dialogElements.forEach(el => el.destroy());
                confirmBtn.destroy();
                confirmLabel.destroy();
                confirmZone.destroy();
                cancelBtn.destroy();
                cancelLabel.destroy();
                cancelZone.destroy();
            });

            dialogElements.push(cancelBtn, cancelLabel, cancelZone);
        } else {
            // Close button only
            const closeBtnX = (width - btnWidth) / 2;
            const closeBtn = this.add.graphics();
            closeBtn.fillStyle(0x666666, 1);
            closeBtn.fillRoundedRect(closeBtnX, btnY, btnWidth, btnHeight, 8);
            closeBtn.setDepth(202);

            const closeLabel = this.add.text(closeBtnX + btnWidth / 2, btnY + btnHeight / 2, 'CLOSE', {
                fontSize: '16px',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(202);

            const closeZone = this.add.zone(closeBtnX, btnY, btnWidth, btnHeight).setOrigin(0);
            closeZone.setInteractive({ useHandCursor: true });
            closeZone.setDepth(203);

            closeZone.on('pointerdown', () => {
                dialogElements.forEach(el => el.destroy());
                closeBtn.destroy();
                closeLabel.destroy();
                closeZone.destroy();
            });

            dialogElements.push(closeBtn, closeLabel, closeZone);
        }
    }

    showUnlockSuccess(gate) {
        const { width, height, isMobile } = this.dims;

        // Success message
        const successText = this.add.text(width / 2, height / 2, `🎉 ${gate.data.name} Unlocked!`, {
            fontSize: isMobile ? '24px' : '32px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(250).setAlpha(0);

        // Animate in
        this.tweens.add({
            targets: successText,
            alpha: 1,
            scale: { from: 0.5, to: 1.2 },
            duration: 500,
            ease: 'Back.easeOut'
        });

        // Particle burst
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, width / 2, height / 2, {
                count: 30,
                color: [gate.config.color, 0xFFD700, 0xFFFFFF],
                duration: 2000
            });
        }

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playLevelUp();
        }

        // Fade out
        this.time.delayedCall(2000, () => {
            this.tweens.add({
                targets: successText,
                alpha: 0,
                duration: 500,
                onComplete: () => successText.destroy()
            });
        });
    }

    refreshGates() {
        // Remove old gate elements
        this.gateElements.forEach(container => container.destroy());
        this.gates = [];
        this.gateElements = [];

        // Recreate gates
        this.createGates();
        this.selectGate(this.selectedGateIndex);
    }

    enterGate(gate) {
        if (this.isTransitioning) return;

        // Double-check for in-development gates (should be caught earlier)
        if (gate.data.inDevelopment) {
            this.showComingSoonModal(gate);
            return;
        }

        const entryResult = this.progressionPreview
            ? { success: true }
            : window.GameState?.enterGate(gate.id);
        if (entryResult && entryResult.success !== true) {
            this.showUnlockConfirmation(gate);
            return;
        }

        this.isTransitioning = true;
        this.gateTransitionStarted = false;

        console.log(`[HubWorldScene] Entering gate: ${gate.id}`);
        const resume = this.getExpeditionResumeForGate(gate.id);

        if (gate.id === 'mythical_forest') {
            (window.CompanionMediaService || companionMediaService)
                ?.prepareCinematic?.(this, {
                    momentId: 'first_forest_arrival',
                    stage: window.GameState?.get?.('creature.lifecycle.stage') || 'baby'
                });
        }

        // Show loading (will appear after transition)
        if (window.UXEnhancements) {
            this.time.delayedCall(800, () => {
                window.UXEnhancements.showLoading(
                    resume
                        ? `Reconnecting at ${resume.label}...`
                        : `Traveling to ${gate.data.name}...`
                );
            });
        }

        // Cinematic transition
        this.playCinematicGateEntry(gate);

        // A scene launch must not depend solely on a tween/timer callback. This
        // independent watchdog handles backgrounded mobile tabs and interrupted FX.
        this.gateTransitionFallback = setTimeout(() => {
            this.beginGateSceneTransition(gate);
        }, 1800);
    }

    beginGateSceneTransition(gate) {
        if (this.gateTransitionStarted || this._isShuttingDown) return false;
        this.gateTransitionStarted = true;
        if (this.gateTransitionFallback) {
            clearTimeout(this.gateTransitionFallback);
            this.gateTransitionFallback = null;
        }
        Promise.resolve(this.transitionToGateScene(gate)).catch(error => {
            console.error('[HubWorldScene] Gate transition failed:', error);
            this.isTransitioning = false;
            this.gateTransitionStarted = false;
            this.showLevelLoadError(gate.data?.name || gate.id);
        });
        return true;
    }

    /**
     * Play cinematic gate entry sequence
     * Timeline: zoom → particles → radial wipe → transition
     */
    playCinematicGateEntry(gate) {
        const { width, height, isMobile } = this.dims;
        const gateX = gate.x;
        const gateY = gate.y;

        // 0ms: Camera zoom toward gate (400ms)
        this.tweens.add({
            targets: this.cameras.main,
            zoom: 1.5,
            scrollX: gateX - width / 2,
            scrollY: gateY - height / 2,
            duration: 400,
            ease: 'Power2'
        });

        // 300ms: Particle burst from gate
        this.time.delayedCall(300, () => {
            this.createGateEntryBurst(gateX, gateY, gate.config.color);

            // Play whoosh/portal sound
            if (window.AudioManager) {
                window.AudioManager.playPurchase();
            }
        });

        // 500ms: Expanding radial wipe from gate center
        this.time.delayedCall(500, () => {
            this.createRadialWipe(gateX, gateY, gate.config.color, () => {
                // 900ms: Scene transition
                this.beginGateSceneTransition(gate);
            });
        });
    }

    /**
     * Create particle burst effect at gate position
     */
    createGateEntryBurst(x, y, color) {
        // Particle count based on device
        const particleCount = this.dims.isMobile ? 20 : 40;
        const colors = [color, 0xFFD700, 0xFFFFFF];

        for (let i = 0; i < particleCount; i++) {
            const particle = this.add.graphics();
            const size = Phaser.Math.FloatBetween(2, 6);
            const particleColor = Phaser.Utils.Array.GetRandom(colors);

            particle.fillStyle(particleColor, Phaser.Math.FloatBetween(0.6, 1));
            particle.fillCircle(0, 0, size);
            particle.setPosition(x, y);
            particle.setDepth(250);

            // Random direction burst
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const speed = Phaser.Math.FloatBetween(100, 300);
            const targetX = x + Math.cos(angle) * speed;
            const targetY = y + Math.sin(angle) * speed;

            this.tweens.add({
                targets: particle,
                x: targetX,
                y: targetY,
                alpha: 0,
                scale: { from: 1, to: 0.2 },
                duration: Phaser.Math.Between(400, 800),
                ease: 'Power2',
                onComplete: () => particle.destroy()
            });
        }

        // Add FXLibrary burst if available
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, x, y, {
                count: 20,
                color: [color, 0xFFD700],
                duration: 1000
            });
        }
    }

    /**
     * Create expanding radial wipe effect
     */
    createRadialWipe(centerX, centerY, color, onComplete) {
        const { width, height } = this.dims;
        const maxRadius = Math.max(width, height) * 1.5;

        this.clearGateTransitionFx(false);

        // Create circular mask/wipe
        const wipe = this.add.graphics();
        wipe.setDepth(300);
        this.gateTransitionWipe = wipe;

        // Animate expanding circle
        let currentRadius = 0;

        const wipeTimer = this.time.addEvent({
            delay: 16, // ~60fps
            callback: () => {
                currentRadius += 30; // Expansion speed

                wipe.clear();
                wipe.fillStyle(color, 1);
                wipe.fillCircle(centerX, centerY, currentRadius);

                // Add inner glow ring
                if (currentRadius > 50) {
                    wipe.lineStyle(4, 0xFFFFFF, 0.5);
                    wipe.strokeCircle(centerX, centerY, currentRadius - 20);
                }

                if (currentRadius >= maxRadius) {
                    wipeTimer.destroy();
                    this.gateTransitionWipeTimer = null;
                    if (onComplete) onComplete();
                }
            },
            loop: true
        });
        this.gateTransitionWipeTimer = wipeTimer;
    }

    clearGateTransitionFx(restoreCamera = true) {
        this.gateTransitionWipeTimer?.destroy?.();
        this.gateTransitionWipeTimer = null;
        this.gateTransitionWipe?.destroy?.();
        this.gateTransitionWipe = null;

        if (restoreCamera && this.cameras?.main) {
            this.cameras.main.setZoom?.(1);
            if (this.player && !this.cameras.main._follow) {
                this.cameras.main.startFollow?.(this.player, true, 0.1, 0.1);
            }
        }
    }

    /**
     * Transition to appropriate scene based on gate
     * Uses lazy loading for platformer levels to reduce initial bundle size
     */
    async transitionToGateScene(gate) {
        // Map gate IDs to scene names for lazy loading
        const levelSceneMap = {
            'crystal_caves': 'CrystalCavesLevel',
            'stellar_reef': 'ReefLevel',
            'mythical_forest': 'MythicalForestLevel',
            'void_peaks': 'VoidPeaksLevel',
            'aurora_depths': 'AuroraDepthsLevel',
            'final_void': 'FinalVoidLevel'
        };

        if (gate.id === 'main') {
            // Main sanctuary - top-down exploration (not lazy loaded)
            this.scene.start('GameScene', { biome: 'nebula' });
            return;
        }

        // Check if this is a platformer level that needs lazy loading
        const sceneName = levelSceneMap[gate.id];
        if (sceneName) {
            // Show loading indicator
            if (window.UXEnhancements) {
                window.UXEnhancements.showLoading(`Loading ${gate.data?.name || 'level'}...`);
            }

            try {
                // Use SceneLoader for lazy loading
                if (window.SceneLoader) {
                    const loaded = await window.SceneLoader.loadScene(this.game, sceneName);
                    if (loaded) {
                        if (window.UXEnhancements) {
                            window.UXEnhancements.hideLoading();
                        }
                        this.clearGateTransitionFx(false);
                        this.scene.start(sceneName);
                        return;
                    }
                    throw new Error(`${sceneName} could not be loaded`);
                }

                // Fallback only when the scene is already registered. Starting an
                // unknown Phaser key produces the same blank-screen failure as a
                // rejected chunk load.
                const registeredScene = this.game?.scene?.keys?.[sceneName] ||
                    this.game?.scene?.scenes?.find?.(
                        scene => scene?.sys?.settings?.key === sceneName
                    );
                if (!registeredScene) {
                    throw new Error(`${sceneName} is not registered`);
                }
                if (window.UXEnhancements) {
                    window.UXEnhancements.hideLoading();
                }
                this.clearGateTransitionFx(false);
                this.scene.start(sceneName);
            } catch (error) {
                console.error(`[HubWorldScene] Failed to load ${sceneName}:`, error);
                if (window.UXEnhancements) {
                    window.UXEnhancements.hideLoading();
                }
                this.clearGateTransitionFx(true);
                // Show error to user
                this.showLevelLoadError(gate.data?.name || sceneName);
                this.isTransitioning = false;
                this.gateTransitionStarted = false;
            }
            return;
        }

        // Other biomes - top-down for now (will become platformer levels)
        this.scene.start('GameScene', { biome: gate.data?.biome });
    }

    /**
     * Show error when level fails to load
     */
    showLevelLoadError(levelName) {
        const { width, height } = this.dims;

        const errorText = this.add.text(width / 2, height / 2,
            `Failed to load ${levelName}\nPlease try again`,
            {
                fontSize: '20px',
                color: '#FF6B6B',
                align: 'center',
                stroke: '#000000',
                strokeThickness: 3
            }
        ).setOrigin(0.5).setDepth(500);

        this.time.delayedCall(3000, () => {
            errorText.destroy();
        });
    }

    /**
     * Preload a level when player hovers over its gate
     * This makes the level load faster when they actually enter
     */
    preloadLevelForGate(gateId) {
        if (window.SceneLoader?.preloadLevel) {
            window.SceneLoader.preloadLevel(gateId);
        }
    }

    showComingSoonModal(gate) {
        const { width, height, isMobile } = this.dims;

        // Create overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(200);

        // Modal panel
        const modalWidth = isMobile ? width - 40 : 380;
        const modalHeight = 220;
        const modalX = (width - modalWidth) / 2;
        const modalY = (height - modalHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 1);
        panel.fillRoundedRect(modalX, modalY, modalWidth, modalHeight, 15);
        panel.lineStyle(3, gate.config.color);
        panel.strokeRoundedRect(modalX, modalY, modalWidth, modalHeight, 15);
        panel.setDepth(201);

        // Construction icon
        const constructionIcon = this.add.text(width / 2, modalY + 45, '🚧', {
            fontSize: '48px'
        }).setOrigin(0.5).setDepth(202);

        // Title
        const title = this.add.text(width / 2, modalY + 100, 'Coming Soon!', {
            fontSize: isMobile ? '24px' : '28px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        // Description
        const desc = this.add.text(width / 2, modalY + 135,
            `${gate.data.name} is currently\nin development.`, {
            fontSize: isMobile ? '14px' : '16px',
            color: '#AAAAAA',
            align: 'center'
        }).setOrigin(0.5).setDepth(202);

        const elements = [overlay, panel, constructionIcon, title, desc];

        // Close button
        const closeBtn = this.add.text(width / 2, modalY + modalHeight - 35, 'OK', {
            fontSize: '18px',
            color: '#FFFFFF',
            backgroundColor: '#666666',
            padding: { x: 30, y: 10 }
        }).setOrigin(0.5).setDepth(202);
        closeBtn.setInteractive({ useHandCursor: true });

        closeBtn.on('pointerdown', () => {
            elements.forEach(el => el.destroy());
            closeBtn.destroy();
        });

        closeBtn.on('pointerover', () => closeBtn.setStyle({ backgroundColor: '#888888' }));
        closeBtn.on('pointerout', () => closeBtn.setStyle({ backgroundColor: '#666666' }));

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }
    }

    /**
     * Reveal Final Void access after the five pre-final systems are installed.
     * This is a route handoff, not permission to launch or transmit.
     */
    showShipCompletionCutscene() {
        const { width, height, isMobile } = this.dims;
        if (!this.isFinalVoidReady()) return;
        console.log('[HubWorldScene] Revealing Final Void access');

        // Play epic sound
        if (window.AudioManager) {
            window.AudioManager.playLevelUp();
        }

        // Dark overlay (fade in)
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.95);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(400);
        overlay.setAlpha(0);

        this.tweens.add({
            targets: overlay,
            alpha: 1,
            duration: 800,
            ease: 'Power2'
        });

        // Installed systems converge on the held Command Module route.
        const partData = [
            { icon: '🔮', name: 'Crystal Core', delay: 100, startX: -50, startY: height * 0.3 },
            { icon: '⚙️', name: 'Dimensional Drive', delay: 200, startX: width + 50, startY: height * 0.4 },
            { icon: '🌿', name: 'Forest Core', delay: 300, startX: -50, startY: height * 0.5 },
            { icon: '🛡️', name: 'Hull Plating', delay: 400, startX: width + 50, startY: height * 0.6 },
            { icon: '✨', name: 'Aurora Reactor', delay: 500, startX: width / 2, startY: -50 }
        ];

        const centerX = width / 2;
        const centerY = height / 2 - 50;
        const elements = [overlay];
        const convergingIcons = [];

        partData.forEach(part => {
            this.time.delayedCall(part.delay, () => {
                const partIcon = this.add.text(part.startX, part.startY, part.icon, {
                    fontSize: isMobile ? '36px' : '48px'
                }).setOrigin(0.5).setDepth(401);
                convergingIcons.push(partIcon);

                // Fly to center with trail effect
                this.tweens.add({
                    targets: partIcon,
                    x: centerX + Phaser.Math.Between(-30, 30),
                    y: centerY + Phaser.Math.Between(-30, 30),
                    duration: 300,
                    ease: 'Power2',
                    onComplete: () => {
                        // Flash when part arrives
                        if (window.FXLibrary) {
                            window.FXLibrary.stardustBurst(this, partIcon.x, partIcon.y, {
                                count: 10,
                                color: [0xFFD700, 0xFFFFFF],
                                duration: 500
                            });
                        }
                        if (window.AudioManager) {
                            window.AudioManager.playCoinCollect();
                        }
                    }
                });
            });
        });

        // Show the repaired system chain and its remaining boundary.
        this.time.delayedCall(900, () => {
            convergingIcons.forEach(icon => icon.destroy());

            // Flash effect
            const flash = this.add.graphics();
            flash.fillStyle(0xFFD700, 0.8);
            flash.fillRect(0, 0, width, height);
            flash.setDepth(402);
            elements.push(flash);

            this.tweens.add({
                targets: flash,
                alpha: 0,
                duration: 800,
                ease: 'Power2'
            });

            const shipIcon = this.add.text(centerX, centerY - 45, 'W-77', {
                fontSize: isMobile ? '42px' : '56px',
                color: '#FFFFFF',
                fontStyle: 'bold',
                stroke: '#008A4A',
                strokeThickness: 5
            }).setOrigin(0.5).setDepth(403);
            elements.push(shipIcon);

            // Pulsing glow
            this.tweens.add({
                targets: shipIcon,
                scale: { from: 1, to: 1.15 },
                duration: 800,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            // Title
            const title = this.add.text(centerX, centerY + 35, 'FIVE SYSTEMS ONLINE', {
                fontSize: isMobile ? '25px' : '34px',
                color: '#6FFFA8',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5).setDepth(403);
            elements.push(title);

            // Story text
            const story = this.add.text(centerX, centerY + 82,
                'The repair lattice is holding.\nThe Command Module remains in the Final Void.\n\nNO LAUNCH // NO TRANSMISSION\nFEND COORDINATES SEALED', {
                fontSize: isMobile ? '16px' : '20px',
                color: '#FFFFFF',
                align: 'center',
                lineSpacing: 7,
                wordWrap: { width: Math.min(width - 48, 620) }
            }).setOrigin(0.5, 0).setDepth(403);
            elements.push(story);

            // Continue button
            this.time.delayedCall(450, () => {
                const continueBtn = this.add.text(centerX, height - (isMobile ? 80 : 100), 'SHOW FINAL VOID ROUTE', {
                    fontSize: isMobile ? '18px' : '22px',
                    color: '#FFFFFF',
                    backgroundColor: '#8B1616',
                    padding: { x: 25, y: 15 }
                }).setOrigin(0.5).setDepth(403);
                continueBtn.setInteractive({ useHandCursor: true });
                elements.push(continueBtn);

                // Button hover effects
                continueBtn.on('pointerover', () => {
                    continueBtn.setStyle({ backgroundColor: '#B51E1E' });
                });
                continueBtn.on('pointerout', () => {
                    continueBtn.setStyle({ backgroundColor: '#8B1616' });
                });

                // Button click - close cutscene and refresh gates
                continueBtn.on('pointerdown', () => {
                    if (!this.progressionPreview) {
                        this.shipReconstruction = getShipReconstructionSnapshot(
                            window.GameState
                        );
                        if (!this.isFinalVoidReady()) return;
                        window.GameState?.set('hubWorld.shipCompletionCutsceneShown', true);
                        window.GameState?.set('hubWorld.shipParts.finalBossUnlocked', true);
                        window.GameState?.set('hubWorld.gates.final_void.unlocked', true);
                        window.GameState?.save();
                    }

                    // Play sound
                    if (window.AudioManager) {
                        window.AudioManager.playButtonClick();
                    }

                    // Fade out overlay
                    this.tweens.add({
                        targets: elements,
                        alpha: 0,
                        duration: 500,
                        onComplete: () => {
                            elements.forEach(el => {
                                if (el && el.destroy) el.destroy();
                            });

                            // Refresh gates to show Final Void
                            this.refreshGates();
                            const finalGateIndex = this.gates.findIndex(
                                gate => gate.id === 'final_void'
                            );
                            if (finalGateIndex >= 0) {
                                this.selectGate(finalGateIndex);
                            }
                        }
                    });
                });

                // Pulsing animation for button
                this.tweens.add({
                    targets: continueBtn,
                    alpha: { from: 1, to: 0.7 },
                    duration: 600,
                    yoyo: true,
                    repeat: -1
                });
            });
        });
    }

    /**
     * Visualize systems that the player has deliberately installed.
     */
    createShipAssemblyView() {
        const { width, height, centerX, centerY, isMobile } = this.dims;

        const reconstruction = this.shipReconstruction ||
            getShipReconstructionSnapshot(window.GameState);
        const preFinalSteps = reconstruction.steps.slice(0, 5);
        const finalApproachPreview = this.progressionPreview === 'finalApproach';
        const installedPartIds = new Set(
            preFinalSteps
                .filter(step => finalApproachPreview || step.installed)
                .map(step => step.partId)
        );
        const installedCount = installedPartIds.size;
        const totalRequired = preFinalSteps.length;
        const allInstalled = reconstruction.finalVoidReady;

        // For grid layout, position ship assembly above creature (in header area)
        // If mobile, skip the detailed ship view to save space - use header progress bar instead
        if (isMobile) {
            // On mobile, just show a simple ship icon near creature
            this.shipAssemblyElements = [];
            return; // Use header progress display instead
        }

        // Position ship assembly view above creature display (desktop only)
        const shipY = centerY - 80;
        const shipScale = 0.8;

        // Part definitions with positions relative to ship center (5 pre-final parts total)
        const partDefs = {
            crystal_core: { x: -30 * shipScale, y: -20 * shipScale, icon: '🔮', label: 'Core' },
            dimensional_drive: { x: 30 * shipScale, y: -20 * shipScale, icon: '⚙️', label: 'Engine' },
            forest_core: { x: -35 * shipScale, y: 20 * shipScale, icon: '🌿', label: 'Life' },
            hull_plating: { x: 35 * shipScale, y: 20 * shipScale, icon: '🛡️', label: 'Hull' },
            aurora_reactor: { x: 0, y: 0, icon: '✨', label: 'Reactor' }
        };

        // Store elements for cleanup
        this.shipAssemblyElements = [];

        // Create ship container
        const shipContainer = this.add.container(centerX, shipY);
        shipContainer.setDepth(15);
        this.shipAssemblyElements.push(shipContainer);

        // Draw ship hull outline (dashed purple lines connecting part positions)
        const hull = this.add.graphics();
        hull.lineStyle(2, 0x7B68EE, 0.5);

        // Draw hull shape as connected lines (pentagon shape for 5 parts)
        const points = [
            { x: partDefs.aurora_reactor.x, y: partDefs.aurora_reactor.y - 30 * shipScale }, // Top
            { x: partDefs.hull_plating.x + 15, y: partDefs.hull_plating.y }, // Right top
            { x: partDefs.forest_core.x + 15, y: partDefs.forest_core.y + 15 }, // Right bottom
            { x: partDefs.crystal_core.x - 15, y: partDefs.crystal_core.y + 15 }, // Left bottom
            { x: partDefs.dimensional_drive.x - 15, y: partDefs.dimensional_drive.y } // Left top
        ];

        // Draw dashed hull outline
        for (let i = 0; i < points.length; i++) {
            const start = points[i];
            const end = points[(i + 1) % points.length];
            this.drawDashedLine(hull, start.x, start.y, end.x, end.y, 5, 5);
        }

        shipContainer.add(hull);

        // Glow effect for the installed pre-final system chain.
        if (allInstalled) {
            const glow = this.add.graphics();
            glow.fillStyle(0xFFD700, 0.2);
            glow.fillCircle(0, 0, 60 * shipScale);
            shipContainer.add(glow);

            // Pulse glow animation
            this.tweens.add({
                targets: glow,
                alpha: { from: 0.2, to: 0.5 },
                scaleX: { from: 1, to: 1.2 },
                scaleY: { from: 1, to: 1.2 },
                duration: 1200,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }

        // Draw connection lines between installed systems.
        const connectionGraphics = this.add.graphics();
        connectionGraphics.lineStyle(2, 0xFFD700, 0.6);
        shipContainer.add(connectionGraphics);

        const installedPositions = [];

        // Create part slots
        Object.entries(partDefs).forEach(([partId, def]) => {
            const isInstalled = installedPartIds.has(partId);
            const slotSize = isMobile ? 18 : 24;

            // Part background circle
            const slotBg = this.add.graphics();
            if (isInstalled) {
                // Installed: green-white signal with full opacity.
                slotBg.fillStyle(0xFFD700, 0.3);
                slotBg.fillCircle(def.x, def.y, slotSize + 5);
                slotBg.fillStyle(0x1A0A2E, 1);
                slotBg.fillCircle(def.x, def.y, slotSize);
                slotBg.lineStyle(2, 0xFFD700);
                slotBg.strokeCircle(def.x, def.y, slotSize);

                installedPositions.push({ x: def.x, y: def.y });
            } else {
                // Missing: Gray, low opacity
                slotBg.fillStyle(0x333333, 0.5);
                slotBg.fillCircle(def.x, def.y, slotSize);
                slotBg.lineStyle(1, 0x555555, 0.5);
                slotBg.strokeCircle(def.x, def.y, slotSize);
            }
            shipContainer.add(slotBg);

            // Part icon
            const icon = this.add.text(def.x, def.y, def.icon, {
                fontSize: isMobile ? '16px' : '22px'
            }).setOrigin(0.5);

            if (!isInstalled) {
                icon.setAlpha(0.3);
            }
            shipContainer.add(icon);

            if (isInstalled) {
                this.tweens.add({
                    targets: [icon],
                    alpha: { from: 1, to: 0.6 },
                    duration: 1000,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            }
        });

        // Draw connection lines between installed systems.
        if (installedPositions.length >= 2) {
            for (let i = 0; i < installedPositions.length; i++) {
                for (let j = i + 1; j < installedPositions.length; j++) {
                    connectionGraphics.beginPath();
                    connectionGraphics.moveTo(installedPositions[i].x, installedPositions[i].y);
                    connectionGraphics.lineTo(installedPositions[j].x, installedPositions[j].y);
                    connectionGraphics.strokePath();
                }
            }
        }

        // Progress counter
        const progressText = this.add.text(0, 55 * shipScale, `${installedCount}/${totalRequired} Systems`, {
            fontSize: isMobile ? '12px' : '14px',
            color: allInstalled ? '#6FFFA8' : '#AAAAAA',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        shipContainer.add(progressText);

        if (allInstalled) {
            const readyText = this.add.text(0, 75 * shipScale, 'FINAL VOID ACCESS', {
                fontSize: isMobile ? '14px' : '18px',
                color: '#00FF00',
                fontStyle: 'bold',
                stroke: '#004400',
                strokeThickness: 2
            }).setOrigin(0.5);
            shipContainer.add(readyText);

            // Pulsing animation for ready text
            this.tweens.add({
                targets: readyText,
                scale: { from: 1, to: 1.1 },
                duration: 600,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }

    /**
     * Draw a dashed line on graphics object
     */
    drawDashedLine(graphics, x1, y1, x2, y2, dashLength = 5, gapLength = 5) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const dashCount = Math.floor(distance / (dashLength + gapLength));
        const nx = dx / distance;
        const ny = dy / distance;

        for (let i = 0; i < dashCount; i++) {
            const startX = x1 + (dashLength + gapLength) * i * nx;
            const startY = y1 + (dashLength + gapLength) * i * ny;
            const endX = startX + dashLength * nx;
            const endY = startY + dashLength * ny;

            graphics.beginPath();
            graphics.moveTo(startX, startY);
            graphics.lineTo(endX, endY);
            graphics.strokePath();
        }
    }

    createCreatureDisplay() {
        const { centerX, centerY, platformRadius, isMobile } = this.dims;

        // Get active creature
        const creature = window.GameState?.getActiveCreature();

        if (creature && creature.textureName && this.textures.exists(creature.textureName)) {
            // Use existing texture
            this.creatureSprite = this.add.sprite(centerX, centerY - 10, creature.textureName);
            this.creatureSprite.setScale(isMobile ? 0.8 : 1);
            this.creatureSprite.setDepth(8);
        } else if (creature && creature.genes && this.graphicsEngine) {
            // Generate creature texture
            const { textureName } = this.graphicsEngine.createRandomizedSpaceMythicCreature(creature.genes, 0);
            this.creatureSprite = this.add.sprite(centerX, centerY - 10, textureName);
            this.creatureSprite.setScale(isMobile ? 0.8 : 1);
            this.creatureSprite.setDepth(8);
        } else {
            // Placeholder
            const placeholder = this.add.text(centerX, centerY, '🐾', {
                fontSize: isMobile ? '48px' : '64px'
            }).setOrigin(0.5).setDepth(8);

            this.creatureSprite = placeholder;
        }

        // Idle animation
        this.tweens.add({
            targets: this.creatureSprite,
            y: this.creatureSprite.y - 5,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Creature name below platform
        const creatureName = creature?.name || 'No Creature';
        this.creatureNameText = this.add.text(centerX, centerY + platformRadius + 10, creatureName, {
            fontSize: isMobile ? '16px' : '20px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(8);
    }

    createUI() {
        const { width, height, isMobile } = this.dims;

        // Title
        const title = this.add.text(width / 2, 30, 'COSMIC HUB', {
            fontSize: isMobile ? '28px' : '42px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
            stroke: '#4A0080',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(50);

        // Coins display
        const coins = window.GameState?.get('player.cosmicCoins') || 0;
        this.coinsText = this.add.text(width - 20, 20, `🪙 ${coins}`, {
            fontSize: isMobile ? '18px' : '24px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(1, 0).setDepth(50);

        // Ship Parts Progress Display
        this.createShipPartsDisplay();

        // Info panel at bottom
        const infoPanelY = height - (isMobile ? 140 : 160);
        const infoPanelHeight = isMobile ? 130 : 150;

        const infoPanel = this.add.graphics();
        infoPanel.fillStyle(0x1A0A2E, 0.9);
        infoPanel.fillRoundedRect(20, infoPanelY, width - 40, infoPanelHeight, 15);
        infoPanel.lineStyle(3, 0x6B00B3);
        infoPanel.strokeRoundedRect(20, infoPanelY, width - 40, infoPanelHeight, 15);
        infoPanel.setDepth(40);

        const actionBtnX = isMobile ? width / 2 : width - 110;
        const actionBtnY = isMobile
            ? infoPanelY + infoPanelHeight - 35
            : infoPanelY + infoPanelHeight / 2;
        const infoX = isMobile ? width / 2 : 42;
        const infoY = isMobile ? infoPanelY + 14 : actionBtnY;

        // Info text
        this.infoText = this.add.text(infoX, infoY, 'Select a gate', {
            fontSize: isMobile ? '16px' : '21px',
            color: '#FFFFFF',
            align: isMobile ? 'center' : 'left',
            lineSpacing: 3,
            wordWrap: {
                width: isMobile ? width - 70 : Math.max(260, width - 310)
            }
        }).setOrigin(isMobile ? 0.5 : 0, isMobile ? 0 : 0.5).setDepth(41);

        // Action button uses a stable local coordinate system when its style changes.
        this.actionButton = this.add.graphics().setPosition(actionBtnX, actionBtnY);
        this.actionButton.fillStyle(0x00AA00, 1);
        this.actionButton.fillRoundedRect(-60, -25, 120, 50, 10);
        this.actionButton.setDepth(41);

        this.actionLabel = this.add.text(actionBtnX, actionBtnY, 'ENTER', {
            fontSize: isMobile ? '15px' : '17px',
            color: '#FFFFFF',
            fontStyle: 'bold',
            align: 'center',
            fixedWidth: 112
        }).setOrigin(0.5).setDepth(42);

        const actionZone = this.add.zone(
            actionBtnX,
            actionBtnY,
            120,
            50
        ).setOrigin(0.5);
        actionZone.setInteractive({ useHandCursor: true });
        actionZone.setDepth(42);

        actionZone.on('pointerdown', () => {
            const selectedGate = this.gates[this.selectedGateIndex];
            if (selectedGate) {
                this.onGateClicked(selectedGate, this.selectedGateIndex);
            }
        });

        // Back button (to return to GameScene if coming from there)
        const backBtn = this.add.text(20, 20, '← Back', {
            fontSize: isMobile ? '16px' : '20px',
            color: '#FFFFFF',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: { x: 15, y: 8 }
        }).setOrigin(0, 0).setDepth(50);
        backBtn.setInteractive({ useHandCursor: true });

        backBtn.on('pointerdown', () => {
            this.scene.start('GameScene');
        });

        backBtn.on('pointerover', () => backBtn.setAlpha(0.8));
        backBtn.on('pointerout', () => backBtn.setAlpha(1));

        // Mobile navigation arrows (easier gate navigation on touch devices)
        if (isMobile) {
            this.createMobileNavArrows();
        }
    }

    /**
     * Create mobile navigation arrows for easier gate selection
     */
    createMobileNavArrows() {
        const { width, height, centerY } = this.dims;

        // Arrow button size (large touch targets - minimum 44px)
        const arrowSize = 60;
        const arrowY = centerY;

        // Left arrow
        const leftArrowBg = this.add.graphics();
        leftArrowBg.fillStyle(0x000000, 0.5);
        leftArrowBg.fillCircle(40, arrowY, arrowSize / 2);
        leftArrowBg.lineStyle(2, 0x7B68EE);
        leftArrowBg.strokeCircle(40, arrowY, arrowSize / 2);
        leftArrowBg.setDepth(45);

        const leftArrow = this.add.text(40, arrowY, '◀', {
            fontSize: '28px',
            color: '#FFFFFF'
        }).setOrigin(0.5).setDepth(46);

        const leftArrowZone = this.add.zone(40, arrowY, arrowSize, arrowSize)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setDepth(47);

        leftArrowZone.on('pointerdown', () => {
            const newIndex = (this.selectedGateIndex - 1 + this.gates.length) % this.gates.length;
            this.selectGate(newIndex);
            // Visual feedback
            leftArrowBg.clear();
            leftArrowBg.fillStyle(0x7B68EE, 0.7);
            leftArrowBg.fillCircle(40, arrowY, arrowSize / 2);
            leftArrowBg.lineStyle(2, 0xFFD700);
            leftArrowBg.strokeCircle(40, arrowY, arrowSize / 2);
            // Play sound
            if (window.AudioManager) {
                window.AudioManager.playButtonClick();
            }
        });

        leftArrowZone.on('pointerup', () => {
            leftArrowBg.clear();
            leftArrowBg.fillStyle(0x000000, 0.5);
            leftArrowBg.fillCircle(40, arrowY, arrowSize / 2);
            leftArrowBg.lineStyle(2, 0x7B68EE);
            leftArrowBg.strokeCircle(40, arrowY, arrowSize / 2);
        });

        // Right arrow
        const rightArrowBg = this.add.graphics();
        rightArrowBg.fillStyle(0x000000, 0.5);
        rightArrowBg.fillCircle(width - 40, arrowY, arrowSize / 2);
        rightArrowBg.lineStyle(2, 0x7B68EE);
        rightArrowBg.strokeCircle(width - 40, arrowY, arrowSize / 2);
        rightArrowBg.setDepth(45);

        const rightArrow = this.add.text(width - 40, arrowY, '▶', {
            fontSize: '28px',
            color: '#FFFFFF'
        }).setOrigin(0.5).setDepth(46);

        const rightArrowZone = this.add.zone(width - 40, arrowY, arrowSize, arrowSize)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setDepth(47);

        rightArrowZone.on('pointerdown', () => {
            const newIndex = (this.selectedGateIndex + 1) % this.gates.length;
            this.selectGate(newIndex);
            // Visual feedback
            rightArrowBg.clear();
            rightArrowBg.fillStyle(0x7B68EE, 0.7);
            rightArrowBg.fillCircle(width - 40, arrowY, arrowSize / 2);
            rightArrowBg.lineStyle(2, 0xFFD700);
            rightArrowBg.strokeCircle(width - 40, arrowY, arrowSize / 2);
            // Play sound
            if (window.AudioManager) {
                window.AudioManager.playButtonClick();
            }
        });

        rightArrowZone.on('pointerup', () => {
            rightArrowBg.clear();
            rightArrowBg.fillStyle(0x000000, 0.5);
            rightArrowBg.fillCircle(width - 40, arrowY, arrowSize / 2);
            rightArrowBg.lineStyle(2, 0x7B68EE);
            rightArrowBg.strokeCircle(width - 40, arrowY, arrowSize / 2);
        });

        // Store references for cleanup
        this.mobileNavElements = [leftArrowBg, leftArrow, leftArrowZone, rightArrowBg, rightArrow, rightArrowZone];
    }

    /**
     * Show installation progress toward Final Void access.
     */
    createShipPartsDisplay() {
        const { width, height, isMobile } = this.dims;

        const reconstruction = this.shipReconstruction ||
            getShipReconstructionSnapshot(window.GameState);
        const preFinalSteps = reconstruction.steps.slice(0, 5);
        const finalApproachPreview = this.progressionPreview === 'finalApproach';
        const installed = finalApproachPreview
            ? preFinalSteps.length
            : preFinalSteps.filter(step => step.installed).length;
        const total = preFinalSteps.length;

        // Position below title
        const displayY = isMobile ? 70 : 85;

        // Ship parts container
        const containerWidth = isMobile ? 200 : 280;
        const containerHeight = isMobile ? 50 : 60;
        const containerX = (width - containerWidth) / 2;

        // Background panel
        const shipPanel = this.add.graphics();
        shipPanel.fillStyle(0x1A0A2E, 0.85);
        shipPanel.fillRoundedRect(containerX, displayY, containerWidth, containerHeight, 10);
        shipPanel.lineStyle(2, installed === total ? 0x33D17A : 0x6B00B3);
        shipPanel.strokeRoundedRect(containerX, displayY, containerWidth, containerHeight, 10);
        shipPanel.setDepth(50);

        // Ship icon
        const shipIcon = this.add.text(containerX + 15, displayY + containerHeight / 2, '🚀', {
            fontSize: isMobile ? '24px' : '32px'
        }).setOrigin(0, 0.5).setDepth(51);

        // Title text
        const titleText = this.add.text(containerX + (isMobile ? 45 : 55), displayY + 12, 'SHIP SYSTEMS', {
            fontSize: isMobile ? '10px' : '12px',
            color: '#AAAAAA',
            fontStyle: 'bold'
        }).setDepth(51);

        // Progress text
        const progressColor = installed === total ? '#6FFFA8' : '#FFFFFF';
        const progressText = this.add.text(containerX + (isMobile ? 45 : 55), displayY + (isMobile ? 30 : 35),
            `${installed}/${total} Installed`, {
            fontSize: isMobile ? '14px' : '18px',
            color: progressColor,
            fontStyle: 'bold'
        }).setDepth(51);

        // Part indicators (small circles showing collected/not collected)
        const partIcons = ['🔮', '⚙️', '🌿', '🛡️', '✨'];
        const partNames = ['Crystal Core', 'Dimensional Drive', 'Forest Core', 'Hull Plating', 'Aurora Reactor'];
        const partIds = PRE_FINAL_SHIP_PART_IDS;

        const startX = containerX + containerWidth - (isMobile ? 75 : 100);
        partIcons.forEach((icon, idx) => {
            const step = preFinalSteps.find(candidate => candidate.partId === partIds[idx]);
            const isInstalled = finalApproachPreview || step?.installed === true;
            const isRecovered = step?.recovered === true;
            const partX = startX + idx * (isMobile ? 14 : 18);

            const partIndicator = this.add.text(partX, displayY + containerHeight / 2, icon, {
                fontSize: isMobile ? '12px' : '16px'
            }).setOrigin(0.5).setDepth(51);

            partIndicator.setAlpha(isInstalled ? 1 : isRecovered ? 0.55 : 0.2);
        });

        if (installed === total) {
            const readyText = this.add.text(width / 2, displayY + containerHeight + 15, 'FINAL VOID ACCESS READY', {
                fontSize: isMobile ? '14px' : '18px',
                color: '#FFD700',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5).setDepth(51);

            // Pulsing animation
            this.tweens.add({
                targets: readyText,
                alpha: { from: 1, to: 0.6 },
                scale: { from: 1, to: 1.05 },
                duration: 800,
                yoyo: true,
                repeat: -1
            });
        }
    }

    createCollectionButton() {
        const { width, height, isMobile } = this.dims;

        // Collection button to view/switch creatures
        const collectionStatus = window.GameState?.getCollectionStatus() || { count: 0, max: 8 };

        const btnX = isMobile ? width - 60 : width - 80;
        const btnY = isMobile ? 70 : 80;

        const collectionBtn = this.add.graphics();
        collectionBtn.fillStyle(0x4A0080, 0.9);
        collectionBtn.fillRoundedRect(btnX - 50, btnY - 25, 100, 50, 10);
        collectionBtn.lineStyle(2, 0x9370DB);
        collectionBtn.strokeRoundedRect(btnX - 50, btnY - 25, 100, 50, 10);
        collectionBtn.setDepth(50);

        const collectionLabel = this.add.text(btnX, btnY, `🐾 ${collectionStatus.count}/${collectionStatus.max}`, {
            fontSize: isMobile ? '14px' : '16px',
            color: '#FFFFFF'
        }).setOrigin(0.5).setDepth(51);

        const collectionZone = this.add.zone(btnX - 50, btnY - 25, 100, 50).setOrigin(0);
        collectionZone.setInteractive({ useHandCursor: true });
        collectionZone.setDepth(51);

        collectionZone.on('pointerdown', () => {
            this.showCreatureCollection();
        });

        this.collectionButton = { btn: collectionBtn, label: collectionLabel, zone: collectionZone };
    }

    showCreatureCollection() {
        const { width, height, isMobile } = this.dims;

        // Get creatures
        const creatures = window.GameState?.getCreatureCollection() || [];
        const activeIndex = window.GameState?.get('activeCreatureIndex') || 0;

        if (creatures.length === 0) {
            // Show message
            const msg = this.add.text(width / 2, height / 2, 'No creatures in collection yet!', {
                fontSize: '20px',
                color: '#FFFFFF'
            }).setOrigin(0.5).setDepth(250);

            this.time.delayedCall(2000, () => msg.destroy());
            return;
        }

        // Create overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(200);

        // Panel
        const panelWidth = isMobile ? width - 40 : 500;
        const panelHeight = Math.min(height - 100, creatures.length * 80 + 120);
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.lineStyle(3, 0x9370DB);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.setDepth(201);

        // Title
        const title = this.add.text(width / 2, panelY + 30, '🐾 Creature Collection', {
            fontSize: isMobile ? '22px' : '28px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        const elements = [overlay, panel, title];

        // List creatures
        creatures.forEach((creature, index) => {
            const itemY = panelY + 80 + index * 70;

            // Item background
            const itemBg = this.add.graphics();
            itemBg.fillStyle(index === activeIndex ? 0x4A0080 : 0x2A0040, 0.8);
            itemBg.fillRoundedRect(panelX + 20, itemY, panelWidth - 40, 60, 8);
            if (index === activeIndex) {
                itemBg.lineStyle(2, 0xFFD700);
                itemBg.strokeRoundedRect(panelX + 20, itemY, panelWidth - 40, 60, 8);
            }
            itemBg.setDepth(202);
            elements.push(itemBg);

            // Creature name and info
            const nameText = this.add.text(panelX + 40, itemY + 15,
                `${creature.name}${index === activeIndex ? ' (Active)' : ''}`, {
                fontSize: '18px',
                color: index === activeIndex ? '#FFD700' : '#FFFFFF',
                fontStyle: 'bold'
            }).setDepth(203);
            elements.push(nameText);

            const infoText = this.add.text(panelX + 40, itemY + 38,
                `Lv.${creature.level || 1} • ${creature.rarity || 'common'}`, {
                fontSize: '14px',
                color: '#AAAAAA'
            }).setDepth(203);
            elements.push(infoText);

            // Select button
            if (index !== activeIndex) {
                const selectBtn = this.add.text(panelX + panelWidth - 80, itemY + 30, 'SELECT', {
                    fontSize: '14px',
                    color: '#FFFFFF',
                    backgroundColor: '#00AA00',
                    padding: { x: 10, y: 5 }
                }).setOrigin(0.5).setDepth(203);
                selectBtn.setInteractive({ useHandCursor: true });

                selectBtn.on('pointerdown', () => {
                    window.GameState?.switchActiveCreature(index);

                    // Close modal and refresh
                    elements.forEach(el => el.destroy());
                    this.refreshCreatureDisplay();
                });

                elements.push(selectBtn);
            }
        });

        // Close button
        const closeBtn = this.add.text(width / 2, panelY + panelHeight - 30, 'CLOSE', {
            fontSize: '18px',
            color: '#FFFFFF',
            backgroundColor: '#666666',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setDepth(202);
        closeBtn.setInteractive({ useHandCursor: true });

        closeBtn.on('pointerdown', () => {
            elements.forEach(el => el.destroy());
            closeBtn.destroy();
        });
    }

    refreshCreatureDisplay() {
        // Refresh creature on platform
        if (this.creatureSprite) {
            this.creatureSprite.destroy();
        }
        if (this.creatureNameText) {
            this.creatureNameText.destroy();
        }

        this.createCreatureDisplay();

        // Update collection button
        const collectionStatus = window.GameState?.getCollectionStatus() || { count: 0, max: 8 };
        if (this.collectionButton?.label) {
            this.collectionButton.label.setText(`🐾 ${collectionStatus.count}/${collectionStatus.max}`);
        }
    }

    setupInput() {
        // Keyboard navigation
        this.input.keyboard.on('keydown-LEFT', () => {
            if (this.isFirstExpeditionInvitationOpen) return;
            const newIndex = (this.selectedGateIndex - 1 + this.gates.length) % this.gates.length;
            this.selectGate(newIndex);
        });

        this.input.keyboard.on('keydown-RIGHT', () => {
            if (this.isFirstExpeditionInvitationOpen) return;
            const newIndex = (this.selectedGateIndex + 1) % this.gates.length;
            this.selectGate(newIndex);
        });

        this.input.keyboard.on('keydown-ENTER', () => {
            if (this.isFirstExpeditionInvitationOpen) {
                const forestGate = this.gates.find(gate => gate.id === 'mythical_forest');
                this.closeFirstExpeditionInvitation();
                if (this.progressionPreview === 'firstRoute') return;
                if (forestGate) this.enterGate(forestGate);
                return;
            }
            const selectedGate = this.gates[this.selectedGateIndex];
            if (selectedGate) {
                this.onGateClicked(selectedGate, this.selectedGateIndex);
            }
        });

        this.input.keyboard.on('keydown-ESC', () => {
            if (this.isFirstExpeditionInvitationOpen) {
                this.closeFirstExpeditionInvitation();
                return;
            }
            this.scene.start('GameScene');
        });

        // H key to return here from GameScene
        console.log('[HubWorldScene] Input setup complete (Arrow keys, Enter, ESC)');
    }

    shutdown() {
        if (this._isShuttingDown) return;
        this._isShuttingDown = true;

        console.log('[HubWorldScene] Shutting down');
        if (this.gateTransitionFallback) {
            clearTimeout(this.gateTransitionFallback);
            this.gateTransitionFallback = null;
        }
        this.closeFirstExpeditionInvitation({ markSeen: false });

        // Remove keyboard listeners
        if (this.input?.keyboard) {
            this.input.keyboard.off('keydown-LEFT');
            this.input.keyboard.off('keydown-RIGHT');
            this.input.keyboard.off('keydown-ENTER');
            this.input.keyboard.off('keydown-ESC');
        }

        // Remove gate zone listeners
        this.gates.forEach(gate => {
            if (gate.zone && gate.zone.removeAllListeners) {
                gate.zone.removeAllListeners();
            }
        });

        // Clear mobile navigation elements
        if (this.mobileNavElements) {
            this.mobileNavElements.forEach(el => {
                if (el && el.removeAllListeners) el.removeAllListeners();
                if (el && el.destroy) el.destroy();
            });
            this.mobileNavElements = [];
        }

        // Clear timers and tweens
        if (this.time) this.time.removeAllEvents();
        if (this.tweens) this.tweens.killAll();

        // Clear ship assembly elements
        if (this.shipAssemblyElements) {
            this.shipAssemblyElements.forEach(el => {
                if (el && el.destroy) el.destroy();
            });
            this.shipAssemblyElements = [];
        }

        // Clear portal vortex timers
        if (this.vortexTimers) {
            this.vortexTimers.forEach(timer => {
                if (timer && timer.destroy) timer.destroy();
            });
            this.vortexTimers = [];
        }

        // Clear portal vortex elements
        if (this.portalVortexElements) {
            this.portalVortexElements.forEach(vortex => {
                if (vortex.glow && vortex.glow.destroy) vortex.glow.destroy();
                if (vortex.particles) {
                    vortex.particles.forEach(p => {
                        if (p.graphics && p.graphics.destroy) p.graphics.destroy();
                    });
                }
            });
            this.portalVortexElements = [];
        }

        // Clear parallax timer
        if (this.parallaxTimer && this.parallaxTimer.destroy) {
            this.parallaxTimer.destroy();
            this.parallaxTimer = null;
        }

        // Clear parallax layers
        if (this.parallaxLayers) {
            this.parallaxLayers.forEach(layer => {
                layer.stars.forEach(star => {
                    if (star.graphics && star.graphics.destroy) star.graphics.destroy();
                });
            });
            this.parallaxLayers = [];
        }

        // Remove pointer move listener
        if (this.input) {
            this.input.off('pointermove');
        }

        // Clear details panel
        if (this.detailsPanelElements) {
            this.detailsPanelElements.forEach(el => {
                if (el && el.destroy) el.destroy();
            });
            this.detailsPanelElements = [];
        }

        if (this.projectBeaconDebriefElements) {
            this.projectBeaconDebriefElements.forEach(element => element?.destroy?.());
            this.projectBeaconDebriefElements = [];
        }
        this.isProjectBeaconDebriefOpen = false;

        // Clear references
        this.graphicsEngine = null;
        this.gates = [];
        this.gateElements = [];
        this.creatureSprite = null;

        console.log('[HubWorldScene] Cleanup complete');
    }
}

// Register globally
if (typeof window !== 'undefined') {
    window.HubWorldScene = HubWorldScene;
}
