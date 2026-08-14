#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const opportunitiesPath = path.join(root, 'docs/company/distribution/platform-opportunities-2026-08-14.json');
const itchPackPath = path.join(root, 'docs/company/distribution/itch-launch-pack-2026-08-14.json');
const errors = [];

function readJson(file) {
    if (!fs.existsSync(file)) {
        errors.push(`${path.relative(root, file)} is missing`);
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        errors.push(`${path.relative(root, file)} is invalid JSON: ${error.message}`);
        return {};
    }
}

const opportunities = readJson(opportunitiesPath);
const itchPack = readJson(itchPackPath);
const ranking = opportunities.ranking || [];
const expectedOrder = ['owned-search', 'itch', 'imirt', 'crazygames', 'poki'];

if (opportunities.asOf !== '2026-08-14') errors.push('opportunity research date is missing or unexpected');
for (const boundary of ['externalAccountCreationAuthorized', 'externalSubmissionAuthorized', 'spendAuthorized', 'contractAcceptanceAuthorized']) {
    if (opportunities.authority?.[boundary] !== false) errors.push(`${boundary} must remain false`);
}
if (ranking.map(item => item.id).join(',') !== expectedOrder.join(',')) errors.push('platform ranking has changed without review');

for (const item of ranking) {
    if (!Number.isInteger(item.rank)) errors.push(`${item.id}: integer rank missing`);
    if (!item.whyNow || !item.nextAction) errors.push(`${item.id}: decision explanation is incomplete`);
    if (!(item.sources || []).length) errors.push(`${item.id}: sources missing`);
    for (const source of item.sources || []) {
        if (!source.startsWith('https://')) errors.push(`${item.id}: source must use HTTPS: ${source}`);
    }
    if (/\b(?:guaranteed|millions of players|viral|best platform)\b/i.test(JSON.stringify(item))) {
        errors.push(`${item.id}: contains an unsupported reach or certainty claim`);
    }
}

const itch = ranking.find(item => item.id === 'itch');
if (!itch?.gates?.some(gate => /portable/i.test(gate))) errors.push('itch: portable-build gate missing');
if (!itch?.gates?.some(gate => /Kevin/i.test(gate))) errors.push('itch: Kevin publication gate missing');

const imirt = ranking.find(item => item.id === 'imirt');
if (!/EUR 100/.test(imirt?.cost || '')) errors.push('Imirt: current EUR 100 decision is missing');
if (!imirt?.gates?.some(gate => /spend/i.test(gate))) errors.push('Imirt: spend gate missing');

const crazygames = ranking.find(item => item.id === 'crazygames');
if (!crazygames?.gates?.some(gate => /targeted for kids/i.test(gate))) errors.push('CrazyGames: child-targeting fit risk missing');
if (!crazygames?.gates?.some(gate => /PEGI 12/i.test(gate))) errors.push('CrazyGames: PEGI 12 review missing');

const poki = ranking.find(item => item.id === 'poki');
if (!poki?.gates?.some(gate => /8 MB/i.test(gate))) errors.push('Poki: published total-size guidance missing');

if (itchPack.state !== 'internal_draft_not_submitted') errors.push('itch pack must remain an internal, unsubmitted draft');
for (const boundary of ['accountCreationAuthorized', 'publicationAuthorized', 'paymentsEnabled', 'donationsEnabled']) {
    if (itchPack.authority?.[boundary] !== false) errors.push(`itch pack: ${boundary} must remain false`);
}
if ((itchPack.media?.screenshots || []).length < 3 || (itchPack.media?.screenshots || []).length > 5) {
    errors.push('itch pack: use three to five real gameplay screenshots');
}
for (const screenshot of itchPack.media?.screenshots || []) {
    if (!fs.existsSync(path.join(root, screenshot))) errors.push(`itch pack: missing screenshot ${screenshot}`);
}
if (!fs.existsSync(path.join(root, itchPack.media?.gameplayVideo || ''))) errors.push('itch pack: gameplay video is missing');

const combinedCopy = JSON.stringify({ opportunities, itchPack });
if (/no two (?:creatures|companions) alike|every creature is unique|infinite unique creatures/i.test(combinedCopy)) {
    errors.push('distribution copy contains an unsupported uniqueness promise');
}
if (/official NASA|NASA partner|NASA-approved/i.test(combinedCopy)) errors.push('distribution copy implies a NASA relationship');

if (errors.length) {
    console.error('Browser distribution plan is not ready:\n');
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log(JSON.stringify({
    valid: true,
    rankedOpportunities: expectedOrder,
    externalAccountsCreated: 0,
    externalSubmissionsMade: 0,
    spendAuthorized: false,
    itchScreenshotsPrepared: itchPack.media.screenshots.length,
    gameplayVideoPrepared: true
}, null, 2));
