#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createGroundedSupportDraft } = require('./lib/grounded-support-draft.cjs');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--input') {
    console.error('Usage: node scripts/company/draft-support-reply.cjs --input invented-message.json');
    process.exit(1);
}

let input;
let knowledgeBase;
try {
    input = JSON.parse(fs.readFileSync(path.resolve(args[1]), 'utf8'));
    knowledgeBase = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/support/knowledge-base.json'), 'utf8'));
} catch (error) {
    console.error(`Input could not be read: ${error.message}`);
    process.exit(1);
}

console.log(JSON.stringify(createGroundedSupportDraft(input, knowledgeBase), null, 2));
