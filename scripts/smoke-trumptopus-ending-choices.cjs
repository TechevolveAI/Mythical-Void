#!/usr/bin/env node
// Narrow continuation proof: seed the win, then use the real repair/ending UI.
// This is not another full fight, physical-device test, or visual approval.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const {createCampaignProofHtml,completeCampaignEnding,ENDING_CHOICES,inspectEndingLayout}=require('./lib/trumptopus-campaign-proof.cjs');

async function main() {
    const root=path.resolve(__dirname,'..');
    const name=process.env.TRUMPTOPUS_PROOF_NAME||'trumptopus-ending-choices';
    assert(/^trumptopus-[a-z0-9-]+$/.test(name));
    const output=path.join(root,'.visual-review',name);
    assert(!fs.existsSync(path.join(output,'report.json')),'Do not overwrite a previous proof');
    fs.mkdirSync(output,{recursive:true});
    const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
    const report={sourceCommit:git('rev-parse','HEAD'),sourceDirty:Boolean(git('status','--porcelain')),
        kind:'real-ending-choice-ui-with-seeded-victory',syntheticVictorySetup:true,fullCampaignPlayed:false,
        renderer:'webgl',physicalDeviceTest:false,productionIntegrated:false,publicationAuthorized:false,
        paidGenerationCalls:0,journeys:[]};
    let browser,server,activePage;
    const cleanup=async()=>{try{await browser?.close();}finally{await server?.close();}};
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await cleanup();process.exit(1);});
    try {
        const {createServer}=await import('vite');
        server=await createServer({configFile:false,root,envDir:path.join(root,'.private-no-env'),
            define:{'import.meta.env.VITE_ENABLE_API_FEATURES':'"false"','import.meta.env.VITE_ENABLE_AI_PORTRAITS':'"false"',
                'import.meta.env.VITE_ENABLE_AI_VIDEOS':'"false"',__MYTHICAL_STATIC_CONTINUITY__:'true',__MYTHICAL_OBSERVABILITY_DELIVERY_ENABLED__:'false'},
            server:{host:'127.0.0.1',port:0,open:false},plugins:[{name:'private-ending-choices',configureServer(vite){
                vite.middlewares.use('/__ending-choices',(_,res)=>{res.setHeader('Content-Type','text/html');
                    res.end(createCampaignProofHtml({seededVictory:true}));});
            }}]});
        await server.listen();
        const base=`http://127.0.0.1:${server.httpServer.address().port}`;
        browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
        for(const [screen,width,height] of [['phone',390,844],['desktop',1280,720]])for(const priority of Object.keys(ENDING_CHOICES)) {
            const name=`${screen}-${priority.replaceAll('_','-')}`;
            const context=await browser.newContext({viewport:{width,height},hasTouch:screen==='phone',serviceWorkers:'block'});
            const page=await context.newPage();activePage=page;
            const errors=[],outside=[];report.inProgress={name,errors,outside};
            page.on('pageerror',error=>errors.push(error.stack||error.message));
            page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
            await page.route('**/*',route=>{
                const request=route.request();
                if(!request.url().startsWith(base)||request.method()!=='GET'||/\/api\/|\/\.netlify\//.test(request.url())) {
                    outside.push({url:request.url(),method:request.method()});return route.abort();
                }
                return route.continue();
            });
            await page.goto(`${base}/__ending-choices?renderer=webgl`);
            const ending=await completeCampaignEnding(page,output,name,{priority,exerciseRecovery:true});
            await page.screenshot({path:path.join(output,`${name}-returned-to-sanctuary.png`)});
            const state=await page.evaluate(()=>({priority:GameState.get('story.projectBeacon.finale.priority'),
                capsuleIntent:GameState.get('story.projectBeacon.legacyCapsule.intent'),
                levelsComplete:GameState.get('stats.levelsCompleted'),creatureUnchanged:window.fixtureUnchanged(),
                victorious:GameState.get('world.antagonistOutcomes.trumptopus.victories'),
                audioDisabled:window.game.config.audio.noAudio,
                leftoverDialogs:document.querySelectorAll('[role=dialog],video').length}));
            assert(state.creatureUnchanged);assert(state.audioDisabled);assert.equal(state.priority,priority);
            assert.equal(state.capsuleIntent,priority);
            assert.equal(state.victorious,1);assert.equal(state.levelsComplete,6);assert.equal(state.leftoverDialogs,0);
            await page.evaluate(()=>{window.game.scene.getScenes(true).forEach(scene=>scene.scene.stop());
                window.dispatchEvent(new Event('resize'));window.game.events.emit('focus');});
            await page.waitForTimeout(250);
            assert.deepEqual(errors,[]);assert.deepEqual(outside,[]);
            report.journeys.push({name,width,height,priority,ending,state,errors,outsideRequests:outside.length});
            delete report.inProgress;await context.close();
        }
        report.passed=true;
    } catch(error) {
        report.failure=error.stack;
        if(activePage&&!activePage.isClosed()) {
            report.failureLayout=await activePage.evaluate(inspectEndingLayout).catch(()=>null);
            report.failureState=await activePage.evaluate(()=>({finale:window.GameState?.get('story.projectBeacon.finale'),
                scenes:window.game?.scene.getScenes(true).map(scene=>scene.sys.settings.key)})).catch(()=>null);
            await activePage.screenshot({path:path.join(output,'failed-attempt.png')}).catch(()=>{});
        }
        throw error;
    } finally {
        await cleanup();report.browserAndServerClosed=true;
        fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
    }
    console.log(JSON.stringify({passed:report.passed,sourceCommit:report.sourceCommit,journeys:report.journeys.map(j=>j.name),output},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
