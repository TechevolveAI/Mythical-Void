#!/usr/bin/env node
// Local-only, real Phaser Canvas regression proof. No game saves or media services.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.CREATURE_EVIDENCE_DIR || path.join(root, '.visual-review/adult-visibility-repair'));
let browser, server, cleaning;
async function cleanup() {
    return cleaning ||= (async () => {
        await browser?.close();
        if (server) await new Promise(resolve => server.close(resolve));
    })();
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await cleanup(); process.exit(1); });

const html = `<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,">
<style>body{margin:0;background:#171f28;color:#e1ece8;font:14px Arial}#grid{display:grid;grid-template-columns:repeat(4,260px)}.cell{height:300px;text-align:center}img{display:block;margin:auto}#runtime{display:none}</style>
<div id="grid"></div><div id="runtime"></div>
<script src="/node_modules/phaser/dist/phaser.js"></script>
<script type="module" src="/src/systems/GraphicsEngine.js"></script><script type="module" src="/src/systems/StageVisualResolver.js"></script>
<script>
(async()=>{
const evolution=await(await fetch('/src/config/evolution.json')).json();
window.CreatureLifecycle={getStageVisualConfig:s=>evolution.stages[s].visual};
window.profiles=(await(await fetch('/public/press/gameplay/real-creature-showcase/source-profiles.json')).json()).profiles;
new Phaser.Game({type:Phaser.CANVAS,width:32,height:32,parent:'runtime',audio:{noAudio:true},scene:{create(){window.scene=this;window.engine=new GraphicsEngine(this);window.ready=true;}}});
window.seeded=fn=>{const previous=Math.random;let seed=12345;try{Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};return fn();}finally{Math.random=previous;}};
window.pixels=key=>{const c=scene.textures.get(key).getSourceImage();return {width:c.width,height:c.height,data:Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data),url:c.toDataURL()};};
window.records=[];
window.check=()=>{
const result={profiles:[],phaser:Phaser.VERSION};
const before=JSON.stringify(profiles);
for(const p of profiles)for(const stage of ['baby','juvenile','adult','elder']){
const rendered=seeded(()=>engine.createCreatureFromDNA(p.dna,0,stage,p.genes));
const a=pixels(rendered.textureName);
const repeat=engine.createCreatureFromDNA(p.dna,0,stage,p.genes),b=pixels(repeat.textureName);
delete scene.textures.get(rendered.textureName).customData.creatureRenderIdentity;
seeded(()=>engine.createCreatureFromDNA(p.dna,0,stage,p.genes));
const c=pixels(rendered.textureName);
let edgePixels=0,opaquePixels=0;
for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){
const alpha=a.data[(y*a.width+x)*4+3];
if(alpha>0&&(x===0||y===0||x===a.width-1||y===a.height-1))edgePixels++;
if(alpha>=230)opaquePixels++;
}
const legacy=seeded(()=>engine.createRandomizedSpaceMythicCreature(p.genes,0,stage));
const l1=pixels(legacy.textureName);
seeded(()=>engine.createRandomizedSpaceMythicCreature(p.genes,0,stage));
const l2=pixels(legacy.textureName);
result.profiles.push({id:p.id,stage,width:a.width,height:a.height,edgePixels,opaquePixels,
cached:repeat.metadata.cached===true,stable:a.url===b.url,stableRebuild:a.url===c.url,legacyStable:l1.url===l2.url});
records.push({id:p.id,stage,url:a.url,width:a.width,height:a.height});
}
const g=scene.make.graphics({add:false});g.fillStyle(0xff0000,1);
engine.addCosmicAura(g,{x:50,y:50},{innerColor:0x00ff00,outerColor:0x0000ff,intensity:.08});
engine.finalizeTexture(g,'aura-probe',100,100);
const probe=pixels('aura-probe');result.aura=probe.data.slice((50*100+50)*4,(50*100+50)*4+4);
result.identityUnchanged=JSON.stringify(profiles)===before;
return result;
};
window.draw=async(ids,scale,columns)=>{
const grid=document.querySelector('#grid');grid.innerHTML='';grid.style.gridTemplateColumns='repeat('+columns+',1fr)';
for(const r of records.filter(r=>ids.includes(r.id))){const cell=document.createElement('div');cell.className='cell';cell.style.height=columns===1?'255px':'300px';cell.textContent=r.id+' / '+r.stage;const img=new Image();img.src=r.url;img.width=r.width*scale;img.height=r.height*scale;cell.append(img);grid.append(cell);await img.decode();}
};
})();</script>`;

async function main() {
    fs.mkdirSync(output, { recursive: true });
    const files = ['/node_modules/phaser/dist/phaser.js', '/src/systems/GraphicsEngine.js',
        '/src/systems/StageVisualResolver.js', '/src/config/evolution.json',
        '/public/press/gameplay/real-creature-showcase/source-profiles.json'];
    server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://local').pathname;
        if (url === '/') { res.setHeader('Content-Type', 'text/html'); return res.end(html); }
        if (!files.includes(url)) { res.statusCode = 404; return res.end(); }
        res.setHeader('Content-Type', url.endsWith('.json') ? 'application/json' : 'text/javascript');
        res.end(fs.readFileSync(path.join(root, url)));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
    const page = await browser.newPage({ viewport: { width: 1040, height: 1800 } });
    const errors = [], externalRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/*', route => {
        if (new URL(route.request().url()).origin !== base) {
            externalRequests.push(route.request().url());
            return route.abort();
        }
        return route.continue();
    });
    await page.goto(base);
    await page.waitForFunction(() => window.ready === true);
    const measurements = await page.evaluate(() => check());
    const ids = [...new Set(measurements.profiles.map(p => p.id))];
    for (let i = 0; i < 2; i++) {
        await page.evaluate(({ ids }) => draw(ids, 1, 4), { ids: ids.slice(i * 6, i * 6 + 6) });
        await page.screenshot({ path: path.join(output, `desktop-${i + 1}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 1020 });
    for (const id of ['MV-0153', 'MV-0567']) {
        await page.evaluate(id => draw([id], 0.85, 1), id);
        await page.screenshot({ path: path.join(output, `phone-${id}.png`), fullPage: true });
    }
    const evidence = { sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
        sourceStatus: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(),
        rendererSha256: createHash('sha256').update(fs.readFileSync(path.join(root, 'src/systems/GraphicsEngine.js'))).digest('hex'),
        muted: true, publicationAuthorized: false, fullPlaythrough: false, errors, externalRequests, ...measurements };
    fs.writeFileSync(path.join(output, 'texture-evidence.json'), JSON.stringify(evidence, null, 2));
    assert.deepEqual(errors, []);
    assert.deepEqual(externalRequests, []);
    assert.equal(measurements.identityUnchanged, true);
    assert.equal(measurements.profiles.length, 48);
    assert.equal(measurements.aura[0], 0, 'Aura must not inherit the preceding opaque red fill');
    assert.ok(measurements.aura[3] > 0 && measurements.aura[3] < 12, 'Aura must remain translucent');
    for (const p of measurements.profiles) {
        assert.equal(p.edgePixels, 0, `${p.id}/${p.stage}: clipped pixels`);
        assert.ok(p.opaquePixels > 100, `${p.id}/${p.stage}: body disappeared`);
        assert.ok(p.cached && p.stable && p.stableRebuild && p.legacyStable, `${p.id}/${p.stage}: unstable texture`);
    }
    console.log(`PASS 48 DNA renders, 48 legacy rebuilds, alpha/bounds/cache/identity; ${output}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(cleanup);
