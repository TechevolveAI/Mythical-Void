const assert = require('node:assert/strict');
const path = require('node:path');

function seedPriorCampaignRoutes(state,routes) {
    if(routes.at(-1)?.levelStateId!=='finalVoid')throw new Error('Ending fixture requires the canonical final route');
    const prior=routes.slice(0,-1);
    for(const route of prior)state.set('levels.'+route.levelStateId+'.completed',true);
    state.set('stats.levelsCompleted',prior.length);
}

function createCampaignProofHtml({approach = false, arrivalFixture = null, seededVictory = false} = {}) {
    assert(!(approach&&seededVictory),'Seeded ending proof must not imply approach gameplay');
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Private finale campaign proof</title>
    <style>html,body{margin:0;overflow:hidden;background:#15191c;color:#eee;font:12px Arial}header{height:42px;box-sizing:border-box;padding:0 8px;display:flex;align-items:center;justify-content:space-between}button{height:34px;min-width:56px;border:1px solid #687775;background:#273034;color:white}canvas{display:block;touch-action:none}#paused{position:fixed;inset:45% 20% auto;z-index:3;background:#192423;padding:20px;text-align:center}#paused[hidden]{display:none}</style>
    </head><body><header><span>${seededVictory?'PRIVATE / ENDING FIXTURE':'PRIVATE / TEMPORARY BOSS ART'}</span><span><button id="pause">Pause</button> <button id="retry">Retry</button></span></header><div id="game"></div><div id="paused" hidden>Paused</div>
    <script type="module">
    const {Phaser}=await import('/src/global-init.js');
    const {default:Preview}=await import('/src/dev/TrumptopusCampaignPreview.js');
    ${approach ? "const {default:Approach}=await import('/src/dev/TrumptopusApproachPreview.js');" : ''}
    ${arrivalFixture ? `
    const {FinaleFilms}=await import('/src/systems/FinaleFilms.js');
    const {PreparedFilm}=await import('/src/systems/PreparedFilm.js');
    const {beginTrumptopusRun,checkpointTrumptopusApproach}=await import('/src/systems/TrumptopusProgress.js');
    const fixtureParams=new URLSearchParams(location.search);
    window.arrivalFixtureFetches=0;
    class ArrivalApproach extends Approach {
        createEncounter(data) {
            const encounter=super.createEncounter(data);
            if(fixtureParams.has('boundary'))this.spawnX=2650;
            return encounter;
        }
        createFinaleFilms() {
            let failOnce=fixtureParams.has('failed');
            const config={enabled:!fixtureParams.has('absent'),encounterId:'trumptopus',films:{arrival:{approved:true,
                title:'Playback fixture: existing Forest film',asset:${JSON.stringify(arrivalFixture)}}}};
            return new FinaleFilms(this,{encounterId:'trumptopus',config,createFilm:asset=>{
                const film=new PreparedFilm(asset,{fetch:(...args)=>{
                    window.arrivalFixtureFetches++;
                    if(failOnce){failOnce=false;return Promise.reject(Error('injected_offline'));}
                    if(fixtureParams.has('delayed'))return new Promise((resolve,reject)=>{
                        const signal=args[1]?.signal;
                        signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
                        window.releaseArrivalFixture=()=>{if(!signal?.aborted)resolve(fetch(...args));};
                    });
                    return fetch(...args);
                }});
                window.arrivalFixtureFilm=film;return film;
            }});
        }
    }` : ''}
    const {default:GameScene}=await import('/src/scenes/GameScene.js');
    const {default:VictoryScene}=await import('/src/scenes/VictoryScene.js');
    const {default:HubWorldScene}=await import('/src/scenes/HubWorldScene.js');
    const {SHIP_RECONSTRUCTION_STEPS,installShipReconstructionStep}=await import('/src/systems/ShipReconstruction.js');
    const {CAMPAIGN_ROUTE}=await import('/src/systems/CampaignJourneyGuide.js');
    ${seedPriorCampaignRoutes.toString()}
    await window.envLoader.load();await window.APIConfig.initialize();
    window.AudioManager.muted=true;
    const state=window.GameState;
    state.saveKey='private_trumptopus_campaign';state.saveBackupKeyPrefix='private_campaign_backup_';state.saveBackupIndexKey='private_campaign_backups';
    const saved=localStorage.getItem(state.saveKey);
    if(saved)state.commitPreparedSave(state.prepareSaveCandidate(saved),{persist:false});
    else {
        const profile=(await(await fetch('/press/gameplay/real-creature-showcase/source-profiles.json')).json()).profiles[1];
        const evolution=(await(await fetch('/src/config/evolution.json')).json());
        const creature={...state.get('creature'),id:profile.genes.id,name:'Aster',genes:profile.genes,dna:profile.dna,hatched:true,named:true,
            lifecycle:{...state.get('creature.lifecycle'),stage:'juvenile',birthDate:Date.now()-evolution.stages.juvenile.daysRequired*86400000}};
        state.set('creature',creature);state.set('creatures',[creature]);state.set('activeCreatureIndex',0);
        state.set('settings.audioMuted',true);state.set('session.gameStarted',true);
        state.set('tutorial.livingFormSeen',true);state.set('tutorial.livingFormPending',false);
        state.set('world.currentPosition',{x:1200,y:900});
        state.set('story.projectBeacon.fieldKit.recovered',true);
        state.set('story.projectBeacon.pendingDebriefs',[]);
        state.set('story.projectBeacon.debriefsSeen',[1,2,3,4,5].map(n=>'beacon_debrief_'+n));
        state.set('story.projectBeacon.firstExpeditionDrill',{completed:true});
        state.set('story.projectBeacon.firstForestCinematicVersion',2);
        state.set('hubWorld.shipCompletionCutsceneShown',true);
        seedPriorCampaignRoutes(state,CAMPAIGN_ROUTE);
        for(const step of SHIP_RECONSTRUCTION_STEPS.slice(0,5)) {
            state.set('hubWorld.shipParts.collected',[...(state.get('hubWorld.shipParts.collected')||[]),step.partId]);
            installShipReconstructionStep(state,step.id,{save:false});
        }
    }
    ${seededVictory ? `if(!saved) {
        const {beginTrumptopusRun,checkpointTrumptopusRun,recordTrumptopusVictory}=await import('/src/systems/TrumptopusProgress.js');
        const {run}=beginTrumptopusRun(state);
        checkpointTrumptopusRun(state,run.sequence,1,{elapsedMs:20000,damageTaken:1});
        checkpointTrumptopusRun(state,run.sequence,2,{elapsedMs:40000,damageTaken:1});
        recordTrumptopusVictory(state,{sequence:run.sequence,completionMs:60000,damageTaken:1});
    }` : ''}
    ${arrivalFixture ? `if(fixtureParams.has('boundary')&&!saved) {
        const {run}=beginTrumptopusRun(state,{withApproach:true});
        for(const clearedGrips of [1,2])checkpointTrumptopusApproach(state,run.sequence,{schemaVersion:1,clearedGrips,arrived:false});
    }` : ''}
    for(const name of ['EconomyManager','EnemyManager','ProjectileManager','InventoryManager','CreatureLifecycle'])await window[name].initialize();
    for(const name of ['QuestManager','CollectibleManager','CreatureSkills'])await window[name].init();
    window.fixtureIdentity=JSON.stringify({genes:state.get('creature.genes'),dna:state.get('creature.dna')});
    window.fixtureUnchanged=()=>window.fixtureIdentity===JSON.stringify({genes:state.get('creature.genes'),dna:state.get('creature.dna')});
    window.game=window.mythicalGame=new Phaser.Game({type:new URLSearchParams(location.search).get('renderer')==='webgl'?Phaser.WEBGL:Phaser.CANVAS,parent:'game',width:innerWidth,height:innerHeight-42,audio:{noAudio:true},
        dom:{createContainer:true},input:{activePointers:3},physics:{default:'arcade',arcade:{debug:false}},scene:[${approach ? arrivalFixture ? 'ArrivalApproach,' : 'Approach,' : ''}Preview,GameScene,VictoryScene,HubWorldScene],
        callbacks:{postBoot:game=>{window.UXEnhancements.initialize(game);window.FXLibrary.initialize();}}});
    document.querySelector('#retry').onclick=()=>{document.querySelector('#paused').hidden=true;document.querySelector('#paused').textContent='Paused';document.querySelector('#pause').textContent='Pause';window.prototypeScene.scene.restart();};
    document.querySelector('#pause').onclick=()=>window.prototypeScene.showPauseMenu();
    window.addEventListener('prototype-pause',event=>{document.querySelector('#paused').hidden=!event.detail;document.querySelector('#pause').textContent=event.detail?'Resume':'Pause';});
    window.addEventListener('prototype-defeat',()=>{document.querySelector('#paused').textContent='Try again';document.querySelector('#paused').hidden=false;});
    </script></body></html>`;
}

function sceneTextPoint(text) {
        const candidates=[];
        function visit(item) {
            if(!item||item.visible===false||item.alpha<=0)return;
            if(item.text===text&&item.getBounds)candidates.push(item);
            for(const child of item.list||[])visit(child);
        }
        for(const scene of window.game.scene.getScenes(true))for(const item of scene.children.list)visit(item);
        const item=candidates.sort((a,b)=>(b.depth||0)-(a.depth||0))[0];
        if(!item)return null;
        const camera=item.scene.cameras.main,canvas=window.game.canvas.getBoundingClientRect(),bounds=item.getBounds();
        if(camera.shakeEffect?.isRunning||camera.zoomEffect?.isRunning)return null;
        // Newly drawn labels precede Phaser's next input-list update. Match the
        // existing completion smoke's live hit-area check, not just the text.
        const live=item.scene.input?._list||[];
        const ready=item.input?.enabled===true ? live.includes(item) : live.some(candidate=>{
            if(!candidate?.input?.enabled||candidate.visible===false||candidate.alpha<=0||!candidate.getBounds)return false;
            const area=candidate.getBounds();
            return bounds.centerX>=area.left&&bounds.centerX<=area.right&&bounds.centerY>=area.top&&bounds.centerY<=area.bottom;
        });
        const modal=item.scene.shipEvidenceBoardModal;
        const modalReady=modal?.isVisible===true&&modal.pointerRegions?.some(region=>
            bounds.centerX>=region.left&&bounds.centerX<=region.right&&bounds.centerY>=region.top&&bounds.centerY<=region.bottom);
        if(!ready&&!modalReady)return null;
        const point=camera.matrix.transformPoint(bounds.centerX-camera.scrollX*item.scrollFactorX,bounds.centerY-camera.scrollY*item.scrollFactorY);
        const x=canvas.left+point.x*canvas.width/item.scene.scale.width,y=canvas.top+point.y*canvas.height/item.scene.scale.height;
        return x>=0&&x<=innerWidth&&y>=0&&y<=innerHeight?{x,y}:null;
}

async function clickSceneText(page, text) {
    const target=await page.waitForFunction(sceneTextPoint,text,{timeout:20000});
    const point=await target.jsonValue();await target.dispose();
    if(page.viewportSize().width<600)await page.touchscreen.tap(point.x,point.y);
    else await page.mouse.click(point.x,point.y);
}

const ENDING_CHOICES=Object.freeze({
    remain_and_defend:{label:'DEFEND FIRST\nRestore communities',confirm:'SET DEFENCE PRIORITY'},
    prepare_homecoming:{label:'PREPARE HOMECOMING\nPreserve a secret route',confirm:'PREPARE THE ROUTE'},
    prepare_first_contact:{label:'PREPARE HONEST CONTACT\nBuild consent and proof',confirm:'BUILD THE PROTOCOL'}
});

function inspectEndingLayout() {
    const scene=window.game.scene.getScene('VictoryScene'),{width,height}=scene.scale;
    const texts=scene.elements.filter(item=>item.type==='Text'&&item.active&&item.visible&&item.alpha>0)
        .map(item=>{const b=item.getBounds();return {text:item.text,left:b.left,right:b.right,top:b.top,bottom:b.bottom};});
    const clipped=texts.filter(b=>b.left<0||b.top<0||b.right>width||b.bottom>height);
    const overlaps=[];
    for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){
        const a=texts[i],b=texts[j];
        if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)
            overlaps.push([a.text,b.text]);
    }
    return {width,height,texts,clipped,overlaps};
}

async function completeCampaignEnding(page,output,name,{priority='prepare_homecoming',exerciseRecovery=false}={}) {
    const choice=ENDING_CHOICES[priority];
    assert(choice,`Unknown ending priority: ${priority}`);
    const layouts=[];
    async function layout(stage) {
        if(!exerciseRecovery)return;
        const result=await page.evaluate(inspectEndingLayout);
        layouts.push({stage,...result});
        assert(result.texts.length>0,'No ending text rendered');
        assert.deepEqual(result.clipped,[],`Clipped text at ${stage}`);
        assert.deepEqual(result.overlaps,[],`Overlapping text at ${stage}`);
    }
    await page.getByRole('button',{name:'Repair the ship',exact:true}).waitFor();
    const before=await page.evaluate(()=>({coins:GameState.get('player.cosmicCoins'),items:GameState.get('inventory.items'),run:GameState.get('story.projectBeacon.trumptopus')}));
    assert.equal(before.run.status,'won');assert.equal(before.items.find(i=>i.id==='super_blast').quantity,1);
    assert.equal(await page.getByRole('button',{name:'Watch',exact:true}).count(),0,'Unapproved finale film offered Watch');
    await page.screenshot({path:path.join(output,`${name}-result.png`)});
    // A genuine page refresh at the result must restore a terminal encounter.
    await page.reload();
    await page.getByRole('button',{name:'Repair the ship',exact:true}).waitFor();
    const resumed=await page.evaluate(()=>({coins:GameState.get('player.cosmicCoins'),items:GameState.get('inventory.items'),state:window.prototypeScene.encounter.snapshot()}));
    assert.equal(resumed.coins,before.coins);assert.deepEqual(resumed.items,before.items);assert.equal(resumed.state.state,'aftermath');
    await page.getByRole('button',{name:'Repair the ship',exact:true}).click();
    await page.waitForFunction(()=>window.game.scene.isActive('GameScene'));
    await clickSceneText(page,'INSTALL COMMAND MODULE');
    await page.waitForFunction(()=>window.game.scene.isActive('VictoryScene'),null,{timeout:20000});
    await page.screenshot({path:path.join(output,`${name}-ship-restored.png`)});
    await clickSceneText(page,'SKIP >>');
    await clickSceneText(page,'Choose what comes first');
    await layout('choices');
    await page.screenshot({path:path.join(output,`${name}-ending-choices.png`)});
    await clickSceneText(page,choice.label);
    await layout('confirmation');
    if(exerciseRecovery) {
        await page.screenshot({path:path.join(output,`${name}-confirmation.png`)});
        assert.equal(await page.evaluate(()=>GameState.get('story.projectBeacon.finale.priority')),null);
        await clickSceneText(page,'GO BACK');
        assert.equal(await page.evaluate(()=>GameState.get('story.projectBeacon.finale.priority')),null,'Going back committed a priority');
        await clickSceneText(page,choice.label);
    }
    await clickSceneText(page,choice.confirm);
    if(exerciseRecovery) {
        await layout('epilogue-before-refresh');
        const pending=await page.evaluate(()=>GameState.get('story.projectBeacon.finale'));
        assert.equal(pending.priority,priority);assert.equal(pending.epilogueSeen,false);
        await page.reload();
        await page.getByRole('button',{name:'Finish the story',exact:true}).waitFor();
        assert.equal(await page.evaluate(()=>GameState.get('player.cosmicCoins')),before.coins);
        assert.deepEqual(await page.evaluate(()=>GameState.get('inventory.items')),before.items);
        await page.getByRole('button',{name:'Finish the story',exact:true}).click();
        await page.waitForFunction(()=>window.game.scene.isActive('VictoryScene'));
        assert.equal(await page.evaluate(()=>GameState.get('story.projectBeacon.finale.priority')),priority);
    }
    for(let number=1;number<=3;number++) {
        await page.waitForFunction(text=>window.game.scene.getScene('VictoryScene').children.list.some(item=>
            item.text===text&&item.visible!==false&&item.alpha>0),`${String(number).padStart(2,'0')} / 03`);
        await layout(`epilogue-${number}`);
        if(exerciseRecovery)await page.screenshot({path:path.join(output,`${name}-epilogue-${number}.png`)});
        if(number<3)await clickSceneText(page,'CONTINUE');
    }
    await page.screenshot({path:path.join(output,`${name}-epilogue.png`)});
    const ending=await page.evaluate(()=>({coins:GameState.get('player.cosmicCoins'),items:GameState.get('inventory.items'),
        priority:GameState.get('story.projectBeacon.finale.priority'),seen:GameState.get('story.projectBeacon.finale.epilogueSeen'),
        parts:GameState.get('hubWorld.shipParts.collected'),identityUnchanged:window.fixtureUnchanged(),
        antagonist:GameState.get('world.antagonistOutcomes.trumptopus'),
        empress:window.GuardianOutcomes.getGuardianOutcomeSnapshot(GameState).state.records.void_empress||null}));
    assert.equal(ending.priority,priority);assert.equal(ending.seen,true);assert(ending.identityUnchanged);
    assert.equal(ending.antagonist.outcome,'banished');assert.equal(ending.empress,null);
    assert.equal(ending.items.find(i=>i.id==='super_blast').quantity,1);
    if(exerciseRecovery) {
        await clickSceneText(page,'NEW GAME+');
        await layout('new-game-plus-confirmation');
        await page.screenshot({path:path.join(output,`${name}-new-game-plus-confirmation.png`)});
        await clickSceneText(page,'KEEP PRIORITY');
        await layout('new-game-plus-cancelled');
        assert.equal(await page.evaluate(()=>GameState.get('story.projectBeacon.finale.priority')),priority);
        assert.deepEqual(await page.evaluate(()=>GameState.get('inventory.items')),ending.items);
        assert.deepEqual(await page.evaluate(()=>GameState.get('hubWorld.shipParts.collected')),ending.parts);
    }
    await clickSceneText(page,'SANCTUARY');
    await page.waitForFunction(()=>window.game.scene.isActive('HubWorldScene'),null,{timeout:20000});
    return {before,resumed,ending,layouts,choiceBackChecked:exerciseRecovery,epilogueRefreshChecked:exerciseRecovery,
        newGamePlusCancelled:exerciseRecovery,actualSanctuaryRepair:true,actualEndingChoice:true,returnedToHub:true};
}
module.exports={createCampaignProofHtml,completeCampaignEnding,sceneTextPoint,ENDING_CHOICES,inspectEndingLayout,seedPriorCampaignRoutes};
