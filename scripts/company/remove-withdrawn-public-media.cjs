#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { readVisualPublicationRegister } = require('./visual-publication-policy.cjs');

const root = path.resolve(__dirname, '../..');
const distRoot = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(root, 'dist');
const register = readVisualPublicationRegister();

function safeTarget(publicPath) {
    const relative = String(publicPath).replace(/^\/+/, '').replace(/\/+$/, '');
    if (!relative) throw new Error(`Refusing an empty withdrawn-media target: ${publicPath}`);
    const target = path.resolve(distRoot, relative);
    const inside = path.relative(distRoot, target);
    if (inside.startsWith('..') || path.isAbsolute(inside)) {
        throw new Error(`Withdrawn-media target escapes the production directory: ${publicPath}`);
    }
    return target;
}

if (!fs.existsSync(distRoot) || !fs.statSync(distRoot).isDirectory()) {
    throw new Error(`Production directory is missing: ${distRoot}`);
}

const removed = [];
for (const prefix of register.withdrawnPathFamilies) {
    const target = safeTarget(prefix);
    if (!fs.existsSync(target)) continue;
    fs.rmSync(target, { recursive: true, force: true });
    removed.push(prefix);
}
for (const publicPath of register.withdrawnIndividualPaths) {
    const target = safeTarget(publicPath);
    if (!fs.existsSync(target)) continue;
    fs.rmSync(target, { force: true });
    removed.push(publicPath);
}

const survivors = [
    ...register.withdrawnPathFamilies,
    ...register.withdrawnIndividualPaths
].filter(publicPath => fs.existsSync(safeTarget(publicPath)));
if (survivors.length) {
    throw new Error(`Withdrawn media survived the production cleanup: ${survivors.join(', ')}`);
}

console.log(JSON.stringify({
    productionPackage: distRoot,
    withdrawnTargetsRemoved: removed.length,
    withdrawnTargetsRemaining: 0
}, null, 2));
