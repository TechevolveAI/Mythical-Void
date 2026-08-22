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
    VILLAGE_BUILDING_DEFINITIONS,
    VILLAGE_PLOTS,
    VILLAGE_WORLD_ARTWORK
} from '../VillageSettlement.js';
import {
    SANCTUARY_FLORA_PLACEMENTS,
    SANCTUARY_WORLD_ART
} from './SanctuaryWorldArt.js';

const VILLAGE_SETTLEMENT_LAYOUTS = Object.freeze({
    compact: Object.freeze({
        profile: 'terraced_current_v2',
        heartArtworkSize: 132,
        buildingArtworkScale: 0.48,
        plotOffsets: Object.freeze([
            Object.freeze({ x: -112, y: -226 }),
            Object.freeze({ x: 112, y: -226 }),
            Object.freeze({ x: -128, y: -72 }),
            Object.freeze({ x: 128, y: -72 }),
            Object.freeze({ x: 0, y: 148 })
        ])
    }),
    expanded: Object.freeze({
        profile: 'commons_spine_v1',
        heartArtworkSize: 202,
        buildingArtworkScale: 0.84,
        plotOffsets: Object.freeze([
            Object.freeze({ x: 210, y: -176 }),
            Object.freeze({ x: 430, y: -132 }),
            Object.freeze({ x: 238, y: 124 }),
            Object.freeze({ x: 474, y: 136 }),
            Object.freeze({ x: 545, y: -4 })
        ])
    })
});

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
        const sanctuaryDistricts = this.createSanctuaryDistrictEnvironment();

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
        const sanctuaryCommons = this.createSanctuaryCommons({
            signalGarden: landmarks.signalGarden,
            villageHeart: landmarks.villageHeart,
            hubPortal: landmarks.hubPortal
        });
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
            sanctuaryCommons,
            signalGarden,
            villageHeartLandmark,
            sanctuaryKeepsakes,
            kinshipBeacon,
            fusionPodLandmark,
            sanctuaryDistricts
        };
    }

    createSanctuaryDistrictEnvironment() {
        const zones = this.sanctuaryZones.zones;
        const landmarks = this.sanctuaryZones.landmarks;
        const terrain = this.scene.add.graphics()
            .setDepth(-24)
            .setData('sanctuaryDistrictTerrain', true)
            .setData('sanctuaryDistrictVisualProfile', 'woven_edge_contours_v4')
            .setData('sanctuaryDistrictFullZoneFill', false)
            .setData('sanctuaryDistrictMaxFillAlpha', 0.08);
        const routes = this.scene.add.graphics()
            .setDepth(-23)
            .setData('sanctuaryPhysicalRoutes', true)
            .setData('sanctuaryRouteProfile', 'living_current_filaments_v3')
            .setData('sanctuaryRouteMaxWidth', 28);

        let contourSegmentCount = 0;
        let anchorPatchCount = 0;
        const drawDistrictContours = (zone, colors, scale = 1) => {
            const { center, bounds } = zone;
            const width = bounds.width * scale;
            const height = bounds.height * scale;
            const contourArcs = [
                { start: 0.03, end: 0.17, radius: 0.92 },
                { start: 0.29, end: 0.43, radius: 0.76 },
                { start: 0.53, end: 0.69, radius: 0.9 },
                { start: 0.79, end: 0.94, radius: 0.72 }
            ];

            contourArcs.forEach(({ start, end, radius }, arcIndex) => {
                const points = Array.from({ length: 10 }, (_, pointIndex) => {
                    const progress = pointIndex / 9;
                    const angle = Math.PI * 2 * (start + ((end - start) * progress));
                    return {
                        x: center.x + Math.cos(angle) * width * 0.44 * radius,
                        y: center.y + Math.sin(angle) * height * 0.29 * radius
                    };
                });
                const stroke = (lineWidth, color, alpha) => {
                    terrain.lineStyle(lineWidth, color, alpha);
                    terrain.beginPath();
                    terrain.moveTo(points[0].x, points[0].y);
                    points.slice(1).forEach(point => terrain.lineTo(point.x, point.y));
                    terrain.strokePath();
                };
                stroke(arcIndex % 2 ? 7 : 5, colors.shadow, 0.07);
                stroke(2, colors.edge, arcIndex % 2 ? 0.18 : 0.22);
                contourSegmentCount += 1;
            });

            [0.12, 0.36, 0.61, 0.85].forEach((progress, patchIndex) => {
                const angle = Math.PI * 2 * progress;
                const x = center.x + Math.cos(angle) * width * 0.35;
                const y = center.y + Math.sin(angle) * height * 0.22;
                const patchWidth = 14 + ((patchIndex % 2) * 7);
                terrain.fillStyle(colors.ground, patchIndex % 2 ? 0.08 : 0.06);
                terrain.fillEllipse(x, y, patchWidth, patchIndex % 2 ? 8 : 6);
                terrain.fillStyle(colors.edge, 0.2);
                terrain.fillCircle(x + (patchIndex % 2 ? 6 : -5), y - 2, 1.5);
                anchorPatchCount += 1;
            });
        };

        drawDistrictContours(zones.crashSite, {
            shadow: 0x05090A,
            ground: 0x293438,
            edge: 0x8BA3AA
        }, 1.04);
        drawDistrictContours(zones.livingArea, {
            shadow: 0x071411,
            ground: 0x163B35,
            edge: 0x71E6B1
        }, 1.05);
        drawDistrictContours(zones.shopArea, {
            shadow: 0x080D0D,
            ground: 0x263D38,
            edge: 0xF2C14E
        }, 0.95);
        drawDistrictContours(zones.hubGate, {
            shadow: 0x070912,
            ground: 0x24233D,
            edge: 0xBFA6FF
        }, 1.04);
        drawDistrictContours(zones.gardenPlot, {
            shadow: 0x071411,
            ground: 0x1B4435,
            edge: 0x8FE3CF
        }, 1.02);
        drawDistrictContours(zones.trainingGrounds, {
            shadow: 0x100A0A,
            ground: 0x342A2A,
            edge: 0xD94B4B
        }, 0.96);
        terrain
            .setData('sanctuaryDistrictContourCount', contourSegmentCount)
            .setData('sanctuaryDistrictAnchorPatchCount', anchorPatchCount);

        const routeDefinitions = [
            {
                id: 'crash_to_commons',
                start: landmarks.crashedShip.position,
                end: zones.livingArea.center,
                accent: 0x90A4AE
            },
            {
                id: 'commons_to_shop',
                start: zones.livingArea.center,
                end: landmarks.cosmicShop.position,
                accent: 0xF2C14E
            },
            {
                id: 'commons_to_settlement',
                start: zones.livingArea.center,
                end: landmarks.villageHeart.position,
                accent: 0x71E6B1
            },
            {
                id: 'commons_to_training',
                start: zones.livingArea.center,
                end: landmarks.targetRange.position,
                accent: 0xD94B4B
            }
        ];
        routes.setData(
            'sanctuaryRouteIds',
            routeDefinitions.map(route => route.id)
        );
        routeDefinitions.forEach(({ start, end, accent }, routeIndex) => {
            const midpoint = {
                x: (start.x + end.x) / 2 + (routeIndex % 2 ? 34 : -26),
                y: (start.y + end.y) / 2 + (routeIndex % 2 ? 62 : -54)
            };
            const points = Array.from({ length: 28 }, (_, index) => {
                const t = index / 27;
                const inverse = 1 - t;
                return {
                    x: (inverse * inverse * start.x) +
                        (2 * inverse * t * midpoint.x) +
                        (t * t * end.x),
                    y: (inverse * inverse * start.y) +
                        (2 * inverse * t * midpoint.y) +
                        (t * t * end.y)
                };
            });
            const stroke = (width, color, alpha) => {
                routes.lineStyle(width, color, alpha);
                routes.beginPath();
                routes.moveTo(points[0].x, points[0].y);
                points.slice(1).forEach(point => routes.lineTo(point.x, point.y));
                routes.strokePath();
            };
            stroke(28, 0x07100F, 0.11);
            stroke(16, 0x1C3532, 0.2);
            stroke(3, accent, routeIndex < 2 ? 0.2 : 0.28);
            stroke(1, 0xF4F4F4, 0.12);
            [0.18, 0.36, 0.58, 0.78].forEach((progress, detailIndex) => {
                const point = points[Math.round(progress * (points.length - 1))];
                const side = detailIndex % 2 ? 1 : -1;
                routes.fillStyle(
                    detailIndex % 2 ? accent : 0x8FE3CF,
                    detailIndex % 2 ? 0.3 : 0.22
                );
                routes.fillEllipse(
                    point.x + side * 11,
                    point.y - side * 7,
                    detailIndex % 2 ? 9 : 6,
                    detailIndex % 2 ? 4 : 3
                );
            });
        });

        // Crash scars establish the human arrival without another floating label.
        const ship = landmarks.crashedShip.position;
        terrain.lineStyle(8, 0x111A1D, 0.34);
        [-32, 0, 38].forEach((offset, index) => {
            terrain.beginPath();
            terrain.moveTo(ship.x - 120, ship.y + offset);
            terrain.lineTo(ship.x - 210 - (index * 24), ship.y + offset + 42);
            terrain.strokePath();
        });

        // Civic markings make the training district legible without UI chrome.
        const range = zones.trainingGrounds;
        [0xD94B4B, 0xF4F4F4, 0x101616, 0x3FAE62].forEach((color, index) => {
            terrain.fillStyle(color, index === 2 ? 0.34 : 0.42);
            terrain.fillRect(
                range.bounds.x + 42 + (index * 36),
                range.bounds.y + range.bounds.height - 48,
                24,
                7
            );
        });

        const flora = SANCTUARY_FLORA_PLACEMENTS.flatMap((placement, index) => {
            const artwork = SANCTUARY_WORLD_ART[placement.artwork];
            const zone = zones[placement.zone];
            if (!artwork || !zone || !this.scene.textures.exists(artwork.key)) return [];
            const x = zone.center.x + placement.offsetX;
            const y = zone.center.y + placement.offsetY;
            const image = this.scene.add.image(x, y, artwork.key)
                .setDisplaySize(
                    placement.width,
                    placement.artwork === 'listeningReeds'
                        ? placement.width * 0.667
                        : placement.width
                )
                .setFlipX(placement.flipX)
                .setDepth(y - 4)
                .setAlpha(0.97)
                .setData('sanctuaryFlora', placement.artwork);
            image.sanctuaryBaseScaleX = image.scaleX;
            image.sanctuaryBaseScaleY = image.scaleY;
            const tween = this.scene.tweens.add({
                targets: image,
                alpha: { from: 0.9, to: 0.98 },
                scaleY: {
                    from: image.sanctuaryBaseScaleY * 0.992,
                    to: image.sanctuaryBaseScaleY * 1.008
                },
                duration: 2500 + (index * 177),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            return [{ image, tween }];
        });

        const districtDefinitions = [
            {
                zoneId: 'crashSite',
                label: 'CRASH SITE',
                x: zones.crashSite.center.x,
                y: zones.crashSite.bounds.y + zones.crashSite.bounds.height - 12,
                tone: 0x90A4AE
            },
            {
                zoneId: 'livingArea',
                label: 'LIVING COMMONS',
                x: zones.livingArea.center.x,
                y: zones.livingArea.bounds.y + zones.livingArea.bounds.height - 18,
                tone: 0x71E6B1
            },
            {
                zoneId: 'shopArea',
                label: 'SUPPLY DOCK',
                x: zones.shopArea.bounds.x + 28,
                y: zones.shopArea.center.y,
                tone: 0xF2C14E,
                vertical: true
            },
            {
                zoneId: 'hubGate',
                label: 'EXPEDITION GATE',
                x: zones.hubGate.center.x,
                y: zones.hubGate.bounds.y + 10,
                tone: 0xBFA6FF
            },
            {
                zoneId: 'gardenPlot',
                label: 'SIGNAL GARDEN',
                x: zones.gardenPlot.center.x,
                y: zones.gardenPlot.bounds.y + 14,
                tone: 0x8FE3CF
            },
            {
                zoneId: 'settlementDistrict',
                label: 'FEND SETTLEMENT',
                x: zones.settlementDistrict.center.x,
                y: zones.settlementDistrict.bounds.y + 16,
                tone: 0x71E6B1
            },
            {
                zoneId: 'trainingGrounds',
                label: 'TRAINING RING',
                x: zones.trainingGrounds.bounds.x + 30,
                y: zones.trainingGrounds.bounds.y + zones.trainingGrounds.bounds.height - 18,
                tone: 0xD94B4B
            }
        ];
        const markers = districtDefinitions.map(definition => {
            const width = Math.max(126, definition.label.length * 8 + 44);
            const line = this.scene.add.graphics();
            line.lineStyle(2, definition.tone, 0.56);
            line.lineBetween(-width / 2, 0, -18, 0);
            line.lineBetween(18, 0, width / 2, 0);
            line.fillStyle(0x071411, 0.94);
            line.fillCircle(0, 0, 8);
            line.lineStyle(2, definition.tone, 0.82);
            line.strokeCircle(0, 0, 6);
            line.fillStyle(0xF4F4F4, 0.9);
            line.fillCircle(0, 0, 2);
            const label = this.scene.add.text(0, 14, definition.label, {
                fontSize: '11px',
                fontFamily: 'Arial, sans-serif',
                color: '#F4F4F4',
                fontStyle: 'bold',
                stroke: '#050505',
                strokeThickness: 4
            }).setOrigin(0.5, 0).setAlpha(0);
            const container = this.scene.add.container(
                definition.x,
                definition.y,
                [line, label]
            )
                .setDepth(definition.y - 2)
                .setAlpha(0.18)
                .setData('sanctuaryDistrictMarker', definition.zoneId)
                .setData('sanctuaryDistrictLabel', definition.label);
            if (definition.vertical) {
                line.setAngle(90);
                label.setPosition(24, -6).setOrigin(0, 0.5);
            }
            return {
                ...definition,
                container,
                line,
                label,
                focusTween: null,
                labelTween: null
            };
        });

        const districts = {
            terrain,
            routes,
            flora,
            markers,
            activeZoneId: null
        };
        this.sanctuaryDistricts = districts;
        return districts;
    }

    setSanctuaryDistrictFocus(
        districts,
        zoneId,
        { immediate = false } = {}
    ) {
        if (!districts?.markers || districts.activeZoneId === zoneId) {
            return false;
        }
        districts.activeZoneId = zoneId || null;
        districts.markers.forEach(marker => {
            marker.focusTween?.stop?.();
            marker.labelTween?.stop?.();
            marker.focusTween = null;
            marker.labelTween = null;
            const active = marker.zoneId === zoneId;
            const alpha = active ? 0.82 : 0.18;
            const scale = active ? 1.04 : 1;
            marker.label.setColor(active ? '#FFFFFF' : '#C4CFCC');
            if (immediate || !this.scene?.tweens) {
                marker.container.setAlpha(alpha).setScale(scale);
                marker.label.setAlpha(active ? 1 : 0);
                return;
            }
            marker.focusTween = this.scene.tweens.add({
                targets: marker.container,
                alpha,
                scaleX: scale,
                scaleY: scale,
                duration: 260,
                ease: 'Sine.easeOut'
            });
            marker.labelTween = this.scene.tweens.add({
                targets: marker.label,
                alpha: active ? 1 : 0,
                duration: active ? 220 : 140,
                ease: 'Sine.easeOut'
            });
        });
        return true;
    }

    createSanctuaryCommons({ signalGarden, villageHeart, hubPortal } = {}) {
        const garden = signalGarden?.position;
        const heart = villageHeart?.position;
        const portal = hubPortal?.position;
        if (!garden || !heart || !portal) return null;

        const baseDepth = Math.min(garden.y, heart.y, portal.y) - 64;
        const terrain = this.scene.add.graphics()
            .setDepth(baseDepth)
            .setData('sanctuaryCommons', true)
            .setData('sanctuaryCommonsPathProfile', 'living_current_filaments_v3')
            .setData('sanctuaryCommonsMaxWidth', 32);
        const routes = [
            {
                id: 'garden_to_heart',
                start: garden,
                control: {
                    x: (garden.x + heart.x) / 2,
                    y: Math.min(garden.y, heart.y) - 82
                },
                end: heart,
                color: 0x71E6B1
            },
            {
                id: 'heart_to_portal',
                start: heart,
                control: {
                    x: (heart.x + portal.x) / 2,
                    y: Math.max(heart.y, portal.y) + 88
                },
                end: portal,
                color: 0x8FE3CF
            }
        ];
        const path = this.scene.add.graphics()
            .setDepth(baseDepth + 8)
            .setData('sanctuaryCurrentRoutes', routes.map(route => route.id));
        const pointOnRoute = (route, progress) => {
            const inverse = 1 - progress;
            return {
                x: (inverse * inverse * route.start.x) +
                    (2 * inverse * progress * route.control.x) +
                    (progress * progress * route.end.x),
                y: (inverse * inverse * route.start.y) +
                    (2 * inverse * progress * route.control.y) +
                    (progress * progress * route.end.y)
            };
        };
        routes.forEach((route, routeIndex) => {
            const points = Array.from({ length: 25 }, (_, index) => (
                pointOnRoute(route, index / 24)
            ));
            const strokeGround = (width, color, alpha) => {
                terrain.lineStyle(width, color, alpha);
                terrain.beginPath();
                terrain.moveTo(points[0].x, points[0].y);
                points.slice(1).forEach(point => terrain.lineTo(point.x, point.y));
                terrain.strokePath();
            };
            strokeGround(32, 0x071411, routeIndex === 0 ? 0.1 : 0.08);
            strokeGround(18, routeIndex === 0 ? 0x173D36 : 0x12352F, 0.18);
            [0.18, 0.42, 0.67, 0.86].forEach((progress, detailIndex) => {
                const detail = pointOnRoute(route, progress);
                terrain.fillStyle(
                    detailIndex % 2 ? 0x3FAE62 : 0x8FE3CF,
                    detailIndex % 2 ? 0.14 : 0.1
                );
                terrain.fillEllipse(
                    detail.x + (detailIndex % 2 ? 9 : -7),
                    detail.y + (detailIndex % 2 ? 6 : -5),
                    detailIndex % 2 ? 18 : 11,
                    detailIndex % 2 ? 7 : 5
                );
            });
        });
        routes.forEach(route => {
            const points = Array.from({ length: 25 }, (_, index) => (
                pointOnRoute(route, index / 24)
            ));
            const stroke = (width, color, alpha) => {
                path.lineStyle(width, color, alpha);
                path.beginPath();
                path.moveTo(points[0].x, points[0].y);
                points.slice(1).forEach(point => path.lineTo(point.x, point.y));
                path.strokePath();
            };
            stroke(7, 0x071411, 0.16);
            stroke(2, route.color, 0.34);
            stroke(1, 0xF4F4F4, 0.26);
        });
        path.setBlendMode?.(Phaser.BlendModes.ADD);

        const nodes = [garden, heart, portal].map((position, index) => {
            const node = this.scene.add.graphics()
                .setPosition(position.x, position.y)
                .setDepth(baseDepth + 10)
                .setData('sanctuaryCurrentNode', index);
            node.fillStyle(0x071411, 0.86);
            node.fillCircle(0, 0, index === 1 ? 12 : 9);
            node.lineStyle(2, index === 1 ? 0xF2C14E : 0x71E6B1, 0.84);
            node.strokeCircle(0, 0, index === 1 ? 10 : 7);
            node.fillStyle(0xF4F4F4, 0.9);
            node.fillCircle(0, 0, 2);
            node.setBlendMode?.(Phaser.BlendModes.ADD);
            return node;
        });

        const signals = [];
        const signalTweens = [];
        routes.forEach((route, routeIndex) => {
            [0, 1].forEach(signalIndex => {
                const signal = this.scene.add.circle(
                    route.start.x,
                    route.start.y,
                    signalIndex === 0 ? 3 : 2,
                    route.color,
                    0.78
                ).setDepth(baseDepth + 11)
                    .setData('sanctuaryCurrentSignal', route.id);
                signal.setBlendMode?.(Phaser.BlendModes.ADD);
                const progress = { value: 0 };
                const tween = this.scene.tweens.add({
                    targets: progress,
                    value: 1,
                    delay: (routeIndex * 420) + (signalIndex * 1250),
                    duration: 3400 + (routeIndex * 500),
                    repeat: -1,
                    ease: 'Sine.easeInOut',
                    onUpdate: () => {
                        const point = pointOnRoute(route, progress.value);
                        signal.setPosition(point.x, point.y);
                        signal.setAlpha(0.2 + Math.sin(progress.value * Math.PI) * 0.58);
                    }
                });
                signals.push(signal);
                signalTweens.push(tween);
            });
        });

        const commons = {
            terrain,
            path,
            nodes,
            signals,
            signalTweens,
            routes
        };
        this.sanctuaryCommons = commons;
        return commons;
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
            .setDepth(-21);
        const currentPaths = this.scene.add.graphics()
            .setPosition(x, y)
            .setDepth(-20);
        const districtEcology = this.scene.add.graphics()
            .setPosition(x, y)
            .setDepth(-19);
        const districtPulse = this.scene.add.graphics()
            .setPosition(x, y)
            .setDepth(-18);
        districtPulse.setBlendMode?.(Phaser.BlendModes.ADD);
        const districtThresholds = this.scene.add.graphics()
            .setPosition(x, y)
            .setDepth(-17);
        const heart = this.scene.add.graphics().setPosition(x, y).setDepth(y + 2);
        const heartCaption = this.scene.add.graphics()
            .setPosition(x, y)
            .setDepth(y + 3);
        const heartArtwork = this.scene.textures.exists(VILLAGE_WORLD_ARTWORK.heart.key)
            ? this.scene.add.image(x, y - 22, VILLAGE_WORLD_ARTWORK.heart.key)
                .setDisplaySize(228, 228)
                .setDepth(y + 2)
            : null;
        if (heartArtwork) heartArtwork.villageBaseScale = heartArtwork.scaleX;
        const glow = this.scene.add.graphics().setPosition(x, y).setDepth(y + 1);
        const restorationRoots = this.scene.add.graphics()
            .setPosition(x, y)
            .setDepth(y + 1.5);
        const heartLifeAura = this.scene.add.graphics()
            .setPosition(x, y - 22)
            .setDepth(y + 1.75);
        const heartLifeOrbit = this.scene.add.graphics()
            .setPosition(x, y - 22)
            .setDepth(y + 3);
        const heartLifeCrown = this.scene.add.graphics()
            .setPosition(x, y - 22)
            .setDepth(y + 3.1);
        const heartLifeCore = this.scene.add.circle(
            x,
            y - 22,
            4,
            0xF4F4F4,
            0
        ).setDepth(y + 3.2);
        const heartDeliveryPulse = this.scene.add.graphics()
            .setPosition(x, y - 6)
            .setDepth(y + 3.3)
            .setAlpha(0);
        const actionLabel = this.scene.add.text(x, y - 126, 'OPEN PLAN', {
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
            districtEcology,
            districtPulse,
            districtThresholds,
            heart,
            heartCaption,
            heartArtwork,
            glow,
            restorationRoots,
            heartLife: {
                aura: heartLifeAura,
                orbit: heartLifeOrbit,
                crown: heartLifeCrown,
                core: heartLifeCore,
                deliveryPulse: heartDeliveryPulse
            },
            heartLifeTweens: [],
            heartDeliveryTween: null,
            activeDeliverySources: new Set(),
            actionLabel,
            label,
            statusLabel,
            buildingElements: [],
            buildingTweens: [],
            focusTweens: [],
            focusModeActive: false,
            plotHitZones: [],
            nextActionElement: null,
            nextActionHitZone: null,
            nextActionPlacard: null,
            nextActionRing: null,
            nextActionTween: null,
            guidanceRoute: null,
            arrivalGuide: null,
            arrivalGuideTween: null,
            arrivalReveal: null,
            arrivalRevealTweens: [],
            pulseTween: null,
            ecologyTween: null,
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
                        !landmark.snapshot?.unlock?.unlocked
                            ? '#93A2A9'
                            : landmark.snapshot?.worldState?.nextAction?.type === 'decision'
                                ? '#8FE3CF'
                                : '#F2C14E'
                    )
                .setScale(1);
        });
        zone.on('pointerdown', () => this.activateVillageHeart(landmark));
        actionLabel.setInteractive({ useHandCursor: true });
        actionLabel.on('pointerdown', () => this.activateVillageHeart(landmark));

        const snapshot = snapshotOverride || (
            typeof window !== 'undefined' && window.GameState
                ? getVillageSnapshot(window.GameState)
                : null
        );
        this.refreshVillageSettlement(landmark, snapshot);
        this.villageHeart = landmark;
        return landmark;
    }

    drawVillageDistrictGround({
        terrain,
        ecology,
        pulse,
        thresholds,
        plotOffsets,
        buildingByPlot,
        unlocked,
        growthTier,
        restoredCount,
        compact
    }) {
        const heartBasin = compact
            ? { x: 0, y: 22, width: 205, height: 156 }
            : { x: 0, y: 24, width: 230, height: 170 };
        const plotBasins = plotOffsets.map((offset, index) => {
            const plot = VILLAGE_PLOTS[index];
            const building = buildingByPlot.get(plot.id) || null;
            const complete = building?.status === 'complete';
            return {
                x: offset.x,
                y: offset.y + 25,
                width: compact ? (building ? 178 : 150) : (building ? 194 : 164),
                height: compact ? (building ? 128 : 102) : (building ? 138 : 108),
                building,
                complete
            };
        });
        const districtProfiles = [
            { id: 'garden_edge', motif: 'growth', color: 0xF2C14E },
            { id: 'upper_glade', motif: 'canopy', color: 0x71E6B1 },
            { id: 'current_bend', motif: 'current', color: 0x8FE3CF },
            { id: 'shelter_grove', motif: 'shelter', color: 0xE85D5D },
            { id: 'far_root', motif: 'signal', color: 0xB7F7DE }
        ];
        const basins = [heartBasin, ...plotBasins];
        const growthStrength = unlocked ? 0.72 + (growthTier * 0.08) : 0.38;
        basins.forEach((basin, index) => {
            const activeStrength = index === 0
                ? growthStrength
                : basin.complete
                    ? growthStrength
                    : basin.building
                        ? growthStrength * 0.72
                        : growthStrength * 0.42;
            const shifts = [
                { x: -5, y: 3, scale: 1.18, alpha: 0.035 },
                { x: 4, y: -2, scale: 0.98, alpha: 0.065 },
                { x: -2, y: 2, scale: 0.74, alpha: 0.075 }
            ];
            shifts.forEach((layer, layerIndex) => {
                terrain.fillStyle(
                    layerIndex === 1 ? 0x173D36 : layerIndex === 2 ? 0x245044 : 0x071411,
                    layer.alpha * activeStrength
                );
                terrain.fillEllipse(
                    basin.x + layer.x,
                    basin.y + layer.y,
                    basin.width * layer.scale,
                    basin.height * layer.scale
                );
            });
            terrain.lineStyle(
                1,
                basin.complete ? 0x71E6B1 : 0x3FAE62,
                basin.complete ? 0.18 : 0.08
            );
            terrain.beginPath();
            terrain.arc(
                basin.x,
                basin.y,
                basin.width * 0.43,
                Math.PI * (index % 2 ? 0.12 : 1.08),
                Math.PI * (index % 2 ? 0.76 : 1.7)
            );
            terrain.strokePath();
        });

        plotBasins.forEach((basin, index) => {
            const profile = districtProfiles[index];
            const settled = Boolean(basin.building);
            const identityAlpha = settled ? 0.52 : unlocked ? 0.24 : 0.12;
            const thresholdY = basin.y + (compact ? 42 : 48);
            const span = compact ? 54 : 62;

            terrain.fillStyle(0x071411, settled ? 0.64 : 0.46);
            terrain.fillEllipse(
                basin.x,
                thresholdY + 3,
                compact ? 108 : 124,
                compact ? 23 : 27
            );
            terrain.lineStyle(2, profile.color, identityAlpha);
            terrain.beginPath();
            terrain.arc(
                basin.x,
                thresholdY + 3,
                span,
                Math.PI * 1.12,
                Math.PI * 1.88
            );
            terrain.strokePath();
            terrain.fillStyle(profile.color, identityAlpha + 0.08);
            terrain.fillCircle(basin.x - span, thresholdY, compact ? 2 : 2.5);
            terrain.fillCircle(basin.x + span, thresholdY, compact ? 2 : 2.5);

            const motifX = basin.x + (index % 2 === 0 ? -1 : 1) *
                (basin.width * 0.36);
            const motifY = basin.y - (compact ? 17 : 20);
            ecology.lineStyle(2, profile.color, identityAlpha);
            if (profile.motif === 'growth') {
                ecology.lineBetween(motifX, motifY + 12, motifX, motifY - 9);
                ecology.fillStyle(profile.color, identityAlpha + 0.14);
                ecology.fillEllipse(motifX - 6, motifY - 3, 13, 6);
                ecology.fillEllipse(motifX + 6, motifY - 8, 13, 6);
            } else if (profile.motif === 'canopy') {
                ecology.beginPath();
                ecology.arc(motifX, motifY + 8, 15, Math.PI, Math.PI * 2);
                ecology.strokePath();
                ecology.fillStyle(profile.color, identityAlpha + 0.12);
                [-10, 0, 10].forEach(branchX => {
                    ecology.fillEllipse(motifX + branchX, motifY - 5, 13, 6);
                });
            } else if (profile.motif === 'current') {
                [-8, 0, 8].forEach((crystalX, crystalIndex) => {
                    ecology.fillStyle(profile.color, identityAlpha + 0.12);
                    ecology.fillTriangle(
                        motifX + crystalX,
                        motifY - 13 - (crystalIndex === 1 ? 5 : 0),
                        motifX + crystalX - 4,
                        motifY + 6,
                        motifX + crystalX + 4,
                        motifY + 6
                    );
                });
            } else if (profile.motif === 'shelter') {
                ecology.beginPath();
                ecology.arc(motifX, motifY + 8, 14, Math.PI, Math.PI * 2);
                ecology.strokePath();
                ecology.lineBetween(motifX - 14, motifY + 8, motifX - 14, motifY + 15);
                ecology.lineBetween(motifX + 14, motifY + 8, motifX + 14, motifY + 15);
                ecology.fillStyle(profile.color, identityAlpha + 0.14);
                ecology.fillCircle(motifX, motifY + 3, 3);
            } else {
                [8, 13, 18].forEach((radius, signalIndex) => {
                    ecology.lineStyle(
                        signalIndex === 2 ? 1 : 2,
                        profile.color,
                        identityAlpha - (signalIndex * 0.04)
                    );
                    ecology.beginPath();
                    ecology.arc(motifX, motifY + 6, radius, Math.PI * 1.12, Math.PI * 1.88);
                    ecology.strokePath();
                });
                ecology.fillStyle(profile.color, identityAlpha + 0.18);
                ecology.fillCircle(motifX, motifY + 6, 2.5);
            }
        });

        const ecologyByBuilding = {
            forager_hut: { color: 0xF2C14E, shape: 'fruit' },
            sawmill: { color: 0x3FAE62, shape: 'leaf' },
            current_masonry: { color: 0xB7F7DE, shape: 'crystal' },
            habitat: { color: 0xE85D5D, shape: 'flower' },
            workshop: { color: 0x8FE3CF, shape: 'spark' }
        };
        let ecologyNodeCount = 0;
        plotBasins.forEach((basin, index) => {
            if (!basin.complete) return;
            const profile = ecologyByBuilding[basin.building.definitionId] || {
                color: 0x71E6B1,
                shape: 'leaf'
            };
            const side = index % 2 === 0 ? -1 : 1;
            const clusters = [
                { x: basin.x + side * basin.width * 0.38, y: basin.y + 15 },
                { x: basin.x - side * basin.width * 0.31, y: basin.y + 35 }
            ];
            clusters.forEach((cluster, clusterIndex) => {
                ecology.lineStyle(2, 0x3FAE62, 0.52);
                ecology.lineBetween(cluster.x, cluster.y + 8, cluster.x, cluster.y - 5);
                if (profile.shape === 'crystal') {
                    ecology.fillStyle(profile.color, 0.66);
                    ecology.fillTriangle(
                        cluster.x,
                        cluster.y - 13,
                        cluster.x - 6,
                        cluster.y + 5,
                        cluster.x + 4,
                        cluster.y + 5
                    );
                } else if (profile.shape === 'fruit') {
                    ecology.fillStyle(profile.color, 0.72);
                    ecology.fillCircle(cluster.x, cluster.y - 8, 4);
                    ecology.fillStyle(0x3FAE62, 0.56);
                    ecology.fillEllipse(cluster.x + 5, cluster.y - 11, 9, 4);
                } else if (profile.shape === 'flower') {
                    ecology.fillStyle(profile.color, 0.58);
                    [-5, 0, 5].forEach(petalX => (
                        ecology.fillCircle(cluster.x + petalX, cluster.y - 8, 4)
                    ));
                    ecology.fillStyle(0xF2C14E, 0.82);
                    ecology.fillCircle(cluster.x, cluster.y - 8, 2);
                } else if (profile.shape === 'spark') {
                    ecology.fillStyle(profile.color, 0.72);
                    ecology.fillTriangle(
                        cluster.x,
                        cluster.y - 13,
                        cluster.x - 4,
                        cluster.y,
                        cluster.x + 4,
                        cluster.y
                    );
                    ecology.fillTriangle(
                        cluster.x,
                        cluster.y + 5,
                        cluster.x - 4,
                        cluster.y - 4,
                        cluster.x + 4,
                        cluster.y - 4
                    );
                } else {
                    ecology.fillStyle(profile.color, 0.54);
                    ecology.fillEllipse(cluster.x - 5, cluster.y - 7, 12, 6);
                    ecology.fillEllipse(cluster.x + 5, cluster.y - 10, 12, 6);
                }
                pulse.fillStyle(profile.color, 0.72);
                pulse.fillCircle(
                    cluster.x + (clusterIndex ? 3 : -3),
                    cluster.y - 15,
                    clusterIndex ? 2 : 2.5
                );
                ecologyNodeCount += 1;
            });
        });

        const thresholdPositions = compact
            ? [{ x: -184, y: 46 }, { x: 184, y: 54 }]
            : [{ x: -126, y: 48 }, { x: 154, y: 76 }];
        thresholdPositions.forEach((position, index) => {
            thresholds.lineStyle(3, 0x071411, 0.58);
            thresholds.beginPath();
            thresholds.arc(position.x, position.y, 20, Math.PI, Math.PI * 2);
            thresholds.strokePath();
            thresholds.lineStyle(2, index === 0 ? 0x71E6B1 : 0x8FE3CF, 0.62);
            thresholds.beginPath();
            thresholds.arc(position.x, position.y, 17, Math.PI * 1.08, Math.PI * 1.92);
            thresholds.strokePath();
            thresholds.fillStyle(0x3FAE62, 0.64);
            thresholds.fillEllipse(position.x - 17, position.y + 1, 12, 6);
            thresholds.fillEllipse(position.x + 17, position.y + 1, 12, 6);
            thresholds.fillStyle(0xF4F4F4, 0.8);
            thresholds.fillCircle(position.x, position.y - 17, 2);
        });

        terrain
            .setData('villageTerrainMaterial', 'living_current_districts_v3')
            .setData('uniformOverlay', false)
            .setData('terrainPatchCount', basins.length)
            .setData('districtIdentityCount', districtProfiles.length)
            .setData('districtIdentityIds', districtProfiles.map(profile => profile.id));
        ecology
            .setData('villageDistrictEcology', true)
            .setData('growthTier', growthTier)
            .setData('restoredCount', restoredCount)
            .setData('ecologyNodeCount', ecologyNodeCount);
        pulse
            .setData('villageEcologyPulse', true)
            .setData('ecologyNodeCount', ecologyNodeCount);
        thresholds
            .setData('villageThresholdCount', thresholdPositions.length)
            .setData('thresholdPurpose', 'commons_transition');
        return ecologyNodeCount;
    }

    refreshVillageSettlement(landmark, snapshot = null) {
        if (!landmark?.heart) return;
        landmark.pulseTween?.stop?.();
        landmark.heartArtworkTween?.stop?.();
        landmark.ecologyTween?.stop?.();
        landmark.heartLifeTweens?.forEach(tween => tween?.stop?.());
        landmark.heartDeliveryTween?.stop?.();
        landmark.buildingTweens?.forEach(tween => tween?.stop?.());
        landmark.focusTweens?.forEach(tween => tween?.stop?.());
        this.clearVillageCommunityMoment(landmark);
        this.clearVillageDecisionMoment(landmark);
        this.clearVillageWorkerCheckIn(landmark);
        this.clearVillageArrivalReveal(landmark);
        landmark.buildingElements?.forEach(element => element?.destroy?.(true));
        landmark.plotHitZones?.forEach(zone => zone?.destroy?.());
        landmark.buildingTweens = [];
        landmark.heartLifeTweens = [];
        landmark.heartDeliveryTween = null;
        landmark.activeDeliverySources?.clear?.();
        landmark.focusTweens = [];
        landmark.buildingElements = [];
        landmark.plotHitZones = [];
        landmark.workerElements = [];
        landmark.residentElements = [];
        landmark.heartMemoryElements = [];
        landmark.valueGrowthElements = [];
        landmark.plotPresentations = [];
        landmark.villageFlowSignals = [];
        landmark.nextActionElement = null;
        landmark.nextActionHitZone = null;
        landmark.nextActionPlacard = null;
        landmark.nextActionRing = null;
        landmark.nextActionTween = null;
        landmark.guidanceRoute = null;
        landmark.arrivalGuide = null;
        landmark.arrivalGuideTween = null;
        landmark.plotWorldPositions = new Map();
        landmark.snapshot = snapshot;

        const unlocked = snapshot?.unlock?.unlocked === true;
        const {
            districtTerrain,
            currentPaths,
            districtEcology,
            districtPulse,
            districtThresholds,
            heart,
            heartCaption,
            heartArtwork,
            glow,
            restorationRoots,
            actionLabel,
            label,
            statusLabel
        } = landmark;
        const compactSettlement = this.scene.scale.width <= 600;
        const settlementLayout = compactSettlement
            ? VILLAGE_SETTLEMENT_LAYOUTS.compact
            : VILLAGE_SETTLEMENT_LAYOUTS.expanded;
        if (heartArtwork) {
            const heartDisplaySize = settlementLayout.heartArtworkSize;
            heartArtwork.setDisplaySize(heartDisplaySize, heartDisplaySize);
            heartArtwork.villageBaseScale = heartArtwork.scaleX;
            heartArtwork
                .setData('villageLayoutProfile', settlementLayout.profile)
                .setData('villageDisplaySize', heartDisplaySize);
        }
        const plotOffsets = settlementLayout.plotOffsets;
        const buildingByPlot = new Map(
            snapshot?.buildings?.map(building => [building.plotId, building]) || []
        );
        const growthTier = snapshot?.worldState?.growthTier || 0;
        const restoredCount = Phaser.Math.Clamp(
            snapshot?.worldState?.restored || 0,
            0,
            VILLAGE_PLOTS.length
        );

        districtTerrain.clear();
        currentPaths.clear();
        districtEcology.clear();
        districtPulse.clear();
        districtThresholds.clear();
        heart.clear();
        heartCaption.clear();
        glow.clear();
        restorationRoots.clear();
        Object.values(landmark.heartLife || {}).forEach(element => {
            element?.clear?.();
            element?.setAlpha?.(0);
            element?.setScale?.(1);
            if (typeof element?.setAngle === 'function') element.setAngle(0);
        });
        heartCaption
            .fillStyle(0x071411, unlocked ? 0.82 : 0.62)
            .fillEllipse(0, compactSettlement ? 94 : 100, compactSettlement ? 150 : 174, 44)
            .lineStyle(1, unlocked ? 0x71E6B1 : 0x53616A, unlocked ? 0.52 : 0.28)
            .strokeEllipse(0, compactSettlement ? 94 : 100, compactSettlement ? 144 : 168, 38)
            .setData('villageHeartCaption', true)
            .setData('villageLayoutProfile', settlementLayout.profile);
        restorationRoots
            .setData('rootBudCount', VILLAGE_PLOTS.length)
            .setData('litRootCount', restoredCount)
            .setData('growthTier', growthTier)
            .setData('growthLabel', snapshot?.worldState?.growthLabel || 'AWAKENED ROOT')
            .setData(
                'ariaLabel',
                `${snapshot?.worldState?.growthLabel || 'Awakened root'}; ` +
                    `${restoredCount} of ${VILLAGE_PLOTS.length} village roots restored`
            );

        this.drawVillageDistrictGround({
            terrain: districtTerrain,
            ecology: districtEcology,
            pulse: districtPulse,
            thresholds: districtThresholds,
            plotOffsets,
            buildingByPlot,
            unlocked,
            growthTier,
            restoredCount,
            compact: compactSettlement
        });
        this.drawVillageHeartLife(landmark, {
            unlocked,
            growthTier,
            restoredCount,
            values: snapshot?.worldState?.values,
            choices: snapshot?.worldState?.choices || 0,
            compact: compactSettlement
        });

        let connectedPlotCount = 0;
        plotOffsets.forEach((offset, index) => {
            const plot = VILLAGE_PLOTS[index];
            const connectedBuilding = buildingByPlot.get(plot.id) || null;
            const completePath = connectedBuilding?.status === 'complete';
            const growingPath = connectedBuilding?.status === 'constructing';
            if (completePath) connectedPlotCount += 1;
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
            strokeCurrentPath(
                compactSettlement ? 22 : 28,
                0x102B26,
                completePath ? 0.42 : growingPath ? 0.36 : 0.26
            );
            strokeCurrentPath(
                compactSettlement ? 15 : 19,
                0x071411,
                completePath ? 0.42 : 0.34
            );
            strokeCurrentPath(
                completePath ? 3 : growingPath ? 3 : 2,
                growingPath ? 0xF2C14E : completePath ? 0x3FAE62 : 0x53616A,
                completePath ? 0.3 : growingPath ? 0.42 : unlocked ? 0.11 : 0.06
            );
            strokeCurrentPath(
                completePath ? 1 : 0.8,
                growingPath ? 0xF4F4F4 : completePath ? 0xB7F7DE : 0x657682,
                completePath ? 0.42 : growingPath ? 0.58 : 0.14
            );
            if (completePath) {
                [9, 13].forEach((pointIndex, branchIndex) => {
                    const point = pathPoints[pointIndex];
                    const direction = (index + branchIndex) % 2 === 0 ? -1 : 1;
                    currentPaths.lineStyle(1, 0x3FAE62, 0.28);
                    currentPaths.lineBetween(
                        point.x,
                        point.y,
                        point.x + direction * (12 + branchIndex * 4),
                        point.y - 7 + branchIndex * 11
                    );
                    currentPaths.fillStyle(0x71E6B1, 0.36);
                    currentPaths.fillEllipse(
                        point.x + direction * (13 + branchIndex * 4),
                        point.y - 6 + branchIndex * 11,
                        9,
                        4
                    );
                });
            }
        });
        currentPaths
            .setData('villagePathMaterial', 'grounded_current_paths_v3')
            .setData('connectedPlotCount', connectedPlotCount)
            .setData('routeFoundationWidth', compactSettlement ? 22 : 28)
            .setData('routeHighlightWidth', 3);

        districtPulse.setAlpha(unlocked ? 0.54 : 0.2);
        landmark.ecologyTween = this.scene.tweens.add({
            targets: districtPulse,
            alpha: { from: unlocked ? 0.32 : 0.12, to: unlocked ? 0.78 : 0.28 },
            scaleX: { from: 0.96, to: 1.04 },
            scaleY: { from: 0.96, to: 1.04 },
            duration: 2100,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        glow.fillStyle(unlocked ? 0x71E6B1 : 0x53616A, unlocked ? 0.14 : 0.08);
        glow.fillEllipse(
            0,
            22,
            compactSettlement ? (unlocked ? 152 : 132) : (unlocked ? 180 : 152),
            compactSettlement ? (unlocked ? 94 : 78) : (unlocked ? 110 : 90)
        );
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

        const rootTargets = compactSettlement
            ? [
                { x: 0, y: 88 },
                { x: -52, y: 96 },
                { x: 52, y: 96 },
                { x: -101, y: 72 },
                { x: 101, y: 72 }
            ]
            : [
                { x: 0, y: 96 },
                { x: -60, y: 104 },
                { x: 60, y: 104 },
                { x: -112, y: 76 },
                { x: 112, y: 76 }
            ];
        rootTargets.forEach((target, index) => {
            const active = unlocked && index < restoredCount;
            const complete = active && restoredCount === VILLAGE_PLOTS.length;
            const color = complete ? 0xF2C14E : active ? 0x71E6B1 : 0x53616A;
            const start = { x: 0, y: 40 };
            const control = {
                x: target.x * 0.28 + (index % 2 ? -7 : 7),
                y: 72 + Math.abs(target.x) * 0.04
            };
            const rootPoints = Array.from({ length: 13 }, (_, pointIndex) => {
                const progress = pointIndex / 12;
                const inverse = 1 - progress;
                return {
                    x: (inverse * inverse * start.x) +
                        (2 * inverse * progress * control.x) +
                        (progress * progress * target.x),
                    y: (inverse * inverse * start.y) +
                        (2 * inverse * progress * control.y) +
                        (progress * progress * target.y)
                };
            });
            const strokeRoot = (width, strokeColor, alpha) => {
                restorationRoots.lineStyle(width, strokeColor, alpha);
                restorationRoots.beginPath();
                restorationRoots.moveTo(rootPoints[0].x, rootPoints[0].y);
                rootPoints.slice(1).forEach(point => {
                    restorationRoots.lineTo(point.x, point.y);
                });
                restorationRoots.strokePath();
            };
            strokeRoot(active ? 5 : 3, 0x071411, active ? 0.46 : 0.3);
            strokeRoot(active ? 2 : 1, color, active ? 0.72 : 0.2);
            if (active) {
                restorationRoots.fillStyle(color, 0.84);
                restorationRoots.fillEllipse(target.x - 6, target.y - 5, 12, 6);
                restorationRoots.fillEllipse(target.x + 6, target.y - 7, 12, 6);
                restorationRoots.fillStyle(0xF4F4F4, 0.94);
                restorationRoots.fillCircle(target.x, target.y, 2);
            } else {
                restorationRoots.fillStyle(0x071411, 0.72);
                restorationRoots.fillEllipse(target.x, target.y, 8, 5);
                restorationRoots.lineStyle(1, color, 0.24);
                restorationRoots.strokeEllipse(target.x, target.y, 8, 5);
            }
        });

        label
            .setText(unlocked ? 'VILLAGE HEART' : 'DORMANT HEART')
            .setFontSize(compactSettlement ? '10px' : '12px')
            .setPosition(landmark.zone.x, landmark.zone.y + (compactSettlement ? 86 : 115))
            .setAlpha(unlocked ? 0.86 : 0.68)
            .setColor(unlocked ? '#F4F4F4' : '#93A2A9');
        actionLabel
            .setText(unlocked ? 'OPEN PLAN' : 'HEART DORMANT')
            .setAlpha(1)
            .setColor(unlocked ? '#F2C14E' : '#93A2A9')
            .setData('villageNextAction', null)
            .setData('definitionId', null)
            .setInteractive({ useHandCursor: true });
        statusLabel
            .setText(unlocked
                ? restoredCount === 0
                    ? `0/${VILLAGE_PLOTS.length} ROOTS · BUILD A HOME TOGETHER`
                    : `${restoredCount}/${VILLAGE_PLOTS.length} ROOTS · ` +
                        `${snapshot?.worldState?.growthLabel || 'AWAKENED ROOT'}`
                : 'HATCH A COMPANION TO WAKE IT'
            )
            .setFontSize(compactSettlement ? '8px' : '9px')
            .setPosition(landmark.zone.x, landmark.zone.y + (compactSettlement ? 105 : 138))
            .setAlpha(unlocked ? 0.82 : 0.64)
            .setColor(unlocked ? '#8FE3CF' : '#93A2A9')
            .setData('villageGrowthTier', growthTier)
            .setData('villageGrowthLabel', snapshot?.worldState?.growthLabel || 'AWAKENED ROOT');

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

        VILLAGE_PLOTS.forEach((plot, index) => {
            const offset = plotOffsets[index];
            const plotX = landmark.zone.x + offset.x;
            const plotY = landmark.zone.y + offset.y;
            landmark.plotWorldPositions.set(plot.id, { x: plotX, y: plotY });
            const building = buildingByPlot.get(plot.id) || null;
            const definition = building
                ? VILLAGE_BUILDING_DEFINITIONS.find(
                    entry => entry.id === building.definitionId
                )
                : null;
            const nextAction = snapshot?.worldState?.nextAction;
            const guidedPlot = ['build', 'assign'].includes(nextAction?.type) &&
                nextAction?.plotId === plot.id;
            const plotState = !unlocked
                ? 'dormant'
                : !building
                    ? 'available'
                    : building.status === 'constructing'
                        ? 'constructing'
                        : definition?.production && !building.creature
                            ? 'needs_helper'
                            : building.creature
                                ? 'staffed'
                                : 'complete';
            const constructionStartedAt = Number(building?.startedAt) || Date.now();
            const constructionCompletesAt = Number(building?.completesAt) ||
                constructionStartedAt;
            const constructionDuration = Math.max(
                1,
                constructionCompletesAt - constructionStartedAt
            );
            const constructionProgress = plotState === 'constructing'
                ? Phaser.Math.Clamp(
                    (Date.now() - constructionStartedAt) / constructionDuration,
                    0,
                    1
                )
                : plotState === 'dormant' || plotState === 'available'
                    ? 0
                    : 1;
            const container = this.scene.add.container(plotX, plotY)
                .setDepth(plotY + 2)
                .setData('villageBuildingStructure', true)
                .setData('plotId', plot.id)
                .setData(
                    'villageFoundationMaterial',
                    building ? 'inhabited_root_basin_v1' : 'living_root_cradle_v2'
                );
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
                            settlementLayout.buildingArtworkScale,
                        (worldArtworkDefinition.displaySize || 176) *
                            settlementLayout.buildingArtworkScale
                    )
                    .setData('villageLayoutProfile', settlementLayout.profile)
                    .setData(
                        'villageDisplaySize',
                        (worldArtworkDefinition.displaySize || 176) *
                            settlementLayout.buildingArtworkScale
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
                    worldArtwork.setAlpha(0.66).setTint(0xA7BDAF);
                    drawing.lineStyle(3, 0x071411, 0.62);
                    drawing.beginPath();
                    drawing.arc(0, 22, 62, Math.PI * 1.08, Math.PI * 1.92, false);
                    drawing.strokePath();
                    drawing.lineStyle(2, 0xF2C14E, 0.78);
                    drawing.beginPath();
                    drawing.arc(0, 22, 58, Math.PI * 1.1, Math.PI * 1.9, false);
                    drawing.strokePath();
                    [-44, 44].forEach((supportX, supportIndex) => {
                        const topX = supportX * 0.72;
                        drawing.lineStyle(3, 0x3FAE62, 0.74);
                        drawing.lineBetween(supportX, 22, topX, -39);
                        drawing.fillStyle(0x71E6B1, 0.78);
                        drawing.fillEllipse(
                            topX + (supportIndex === 0 ? -5 : 5),
                            -25,
                            13,
                            7
                        );
                        drawing.fillStyle(0xF2C14E, 0.88);
                        drawing.fillCircle(topX, -40, 3);
                    });
                }
                currentSignal.fillStyle(0x71E6B1, 0.95);
                currentSignal.fillCircle(0, 0, 3);
                currentSignal.lineStyle(1, 0xF4F4F4, 0.85);
                currentSignal.strokeCircle(0, 0, 5);
                currentSignal.setPosition(-42, 20);
                currentSignal.setBlendMode?.(Phaser.BlendModes.ADD);
            } else {
                this.drawVillageFoundationCradle(drawing, {
                    state: plotState,
                    unlocked,
                    guided: guidedPlot,
                    compact: compactSettlement,
                    index
                });
            }
            const stateMarker = this.createVillagePlotStateMarker({
                state: plotState,
                progress: constructionProgress,
                compact: compactSettlement,
                built: Boolean(building)
            });
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
            const persistentState = Boolean(
                building?.status === 'constructing' ||
                (
                    building?.status === 'complete' &&
                    definition?.production &&
                    !building.creature
                )
            );
            const plotLabelRestAlpha = guidedPlot
                ? 0.32
                : 0;
            const stateLabelRestAlpha = guidedPlot
                ? 0
                : persistentState
                    ? 1
                    : 0;
            const districtAnchor = this.createVillageDistrictAnchor({
                state: plotState,
                guided: guidedPlot,
                built: Boolean(building),
                compact: compactSettlement,
                districtId: plot.id
            });
            const focusRing = this.scene.add.graphics().setAlpha(0);
            const focusColor = building?.status === 'complete' ? 0x71E6B1 : 0xF2C14E;
            focusRing.lineStyle(2, focusColor, 0.92);
            focusRing.beginPath();
            focusRing.arc(0, 23, compactSettlement ? 58 : 70, Math.PI * 0.12, Math.PI * 0.86);
            focusRing.strokePath();
            focusRing.beginPath();
            focusRing.arc(0, 23, compactSettlement ? 58 : 70, Math.PI * 1.08, Math.PI * 1.82);
            focusRing.strokePath();
            focusRing.fillStyle(focusColor, 0.94);
            focusRing.fillCircle(compactSettlement ? 48 : 59, -10, 3);
            focusRing.setBlendMode?.(Phaser.BlendModes.ADD);
            const plotLabel = this.scene.add.text(
                0,
                worldArtwork ? 63 : 45,
                definition
                    ? definition.shortLabel
                    : plot.label,
                {
                    fontSize: compactSettlement ? '9px' : '10px',
                    fontFamily: 'Arial, sans-serif',
                    color: building ? '#F4F4F4' : '#C9F7E9',
                    fontStyle: 'bold',
                    stroke: '#050505',
                    strokeThickness: 3
                }
            ).setOrigin(0.5).setAlpha(plotLabelRestAlpha);
            const stateLabel = this.scene.add.text(
                0,
                worldArtwork && persistentState
                    ? (compactSettlement ? 81 : 86)
                    : worldArtwork
                        ? -124
                        : -48,
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
            ).setOrigin(0.5).setAlpha(stateLabelRestAlpha);
            const activity = building?.status === 'complete'
                ? this.createVillageBuildingActivity(building)
                : null;
            const worker = building?.status === 'complete' && building.creature
                ? this.createVillageWorker(building, {
                    compact: compactSettlement,
                    index,
                    landmark,
                    plotPosition: { x: plotX, y: plotY },
                    heartPosition: {
                        x: landmark.zone.x,
                        y: landmark.zone.y
                    }
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
                stateMarker,
                ...(building ? [currentSignal] : []),
                ...(activity ? [activity] : []),
                ...(habitatLife ? [habitatLife.container] : []),
                districtAnchor,
                focusRing,
                plotLabel,
                stateLabel
            ]);
            landmark.buildingElements.push(container);
            if (worker) {
                landmark.workerElements.push(worker.container);
                landmark.buildingElements.push(worker.container);
                landmark.buildingTweens.push(
                    worker.moveTween,
                    worker.breatheTween,
                    worker.cueTween
                );
                worker.container.on('pointerdown', (_pointer, _x, _y, event) => {
                    event?.stopPropagation?.();
                    this.activateVillageWorker(landmark, building);
                });
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
            if (['constructing', 'needs_helper'].includes(plotState)) {
                landmark.buildingTweens.push(this.scene.tweens.add({
                    targets: stateMarker,
                    alpha: { from: 0.62, to: 1 },
                    duration: plotState === 'constructing' ? 760 : 1250,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                }));
            }

            const villageFlow = this.createVillageFlowSignal({
                building,
                definition,
                unlocked,
                guided: guidedPlot,
                state: plotState,
                index,
                heartPosition: {
                    x: landmark.zone.x,
                    y: landmark.zone.y + 20
                },
                plotPosition: {
                    x: plotX,
                    y: plotY + 18
                }
            });
            landmark.villageFlowSignals.push(villageFlow.container);
            landmark.buildingElements.push(villageFlow.container);
            landmark.buildingTweens.push(villageFlow.tween);

            const plotHitZone = this.scene.add.zone(
                plotX,
                plotY - 10,
                compactSettlement ? 132 : 168,
                compactSettlement ? 132 : 164
            )
                .setDepth(plotY + 6)
                .setInteractive({ useHandCursor: unlocked });
            plotHitZone.plotId = plot.id;
            const focusCopy = unlocked
                ? definition
                    ? building?.creature
                        ? `${building.creature.name.toUpperCase()} · ${definition.roleLabel}`
                        : definition.worldEffectLabel
                    : 'CHOOSE WHAT GROWS HERE'
                : 'DORMANT';
            const interactionLabel = definition
                ? `${definition.label}. ${buildingStateCopy}. Tap to manage.`
                : unlocked
                    ? `${plot.label}. Foundation available. Tap to plan.`
                    : `${plot.label}. Dormant foundation.`;
            plotHitZone
                .setData('interactionLabel', interactionLabel)
                .setData('definitionId', building?.definitionId || null)
                .setData('plotState', plotState)
                .setData('worldEffectLabel', definition?.worldEffectLabel || null)
                .setData('guided', guidedPlot);
            plotHitZone.on('pointerover', () => {
                container.setScale(1.06);
                container.setAlpha(1);
                focusRing.setAlpha(1);
                districtAnchor.setAlpha(1);
                plotLabel.setAlpha(1);
                stateLabel
                    .setText(focusCopy)
                    .setAlpha(1);
            });
            plotHitZone.on('pointerout', () => {
                container.setScale(1);
                const focusPriority = container.getData('villageFocusPriority');
                const presentationMode = container.getData('villagePresentationMode');
                const directPlotCommand = Boolean(
                    focusPriority === 'primary' &&
                    ['build', 'assign'].includes(
                        landmark.snapshot?.worldState?.nextAction?.type
                    )
                );
                container.setAlpha(
                    Number(container.getData('villageFocusAlpha')) || 1
                );
                focusRing.setAlpha(
                    presentationMode !== 'story' &&
                    focusPriority === 'primary' &&
                    !directPlotCommand
                        ? 0.82
                        : 0
                );
                districtAnchor.setAlpha(
                    focusPriority === 'primary'
                        ? 1
                        : guidedPlot
                            ? 1
                            : ['constructing', 'needs_helper', 'complete', 'staffed'].includes(plotState)
                                ? 0.58
                                : 0.3
                );
                plotLabel.setAlpha(
                    directPlotCommand
                        ? 0
                        : presentationMode === 'story'
                        ? focusPriority === 'primary' ? 0.88 : 0
                        : focusPriority === 'primary' ? 1 : plotLabelRestAlpha
                );
                stateLabel
                    .setText(buildingStateCopy)
                    .setAlpha(
                        directPlotCommand
                            ? 0
                            : presentationMode === 'story'
                            ? 0
                            : focusPriority === 'primary' ? 1 : stateLabelRestAlpha
                    );
            });
            plotHitZone.on('pointerdown', pointer => {
                if (worker?.container && building?.creature) {
                    const workerX = worker.container.x;
                    const workerY = worker.container.y;
                    const pointerX = pointer?.worldX ?? pointer?.x;
                    const pointerY = pointer?.worldY ?? pointer?.y;
                    const workerHitRadius = compactSettlement ? 36 : 42;
                    if (
                        Number.isFinite(pointerX) &&
                        Number.isFinite(pointerY) &&
                        Phaser.Math.Distance.Between(
                            pointerX,
                            pointerY,
                            workerX,
                            workerY
                        ) <= workerHitRadius &&
                        this.activateVillageWorker(landmark, building)
                    ) {
                        return;
                    }
                }
                this.activateVillageHeart(landmark, plot.id);
            });
            landmark.plotHitZones.push(plotHitZone);
            landmark.plotPresentations.push({
                plotId: plot.id,
                container,
                hitZone: plotHitZone,
                worldArtwork,
                plotLabel,
                stateLabel,
                focusRing,
                stateMarker,
                districtAnchor,
                flowSignal: villageFlow.container,
                worker: worker?.container || null,
                plotState,
                layoutProfile: settlementLayout.profile,
                plotLabelRestAlpha,
                stateLabelRestAlpha,
                interactionLabel
            });

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
        this.createVillageArrivalGuide(landmark, snapshot, {
            compact: compactSettlement
        });
        this.createVillageHeartMemories(landmark, snapshot, {
            compact: compactSettlement
        });
        this.createVillageValueGrowth(landmark, snapshot, {
            compact: compactSettlement
        });
        this.createVillageNextActionBeacon(landmark, snapshot, {
            compact: compactSettlement
        });
        this.setVillageFocusMode(
            landmark,
            Boolean(this.scene.sanctuaryFocusModeActive || this.scene.nearVillageHeart),
            { immediate: true }
        );
    }

    drawVillageHeartLife(
        landmark,
        {
            unlocked = false,
            growthTier = 0,
            restoredCount = 0,
            values = {},
            choices = 0,
            compact = false
        } = {}
    ) {
        const life = landmark?.heartLife;
        if (!life) return false;
        const stageLabels = [
            'AWAKENED ROOT',
            'FIRST ROOT',
            'CONNECTED GLADE',
            'LIVING SETTLEMENT',
            'SHARED SANCTUARY'
        ];
        const tier = Phaser.Math.Clamp(Number(growthTier) || 0, 0, 4);
        const stageLabel = stageLabels[tier];
        const radius = (compact ? 57 : 81) + (tier * (compact ? 2.5 : 3));
        const orbitNodeCount = unlocked ? Math.max(1, Math.min(5, restoredCount)) : 0;
        const care = Math.max(0, Number(values?.care) || 0);
        const readiness = Math.max(0, Number(values?.readiness) || 0);
        const dominantValue = care === readiness
            ? 'balanced'
            : care > readiness
                ? 'care'
                : 'readiness';
        const stageColor = tier >= 4
            ? 0xF2C14E
            : tier >= 2
                ? 0x71E6B1
                : unlocked
                    ? 0x8FE3CF
                    : 0x53616A;

        life.aura.clear();
        life.orbit.clear();
        life.crown.clear();
        life.deliveryPulse.clear();
        life.aura.lineStyle(compact ? 7 : 9, 0x071411, unlocked ? 0.48 : 0.3);
        life.aura.beginPath();
        life.aura.arc(0, 4, radius, Math.PI * 0.06, Math.PI * 0.9);
        life.aura.strokePath();
        life.aura.beginPath();
        life.aura.arc(0, 4, radius, Math.PI * 1.06, Math.PI * 1.9);
        life.aura.strokePath();
        life.aura.lineStyle(2, stageColor, unlocked ? 0.48 + (tier * 0.07) : 0.18);
        life.aura.beginPath();
        life.aura.arc(0, 4, radius, Math.PI * 0.08, Math.PI * 0.88);
        life.aura.strokePath();
        life.aura.beginPath();
        life.aura.arc(0, 4, radius, Math.PI * 1.08, Math.PI * 1.88);
        life.aura.strokePath();
        life.aura.lineStyle(1, 0xF4F4F4, unlocked ? 0.22 + (tier * 0.04) : 0.08);
        life.aura.strokeCircle(0, 4, radius - (compact ? 7 : 9));

        Array.from({ length: orbitNodeCount }, (_, index) => {
            const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / orbitNodeCount);
            const nodeX = Math.cos(angle) * radius;
            const nodeY = 4 + (Math.sin(angle) * radius);
            life.orbit.fillStyle(0x071411, 0.82);
            life.orbit.fillCircle(nodeX, nodeY, compact ? 5 : 6);
            life.orbit.lineStyle(1, stageColor, 0.86);
            life.orbit.strokeCircle(nodeX, nodeY, compact ? 4 : 5);
            life.orbit.fillStyle(index < restoredCount ? 0xF4F4F4 : stageColor, 0.94);
            life.orbit.fillCircle(nodeX, nodeY, compact ? 1.8 : 2.2);
        });

        const leafCount = unlocked ? 2 + tier : 0;
        Array.from({ length: leafCount }, (_, index) => {
            const spread = leafCount === 1 ? 0 : (index / (leafCount - 1)) - 0.5;
            const leafX = spread * (compact ? 76 : 108);
            const leafY = (compact ? -52 : -74) + (Math.abs(spread) * 26);
            const direction = index % 2 === 0 ? -1 : 1;
            life.crown.lineStyle(1, 0x3FAE62, 0.5 + (tier * 0.06));
            life.crown.lineBetween(leafX, leafY + 10, leafX + direction * 4, leafY);
            life.crown.fillStyle(stageColor, 0.34 + (tier * 0.08));
            life.crown.fillEllipse(
                leafX + direction * 5,
                leafY,
                compact ? 11 : 14,
                compact ? 5 : 7
            );
        });
        if (choices > 0) {
            const memoryCount = Math.min(5, choices);
            Array.from({ length: memoryCount }, (_, index) => {
                const memoryX = (index - ((memoryCount - 1) / 2)) * (compact ? 17 : 21);
                const memoryColor = dominantValue === 'care'
                    ? 0x71E6B1
                    : dominantValue === 'readiness'
                        ? 0xF2C14E
                        : index % 2 === 0 ? 0x71E6B1 : 0xF2C14E;
                life.crown.fillStyle(0x071411, 0.82);
                life.crown.fillCircle(memoryX, compact ? 59 : 82, compact ? 4 : 5);
                life.crown.fillStyle(memoryColor, 0.94);
                life.crown.fillCircle(memoryX, compact ? 59 : 82, compact ? 2 : 2.5);
            });
        }

        life.deliveryPulse.lineStyle(3, stageColor, 0.92);
        life.deliveryPulse.strokeCircle(0, 8, compact ? 34 : 46);
        life.deliveryPulse.lineStyle(1, 0xF4F4F4, 0.78);
        life.deliveryPulse.strokeCircle(0, 8, compact ? 24 : 33);
        life.core
            .setRadius(compact ? 3.5 : 4.5)
            .setFillStyle(stageColor, unlocked ? 0.92 : 0.24)
            .setStrokeStyle(1, 0xF4F4F4, unlocked ? 0.72 : 0.18)
            .setAlpha(unlocked ? 0.9 : 0.3);
        [life.aura, life.orbit, life.crown, life.core].forEach(element => {
            element
                .setAlpha(unlocked ? 1 : 0.38)
                .setData('villageHeartLife', true)
                .setData('villageHeartGrowthTier', tier)
                .setData('villageHeartGrowthStage', stageLabel)
                .setData('villageHeartDominantValue', dominantValue)
                .setData('villageHeartMotionProfile', 'living_current_breath_v1');
        });
        life.aura
            .setData('villageHeartAuraRadius', radius)
            .setData('ariaLabel', `${stageLabel}; the Village Heart is breathing`);
        life.orbit
            .setData('villageHeartOrbitNodeCount', orbitNodeCount)
            .setData('villageHeartRestoredRoots', restoredCount);
        life.crown
            .setData('villageHeartLeafCount', leafCount)
            .setData('villageHeartMemoryLightCount', Math.min(5, choices));
        life.deliveryPulse
            .setData('villageHeartDeliveryResponse', true)
            .setData('villageHeartDeliveryActive', false)
            .setData('villageHeartDeliveryCount', 0)
            .setData('villageHeartLastDelivery', null);

        if (unlocked) {
            landmark.heartLifeTweens.push(this.scene.tweens.add({
                targets: life.aura,
                scaleX: { from: 0.985, to: 1.025 },
                scaleY: { from: 0.985, to: 1.025 },
                duration: Math.max(1500, 2350 - (tier * 140)),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            }));
            landmark.heartLifeTweens.push(this.scene.tweens.add({
                targets: life.orbit,
                angle: 360,
                duration: Math.max(14000, 23000 - (tier * 1600)),
                repeat: -1,
                ease: 'Linear'
            }));
            landmark.heartLifeTweens.push(this.scene.tweens.add({
                targets: life.core,
                scaleX: { from: 0.9, to: 1.2 },
                scaleY: { from: 0.9, to: 1.2 },
                duration: Math.max(920, 1450 - (tier * 90)),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            }));
        }
        return true;
    }

    setVillageHeartDeliveryState(landmark, sourceId, active, effectLabel = null) {
        const life = landmark?.heartLife;
        if (!life?.deliveryPulse || !sourceId) return false;
        const sources = landmark.activeDeliverySources || new Set();
        landmark.activeDeliverySources = sources;
        const wasActive = sources.has(sourceId);
        if (active) sources.add(sourceId);
        else sources.delete(sourceId);
        life.deliveryPulse
            .setData('villageHeartDeliveryActive', sources.size > 0)
            .setData('villageHeartDeliveryCount', sources.size);
        if (!active || wasActive) return true;

        life.deliveryPulse.setData('villageHeartLastDelivery', effectLabel);
        landmark.heartDeliveryTween?.stop?.();
        life.deliveryPulse.setAlpha(
            landmark.presentationMode === 'story' ? 0.18 : 0.96
        ).setScale(0.72);
        landmark.heartDeliveryTween = this.scene.tweens.add({
            targets: life.deliveryPulse,
            alpha: 0,
            scaleX: 1.55,
            scaleY: 1.55,
            duration: 760,
            ease: 'Sine.easeOut'
        });
        return true;
    }

    playVillageArrivalReveal(landmark, { duration = 2800 } = {}) {
        if (!landmark?.zone) return false;
        this.clearVillageArrivalReveal(landmark);
        const compact = this.scene.scale.width <= 600;
        const reveal = this.scene.add.container(
            landmark.zone.x,
            landmark.zone.y
        ).setDepth(landmark.zone.y + 8);
        const currentWave = this.scene.add.graphics();
        const crownSignal = this.scene.add.graphics();
        const title = this.scene.add.text(
            0,
            compact ? -132 : -156,
            'THE HEART ANSWERS',
            {
                fontSize: compact ? '16px' : '18px',
                fontFamily: 'Arial, sans-serif',
                color: '#F4F4F4',
                fontStyle: 'bold',
                stroke: '#050B0A',
                strokeThickness: 5,
                align: 'center'
            }
        ).setOrigin(0.5);
        const subtitle = this.scene.add.text(
            0,
            compact ? -108 : -130,
            'A HOME WE BUILD TOGETHER',
            {
                fontSize: compact ? '10px' : '11px',
                fontFamily: 'Arial, sans-serif',
                color: '#8FE3CF',
                fontStyle: 'bold',
                stroke: '#050B0A',
                strokeThickness: 4,
                align: 'center'
            }
        ).setOrigin(0.5);
        const radius = compact ? 74 : 104;
        currentWave.lineStyle(compact ? 5 : 7, 0x071411, 0.68);
        currentWave.strokeCircle(0, 0, radius);
        currentWave.lineStyle(2, 0x71E6B1, 0.92);
        currentWave.beginPath();
        currentWave.arc(0, 0, radius, Math.PI * 0.04, Math.PI * 0.9);
        currentWave.strokePath();
        currentWave.beginPath();
        currentWave.arc(0, 0, radius, Math.PI * 1.04, Math.PI * 1.9);
        currentWave.strokePath();
        currentWave.lineStyle(1, 0xF4F4F4, 0.72);
        currentWave.strokeCircle(0, 0, radius - (compact ? 8 : 11));
        currentWave.setBlendMode?.(Phaser.BlendModes.ADD);

        const rayLength = compact ? 118 : 162;
        [-0.82, -0.28, 0.28, 0.82].forEach((ratio, index) => {
            const endX = ratio * rayLength;
            const endY = (compact ? 78 : 104) + ((index % 2) * 13);
            crownSignal.lineStyle(5, 0x071411, 0.46);
            crownSignal.lineBetween(ratio * 20, 22, endX, endY);
            crownSignal.lineStyle(1, index % 2 ? 0x8FE3CF : 0x71E6B1, 0.82);
            crownSignal.lineBetween(ratio * 20, 22, endX, endY);
            crownSignal.fillStyle(index % 2 ? 0x8FE3CF : 0x71E6B1, 0.88);
            crownSignal.fillCircle(endX, endY, compact ? 2.5 : 3);
        });
        crownSignal.setBlendMode?.(Phaser.BlendModes.ADD);
        reveal.add([currentWave, crownSignal, title, subtitle]);
        reveal
            .setAlpha(0)
            .setData('villageArrivalReveal', true)
            .setData('villageArrivalRevealWorldLed', true)
            .setData('villageArrivalRevealBlockingPanel', false)
            .setData('villageArrivalRevealSkippable', true)
            .setData('villageArrivalRevealDuration', duration)
            .setData('villageArrivalRevealTitle', title.text)
            .setData('villageArrivalRevealSubtitle', subtitle.text)
            .setData(
                'ariaLabel',
                `${title.text}. ${subtitle.text}. Tap or press any key to continue.`
            );
        currentWave
            .setScale(0.68)
            .setAlpha(0)
            .setData('villageArrivalCurrentWave', true);
        crownSignal
            .setAlpha(0)
            .setData('villageArrivalRootAnswer', true);
        title.setAlpha(0);
        subtitle.setAlpha(0);

        landmark.arrivalReveal = reveal;
        landmark.arrivalRevealTweens = [
            this.scene.tweens.add({
                targets: reveal,
                alpha: 1,
                duration: 260,
                ease: 'Sine.easeOut'
            }),
            this.scene.tweens.add({
                targets: currentWave,
                alpha: { from: 0.82, to: 0 },
                scaleX: { from: 0.68, to: 1.55 },
                scaleY: { from: 0.68, to: 1.55 },
                duration: 1180,
                delay: 180,
                repeat: 1,
                repeatDelay: 90,
                ease: 'Sine.easeOut'
            }),
            this.scene.tweens.add({
                targets: crownSignal,
                alpha: { from: 0, to: 0.94 },
                duration: 520,
                delay: 320,
                yoyo: true,
                hold: 860,
                ease: 'Sine.easeInOut'
            }),
            this.scene.tweens.add({
                targets: [title, subtitle],
                alpha: { from: 0, to: 1 },
                y: '-=5',
                duration: 420,
                delay: 360,
                yoyo: true,
                hold: 1120,
                ease: 'Sine.easeInOut'
            })
        ];
        return true;
    }

    clearVillageArrivalReveal(landmark) {
        if (!landmark) return false;
        const wasActive = Boolean(landmark.arrivalReveal?.active);
        landmark.arrivalRevealTweens?.forEach(tween => tween?.stop?.());
        landmark.arrivalRevealTweens = [];
        landmark.arrivalReveal?.destroy?.(true);
        landmark.arrivalReveal = null;
        return wasActive;
    }

    setVillageFocusMode(
        landmark,
        active,
        {
            immediate = false,
            presentationMode = active ? 'action' : 'ambient',
            focusPlotIdOverride
        } = {}
    ) {
        if (!landmark?.zone) return false;
        landmark.focusTweens?.forEach(tween => tween?.stop?.());
        landmark.focusTweens = [];
        landmark.focusModeActive = Boolean(active);
        landmark.presentationMode = active ? presentationMode : 'ambient';

        const action = landmark.snapshot?.worldState?.nextAction || null;
        const storyMode = Boolean(active && presentationMode === 'story');
        const ambientFocusPlotId = !active && ['build', 'assign'].includes(action?.type)
            ? action.plotId
            : null;
        const focusPlotId = active
            ? focusPlotIdOverride !== undefined
                ? focusPlotIdOverride
                : ['build', 'assign'].includes(action?.type)
                    ? action.plotId
                    : null
            : ambientFocusPlotId;
        const heartIsPrimary = !focusPlotId;
        const transition = (target, alpha) => {
            if (!target?.active) return;
            if (immediate || !this.scene.tweens?.add) {
                target.setAlpha(alpha);
                return;
            }
            landmark.focusTweens.push(this.scene.tweens.add({
                targets: target,
                alpha,
                duration: 220,
                ease: 'Sine.easeOut'
            }));
        };

        landmark.plotPresentations?.forEach(presentation => {
            const primary = Boolean(focusPlotId && presentation.plotId === focusPlotId);
            const directPlotCommand = Boolean(
                primary && ['build', 'assign'].includes(action?.type)
            );
            const priority = primary
                ? 'primary'
                : !active
                    ? 'ambient'
                    : 'supporting';
            const settled = ['constructing', 'needs_helper', 'complete', 'staffed'].includes(
                presentation.plotState
            );
            const ambientAlpha = primary
                ? 1
                : presentation.plotState === 'constructing'
                    ? 0.9
                    : settled
                        ? 0.82
                        : 0.24;
            const alpha = !active
                ? ambientAlpha
                : storyMode
                    ? primary ? 0.86 : 0.48
                    : primary
                        ? 1
                        : presentation.plotState === 'constructing'
                            ? 0.76
                            : focusPlotId
                                ? 0.4
                                : 0.46;
            const plotLabelAlpha = !active
                ? presentation.plotLabelRestAlpha
                : directPlotCommand
                    ? 0
                : storyMode
                    ? primary ? 0.88 : 0
                    : primary ? 1 : 0.08;
            const stateLabelAlpha = !active
                ? presentation.stateLabelRestAlpha
                : directPlotCommand
                    ? 0
                : storyMode
                    ? 0
                    : primary || presentation.plotState === 'constructing' ? 1 : 0;

            presentation.container
                ?.setData('villageFocusPriority', priority)
                .setData('villageFocusAlpha', alpha)
                .setData('villageFocusAction', action?.type || null)
                .setData('villagePresentationMode', landmark.presentationMode);
            presentation.focusRing
                ?.setData('villageFocusPrimary', primary)
                .setAlpha(!storyMode && primary && !directPlotCommand ? 0.82 : 0);
            const anchorAlpha = !active
                ? presentation.districtAnchor?.getData?.('villageDistrictGuided')
                    ? 1
                    : ['constructing', 'needs_helper', 'complete', 'staffed'].includes(
                        presentation.plotState
                    )
                        ? 0.58
                        : 0.3
                : storyMode
                    ? primary ? 0.82 : 0.12
                    : primary ? 1 : 0.18;
            presentation.districtAnchor
                ?.setData('villageFocusPrimary', primary)
                .setData('villageFocusPriority', priority);
            transition(presentation.districtAnchor, anchorAlpha);
            presentation.plotLabel?.setAlpha(plotLabelAlpha);
            presentation.stateLabel?.setAlpha(stateLabelAlpha);
            presentation.hitZone?.setData('villagePresentationMode', landmark.presentationMode);
            if (landmark.snapshot?.unlock?.unlocked) {
                presentation.hitZone?.setInteractive?.({ useHandCursor: true });
            }
            transition(presentation.container, alpha);
            if (presentation.worker) {
                const workerAlpha = !active
                    ? primary ? 0.92 : 0.72
                    : storyMode
                        ? primary ? 0.78 : 0.24
                        : primary
                            ? 1
                            : focusPlotId ? 0.36 : 0.54;
                presentation.worker
                    .setData('villageFocusPriority', priority)
                    .setData('villageFocusAlpha', workerAlpha)
                    .setData('villagePresentationMode', landmark.presentationMode);
                if (storyMode) {
                    presentation.worker.disableInteractive();
                } else {
                    presentation.worker.setInteractive({ useHandCursor: true });
                }
                transition(presentation.worker, workerAlpha);
            }
        });

        const heartBaseAlpha = landmark.snapshot?.unlock?.unlocked === true ? 1 : 0.52;
        const heartAlpha = !active
            ? heartIsPrimary ? heartBaseAlpha : heartBaseAlpha * 0.88
            : storyMode
                ? heartIsPrimary ? heartBaseAlpha : heartBaseAlpha * 0.62
                : focusPlotId
                    ? heartBaseAlpha * 0.78
                    : heartBaseAlpha;
        landmark.heartArtwork
            ?.setData('villageFocusPriority', heartIsPrimary ? 'primary' : active ? 'supporting' : 'ambient')
            .setData('villageFocusAlpha', heartAlpha)
            .setData('villageFocusAction', action?.type || null);
        landmark.actionLabel
            ?.setData('villageFocusPrimary', heartIsPrimary)
            .setData('villageFocusAction', action?.type || null);
        // The shared Sanctuary interaction beacon owns action copy. Keeping this
        // text hidden prevents the Heart from publishing the same command twice.
        const actionVisible = false;
        if (landmark.actionLabel) {
            landmark.actionLabel.setAlpha(actionVisible ? (active ? 1 : 0.58) : 0);
            if (actionVisible) {
                landmark.actionLabel.setInteractive({ useHandCursor: true });
            } else {
                landmark.actionLabel.disableInteractive();
            }
        }
        landmark.zone.setInteractive?.({ useHandCursor: true });
        landmark.label?.setAlpha(storyMode ? 0.3 : active ? 0.8 : 0.18);
        landmark.statusLabel?.setAlpha(storyMode ? 0.16 : active ? 0.68 : 0);
        landmark.heartCaption?.setAlpha(storyMode ? 0.44 : active ? 0.9 : 0.42);
        landmark.arrivalGuide?.setAlpha(storyMode ? 0.12 : active ? 0.82 : 0.24);
        Object.entries(landmark.heartLife || {}).forEach(([key, element]) => {
            if (!element || key === 'deliveryPulse') return;
            const lifeBaseAlpha = landmark.snapshot?.unlock?.unlocked === true ? 1 : 0.38;
            const lifeAlpha = lifeBaseAlpha * (storyMode
                ? heartIsPrimary ? 0.54 : 0.24
                : active && focusPlotId
                    ? 0.58
                    : 1);
            element
                .setData('villagePresentationMode', landmark.presentationMode)
                .setData('villageFocusAlpha', lifeAlpha);
            transition(element, lifeAlpha);
        });
        landmark.heartLife?.deliveryPulse
            ?.setData('villagePresentationMode', landmark.presentationMode)
            .setData('villageFocusAlpha', storyMode ? 0.18 : 1);
        if (landmark.nextActionElement && landmark.nextActionElement !== landmark.actionLabel) {
            landmark.nextActionElement.setAlpha(storyMode ? 0 : 1);
            if (storyMode) {
                landmark.nextActionElement.disableInteractive?.();
            } else {
                landmark.nextActionElement.setInteractive?.({ useHandCursor: true });
            }
        }
        if (landmark.nextActionHitZone) {
            if (storyMode) {
                landmark.nextActionHitZone.disableInteractive?.();
            } else {
                landmark.nextActionHitZone.setInteractive?.({ useHandCursor: true });
            }
        }
        if (storyMode) {
            landmark.nextActionTween?.pause?.();
        } else {
            landmark.nextActionTween?.resume?.();
        }
        landmark.nextActionPlacard?.setAlpha(storyMode ? 0 : 1);
        landmark.nextActionRing?.setAlpha(storyMode ? 0 : 1);
        landmark.guidanceRoute?.setAlpha(storyMode ? 0 : active ? 1 : 0.72);
        landmark.villageFlowSignals?.forEach(signal => {
            signal?.setData(
                'villageFocusAlphaMultiplier',
                storyMode ? 0.22 : active ? 0.52 : 1
            );
        });
        transition(landmark.heartArtwork, heartAlpha);
        transition(landmark.heart, heartAlpha);
        return true;
    }

    drawVillageFoundationCradle(
        drawing,
        {
            state = 'dormant',
            unlocked = false,
            guided = false,
            compact = false,
            index = 0
        } = {}
    ) {
        if (!drawing) return false;
        const active = unlocked && state === 'available';
        const accent = guided ? 0xF2C14E : active ? 0x71E6B1 : 0x53616A;
        const foundationWidth = compact ? 82 : 92;
        const foundationHeight = compact ? 25 : 28;

        drawing.fillStyle(0x071411, unlocked ? 0.78 : 0.64);
        drawing.fillEllipse(0, 24, foundationWidth, foundationHeight);
        drawing.fillStyle(0x173D36, unlocked ? 0.68 : 0.34);
        drawing.fillEllipse(0, 20, foundationWidth - 12, foundationHeight - 9);

        const rootOffsets = [-1, 1];
        rootOffsets.forEach((direction, rootIndex) => {
            const verticalBias = ((index + rootIndex) % 2 === 0 ? -1 : 1) * 3;
            drawing.lineStyle(
                rootIndex === 0 ? 5 : 3,
                0x071411,
                unlocked ? 0.72 : 0.54
            );
            drawing.beginPath();
            drawing.moveTo(direction * 5, 20);
            drawing.lineTo(direction * 19, 14 + verticalBias);
            drawing.lineTo(direction * 32, 20 - verticalBias);
            drawing.lineTo(direction * 41, 14 + verticalBias);
            drawing.strokePath();
            drawing.lineStyle(rootIndex === 0 ? 2 : 1, accent, active ? 0.58 : 0.24);
            drawing.beginPath();
            drawing.moveTo(direction * 5, 20);
            drawing.lineTo(direction * 19, 14 + verticalBias);
            drawing.lineTo(direction * 32, 20 - verticalBias);
            drawing.lineTo(direction * 41, 14 + verticalBias);
            drawing.strokePath();
        });

        [-28, 0, 28].forEach((stoneX, stoneIndex) => {
            const stoneY = 18 + Math.abs(stoneIndex - 1) * 4;
            drawing.fillStyle(stoneIndex === 1 ? 0x273C37 : 0x1E332E, 0.92);
            drawing.fillEllipse(stoneX, stoneY, stoneIndex === 1 ? 19 : 17, 9);
            drawing.lineStyle(1, accent, active ? 0.42 : 0.16);
            drawing.strokeEllipse(stoneX, stoneY, stoneIndex === 1 ? 17 : 15, 7);
        });

        drawing.fillStyle(0x061310, 0.94);
        drawing.fillEllipse(0, 6, 22, 30);
        drawing.lineStyle(2, accent, active ? 0.78 : 0.28);
        drawing.beginPath();
        drawing.arc(0, 6, 11, Math.PI * 0.18, Math.PI * 0.82);
        drawing.strokePath();
        drawing.beginPath();
        drawing.arc(0, 6, 11, Math.PI * 1.18, Math.PI * 1.82);
        drawing.strokePath();
        drawing.lineStyle(1, active ? 0xF4F4F4 : 0x657682, active ? 0.7 : 0.22);
        drawing.lineBetween(0, -5, 0, 17);
        if (active) {
            drawing.fillStyle(accent, guided ? 0.95 : 0.8);
            drawing.fillCircle(0, 6, guided ? 4 : 3);
            drawing.fillEllipse(-9, -7, 12, 6);
            drawing.fillEllipse(9, -9, 13, 6);
        }

        drawing
            .setData('villageFoundationCradle', true)
            .setData('villageFoundationState', state)
            .setData('villageFoundationGuided', guided)
            .setData('villageFoundationMaterial', 'living_root_cradle_v2')
            .setData('ariaLabel', `${state} living root cradle`);
        return true;
    }

    createVillageArrivalGuide(landmark, snapshot, { compact = false } = {}) {
        if (
            !landmark?.zone ||
            snapshot?.unlock?.unlocked !== true ||
            snapshot?.state?.guidanceSeen === true ||
            (snapshot?.worldState?.restored || 0) > 0
        ) {
            return false;
        }

        const guideX = landmark.zone.x + (compact ? 0 : -142);
        const guideY = landmark.zone.y + (compact ? 220 : 126);
        const guide = this.scene.add.container(guideX, guideY)
            .setDepth(guideY - 2)
            .setData('villageArrivalGuide', true)
            .setData('villageArrivalMessage', 'BUILD A HOME TOGETHER')
            .setData('villageArrivalSteps', ['BUILD', 'INVITE', 'GROW']);
        const ground = this.scene.add.graphics();
        ground.fillStyle(0x071411, 0.78);
        ground.fillEllipse(0, 4, compact ? 188 : 220, compact ? 42 : 48);
        ground.lineStyle(2, 0x71E6B1, 0.56);
        ground.beginPath();
        ground.arc(0, 5, compact ? 88 : 104, Math.PI * 1.08, Math.PI * 1.92);
        ground.strokePath();
        [-1, 0, 1].forEach(stepIndex => {
            const stepX = stepIndex * (compact ? 41 : 48);
            ground.fillStyle(0x061310, 0.96);
            ground.fillCircle(stepX, 3, 7);
            ground.lineStyle(1.5, stepIndex === 0 ? 0xF2C14E : 0x71E6B1, 0.78);
            ground.strokeCircle(stepX, 3, 5);
            ground.fillStyle(0xF4F4F4, 0.82);
            ground.fillCircle(stepX, 3, 1.5);
        });
        const title = this.scene.add.text(0, -24, 'BUILD A HOME TOGETHER', {
            fontSize: compact ? '9px' : '10px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#F4F4F4',
            stroke: '#07100F',
            strokeThickness: 4
        }).setOrigin(0.5);
        const steps = this.scene.add.text(0, compact ? 20 : 26, 'BUILD  ·  INVITE  ·  GROW', {
            fontSize: compact ? '7px' : '8px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#8FE3CF',
            stroke: '#07100F',
            strokeThickness: 3
        }).setOrigin(0.5);
        guide.add([ground, title, steps]);
        landmark.arrivalGuide = guide;
        landmark.arrivalGuideTween = this.scene.tweens.add({
            targets: ground,
            alpha: { from: 0.62, to: 1 },
            duration: 1800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        landmark.buildingElements.push(guide);
        landmark.buildingTweens.push(landmark.arrivalGuideTween);
        return true;
    }

    createVillagePlotStateMarker({
        state,
        progress = 0,
        compact = false,
        built = false
    } = {}) {
        const marker = this.scene.add.graphics();
        const nodeCount = 6;
        const activeNodesByState = {
            dormant: 0,
            available: 1,
            constructing: Math.max(1, Math.round(progress * nodeCount)),
            needs_helper: nodeCount - 1,
            complete: nodeCount,
            staffed: nodeCount
        };
        const activeNodes = activeNodesByState[state] ?? 0;
        const activeColor = ['available', 'constructing', 'needs_helper'].includes(state)
            ? 0xF2C14E
            : 0x71E6B1;
        const radiusX = built
            ? (compact ? 54 : 64)
            : (compact ? 37 : 43);
        const radiusY = built
            ? (compact ? 16 : 18)
            : (compact ? 11 : 13);
        const centerY = built ? 27 : 24;
        const nodeRadius = compact ? 2.5 : 3;

        for (let index = 0; index < nodeCount; index += 1) {
            const angle = -Math.PI / 2 + (index / nodeCount) * Math.PI * 2;
            const nodeX = Math.cos(angle) * radiusX;
            const nodeY = centerY + Math.sin(angle) * radiusY;
            marker.fillStyle(0x071411, 0.88);
            marker.fillCircle(nodeX, nodeY, nodeRadius + 1.5);
            if (index < activeNodes) {
                marker.fillStyle(activeColor, state === 'available' ? 0.92 : 0.82);
                marker.fillCircle(nodeX, nodeY, nodeRadius);
            } else {
                marker.fillStyle(0x657682, state === 'dormant' ? 0.22 : 0.38);
                marker.fillCircle(nodeX, nodeY, nodeRadius - 0.5);
            }
            if (state === 'needs_helper' && index === nodeCount - 1) {
                marker.lineStyle(1.5, 0xF2C14E, 0.9);
                marker.strokeCircle(nodeX, nodeY, nodeRadius + 2.5);
            }
        }

        if (state === 'staffed') {
            marker.lineStyle(1.5, 0xF4F4F4, 0.72);
            marker.lineBetween(-7, centerY, 7, centerY);
            marker.fillStyle(0x71E6B1, 0.96);
            marker.fillCircle(-7, centerY, 3);
            marker.fillCircle(7, centerY, 3);
            marker.fillStyle(0xF4F4F4, 0.96);
            marker.fillCircle(0, centerY, 2.5);
        } else if (state === 'complete') {
            marker.fillStyle(0x71E6B1, 0.92);
            marker.fillCircle(0, centerY, 3);
        }

        marker
            .setData('villagePlotState', state)
            .setData('progressNodes', activeNodes)
            .setData('progressRatio', progress)
            .setData('ariaLabel', `${String(state || 'dormant').replace('_', ' ')} foundation`);
        marker.setBlendMode?.(Phaser.BlendModes.ADD);
        return marker;
    }

    createVillageDistrictAnchor({
        state,
        guided = false,
        built = false,
        compact = false,
        districtId = null
    } = {}) {
        const anchor = this.scene.add.graphics();
        const active = ['constructing', 'needs_helper', 'complete', 'staffed'].includes(state);
        const color = guided || ['constructing', 'needs_helper'].includes(state)
            ? 0xF2C14E
            : active
                ? 0x71E6B1
                : 0x8FE3CF;
        const y = built ? (compact ? 70 : 77) : (compact ? 48 : 53);
        const width = compact ? 34 : 40;

        anchor.fillStyle(0x071411, 0.88);
        anchor.fillEllipse(0, y, width + 20, compact ? 16 : 18);
        anchor.lineStyle(2, color, guided ? 0.92 : active ? 0.66 : 0.36);
        anchor.beginPath();
        anchor.arc(0, y, width / 2, Math.PI * 1.08, Math.PI * 1.92);
        anchor.strokePath();
        anchor.fillStyle(color, guided ? 1 : active ? 0.88 : 0.56);
        anchor.fillCircle(0, y - 1, guided ? 4 : 3);
        anchor.fillStyle(0xF4F4F4, guided ? 0.96 : 0.72);
        anchor.fillCircle(0, y - 1, 1.5);
        [-1, 1].forEach(direction => {
            anchor.lineStyle(1, color, guided ? 0.76 : 0.4);
            anchor.lineBetween(
                direction * 6,
                y - 1,
                direction * (width / 2),
                y - 7
            );
            anchor.fillStyle(color, guided ? 0.82 : 0.46);
            anchor.fillEllipse(direction * (width / 2), y - 8, 8, 4);
        });
        anchor
            .setAlpha(guided ? 1 : active ? 0.58 : 0.3)
            .setData('villageDistrictAnchor', true)
            .setData('villageDistrictId', districtId)
            .setData('villageDistrictState', state)
            .setData('villageDistrictGuided', guided)
            .setData('villageDistrictAnchorMaterial', 'root_threshold_v1')
            .setData('ariaLabel', `${String(state || 'dormant').replace('_', ' ')} root district`);
        anchor.setBlendMode?.(Phaser.BlendModes.ADD);
        return anchor;
    }

    createVillageValueGrowth(landmark, snapshot, { compact = false } = {}) {
        const values = snapshot?.worldState?.values || { care: 0, readiness: 0 };
        const heartX = landmark?.zone?.x;
        const heartY = landmark?.zone?.y;
        if (!Number.isFinite(heartX) || !Number.isFinite(heartY)) return false;

        const careOffsets = compact
            ? [[-98, 86], [-48, 123], [-118, 22]]
            : [[-120, 88], [-58, 132], [-150, 12]];
        const readinessOffsets = compact
            ? [[98, 86], [48, 123], [118, 22]]
            : [[120, 88], [58, 132], [150, 12]];
        const elements = [];
        const createGrowth = (kind, index, offset) => {
            const color = kind === 'care' ? 0x71E6B1 : 0xF2C14E;
            const growth = this.scene.add.graphics()
                .setPosition(heartX + offset[0], heartY + offset[1])
                .setDepth(landmark.zone.y + 5)
                .setData('villageValueGrowth', kind)
                .setData('growthIndex', index);
            growth.fillStyle(0x071411, 0.76);
            growth.fillEllipse(0, 8, compact ? 24 : 28, compact ? 10 : 12);
            if (kind === 'care') {
                growth.lineStyle(2, color, 0.92);
                growth.lineBetween(0, 8, 0, -10 - index * 2);
                growth.fillStyle(color, 0.9);
                growth.fillEllipse(-5, -3, 9, 5);
                growth.fillEllipse(5, -7, 9, 5);
                growth.fillStyle(0xF4F4F4, 0.82);
                growth.fillCircle(0, -12 - index * 2, 2);
            } else {
                growth.lineStyle(2, color, 0.88);
                growth.strokeTriangle(0, -15 - index, -8, 6, 8, 6);
                growth.fillStyle(color, 0.8);
                growth.fillTriangle(0, -11 - index, -5, 4, 5, 4);
                growth.fillStyle(0xF4F4F4, 0.9);
                growth.fillCircle(0, -2, 2);
            }
            growth.setBlendMode?.(Phaser.BlendModes.ADD);
            landmark.buildingElements.push(growth);
            landmark.buildingTweens.push(this.scene.tweens.add({
                targets: growth,
                alpha: { from: 0.62, to: 1 },
                y: { from: growth.y + 2, to: growth.y - 2 },
                duration: 1700 + index * 220,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            }));
            elements.push(growth);
        };
        for (let index = 0; index < Math.min(3, values.care || 0); index += 1) {
            createGrowth('care', index, careOffsets[index]);
        }
        for (let index = 0; index < Math.min(3, values.readiness || 0); index += 1) {
            createGrowth('readiness', index, readinessOffsets[index]);
        }
        landmark.valueGrowthElements = elements;
        return elements.length > 0;
    }

    createVillageGuidanceRoute({ landmark, action, position, compact = false } = {}) {
        if (!landmark?.zone || !action || !position) return null;

        const color = action.type === 'assign' ? 0x71E6B1 : 0xF2C14E;
        const start = {
            x: landmark.zone.x,
            y: landmark.zone.y + 18
        };
        const end = {
            x: position.x,
            y: position.y + 18
        };
        const bend = {
            x: start.x + ((end.x - start.x) * 0.56),
            y: start.y + ((end.y - start.y) * 0.34) + (end.x < start.x ? 16 : -16)
        };
        const points = Array.from({ length: 19 }, (_, pointIndex) => {
            const progress = pointIndex / 18;
            const inverse = 1 - progress;
            return {
                x: (inverse * inverse * start.x) +
                    (2 * inverse * progress * bend.x) +
                    (progress * progress * end.x),
                y: (inverse * inverse * start.y) +
                    (2 * inverse * progress * bend.y) +
                    (progress * progress * end.y)
            };
        });
        const route = this.scene.add.graphics()
            .setDepth(-16)
            .setData('villageGuidanceRoute', true)
            .setData('villageRouteMaterial', 'current_stepping_lights_v1')
            .setData('villageNextAction', action.type)
            .setData('plotId', action.plotId)
            .setData('routePointCount', points.length);
        const strokeRoute = (width, strokeColor, alpha) => {
            route.lineStyle(width, strokeColor, alpha);
            route.beginPath();
            route.moveTo(points[0].x, points[0].y);
            points.slice(1).forEach(point => route.lineTo(point.x, point.y));
            route.strokePath();
        };
        strokeRoute(compact ? 14 : 18, 0x061310, 0.78);
        strokeRoute(compact ? 5 : 6, color, 0.62);
        strokeRoute(1, 0xF4F4F4, 0.58);

        const guidanceNodes = [4, 8, 12, 16];
        guidanceNodes.forEach((pointIndex, nodeIndex) => {
            const point = points[pointIndex];
            route.fillStyle(0x061310, 0.9);
            route.fillCircle(point.x, point.y, compact ? 5 : 6);
            route.fillStyle(color, 0.94);
            route.fillCircle(point.x, point.y, 2 + (nodeIndex * 0.35));
        });
        route.setData('guidanceNodeCount', guidanceNodes.length);
        return route;
    }

    createVillageNextActionBeacon(landmark, snapshot, { compact = false } = {}) {
        const action = snapshot?.worldState?.nextAction;
        if (!landmark?.zone || !action) return false;
        landmark.nextActionElement = null;
        landmark.nextActionHitZone = null;
        landmark.nextActionPlacard = null;
        landmark.nextActionRing = null;
        landmark.nextActionTween = null;
        landmark.guidanceRoute = null;

        if (action.type === 'decision' || action.type === 'supplies') {
            landmark.actionLabel
                .setText(action.label)
                .setAlpha(1)
                .setColor(action.type === 'decision' ? '#8FE3CF' : '#F2C14E');
            landmark.actionLabel
                .setData('villageNextAction', action.type)
                .setData('definitionId', action.definitionId || null);
            landmark.nextActionElement = landmark.actionLabel;
            return true;
        }
        if (!['build', 'assign'].includes(action.type) || !action.plotId) return false;

        landmark.actionLabel
            .setText('')
            .setAlpha(0)
            .disableInteractive();

        const position = landmark.plotWorldPositions?.get(action.plotId);
        if (!position) return false;
        const color = action.type === 'assign' ? 0x71E6B1 : 0xF2C14E;
        const guidanceRoute = this.createVillageGuidanceRoute({
            landmark,
            action,
            position,
            compact
        });
        const ring = this.scene.add.graphics()
            .setPosition(position.x, position.y + 16)
            .setDepth(position.y + 5)
            .setData('villageNextActionRing', action.type);
        ring.lineStyle(3, color, 0.9);
        ring.beginPath();
        ring.arc(0, 0, compact ? 57 : 70, Math.PI * 0.08, Math.PI * 0.88);
        ring.strokePath();
        ring.beginPath();
        ring.arc(0, 0, compact ? 57 : 70, Math.PI * 1.08, Math.PI * 1.88);
        ring.strokePath();
        ring.fillStyle(color, 0.96);
        ring.fillTriangle(0, -52, -7, -40, 7, -40);
        ring.setBlendMode?.(Phaser.BlendModes.ADD);

        const labelX = compact
            ? position.x + (position.x > landmark.zone.x ? -16 : position.x < landmark.zone.x ? 16 : 0)
            : position.x;
        const labelY = position.y - (compact ? 92 : 106);
        const actionCopy = compact
            ? `TAP · ${action.label}`
            : `NEXT · ${action.label}`;
        const labelBackdrop = this.scene.add.graphics()
            .setPosition(labelX, labelY)
            .setDepth(position.y + 7)
            .setData('villageNextActionPlacard', true);
        labelBackdrop.fillStyle(0x061310, 0.9);
        labelBackdrop.fillRoundedRect(
            compact ? -72 : -86,
            -14,
            compact ? 144 : 172,
            28,
            6
        );
        labelBackdrop.lineStyle(1, color, 0.68);
        labelBackdrop.strokeRoundedRect(
            compact ? -71 : -85,
            -13,
            compact ? 142 : 170,
            26,
            5
        );
        const label = this.scene.add.text(
            labelX,
            labelY,
            actionCopy,
            {
                fontSize: compact ? '9px' : '10px',
                fontFamily: 'Arial, sans-serif',
                fontStyle: 'bold',
                color: action.type === 'assign' ? '#8FE3CF' : '#F2C14E',
                align: 'center',
                stroke: '#07100F',
                strokeThickness: 4,
                wordWrap: { width: compact ? 130 : 158 }
            }
        ).setOrigin(0.5)
            .setDepth(position.y + 8)
            .setInteractive({ useHandCursor: true })
            .setData('villageNextAction', action.type)
            .setData('plotId', action.plotId)
            .setData('definitionId', action.definitionId || null)
            .setData('villageActionCopy', actionCopy);
        label.on('pointerdown', () => this.activateVillageHeart(landmark, action.plotId));

        const hitZone = this.scene.add.zone(
            labelX,
            labelY,
            compact ? 156 : 184,
            52
        )
            .setDepth(position.y + 9)
            .setInteractive({ useHandCursor: true })
            .setData('villageNextActionHitZone', true)
            .setData('touchTargetWidth', compact ? 156 : 184)
            .setData('touchTargetHeight', 52)
            .setData('villageNextAction', action.type)
            .setData('plotId', action.plotId)
            .setData('definitionId', action.definitionId || null);
        hitZone.on('pointerdown', () => this.activateVillageHeart(landmark, action.plotId));

        landmark.nextActionElement = label;
        landmark.nextActionHitZone = hitZone;
        landmark.nextActionPlacard = labelBackdrop;
        landmark.nextActionRing = ring;
        landmark.guidanceRoute = guidanceRoute;
        landmark.buildingElements.push(
            ...(guidanceRoute ? [guidanceRoute] : []),
            ring,
            labelBackdrop,
            label,
            hitZone
        );
        landmark.nextActionTween = this.scene.tweens.add({
            targets: [ring, label, ...(guidanceRoute ? [guidanceRoute] : [])],
            alpha: { from: 0.68, to: 1 },
            duration: 1050,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        landmark.buildingTweens.push(landmark.nextActionTween);
        return true;
    }

    createVillageHeartMemories(landmark, snapshot, { compact = false } = {}) {
        const choices = snapshot?.heartDecision?.completed || [];
        if (!landmark?.zone || choices.length === 0) return false;

        const heartX = landmark.zone.x;
        const heartY = landmark.zone.y - 12;
        const offsets = compact
            ? [{ x: -68, y: 34 }, { x: 0, y: 66 }, { x: 68, y: 34 }]
            : [{ x: -86, y: 30 }, { x: 0, y: 78 }, { x: 86, y: 30 }];
        const traces = this.scene.add.graphics()
            .setDepth(landmark.zone.y - 1)
            .setData('villageHeartMemoryCount', choices.length);

        choices.forEach((choice, index) => {
            const color = choice.option.value === 'care' ? 0x71E6B1 : 0xF2C14E;
            const offset = offsets[index] || offsets[offsets.length - 1];
            const markerX = heartX + offset.x;
            const markerY = heartY + offset.y;

            choice.definition.requiredBuildingIds.forEach(buildingId => {
                const building = snapshot.buildings.find(entry => (
                    entry.definitionId === buildingId
                ));
                const source = landmark.plotWorldPositions?.get(building?.plotId);
                if (!source) return;
                traces.lineStyle(2, color, 0.2);
                traces.beginPath();
                traces.moveTo(source.x, source.y + 14);
                traces.lineTo(markerX, markerY);
                traces.strokePath();
            });

            const marker = this.scene.add.graphics()
                .setPosition(markerX, markerY)
                .setDepth(landmark.zone.y + 7)
                .setData('villageHeartMemory', choice.decisionId)
                .setData('optionId', choice.optionId)
                .setData('value', choice.option.value)
                .setData('speakerName', choice.speakerName)
                .setData('followUpLine', choice.followUpLine);
            marker.fillStyle(0x071411, 0.92);
            marker.fillCircle(0, 0, compact ? 12 : 14);
            marker.lineStyle(2, color, 0.92);
            marker.strokeCircle(0, 0, compact ? 10 : 12);
            if (choice.option.value === 'care') {
                marker.fillStyle(color, 0.96);
                marker.fillTriangle(-1, 6, -7, -2, -1, -7);
                marker.fillTriangle(1, 6, 7, -2, 1, -7);
                marker.lineStyle(1, 0xF4F4F4, 0.8);
                marker.lineBetween(0, 7, 0, -6);
            } else {
                marker.fillStyle(color, 0.96);
                marker.fillTriangle(0, -8, -7, 0, 0, 8);
                marker.fillTriangle(0, -8, 7, 0, 0, 8);
                marker.fillStyle(0xF4F4F4, 0.9);
                marker.fillCircle(0, 0, 2);
            }
            marker.setBlendMode?.(Phaser.BlendModes.ADD);
            landmark.heartMemoryElements.push(marker);
            landmark.buildingElements.push(marker);
            landmark.buildingTweens.push(this.scene.tweens.add({
                targets: marker,
                alpha: { from: 0.72, to: 1 },
                scaleX: { from: 0.94, to: 1.06 },
                scaleY: { from: 0.94, to: 1.06 },
                duration: 1500 + index * 240,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            }));
        });

        traces.setBlendMode?.(Phaser.BlendModes.ADD);
        landmark.heartMemoryElements.unshift(traces);
        landmark.buildingElements.push(traces);
        return true;
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
            -114,
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
        const impact = this.scene.add.text(
            0,
            -92,
            complete
                ? building.definition.worldEffectLabel
                : 'THE CURRENT TAKES ROOT',
            {
                fontSize: '9px',
                fontFamily: 'Arial, sans-serif',
                fontStyle: 'bold',
                color: '#F4F4F4',
                stroke: '#050505',
                strokeThickness: 4,
                align: 'center',
                wordWrap: { width: 180 }
            }
        ).setOrigin(0.5);
        const growth = this.scene.add.graphics();
        if (complete) {
            [-42, -21, 0, 21, 42].forEach((rootX, index) => {
                growth.lineStyle(2, index % 2 ? 0x71E6B1 : 0xF2C14E, 0.82);
                growth.beginPath();
                growth.moveTo(rootX, 31);
                growth.lineTo(rootX + (index % 2 ? 7 : -7), 17 - (index % 3) * 4);
                growth.strokePath();
                growth.fillStyle(0x8FE3CF, 0.9);
                growth.fillCircle(rootX + (index % 2 ? 7 : -7), 15 - (index % 3) * 4, 3);
            });
            growth.setBlendMode?.(Phaser.BlendModes.ADD);
        }
        container.add([current, growth, signal, impact, title]);
        container.setData('villageBuildingMomentStage', stage);
        container.setData('villageBuildingImpact', building.definition.worldEffectLabel);
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
            targets: [signal, impact, title, growth],
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
        const container = this.scene.add.container(0, compact ? 23 : 28);
        const residents = Array.isArray(home?.residents) ? home.residents : [];
        const capacity = Math.max(0, Number(home?.capacity) || 0);
        const residentColors = [0x8FE3CF, 0xF2C14E, 0xBFA6FF, 0xD94B4B];
        const slotContainers = Array.from({ length: capacity }, (_, index) => {
            const resident = residents[index] || null;
            const x = (index - ((capacity - 1) / 2)) * (compact ? 38 : 44);
            const slot = this.scene.add.container(x, 0);
            const cradle = this.scene.add.graphics();
            cradle.fillStyle(0x071411, resident ? 0.76 : 0.42);
            cradle.fillEllipse(0, 8, compact ? 30 : 34, compact ? 13 : 15);
            cradle.lineStyle(
                resident ? 2 : 1,
                resident?.atWork ? 0xF2C14E : resident ? 0x71E6B1 : 0x657682,
                resident ? 0.82 : 0.46
            );
            cradle.strokeEllipse(0, 8, compact ? 28 : 32, compact ? 11 : 13);
            const identity = this.scene.add.text(
                0,
                18,
                resident ? resident.name.slice(0, 7).toUpperCase() : 'OPEN',
                {
                    fontSize: compact ? '6px' : '7px',
                    fontFamily: 'Arial, sans-serif',
                    fontStyle: 'bold',
                    color: resident?.atWork ? '#F2C14E' : resident ? '#C9F7E9' : '#85928F',
                    stroke: '#07100F',
                    strokeThickness: 3
                }
            ).setOrigin(0.5);
            slot.add([cradle, identity]);

            if (resident?.atWork) {
                const tether = this.scene.add.graphics();
                tether.lineStyle(2, 0xF2C14E, 0.72);
                tether.beginPath();
                tether.moveTo(-7, 5);
                tether.lineTo(-2, -4);
                tether.lineTo(7, -10);
                tether.strokePath();
                tether.fillStyle(0xF2C14E, 0.92);
                tether.fillTriangle(7, -14, 12, -8, 5, -7);
                tether.fillStyle(0xF4F4F4, 0.84);
                tether.fillCircle(-8, 6, 2);
                tether.setData('villageHomeTether', true);
                slot.add(tether);
            } else if (resident) {
                const figure = this.scene.add.graphics();
                const color = residentColors[index % residentColors.length];
                figure.fillStyle(color, 0.98);
                figure.fillCircle(0, -8, compact ? 5 : 6);
                figure.fillEllipse(0, 0, compact ? 10 : 12, compact ? 13 : 15);
                figure.fillStyle(0xF4F4F4, 0.96);
                figure.fillCircle(-2, -9, 1.3);
                figure.fillCircle(2, -9, 1.3);
                figure.lineStyle(1, color, 0.9);
                figure.lineBetween(-4, -12, -7, -17);
                figure.lineBetween(4, -12, 7, -17);
                figure.setData('villageResidentFigure', true);
                slot.add(figure);
            } else {
                const opening = this.scene.add.graphics();
                opening.lineStyle(1, 0x8FE3CF, 0.4);
                opening.strokeCircle(0, -2, 5);
                opening.fillStyle(0x8FE3CF, 0.34);
                opening.fillCircle(0, -2, 2);
                slot.add(opening);
            }
            slot
                .setData('villageHabitatSlot', true)
                .setData('residentName', resident?.name || null)
                .setData('residentStatus', resident?.atWork ? 'helping' : resident ? 'home' : 'open')
                .setData('workLabel', resident?.workLabel || null);
            return slot;
        });
        const status = this.scene.add.text(
            0,
            37,
            residents.length > 0
                ? home.presentCount > 0
                    ? `${home.presentCount} HOME · ${home.helpingCount} OUT HELPING`
                    : `${home.helpingCount} OUT HELPING · LIGHTS ON`
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
        container.add([...slotContainers, status]);
        container.setData('villageHabitatLife', true);
        container.setData('residentNames', residents.map(resident => resident.name));
        container.setData(
            'residentStatuses',
            residents.map(resident => resident.atWork ? 'helping' : 'home')
        );
        container.setData('residentFigureCount', home?.presentCount || 0);
        container.setData('homeTetherCount', home?.helpingCount || 0);
        container.setData('capacity', capacity);
        container.setData('presentCount', home?.presentCount || 0);
        container.setData('helpingCount', home?.helpingCount || 0);
        container.setData(
            'ariaLabel',
            residents.length > 0
                ? `Shared Habitat. ${home.presentCount} home and ${home.helpingCount} out helping. ` +
                    residents.map(resident => (
                        resident.atWork
                            ? `${resident.name} is helping at ${resident.workLabel || 'the settlement'}`
                            : `${resident.name} is home`
                    )).join('. ')
                : `Shared Habitat. ${capacity} places ready for rescued friends.`
        );
        const pulseTween = this.scene.tweens.add({
            targets: container,
            alpha: { from: 0.82, to: 1 },
            scaleX: { from: 0.985, to: 1.015 },
            scaleY: { from: 0.985, to: 1.015 },
            duration: 1700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        return { container, pulseTween };
    }

    createVillageFlowSignal({
        building,
        definition,
        unlocked = false,
        guided = false,
        state = 'available',
        index = 0,
        heartPosition,
        plotPosition
    } = {}) {
        const isDelivery = Boolean(
            building?.status === 'complete' &&
            building.creature &&
            definition?.production
        );
        const isConstruction = building?.status === 'constructing' || state === 'constructing';
        const isGuidance = Boolean(guided && !building);
        const flowVisible = isConstruction || isGuidance;
        const ambientRole = isConstruction
            ? 'construction_current'
            : isGuidance
                ? 'guided_foundation'
                : isDelivery
                    ? 'worker_represents_delivery'
                    : 'quiet_background';
        const resource = isDelivery ? definition.production.resource : null;
        const signalColors = {
            food: 0xF2C14E,
            wood: 0xC58A52,
            stone: 0xD8E2DF
        };
        const color = resource
            ? signalColors[resource] || 0x71E6B1
            : unlocked
                ? 0x71E6B1
                : 0x657682;
        const start = isDelivery ? plotPosition : heartPosition;
        const end = isDelivery ? heartPosition : plotPosition;
        const control = {
            x: (start.x + end.x) / 2 + (index % 2 === 0 ? -16 : 16),
            y: (start.y + end.y) / 2 - 24
        };
        const container = this.scene.add.container(start.x, start.y)
            .setDepth(Math.min(heartPosition.y, plotPosition.y) - 1)
            .setVisible(flowVisible)
            .setActive(flowVisible);
        const halo = this.scene.add.circle(
            0,
            0,
            isDelivery ? 7 : 5,
            color,
            isDelivery ? 0.22 : unlocked ? 0.16 : 0.08
        );
        const core = this.scene.add.circle(
            0,
            0,
            isDelivery ? 3.5 : 2.5,
            color,
            isDelivery ? 0.98 : unlocked ? 0.82 : 0.24
        );
        core.setStrokeStyle?.(1, isDelivery ? 0xF4F4F4 : 0x071411, 0.78);
        container.add([halo, core]);
        if (isDelivery) {
            const cargo = this.createVillageWorkerCargo(resource);
            cargo.setScale(0.58);
            container.add(cargo);
        }
        container.setBlendMode?.(Phaser.BlendModes.ADD);
        container
            .setData('villageFlowSignal', true)
            .setData('direction', isDelivery ? 'to_heart' : 'to_plot')
            .setData('resource', resource)
            .setData('helperName', building?.creature?.name || null)
            .setData('buildingId', building?.definitionId || null)
            .setData('worldEffectLabel', definition?.worldEffectLabel || null)
            .setData('villageFlowVisible', flowVisible)
            .setData('villageAmbientRole', ambientRole)
            .setData(
                'ariaLabel',
                isConstruction
                    ? `${definition?.label || 'The new structure'} draws construction Current from the Village Heart.`
                    : isGuidance
                        ? 'The Current marks the one foundation ready for the next build.'
                        : isDelivery
                            ? `${building.creature.name} visibly carries ${resource} to the Village Heart. ${definition.worldEffectLabel}.`
                            : 'This open foundation stays quiet until the settlement chooses it.'
            );

        const travel = { progress: 0 };
        const updatePosition = () => {
            const progress = Phaser.Math.Clamp(travel.progress, 0, 1);
            const inverse = 1 - progress;
            container.setPosition(
                (inverse * inverse * start.x) +
                    (2 * inverse * progress * control.x) +
                    (progress * progress * end.x),
                (inverse * inverse * start.y) +
                    (2 * inverse * progress * control.y) +
                    (progress * progress * end.y)
            );
            container.setAlpha((
                (isDelivery ? 0.38 : unlocked ? 0.16 : 0.08) +
                Math.sin(progress * Math.PI) * (isDelivery ? 0.62 : unlocked ? 0.72 : 0.12)
            ) * (Number(container.getData('villageFocusAlphaMultiplier')) || 1));
        };
        const tween = this.scene.tweens.add({
            targets: travel,
            progress: 1,
            duration: 2400 + index * 240,
            delay: index * 180,
            paused: !flowVisible,
            repeat: -1,
            ease: 'Sine.easeInOut',
            onUpdate: updatePosition,
            onRepeat: () => {
                travel.progress = 0;
                updatePosition();
            }
        });
        return { container, tween };
    }

    createVillageWorker(building, {
        compact = false,
        index = 0,
        landmark = null,
        plotPosition,
        heartPosition
    } = {}) {
        const deliverySourceId = building.id || `${building.plotId}:${building.definitionId}`;
        const routeStart = {
            x: (plotPosition?.x || 0) + (compact ? -28 : -42),
            y: (plotPosition?.y || 0) + (compact ? 27 : 33)
        };
        const routeEnd = {
            x: (heartPosition?.x || 0) + ((index - 1) * (compact ? 52 : 64)),
            y: (heartPosition?.y || 0) + (compact ? 82 : 92) + ((index % 2) * 8)
        };
        const routeControl = {
            x: (routeStart.x + routeEnd.x) / 2 + (index % 2 === 0 ? -22 : 22),
            y: Math.min(routeStart.y, routeEnd.y) - (compact ? 46 : 58)
        };
        const worker = this.scene.add.container(routeStart.x, routeStart.y)
            .setDepth(routeStart.y + 18);
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
        const deliveryPulse = this.scene.add.graphics().setAlpha(0);
        deliveryPulse.lineStyle(2, accent, 0.86);
        deliveryPulse.strokeCircle(0, 10, 17);
        deliveryPulse.lineStyle(1, 0xF4F4F4, 0.72);
        deliveryPulse.strokeCircle(0, 10, 10);
        deliveryPulse
            .setData('villageDeliveryPulse', true)
            .setData('resource', building.definition.workerRoutine?.carriedResource || null);
        const routeStatus = this.scene.add.text(0, -48, '', {
            fontSize: compact ? '10px' : '9px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#C9F7E9',
            stroke: '#07100F',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5).setAlpha(0);
        routeStatus.setData('villageWorkerRouteStatus', true);
        const checkInCue = this.scene.add.graphics();
        checkInCue.fillStyle(0x061513, 0.9);
        checkInCue.fillCircle(0, -29, 10);
        checkInCue.lineStyle(2, 0x71E6B1, 0.86);
        checkInCue.strokeCircle(0, -29, 9);
        checkInCue.lineStyle(1, 0xF4F4F4, 0.64);
        checkInCue.strokeCircle(0, -29, 5.5);
        checkInCue.fillStyle(0xF4F4F4, 0.95);
        [-4, 0, 4].forEach(dotX => checkInCue.fillCircle(dotX, -29, 1.25));
        checkInCue.fillStyle(0xE85D5D, 0.9);
        checkInCue.fillTriangle(7, -37, 12, -34, 8, -31);
        checkInCue.setData('villageResonanceCue', true);
        worker.add([
            shadow,
            deliveryPulse,
            figure,
            initial,
            cargo,
            routeStatus,
            checkInCue
        ]);
        worker.setScale(scale);
        worker.setData('villageWorker', true);
        worker.setData('helperName', building.creature.name);
        worker.setData('creatureId', building.creature.id);
        worker.setData('buildingId', building.definitionId);
        worker.setData('plotId', building.plotId);
        worker.setData('routineCue', building.definition.workerRoutine?.cue || 'HELPING');
        worker.setData('checkInCue', true);
        worker.setData('checkInCueStyle', 'current_resonance');
        worker.setData('routeType', 'building_to_heart');
        worker.setData(
            'carriedResource',
            building.definition.workerRoutine?.carriedResource || null
        );
        worker.setData('routeProgress', 0);
        worker.setData('routePhase', 'working');
        worker.setData('routeDirection', 'to_heart');
        worker.setData('deliverySourceId', deliverySourceId);
        worker.setData('cargoVisible', true);
        worker.setData('deliveryFeedback', false);
        worker.setData('visibleRoutineCue', building.definition.workerRoutine?.cue || 'HELPING');
        worker.setData('worldEffectLabel', building.definition.worldEffectLabel);
        worker.setData(
            'ariaLabel',
            `${building.creature.name} carries ` +
                `${building.definition.workerRoutine?.carriedResource || 'supplies'} ` +
                `between ${building.definition.label} and the Village Heart. ` +
                `${building.definition.worldEffectLabel}.`
        );
        worker.setSize(compact ? 42 : 48, compact ? 54 : 62);
        worker.setInteractive({ useHandCursor: true });

        const travel = { progress: 0 };
        let previousX = routeStart.x;
        let previousProgress = 0;
        let routeDirection = 'to_heart';
        let deliveryActive = false;
        const worldRoutineCue = {
            forager_hut: 'FORAGING',
            sawmill: 'SHAPING',
            current_masonry: 'LISTENING'
        }[building.definitionId] || 'HELPING';
        worker.setData('visibleRoutineCue', worldRoutineCue);
        const effectCue = String(building.definition.worldEffectLabel || 'SUPPLIES DELIVERED')
            .split('·')
            .pop()
            .trim();
        const updateRoute = () => {
            const progress = Phaser.Math.Clamp(travel.progress, 0, 1);
            if (progress > previousProgress + 0.001) {
                routeDirection = 'to_heart';
            } else if (progress < previousProgress - 0.001) {
                routeDirection = 'to_building';
            }
            const inverse = 1 - progress;
            const x = (inverse * inverse * routeStart.x) +
                (2 * inverse * progress * routeControl.x) +
                (progress * progress * routeEnd.x);
            const y = (inverse * inverse * routeStart.y) +
                (2 * inverse * progress * routeControl.y) +
                (progress * progress * routeEnd.y);
            worker.setPosition(x, y);
            worker.setDepth(y + 18);
            figure.setScale(Math.abs(figure.scaleX) * (x < previousX ? -1 : 1), figure.scaleY);
            previousX = x;
            previousProgress = progress;
            const working = progress < 0.12;
            const delivering = routeDirection === 'to_heart' && progress > 0.82;
            const returning = routeDirection === 'to_building' && !working;
            const carrying = routeDirection === 'to_heart' && !delivering;
            cargo.setAlpha(carrying ? 1 : 0.12);
            cargo.setScale(carrying ? 1 : 0.72);
            deliveryPulse
                .setAlpha(delivering ? 0.82 : 0)
                .setScale(delivering ? 0.72 + ((progress - 0.82) * 2.2) : 0.72);
            const statusCopy = working
                ? worldRoutineCue
                : delivering
                    ? effectCue
                    : '';
            routeStatus
                .setText(statusCopy)
                .setAlpha(statusCopy ? 0.92 : 0)
                .setColor(delivering ? '#F2C14E' : '#C9F7E9');
            checkInCue.setAlpha(working ? 0.92 : delivering ? 0.46 : 0.28);
            worker.setData('routeProgress', Number(progress.toFixed(3)));
            worker.setData(
                'routePhase',
                working
                    ? 'working'
                    : delivering
                        ? 'delivering'
                        : returning
                            ? 'returning'
                            : 'travelling'
            );
            worker.setData('routeDirection', routeDirection);
            worker.setData('cargoVisible', carrying);
            worker.setData('deliveryFeedback', delivering);
            worker.setData('visibleRoutineCue', statusCopy || null);
            if (delivering !== deliveryActive) {
                deliveryActive = delivering;
                this.setVillageHeartDeliveryState(
                    landmark,
                    deliverySourceId,
                    delivering,
                    building.definition.worldEffectLabel
                );
            }
        };
        const moveTween = this.scene.tweens.add({
            targets: travel,
            progress: 1,
            duration: 4300 + (index * 360),
            delay: 700 + (index * 940),
            hold: 1500,
            repeatDelay: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            onUpdate: updateRoute,
            onRepeat: () => {
                travel.progress = 0;
                updateRoute();
            }
        });
        const breatheTween = this.scene.tweens.add({
            targets: figure,
            scaleY: { from: 0.96, to: 1.04 },
            duration: 760 + (index * 90),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        const cueTween = this.scene.tweens.add({
            targets: checkInCue,
            scaleX: { from: 0.92, to: 1.06 },
            scaleY: { from: 0.92, to: 1.06 },
            duration: 980 + (index * 110),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        return { container: worker, moveTween, breatheTween, cueTween };
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

    createVillageResonanceBackdrop({
        width,
        height,
        accent = 0x71E6B1,
        kind = 'current_message',
        y = 0
    } = {}) {
        const backdrop = this.scene.add.graphics().setPosition(0, y);
        const left = -width / 2;
        const top = -height / 2;
        backdrop.fillStyle(0x061513, 0.9);
        backdrop.fillRoundedRect(left, top, width, height, 8);
        backdrop.lineStyle(1, 0xF4F4F4, 0.18);
        backdrop.strokeRoundedRect(left + 1, top + 1, width - 2, height - 2, 7);
        backdrop.lineStyle(2, accent, 0.82);
        backdrop.beginPath();
        backdrop.moveTo(left + 12, top + 1);
        backdrop.lineTo(left + Math.min(88, width * 0.28), top + 1);
        backdrop.strokePath();
        backdrop.lineStyle(1, accent, 0.46);
        backdrop.beginPath();
        backdrop.moveTo(left + 12, top + height - 1);
        backdrop.lineTo(left + Math.min(52, width * 0.2), top + height - 1);
        backdrop.strokePath();
        backdrop.fillStyle(0xF4F4F4, 0.86);
        [0, 7, 14].forEach(offset => backdrop.fillCircle(left + 15 + offset, top + 10, 1.3));
        backdrop.fillStyle(0xE85D5D, 0.86);
        backdrop.fillTriangle(
            left + width - 20,
            top + 1,
            left + width - 10,
            top + 1,
            left + width - 10,
            top + 7
        );
        backdrop.fillStyle(accent, 0.72);
        backdrop.fillTriangle(-5, top + height, 5, top + height, 0, top + height + 7);
        backdrop.setData('villageResonanceBackdrop', true);
        backdrop.setData('resonanceKind', kind);
        return backdrop;
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
        this.clearVillageWorkerCheckIn(landmark);
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

        const copyWidth = compact ? 270 : 360;
        const copyHeight = compact ? 66 : 70;
        const copy = this.scene.add.container(
            landmark.zone.x + (compact ? 0 : 230),
            landmark.zone.y - (compact ? 280 : 245)
        ).setDepth(landmark.zone.y + 14).setAlpha(0);
        const backdrop = this.createVillageResonanceBackdrop({
            width: copyWidth,
            height: copyHeight,
            accent: 0x71E6B1,
            kind: 'community_moment'
        });
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
        copy.add([backdrop, names, title, value]);
        copy.setData('villageCommunityMoment', moment.id);
        copy.setData('participantNames', moment.participantNames);
        copy.setData('sharedValue', moment.sharedValue);
        copy.setData('resonanceStyle', 'current_ribbon');
        copy.setData('resonanceAnchor', 'quiet_space');
        copy.setData('resonanceBounds', { width: copyWidth, height: copyHeight });

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
        this.scene.setSanctuaryMomentFocus?.(true, {
            kind: 'community',
            plotId: null
        });
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

    playVillageHeartMemory(landmark, memory) {
        if (!landmark?.zone || !memory?.line) return false;
        this.clearVillageCommunityMoment(landmark);
        this.clearVillageDecisionMoment(landmark);
        this.clearVillageWorkerCheckIn(landmark);

        const compact = this.scene.scale.width <= 600;
        const color = memory.value === 'care' ? 0x71E6B1 : 0xF2C14E;
        const marker = landmark.heartMemoryElements?.find(element => (
            element?.getData?.('villageHeartMemory') === memory.decisionId
        ));
        const markerX = marker?.x ?? landmark.zone.x;
        const markerY = marker?.y ?? landmark.zone.y;
        const pulse = this.scene.add.graphics()
            .setPosition(markerX, markerY)
            .setDepth(landmark.zone.y + 10)
            .setAlpha(0);
        pulse.lineStyle(3, color, 0.9);
        pulse.strokeCircle(0, 0, compact ? 19 : 22);
        pulse.lineStyle(1, 0xF4F4F4, 0.72);
        pulse.strokeCircle(0, 0, compact ? 27 : 31);
        pulse.setBlendMode?.(Phaser.BlendModes.ADD);

        const copy = this.scene.add.container(
            landmark.zone.x,
            landmark.zone.y - (compact ? 375 : 345)
        ).setDepth(landmark.zone.y + 15).setAlpha(0);
        const copyWidth = compact ? 278 : 410;
        const copyHeight = compact ? 102 : 108;
        const backdrop = this.createVillageResonanceBackdrop({
            width: copyWidth,
            height: copyHeight,
            accent: color,
            kind: 'heart_memory'
        });
        const speaker = this.scene.add.text(
            0,
            -24,
            `${memory.speakerName.toUpperCase()} REMEMBERS`,
            {
                fontSize: compact ? '8px' : '9px',
                fontFamily: 'Arial, sans-serif',
                fontStyle: 'bold',
                color: memory.value === 'care' ? '#8FE3CF' : '#F2C14E',
                stroke: '#07100F',
                strokeThickness: 5
            }
        ).setOrigin(0.5);
        const line = this.scene.add.text(0, 0, `"${memory.line}"`, {
            fontSize: compact ? '10px' : '12px',
            fontFamily: 'Arial, sans-serif',
            color: '#F4F4F4',
            align: 'center',
            stroke: '#07100F',
            strokeThickness: 5,
            wordWrap: { width: compact ? 248 : 370 }
        }).setOrigin(0.5);
        const value = this.scene.add.text(0, compact ? 35 : 38, memory.optionLabel, {
            fontSize: compact ? '7px' : '8px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#F4F4F4',
            stroke: '#07100F',
            strokeThickness: 4
        }).setOrigin(0.5);
        copy.add([backdrop, speaker, line, value]);
        copy.setData('villageHeartFollowUp', memory.decisionId);
        copy.setData('speakerName', memory.speakerName);
        copy.setData('optionId', memory.optionId);
        copy.setData('resonanceStyle', 'current_ribbon');
        copy.setData('resonanceAnchor', 'village_heart');
        copy.setData('resonanceBounds', { width: copyWidth, height: copyHeight });
        copy.setData('resonanceVerticalOffset', compact ? 375 : 345);

        const revealTween = this.scene.tweens.add({
            targets: [pulse, copy],
            alpha: 1,
            duration: 360,
            ease: 'Sine.easeOut'
        });
        const pulseTween = this.scene.tweens.add({
            targets: pulse,
            scaleX: { from: 0.78, to: 1.15 },
            scaleY: { from: 0.78, to: 1.15 },
            alpha: { from: 0.48, to: 1 },
            duration: 1200,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.easeInOut'
        });
        landmark.communityMomentElements = [pulse, copy];
        landmark.communityMomentTweens = [revealTween, pulseTween];
        landmark.activeCommunityMoment = copy;
        this.scene.setSanctuaryMomentFocus?.(true, {
            kind: 'memory',
            plotId: null
        });
        landmark.communityMomentTimer = this.scene.time.delayedCall(5600, () => {
            if (landmark.activeCommunityMoment !== copy) return;
            const fadeTween = this.scene.tweens.add({
                targets: [pulse, copy],
                alpha: 0,
                duration: 420,
                onComplete: () => this.clearVillageCommunityMoment(landmark)
            });
            landmark.communityMomentTweens.push(fadeTween);
        });
        return true;
    }

    clearVillageCommunityMoment(landmark) {
        const wasActive = Boolean(landmark?.activeCommunityMoment);
        landmark?.communityMomentTimer?.remove?.();
        landmark?.communityMomentTweens?.forEach(tween => tween?.stop?.());
        landmark?.communityMomentElements?.forEach(element => element?.destroy?.(true));
        if (!landmark) return;
        landmark.communityMomentTimer = null;
        landmark.communityMomentTweens = [];
        landmark.communityMomentElements = [];
        landmark.activeCommunityMoment = null;
        if (wasActive) this.scene.setSanctuaryMomentFocus?.(false);
    }

    playVillageWorkerCheckIn(landmark, checkIn) {
        const position = landmark?.plotWorldPositions?.get(checkIn?.plotId);
        if (!position || !checkIn?.line) return false;
        this.clearVillageCommunityMoment(landmark);
        this.clearVillageDecisionMoment(landmark);
        this.clearVillageWorkerCheckIn(landmark);

        const compact = this.scene.scale.width <= 600;
        const worker = landmark.workerElements?.find(element => (
            element?.getData?.('creatureId') === checkIn.creatureId
        ));
        const workerX = position.x + (worker?.x || 0);
        const workerY = position.y + (worker?.y || 0);
        const copyWidth = compact ? 250 : 380;
        const ribbonWidth = copyWidth + (compact ? 16 : 22);
        const cameraView = this.scene.cameras?.main?.worldView;
        const viewportLeft = cameraView?.x || 0;
        const viewportRight = viewportLeft + (
            cameraView?.width || this.scene.scale.width
        );
        const copyX = Phaser.Math.Clamp(
            workerX,
            viewportLeft + ribbonWidth / 2 + 8,
            viewportRight - ribbonWidth / 2 - 8
        );
        const copyY = Math.max(
            compact ? 92 : 82,
            landmark.zone.y - (compact ? 255 : 225)
        );
        const path = this.scene.add.graphics()
            .setDepth(Math.min(workerY, copyY) - 1)
            .setAlpha(0);
        path.lineStyle(2, 0x71E6B1, 0.54);
        path.beginPath();
        path.moveTo(workerX, workerY - 8);
        path.lineTo(copyX, copyY + 48);
        path.strokePath();
        path.setBlendMode?.(Phaser.BlendModes.ADD);

        const pulse = this.scene.add.graphics()
            .setPosition(workerX, workerY)
            .setDepth(position.y + 10)
            .setAlpha(0);
        pulse.lineStyle(3, 0x71E6B1, 0.9);
        pulse.strokeCircle(0, 0, compact ? 25 : 30);
        pulse.lineStyle(1, 0xF4F4F4, 0.7);
        pulse.strokeCircle(0, 0, compact ? 34 : 40);
        pulse.setBlendMode?.(Phaser.BlendModes.ADD);

        const copy = this.scene.add.container(copyX, copyY)
            .setDepth(landmark.zone.y + 16)
            .setAlpha(0);
        const copyHeight = checkIn.memory ? (compact ? 136 : 140) : (compact ? 116 : 120);
        const backdrop = this.createVillageResonanceBackdrop({
            width: ribbonWidth,
            height: copyHeight,
            accent: 0x71E6B1,
            kind: 'worker_check_in',
            y: checkIn.memory ? 8 : 1
        });
        const identity = this.scene.add.text(
            0,
            -38,
            `${checkIn.name.toUpperCase()} // ${checkIn.roleLabel}`,
            {
                fontSize: compact ? '9px' : '10px',
                fontFamily: 'Arial, sans-serif',
                fontStyle: 'bold',
                color: '#F2C14E',
                stroke: '#07100F',
                strokeThickness: 5
            }
        ).setOrigin(0.5);
        const line = this.scene.add.text(0, -13, `"${checkIn.line}"`, {
            fontSize: compact ? '10px' : '12px',
            fontFamily: 'Arial, sans-serif',
            color: '#F4F4F4',
            align: 'center',
            stroke: '#07100F',
            strokeThickness: 5,
            wordWrap: { width: copyWidth }
        }).setOrigin(0.5);
        const routine = this.scene.add.text(
            0,
            20,
            `${checkIn.routineCue} · ${checkIn.purpose}`,
            {
                fontSize: compact ? '7px' : '8px',
                fontFamily: 'Arial, sans-serif',
                fontStyle: 'bold',
                color: '#8FE3CF',
                align: 'center',
                stroke: '#07100F',
                strokeThickness: 4,
                wordWrap: { width: copyWidth }
            }
        ).setOrigin(0.5);
        const impact = this.scene.add.text(0, 43, checkIn.impact, {
            fontSize: compact ? '8px' : '9px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#F4F4F4',
            stroke: '#07100F',
            strokeThickness: 4
        }).setOrigin(0.5);
        const memory = checkIn.memory
            ? this.scene.add.text(
                0,
                61,
                `HEART MEMORY · ${checkIn.memory.label}`,
                {
                    fontSize: compact ? '7px' : '8px',
                    fontFamily: 'Arial, sans-serif',
                    fontStyle: 'bold',
                    color: checkIn.memory.value === 'care' ? '#8FE3CF' : '#F2C14E',
                    stroke: '#07100F',
                    strokeThickness: 4
                }
            ).setOrigin(0.5)
            : null;
        copy.add([backdrop, identity, line, routine, impact, ...(memory ? [memory] : [])]);
        copy.setData('villageWorkerCheckIn', checkIn.creatureId);
        copy.setData('helperName', checkIn.name);
        copy.setData('buildingId', checkIn.definitionId);
        copy.setData('routineCue', checkIn.routineCue);
        copy.setData('impact', checkIn.impact);
        copy.setData('memoryDecisionId', checkIn.memory?.decisionId || null);
        copy.setData('resonanceStyle', 'current_ribbon');
        copy.setData('resonanceAnchor', 'resident_tether');
        copy.setData('resonanceBounds', {
            width: ribbonWidth,
            height: copyHeight
        });

        const revealTween = this.scene.tweens.add({
            targets: [path, pulse, copy],
            alpha: 1,
            duration: 340,
            ease: 'Sine.easeOut'
        });
        const pulseTween = this.scene.tweens.add({
            targets: pulse,
            scaleX: { from: 0.78, to: 1.12 },
            scaleY: { from: 0.78, to: 1.12 },
            alpha: { from: 0.5, to: 1 },
            duration: 1100,
            yoyo: true,
            repeat: 3,
            ease: 'Sine.easeInOut'
        });
        landmark.workerCheckInElements = [path, pulse, copy];
        landmark.workerCheckInTweens = [revealTween, pulseTween];
        landmark.activeWorkerCheckIn = copy;
        this.scene.setSanctuaryMomentFocus?.(true, {
            kind: 'resident',
            plotId: checkIn.plotId
        });
        landmark.workerCheckInTimer = this.scene.time.delayedCall(6500, () => {
            if (landmark.activeWorkerCheckIn !== copy) return;
            const fadeTween = this.scene.tweens.add({
                targets: [path, pulse, copy],
                alpha: 0,
                duration: 420,
                onComplete: () => this.clearVillageWorkerCheckIn(landmark)
            });
            landmark.workerCheckInTweens.push(fadeTween);
        });
        return true;
    }

    clearVillageWorkerCheckIn(landmark) {
        const wasActive = Boolean(landmark?.activeWorkerCheckIn);
        landmark?.workerCheckInTimer?.remove?.();
        landmark?.workerCheckInTweens?.forEach(tween => tween?.stop?.());
        landmark?.workerCheckInElements?.forEach(element => element?.destroy?.(true));
        if (!landmark) return;
        landmark.workerCheckInTimer = null;
        landmark.workerCheckInTweens = [];
        landmark.workerCheckInElements = [];
        landmark.activeWorkerCheckIn = null;
        if (wasActive) this.scene.setSanctuaryMomentFocus?.(false);
    }

    playVillageDecisionMoment(landmark, result) {
        if (!landmark?.zone || !result?.decision || !result?.option) return false;
        this.clearVillageCommunityMoment(landmark);
        this.clearVillageDecisionMoment(landmark);
        this.clearVillageWorkerCheckIn(landmark);
        landmark.activeBuildingMomentTween?.stop?.();
        landmark.activeBuildingMoment?.destroy?.(true);
        landmark.activeBuildingMomentTween = null;
        landmark.activeBuildingMoment = null;
        const compact = this.scene.scale.width <= 600;
        const color = result.option.value === 'care' ? 0x71E6B1 : 0xF2C14E;
        const heartX = landmark.zone.x;
        const heartY = landmark.zone.y - 12;
        const paths = this.scene.add.graphics()
            .setDepth(-15)
            .setAlpha(0)
            .setData('villageDecisionGroundResponse', true);
        paths.lineStyle(3, color, 0.58);
        result.decision.requiredBuildingIds.forEach(buildingId => {
            const building = result.snapshot?.buildings?.find(entry => (
                entry.definitionId === buildingId
            ));
            const position = landmark.plotWorldPositions?.get(building?.plotId);
            if (!position) return;
            paths.beginPath();
            paths.moveTo(position.x, position.y);
            paths.lineTo(heartX, heartY);
            paths.strokePath();
        });
        paths.setBlendMode?.(Phaser.BlendModes.ADD);

        const pulse = this.scene.add.graphics()
            .setPosition(heartX, heartY)
            .setDepth(landmark.zone.y + 12)
            .setAlpha(0);
        pulse.lineStyle(4, color, 0.92);
        pulse.strokeCircle(0, 0, compact ? 48 : 62);
        pulse.lineStyle(2, 0xF4F4F4, 0.72);
        pulse.strokeCircle(0, 0, compact ? 65 : 82);
        pulse.setBlendMode?.(Phaser.BlendModes.ADD);

        const copy = this.scene.add.container(
            heartX,
            heartY - (compact ? 360 : 330)
        ).setDepth(landmark.zone.y + 16).setAlpha(0);
        const copyWidth = compact ? 290 : 420;
        const copyHeight = compact ? 98 : 104;
        const backdrop = this.createVillageResonanceBackdrop({
            width: copyWidth,
            height: copyHeight,
            accent: color,
            kind: 'heart_decision'
        });
        const kicker = this.scene.add.text(0, -25, 'THE VILLAGE HEART REMEMBERS', {
            fontSize: compact ? '8px' : '9px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: result.option.value === 'care' ? '#8FE3CF' : '#F2C14E',
            stroke: '#07100F',
            strokeThickness: 5
        }).setOrigin(0.5);
        const title = this.scene.add.text(0, -6, result.option.label, {
            fontSize: compact ? '11px' : '14px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#F4F4F4',
            stroke: '#07100F',
            strokeThickness: 5
        }).setOrigin(0.5);
        const consequence = this.scene.add.text(0, 17, result.option.consequence, {
            fontSize: compact ? '8px' : '9px',
            fontFamily: 'Arial, sans-serif',
            color: '#F4F4F4',
            align: 'center',
            stroke: '#07100F',
            strokeThickness: 4,
            wordWrap: { width: compact ? 230 : 330 }
        }).setOrigin(0.5);
        copy.add([backdrop, kicker, title, consequence]);
        copy.setData('villageDecisionMoment', result.decision.id);
        copy.setData('optionId', result.option.id);
        copy.setData('value', result.option.value);
        copy.setData('resonanceStyle', 'current_ribbon');
        copy.setData('resonanceAnchor', 'village_heart');
        copy.setData('resonanceBounds', { width: copyWidth, height: copyHeight });
        copy.setData('resonanceVerticalOffset', compact ? 360 : 330);

        const revealTween = this.scene.tweens.add({
            targets: [paths, pulse, copy],
            alpha: 1,
            duration: 420,
            ease: 'Sine.easeOut'
        });
        const pulseTween = this.scene.tweens.add({
            targets: pulse,
            scaleX: { from: 0.82, to: 1.12 },
            scaleY: { from: 0.82, to: 1.12 },
            alpha: { from: 0.52, to: 1 },
            duration: 1100,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.easeInOut'
        });
        landmark.decisionMomentElements = [paths, pulse, copy];
        landmark.decisionMomentTweens = [revealTween, pulseTween];
        landmark.activeDecisionMoment = copy;
        this.scene.setSanctuaryMomentFocus?.(true, {
            kind: 'decision',
            plotId: null
        });
        landmark.decisionMomentTimer = this.scene.time.delayedCall(5200, () => {
            if (landmark.activeDecisionMoment !== copy) return;
            const fadeTween = this.scene.tweens.add({
                targets: [paths, pulse, copy],
                alpha: 0,
                duration: 420,
                onComplete: () => this.clearVillageDecisionMoment(landmark)
            });
            landmark.decisionMomentTweens.push(fadeTween);
        });
        return true;
    }

    clearVillageDecisionMoment(landmark) {
        const wasActive = Boolean(landmark?.activeDecisionMoment);
        landmark?.decisionMomentTimer?.remove?.();
        landmark?.decisionMomentTweens?.forEach(tween => tween?.stop?.());
        landmark?.decisionMomentElements?.forEach(element => element?.destroy?.(true));
        if (!landmark) return;
        landmark.decisionMomentTimer = null;
        landmark.decisionMomentTweens = [];
        landmark.decisionMomentElements = [];
        landmark.activeDecisionMoment = null;
        if (wasActive) this.scene.setSanctuaryMomentFocus?.(false);
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

    activateVillageWorker(landmark, building) {
        if (!landmark?.snapshot || !building?.creature?.id) return false;
        return this.scene.openVillageWorkerCheckIn?.({
            creatureId: building.creature.id,
            snapshot: landmark.snapshot
        }) === true;
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
        const isSanctuary = this.currentBiome === 'nebula';
        if (isSanctuary) {
            this.scene.cameras?.main?.setBackgroundColor?.('#102329');
        }
        this.backgroundImage
            .setData(
                'worldBackgroundProfile',
                isSanctuary ? 'living_current_ground_v3' : 'cosmic_biome_v1'
            )
            .setData('worldBackgroundCloudRadiusMax', isSanctuary ? 0 : 200)
            .setData('worldBackgroundFloatingPlatformCount', isSanctuary ? 0 : 40)
            .setData('worldBackgroundCurrentThreadCount', isSanctuary ? 18 : 0)
            .setData('worldBackgroundEdgeColor', isSanctuary ? 0x102329 : null);
        return this.backgroundImage;
    }

    generateBackgroundTexture() {
        const biomeId = this.currentBiome;
        const isSanctuary = biomeId === 'nebula';
        const profileSuffix = isSanctuary ? '_living_v3' : '';
        const textureKey = `worldBackground_${biomeId}_${this.worldWidth}x${this.worldHeight}${profileSuffix}`;

        if (this.scene.textures.exists(textureKey)) {
            return textureKey;
        }

        const graphics = this.scene.make.graphics({ add: false });
        const palette = this.biomeConfig.palette || {};

        // Get biome-specific colors
        const skyTop = isSanctuary
            ? 0x071017
            : this.hexToInt(palette.skyTop) || 0x0a0a2e;
        const skyBottom = isSanctuary
            ? 0x102329
            : this.hexToInt(palette.skyBottom) || 0x1a1a4e;
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

        if (biomeId === 'nebula') {
            this.addSanctuaryGroundTexture(graphics, {
                nebulaColor,
                accentColor,
                floraColor,
                rockColor
            });
        } else {
            // Expedition biomes retain their more dramatic cloud silhouettes.
            const nebulaColors = this.getNebulaColors();
            for (let i = 0; i < 30; i++) {
                const nebula = Phaser.Math.RND.pick(nebulaColors);
                const x = Phaser.Math.Between(0, this.worldWidth);
                const y = Phaser.Math.Between(0, this.worldHeight);
                const size = Phaser.Math.Between(80, 200);
                graphics.fillStyle(nebula.color, nebula.alpha);
                graphics.fillCircle(x, y, size);
            }

            this.addBiomeFeatures(graphics, palette);

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
        }

        graphics.generateTexture(textureKey, this.worldWidth, this.worldHeight);
        graphics.destroy();
        return textureKey;
    }

    addSanctuaryGroundTexture(graphics, {
        nebulaColor,
        accentColor,
        floraColor,
        rockColor
    }) {
        const threadColors = [
            floraColor,
            0x8FE3CF,
            0x71E6B1,
            accentColor,
            rockColor
        ];
        for (let threadIndex = 0; threadIndex < 18; threadIndex++) {
            const startX = Phaser.Math.Between(-40, this.worldWidth - 80);
            const startY = Phaser.Math.Between(40, this.worldHeight - 40);
            const length = Phaser.Math.Between(110, 260);
            const bend = Phaser.Math.Between(-44, 44);
            const color = threadColors[threadIndex % threadColors.length];
            graphics.lineStyle(
                threadIndex % 3 === 0 ? 2 : 1,
                color,
                threadIndex % 4 === 0 ? 0.12 : 0.08
            );
            graphics.beginPath();
            graphics.moveTo(startX, startY);
            for (let pointIndex = 1; pointIndex <= 6; pointIndex++) {
                const progress = pointIndex / 6;
                graphics.lineTo(
                    startX + (length * progress),
                    startY + (bend * Math.sin(progress * Math.PI))
                );
            }
            graphics.strokePath();
        }

        for (let patchIndex = 0; patchIndex < 30; patchIndex++) {
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(0, this.worldHeight);
            const width = Phaser.Math.Between(8, 34);
            const color = patchIndex % 3 === 0 ? nebulaColor : rockColor;
            graphics.fillStyle(color, patchIndex % 3 === 0 ? 0.05 : 0.07);
            graphics.fillEllipse(x, y, width, Phaser.Math.Between(3, 10));
        }
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
                const position = this.findEnvironmentPosition(80, 36);
                if (!position) continue;
                const { x, y } = position;
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
            // The Sanctuary's landmarks and routes carry the visual hierarchy.
            // Atmospheric particles keep it alive without turning scenery into
            // dozens of competing collision silhouettes.
            nebula: { trees: 0, rocks: 0, flowers: 8 },
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
        this.sanctuaryDistricts?.flora?.forEach(entry => {
            entry.tween?.stop?.();
            entry.image?.destroy?.();
        });
        this.sanctuaryDistricts?.markers?.forEach(marker => {
            marker.focusTween?.stop?.();
            marker.labelTween?.stop?.();
            marker.container?.destroy?.(true);
        });
        this.sanctuaryDistricts?.routes?.destroy?.();
        this.sanctuaryDistricts?.terrain?.destroy?.();
        this.sanctuaryDistricts = null;
        this.sanctuaryCommons?.signalTweens?.forEach(tween => tween?.stop?.());
        this.sanctuaryCommons?.signals?.forEach(signal => signal?.destroy?.());
        this.sanctuaryCommons?.nodes?.forEach(node => node?.destroy?.());
        this.sanctuaryCommons?.path?.destroy?.();
        this.sanctuaryCommons?.terrain?.destroy?.();
        this.sanctuaryCommons = null;
        this.villageHeart?.pulseTween?.stop?.();
        this.villageHeart?.ecologyTween?.stop?.();
        this.villageHeart?.heartArtworkTween?.stop?.();
        this.villageHeart?.heartLifeTweens?.forEach(tween => tween?.stop?.());
        this.villageHeart?.heartDeliveryTween?.stop?.();
        this.villageHeart?.buildingTweens?.forEach(tween => tween?.stop?.());
        this.villageHeart?.focusTweens?.forEach(tween => tween?.stop?.());
        this.clearVillageCommunityMoment(this.villageHeart);
        this.clearVillageDecisionMoment(this.villageHeart);
        this.clearVillageWorkerCheckIn(this.villageHeart);
        this.clearVillageArrivalReveal(this.villageHeart);
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
        this.villageHeart?.districtEcology?.destroy?.();
        this.villageHeart?.districtPulse?.destroy?.();
            this.villageHeart?.districtThresholds?.destroy?.();
            this.villageHeart?.heart?.destroy?.();
            this.villageHeart?.heartCaption?.destroy?.();
            this.villageHeart?.heartArtwork?.destroy?.();
        this.villageHeart?.glow?.destroy?.();
        this.villageHeart?.restorationRoots?.destroy?.();
        Object.values(this.villageHeart?.heartLife || {}).forEach(
            element => element?.destroy?.()
        );
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
