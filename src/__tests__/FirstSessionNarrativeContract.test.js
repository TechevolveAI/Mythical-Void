const fs = require('fs');
const path = require('path');
const projectBeacon = require('../config/project-beacon.json');

describe('first-session Project Beacon framing', () => {
    const source = fs.readFileSync(
        path.join(__dirname, '../scenes/HatchingScene.js'),
        'utf8'
    );
    const framing = projectBeacon.firstSessionFraming;

    test('introduces mission pressure before first contact', () => {
        expect(framing.homeSubtitle).toBe('PROJECT BEACON // WANDERER-7');
        expect(framing.homeCta).toBe('BEGIN PROJECT BEACON');
        expect(framing.homePromise).toMatch(/astronaut.*beacon.*living world/i);
        expect(framing.homeCards.map(card => card.title)).toEqual([
            'SURVIVE',
            'CONNECT',
            'RESTORE'
        ]);
    });

    test('turns the hatch into a warm first-contact moment', () => {
        const hatchText = [
            framing.hatchTitle,
            framing.hatchSubtitle,
            framing.firstHatchPrompt,
            framing.returningHatchPrompt,
            ...Object.values(framing.tutorialHints)
        ].join(' ');

        expect(hatchText).toMatch(/first contact/i);
        expect(hatchText).toMatch(/living signal/i);
        expect(hatchText).toMatch(/gently/i);
        expect(hatchText).toMatch(/trusted you/i);
        expect(hatchText).not.toMatch(/specimen|extract|Earth comes first/i);
    });

    test('uses the shared canon instead of generic adventure copy', () => {
        expect(source).toContain(
            "import projectBeacon from '../config/project-beacon.json';"
        );
        expect(source).toContain(
            'const firstSessionFraming = projectBeacon.firstSessionFraming;'
        );
        expect(source).not.toMatch(
            /Where Space Meets Magic|START YOUR ADVENTURE|Mythical Creature Game|magical adventure begins|Explore the magical world/
        );
    });

    test('fits the first-contact action on narrow screens', () => {
        expect(source).toContain(
            'const isMobile = MobileHelpers.isMobile() || width < 600;'
        );
        expect(source).toContain(
            'const fittedFontSize = availableWidth / (text.length * 0.62);'
        );
        expect(source).toContain(
            'const instructionBottom = this.instructionText'
        );
        expect(source).toContain(
            'const textY = instructionBottom + (fontSize / 2) + 14;'
        );
        expect(source).toContain('y: textY - 6');
        expect(source).not.toContain('y: 170');
        expect(source.indexOf('this.createUI();')).toBeLessThan(
            source.indexOf('this.createTapToHatchText();')
        );
        expect(source).toContain('const arrowY = eggTop - 4;');
        expect(framing.tapPromptMobile.length)
            .toBeLessThan(framing.tapPromptDesktop.length);
    });
});
