#!/usr/bin/env node
// Read-only source comparison; save writes go to an isolated in-memory store.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {EventEmitter}=require('node:events');
const {parse}=require('@babel/parser');

const BASELINE='fd4f3f18e4390f8e6584732e6626cedc72b431a6';
const root=path.resolve(__dirname,'..');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const quiet={log(){},warn(){},error(){}};
const clone=value=>JSON.parse(JSON.stringify(value));
const local=filename=>fs.readFileSync(path.join(root,filename),'utf8');
const sources=new Map();
function source(filename,baseline=false) {
    const key=`${baseline?'baseline':'candidate'}:${filename}`;
    if(!sources.has(key))sources.set(key,baseline?execFileSync('git',['show',`${BASELINE}:${filename}`],{cwd:root,encoding:'utf8'}):local(filename));
    return sources.get(key);
}

function modules(window,storage) {
    return (filename,names,deps={},baseline=false)=>{
        const code=source(`src/systems/${filename}`,baseline);
        const body=parse(code,{sourceType:'module'}).program.body.map(node=>{
            if(node.type==='ImportDeclaration'||node.type==='ExportDefaultDeclaration')return '';
            if(node.type==='ExportNamedDeclaration')return node.declaration?code.slice(node.declaration.start,node.declaration.end):'';
            return code.slice(node.start,node.end);
        }).join('\n');
        return new Function('window','localStorage','console','module',...Object.keys(deps),`${body}\nreturn {${names.join(',')}};`)(
            window,storage,quiet,{exports:{}},...Object.values(deps));
    };
}

function newStore() {
    const map=new Map();
    return {get length(){return map.size;},getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),
        removeItem:key=>map.delete(key),key:index=>[...map.keys()][index]??null,clear:()=>map.clear()};
}

function createWorld() {
    const window={},storage=newStore(),load=modules(window,storage);
    const current=load('GameState.js',['GameStateManager']);
    const legacy=load('GameState.js',['GameStateManager'],{},true);
    const guardians=load('GuardianOutcomes.js',['getGuardianOutcomeSnapshot','recordGuardianOutcome']);
    const oldGuardians=load('GuardianOutcomes.js',['getGuardianOutcomeSnapshot','recordGuardianOutcome'],{},true);
    const ecology=load('CurrentEcology.js',['recordCurrentRegionRestoration','getCurrentEcologySnapshot']);
    const residents=load('RescuedResidents.js',['recordRescuedResident','getRescuedResidentSnapshot']);
    const story=load('ProjectBeaconStory.js',['queueProjectBeaconDebrief'],{projectBeacon:JSON.parse(local('src/config/project-beacon.json'))});
    const ship=load('ShipReconstruction.js',['SHIP_RECONSTRUCTION_STEPS','getShipReconstructionSnapshot','installShipReconstructionStep']);
    const journey=load('CampaignJourneyGuide.js',['getCampaignFinaleRecovery'],{
        getShipReconstructionSnapshot:ship.getShipReconstructionSnapshot,
        CAMPAIGN_INTENTS:['remain_and_defend','prepare_homecoming','prepare_first_contact']
    },true);
    const approach=load('FinalVoidApproach.js',['validApproachCheckpoint']);
    const progress=load('TrumptopusProgress.js',['beginTrumptopusRun','checkpointTrumptopusRun','checkpointTrumptopusApproach','recordTrumptopusVictory','getTrumptopusRun'],{
        bossConfigs:JSON.parse(local('src/config/bosses.json')),...guardians,...ecology,...residents,...story,...approach
    });
    const Inventory=load('InventoryManager.js',['InventoryManager'],{Phaser:{Events:{EventEmitter}}}).InventoryManager;
    const identity=JSON.parse(local('public/press/gameplay/real-creature-showcase/source-profiles.json')).profiles[1];
    function fresh(Old=current.GameStateManager) {
        const state=new Old();
        state.set('creature.genes',clone(identity.genes));state.set('creature.dna',clone(identity.dna));
        state.set('creature.hatched',true);state.set('creature.lifecycle.stage','juvenile');
        state.set('story.projectBeacon.fieldKit.recovered',true);
        for(const step of ship.SHIP_RECONSTRUCTION_STEPS.slice(0,5)) {
            state.set('hubWorld.shipParts.collected',[...(state.get('hubWorld.shipParts.collected')||[]),step.partId]);
            ship.installShipReconstructionStep(state,step.id,{save:false});
        }
        return state;
    }
    function restore(raw,Old) {
        const state=new Old();state.commitPreparedSave(state.prepareSaveCandidate(raw),{persist:false});return state;
    }
    function summary(state) {
        return clone({run:state.get('story.projectBeacon.trumptopus')||null,antagonist:state.get('world.antagonistOutcomes.trumptopus')||null,
            creature:{genes:state.get('creature.genes'),dna:state.get('creature.dna'),stage:state.get('creature.lifecycle.stage')},
            coins:state.get('player.cosmicCoins'),items:state.get('inventory.items'),pending:state.get('inventory.pendingBossRewards')||[],
            parts:state.get('hubWorld.shipParts'),levels:state.get('levels'),finale:state.get('story.projectBeacon.finale')||null,
            empress:guardians.getGuardianOutcomeSnapshot(state).state.records.void_empress||null,
            residents:residents.getRescuedResidentSnapshot(state).rescued.map(r=>r.id),
            recovery:journey.getCampaignFinaleRecovery(state),ecology:ecology.getCurrentEcologySnapshot(state).state});
    }
    function win(state) {
        const sequence=progress.beginTrumptopusRun(state).run.sequence;
        progress.checkpointTrumptopusRun(state,sequence,1,{elapsedMs:45000,damageTaken:1});
        progress.checkpointTrumptopusRun(state,sequence,2,{elapsedMs:90000,damageTaken:2});
        progress.recordTrumptopusVictory(state,{sequence,completionMs:120000,damageTaken:2});
    }
    function claim(state) {window.GameState=state;const inventory=new Inventory();inventory.initialize();return inventory;}
    return {window,storage,current,legacy,guardians,oldGuardians,ship,progress,fresh,restore,summary,win,claim};
}

function runAudit() {
    const report={sourceCommit:git('rev-parse','HEAD'),sourceDirty:Boolean(git('status','--porcelain')),baselineCommit:BASELINE,
        privateOnly:true,liveEnvironmentInspected:false,playerSavesUsed:false,externalRequests:0,browserRun:false,
        deployed:false,finalArtwork:false,finaleFilmsReady:false,cases:[]};
    const cases=[
        ['legacy-unfinished',w=>w.fresh(w.legacy.GameStateManager)],
        ['approach-checkpoint',w=>{
            const state=w.fresh(),sequence=w.progress.beginTrumptopusRun(state,{withApproach:true}).run.sequence;
            w.progress.checkpointTrumptopusApproach(state,sequence,{schemaVersion:1,clearedGrips:1,arrived:false},{elapsedMs:45000,damageTaken:1});return state;
        }],
        ['fight-phase-two',w=>{
            const state=w.fresh(),sequence=w.progress.beginTrumptopusRun(state).run.sequence;
            w.progress.checkpointTrumptopusRun(state,sequence,1,{elapsedMs:90000,damageTaken:2});return state;
        }],
        ['victory-before-repair',w=>{const state=w.fresh();w.win(state);return state;}],
        ['victory-queued-reward',w=>{
            const state=w.fresh();state.set('inventory.items',Array.from({length:30},(_,slot)=>({id:`egg_${slot}`,name:'Egg',type:'egg',quantity:1,slot})));
            w.win(state);return state;
        }],
        ...['inferred','explicit'].map(history=>[`legacy-empress-${history}`,w=>{
            const state=w.fresh(w.legacy.GameStateManager);state.set('levels.finalVoid.completed',true);
            if(history==='explicit')w.oldGuardians.recordGuardianOutcome(state,'finalVoid',{outcome:'allied',resolvedAt:'2026-01-02T00:00:00.000Z',save:false});
            const previous=w.oldGuardians.getGuardianOutcomeSnapshot(state).state.records.void_empress;
            const next=w.restore(state.createSaveSnapshot(),w.current.GameStateManager);w.win(next);
            assert.deepEqual(w.guardians.getGuardianOutcomeSnapshot(next).state.records.void_empress,previous);return next;
        }]),
        ...['remain_and_defend','prepare_homecoming','prepare_first_contact'].map(priority=>[`ending-${priority}`,w=>{
            const state=w.fresh();w.win(state);w.ship.installShipReconstructionStep(state,'black_box_recovery',{save:false});
            state.set('story.projectBeacon.finale.priority',priority);state.set('story.projectBeacon.finale.epilogueSeen',true);
            // Canonicalize the fixture with today's reader before testing the old reader.
            // Setting only priority leaves its sharedOutcome intentionally incomplete.
            return w.restore(state.createSaveSnapshot(),w.current.GameStateManager);
        }]),
        ['future-run-schema',w=>{const state=w.fresh();state.set('story.projectBeacon.trumptopus',{schemaVersion:99,sentinel:'preserve-for-newer-reader'});return state;}]
    ];
    for(const [name,make] of cases) {
        const w=createWorld(),candidate=make(w),before=w.summary(candidate);
        const raw=candidate.createSaveSnapshot();
        const rollback=w.restore(raw,w.legacy.GameStateManager);
        assert.deepEqual(w.summary(rollback),before,`${name}: older reader altered protected state`);
        // This is the unchanged legacy save writer, paired with the retained outcome reader.
        assert.equal(rollback.save(),true);
        const restored=w.restore(w.storage.getItem(rollback.saveKey),w.current.GameStateManager);
        assert.deepEqual(w.summary(restored),before,`${name}: round trip altered protected state`);
        let rewardRecovery=null;
        if(name==='victory-queued-reward') {
            const inventory=w.claim(rollback);inventory.removeItem(2);
            const next=w.restore(w.storage.getItem(rollback.saveKey),w.current.GameStateManager);
            assert.equal(next.get('inventory.items').find(item=>item.id==='super_blast').quantity,1);
            assert.deepEqual(next.get('inventory.pendingBossRewards'),[]);
            assert.deepEqual(w.progress.getTrumptopusRun(next),before.run);
            assert.equal(next.get('player.cosmicCoins'),before.coins);
            rewardRecovery={quantity:1,pending:0,receiptPreserved:true};
        }
        if(name==='future-run-schema')assert.throws(()=>w.progress.getTrumptopusRun(restored),/Unsupported/);
        else if(before.run)assert.deepEqual(w.progress.getTrumptopusRun(restored),before.run);
        const rawLegacyEmpress=w.oldGuardians.getGuardianOutcomeSnapshot(rollback).state.records.void_empress||null;
        if(name==='victory-before-repair') {
            assert.equal(before.empress,null);
            assert.equal(rawLegacyEmpress.outcome,'restored');
            report.rawBaselineControl={acceptedSave:true,incorrectlyInfersEmpress:true,acceptableRollback:false};
            // A genuine earlier-Guardian update must not materialize the false final record in the safe target.
            w.guardians.recordGuardianOutcome(rollback,'mythicalForest',{save:false});
            assert.equal(w.guardians.getGuardianOutcomeSnapshot(rollback).state.records.void_empress,undefined);
        }
        report.cases.push({name,passed:true,protectedStateSha256:hash(JSON.stringify(before)),
            oldReaderLoaded:true,oldWriterSaved:true,currentReaderRestored:true,empress:before.empress,recovery:before.recovery,rewardRecovery,
            runSchema:before.run?.schemaVersion||null,runStatus:before.run?.status||null});
    }
    const unchanged=['src/game.js','src/utils/SceneLoader.js','src/scenes/levels/FinalVoidLevel.js',
        'src/scenes/VictoryScene.js','src/systems/ShipReconstruction.js','src/systems/CampaignJourneyGuide.js'];
    for(const file of unchanged)assert.equal(hash(source(file)),hash(source(file,true)),`${file} changed from the legacy route`);
    report.legacyRouteFilesUnchanged=unchanged;
    const manifest=JSON.parse(local('src/config/final-void-films.json'));
    assert.equal(manifest.enabled,false);assert(!Object.values(manifest.films).some(film=>film.approved));
    report.retainedCompatibilityFiles=['src/systems/GuardianOutcomes.js','src/systems/InventoryManager.js','src/systems/GameState.js','src/systems/CurrentEcology.js'];
    report.sourceModules=[...sources.entries()].map(([file,contents])=>({file,sha256:hash(contents)}));
    report.supportedRollback='Legacy encounter with retained compatibility helpers, not the bare historical artifact';
    report.passed=true;return report;
}

if(require.main===module) {
    try {
        const report=runAudit(),output=path.join(root,'.visual-review/trumptopus-rollback');
        fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
        console.log(JSON.stringify({passed:report.passed,sourceCommit:report.sourceCommit,baselineCommit:BASELINE,
            cases:report.cases.map(c=>c.name),rawBaselineControl:report.rawBaselineControl,output},null,2));
    } catch(error) {console.error(error);process.exitCode=1;}
}
module.exports={runAudit,BASELINE};
