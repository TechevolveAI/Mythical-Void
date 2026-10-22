const path = require('path');
const fs = require('fs');

const {
    validateFile,
    CRITICAL_PATTERNS,
    PROTECTED_SECTIONS
} = require('../validate-game-flow.js');

describe('game flow integrity validator', () => {
    afterEach(() => jest.restoreAllMocks());

    const root = path.resolve(__dirname, '../..');
    const protectedPath = 'src/scenes/HatchingScene.js';
    const protectedFile = path.join(root, protectedPath);
    const protectedSource = fs.readFileSync(protectedFile, 'utf8');

    test.each(['absolute', 'relative', 'dot-relative', 'normalised-absolute'].flatMap(shape =>
        PROTECTED_SECTIONS[protectedPath].map(marker => [shape, marker])))(
        '%s paths reject a missing review marker: %s', (shape, marker) => {
            const inputs = { absolute: protectedFile, relative: protectedPath,
                'dot-relative': './' + protectedPath,
                'normalised-absolute': root + '/src/scenes/../scenes/HatchingScene.js' };
            const read = fs.readFileSync.bind(fs);
            jest.spyOn(fs, 'readFileSync').mockImplementation((file, ...args) =>
                path.resolve(String(file)) === protectedFile
                    ? protectedSource.replace(marker, '') : read(file, ...args));
            const result = validateFile(inputs[shape], ['HatchCinematics.play']);
            expect(result.valid).toBe(false);
            expect(result.missing).toEqual([`PROTECTION MARKER: ${marker}`]);
        }
    );

    test('the active Start guard follows verified draft publication, not the legacy delay/global-save path', () => {
        const patterns = CRITICAL_PATTERNS[protectedPath];
        expect(patterns).toEqual(expect.arrayContaining([
            "draft.set('session.gameStarted', true);",
            "['creature.hatched', false], ['creature.hatchTransaction', null]",
            'const result = attempt.state.commitHatchSaveDraft(draft.state, {',
            'isCurrentCampaign: attempt.ownsScene,',
            'if (!result.success) return this.recoverOpeningStart(attempt);',
            'if (!attempt.isCurrent()) return false;'
        ]));
        expect(patterns).not.toContain("GameState.set('session.gameStarted', true);");
        expect(patterns).not.toContain('GameState.save();');
        expect(patterns).not.toContain('this.time.delayedCall(100, () => {');
    });

    test.each(Object.entries(CRITICAL_PATTERNS))('CI checks the full declared source contract for %s', (file, patterns) => {
        expect(validateFile(path.join(root, file), patterns)).toEqual(expect.objectContaining({ valid: true, missing: [] }));
    });

    test.each(['declared-policy', 'canonical-policy'])('%s cannot bypass the marker through a path alias', policy => {
        const marker = PROTECTED_SECTIONS[protectedPath][0];
        const alias = path.join(root, 'src/scenes/SyntheticAlias.js');
        const input = policy === 'declared-policy' ? protectedFile : alias;
        const read = fs.readFileSync.bind(fs), real = fs.realpathSync.bind(fs);
        jest.spyOn(fs, 'readFileSync').mockImplementation((file, ...args) =>
            path.resolve(String(file)) === input ? protectedSource.replace(marker, '') : read(file, ...args));
        jest.spyOn(fs, 'realpathSync').mockImplementation((file, ...args) => {
            if (path.resolve(String(file)) === input) {
                return policy === 'declared-policy' ? path.join(root, '../synthetic-external-source.js') : protectedFile;
            }
            return real(file, ...args);
        });
        expect(validateFile(input, ['HatchCinematics.play'])).toEqual(expect.objectContaining({
            valid: false, missing: [`PROTECTION MARKER: ${marker}`]
        }));
    });

    test('an unreadable file remains a failure rather than silently omitting its policy', () => {
        const result = validateFile(path.join(root, 'src/scenes/SyntheticMissingScene.js'), []);
        expect(result.valid).toBe(false);
        expect(result.missing[0]).toMatch(/^FILE ERROR:/);
    });

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
            'gameStarted: currentSession.gameStarted === true || savedJourneyHasStarted',
            'const { updatePlayTime = false, state = this.state } = options;',
            'gameStarted: state.session?.gameStarted === true'
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
