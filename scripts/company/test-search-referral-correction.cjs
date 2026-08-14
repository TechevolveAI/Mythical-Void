#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const validator = path.join(__dirname, 'validate-search-referral-correction.cjs');
const source = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/search/TECHEVOLVEAI_MYTHICAL_VOID_CORRECTION_2026-08-14.json'), 'utf8'));
const sourceReadable = fs.readFileSync(path.join(root, 'docs/company/search/TECHEVOLVEAI_MYTHICAL_VOID_CORRECTION_2026-08-14.md'), 'utf8');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-referral-correction-'));

function run(name, correction = source, readable = sourceReadable) {
    const correctionFile = path.join(temp, `${name}.json`);
    const readableFile = path.join(temp, `${name}.md`);
    fs.writeFileSync(correctionFile, `${JSON.stringify(correction, null, 2)}\n`);
    fs.writeFileSync(readableFile, readable);
    return spawnSync(process.execPath, [validator, correctionFile, readableFile], { cwd: root, encoding: 'utf8' });
}

try {
    if (run('valid').status !== 0) throw new Error('Valid search referral correction was rejected.');

    const absolutePromise = structuredClone(source);
    absolutePromise.approvedReplacement.description = 'Every creature is unique and completely unique.';
    if (run('absolute-promise', absolutePromise).status === 0) throw new Error('An absolute uniqueness promise was accepted.');

    const wrongRealmCount = structuredClone(source);
    wrongRealmCount.approvedReplacement.description = wrongRealmCount.approvedReplacement.description.replace('six living realms', 'five cosmic biomes');
    if (run('wrong-realm-count', wrongRealmCount).status === 0) throw new Error('The old five-biome claim was accepted.');

    const published = structuredClone(source);
    published.authority.externalSitePublicationAuthorized = true;
    if (run('published', published).status === 0) throw new Error('Unauthorized external publication was accepted.');

    const recrawl = structuredClone(source);
    recrawl.authority.searchRecrawlAuthorized = true;
    if (run('recrawl', recrawl).status === 0) throw new Error('Unauthorized search recrawl was accepted.');

    const ranking = structuredClone(source);
    ranking.authority.rankingClaimAuthorized = true;
    if (run('ranking', ranking).status === 0) throw new Error('An unsupported ranking claim was accepted.');

    console.log('Search referral correction tests passed: valid replacement plus 5 claim, count, publication, recrawl and ranking mutations checked.');
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
