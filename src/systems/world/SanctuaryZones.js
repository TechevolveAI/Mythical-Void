/**
 * SanctuaryZones - Defines zones and landmarks within the Sanctuary (main world)
 * The Sanctuary is your home base with distinct areas:
 * - Crash Site: Your wrecked ship, narrative anchor
 * - Shop Area: The Cosmic Boutique
 * - Hub Gate: Portal to other worlds
 * - Living Area: Where creatures roam
 * - Buildable Plots: Future expansion areas
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
                name: 'Garden Plot',
                description: 'A place to grow things. (Coming Soon)',
                bounds: { x: padding, y: h - 400, width: 300, height: 300 },
                center: { x: 200, y: h - 250 },
                icon: '🌱',
                color: 0x4CAF50,
                locked: true
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
}

export default SanctuaryZones;
