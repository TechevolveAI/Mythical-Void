#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const guidePath = path.join(__dirname, '../../docs/company/growth/WEEKLY_GROWTH_LOOP.md');
const guide = fs.readFileSync(guidePath, 'utf8');
const normalizedGuide = guide.replace(/\s+/g, ' ');

const requiredPhrases = [
    'npm run audit:live-health',
    'npm run watch:game-development',
    'npm run test:game-development-watch',
    'npm run validate:game-development-watch',
    'A person still decides whether it looks good',
    'does not prove that anybody played, enjoyed, returned to or recommended the game',
    'publish a social post or reply',
    'create an account, submit the game to a platform or accept platform terms',
    'spend money or start advertising',
    'describe generated artwork as gameplay',
    'identify Kevin’s son',
    'ignore old-game identification requests',
    'report at most three public links',
    'never reply automatically',
    'without storing usernames, copied comments or private messages'
];

for (const phrase of requiredPhrases) {
    assert.ok(normalizedGuide.includes(phrase), `weekly growth loop is missing: ${phrase}`);
}

assert.ok(!/call(?:s|ed)?\s+(?:page visits|visits)\s+(?:players|plays)/i.test(guide));
assert.ok(!/automatically\s+(?:publish|post|contact|submit|spend)/i.test(guide));

console.log(`${requiredPhrases.length + 2}/${requiredPhrases.length + 2} weekly-growth-loop safeguards passed`);
