#!/usr/bin/env node
// Local-only feature proof. Use the installed Playwright module or explicitly
// provide PLAYWRIGHT_MODULE from the developer runtime. No provider spending.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn, execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.DEBRIEF_SMOKE_PORT || (18000 + process.pid % 20000));
const base = `http://127.0.0.1:${port}`;
const output = path.resolve(process.env.DEBRIEF_EVIDENCE_DIR || '/private/tmp/mythical-debrief-evidence');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser;
let preview;
let cleaning;

function cleanup() {
    if (cleaning) return cleaning;
    cleaning = (async () => {
        await browser?.close().catch(() => {});
        if (preview && preview.exitCode === null && preview.signalCode === null) {
            preview.kill('SIGTERM');
            for (let i = 0; i < 20 && preview.exitCode === null && preview.signalCode === null; i++) await delay(100);
            if (preview.exitCode === null && preview.signalCode === null) preview.kill('SIGKILL');
        }
    })();
    return cleaning;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await cleanup(); process.exit(1); });

async function checkLayout(page) {
    const metrics = await page.evaluate(() => {
        const root = document.querySelector('[data-testid="expedition-debrief"]');
        const button = root.querySelector('button');
        const rect = button.getBoundingClientRect();
        const story = root.querySelector('.expedition-debrief-story');
        const storyBounds = story.getBoundingClientRect();
        const header = root.querySelector('header').getBoundingClientRect();
        const footer = root.querySelector('footer').getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return {
            button: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom },
            viewport: { width: innerWidth, height: innerHeight },
            hit: hit === button,
            scrollable: story.scrollHeight > story.clientHeight,
            noOverlap: header.bottom <= storyBounds.top + 1 && storyBounds.bottom <= footer.top + 1,
            overflow: root.scrollWidth > root.clientWidth,
            text: button.textContent
        };
    });
    assert(metrics.hit, 'Action is not hit-testable');
    assert(metrics.button.x >= 0 && metrics.button.y >= 0, 'Action clipped at top or left');
    assert(metrics.button.right <= metrics.viewport.width && metrics.button.bottom <= metrics.viewport.height, 'Action outside viewport');
    assert(metrics.button.height >= 44, 'Action is too small to tap');
    assert(metrics.noOverlap && !metrics.overflow, 'Content overlaps or overflows horizontally');
    return metrics;
}

async function main() {
    fs.mkdirSync(output, { recursive: true });
    preview = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore' });
    for (let i = 0; i < 80; i++) {
        if (preview.exitCode !== null) throw new Error('Preview failed to start; port may be occupied');
        try { if ((await fetch(`${base}/play/`)).ok) break; } catch {}
        await delay(250);
        if (i === 79) throw new Error('Preview did not become ready');
    }
    browser = await chromium.launch({
        headless: true,
        executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        args: ['--mute-audio']
    });
    const evidence = {
        sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
        sourceStatus: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(),
        shippedEntrySha256: createHash('sha256').update(fs.readFileSync(path.join(root, 'dist/play/index.html'))).digest('hex'),
        fixtureOnly: true,
        publicationAuthorized: false,
        externalRequests: [], pageErrors: [], consoleErrors: [], httpErrors: [], cases: []
    };
    for (const [name, width, height] of [['phone', 390, 844], ['short-phone', 375, 667], ['landscape', 844, 390], ['desktop', 1280, 720]]) {
        const context = await browser.newContext({ viewport: { width, height }, hasTouch: name !== 'desktop', serviceWorkers: 'block' });
        const page = await context.newPage();
        page.on('pageerror', error => evidence.pageErrors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') evidence.consoleErrors.push(message.text()); });
        page.on('response', response => { if (response.status() >= 400) evidence.httpErrors.push({ url: response.url(), status: response.status() }); });
        await context.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== base && ['http:', 'https:'].includes(url.protocol)) {
                evidence.externalRequests.push(url.origin + url.pathname);
                return route.abort();
            }
            return route.continue();
        });
        await page.addInitScript(() => {
            localStorage.setItem('audioMuted', 'true');
            localStorage.setItem('mythical_void_age_confirmed', 'true');
            localStorage.setItem('mythical_void_age_group', 'age_under_13');
            Object.defineProperty(window, 'AudioManager', {
                configurable: true,
                set(value) {
                    Object.defineProperty(value, 'muted', { configurable: true, get: () => true, set: () => {} });
                    Object.defineProperty(window, 'AudioManager', { configurable: true, writable: true, value });
                }
            });
            Object.defineProperty(window, 'APIConfig', {
                configurable: true,
                set(value) {
                    value.isEnabled = () => false;
                    value.isVideoEnabled = () => false;
                    Object.defineProperty(window, 'APIConfig', { configurable: true, writable: true, value });
                }
            });
        });
        for (let number = 1; number <= 5; number++) {
            await page.goto(`${base}/play/?testDebrief=${number}`);
            const action = page.getByTestId('expedition-debrief-continue');
            await action.waitFor({ timeout: 30000 });
            const metrics = await checkLayout(page);
            await page.locator('summary').click();
            await checkLayout(page);
            await page.screenshot({ path: path.join(output, `${name}-debrief-${number}.png`) });
            if (name === 'phone' && number === 1) {
                await page.setViewportSize({ width: 844, height: 390 });
                await checkLayout(page);
                await page.setViewportSize({ width, height });
            }
            await action.click();
            await page.getByTestId('expedition-debrief').waitFor({ state: 'detached' });
            evidence.cases.push({ name, number, metrics });
        }
        await context.close();
    }
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(evidence, null, 2));
    assert.equal(evidence.externalRequests.length, 0, 'Unexpected external request');
    assert.equal(evidence.pageErrors.length, 0, 'Browser runtime errors');
    assert.equal(evidence.consoleErrors.length, 0, 'Browser console errors');
    assert.equal(evidence.httpErrors.length, 0, 'HTTP errors');
    console.log(JSON.stringify({ pass: true, cases: evidence.cases.length, output }));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(cleanup);
