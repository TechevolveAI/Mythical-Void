/**
 * SanctuaryZones - Defines zones and landmarks within the Sanctuary (main world)
 * The Sanctuary is your home base with distinct areas:
 * - Crash Site: Your wrecked ship, narrative anchor
 * - Shop Area: The Cosmic Boutique
 * - Hub Gate: Portal to other worlds
 * - Living Area: Where creatures roam
 * - Signal Garden: A shared living-signal sanctuary
 */

class SanctuaryZones {
    constructor(worldWidth, worldHeight) {
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;

        // Define zone boundaries and centers
        this.zones = this.defineZones();
        this.landmarks = this.defineLandmarks();
    }

    /**
     * Define the major zones of the Sanctuary
     */
    defineZones() {
        const w = this.worldWidth;
        const h = this.worldHeight;
        const padding = 100;

        return {
            crashSite: {
                name: 'Crash Site',
                description: 'The wreckage of your ship. Home.',
                bounds: { x: padding, y: padding, width: 400, height: 350 },
                center: { x: 250, y: 250 },
                icon: '🚀',
                color: 0x4A90A4
            },
            livingArea: {
                name: 'Living Area',
                description: 'Where your creatures roam freely.',
                bounds: { x: w / 2 - 300, y: h / 2 - 200, width: 600, height: 400 },
                center: { x: w / 2, y: h / 2 },
                icon: '🐾',
                color: 0x7B68EE
            },
            shopArea: {
                name: 'Cosmic Boutique',
                description: 'Trade cosmic coins for eggs and items.',
                bounds: { x: w - 400, y: h / 2 - 175, width: 350, height: 350 },
                center: { x: w - 220, y: h / 2 },
                icon: '🏪',
                color: 0xFFD700
            },
            hubGate: {
                name: 'Hub Gate',
                description: 'Portal to other worlds.',
                bounds: { x: w / 2 - 150, y: h - 350, width: 300, height: 250 },
                center: { x: w / 2, y: h - 200 },
                icon: '⭐',
                color: 0x9370DB
            },
            gardenPlot: {
                name: 'Signal Garden',
                description: 'Nurture a living signal with your companion.',
                bounds: { x: padding, y: h - 400, width: 300, height: 300 },
                center: { x: 200, y: h - 250 },
                icon: '🌱',
                color: 0x4CAF50,
                locked: false
            },
            settlementDistrict: {
                name: 'Fend Settlement',
                description: 'A shared district shaped by the creatures who live here.',
                bounds: { x: 340, y: h - 520, width: 760, height: 440 },
                center: { x: 690, y: h - 280 },
                icon: 'V',
                color: 0x71E6B1,
                locked: false
            },
            trainingGrounds: {
                name: 'Target Range',
                description: 'Practice shooting at targets. Test your weapons!',
                bounds: { x: w - 450, y: padding, width: 400, height: 350 },
                center: { x: w - 250, y: 220 },
                icon: '🎯',
                color: 0xFF6B6B,
                locked: false  // Now available!
            }
        };
    }

    /**
     * Define landmarks (interactive objects within zones)
     */
    defineLandmarks() {
        const zones = this.zones;

        return {
            crashedShip: {
                zone: 'crashSite',
                position: { x: zones.crashSite.center.x, y: zones.crashSite.center.y },
                size: { width: 200, height: 150 },
                interactable: true,
                interactRadius: 120,
                name: 'Crashed Ship',
                description: 'Your ship. The journey that brought you here.',
                onInteract: 'showShipMemories'
            },
            cosmicShop: {
                zone: 'shopArea',
                position: { x: zones.shopArea.center.x, y: zones.shopArea.center.y },
                size: { width: 180, height: 200 },
                interactable: true,
                interactRadius: 150,
                name: 'Cosmic Boutique',
                description: 'Buy eggs, items, and treats.',
                onInteract: 'enterShop'
            },
            hubPortal: {
                zone: 'hubGate',
                position: { x: zones.hubGate.center.x, y: zones.hubGate.center.y },
                size: { width: 150, height: 150 },
                interactable: true,
                interactRadius: 100,
                name: 'Hub Gate',
                description: 'Travel to other worlds.',
                onInteract: 'enterHubWorld'
            },
            campfire: {
                zone: 'livingArea',
                position: { x: this.worldWidth / 2 - 100, y: this.worldHeight / 2 + 50 },
                size: { width: 60, height: 60 },
                interactable: false,
                name: 'Campfire',
                description: 'A warm gathering spot.'
            },
            signalGarden: {
                zone: 'gardenPlot',
                position: { x: zones.gardenPlot.center.x, y: zones.gardenPlot.center.y },
                size: { width: 180, height: 140 },
                interactable: true,
                interactRadius: 115,
                name: 'Signal Garden',
                description: 'Nurture a living signal with your companion.',
                onInteract: 'tendSignalGarden'
            },
            villageHeart: {
                zone: 'settlementDistrict',
                position: {
                    x: zones.settlementDistrict.bounds.x + 120,
                    y: zones.settlementDistrict.center.y
                },
                size: { width: 150, height: 130 },
                interactable: true,
                interactRadius: 118,
                name: 'Village Heart',
                description: 'Plan shared structures and invite creature contributions.',
                onInteract: 'openVillageCommand'
            },
            fusionPod: {
                zone: 'livingArea',
                position: {
                    x: this.worldWidth / 2 + 270,
                    y: this.worldHeight / 2 + 90
                },
                size: { width: 150, height: 150 },
                interactable: true,
                interactRadius: 118,
                name: 'Fusion Pod',
                description:
                    'A dormant Fend interface that answers stable living signatures.',
                onInteract: 'openFusionPod'
            },
            voidPortal: {
                zone: 'crashSite',
                // Position directly under the ship where the impact crater/shadow is
                position: { x: zones.crashSite.center.x, y: zones.crashSite.center.y + 65 },
                size: { width: 100, height: 100 },
                interactable: true,
                interactRadius: 70,
                name: 'Void Rift',
                description: '⚠️ DANGER! A mysterious tear in spacetime. Enter at your own risk!',
                onInteract: 'enterVoidMiniGame'
            },
            targetRange: {
                zone: 'trainingGrounds',
                position: { x: zones.trainingGrounds.center.x, y: zones.trainingGrounds.center.y },
                size: { width: 350, height: 300 },
                interactable: true,
                interactRadius: 200,
                name: 'Target Range',
                description: '🎯 Practice your aim! Test weapons and abilities on targets.',
                onInteract: 'enterTargetRange'
            }
        };
    }

    /**
     * Get zone at a specific position
     */
    getZoneAt(x, y) {
        for (const [zoneId, zone] of Object.entries(this.zones)) {
            const b = zone.bounds;
            if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
                return { id: zoneId, ...zone };
            }
        }
        return null;
    }

    /**
     * Get nearest landmark to a position
     */
    getNearestLandmark(x, y, maxDistance = 200) {
        let nearest = null;
        let nearestDistance = maxDistance;

        for (const [landmarkId, landmark] of Object.entries(this.landmarks)) {
            const distance = Math.sqrt(
                Math.pow(x - landmark.position.x, 2) +
                Math.pow(y - landmark.position.y, 2)
            );

            if (distance < nearestDistance) {
                nearest = { id: landmarkId, distance, ...landmark };
                nearestDistance = distance;
            }
        }

        return nearest;
    }

    /**
     * Check if position is near an interactable landmark
     */
    getInteractableLandmark(x, y) {
        for (const [landmarkId, landmark] of Object.entries(this.landmarks)) {
            if (!landmark.interactable) continue;

            const distance = Math.sqrt(
                Math.pow(x - landmark.position.x, 2) +
                Math.pow(y - landmark.position.y, 2)
            );

            if (distance <= landmark.interactRadius) {
                return { id: landmarkId, distance, ...landmark };
            }
        }

        return null;
    }

    /**
     * Get all zone centers for mini-map display
     */
    getZoneCenters() {
        return Object.entries(this.zones).map(([id, zone]) => ({
            id,
            name: zone.name,
            icon: zone.icon,
            x: zone.center.x,
            y: zone.center.y,
            color: zone.color,
            locked: zone.locked || false
        }));
    }

    /**
     * Get spawn position (near crash site but in living area)
     */
    getSpawnPosition() {
        // Spawn in the living area, slightly toward the crash site
        return {
            x: this.worldWidth / 2 - 100,
            y: this.worldHeight / 2
        };
    }

    getVoidExitPosition(distance = 180) {
        const portal = this.landmarks.voidPortal.position;
        const livingArea = this.zones.livingArea.center;
        const dx = livingArea.x - portal.x;
        const dy = livingArea.y - portal.y;
        const magnitude = Math.max(1, Math.hypot(dx, dy));

        return this.getSafeSpawnPosition({
            x: portal.x + (dx / magnitude) * distance,
            y: portal.y + (dy / magnitude) * distance
        });
    }

    /**
     * Keep restored players away from narrow world-edge pockets. Older builds
     * could save a position between the Target Range and the outer bounds.
     */
    getSafeSpawnPosition(position, inset = 90) {
        const x = Number(position?.x);
        const y = Number(position?.y);
        const valid = Number.isFinite(x) && Number.isFinite(y);
        const insideSafeWorld = valid &&
            x >= inset &&
            x <= this.worldWidth - inset &&
            y >= inset &&
            y <= this.worldHeight - inset;

        if (insideSafeWorld) {
            return { x, y };
        }

        const range = this.zones.trainingGrounds;
        const nearRange = valid &&
            x >= range.bounds.x - 180 &&
            y <= range.bounds.y + range.bounds.height + 160;
        if (nearRange) {
            return {
                x: range.center.x,
                y: Math.min(
                    range.bounds.y + range.bounds.height - 55,
                    range.center.y + 130
                )
            };
        }

        return this.getSpawnPosition();
    }
}

export default SanctuaryZones;
