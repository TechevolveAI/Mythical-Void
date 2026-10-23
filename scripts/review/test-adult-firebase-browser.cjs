const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { mkdir } = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const origin = 'http://127.0.0.1:8145';
const pageUrl = origin + '/scripts/review/adult-account-preview.html';
if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9198' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8188') throw Error('Local demo emulators required');
const children = []; let browser;
const start = (file, args, options = {}) => {
    const child = spawn(file, args, { cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'pipe'], ...options });
    // Child output is intentionally kept out of the report: emulators can include one-time links.
    child.stdout.resume(); child.stderr.resume(); children.push(child); return child;
};
async function ready(url) {
    for (let i = 0; i < 100; i++) {
        if (children.some(p => p.exitCode !== null)) throw Error('A local test server exited');
        try { if ((await fetch(url)).ok) return; } catch { /* Startup. */ }
        await new Promise(r => setTimeout(r, 100));
    }
    throw Error('Local server did not start');
}
async function waitText(page, value) { await page.getByText(value, { exact: false }).first().waitFor({ timeout: 15000 }); }
async function requestLink(page) {
    await page.getByRole('button', { name: '18 or over', exact: true }).click();
    await page.getByRole('textbox', { name: 'Email address' }).fill('browser-adult@example.test');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Send sign-in link', exact: true }).click();
    await waitText(page, 'Check b');
    const data = await (await fetch('http://127.0.0.1:9198/emulator/v1/projects/demo-mythical-adult/oobCodes')).json();
    const code = data.oobCodes.filter(c => c.email === 'browser-adult@example.test').at(-1);
    assert(code?.oobLink);
    return pageUrl + new URL(code.oobLink).search;
}
async function complete(page, link) {
    await page.goto(link);
    await waitText(page, 'Confirm your email');
    assert(!page.url().includes('oobCode'));
    await page.getByRole('textbox', { name: 'Email address' }).fill('browser-adult@example.test');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Finish signing in', exact: true }).click();
    await waitText(page, 'Signed in as');
}
(async () => {
    const output = path.join(root, '.visual-review/adult-firebase'); await mkdir(output, { recursive: true });
    try {
        start(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '8145', '--strictPort']);
        start(process.execPath, ['server.cjs'], { cwd: path.join(root, 'cloudrun/adult-accounts'), env: { ...process.env,
            GOOGLE_CLOUD_PROJECT: 'demo-mythical-adult', ENABLE_ADULT_ACCOUNTS: 'true',
            ADULT_ACCOUNT_ALLOWED_ORIGINS: origin, PORT: '8146' } });
        await Promise.all([ready(pageUrl), ready('http://127.0.0.1:8146/healthz')]);
        browser = await chromium.launch({ headless: true, args: ['--mute-audio'],
            ...(process.env.MYTHICAL_BROWSER_CHANNEL ? { channel: process.env.MYTHICAL_BROWSER_CHANNEL } : {}) });
        const errors = [];
        const context = async () => {
            const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
            c.on('page', p => p.on('pageerror', e => errors.push(e.message)));
            return c;
        };
        const child = await context(), childPage = await child.newPage();
        const authRequests = [];
        childPage.on('request', r => { if (r.url().includes(':9198')) authRequests.push(r.url()); });
        await childPage.goto(pageUrl);
        await childPage.getByRole('button', { name: 'Under 18', exact: true }).click();
        assert.equal(await childPage.locator('input[type=email]').count(), 0);
        assert.equal(authRequests.length, 0);
        await childPage.getByRole('button', { name: 'Keep playing', exact: true }).click();
        assert.equal(await childPage.getByRole('dialog').count(), 0);
        await child.close();
        const first = await context(), one = await first.newPage();
        await one.goto(pageUrl);
        await complete(one, await requestLink(one));
        await one.getByRole('button', { name: 'Add this adventure to my account', exact: true }).click();
        await waitText(one, 'This adventure is saved to your account.');
        await one.getByRole('button', { name: 'Continue with Test Fern', exact: true }).waitFor();
        await one.screenshot({ path: path.join(output, 'phone-saved.png'), fullPage: true });
        assert.equal(await one.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await one.reload(); await waitText(one, 'Signed in as');
        const second = await context(), two = await second.newPage();
        await two.goto(pageUrl);
        const link = await requestLink(two);
        // The email can open on a different browser, with no stored address hint.
        await two.evaluate(() => localStorage.removeItem('mythical-firebase-pending-email-v1'));
        await complete(two, link);
        await two.getByRole('button', { name: 'Continue with Test Fern', exact: true }).click();
        await waitText(two, 'The earlier local adventure is still here.');
        const stores = await two.evaluate(() => window.accountReview.store.list());
        assert.equal(stores.length, 2); assert(stores.every(s => s.name === 'Test Fern'));
        const copies = await two.evaluate(() => window.accountReview.store.list().map(s => localStorage.getItem(s.key)).join(''));
        assert(!copies.includes('browser-adult@example.test'));
        // An offline refresh can fail without trapping the account panel or deleting local play.
        await two.getByRole('button', { name: 'Open accounts', exact: true }).click();
        await two.getByRole('button', { name: 'Refresh saved adventures', exact: true }).waitFor();
        await two.route('**/v1/adventures**', r => r.abort());
        await two.getByRole('button', { name: 'Refresh saved adventures', exact: true }).click();
        await waitText(two, 'temporarily unavailable');
        await two.getByRole('button', { name: 'Keep playing', exact: true }).click();
        assert.equal(await two.getByRole('dialog').count(), 0);
        assert.equal((await two.evaluate(() => window.accountReview.store.list())).length, 2);
        await two.unroute('**/v1/adventures**');
        await one.getByRole('button', { name: 'Sign out', exact: true }).click();
        await one.getByRole('button', { name: 'Send sign-in link', exact: true }).waitFor();
        assert(await one.evaluate(() => Boolean(localStorage.getItem('mythical-creature-save'))));
        assert.deepEqual(errors, []);
        console.log('PASS: real Firebase email links; under-18 exclusion; two isolated phone browsers; persisted sign-in; safe local import; offline close; sign-out; no email in saves.');
        console.log('Evidence: .visual-review/adult-firebase/phone-saved.png');
    } finally {
        await browser?.close();
        await Promise.all(children.map(async p => {
            if (p.exitCode !== null) return;
            p.kill('SIGTERM');
            await Promise.race([once(p, 'exit'), new Promise(r => setTimeout(r, 3000))]);
            if (p.exitCode === null) p.kill('SIGKILL');
        }));
    }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
