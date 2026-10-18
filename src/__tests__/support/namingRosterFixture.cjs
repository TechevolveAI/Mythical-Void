const { fixture } = require('./soulNamingFixture.cjs');
const CreatureGenetics = require('../../systems/CreatureGenetics.js');
const { FusionAuthority } = require('../../systems/FusionAuthority.js');
const clone = value => JSON.parse(JSON.stringify(value));

function namingRosterFixture(seed = () => {}, { inventory = false, beforeHatch = () => {} } = {}) {
    const f = fixture();
    f.state.set('creature', f.state.createInitialState().creature);
    expect(f.state.save()).toBe(true);
    beforeHatch(f);
    const generator = new CreatureGenetics({
        random: new FusionAuthority().createSeededRandom('fictional-naming-roster'),
        creation: { now: () => 1700000000777, nextGeneticId: () => 'fictional-full-generated-genes', emit() {} }
    });
    generator.initialize();
    const genes = generator.generateCreatureGenetics('rare');
    const dna = { id: 'fictional-full-generated-dna', bodyArchetype: 'luminous', raritySignature: 'rare' };
    let reservation = null;
    if (inventory) {
        const previous = { ...clone(f.state.createInitialState().creature), id: 'fictional-previous-record',
            name: 'Fictional previous creature', named: true, hatched: true, level: 3, experience: 250,
            genes: { ...clone(genes), id: 'fictional-previous-genes' },
            dna: { ...clone(dna), id: 'fictional-previous-dna' } };
        previous.bond.experience = 17;
        f.state.set('creatures', [clone(previous)]);
        f.state.set('creature', previous);
        reservation = { schemaVersion: 1, status: 'reserved', eggType: 'stellar',
            eggItemId: 'fictional-reserved-egg', inventorySlot: 0,
            spawnPosition: { x: 0, y: 240 }, reservedAt: Date.now() };
        f.state.set('creature.hatchTransaction', reservation);
        f.state.state = f.state.prepareSaveCandidate(f.state.createSaveSnapshot()).state;
        expect(f.state.save()).toBe(true);
    }
    expect(f.state.commitCreatureHatch({ genetics: genes, dna,
        personalityState: { curiosity: 4 }, descriptiveName: 'Fictional Alien Hatchling',
        textureName: 'fictional-generated-texture' }, {
        isInventoryHatch: inventory, expectedReservation: reservation,
        expectedActiveIdentity: f.state.getHatchActiveIdentity()
    }).success).toBe(true);
    seed(f.state);
    expect(f.state.save()).toBe(true);
    return { ...f, genes, dna };
}

module.exports = { namingRosterFixture, clone };
