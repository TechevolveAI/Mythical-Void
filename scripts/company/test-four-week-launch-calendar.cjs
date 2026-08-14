#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const validator = path.join(root, 'scripts/company/validate-four-week-launch-calendar.cjs');
const result = spawnSync(process.execPath, [validator], {
    cwd: root,
    encoding: 'utf8'
});

if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
}

process.stdout.write(result.stdout);
