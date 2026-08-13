const fs = require('fs');
const path = require('path');

describe('Platformer failure and mobile input recovery', () => {
    const source = fs.readFileSync(
        path.join(__dirname, '../scenes/PlatformerLevelScene.js'),
        'utf8'
    );

    test('attaches scene cleanup to Phaser shutdown', () => {
        expect(source).toContain(
            'this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);'
        );
    });

    test('removes native and Phaser joystick handlers', () => {
        expect(source).toContain(
            "canvas.removeEventListener('touchend', this.platformerTouchEndHandler);"
        );
        expect(source).toContain(
            "canvas.removeEventListener('pointercancel', this.platformerPointerCancelHandler);"
        );
        expect(source).toContain(
            "this.input.off('pointermove', this.platformerJoystickMoveHandler);"
        );
        expect(source).toContain('this.cleanupPlatformerInputHandlers();');
    });

    test('shows an actionable recovery instead of a blank level', () => {
        expect(source).toContain('this.showLevelInitializationError();');
        expect(source).toContain("'EXPEDITION INTERRUPTED'");
        expect(source).toContain("button?.once?.('pointerup', () => this.scene.start('HubWorldScene'));"
        );
    });

    test('uses a short-screen resident rescue layout without stacked copy overlap', () => {
        expect(source).toContain('const shortCompact = compact && height < 620;');
        expect(source).toContain("shortCompact ? titleY + 26 : height * 0.72");
        expect(source).toContain('shortCompact ? 0 : 0.5');
    });

    test('keeps flat-ground mobile jumps stable instead of passively bouncing', () => {
        expect(source).toContain('this.player.setBounce(0);');
        expect(source).toContain(
            'const isRising = this.player.body.velocity.y < -1;'
        );
        expect(source).toContain(') && !isRising;');
    });

    test('freezes guardian hazards behind recovery and resumes the scene clock', () => {
        expect(source).toContain('if (this.time) this.time.paused = true;');
        expect(source).toContain('this.time.paused = false;');
        expect(source).toContain('this.tweens?.pauseAll?.();');
        expect(source).toContain('this.tweens?.resumeAll?.();');
        expect(source).toContain('this.resumeFailureRecoveryClock();');
        expect(source).toContain("'RETURN TO GUARDIAN STANCE'");
        expect(source).toContain('this.guardianEncounter?.active');
        expect(source).toContain('this.showDeathScreen();');
        expect(source).not.toContain('targets: this.player,\n            alpha: 0');
    });

    test('resumes the recovery clock before leaving for either hub', () => {
        const returnToHub = source.slice(
            source.indexOf('    returnToHub() {'),
            source.indexOf('    returnToSanctuary() {')
        );
        const returnToSanctuary = source.slice(
            source.indexOf('    returnToSanctuary() {'),
            source.indexOf('    shutdown() {')
        );

        expect(returnToHub).toContain('this.resumeFailureRecoveryClock();');
        expect(returnToHub).toContain("this.scene.start('HubWorldScene');");
        expect(returnToSanctuary).toContain('this.resumeFailureRecoveryClock();');
        expect(returnToSanctuary).toContain("this.scene.start('GameScene'");
    });
});
