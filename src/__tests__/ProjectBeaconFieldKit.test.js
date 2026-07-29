const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadFieldKitSystem() {
    const filePath = path.join(__dirname, '../systems/ProjectBeaconFieldKit.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .concat(
            '\nmodule.exports = {' +
            ' PROJECT_BEACON_FIELD_KIT,' +
            ' PROJECT_BEACON_KATANA_UPGRADES,' +
            ' recoverProjectBeaconFieldKit,' +
            ' installProjectBeaconKatanaUpgrade,' +
            ' getProjectBeaconKatanaUpgradeIds,' +
            ' getProjectBeaconKatanaCombatProfile };'
        );
    const sandbox = {
        module: { exports: {} },
        exports: {},
        Date,
        Object,
        Array,
        Set
    };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createGameState(fieldKit = {}) {
    const state = {
        story: {
            projectBeacon: {
                fieldKit
            }
        }
    };

    return {
        state,
        get: jest.fn((propertyPath) => (
            propertyPath.split('.').reduce((value, key) => value?.[key], state)
        )),
        set: jest.fn((propertyPath, value) => {
            state.story.projectBeacon.fieldKit = value;
        }),
        emit: jest.fn(),
        save: jest.fn()
    };
}

describe('Project Beacon field kit', () => {
    const recoveredAt = '2026-07-26T19:30:00.000Z';

    test('records the Earth-forged katana and emits a single recovery event', () => {
        const { recoverProjectBeaconFieldKit } = loadFieldKitSystem();
        const gameState = createGameState({
            recovered: false,
            katana: { installedUpgrades: [] }
        });

        const result = recoverProjectBeaconFieldKit(gameState, { recoveredAt });

        expect(result.changed).toBe(true);
        expect(result.fieldKit).toEqual(expect.objectContaining({
            id: 'wanderer_7_field_kit',
            recovered: true,
            recoveredAt
        }));
        expect(result.fieldKit.katana).toEqual(expect.objectContaining({
            id: 'earth_field_katana',
            material: 'Titanium-ceramic laminate',
            configuration: 'earth_forged',
            upgradeSlots: 2,
            installedUpgrades: []
        }));
        expect(gameState.emit).toHaveBeenCalledWith(
            'projectBeaconFieldKitRecovered',
            { fieldKit: result.fieldKit }
        );
        expect(gameState.save).toHaveBeenCalledTimes(1);
    });

    test('is idempotent when the kit was already recovered', () => {
        const { recoverProjectBeaconFieldKit } = loadFieldKitSystem();
        const existing = {
            recovered: true,
            recoveredAt,
            katana: { configuration: 'earth_forged' }
        };
        const gameState = createGameState(existing);

        const result = recoverProjectBeaconFieldKit(gameState, {
            recoveredAt: '2026-07-27T00:00:00.000Z'
        });

        expect(result).toEqual({ changed: false, fieldKit: existing });
        expect(gameState.set).not.toHaveBeenCalled();
        expect(gameState.emit).not.toHaveBeenCalled();
        expect(gameState.save).not.toHaveBeenCalled();
    });

    test('preserves creature-tech upgrades already present in migrated saves', () => {
        const { recoverProjectBeaconFieldKit } = loadFieldKitSystem();
        const installedUpgrades = [{ id: 'legacy_resonance' }];
        const gameState = createGameState({
            recovered: false,
            katana: { installedUpgrades }
        });

        const result = recoverProjectBeaconFieldKit(gameState, { recoveredAt });

        expect(result.fieldKit.katana.installedUpgrades).toEqual(installedUpgrades);
    });

    test('installs each earned creature-tech upgrade once within two slots', () => {
        const {
            installProjectBeaconKatanaUpgrade
        } = loadFieldKitSystem();
        const gameState = createGameState({
            recovered: true,
            katana: {
                upgradeSlots: 2,
                installedUpgrades: []
            }
        });

        const edge = installProjectBeaconKatanaUpgrade(
            gameState,
            'crystal_edge',
            { installedAt: recoveredAt }
        );
        const duplicate = installProjectBeaconKatanaUpgrade(
            gameState,
            'crystal_edge'
        );
        const guard = installProjectBeaconKatanaUpgrade(
            gameState,
            'aurora_guard'
        );

        expect(edge.changed).toBe(true);
        expect(edge.installedUpgrade).toEqual(expect.objectContaining({
            id: 'crystal_edge',
            name: 'Resonant Edge',
            installedAt: recoveredAt
        }));
        expect(duplicate).toEqual(expect.objectContaining({
            changed: false,
            reason: 'already_installed'
        }));
        expect(guard.changed).toBe(true);
        expect(gameState.state.story.projectBeacon.fieldKit.katana).toEqual(
            expect.objectContaining({
                configuration: 'creature_tech_adapted',
                installedUpgrades: [
                    expect.objectContaining({ id: 'crystal_edge' }),
                    expect.objectContaining({ id: 'aurora_guard' })
                ]
            })
        );
        expect(gameState.emit).toHaveBeenCalledTimes(2);
        expect(gameState.save).toHaveBeenCalledTimes(2);
    });

    test('derives combat effects from string and object save formats', () => {
        const {
            getProjectBeaconKatanaCombatProfile
        } = loadFieldKitSystem();
        const gameState = createGameState({
            recovered: true,
            katana: {
                installedUpgrades: [
                    'crystal_edge',
                    { id: 'aurora_guard' },
                    { id: 'unknown_legacy_upgrade' }
                ]
            }
        });

        expect(getProjectBeaconKatanaCombatProfile(gameState)).toEqual({
            upgradeIds: ['crystal_edge', 'aurora_guard'],
            meleeDamage: 3,
            enemyMeleeRange: 85,
            bossMeleeRange: 95,
            slashColor: 0x8FE3CF,
            slashGlowColor: 0x66C7D4,
            guardCharges: 1
        });
    });

    test('does not install upgrades before the field kit is recovered', () => {
        const {
            installProjectBeaconKatanaUpgrade
        } = loadFieldKitSystem();
        const gameState = createGameState({
            recovered: false,
            katana: { installedUpgrades: [] }
        });

        expect(
            installProjectBeaconKatanaUpgrade(gameState, 'crystal_edge')
        ).toEqual(expect.objectContaining({
            changed: false,
            reason: 'field_kit_missing'
        }));
        expect(gameState.set).not.toHaveBeenCalled();
        expect(gameState.save).not.toHaveBeenCalled();
    });
});
