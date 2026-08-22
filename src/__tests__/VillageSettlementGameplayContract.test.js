const fs = require('fs');
const path = require('path');

const read = relativePath => fs.readFileSync(
    path.join(__dirname, '..', relativePath),
    'utf8'
);

describe('Village settlement gameplay contract', () => {
    test('achievement modals remain true screen-space UI during Sanctuary focus zoom', () => {
        const source = read('ui/AchievementNotification.js');
        const sceneSource = read('scenes/GameScene.js');

        expect(source).toContain('getScreenSpaceTransform()');
        expect(source).toContain('x: width / (2 * cameraZoom)');
        expect(source).toContain('y: height / (2 * cameraZoom)');
        expect(source).toContain('scale: 1 / cameraZoom');
        expect(source).toContain('drawScreenSpaceRect(graphics, color, alpha)');
        expect(source).toContain(".setData('screenSpaceCoverage', 'viewport')");
        expect(source).toContain('screenSpace.width / screenSpace.cameraZoom');
        expect(source).toContain('screenSpace.height / screenSpace.cameraZoom');
        expect(source).toContain('const uiScale = screenSpace.scale;');
        expect(source).toContain('this.container.setScrollFactor(0);');
        expect(source).toContain('.setPosition(screenSpace.x, screenSpace.y)');
        expect(source).toContain('.setScale(uiScale)');
        expect(source).toContain('.setScrollFactor(0)');
        expect(source).toContain('this.contentContainer.setScale(0.8);');
        expect(source).toContain('targets: this.contentContainer');
        expect(source).toContain("this.scene.events.on('update', this.syncCameraZoom, this);");
        expect(source).toContain("this.scene?.events?.off?.('update', this.syncCameraZoom, this);");
        expect(source).toContain('.setScale(1)');
        expect(source).toContain('syncCameraZoom()');
        expect(sceneSource.match(/this\.achievementNotification\?\.syncCameraZoom\?\.\(\);/g)).toHaveLength(6);
        expect(sceneSource).toContain('this.sanctuaryCameraFocusPreviousZoom = zoom;');
        expect(sceneSource).toContain('this.sanctuaryCameraFocusZoom = zoom;');
        expect(sceneSource).toContain('camera.setZoom(restoreZoom);');
    });

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
            'village-heart.png',
            'forager-hut.png',
            'living-sawmill.png',
            'current-masonry.png',
            'shared-habitat.png',
            'discovery-workshop.png'
        ].forEach(asset => {
            expect(fs.existsSync(path.join(
                publicRoot,
                'game/village/world/compact',
                asset
            ))).toBe(true);
        });
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
        const parallaxSource = read('systems/ParallaxBiome.js');
        const biomes = JSON.parse(read('config/biomes.json'));
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
        expect(worldSource).toContain(".setData('rootBudCount', VILLAGE_PLOTS.length)");
        expect(worldSource).toContain(".setData('litRootCount', restoredCount)");
        expect(worldSource).toContain('this.findEnvironmentPosition(80, 36)');
        expect(worldSource).toContain('createVillagePlotStateMarker({');
        expect(worldSource).toContain(".setData('villagePlotState', state)");
        expect(worldSource).toContain(".setData('progressNodes', activeNodes)");
        expect(worldSource).toContain(".setData('plotState', plotState)");
        expect(worldSource).not.toContain(
            'strokeRoundedRect(-70, -76, 140, 124, 8)'
        );
        expect(worldSource).toContain('worldArtwork.setAlpha(0.66).setTint(0xA7BDAF)');
        expect(worldSource).toContain('createVillageArtworkGrounding({');
        expect(worldSource).toContain("? 'compact_silhouette'");
        expect(worldSource).toContain(".setData('villageGroundingMaterial', 'woven_root_foreground_v1')");
        expect(worldSource).toContain(".setData('villageArtworkTreatment', 'living_current_material_v1')");
        expect(worldSource).toContain("? 'full_color'");
        expect(worldSource).toContain("? 'story_supporting'");
        expect(worldSource).toContain('this.applyVillageArtworkTreatment(presentation.worldArtwork');
        expect(worldSource).toContain('refreshVillageSettlement(');
        expect(worldSource).toContain("zone.on('pointerdown', () => this.activateVillageHeart(landmark))");
        expect(worldSource).toContain("plotHitZone.on('pointerdown', pointer => {");
        expect(worldSource).toContain('this.activateVillageWorker(landmark, building)');
        expect(worldSource).toContain('this.activateVillageHeart(landmark, plot.id);');
        expect(sceneSource).toContain('VILLAGE_HEART_INTERACT_DISTANCE');
        expect(sceneSource).toContain('this.openVillageCommand();');
        expect(sceneSource).toContain('const touchControlsVisible = this.hasVisibleTouchControls()');
        expect(sceneSource).toContain('decision: touchControlsVisible');
        expect(sceneSource).toContain("'Tap the Village Heart · Decide together'");
        expect(sceneSource).toContain('getVillageHeartInteractionPresentation(snapshot)');
        expect(sceneSource).toContain('offerVillageHeartInteraction(snapshot');
        expect(sceneSource).toContain("ownerLabel: 'VILLAGE HEART'");
        expect(sceneSource).toContain('this.setupVillageHeartCollision();');
        expect(sceneSource).toContain('if (window.MobileControls && this.forceMobileControls)');
        expect(sceneSource).toContain('this.mobileControls.show(true);');
        expect(sceneSource).toContain('updateSanctuaryActorDepths()');
        expect(sceneSource).toContain(".setData?.('sanctuaryDepthSorted', true)");
        expect(sceneSource).toContain('setSanctuaryPeripheralWayfindingVisible(visible = true)');
        expect(sceneSource).toContain(".setData('peripheralWayfindingSuppressed', !visible)");
        expect(sceneSource).toContain('this.setSanctuaryPeripheralWayfindingVisible(!nextActive);');
        expect(sceneSource).toContain('this.offerVillageHeartInteraction(closeSnapshot)');
        expect(sceneSource).toContain(
            "!this.sanctuaryInteractionDirector?.candidates?.has('villageHeart')"
        );
        expect(sceneSource).toContain(
            'this.sanctuaryInteractionDirector = new SanctuaryInteractionDirector(this)'
        );
        expect(sceneSource).toContain("verb: 'DECIDE'");
        expect(sceneSource).toContain("label: 'TOGETHER'");
        expect(sceneSource).toContain('worldPrompt: true');
        expect(sceneSource).toContain('suppressWorldBeacon: directPlotAction');
        expect(sceneSource).toContain('(this.sanctuaryFocusModeActive || this.nearVillageHeart) &&');
        expect(sceneSource).toContain("['build', 'assign'].includes(liveNextAction?.type)");
        expect(sceneSource).toContain("nextAction?.type === 'decision' ? '?' : '🏗'");
        expect(sceneSource).toContain('{ persistent: true }');
        expect(sceneSource).toContain('{ persistent = false, ownerId = null, force = false } = {}');
        expect(sceneSource).toContain('this.sanctuaryInteractionDirector?.activate()');
        expect(sceneSource).toContain("this.withdrawSanctuaryInteraction('villageHeart')");
        expect(sceneSource).toContain('this.updateSanctuaryFocusMode(true)');
        expect(sceneSource).toContain('this.updateSanctuaryFocusMode(false)');
        expect(sceneSource).toContain('this.applySanctuaryCameraFocus();');
        expect(sceneSource).toContain('this.restorePlayerCameraFollow();');
        expect(sceneSource).toContain('scheduleVillageArrivalReveal({');
        expect(sceneSource).toContain('shouldPlayVillageArrivalReveal()');
        expect(sceneSource).toContain('isVillageArrivalRevealBlocked()');
        expect(sceneSource).toContain('this.achievementNotification?.isVisible ||');
        expect(sceneSource).toContain('playVillageArrivalReveal({ force = false');
        expect(sceneSource).toContain("this.setSanctuaryMomentFocus(true, { kind: 'arrival' });");
        expect(sceneSource).toContain("window.AudioManager?.playSound?.('current_harmony', 0.9);");
        expect(sceneSource).toContain("window.GameState?.set('tutorial.villageHeartArrivalSeen', true)");
        expect(sceneSource).toContain("?.once?.('pointerdown', this.skipVillageArrivalReveal, this)");
        expect(sceneSource).toContain("this.input?.keyboard?.once?.('keydown', this.skipVillageArrivalReveal, this)");
        expect(sceneSource).toContain('this.villageArrivalRevealHandoffTimer = window.setTimeout');
        expect(sceneSource).toContain('window.clearTimeout(this.villageArrivalRevealHandoffTimer)');
        expect(sceneSource).toContain(".setData('villageArrivalRevealInputShield', true)");
        expect(sceneSource).toContain(".setData('visiblePanel', false)");
        expect(sceneSource).toContain('villageArrivalRevealInputCooldownUntil');
        expect(sceneSource).toContain('setVillageArrivalChromeHidden(hidden)');
        expect(sceneSource).toContain('...(this.navigationMarkers || [])');
        expect(sceneSource).toContain('menuButton?.zone');
        expect(sceneSource).toContain('finishVillageArrivalReveal({ skipped = false } = {})');
        expect(sceneSource).toContain('this.cancelVillageArrivalReveal();');
        expect(sceneSource).toContain('this.villageArrivalRevealActive ||');
        expect(sceneSource).toContain('const shortViewport = this.scale.height <= 520;');
        expect(sceneSource).toContain('zoom = Math.min(zoom, compact ? 0.62 : 0.68);');
        expect(sceneSource).toContain('this.sanctuaryCameraFocusPreviousZoom = zoom;');
        expect(sceneSource).toContain('this.sanctuaryCameraFocusZoom = zoom;');
        expect(sceneSource).toContain('const restoreZoom = this.sanctuaryCameraFocusPreviousZoom;');
        expect(sceneSource).toContain('this.worldBuilder?.setVillageFocusMode?.(');
        expect(sceneSource).toContain("this.currentBiome === 'nebula' ? '#102329' : '#050214'");
        expect(sceneSource).toContain('firstContactActive || this.sanctuaryFocusModeActive');
        expect(sceneSource).toContain('this.dismissCosmicAffinityNotice();');
        expect(sceneSource).toContain(".setData('sanctuaryNotice', true)");
        expect(sceneSource).toContain('Exploration discoveries earn bonus XP');
        expect(sceneSource).not.toContain('${info.emoji} ${element.toUpperCase()} AFFINITY');
        expect(worldSource).toContain('nebula: { trees: 0, rocks: 0, flowers: 8 }');
        expect(worldSource).toContain('createSanctuaryDistrictEnvironment()');
        expect(worldSource).toContain(".setData('sanctuaryPhysicalRoutes', true)");
        expect(worldSource).toContain(".setData('sanctuaryRouteProfile', 'living_current_filaments_v3')");
        expect(worldSource).toContain(".setData('sanctuaryRouteMaxWidth', 28)");
        expect(worldSource).toContain(".setData('sanctuaryDistrictVisualProfile', 'woven_edge_contours_v4')");
        expect(worldSource).toContain(".setData('sanctuaryDistrictFullZoneFill', false)");
        expect(worldSource).toContain(".setData('sanctuaryDistrictMaxFillAlpha', 0.08)");
        expect(worldSource).toContain(".setData('sanctuaryDistrictContourCount', contourSegmentCount)");
        expect(worldSource).toContain(".setData('sanctuaryDistrictAnchorPatchCount', anchorPatchCount)");
        expect(worldSource).not.toContain('drawOrganicPad');
        expect(worldSource).toContain("isSanctuary ? 'living_current_ground_v3' : 'cosmic_biome_v1'");
        expect(worldSource).toContain("this.scene.cameras?.main?.setBackgroundColor?.('#102329')");
        expect(worldSource).toContain(".setData('worldBackgroundEdgeColor', isSanctuary ? 0x102329 : null)");
        expect(worldSource).toContain("const profileSuffix = isSanctuary ? '_living_v3' : '';");
        expect(worldSource).toContain('? 0x071017');
        expect(worldSource).toContain('? 0x102329');
        expect(worldSource).toContain(".setData('worldBackgroundCloudRadiusMax', isSanctuary ? 0 : 200)");
        expect(worldSource).toContain(".setData('worldBackgroundFloatingPlatformCount', isSanctuary ? 0 : 40)");
        expect(worldSource).toContain(".setData('worldBackgroundCurrentThreadCount', isSanctuary ? 18 : 0)");
        expect(worldSource).toContain('addSanctuaryGroundTexture(graphics');
        expect(worldSource).toContain(".setData('sanctuaryCommonsPathProfile', 'living_current_filaments_v3')");
        expect(worldSource).toContain(".setData('sanctuaryCommonsMaxWidth', 32)");
        expect(worldSource).toContain('setSanctuaryDistrictFocus(');
        expect(worldSource).toContain(".setData('sanctuaryDistrictMarker', definition.zoneId)");
        expect(worldSource).toContain('marker.label.setAlpha(active ? 1 : 0)');
        expect(sceneSource).toContain('this.worldBuilder?.setSanctuaryDistrictFocus?.(');
        expect(biomes.nebula.layers.floatingRocks.enabled).toBe(false);
        expect(biomes.nebula.layers.crystalFlora.enabled).toBe(false);
        expect(parallaxSource).toContain(
            'if (this.config.layers.floatingRocks.enabled)'
        );
        expect(parallaxSource).toContain(
            'if (this.config.layers.crystalFlora.enabled)'
        );
        expect(parallaxSource).toContain("'quiet_current_threads_v2'");
        expect(parallaxSource).toContain(".setData('sanctuaryParallaxFilledWisps', false)");
        expect(parallaxSource).toContain(".setData('sanctuaryParallaxThreadCount', 3)");
        expect(parallaxSource).toContain(".setData('sanctuaryParallaxShaderEnabled', false)");
        expect(parallaxSource).toContain(".setData('sanctuaryParallaxBackdropFixed', sanctuaryBackdrop)");
        expect(parallaxSource).toContain("sanctuaryBackdrop ? 'world_background_owned_v3' : 'biome_parallax_gradient_v1'");
        expect(parallaxSource).toContain('nebulaBg.setAlpha(sanctuaryBackdrop ? 0 : layer.alpha);');
        expect(parallaxSource).toContain("type: 'sanctuaryCurrentField'");
        expect(parallaxSource).toContain("console.log('biome:info [ParallaxBiome] Sanctuary skips expedition post shader')");
        expect(parallaxSource).toContain("this.scene?.cameras?.main?.removePostPipeline?.('NebulaShader')");
        expect(parallaxSource).toContain("if (this.currentBiomeId === 'nebula') return;");
        expect(sceneSource).toContain('this.kidModeHelpContainer?.destroy?.(true)');
        expect(sceneSource).not.toContain('createKidModeStatusBar(this, needsData)');
        expect(hudSource).toContain(".get('debugHud') === '1'");
        expect(hudSource).toContain('GIFT READY · STREAK ${bonus.streak}');
        expect(kidModeSource).toContain('if (scene?.sanctuaryFocusModeActive) return null');
    });

    test('a single proximity director owns competing Sanctuary actions', () => {
        const sceneSource = read('scenes/GameScene.js');
        const directorSource = read('systems/world/SanctuaryInteractionDirector.js');

        [
            "id: 'villageHeart'",
            "id: 'crashedShip'",
            "id: 'signalGarden'",
            "id: 'fusionPod'",
            "id: 'hubPortal'",
            "id: 'campfire'",
            "id: 'shop'",
            "id: 'flower'"
        ].forEach(candidate => expect(sceneSource).toContain(candidate));
        expect(sceneSource).toContain('`fendResident:${residentId}`');
        expect(sceneSource).toContain('`guardianResident:${guardianId}`');
        expect(sceneSource).toContain('`rescuedResident:${residentId}`');
        expect(sceneSource).toContain('`currentVeilAnchor:${anchorId}`');
        expect(directorSource).toContain('distanceDelta');
        expect(directorSource).toContain('return right.priority - left.priority');
        expect(directorSource).toContain("updateInteractIcon(next.icon)");
        expect(directorSource).toContain("next.hintMode === 'world'");
        expect(directorSource).toContain('resolved.worldPrompt === true');
        expect(directorSource).toContain('this.scene?.hasVisibleTouchControls?.()');
        expect(directorSource).toContain(".setData('sanctuaryInteractionBeacon', true)");
        expect(directorSource).toContain(".setData('touchTargetWidth', 164)");
        expect(directorSource).toContain(".setData('touchTargetHeight', 52)");
        [
            "verb: 'SHOP'",
            "label: 'SUPPLIES & BUILDING'",
            "verb: 'EXPLORE'",
            "label: 'CHOOSE A WORLD'",
            "verb: 'REST'",
            "label: 'TOGETHER'",
            "label: 'FUSION POD'",
            "label: 'SIGNAL GARDEN'",
            "verb: 'CHECK SUPPLIES'",
            "verb: 'STABILIZE'"
        ].forEach(copy => expect(sceneSource).toContain(copy));
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
        expect(source).toContain("'.village-guided-stage'");
        expect(source).toContain('element.scrollTop = top');
        expect(source).toContain('restoreScrollState()');
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
        expect(source).toContain('createVillageSupportImpactSummary(snapshot)');
        expect(source).toContain('createResidentProposal(snapshot, visualDefinition)');
        expect(source).toContain('village-resident-proposal');
        expect(source).toContain('IN YOUR GAME · ${proposal.immediateImpact}');
        const scene = read('scenes/GameScene.js');
        const worldBuilder = read('systems/world/WorldBuilder.js');
        expect(scene).toContain('maybePlayVillageReturnRitual(snapshot)');
        expect(scene).toContain('villageReturnRitualsSeen');
        expect(worldBuilder).toContain('playVillageReturnRitual(landmark, ritual)');
        expect(worldBuilder).toContain("'WELCOME HOME'");
        expect(worldBuilder).toContain("kind: 'expedition_return'");
        expect(source).toContain('getVillageSupportSummary(snapshot?.effects || {})');
        expect(source).toContain('WHAT YOUR SANCTUARY CHANGES');
        expect(source).toContain('village-support-impact-row');
        expect(source).toContain('moment.sharedValue');
        expect(source).toContain('createHeartDecision(snapshot');
        expect(source).toContain('village-heart-decision');
        expect(source).toContain('this.onDecision?.(request)');
        expect(source).toContain('village-decision-resident-line');
        expect(source).toContain('THIS MEMORY REMAINS IN THE SANCTUARY');
        expect(source).toContain("root.classList.add('is-contextual')");
        expect(source).toContain("root.classList.add('is-guided')");
        expect(source).toContain('renderGuided(snapshot, definitionById)');
        expect(source).toContain("'village-heart-sheet'");
        expect(source).toContain("'THE NEXT USEFUL CHANGE'");
        expect(source).toContain("'CONTINUE WITH THE SANCTUARY'");
        expect(source).toContain('OPEN FULL PLAN');
        expect(source).toContain('this.guidedActionKey !== guidedActionKey');
        expect(source).toContain('nextAction.definitionId ||');
        expect(source).toContain('requestedPlot?.building?.definitionId');
        expect(source).toContain('const contextualBuilding = selectedPlot?.building');
        expect(source).toContain('ACTIVE · ${contextualBuilding.definition.worldEffectLabel}');
        const styles = read('styles/main.css');
        expect(styles).toContain('.village-command-modal.is-contextual .village-resource-ledger');
        expect(styles).toContain('grid-template-columns: repeat(4, minmax(0, 1fr));');
        expect(styles).toContain('.village-command-modal.is-contextual .village-command-body {');
        expect(styles).toContain('flex-direction: column;');
        expect(styles).toContain('.village-command-modal.is-contextual .village-building-catalog {');
        expect(styles).toContain('flex: 0 0 auto;');
        expect(styles).toContain('order: 2;');
        expect(styles).toContain('.village-command-modal.is-contextual .village-site-plan {');
        expect(styles).toContain('order: 1;');
        expect(styles).toContain('.village-command-modal.is-contextual .village-assignment-controls {');
        expect(styles).toContain('grid-template-columns: minmax(0, 1fr) minmax(88px, auto);');
        expect(styles).toContain('.village-support-impact-summary {');
        expect(styles).toContain('.village-support-impact-list {');
        expect(styles).toContain('.village-resident-proposal {');
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
        expect(village).toContain("compactUrl: '/game/village/world/compact/forager-hut.png'");
        expect(village).toContain("compactUrl: '/game/village/world/compact/living-sawmill.png'");
        expect(village).toContain("compactUrl: '/game/village/world/compact/current-masonry.png'");
        expect(village).toContain("compactUrl: '/game/village/world/compact/shared-habitat.png'");
        expect(village).toContain("compactUrl: '/game/village/world/compact/discovery-workshop.png'");
        expect(village).toContain("compactUrl: '/game/village/world/compact/village-heart.png'");
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
        expect(css).toContain('.village-command-modal.is-guided');
        expect(css).toContain('.village-heart-sheet');
        expect(css).toContain('.village-guided-stage');
        expect(css).toContain(".village-guided-stage[data-intent='decision']");
        expect(css).toContain('.village-guided-primary');
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
        expect(platformer).toContain('getVillageSupportSummary(this.villageSupport || {})');
        expect(platformer).toContain(".filter(effect => effect.context === 'expedition')");
        expect(village).toContain('export function getVillageSupportSummary(effects = {})');
        expect(village).toContain('INCOMING ${guardCharges === 1 ? \'HIT IS\' : \'HITS ARE\'} BLOCKED');
        expect(village).toContain('ROOM FOR ${creatureCapacityBonus} MORE');
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
        expect(scene).toContain('reconcileVillageSettlementNow({ notify = true } = {})');
        expect(scene).toContain('this.reconcileVillageSettlementNow();');
        expect(scene).toContain('showVillageCompletionMoment(completed)');
        expect(scene).toContain('markVillageGuidanceSeen(window.GameState)');
        expect(world).toContain('const compactSettlement = this.scene.scale.width <= 600;');
        expect(world).toContain('drawVillageDistrictGround({');
        expect(world).toContain("setData('villageTerrainMaterial', 'living_current_districts_v3')");
        expect(world).toContain("setData('uniformOverlay', false)");
        expect(world).toContain("setData('districtIdentityCount', districtProfiles.length)");
        expect(world).toContain("setData('districtIdentityIds', districtProfiles.map(profile => profile.id))");
        expect(world).toContain("setData('villageDistrictEcology', true)");
        expect(world).toContain("setData('villageThresholdCount'");
        expect(world).toContain("setData('villagePathMaterial', 'grounded_current_paths_v3')");
        expect(world).toContain("setData('routeFoundationWidth', compactSettlement ? 22 : 28)");
        expect(world).toContain("setData('routeHighlightWidth', 3)");
        expect(world).toContain("setData('villageEcologyPulse', true)");
        expect(world).toContain("setData('growthLabel', snapshot?.worldState?.growthLabel");
        expect(world).toContain("setData('villageGrowthLabel'");
        expect(world).toContain('drawVillageHeartLife(landmark, {');
        expect(world).toContain("'AWAKENED ROOT'");
        expect(world).toContain("'SHARED SANCTUARY'");
        expect(world).toContain("setData('villageHeartLife', true)");
        expect(world).toContain("setData('villageHeartGrowthTier', tier)");
        expect(world).toContain("setData('villageHeartGrowthStage', stageLabel)");
        expect(world).toContain("setData('villageHeartOrbitNodeCount', orbitNodeCount)");
        expect(world).toContain("setData('villageHeartMemoryLightCount'");
        expect(world).toContain("setData('villageHeartMotionProfile', 'living_current_breath_v1')");
        expect(world).toContain('setVillageHeartDeliveryState(');
        expect(world).toContain("setData('villageHeartDeliveryResponse', true)");
        expect(world).toContain("setData('villageHeartLastDelivery', effectLabel)");
        expect(world).toContain("landmark.presentationMode === 'story' ? 0.18 : 0.96");
        expect(world).toContain('playVillageArrivalReveal(landmark');
        expect(world).toContain("'THE HEART ANSWERS'");
        expect(world).toContain("'A HOME WE BUILD TOGETHER'");
        expect(world).toContain("setData('villageArrivalRevealWorldLed', true)");
        expect(world).toContain("setData('villageArrivalRevealBlockingPanel', false)");
        expect(world).toContain("setData('villageArrivalRevealSkippable', true)");
        expect(world).toContain('clearVillageArrivalReveal(landmark)');
        expect(world).toContain('const rootTargets = compactSettlement');
        expect(world).toContain('const pathPoints = Array.from({ length: 17 }');
        expect(world).toContain('currentPaths.lineTo(point.x, point.y)');
        expect(world).toContain('this.drawVillageBuilding(');
        expect(world).toContain('VILLAGE_WORLD_ARTWORK.heart.key');
        expect(world).toContain("VILLAGE_WORLD_ARTWORK[building.definitionId]");
        expect(world).toContain('this.createVillageBuildingActivity(building)');
        expect(world).toContain('playVillageBuildingMoment(');
        expect(world).toContain('createVillageWorker(');
        expect(world).toContain('createVillageWorkerCargo(');
        expect(world).toContain('createVillageResonanceBackdrop(');
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
        expect(world).toContain('createVillageArrivalGuide(landmark, snapshot');
        expect(world).toContain("setData('villageArrivalGuide', true)");
        expect(world).toContain("setData('villageArrivalMessage', 'BUILD A HOME TOGETHER')");
        expect(world).toContain("setData('villageArrivalSteps', ['BUILD', 'INVITE', 'GROW'])");
        expect(world).toContain("'BUILD  ·  INVITE  ·  GROW'");
        expect(world).toContain('drawVillageFoundationCradle(');
        expect(world).toContain('createVillageDistrictAnchor({');
        expect(world).toContain("setData('villageDistrictAnchor', true)");
        expect(world).toContain("setData('villageDistrictAnchorMaterial', 'root_threshold_v1')");
        expect(world).toContain("setData('villageFoundationCradle', true)");
        expect(world).toContain("setData('villageFoundationMaterial', 'living_root_cradle_v2')");
        expect(world).toContain("'inhabited_root_basin_v1' : 'living_root_cradle_v2'");
        expect(world).toContain('createVillageGuidanceRoute({');
        expect(world).toContain("setData('villageGuidanceRoute', true)");
        expect(world).toContain("setData('villageRouteMaterial', 'current_stepping_lights_v1')");
        expect(world).toContain("setData('guidanceNodeCount', guidanceNodes.length)");
        expect(world).toContain("setData('villageNextActionHitZone', true)");
        expect(world).toContain("setData('touchTargetHeight', 52)");
        expect(world).toContain('landmark.nextActionTween?.pause?.();');
        expect(world).toContain('landmark.nextActionTween?.resume?.();');
        expect(world).toContain('landmark.nextActionPlacard?.setAlpha(storyMode ? 0 : 1);');
        expect(world).toContain('landmark.nextActionRing?.setAlpha(storyMode ? 0 : 1);');
        expect(world).toContain("setData('villageDecisionGroundResponse', true)");
        expect(world).toContain("copy.setData('resonanceVerticalOffset', compact ? 360 : 330)");
        expect(world).toContain("copy.setData('resonanceVerticalOffset', compact ? 375 : 345)");
        expect(world).toContain("setData('villageNextAction'");
        expect(world).toContain("setData('routeDirection', 'to_heart')");
        expect(world).toContain("setData('villageDeliveryPulse', true)");
        expect(world).toContain("setData('villageWorkerRouteStatus', true)");
        expect(world).toContain("worker.setData('cargoVisible', carrying)");
        expect(world).toContain("worker.setData('deliveryFeedback', delivering)");
        expect(world).toContain("? 'returning'");
        expect(world).toContain('playVillageHeartMemory(');
        expect(world).toContain("setData('villageHeartFollowUp'");
        expect(world).toContain("copy.setData('villageDecisionMoment', result.decision.id)");
        expect(world).toContain("container.setData('villageHabitatLife', true)");
        expect(world).toContain(".setData('residentStatus', resident?.atWork ? 'helping' : resident ? 'home' : 'open')");
        expect(world).toContain("tether.setData('villageHomeTether', true)");
        expect(world).toContain("figure.setData('villageResidentFigure', true)");
        expect(world).toContain("container.setData('homeTetherCount', home?.helpingCount || 0)");
        expect(world).toContain("container.setData('residentFigureCount', home?.presentCount || 0)");
        expect(world).toContain("worker.setData('villageWorker', true)");
        expect(world).toContain("worker.setData('checkInCue', true)");
        expect(world).toContain("worker.setData('checkInCueStyle', 'current_resonance')");
        expect(world).toContain("worker.setData('routeType', 'building_to_heart')");
        expect(world).toContain("'carriedResource',");
        expect(world).toContain("worker.setData('routeProgress'");
        expect(world).toContain("worker.setData('routePhase'");
        expect(world).toContain("worker.setData('worldEffectLabel', building.definition.worldEffectLabel)");
        expect(world).toContain('worker.setInteractive({ useHandCursor: true })');
        expect(world).toContain('heartPosition: {');
        expect(world).toContain('plotPosition: { x: plotX, y: plotY }');
        expect(world).toContain(".setData('villageBuildingImpact', building.definition.worldEffectLabel)");
        expect(world).toContain("setData('villageResonanceCue', true)");
        expect(world).toContain("setData('villageResonanceBackdrop', true)");
        expect(world).toContain("setData('resonanceStyle', 'current_ribbon')");
        expect(world).toContain("copy.setData('villageWorkerCheckIn'");
        expect(scene).toContain('maybePlayVillageCommunityMoment(snapshot');
        expect(scene).toContain('getVillageCommunityMoment(snapshot');
        expect(scene).toContain('resolveVillageHeartDecision(');
        expect(scene).toContain('this.villageDecisionMomentPending = result');
        expect(scene).toContain('maybePlayVillageHeartMemory(snapshot)');
        expect(scene).toContain('openVillageWorkerCheckIn(');
        expect(scene).toContain('getVillageWorkerCheckIn(');
        expect(village).toContain('participantCreatureIds: active.participants.map(');
        expect(village).toContain('participantNames: active.participants.map(');
        expect(village).toContain('choice.participantNames');
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
        expect(world).toContain("presentationMode === 'story'");
        expect(world).toContain('focusPriority === \'primary\' ? 1 : plotLabelRestAlpha');
        expect(world).toContain('focusPriority === \'primary\' ? 1 : stateLabelRestAlpha');
        expect(world).toContain(".setText('')");
        expect(world).toContain('.disableInteractive();');
        expect(world).toContain('definition.worldEffectLabel');
        expect(world).toContain("'BUILD HERE'");
        expect(world).toContain('Phaser.BlendModes.ADD');
        expect(world).toContain('createVillageFlowSignal({');
        expect(world).toContain(".setData('direction', isDelivery ? 'to_heart' : 'to_plot')");
        expect(world).toContain(".setData('resource', resource)");
        expect(world).toContain(".setData('worldEffectLabel', definition?.worldEffectLabel || null)");
        expect(world).toContain("const flowVisible = isConstruction || isGuidance;");
        expect(world).toContain("'worker_represents_delivery'");
        expect(world).toContain("'guided_foundation'");
        expect(world).toContain("'quiet_background'");
        expect(world).toContain(".setData('villageFlowVisible', flowVisible)");
        expect(world).toContain(".setData('villageAmbientRole', ambientRole)");
        expect(world).toContain('.setVisible(flowVisible)');
        expect(world).toContain('paused: !flowVisible');
        expect(world).toContain('setVillageFocusMode(');
        expect(world).toContain(".setData('villageFocusPriority', priority)");
        expect(world).toContain(".setData('villageFocusPrimary', primary)");
        expect(world).toContain("presentationMode = active ? 'action' : 'ambient'");
        expect(world).toContain("presentationMode === 'story'");
        expect(world).toContain("presentation.plotState === 'constructing'");
        expect(world).toContain('setVillagePlayerProximity(landmark, plotId = null)');
        expect(world).toContain(".setData('villagePlayerNearby', playerNearby)");
        expect(world).toContain("? 'nearby'");
        expect(world).toContain('compactPresentation ? 0.58 : 0.72');
        expect(world).toContain('compactPresentation ? 0.16 : 0.2');
        expect(world).toContain('compactPresentation ? 0.2 : 0.28');
        expect(world).toContain('compactPresentation ? 0.25 : 0.34');
        expect(scene).toContain('updateVillagePlotProximity()');
        expect(scene).toContain('this.worldBuilder.setVillagePlayerProximity(landmark, activePlotId)');
        expect(scene).toContain('syncVillagePlotInteraction(landmark, plotId = null)');
        expect(scene).toContain("const nextInteractionId = plotId ? `villagePlot:${plotId}` : null;");
        expect(scene).toContain("available: { verb: 'BUILD HERE', icon: '+' }");
        expect(scene).toContain("staffed: { verb: 'MANAGE', icon: '✦' }");
        expect(scene).toContain('action: () => this.openVillageCommand({ plotId })');
        expect(scene).toContain('applyExplorationCameraFollowOffset(');
        expect(scene).toContain('layout.dockHeight * 0.46');
        expect(scene).toContain('shouldPresentLegacyTutorialFeedback()');
        expect(scene).toContain('if (villageSnapshot?.unlock?.unlocked === true) return false;');
        expect(scene).toContain('this.dismissLegacyTutorialHint();');
        expect(scene).toContain("hint.setData('legacyTutorialHint', true)");
        expect(world).toContain('compactPresentation ? 0 : 1');
        expect(world).toContain('`${definition.shortLabel} · ${building.creature.name.toUpperCase()}');
        expect(world).toContain('${definition.worldEffectLabel}`');
        expect(world).toContain("'villageFocusAlphaMultiplier'");
        expect(world).toContain('this.scene.setSanctuaryMomentFocus?.(true');
        expect(scene).toContain('getVillageHeartInteractionPrompt(');
        expect(scene).toContain("this.sanctuaryPresentationMode = 'ambient'");
        expect(scene).toContain("const quietArrival = ['review', 'supplies'].includes(nextAction?.type)");
        expect(scene).toContain('guided: plotId === null');
        expect(world).toContain("profile: 'terraced_current_v2'");
        expect(world).toContain('heartArtworkSize: 132');
        expect(world).toContain('buildingArtworkScale: 0.48');
        expect(world).toContain('heartArtworkSize: 202');
        expect(world).toContain('buildingArtworkScale: 0.84');
        expect(world).toContain('Object.freeze({ x: -112, y: -226 })');
        expect(world).toContain('Object.freeze({ x: 0, y: 148 })');
        expect(world).toContain('.setDepth(-21)');
        expect(world).toContain('.setDepth(-20)');
        expect(world).toContain('const heartDisplaySize = settlementLayout.heartArtworkSize;');
        expect(world).toContain(".setData('villageHeartCollisionCore', true)");
        expect(world).toContain(".setData('villageHeartApproachThreshold', true)");
        expect(world).toContain(".setData('approachDirection', 'south')");
        expect(world).toContain(".setData('villageLayoutProfile', settlementLayout.profile)");
        expect(world).toContain(".setData('villageHeartCaption', true)");
        expect(world).toContain('landmark.heartCaption?.setAlpha(');
        expect(world).toContain('const directPlotCommand = Boolean(');
        expect(world).toContain('primary && [\'build\', \'assign\'].includes(action?.type)');
        expect(world).toContain("? primary ? 0.88 : 0");
        expect(world).toContain('const plotLabelRestAlpha = guidedPlot');
        expect(world).toContain('? 0.32\n                : 0;');
    });

    test('the local completion preview renders the entire connected settlement', () => {
        const game = read('game.js');
        const scene = read('scenes/GameScene.js');

        expect(game).toContain("['empty', 'building', 'active', 'complete']");
        expect(scene).toContain("this.villageCommandPreview === 'complete'");
        expect(scene).toContain("['workshop', 'root_05', null]");
        expect(scene).toContain('createFieldKitPreviewBackdrop({ includeShip = true } = {})');
        expect(scene).toContain("ship.setData('fieldKitPreviewShip', true)");
        expect(scene).toContain('this.createFieldKitPreviewBackdrop({ includeShip: false });');
    });
});
