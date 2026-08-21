import Phaser from 'phaser';
import biomeConfigs from '../../config/biomes.json';
import SanctuaryZones from './SanctuaryZones.js';
import { FEND_RESIDENT_DEFINITIONS } from '../FendResidents.js';
import {
    GUARDIAN_RESIDENT_DEFINITIONS,
    GUARDIAN_SOCIAL_EXCHANGES
} from '../GuardianResidents.js';
import { RESCUED_RESIDENT_DEFINITIONS } from '../RescuedResidents.js';
import { CURRENT_VEIL_ANCHORS } from '../CurrentVeilMission.js';
import { getFusionPodLandmarkSnapshot } from '../FusionPodLandmark.js';
import {
    getVillageSnapshot,
    getVillageWorldGuidance,
    VILLAGE_BUILDING_DEFINITIONS,
    VILLAGE_PLOTS,
    VILLAGE_WORLD_ARTWORK
} from '../VillageSettlement.js';

/**
 * WorldBuilder - Creates biome-specific game world environments
 * Generates backgrounds, environment objects, and world features based on current biome
 */
class WorldBuilder {
    constructor(scene, graphicsEngine, options = {}) {
        this.scene = scene;
        this.graphicsEngine = graphicsEngine;
        this.worldWidth = options.worldWidth || 1600;
        this.worldHeight = options.worldHeight || 1200;
        this.currentBiome = options.biome || scene?.currentBiome || 'nebula';
        this.biomeConfig = this.loadBiomeConfig(this.currentBiome);
        this.debugGraphics = null;
        this.backgroundImage = null;

        // Initialize Sanctuary zones for the main world
        this.sanctuaryZones = new SanctuaryZones(this.worldWidth, this.worldHeight);
    }

    /**
     * Load biome configuration
     */
    loadBiomeConfig(biomeId) {
        const config = biomeConfigs[biomeId];
        if (!config) {
            console.warn(`[WorldBuilder] Unknown biome "${biomeId}", using nebula`);
            return biomeConfigs['nebula'] || this.getDefaultPalette();
        }
        return config;
    }

    /**
     * Get default palette for fallback
     */
    getDefaultPalette() {
        return {
            palette: {
                skyTop: '#B39DDB',
                skyBottom: '#80CBC4',
                nebula: '#F48FB1',
                accent: '#FFD54F',
                flora: '#64B5F6',
                rocks: '#90A4AE'
            }
        };
    }

    /**
     * Convert hex string to number
     */
    hexToInt(hex) {
        if (typeof hex === 'number') return hex;
        if (typeof hex === 'string') {
            return parseInt(hex.replace('#', ''), 16);
        }
        return 0xFFFFFF;
    }

    build() {
        const background = this.createBackgroundImage();

        // Cave biomes use constrained tunnel navigation
        const isCaveBiome = this.currentBiome === 'crystal_caves';

        let environment;
        let caveTunnels = null;
        let caveElements = null;

        if (isCaveBiome) {
            // Cave-specific environment (no shop, tunnels, special elements)
            environment = this.createCaveEnvironment();
            caveTunnels = this.createCaveTunnels();
            caveElements = this.createCaveElements();
        } else {
            environment = this.createEnvironmentObjects();
        }

        // Add Sanctuary-specific landmarks if in main/nebula biome
        let sanctuaryLandmarks = {};
        if (this.currentBiome === 'nebula') {
            sanctuaryLandmarks = this.createSanctuaryLandmarks();
        }

        // Add return portal for non-sanctuary biomes
        let returnPortal = null;
        if (this.currentBiome !== 'nebula') {
            returnPortal = this.createReturnPortal();
        }

        return {
            background,
            ...environment,
            ...sanctuaryLandmarks,
            returnPortal,
            caveTunnels,
            caveElements,
            sanctuaryZones: this.sanctuaryZones
        };
    }

    /**
     * Create Sanctuary-specific landmarks
     */
    createSanctuaryLandmarks() {
        const physics = this.scene.physics;
        const landmarks = this.sanctuaryZones.landmarks;

        // Create crashed ship (futuristic spacecraft, 220x160 texture - horizontal layout)
        this.graphicsEngine.createCrashedShip();
        const crashedShip = physics.add.staticSprite(
            landmarks.crashedShip.position.x,
            landmarks.crashedShip.position.y,
            'crashedShip'
        );
        crashedShip.setScale(1.0);
        crashedShip.setDepth(landmarks.crashedShip.position.y);
        // Collision body sized for fuselage (220x160 texture, horizontal orientation)
        crashedShip.body.setSize(180, 80);
        crashedShip.body.setOffset(20, 40);
        crashedShip.landmarkId = 'crashedShip';
        crashedShip.landmarkData = landmarks.crashedShip;

        // Create hub portal (mystical gate to other worlds) at the bottom
        this.graphicsEngine.createHubPortal();
        const hubPortal = physics.add.staticSprite(
            landmarks.hubPortal.position.x,
            landmarks.hubPortal.position.y,
            'hubPortal'
        );
        hubPortal.setScale(1.0);
        hubPortal.setDepth(landmarks.hubPortal.position.y);
        hubPortal.body.setSize(120, 160);
        hubPortal.body.setOffset(20, 10);
        hubPortal.landmarkId = 'hubPortal';
        hubPortal.landmarkData = landmarks.hubPortal;
        hubPortal.setInteractive();

        // Add gentle pulsing animation for the mystical gate
        this.scene.tweens.add({
            targets: hubPortal,
            alpha: { from: 0.95, to: 1 },
            scaleX: { from: 0.98, to: 1.02 },
            scaleY: { from: 0.98, to: 1.02 },
            duration: 2500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Create void portal (black hole for void mini-game) directly under the spaceship
        // This replaces the visual shadow/crater under the ship
        this.graphicsEngine.createVoidPortal();
        const voidPortal = physics.add.staticSprite(
            landmarks.voidPortal.position.x,
            landmarks.voidPortal.position.y,
            'voidPortal'
        );
        voidPortal.setScale(0.5); // Slightly smaller to fit under ship
        voidPortal.setDepth(landmarks.crashedShip.position.y - 10); // Just below ship
        voidPortal.body.setSize(70, 70);
        voidPortal.body.setOffset(65, 65); // Adjusted for scale
        voidPortal.landmarkId = 'voidPortal';
        voidPortal.landmarkData = landmarks.voidPortal;
        voidPortal.setInteractive();

        // Add ominous pulsing animation for the black hole
        this.scene.tweens.add({
            targets: voidPortal,
            alpha: { from: 0.85, to: 1 },
            scaleX: { from: 0.45, to: 0.55 },
            scaleY: { from: 0.45, to: 0.55 },
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Add slow rotation to give swirling black hole effect
        this.scene.tweens.add({
            targets: voidPortal,
            angle: 360,
            duration: 25000,
            repeat: -1,
            ease: 'Linear'
        });

        // Create warning signs around the void portal
        const warningSigns = this.createVoidWarningSigns(
            landmarks.voidPortal.position.x,
            landmarks.voidPortal.position.y,
            voidPortal.depth - 5
        );

        // Create campfire
        this.graphicsEngine.createCampfire();
        const campfire = physics.add.staticSprite(
            landmarks.campfire.position.x,
            landmarks.campfire.position.y,
            'campfire'
        );
        campfire.setScale(1.0);
        campfire.setDepth(landmarks.campfire.position.y);
        campfire.body.setSize(40, 30);
        campfire.body.setOffset(10, 35);
        campfire.landmarkId = 'campfire';

        // Add campfire flicker animation
        this.scene.tweens.add({
            targets: campfire,
            scaleX: { from: 0.95, to: 1.05 },
            scaleY: { from: 0.95, to: 1.05 },
            duration: 300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Create Target Practice Range
        const targetRange = this.createTargetRange(landmarks.targetRange);
        const signalGarden = this.createSignalGarden(landmarks.signalGarden);
        const villageHeartLandmark = this.createVillageHeart(
            landmarks.villageHeart
        );
        const sanctuaryKeepsakes = this.createSanctuaryKeepsakes();
        const kinshipBeacon = this.createKinshipBeacon();
        const fusionPodLandmark = this.createFusionPodLandmark(
            landmarks.fusionPod
        );

        console.log('[WorldBuilder] Created Sanctuary landmarks, including persistent lineage records');

        return {
            crashedShip,
            hubPortal,
            voidPortal,
            campfire,
            targetRange,
            signalGarden,
            villageHeartLandmark,
            sanctuaryKeepsakes,
            kinshipBeacon,
            fusionPodLandmark
        };
    }

    createVillageHeart(landmarkData, snapshotOverride = null) {
        const x = landmarkData.position.x;
        const y = landmarkData.position.y;
        const zone = this.scene.add.zone(
            x,
            y,
            landmarkData.size.width,
            landmarkData.size.height
        );
        this.scene.physics.add.existing(zone, true);
        zone.setDepth(y);
        zone.landmarkId = 'villageHeart';
        zone.landmarkData = landmarkData;

        const districtTerrain = this.scene.add.graphics()
            .setPosition(x, y)
            .setDepth(y - 3);
        const currentPaths = this.scene.add.graphics()
            .setPosition(x, y)
            .setDepth(y - 2);
        const heart = this.scene.add.graphics().setPosition(x, y).setDepth(y + 2);
        const heartArtwork = this.scene.textures.exists(VILLAGE_WORLD_ARTWORK.heart.key)
            ? this.scene.add.image(x, y - 22, VILLAGE_WORLD_ARTWORK.heart.key)
                .setDisplaySize(228, 228)
                .setDepth(y + 2)
            : null;
        if (heartArtwork) heartArtwork.villageBaseScale = heartArtwork.scaleX;
        const glow = this.scene.add.graphics().setPosition(x, y).setDepth(y + 1);
        const actionLabel = this.scene.add.text(x, y - 126, 'OPEN VILLAGE PLAN', {
            fontSize: '10px',
            fontFamily: 'Arial, sans-serif',
            color: '#F2C14E',
            fontStyle: 'bold',
            stroke: '#071411',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(y + 5);
        const label = this.scene.add.text(x, y + 105, 'VILLAGE HEART', {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            color: '#F4F4F4',
            fontStyle: 'bold',
            stroke: '#050505',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(y + 4);
        const statusLabel = this.scene.add.text(x, y + 132, '', {
            fontSize: '9px',
            fontFamily: 'Arial, sans-serif',
            color: '#8FE3CF',
            fontStyle: 'bold',
            stroke: '#050505',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(y + 4);

        const landmark = {
            zone,
            districtTerrain,
            currentPaths,
            heart,
            heartArtwork,
            glow,
            actionLabel,
            label,
            statusLabel,
            buildingElements: [],
            buildingTweens: [],
            plotHitZones: [],
            pulseTween: null,
            heartArtworkTween: null,
            snapshot: null
        };

        zone.setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => {
            heart.setScale(1.04);
            if (heartArtwork) {
                heartArtwork.setScale(heartArtwork.villageBaseScale * 1.04);
            }
            glow.setScale(1.08);
            actionLabel.setColor('#FFFFFF').setScale(1.06);
        });
        zone.on('pointerout', () => {
            heart.setScale(1);
            if (heartArtwork) heartArtwork.setScale(heartArtwork.villageBaseScale);
            glow.setScale(1);
            actionLabel
                .setColor(
                    landmark.snapshot?.unlock?.unlocked
                        ? '#F2C14E'
                        : '#93A2A9'
                )
                .setScale(1);
        });
        zone.on('pointerdown', () => this.activateVillageHeart(landmark));

        const snapshot = snapshotOverride || (
            typeof window !== 'undefined' && window.GameState
                ? getVillageSnapshot(window.GameState)
                : null
        );
        this.refreshVillageSettlement(landmark, snapshot);
        this.villageHeart = landmark;
        return landmark;
    }

    refreshVillageSettlement(landmark, snapshot = null) {
        if (!landmark?.heart) return;
        landmark.pulseTween?.stop?.();
        landmark.heartArtworkTween?.stop?.();
        landmark.buildingTweens?.forEach(tween => tween?.stop?.());
        this.clearVillageCommunityMoment(landmark);
        landmark.buildingElements?.forEach(element => element?.destroy?.(true));
        landmark.plotHitZones?.forEach(zone => zone?.destroy?.());
        landmark.buildingTweens = [];
        landmark.buildingElements = [];
        landmark.plotHitZones = [];
        landmark.workerElements = [];
        landmark.residentElements = [];
        landmark.plotWorldPositions = new Map();
        landmark.snapshot = snapshot;

        const unlocked = snapshot?.unlock?.unlocked === true;
        const {
            districtTerrain,
            currentPaths,
            heart,
            heartArtwork,
            glow,
            actionLabel,
            label,
            statusLabel
        } = landmark;
        const compactSettlement = this.scene.scale.width <= 600;
        const plotOffsets = compactSettlement
            ? [
                { x: -130, y: -174 },
                { x: 130, y: -174 },
                { x: -130, y: 86 },
                { x: 130, y: 86 },
                { x: 0, y: 218 }
            ]
            : [
                { x: 210, y: -176 },
                { x: 430, y: -132 },
                { x: 238, y: 124 },
                { x: 474, y: 136 },
                { x: 545, y: -4 }
            ];

        districtTerrain.clear();
        currentPaths.clear();
        heart.clear();
        glow.clear();

        const districtCenterX = compactSettlement ? 0 : 230;
        const districtPatches = compactSettlement
            ? [
                [0, 18, 462, 468], [-132, -126, 210, 186],
                [136, -118, 210, 180], [0, 174, 278, 164]
            ]
            : [
                [districtCenterX + 84, 0, 790, 362], [50, -72, 278, 230],
                [344, -112, 390, 196], [536, 74, 358, 218]
            ];
        districtPatches.forEach(([patchX, patchY, width, height], index) => {
            districtTerrain.fillStyle(
                index === 0 ? 0x12352F : index % 2 ? 0x245044 : 0x183E36,
                unlocked ? (index === 0 ? 0.3 : 0.2) : 0.1
            );
            districtTerrain.fillEllipse(patchX, patchY, width, height);
        });
        const groundDetails = compactSettlement
            ? [[-154, 62], [142, 94], [-92, -154], [88, 156]]
            : [[-54, 64], [132, -130], [294, 128], [492, -72], [548, 74]];
        groundDetails.forEach(([detailX, detailY], index) => {
            districtTerrain.fillStyle(index % 2 ? 0x8FE3CF : 0xF4F4F4, 0.16);
            districtTerrain.fillCircle(detailX, detailY, index % 2 ? 4 : 3);
            districtTerrain.fillStyle(0x3FAE62, 0.22);
            districtTerrain.fillEllipse(detailX + 7, detailY + 3, 14, 6);
        });

        plotOffsets.forEach((offset, index) => {
            const elbowX = offset.x * (compactSettlement ? 0.42 : 0.5);
            const elbowY = offset.y * 0.32 + (index % 2 === 0 ? -12 : 12);
            const pathPoints = Array.from({ length: 17 }, (_, pointIndex) => {
                const t = pointIndex / 16;
                const inverse = 1 - t;
                return {
                    x: (2 * inverse * t * elbowX) + (t * t * offset.x),
                    y: (inverse * inverse * 20) +
                        (2 * inverse * t * elbowY) +
                        (t * t * (offset.y + 18))
                };
            });
            const strokeCurrentPath = (width, color, alpha) => {
                currentPaths.lineStyle(width, color, alpha);
                currentPaths.beginPath();
                currentPaths.moveTo(pathPoints[0].x, pathPoints[0].y);
                pathPoints.slice(1).forEach(point => {
                    currentPaths.lineTo(point.x, point.y);
                });
                currentPaths.strokePath();
            };
            strokeCurrentPath(16, 0x071411, 0.24);
            strokeCurrentPath(5, unlocked ? 0x3FAE62 : 0x53616A, 0.24);
            strokeCurrentPath(2, unlocked ? 0xB7F7DE : 0x657682, 0.42);
        });

        glow.fillStyle(unlocked ? 0x71E6B1 : 0x53616A, unlocked ? 0.14 : 0.08);
        glow.fillEllipse(0, 22, unlocked ? 196 : 160, unlocked ? 120 : 96);
        glow.fillStyle(unlocked ? 0xF4F4F4 : 0x53616A, unlocked ? 0.08 : 0.04);
        glow.fillEllipse(0, 18, unlocked ? 132 : 104, unlocked ? 76 : 62);

        if (heartArtwork) {
            heartArtwork
                .clearTint()
                .setAlpha(unlocked ? 1 : 0.52);
            if (!unlocked) heartArtwork.setTint(0x71807A);
        } else {
            heart.fillStyle(0x0C201D, 0.95);
            heart.fillEllipse(0, 31, 150, 58);
            heart.lineStyle(4, unlocked ? 0x71E6B1 : 0x53616A, 0.9);
            heart.strokeEllipse(0, 24, 128, 48);
            heart.fillStyle(unlocked ? 0xF4F4F4 : 0x657682, 0.95);
            heart.fillTriangle(0, -54, -19, 9, 19, 9);
            heart.fillStyle(unlocked ? 0x71E6B1 : 0x53616A, 0.88);
            heart.fillCircle(0, 13, 11);
        }

        label.setColor(unlocked ? '#F4F4F4' : '#93A2A9');
        actionLabel
            .setText(unlocked ? 'OPEN VILLAGE PLAN' : 'HEART DORMANT')
            .setColor(unlocked ? '#F2C14E' : '#93A2A9');
        statusLabel
            .setText(unlocked
                ? getVillageWorldGuidance(snapshot)
                : 'HATCH A COMPANION TO WAKE IT'
            )
            .setColor(unlocked ? '#8FE3CF' : '#93A2A9');

        landmark.pulseTween = this.scene.tweens.add({
            targets: glow,
            alpha: { from: unlocked ? 0.72 : 0.42, to: 1 },
            scaleX: { from: 0.96, to: 1.05 },
            scaleY: { from: 0.96, to: 1.05 },
            duration: unlocked ? 1450 : 2300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        if (heartArtwork && unlocked) {
            landmark.heartArtworkTween = this.scene.tweens.add({
                targets: heartArtwork,
                y: { from: landmark.zone.y - 24, to: landmark.zone.y - 20 },
                duration: 2100,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }

        const buildingByPlot = new Map(
            snapshot?.buildings?.map(building => [building.plotId, building]) || []
        );
        VILLAGE_PLOTS.forEach((plot, index) => {
            const offset = plotOffsets[index];
            const plotX = landmark.zone.x + offset.x;
            const plotY = landmark.zone.y + offset.y;
            landmark.plotWorldPositions.set(plot.id, { x: plotX, y: plotY });
            const building = buildingByPlot.get(plot.id) || null;
            const container = this.scene.add.container(plotX, plotY).setDepth(plotY + 2);
            const drawing = this.scene.add.graphics();
            const currentSignal = this.scene.add.graphics();
            const worldArtworkDefinition = building
                ? VILLAGE_WORLD_ARTWORK[building.definitionId]
                : null;
            const worldArtwork = worldArtworkDefinition &&
                this.scene.textures.exists(worldArtworkDefinition.key)
                ? this.scene.add.image(0, compactSettlement ? -20 : -28, worldArtworkDefinition.key)
                    .setDisplaySize(
                        (worldArtworkDefinition.displaySize || 176) *
                            (compactSettlement ? 0.76 : 1),
                        (worldArtworkDefinition.displaySize || 176) *
                            (compactSettlement ? 0.76 : 1)
                    )
                : null;
            drawing.fillStyle(0x102B26, building ? 0.7 : 0.36);
            drawing.fillEllipse(0, 29, building ? 136 : 96, building ? 46 : 29);
            drawing.lineStyle(
                building ? 3 : 1,
                building ? 0x71E6B1 : 0xB7F7DE,
                building ? 0.5 : 0.34
            );
            drawing.strokeEllipse(0, 25, building ? 124 : 84, building ? 38 : 24);
            if (building) {
                if (!worldArtwork) {
                    this.drawVillageBuilding(
                        drawing,
                        building.definitionId,
                        building.status
                    );
                } else if (building.status === 'constructing') {
                    worldArtwork.setAlpha(0.58).setTint(0x91A69D);
                    drawing.lineStyle(2, 0xF2C14E, 0.72);
                    drawing.strokeRoundedRect(-70, -76, 140, 124, 8);
                    drawing.lineBetween(-70, -30, 70, -30);
                }
                currentSignal.fillStyle(0x71E6B1, 0.95);
                currentSignal.fillCircle(0, 0, 3);
                currentSignal.lineStyle(1, 0xF4F4F4, 0.85);
                currentSignal.strokeCircle(0, 0, 5);
                currentSignal.setPosition(-42, 20);
                currentSignal.setBlendMode?.(Phaser.BlendModes.ADD);
            } else {
                drawing.fillStyle(0x273C37, 0.72);
                [-24, 0, 24].forEach((stoneX, stoneIndex) => {
                    drawing.fillEllipse(stoneX, 17 + Math.abs(stoneIndex - 1) * 3, 21, 10);
                });
                drawing.lineStyle(2, 0x71E6B1, unlocked ? 0.54 : 0.18);
                drawing.beginPath();
                drawing.arc(0, 11, 26, Math.PI * 1.08, Math.PI * 1.92, false);
                drawing.strokePath();
                drawing.fillStyle(0xB7F7DE, unlocked ? 0.82 : 0.2);
                drawing.fillEllipse(-5, -2, 7, 15);
                drawing.fillEllipse(5, -4, 8, 17);
                drawing.lineStyle(2, 0x3FAE62, unlocked ? 0.7 : 0.18);
                drawing.lineBetween(0, 10, 0, -5);
            }
            const definition = building
                ? VILLAGE_BUILDING_DEFINITIONS.find(entry => entry.id === building.definitionId)
                : null;
            const buildingStateCopy = building
                ? building.status === 'constructing'
                    ? 'GROWING TOGETHER'
                    : building.definitionId === 'habitat' && snapshot?.home?.unlocked
                        ? `${snapshot.home.residents.length}/${snapshot.home.capacity} CALL THIS HOME`
                    : definition?.production && !building.creature
                        ? 'INVITE A HELPER'
                        : building.creature
                            ? `${building.creature.name.toUpperCase()} IS HELPING`
                            : 'OPEN AND ACTIVE'
                : unlocked
                    ? 'BUILD HERE'
                    : 'DORMANT';
            const stateVisibleAtRest = !building ||
                building.status === 'constructing' ||
                building.definitionId === 'habitat' ||
                Boolean(
                    !compactSettlement &&
                    definition?.production &&
                    !building.creature
                );
            const plotLabel = this.scene.add.text(
                0,
                worldArtwork ? 63 : 45,
                definition
                    ? definition.shortLabel
                    : plot.label,
                {
                    fontSize: '11px',
                    fontFamily: 'Arial, sans-serif',
                    color: building ? '#F4F4F4' : '#C9F7E9',
                    fontStyle: 'bold',
                    stroke: '#050505',
                    strokeThickness: 3
                }
            ).setOrigin(0.5);
            const stateLabel = this.scene.add.text(
                0,
                worldArtwork ? -124 : -48,
                buildingStateCopy,
                {
                    fontSize: '8px',
                    fontFamily: 'Arial, sans-serif',
                    color: building?.status === 'complete'
                        ? '#8FE3CF'
                        : building
                            ? '#F2C14E'
                            : '#F2C14E',
                    fontStyle: 'bold',
                    stroke: '#050505',
                    strokeThickness: 3
                }
            ).setOrigin(0.5).setAlpha(stateVisibleAtRest ? 1 : 0);
            const activity = building?.status === 'complete'
                ? this.createVillageBuildingActivity(building)
                : null;
            const worker = building?.status === 'complete' && building.creature
                ? this.createVillageWorker(building, {
                    compact: compactSettlement,
                    index
                })
                : null;
            const habitatLife = building?.status === 'complete' &&
                building.definitionId === 'habitat'
                ? this.createVillageHabitatLife(snapshot?.home, {
                    compact: compactSettlement
                })
                : null;
            container.add([
                drawing,
                ...(worldArtwork ? [worldArtwork] : []),
                ...(building ? [currentSignal] : []),
                ...(activity ? [activity] : []),
                ...(worker ? [worker.container] : []),
                ...(habitatLife ? [habitatLife.container] : []),
                plotLabel,
                stateLabel
            ]);
            landmark.buildingElements.push(container);
            if (worker) {
                landmark.workerElements.push(worker.container);
                landmark.buildingTweens.push(worker.moveTween, worker.breatheTween);
            }
            if (habitatLife) {
                landmark.residentElements.push(habitatLife.container);
                landmark.buildingTweens.push(habitatLife.pulseTween);
            }
            if (building) {
                landmark.buildingTweens.push(this.scene.tweens.add({
                    targets: currentSignal,
                    x: { from: -42, to: 42 },
                    alpha: { from: 0.3, to: 1 },
                    duration: 1800 + index * 140,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                }));
            }
            if (activity) {
                landmark.buildingTweens.push(this.scene.tweens.add({
                    targets: activity,
                    alpha: { from: 0.68, to: 1 },
                    scaleX: { from: 0.94, to: 1.04 },
                    scaleY: { from: 0.94, to: 1.04 },
                    duration: 1200,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                }));
            }

            const pathSignal = this.scene.add.circle(
                landmark.zone.x,
                landmark.zone.y + 20,
                3,
                unlocked ? 0x71E6B1 : 0x657682,
                unlocked ? 0.85 : 0.25
            ).setDepth(Math.min(landmark.zone.y, plotY) - 1);
            pathSignal.setBlendMode?.(Phaser.BlendModes.ADD);
            landmark.buildingElements.push(pathSignal);
            landmark.buildingTweens.push(this.scene.tweens.add({
                targets: pathSignal,
                x: plotX,
                y: plotY + 18,
                alpha: { from: unlocked ? 0.15 : 0.08, to: unlocked ? 1 : 0.2 },
                duration: 2400 + index * 240,
                delay: index * 180,
                repeat: -1,
                ease: 'Sine.easeInOut'
            }));

            const plotHitZone = this.scene.add.zone(
                plotX,
                plotY - 10,
                compactSettlement ? 132 : 168,
                compactSettlement ? 132 : 164
            )
                .setDepth(plotY + 6)
                .setInteractive({ useHandCursor: unlocked });
            plotHitZone.plotId = plot.id;
            plotHitZone.on('pointerover', () => {
                container.setScale(1.06);
                stateLabel
                    .setText(unlocked
                        ? definition
                            ? building?.creature
                                ? `${building.creature.name.toUpperCase()} · ${definition.roleLabel}`
                                : definition.worldEffectLabel
                            : 'CHOOSE WHAT GROWS HERE'
                        : 'DORMANT')
                    .setAlpha(1);
            });
            plotHitZone.on('pointerout', () => {
                container.setScale(1);
                stateLabel
                    .setText(buildingStateCopy)
                    .setAlpha(stateVisibleAtRest ? 1 : 0);
            });
            plotHitZone.on('pointerdown', () => this.activateVillageHeart(landmark, plot.id));
            landmark.plotHitZones.push(plotHitZone);

            if (building?.status === 'constructing') {
                landmark.buildingTweens.push(this.scene.tweens.add({
                    targets: container,
                    alpha: { from: 0.55, to: 1 },
                    duration: 520,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                }));
            }
        });
    }

    playVillageBuildingMoment(landmark, building, { stage = 'complete' } = {}) {
        const position = landmark?.plotWorldPositions?.get(building?.plotId);
        if (!position || !building?.definition) return false;

        landmark.activeBuildingMoment?.destroy?.(true);
        landmark.activeBuildingMomentTween?.stop?.();
        const complete = stage === 'complete';
        const container = this.scene.add.container(position.x, position.y - 18)
            .setDepth(position.y + 30);
        const current = this.scene.add.graphics();
        current.lineStyle(complete ? 5 : 3, complete ? 0x71E6B1 : 0xF2C14E, 0.95);
        current.strokeEllipse(0, 30, 116, 44);
        current.lineStyle(2, 0xF4F4F4, 0.82);
        current.strokeEllipse(0, 30, 82, 30);
        current.setBlendMode?.(Phaser.BlendModes.ADD);
        const signal = this.scene.add.circle(0, -70, complete ? 9 : 7, complete ? 0x71E6B1 : 0xF2C14E, 1)
            .setStrokeStyle(2, 0xF4F4F4, 0.9);
        const title = this.scene.add.text(
            0,
            -104,
            complete
                ? `${building.definition.shortLabel} ONLINE`
                : `${building.definition.shortLabel} PLANTED`,
            {
                fontSize: '12px',
                fontFamily: 'Arial, sans-serif',
                fontStyle: 'bold',
                color: complete ? '#8FE3CF' : '#F2C14E',
                stroke: '#050505',
                strokeThickness: 4
            }
        ).setOrigin(0.5);
        container.add([current, signal, title]);
        landmark.activeBuildingMoment = container;
        landmark.activeBuildingMomentTween = this.scene.tweens.add({
            targets: current,
            scaleX: { from: 0.45, to: 1.55 },
            scaleY: { from: 0.45, to: 1.55 },
            alpha: { from: 1, to: 0 },
            duration: complete ? 1500 : 1100,
            ease: 'Sine.easeOut'
        });
        this.scene.tweens.add({
            targets: [signal, title],
            y: '-=14',
            alpha: { from: 1, to: 0 },
            delay: complete ? 1150 : 850,
            duration: 650,
            ease: 'Sine.easeIn',
            onComplete: () => {
                container.destroy(true);
                if (landmark.activeBuildingMoment === container) {
                    landmark.activeBuildingMoment = null;
                    landmark.activeBuildingMomentTween = null;
                }
            }
        });
        return true;
    }

    createVillageBuildingActivity(building) {
        const activity = this.scene.add.container(0, 0);
        const routine = this.scene.add.graphics();

        if (building.definitionId === 'forager_hut') {
            routine.fillStyle(0x6E4D2E, 0.96);
            routine.fillRoundedRect(43, 22, 29, 18, 5);
            routine.lineStyle(2, 0xF2C14E, 0.92);
            routine.beginPath();
            routine.arc(57, 23, 12, Math.PI, 0, false);
            routine.strokePath();
            [48, 57, 66].forEach((podX, index) => {
                routine.fillStyle(index === 1 ? 0xF4F4F4 : 0xF2C14E, 0.98);
                routine.fillCircle(podX, 20 - (index % 2) * 4, 5);
            });
        } else if (building.definitionId === 'sawmill') {
            routine.fillStyle(0x6E4D2E, 0.98);
            routine.fillRoundedRect(39, 20, 36, 12, 5);
            routine.lineStyle(2, 0xF2C14E, 0.92);
            routine.strokeCircle(57, 26, 18);
            routine.lineStyle(2, 0xF4F4F4, 0.82);
            routine.lineBetween(45, 26, 69, 26);
        } else if (building.definitionId === 'current_masonry') {
            routine.fillStyle(0x71E6B1, 0.32);
            routine.fillTriangle(57, 6, 37, 25, 43, 45);
            routine.fillTriangle(57, 6, 77, 25, 71, 45);
            routine.lineStyle(2, 0xF4F4F4, 0.92);
            routine.strokeCircle(57, 27, 20);
            [40, 57, 74].forEach((stoneX, index) => {
                routine.fillStyle(0xB7C8C4, 0.95);
                routine.fillCircle(stoneX, 19 + index * 5, 4);
            });
        } else if (building.definitionId === 'habitat') {
            [[-56, 24, 0x8FE3CF], [54, 27, 0xF2C14E], [0, 34, 0xF4F4F4]]
                .forEach(([residentX, residentY, color], index) => {
                    routine.fillStyle(color, 0.95);
                    routine.fillCircle(residentX, residentY - 9, 6 - index);
                    routine.fillEllipse(residentX, residentY + 2, 13, 15);
                });
            routine.lineStyle(2, 0x71E6B1, 0.82);
            routine.strokeCircle(0, 30, 19);
        } else if (building.definitionId === 'workshop') {
            routine.lineStyle(4, 0xF4F4F4, 0.92);
            routine.lineBetween(38, 36, 75, 20);
            routine.lineStyle(3, 0xD94B4B, 0.9);
            routine.lineBetween(35, 39, 43, 31);
            routine.fillStyle(0x71E6B1, 0.92);
            routine.fillTriangle(57, 5, 49, 18, 65, 18);
            routine.fillTriangle(57, 31, 49, 18, 65, 18);
        }

        activity.add(routine);
        activity.setData('helperName', building?.creature?.name || 'Companion');
        activity.setData('routine', building.definitionId);
        return activity;
    }

    createVillageHabitatLife(home, { compact = false } = {}) {
        const container = this.scene.add.container(0, compact ? 25 : 31);
        const residents = Array.isArray(home?.residents) ? home.residents : [];
        const capacity = Math.max(0, Number(home?.capacity) || 0);
        const slots = Array.from({ length: capacity }, (_, index) => {
            const resident = residents[index] || null;
            const x = (index - ((capacity - 1) / 2)) * 24;
            const signal = this.scene.add.circle(
                x,
                0,
                9,
                resident ? (resident.atWork ? 0xF2C14E : 0x71E6B1) : 0x657682,
                resident ? 0.98 : 0.34
            ).setStrokeStyle(2, 0x07100F, 0.9);
            const initial = this.scene.add.text(
                x,
                0,
                resident ? resident.name.slice(0, 1).toUpperCase() : '·',
                {
                    fontSize: '8px',
                    fontFamily: 'Arial, sans-serif',
                    fontStyle: 'bold',
                    color: resident ? '#07100F' : '#F4F4F4'
                }
            ).setOrigin(0.5);
            return [signal, initial];
        }).flat();
        const status = this.scene.add.text(
            0,
            19,
            residents.length > 0
                ? `${home.presentCount} HOME · ${home.helpingCount} HELPING`
                : 'ROOM FOR RESCUED FRIENDS',
            {
                fontSize: compact ? '7px' : '8px',
                fontFamily: 'Arial, sans-serif',
                fontStyle: 'bold',
                color: '#C9F7E9',
                stroke: '#07100F',
                strokeThickness: 3
            }
        ).setOrigin(0.5);
        container.add([...slots, status]);
        container.setData('villageHabitatLife', true);
        container.setData('residentNames', residents.map(resident => resident.name));
        container.setData('presentCount', home?.presentCount || 0);
        container.setData('helpingCount', home?.helpingCount || 0);
        const pulseTween = this.scene.tweens.add({
            targets: container,
            alpha: { from: 0.72, to: 1 },
            scaleX: { from: 0.96, to: 1.04 },
            scaleY: { from: 0.96, to: 1.04 },
            duration: 1450,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        return { container, pulseTween };
    }

    createVillageWorker(building, { compact = false, index = 0 } = {}) {
        const worker = this.scene.add.container(-48, compact ? 28 : 34);
        const accentByAffinity = {
            star: 0xF2C14E,
            crystal: 0x8FE3CF,
            nebula: 0x71E6B1
        };
        const affinity = String(
            building.creature?.cosmicAffinity?.element ||
            building.creature?.cosmicAffinity ||
            building.creature?.genes?.cosmicAffinity?.element ||
            'nebula'
        ).toLowerCase();
        const accent = accentByAffinity[affinity] || 0x71E6B1;
        const scale = compact ? 0.78 : 1;
        const shadow = this.scene.add.ellipse(0, 16, 29, 8, 0x07100F, 0.58);
        const figure = this.scene.add.graphics();
        figure.fillStyle(accent, 0.98);
        figure.fillCircle(0, -4, 8);
        figure.fillEllipse(0, 8, 16, 20);
        figure.fillStyle(0xF4F4F4, 0.98);
        figure.fillCircle(-3, -5, 2);
        figure.fillCircle(3, -5, 2);
        figure.lineStyle(2, 0x101616, 0.9);
        figure.lineBetween(-6, -11, -10, -18);
        figure.lineBetween(6, -11, 10, -18);
        const initial = this.scene.add.text(
            0,
            7,
            String(building.creature.name || 'C').slice(0, 1).toUpperCase(),
            {
                fontSize: '7px',
                fontFamily: 'Arial, sans-serif',
                fontStyle: 'bold',
                color: '#07100F'
            }
        ).setOrigin(0.5);
        const cargo = this.createVillageWorkerCargo(
            building.definition.workerRoutine?.carriedResource
        );
        cargo.setPosition(13, 5);
        worker.add([shadow, figure, initial, cargo]);
        worker.setScale(scale);
        worker.setData('villageWorker', true);
        worker.setData('helperName', building.creature.name);
        worker.setData('buildingId', building.definitionId);
        worker.setData('routineCue', building.definition.workerRoutine?.cue || 'HELPING');

        const moveTween = this.scene.tweens.add({
            targets: worker,
            x: { from: -48, to: 46 },
            y: { from: compact ? 28 : 34, to: compact ? 20 : 25 },
            duration: 3300 + (index * 370),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        const breatheTween = this.scene.tweens.add({
            targets: figure,
            scaleY: { from: 0.96, to: 1.04 },
            duration: 760 + (index * 90),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        return { container: worker, moveTween, breatheTween };
    }

    createVillageWorkerCargo(resource) {
        const cargo = this.scene.add.graphics();
        if (resource === 'food') {
            cargo.fillStyle(0xF2C14E, 1);
            cargo.fillCircle(0, 0, 5);
            cargo.lineStyle(2, 0x3FAE62, 1);
            cargo.lineBetween(0, -4, 4, -9);
        } else if (resource === 'wood') {
            cargo.fillStyle(0x6E4D2E, 1);
            cargo.fillRoundedRect(-7, -3, 14, 7, 3);
            cargo.lineStyle(1, 0xF2C14E, 0.9);
            cargo.lineBetween(-3, -2, -3, 3);
            cargo.lineBetween(3, -2, 3, 3);
        } else if (resource === 'stone') {
            cargo.fillStyle(0xB7C8C4, 1);
            cargo.fillTriangle(0, -7, -7, 5, 7, 5);
        } else {
            cargo.fillStyle(0x71E6B1, 1);
            cargo.fillTriangle(0, -8, -6, 1, 0, 8);
            cargo.fillTriangle(0, -8, 6, 1, 0, 8);
        }
        return cargo;
    }

    playVillageProductionMoment(landmark, snapshot, gains = []) {
        if (!landmark?.zone || !Array.isArray(gains) || gains.length === 0) {
            return false;
        }
        const resourceColors = {
            food: 0xF2C14E,
            wood: 0x8FE3CF,
            stone: 0xF4F4F4
        };
        landmark.productionMoments ||= [];
        landmark.productionTweens ||= [];
        gains.forEach((gain, index) => {
            const source = snapshot?.buildings?.find(building => (
                building.status === 'complete' &&
                building.creature &&
                building.definition.production?.resource === gain.id
            ));
            const position = landmark.plotWorldPositions?.get(source?.plotId);
            if (!position) return;
            const color = resourceColors[gain.id] || 0x71E6B1;
            const moment = this.scene.add.container(position.x, position.y - 42)
                .setDepth(position.y + 40);
            const token = this.scene.add.circle(0, 0, 9, color, 0.98)
                .setStrokeStyle(2, 0x07100F, 0.9);
            const label = this.scene.add.text(0, -19, `+${gain.amount} ${gain.label}`, {
                fontSize: '10px',
                fontFamily: 'Arial, sans-serif',
                fontStyle: 'bold',
                color: '#F4F4F4',
                stroke: '#07100F',
                strokeThickness: 4
            }).setOrigin(0.5);
            moment.add([token, label]);
            landmark.productionMoments.push(moment);
            const tween = this.scene.tweens.add({
                targets: moment,
                x: landmark.zone.x + ((index - (gains.length - 1) / 2) * 18),
                y: landmark.zone.y - 38,
                scaleX: { from: 1, to: 0.62 },
                scaleY: { from: 1, to: 0.62 },
                alpha: { from: 1, to: 0.16 },
                delay: index * 160,
                duration: 1250,
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    moment.destroy(true);
                    landmark.productionMoments = landmark.productionMoments.filter(
                        entry => entry !== moment
                    );
                    landmark.productionTweens = landmark.productionTweens.filter(
                        entry => entry !== tween
                    );
                }
            });
            landmark.productionTweens.push(tween);
        });
        return landmark.productionMoments.length > 0;
    }

    playVillageCommunityMoment(landmark, moment) {
        if (!landmark?.zone || !moment?.participants?.length) return false;
        const positions = moment.participants
            .map(participant => landmark.plotWorldPositions?.get(participant.plotId))
            .filter(Boolean);
        if (positions.length < 2) return false;

        this.clearVillageCommunityMoment(landmark);
        const compact = this.scene.scale.width <= 600;
        const heartPosition = { x: landmark.zone.x, y: landmark.zone.y - 18 };
        const anchorPosition = landmark.plotWorldPositions?.get(moment.anchorPlotId);
        const meetingPosition = moment.id === 'return_home' && anchorPosition
            ? { x: anchorPosition.x, y: anchorPosition.y - 18 }
            : heartPosition;
        const path = this.scene.add.graphics()
            .setDepth(Math.min(...positions.map(position => position.y), landmark.zone.y) - 2);
        path.lineStyle(3, 0x71E6B1, 0.62);
        path.beginPath();
        path.moveTo(positions[0].x, positions[0].y);
        path.lineTo(meetingPosition.x, meetingPosition.y);
        path.lineTo(positions[1].x, positions[1].y);
        path.strokePath();
        path.setBlendMode?.(Phaser.BlendModes.ADD);

        const signal = this.scene.add.circle(
            positions[0].x,
            positions[0].y,
            compact ? 6 : 7,
            0xF2C14E,
            1
        ).setDepth(landmark.zone.y + 12);
        signal.setBlendMode?.(Phaser.BlendModes.ADD);

        const copy = this.scene.add.container(
            meetingPosition.x,
            meetingPosition.y - (compact ? 106 : 122)
        ).setDepth(landmark.zone.y + 14).setAlpha(0);
        const names = this.scene.add.text(
            0,
            -21,
            moment.participantNames.join(' + ').toUpperCase(),
            {
                fontSize: compact ? '9px' : '10px',
                fontFamily: 'Arial, sans-serif',
                fontStyle: 'bold',
                color: '#F2C14E',
                stroke: '#07100F',
                strokeThickness: 5
            }
        ).setOrigin(0.5);
        const title = this.scene.add.text(0, -4, moment.title, {
            fontSize: compact ? '11px' : '13px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#F4F4F4',
            stroke: '#07100F',
            strokeThickness: 5
        }).setOrigin(0.5);
        const value = this.scene.add.text(0, 15, moment.sharedValue, {
            fontSize: compact ? '8px' : '9px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#8FE3CF',
            stroke: '#07100F',
            strokeThickness: 4
        }).setOrigin(0.5);
        copy.add([names, title, value]);
        copy.setData('villageCommunityMoment', moment.id);
        copy.setData('participantNames', moment.participantNames);
        copy.setData('sharedValue', moment.sharedValue);

        const signalTween = this.scene.tweens.add({
            targets: signal,
            x: positions[1].x,
            y: positions[1].y,
            duration: 4200,
            ease: 'Sine.easeInOut'
        });
        const copyTween = this.scene.tweens.add({
            targets: copy,
            alpha: { from: 0, to: 1 },
            y: copy.y + 6,
            duration: 380,
            ease: 'Sine.easeOut'
        });
        landmark.communityMomentElements = [path, signal, copy];
        landmark.communityMomentTweens = [signalTween, copyTween];
        landmark.activeCommunityMoment = copy;
        landmark.communityMomentTimer = this.scene.time.delayedCall(4700, () => {
            if (landmark.activeCommunityMoment !== copy) return;
            const fadeTween = this.scene.tweens.add({
                targets: [path, signal, copy],
                alpha: 0,
                duration: 420,
                onComplete: () => this.clearVillageCommunityMoment(landmark)
            });
            landmark.communityMomentTweens.push(fadeTween);
        });
        return true;
    }

    clearVillageCommunityMoment(landmark) {
        landmark?.communityMomentTimer?.remove?.();
        landmark?.communityMomentTweens?.forEach(tween => tween?.stop?.());
        landmark?.communityMomentElements?.forEach(element => element?.destroy?.(true));
        if (!landmark) return;
        landmark.communityMomentTimer = null;
        landmark.communityMomentTweens = [];
        landmark.communityMomentElements = [];
        landmark.activeCommunityMoment = null;
    }

    activateVillageHeart(landmark, plotId = null) {
        const snapshot = landmark?.snapshot;
        if (!snapshot?.unlock?.unlocked) {
            this.scene.showInteractionHint?.(
                snapshot?.unlock?.reason || 'Hatch a companion to wake the Village Heart'
            );
            if (typeof window !== 'undefined') {
                window.AudioManager?.playError?.();
            }
            return false;
        }

        this.scene.nearVillageHeart = true;
        const place = VILLAGE_PLOTS.find(plot => plot.id === plotId);
        this.scene.showInteractionHint?.(
            place ? `Planning ${place.label}` : 'Opening Village Plan'
        );
        return this.scene.openVillageCommand?.({ plotId }) === true;
    }

    drawVillageBuilding(graphics, definitionId, status) {
        const alpha = status === 'constructing' ? 0.58 : 1;
        graphics.fillStyle(0x101616, alpha);
        graphics.lineStyle(2, 0xF4F4F4, alpha * 0.9);

        if (definitionId === 'forager_hut') {
            graphics.fillRoundedRect(-28, -16, 56, 43, 5);
            graphics.strokeRoundedRect(-28, -16, 56, 43, 5);
            graphics.fillStyle(0x3FAE62, alpha);
            graphics.fillTriangle(-36, -15, 0, -43, 36, -15);
            graphics.fillStyle(0xF2C14E, alpha);
            graphics.fillCircle(0, 6, 5);
        } else if (definitionId === 'sawmill') {
            graphics.fillRoundedRect(-34, -19, 68, 46, 4);
            graphics.strokeRoundedRect(-34, -19, 68, 46, 4);
            graphics.lineStyle(4, 0xD94B4B, alpha);
            graphics.strokeCircle(23, 10, 13);
            graphics.lineBetween(23, -3, 23, 23);
            graphics.lineBetween(10, 10, 36, 10);
        } else if (definitionId === 'current_masonry') {
            graphics.fillStyle(0x101616, alpha);
            graphics.fillRoundedRect(-34, 4, 68, 23, 4);
            graphics.lineStyle(2, 0xF4F4F4, alpha);
            graphics.strokeRoundedRect(-34, 4, 68, 23, 4);
            graphics.fillStyle(0x71E6B1, alpha);
            graphics.fillTriangle(-26, 4, -10, -34, 4, 4);
            graphics.fillStyle(0xF4F4F4, alpha);
            graphics.fillTriangle(-4, 4, 10, -26, 24, 4);
        } else if (definitionId === 'habitat') {
            graphics.fillStyle(0x101616, alpha);
            graphics.fillRoundedRect(-38, -6, 76, 34, 5);
            graphics.lineStyle(3, 0xF4F4F4, alpha);
            graphics.strokeRoundedRect(-38, -6, 76, 34, 5);
            graphics.lineStyle(5, 0x3FAE62, alpha);
            graphics.beginPath();
            graphics.arc(0, -5, 33, Math.PI, 0, false);
            graphics.strokePath();
            graphics.fillStyle(0xD94B4B, alpha);
            graphics.fillCircle(0, 9, 5);
        } else {
            graphics.fillRoundedRect(-36, -21, 72, 48, 4);
            graphics.strokeRoundedRect(-36, -21, 72, 48, 4);
            graphics.lineStyle(4, 0x3FAE62, alpha);
            graphics.lineBetween(-20, -4, 20, -4);
            graphics.lineBetween(0, -35, 0, -21);
            graphics.fillStyle(0xD94B4B, alpha);
            graphics.fillCircle(0, -36, 5);
            graphics.fillStyle(0xF2C14E, alpha);
            graphics.fillCircle(-18, 12, 4);
            graphics.fillCircle(0, 12, 4);
            graphics.fillCircle(18, 12, 4);
        }

        if (status === 'constructing') {
            graphics.lineStyle(2, 0xF2C14E, 0.9);
            graphics.lineBetween(-43, -42, -43, 30);
            graphics.lineBetween(43, -42, 43, 30);
            graphics.lineBetween(-43, -35, 43, -35);
        }
    }

    createFusionPodLandmark(landmarkData, snapshotOverride = null) {
        const x = landmarkData.position.x;
        const y = landmarkData.position.y;
        const zone = this.scene.add.zone(
            x,
            y,
            landmarkData.size.width,
            landmarkData.size.height
        );
        this.scene.physics.add.existing(zone, true);
        zone.setDepth(y);
        zone.landmarkId = 'fusionPod';
        zone.landmarkData = landmarkData;

        const group = this.scene.add.container(x, y).setDepth(y + 2);
        const foundation = this.scene.add.graphics();
        foundation.fillStyle(0x050505, 0.96);
        foundation.fillEllipse(0, 42, 134, 38);
        foundation.lineStyle(3, 0xF4F4F4, 0.85);
        foundation.strokeEllipse(0, 37, 112, 30);
        foundation.fillStyle(0x101616, 1);
        foundation.fillRoundedRect(-48, -31, 96, 70, 16);
        foundation.lineStyle(3, 0xF4F4F4, 0.9);
        foundation.strokeRoundedRect(-48, -31, 96, 70, 16);

        const current = this.scene.add.graphics();
        current.lineStyle(5, 0x3FAE62, 1);
        current.strokeCircle(0, -1, 27);
        current.lineStyle(3, 0xC73A3A, 0.95);
        current.beginPath();
        current.moveTo(-38, 26);
        current.lineTo(-18, 8);
        current.strokePath();
        current.beginPath();
        current.moveTo(38, 26);
        current.lineTo(18, 8);
        current.strokePath();
        current.fillStyle(0xF4F4F4, 1);
        current.fillCircle(-11, -3, 6);
        current.fillCircle(11, -3, 6);

        const glow = this.scene.add.graphics();
        group.add([glow, foundation, current]);

        const label = this.scene.add.text(
            x,
            y + 72,
            'FUSION POD',
            {
                fontSize: '13px',
                fontFamily: 'Arial, sans-serif',
                color: '#F4F4F4',
                fontStyle: 'bold',
                stroke: '#050505',
                strokeThickness: 4
            }
        ).setOrigin(0.5).setDepth(y + 4);
        const statusLabel = this.scene.add.text(
            x,
            y + 91,
            '',
            {
                fontSize: '9px',
                fontFamily: 'Arial, sans-serif',
                color: '#AFC3CF',
                fontStyle: 'bold',
                stroke: '#050505',
                strokeThickness: 3
            }
        ).setOrigin(0.5).setDepth(y + 4);

        const landmark = {
            zone,
            group,
            glow,
            label,
            statusLabel,
            pulseTween: null,
            snapshot: null
        };
        this.refreshFusionPodLandmark(
            landmark,
            snapshotOverride
        );
        return landmark;
    }

    refreshFusionPodLandmark(landmark, snapshotOverride = null) {
        if (!landmark?.glow) return landmark;
        const sharedAvailable = typeof window !== 'undefined'
            ? window.SharedFusionInvitation
                ?.getSharedFusionAvailability?.(
                    window.CloudSave
                )?.available === true
            : false;
        const snapshot = snapshotOverride ||
            getFusionPodLandmarkSnapshot(
                typeof window !== 'undefined' ? window.GameState : null,
                { sharedAvailable }
            );
        const tones = {
            dormant: { color: 0x657682, alpha: 0.12 },
            calibrating: { color: 0xF2C14E, alpha: 0.16 },
            warning: { color: 0xC73A3A, alpha: 0.17 },
            ready: { color: 0x71E6B1, alpha: 0.22 }
        };
        const tone = tones[snapshot.tone] || tones.dormant;

        landmark.pulseTween?.stop?.();
        landmark.glow.clear();
        landmark.glow.fillStyle(tone.color, tone.alpha);
        landmark.glow.fillCircle(0, -1, 61);
        landmark.glow.lineStyle(3, tone.color, 0.72);
        landmark.glow.strokeCircle(0, -1, 51);
        landmark.statusLabel
            ?.setText(snapshot.statusLabel)
            .setColor(`#${tone.color.toString(16).padStart(6, '0')}`);
        landmark.pulseTween = this.scene.tweens.add({
            targets: landmark.glow,
            alpha: {
                from: snapshot.tone === 'dormant' ? 0.5 : 0.7,
                to: 1
            },
            scaleX: { from: 0.96, to: 1.05 },
            scaleY: { from: 0.96, to: 1.05 },
            duration: snapshot.tone === 'ready' ? 1150 : 1777,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        landmark.snapshot = snapshot;
        return landmark;
    }

    createKinshipBeacon(stateOverride = null) {
        const storedState = typeof window !== 'undefined'
            ? window.GameState?.get?.(
                'world.sanctuaryDecorations.kinshipBeacon'
            )
            : null;
        const state = stateOverride || storedState || {};
        if (!state.unlocked) {
            return {
                unlocked: false,
                lineageCount: 0,
                group: null,
                pulseTween: null
            };
        }

        const lineageCount = Math.max(1, Math.floor(Number(state.lineageCount) || 1));
        const sharedLineageCount = Math.max(
            0,
            Math.floor(Number(state.sharedLineageCount) || 0)
        );
        const x = 520;
        const y = 1015;
        const group = this.scene.add.container(x, y).setDepth(y);

        const foundation = this.scene.add.graphics();
        foundation.fillStyle(0x101616, 0.98);
        foundation.fillEllipse(0, 28, 112, 34);
        foundation.fillStyle(0xF4F4F4, 0.9);
        foundation.fillRoundedRect(-37, 11, 74, 20, 6);
        foundation.lineStyle(3, 0x101616, 1);
        foundation.strokeRoundedRect(-37, 11, 74, 20, 6);

        const current = this.scene.add.graphics();
        current.lineStyle(5, 0x3FAE62, 1);
        current.beginPath();
        current.moveTo(0, 14);
        current.lineTo(0, -45);
        current.strokePath();
        current.lineStyle(3, 0xF4F4F4, 0.92);
        current.strokeCircle(0, -55, 30);
        current.lineStyle(4, 0xC73A3A, 0.95);
        current.beginPath();
        current.moveTo(-18, -42);
        current.lineTo(0, -62);
        current.lineTo(18, -42);
        current.strokePath();

        const glow = this.scene.add.graphics();
        glow.fillStyle(0x71E6B1, 0.13);
        glow.fillCircle(0, -54, 48);
        glow.lineStyle(2, 0xF4F4F4, 0.42);
        glow.strokeCircle(0, -54, 42);

        const nodes = this.scene.add.graphics();
        if (sharedLineageCount > 0) {
            nodes.lineStyle(3, 0xF4F4F4, 0.9);
            nodes.beginPath();
            nodes.moveTo(-18, -42);
            nodes.lineTo(18, -42);
            nodes.strokePath();
            nodes.lineStyle(2, 0x71E6B1, 0.62);
            nodes.strokeCircle(-18, -42, 12);
            nodes.lineStyle(2, 0xC73A3A, 0.7);
            nodes.strokeCircle(18, -42, 12);
            nodes.fillStyle(0x3FAE62, 1);
            nodes.fillCircle(-18, -42, 6);
            nodes.fillStyle(0xC73A3A, 1);
            nodes.fillCircle(18, -42, 6);
        } else {
            nodes.fillStyle(0xF4F4F4, 1);
            nodes.fillCircle(-18, -42, 6);
            nodes.fillCircle(18, -42, 6);
        }
        nodes.fillStyle(0x3FAE62, 1);
        nodes.fillCircle(0, -62, 7);

        group.add([glow, foundation, current, nodes]);
        const pulseTween = this.scene.tweens.add({
            targets: glow,
            alpha: { from: 0.55, to: 1 },
            scaleX: { from: 0.94, to: 1.08 },
            scaleY: { from: 0.94, to: 1.08 },
            duration: 1777,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        const label = this.scene.add.text(
            x,
            y + 62,
            sharedLineageCount > 0
                ? 'KINSHIP BEACON // LINKED SANCTUARIES'
                : lineageCount === 1
                    ? 'KINSHIP BEACON // FIRST LINEAGE'
                    : `KINSHIP BEACON // ${lineageCount} LINEAGES`,
            {
                fontSize: sharedLineageCount > 0 ? '12px' : '13px',
                fontFamily: 'Arial, sans-serif',
                color: '#F4F4F4',
                fontStyle: 'bold',
                stroke: '#101616',
                strokeThickness: 4
            }
        ).setOrigin(0.5).setDepth(y + 63);
        const statusLabel = sharedLineageCount > 0
            ? this.scene.add.text(
                x,
                y + 81,
                `${sharedLineageCount} SHARED ${sharedLineageCount === 1 ? 'LINEAGE' : 'LINEAGES'} // PEER IDENTITY PROTECTED`,
                {
                    fontSize: '9px',
                    fontFamily: 'Arial, sans-serif',
                    color: '#71E6B1',
                    fontStyle: 'bold',
                    stroke: '#101616',
                    strokeThickness: 3
                }
            ).setOrigin(0.5).setDepth(y + 64)
            : null;

        return {
            unlocked: true,
            lineageCount,
            sharedLineageCount,
            group,
            label,
            statusLabel,
            pulseTween
        };
    }

    refreshKinshipBeacon(beacon, stateOverride = null) {
        beacon?.pulseTween?.stop?.();
        beacon?.group?.destroy?.(true);
        beacon?.label?.destroy?.();
        beacon?.statusLabel?.destroy?.();
        return this.createKinshipBeacon(stateOverride);
    }

    createSanctuaryKeepsakes(countOverride = null) {
        const storedCount = typeof window !== 'undefined'
            ? Number(window.GameState?.get?.('world.sanctuaryDecorations.voidCrystals'))
            : 0;
        const requestedCount = countOverride === null ? storedCount : Number(countOverride);
        const count = Number.isFinite(requestedCount)
            ? Math.max(0, Math.min(3, Math.floor(requestedCount)))
            : 0;
        const positions = [
            { x: 1005, y: 1015, scale: 0.9 },
            { x: 1195, y: 1035, scale: 1.05 },
            { x: 1090, y: 1100, scale: 0.82 }
        ];
        const elements = [];

        positions.slice(0, count).forEach((position, index) => {
            const group = this.scene.add.container(position.x, position.y);
            group.setDepth(position.y);
            group.setScale(position.scale);

            const glow = this.scene.add.graphics();
            glow.fillStyle(0x8CEBFF, 0.12);
            glow.fillCircle(0, -30, 42);
            glow.lineStyle(2, 0xBFA6FF, 0.4);
            glow.strokeCircle(0, -30, 32);

            const pedestal = this.scene.add.graphics();
            pedestal.fillStyle(0x172B35, 0.98);
            pedestal.fillEllipse(0, 8, 62, 24);
            pedestal.fillStyle(0x355162, 1);
            pedestal.fillRoundedRect(-22, -2, 44, 15, 5);
            pedestal.lineStyle(2, 0x78B8C7, 0.72);
            pedestal.strokeEllipse(0, 4, 54, 20);

            const crystal = this.scene.add.graphics();
            crystal.fillStyle(index === 1 ? 0xBFA6FF : 0x72E6E1, 1);
            crystal.lineStyle(3, 0xE8FFFF, 0.9);
            crystal.beginPath();
            crystal.moveTo(0, -67);
            crystal.lineTo(19, -35);
            crystal.lineTo(11, -7);
            crystal.lineTo(-12, -7);
            crystal.lineTo(-20, -36);
            crystal.closePath();
            crystal.fillPath();
            crystal.strokePath();
            crystal.lineStyle(2, 0xFFFFFF, 0.65);
            crystal.beginPath();
            crystal.moveTo(0, -62);
            crystal.lineTo(2, -13);
            crystal.strokePath();

            group.add([glow, pedestal, crystal]);
            const pulseTween = this.scene.tweens.add({
                targets: glow,
                alpha: { from: 0.55, to: 1 },
                scaleX: { from: 0.92, to: 1.08 },
                scaleY: { from: 0.92, to: 1.08 },
                duration: 1500 + (index * 180),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            elements.push({ group, glow, pedestal, crystal, pulseTween });
        });

        let label = null;
        if (count > 0) {
            label = this.scene.add.text(1100, 1145, 'A QUIET CORNER', {
                fontSize: '13px',
                fontFamily: 'Arial, sans-serif',
                color: '#D8FFF0',
                fontStyle: 'bold',
                stroke: '#081514',
                strokeThickness: 4
            }).setOrigin(0.5).setDepth(1146);
        }

        return { count, elements, label };
    }

    refreshSanctuaryKeepsakes(keepsakes, countOverride = null) {
        keepsakes?.elements?.forEach(({ group, pulseTween }) => {
            pulseTween?.stop?.();
            group?.destroy?.(true);
        });
        keepsakes?.label?.destroy?.();
        return this.createSanctuaryKeepsakes(countOverride);
    }

    /**
     * Create the Signal Garden and its stage-specific living growth.
     */
    createSignalGarden(landmarkData, stageOverride = null) {
        const centerX = landmarkData.position.x;
        const centerY = landmarkData.position.y;
        const zone = this.scene.add.zone(centerX, centerY, 180, 140);
        this.scene.physics.add.existing(zone, true);
        zone.setDepth(centerY);
        zone.landmarkId = 'signalGarden';
        zone.landmarkData = landmarkData;

        const bed = this.scene.add.graphics().setPosition(centerX, centerY);
        bed.setDepth(centerY - 2);
        bed.fillStyle(0x142D2A, 0.95);
        bed.fillRoundedRect(-86, -38, 172, 76, 22);
        bed.lineStyle(3, 0x71E6B1, 0.65);
        bed.strokeRoundedRect(-86, -38, 172, 76, 22);
        bed.fillStyle(0x243D38, 1);
        bed.fillEllipse(0, 5, 142, 52);
        bed.lineStyle(2, 0xF2C86B, 0.5);
        bed.strokeEllipse(0, 5, 142, 52);

        const growth = this.scene.add.graphics().setPosition(centerX, centerY);
        growth.setDepth(centerY + 1);

        const community = this.scene.add.graphics().setPosition(centerX, centerY);
        community.setDepth(centerY);

        const label = this.scene.add.text(centerX, centerY - 102, 'SIGNAL GARDEN', {
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
            color: '#D8FFF0',
            fontStyle: 'bold',
            stroke: '#081514',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(centerY + 2);

        const storedStage = typeof window !== 'undefined'
            ? window.GameState?.get?.('world.signalGarden.stage')
            : null;
        const garden = {
            zone,
            bed,
            growth,
            community,
            label,
            pulseTween: null,
            communityPulseTween: null,
            cultureElements: [],
            culturePulseTween: null,
            currentVeilAnchors: [],
            currentVeilNetwork: null,
            residents: [],
            guardianResidents: [],
            rescuedResidents: [],
            stage: 'seed'
        };

        this.refreshSignalGarden(garden, stageOverride || storedStage || 'seed');
        const communityStage = typeof window !== 'undefined'
            ? window.FendCommunity?.getFendCommunitySnapshot?.(window.GameState)?.stage
            : 0;
        this.refreshFendCommunity(garden, communityStage || 0);
        const residentSnapshot = typeof window !== 'undefined'
            ? window.FendResidents?.getFendResidentsSnapshot?.(window.GameState)
            : null;
        this.refreshFendResidents(garden, residentSnapshot);
        const guardianSnapshot = typeof window !== 'undefined'
            ? window.GuardianResidents?.getGuardianResidentsSnapshot?.(
                window.GameState
            )
            : null;
        this.refreshGuardianResidents(garden, guardianSnapshot);
        const rescuedResidentSnapshot = typeof window !== 'undefined'
            ? window.RescuedResidents?.getRescuedResidentSnapshot?.(
                window.GameState
            )
            : null;
        this.refreshRescuedResidents(garden, rescuedResidentSnapshot);
        const cultureSnapshot = typeof window !== 'undefined'
            ? window.FendCulture?.getFendCultureSnapshot?.(window.GameState)
            : null;
        this.refreshFendCulture(garden, cultureSnapshot);
        const currentVeilSnapshot = typeof window !== 'undefined'
            ? window.CurrentVeilMission?.getCurrentVeilSnapshot?.(
                window.GameState
            )
            : null;
        this.refreshCurrentVeilMission(garden, currentVeilSnapshot);
        this.signalGarden = garden;
        return garden;
    }

    refreshSignalGarden(garden, requestedStage = 'seed') {
        if (!garden?.growth) return;

        const stages = ['seed', 'sprout', 'bud', 'bloom'];
        const stage = stages.includes(requestedStage) ? requestedStage : 'seed';
        const growth = garden.growth;
        garden.pulseTween?.stop();
        growth.clear();

        growth.lineStyle(2, 0x71E6B1, 0.32);
        growth.strokeEllipse(0, 4, stage === 'bloom' ? 118 : 82, stage === 'bloom' ? 54 : 36);

        if (stage === 'seed') {
            growth.fillStyle(0xF2C86B, 1);
            growth.fillCircle(0, 5, 6);
            growth.lineStyle(2, 0xF2C86B, 0.45);
            growth.strokeCircle(0, 5, 15);
        } else {
            const stemHeight = stage === 'sprout' ? 25 : stage === 'bud' ? 42 : 54;
            growth.lineStyle(5, 0x71E6B1, 1);
            growth.beginPath();
            growth.moveTo(0, 8);
            growth.lineTo(0, 8 - stemHeight);
            growth.strokePath();

            growth.fillStyle(0x56C992, 1);
            growth.fillEllipse(-10, -7, 19, 9);
            growth.fillEllipse(10, -17, 19, 9);

            if (stage === 'sprout') {
                growth.fillStyle(0xD8FFF0, 1);
                growth.fillCircle(0, -18, 4);
            } else if (stage === 'bud') {
                growth.fillStyle(0xBFA6FF, 1);
                growth.fillEllipse(0, -36, 15, 19);
                growth.lineStyle(2, 0xF2C86B, 0.55);
                growth.strokeCircle(0, -36, 18);
            } else {
                growth.fillStyle(0xBFA6FF, 1);
                growth.fillCircle(-10, -47, 10);
                growth.fillCircle(10, -47, 10);
                growth.fillStyle(0x71E6B1, 1);
                growth.fillCircle(0, -57, 11);
                growth.fillCircle(0, -38, 11);
                growth.fillStyle(0xF2C86B, 1);
                growth.fillCircle(0, -47, 8);
                growth.lineStyle(2, 0xD8FFF0, 0.55);
                growth.strokeCircle(0, -47, 28);
            }
        }

        garden.stage = stage;
        garden.pulseTween = this.scene.tweens.add({
            targets: growth,
            alpha: { from: 0.82, to: 1 },
            scaleX: { from: 0.97, to: 1.03 },
            scaleY: { from: 0.97, to: 1.03 },
            duration: stage === 'bloom' ? 1400 : 1900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    refreshFendCommunity(garden, requestedStage = 0) {
        if (!garden?.community) return;

        const stage = Math.max(0, Math.min(4, Math.floor(Number(requestedStage) || 0)));
        const graphics = garden.community;
        garden.communityPulseTween?.stop?.();
        graphics.clear();
        graphics.setAlpha(1);
        graphics.setScale(1);

        if (stage >= 1) {
            // First Light Shelter: a compact field canopy using the mission colors.
            graphics.fillStyle(0x101616, 0.98);
            graphics.fillRoundedRect(-102, -32, 54, 48, 6);
            graphics.lineStyle(3, 0xF4F4F4, 0.9);
            graphics.strokeRoundedRect(-102, -32, 54, 48, 6);
            graphics.fillStyle(0x3FAE62, 1);
            graphics.fillTriangle(-108, -29, -75, -60, -42, -29);
            graphics.lineStyle(3, 0xD94B4B, 0.92);
            graphics.lineBetween(-99, 16, -99, -34);
            graphics.fillStyle(0xF2C14E, 0.95);
            graphics.fillCircle(-75, -5, 4);
        }

        if (stage >= 2) {
            // Current Well: returned energy visibly circulates instead of being stored.
            graphics.fillStyle(0x101616, 0.98);
            graphics.fillEllipse(78, 8, 60, 28);
            graphics.lineStyle(4, 0x71E6B1, 1);
            graphics.strokeEllipse(78, -1, 48, 25);
            graphics.lineStyle(2, 0xF4F4F4, 0.72);
            graphics.strokeEllipse(78, -1, 31, 16);
            graphics.fillStyle(0x8FE3CF, 0.9);
            graphics.fillCircle(78, -1, 8);
            graphics.lineStyle(2, 0xD94B4B, 0.82);
            graphics.lineBetween(55, 16, 101, 16);
        }

        if (stage >= 3) {
            // Wayfinder Relay: a small shared warning network, not a command tower.
            graphics.lineStyle(5, 0x101616, 1);
            graphics.lineBetween(78, -22, 78, -83);
            graphics.lineStyle(3, 0xF4F4F4, 0.9);
            graphics.lineBetween(70, -24, 86, -24);
            graphics.lineBetween(78, -82, 61, -68);
            graphics.lineBetween(78, -82, 95, -68);
            graphics.fillStyle(0xD94B4B, 1);
            graphics.fillCircle(78, -83, 6);
            graphics.lineStyle(2, 0x71E6B1, 0.55);
            graphics.strokeCircle(78, -83, 15);
            graphics.strokeCircle(78, -83, 26);
        }

        if (stage >= 4) {
            // Living Commons: distinct creature-scale lights gather around the garden.
            graphics.lineStyle(4, 0x71E6B1, 0.75);
            graphics.beginPath();
            graphics.arc(0, 6, 128, Math.PI * 1.12, Math.PI * 1.88, false);
            graphics.strokePath();
            [
                [-111, -45, 0xD94B4B],
                [-58, -94, 0xF4F4F4],
                [0, -112, 0x3FAE62],
                [58, -94, 0xF4F4F4],
                [111, -45, 0xD94B4B]
            ].forEach(([x, y, color]) => {
                graphics.fillStyle(0x101616, 1);
                graphics.fillCircle(x, y, 9);
                graphics.fillStyle(color, 1);
                graphics.fillCircle(x, y, 5);
            });
        }

        garden.communityStage = stage;
        garden.label
            ?.setText(stage >= 4
                ? 'FEND COMMONS'
                : stage > 0
                    ? `FEND SETTLEMENT  ${stage}/4`
                    : 'SIGNAL GARDEN'
            )
            .setY(garden.zone.y - (
                stage >= 4 ? 145 : stage >= 3 ? 122 : 102
            ));
        garden.communityPulseTween = stage > 0
            ? this.scene.tweens.add({
                targets: graphics,
                alpha: { from: 0.86, to: 1 },
                duration: stage >= 3 ? 1250 : 1750,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            })
            : null;
    }

    /**
     * Render authored Fend residents around the settlement. Their interaction
     * zones remain separate from the garden so touch controls resolve cleanly.
     */
    refreshFendResidents(garden, snapshot = null) {
        if (!garden?.zone) return;

        garden.residents?.forEach(resident => {
            resident.pulseTween?.stop?.();
            resident.container?.destroy?.(true);
            resident.zone?.destroy?.();
        });
        garden.residents = [];

        const availableIds = new Set(
            snapshot?.availableResidents?.map(resident => resident.id) || []
        );
        const statuses = new Map(
            snapshot?.residents?.map(resident => [resident.id, resident]) || []
        );
        const offsets = [
            { x: 126, y: 54 },
            { x: 112, y: -54 },
            { x: -112, y: 54 },
            { x: -138, y: -70 }
        ];

        FEND_RESIDENT_DEFINITIONS.forEach((definition, index) => {
            if (!availableIds.has(definition.id)) return;

            const offset = offsets[index];
            const x = garden.zone.x + offset.x;
            const y = garden.zone.y + offset.y;
            const status = statuses.get(definition.id) || {};
            const container = this.scene.add.container(x, y).setDepth(y + 3);
            const figure = this.scene.add.graphics();

            figure.fillStyle(0x101616, 0.9);
            figure.fillEllipse(0, 23, 34, 11);
            figure.fillStyle(definition.color, 1);
            figure.fillRoundedRect(-12, -3, 24, 31, 8);
            figure.lineStyle(2, definition.accent, 0.95);
            figure.strokeRoundedRect(-12, -3, 24, 31, 8);
            figure.fillStyle(definition.accent, 1);
            figure.fillCircle(0, -12, 13);
            figure.lineStyle(2, 0x101616, 0.8);
            figure.strokeCircle(0, -12, 13);
            figure.fillStyle(0x101616, 1);
            figure.fillCircle(-4, -13, 2);
            figure.fillCircle(4, -13, 2);

            const roleMarks = [
                () => {
                    figure.lineStyle(3, 0xD94B4B, 1);
                    figure.lineBetween(-15, -25, 15, -25);
                },
                () => {
                    figure.lineStyle(2, 0x8FE3CF, 1);
                    figure.strokeCircle(0, -12, 18);
                },
                () => {
                    figure.lineStyle(3, 0xF2C14E, 1);
                    figure.lineBetween(-8, -29, 0, -37);
                    figure.lineBetween(0, -37, 8, -29);
                },
                () => {
                    figure.fillStyle(0x3FAE62, 1);
                    figure.fillCircle(-10, -28, 4);
                    figure.fillCircle(0, -32, 4);
                    figure.fillCircle(10, -28, 4);
                }
            ];
            roleMarks[index]?.();

            const markerLabel = status.completed
                ? 'OK'
                : status.ready
                    ? '!'
                    : status.active
                        ? '...'
                        : '+';
            const marker = this.scene.add.text(18, -34, markerLabel, {
                fontSize: status.active ? '11px' : '12px',
                fontFamily: 'Arial, sans-serif',
                color: status.ready ? '#F2C14E' : '#D8FFF0',
                fontStyle: 'bold',
                backgroundColor: '#101616',
                padding: { x: 4, y: 2 }
            }).setOrigin(0.5);
            const name = this.scene.add.text(0, 39, definition.name.toUpperCase(), {
                fontSize: '10px',
                fontFamily: 'Arial, sans-serif',
                color: '#D8FFF0',
                fontStyle: 'bold',
                stroke: '#081514',
                strokeThickness: 3
            }).setOrigin(0.5);
            container.add([figure, marker, name]);

            const zone = this.scene.add.zone(x, y, 72, 84);
            this.scene.physics.add.existing(zone, true);
            zone.setDepth(y);
            zone.residentId = definition.id;

            const pulseTween = this.scene.tweens.add({
                targets: container,
                y: y - 3,
                duration: 1200 + (index * 130),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            garden.residents.push({
                id: definition.id,
                definition,
                status,
                container,
                zone,
                pulseTween
            });
        });
    }

    /**
     * Restored expedition guardians return in calm forms and patrol distinct
     * Sanctuary routes. Their collision zones follow them, so they are living
     * residents rather than static trophies around the Signal Garden.
     */
    refreshGuardianResidents(garden, snapshot = null) {
        if (!garden?.zone) return;

        garden.guardianSocialTimer?.remove?.();
        garden.guardianSocialTimer = null;
        this.clearGuardianResidentSocialMoment(garden);
        garden.guardianResidents?.forEach(resident => {
            resident.moveTween?.stop?.();
            resident.idleTween?.stop?.();
            resident.routineTween?.stop?.();
            resident.ambientTween?.stop?.();
            resident.ambientTimer?.remove?.();
            resident.routineTimer?.remove?.();
            resident.container?.destroy?.(true);
            resident.zone?.destroy?.();
        });
        garden.guardianResidents = [];

        const rescuedIds = new Set(
            snapshot?.rescuedResidents?.map(resident => resident.id) || []
        );
        const residentStatuses = new Map(
            snapshot?.residents?.map(resident => [resident.id, resident]) || []
        );
        const useCompactPatrol =
            this.worldWidth < 900 ||
            (this.worldWidth - garden.zone.x) < 1250;
        const patrolRoutes = useCompactPatrol
            ? [
                [[-122, -205], [-105, -225], [-82, -201], [-104, -179]],
                [[0, -238], [20, -222], [2, -200], [-18, -218]],
                [[122, -205], [105, -225], [82, -201], [104, -179]],
                [[-122, 105], [-102, 84], [-80, 108], [-105, 126]],
                [[0, 148], [22, 128], [0, 108], [-20, 128]],
                [[122, 105], [102, 84], [80, 108], [105, 126]]
            ]
            : [
                [[190, -72], [330, -110], [410, -18], [270, 42]],
                [[310, -245], [445, -300], [555, -210], [410, -155]],
                [[520, -35], [690, -90], [790, 20], [630, 82]],
                [[310, -430], [500, -490], [640, -410], [455, -350]],
                [[680, -300], [850, -355], [980, -250], [825, -185]],
                [[870, -520], [1030, -460], [1110, -330], [940, -375]]
            ];

        GUARDIAN_RESIDENT_DEFINITIONS.forEach((definition, index) => {
            if (!rescuedIds.has(definition.id)) return;

            const route = patrolRoutes[index].map(([x, y]) => ({
                x: Math.max(64, Math.min(this.worldWidth - 64, garden.zone.x + x)),
                y: Math.max(100, Math.min(this.worldHeight - 92, garden.zone.y + y))
            }));
            const start = route[0];
            const status = residentStatuses.get(definition.id) || definition;
            const container = this.scene.add.container(start.x, start.y)
                .setDepth(start.y + 4);
            const shadow = this.scene.add.ellipse(0, 23, 54, 14, 0x101616, 0.42);
            let figure;
            let figureScaleX = 1;
            let figureScaleY = 1;
            if (this.scene.textures.exists(definition.textureKey)) {
                figure = this.scene.add.image(0, -4, definition.textureKey);
                const sourceWidth = Math.max(1, figure.width);
                const sourceHeight = Math.max(1, figure.height);
                const residentScale = Math.min(
                    66 / sourceWidth,
                    72 / sourceHeight
                );
                figureScaleX = residentScale;
                figureScaleY = residentScale;
                figure.setScale(figureScaleX, figureScaleY);
            } else {
                figure = this.scene.add.graphics();
                this.drawGuardianResidentFigure(figure, definition);
            }
            const name = this.scene.add.text(0, 43, definition.name.toUpperCase(), {
                fontSize: '10px',
                fontFamily: 'Arial, sans-serif',
                color: '#F4F4F4',
                fontStyle: 'bold',
                stroke: '#081514',
                strokeThickness: 4
            }).setOrigin(0.5);
            const standingLabel = status.activeTeam
                ? 'ALLY'
                : status.synergyUnlocked
                    ? 'TRUSTED'
                    : status.taskStatus === 'completed'
                        ? 'UNLOCKED'
                        : status.taskStatus === 'active'
                            ? `TASK ${status.taskProgress?.progress || 0}/${status.taskProgress?.target || 1}`
                            : status.taskStatus === 'available'
                                ? 'TASK'
                                : '';
            const routineStateLabel = status.routineStatus === 'recovering' &&
                status.routineSupported
                ? 'STABLE'
                : status.routineReady
                    ? 'CARE'
                    : null;
            const markerLabel = status.expeditionDebriefReady
                ? 'DEBRIEF'
                : status.taskStatus === 'ready'
                    ? 'READY'
                : [standingLabel, routineStateLabel]
                    .filter(Boolean)
                    .join(' · ');
            const marker = this.scene.add.text(0, -61, markerLabel, {
                fontSize: '9px',
                fontFamily: 'Arial, sans-serif',
                color: status.routineStatus === 'recovering'
                    ? '#8FE3CF'
                    : status.activeTeam || status.taskStatus === 'ready' || status.routineReady
                    ? '#F2C14E'
                    : '#D8FFF0',
                fontStyle: 'bold',
                backgroundColor: '#101616',
                padding: { x: 5, y: 2 },
                stroke: '#081514',
                strokeThickness: 2
            }).setOrigin(0.5).setVisible(Boolean(markerLabel));
            const routineRing = this.scene.add.graphics();
            routineRing.lineStyle(2, definition.accent, 0.85);
            routineRing.strokeEllipse(0, 2, 68, 43);
            routineRing.setVisible(false);
            const routineLabel = this.scene.add.text(
                0,
                -79,
                definition.routineCue,
                {
                    fontSize: '9px',
                    fontFamily: 'Arial, sans-serif',
                    color: '#F4F4F4',
                    fontStyle: 'bold',
                    backgroundColor: '#101616',
                    padding: { x: 6, y: 3 },
                    stroke: '#081514',
                    strokeThickness: 2
                }
            ).setOrigin(0.5).setVisible(false);
            const ambientLine = this.scene.add.text(0, -105, '', {
                fontSize: '10px',
                fontFamily: 'Arial, sans-serif',
                color: '#F4F4F4',
                fontStyle: 'italic',
                align: 'center',
                wordWrap: { width: 168 },
                backgroundColor: '#101616',
                padding: { x: 7, y: 4 },
                stroke: '#081514',
                strokeThickness: 2
            }).setOrigin(0.5, 1).setVisible(false).setAlpha(0);
            container.add([
                shadow,
                routineRing,
                figure,
                name,
                marker,
                routineLabel,
                ambientLine
            ]);

            const zone = this.scene.add.zone(start.x, start.y, 92, 98);
            this.scene.physics.add.existing(zone, true);
            zone.guardianResidentId = definition.id;
            const entry = {
                id: definition.id,
                definition,
                status,
                container,
                zone,
                route,
                routeIndex: 0,
                moveTween: null,
                idleTween: null,
                routineTween: null,
                routineTimer: null,
                ambientTween: null,
                ambientTimer: null,
                ambientLine,
                routineCycle: 0,
                careFeedbackShown: false
            };
            const syncZone = () => {
                if (!container.active || !zone.active) return;
                zone.setPosition(container.x, container.y);
                zone.body?.updateFromGameObject?.();
                container.setDepth(container.y + 4);
            };
            let walkNext;
            const showAmbientLine = (line, { duration = 1500 } = {}) => {
                if (!line) return;
                entry.ambientTween?.stop?.();
                entry.ambientTimer?.remove?.();
                ambientLine
                    .setText(`“${line}”`)
                    .setY(-100)
                    .setAlpha(0)
                    .setVisible(true);
                entry.ambientTween = this.scene.tweens.add({
                    targets: ambientLine,
                    alpha: 1,
                    y: -105,
                    duration: 260,
                    ease: 'Sine.easeOut'
                });
                entry.ambientTimer = this.scene.time?.delayedCall?.(
                    duration,
                    () => {
                        entry.ambientTimer = null;
                        entry.ambientTween?.stop?.();
                        ambientLine.setVisible(false).setAlpha(0);
                    }
                );
            };
            entry.showAmbientLine = showAmbientLine;
            const beginRoutine = () => {
                if (!container.active) return;
                entry.routineCycle += 1;
                marker.setVisible(false);
                routineLabel.setVisible(true);
                routineRing.setVisible(true).setAlpha(0.42).setScale(0.9);
                if (
                    status.routineStatus === 'recovering' &&
                    !entry.careFeedbackShown
                ) {
                    entry.careFeedbackShown = true;
                    showAmbientLine(definition.routineCare.worldFeedback);
                } else {
                    const ambientCadence = Math.max(
                        2,
                        Math.min(6, rescuedIds.size)
                    );
                    const ambientLines = definition.ambientLines || [];
                    if (
                        ambientLines.length > 0 &&
                        (entry.routineCycle + index) % ambientCadence === 0
                    ) {
                        const lineIndex = (
                            entry.routineCycle + index
                        ) % ambientLines.length;
                        showAmbientLine(ambientLines[lineIndex]);
                    }
                }
                entry.routineTween?.stop?.();
                entry.routineTween = this.scene.tweens.add({
                    targets: routineRing,
                    alpha: { from: 0.42, to: 1 },
                    scaleX: { from: 0.9, to: 1.16 },
                    scaleY: { from: 0.9, to: 1.16 },
                    duration: 650 + (index * 55),
                    yoyo: true,
                    repeat: 1,
                    ease: 'Sine.easeInOut'
                });
                entry.routineTimer = this.scene.time?.delayedCall?.(
                    1700 + (index * 110),
                    () => {
                        if (!container.active) return;
                        entry.routineTween?.stop?.();
                        entry.ambientTween?.stop?.();
                        entry.ambientTimer?.remove?.();
                        entry.ambientTimer = null;
                        ambientLine.setVisible(false).setAlpha(0);
                        routineRing.setVisible(false);
                        routineLabel.setVisible(false);
                        marker.setVisible(Boolean(markerLabel));
                        walkNext();
                    }
                );
            };
            walkNext = () => {
                if (!container.active || !this.scene?.tweens) return;
                entry.routeIndex = (entry.routeIndex + 1) % route.length;
                const target = route[entry.routeIndex];
                const facing = target.x >= container.x ? 1 : -1;
                figure.setScale(figureScaleX * facing, figureScaleY);
                entry.moveTween = this.scene.tweens.add({
                    targets: container,
                    x: target.x,
                    y: target.y,
                    duration: 4200 + (index * 260),
                    ease: 'Sine.easeInOut',
                    onUpdate: syncZone,
                    onComplete: beginRoutine
                });
            };
            entry.idleTween = this.scene.tweens.add({
                targets: figure,
                scaleY: {
                    from: figureScaleY * 0.98,
                    to: figureScaleY * 1.03
                },
                duration: 900 + (index * 110),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            entry.routineTimer = this.scene.time?.delayedCall?.(
                900 + (index * 260),
                walkNext
            );
            garden.guardianResidents.push(entry);
        });
        this.startGuardianResidentSocialMoments(garden);
    }

    refreshRescuedResidents(garden, snapshot = null) {
        if (!garden?.zone) return;
        garden.rescuedResidents?.forEach(resident => {
            resident.moveTween?.stop?.();
            resident.idleTween?.stop?.();
            resident.container?.destroy?.(true);
            resident.zone?.destroy?.();
        });
        garden.rescuedResidents = [];

        const rescuedIds = new Set(
            snapshot?.rescued?.map(resident => resident.id) || []
        );
        const compact = this.worldWidth < 900 ||
            (this.worldWidth - garden.zone.x) < 1250;
        const positions = compact
            ? [[-148, -42], [-76, 185], [0, -142], [76, 185], [148, -42], [0, 225]]
            : [[-210, 150], [-80, 250], [70, 180], [210, 260], [360, 170], [500, 250]];

        RESCUED_RESIDENT_DEFINITIONS.forEach((definition, index) => {
            if (!rescuedIds.has(definition.id)) return;
            const [offsetX, offsetY] = positions[index];
            const startX = Math.max(62, Math.min(
                this.worldWidth - 62,
                garden.zone.x + offsetX
            ));
            const startY = Math.max(92, Math.min(
                this.worldHeight - 70,
                garden.zone.y + offsetY
            ));
            const container = this.scene.add.container(startX, startY)
                .setDepth(startY + 6);
            const shadow = this.scene.add.ellipse(0, 20, 40, 11, 0x101616, 0.38);
            const figure = this.scene.add.graphics();
            figure.fillStyle(definition.color, 1);
            figure.fillRoundedRect(-19, -24, 38, 48, 10);
            figure.fillStyle(definition.accent, 0.75);
            figure.fillCircle(0, 6, 11);
            figure.fillStyle(0xF4F4F4, 1);
            figure.fillCircle(-8, -8, 7);
            figure.fillCircle(8, -8, 7);
            figure.fillStyle(0x101616, 1);
            figure.fillCircle(-7, -8, 3);
            figure.fillCircle(9, -8, 3);
            const name = this.scene.add.text(0, 35, definition.name.toUpperCase(), {
                fontSize: '10px',
                fontFamily: 'Arial, sans-serif',
                color: '#F4F4F4',
                fontStyle: 'bold',
                stroke: '#081514',
                strokeThickness: 4
            }).setOrigin(0.5);
            const role = this.scene.add.text(0, 50, definition.role.toUpperCase(), {
                fontSize: '8px',
                fontFamily: 'Arial, sans-serif',
                color: '#8FE3CF',
                backgroundColor: '#101616',
                padding: { x: 4, y: 2 }
            }).setOrigin(0.5);
            const marker = this.scene.add.text(0, -41, 'SUPPORT READY', {
                fontSize: '8px',
                fontFamily: 'Arial, sans-serif',
                color: '#061116',
                backgroundColor: '#F2C14E',
                fontStyle: 'bold',
                padding: { x: 5, y: 2 }
            }).setOrigin(0.5);
            container.add([shadow, figure, name, role, marker]);

            const zone = this.scene.add.zone(startX, startY, 82, 92);
            this.scene.physics.add.existing(zone, true);
            zone.rescuedResidentId = definition.id;
            const entry = {
                id: definition.id,
                definition,
                container,
                zone,
                moveTween: null,
                idleTween: null
            };
            entry.idleTween = this.scene.tweens.add({
                targets: figure,
                y: { from: -2, to: 2 },
                duration: 900 + index * 90,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            entry.moveTween = this.scene.tweens.add({
                targets: container,
                x: startX + (index % 2 === 0 ? 24 : -24),
                duration: 3200 + index * 180,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
                onUpdate: () => {
                    if (!zone.active || !container.active) return;
                    zone.setPosition(container.x, container.y);
                    zone.body?.updateFromGameObject?.();
                    container.setDepth(container.y + 6);
                }
            });
            garden.rescuedResidents.push(entry);
        });
    }

    clearGuardianResidentSocialMoment(garden) {
        if (!garden) return;
        garden.guardianSocialMomentTimer?.remove?.();
        garden.guardianSocialMomentTimer = null;
        garden.guardianSocialTween?.stop?.();
        garden.guardianSocialTween = null;
        garden.guardianSocialElements?.forEach(element => {
            element?.destroy?.();
        });
        garden.guardianSocialElements = [];
    }

    startGuardianResidentSocialMoments(garden) {
        if (!garden?.guardianResidents?.length || !this.scene?.time) return;
        const residentsById = new Map(
            garden.guardianResidents.map(resident => [resident.id, resident])
        );
        const exchanges = GUARDIAN_SOCIAL_EXCHANGES.filter(exchange => (
            exchange.guardianIds.every(id => residentsById.has(id))
        ));
        if (exchanges.length === 0) return;
        garden.guardianSocialCycle = 0;

        const schedule = delay => {
            garden.guardianSocialTimer?.remove?.();
            garden.guardianSocialTimer = this.scene.time.delayedCall(
                delay,
                trigger
            );
        };
        const trigger = () => {
            garden.guardianSocialTimer = null;
            if (!garden.zone?.active || !this.scene?.sys?.isActive?.()) {
                return;
            }
            if (
                this.scene.guardianExchangeOpen ||
                this.scene.guardianCareActivityOpen ||
                this.scene.storyModalElements?.length ||
                this.scene.hamburgerMenu?.isOpen
            ) {
                schedule(4200);
                return;
            }
            const player = this.scene.player;
            const candidates = exchanges.map(exchange => {
                const residents = exchange.guardianIds.map(
                    id => residentsById.get(id)
                );
                if (residents.some(resident => !resident?.container?.active)) {
                    return null;
                }
                const [left, right] = residents;
                const midpoint = {
                    x: (left.container.x + right.container.x) / 2,
                    y: (left.container.y + right.container.y) / 2
                };
                const pairDistance = Phaser.Math.Distance.Between(
                    left.container.x,
                    left.container.y,
                    right.container.x,
                    right.container.y
                );
                const playerDistance = player
                    ? Phaser.Math.Distance.Between(
                        player.x,
                        player.y,
                        midpoint.x,
                        midpoint.y
                    )
                    : 0;
                return {
                    exchange,
                    residents,
                    midpoint,
                    pairDistance,
                    playerDistance
                };
            }).filter(candidate => (
                candidate &&
                candidate.pairDistance <= 430 &&
                candidate.playerDistance <= 470
            )).sort((left, right) => (
                left.playerDistance - right.playerDistance ||
                left.exchange.id.localeCompare(right.exchange.id)
            ));
            if (candidates.length === 0) {
                schedule(5200);
                return;
            }

            const candidate = candidates[
                garden.guardianSocialCycle % candidates.length
            ];
            const variantIndex = Math.floor(
                garden.guardianSocialCycle / candidates.length
            ) % candidate.exchange.variants.length;
            const variant = candidate.exchange.variants[variantIndex];
            garden.guardianSocialCycle += 1;
            this.clearGuardianResidentSocialMoment(garden);
            candidate.residents.forEach(resident => {
                resident.showAmbientLine?.(
                    variant[resident.id],
                    { duration: 3200 }
                );
            });

            const connection = this.scene.add.graphics()
                .setDepth(candidate.midpoint.y + 1)
                .setAlpha(0);
            connection.lineStyle(2, 0x8FE3CF, 0.58);
            connection.lineBetween(
                candidate.residents[0].container.x,
                candidate.residents[0].container.y - 22,
                candidate.residents[1].container.x,
                candidate.residents[1].container.y - 22
            );
            const cue = this.scene.add.text(
                candidate.midpoint.x,
                candidate.midpoint.y - 46,
                `SANCTUARY EXCHANGE // ${candidate.exchange.cue}`,
                {
                    fontSize: '9px',
                    fontFamily: 'Arial, sans-serif',
                    color: '#8FE3CF',
                    fontStyle: 'bold',
                    backgroundColor: '#101616',
                    padding: { x: 6, y: 3 },
                    stroke: '#081514',
                    strokeThickness: 2
                }
            ).setOrigin(0.5).setDepth(candidate.midpoint.y + 3)
                .setAlpha(0);
            garden.guardianSocialElements = [connection, cue];
            garden.guardianSocialTween = this.scene.tweens.add({
                targets: garden.guardianSocialElements,
                alpha: 1,
                duration: 260,
                yoyo: true,
                hold: 2500,
                ease: 'Sine.easeInOut'
            });
            garden.guardianSocialMomentTimer = this.scene.time.delayedCall(
                3200,
                () => this.clearGuardianResidentSocialMoment(garden)
            );
            this.scene.game?.events?.emit?.('guardian-social-moment', {
                exchangeId: candidate.exchange.id,
                guardianIds: [...candidate.exchange.guardianIds]
            });
            schedule(23000);
        };

        schedule(4200);
    }

    drawGuardianResidentFigure(graphics, definition) {
        const color = definition.color;
        const accent = definition.accent;
        graphics.lineStyle(3, accent, 0.95);
        graphics.fillStyle(color, 1);

        if (definition.kind === 'treant') {
            graphics.fillRoundedRect(-15, -22, 30, 50, 8);
            graphics.strokeRoundedRect(-15, -22, 30, 50, 8);
            graphics.lineBetween(-9, -20, -25, -38);
            graphics.lineBetween(9, -20, 25, -38);
            graphics.fillStyle(accent, 1);
            graphics.fillCircle(-25, -40, 9);
            graphics.fillCircle(0, -46, 12);
            graphics.fillCircle(25, -40, 9);
        } else if (definition.kind === 'golem') {
            const body = [
                { x: -22, y: 20 },
                { x: -19, y: -21 },
                { x: 0, y: -42 },
                { x: 20, y: -18 },
                { x: 24, y: 21 }
            ];
            graphics.fillPoints(body, true);
            graphics.strokePoints(body, true);
            graphics.fillStyle(accent, 1);
            graphics.fillTriangle(-9, -17, 0, -36, 9, -17);
            graphics.fillCircle(-8, -7, 3);
            graphics.fillCircle(8, -7, 3);
        } else if (definition.kind === 'serpent') {
            graphics.fillEllipse(0, 1, 62, 29);
            graphics.strokeEllipse(0, 1, 62, 29);
            graphics.fillCircle(22, -15, 18);
            graphics.strokeCircle(22, -15, 18);
            graphics.fillStyle(accent, 1);
            graphics.fillCircle(27, -19, 3);
            graphics.lineBetween(-29, 4, -42, -7);
            graphics.lineBetween(-29, 4, -43, 14);
        } else if (definition.kind === 'phoenix') {
            graphics.fillCircle(0, -8, 17);
            graphics.fillTriangle(-6, 4, -42, -24, -24, 16);
            graphics.fillTriangle(6, 4, 42, -24, 24, 16);
            graphics.strokeTriangle(-6, 4, -42, -24, -24, 16);
            graphics.strokeTriangle(6, 4, 42, -24, 24, 16);
            graphics.fillStyle(accent, 1);
            graphics.fillTriangle(-11, 17, 0, 38, 11, 17);
            graphics.fillCircle(5, -12, 3);
        } else if (definition.kind === 'titan') {
            graphics.fillRoundedRect(-24, -31, 48, 58, 8);
            graphics.strokeRoundedRect(-24, -31, 48, 58, 8);
            graphics.fillStyle(accent, 1);
            graphics.fillTriangle(-14, -12, 0, -31, 14, -12);
            graphics.lineBetween(-31, -15, -24, 11);
            graphics.lineBetween(31, -15, 24, 11);
        } else {
            graphics.fillEllipse(0, -2, 42, 57);
            graphics.strokeEllipse(0, -2, 42, 57);
            graphics.fillStyle(accent, 1);
            graphics.fillTriangle(-23, -25, 0, -50, 23, -25);
            graphics.lineStyle(2, accent, 0.7);
            graphics.strokeCircle(0, -7, 31);
            graphics.fillCircle(-7, -10, 3);
            graphics.fillCircle(7, -10, 3);
        }
    }

    /**
     * Mark the Living Commons decision in the world without adding another
     * construction tier. The four pennants represent the mission colors and
     * remain visible after the First Listening.
     */
    refreshFendCulture(garden, snapshot = null) {
        if (!garden?.zone) return;

        garden.culturePulseTween?.stop?.();
        garden.culturePulseTween = null;
        garden.cultureElements?.forEach(element => element?.destroy?.());
        garden.cultureElements = [];
        if (!snapshot?.complete || !snapshot.selectedPriority) return;

        const centerX = garden.zone.x;
        const centerY = garden.zone.y - 132;
        const sigil = this.scene.add.graphics().setDepth(garden.zone.y + 4);
        sigil.fillStyle(0x101616, 0.96);
        sigil.fillCircle(centerX, centerY, 22);
        sigil.lineStyle(2, 0xF4F4F4, 0.95);
        sigil.strokeCircle(centerX, centerY, 22);
        sigil.lineStyle(3, 0x3FAE62, 1);
        sigil.lineBetween(centerX - 10, centerY + 7, centerX, centerY - 8);
        sigil.lineBetween(centerX, centerY - 8, centerX + 10, centerY + 7);
        sigil.fillStyle(0xD94B4B, 1);
        sigil.fillCircle(centerX, centerY - 8, 4);

        const pennantColors = [0xD94B4B, 0x101616, 0xF4F4F4, 0x3FAE62];
        pennantColors.forEach((color, index) => {
            const x = centerX - 31 + (index * 20);
            sigil.fillStyle(color, 1);
            sigil.fillTriangle(x, centerY + 30, x + 14, centerY + 30, x + 7, centerY + 41);
        });

        const label = this.scene.add.text(
            centerX,
            centerY + 53,
            snapshot.selectedPriority.shortLabel,
            {
                fontSize: '9px',
                fontFamily: 'Arial, sans-serif',
                color: '#D8FFF0',
                fontStyle: 'bold',
                backgroundColor: '#101616',
                padding: { x: 5, y: 3 },
                stroke: '#081514',
                strokeThickness: 2
            }
        ).setOrigin(0.5).setDepth(garden.zone.y + 5);

        garden.cultureElements = [sigil, label];
        garden.culturePulseTween = this.scene.tweens.add({
            targets: [sigil, label],
            alpha: { from: 0.82, to: 1 },
            duration: 1450,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    /**
     * Render the three Quiet Current anchors as a physical consequence of the
     * protected-return decision. Saved state carries only anchor IDs; world
     * coordinates remain authored locally in this renderer.
     */
    refreshCurrentVeilMission(garden, snapshot = null) {
        if (!garden?.zone) return;

        garden.currentVeilAnchors?.forEach(anchor => {
            anchor.pulseTween?.stop?.();
            anchor.container?.destroy?.(true);
            anchor.zone?.destroy?.();
        });
        garden.currentVeilAnchors = [];
        garden.currentVeilNetwork?.destroy?.();
        garden.currentVeilNetwork = null;

        if (
            !snapshot?.active &&
            !snapshot?.verificationReady &&
            !snapshot?.complete
        ) {
            return;
        }

        const network = this.scene.add.graphics()
            .setDepth(garden.zone.y - 8);
        network.lineStyle(
            2,
            snapshot.complete ? 0x71E6B1 : 0x8FE3CF,
            snapshot.complete ? 0.58 : 0.3
        );
        const points = snapshot.anchors.map(anchor => ({
            x: garden.zone.x + anchor.positionOffset.x,
            y: garden.zone.y + anchor.positionOffset.y
        }));
        points.forEach((point, index) => {
            const next = points[(index + 1) % points.length];
            network.lineBetween(point.x, point.y, next.x, next.y);
            network.lineBetween(
                point.x,
                point.y,
                garden.zone.x,
                garden.zone.y
            );
        });
        garden.currentVeilNetwork = network;

        snapshot.anchors.forEach(anchor => {
            const x = garden.zone.x + anchor.positionOffset.x;
            const y = garden.zone.y + anchor.positionOffset.y;
            const stabilized = anchor.stabilized;
            const container = this.scene.add.container(x, y)
                .setDepth(y + 4);
            const figure = this.scene.add.graphics();
            figure.fillStyle(0x101616, 0.96);
            figure.fillCircle(0, 0, 28);
            figure.lineStyle(
                3,
                stabilized ? 0x71E6B1 : anchor.color,
                1
            );
            figure.strokeCircle(0, 0, 28);
            figure.lineStyle(2, anchor.accent, 0.95);
            figure.strokeCircle(0, 0, 17);
            figure.fillStyle(anchor.color, 1);
            figure.fillCircle(0, 0, stabilized ? 8 : 6);
            figure.lineStyle(3, 0xF4F4F4, 0.9);
            figure.lineBetween(-9, 8, 0, -8);
            figure.lineBetween(0, -8, 9, 8);

            const status = this.scene.add.text(
                0,
                41,
                stabilized ? 'STABILIZED' : anchor.label,
                {
                    fontSize: '9px',
                    fontFamily: 'Arial, sans-serif',
                    color: stabilized ? '#71E6B1' : '#F4F4F4',
                    fontStyle: 'bold',
                    backgroundColor: '#101616',
                    padding: { x: 5, y: 3 },
                    stroke: '#081514',
                    strokeThickness: 2
                }
            ).setOrigin(0.5);
            container.add([figure, status]);

            const zone = this.scene.add.zone(x, y, 78, 78);
            this.scene.physics.add.existing(zone, true);
            zone.setDepth(y);
            zone.currentVeilAnchorId = anchor.id;

            const pulseTween = !stabilized && snapshot.active
                ? this.scene.tweens.add({
                    targets: container,
                    scaleX: { from: 0.96, to: 1.08 },
                    scaleY: { from: 0.96, to: 1.08 },
                    alpha: { from: 0.78, to: 1 },
                    duration: 1050 + (anchor.order * 120),
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                })
                : null;

            garden.currentVeilAnchors.push({
                id: anchor.id,
                definition: anchor,
                stabilized,
                container,
                zone,
                pulseTween
            });
        });
    }

    /**
     * Create the Target Practice Range area with various targets
     * @param {object} landmarkData - Landmark position and data from SanctuaryZones
     * @returns {object} - Object containing all target range elements
     */
    createTargetRange(landmarkData) {
        const physics = this.scene.physics;
        const centerX = landmarkData.position.x;
        const centerY = landmarkData.position.y;

        // Create range sign
        this.graphicsEngine.createTargetRangeSign();
        const rangeSign = this.scene.add.sprite(centerX - 120, centerY - 80, 'targetRangeSign');
        rangeSign.setScale(1.0);
        rangeSign.setDepth(centerY - 100);

        // Create static bullseye targets (3 at different heights)
        this.graphicsEngine.createTargetBullseye();
        const targets = [];

        const targetPositions = [
            { x: centerX - 80, y: centerY - 20, points: 10 },
            { x: centerX, y: centerY - 40, points: 25 },
            { x: centerX + 80, y: centerY - 10, points: 10 }
        ];

        targetPositions.forEach((pos, index) => {
            const target = physics.add.staticSprite(pos.x, pos.y, 'targetBullseye');
            target.setScale(0.9);
            target.setDepth(pos.y);
            target.body.setSize(40, 40);
            target.body.setOffset(12, 15);
            target.setData('type', 'bullseye');
            target.setData('points', pos.points);
            target.setData('targetIndex', index);
            targets.push(target);
        });

        // Create practice dummies (2)
        this.graphicsEngine.createTargetDummy();
        const dummies = [];

        const dummyPositions = [
            { x: centerX - 40, y: centerY + 40, points: 15 },
            { x: centerX + 50, y: centerY + 50, points: 15 }
        ];

        dummyPositions.forEach((pos, index) => {
            const dummy = physics.add.staticSprite(pos.x, pos.y, 'targetDummy');
            dummy.setScale(1.0);
            dummy.setDepth(pos.y);
            dummy.body.setSize(36, 60);
            dummy.body.setOffset(6, 15);
            dummy.setData('type', 'dummy');
            dummy.setData('points', pos.points);
            dummy.setData('targetIndex', index);
            dummies.push(dummy);
        });

        // Create exploding barrels (2)
        this.graphicsEngine.createTargetBarrel();
        const barrels = [];

        const barrelPositions = [
            { x: centerX - 100, y: centerY + 60, points: 50, explodes: true },
            { x: centerX + 100, y: centerY + 30, points: 50, explodes: true }
        ];

        barrelPositions.forEach((pos, index) => {
            const barrel = physics.add.staticSprite(pos.x, pos.y, 'targetBarrel');
            barrel.setScale(1.0);
            barrel.setDepth(pos.y);
            barrel.body.setSize(32, 40);
            barrel.body.setOffset(4, 8);
            barrel.setData('type', 'barrel');
            barrel.setData('points', pos.points);
            barrel.setData('explodes', pos.explodes);
            barrel.setData('targetIndex', index);
            barrels.push(barrel);
        });

        // Create moving target (swinging)
        this.graphicsEngine.createMovingTarget();
        const movingTarget = physics.add.staticSprite(centerX + 30, centerY - 60, 'movingTarget');
        movingTarget.setScale(0.8);
        movingTarget.setDepth(centerY - 80);
        movingTarget.body.setSize(35, 35);
        movingTarget.body.setOffset(8, 18);
        movingTarget.setData('type', 'moving');
        movingTarget.setData('points', 100);
        movingTarget.setData('isMoving', true);

        // Add swinging animation to moving target
        this.scene.tweens.add({
            targets: movingTarget,
            x: { from: centerX - 40, to: centerX + 100 },
            duration: 2500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Create a decorative perimeter with a clear, non-colliding entrance.
        const boundaryGraphics = this.scene.add.graphics();
        boundaryGraphics.lineStyle(2, 0xFF6B6B, 0.4);
        const left = centerX - 140;
        const right = centerX + 140;
        const top = centerY - 100;
        const bottom = centerY + 100;
        const gateHalfWidth = 42;
        boundaryGraphics.lineBetween(left, top, right, top);
        boundaryGraphics.lineBetween(left, top, left, bottom);
        boundaryGraphics.lineBetween(right, top, right, bottom);
        boundaryGraphics.lineBetween(left, bottom, centerX - gateHalfWidth, bottom);
        boundaryGraphics.lineBetween(centerX + gateHalfWidth, bottom, right, bottom);
        boundaryGraphics.fillStyle(0x8FE3CF, 0.7);
        boundaryGraphics.fillTriangle(
            centerX - 22,
            bottom + 18,
            centerX - 10,
            bottom + 18,
            centerX - 16,
            bottom + 5
        );
        boundaryGraphics.fillTriangle(
            centerX + 10,
            bottom + 18,
            centerX + 22,
            bottom + 18,
            centerX + 16,
            bottom + 5
        );
        boundaryGraphics.setDepth(1);

        // Add "DANGER ZONE" corner markers
        const markerPositions = [
            { x: centerX - 140, y: centerY - 100 },
            { x: centerX + 140, y: centerY - 100 },
            { x: centerX - 140, y: centerY + 100 },
            { x: centerX + 140, y: centerY + 100 }
        ];

        markerPositions.forEach(pos => {
            const marker = this.scene.add.graphics();
            marker.fillStyle(0xFF6B6B, 0.6);
            marker.fillTriangle(pos.x, pos.y, pos.x + 15, pos.y, pos.x, pos.y + 15);
            marker.setDepth(2);
        });

        // Store reference for interaction handling
        const allTargets = [...targets, ...dummies, ...barrels, movingTarget];

        // Add interactive glow effect on hover for all targets
        allTargets.forEach(target => {
            target.setInteractive();
            target.on('pointerover', () => {
                target.setTint(0xFFFF00);
            });
            target.on('pointerout', () => {
                target.clearTint();
            });
        });

        console.log('[WorldBuilder] Created Target Range with', allTargets.length, 'targets');

        return {
            sign: rangeSign,
            targets,
            dummies,
            barrels,
            movingTarget,
            allTargets,
            boundary: boundaryGraphics
        };
    }

    /**
     * Create return portal for non-sanctuary biomes
     * Allows player to return to the Sanctuary
     */
    createReturnPortal() {
        const physics = this.scene.physics;

        // Position near the spawn point but slightly offset
        const spawnX = this.worldWidth / 2;
        const spawnY = this.worldHeight / 2;
        const portalX = spawnX - 200;
        const portalY = spawnY + 100;

        // Create return portal texture
        this.graphicsEngine.createReturnPortal();
        const returnPortal = physics.add.staticSprite(portalX, portalY, 'returnPortal');
        returnPortal.setScale(1.0);
        returnPortal.setDepth(portalY);
        // Increased collision body to match texture size better for reliable interaction
        returnPortal.body.setSize(140, 160);
        returnPortal.body.setOffset(0, 0);
        returnPortal.landmarkId = 'returnPortal';
        returnPortal.landmarkData = {
            name: 'Return Portal',
            description: 'Return to your Sanctuary',
            interactable: true,
            interactRadius: 100,
            onInteract: 'returnToSanctuary'
        };

        // Add swirling animation
        this.scene.tweens.add({
            targets: returnPortal,
            angle: { from: -3, to: 3 },
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Add glow pulse
        this.scene.tweens.add({
            targets: returnPortal,
            alpha: { from: 0.85, to: 1 },
            duration: 1500,
            yoyo: true,
            repeat: -1
        });

        console.log('[WorldBuilder] Created return portal for biome:', this.currentBiome);

        return returnPortal;
    }

    createBackgroundImage() {
        if (this.backgroundImage) {
            return this.backgroundImage;
        }

        const textureKey = this.generateBackgroundTexture();
        this.backgroundImage = this.scene.add.image(0, 0, textureKey);
        this.backgroundImage.setOrigin(0, 0);
        this.backgroundImage.setDepth(-1000);
        return this.backgroundImage;
    }

    generateBackgroundTexture() {
        const biomeId = this.currentBiome;
        const textureKey = `worldBackground_${biomeId}_${this.worldWidth}x${this.worldHeight}`;

        if (this.scene.textures.exists(textureKey)) {
            return textureKey;
        }

        const graphics = this.scene.make.graphics({ add: false });
        const palette = this.biomeConfig.palette || {};

        // Get biome-specific colors
        const skyTop = this.hexToInt(palette.skyTop) || 0x0a0a2e;
        const skyBottom = this.hexToInt(palette.skyBottom) || 0x1a1a4e;
        const nebulaColor = this.hexToInt(palette.nebula) || 0x9370DB;
        const accentColor = this.hexToInt(palette.accent) || 0xFFD54F;
        const floraColor = this.hexToInt(palette.flora) || 0x64B5F6;
        const rockColor = this.hexToInt(palette.rocks) || 0x90A4AE;

        // Base gradient using biome colors
        graphics.fillGradientStyle(skyTop, skyTop, skyBottom, skyBottom, 1);
        graphics.fillRect(0, 0, this.worldWidth, this.worldHeight);

        // Stars with biome-appropriate brightness
        const starCount = this.getStarCount();
        for (let i = 0; i < starCount; i++) {
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(0, this.worldHeight);
            const brightness = Math.random();
            const color = this.getStarColor(brightness);
            const size = brightness > 0.8 ? 2 : 1;
            graphics.fillStyle(color, brightness * 0.8 + 0.2);
            graphics.fillCircle(x, y, size);
        }

        // Nebula clouds with biome colors
        const nebulaColors = this.getNebulaColors();
        for (let i = 0; i < 30; i++) {
            const nebula = Phaser.Math.RND.pick(nebulaColors);
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(0, this.worldHeight);
            const size = Phaser.Math.Between(80, 200);
            graphics.fillStyle(nebula.color, nebula.alpha);
            graphics.fillCircle(x, y, size);
        }

        // Biome-specific features
        this.addBiomeFeatures(graphics, palette);

        // Floating platforms with biome-specific colors
        const platformColor = this.blendColors(skyBottom, rockColor, 0.5);
        graphics.fillStyle(platformColor, 0.4);
        for (let i = 0; i < 40; i++) {
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(0, this.worldHeight);
            const width = Phaser.Math.Between(100, 300);
            const height = Phaser.Math.Between(20, 40);
            graphics.fillRoundedRect(x, y, width, height, 10);
            graphics.fillStyle(accentColor, 0.3);
            graphics.fillRoundedRect(x, y, width, height * 0.3, 5);
            graphics.fillStyle(platformColor, 0.4);
        }

        graphics.generateTexture(textureKey, this.worldWidth, this.worldHeight);
        graphics.destroy();
        return textureKey;
    }

    /**
     * Get star count based on biome
     */
    getStarCount() {
        const counts = {
            nebula: 200,
            stellar_reef: 150,
            crystal_caves: 80,
            void_peaks: 120,
            aurora_depths: 180
        };
        return counts[this.currentBiome] || 200;
    }

    /**
     * Get star colors based on biome
     */
    getStarColor(brightness) {
        const palette = this.biomeConfig.palette || {};
        const accent = this.hexToInt(palette.accent) || 0xFFFFFF;

        switch (this.currentBiome) {
            case 'stellar_reef':
                return brightness > 0.7 ? 0xE0F7FA : (brightness > 0.4 ? 0xB2EBF2 : 0x80DEEA);
            case 'crystal_caves':
                return brightness > 0.7 ? 0xE1BEE7 : (brightness > 0.4 ? 0xCE93D8 : 0xBA68C8);
            case 'void_peaks':
                return brightness > 0.7 ? 0xFF4500 : (brightness > 0.4 ? 0xDC143C : 0x8B0000);
            case 'aurora_depths':
                return brightness > 0.7 ? 0x7FFFD4 : (brightness > 0.4 ? 0x00FA9A : 0x00FF7F);
            default:
                return brightness > 0.7 ? 0xFFFFFF : (brightness > 0.4 ? 0xCCCCFF : 0x8888FF);
        }
    }

    /**
     * Get nebula colors based on biome
     */
    getNebulaColors() {
        const palette = this.biomeConfig.palette || {};
        const nebula = this.hexToInt(palette.nebula) || 0x9370DB;
        const accent = this.hexToInt(palette.accent) || 0xFFD54F;
        const flora = this.hexToInt(palette.flora) || 0x64B5F6;

        switch (this.currentBiome) {
            case 'stellar_reef':
                return [
                    { color: 0x00BCD4, alpha: 0.15 },
                    { color: 0x26A69A, alpha: 0.12 },
                    { color: 0x00838F, alpha: 0.10 },
                    { color: accent, alpha: 0.08 }
                ];
            case 'crystal_caves':
                return [
                    { color: 0x7B68EE, alpha: 0.18 },
                    { color: 0x9370DB, alpha: 0.15 },
                    { color: 0x00FFFF, alpha: 0.12 },
                    { color: 0xE040FB, alpha: 0.08 }
                ];
            case 'void_peaks':
                return [
                    { color: 0x4B0082, alpha: 0.20 },
                    { color: 0x8B008B, alpha: 0.15 },
                    { color: 0xFF4500, alpha: 0.10 },
                    { color: 0x000000, alpha: 0.25 }
                ];
            case 'aurora_depths':
                return [
                    { color: 0x00FF7F, alpha: 0.15 },
                    { color: 0x7FFFD4, alpha: 0.12 },
                    { color: 0xFFD700, alpha: 0.10 },
                    { color: 0x40E0D0, alpha: 0.08 }
                ];
            default:
                return [
                    { color: nebula, alpha: 0.15 },
                    { color: 0x4169E1, alpha: 0.12 },
                    { color: flora, alpha: 0.08 },
                    { color: accent, alpha: 0.10 }
                ];
        }
    }

    /**
     * Add biome-specific visual features
     */
    addBiomeFeatures(graphics, palette) {
        switch (this.currentBiome) {
            case 'stellar_reef':
                this.addCoralFormations(graphics);
                this.addBubbles(graphics);
                break;
            case 'crystal_caves':
                this.addCrystalFormations(graphics);
                this.addStalactites(graphics);
                break;
            case 'void_peaks':
                this.addVoidCracks(graphics);
                this.addDarkMountains(graphics);
                break;
            case 'aurora_depths':
                this.addAuroraWaves(graphics);
                this.addLightOrbs(graphics);
                break;
        }
    }

    addCoralFormations(graphics) {
        const colors = [0xFF6B6B, 0xFF8E8E, 0xE57373, 0xFFB3B3];
        for (let i = 0; i < 20; i++) {
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(this.worldHeight * 0.4, this.worldHeight);
            const color = Phaser.Math.RND.pick(colors);
            graphics.fillStyle(color, 0.6);
            // Branch-like coral shape
            for (let j = 0; j < 3; j++) {
                const angle = (j - 1) * 0.3;
                const length = Phaser.Math.Between(20, 60);
                graphics.fillTriangle(
                    x, y,
                    x + Math.cos(angle - Math.PI/2) * length * 0.3, y - length,
                    x + Math.cos(angle + 0.2 - Math.PI/2) * length * 0.3, y - length * 0.8
                );
            }
        }
    }

    addBubbles(graphics) {
        for (let i = 0; i < 50; i++) {
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(0, this.worldHeight);
            const size = Phaser.Math.Between(3, 12);
            graphics.fillStyle(0xE0F7FA, 0.3);
            graphics.fillCircle(x, y, size);
            graphics.lineStyle(1, 0xFFFFFF, 0.5);
            graphics.strokeCircle(x, y, size);
        }
    }

    addCrystalFormations(graphics) {
        const colors = [0x00FFFF, 0x00CED1, 0x7B68EE, 0x9370DB];
        for (let i = 0; i < 25; i++) {
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(0, this.worldHeight);
            const color = Phaser.Math.RND.pick(colors);
            const height = Phaser.Math.Between(30, 80);
            const width = Phaser.Math.Between(15, 30);

            graphics.fillStyle(color, 0.7);
            graphics.fillTriangle(x, y, x - width/2, y + height, x + width/2, y + height);

            // Glow effect
            graphics.fillStyle(color, 0.2);
            graphics.fillCircle(x, y + height/2, width * 1.5);
        }
    }

    addStalactites(graphics) {
        for (let i = 0; i < 30; i++) {
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(0, 100);
            const length = Phaser.Math.Between(40, 120);
            const width = Phaser.Math.Between(10, 25);

            graphics.fillStyle(0x2C3E50, 0.8);
            graphics.fillTriangle(x - width/2, y, x + width/2, y, x, y + length);
        }
    }

    addVoidCracks(graphics) {
        const colors = [0x4B0082, 0x8B008B, 0x9400D3];
        for (let i = 0; i < 15; i++) {
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(0, this.worldHeight);
            const color = Phaser.Math.RND.pick(colors);

            graphics.lineStyle(3, color, 0.8);
            graphics.beginPath();
            graphics.moveTo(x, y);

            let px = x, py = y;
            for (let j = 0; j < 5; j++) {
                px += Phaser.Math.Between(-50, 50);
                py += Phaser.Math.Between(20, 60);
                graphics.lineTo(px, py);
            }
            graphics.strokePath();

            // Glow
            graphics.fillStyle(color, 0.15);
            graphics.fillCircle(x, y, 30);
        }
    }

    addDarkMountains(graphics) {
        for (let i = 0; i < 8; i++) {
            const x = Phaser.Math.Between(-100, this.worldWidth + 100);
            const baseY = this.worldHeight + 50;
            const peakY = Phaser.Math.Between(this.worldHeight * 0.3, this.worldHeight * 0.7);
            const width = Phaser.Math.Between(200, 400);

            graphics.fillStyle(0x1A1A2E, 0.9);
            graphics.fillTriangle(x - width/2, baseY, x + width/2, baseY, x, peakY);
        }
    }

    addAuroraWaves(graphics) {
        const colors = [0x00FF7F, 0x7FFFD4, 0x40E0D0, 0x00CED1];
        for (let wave = 0; wave < 4; wave++) {
            const color = colors[wave];
            const y = 100 + wave * 80;

            graphics.beginPath();
            graphics.moveTo(0, y);

            for (let x = 0; x <= this.worldWidth; x += 50) {
                const waveY = y + Math.sin(x / 200 + wave) * 30;
                graphics.lineTo(x, waveY);
            }

            graphics.lineTo(this.worldWidth, this.worldHeight);
            graphics.lineTo(0, this.worldHeight);
            graphics.closePath();
            graphics.fillStyle(color, 0.08);
            graphics.fillPath();
        }
    }

    addLightOrbs(graphics) {
        const colors = [0xFFD700, 0xFFA500, 0xFF8C00, 0xFFFFFF];
        for (let i = 0; i < 30; i++) {
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(0, this.worldHeight);
            const color = Phaser.Math.RND.pick(colors);
            const size = Phaser.Math.Between(5, 15);

            // Outer glow
            graphics.fillStyle(color, 0.15);
            graphics.fillCircle(x, y, size * 2);
            // Inner orb
            graphics.fillStyle(color, 0.6);
            graphics.fillCircle(x, y, size);
        }
    }

    /**
     * Blend two colors
     */
    blendColors(color1, color2, ratio) {
        const r1 = (color1 >> 16) & 0xFF;
        const g1 = (color1 >> 8) & 0xFF;
        const b1 = color1 & 0xFF;

        const r2 = (color2 >> 16) & 0xFF;
        const g2 = (color2 >> 8) & 0xFF;
        const b2 = color2 & 0xFF;

        const r = Math.round(r1 + (r2 - r1) * ratio);
        const g = Math.round(g1 + (g2 - g1) * ratio);
        const b = Math.round(b1 + (b2 - b1) * ratio);

        return (r << 16) | (g << 8) | b;
    }

    createEnvironmentObjects() {
        const physics = this.scene.physics;
        const trees = physics.add.staticGroup();
        const rocks = physics.add.staticGroup();
        const flowers = physics.add.staticGroup();

        // Get biome-specific tints
        const floraTint = this.hexToInt(this.biomeConfig.palette?.flora) || 0xFFFFFF;
        const rockTint = this.hexToInt(this.biomeConfig.palette?.rocks) || 0x90A4AE;

        // Trees (reduced for some biomes)
        const treeCount = this.getObjectCount('trees');
        const treeVariants = ['enhancedTree_summer', 'enhancedTree_spring', 'enhancedTree_autumn'];
        const validTreeVariants = treeVariants.filter(tex => this.scene.textures.exists(tex));

        if (validTreeVariants.length > 0 && treeCount > 0) {
            for (let i = 0; i < treeCount; i++) {
                const position = this.findEnvironmentPosition(150, 72);
                if (!position) continue;
                const { x, y } = position;
                const treeType = Phaser.Math.RND.pick(validTreeVariants);
                const tree = trees.create(x, y, treeType);
                tree.setScale(Phaser.Math.FloatBetween(1.0, 1.8));
                tree.body.setSize(30, 40);
                tree.setDepth(y);
                // Apply biome tint
                if (this.currentBiome !== 'nebula') {
                    tree.setTint(this.getBiomeTreeTint());
                }
            }
        }

        // Rocks
        const rockCount = this.getObjectCount('rocks');
        for (let i = 0; i < 3; i++) {
            const textureName = `enhancedRock_${i}`;
            if (!this.scene.textures.exists(textureName)) continue;
            for (let j = 0; j < Math.ceil(rockCount / 3); j++) {
                const position = this.findEnvironmentPosition(100, 58);
                if (!position) continue;
                const { x, y } = position;
                const rock = rocks.create(x, y, textureName);
                rock.setScale(Phaser.Math.FloatBetween(1.2, 2.0));
                rock.body.setSize(25, 20);
                rock.setDepth(y);
                rock.setTint(rockTint);
            }
        }

        // Flowers
        const flowerCount = this.getObjectCount('flowers');
        if (this.scene.textures.exists('enhancedFlower') && flowerCount > 0) {
            const flowerTints = this.getFlowerTints();
            for (let i = 0; i < flowerCount; i++) {
                const x = Phaser.Math.Between(80, this.worldWidth - 80);
                const y = Phaser.Math.Between(80, this.worldHeight - 80);
                const flower = flowers.create(x, y, 'enhancedFlower');
                flower.setScale(Phaser.Math.FloatBetween(1.0, 1.5));
                flower.body.setSize(15, 20);
                flower.setDepth(y);
                flower.setTint(Phaser.Math.RND.pick(flowerTints));
            }
        }

        // Cosmic shop
        this.graphicsEngine.createCosmicShop();
        const shopX = this.worldWidth - 220;
        const shopY = this.worldHeight / 2;
        const shop = physics.add.staticSprite(shopX, shopY, 'cosmicShop');
        shop.setScale(1.3);
        shop.setDepth(shopY);
        shop.body.setSize(220, 220);
        shop.body.setOffset(-60, -60);

        return { trees, rocks, flowers, shop };
    }

    isReservedSanctuaryPosition(x, y, padding = 60) {
        if (this.currentBiome !== 'nebula') return false;

        return Object.values(this.sanctuaryZones?.zones || {}).some(zone => {
            const bounds = zone.bounds;
            return x >= bounds.x - padding &&
                x <= bounds.x + bounds.width + padding &&
                y >= bounds.y - padding &&
                y <= bounds.y + bounds.height + padding;
        });
    }

    findEnvironmentPosition(margin, reservedPadding, maxAttempts = 40) {
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            const x = Phaser.Math.Between(margin, this.worldWidth - margin);
            const y = Phaser.Math.Between(margin, this.worldHeight - margin);
            if (!this.isReservedSanctuaryPosition(x, y, reservedPadding)) {
                return { x, y };
            }
        }
        return null;
    }

    /**
     * Get object count based on biome
     */
    getObjectCount(objectType) {
        const counts = {
            nebula: { trees: 15, rocks: 30, flowers: 25 },
            stellar_reef: { trees: 0, rocks: 20, flowers: 30 },
            crystal_caves: { trees: 5, rocks: 40, flowers: 15 },
            void_peaks: { trees: 8, rocks: 35, flowers: 10 },
            aurora_depths: { trees: 12, rocks: 25, flowers: 35 }
        };

        const biome = counts[this.currentBiome] || counts.nebula;
        return biome[objectType] || 0;
    }

    /**
     * Get tree tint based on biome
     */
    getBiomeTreeTint() {
        const tints = {
            stellar_reef: 0x4DB6AC,
            crystal_caves: 0x9370DB,
            void_peaks: 0x483D8B,
            aurora_depths: 0x40916C
        };
        return tints[this.currentBiome] || 0xFFFFFF;
    }

    /**
     * Get flower tints based on biome
     */
    getFlowerTints() {
        const tints = {
            nebula: [0xFFFFFF, 0xFFB6FF, 0xB6FFFF, 0xFFFFB6, 0xFFB6B6],
            stellar_reef: [0xE0F7FA, 0xB2EBF2, 0x80DEEA, 0x4DD0E1],
            crystal_caves: [0xE1BEE7, 0xCE93D8, 0xBA68C8, 0xAB47BC],
            void_peaks: [0x7986CB, 0x5C6BC0, 0x3F51B5, 0x3949AB],
            aurora_depths: [0xA5D6A7, 0x81C784, 0x66BB6A, 0x4CAF50]
        };
        return tints[this.currentBiome] || tints.nebula;
    }

    // ==========================================
    // CAVE-SPECIFIC METHODS (Crystal Caves biome)
    // ==========================================

    /**
     * Create cave tunnel collision walls for constrained navigation
     * Player can only move within the tunnel paths
     */
    createCaveTunnels() {
        const physics = this.scene.physics;
        const tunnelWalls = physics.add.staticGroup();

        // Cave dimensions
        const caveWidth = this.worldWidth;
        const caveHeight = this.worldHeight;

        // Tunnel configuration - defines walkable paths
        // Main horizontal tunnel through center
        const tunnelHeight = 180;  // Width of walkable tunnel
        const tunnelY = caveHeight / 2;

        // Create top wall (above main tunnel)
        this.createCaveWall(tunnelWalls, 0, 0, caveWidth, tunnelY - tunnelHeight / 2);

        // Create bottom wall (below main tunnel)
        this.createCaveWall(tunnelWalls, 0, tunnelY + tunnelHeight / 2, caveWidth, caveHeight - (tunnelY + tunnelHeight / 2));

        // Add branching tunnel to the left (vertical passage)
        const leftBranchX = caveWidth * 0.25;
        const leftBranchWidth = 160;

        // Gap in top wall for left branch
        this.createCaveWall(tunnelWalls, 0, 0, leftBranchX - leftBranchWidth / 2, tunnelY - tunnelHeight / 2);
        this.createCaveWall(tunnelWalls, leftBranchX + leftBranchWidth / 2, 0, caveWidth - (leftBranchX + leftBranchWidth / 2), tunnelY - tunnelHeight / 2);

        // Add branching tunnel to the right (goes down)
        const rightBranchX = caveWidth * 0.75;
        const rightBranchWidth = 160;

        // Add small chamber at the end of left branch
        const leftChamberY = 150;
        const chamberRadius = 120;
        this.createChamberWalls(tunnelWalls, leftBranchX, leftChamberY, chamberRadius, leftBranchWidth);

        // Add small chamber at the end of right branch
        const rightChamberY = caveHeight - 150;
        this.createChamberWalls(tunnelWalls, rightBranchX, rightChamberY, chamberRadius, rightBranchWidth);

        // Gap in bottom wall for right branch
        this.createCaveWall(tunnelWalls, 0, tunnelY + tunnelHeight / 2, rightBranchX - rightBranchWidth / 2, caveHeight - (tunnelY + tunnelHeight / 2));
        this.createCaveWall(tunnelWalls, rightBranchX + rightBranchWidth / 2, tunnelY + tunnelHeight / 2, caveWidth - (rightBranchX + rightBranchWidth / 2), caveHeight - (tunnelY + tunnelHeight / 2));

        console.log('[WorldBuilder] Created cave tunnel system with collision walls');

        return {
            walls: tunnelWalls,
            spawnPoint: { x: caveWidth / 2, y: tunnelY },  // Spawn in center of main tunnel
            tunnelConfig: {
                mainTunnelY: tunnelY,
                tunnelHeight: tunnelHeight,
                leftBranch: { x: leftBranchX, chamberY: leftChamberY },
                rightBranch: { x: rightBranchX, chamberY: rightChamberY }
            }
        };
    }

    /**
     * Create a single cave wall section
     */
    createCaveWall(group, x, y, width, height) {
        if (width <= 0 || height <= 0) return null;

        // Create wall texture
        const textureKey = `caveWall_${x}_${y}_${width}_${height}`;

        if (!this.scene.textures.exists(textureKey)) {
            const graphics = this.scene.make.graphics({ add: false });

            // Dark rocky texture with variations
            graphics.fillStyle(0x1A0A20, 1);
            graphics.fillRect(0, 0, width, height);

            // Add rock texture variations
            for (let i = 0; i < Math.floor(width * height / 2000); i++) {
                const rx = Phaser.Math.Between(0, width);
                const ry = Phaser.Math.Between(0, height);
                const rw = Phaser.Math.Between(20, 60);
                const rh = Phaser.Math.Between(15, 40);
                const darkness = Phaser.Math.Between(0, 30);
                graphics.fillStyle(Phaser.Display.Color.GetColor(26 - darkness, 10 - darkness / 3, 32 - darkness), 0.8);
                graphics.fillRoundedRect(rx, ry, rw, rh, 5);
            }

            // Add some purple crystal veins
            for (let i = 0; i < Math.floor(width * height / 8000); i++) {
                const vx = Phaser.Math.Between(0, width);
                const vy = Phaser.Math.Between(0, height);
                graphics.lineStyle(2, 0x7B68EE, 0.4);
                graphics.beginPath();
                graphics.moveTo(vx, vy);
                for (let j = 0; j < 4; j++) {
                    graphics.lineTo(
                        vx + Phaser.Math.Between(-30, 30),
                        vy + Phaser.Math.Between(-30, 30)
                    );
                }
                graphics.strokePath();
            }

            graphics.generateTexture(textureKey, width, height);
            graphics.destroy();
        }

        const wall = group.create(x + width / 2, y + height / 2, textureKey);
        wall.setDepth(50);  // Above background, below characters
        wall.body.setSize(width, height);
        wall.body.setOffset(-width / 2, -height / 2);

        return wall;
    }

    /**
     * Create circular chamber walls (with opening to connect to tunnel)
     */
    createChamberWalls(group, centerX, centerY, radius, openingWidth) {
        // Create walls around chamber except for opening
        // This creates a roughly circular area to explore

        const segments = 8;
        const angleStep = (Math.PI * 2) / segments;

        for (let i = 0; i < segments; i++) {
            const angle = i * angleStep;
            const nextAngle = (i + 1) * angleStep;

            // Skip segments that would block the tunnel connection
            const midAngle = (angle + nextAngle) / 2;
            if (Math.abs(Math.sin(midAngle)) > 0.7) continue;  // Skip top/bottom openings

            const x1 = centerX + Math.cos(angle) * radius;
            const y1 = centerY + Math.sin(angle) * radius;
            const x2 = centerX + Math.cos(nextAngle) * radius;
            const y2 = centerY + Math.sin(nextAngle) * radius;

            const width = Math.abs(x2 - x1) + 30;
            const height = Math.abs(y2 - y1) + 30;
            const wx = Math.min(x1, x2) - 15;
            const wy = Math.min(y1, y2) - 15;

            this.createCaveWall(group, wx, wy, width, height);
        }
    }

    /**
     * Create cave environment (simplified - no shop)
     */
    createCaveEnvironment() {
        const physics = this.scene.physics;
        const rocks = physics.add.staticGroup();

        // Cave has lots of rocks, no trees, minimal flowers
        const rockCount = 50;
        const rockTint = 0x4A3B5C;  // Dark purple rocks

        for (let i = 0; i < 3; i++) {
            const textureName = `enhancedRock_${i}`;
            if (!this.scene.textures.exists(textureName)) continue;

            for (let j = 0; j < Math.ceil(rockCount / 3); j++) {
                const x = Phaser.Math.Between(100, this.worldWidth - 100);
                const y = Phaser.Math.Between(100, this.worldHeight - 100);
                const rock = rocks.create(x, y, textureName);
                rock.setScale(Phaser.Math.FloatBetween(0.8, 1.5));
                rock.body.setSize(25, 20);
                rock.setDepth(y);
                rock.setTint(rockTint);
            }
        }

        // Note: No shop in cave biomes - player must return to sanctuary

        console.log('[WorldBuilder] Created cave environment (no shop)');

        return {
            trees: physics.add.staticGroup(),  // Empty - no trees in caves
            rocks,
            flowers: physics.add.staticGroup(),  // Empty - minimal flora
            shop: null  // No shop in caves
        };
    }

    /**
     * Create cave-specific visual elements
     * Glowing crystals, flames, and bat creatures
     */
    createCaveElements() {
        const elements = {
            glowingCrystals: [],
            flames: [],
            batCreatures: []
        };

        // Create glowing crystals scattered around the cave
        const crystalCount = 25;
        for (let i = 0; i < crystalCount; i++) {
            const crystal = this.createGlowingCrystal(
                Phaser.Math.Between(100, this.worldWidth - 100),
                Phaser.Math.Between(100, this.worldHeight - 100)
            );
            elements.glowingCrystals.push(crystal);
        }

        // Create flame light sources on walls
        const flameCount = 12;
        for (let i = 0; i < flameCount; i++) {
            // Place flames along the tunnel walls
            const x = Phaser.Math.Between(150, this.worldWidth - 150);
            const y = this.worldHeight / 2 + (i % 2 === 0 ? -80 : 80);  // Top or bottom of tunnel
            const flame = this.createCaveFlame(x, y);
            elements.flames.push(flame);
        }

        // Create bat-like creatures that flutter around
        const batCount = 8;
        for (let i = 0; i < batCount; i++) {
            const bat = this.createBatCreature(
                Phaser.Math.Between(200, this.worldWidth - 200),
                Phaser.Math.Between(150, this.worldHeight - 150)
            );
            elements.batCreatures.push(bat);
        }

        console.log('[WorldBuilder] Created cave elements: crystals, flames, bat creatures');

        return elements;
    }

    /**
     * Create a glowing crystal with pulsing light effect
     */
    createGlowingCrystal(x, y) {
        const graphics = this.scene.add.graphics();

        // Crystal colors
        const colors = [0x00FFFF, 0x7B68EE, 0xE040FB, 0x9370DB];
        const color = Phaser.Math.RND.pick(colors);

        const height = Phaser.Math.Between(30, 70);
        const width = Phaser.Math.Between(10, 25);

        // Outer glow (larger, more transparent)
        graphics.fillStyle(color, 0.2);
        graphics.fillCircle(0, 0, width * 2.5);

        // Middle glow
        graphics.fillStyle(color, 0.4);
        graphics.fillCircle(0, 0, width * 1.5);

        // Crystal shape (pointing up or down randomly)
        const pointUp = Math.random() > 0.5;
        graphics.fillStyle(color, 0.9);
        if (pointUp) {
            graphics.fillTriangle(-width / 2, height / 2, width / 2, height / 2, 0, -height / 2);
        } else {
            graphics.fillTriangle(-width / 2, -height / 2, width / 2, -height / 2, 0, height / 2);
        }

        // Inner highlight
        graphics.fillStyle(0xFFFFFF, 0.5);
        if (pointUp) {
            graphics.fillTriangle(-width / 4, height / 4, width / 6, height / 4, 0, -height / 4);
        } else {
            graphics.fillTriangle(-width / 4, -height / 4, width / 6, -height / 4, 0, height / 4);
        }

        graphics.setPosition(x, y);
        graphics.setDepth(y - 1);

        // Pulsing glow animation
        this.scene.tweens.add({
            targets: graphics,
            alpha: { from: 0.6, to: 1.0 },
            scaleX: { from: 0.95, to: 1.05 },
            scaleY: { from: 0.95, to: 1.05 },
            duration: Phaser.Math.Between(1500, 3000),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        return graphics;
    }

    /**
     * Create a flame light source on cave wall
     */
    createCaveFlame(x, y) {
        const container = this.scene.add.container(x, y);

        // Flame glow circle
        const glow = this.scene.add.graphics();
        glow.fillStyle(0xFF6600, 0.3);
        glow.fillCircle(0, 0, 60);
        glow.fillStyle(0xFFAA00, 0.2);
        glow.fillCircle(0, 0, 40);
        container.add(glow);

        // Flame shape
        const flame = this.scene.add.graphics();
        flame.fillStyle(0xFF4500, 0.9);
        flame.fillTriangle(-12, 10, 12, 10, 0, -25);
        flame.fillStyle(0xFFA500, 0.9);
        flame.fillTriangle(-8, 8, 8, 8, 0, -18);
        flame.fillStyle(0xFFD700, 0.9);
        flame.fillTriangle(-4, 5, 4, 5, 0, -10);
        container.add(flame);

        container.setDepth(y);

        // Flicker animation
        this.scene.tweens.add({
            targets: flame,
            scaleX: { from: 0.9, to: 1.1 },
            scaleY: { from: 0.85, to: 1.15 },
            alpha: { from: 0.8, to: 1.0 },
            duration: 150,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Glow pulse
        this.scene.tweens.add({
            targets: glow,
            alpha: { from: 0.7, to: 1.0 },
            scaleX: { from: 0.95, to: 1.05 },
            scaleY: { from: 0.95, to: 1.05 },
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        return container;
    }

    /**
     * Create a bat-like cave creature that flutters around
     */
    createBatCreature(x, y) {
        const graphics = this.scene.add.graphics();

        // Bat body (dark purple)
        graphics.fillStyle(0x2D1B3D, 1);
        graphics.fillEllipse(0, 0, 20, 15);

        // Wings (spread)
        graphics.fillStyle(0x3D2B4D, 0.9);
        // Left wing
        graphics.fillTriangle(-8, 0, -35, -10, -25, 10);
        // Right wing
        graphics.fillTriangle(8, 0, 35, -10, 25, 10);

        // Eyes (glowing purple)
        graphics.fillStyle(0xE040FB, 1);
        graphics.fillCircle(-5, -3, 3);
        graphics.fillCircle(5, -3, 3);

        // Eye glow
        graphics.fillStyle(0xE040FB, 0.3);
        graphics.fillCircle(-5, -3, 5);
        graphics.fillCircle(5, -3, 5);

        graphics.setPosition(x, y);
        graphics.setDepth(900);  // Above most things

        // Store original position for patrol
        graphics.originX = x;
        graphics.originY = y;

        // Wing flap animation
        this.scene.tweens.add({
            targets: graphics,
            scaleY: { from: 0.9, to: 1.1 },
            duration: 100,
            yoyo: true,
            repeat: -1
        });

        // Patrol movement - flutter around in area
        this.createBatPatrol(graphics);

        return graphics;
    }

    /**
     * Create patrol behavior for bat creature
     */
    createBatPatrol(bat) {
        const patrolRange = 150;

        const moveToNewPosition = () => {
            const newX = bat.originX + Phaser.Math.Between(-patrolRange, patrolRange);
            const newY = bat.originY + Phaser.Math.Between(-patrolRange / 2, patrolRange / 2);

            this.scene.tweens.add({
                targets: bat,
                x: newX,
                y: newY,
                duration: Phaser.Math.Between(2000, 4000),
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    this.scene.time.delayedCall(Phaser.Math.Between(500, 1500), moveToNewPosition);
                }
            });
        };

        // Start patrol after random delay
        this.scene.time.delayedCall(Phaser.Math.Between(0, 2000), moveToNewPosition);
    }

    /**
     * Create warning signs around the void portal
     * Caution triangles and danger text to warn players
     */
    createVoidWarningSigns(centerX, centerY, depth) {
        const signs = [];

        // Create warning triangle texture if it doesn't exist
        if (!this.scene.textures.exists('warningTriangle')) {
            const graphics = this.scene.make.graphics({ add: false });

            // Yellow warning triangle with black border
            const size = 32;

            // Outer black border
            graphics.fillStyle(0x000000, 1);
            graphics.fillTriangle(size/2, 2, 2, size - 2, size - 2, size - 2);

            // Yellow fill
            graphics.fillStyle(0xFFD700, 1);
            graphics.fillTriangle(size/2, 6, 6, size - 5, size - 6, size - 5);

            // Exclamation mark
            graphics.fillStyle(0x000000, 1);
            graphics.fillRect(size/2 - 2, 12, 4, 10);
            graphics.fillCircle(size/2, 26, 2);

            graphics.generateTexture('warningTriangle', size, size);
            graphics.destroy();
        }

        // Create caution tape texture if it doesn't exist
        if (!this.scene.textures.exists('cautionStripe')) {
            const graphics = this.scene.make.graphics({ add: false });
            const stripeWidth = 60;
            const stripeHeight = 8;

            // Yellow and black diagonal stripes
            graphics.fillStyle(0xFFD700, 1);
            graphics.fillRect(0, 0, stripeWidth, stripeHeight);

            graphics.fillStyle(0x000000, 1);
            for (let i = -stripeHeight; i < stripeWidth; i += 12) {
                graphics.beginPath();
                graphics.moveTo(i, 0);
                graphics.lineTo(i + stripeHeight, stripeHeight);
                graphics.lineTo(i + stripeHeight + 6, stripeHeight);
                graphics.lineTo(i + 6, 0);
                graphics.closePath();
                graphics.fillPath();
            }

            graphics.generateTexture('cautionStripe', stripeWidth, stripeHeight);
            graphics.destroy();
        }

        // Place warning triangles around the portal
        const radius = 65;
        const angles = [
            Math.PI * 0.75,   // Top-left
            Math.PI * 0.25,   // Top-right
            Math.PI * 1.25,   // Bottom-left
            Math.PI * 1.75    // Bottom-right
        ];

        angles.forEach((angle, i) => {
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;

            const triangle = this.scene.add.sprite(x, y, 'warningTriangle');
            triangle.setDepth(depth);
            triangle.setScale(0.8);

            // Pulsing animation for urgency
            this.scene.tweens.add({
                targets: triangle,
                alpha: { from: 0.7, to: 1 },
                scaleX: { from: 0.75, to: 0.85 },
                scaleY: { from: 0.75, to: 0.85 },
                duration: 800 + i * 100, // Staggered timing
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            signs.push(triangle);
        });

        // Add "DANGER" text above the portal
        const dangerText = this.scene.add.text(centerX, centerY - 55, '⚠️ DANGER', {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(depth + 1);

        // Flashing danger text
        this.scene.tweens.add({
            targets: dangerText,
            alpha: { from: 0.6, to: 1 },
            duration: 500,
            yoyo: true,
            repeat: -1
        });

        signs.push(dangerText);

        // Add small caution stripes on sides
        const leftStripe = this.scene.add.sprite(centerX - 55, centerY, 'cautionStripe');
        leftStripe.setDepth(depth);
        leftStripe.setAngle(90);
        leftStripe.setScale(0.8);
        signs.push(leftStripe);

        const rightStripe = this.scene.add.sprite(centerX + 55, centerY, 'cautionStripe');
        rightStripe.setDepth(depth);
        rightStripe.setAngle(90);
        rightStripe.setScale(0.8);
        signs.push(rightStripe);

        console.log('[WorldBuilder] Created warning signs around void portal');

        return signs;
    }

    destroy() {
        this.villageHeart?.pulseTween?.stop?.();
        this.villageHeart?.heartArtworkTween?.stop?.();
        this.villageHeart?.buildingTweens?.forEach(tween => tween?.stop?.());
        this.clearVillageCommunityMoment(this.villageHeart);
        this.villageHeart?.productionTweens?.forEach(tween => tween?.stop?.());
        this.villageHeart?.productionMoments?.forEach(
            moment => moment?.destroy?.(true)
        );
        this.villageHeart?.activeBuildingMomentTween?.stop?.();
        this.villageHeart?.activeBuildingMoment?.destroy?.(true);
        this.villageHeart?.buildingElements?.forEach(
            element => element?.destroy?.(true)
        );
        this.villageHeart?.zone?.destroy?.();
        this.villageHeart?.plotHitZones?.forEach(zone => zone?.destroy?.());
        this.villageHeart?.districtTerrain?.destroy?.();
        this.villageHeart?.currentPaths?.destroy?.();
        this.villageHeart?.heart?.destroy?.();
        this.villageHeart?.heartArtwork?.destroy?.();
        this.villageHeart?.glow?.destroy?.();
        this.villageHeart?.actionLabel?.destroy?.();
        this.villageHeart?.label?.destroy?.();
        this.villageHeart?.statusLabel?.destroy?.();
        this.villageHeart = null;
        this.signalGarden?.pulseTween?.stop();
        this.signalGarden?.communityPulseTween?.stop();
        this.signalGarden?.culturePulseTween?.stop();
        this.signalGarden?.cultureElements?.forEach(
            element => element?.destroy?.()
        );
        this.signalGarden?.residents?.forEach(resident => {
            resident.pulseTween?.stop?.();
            resident.container?.destroy?.(true);
            resident.zone?.destroy?.();
        });
        this.signalGarden?.guardianSocialTimer?.remove?.();
        this.clearGuardianResidentSocialMoment(this.signalGarden);
        this.signalGarden?.guardianResidents?.forEach(resident => {
            resident.moveTween?.stop?.();
            resident.idleTween?.stop?.();
            resident.routineTween?.stop?.();
            resident.ambientTween?.stop?.();
            resident.ambientTimer?.remove?.();
            resident.routineTimer?.remove?.();
            resident.container?.destroy?.(true);
            resident.zone?.destroy?.();
        });
        this.signalGarden?.rescuedResidents?.forEach(resident => {
            resident.moveTween?.stop?.();
            resident.idleTween?.stop?.();
            resident.container?.destroy?.(true);
            resident.zone?.destroy?.();
        });
        this.signalGarden?.currentVeilAnchors?.forEach(anchor => {
            anchor.pulseTween?.stop?.();
            anchor.container?.destroy?.(true);
            anchor.zone?.destroy?.();
        });
        this.signalGarden?.currentVeilNetwork?.destroy?.();
        this.signalGarden?.zone?.destroy();
        this.signalGarden?.bed?.destroy();
        this.signalGarden?.growth?.destroy();
        this.signalGarden?.community?.destroy();
        this.signalGarden?.label?.destroy();
        this.signalGarden = null;
        this.backgroundImage?.destroy();
        this.backgroundImage = null;
        this.debugGraphics?.destroy();
        this.debugGraphics = null;
    }
}

export default WorldBuilder;
