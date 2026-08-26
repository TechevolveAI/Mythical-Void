#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const key = '2d33a591a69d023517107abcaf6b7d52';
const host = 'mythicalvoid.com';
const endpoint = 'https://api.indexnow.org/indexnow';
const submit = process.argv.includes('--submit');

if (process.argv.slice(2).some(argument => argument !== '--submit')) {
    console.error('Usage: node scripts/company/submit-indexnow.cjs [--submit]');
    process.exit(1);
}

const keyPath = path.join(repositoryRoot, 'public', `${key}.txt`);
if (fs.readFileSync(keyPath, 'utf8').trim() !== key) {
    throw new Error('The public IndexNow ownership file does not match the release key.');
}

const sitemap = fs.readFileSync(path.join(repositoryRoot, 'public', 'sitemap.xml'), 'utf8');
const urlList = [...sitemap.matchAll(/<loc>(https:\/\/mythicalvoid\.com\/[^<]*)<\/loc>/g)].map(match => match[1]);
if (urlList.length === 0 || urlList.some(url => new URL(url).host !== host)) {
    throw new Error('The sitemap did not provide a safe list of Mythical Void URLs.');
}

const payload = {
    host,
    key,
    keyLocation: `https://${host}/${key}.txt`,
    urlList
};

if (!submit) {
    console.log(JSON.stringify({ mode: 'dry_run', endpoint, ...payload }, null, 2));
    process.exit(0);
}

(async () => {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload)
    });
    const body = await response.text();
    const accepted = response.status === 200 || response.status === 202;
    console.log(JSON.stringify({
        mode: 'submitted',
        accepted,
        status: response.status,
        urlCount: urlList.length,
        endpoint,
        response: body.slice(0, 500)
    }, null, 2));
    if (!accepted) process.exitCode = 1;
})().catch(error => {
    console.error(`IndexNow submission failed: ${error.message}`);
    process.exitCode = 1;
});
