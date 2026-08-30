#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const netlifyConfig = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
const functionsDir = path.join(root, 'netlify', 'functions');
const declared = new Set([
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.optionalDependencies || {})
]);
const externalMatch = netlifyConfig.match(/external_node_modules\s*=\s*\[([^\]]*)\]/s);
const external = new Set(
    (externalMatch?.[1].match(/["']([^"']+)["']/g) || [])
        .map(value => value.slice(1, -1))
);
const imports = new Map();

function packageName(specifier) {
    if (specifier.startsWith('node:')) return null;
    if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/');
    return specifier.split('/')[0];
}

for (const filename of fs.readdirSync(functionsDir).filter(name => name.endsWith('.mjs'))) {
    const source = fs.readFileSync(path.join(functionsDir, filename), 'utf8');
    const pattern = /(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g;
    for (const match of source.matchAll(pattern)) {
        const dependency = packageName(match[1]);
        if (!dependency || match[1].startsWith('.') || match[1].startsWith('/')) continue;
        if (!imports.has(dependency)) imports.set(dependency, new Set());
        imports.get(dependency).add(filename);
    }
}

const failures = [];
for (const [dependency, files] of imports) {
    if (!declared.has(dependency)) {
        failures.push(`${dependency} is imported by ${[...files].join(', ')} but is not a production dependency`);
    }
    if (!external.has(dependency)) {
        failures.push(`${dependency} is imported by ${[...files].join(', ')} but is absent from Netlify external_node_modules`);
    }
}

if (failures.length) {
    console.error('[function-runtime] FAIL');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(`[function-runtime] PASS (${imports.size} server dependencies protected)`);
