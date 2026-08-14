#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { validateRegister } = require('./family-play-observation-lib.cjs');

const root = path.resolve(__dirname, '../..');
const registerPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(root, 'docs/company/customer/family-play-observations.json');

let register;
try {
    register = JSON.parse(fs.readFileSync(registerPath, 'utf8'));
} catch (error) {
    console.error(`Family play observation register could not be read: ${error.message}`);
    process.exit(1);
}

const failures = validateRegister(register);
console.log(JSON.stringify({
    mode: 'internal adult-recorded family play observation assurance',
    registerValid: failures.length === 0,
    observationCount: Array.isArray(register.observations) ? register.observations.length : 0,
    customerEvidenceCount: 0,
    publicIntakeAuthorized: false,
    directMinorContactAuthorized: false,
    publicationAuthorized: false,
    failures,
    nextGate: 'Kevin may record an adult-written, de-identified product observation. Public feedback remains closed.'
}, null, 2));

if (failures.length) process.exit(1);
