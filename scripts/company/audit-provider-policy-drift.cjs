#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const defaultRepositoryRoot = path.resolve(__dirname, '..', '..');
let repositoryRoot = defaultRepositoryRoot;
if (process.argv.length > 2) {
    if (process.argv.length !== 4 || process.argv[2] !== '--root') {
        console.error('Usage: audit-provider-policy-drift.cjs [--root fixture-root]');
        process.exit(1);
    }
    repositoryRoot = path.resolve(process.argv[3]);
}
const failures = [];
const findings = [];

function read(relativePath) {
    const absolutePath = path.join(repositoryRoot, relativePath);
    try {
        return fs.readFileSync(absolutePath, 'utf8');
    } catch (error) {
        failures.push({
            id: 'PD-FILE',
            severity: 'major',
            file: relativePath,
            issue: `Required evidence file could not be read: ${error.message}`
        });
        return '';
    }
}

function addFinding(id, severity, file, issue, evidence, nextAction) {
    findings.push({ id, severity, file, issue, evidence, nextAction });
}

const portraitCorePath = 'netlify/lib/generate-ai-art-core.cjs';
const videoCorePath = 'netlify/lib/generate-companion-video-core.cjs';
const portraitCore = read(portraitCorePath);
const videoCore = read(videoCorePath);
const apiConfigPath = 'src/config/api-config.js';
const apiConfig = read(apiConfigPath);
const legalPath = 'src/config/legal.json';
const legal = read(legalPath);
const compliancePath = 'docs/EU_AI_ACT_COMPLIANCE.md';
const compliance = read(compliancePath);
const livingMediaPath = 'docs/LIVING_CREATURE_MEDIA.md';
const livingMedia = read(livingMediaPath);
const deploymentPath = 'docs/DEPLOYMENT.md';
const deployment = read(deploymentPath);

const sourceSignals = {
    portraitDefaultGemini:
        /PORTRAIT_IMAGE_PROVIDER\s*\|\|\s*['"]gemini['"]/.test(portraitCore),
    portraitReplicateFallback:
        /trying Replicate/.test(portraitCore) && /REPLICATE_API_TOKEN/.test(portraitCore),
    videoDefaultAuto:
        /VIDEO_PROVIDER\s*\|\|\s*['"]auto['"]/.test(videoCore),
    videoGeminiFirst:
        /return await startGeminiPrediction/.test(videoCore) && /trying Replicate/.test(videoCore),
    geminiFunctionsPresent:
        fs.existsSync(path.join(repositoryRoot, 'netlify/functions/generate-ai-art.mjs')) &&
        fs.existsSync(path.join(repositoryRoot, 'netlify/functions/generate-companion-video.mjs'))
};

if (!sourceSignals.portraitDefaultGemini) {
    failures.push({
        id: 'PD-RUNTIME-001',
        severity: 'major',
        file: portraitCorePath,
        issue: 'Expected portrait provider default signal was not found; update this audit when runtime selection changes.'
    });
}

if (!sourceSignals.videoDefaultAuto || !sourceSignals.videoGeminiFirst) {
    failures.push({
        id: 'PD-RUNTIME-002',
        severity: 'major',
        file: videoCorePath,
        issue: 'Expected video auto/Gemini-first source signals were not found; update this audit when runtime selection changes.'
    });
}

if (
    sourceSignals.portraitDefaultGemini &&
    /only external API is Replicate/i.test(apiConfig)
) {
    addFinding(
        'PD-001',
        'major',
        apiConfigPath,
        'Public configuration commentary says Replicate is the only external AI API while source defaults portraits to Gemini.',
        'Source-level contradiction; this does not establish which production credential is active.',
        'After GDH-006 runtime verification, replace provider-specific client assumptions with an accurate provider-agnostic disclosure or verified provider set.'
    );
}

if (
    sourceSignals.portraitDefaultGemini &&
    /provider:\s*['"]Replicate official model/i.test(apiConfig)
) {
    addFinding(
        'PD-002',
        'major',
        apiConfigPath,
        'The client-facing public configuration labels AI art as Replicate even when the source default selects Gemini.',
        'The label can misstate the provider selected by server-side configuration or fallback.',
        'Make the returned label derive from verified server provenance, or use a reviewed non-provider-specific label.'
    );
}

if (
    sourceSignals.portraitDefaultGemini &&
    /Replicate:/.test(legal) &&
    !/Gemini|Google AI|Google Cloud AI/i.test(legal)
) {
    addFinding(
        'PD-003',
        'major',
        legalPath,
        'The configured privacy text names Replicate for personalized living media but does not identify the Gemini/Google path present in source.',
        'This is a disclosure-review trigger, not a legal conclusion or proof of active production processing.',
        'Verify the production and fallback data-flow matrix, provider terms, and regions; then update the policy through privacy review.'
    );
}

if (
    /netlify\/functions\/generate-ai-art\.js/.test(compliance) &&
    !fs.existsSync(path.join(repositoryRoot, 'netlify/functions/generate-ai-art.js'))
) {
    addFinding(
        'PD-004',
        'minor',
        compliancePath,
        'The AI compliance document references a JavaScript function path that no longer exists.',
        'The current entry point is netlify/functions/generate-ai-art.mjs.',
        'Correct the code reference in the coordinated provider/documentation release.'
    );
}

if (
    sourceSignals.portraitDefaultGemini &&
    /AI Provider[^\n]*Replicate API/i.test(compliance) &&
    !/AI Provider[^\n]*(Gemini|Google)/i.test(compliance)
) {
    addFinding(
        'PD-005',
        'major',
        compliancePath,
        'The AI system inventory describes the art provider as Replicate while the source default includes Gemini.',
        'Provider inventory is incomplete relative to source behavior.',
        'Rebuild the inventory from the verified runtime matrix and obtain the appropriate compliance review.'
    );
}

if (
    sourceSignals.portraitDefaultGemini &&
    /Recommended first implementation[^\n]*Replicate/i.test(livingMedia)
) {
    addFinding(
        'PD-006',
        'minor',
        livingMediaPath,
        'The portrait provider recommendation is stale relative to the current Gemini-default source.',
        'The same document already describes Gemini/Veo as preferred for video.',
        'Separate historical options from the verified current architecture and date the decision.'
    );
}

if (
    sourceSignals.geminiFunctionsPresent &&
    /REPLICATE_API_TOKEN/.test(deployment) &&
    !/GEMINI_API_KEY|PORTRAIT_IMAGE_PROVIDER|VIDEO_PROVIDER/.test(deployment)
) {
    addFinding(
        'PD-007',
        'major',
        deploymentPath,
        'Deployment guidance documents Replicate configuration but omits the Gemini and provider-selection variables used by current functions.',
        'An operator following this guide cannot reproduce or explain the current source-level routing.',
        'After GDH-006 verification, document required gates, provider selection, secrets, fallback, and rollback without exposing values.'
    );
}

if (/provider:\s*job\.provider\s*\|\|\s*['"]Replicate['"]/.test(portraitCore)) {
    addFinding(
        'PD-008',
        'minor',
        portraitCorePath,
        'A missing portrait job provider is labeled Replicate by fallback logic even though the source default is Gemini.',
        'Legacy or incomplete records could receive misleading provenance.',
        'Make missing provenance explicit or infer it only from an auditable stored field; add a regression test before changing production behavior.'
    );
}

const severityCounts = findings.reduce((counts, finding) => {
    counts[finding.severity] = (counts[finding.severity] || 0) + 1;
    return counts;
}, {});

const output = {
    workflow: 'A-010',
    checkedAt: new Date().toISOString(),
    mode: 'read-only source and documentation assurance',
    limitations: [
        'This audit does not inspect environment variable values, provider accounts, contracts, logs, or live player data.',
        'Source defaults do not prove which provider is active in production.',
        'Findings are operational review triggers, not legal advice.'
    ],
    sourceSignals,
    auditValid: failures.length === 0,
    policyReadiness: failures.length === 0 && findings.length === 0,
    findingCount: findings.length,
    findingSeverity: severityCounts,
    failures,
    findings,
    nextGate: 'Complete GDH-006 and D-013 before changing public privacy/provider claims.'
};

console.log(JSON.stringify(output, null, 2));
if (failures.length) process.exitCode = 1;
else if (findings.length) process.exitCode = 2;
