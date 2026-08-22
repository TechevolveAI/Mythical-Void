const fs = require('fs');
const path = require('path');

const read = relativePath => fs.readFileSync(
    path.join(__dirname, '..', relativePath),
    'utf8'
);

describe('Village settlement gameplay contract', () => {
    test('the Living Current vertical-slice world assets ship with the game', () => {
        const publicRoot = path.join(__dirname, '..', '..', 'public');

        expect(fs.existsSync(path.join(
            publicRoot,
            'game/village/world/village-heart.webp'
        ))).toBe(true);
        expect(fs.existsSync(path.join(
            publicRoot,
            'game/village/world/forager-hut.webp'
        ))).toBe(true);
        [
            'living-sawmill.webp',
            'current-masonry.webp',
            'shared-habitat.webp',
            'discovery-workshop.webp'
        ].forEach(asset => {
            expect(fs.existsSync(path.join(
                publicRoot,
                'game/village/world',
                asset
            ))).toBe(true);
        });
    });

    test('the additive save tree persists versioned village resources and structures', () => {
        const source = read('systems/GameState.js');

        expect(source).toContain('village: {');
        expect(source).toContain('starterSuppliesClaimed: false');
        expect(source).toContain('lifetimeProduced: {');
        expect(source).toContain('heartDecisions: []');
        expect(source).toContain('buildings: []');
        expect(source).toContain('schemaVersion: 3');
    });

    test('the Village Heart is a real Sanctuary landmark with a mobile interaction fallback', () => {
        const zoneSource = read('systems/world/SanctuaryZones.js');
        const worldSource = read('systems/world/WorldBuilder.js');
        const sceneSource = read('scenes/GameScene.js');
        const hudSource = read('scenes/controllers/GameSceneHudController.js');
        const kidModeSource = read('systems/KidMode.js');

        expect(zoneSource).toContain("villageHeart: {");
        expect(zoneSource).toContain("onInteract: 'openVillageCommand'");
        expect(worldSource).toContain('createVillageHeart(');
        expect(worldSource).toContain('createSanctuaryCommons({');
        expect(worldSource).toContain("id: 'garden_to_heart'");
        expect(worldSource).toContain("id: 'heart_to_portal'");
        expect(worldSource).toContain(".setData('sanctuaryCommons', true)");
        expect(worldSource).toContain(".setData('sanctuaryCurrentSignal', route.id)");
        expect(worldSource).toContain('refreshVillageSettlement(');
        expect(worldSource).toContain("zone.on('pointerdown', () => this.activateVillageHeart(landmark))");
        expect(worldSource).toContain("plotHitZone.on('pointerdown', pointer => {");
        expect(worldSource).toContain('this.activateVillageWorker(landmark, building)');
        expect(worldSource).toContain('this.activateVillageHeart(landmark, plot.id);');
        expect(sceneSource).toContain('VILLAGE_HEART_INTERACT_DISTANCE');
        expect(sceneSource).toContain('this.openVillageCommand();');
        expect(sceneSource).toContain("decision: this.mobileControls");
        expect(sceneSource).toContain("'Tap the Village Heart · Decide together'");
        expect(sceneSource).toContain("nextAction?.type === 'decision' ? '?' : '🏗'");
        expect(sceneSource).toContain('{ persistent: true }');
        expect(sceneSource).toContain('showInteractionHint(message, { persistent = false } = {})');
        expect(sceneSource).toContain('this.updateSanctuaryFocusMode(true)');
        expect(sceneSource).toContain('this.updateSanctuaryFocusMode(false)');
        expect(sceneSource).toContain('firstContactActive || this.sanctuaryFocusModeActive');
        expect(sceneSource).toContain('this.kidModeHelpContainer?.destroy?.(true)');
        expect(sceneSource).not.toContain('createKidModeStatusBar(this, needsData)');
        expect(hudSource).toContain(".get('debugHud') === '1'");
        expect(hudSource).toContain('GIFT READY · STREAK ${bonus.streak}');
        expect(kidModeSource).toContain('if (scene?.sanctuaryFocusModeActive) return null');
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
        expect(source).toContain("root.classList.add('accepts-input')");
        expect(source).toContain('this.inputActivationTimer');
        expect(source).toContain('this.scene.physics?.world');
        expect(source).toContain('this.scene.physics.resume()');
        expect(source).toContain('BUILD NEXT');
        expect(source).toContain('village-next-step');
        expect(source).toContain('BUILD ${selectedDefinition.shortLabel} HERE');
        expect(source).toContain('this.selectedPlotId');
        expect(source).toContain("createElement('span', 'village-resource-icon')");
        expect(source).toContain('village-assignment-routine');
        expect(source).toContain('workerRoutine.emotionalPurpose');
        expect(source).toContain('createCommunityPulse(snapshot)');
        expect(source).toContain('village-community-pulse');
        expect(source).toContain('moment.sharedValue');
        expect(source).toContain('createHeartDecision(snapshot');
        expect(source).toContain('village-heart-decision');
        expect(source).toContain('this.onDecision?.(request)');
        expect(source).toContain('village-decision-resident-line');
        expect(source).toContain('THIS MEMORY REMAINS IN THE SANCTUARY');
        expect(source).toContain("root.classList.add('is-contextual')");
        expect(source).toContain('requestedPlot?.building?.definitionId');
        expect(source).toContain('const contextualBuilding = selectedPlot?.building');
        expect(source).toContain('ACTIVE · ${contextualBuilding.definition.worldEffectLabel}');
    });

    test('the responsive layout moves to a single scroll surface on mobile', () => {
        const css = read('styles/main.css');
        const theme = read('systems/UITheme.js');

        expect(css).toContain('@media (max-width: 680px)');
        expect(css).toContain('.village-command-modal.accepts-input');
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
        expect(village).toContain("url: '/game/village/world/village-heart.webp'");
        expect(village).toContain("url: '/game/village/world/forager-hut.webp'");
        expect(village).toContain("url: '/game/village/world/living-sawmill.webp'");
        expect(village).toContain("url: '/game/village/world/current-masonry.webp'");
        expect(village).toContain("url: '/game/village/world/shared-habitat.webp'");
        expect(village).toContain("url: '/game/village/world/discovery-workshop.webp'");
        expect(village).toContain("worldEffectLabel: 'FEEDING · +5 HAPPINESS'");
        expect(village).toContain('completionCopy:');
        expect(panel).toContain('`HELPS NOW · ${definition.immediateImpact}`');
        expect(panel).toContain('`UNLOCKS · ${definition.extensionImpact}`');
        expect(panel).toContain('SETTLEMENT GOAL');
        expect(panel).toContain('snapshot.productionRates');
        expect(css).toContain('@keyframes village-building-breathe');
        expect(css).toContain('@keyframes village-card-current');
        expect(css).toContain('.village-command-modal.is-contextual');
        expect(css).toContain('.village-community-pulse');
        expect(css).toContain('.village-community-home');
        expect(css).toContain('.village-heart-decision');
        expect(css).toContain('.village-decision-options');
        expect(css).toMatch(/\.village-decision-option\s*\{[^}]*min-height: 64px;/s);
        expect(css).toContain('scroll-snap-type: x mandatory;');
        expect(css).toContain('font-size: 11px;');
    });

    test('building promises are connected to care, expeditions, and collection capacity', () => {
        const village = read('systems/VillageSettlement.js');
        const care = read('systems/CareSystem.js');
        const carePanel = read('systems/ui/CarePanelManager.js');
        const platformer = read('scenes/PlatformerLevelScene.js');

        expect(village).toContain('feedHappinessBonus');
        expect(village).toContain('victoryCoinBonus');
        expect(village).toContain('creatureCapacityBonus');
        expect(village).toContain('VILLAGE_HEART_DECISION_DEFINITIONS');
        expect(village).toContain('resolveVillageHeartDecision');
        expect(village).toContain('heartCareBonus');
        expect(village).toContain('heartReadinessEnergyBonus');
        expect(village).toContain("gameState.set('maxCreatures', target)");
        expect(care).toContain('.feedHappinessBonus');
        expect(carePanel).toContain('FORAGER HUT SUPPORT');
        expect(carePanel).toContain('VILLAGE HEART CARE');
        expect(platformer).toContain('this.villageSupport.maxEnergyBonus');
        expect(platformer).toContain('this.villageSupport.guardCharges');
        expect(platformer).toContain('this.villageSupport?.victoryCoinBonus');
        expect(platformer).toContain('showVillageSupportBriefing()');
        expect(platformer).toContain('VILLAGE HEART READY');
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

    test('completed buildings appear as connected world structures in the Sanctuary', () => {
        const world = read('systems/world/WorldBuilder.js');
        const scene = read('scenes/GameScene.js');
        const village = read('systems/VillageSettlement.js');

        expect(scene).toContain('Object.values(VILLAGE_BUILDING_ARTWORK)');
        expect(scene).toContain('notifyVillageProgress(previous, next)');
        expect(scene).toContain('showVillageCompletionMoment(completed)');
        expect(scene).toContain('markVillageGuidanceSeen(window.GameState)');
        expect(world).toContain('const compactSettlement = this.scene.scale.width <= 600;');
        expect(world).toContain('districtTerrain.fillEllipse(');
        expect(world).toContain('const pathPoints = Array.from({ length: 17 }');
        expect(world).toContain('currentPaths.lineTo(point.x, point.y)');
        expect(world).toContain('this.drawVillageBuilding(');
        expect(world).toContain('VILLAGE_WORLD_ARTWORK.heart.key');
        expect(world).toContain("VILLAGE_WORLD_ARTWORK[building.definitionId]");
        expect(world).toContain('this.createVillageBuildingActivity(building)');
        expect(world).toContain('playVillageBuildingMoment(');
        expect(world).toContain('createVillageWorker(');
        expect(world).toContain('createVillageWorkerCargo(');
        expect(world).toContain('createVillageHabitatLife(');
        expect(world).toContain('playVillageProductionMoment(');
        expect(world).toContain('playVillageCommunityMoment(');
        expect(world).toContain('playVillageDecisionMoment(');
        expect(world).toContain('playVillageWorkerCheckIn(');
        expect(world).toContain('clearVillageWorkerCheckIn(');
        expect(world).toContain('activateVillageWorker(');
        expect(world).toContain('createVillageHeartMemories(');
        expect(world).toContain("setData('villageHeartMemory'");
        expect(world).toContain('createVillageValueGrowth(');
        expect(world).toContain("setData('villageValueGrowth'");
        expect(world).toContain('createVillageNextActionBeacon(');
        expect(world).toContain("setData('villageNextAction'");
        expect(world).toContain('playVillageHeartMemory(');
        expect(world).toContain("setData('villageHeartFollowUp'");
        expect(world).toContain("copy.setData('villageDecisionMoment', result.decision.id)");
        expect(world).toContain("container.setData('villageHabitatLife', true)");
        expect(world).toContain("worker.setData('villageWorker', true)");
        expect(world).toContain("worker.setData('checkInCue', true)");
        expect(world).toContain("copy.setData('villageWorkerCheckIn'");
        expect(scene).toContain('maybePlayVillageCommunityMoment(snapshot');
        expect(scene).toContain('getVillageCommunityMoment(snapshot');
        expect(scene).toContain('resolveVillageHeartDecision(');
        expect(scene).toContain('this.villageDecisionMomentPending = result');
        expect(scene).toContain('maybePlayVillageHeartMemory(snapshot)');
        expect(scene).toContain('openVillageWorkerCheckIn(');
        expect(scene).toContain('getVillageWorkerCheckIn(');
        expect(village).toContain('participantCreatureIds: active.participants.map(');
        expect(village).toContain('getVillageHeartMemory(snapshot');
        expect(village).toContain('getVillageWorldState(snapshot)');
        expect(village).toContain("type: 'supplies'");
        expect(village).toContain("type: 'assign'");
        expect(village).toContain('residentLine:');
        expect(village).toContain('checkInLine:');
        expect(village).toContain('getVillageWorkerCheckIn(snapshot');
        expect(world).toContain('landmark.plotPresentations = []');
        expect(world).toContain(".setData('interactionLabel', interactionLabel)");
        expect(world).toContain('focusRing.setAlpha(1)');
        expect(world).toContain('plotLabel.setAlpha(plotLabelRestAlpha)');
        expect(world).toContain('.setAlpha(stateLabelRestAlpha);');
        expect(world).toContain(".setText('')");
        expect(world).toContain('.disableInteractive();');
        expect(world).toContain('definition.worldEffectLabel');
        expect(world).toContain("'BUILD HERE'");
        expect(world).toContain('Phaser.BlendModes.ADD');
    });

    test('the local completion preview renders the entire connected settlement', () => {
        const game = read('game.js');
        const scene = read('scenes/GameScene.js');

        expect(game).toContain("['empty', 'building', 'active', 'complete']");
        expect(scene).toContain("this.villageCommandPreview === 'complete'");
        expect(scene).toContain("['workshop', 'root_05', null]");
    });
});
