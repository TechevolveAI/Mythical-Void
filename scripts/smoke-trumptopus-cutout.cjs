#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const runtime = createRequire(path.join(root, '.visual-review/trumptopus-rig-runtime/package.json'));
const { chromium } = runtime('playwright');
const phaser = path.join(path.dirname(runtime.resolve('phaser/package.json')), 'dist/phaser.js');
const proofName = process.env.TRUMPTOPUS_CUTOUT_PROOF || 'trumptopus-source-rig';
assert(/^trumptopus-source-rig(?:-[a-z0-9-]+)?$/.test(proofName), 'Invalid private proof name');
const output = path.join(root, '.visual-review', proofName);
const original = path.join(root, 'src/dev/assets/trumptopus/source-original.png');
const asset = path.join(root, 'src/dev/assets/trumptopus/source-foreground.png');
const poses = ['rest','load','reach','contact','recover'];
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Private source-art rig</title><style>html,body{margin:0;background:#20282d;overflow:hidden}canvas{display:block}header{position:fixed;left:0;right:0;bottom:0;height:42px;display:flex;gap:8px;justify-content:center;align-items:center;background:#11171c;color:#ddd;font:12px Arial}button{background:#35424a;color:white;border:1px solid #71878b;height:30px}</style></head><body><div id="game"></div><header><span>PRIVATE ART RIG</span><button id="play">Play</button><button id="rest">Rest</button></header><script src="/phaser.js"></script><script type="module">
import Rig from '/src/dev/TrumptopusCutoutRig.js';
let active=false,started=0;
class Study extends Phaser.Scene {
 preload(){this.load.image('source','/source.png');}
 create(){
  const w=this.scale.width,h=this.scale.height;const floor=h-62;
  this.cameras.main.setBackgroundColor('#20282d');
  this.add.rectangle(w/2,floor+31,w,62,0x303b3d);
  this.add.ellipse(w/2,floor+2,Math.min(230,w*.57),12,0x080b0c,.6);
  const height=Math.min(h-128,(w-40)/.635);
  window.rig=new Rig(this,this.textures.get('source').getSourceImage(),{x:w/2,floorY:floor,height});
  window.study=this;
  window.proofReady=true;
 }
 update(time){if(!active)return;const phases=['rest','load','reach','contact','recover'];const elapsed=(time-started)%7000;const i=Math.floor(elapsed/1400);window.rig.setPose(phases[i],(elapsed-i*1400)/1400);}
}
window.game=new Phaser.Game({type:new URLSearchParams(location.search).get('renderer')==='canvas'?Phaser.CANVAS:Phaser.WEBGL,parent:'game',width:innerWidth,height:innerHeight-42,audio:{noAudio:true},scene:Study});
window.pose=(name,p=1)=>{active=false;window.rig.setPose(name,p);return window.rig.getEvidence();};
document.querySelector('#play').onclick=()=>{started=window.study.time.now;active=true;};
document.querySelector('#rest').onclick=()=>window.pose('rest');
window.disposeProof=()=>{active=false;window.rig.destroy();window.game.destroy(true);};
</script></body></html>`;

async function main() {
    assert(!fs.existsSync(path.join(output, 'report.json')), 'Do not overwrite a prior proof');
    fs.mkdirSync(output, { recursive: true });
    const git = (...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
    const report = { sourceCommit:git('rev-parse','HEAD'),sourceTree:git('rev-parse','HEAD^{tree}'),
        cleanSourceAtCapture:git('--no-optional-locks','status','--porcelain')==='',
        sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(original)).digest('hex'),
        extractedSha256: crypto.createHash('sha256').update(fs.readFileSync(asset)).digest('hex'),
        privateOnly:true, productionChanged:false, finalArtworkApproved:false, campaignIntegrated:false,
        paidGenerationCalls:0, imageGenerationCalls:0, sourcePixelsOnly:true, foregroundMethod:'local Apple Vision segmentation', journeys:[] };
    let server, browser;
    const cleanup = async () => { await browser?.close(); if(server) await new Promise(resolve=>server.close(resolve)); };
    for(const signal of ['SIGINT','SIGTERM']) process.once(signal,async()=>{await cleanup();process.exit(1);});
    try {
        server=http.createServer((req,res)=>{
            const url=new URL(req.url,'http://local').pathname;
            if(url==='/'){res.setHeader('Content-Type','text/html');return res.end(html);}
            const capture=/^\/capture\/(phone|desktop)-(rest|load|reach|contact|recover)\.png$/.test(url)?path.join(output,path.basename(url)):null;
            const local=capture || (url==='/phaser.js'?phaser:url==='/source.png'?asset:
                ['/src/dev/TrumptopusCutoutRig.js','/src/dev/TrumptopusCutoutData.js'].includes(url)?path.join(root,url):null
            );
            if(!local){res.writeHead(404);return res.end();}
            res.setHeader('Content-Type',local.endsWith('.png')?'image/png':'text/javascript');
            res.end(fs.readFileSync(local));
        });
        await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
        const base=`http://127.0.0.1:${server.address().port}`;
        browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
        for(const [name,width,height,renderer] of [['phone',390,844,'webgl'],['desktop',1280,720,'webgl'],['canvas',390,844,'canvas']]) {
            const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'});
            const page=await context.newPage();
            const errors=[],requests=[];
            page.on('pageerror',e=>errors.push(e.message));
            page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
            await page.addInitScript(()=>{
                window.storageWrites=0;
                Storage.prototype.setItem=()=>{window.storageWrites++;throw Error('Unexpected storage write');};
            });
            await page.route('**/*',route=>{
                const url=route.request().url();requests.push(url);
                if(!url.startsWith(base+'/')){errors.push(`Outside request: ${url}`);return route.abort();}
                return route.continue();
            });
            await page.goto(`${base}/?renderer=${renderer}`);
            await page.waitForFunction(()=>window.proofReady,undefined,{timeout:30000});
            const states=[];
            for(const pose of poses){
                states.push(await page.evaluate(p=>window.pose(p,['reach','recover'].includes(p)?0.55:1),pose));
                await page.waitForTimeout(60);
                await page.screenshot({path:path.join(output,`${name}-${pose}.png`)});
            }
            const layers=await page.evaluate(()=>Array.from(window.rig.parts.values()).map(part=>{
                const ctx=part.canvas.getContext('2d'),pixels=ctx.getImageData(0,0,part.canvas.width,part.canvas.height).data;
                let visible=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])visible++;
                return {id:part.id,width:part.canvas.width,height:part.canvas.height,pivot:part.pivot,
                    bounds:part.bounds,visiblePixels:visible,totalPixels:pixels.length/4,
                    transparentCorners:[3,(part.canvas.width-1)*4+3,(pixels.length-part.canvas.width*4)+3,pixels.length-1].every(i=>pixels[i]===0),
                    png:part.canvas.toDataURL('image/png').split(',')[1]};
            }));
            for(const layer of layers){
                assert(layer.visiblePixels>1000,`Blank layer: ${layer.id}`);
                assert(layer.transparentCorners,`Opaque texture corners: ${layer.id}`);
                if(name==='phone')fs.writeFileSync(path.join(output,`layer-${layer.id}.png`),Buffer.from(layer.png,'base64'));
                delete layer.png;
            }
            assert(states.every(s=>s.joints.every(j=>[...j.shoulder,...j.elbow,...j.wrist,j.stretch].every(Number.isFinite))));
            for(const state of states){
                assert(state.visibleBounds.left>=8&&state.visibleBounds.right<=width-8, `${name}/${state.beat}: clipped anatomy`);
                assert(state.visibleBounds.top>=8&&state.visibleBounds.bottom<=height-42, `${name}/${state.beat}: clipped vertical anatomy`);
                assert(Math.abs(state.visibleBounds.bottom-(height-104))<2, `${name}/${state.beat}: unsupported contact`);
            }
            if(name!=='canvas'){
                await page.evaluate(()=>{
                    window.chunks=[];window.stream=window.game.canvas.captureStream(30);
                    if(window.stream.getAudioTracks().length)throw Error('Unexpected audio track');
                    window.recorder=new MediaRecorder(window.stream,{mimeType:'video/webm;codecs=vp8'});
                    window.recorder.ondataavailable=e=>{if(e.data.size)window.chunks.push(e.data);};
                    window.recorder.start(100);document.querySelector('#play').click();
                });
                await page.waitForTimeout(7200);
                const video=await page.evaluate(()=>new Promise(resolve=>{
                    window.recorder.onstop=async()=>{const bytes=new Uint8Array(await new Blob(window.chunks).arrayBuffer());window.stream.getTracks().forEach(t=>t.stop());let b='';for(const v of bytes)b+=String.fromCharCode(v);resolve(btoa(b));};window.recorder.stop();
                }));
                fs.writeFileSync(path.join(output,`${name}-source-rig-silent.webm`),Buffer.from(video,'base64'));
            }
            const storageWrites=await page.evaluate(()=>window.storageWrites);
            await page.evaluate(()=>window.disposeProof());
            await page.waitForTimeout(60);
            report.journeys.push({name,width,height,renderer,errors,requests,storageWrites,states,layers});
            assert.deepEqual(errors,[]);assert.equal(storageWrites,0);
            await context.close();
        }
        report.contactSheets=[];
        for(const [name,w,h] of [['phone',390,844],['desktop',640,360]]){
            const context=await browser.newContext({viewport:{width:w*5,height:h+28},serviceWorkers:'block'});
            const page=await context.newPage();
            await page.route('**/*',route=>route.request().url().startsWith(base+'/capture/')?route.continue():route.abort());
            await page.setContent(`<html><head><style>body{margin:0;background:#20282d;color:#fff;font:12px Arial;display:flex}figure{margin:0}figcaption{height:28px;display:flex;align-items:center;justify-content:center}img{display:block}</style></head><body>${poses.map(p=>`<figure><figcaption>${p.toUpperCase()}</figcaption><img width="${w}" height="${h}" src="${base}/capture/${name}-${p}.png"></figure>`).join('')}</body></html>`);
            await page.evaluate(()=>Promise.all(Array.from(document.images).map(image=>image.decode())));
            const file=`${name}-contact-sheet.png`;
            await page.screenshot({path:path.join(output,file),fullPage:true});
            report.contactSheets.push({file,frames:5,scale:name==='phone'?1:0.5});
            await context.close();
        }
        report.passed=true;
    } catch(error){report.passed=false;report.failure=error.stack;throw error;}
    finally {await cleanup();report.browserAndServerClosed=true;fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
    console.log(JSON.stringify({output,passed:report.passed,journeys:report.journeys.length}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
