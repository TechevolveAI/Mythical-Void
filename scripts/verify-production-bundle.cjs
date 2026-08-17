#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const REMOVABLE_CONSOLE_CALL = /\bconsole\.(?:log|info|debug)\s*\(/g;

function inspectProductionBundle(distDir) {
    const assetsDir = path.join(distDir, 'assets');
    if (!fs.existsSync(assetsDir)) {
        throw new Error(`Production assets directory not found: ${assetsDir}`);
    }

    const applicationChunks = fs.readdirSync(assetsDir)
        .filter(fileName => (
            fileName.endsWith('.js') &&
            !fileName.startsWith('vendor-')
        ));

    if (applicationChunks.length === 0) {
        throw new Error(`No production application chunks found in ${assetsDir}`);
    }

    const failures = applicationChunks.flatMap(fileName => {
        const source = fs.readFileSync(path.join(assetsDir, fileName), 'utf8');
        const matches = source.match(REMOVABLE_CONSOLE_CALL) || [];
        return matches.length > 0
            ? [{ fileName, count: matches.length }]
            : [];
    });

    return {
        applicationChunkCount: applicationChunks.length,
        removableConsoleCallCount: failures.reduce(
            (total, failure) => total + failure.count,
            0
        ),
        failures
    };
}

function verifyProductionBundle(distDir = path.resolve(__dirname, '../dist')) {
    const result = inspectProductionBundle(distDir);
    if (result.failures.length > 0) {
        const details = result.failures
            .map(({ fileName, count }) => `${fileName}: ${count}`)
            .join(', ');
        throw new Error(
            `Production bundle retained console.log/info/debug calls (${details})`
        );
    }
    return result;
}

if (require.main === module) {
    try {
        const result = verifyProductionBundle();
        process.stdout.write(`${JSON.stringify({
            valid: true,
            ...result
        })}\n`);
    } catch (error) {
        process.stderr.write(`[production-bundle] ${error.message}\n`);
        process.exitCode = 1;
    }
}

module.exports = {
    REMOVABLE_CONSOLE_CALL,
    inspectProductionBundle,
    verifyProductionBundle
};
