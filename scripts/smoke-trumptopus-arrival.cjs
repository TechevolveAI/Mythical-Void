#!/usr/bin/env node
// Existing Forest footage is a playback fixture only. No final media is approved here.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const {createCampaignProofHtml}=require('./lib/trumptopus-campaign-proof.cjs');
const {playApproach}=require('./lib/trumptopus-approach-proof.cjs');

async function main() {
    const root=path.resolve(__dirname,'..'),output=path.join(root,'.visual-review/trumptopus-arrival');
    fs.mkdirSync(output,{recursive:true});
    const bytes=fs.readFileSync(path.join(root,'public/game/cinematics/mythical-forest-arrival-loop.mp4'));
    const asset={url:'/game/cinematics/mythical-forest-arrival-loop.mp4',bytes:bytes.length,
        sha256:crypto.createHash('sha256').update(bytes).digest('hex'),durationSeconds:8};
    const report={kind:'private-arrival-watch-handoff',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
        sourceDirty:Boolean(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim()),
        fixtureFilm:asset,finalArtwork:false,finalFilm:false,physicalDeviceTest:false,productionIntegrated:false,journeys:[]};
    let server,browser,activePage;
    const cleanup=async()=>{try{await browser?.close();}finally{await server?.close();}};
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await cleanup();process.exit(1);});
    try {
        const {createServer}=await import('vite');
        server=await createServer({configFile:false,root,envDir:path.join(root,'.private-no-env'),
            define:{'import.meta.env.VITE_ENABLE_API_FEATURES':'"false"','import.meta.env.VITE_ENABLE_AI_PORTRAITS':'"false"',
                'import.meta.env.VITE_ENABLE_AI_VIDEOS':'"false"',__MYTHICAL_STATIC_CONTINUITY__:'true',__MYTHICAL_OBSERVABILITY_DELIVERY_ENABLED__:'false'},
            server:{host:'127.0.0.1',port:0,open:false},plugins:[{name:'private-arrival-proof',configureServer(vite){
                vite.middlewares.use('/__arrival-proof',(_,res)=>{res.setHeader('Content-Type','text/html');res.end(createCampaignProofHtml({approach:true,arrivalFixture:asset}));});
            }}]});
        await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`;
        browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
        for(const [name,width,height,query] of [
            ['phone',390,844,''],['desktop',1280,720,''],['delayed-skip',390,844,'?boundary&delayed'],
            ['retry',390,844,'?boundary&failed'],['no-film',390,844,'?boundary&absent'],['refresh',390,844,'?boundary']
        ]) {
            const context=await browser.newContext({viewport:{width,height},hasTouch:width===390,serviceWorkers:'block'});
            const page=await context.newPage();activePage=page;const errors=[],requests=[];
            report.inProgress={name,errors};
            page.on('pageerror',error=>errors.push(error.stack||error.message));
            page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
            await page.route('**/*',route=>{
                const request=route.request();requests.push({url:request.url(),method:request.method()});
                if(!request.url().startsWith(base)||request.method()!=='GET'||/\/api\/|\/\.netlify\//.test(request.url())) {
                    errors.push(`Unexpected service: ${request.url()}`);return route.abort();
                }
                return route.continue();
            });
            await page.goto(`${base}/__arrival-proof${query}`);
            await page.waitForFunction(()=>window.prototypeScene?.player?.body);
            let handoff,routeEvidence=null;
            async function arrival() {
                const panel=page.locator('.trumptopus-arrival');await panel.waitFor();
                const before=await page.evaluate(()=>({x:prototypeScene.player.x,y:prototypeScene.player.y,
                    time:prototypeScene.completion.elapsedMs,coins:GameState.get('player.cosmicCoins'),run:prototypeScene.completion.run}));
                await page.evaluate(()=>window.game.events.emit('focus'));
                await page.keyboard.down('ArrowRight');await page.waitForTimeout(250);await page.keyboard.up('ArrowRight');
                const frozen=await page.evaluate(()=>({x:prototypeScene.player.x,y:prototypeScene.player.y,time:prototypeScene.completion.elapsedMs,
                    paused:prototypeScene.sys.isPaused(),run:GameState.get('story.projectBeacon.trumptopus')}));
                assert(frozen.paused);assert.equal(frozen.x,before.x);assert.equal(frozen.y,before.y);assert.equal(frozen.time,before.time);
                assert.equal(frozen.run.status,'fighting');assert.equal(frozen.run.receipt,null);assert.equal(frozen.run.approach.arrived,true);
                const layout=await panel.evaluate(root=>({noOverflow:root.scrollWidth<=root.clientWidth,buttons:[...root.querySelectorAll('button')].map(b=>{
                    const r=b.getBoundingClientRect();return {text:b.textContent,left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height};
                })}));
                assert(layout.noOverflow);assert(layout.buttons.every(b=>b.left>=0&&b.right<=width&&b.top>=0&&b.bottom<=height&&b.height>=44));
                let playback=null;
                if(name==='delayed-skip') {
                    assert(await panel.getByRole('button',{name:'Watch',exact:true}).isDisabled());
                    await page.screenshot({path:path.join(output,`${name}-cue.png`)});
                    await panel.getByRole('button',{name:'Face Trumptopus',exact:true}).click();
                } else if(name==='refresh') {
                    await page.reload();
                } else {
                    if(name==='retry') {
                        await panel.getByRole('button',{name:'Retry film',exact:true}).click();
                    }
                    await page.waitForFunction(()=>prototypeScene.completion.films.isReady('arrival'));
                    await page.screenshot({path:path.join(output,`${name}-cue.png`)});
                    const fetches=await page.evaluate(()=>window.arrivalFixtureFetches);
                    await panel.getByRole('button',{name:'Watch',exact:true}).click();
                    await page.waitForFunction(()=>document.querySelector('video')?.currentTime>0.35);
                    playback=await page.evaluate(()=>{
                        const video=document.querySelector('video'),canvas=document.createElement('canvas');canvas.width=96;canvas.height=54;
                        const ctx=canvas.getContext('2d');ctx.drawImage(video,0,0,96,54);const data=ctx.getImageData(0,0,96,54).data;
                        let visible=0;for(let i=0;i<data.length;i+=4)if(data[i]+data[i+1]+data[i+2]>30)visible++;
                        return {muted:video.muted,time:video.currentTime,visibleFraction:visible/(96*54),scenePaused:prototypeScene.sys.isPaused()};
                    });
                    assert(playback.muted&&playback.scenePaused&&playback.visibleFraction>0.15);
                    assert.equal(await page.evaluate(()=>window.arrivalFixtureFetches),fetches,'Watch started another fetch');
                    await page.screenshot({path:path.join(output,`${name}-playing-fixture.png`)});
                    await page.getByRole('button',{name:'Continue',exact:true}).click();
                }
                await page.waitForFunction(()=>window.prototypeScene?.sys.settings.key==='TrumptopusPrototype'&&window.prototypeScene.sys.isActive());
                assert.equal(await page.locator('[role=dialog],video').count(),0);
                if(name==='delayed-skip') {
                    assert.equal(await page.evaluate(()=>window.arrivalFixtureFilm.state),'disposed');
                    await page.evaluate(()=>window.releaseArrivalFixture());
                }
                const after=await page.evaluate(()=>({coins:GameState.get('player.cosmicCoins'),run:GameState.get('story.projectBeacon.trumptopus')}));
                assert.equal(after.coins,before.coins);assert.equal(after.run.status,'fighting');assert.equal(after.run.receipt,null);
                handoff={before,frozen,layout,playback,after,pausedUntilContinue:true,noRefetchOnWatch:Boolean(playback)};
            }
            if(!query)routeEvidence=await playApproach(page,context,output,name,{onArrival:arrival});
            else {
                // Boundary cases seed two completed grips, then walk on the real road into the real cue.
                await page.waitForFunction(()=>prototypeScene.isGrounded);
                await page.keyboard.down('ArrowRight');
                await page.waitForFunction(()=>prototypeScene?.arrivalCue?.root||prototypeScene?.sys.settings.key==='TrumptopusPrototype');
                await page.keyboard.up('ArrowRight');
                if(name==='no-film') {
                    assert.equal(await page.locator('[role=dialog]').count(),0);
                    assert.equal(await page.evaluate(()=>window.arrivalFixtureFetches),0);
                } else await arrival();
            }
            await page.waitForFunction(()=>prototypeScene.sys.settings.key==='TrumptopusPrototype'&&prototypeScene.isGrounded);
            const startX=await page.evaluate(()=>prototypeScene.player.x);
            await page.keyboard.down('ArrowRight');
            await page.waitForFunction(x=>prototypeScene.player.x>x+20,startX);
            await page.keyboard.up('ArrowRight');
            await page.screenshot({path:path.join(output,`${name}-arena.png`)});
            assert.deepEqual(errors,[]);
            report.journeys.push({name,width,height,seededApproachBoundary:Boolean(query),routeEvidence,handoff,
                fightControlsRespond:true,externalRequests:0,errors,filmRequests:requests.filter(r=>r.url.endsWith('.mp4')).length});
            delete report.inProgress;await context.close();
        }
        report.passed=true;
    } catch(error) {
        report.failure=error.stack;
        if(activePage&&!activePage.isClosed())await activePage.screenshot({path:path.join(output,'failed-attempt.png')}).catch(()=>{});
        throw error;
    } finally {
        await cleanup();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
    }
    console.log(JSON.stringify({passed:report.passed,journeys:report.journeys.map(j=>j.name),output},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
