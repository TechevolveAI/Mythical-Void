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

        expect(reveal.visionMessage).toBe('PROJECTED MATURITY // GROWTH POTENTIAL');
        expect(reveal.transitionMessage).toContain('One possible future');
        expect(reveal.babyRevealMessage).toBe('FIRST CONTACT // PRESENT FORM');
        expect(sceneSource).not.toContain('magnificent destiny');
        expect(sceneSource).not.toContain('incredible form');
    });

    test('treats the result as a field reading and the alternative as a rescan', () => {
        expect(sceneSource).toContain("'FIELD CLASSIFICATION'");
        expect(sceneSource).toContain('const rarityLabel = rarityInfo.displayName');
        expect(sceneSource).toContain('rarityLabel.toUpperCase()');
        expect(sceneSource).not.toMatch(/\bsignals?\b/i);
        expect(sceneSource).toContain('GENETIC TRAIT · ${formatFieldTerm(specialFeature)}');
        expect(sceneSource).toContain('CONFIRM CONTACT');
        expect(sceneSource).toContain('RESCAN CREATURE');
        expect(sceneSource).toContain('One rescan remains. Accept this reading');
        expect(sceneSource).toContain('SCAN ESTIMATE · ${advice.message}');
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
        expect(sceneSource).toContain("'FIELD CLASSIFICATION'");
        expect(sceneSource).toContain('${formatFieldTerm(this.creatureGenetics.species)} ·');
    });

    test('makes the creature the focus and removes finished egg instructions', () => {
        expect(sceneSource.match(/const targetScale = layout\.creatureScale/g)).toHaveLength(3);
        expect(sceneSource).toContain('creature.setBlendMode(Phaser.BlendModes.SCREEN)');
        expect(sceneSource).toContain('creature.clearMask?.(true)');
        expect(sceneSource).not.toContain('creature.setMask(');
        expect(sceneSource).not.toContain('creatureMaskWidth');
        expect(sceneSource).not.toContain('creatureMaskHeight');
        expect(sceneSource).toContain('this.tapToHatchText.destroy()');
        expect(sceneSource).toContain('Object.values(this.controlPanelElements || {}).forEach');
        expect(sceneSource).toContain('const advice = canReroll ?');
        expect(sceneSource).toContain('const adviceText = advice ?');
        expect(sceneSource).toContain('this.controlPanelElements = { panelBg, controlText, journeyText }');
        expect(sceneSource).toContain("const keepLabel = canReroll ? 'CONFIRM CONTACT' : 'MEET THIS CREATURE'");
    });

    test('uses one phone-first layout for the full reveal reading order', () => {
        expect(sceneSource).toContain('getFirstContactLayout(canReroll = true)');
        expect(sceneSource).toContain('bannerHeight = isCompact ? 108 : 98');
        expect(sceneSource).toContain('const guidanceY = platformY +');
        expect(sceneSource).toContain('const scanY = canReroll ? guidanceY +');
        expect(sceneSource).toContain('const buttonY = Math.min(');
        expect(sceneSource).toContain("'FIELD CLASSIFICATION'");
        expect(sceneSource).toContain('this.firstContactGuidance = { guidanceBg, tutorialHint }');
        expect(sceneSource).toContain('this.tweens.killTweensOf(this.tutorialHintText)');
        expect(sceneSource).toContain('if (window.rerollSystem && this.creatureGenetics)');
        expect(sceneSource).toContain('Classification is local game data');
        expect(sceneSource).toContain('The first-contact guidance below now owns this step.');
        expect(sceneSource).not.toContain('height * 0.625');
        expect(sceneSource).not.toContain('height * 0.715');
        expect(sceneSource).not.toContain('height * 0.79');
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
                expect(entry.displayName).toMatch(/Life Form$/);
                expect(entry.celebrationMessage).toMatch(/^First contact confirmed\./);
                expect(entry.celebrationMessage).not.toMatch(
                    /lovely|wonderful|delightfully|wow|incredible|friend/i
                );
            });
        expect(sceneSource).toContain('const bannerWidth = Math.min(500, width - 24)');
        expect(sceneSource).toContain('wordWrap: { width: bannerWidth - 28 }');
    });
});
