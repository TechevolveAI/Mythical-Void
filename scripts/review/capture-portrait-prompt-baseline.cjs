// Explicit one-off capture from the released source, never today's working copy.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { KINDS, STAGES, STYLES, createPromptSpec } = require('../../src/__tests__/support/portraitPromptFixture.cjs');
const root = path.resolve(__dirname, '../..');
const baseline = 'c4e3705cdf5773c2bec896d5fe05c3594bdc425a';
const sourcePath = 'netlify/lib/generate-ai-art-core.cjs';
const source = execFileSync('git', ['show', baseline + ':' + sourcePath], {
    cwd: root, encoding: 'utf8', env: { PATH: '/usr/bin:/bin:/usr/local/bin',
        TMPDIR: '/private/tmp', GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' } });
const baselineExports = {};
const deny = () => { throw Error('BASELINE_NETWORK_OR_BACKEND_FORBIDDEN'); };
vm.runInNewContext(source, { exports: baselineExports, process: { env: {} }, fetch: deny,
    require: name => { if (name !== '@supabase/supabase-js') throw Error('BASELINE_REQUIRE_FORBIDDEN');
        return { createClient: deny }; } }, { timeout: 1000 });
const sha256 = value => createHash('sha256').update(value).digest('hex');
const cases = [];
for (const kind of KINDS) for (const stage of STAGES) for (const style of STYLES) {
    for (const hasReferenceImage of [false, true]) {
        const spec = createPromptSpec(kind, stage);
        if (!baselineExports._internal.validatePortraitSpec(spec)) throw Error('INVALID_BASELINE_FIXTURE');
        const prompt = baselineExports._internal.buildCreaturePrompt(spec, style, { hasReferenceImage });
        cases.push({ kind, stage, style, hasReferenceImage, sha256: sha256(prompt) });
    }
}
const output = path.join(root, 'src/__tests__/fixtures/portrait-prompt-baseline.json');
fs.writeFileSync(output, JSON.stringify({ sourceCommit: baseline, sourcePath,
    sourceSha256: sha256(source), providerRequests: 0, cases }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, sourceCommit: baseline, cases: cases.length, providerRequests: 0 }));
