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
    const inventoryManagerSource = fs.readFileSync(
        path.join(__dirname, '../systems/InventoryManager.js'),
        'utf8'
    );
    const gameStateSource = fs.readFileSync(path.join(__dirname, '../systems/GameState.js'), 'utf8');

    test('commits the hatched flag only after genetics are stored', () => {
        const animationComplete = hatchingSource.slice(
            hatchingSource.indexOf('completeHatching() {'),
            hatchingSource.indexOf('showCelebrationBanner(')
        );
        const identityCommit = gameStateSource.slice(gameStateSource.indexOf('commitCreatureHatch(profile,'),
            gameStateSource.indexOf('\n    completeHatching() {'));

        expect(animationComplete).not.toContain('getGameState().completeHatching()');
        expect(identityCommit.indexOf("draft.set('creature.genes'"))
            .toBeLessThan(identityCommit.indexOf('draft.completeHatching()'));
        expect(identityCommit.indexOf('draft.completeHatching()'))
            .toBeLessThan(identityCommit.indexOf('this.commitHatchSaveDraft(draft.state'));
        expect(identityCommit).not.toContain('this.state.creature =');
    });

    test('protects uncertain partial hatches instead of silently resetting their identity', () => {
        const entry = hatchingSource.slice(hatchingSource.indexOf('    continueHatchEntry() {'),
            hatchingSource.indexOf('\n    showHomeScreen() {'));
        expect(entry).toContain('if (!this.canCommitHatch())');
        expect(entry).toContain('reader.assertCurrent();');
        expect(entry).not.toContain("GameState.set('creature.hatched', false)");
        expect(entry).not.toContain('GameState.save()');
        expect(entry).not.toContain('captureHatchSaveOwner(');
        expect(gameStateSource).toContain('assertHatchIdentityReadable(parsed);');
        expect(gameStateSource).toContain('assertHatchIdentityReadable(this.state);');
    });

    test('persists and resumes an inventory egg reservation', () => {
        expect(inventoryManagerSource).toContain('reserveEggForHatching(');
        expect(gameStateSource).toContain("schemaVersion: 1, status: 'reserved'");
        expect(inventoryManagerSource).toContain('reserveInventoryEggForHatching?.(');
        expect(gameStateSource).toContain('staged.creature.hatchTransaction = transaction;');
        expect(inventorySource).toContain('reserveEggForHatching?.(');
        expect(hatchingSource).toContain("pendingHatch?.status === 'reserved'");
        expect(gameStateSource).toContain("draft.set('creature.hatchTransaction', null)");
        expect(gameStateSource).toContain('draft.state.creature = this.createInitialState().creature;');
        expect(hatchingSource).not.toContain("GameState.set('creature', freshCreature)");
        expect(inventorySource).toContain(
            'const hatchLaunchTimeout = setTimeout(launchReservedHatch, 3000);'
        );
        expect(inventorySource).toContain(
            'this.pendingTimeouts.push(hatchLaunchTimeout);'
        );
        expect(inventorySource).not.toContain(
            "window.GameState?.set('creature.hatched', false)"
        );
        expect(inventorySource).not.toContain(
            "window.GameState?.set('creature.named', false)"
        );
    });
});
