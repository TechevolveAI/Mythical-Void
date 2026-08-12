const fs = require('fs');
const path = require('path');
const vm = require('vm');

const gameSource = fs.readFileSync(
    path.join(__dirname, '../game.js'),
    'utf8'
);
const hatchingSource = fs.readFileSync(
    path.join(__dirname, '../scenes/HatchingScene.js'),
    'utf8'
);
const sceneSource = fs.readFileSync(
    path.join(__dirname, '../scenes/GameScene.js'),
    'utf8'
);

function loadCheckInModule() {
    const filePath = path.join(
        __dirname,
        '../systems/SanctuaryCheckIn.js'
    );
    const source = fs.readFileSync(filePath, 'utf8')
        .replace('export function getSanctuaryCheckInCopy', 'function getSanctuaryCheckInCopy')
        .replace(
            'export { CHECK_IN_LINES };',
            'module.exports = { CHECK_IN_LINES, getSanctuaryCheckInCopy };'
        );
    const sandbox = { module: { exports: {} }, exports: {} };
    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

const {
    CHECK_IN_LINES,
    getSanctuaryCheckInCopy
} = loadCheckInModule();

describe('Sanctuary return-session tone', () => {
    test.each([
        ['curious', 8, 'MORNING CYCLE'],
        ['playful', 13, 'MIDDAY CYCLE'],
        ['gentle', 20, 'EVENING CYCLE'],
        ['wise', 23, 'EVENING CYCLE'],
        ['energetic', 0, 'MORNING CYCLE']
    ])('authors a grounded %s check-in', (personalityCore, hour, cycleLabel) => {
        const copy = getSanctuaryCheckInCopy({
            name: 'Nova',
            personalityCore,
            hour
        });

        expect(copy.title).toBe('SANCTUARY CHECK-IN');
        expect(copy.cycleLabel).toBe(cycleLabel);
        expect(copy.statusLine).toContain('BOND LINK RESTORED');
        expect(copy.line).toContain('Nova');
        expect(copy.line).not.toMatch(/happy wiggle|bounces excitedly|chirps with joy/i);
    });

    test('keeps multiple authored observations per personality', () => {
        Object.values(CHECK_IN_LINES).forEach(lines => {
            expect(lines).toHaveLength(3);
            expect(new Set(lines).size).toBe(lines.length);
        });
    });

    test('sanitizes the companion name and falls back to a supported voice', () => {
        const copy = getSanctuaryCheckInCopy({
            name: '  Nova\u0000  ',
            personalityCore: 'unsupported',
            hour: 12
        });

        expect(copy.personalityCore).toBe('curious');
        expect(copy.line).toContain('Nova');
        expect(copy.line).not.toContain('\u0000');
    });

    test('provides a local non-saving mobile preview route', () => {
        expect(gameSource).toContain("urlParams.get('testCheckIn')");
        expect(gameSource).toContain('checkInPreview: testCheckIn');
        expect(hatchingSource).toContain("previewParams.has('testCheckIn')");
        expect(sceneSource).toContain('this.checkInPreview');
        expect(sceneSource).toContain('Sanctuary check-in preview created successfully');
    });
});
