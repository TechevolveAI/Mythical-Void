const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('Guardian resident gameplay contract', () => {
    const platformer = read('scenes/PlatformerLevelScene.js');
    const gameScene = read('scenes/GameScene.js');
    const worldBuilder = read('systems/world/WorldBuilder.js');
    const gameState = read('systems/GameState.js');
    const game = read('game.js');
    const hatching = read('scenes/HatchingScene.js');
    const globalInit = read('global-init.js');
    const beaconModal = read('ui/ProjectBeaconLogModal.js');
    const completionLevels = [
        'scenes/levels/MythicalForestLevel.js',
        'scenes/levels/CrystalCavesLevel.js',
        'scenes/levels/ReefLevel.js',
        'scenes/levels/AuroraDepthsLevel.js',
        'scenes/levels/VoidPeaksLevel.js',
        'scenes/levels/FinalVoidLevel.js'
    ].map(read);

    test('records regional Guardian outcomes and frees a distinct creature', () => {
        expect(platformer).toContain('window.GuardianOutcomes');
        expect(platformer).toContain('?.recordGuardianOutcome?.(');
        expect(platformer).toContain('window.RescuedResidents');
        expect(platformer).toContain('?.recordRescuedResident?.(');
        expect(platformer).toContain('newlyRescued: rescuedResident.changed');
        expect(platformer).toContain('getGuardianSanctuaryArrivalCopy');
        expect(platformer).toContain('${resident.name} FREED -> SANCTUARY');
        expect(platformer).toContain('REGIONAL OUTCOME // ${guardian.name}');
        completionLevels.forEach(level => {
            expect(level).toContain(
                'this.getGuardianSanctuaryArrivalCopy({ compact: true })'
            );
        });
    });

    test('renders only canonical Guardian presences while rescued creatures inhabit the Sanctuary', () => {
        expect(worldBuilder).toContain('refreshGuardianResidents(garden, snapshot = null)');
        expect(worldBuilder).toContain('allowedPresenceIds');
        expect(worldBuilder).toContain("? 'HEART ECHO'");
        expect(worldBuilder).toContain(".setData('guardianSanctuaryPresence', heartProjection ? 'heart_projection' : 'none')");
        expect(worldBuilder).toContain(".setData('guardianCommunityStatus', heartProjection ? 'heart_echo' : 'region_bound')");
        expect(worldBuilder).toContain('refreshRescuedResidents(garden, snapshot = null, {');
        expect(worldBuilder).toContain('this.scene.add.image(0, -3, definition.textureKey)');
        expect(worldBuilder).toContain('zone.guardianResidentId = definition.id');
        expect(worldBuilder).toContain('zone.body?.updateFromGameObject?.()');
        expect(worldBuilder).toContain('onComplete: beginRoutine');
        expect(worldBuilder).toContain('this.scene.textures.exists(definition.textureKey)');
        expect(worldBuilder).toContain('this.scene.add.image(0, -4, definition.textureKey)');
        expect(worldBuilder).toContain('drawGuardianResidentFigure(graphics, definition)');
        expect(worldBuilder).toContain('definition.routineCue');
        expect(worldBuilder).toContain('routineLabel.setVisible(true)');
        expect(worldBuilder).toContain("? 'STABLE'");
        expect(worldBuilder).toContain('definition.routineCare.worldFeedback');
        expect(worldBuilder).toContain('definition.ambientLines || []');
        expect(worldBuilder).toContain('(entry.routineCycle + index) % ambientCadence === 0');
        expect(worldBuilder).toContain('showAmbientLine(ambientLines[lineIndex])');
        expect(worldBuilder).toContain('startGuardianResidentSocialMoments(garden)');
        expect(worldBuilder).toContain('GUARDIAN_SOCIAL_EXCHANGES.filter');
        expect(worldBuilder).toContain('candidate.playerDistance <= 470');
        expect(worldBuilder).toContain('SANCTUARY EXCHANGE // ${candidate.exchange.cue}');
        expect(worldBuilder).toContain("'guardian-social-moment'");
        expect(worldBuilder).toContain('schedule(23000)');
        expect(worldBuilder).toContain('routineTimer?.remove?.()');
    });

    test('prioritizes guardian conversations and exposes tasks plus team abilities', () => {
        expect(gameScene).toContain('this.setupGuardianResidentOverlaps()');
        expect(gameScene).toMatch(
            /if \(this\.nearGuardianResidentId\)[\s\S]*this\.interactWithGuardianResident\(\);[\s\S]*if \(this\.nearFendResidentId\)/
        );
        expect(gameScene).toContain('REGIONAL ALLY // HEART ECHO');
        expect(gameScene).toContain('FOREST ROOTWARDEN  //  SPEAKS THROUGH THE VILLAGE HEART');
        expect(gameScene).toContain('COOPERATIVE TASK // ${result.resident.task.title.toUpperCase()}');
        expect(gameScene).toContain('ACTIVE EXPEDITION ALLY');
        expect(gameScene).toContain('[ ASSIST ROUTINE ]');
        expect(gameScene).toContain('CARE AVAILABLE AFTER FIRST MEETING');
        expect(gameScene).toContain('CARE RECOVERING ${formatGuardianRoutineRecovery(result.resident.routineWaitMs)}');
        expect(gameScene).toContain('[ RECOVERING ${formatGuardianRoutineRecovery(result.resident.routineWaitMs)} ]');
        expect(gameScene).toContain('resident.artwork');
        expect(gameScene).toContain('result.resident.textureKey');
        expect(gameScene).toContain('this.assistGuardianResidentRoutine(guardianId)');
        expect(gameScene).toContain('this.showGuardianCareActivity(resident)');
        expect(gameScene).toContain('getGuardianCompanionRecognition(');
        expect(gameScene).toContain('Date.now() - lastRecognitionAt >= 23000');
        expect(gameScene).toContain('showGuardianCompanionRecognitionMoment(recognition, resident');
        expect(gameScene).toContain('COMPANION RECOGNITION // ${resident.name.toUpperCase()}');
        expect(gameScene).toContain('SANCTUARY CARE // LIVING ROUTINE');
        expect(gameScene).toContain('`STEP 1/${steps.length}`');
        expect(gameScene).toContain('CARE COMPLETE // ROUTINE STABLE');
        expect(gameScene).toContain("cancel.on('pointerup', () => this.destroyGuardianCareActivity())");
        expect(gameScene).toContain('createGuardianRoutineAssistPreviewResult(guardianId)');
        expect(gameScene).toContain("reason: 'guardian_routine_assisted'");
        expect(gameScene).toContain('TRUST ${result.resident.trustProgress}/${result.resident.trustTarget}');
        expect(gameScene).toContain("result.reason === 'guardian_synergy_unlocked'");
        expect(gameScene).toContain("recordGuardianActivity(window.GameState, 'targetHits')");
    });

    test('persists a minimal guardian state and initializes the system globally', () => {
        expect(gameState).toContain('guardianResidents: {');
        expect(gameState).toContain('rescuedIds: []');
        expect(gameState).toContain('acceptedTaskIds: []');
        expect(gameState).toContain('gardenVisits: 0');
        expect(gameState).toContain('activeTeamGuardianId: null');
        expect(gameState).toContain('routineAssists: {}');
        expect(gameState).toContain('routineHistory: []');
        expect(gameState).toContain('expeditionHistory: []');
        expect(gameState).toContain('pendingExpeditionDebrief: null');
        expect(globalInit).toContain("import './systems/GuardianResidents.js';");
        expect(globalInit).toContain("import './systems/GuardianOutcomes.js';");
        expect(globalInit).toContain("import './systems/SanctuaryCommunity.js';");
    });

    test('applies exactly one selected guardian ability to expedition stats', () => {
        expect(platformer).toContain('getActiveGuardianTeamSupport?.(window.GameState)');
        expect(platformer).toContain('this.applyMovementProfile();');
        expect(platformer).toContain('this.playerSpeed = Number.isFinite(profile.playerSpeed)');
        expect(platformer).toContain('this.jumpVelocity = Number.isFinite(profile.jumpVelocity)');
        expect(platformer).toContain('this.guardianTeamSupport.maxHealthBonus');
        expect(platformer).toContain('this.guardianTeamSupport.maxEnergyBonus');
        expect(platformer).toContain('this.powerupShieldHits = this.guardianTeamSupport.shieldHits');
        expect(platformer).toContain('ALLY ${this.guardianTeamSupport.guardianName.toUpperCase()}');
        expect(platformer).toContain('createGuardianTeamSupportEcho()');
        expect(platformer).toContain('updateGuardianTeamSupportEcho(delta)');
        expect(platformer).toContain('pulseGuardianTeamSupportEcho(blockLabel)');
        expect(platformer).toContain('destroyGuardianTeamSupportEcho()');
        expect(platformer).toContain('?.recordGuardianExpedition?.(gameState, {');
        expect(platformer).toContain('interventionCount: this.guardianInterventions');
        expect(gameScene).toContain("result.reason === 'guardian_expedition_debrief'");
        expect(gameScene).toContain('ALLIANCE DEBRIEF // SHARED EXPEDITION MEMORY');
        expect(gameScene).toContain("? 'Debrief shared expedition'");
        expect(worldBuilder).toContain("? 'DEBRIEF'");
        expect(platformer).toContain('preloadGuardianTeamSupportArtwork()');
        expect(platformer).toContain('this.load.image(support.textureKey, support.artwork)');
        expect(platformer).toContain('this.add.image(0, 0, support.textureKey)');
        expect(platformer).toContain('this.guardianSupportEcho = {');
        expect(platformer).toContain('usesArtwork');
        completionLevels.forEach(level => {
            expect(level).toContain('super.preload();');
        });
        expect(gameScene).toContain("'synergy'");
        expect(worldBuilder).toContain("? 'TRUSTED'");
        expect(worldBuilder).toContain("status.routineReady\n                    ? 'CARE'");
        expect(worldBuilder).toContain('[standingLabel, routineStateLabel]');
    });

    test('provides a local non-saving route for visual regression of all guardians', () => {
        expect(game).toContain("const testGuardians = urlParams.get('testGuardians')");
        expect(game).toContain('guardianResidentPreview: Number(testGuardians)');
        expect(game).toContain("const testGuardianExchange = urlParams.get('testGuardianExchange')");
        expect(game).toContain('guardianExchangePreview: Number(testGuardianExchange)');
        expect(hatching).toContain("previewParams.has('testGuardians')");
        expect(hatching).toContain("previewParams.has('testGuardianExchange')");
        expect(hatching).toContain("previewParams.has('testGuardianRecognition')");
        expect(hatching).toContain("previewParams.has('testGuardianAlly')");
        expect(game).toContain("urlParams.get('testGuardianAlly')");
        expect(game).toContain('guardianAllyPreview: testGuardianAlly');
        expect(gameScene).toContain(
            'createGuardianResidentPreviewSnapshot(count, taskState = null, taskResidentIndex = null)'
        );
        expect(game).toContain("urlParams.get('guardianTaskState')");
        expect(game).toContain("'debrief'");
        expect(gameScene).toContain("debrief: 'guardian_expedition_debrief'");
        expect(game).toContain("'testGuardianRecognition'");
        expect(game).toContain('guardianRecognitionPreview: Number');
        expect(gameScene).toContain('this.guardianRecognitionPreview = Number.isFinite');
        expect(gameScene).toContain("id: 'preview_kira_23'");
    });

    test('makes the Sanctuary return payoff visible in Project Beacon', () => {
        expect(beaconModal).toContain(
            'SANCTUARY RESIDENTS ${sanctuaryCommunity.counts.residents}'
        );
        expect(beaconModal).toContain(
            'REGIONAL ALLIES ${sanctuaryCommunity.counts.regionalAllies}'
        );
        expect(beaconModal).toContain('VILLAGE HEART ALLY');
        expect(beaconModal).toContain('HEART ECHO READY');
        expect(beaconModal).toContain('guardianResidents.taskFocusResident');
        expect(beaconModal).toContain('guardianResidents.supportedResidentCount');
        expect(beaconModal).toContain('guardianResidents.synergyCount');
    });
});
