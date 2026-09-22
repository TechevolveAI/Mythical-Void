#!/usr/bin/env node
// Private real-input mechanics proof. All owned media and browsers are silent.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const { chromium } = require('playwright');
const { createProofHtml } = require('./smoke-trumptopus-grip.cjs');
const { createCampaignProofHtml, completeCampaignEnding } = require('./lib/trumptopus-campaign-proof.cjs');
const { playApproach } = require('./lib/trumptopus-approach-proof.cjs');
const { startBanishmentCapture } = require('./lib/trumptopus-banishment-proof.cjs');

async function main() {
    const root = path.resolve(__dirname, '..');
    const artwork = process.env.TRUMPTOPUS_ART_PROOF === '1';
    const renderer=process.env.TRUMPTOPUS_RENDERER==='webgl'?'webgl':'canvas';
    const framing = process.env.TRUMPTOPUS_FRAMING_PROOF === '1';
    const approach = framing || process.env.TRUMPTOPUS_APPROACH_PROOF === '1';
    const campaign = approach || process.env.TRUMPTOPUS_CAMPAIGN_PROOF === '1';
    const proofName = process.env.TRUMPTOPUS_PROOF_NAME || (framing ? 'trumptopus-framing' : approach ? 'trumptopus-approach' : campaign ? 'trumptopus-campaign' : 'trumptopus-three-phase');
    assert(/^trumptopus-[a-z0-9-]+$/.test(proofName), 'Proof output must be a private Trumptopus folder name');
    const output = path.join(root, '.visual-review', proofName);
    assert(!fs.existsSync(path.join(output,'report.json')),'Do not overwrite an existing private proof');
    fs.mkdirSync(output, { recursive: true });
    const report = { kind: campaign ? 'real-fight-to-campaign-ending' : artwork ? 'three-phase-source-art' : 'three-phase-greybox', finalArtwork: false,
        suppliedImageRig:artwork||campaign,
        renderer,
        privateCampaignAdapterProved: campaign, productionIntegrated: false,
        fixturePriorLevels: campaign, approachIncluded:approach, physicalDeviceTest: false, journeys: [],
        sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
        sourceDirty:Boolean(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim()) };
    let server, browser, activePage;
    const cleanup = async () => { try { await browser?.close(); } finally { await server?.close(); } };
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await cleanup(); process.exit(1); });
    try {
        const { createServer } = await import('vite');
        server = await createServer({ configFile: false, root, envDir: path.join(root,'.private-no-env'),
            define:{'import.meta.env.VITE_ENABLE_API_FEATURES':'"false"','import.meta.env.VITE_ENABLE_AI_PORTRAITS':'"false"','import.meta.env.VITE_ENABLE_AI_VIDEOS':'"false"',__MYTHICAL_STATIC_CONTINUITY__:'true',__MYTHICAL_OBSERVABILITY_DELIVERY_ENABLED__:'false'},
            server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{
            name: 'private-finale', configureServer(vite) {
                vite.middlewares.use('/__finale-proof', (_, res) => { res.setHeader('Content-Type', 'text/html'); res.end(campaign ? createCampaignProofHtml({approach}) : createProofHtml({ finale: true, artwork })); });
            }
        }] });
        await server.listen();
        const base = `http://127.0.0.1:${server.httpServer.address().port}`;
        browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
        for (const [name, width, height] of [['phone', 390, 844], ['desktop', 1280, 720]]) {
            const context = await browser.newContext({ viewport: { width, height }, hasTouch: name === 'phone', serviceWorkers: 'block' });
            const page = await context.newPage(); activePage = page;
            const errors = [], requests = [], exchanges = [];
            report.inProgress = { name, errors, exchanges };
            page.on('pageerror', error => errors.push(error.stack || error.message));
            page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
            await page.addInitScript(campaign => {
                window.storageWrites = 0;
                for (const method of ['setItem', 'removeItem', 'clear']) {
                    const original=Storage.prototype[method];
                    Storage.prototype[method]=function(...args){window.storageWrites++;if(campaign)return original.apply(this,args);throw Error('Proof attempted persistent storage');};
                }
            },campaign);
            await page.route('**/*', route => {
                const request = route.request(); requests.push({ url: request.url(), method: request.method() });
                if (!request.url().startsWith(base) || request.method() !== 'GET' || /\/api\/|\/\.netlify\//.test(request.url())) {
                    errors.push(`Unexpected service: ${request.url()}`); return route.abort();
                }
                return route.continue();
            });
            await page.goto(`${base}/__finale-proof?renderer=${renderer}`);
            await page.waitForFunction(() => window.prototypeScene?.player?.body);
            const routeEvidence = approach ? await playApproach(page,context,output,name,{framing}) : null;
            const rigTextureCount=()=>page.evaluate(()=>window.game.textures.getTextureKeys().filter(key=>key.startsWith('trumptopus-fight-')).length);
            const stageTextureCount=()=>page.evaluate(()=>window.game.textures.getTextureKeys().filter(key=>key.startsWith('trumptopus-stage-')).length);
            if(artwork||campaign)assert.equal(await rigTextureCount(),13,'Unexpected rig texture ownership');
            if(artwork||campaign)assert.equal(await stageTextureCount(),4,'Expected sky, floor, dais and prop atlas');
            await page.evaluate(() => {
                window.proofJumpInputs = [];
                window.proofAttackInputs = [];
                const record = destination => {
                    const scene = window.prototypeScene, snapshot = scene.encounter.snapshot();
                    destination.push({ state:snapshot.state, attack:snapshot.attack,
                        progress:snapshot.progress, bottom:scene.player.body.bottom,
                        damageCount:scene.damageEvidence.length });
                };
                document.addEventListener('keydown', event => {
                    if (event.code === 'Space') record(window.proofJumpInputs);
                    if (event.code === 'KeyM') record(window.proofAttackInputs);
                }, true);
                document.addEventListener('pointerdown', event => {
                    const jump = window.prototypeScene.mobileControlTargets?.jump;
                    if (jump && Math.hypot(event.clientX - jump.x, event.clientY - 42 - jump.y) <= jump.radius) record(window.proofJumpInputs);
                }, true);
            });
            const state = () => page.evaluate(() => window.prototypeScene.getProofState());
            const waitState = expected => page.waitForFunction(value => window.prototypeScene.encounter.state === value, expected, { timeout: 15000 });
            const cdp = name === 'phone' ? await context.newCDPSession(page) : null;
            async function direction(value) {
                if (cdp) {
                    const { joystick } = await state(); const x = joystick.x, y = joystick.y + 42;
                    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
                    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + value * 42, y }] });
                } else await page.keyboard.down(value > 0 ? 'ArrowRight' : 'ArrowLeft');
            }
            async function release() {
                if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                else { await page.keyboard.up('ArrowRight'); await page.keyboard.up('ArrowLeft'); }
            }
            async function moveTo(x) {
                const before = await state(); const sign = Math.sign(x - before.player.x);
                if (Math.abs(x - before.player.x) < 8) return;
                await direction(sign);
                await page.waitForFunction(({ x, sign }) => sign * (window.prototypeScene.player.x - x) >= 0, { x, sign }, { timeout: 5000 });
                await release();
            }
            async function face(sign) { await direction(sign); await page.waitForTimeout(65); await release(); }
            async function jump() {
                if (name === 'phone') { const { jump } = (await state()).controls; await page.touchscreen.tap(jump.x, jump.y + 42); }
                else await page.keyboard.down('Space');
                await page.waitForFunction(() => window.prototypeScene.player.body.velocity.y < -50);
                if (name === 'desktop') await page.keyboard.up('Space');
            }
            async function attack() {
                if (name === 'phone') { const { melee } = (await state()).controls; await page.touchscreen.tap(melee.x, melee.y + 42); }
                else await page.keyboard.press('m');
            }
            await moveTo(195);
            await page.click('#pause');
            const paused = await state(); await page.waitForTimeout(300);
            assert.equal((await state()).elapsed, paused.elapsed);
            await page.click('#pause');
            await page.evaluate(() => {
                const scene=window.prototypeScene,cache=new Map();
                const recordingStarted=performance.now();
                window.actorSpacing={samples:0,minimumGap:null,offscreenSamples:0,minimum:null};
                window.arenaPropEvidence={samples:0,violations:[],liftSamples:0,retractSamples:0};
                const bounds=sprite=>{
                    const key=sprite.texture.key;
                    if(!cache.has(key)){
                        const source=sprite.texture.getSourceImage(),canvas=document.createElement('canvas');
                        canvas.width=source.width;canvas.height=source.height;
                        const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0);
                        const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
                        const box={left:canvas.width,right:0,top:canvas.height,bottom:0};
                        for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>16){
                            box.left=Math.min(box.left,x);box.right=Math.max(box.right,x+1);
                            box.top=Math.min(box.top,y);box.bottom=Math.max(box.bottom,y+1);
                        }
                        cache.set(key,box);
                    }
                    const box=cache.get(key),left=sprite.flipX?sprite.width-box.right:box.left;
                    const right=left+box.right-box.left,matrix=sprite.getWorldTransformMatrix();
                    const corners=[[left,box.top],[right,box.top],[right,box.bottom],[left,box.bottom]].map(([x,y])=>
                        matrix.transformPoint(x-sprite.displayOriginX,y-sprite.displayOriginY));
                    return {left:Math.min(...corners.map(p=>p.x)),right:Math.max(...corners.map(p=>p.x)),
                        top:Math.min(...corners.map(p=>p.y)),bottom:Math.max(...corners.map(p=>p.y))};
                };
                const sample=()=>{
                    if(!scene.player?.active||!scene.astronautFollower?.sprite?.active)return;
                    const creature=bounds(scene.player),ally=bounds(scene.astronautFollower.sprite);
                    const gap=Math.hypot(Math.max(0,creature.left-ally.right,ally.left-creature.right),
                        Math.max(0,creature.top-ally.bottom,ally.top-creature.bottom));
                    const evidence=window.actorSpacing;evidence.samples++;
                    const state=scene.encounter.snapshot();
                    if(scene.arenaStage){
                        const props=scene.arenaStage.getPropEvidence(),propEvidence=window.arenaPropEvidence;
                        propEvidence.samples++;
                        for(const prop of props){
                            const aligned=Object.keys(prop.art).every(key=>Math.abs(prop.art[key]-prop.collision[key])<.001);
                            if(!aligned||!prop.sourceHidden||!prop.floorOccludesBuriedSection||prop.visible!==(prop.aboveFloor>0)){
                                if(propEvidence.violations.length<10)propEvidence.violations.push({state:state.state,...prop});
                            }
                            if(prop.name==='rising-foothold'&&prop.visible&&!prop.enabled)propEvidence.liftSamples++;
                            if(prop.name==='exit-stone'&&prop.aboveFloor>0&&prop.aboveFloor<prop.collision.height)propEvidence.retractSamples++;
                        }
                    }
                    if(evidence.minimumGap===null||gap<evidence.minimumGap){
                        evidence.minimumGap=gap;evidence.minimum={creature,ally,mode:state.mode,attack:state.attack,state:state.state,
                            recordingMs:performance.now()-recordingStarted,leap:scene.allyLeap?{...scene.allyLeap}:null,
                            striking:scene.astronautFollower.isStriking};
                    }
                    if([creature,ally].some(b=>b.left<0||b.right>scene.scale.width||b.top<0||b.bottom>scene.scale.height)){
                        evidence.offscreenSamples++;
                        evidence.firstOffscreen??={creature,ally,recordingMs:performance.now()-recordingStarted,
                            mode:state.mode,state:state.state,attack:state.attack,striking:scene.astronautFollower.isStriking,
                            leap:scene.allyLeap?{...scene.allyLeap}:null};
                    }
                    window.currentActorSpacing={gap,creature,ally};
                };
                window.game.events.on('poststep',sample);
                window.stopActorSpacing=()=>window.game.events.off('poststep',sample);
                const chunks = [], stream = window.game.canvas.captureStream(24);
                if(stream.getAudioTracks().length)throw Error('Unexpected proof audio track');
                const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 1500000 });
                recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
                window.stopProofRecording = () => new Promise(resolve => {
                    recorder.onstop = async () => {
                        const data = new Uint8Array(await new Blob(chunks, {type:'video/webm'}).arrayBuffer());
                        stream.getTracks().forEach(track => track.stop());
                        let binary = ''; for (const byte of data) binary += String.fromCharCode(byte);
                        resolve(btoa(binary));
                    }; recorder.stop();
                }); recorder.start(200);
            });
            if(artwork||campaign)await page.evaluate(startBanishmentCapture);
            const captured = new Set();
            let retriedPhase = false;
            for (let attempt = 0; attempt < 20 && !(await state()).completionReady; attempt++) {
                await waitState('windup');
                let locked = await state();
                if (locked.phaseIndex === 1 && !retriedPhase) {
                    const checkpoint = locked.checkpoint;
                    await page.click('#retry');
                    await page.waitForFunction(needsArt => {
                        const scene=window.prototypeScene;
                        return scene.scene.isActive()&&scene.player?.body&&scene.encounter.state==='phase_intro'&&
                            (!needsArt||scene.characterRig?.root?.active);
                    },artwork||campaign);
                    const retried = await state();
                    if(artwork||campaign)assert.equal(await rigTextureCount(),13,'Retry leaked rig textures');
                    if(artwork||campaign)assert.equal(await stageTextureCount(),4,'Retry leaked stage textures');
                    assert.deepEqual(retried.checkpoint, checkpoint);
                    assert.equal(retried.phaseHealth, 8);
                    retriedPhase = true;
                    await moveTo(195); await waitState('windup'); locked = await state();
                }
                if (!captured.has(locked.attack)) {
                    await page.screenshot({ path: path.join(output, `${name}-${locked.attack}-warning.png`) });
                    captured.add(locked.attack);
                }
                const damageBefore = locked.damage.length;
                if (locked.attack === 'sweep') {
                    await moveTo(195);
                    // React to the readable wind-up, allowing native input delivery
                    // time. Ordinary -420/500 movement spans the remaining sweep.
                    await page.waitForFunction(() => {
                        const snapshot = window.prototypeScene.encounter.snapshot();
                        return snapshot.state === 'windup' && snapshot.progress >= 0.55;
                    });
                    await jump();
                    await page.screenshot({ path: path.join(output, `${name}-sweep-jump.png`) });
                    await waitState('exposed');
                    await page.waitForFunction(() => window.prototypeScene.isGrounded);
                    await face(-1);
                } else {
                    const destination = locked.targetX + 100 < width - 85 ? locked.targetX + 100 : locked.targetX - 100;
                    await moveTo(destination);
                    await face(destination > locked.targetX ? -1 : 1);
                    await waitState('exposed');
                }
                const exposed = await state();
                const spacing=await page.evaluate(()=>window.currentActorSpacing);
                if((artwork||campaign)&&!captured.has(`${locked.attack}-contact`)){
                    await page.screenshot({path:path.join(output,`${name}-${locked.attack}-contact.png`)});
                    captured.add(`${locked.attack}-contact`);
                }
                if(artwork||campaign){
                    assert.equal(exposed.sourceArtRig?.layerCount,10,'Supplied artwork is absent from the fight');
                    assert.equal(exposed.sourceArtRig.attackHands.length,locked.attack==='closing_grasp'?2:1);
                    for(const hand of exposed.sourceArtRig.attackHands){
                        assert(hand.elbowGap<0.001&&hand.wristGap<0.001,'Detached attacking limb');
                        assert(Math.abs(hand.visibleBottom-(hand.palm.y+hand.palm.height/2))<0.01,'Claw contact differs from collision');
                        assert(Math.abs(hand.visibleLeft-(hand.palm.x-hand.palm.width/2))<0.01,'Claw left edge differs from collision');
                        assert(Math.abs(hand.visibleRight-(hand.palm.x+hand.palm.width/2))<0.01,'Claw right edge differs from collision');
                    }
                }
                assert.equal(exposed.damage.length, damageBefore, `${locked.attack} was not dodged`);
                assert.equal(exposed.targetX, locked.targetX, 'Committed grab followed the player');
                for (let press = 0; press < 5 && (await state()).state === 'exposed'; press++) { await attack(); await page.waitForTimeout(380); }
                const countered = await state();
                assert(countered.health < exposed.health, `No real ${name} attack reached ${locked.attack}`);
                exchanges.push({ phase: locked.phaseIndex + 1, attack: locked.attack, damageBefore, damageAfter: countered.damage.length, healthBefore: exposed.health, healthAfter: countered.health, spacing });
                if (!captured.has(`${locked.phaseIndex}-countered`)) {
                    await page.screenshot({ path: path.join(output, `${name}-phase-${locked.phaseIndex + 1}-countered.png`) });
                    captured.add(`${locked.phaseIndex}-countered`);
                }
                await page.waitForFunction(() => !['exposed', 'recoil'].includes(window.prototypeScene.encounter.state));
            }
            const banishmentFrames=[];
            if(artwork||campaign){
                await page.waitForFunction(()=>window.banishmentCapture.error||window.banishmentCapture.frames.length===4,
                    undefined,{timeout:5000});
                const capture=await page.evaluate(()=>({error:window.banishmentCapture.error,frames:window.banishmentCapture.frames}));
                assert.equal(capture.error,null);
                assert.equal(capture.frames.length,4);
                for(const frame of capture.frames){
                    if(frame.target<.8){
                        assert.equal(frame.rig.rootAlpha,1,'Banishment fades instead of moving the intact boss');
                        assert(frame.rig.rootScale<frame.rig.restScale,'Boss did not recede into the Void');
                        assert(frame.rig.rootRotation<0,'Boss did not react to the pull');
                    }
                    const {png,...metadata}=frame;
                    fs.writeFileSync(path.join(output,`${name}-banishment-${Math.round(frame.target*100)}.png`),Buffer.from(png,'base64'));
                    banishmentFrames.push({...metadata,capture:'postrender-canvas-no-toolbar'});
                }
            }
            await waitState('aftermath');
            const finished = await state();
            assert.equal(finished.health, 0); assert.equal(finished.gateEnabled, false);
            assert(finished.phaseEvidence.some(event => event.type === 'creature-answer'));
            assert.equal(finished.phaseEvidence.filter(event => event.type === 'final-strike').length, 1);
            assert.equal(finished.phaseEvidence.filter(event => event.type === 'banished').length, 1);
            assert(retriedPhase); assert.equal(finished.causeway.enabled, true);
            assert.equal(finished.causeway.bodyTop, finished.causeway.artTop);
            if(artwork||campaign)assert.equal(finished.floorContact.bodyTop,finished.floorContact.artTop,'Ground art and physics differ');
            if(artwork||campaign){
                assert.equal(finished.stageMaterial.tiled,false,'Arena floor returned to repeating landscape strips');
                assert(finished.stageTextureRgbaBytes<4*1024*1024,'Arena scenery exceeds 4 MiB RGBA');
            }
            assert(Math.abs(finished.player.bottom - finished.floorY) < 2);
            await page.screenshot({ path: path.join(output, `${name}-aftermath.png`) });
            const motion = await page.evaluate(() => window.stopProofRecording());
            fs.writeFileSync(path.join(output, `${name}-three-phase-silent.webm`), Buffer.from(motion, 'base64'));
            const integrity = await page.evaluate(() => ({saveWrites:window.saveWrites,storageWrites:window.storageWrites,unchanged:window.fixtureUnchanged()}));
            const actorSpacing=await page.evaluate(()=>{window.stopActorSpacing();return window.actorSpacing;});
            const arenaPropEvidence=await page.evaluate(()=>window.arenaPropEvidence);
            report.inProgress.actorSpacing=actorSpacing;
            const presentationPreflight={
                method:'Rendered alpha bounds (>16/255), including world rotation/scale/flip; conservative axis-aligned envelopes sampled each game step, not pixel-perfect overlap or human approval',
                minimumRequiredGap:24,allMovementSeparated:actorSpacing.minimumGap>=24,
                contactMomentsSeparated:exchanges.every(exchange=>exchange.spacing.gap>=24),
                actorsOnscreen:actorSpacing.offscreenSamples===0
            };
            if(artwork||campaign){
                assert(presentationPreflight.allMovementSeparated,`Actor gap ${actorSpacing.minimumGap}px is below 24px during movement`);
                assert(presentationPreflight.contactMomentsSeparated,'Attack contact actor gap is below 24px');
                assert(presentationPreflight.actorsOnscreen,'An actor left the canvas');
                assert(arenaPropEvidence.samples>0&&arenaPropEvidence.liftSamples>0&&arenaPropEvidence.retractSamples>0,
                    'Moving arena props were not observed');
                assert.deepEqual(arenaPropEvidence.violations,[],'Arena prop art differs from collision or floor occlusion');
                assert.equal(finished.arenaProps.find(prop=>prop.name==='exit-stone').visible,false,'Released exit stone remains visible');
            }
            if(campaign) assert(integrity.unchanged&&integrity.storageWrites>0);
            else assert.deepEqual(integrity, {saveWrites:0,storageWrites:0,unchanged:true});
            const ending=campaign ? await completeCampaignEnding(page,output,name) : null;
            await page.evaluate(() => { window.game.scene.getScenes(true).forEach(scene=>scene.scene.stop()); window.dispatchEvent(new Event('resize')); window.game.events.emit('focus'); });
            await page.waitForTimeout(250);
            assert.equal(await page.evaluate(() => window.prototypeScene.encounter.disposed), true);
            if(artwork||campaign)assert.equal(await rigTextureCount(),0,'Shutdown retained rig textures');
            if(artwork||campaign)assert.equal(await stageTextureCount(),0,'Shutdown retained stage textures');
            assert.deepEqual(errors, []);
            const jumpInputs = await page.evaluate(() => window.proofJumpInputs);
            const attackInputs = await page.evaluate(() => window.proofAttackInputs);
            report.journeys.push({name,width,height,routeEvidence,exchanges,jumpInputs,attackInputs,finished,banishmentFrames,actorSpacing,arenaPropEvidence,presentationPreflight,integrity,ending,pausedSafely:true,retryKeptPhase:true,externalRequests:0,errors});
            delete report.inProgress;
            await context.close();
        }
        report.passed = true;
    } catch (error) {
        report.failure = error.stack;
        if (activePage && !activePage.isClosed()) {
            report.failureState = await activePage.evaluate(() => window.prototypeScene?.getProofState()).catch(() => null);
            report.failureInputTrace = await activePage.evaluate(() => window.approachJumpTrace || null).catch(() => null);
            report.failureFraming = await activePage.evaluate(() => window.completedFramingSample || null).catch(() => null);
            report.failureJumpInputs = await activePage.evaluate(() => window.proofJumpInputs || []).catch(() => null);
            report.failureAttackInputs = await activePage.evaluate(() => window.proofAttackInputs || []).catch(() => null);
            await activePage.screenshot({path:path.join(output,'failed-attempt.png')}).catch(() => {});
        }
        throw error;
    } finally {
        await cleanup();
        report.browserAndServerClosed=true;
        fs.writeFileSync(path.join(output,'report.json'), JSON.stringify(report,null,2));
    }
    console.log(JSON.stringify({passed:report.passed,journeys:report.journeys.map(({name,exchanges})=>({name,exchanges:exchanges.length})),output},null,2));
}
main().catch(error => {console.error(error);process.exitCode=1;});
