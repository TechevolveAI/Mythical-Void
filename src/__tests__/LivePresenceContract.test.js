const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, '../..', relativePath), 'utf8');
}

describe('truthful live-player signal contract', () => {
    const client = read('src/site/live-presence.js');
    const storefront = read('src/site/storefront.js');
    const main = read('src/main.js');
    const migration = read(
        'supabase/migrations/20260831000100_create_live_game_presence.sql'
    );
    const netlify = read('netlify.toml');
    const redirects = read('public/_redirects');

    test('shows actual approximate ranges and an honest quiet state', () => {
        expect(client).toContain("return 'The Void is quiet — be the first to explore'");
        expect(client).toContain('`${data.range} playing now`');
        expect(storefront).toContain('Approximate active game sessions');
        expect(storefront).not.toMatch(/fake|fabricat(?:e|ed)\s+(?:two|2|three|3)/i);
    });

    test('counts only loaded game routes and never the portal build', () => {
        expect(main).toContain("import('./site/live-presence.js')");
        expect(main).toContain('startGamePresence()');
        expect(main).toContain('if (!isPortalBuild)');
        expect(main).toContain('The optional live signal must never interrupt the game');
        expect(client).toContain("method: 'POST'");
        expect(client).toContain('document.hidden');
    });

    test('keeps the signal anonymous, short-lived and server-only', () => {
        expect(migration).toContain('session_hash text primary key');
        expect(migration).toContain("last_seen_at < now() - interval '10 minutes'");
        expect(migration).toContain('p_active_seconds integer default 90');
        expect(migration).toContain('enable row level security');
        expect(migration).toContain('revoke all on table public.live_game_presence');
        expect(migration).toContain('to service_role');
        expect(storefront).toContain('temporary random code');
        expect(storefront).toContain('does not include a name, account, creature, game choices');
        expect(storefront).toContain('stops counting after 90 seconds');
    });

    test('routes the endpoint ahead of the generic API fallback', () => {
        const exact = 'from = "/api/live-presence"';
        const generic = 'from = "/api/*"';
        expect(netlify.indexOf(exact)).toBeGreaterThan(-1);
        expect(netlify.indexOf(exact)).toBeLessThan(netlify.indexOf(generic));
        expect(redirects).toContain(
            '/api/live-presence           /.netlify/functions/live-presence           200!'
        );
    });

    test('falls back to a truthful availability message if counting fails', () => {
        expect(client).toContain("copy.textContent = 'Early access is live'");
        expect(client).not.toContain('Math.random() *');
    });
});
