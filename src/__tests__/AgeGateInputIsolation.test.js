const fs = require('fs');
const path = require('path');

describe('age gate input isolation', () => {
    const source = fs.readFileSync(
        path.join(__dirname, '../ui/AgeGateModal.js'),
        'utf8'
    );

    test('age and notice confirmations wait for pointer release', () => {
        expect(source).toContain("btn.on('pointerup', onClick)");
        expect(source).toContain("continueBtn.on('pointerup'");
        expect(source).not.toContain("btn.on('pointerdown', onClick)");
    });

    test('home content is not created in the confirming pointer event', () => {
        expect(source).toContain('this.isCompleting = true');
        expect(source).toContain('this.scene.time.delayedCall(50');
        expect(source).toContain('const onComplete = this.onComplete');
        expect(source).toContain('this.onComplete = null');
    });
});
