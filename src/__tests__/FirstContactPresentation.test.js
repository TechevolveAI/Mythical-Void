const fs = require('fs');
const path = require('path');

describe('first-contact hatch presentation', () => {
    const sceneSource = fs.readFileSync(
        path.join(__dirname, '../scenes/HatchingScene.js'),
        'utf8'
    );
    const evolutionConfig = require('../config/evolution.json');
    const rarityConfig = require('../config/rarity-config.json');

    test('frames maturity as a projection instead of a guaranteed destiny', () => {
        const reveal = evolutionConfig.hatching.visionReveal;

        expect(reveal.visionMessage).toBe('PROJECTED MATURITY // SIGNAL POTENTIAL');
        expect(reveal.transitionMessage).toContain('One possible future');
        expect(reveal.babyRevealMessage).toBe('FIRST CONTACT // PRESENT FORM');
        expect(sceneSource).not.toContain('magnificent destiny');
        expect(sceneSource).not.toContain('incredible form');
    });

    test('treats the result as a field reading and the alternative as a rescan', () => {
        expect(sceneSource).toContain('FIELD CLASSIFICATION //');
        expect(sceneSource).toContain('CONFIRM CONTACT');
        expect(sceneSource).toContain('RESCAN SIGNAL');
        expect(sceneSource).toContain('before the signal stabilizes');
        expect(sceneSource).not.toContain('✓ KEEP');
        expect(sceneSource).not.toContain("'🔄 REROLL', {");
        expect(sceneSource).not.toContain('Great choice!');
    });

    test('gives the decision exclusive ownership of the header area', () => {
        expect(sceneSource).toContain('this.hatchTitleText = this.add.text');
        expect(sceneSource).toContain('this.hatchSubtitleText = this.add.text');
        expect(sceneSource).toContain(
            '[this.hatchTitleText, this.hatchSubtitleText, this.instructionText, this.progressText]'
        );
        expect(sceneSource).toContain('element?.setVisible(false)');
    });

    test('positions sparkles and confirmation from the active viewport', () => {
        expect(sceneSource).toContain('const centerY = height * 0.45');
        expect(sceneSource).toContain('centerX + Phaser.Math.Between(-horizontalSpread, horizontalSpread)');
        expect(sceneSource).toContain("this.add.text(width / 2, height * 0.7, 'CONTACT CONFIRMED'");
        expect(sceneSource).not.toContain("this.add.text(400, 480, '✨ Great choice! ✨'");
    });

    test('uses mission-age first-contact language for every rarity', () => {
        Object.values(rarityConfig)
            .filter(entry => entry?.celebrationMessage)
            .forEach(entry => {
                expect(entry.displayName).toMatch(/Signal$/);
                expect(entry.celebrationMessage).toMatch(/^First contact confirmed\./);
                expect(entry.celebrationMessage).not.toMatch(
                    /lovely|wonderful|delightfully|wow|incredible|friend/i
                );
            });
        expect(sceneSource).toContain('const bannerWidth = Math.min(500, width - 24)');
        expect(sceneSource).toContain('wordWrap: { width: bannerWidth - 28 }');
    });
});
