const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const GameStateManager = require('../systems/GameState.js');

// Execute real leaf modules with explicit dependencies, without booting Phaser.
function load(file, names, dependencies = {}) {
    const source = fs.readFileSync(path.join(__dirname, '../systems', file), 'utf8');
    const body = parse(source, {sourceType:'module'}).program.body.map(node => {
        if (node.type === 'ImportDeclaration' || node.type === 'ExportDefaultDeclaration') return '';
        if (node.type === 'ExportNamedDeclaration') return node.declaration ? source.slice(node.declaration.start, node.declaration.end) : '';
        return source.slice(node.start, node.end);
    }).join('\n');
    return new Function('window', ...Object.keys(dependencies), `${body}\nreturn {${names.join(',')}};`)({}, ...Object.values(dependencies));
}
const guardians = load('GuardianOutcomes.js', ['getGuardianOutcomeSnapshot', 'recordGuardianOutcome']);
const ecology = load('CurrentEcology.js', ['recordCurrentRegionRestoration']);
const residents = load('RescuedResidents.js', ['recordRescuedResident', 'getRescuedResidentSnapshot']);
const story = load('ProjectBeaconStory.js', ['queueProjectBeaconDebrief'], {projectBeacon:require('../config/project-beacon.json')});
const ship = load('ShipReconstruction.js', ['getShipReconstructionSnapshot', 'installShipReconstructionStep', 'SHIP_RECONSTRUCTION_STEPS']);
const journey = load('CampaignJourneyGuide.js', ['getCampaignFinaleRecovery'], {getShipReconstructionSnapshot:ship.getShipReconstructionSnapshot,CAMPAIGN_INTENTS:['remain_and_defend','prepare_homecoming','prepare_first_contact']});
const { beginTrumptopusRun: begin, checkpointTrumptopusRun: checkpoint, recordTrumptopusVictory: win, getTrumptopusRun: run } = load('TrumptopusProgress.js', [
    'beginTrumptopusRun','checkpointTrumptopusRun','recordTrumptopusVictory','getTrumptopusRun'
], {bossConfigs:require('../config/bosses.json'),...guardians,...ecology,...residents,...story});

describe('private finale durable victory boundary', () => {
    let state;
    const ready = () => {
        const result = begin(state);
        checkpoint(state,result.run.sequence,1); checkpoint(state,result.run.sequence,2);
        return result.run.sequence;
    };
    const restored = () => {
        const next = new GameStateManager();
        next.commitPreparedSave(next.prepareSaveCandidate(localStorage.getItem(state.saveKey)), {persist:false});
        return next;
    };
    beforeEach(() => {
        localStorage.clear();
        jest.spyOn(console,'log').mockImplementation(() => {});
        jest.spyOn(console,'warn').mockImplementation(() => {});
        state = new GameStateManager();
        state.set('creature.genes',{id:'existing-identity',bodyType:'crystal'});
        state.set('creature.dna',{id:'existing-dna',seed:42});
        state.set('creature.lifecycle.stage','adult');
        state.set('creature.hatched',true);
        state.set('story.projectBeacon.fieldKit.recovered',true);
        for (const step of ship.SHIP_RECONSTRUCTION_STEPS.slice(0,5)) {
            state.set('hubWorld.shipParts.collected',[...(state.get('hubWorld.shipParts.collected') || []),step.partId]);
            ship.installShipReconstructionStep(state,step.id,{save:false});
        }
    });
    afterEach(() => { state.stopAutoSave(); jest.restoreAllMocks(); });

    test('commits reward, victory, Nova and command module in one primary-save write', () => {
        const sequence = ready();
        const writes = [];
        const setItem = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype,'setItem').mockImplementation(function(key,value) {
            if (key === state.saveKey) writes.push(JSON.parse(value));
            return setItem.call(this,key,value);
        });
        const beforeGenes = JSON.stringify(state.get('creature.genes'));
        const result = win(state,{sequence,completionMs:62000});
        expect(result).toMatchObject({changed:true,persisted:true,receipt:{outcome:'banished',coinsAwarded:2500,partAwarded:true,rescuedResidentId:'nova',powerup:{id:'super_blast',queued:false}}});
        expect(writes).toHaveLength(1);
        expect(writes[0].levels.finalVoid.completed).toBe(true);
        expect(writes[0].story.projectBeacon.trumptopus.status).toBe('won');
        expect(writes[0].inventory.items).toEqual([expect.objectContaining({id:'super_blast',quantity:1})]);
        expect(writes[0].hubWorld.shipParts.collected).toContain('command_module');
        expect(state.get('world.antagonistOutcomes.trumptopus.outcome')).toBe('banished');
        expect(guardians.getGuardianOutcomeSnapshot(state).resolved.map(g=>g.guardianId)).not.toContain('void_empress');
        expect(residents.getRescuedResidentSnapshot(state).rescued.map(r=>r.id)).toContain('nova');
        expect(state.get('world.currentEcology.regions.current_heart.evidence')).toBe('antagonist_banished');
        expect(JSON.stringify(state.get('creature.genes'))).toBe(beforeGenes);
        expect(state.get('creature.lifecycle.stage')).toBe('adult');
        expect(state.get('creature.dna.id')).toBe('existing-dna');
    });

    test('refreshing after victory cannot duplicate rewards, even before any presentation', () => {
        const sequence = ready(); win(state,{sequence});
        const next = restored();
        const before = next.createSaveSnapshot();
        expect(win(next,{sequence})).toMatchObject({changed:false,receipt:{id:`trumptopus:${sequence}`}});
        expect(next.createSaveSnapshot()).toEqual(before);
        expect(begin(next).run.status).toBe('won');
        expect(next.get('inventory.items')[0].quantity).toBe(1);
        expect(next.get('player.cosmicCoins')).toBe(2500);
    });

    test.each(['inferred','explicit'])('preserves %s Empress history without recruiting the antagonist', kind => {
        state.set('levels.finalVoid.completed',true);
        if (kind === 'explicit') guardians.recordGuardianOutcome(state,'finalVoid',{outcome:'allied',resolvedAt:'2026-01-02T00:00:00.000Z',save:false});
        const before = guardians.getGuardianOutcomeSnapshot(state).state.records.void_empress;
        const sequence = ready(); win(state,{sequence});
        expect(guardians.getGuardianOutcomeSnapshot(state).state.records.void_empress).toEqual(before);
        expect(guardians.getGuardianOutcomeSnapshot(restored()).state.records.void_empress).toEqual(before);
        expect(guardians.getGuardianOutcomeSnapshot(state).outcomes.find(g=>g.guardianId==='trumptopus')).toBeUndefined();
    });

    test('a full inventory queues one reward and does not discard existing items', () => {
        const items = Array.from({length:30},(_,slot)=>({id:`item_${slot}`,type:'utility',quantity:1,slot}));
        state.set('inventory.items',items);
        const sequence = ready(); const result = win(state,{sequence});
        expect(result.receipt.powerup.queued).toBe(true);
        expect(state.get('inventory.items')).toEqual(items);
        expect(state.get('inventory.pendingBossRewards')).toHaveLength(1);
        const next = restored(); win(next,{sequence});
        expect(next.get('inventory.pendingBossRewards')).toHaveLength(1);
    });

    test('a full inventory with an existing Super Blast stack receives it immediately', () => {
        state.set('inventory.items',Array.from({length:30},(_,slot)=>({id:slot ? `item_${slot}`:'super_blast',type:slot?'utility':'powerup',quantity:2,slot})));
        const result = win(state,{sequence:ready()});
        expect(result.receipt.powerup.queued).toBe(false);
        expect(state.get('inventory.items')[0].quantity).toBe(3);
    });

    test.each(['memory','denied'])('unavailable %s storage retains the whole win in-session without pretending it was saved', kind => {
        const sequence = ready();
        if (kind === 'memory') state.storageMode = 'memory';
        else jest.spyOn(Storage.prototype,'setItem').mockImplementation(() => {throw new DOMException('Denied','SecurityError');});
        expect(win(state,{sequence})).toMatchObject({changed:true,persisted:false});
        expect(state.get('levels.finalVoid.completed')).toBe(true);
        expect(state.get('inventory.items')[0].quantity).toBe(1);
        expect(win(state,{sequence}).changed).toBe(false);
        expect(begin(state).persisted).toBe(false);
        expect(win(state,{sequence}).persisted).toBe(false);
    });

    test('a deliberate new expedition earns one new reward; an old callback cannot finish it', () => {
        const first = ready(); win(state,{sequence:first});
        const second = begin(state,{newExpedition:true}).run.sequence;
        expect(second).toBe(first+1);
        expect(win(state,{sequence:first})).toMatchObject({changed:false,reason:'stale_expedition'});
        checkpoint(state,second,1); checkpoint(state,second,2);
        win(state,{sequence:second});
        expect(state.get('inventory.items')[0].quantity).toBe(2);
        expect(state.get('player.cosmicCoins')).toBe(5000);
        expect(state.get('hubWorld.shipParts.collected').filter(p=>p==='command_module')).toHaveLength(1);
        expect(state.get('stats.levelsCompleted')).toBe(1);
    });

    test('checkpoint refresh restores a phase boundary; unknown versions never overwrite data', () => {
        const sequence = begin(state).run.sequence;
        expect(()=>checkpoint(state,sequence,2)).toThrow('skip');
        checkpoint(state,sequence,1);
        expect(run(restored())).toMatchObject({sequence,phaseIndex:1,status:'fighting'});
        expect(win(state,{sequence})).toMatchObject({changed:false,reason:'final_phase_required'});
        state.set('story.projectBeacon.trumptopus',{schemaVersion:99,sentinel:'keep'});
        expect(()=>begin(state)).toThrow('Unsupported');
        expect(state.get('story.projectBeacon.trumptopus')).toEqual({schemaVersion:99,sentinel:'keep'});
    });

    test('existing final repair leads to the existing ending and preserves an already chosen priority', () => {
        win(state,{sequence:ready()});
        const next = restored();
        expect(journey.getCampaignFinaleRecovery(next)).toMatchObject({status:'repair',repairStepId:'black_box_recovery'});
        expect(ship.installShipReconstructionStep(next,'black_box_recovery',{save:false}).changed).toBe(true);
        expect(journey.getCampaignFinaleRecovery(next)).toMatchObject({status:'ending'});
        next.set('story.projectBeacon.finale.priority','prepare_homecoming');
        next.set('story.projectBeacon.finale.epilogueSeen',true);
        expect(journey.getCampaignFinaleRecovery(next)).toBeNull();
        const prior = next.get('story.projectBeacon.finale');
        const replay = begin(next,{newExpedition:true}).run.sequence;
        checkpoint(next,replay,1); checkpoint(next,replay,2); win(next,{sequence:replay});
        expect(next.get('story.projectBeacon.finale')).toEqual(prior);
        expect(journey.getCampaignFinaleRecovery(next)).toBeNull();
    });

    test('staged snapshot serialization never mutates the current game state', () => {
        const before = JSON.stringify(state.state);
        const draft = JSON.parse(before); draft.player.cosmicCoins = 999;
        const snapshot = state.createSaveSnapshot({state:draft,updatePlayTime:true});
        expect(snapshot.player.cosmicCoins).toBe(999);
        expect(snapshot.session).toEqual({gameStarted:draft.session.gameStarted === true});
        expect(JSON.stringify(state.state)).toBe(before);
    });

    test('snapshot resume marker comes from the staged state, without leaking session fields', () => {
        state.set('session.gameStarted',false);
        const draft = JSON.parse(JSON.stringify(state.state));
        draft.session = {...draft.session,gameStarted:true,privateSessionOnly:'not durable'};
        const snapshot = state.createSaveSnapshot({state:draft});
        expect(snapshot.session).toEqual({gameStarted:true});
        expect(state.get('session.gameStarted')).toBe(false);
        expect(state.createSaveSnapshot().session).toEqual({gameStarted:false});
    });
});
