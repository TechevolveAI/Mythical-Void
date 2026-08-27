#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const key = '2d33a591a69d023517107abcaf6b7d52';
const host = 'mythicalvoid.com';
const endpoint = 'https://api.indexnow.org/indexnow';
const submit = process.argv.includes('--submit');

function requestedUrlsFromArguments(argumentsList) {
    const requested = [];
    for (let index = 0; index < argumentsList.length; index += 1) {
        const argument = argumentsList[index];
        if (argument === '--submit') continue;
        if (argument !== '--url' || !argumentsList[index + 1]) {
            throw new Error('Usage: node scripts/company/submit-indexnow.cjs [--submit] [--url /changed-page/ ...]');
        }
        requested.push(argumentsList[index + 1]);
        index += 1;
    }
    return requested;
}

function selectCanonicalUrls(sitemapUrls, requestedUrls) {
    if (!requestedUrls.length) return sitemapUrls;
    const known = new Set(sitemapUrls);
    const selected = [];
    for (const requested of requestedUrls) {
        const parsed = new URL(requested, `https://${host}`);
        if (parsed.protocol !== 'https:' || parsed.host !== host || parsed.search || parsed.hash) {
            throw new Error(`IndexNow URL must be a clean owned Mythical Void address: ${requested}`);
        }
        const canonical = parsed.href;
        if (!known.has(canonical)) throw new Error(`IndexNow URL is not in the canonical sitemap: ${canonical}`);
        if (!selected.includes(canonical)) selected.push(canonical);
    }
    return selected;
}

const keyPath = path.join(repositoryRoot, 'public', `${key}.txt`);
if (fs.readFileSync(keyPath, 'utf8').trim() !== key) {
    throw new Error('The public IndexNow ownership file does not match the release key.');
}

const sitemap = fs.readFileSync(path.join(repositoryRoot, 'public', 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>(https:\/\/mythicalvoid\.com\/[^<]*)<\/loc>/g)].map(match => match[1]);
if (sitemapUrls.length === 0 || sitemapUrls.some(url => new URL(url).host !== host)) {
    throw new Error('The sitemap did not provide a safe list of Mythical Void URLs.');
}
const urlList = selectCanonicalUrls(sitemapUrls, requestedUrlsFromArguments(process.argv.slice(2)));

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

module.exports = { requestedUrlsFromArguments, selectCanonicalUrls };
