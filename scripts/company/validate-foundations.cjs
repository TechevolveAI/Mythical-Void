#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const failures = [];

function read(relativePath) {
    const absolutePath = path.join(repositoryRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
        failures.push(`Missing ${relativePath}`);
        return '';
    }
    return fs.readFileSync(absolutePath, 'utf8');
}

function requireMatch(content, pattern, message) {
    if (!pattern.test(content)) failures.push(message);
}

const index = read('index.html');
const jsonLdMatch = index.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
);

if (!jsonLdMatch) {
    failures.push('Missing VideoGame JSON-LD in index.html');
} else {
    try {
        const structuredData = JSON.parse(jsonLdMatch[1]);
        if (structuredData['@type'] !== 'VideoGame') {
            failures.push('Structured data @type must be VideoGame');
        }
        if (structuredData.url !== 'https://mythicalvoid.com/') {
            failures.push('Structured data must use the canonical production URL');
        }
    } catch (error) {
        failures.push(`Invalid JSON-LD: ${error.message}`);
    }
}

const robots = read('public/robots.txt');
requireMatch(
    robots,
    /^Sitemap: https:\/\/mythicalvoid\.com\/sitemap\.xml$/m,
    'robots.txt must publish the canonical sitemap URL'
);

const sitemap = read('public/sitemap.xml');
requireMatch(
    sitemap,
    /<loc>https:\/\/mythicalvoid\.com\/<\/loc>/,
    'sitemap.xml must contain the canonical storefront URL'
);
requireMatch(
    sitemap,
    /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/,
    'sitemap.xml must use the sitemap protocol namespace'
);

const llms = read('public/llms.txt');
requireMatch(
    llms,
    /^# Mythical Void$/m,
    'llms.txt must identify Mythical Void'
);
requireMatch(
    llms,
    /Privacy and safety: https:\/\/mythicalvoid\.com\/privacy\//,
    'llms.txt must link to privacy and safety information'
);

const storefront = read('src/site/storefront.js');
requireMatch(
    storefront,
    /For a young designer, a parent or guardian must send the idea\./,
    'Community submission copy must require parent/guardian mediation'
);
requireMatch(
    storefront,
    /do not include the child&#39;s|do not include the child's/,
    'Community submission copy must prohibit unnecessary child identifiers'
);

const companyRoot = path.join(repositoryRoot, 'docs', 'company');

function validateDocumentLinks(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            validateDocumentLinks(absolutePath);
            continue;
        }
        if (!entry.name.endsWith('.md')) continue;

        const body = fs.readFileSync(absolutePath, 'utf8');
        for (const match of body.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
            const target = match[1].split('#')[0];
            if (!target || /^(https?:|mailto:)/.test(target)) continue;

            const resolved = path.resolve(path.dirname(absolutePath), target);
            if (!fs.existsSync(resolved)) {
                failures.push(
                    `${path.relative(repositoryRoot, absolutePath)} has broken link ${target}`
                );
            }
        }
    }
}

if (fs.existsSync(companyRoot)) {
    validateDocumentLinks(companyRoot);
} else {
    failures.push('Missing docs/company control plane');
}

const automationRegistry = JSON.parse(
    read('docs/company/automation/registry.json') || '{"workflows":[]}'
);
const allowedAutonomy = new Set(['A0', 'A1', 'A2', 'A3', 'A4']);
const allowedZones = new Set(['Z0', 'Z1', 'Z2', 'Z3']);
const workflowIds = new Set();

if (automationRegistry.schemaVersion !== 1) {
    failures.push('Automation registry schemaVersion must be 1');
}
for (const workflow of automationRegistry.workflows || []) {
    if (!/^A-\d{3}$/.test(workflow.id || '')) {
        failures.push(`Invalid automation ID ${workflow.id || '(missing)'}`);
    }
    if (workflowIds.has(workflow.id)) {
        failures.push(`Duplicate automation ID ${workflow.id}`);
    }
    workflowIds.add(workflow.id);
    if (!allowedAutonomy.has(workflow.autonomy)) {
        failures.push(`${workflow.id} has invalid autonomy ${workflow.autonomy}`);
    }
    if (!(workflow.dataZones || []).every(zone => allowedZones.has(zone))) {
        failures.push(`${workflow.id} has an invalid data zone`);
    }
    if (workflow.externalEffect && !workflow.approval?.required) {
        failures.push(`${workflow.id} has an external effect without required approval`);
    }
    if (workflow.implementation) {
        const implementation = path.join(repositoryRoot, workflow.implementation);
        if (!fs.existsSync(implementation)) {
            failures.push(`${workflow.id} implementation is missing: ${workflow.implementation}`);
        }
    }
    if (!workflow.owner || !workflow.killSwitch || !workflow.purpose) {
        failures.push(`${workflow.id} lacks an owner, purpose, or kill switch`);
    }
}

if (failures.length > 0) {
    console.error('Mythical company foundation validation failed:');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log('Mythical company foundations are valid.');
