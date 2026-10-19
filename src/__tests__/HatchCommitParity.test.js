const { readPinnedSource } = require('./support/pinnedSourceFixture.cjs');
const path = require('path');
const vm = require('vm');

const { parse } = require('@babel/parser');
const GameStateManager = require('../systems/GameState.js');

const beforeCommit = '12e4d9781c45cfc7c98b1ca0382f26774e981a9e';
const beforeSource = readPinnedSource(`${beforeCommit}:src/scenes/HatchingScene.js`);
const declaration = parse(beforeSource, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
const node = declaration.body.body.find(item => item.key?.name === 'saveCreatureGenetics');
const clone = value => JSON.parse(JSON.stringify(value));

function initial(mode, experience) {
    const state = new GameStateManager();
    state.set('session.gameStarted', true);
    state.set('creature.experience', experience);
    state.set('creatures', [{ id: 'fictional-roster-a', genes: { id: 'fictional-roster-genes-a' } },
        { id: 'fictional-roster-b', genes: { id: 'fictional-roster-genes-b' } }]);
    if (mode === 'inventory') {
        state.set('creature.hatched', true);
        state.set('creature.named', true);
        state.set('creature.name', 'Fictional earlier creature');
        state.set('creature.genes', { id: 'fictional-prior-genes' });
        state.set('creature.lifecycle.stage', 'adult');
        state.set('creature.hatchTransaction', { schemaVersion: 1, status: 'reserved',
            eggItemId: 'fictional-egg', eggType: 'stellar', inventorySlot: 2,
            spawnPosition: { x: 0, y: 240 }, reservedAt: Date.now() - 100 });
        state.set('tutorial.livingFormPending', true);
        state.set('tutorial.livingFormSeen', true);
    } else if (mode === 'reroll') {
        state.set('creature.hatched', true);
        state.set('creature.genes', { id: 'fictional-prior-reroll-genes' });
        state.set('creature.hatchTime', Date.now() - 1000);
        state.set('creature.lifecycle.birthDate', Date.now() - 1000);
    }
    state.state = state.prepareSaveCandidate(state.createSaveSnapshot()).state;
    expect(state.save()).toBe(true);
    return state;
}

describe('the hatch safety repair retains pinned existing successful payload semantics', () => {
    beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(1700000000777); localStorage.clear(); });
    afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

    test.each([
        { mode: 'opening', experience: 0, dna: true },
        { mode: 'inventory', experience: 250, dna: true },
        { mode: 'reroll', experience: 50, dna: true },
        { mode: 'opening', experience: 0, dna: false },
        { mode: 'opening', experience: 95, dna: true },
        { mode: 'opening', experience: 450, dna: true }
    ])('$mode / XP $experience / DNA $dna matches the pinned successful final save', ({ mode, experience, dna }) => {
        const profile = { genetics: { id: 'fictional-hatch-genes', species: 'nebulaSprite', rarity: 'rare',
            personality: { core: 'curious' }, cosmicAffinity: { element: 'nebula' },
            traits: { bodyShape: { type: 'slender' }, features: {}, colorGenome: { primary: 0x8357b5 } } },
            dna: dna ? { id: 'fictional-hatch-dna', bodyArchetype: 'luminous' } : undefined,
            personalityState: dna ? { curiosity: 4 } : undefined, pitySystem: { hatchesSinceEpic: 1 },
            descriptiveName: 'Nebula Explorer Sprite', textureName: 'fictional-hatch-texture',
            spawnPosition: { x: 0, y: 240 } };
        const old = initial(mode, experience);
        const baseline = clone(old.state);
        const reservation = clone(old.get('creature.hatchTransaction'));
        if (mode === 'inventory') {
            const fresh = old.createInitialState().creature;
            fresh.hatchTransaction = reservation; fresh.spawnPosition = profile.spawnPosition;
            old.set('creature', fresh);
            old.set('tutorial.livingFormPending', false); old.set('tutorial.livingFormSeen', false);
        }
        if (dna) {
            old.set('creature.dna', profile.dna);
            old.set('creature.personalityState', profile.personalityState);
        }
        old.set('pitySystem', profile.pitySystem);
        const oldSave = vm.runInNewContext(`({${beforeSource.slice(node.start, node.end)}}).saveCreatureGenetics`, {
            getGameState: () => old, console
        });
        oldSave.call({ creatureGenetics: profile.genetics, creature: { texture: { key: profile.textureName } },
            generateCreatureName: () => profile.descriptiveName,
            showCriticalError: () => { throw Error('Pinned successful hatch unexpectedly failed'); } });
        const expected = JSON.parse(localStorage.getItem(old.saveKey));

        localStorage.clear();
        const current = new GameStateManager(); current.state = clone(baseline);
        expect(current.save()).toBe(true);
        expect(current.commitCreatureHatch(clone(profile), {
            isInventoryHatch: mode === 'inventory', expectedReservation: reservation
        }).success).toBe(true);
        expect(JSON.parse(localStorage.getItem(current.saveKey))).toEqual(expected);
        expect(current.createSaveSnapshot()).toEqual(old.createSaveSnapshot());
    });
});
