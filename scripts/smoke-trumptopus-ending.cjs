#!/usr/bin/env node
// Private component-boundary proof. The win is seeded, not earned by this journey.
// Uses the existing Forest film strictly as a playback fixture, not final artwork.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');

function proofHtml(asset) {
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Private ending boundary proof</title>
    <style>html,body{margin:0;background:#15191c;color:#eee;font:13px Arial}header{height:42px;box-sizing:border-box;padding:12px}canvas{display:block}</style></head><body>
    <header>PRIVATE / ENDING FLOW ONLY / SEEDED VICTORY</header><div id="game"></div>
    <script type="module">
    import * as Phaser from '/node_modules/phaser/dist/phaser.esm.js';
    import '/src/systems/GameState.js';
    import {TrumptopusCompletion} from '/src/systems/TrumptopusCompletion.js';
    import {FinaleFilms} from '/src/systems/FinaleFilms.js';
    import {PreparedFilm} from '/src/systems/PreparedFilm.js';
    import {SHIP_RECONSTRUCTION_STEPS,installShipReconstructionStep} from '/src/systems/ShipReconstruction.js';
    const params=new URLSearchParams(location.search);
    const state=window.GameState;
    state.saveKey='private_trumptopus_proof';
    state.saveBackupKeyPrefix='private_trumptopus_backup_';
    state.saveBackupIndexKey='private_trumptopus_backups';
    const saved=localStorage.getItem(state.saveKey);
    if(saved) state.commitPreparedSave(state.prepareSaveCandidate(saved),{persist:false});
    else {
        state.set('creature.hatched',true); state.set('story.projectBeacon.fieldKit.recovered',true);
        for(const step of SHIP_RECONSTRUCTION_STEPS.slice(0,5)) {
            state.set('hubWorld.shipParts.collected',[...(state.get('hubWorld.shipParts.collected')||[]),step.partId]);
            installShipReconstructionStep(state,step.id,{save:false});
        }
    }
    window.primaryWrites=0;
    const setItem=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value) {
        if(params.has('denied')) throw new DOMException('Denied','SecurityError');
        if(key===state.saveKey) window.primaryWrites++;
        return setItem.call(this,key,value);
    };
    let failOnce=params.has('failed');
    class Proof extends Phaser.Scene {
        constructor(){super('ResultProof');}
        create(){
            this.cameras.main.setBackgroundColor('#15191c');
            this.add.rectangle(innerWidth/2,130,innerWidth,3,0x819c94);
            this.levelStartTime=Date.now()-60000;
            this.clearInput=()=>{};
            this.enterLevelCompletionState=()=>{};
            const config={enabled:!params.has('absent'),encounterId:'trumptopus',films:{victory:{approved:true,title:'Playback fixture: existing Forest film',asset:${JSON.stringify(asset)}}}};
            const films=new FinaleFilms(this,{encounterId:'trumptopus',config,createFilm:asset=>new PreparedFilm(asset,{
                fetch:(...args)=>{if(failOnce){failOnce=false;return Promise.reject(Error('injected_offline'));}return fetch(...args);}
            })});
            const completion=new TrumptopusCompletion(this,{gameState:state,films});
            if(completion.run.status!=='won') {
                completion.observe({snapshot:()=>({phaseIndex:1,completionReady:false})});
                completion.observe({snapshot:()=>({phaseIndex:2,completionReady:true})});
            }
            completion.present();
            window.proof={completion,films,scene:this,state};
        }
    }
    class Destination extends Phaser.Scene {
        constructor(){super('GameScene');}
        init(data){window.handoff=data;}
        create(){this.add.text(16,24,'Existing Sanctuary handoff received (fixture)',{fontSize:'14px',wordWrap:{width:innerWidth-32}});}
    }
    window.game=new Phaser.Game({type:Phaser.CANVAS,parent:'game',width:innerWidth,height:innerHeight-42,audio:{noAudio:true},scene:[Proof,Destination]});
    </script></body></html>`;
}

async function main() {
    const root=path.resolve(__dirname,'..');
    const output=path.join(root,'.visual-review/trumptopus-ending-handoff');
    fs.mkdirSync(output,{recursive:true});
    const bytes=fs.readFileSync(path.join(root,'public/game/cinematics/mythical-forest-arrival-loop.mp4'));
    const asset={url:'/game/cinematics/mythical-forest-arrival-loop.mp4',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),durationSeconds:8};
    const report={kind:'result-save-media-handoff-boundary',syntheticVictorySetup:true,fullCampaignPlayed:false,finalArtwork:false,fixtureFilm:asset,journeys:[]};
    let browser,server,activePage;
    const cleanup=async()=>{try{await browser?.close();}finally{await server?.close();}};
    for(const signal of ['SIGINT','SIGTERM']) process.once(signal,async()=>{await cleanup();process.exit(1);});
    try {
        const {createServer}=await import('vite');
        server=await createServer({configFile:false,root,server:{host:'127.0.0.1',port:0,open:false},plugins:[{
            name:'private-ending-proof',configureServer(vite){vite.middlewares.use('/__ending-proof',(_,res)=>{res.setHeader('Content-Type','text/html');res.end(proofHtml(asset));});}
        }]});
        await server.listen();
        const base=`http://127.0.0.1:${server.httpServer.address().port}`;
        browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
        for(const [name,width,height,query] of [
            ['phone',390,844,''],['desktop',1280,720,''],['landscape',844,390,''],
            ['denied-storage',390,844,'?denied'],['film-retry',390,844,'?failed'],['no-film',390,844,'?absent']
        ]) {
            const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'});
            const page=await context.newPage(); activePage=page;
            const errors=[],requests=[];
            report.inProgress={name,errors};
            page.on('pageerror',error=>errors.push(error.message));
            page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
            await page.route('**/*',route=>{
                const request=route.request(); requests.push({url:request.url(),method:request.method()});
                if(!request.url().startsWith(base)||request.method()!=='GET'||/\/api\/|\/\.netlify\//.test(request.url())) {
                    errors.push(`Outside service: ${request.url()}`);return route.abort();
                }
                return route.continue();
            });
            await page.goto(`${base}/__ending-proof${query}`);
            await page.waitForFunction(()=>window.proof?.completion.panel);
            if(name==='film-retry') {
                await page.getByRole('button',{name:'Retry film',exact:true}).waitFor();
                await page.screenshot({path:path.join(output,`${name}-failed.png`)});
                assert(await page.getByRole('button',{name:'Repair the ship',exact:true}).isEnabled());
                await page.getByRole('button',{name:'Retry film',exact:true}).click();
            }
            if(name!=='no-film') await page.waitForFunction(()=>window.proof.films.isReady('victory'));
            const outcome=await page.evaluate(()=>({coins:GameState.get('player.cosmicCoins'),items:GameState.get('inventory.items'),receipt:window.proof.completion.run.receipt,writes:window.primaryWrites,persisted:window.proof.completion.persisted}));
            assert.equal(outcome.coins,2500);assert.equal(outcome.items[0].id,'super_blast');assert.equal(outcome.items[0].quantity,1);
            if(name==='denied-storage') {
                assert.equal(outcome.persisted,false);assert.equal(outcome.writes,0);
                assert((await page.locator('.trumptopus-result__notice').textContent()).includes('Keep this tab open'));
            } else assert.equal(outcome.writes,4); // run, two phase boundaries, one complete victory
            const layout=await page.evaluate(()=>{
                const panel=window.proof.completion.panel;
                const controls=[panel.watch,panel.primary].filter(button=>!button.hidden);
                const bounds=controls.map(button=>{const b=button.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};});
                return {bounds,buttonsInside:bounds.every(b=>b.x>=0&&b.y>=0&&b.x+b.width<=innerWidth&&b.y+b.height<=innerHeight&&b.height>=44),
                    noHorizontalOverflow:panel.root.scrollWidth<=panel.root.clientWidth,
                    scrollAvailable:panel.root.querySelector('.trumptopus-result__body').scrollHeight>=panel.root.querySelector('.trumptopus-result__body').clientHeight};
            });
            assert(layout.buttonsInside&&layout.noHorizontalOverflow);
            await page.screenshot({path:path.join(output,`${name}-result.png`)});
            let playback=null;
            if(name==='phone'||name==='desktop'||name==='film-retry') {
                const fetchesBefore=requests.filter(r=>r.url.endsWith('.mp4')).length;
                await page.getByRole('button',{name:'Watch',exact:true}).click();
                await page.waitForFunction(()=>window.proof.films.films.get('victory').state==='playing');
                await page.waitForFunction(()=>document.querySelector('video').currentTime>0.3);
                playback=await page.evaluate(()=>{
                    const video=document.querySelector('video');const canvas=document.createElement('canvas');canvas.width=96;canvas.height=54;
                    const ctx=canvas.getContext('2d');ctx.drawImage(video,0,0,96,54);const pixels=ctx.getImageData(0,0,96,54).data;
                    let visible=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]+pixels[i+1]+pixels[i+2]>30)visible++;
                    return {time:video.currentTime,muted:video.muted,visibleFraction:visible/(96*54),resultHidden:window.proof.completion.panel.root.hidden};
                });
                assert(playback.muted&&playback.resultHidden&&playback.visibleFraction>0.15);
                assert.equal(requests.filter(r=>r.url.endsWith('.mp4')).length,fetchesBefore,'Watch downloaded instead of using prepared media');
                await page.screenshot({path:path.join(output,`${name}-playing-fixture.png`)});
                await page.getByRole('button',{name:'Continue',exact:true}).click();
                await page.waitForFunction(()=>!window.proof.completion.panel.root.hidden&&window.proof.scene.sys.isActive());
                assert.equal(await page.locator('video').count(),0);
            }
            if(name==='phone') {
                await page.reload();await page.waitForFunction(()=>window.proof?.completion.panel);
                assert.equal(await page.evaluate(()=>window.primaryWrites),0,'Refresh re-awarded the win');
                assert.equal(await page.evaluate(()=>GameState.get('player.cosmicCoins')),2500);
                assert.equal(await page.evaluate(()=>GameState.get('inventory.items')[0].quantity),1);
            }
            await page.getByRole('button',{name:'Repair the ship',exact:true}).click();
            await page.waitForFunction(()=>window.handoff);
            const handoff=await page.evaluate(()=>window.handoff);
            assert.deepEqual(handoff,{biome:'nebula',continueFinaleAfterRepair:true});
            assert.equal(await page.locator('[role=dialog]').count(),0);
            assert.equal(await page.locator('video').count(),0);
            await page.evaluate(()=>{window.dispatchEvent(new Event('resize'));window.game.events.emit('focus');});
            assert.deepEqual(errors,[]);
            report.journeys.push({name,width,height,outcome,layout,playback,handoff,refreshChecked:name==='phone',sceneCleanup:true,externalRequests:0,errors});
            delete report.inProgress;
            await context.close();
        }
        report.passed=true;
    } catch(error) {
        report.failure=error.stack;
        if(activePage&&!activePage.isClosed())await activePage.screenshot({path:path.join(output,'failed-attempt.png')}).catch(()=>{});
        throw error;
    } finally {
        await cleanup();
        fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
    }
    console.log(JSON.stringify({passed:report.passed,journeys:report.journeys.map(j=>j.name),output},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
