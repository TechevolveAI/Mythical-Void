const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
let fetcher = (...args) => fetch(...args);
const unavailable = () => Object.assign(new Error('Account media unavailable'), { statusCode: 403, publicError: true });
async function accountMediaOwner(client, event, adventureId, jobId, kind) {
    if (process.env.ENABLE_ADULT_ACCOUNTS !== 'true' || !UUID.test(adventureId || '') || !UUID.test(jobId || '') ||
        !['portrait', 'video'].includes(kind)) throw unavailable();
    let url;
    try {
        url = new URL(process.env.ADULT_ACCOUNT_API_URL);
        if (url.protocol !== 'https:' || !url.hostname.startsWith('mythical-void-adult-accounts-') || !url.hostname.endsWith('.run.app')) throw unavailable();
    } catch { throw unavailable(); }
    const authorization = event.headers?.authorization || event.headers?.Authorization;
    if (!/^Bearer [^\s]{1,16384}$/.test(authorization || '')) throw unavailable();
    for (const [key, value] of Object.entries({ action: 'authorize-media', id: adventureId, jobId, kind })) url.searchParams.set(key, value);
    const origin = event.headers.origin || event.headers.Origin || `https://${event.headers.host || event.headers.Host}`;
    let owners;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetcher(url.href, { headers: { Authorization: authorization, Origin: origin }, redirect: 'error', signal: controller.signal });
        if (!response.ok) throw unavailable();
        owners = (await response.json()).mediaOwners;
    } catch { throw unavailable(); } finally { clearTimeout(timeout); }
    if (!Array.isArray(owners) || !owners.length || owners.length > 50 || owners.some(id => !UUID.test(id))) throw unavailable();
    // Firebase verifies the adult; this existing media database only sees anonymous owner IDs.
    const result = await client.from(kind === 'portrait' ? 'creature_portrait_jobs' : 'companion_video_jobs')
        .select('user_id').eq('id', jobId).in('user_id', owners).maybeSingle();
    if (result.error || !owners.includes(result.data?.user_id)) throw unavailable();
    return result.data.user_id;
}
module.exports = { accountMediaOwner, _internal: {
    setFetch(value) { fetcher = value; }, reset() { fetcher = (...args) => fetch(...args); }
} };
