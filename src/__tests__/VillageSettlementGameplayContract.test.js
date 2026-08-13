const fs = require('fs');
const path = require('path');

const read = relativePath => fs.readFileSync(
    path.join(__dirname, '..', relativePath),
    'utf8'
);

describe('Village settlement gameplay contract', () => {
    test('the additive save tree persists versioned village resources and structures', () => {
        const source = read('systems/GameState.js');

        expect(source).toContain('village: {');
        expect(source).toContain('starterSuppliesClaimed: false');
        expect(source).toContain('lifetimeProduced: {');
        expect(source).toContain('buildings: []');
    });

    test('the Village Heart is a real Sanctuary landmark with a mobile interaction fallback', () => {
        const zoneSource = read('systems/world/SanctuaryZones.js');
        const worldSource = read('systems/world/WorldBuilder.js');
        const sceneSource = read('scenes/GameScene.js');

        expect(zoneSource).toContain("villageHeart: {");
        expect(zoneSource).toContain("onInteract: 'openVillageCommand'");
        expect(worldSource).toContain('createVillageHeart(');
        expect(worldSource).toContain('refreshVillageSettlement(');
        expect(sceneSource).toContain('VILLAGE_HEART_INTERACT_DISTANCE');
        expect(sceneSource).toContain('this.openVillageCommand();');
    });

    test('the Shop makes the Base Builder the direct, clear construction route', () => {
        const shop = read('scenes/ShopScene.js');
        const menu = read('ui/HamburgerMenu.js');

        expect(shop).toContain("{ id: 'base', label: 'Build', icon: '🏡' }");
        expect(shop).toContain("id: 'village_heart'");
        expect(shop).toContain(
            'Shop > Build > Base Builder > Choose a structure > Construct'
        );
        expect(shop).toContain('openVillageHeart()');
        expect(shop).toContain('openVillageBuilder()');
        expect(shop).toContain('new VillageCommandPanel(this)');
        expect(shop).toContain("item.type === 'village'");
        expect(menu).not.toContain("key: 'village', label: 'Village Heart'");
        expect(menu).toContain('this.scene.openShop();');
    });

    test('the command interface suspends controls and restores them on close', () => {
        const source = read('ui/VillageCommandPanel.js');

        expect(source).toContain("role', 'dialog'");
        expect(source).toContain("aria-modal', 'true'");
        expect(source).toContain("close.classList.add('compact-icon-button')");
        expect(source).toContain('this.physicsSuspended = Boolean(physicsWorld');
        expect(source).toContain('this.scene.physics.pause()');
        expect(source).toContain('this.scene.mobileControls?.suspend?.()');
        expect(source).toContain('this.scene.mobileControls?.resume?.()');
        expect(source).toContain('this.scene.physics?.world');
        expect(source).toContain('this.scene.physics.resume()');
        expect(source).toContain('BUILD NEXT');
        expect(source).toContain('village-next-step');
        expect(source).toContain('CONSTRUCT ${selectedDefinition.shortLabel} AT ${firstOpenPlot.label}');
    });

    test('the responsive layout moves to a single scroll surface on mobile', () => {
        const css = read('styles/main.css');
        const theme = read('systems/UITheme.js');

        expect(css).toContain('@media (max-width: 680px)');
        expect(css).toContain('.village-command-body');
        expect(css).toContain('overflow-y: auto;');
        expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
        expect(css).toMatch(/\.village-command-close\s*\{[^}]*min-width: 44px;/s);
        expect(theme).toContain('button:not(.compact-icon-button)');
    });

    test('the command interface communicates the settlement through visual landmarks', () => {
        const panel = read('ui/VillageCommandPanel.js');
        const village = read('systems/VillageSettlement.js');
        const css = read('styles/main.css');

        expect(panel).toContain('createBuildingArtwork');
        expect(panel).toContain('createCreatureAvatar');
        expect(panel).toContain('village-foundation-visual');
        expect(village).toContain("url: '/game/village/forager-hut.webp'");
        expect(village).toContain("url: '/game/village/living-sawmill.webp'");
        expect(village).toContain("url: '/game/village/current-masonry.webp'");
        expect(village).toContain("url: '/game/village/shared-habitat.webp'");
        expect(village).toContain("url: '/game/village/discovery-workshop.webp'");
        expect(panel).toContain('`NOW // ${definition.immediateImpact}`');
        expect(panel).toContain('`NEXT // ${definition.extensionImpact}`');
        expect(panel).toContain('PHASE ONE OBJECTIVE');
        expect(panel).toContain('snapshot.productionRates');
        expect(css).toContain('@keyframes village-building-breathe');
        expect(css).toContain('@keyframes village-card-current');
    });

    test('building promises are connected to care, expeditions, and collection capacity', () => {
        const village = read('systems/VillageSettlement.js');
        const care = read('systems/CareSystem.js');
        const carePanel = read('systems/ui/CarePanelManager.js');
        const platformer = read('scenes/PlatformerLevelScene.js');

        expect(village).toContain('feedHappinessBonus');
        expect(village).toContain('victoryCoinBonus');
        expect(village).toContain('creatureCapacityBonus');
        expect(village).toContain("gameState.set('maxCreatures', target)");
        expect(care).toContain('.feedHappinessBonus');
        expect(carePanel).toContain('FORAGER HUT SUPPORT');
        expect(platformer).toContain('this.villageSupport.maxEnergyBonus');
        expect(platformer).toContain('this.villageSupport.guardCharges');
        expect(platformer).toContain('this.villageSupport?.victoryCoinBonus');
        expect(platformer).toContain('showVillageSupportBriefing()');
        expect(platformer).toContain('VILLAGE SUPPORT ONLINE');
        expect(platformer).toContain('getVillageCompletionCopy({ compact = false } = {})');
    });

    test('every expedition result credits any active Village support', () => {
        const levelSources = [
            'scenes/levels/MythicalForestLevel.js',
            'scenes/levels/CrystalCavesLevel.js',
            'scenes/levels/ReefLevel.js',
            'scenes/levels/VoidPeaksLevel.js',
            'scenes/levels/AuroraDepthsLevel.js',
            'scenes/levels/FinalVoidLevel.js'
        ];

        levelSources.forEach(levelPath => {
            expect(read(levelPath)).toContain('getVillageCompletionCopy({ compact: true })');
        });
    });

    test('completed buildings appear as animated artwork in the Sanctuary', () => {
        const world = read('systems/world/WorldBuilder.js');
        const scene = read('scenes/GameScene.js');

        expect(scene).toContain('Object.values(VILLAGE_BUILDING_ARTWORK)');
        expect(scene).toContain('notifyVillageProgress(previous, next)');
        expect(scene).toContain('showVillageCompletionMoment(completed)');
        expect(scene).toContain('markVillageGuidanceSeen(window.GameState)');
        expect(world).toContain('VILLAGE_BUILDING_ARTWORK[building.definitionId]');
        expect(world).toContain('const compactSettlement = this.scene.scale.width <= 600;');
        expect(world).toContain('.setDisplaySize(118, 66)');
        expect(world).toContain('Phaser.BlendModes.ADD');
    });
});
