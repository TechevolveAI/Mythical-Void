#!/usr/bin/env node
// Local mechanics proof only. Never loads the game boot or real player data.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

function createProofHtml({ finale = false, artwork = false } = {}) { return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><link rel="icon" href="data:,"><title>Private Trumptopus mechanics</title>
<style>html,body{margin:0;overflow:hidden;background:#15191c;color:#eee;font:12px Arial}header{height:42px;display:flex;align-items:center;justify-content:space-between;padding:0 8px;box-sizing:border-box}button{height:34px;min-width:56px;border:1px solid #687775;background:#273034;color:white}canvas{display:block;touch-action:none}#paused{position:fixed;inset:45% 20% auto;z-index:3;background:#192423;padding:20px;text-align:center}#paused[hidden]{display:none}</style></head>
<body><header><span>PRIVATE / MECHANICS ONLY</span><span><button id="pause">Pause</button> <button id="retry">Retry</button></span></header><div id="game"></div><div id="paused" hidden>Paused</div>
<script type="module">
import * as Phaser from '/node_modules/phaser/dist/phaser.esm.js';
window.Phaser = Phaser;
await import('/src/systems/GraphicsEngine.js');
await import('/src/systems/StageVisualResolver.js');
const {default: Prototype} = await import('/src/dev/${finale ? artwork ? 'TrumptopusArtFinalePreview' : 'TrumptopusFinalePreview' : 'TrumptopusPrototypeLevel'}.js');
const evolution = await (await fetch('/src/config/evolution.json')).json();
window.CreatureLifecycle = {getStageVisualConfig: stage => evolution.stages[stage].visual};
const profile = (await (await fetch('/press/gameplay/real-creature-showcase/source-profiles.json')).json()).profiles[1];
const fixture = {creature:{genes:profile.genes,dna:profile.dna,lifecycle:{stage:'juvenile'},hatched:true,named:true},story:{projectBeacon:{fieldKit:{recovered:true}}}};
window.fixtureBefore = JSON.stringify(fixture);
window.saveWrites = 0;
window.GameState = {get:key=>key.split('.').reduce((value,part)=>value?.[part],fixture),getActiveCreature:()=>fixture.creature,set:()=>{window.saveWrites++;throw Error('Proof attempted save');},save:()=>{window.saveWrites++;throw Error('Proof attempted persistence');}};
window.fixtureUnchanged = () => window.fixtureBefore === JSON.stringify(fixture);
window.game = new Phaser.Game({type:new URLSearchParams(location.search).get('renderer')==='webgl'?Phaser.WEBGL:Phaser.CANVAS,parent:'game',width:innerWidth,height:innerHeight-42,audio:{noAudio:true},input:{activePointers:3},physics:{default:'arcade',arcade:{debug:false}},scene:Prototype});
document.querySelector('#retry').onclick=()=>{document.querySelector('#paused').hidden=true;document.querySelector('#paused').textContent='Paused';document.querySelector('#pause').textContent='Pause';window.prototypeScene.scene.restart({checkpoint:window.prototypeScene.encounter.checkpoint?.()});};
document.querySelector('#pause').onclick=()=>window.prototypeScene.showPauseMenu();
window.addEventListener('prototype-pause',event=>{document.querySelector('#paused').hidden=!event.detail;document.querySelector('#pause').textContent=event.detail?'Resume':'Pause';});
window.addEventListener('prototype-defeat',()=>{document.querySelector('#paused').textContent='Try again';document.querySelector('#paused').hidden=false;});
</script></body></html>`; }
const html = createProofHtml();

async function main() {
    const root = path.resolve(__dirname, '..');
    const output = path.resolve(root, process.env.TRUMPTOPUS_PROOF_OUTPUT || '.visual-review/trumptopus-grip');
    fs.mkdirSync(output, { recursive: true });
    const report = { kind: 'single-exchange-greybox', finalArtwork: false, campaignIntegrated: false, journeys: [] };
    let server;
    let browser;
    let activePage;
    const cleanup = async () => { await browser?.close(); await server?.close(); };
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await cleanup(); process.exit(1); });
    try {
        const { createServer } = await import('vite');
        server = await createServer({ configFile: false, root, server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{
            name: 'private-grip', configureServer(vite) {
                vite.middlewares.use('/__grip-proof', (_, res) => { res.setHeader('Content-Type', 'text/html'); res.end(html); });
            }
        }] });
        await server.listen();
        const base = `http://127.0.0.1:${server.httpServer.address().port}`;
        browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
        for (const [name, width, height] of [['phone', 390, 844], ['desktop', 1280, 720]]) {
            const context = await browser.newContext({ viewport: { width, height }, hasTouch: name === 'phone', serviceWorkers: 'block' });
            const page = await context.newPage();
            activePage = page;
            const errors = [], requests = [];
            report.inProgress = { name, errors };
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
            await page.addInitScript(() => {
                window.storageWrites = 0;
                Storage.prototype.setItem = () => { window.storageWrites++; throw Error('Proof attempted storage'); };
                Storage.prototype.removeItem = () => { window.storageWrites++; throw Error('Proof attempted storage removal'); };
                Storage.prototype.clear = () => { window.storageWrites++; throw Error('Proof attempted storage clear'); };
            });
            await page.route('**/*', route => {
                const request = route.request(); requests.push({ url: request.url(), method: request.method() });
                if (!request.url().startsWith(base) || request.url().includes('/api/') || request.url().includes('/.netlify/')) {
                    errors.push(`Unexpected service: ${request.url()}`); return route.abort();
                }
                return route.continue();
            });
            await page.goto(`${base}/__grip-proof`);
            await page.waitForFunction(() => window.prototypeScene?.player?.body);
            const state = () => page.evaluate(() => window.prototypeScene.getProofState());
            const waitState = expected => page.waitForFunction(value => window.prototypeScene.encounter.state === value, expected, { timeout: 10000 });
            // First let a genuine collision land, then retry from the public proof control.
            await page.waitForFunction(() => window.prototypeScene.damageEvidence.length === 1);
            const contact = await state();
            assert.equal(contact.playerHealth, 3);
            await page.waitForTimeout(400);
            assert.equal((await state()).damage.length, 1);
            await page.click('#retry');
            await waitState('ready');
            await page.click('#pause');
            const paused = await state();
            await page.waitForTimeout(350);
            assert.equal((await state()).elapsed, paused.elapsed);
            await page.click('#pause');
            await page.evaluate(() => {
                const chunks = [];
                const stream = window.game.canvas.captureStream(30);
                const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
                recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
                window.stopProofRecording = () => new Promise(resolve => {
                    recorder.onstop = async () => {
                        const data = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer());
                        stream.getTracks().forEach(track => track.stop());
                        let binary = '';
                        for (const byte of data) binary += String.fromCharCode(byte);
                        resolve(btoa(binary));
                    };
                    recorder.stop();
                });
                recorder.start(100);
            });
            await waitState('windup');
            const locked = await state();
            await page.screenshot({ path: path.join(output, `${name}-windup.png`) });
            const cdp = name === 'phone' ? await context.newCDPSession(page) : null;
            async function direction(value) {
                if (cdp) {
                    const { joystick } = await state();
                    const x = joystick.x, y = joystick.y + 42;
                    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
                    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + value * 42, y }] });
                } else await page.keyboard.down(value > 0 ? 'ArrowRight' : 'ArrowLeft');
            }
            async function release() {
                if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                else { await page.keyboard.up('ArrowRight'); await page.keyboard.up('ArrowLeft'); }
            }
            await direction(1);
            await page.waitForFunction(x => window.prototypeScene.player.x >= x + 88, locked.player.x);
            await release();
            await direction(-1);
            await page.waitForTimeout(65);
            await release();
            await waitState('exposed');
            const dodged = await state();
            report.inProgress.dodged = dodged;
            assert.equal(dodged.targetX, locked.targetX);
            assert.equal(dodged.damage.length, 0);
            assert(dodged.astronaut.x + dodged.astronaut.width / 2 < dodged.targetX - 35, 'Follower walked into the committed grab');
            await page.screenshot({ path: path.join(output, `${name}-counterattack.png`) });
            if (name === 'phone') {
                const { melee } = dodged.controls;
                await page.touchscreen.tap(melee.x, melee.y + 42);
            } else {
                await page.keyboard.press('m');
                await page.waitForTimeout(380);
                await page.keyboard.press('m');
            }
            await waitState('released');
            const released = await state();
            assert(released.hits.some(hit => hit.applied && hit.source === (name === 'phone' ? 'katana' : 'ranged')));
            assert.equal(released.gateEnabled, false);
            assert.equal(released.playerHealth, 4);
            assert(Math.abs(released.player.bottom - released.floorY) < 2, 'Player lost ground contact');
            assert.notEqual(released.player.texture, 'platformerCreature', 'Real creature renderer was not used');
            for (const frame of [locked, dodged, released]) {
                const astronautLeft = frame.astronaut.x - frame.astronaut.width / 2;
                const astronautRight = frame.astronaut.x + frame.astronaut.width / 2;
                assert(astronautLeft >= 0 && astronautRight <= width, 'Astronaut left the frame');
                assert(frame.creatureBounds.left >= 0 && frame.creatureBounds.right <= width, 'Creature left the frame');
            }
            await page.screenshot({ path: path.join(output, `${name}-released.png`) });
            await page.waitForTimeout(650);
            const motion = await page.evaluate(() => window.stopProofRecording());
            fs.writeFileSync(path.join(output, `${name}-single-exchange-silent.webm`), Buffer.from(motion, 'base64'));
            // Use normal movement to cross the former blocker, then verify a real jump.
            await direction(1);
            await page.waitForFunction(() => window.prototypeScene.player.body.right >= window.prototypeScene.levelWidth - 27);
            await release();
            if (name === 'phone') {
                const { jump } = released.controls; await page.touchscreen.tap(jump.x, jump.y + 42);
            } else await page.keyboard.down('Space');
            await page.waitForFunction(() => window.prototypeScene.player.body.velocity.y < -50);
            if (name === 'desktop') await page.keyboard.up('Space');
            const integrity = await page.evaluate(() => ({ saveWrites: window.saveWrites, storageWrites: window.storageWrites, unchanged: window.fixtureUnchanged() }));
            assert.deepEqual(integrity, { saveWrites: 0, storageWrites: 0, unchanged: true });
            await page.evaluate(() => { window.prototypeScene.scene.stop(); window.dispatchEvent(new Event('resize')); window.game.events.emit('focus'); });
            await page.waitForTimeout(250);
            assert.equal(await page.evaluate(() => window.prototypeScene.encounter.disposed), true);
            assert.deepEqual(errors, []);
            assert(requests.every(request => request.method === 'GET'));
            report.journeys.push({ name, width, height, contact, locked, dodged, released, integrity, realInput: name === 'phone' ? 'touch joystick + katana + jump' : 'keyboard movement + ranged projectiles + jump', pauseFrozen: true, crossedReleasedGate: true, shutdownClean: true, errors });
            delete report.inProgress;
            await context.close();
        }
        report.passed = true;
    } catch (error) {
        report.failure = error.message;
        if (activePage && !activePage.isClosed()) {
            report.failureState = await activePage.evaluate(() => window.prototypeScene?.getProofState()).catch(() => null);
            await activePage.screenshot({ path: path.join(output, 'failed-attempt.png') }).catch(() => {});
        }
        throw error;
    } finally {
        await cleanup();
        fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    }
    console.log(JSON.stringify({ passed: report.passed, journeys: report.journeys.map(({ name, realInput }) => ({ name, realInput })), output }, null, 2));
}
module.exports = { createProofHtml };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
