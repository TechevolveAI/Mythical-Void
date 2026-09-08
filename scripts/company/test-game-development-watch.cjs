#!/usr/bin/env node

const assert = require('assert');
const path = require('path');
const {
    classifyChangedFiles,
    isPlayerVisiblePath,
    isPortalPath,
    parseArguments,
    repositoryIdentity,
    resolveWatchAction
} = require('./watch-game-development.cjs');

let cases = 0;
function check(name, fn) {
    fn();
    cases += 1;
}

check('no change stays quiet', () => assert.strictEqual(classifyChangedFiles([]).action, 'no_change'));
check('game scene requests private visual review', () => assert.strictEqual(classifyChangedFiles(['src/scenes/GameScene.js']).action, 'prepare_private_visual_review'));
check('website copy requests private visual review', () => assert.strictEqual(classifyChangedFiles(['public/parents/index.html']).action, 'prepare_private_visual_review'));
check('game artwork requests private visual review', () => assert.strictEqual(classifyChangedFiles(['public/game/levels/forest.webp']).action, 'prepare_private_visual_review'));
check('test-only work is recorded without visual capture', () => assert.strictEqual(classifyChangedFiles(['src/__tests__/Example.test.js']).action, 'record_private_change'));
check('portal-only work requests remeasurement', () => assert.strictEqual(classifyChangedFiles(['docs/company/growth/poki-candidate-measurement.json']).action, 'remeasure_portal'));
check('game and portal work require both private actions', () => assert.strictEqual(classifyChangedFiles(['src/scenes/GameScene.js', 'scripts/company/build-itch-package.cjs']).action, 'prepare_private_visual_review_and_remeasure_portal'));
check('classification removes duplicate paths', () => assert.deepStrictEqual(classifyChangedFiles(['src/main.js', 'src/main.js']).changedFiles, ['src/main.js']));
check('path helpers are conservative and exact', () => {
    assert.strictEqual(isPlayerVisiblePath('src/scenes/levels/ReefLevel.js'), true);
    assert.strictEqual(isPlayerVisiblePath('docs/company/README.md'), false);
    assert.strictEqual(isPortalPath('scripts/company/validate-youtube-playables-readiness.cjs'), true);
});
check('arguments remain explicit and local', () => {
    const parsed = parseArguments(['--repository', '.', '--baseline', 'abc', '--candidate', 'def', '--output', 'report.json']);
    assert.strictEqual(parsed.baseline, 'abc');
    assert.strictEqual(parsed.candidate, 'def');
    assert.strictEqual(parsed.repository, path.resolve('.'));
    assert.ok(parsed.outputPath.endsWith('report.json'));
});
check('repository record is portable', () => assert.strictEqual(repositoryIdentity(path.resolve(__dirname, '../..')), 'TechevolveAI/Mythical-Void'));
check('a candidate behind or beside production is stopped before review', () => assert.strictEqual(resolveWatchAction('prepare_private_visual_review', false, false), 'rebase_or_rebuild_before_review'));
check('a candidate built on production keeps its normal review action', () => assert.strictEqual(resolveWatchAction('prepare_private_visual_review', true, false), 'prepare_private_visual_review'));
check('matching commits remain a no-change result', () => assert.strictEqual(resolveWatchAction('no_change', true, true), 'no_change'));

console.log(`${cases}/${cases} game-development watch safeguard cases passed`);
