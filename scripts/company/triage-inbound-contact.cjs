#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { classifyInboundContact } = require('./lib/inbound-contact-triage.cjs');

function usage() {
    console.error('Usage: node scripts/company/triage-inbound-contact.cjs --input message.json');
    process.exit(1);
}

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--input') usage();

let input;
try {
    input = JSON.parse(fs.readFileSync(path.resolve(args[1]), 'utf8'));
} catch (error) {
    console.error(`Input could not be read: ${error.message}`);
    process.exit(1);
}

console.log(JSON.stringify(classifyInboundContact(input), null, 2));
