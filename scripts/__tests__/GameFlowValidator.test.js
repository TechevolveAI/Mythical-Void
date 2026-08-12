const path = require('path');

const {
    validateFile,
    CRITICAL_PATTERNS
} = require('../validate-game-flow.js');

describe('game flow integrity validator', () => {
    test('protects the current transactional save and resume contract', () => {
        const gameStatePath = 'src/systems/GameState.js';
        const patterns = CRITICAL_PATTERNS[gameStatePath];
        const result = validateFile(
            path.join(process.cwd(), gameStatePath),
            patterns
        );

        expect(patterns).toEqual(expect.arrayContaining([
            'const prepared = this.prepareSaveCandidate(saveData);',
            'this.commitPreparedSave(prepared, {',
            'gameStarted: currentSession.gameStarted === true || savedJourneyHasStarted'
        ]));
        expect(patterns).not.toContain(
            'this.state = this.deepMerge(this.state, migrated);'
        );
        expect(result).toEqual(expect.objectContaining({
            valid: true,
            missing: []
        }));
    });
});
