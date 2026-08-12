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
});
