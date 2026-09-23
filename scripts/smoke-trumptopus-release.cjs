#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { completeCampaignEnding, sceneTextPoint } = require('./lib/trumptopus-campaign-proof.cjs');
const root = path.resolve(__dirname, '..');
const output = path.resolve(root, process.env.FINALE_RELEASE_EVIDENCE || '.visual-review/release-smoke');
const profile = JSON.parse(fs.readFileSync(path.join(root, 'public/press/gameplay/real-creature-showcase/source-profiles.json'))).profiles[1];
let browser, server, activePage;
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    sourceDirty: Boolean(execFileSync('git', ['status', '--porcelain'], {cwd:root,encoding:'utf8'}).trim()),
    builtGame: true, fixturePriorLevels: true, physicalDeviceTest: false, cases: [] };
async function cleanup() { try { await browser?.close(); } finally { await server?.httpServer.close(); } }
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => { await cleanup(); process.exit(1); });

async function main() {
    assert(!fs.existsSync(path.join(output, 'report.json')), 'Do not overwrite evidence');
    fs.mkdirSync(output, { recursive: true });
    const { preview } = await import('vite');
    server = await preview({ root, preview: { host: '127.0.0.1', port: 0, open: false } });
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
    const views = (process.env.FINALE_RELEASE_VIEWS || 'phone,desktop').split(',');
    assert(views.every(view=>['phone','desktop'].includes(view)), 'Unknown release viewport');
    for (const [name, width, height] of [['phone', 390, 844], ['desktop', 1280, 720]].filter(([name])=>views.includes(name))) {
        const context = await browser.newContext({ viewport: { width, height }, hasTouch: name === 'phone', serviceWorkers: 'block' });
        const page = activePage = await context.newPage();
        const errors = [], outside = [], failedResponses = [];
        report.inProgress = { name, errors, outside, failedResponses };
        page.on('pageerror', error => errors.push(error.stack || error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        page.on('response', response => { if (response.status() >= 400) failedResponses.push([response.status(), response.url()]); });
        await page.route('**/*', route => {
            const url = route.request().url();
            if (!url.startsWith(base + '/') && /^https?:/.test(url)) { outside.push(url); return route.abort(); }
            return route.continue();
        });
        await page.addInitScript(() => {
            localStorage.setItem('audioMuted', 'true');
            localStorage.setItem('mythical_void_age_confirmed', 'true');
            localStorage.setItem('mythical_void_age_group', 'age_under_13');
            for (const name of ['AudioManager', 'APIConfig', 'Phaser']) Object.defineProperty(window, name, {
                configurable: true, set(value) {
                    if (name === 'AudioManager') Object.defineProperty(value, 'muted', { configurable:true,get:()=>true,set(){} });
                    if (name === 'APIConfig') { value.isEnabled=()=>false; value.isVideoEnabled=()=>false; }
                    if (name === 'Phaser') {
                        const Game = value.Game;
                        value.Game = class extends Game { constructor(config) { super({ ...config, audio: { noAudio: true } }); } };
                    }
                    Object.defineProperty(window, name, { configurable:true,writable:true,value });
                }
            });
        });
        // The existing localhost-only preview guard prevents onboarding from
        // racing the explicit prior-campaign fixture. No test ending is selected.
        await page.goto(base + '/play/?testEnding=release-fixture');
        const enterFixture = async () => {
        await page.waitForFunction(() => window.mythicalGame?.isBooted && window.GameState?.state && window.SceneLoader, null, {timeout:60000});
        await page.evaluate(async profile => {
            const state = window.GameState, game = window.mythicalGame;
            window.game = game;
            state.saveKey='release_finale_fixture'; state.saveBackupKeyPrefix='release_finale_backup_'; state.saveBackupIndexKey='release_finale_backups';
            const saved = localStorage.getItem(state.saveKey);
            if (saved) state.commitPreparedSave(state.prepareSaveCandidate(saved),{persist:false});
            else {
            const creature = {...state.get('creature'),id:profile.genes.id,name:'Aster',genes:profile.genes,dna:profile.dna,hatched:true,named:true,
                lifecycle:{...state.get('creature.lifecycle'),stage:'juvenile',birthDate:Date.now()-7*86400000}};
            state.set('creature',creature); state.set('creatures',[creature]); state.set('activeCreatureIndex',0);
            state.set('settings.audioMuted',true); state.set('session.gameStarted',true);
            state.set('tutorial.livingFormSeen',true); state.set('tutorial.livingFormPending',false);
            state.set('tutorial.crashStorySeen',true);
            state.set('tutorial.controlsSeen',true);
            state.set('story.projectBeacon.fieldKit.recovered',true);
            state.set('story.projectBeacon.pendingDebriefs',[]);
            state.set('story.projectBeacon.debriefsSeen',[1,2,3,4,5].map(n=>'beacon_debrief_'+n));
            state.set('story.projectBeacon.firstExpeditionDrill',{completed:true});
            state.set('hubWorld.shipCompletionCutsceneShown',true);
            state.set('world.currentPosition',{x:1200,y:900});
            // Synthetic prerequisite completion, never a live player's account.
            for (const id of ['mythicalForest','crystalCaves','cosmicReef','voidPeaks','auroraDepths']) state.set(`levels.${id}.completed`,true);
            state.set('stats.levelsCompleted',5);
            for(const step of window.ShipReconstruction.SHIP_RECONSTRUCTION_STEPS.slice(0,5)) {
                state.set('hubWorld.shipParts.collected',[...(state.get('hubWorld.shipParts.collected')||[]),step.partId]);
                window.ShipReconstruction.installShipReconstructionStep(state,step.id,{save:false});
            }
            }
            for (const key of ['GameScene','VictoryScene','HubWorldScene','FinalVoidLevel']) {
                if (!await window.SceneLoader.loadScene(game,key)) throw Error('Could not load '+key);
            }
            window.fixtureIdentity=JSON.stringify({genes:state.get('creature.genes'),dna:state.get('creature.dna')});
            window.fixtureUnchanged=()=>window.fixtureIdentity===JSON.stringify({genes:state.get('creature.genes'),dna:state.get('creature.dna')});
            Object.defineProperty(window,'prototypeScene',{configurable:true,get:()=>game.scene.keys.TrumptopusArena?.sys.isActive() || game.scene.keys.TrumptopusArena?.sys.isPaused()
                ?game.scene.keys.TrumptopusArena:game.scene.keys.FinalVoidLevel});
            for (const scene of game.scene.getScenes(false)) if (scene.sys.isActive() || scene.sys.isPaused()) game.scene.stop(scene.sys.settings.key);
            game.scene.start('FinalVoidLevel');
        }, profile);
        };
        await enterFixture();
        await page.waitForFunction(() => prototypeScene?.productionFinale && prototypeScene?.isGrounded);
        const state = () => page.evaluate(() => prototypeScene.getProofState());
        const wait = predicate => page.waitForFunction(predicate, null, {timeout:20000});
        const cdp = name === 'phone' ? await context.newCDPSession(page) : null;
        let stick = null, jumpPoint = null;
        const pointFor = control => page.evaluate(control => {
            const s=prototypeScene,t=s.mobileControlTargets[control],r=game.canvas.getBoundingClientRect();
            return {x:r.left+t.x*r.width/s.scale.width,y:r.top+t.y*r.height/s.scale.height};
        },control);
        const touch = (type,extra=[]) => cdp.send('Input.dispatchTouchEvent',{type,touchPoints:[...(stick?[stick]:[]),...(jumpPoint?[jumpPoint]:[]),...extra]});
        const direction = async sign => {
            if (!cdp) return page.keyboard.down(sign>0?'ArrowRight':'ArrowLeft');
            const p=await pointFor('joystick'); stick={...p,id:0};await touch('touchStart');
            stick.x+=sign*42;await touch('touchMove');
        };
        const release = async () => {
            if (cdp) {stick=null;await touch(jumpPoint?'touchMove':'touchEnd');}
            else {await page.keyboard.up('ArrowRight');await page.keyboard.up('ArrowLeft');}
        };
        const jumpDown = async () => {
            if (!cdp) return page.keyboard.down('Space');
            jumpPoint={...await pointFor('jump'),id:1};await touch('touchStart');
        };
        const jumpUp = async () => {
            if (!cdp) return page.keyboard.up('Space');
            jumpPoint=null;await touch(stick?'touchMove':'touchEnd');
        };
        const move = async x => {
            const start = await state(), sign = Math.sign(x-start.player.x);
            if (Math.abs(x-start.player.x)<8) return;
            await direction(sign);
            try { await page.waitForFunction(({x,sign})=>sign*(prototypeScene.player.x-x)>=0,{x,sign},{timeout:15000}); }
            finally { await release(); }
        };
        const face = async sign => {await direction(sign);await page.waitForTimeout(50);await release();};
        const attack = async () => {
            if (name === 'desktop') return page.keyboard.press('KeyX');
            const point = await pointFor('melee');
            await page.touchscreen.tap(point.x,point.y);
        };
        const watch = async beat => {
            await page.getByRole('button',{name:'Watch',exact:true}).waitFor();
            await wait(()=>!document.querySelector('.trumptopus-result footer button')?.disabled);
            await page.getByRole('button',{name:'Watch',exact:true}).click();
            await wait(()=>document.querySelector('video')?.currentTime>0.3);
            assert(await page.evaluate(()=>document.querySelector('video').muted));
            await page.screenshot({path:path.join(output,`${name}-${beat}-watch.png`)});
            await page.locator('.prepared-film-player').getByRole('button',{name:'Continue',exact:true}).click();
        };
        await page.screenshot({path:path.join(output,`${name}-approach.png`)});
        const jumpTo = async x => {
            await wait(()=>prototypeScene.isGrounded);
            await direction(1);await jumpDown();
            await wait(()=>prototypeScene.player.body.velocity.y < -50);
            await wait(()=>prototypeScene.player.body.velocity.y >= -40);
            await jumpUp();
            await page.waitForFunction(x=>prototypeScene.player.x>=x,x);
            await release();await wait(()=>prototypeScene.isGrounded);
        };
        for (const x of [640,1810]) {
            await move(x); await wait(()=>prototypeScene.encounter.state==='windup');
            const locked=await state(); await move(locked.targetX+100); await face(-1);
            await wait(()=>prototypeScene.encounter.state==='exposed');
            await move(locked.targetX+80);await face(-1);
            for(let i=0;i<5&&(await state()).state==='exposed';i++){await attack();await page.waitForTimeout(350);}
            await wait(()=>prototypeScene.encounter.mode==='travel');
            if(x===640) {
                await move(1245); await wait(()=>prototypeScene.isGrounded);
                await jumpTo(1415);await move(1435);await jumpTo(1610);
            }
        }
        await move(2370);await jumpTo(2570);
        await direction(1);
        await page.locator('.trumptopus-arrival').waitFor();
        await release();
        await watch('arrival');
        await wait(()=>prototypeScene.sys.settings.key==='TrumptopusArena'&&prototypeScene.isGrounded);
        const pausePoint=await page.evaluate(()=>{
            const s=prototypeScene,b=s.pauseButton.getBounds(),r=game.canvas.getBoundingClientRect();
            return {x:r.left+b.centerX*r.width/s.scale.width,y:r.top+b.centerY*r.height/s.scale.height};
        });
        await page.mouse.click(pausePoint.x,pausePoint.y);
        const pausedElapsed=(await state()).elapsed;
        await page.waitForTimeout(200);
        assert.equal((await state()).elapsed,pausedElapsed,'Pause did not stop the attack clock');
        await page.getByRole('button',{name:'Power-ups',exact:true}).click();
        const backHandle=await page.waitForFunction(sceneTextPoint,'← BACK');
        const back=await backHandle.jsonValue();await backHandle.dispose();
        await page.mouse.click(back.x,back.y);
        await page.evaluate(()=>{window.previousFinalePlayer=prototypeScene.player;});
        await page.getByRole('button',{name:'Retry checkpoint',exact:true}).click();
        await wait(()=>prototypeScene.sys.settings.key==='TrumptopusArena'&&prototypeScene.player!==window.previousFinalePlayer&&prototypeScene.player?.body&&prototypeScene.playerContactGeometry&&!prototypeScene.pauseMenuActive&&prototypeScene.isGrounded);
        // Explicit fault injection tests death recovery before the real fight.
        await page.evaluate(()=>prototypeScene.takeDamage(prototypeScene.maxHealth,true));
        await page.evaluate(()=>{window.previousFinalePlayer=prototypeScene.player;});
        await page.getByRole('button',{name:'Try again',exact:true}).click();
        await wait(()=>prototypeScene.player!==window.previousFinalePlayer&&prototypeScene.player?.body&&prototypeScene.playerContactGeometry&&!prototypeScene.isPlayerDead&&prototypeScene.isGrounded);
        assert.equal((await state()).phaseIndex,0);
        if(name==='phone') {
            await page.setViewportSize({width:844,height:390});
            await wait(()=>prototypeScene.sceneSize.width===844&&prototypeScene.isGrounded);
            await page.setViewportSize({width,height});
            await wait(()=>prototypeScene.sceneSize.width===390&&prototypeScene.isGrounded);
        }
        if(name==='desktop') {
            await page.keyboard.press('Escape');
            await page.getByRole('button',{name:'Resume',exact:true}).waitFor();
            await page.keyboard.press('Escape');
            await wait(()=>!prototypeScene.pauseMenuActive&&!prototypeScene.encounter.paused);
        }
        const counters=[];
        for(let n=0;n<24&&!(await state()).completionReady;n++) {
            await wait(()=>prototypeScene.encounter.state==='windup');
            const locked=await state();
            if(locked.attack==='sweep') {
                await move(195); await wait(()=>prototypeScene.encounter.state==='windup'&&prototypeScene.encounter.snapshot().progress>=.55);
                await jumpDown();await page.waitForTimeout(120);await jumpUp();await wait(()=>prototypeScene.encounter.state==='exposed');
                await wait(()=>prototypeScene.isGrounded); await face(-1);
            } else {
                const target=locked.targetX+100<width-85?locked.targetX+100:locked.targetX-100;
                await move(target);await face(target>locked.targetX?-1:1);await wait(()=>prototypeScene.encounter.state==='exposed');
            }
            const before=await state();
            await move(before.hand.x+(before.player.x>=before.hand.x?80:-80));
            await face(before.player.x>=before.hand.x?-1:1);
            await page.screenshot({path:path.join(output,`${name}-phase-${locked.phaseIndex+1}.png`)});
            for(let p=0;p<5&&(await state()).state==='exposed';p++){await attack();await page.waitForTimeout(380);}
            const after=await state();assert(after.health<before.health,'Real counter did not reach the boss');
            counters.push({phase:locked.phaseIndex+1,before:before.health,after:after.health});
            await wait(()=>!['exposed','recoil'].includes(prototypeScene.encounter.state));
        }
        await page.getByRole('button',{name:'Repair the ship',exact:true}).waitFor({timeout:20000});
        await watch('victory');
        await page.screenshot({path:path.join(output,`${name}-result.png`)});
        assert(await page.evaluate(()=>fixtureUnchanged()));
        const result=await page.evaluate(()=>GameState.get('story.projectBeacon.trumptopus'));
        assert.equal(result.status,'won');
        const ending = await completeCampaignEnding(page,output,name,{allowPreparedFilms:true,restoreAfterReload:enterFixture,exerciseRecovery:true});
        assert.deepEqual(errors,[]);assert.deepEqual(outside,[]);assert.deepEqual(failedResponses,[]);
        report.cases.push({name,counters,result,ending,pausePowerupsRetryChecked:true,deathRecoveryInjected:true,
            orientationChecked:name==='phone',errors,outside,failedResponses});
        await context.close();
    }
    report.passed=true;
}
main().catch(async error=>{
    report.failure=error.stack;console.error(error);
    if(activePage&&!activePage.isClosed()){
        await activePage.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
        report.state=await activePage.evaluate(()=>({
            scene:window.prototypeScene?.sys.settings.key,proof:window.prototypeScene?.getProofState?.(),
            viewport:{width:innerWidth,height:innerHeight,visualWidth:visualViewport?.width,visualHeight:visualViewport?.height},
            scale:{width:window.game?.scale.width,height:window.game?.scale.height},
            scaleParent:{bounds:window.game?.scale.parent?.getBoundingClientRect().toJSON(),
                width:window.game?.scale.parentSize.width,height:window.game?.scale.parentSize.height,
                mode:window.game?.scale.scaleMode,dirty:window.game?.scale.dirty,
                style:window.game?.scale.parent?.getAttribute('style'),
                maxWidth:window.game?.scale.displaySize.maxWidth,maxHeight:window.game?.scale.displaySize.maxHeight},
            sceneSize:window.prototypeScene?.sceneSize,
            responsive:{destroyed:window.responsiveManager?.isDestroyed,lastSize:window.responsiveManager?.lastGameSize},
            mobileViewport:window.mobileViewportController?.update?.(),
            scenePaused:window.prototypeScene?.pauseMenuActive,
            sceneActive:window.prototypeScene?.scene.isActive(),
            completionActive:window.prototypeScene?.levelCompletionActive
        })).catch(()=>null);
    }
    process.exitCode=1;
}).finally(async()=>{await cleanup();report.cleanupComplete=true;fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,output}));});
