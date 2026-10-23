const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { id } = require('../test-support/adultAccountFixture.js');
const portrait = require('../../netlify/lib/generate-ai-art-core.cjs');
const video = require('../../netlify/lib/generate-companion-video-core.cjs');
const bridge = require('../../netlify/lib/firebase-account-media.cjs');
const originalEnv = { ...process.env };
afterEach(() => { process.env = { ...originalEnv }; portrait._internal.resetRuntime(); video._internal.resetRuntime(); bridge._internal.reset(); });

test.each([[portrait, 'portrait'], [video, 'video']])('%s existing gateway reads the verified original media owner', async (gateway, kind) => {
    Object.assign(process.env, { ENABLE_ADULT_ACCOUNTS: 'true', ENABLE_API_FEATURES: 'true', ENABLE_AI_PORTRAITS: 'true',
        ENABLE_AI_VIDEOS: 'true', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-key',
        ADULT_ACCOUNT_API_URL: 'https://mythical-void-adult-accounts-dev-synthetic-ew.a.run.app/v1/adventures' });
    const eq = jest.fn();
    const admin = {
        auth: { getUser: jest.fn(async () => { throw Error('Firebase tokens must not reach the old identity provider'); }) },
        from: jest.fn(() => {
            const q = { select: () => q, eq: (k, v) => { eq(k, v); return q; },
                in: () => q, maybeSingle: async () => ({ data: { id: id(200), user_id: id(3), status: 'starting' } }) }; return q;
        })
    };
    const authorize = jest.fn(async () => ({ ok: true, json: async () => ({ mediaOwners: [id(3)] }) }));
    bridge._internal.setFetch(authorize);
    gateway._internal.setRuntime({ createClient: () => admin });
    const event = { httpMethod: 'GET', headers: { host: 'game.example.test', origin: 'https://game.example.test', Authorization: 'Bearer synthetic-token' },
        queryStringParameters: { jobId: id(200), accountAdventure: id(10) } };
    expect((await gateway.handler(event)).statusCode).toBe(202);
    expect(admin.auth.getUser).not.toHaveBeenCalled();
    expect(authorize.mock.calls[0][0]).toContain('action=authorize-media');
    expect(authorize.mock.calls[0][0]).toContain('kind=' + kind);
    expect(eq).toHaveBeenCalledWith('user_id', id(3));
    authorize.mockResolvedValueOnce({ ok: false }); admin.from.mockClear();
    expect((await gateway.handler(event)).statusCode).toBe(403); expect(admin.from).not.toHaveBeenCalled();
    expect((await gateway.handler({ ...event, httpMethod: 'POST', body: '{}' })).statusCode).toBe(403);
    expect(admin.auth.getUser).not.toHaveBeenCalled();
});

function browserService(kind, sceneWindow, fetcher) {
    const file = path.join(__dirname, `../systems/${kind === 'portrait' ? 'LivingPortraitService' : 'CompanionMediaService'}.js`);
    let source = fs.readFileSync(file, 'utf8');
    if (kind === 'portrait') source = source.replace(/import .*;\n/, 'const getCreatureMediaEligibility = () => ({eligible:true});\n')
        .replace('export { LivingPortraitService };', 'module.exports = LivingPortraitService;').replace('export default livingPortraitService;', '');
    else source = source.replace(/import .*;\n/, 'const companionVideoMomentsConfig = { moments: [] };\n')
        .replace(/export\s*\{[\s\S]*?\};\s*$/, 'module.exports = CompanionMediaService;');
    const sandbox = { module: { exports: {} }, window: sceneWindow, fetch: fetcher, console, setTimeout, clearTimeout, AbortController, Date };
    vm.runInNewContext(source, sandbox); return new sandbox.module.exports();
}
test.each(['portrait', 'video'])('%s retries only protected reads and discards a response after account sign-out', async kind => {
    let active = true;
    const assertCurrent = jest.fn(() => { if (!active) throw Error('session_changed'); });
    const sceneWindow = { AdultAccounts: { mediaRequest: jest.fn(async url => ({ url: url + '&accountAdventure=' + id(10), token: 'adult-token', assertCurrent })) } };
    const fetcher = jest.fn(async (_url, options) => ({ status: options.headers.Authorization === 'Bearer adult-token' ? 200 : 404,
        json: async () => ({ success: true, assetRef: 'synthetic-ref' }) }));
    const service = browserService(kind, sceneWindow, fetcher);
    const request = (url, options) => kind === 'portrait'
        ? service.requestJson(url, options, { timeoutMs: 1000, timeoutCode: 'timeout', timeoutMessage: 'Timeout' })
        : service.requestVideoJson(url, options);
    const url = `/.netlify/functions/generate-${kind === 'portrait' ? 'ai-art' : 'companion-video'}?assetRef=synthetic-ref`;
    const options = { headers: { Authorization: 'Bearer anonymous-token' } };
    expect((await request(url, options)).response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2); expect(assertCurrent).toHaveBeenCalled();
    fetcher.mockClear(); await request(url, { ...options, method: 'POST', body: '{}' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockClear(); active = false;
    await expect(request(url, options)).rejects.toThrow('session_changed');
});
