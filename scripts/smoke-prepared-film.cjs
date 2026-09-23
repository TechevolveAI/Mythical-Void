#!/usr/bin/env node
// Private media-player proof, not a Trumptopus art or campaign completion proof.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('playwright');

async function main() {
    const root = path.resolve(__dirname, '..');
    const output = path.join(root, '.visual-review/trumptopus-prepared-films');
    fs.mkdirSync(output, { recursive: true });
    const file = fs.readFileSync(path.join(root, 'public/game/cinematics/mythical-forest-arrival-loop.mp4'));
    const asset = {
        url: '/game/cinematics/mythical-forest-arrival-loop.mp4',
        bytes: file.length,
        sha256: crypto.createHash('sha256').update(file).digest('hex'),
        durationSeconds: 8
    };
    const { createServer } = await import('vite');
    let server;
    let browser;
    const report = { kind: 'prepared-player-only', sourceFixture: asset, generatedFootage: false, journeys: [] };
    try {
        server = await createServer({
            configFile: false, root, server: { host: '127.0.0.1', port: 0, open: false },
            plugins: [{
                name: 'private-film-proof',
                configureServer(vite) {
                    vite.middlewares.use('/__film-proof', (_, res) => {
                        res.setHeader('Content-Type', 'text/html');
                        res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><title>Private film player proof</title>
                        <style>body{margin:0;background:#080e10;color:white;font:16px Arial}button{min-height:48px;margin:12px;font-size:16px}#game{height:120px}</style></head><body>
                        <button id="watch">Watch existing Forest film</button><div id="game"></div>
                        <script type="module">
                        import * as Phaser from '/node_modules/phaser/dist/phaser.esm.js';
                        import { FinaleFilms } from '/src/systems/FinaleFilms.js';
                        class Proof extends Phaser.Scene {
                            create() {
                                this.add.text(16, 30, 'Private playback proof, not final-boss artwork', {fontSize:'13px', wordWrap:{width:340}});
                                const config = { enabled:true, encounterId:'trumptopus', films:{ arrival:{approved:true,title:'Playback check: existing Forest film',asset:${JSON.stringify(asset)}} } };
                                const films = new FinaleFilms(this, {encounterId:'trumptopus',config});
                                window.proof = { films, scene:this };
                                document.querySelector('#watch').onclick = () => films.watch('arrival');
                            }
                        }
                        new Phaser.Game({type:Phaser.CANVAS,parent:'game',width:390,height:120,audio:{noAudio:true},scene:Proof});
                        </script></body></html>`);
                    });
                }
            }]
        });
        await server.listen();
        const base = `http://127.0.0.1:${server.httpServer.address().port}`;
        browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
        for (const [name, width, height] of [['phone', 390, 844], ['desktop', 1280, 720]]) {
            const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
            const page = await context.newPage();
            const failures = [];
            const requests = [];
            report.inProgress = { name, errors: failures };
            page.on('pageerror', error => failures.push(error.message));
            page.on('console', message => { if (message.type() === 'error') failures.push(message.text()); });
            await page.route('**/*', route => {
                const request = route.request();
                if (!request.url().startsWith(base)) {
                    failures.push(`Outside request: ${new URL(request.url()).origin}`);
                    return route.abort();
                }
                requests.push({ path: new URL(request.url()).pathname, method: request.method() });
                return route.continue();
            });
            await page.goto(`${base}/__film-proof`);
            await page.waitForFunction(() => window.proof);
            const prepared = await page.evaluate(() => window.proof.films.prepare('arrival'));
            if (!prepared) throw new Error(`${name}: preparation failed: ${await page.evaluate(() => window.proof.films.films.get('arrival').error)}`);
            const preload = await page.evaluate(() => {
                const film = window.proof.films.films.get('arrival');
                return { state: film.state, time: film.video.currentTime, paused: film.video.paused, muted: film.video.muted };
            });
            if (!preload.paused || !preload.muted || preload.time !== 0) throw new Error('Preload produced playback');
            const started = Date.now();
            await page.click('#watch');
            await page.waitForFunction(() => window.proof.films.films.get('arrival').state === 'playing');
            const startupMs = Date.now() - started;
            await page.waitForTimeout(350);
            const pixels = await page.evaluate(() => {
                const video = document.querySelector('video');
                const canvas = document.createElement('canvas');
                canvas.width = 96; canvas.height = 54;
                const context = canvas.getContext('2d');
                context.drawImage(video, 0, 0, 96, 54);
                const data = context.getImageData(0, 0, 96, 54).data;
                let visible = 0;
                for (let i = 0; i < data.length; i += 4) if (data[i] + data[i + 1] + data[i + 2] > 30) visible++;
                return { visibleFraction: visible / (96 * 54), time: video.currentTime };
            });
            if (pixels.visibleFraction < 0.15) throw new Error('Video was blank');
            await page.screenshot({ path: path.join(output, `${name}-playing.png`) });
            const layout = await page.evaluate(() => {
                const player = window.proof.films.player;
                return [player.action, player.closeButton].every(element => {
                    const box = element.getBoundingClientRect();
                    return box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight && box.height >= 44;
                });
            });
            if (!layout) throw new Error('Controls clipped');
            // Loss of connectivity after preparation must not prevent completing the film.
            await context.setOffline(true);
            await page.getByRole('button', { name: 'Pause', exact: true }).click();
            await page.getByRole('button', { name: 'Resume', exact: true }).click();
            await page.waitForFunction(() => window.proof.films.films.get('arrival').state === 'ended', null, { timeout: 15000 });
            await page.getByRole('button', { name: 'Watch again', exact: true }).click();
            await page.waitForFunction(() => window.proof.films.films.get('arrival').state === 'playing');
            await page.getByRole('button', { name: 'Continue', exact: true }).click();
            await page.waitForFunction(() => window.proof.scene.sys.isActive());
            const clean = await page.evaluate(() => !document.querySelector('video') && !document.querySelector('[role=dialog]'));
            if (!clean || failures.length) throw new Error(JSON.stringify({ clean, failures }));
            const filmRequests = requests.filter(request => request.path.endsWith('.mp4'));
            if (filmRequests.length !== 1 || requests.some(request => request.method !== 'GET')) throw new Error('Unexpected fetch during Watch/replay');
            report.journeys.push({ name, width, height, startupMs, preload, pixels, layout, offlinePlayback: true, replay: true, sceneRestored: true, filmFetches: filmRequests.length, errors: failures });
            delete report.inProgress;
            await context.close();
        }
        report.passed = true;
    } finally {
        await browser?.close();
        await server?.close();
        fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    }
    console.log(JSON.stringify(report, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
