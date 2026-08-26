#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const validator = path.join(__dirname, 'validate-educator-discovery.cjs');
const source = fs.readFileSync(path.join(root, 'public/educators/index.html'), 'utf8');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-educator-'));

function run(name, page = source) {
    const pagePath = path.join(temp, `${name}.html`);
    fs.writeFileSync(pagePath, page);
    return spawnSync(process.execPath, [validator, pagePath], { cwd: root, encoding: 'utf8' });
}

let checks = 0;
try {
    if (run('valid').status !== 0) throw new Error('valid educator journey was rejected');
    checks += 1;
    for (const [name, replace] of [
        ['missing-account-boundary', page => page.replace('No signup · No student accounts · No contact collection', 'Ready for groups')],
        ['contact-form', page => page.replace('</main>', '<form><input name="student-email"></form></main>')],
        ['tracked-download', page => page.replace('mythical-void-stem-creature-lab.pdf', 'mythical-void-stem-creature-lab.pdf?utm_source=school')],
        ['companion-wording', page => page.replace('creature-design activity', 'AI companion activity')],
        ['uniqueness-promise', page => page.replace('whole new life-form', 'a creature where every creature is unique')],
        ['nasa-endorsement', page => page.replaceAll('NASA does not endorse Mythical Void.', 'NASA endorses Mythical Void.')],
        ['missing-activity-preview-boundary', page => page.replace('THE ACTIVITY YOU WILL USE.', 'SPACE ADVENTURE.')],
        ['missing-short-route', page => page.replace('20-minute signal sprint', 'signal sprint')],
        ['missing-ai-boundary', page => page.replace('Children are not asked to use a generative AI service.', 'Try any generative AI service.')],
        ['invalid-structured-data', page => page.replace('"@type": "LearningResource"', '"@type": LearningResource')]
    ]) {
        if (run(name, replace(source)).status === 0) throw new Error(`${name} was accepted`);
        checks += 1;
    }
    console.log(JSON.stringify({ valid: true, adversarialChecksPassed: checks }, null, 2));
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
