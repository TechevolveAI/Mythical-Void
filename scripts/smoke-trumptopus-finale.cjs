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

async function main() {
    const root = path.resolve(__dirname, '..');
    const framing = process.env.TRUMPTOPUS_FRAMING_PROOF === '1';
    const approach = framing || process.env.TRUMPTOPUS_APPROACH_PROOF === '1';
    const campaign = approach || process.env.TRUMPTOPUS_CAMPAIGN_PROOF === '1';
    const output = path.join(root, framing ? '.visual-review/trumptopus-framing' : approach ? '.visual-review/trumptopus-approach' : campaign ? '.visual-review/trumptopus-campaign' : '.visual-review/trumptopus-three-phase');
    fs.mkdirSync(output, { recursive: true });
    const report = { kind: campaign ? 'real-fight-to-campaign-ending' : 'three-phase-greybox', finalArtwork: false,
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
                vite.middlewares.use('/__finale-proof', (_, res) => { res.setHeader('Content-Type', 'text/html'); res.end(campaign ? createCampaignProofHtml({approach}) : createProofHtml({ finale: true })); });
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
            await page.goto(`${base}/__finale-proof`);
            await page.waitForFunction(() => window.prototypeScene?.player?.body);
            const routeEvidence = approach ? await playApproach(page,context,output,name,{framing}) : null;
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
                const chunks = [], stream = window.game.canvas.captureStream(24);
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
            const captured = new Set();
            let retriedPhase = false;
            for (let attempt = 0; attempt < 20 && !(await state()).completionReady; attempt++) {
                await waitState('windup');
                let locked = await state();
                if (locked.phaseIndex === 1 && !retriedPhase) {
                    const checkpoint = locked.checkpoint;
                    await page.click('#retry');
                    await page.waitForFunction(() => window.prototypeScene.encounter.state === 'phase_intro');
                    const retried = await state();
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
                    await waitState('strike');
                    const sweepStart = await state();
                    const jumpAt = Math.max(0, (width - 78 - 35 - sweepStart.player.right) / (width - 156) - 0.18);
                    await page.waitForFunction(value => window.prototypeScene.encounter.snapshot().progress >= value, jumpAt);
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
                assert.equal(exposed.damage.length, damageBefore, `${locked.attack} was not dodged`);
                assert.equal(exposed.targetX, locked.targetX, 'Committed grab followed the player');
                if (!captured.has(`${locked.phaseIndex}-exposed`)) {
                    await page.screenshot({ path: path.join(output, `${name}-phase-${locked.phaseIndex + 1}-exposed.png`) });
                    captured.add(`${locked.phaseIndex}-exposed`);
                }
                for (let press = 0; press < 5 && (await state()).state === 'exposed'; press++) { await attack(); await page.waitForTimeout(380); }
                const countered = await state();
                assert(countered.health < exposed.health, `No real ${name} attack reached ${locked.attack}`);
                exchanges.push({ phase: locked.phaseIndex + 1, attack: locked.attack, damageBefore, damageAfter: countered.damage.length, healthBefore: exposed.health, healthAfter: countered.health });
                await page.waitForFunction(() => !['exposed', 'recoil'].includes(window.prototypeScene.encounter.state));
            }
            await waitState('aftermath');
            const finished = await state();
            assert.equal(finished.health, 0); assert.equal(finished.gateEnabled, false);
            assert(finished.phaseEvidence.some(event => event.type === 'creature-answer'));
            assert.equal(finished.phaseEvidence.filter(event => event.type === 'final-strike').length, 1);
            assert.equal(finished.phaseEvidence.filter(event => event.type === 'banished').length, 1);
            assert(retriedPhase); assert.equal(finished.causeway.enabled, true);
            assert.equal(finished.causeway.bodyTop, finished.causeway.artTop);
            assert(Math.abs(finished.player.bottom - finished.floorY) < 2);
            await page.screenshot({ path: path.join(output, `${name}-aftermath.png`) });
            const motion = await page.evaluate(() => window.stopProofRecording());
            fs.writeFileSync(path.join(output, `${name}-three-phase-silent.webm`), Buffer.from(motion, 'base64'));
            const integrity = await page.evaluate(() => ({saveWrites:window.saveWrites,storageWrites:window.storageWrites,unchanged:window.fixtureUnchanged()}));
            if(campaign) assert(integrity.unchanged&&integrity.storageWrites>0);
            else assert.deepEqual(integrity, {saveWrites:0,storageWrites:0,unchanged:true});
            const ending=campaign ? await completeCampaignEnding(page,output,name) : null;
            await page.evaluate(() => { window.game.scene.getScenes(true).forEach(scene=>scene.scene.stop()); window.dispatchEvent(new Event('resize')); window.game.events.emit('focus'); });
            await page.waitForTimeout(250);
            assert.equal(await page.evaluate(() => window.prototypeScene.encounter.disposed), true);
            assert.deepEqual(errors, []);
            report.journeys.push({name,width,height,routeEvidence,exchanges,finished,integrity,ending,pausedSafely:true,retryKeptPhase:true,externalRequests:0,errors});
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
            await activePage.screenshot({path:path.join(output,'failed-attempt.png')}).catch(() => {});
        }
        throw error;
    } finally {
        await cleanup();
        fs.writeFileSync(path.join(output,'report.json'), JSON.stringify(report,null,2));
    }
    console.log(JSON.stringify({passed:report.passed,journeys:report.journeys.map(({name,exchanges})=>({name,exchanges:exchanges.length})),output},null,2));
}
main().catch(error => {console.error(error);process.exitCode=1;});
