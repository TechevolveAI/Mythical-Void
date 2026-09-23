#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright');
const {createCampaignProofHtml} = require('./lib/trumptopus-campaign-proof.cjs');

async function main() {
    const root=path.resolve(__dirname,'..');
    const input=path.resolve(root,process.env.TRUMPTOPUS_FILM_OUTPUT||'.visual-review/trumptopus-authored-films');
    const output=path.join(input,'playback');
    assert(!fs.existsSync(path.join(output,'report.json')),'Do not overwrite earlier playback evidence');
    fs.mkdirSync(output,{recursive:true});
    const filmReport=JSON.parse(fs.readFileSync(path.join(input,'report.json'),'utf8'));
    assert(filmReport.passed&&!filmReport.stillsOnly,'Completed real film export required');
    const media=new Map();
    const config={enabled:true,encounterId:'trumptopus',films:{}};
    for(const [beat,film] of Object.entries(filmReport.films)) {
        const bytes=fs.readFileSync(path.join(input,film.filename));
        assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),film.sha256);
        const url=`/game/cinematics/trumptopus-private-${beat}.mp4`;
        media.set(url,bytes);
        // Private harness permission only, never a human/public approval record.
        config.films[beat]={approved:true,title:beat==='arrival'?'A World Held Apart':'Break His Grip',
            asset:{url,bytes:bytes.length,sha256:film.sha256,durationSeconds:film.durationSeconds}};
    }
    const report={sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
        sourceDirty:Boolean(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim()),
        filmSource:filmReport.sourceCommit,kind:'actual-authored-film-playback',humanApproved:false,
        productionIntegrated:false,physicalDeviceTest:false,seededBoundaries:true,journeys:[]};
    let browser,server,activePage;
    const cleanup=async()=>{try{await browser?.close();}finally{await server?.close();}};
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await cleanup();process.exit(1);});
    try {
        const {createServer}=await import('vite');
        server=await createServer({configFile:false,root,envDir:path.join(root,'.private-no-env'),
            define:{'import.meta.env.VITE_ENABLE_API_FEATURES':'"false"','import.meta.env.VITE_ENABLE_AI_PORTRAITS':'"false"',
                'import.meta.env.VITE_ENABLE_AI_VIDEOS':'"false"',__MYTHICAL_STATIC_CONTINUITY__:'true',__MYTHICAL_OBSERVABILITY_DELIVERY_ENABLED__:'false'},
            server:{host:'127.0.0.1',port:0,open:false},plugins:[{name:'real-authored-films',configureServer(vite){
                vite.middlewares.use((req,res,next)=>{
                    const url=new URL(req.url,'http://private.local');
                    if(media.has(url.pathname)) {
                        const bytes=media.get(url.pathname);res.setHeader('Content-Type','video/mp4');
                        res.setHeader('Content-Length',bytes.length);res.end(bytes);return;
                    }
                    if(url.pathname!=='/__authored-playback')return next();
                    const arrival=url.searchParams.get('beat')==='arrival';
                    res.setHeader('Content-Type','text/html');
                    res.end(createCampaignProofHtml({approach:arrival,sharedFilms:config,seededVictory:!arrival}));
                });
            }}]});
        await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`;
        browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
        for(const [name,width,height,beat,mode] of [
            ['phone-arrival',390,844,'arrival','normal'],['desktop-arrival',1280,720,'arrival','normal'],
            ['phone-victory',390,844,'victory','normal'],['desktop-victory',1280,720,'victory','normal'],
            ['phone-offline-arrival',390,844,'arrival','failed'],['phone-slow-arrival',390,844,'arrival','delayed']
        ]) {
            const context=await browser.newContext({viewport:{width,height},hasTouch:width===390,serviceWorkers:'block'});
            const page=await context.newPage();activePage=page;const errors=[],external=[],requests=[];
            page.on('pageerror',error=>errors.push(error.stack||error.message));
            page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
            await page.route('**/*',route=>{
                const req=route.request();requests.push(req.url());
                if(!req.url().startsWith(base+'/')||req.method()!=='GET'||/\/api\/|\/\.netlify\//.test(req.url())) {
                    external.push(req.url());return route.abort();
                }
                return route.continue();
            });
            const query=`?beat=${beat}${beat==='arrival'?'&boundary':''}${mode!=='normal'?'&'+mode:''}`;
            await page.goto(base+'/__authored-playback'+query);
            await page.waitForFunction(()=>window.prototypeScene?.isGrounded);
            if(beat==='arrival') {
                await page.keyboard.down('ArrowRight');
                await page.locator('.trumptopus-arrival').waitFor();await page.keyboard.up('ArrowRight');
            } else await page.getByRole('button',{name:'Repair the ship',exact:true}).waitFor();
            const before=await page.evaluate(()=>({coins:GameState.get('player.cosmicCoins'),items:GameState.get('inventory.items'),
                run:GameState.get('story.projectBeacon.trumptopus')}));
            let evidence={};
            if(mode==='delayed') {
                assert(await page.getByRole('button',{name:'Watch',exact:true}).isDisabled());
                await page.getByRole('button',{name:'Face Trumptopus',exact:true}).click();
                await page.waitForFunction(()=>prototypeScene.sys.settings.key==='TrumptopusPrototype'&&prototypeScene.sys.isActive());
                assert.equal(await page.evaluate(()=>window.arrivalFixtureFilm.state),'disposed');
                evidence={skipWhilePreparing:true};
            } else {
                if(mode==='failed')await page.getByRole('button',{name:'Retry film',exact:true}).click();
                await page.waitForFunction(beat=>prototypeScene.completion.films.isReady(beat),beat);
                await page.screenshot({path:path.join(output,name+'-ready.png')});
                const fetchCount=requests.filter(url=>url.endsWith('.mp4')).length;
                await page.getByRole('button',{name:'Watch',exact:true}).click();
                await page.waitForFunction(()=>document.querySelector('video')?.currentTime>1);
                const panel=page.locator('.prepared-film-player');
                evidence=await page.evaluate(()=>{
                    const video=document.querySelector('video'),canvas=document.createElement('canvas');canvas.width=96;canvas.height=54;
                    const ctx=canvas.getContext('2d');ctx.drawImage(video,0,0,96,54);const pixels=ctx.getImageData(0,0,96,54).data;
                    let visible=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]+pixels[i+1]+pixels[i+2]>30)visible++;
                    return {width:video.videoWidth,height:video.videoHeight,duration:video.duration,muted:video.muted,
                        time:video.currentTime,visibleFraction:visible/(96*54),scenePaused:prototypeScene.sys.isPaused()};
                });
                assert(evidence.muted&&evidence.scenePaused&&evidence.visibleFraction>.3);
                assert.equal(evidence.duration,config.films[beat].asset.durationSeconds);
                const layout=await panel.evaluate(root=>({overflow:root.scrollWidth>root.clientWidth,
                    buttons:[...root.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height};})}));
                assert(!layout.overflow);assert(layout.buttons.every(b=>b.left>=0&&b.right<=width&&b.top>=0&&b.bottom<=height&&b.height>=44));
                await page.screenshot({path:path.join(output,name+'-playing.png')});
                await panel.getByRole('button',{name:'Pause',exact:true}).click();
                const pausedTime=await page.evaluate(()=>document.querySelector('video').currentTime);
                await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>document.querySelector('video').currentTime),pausedTime);
                await panel.getByRole('button',{name:'Resume',exact:true}).click();
                await panel.getByRole('button',{name:'Watch again',exact:true}).waitFor({timeout:22000});
                await page.screenshot({path:path.join(output,name+'-ended.png')});
                await panel.getByRole('button',{name:'Watch again',exact:true}).click();
                await page.waitForFunction(()=>{const v=document.querySelector('video');return v?.currentTime>0&&v.currentTime<1;});
                assert.equal(requests.filter(url=>url.endsWith('.mp4')).length,fetchCount,'Watch/replay refetched video');
                await panel.getByRole('button',{name:'Continue',exact:true}).click();
                assert.equal(await page.locator('video,.prepared-film-player').count(),0);
                Object.assign(evidence,{layout,pauseResume:true,naturalEnd:true,replay:true,noRefetch:true,skipAfterReplay:true});
            }
            if(beat==='arrival') {
                // Closing the arrival player already hands into combat; no second confirmation.
                await page.waitForFunction(()=>prototypeScene.sys.settings.key==='TrumptopusPrototype'&&prototypeScene.isGrounded);
                const x=await page.evaluate(()=>prototypeScene.player.x);
                await page.keyboard.down('ArrowRight');await page.waitForFunction(x=>prototypeScene.player.x>x+15,x);await page.keyboard.up('ArrowRight');
            }
            const after=await page.evaluate(()=>({coins:GameState.get('player.cosmicCoins'),items:GameState.get('inventory.items'),
                run:GameState.get('story.projectBeacon.trumptopus')}));
            assert.equal(after.coins,before.coins);assert.deepEqual(after.items,before.items);
            assert.equal(after.run.status,before.run.status);assert.deepEqual(after.run.receipt,before.run.receipt);
            assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
            await page.screenshot({path:path.join(output,name+'-continued.png')});
            report.journeys.push({name,beat,mode,evidence,errors,externalRequests:external.length,rewardsUnchanged:true});
            await context.close();
        }
        report.passed=true;
    } catch(error) {
        report.failure=error.stack;
        if(activePage&&!activePage.isClosed())await activePage.screenshot({path:path.join(output,'failed.png')}).catch(()=>{});
        throw error;
    } finally {await cleanup();report.cleanupComplete=true;fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));}
    console.log(JSON.stringify({passed:report.passed,journeys:report.journeys.map(j=>j.name),output},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
