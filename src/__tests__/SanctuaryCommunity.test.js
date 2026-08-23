const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadSanctuaryCommunity({ guardianSnapshot, rescuedSnapshot }) {
    const filePath = path.join(__dirname, '../systems/SanctuaryCommunity.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            "import { getGuardianOutcomeSnapshot } from './GuardianOutcomes.js';",
            'const getGuardianOutcomeSnapshot = GET_GUARDIAN_SNAPSHOT;'
        )
        .replace(
            "import { getRescuedResidentSnapshot } from './RescuedResidents.js';",
            'const getRescuedResidentSnapshot = GET_RESCUED_SNAPSHOT;'
        )
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .replace(/if \(typeof window !== 'undefined'\) \{[\s\S]*$/, '')
        .concat('module.exports = { getSanctuaryCommunitySnapshot };');
    const sandbox = {
        module: { exports: {} },
        exports: {},
        GET_GUARDIAN_SNAPSHOT: () => guardianSnapshot,
        GET_RESCUED_SNAPSHOT: () => rescuedSnapshot,
        Set,
        Object,
        Array
    };
    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

describe('SanctuaryCommunity', () => {
    test('separates the player companion, rescued residents, and regional Guardians', () => {
        const community = loadSanctuaryCommunity({
            guardianSnapshot: {
                regionalAllies: [
                    { guardianId: 'elder_treant', standing: 'regional_ally' },
                    { guardianId: 'crystal_golem', standing: 'regional_guardian' }
                ],
                sanctuaryPresences: [
                    { guardianId: 'elder_treant', sanctuaryPresence: 'heart_projection' }
                ],
                outcomes: [],
                totalGuardians: 6
            },
            rescuedSnapshot: {
                totalResidents: 6,
                rescued: [{
                    id: 'bloom',
                    name: 'Bloom',
                    residencyStatus: 'resident'
                }]
            }
        });
        const gameState = {
            getActiveCreature: () => ({ id: 'pop', name: 'Pop' }),
            get: pathName => pathName === 'creatures'
                ? [{ id: 'pop', name: 'Pop' }]
                : null
        };
        const snapshot = community.getSanctuaryCommunitySnapshot(gameState);

        expect(snapshot.playerCompanion).toMatchObject({
            id: 'pop',
            communityType: 'player_companion'
        });
        expect(snapshot.residents).toEqual([
            expect.objectContaining({
                id: 'bloom',
                communityType: 'rescued_resident'
            })
        ]);
        expect(snapshot.guardianPresences.map(entry => entry.guardianId))
            .toEqual(['elder_treant']);
        expect(snapshot.counts).toEqual({
            companions: 1,
            residents: 1,
            regionalAllies: 2,
            guardianPresences: 1
        });
        expect(snapshot.totals).toEqual({ residents: 6, guardians: 6 });
    });
});
