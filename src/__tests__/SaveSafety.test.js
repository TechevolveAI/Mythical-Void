const fs = require('fs');
const path = require('path');
const GameStateManager = require('../systems/GameState.js');

describe('local save safety and recovery', () => {
    let manager;

    beforeEach(() => {
        localStorage.clear();
        manager = new GameStateManager();
    });

    afterEach(() => {
        manager.stopAutoSave();
        jest.restoreAllMocks();
    });

    test('migrates an older save before replacing it and retains a recovery copy', () => {
        const olderSave = JSON.stringify({
            version: '1.0.0',
            savedAt: 23,
            player: { name: 'Wanderer' },
            creature: { hatched: true, name: 'Aster' }
        });
        localStorage.setItem(manager.saveKey, olderSave);

        expect(manager.load()).toBe(true);
        expect(manager.get('creature.name')).toBe('Aster');

        const persisted = JSON.parse(localStorage.getItem(manager.saveKey));
        expect(persisted.version).toBe(manager.gameVersion);
        expect(persisted.session).toEqual({ gameStarted: true });

        const [backup] = manager.getLocalSaveBackups();
        expect(backup).toEqual(expect.objectContaining({
            reason: 'before_automatic_migration',
            sourceVersion: '1.0.0',
            sourceSavedAt: 23
        }));
    });

    test('failed migration keeps active state and the original stored save', () => {
        manager.set('creature.name', 'Current Companion');
        const olderSave = JSON.stringify({
            version: '1.0.0',
            savedAt: 50,
            creature: { hatched: true, name: 'Earlier Companion' }
        });
        localStorage.setItem(manager.saveKey, olderSave);
        jest.spyOn(manager, 'migrateSaveData').mockImplementation(() => {
            throw new Error('migration fixture failed');
        });

        expect(manager.load()).toBe(false);
        expect(manager.get('creature.name')).toBe('Current Companion');
        expect(localStorage.getItem(manager.saveKey)).toBe(olderSave);
        expect(manager.getLocalSaveBackups()[0]).toEqual(
            expect.objectContaining({ reason: 'migration_failed' })
        );
    });

    test('corrupted primary data is quarantined without destroying a valid recovery save', () => {
        manager.set('creature.name', 'Aster');
        expect(manager.save()).toBe(true);
        manager.set('player.cosmicCoins', 23);
        expect(manager.save()).toBe(true);
        const validBackup = manager.getLocalSaveBackups()[0];

        localStorage.setItem(manager.saveKey, '{not-json');
        manager.set('creature.name', 'Current Session');

        expect(manager.load()).toBe(false);
        expect(manager.get('creature.name')).toBe('Current Session');
        expect(localStorage.getItem(manager.saveKey)).toBeNull();
        expect(manager.getLocalSaveBackups()).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: validBackup.id }),
                expect.objectContaining({ reason: 'corrupted' })
            ])
        );

        expect(manager.restoreLocalSaveBackup(validBackup.id)).toBe(true);
        expect(manager.get('creature.name')).toBe('Aster');
        expect(JSON.parse(localStorage.getItem(manager.saveKey)).creature.name).toBe('Aster');
    });

    test('manual backup restore is transactional and backs up current progress first', () => {
        manager.set('creature.name', 'Aster');
        expect(manager.save()).toBe(true);
        manager.set('creature.name', 'Nova');
        expect(manager.save()).toBe(true);
        const previousSave = manager.getLocalSaveBackups()[0];

        expect(manager.restoreLocalSaveBackup(previousSave.id)).toBe(true);
        expect(manager.get('creature.name')).toBe('Aster');
        expect(JSON.parse(localStorage.getItem(manager.saveKey)).creature.name).toBe('Aster');
        expect(manager.getLocalSaveBackups()[0]).toEqual(
            expect.objectContaining({ reason: 'before_manual_backup_restore' })
        );
    });

    test('rotates the oldest recovery copy before allocating another full save', () => {
        const backups = ['first', 'second', 'third'].map(name => (
            manager.createLocalSaveBackup({
                version: manager.gameVersion,
                savedAt: Date.now(),
                creature: { name }
            }, name)
        ));
        const oldestKey = `${manager.saveBackupKeyPrefix}${backups[0].id}`;

        const newest = manager.createLocalSaveBackup({
            version: manager.gameVersion,
            savedAt: Date.now(),
            creature: { name: 'fourth' }
        }, 'fourth');

        expect(newest).not.toBeNull();
        expect(manager.getLocalSaveBackups()).toHaveLength(3);
        expect(localStorage.getItem(oldestKey)).toBeNull();
        expect(manager.getLocalSaveBackups()[0].id).toBe(newest.id);
    });

    test('failed external restore leaves both current memory and storage untouched', () => {
        manager.set('creature.name', 'Aster');
        expect(manager.save()).toBe(true);
        const currentRaw = localStorage.getItem(manager.saveKey);
        jest.spyOn(manager, 'migrateSaveData').mockImplementation(() => {
            throw new Error('cloud migration fixture failed');
        });

        expect(manager.applyExternalSave({
            version: '1.0.0',
            creature: { name: 'Remote' }
        }, { source: 'cloud', persist: true })).toBe(false);
        expect(manager.get('creature.name')).toBe('Aster');
        expect(localStorage.getItem(manager.saveKey)).toBe(currentRaw);
    });

    test('save settings exposes an explicit local recovery confirmation', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../ui/CloudSaveSettingsModal.js'),
            'utf8'
        );

        expect(source).toContain('Restore Previous Save');
        expect(source).toContain('restoreLocalSaveBackup');
        expect(source).toContain('A safety copy of your current progress will be made first');
        expect(source).toContain('Current progress was not changed');
    });
});
