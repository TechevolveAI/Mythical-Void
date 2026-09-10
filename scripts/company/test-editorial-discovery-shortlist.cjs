#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { validateEditorialDiscovery } = require('./validate-editorial-discovery-shortlist.cjs');

const root = path.resolve(__dirname, '..', '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/growth/EDITORIAL_DISCOVERY_SHORTLIST_2026-09-10.json'), 'utf8'));
const copy = fs.readFileSync(path.join(root, 'docs/company/growth/EDITORIAL_DISCOVERY_SHORTLIST_2026-09-10.md'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
let cases = 0;

function rejected(name, expectedFailure, change) {
    const candidate = clone(source);
    const changedCopy = change(candidate) || copy;
    const failures = validateEditorialDiscovery(candidate, changedCopy);
    assert(failures.length > 0, `${name} should fail`);
    assert(failures.some(failure => failure.includes(expectedFailure)), `${name} should report ${expectedFailure}`);
    cases += 1;
}

assert.deepStrictEqual(validateEditorialDiscovery(source, copy), []);
cases += 1;

rejected('bulk sending', 'bulk sending', candidate => { candidate.sequence.bulkSendingPermitted = true; });
rejected('automatic sending', 'automatic sending', candidate => { candidate.sequence.automaticSendingPermitted = true; });
rejected('automatic reply', 'automatic replies', candidate => { candidate.sequence.automaticReplyingPermitted = true; });
rejected('missing restoration gate', 'launch gate', candidate => { candidate.sequence.mustWaitFor.shift(); });
rejected('invented send', 'invents an outside message', candidate => { candidate.routes[0].sent = true; });
rejected('unapproved attachment', 'attached unapproved media', candidate => { candidate.routes[1].attachments.push('generated-key-art.png'); });
rejected('promised coverage', 'invents promised coverage', candidate => { candidate.routes[2].coveragePromised = true; });
rejected('missing direct play link', 'does not link directly to play', candidate => { candidate.routes[0].body = candidate.routes[0].body.replace('https://mythicalvoid.com/play/', 'https://mythicalvoid.com/'); });
rejected('missing AI disclosure', 'missing the AI disclosure', candidate => { candidate.routes[1].body = candidate.routes[1].body.replace('Generative AI', 'Software'); });
rejected('missing NASA boundary', 'missing the NASA boundary', candidate => { candidate.routes[2].body = candidate.routes[2].body.replace('; NASA does not endorse Mythical Void.', '.'); });
rejected('retired wording', 'retired companion wording', candidate => { candidate.routes[0].subject = 'Meet your AI companion in Mythical Void'; });
rejected('vague signal wording', 'vague signal wording', candidate => { candidate.routes[1].subject = 'A signal from the Void'; });
rejected('invented audience', 'unsupported public claim', candidate => { candidate.routes[2].subject = 'Played by millions of players'; });
rejected('external authorization', 'authority outreachAuthorized', candidate => { candidate.authority.outreachAuthorized = true; });
rejected('copied human handoff drift', 'human handoff drifted', candidate => { candidate.routes[0].body += '\nExtra claim.'; });

assert.strictEqual(cases, 16);
console.log('Editorial discovery safeguards passed (16 cases).');
