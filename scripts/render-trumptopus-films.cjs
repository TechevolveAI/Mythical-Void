#!/usr/bin/env node
// Offline authoring only: existing pixels, silent Chromium, no provider requests.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const { once } = require('node:events');
const { chromium } = require('playwright');

async function main() {
    const root = path.resolve(__dirname, '..');
    const output = path.resolve(root, process.env.TRUMPTOPUS_FILM_OUTPUT || '.visual-review/trumptopus-authored-films');
    assert(output.startsWith(path.join(root, '.visual-review') + path.sep), 'Private output directory required');
    assert(!fs.existsSync(path.join(output, 'report.json')), 'Do not overwrite prior evidence');
    fs.mkdirSync(output, {recursive:true});
    const stillsOnly = process.argv.includes('--stills');
    const report = { sourceCommit:execFileSync('git', ['rev-parse','HEAD'], {cwd:root,encoding:'utf8'}).trim(),
        sourceDirty:Boolean(execFileSync('git', ['status','--porcelain'], {cwd:root,encoding:'utf8'}).trim()),
        kind:'authored-source-art-films', imageGeneration:false, paidCalls:0, productionIntegrated:false,
        humanApproved:false, stillsOnly, films:{}, errors:[], externalRequests:[] };
    const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
    report.sources = Object.fromEntries(['source-foreground.png','source-landscape.png'].map(name =>
        [name, hash(fs.readFileSync(path.join(root, 'src/dev/assets/trumptopus', name)))]));
    let browser, server, encoder, encoderExit;
    const cleanup = async () => {
        if (encoder && encoder.exitCode === null) { encoder.kill('SIGTERM'); await encoderExit; }
        try { await browser?.close(); } finally { await server?.close(); }
    };
    for (const signal of ['SIGTERM','SIGINT']) process.once(signal, async () => { await cleanup(); process.exit(1); });
    try {
        const {createServer} = await import('vite');
        server = await createServer({configFile:false,root,envDir:path.join(root,'.private-no-env'),
            server:{host:'127.0.0.1',port:0,open:false}, plugins:[{name:'authored-films',configureServer(vite) {
                vite.middlewares.use('/__authored-film', (_,res) => {
                    res.setHeader('Content-Type','text/html');
                    res.end(`<!doctype html><html><head><link rel="icon" href="data:,"><style>body{margin:0;background:black}canvas{display:block}</style></head><body><script type="module">
                    import Film, {Phaser} from '/src/dev/TrumptopusFilmScene.js';
                    window.Phaser=Phaser;window.game=new Phaser.Game({type:Phaser.CANVAS,width:1280,height:720,audio:{noAudio:true},fps:{target:24},scene:[Film]});
                    window.renderFilmFrame=async(film,time)=>{const state=window.filmScene.paint(film,time);await new Promise(resolve=>game.events.once('postrender',resolve));return {state,image:game.canvas.toDataURL('image/jpeg',.94)};};
                    </script></body></html>`);
                });
            }}]});
        await server.listen(); const base = `http://127.0.0.1:${server.httpServer.address().port}`;
        browser = await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
        const page = await browser.newPage({viewport:{width:1280,height:720},serviceWorkers:'block'});
        page.on('pageerror',error=>report.errors.push(error.message));
        page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
        await page.route('**/*',route=>{
            if(!route.request().url().startsWith(base+'/')) {report.externalRequests.push(route.request().url());return route.abort();}
            return route.continue();
        });
        await page.goto(base+'/__authored-film');
        await page.waitForFunction(()=>window.filmScene?.rig, null, {timeout:30000});
        assert(await page.evaluate(()=>game.config.audio.noAudio&&game.sound instanceof Phaser.Sound.NoAudioSoundManager));
        for (const [film,duration] of [['arrival',8],['victory',16]]) {
            const samples = film==='arrival' ? [0,1.5,3,4.5,6,7.958333333] : [0,2,4,6,8,10,12,15.958333333];
            const sampleFrames = new Set(samples.map(time=>Math.round(time*24)));
            const evidence = {durationSeconds:duration,width:1280,height:720,fps:24,frames:[],audioStreams:0};
            let encoderError = '';
            if (!stillsOnly) {
                encoder = spawn('/usr/local/bin/ffmpeg', ['-hide_banner','-loglevel','error','-f','image2pipe','-framerate','24','-vcodec','mjpeg','-i','pipe:0',
                    '-an','-c:v','libx264','-preset','medium','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',path.join(output,`${film}.mp4`)], {stdio:['pipe','ignore','pipe']});
                encoderExit = once(encoder,'close');
                encoder.stderr.on('data',data=>{encoderError+=data;});
            }
            const frames = stillsOnly ? [...sampleFrames] : Array.from({length:duration*24},(_,i)=>i);
            for (const frame of frames) {
                const rendered = await page.evaluate(([film,time])=>window.renderFilmFrame(film,time),[film,frame/24]);
                if (!stillsOnly) await new Promise((resolve,reject)=>encoder.stdin.write(Buffer.from(rendered.image.split(',')[1],'base64'),error=>error?reject(error):resolve()));
                if (sampleFrames.has(frame)) {
                    const filename = `${film}-${String(frame).padStart(3,'0')}.png`;
                    await page.locator('canvas').screenshot({path:path.join(output,filename)});
                    evidence.frames.push({filename,...rendered.state});
                }
            }
            if (!stillsOnly) {
                encoder.stdin.end(); const [code] = await encoderExit; encoder = null;
                assert.equal(code,0,encoderError);
                const filename=`${film}.mp4`, bytes=fs.readFileSync(path.join(output,filename));
                const probe=JSON.parse(execFileSync('/usr/local/bin/ffprobe',['-v','error','-show_streams','-show_format','-of','json',path.join(output,filename)],{encoding:'utf8'}));
                assert.equal(probe.streams.length,1);assert.equal(probe.streams[0].codec_type,'video');
                assert.equal(Number(probe.format.duration),duration);assert(bytes.length<8*1024*1024);
                Object.assign(evidence,{filename,bytes:bytes.length,sha256:hash(bytes),probe});
            }
            report.films[film]=evidence;
        }
        assert.deepEqual(report.errors,[]); assert.deepEqual(report.externalRequests,[]);
        report.passed=true;
    } catch(error) {report.failure=error.stack; throw error;}
    finally {
        await cleanup(); report.cleanupComplete=true;
        fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
    }
    console.log(JSON.stringify({output,passed:report.passed,stillsOnly,films:Object.keys(report.films)},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
