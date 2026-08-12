const fs = require('fs');
const path = require('path');

describe('interruption-safe hatching', () => {
    const hatchingSource = fs.readFileSync(
        path.join(__dirname, '../scenes/HatchingScene.js'),
        'utf8'
    );
    const inventorySource = fs.readFileSync(
        path.join(__dirname, '../scenes/InventoryScene.js'),
        'utf8'
    );

    test('commits the hatched flag only after genetics are stored', () => {
        const animationComplete = hatchingSource.slice(
            hatchingSource.indexOf('completeHatching() {'),
            hatchingSource.indexOf('showCelebrationBanner(')
        );
        const identityCommit = hatchingSource.slice(
            hatchingSource.indexOf('saveCreatureGenetics() {'),
            hatchingSource.indexOf('generateCreatureName() {')
        );

        expect(animationComplete).not.toContain('getGameState().completeHatching()');
        expect(identityCommit.indexOf("state.set('creature.genes'"))
            .toBeLessThan(identityCommit.indexOf('state.completeHatching()'));
        expect(identityCommit.indexOf('state.completeHatching()'))
            .toBeLessThan(identityCommit.indexOf('state.save()'));
    });

    test('repairs an old partial hatch before choosing the boot route', () => {
        expect(hatchingSource).toContain(
            'Repairing interrupted hatch with no durable creature identity'
        );
        expect(hatchingSource).toContain("GameState.set('creature.hatched', false)");
        expect(hatchingSource).toContain('creatureHatched = false;');
    });

    test('persists and resumes an inventory egg reservation', () => {
        expect(inventorySource).toContain("status: 'reserved'");
        expect(inventorySource).toContain("window.GameState?.set('creature.hatchTransaction'");
        expect(hatchingSource).toContain("pendingHatch?.status === 'reserved'");
        expect(hatchingSource).toContain("state.set('creature.hatchTransaction', null)");
        expect(hatchingSource).toContain(
            'const freshCreature = GameState.createInitialState().creature;'
        );
        expect(hatchingSource).toContain("GameState.set('creature', freshCreature)");
        expect(inventorySource).toContain(
            'const hatchLaunchTimeout = setTimeout(launchReservedHatch, 3000);'
        );
        expect(inventorySource).toContain(
            'this.pendingTimeouts.push(hatchLaunchTimeout);'
        );
    });
});
