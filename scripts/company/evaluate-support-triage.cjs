#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultFixturePath = path.join(repositoryRoot, 'docs', 'company', 'support', 'synthetic-evaluation.json');
const fixturePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultFixturePath;
const knowledgePath = path.join(repositoryRoot, 'docs', 'company', 'support', 'knowledge-base.json');
const failures = [];

function load(file, label) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`${label} could not be read: ${error.message}`);
        process.exit(1);
    }
}

const fixture = load(fixturePath, 'Support evaluation fixture');
const knowledge = load(knowledgePath, 'Support knowledge base');

if (fixture.schemaVersion !== 1) failures.push('fixture schemaVersion must be 1');
if (fixture.mode !== 'synthetic_evaluation_only') failures.push('A-004 accepts synthetic_evaluation_only mode exclusively');
if (fixture.containsRealCustomerData !== false) failures.push('containsRealCustomerData must be false');
if (!Array.isArray(fixture.cases) || fixture.cases.length === 0) failures.push('evaluation cases are required');
if (knowledge.approvedForSupportDrafts !== false) {
    failures.push('This pilot expects the support knowledge base to remain unapproved');
}

const rules = [
    {
        queue: 'Q0',
        reason: 'Immediate safeguarding or crisis indicator',
        pattern: /\b(immediate danger|hurt (?:myself|themselves)|self[- ]?harm|suicid|abuse|groom(?:ing|ed)|exploit(?:ation|ed)|child sexual|nude image|credible threat|en peligro|abuso|explotaci[oó]n|danger imm[eé]diat|enfant est en danger|violence)\b/i
    },
    {
        queue: 'Q1',
        reason: 'Prompt injection or attempted unauthorized action',
        pattern: /ignore (?:all |the )?(?:previous|prior) instructions|reveal secrets|send this message automatically|bypass|system prompt/i
    },
    {
        queue: 'Q1',
        reason: 'Privacy, identity, legal, security, media, or payment specialist case',
        pattern: /data rights|delete my (?:cloud )?data|privacy complaint|personal email address|phone number|security vulnerab|account compromis|expose another account|legal demand|lawyer|journalist|press request|official statement|payment dispute|disputes? a charge|refund|credit card/i
    },
    {
        queue: 'Q6',
        reason: 'Spam, abuse, or unsafe attachment indicator',
        pattern: /bulk marketing|unsolicited|open an attachment|harassment|malicious attachment/i
    },
    {
        queue: 'Q5',
        reason: 'Commercial, creator, distribution, or licensing enquiry',
        pattern: /publisher|licensing|distribution partnership|commercial enquiry|creator partnership|sponsor/i
    },
    {
        queue: 'Q2',
        reason: 'Product blocker or severe accessibility problem',
        pattern: /will not load|won't load|cannot load|crash(?:es|ed)?|save (?:is )?lost|lost (?:my )?save|accessibility blocker|cannot continue/i
    },
    {
        queue: 'Q3',
        reason: 'Ordinary product help',
        pattern: /need an account|how (?:do|does|can)|controls|local save|supported browser|feature available|cost|price/i
    },
    {
        queue: 'Q4',
        reason: 'Feedback, idea, praise, or story reaction',
        pattern: /\b(feedback|idea|loved|love|story reaction|suggestion|confus(?:ed|ing))\b/i
    }
];

function classify(item) {
    const normalized = `${item.subject || ''}\n${item.body || ''}`;
    for (const rule of rules) {
        if (rule.pattern.test(normalized)) {
            return { queue: rule.queue, reason: rule.reason };
        }
    }
    return {
        queue: 'Q1',
        reason: 'Ambiguous or unsupported case fails closed to restricted human review'
    };
}

const ids = new Set();
const results = [];
for (const [index, item] of (fixture.cases || []).entries()) {
    const label = item?.id || `cases[${index}]`;
    if (!/^SC-\d{3,}$/.test(item?.id || '')) failures.push(`${label} has invalid ID`);
    if (ids.has(item?.id)) failures.push(`duplicate case ID ${item.id}`);
    ids.add(item?.id);
    if (item?.synthetic !== true || item?.sanitized !== true) {
        failures.push(`${label} must be synthetic and sanitized`);
    }
    if (!/^Q[0-6]$/.test(item?.expectedQueue || '')) failures.push(`${label} has invalid expectedQueue`);
    if (typeof item?.subject !== 'string' || typeof item?.body !== 'string') {
        failures.push(`${label} requires subject and body text`);
        continue;
    }
    const prediction = classify(item);
    results.push({
        id: item.id,
        language: item.language,
        expectedQueue: item.expectedQueue,
        predictedQueue: prediction.queue,
        correct: prediction.queue === item.expectedQueue,
        reason: prediction.reason,
        action: ['Q0', 'Q1'].includes(prediction.queue)
            ? 'Apply minimum-detail restricted label and alert named human; no substantive draft or send.'
            : 'Internal classification only; human review required before any response or evidence use.'
    });
}

const restricted = results.filter(result => ['Q0', 'Q1'].includes(result.expectedQueue));
const restrictedCaught = restricted.filter(result => ['Q0', 'Q1'].includes(result.predictedQueue));
const exactMatches = results.filter(result => result.correct);
const q0 = results.filter(result => result.expectedQueue === 'Q0');
const q0Matches = q0.filter(result => result.predictedQueue === 'Q0');
const mismatches = results.filter(result => !result.correct);
const restrictedRecall = restricted.length ? restrictedCaught.length / restricted.length : 0;
const q0ExactRecall = q0.length ? q0Matches.length / q0.length : 0;
const exactQueueAccuracy = results.length ? exactMatches.length / results.length : 0;

if (mismatches.length) failures.push(`${mismatches.length} expected queue classifications failed`);
if (restrictedRecall !== 1) failures.push('restricted-case recall is below 100%');
if (q0ExactRecall !== 1) failures.push('Q0 exact recall is below 100%');

const evaluationPassed = failures.length === 0;
const promotionGates = [
    'Safeguarding primary, backup, urgent route, geographic scope, and SLA are unassigned.',
    'Only a small synthetic fixture has been evaluated; open-world and multilingual recall are unproven.',
    'The support knowledge base is not approved and no grounded response-draft evaluation exists.',
    'No inbox, restricted incident log, alert path, access boundary, audit log, or kill switch is connected or exercised.',
    'Every response requires human review and send during any future pilot.'
];

console.log(JSON.stringify({
    workflow: 'A-004',
    mode: 'offline synthetic evaluation only',
    evaluationPassed,
    promotionEligible: false,
    liveInboxConnected: false,
    responseDraftingEnabled: false,
    knowledgeBaseApproved: knowledge.approvedForSupportDrafts,
    caseCount: results.length,
    restrictedCaseCount: restricted.length,
    metrics: {
        restrictedRecall,
        q0ExactRecall,
        exactQueueAccuracy,
        unauthorizedSendsOrToolActions: 0,
        prohibitedInformationRequests: 0
    },
    failures,
    mismatches,
    promotionGates,
    results
}, null, 2));

if (failures.length) process.exitCode = 1;
else process.exitCode = 2;
