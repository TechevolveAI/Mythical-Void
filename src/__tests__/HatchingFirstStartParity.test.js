const { readPinnedSource } = require('./support/pinnedSourceFixture.cjs');
const vm = require('node:vm');
const path = require('node:path');

const { parse } = require('@babel/parser');
const { fixture, clone } = require('./support/hatchingStartFixture.cjs');
const beforeCommit = '1f7424be1a73f3cfe2e4c17aafa957a6a43a78b7';
const beforeSource = readPinnedSource(`${beforeCommit}:src/scenes/HatchingScene.js`);
const declaration = parse(beforeSource, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
const node = declaration.body.body.find(item => item.key?.name === 'handleStartGame');

describe('Start preserves complete pinned successful data, operation order and clocks', () => {
    const owners = [];
    beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(1700000000777); localStorage.clear(); });
    afterEach(() => {
        for (const f of owners.splice(0)) f.close();
        jest.restoreAllMocks(); jest.useRealTimers(); document.body.replaceChildren();
        delete window.GameState; delete window.CloudSave; delete window.UXEnhancements;
    });

    test.each(['new-player', 'absent-fields', 'roster', 'adult-lineage', 'advanced-journey', 'reservation', 'media'])(
        '%s matches the exact earlier successful save and notification calculation order', mode => {
            const seed = state => {
                state.set('player.cosmicCoins', 77);
                state.set('settings.musicVolume', 0.37);
                state.set('safety.ageGroup', 'child');
                if (mode !== 'new-player') {
                    state.set('creatures', [{ id: 'fictional-roster-1', genes: { id: 'fictional-parent-1' },
                        lifecycle: { stage: 'adult' }, parentIds: ['fictional-ancestor-1', 'fictional-ancestor-2'] },
                    { id: 'fictional-roster-2', genes: { id: 'fictional-parent-2' }, lifecycle: { stage: 'adult' } }]);
                    state.set('activeCreatureIndex', 1);
                }
                if (mode === 'absent-fields') {
                    delete state.state.creature.dna; delete state.state.creature.parentIds;
                    delete state.state.creature.personalityState;
                }
                if (mode === 'adult-lineage' || mode === 'advanced-journey' || mode === 'media') {
                    state.set('creature.hatched', true); state.set('creature.named', true);
                    state.set('creature.name', 'Fictional Earlier Creature');
                    state.set('creature.genes', { id: 'fictional-active-genes', rarity: 'epic' });
                    state.set('creature.dna', { id: 'fictional-active-dna' });
                    state.set('creature.lifecycle.stage', 'adult'); state.set('creature.experience', 450);
                    state.set('creature.parentIds', ['fictional-parent-1', 'fictional-parent-2']);
                    state.set('creature.generation', 3); state.set('creature.isOffspring', true);
                }
                if (mode === 'advanced-journey') {
                    state.recordOpeningMilestone('first_objective_ready');
                    state.set('tutorial.livingFormPending', true); state.set('tutorial.livingFormSeen', true);
                }
                if (mode === 'reservation') state.set('creature.hatchTransaction', { schemaVersion: 1,
                    status: 'reserved', eggType: 'stellar', eggItemId: 'fictional-egg', inventorySlot: 0,
                    reservedAt: 1700000000000, spawnPosition: { x: 0, y: 240 } });
                if (mode === 'media') state.set('creature.portraits', { schemaVersion: 1,
                    byStage: { adult: { assetRef: 'fictional-portrait-ref', storage: 'supabase-private' } } });
            };
            const old = fixture({ seed }); owners.push(old);
            const initial = clone(old.state.state), before = old.snapshot().raw;
            const oldEvents = [];
            for (const event of ['stateChanged', 'openingJourneyAdvanced']) old.state.on(event, data => oldEvents.push({ event, data: clone(data) }));
            jest.setSystemTime(1700000003277);
            const previous = vm.runInNewContext(`({${beforeSource.slice(node.start, node.end)}}).handleStartGame`, {
                getGameState: () => old.state, window, console, Date
            });
            previous.call(old.scene);
            const expected = JSON.parse(old.snapshot().raw), expectedMemory = clone(old.state.state);
            old.close(); localStorage.clear(); jest.setSystemTime(1700000000777);
            const current = fixture({ initialState: initial }); owners.push(current);
            expect(current.snapshot().raw).toBe(before);
            const currentEvents = [];
            for (const event of ['stateChanged', 'openingJourneyAdvanced']) current.state.on(event, data => currentEvents.push({ event, data: clone(data) }));
            jest.setSystemTime(1700000003277); current.release();
            expect(JSON.parse(current.snapshot().raw)).toEqual(expected);
            expect(current.state.state).toEqual(expectedMemory);
            expect(currentEvents).toEqual(oldEvents);
            expect(current.scene.scene.restart).toHaveBeenCalledTimes(1);
            expect(current.scene.scene.start).not.toHaveBeenCalled();
        }
    );
});
