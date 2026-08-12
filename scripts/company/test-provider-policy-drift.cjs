#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const auditorPath = path.join(__dirname, 'audit-provider-policy-drift.cjs');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a010-'));

function write(relativePath, body = '') {
    const target = path.join(temporaryDirectory, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
}

function baselineFixture() {
    write('netlify/lib/generate-ai-art-core.cjs', "const provider = process.env.PORTRAIT_IMAGE_PROVIDER || 'gemini';\nconsole.log('trying Replicate', process.env.REPLICATE_API_TOKEN);");
    write('netlify/lib/generate-companion-video-core.cjs', "const provider = process.env.VIDEO_PROVIDER || 'auto';\nreturn await startGeminiPrediction();\nconsole.log('trying Replicate');");
    write('netlify/functions/generate-ai-art.mjs');
    write('netlify/functions/generate-companion-video.mjs');
    write('src/config/api-config.js', 'Provider labels are returned from verified server provenance.');
    write('src/config/legal.json', '{"provider":"Gemini or reviewed fallback"}');
    write('docs/EU_AI_ACT_COMPLIANCE.md', 'Current entry point: netlify/functions/generate-ai-art.mjs\nAI Provider: Gemini / reviewed fallback');
    write('docs/LIVING_CREATURE_MEDIA.md', 'Provider selection follows the verified runtime matrix.');
    write('docs/DEPLOYMENT.md', 'GEMINI_API_KEY\nPORTRAIT_IMAGE_PROVIDER\nVIDEO_PROVIDER');
}

function execute() {
    const result = spawnSync(process.execPath, [auditorPath, '--root', temporaryDirectory], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

try {
    baselineFixture();
    const baseline = execute();
    assert.strictEqual(baseline.status, 0);
    assert.strictEqual(baseline.output.auditValid, true);
    assert.strictEqual(baseline.output.policyReadiness, true);

    write('netlify/lib/generate-ai-art-core.cjs', 'no provider default');
    const missingSignal = execute();
    assert.strictEqual(missingSignal.status, 1);
    assert(missingSignal.output.failures.some(item => item.id === 'PD-RUNTIME-001'));

    baselineFixture();
    write('src/config/api-config.js', "// The only external API is Replicate\nconst config = { provider: 'Replicate official model' };");
    const contradiction = execute();
    assert.strictEqual(contradiction.status, 2);
    assert(contradiction.output.findings.some(item => item.id === 'PD-001'));
    assert(contradiction.output.findings.some(item => item.id === 'PD-002'));

    fs.rmSync(path.join(temporaryDirectory, 'docs', 'DEPLOYMENT.md'));
    const missingFile = execute();
    assert.strictEqual(missingFile.status, 1);
    assert(missingFile.output.failures.some(item => item.id === 'PD-FILE'));

    console.log('A-010 provider-policy drift evaluations passed (4 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
