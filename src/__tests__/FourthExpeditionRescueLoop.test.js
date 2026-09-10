const fs = require('fs');
const path = require('path');

const levelPath = path.join(__dirname, '../scenes/levels/VoidPeaksLevel.js');

function readLevel() {
    return fs.readFileSync(levelPath, 'utf8');
}

describe('fourth expedition rescue loop', () => {
    test('uses the base one-shot lifecycle and does not duplicate the boss arena in test mode', () => {
        const source = readLevel();
        const createMethod = source.match(
            /\n    create\(\)\s*\{([\s\S]*?)\n    \}\n\n    startTestMode/
        )?.[1] || '';
        const testMode = source.match(
            /startTestMode\(\)\s*\{([\s\S]*?)\n    \}\n\n    showLevelEntry/
        )?.[1] || '';
        const startLevel = source.match(
            /startLevel\(\)\s*\{([\s\S]*?)\n    \}/
        )?.[1] || '';

        expect(createMethod).toContain('super.create()');
        expect(createMethod).not.toContain('this.createLevelContent()');
        expect(testMode).not.toContain('this.createBossArena()');
        expect(testMode).toContain('this.showPlatformerMobileControls()');
        expect(startLevel).not.toContain('this.createLevelContent()');
        expect(startLevel).toContain('this.showPlatformerMobileControls()');
    });

    test('places three localized warning relays with safe checkpoints', () => {
        const source = readLevel();

        expect(source).toContain("id: 'peaks_relay_1'");
        expect(source).toContain("id: 'peaks_relay_2'");
        expect(source).toContain("id: 'peaks_relay_3'");
        expect(source).toContain(
            'this.createObjectiveTriggerZone(\n                relay.x,\n                relay.y - 35,\n                { width: 150, height: 190 }'
        );
        expect(source).toContain("activationSupportIds: ['peak-lower-relay-overlook']");
        expect(source).toContain("activationSupportIds: ['peak-warning-lower']");
        expect(source).toContain("activationSupportIds: ['peak-summit-relay']");
        expect(source).toContain('this.isPlayerGroundedOnTraversalSupport(');
        expect(source).toContain('this.getTraversalSupportCheckpoint(');
        expect(source).toContain('WARNING BEACON\\nLAND HERE');
        expect(source).toContain('LAND ON THE LIT PLATFORM');
        expect(source).toContain('WARNING BEACON ${this.beaconRelaysActivated}/3 LIT');
        expect(source).toContain("activationSupportIds: ['peak-titan-gate']");
        expect(source).toContain("this.isPlayerGroundedOnTraversalSupport('peak-titan-gate')");
    });

    test('turns the third relay into a visible creature-led warning and reply', () => {
        const source = readLevel();
        const response = source.match(
            /playCreatureWarningResponse\(relay\)\s*\{([\s\S]*?)\n    \}\n\n    getCreatureWarningResponseSnapshot/
        )?.[1] || '';

        expect(source).toContain('const companionName = this.getCompanionName()');
        expect(source).toContain('Warning sent. Stay close.');
        expect(source).toContain('RIDGE FALLING. TITAN HOLDING LINE.');
        expect(source).toContain('THREE SETTLEMENTS ANSWER');
        expect(source).toContain('They want it saved.');
        expect(source).toContain('Light 3 warning beacons. Then free the Cosmic Titan.');
        expect(source).toContain('`[ BEACON ] ${resume.label} link restored`');
        expect(source).toContain('this.creatureNetworkReached = true');
        expect(source).toContain('this.playCreatureWarningResponse(relay)');
        expect(source).toContain('relay.label?.setVisible?.(false)');
        expect(response).toContain('sourceX: body.center.x');
        expect(response).toContain('sourceY: body.bottom');
        expect(source).toContain('SENDS THE WARNING');
        expect(response).toContain('duration: 1600');
        expect(response).toContain('Math.min(element.alpha, 0.24)');
        expect(response).toContain("'peaks_warning_witness'");
        expect(response).toContain('witnessOffsetX');
        expect(response).toContain('body.allowGravity = false');
        expect(response).toContain('this.recoveryInputLockedUntil = Math.max(');
        expect(response).toContain('this.player?.setVelocityX?.(0)');
        expect(source).toContain('restoreCreatureWarningPresentation(response)');
        expect(source).toContain(
            'this.player.body.allowGravity = response.previousAllowGravity'
        );
        expect(source).toContain('element.setAlpha?.(alpha)');
        expect(response).toContain('this.showDistantReplyNetwork(relay);');
        expect(response).toContain("response.stage = 'settled'");
        expect(response).not.toContain('this.physics.pause');
        expect(response).not.toContain('hidePlatformerMobileControls');
        expect(source).toContain('this.clearCreatureWarningResponse();');
        expect(source).toContain("event: 'creature_warning_network_reached'");
    });

    test('turns the settlement network into advance warning gameplay', () => {
        const source = readLevel();

        expect(source).toContain(
            'this.broadcastTitanWarning(attack, attackTarget)'
        );
        expect(source).toContain('NETWORK WARNING // GROUND IMPACT - MOVE');
        expect(source).toContain('NETWORK WARNING // STAR RAIN - KEEP MOVING');
        expect(source).toContain('NETWORK WARNING // TITAN LUNGE - BREAK RANGE');
        expect(source).toContain('NETWORK WARNING // SINGULARITY - CLEAR THE FIELD');
        expect(source).toContain('const TITAN_ATTACK_WINDUP = 700;');
        expect(source).toContain(
            'this.time.delayedCall(TITAN_ATTACK_WINDUP'
        );
        expect(source).toContain(
            'this.executeTitanAttack(attack, attackTarget)'
        );
        expect(source).toContain('RECOVERY WINDOW // PRESS THE ATTACK');
    });

    test('keeps Titan Pass closed until the warning network answers', () => {
        const source = readLevel();
        const gate = source.match(
            /createTitanGate\(\)\s*\{([\s\S]*?)\n    \}\n\n    createBossArena/
        )?.[1] || '';

        expect(gate).toContain('if (!this.creatureNetworkReached)');
        expect(gate).toContain('Titan Pass is closed. Light all 3 warning beacons.');
        expect(gate).toContain('return;');
    });

    test('catches a child who steps off the ledge into a return current', () => {
        const source = readLevel();

        expect(source).toContain('const PEAK_RETURN_CURRENT_LAUNCH_BAND = 130;');
        expect(source).toContain('const descendingIntoCurrent = body.velocity.y >= -20;');
        expect(source).toContain(
            'if ((!grounded && !descendingIntoCurrent) || !inLaunchBand) return false;'
        );
    });

    test('rewards the complete fragment route with a signal-touched egg', () => {
        const source = readLevel();

        expect(source).toContain("id: 'peak_signal_egg'");
        expect(source).toContain("name: 'Strange Egg'");
        expect(source).toContain('ALL FRAGMENTS - EGG AWAKENED');
        expect(source).toContain('this.cosmicEggAwarded = true');
        expect(source).toContain('peakSignalEggAwarded: this.cosmicEggAwarded === true');
        expect(source).toContain('this.hasPeakSignalEgg()');
        expect(source).toContain('this.awardPeakSignalEgg()');
        expect(source).toContain('window.InventoryManager?.addItem?.({');
    });

    test('makes both Peaks routes consequential and persists their combat rewards', () => {
        const source = readLevel();

        expect(source).toContain(
            "mainTradeoff: 'SHORT + RISKY\\nEARNS: TITAN SURGE // 1 FREE BLAST'"
        );
        expect(source).toContain(
            "challengeLabel: 'HIGH RIDGE // 2 RELICS, FEWER GUARDS'"
        );
        expect(source).toContain('titanSurgeCharges: this.peakRouteChoice');
        expect(source).toContain('this.freeSpecialAttackCharges += 1');
        expect(source).toContain('this.retireUnavailablePeakRouteFragments()');
        expect(source).toContain('TITAN SURGE // 1 FREE BLAST READY');
        expect(source).toContain('TITAN SURGE // FREE BLAST SPENT');
        expect(source).toContain('onFreeSpecialAttackConsumed()');
        expect(source).toContain('this.refreshPersistedExpeditionRouteState()');
    });

    test('keeps whole-route decoration static on compact mobile screens', () => {
        const source = readLevel();

        expect(source).toContain('shouldAnimatePeakRouteDecorations()');
        expect(source).toContain(
            'return !(this.isMobile || width <= 480 || height < 620)'
        );
        expect(source).toContain('{ animate: animateRouteDecorations }');
        expect(source).toContain(
            '{ animate: this.shouldAnimatePeakRouteDecorations() }'
        );
    });

    test('protects the player during the intro and after restoration begins', () => {
        const source = readLevel();
        const startBoss = source.match(
            /startBossFight\(\)\s*\{([\s\S]*?)\n    \}\n\n    spawnCosmicTitan/
        )?.[1] || '';
        const defeatBoss = source.match(
            /defeatBoss\(\)\s*\{([\s\S]*?)\n    \}\n\n    showBossVictory/
        )?.[1] || '';

        expect(startBoss).toContain('this.physics.pause()');
        expect(source).toContain('this.physics.resume()');
        expect(source).toContain('if (!marker.active || this.bossDefeated)');
        expect(source).toContain('if (this.bossDefeated) return;');
        expect(defeatBoss).toContain('this.boss.body.enable = false');
    });

    test('uses finished Titan artwork with a procedural combat-safe fallback', () => {
        const source = readLevel();

        expect(source).toContain("const COSMIC_TITAN_ASSET = '/game/guardians/cosmic-titan.webp'");
        expect(source).toContain('this.load.image(COSMIC_TITAN_TEXTURE, COSMIC_TITAN_ASSET)');
        expect(source).toContain('this.createTitanTexture()');
        expect(source).toContain('if (this.textures.exists(COSMIC_TITAN_TEXTURE)) return');
        expect(source).toContain('COSMIC_TITAN_DISPLAY_HEIGHT /');
        expect(source).toContain('this.boss.width * 0.4');
        expect(source).toContain('this.boss.height * 0.66');
        expect(source).toContain('this.bossTargetScale *');
    });

    test('uses responsive restoration language for the Titan encounter', () => {
        const source = readLevel();

        expect(source).toContain(
            'const isMobileLayout = this.isMobile || width <= 480 || height < 620'
        );
        expect(source).toContain('const barY = isMobileLayout ? 118 : 60');
        expect(source).toContain('const toastY = isMobileLayout');
        expect(source).toContain('height < 620 ? Math.min(142, height * 0.38)');
        expect(source).toContain('Math.min(225, height * 0.28)');
        expect(source).toContain('y: toastY - 20');
        expect(source).toContain('this.createCampaignObjectiveDisplay(');
        expect(source).toContain('WARNING BEACON ${current}/3');
        expect(source).toContain("compass?.replace(/^CLUE/, 'CLIMB')");
        expect(source).toContain('TITAN PASS IS OPEN');
        expect(source).toContain(
            '(this.isCompactObjectiveHUD && this.bossFightActive) ||'
        );
        expect(source).toContain(
            '(Number(this.time?.now) || 0) < this.warningReplyCameraFocusUntil'
        );
        expect(source).toContain('this.createBossIndicator()');
        expect(source).toContain('this.updateBossIndicator()');
        expect(source).toContain("'TITAN >'");
        expect(source).toContain("'< TITAN'");
        expect(source).toContain('this.bossIndicator?.setVisible?.(false)');
        expect(source).toContain('WARNING LINE ONLINE // WATCH FOR ATTACK CALLS');
        expect(source).toContain('TITAN ROUTE STABLE');
        expect(source).toContain('COSMIC TITAN RESTORED');
        expect(source).toContain('WARNING NETWORK RESTORED');
        expect(source).toContain("Titan's Gift: Hull Plating");
        expect(source).not.toContain('COSMIC TITAN CONQUERED');
    });

    test('frames the Titan encounter as relieving pressure from an allied guardian', () => {
        const source = readLevel();

        expect(source).toContain('COSMIC TITAN // HOLDING THE LINE');
        expect(source).toContain('VOID PRESSURE // ${pressure}/${this.bossMaxHealth}');
        expect(source).toContain('VOID PRESSURE // CLEARED');
        expect(source).toContain('`PRESSURE -${finalAmount}`');
        expect(source).toContain('this.boss.setTint(0x8FE3CF)');
    });

    test('prevents Titan hazards from overlapping their warning windows', () => {
        const source = readLevel();

        expect(source).toContain('const TITAN_ATTACK_WINDOWS = Object.freeze({');
        expect(source).toContain('gravityCrush: 1800');
        expect(source).toContain('starRain: 2600');
        expect(source).toContain('voidPunch: 1500');
        expect(source).toContain('singularity: 1800');
        expect(source).toContain('this.titanAttackLocked');
        expect(source).toContain('const attackWindow = TITAN_ATTACK_WINDOWS[attack] || 1800');
        expect(source).toContain('this.titanAttackUnlockTimer = this.time.delayedCall(');
    });

    test('supports deterministic local previews for all Titan attack calls', () => {
        const source = readLevel();
        const gameSource = fs.readFileSync(
            path.join(__dirname, '../game.js'),
            'utf8'
        );

        expect(source).toContain("'gravityCrush'");
        expect(source).toContain("'starRain'");
        expect(source).toContain("'voidPunch'");
        expect(source).toContain("'singularity'");
        expect(source).toContain('this.performTitanAttack(this.bossAttackPreview)');
        expect(gameSource).toContain("'gravityCrush'");
        expect(gameSource).toContain("'singularity'");
    });

    test('makes the expedition entry keyboard-accessible and single-fire', () => {
        const source = readLevel();
        const entry = source.match(
            /showLevelEntry\(\)\s*\{([\s\S]*?)\n    \}\n\n    clearLevelEntryKeyHandler/
        )?.[1] || '';

        expect(entry).toContain('if (this.levelEntryDismissing) return');
        expect(entry).toContain('enterBtn.disableInteractive()');
        expect(entry).toContain('overlay.disableInteractive()');
        expect(entry).toContain("if (!['Enter', ' '].includes(event.key)) return");
        expect(entry).toContain("window.addEventListener('keydown', this.levelEntryKeyHandler)");
        expect(source).toMatch(
            /shutdown\(\)[\s\S]*this\.clearLevelEntryKeyHandler\(\)/
        );
    });
});
