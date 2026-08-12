const fs = require('fs');
const path = require('path');

describe('Sanctuary companion care rhythm gameplay contract', () => {
    const careSystemSource = fs.readFileSync(
        path.join(__dirname, '../systems/CareSystem.js'),
        'utf8'
    );
    const panelSource = fs.readFileSync(
        path.join(__dirname, '../systems/ui/CarePanelManager.js'),
        'utf8'
    );
    const gameStateSource = fs.readFileSync(
        path.join(__dirname, '../systems/GameState.js'),
        'utf8'
    );

    test('uses saved care history to recognize repetition and choose a next signal', () => {
        expect(careSystemSource).toContain('getCareMomentContext(actionType, genetics)');
        expect(careSystemSource).toContain("get('creature.care.careHistory')");
        expect(careSystemSource).toContain("needLabel = 'VARIATION REQUEST'");
        expect(careSystemSource).toContain("needLabel = 'RECOVERY REQUEST'");
        expect(careSystemSource).toContain('recommendedAction');
    });

    test('surfaces the changing request in the existing care panel', () => {
        expect(panelSource).toContain('signal.recommendedAction');
        expect(panelSource).toContain('signal.needLabel');
        expect(panelSource).toContain("' // REQUESTED'");
        expect(panelSource).toMatch(
            /showCareEffect\([\s\S]*actionType,[\s\S]*result\.happinessBonus,[\s\S]*result\.villageBonus[\s\S]*\);[\s\S]*updateSignal\(\);/
        );
        expect(panelSource).toContain('FORAGER HUT SUPPORT');
    });

    test('never punishes a young player for time away from the game', () => {
        expect(gameStateSource).toContain('creatureOfflineRecoveryApplied');
        expect(gameStateSource).toContain("set('creature.stats.energy', nextEnergy)");
        expect(gameStateSource).not.toContain('Happiness decayed');
        expect(careSystemSource).not.toMatch(
            /care for it immediately|loves the attention|unbreakable bond/i
        );
        expect(careSystemSource).toContain('Care remains optional');
    });
});
