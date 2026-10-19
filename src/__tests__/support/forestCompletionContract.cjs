const fs = require('node:fs'), path = require('node:path'), { parse } = require('@babel/parser');
const read = file => fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');

// Follow the extracted caller, not a missing old call or concatenated strings.
function expectForestCompletionConnection() {
    const level = read('scenes/levels/MythicalForestLevel.js');
    const adapter = read('scenes/controllers/ForestCompletionTransaction.js');
    const controller = read('scenes/controllers/LevelCompletionTransaction.js');
    const cls = parse(level, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
    const method = cls.body.body.find(node => node.key?.name === 'showBossVictory');
    expect(level.slice(method.body.start, method.body.end).trim()).toBe('{\n        return finishForestCompletion(this);\n    }');
    expect(level).toContain("import { createForestCompletionHandler } from '../controllers/ForestCompletionTransaction.js'");
    expect(level).toContain('const finishForestCompletion = createForestCompletionHandler(Object.freeze({');
    expect(level).toContain('prototype: MythicalForestLevel.prototype');
    expect(level).toContain("'showRegionalVictorySummary'");
    expect(level).not.toContain('this.completeLevelProgression({');
    expect(adapter).toContain("return createLevelCompletionHandler(blueprint, 'mythicalForest')");
    expect(controller).toContain('calculateLevelCompletionDraft(root,');
    expect(controller).toContain("levelId: 'mythicalForest', sceneLevelId: 'mythical_forest_1', guardianId: 'elder_treant'");
    expect(controller).toContain("shipPartId: 'forest_core', speedrunThreshold: 240000, rewardBonusField: 'starFragmentsCollected'");
    expect(controller).toContain('guardianRestoredAfter: !profile.guardianBefore');
    expect(completionProfiles(controller).mythicalForest.guardianBefore).not.toBe(true);
    expect(controller).toContain('state.commitHatchSaveDraft(draft.state,');
    expect(controller).toContain("attempt.verified = true; attempt.phase = 'committed';");
    expect(controller).toContain('if (!presentationCurrent())');
    expect(controller).toContain('blueprint.methods.showRegionalVictorySummary.call(scene)');
    return controller;
}
function expectPeaksCompletionConnection() {
    const level = read('scenes/levels/VoidPeaksLevel.js'), adapter = read('scenes/controllers/PeaksCompletionTransaction.js');
    const controller = read('scenes/controllers/LevelCompletionTransaction.js');
    expect(level).toContain("import { createPeaksCompletionHandler } from '../controllers/PeaksCompletionTransaction.js'");
    expect(level).toContain('const finishPeaksCompletion = createPeaksCompletionHandler(Object.freeze({');
    expect(level).toContain('prototype: VoidPeaksLevel.prototype');
    expect(level).toContain('return finishPeaksCompletion(this);');
    expect(level).toContain('return finishPeaksCompletion.present(this);');
    expect(level).not.toContain('this.completeLevelProgression({');
    expect(level).not.toMatch(/recordEvent(?:\?\.)?\('guardian_restored'/);
    expect(adapter).toContain("return createLevelCompletionHandler(blueprint, 'voidPeaks')");
    expect(controller).toContain("levelId: 'voidPeaks', sceneLevelId: 'void_peaks_1', guardianId: 'cosmic_titan'");
    expect(controller).toContain("shipPartId: 'hull_plating', speedrunThreshold: 180000, rewardBonusField: null");
    expect(controller).toContain("afterCommit: 'startSavedPeakVictory'");
    expect(controller).toContain('guardianRestoredAfter: !profile.guardianBefore');
    expect(completionProfiles(controller).voidPeaks.guardianBefore).not.toBe(true);
    expect(controller).toContain('state.commitHatchSaveDraft(draft.state,');
    expect(controller.indexOf("attempt.verified = true; attempt.phase = 'committed';")).toBeLessThan(controller.indexOf('blueprint.methods[profile.afterCommit].call'));
    expect(controller).toContain('blueprint.methods.showRegionalVictorySummary.call(scene)');
    return controller;
}
function completionProfiles(source) {
    const declaration = parse(source, { sourceType: 'module' }).program.body.find(node =>
        node.type === 'VariableDeclaration' && node.declarations[0]?.id?.name === 'profiles');
    return require('node:vm').runInNewContext(source.slice(declaration.start, declaration.end) + '\nprofiles');
}
function expectCrystalCompletionConnection() {
    const level = read('scenes/levels/CrystalCavesLevel.js'), adapter = read('scenes/controllers/CrystalCompletionTransaction.js');
    const controller = read('scenes/controllers/LevelCompletionTransaction.js'), sequence = read('scenes/controllers/CrystalVictorySequence.js');
    expect(level).toContain("import { createCrystalCompletionHandler } from '../controllers/CrystalCompletionTransaction.js'");
    expect(level).toContain('const finishCrystalCompletion = createCrystalCompletionHandler(Object.freeze({');
    expect(level).toContain('prototype: CrystalCavesLevel.prototype');
    expect(level).toContain('return finishCrystalCompletion(this);');
    expect(level).toContain('return finishCrystalCompletion.present(this);');
    expect(level).not.toContain('this.completeLevelProgression({');
    expect(level).not.toMatch(/recordEvent(?:\?\.)?\('guardian_restored'/);
    expect(adapter).toContain("return createLevelCompletionHandler(blueprint, 'crystalCaves')");
    expect(completionProfiles(controller).crystalCaves).toMatchObject({ levelId: 'crystalCaves', sceneLevelId: 'crystal_caves_1',
        guardianId: 'crystal_golem', shipPartId: 'crystal_core', katanaUpgradeId: 'crystal_edge', speedrunThreshold: 180000,
        rewardBonusField: 'starFragmentsCollected', guardianBefore: true, afterCommit: 'startSavedCrystalCompletion' });
    expect(controller).toContain('guardianRestoredBefore: Boolean(profile.guardianBefore)');
    expect(controller).toContain('guardianRestoredAt: profile.guardianBefore ? scene.completionGuardianAt : null');
    expect(controller).toContain('state.commitHatchSaveDraft(draft.state,');
    expect(controller.indexOf("attempt.verified = true; attempt.phase = 'committed';")).toBeLessThan(controller.indexOf('blueprint.methods[profile.afterCommit].call'));
    expect(controller).toContain('blueprint.methods.showRegionalVictorySummary.call(scene)');
    expect(sequence).toContain("this.later('message', 2000,");
    expect(sequence).toContain("this.later('completion', 3000,");
    expect(sequence).toContain("this.later('rewards', 1500,");
    return controller;
}
function expectReefCompletionConnection() {
    const level = read('scenes/levels/ReefLevel.js'), adapter = read('scenes/controllers/ReefCompletionTransaction.js');
    const controller = read('scenes/controllers/LevelCompletionTransaction.js'), sequence = read('scenes/controllers/ReefVictorySequence.js');
    expect(level).toContain("import { createReefCompletionHandler } from '../controllers/ReefCompletionTransaction.js'");
    expect(level).toContain('const finishReefCompletion = createReefCompletionHandler(Object.freeze({');
    expect(level).toContain('prototype: ReefLevel.prototype');
    expect(level).toContain('return finishReefCompletion(this);');
    expect(level).toContain('return finishReefCompletion.present(this);');
    expect(level).not.toContain('this.completeLevelProgression({');
    expect(level).not.toMatch(/recordEvent(?:\?\.)?\('guardian_restored'/);
    expect(adapter).toContain("return createLevelCompletionHandler(blueprint, 'cosmicReef')");
    expect(completionProfiles(controller).cosmicReef).toMatchObject({ levelId: 'cosmicReef', sceneLevelId: 'reef_1', guardianId: 'nyxvoral',
        shipPartId: 'dimensional_drive', speedrunThreshold: 240000, rewardBonusField: null, physicsActor: 'bossBody', cosmeticBoss: true,
        guardianBefore: true, afterCommit: 'startSavedReefCompletion', presentAfterCommit: true, requireAfterCommit: true });
    expect(controller).toContain('guardianRestoredAt: profile.guardianBefore ? scene.completionGuardianAt : null');
    expect(controller).toContain('state.commitHatchSaveDraft(draft.state,');
    expect(controller.indexOf("attempt.verified = true; attempt.phase = 'committed';")).toBeLessThan(controller.indexOf('blueprint.methods[profile.afterCommit].call'));
    expect(controller).toContain('blueprint.methods.showRegionalVictorySummary.call(scene)');
    expect(sequence).toContain('this.later(2600, () => this.finish())');
    expect(sequence).toContain('this.later(2200, () => this.releaseVisuals())');
    expect(sequence.indexOf('if (!this.artDestructionAttempted) this.releaseVisuals();')).toBeLessThan(sequence.indexOf("this.phase = 'completing'"));
    return controller;
}
function expectAuroraCompletionConnection() {
    const level = read('scenes/levels/AuroraDepthsLevel.js'), adapter = read('scenes/controllers/AuroraCompletionTransaction.js');
    const controller = read('scenes/controllers/LevelCompletionTransaction.js'), sequence = read('scenes/controllers/AuroraVictorySequence.js');
    expect(level).toContain("import { createAuroraCompletionHandler } from '../controllers/AuroraCompletionTransaction.js'");
    expect(level).toContain('const finishAuroraCompletion = createAuroraCompletionHandler(Object.freeze({');
    expect(level).toContain('prototype: AuroraDepthsLevel.prototype');
    expect(level).toContain('return finishAuroraCompletion(this);');
    expect(level).toContain('return finishAuroraCompletion.present(this);');
    expect(level).not.toContain('this.completeLevelProgression({');
    expect(level).not.toMatch(/recordEvent(?:\?\.)?\('guardian_restored'/);
    expect(adapter).toContain("return createLevelCompletionHandler(blueprint, 'auroraDepths')");
    expect(completionProfiles(controller).auroraDepths).toMatchObject({ levelId: 'auroraDepths', sceneLevelId: 'aurora_depths_1',
        guardianId: 'shadow_phoenix', shipPartId: 'aurora_reactor', katanaUpgradeId: 'aurora_guard', speedrunThreshold: 300000,
        rewardBonusField: null, physicsActor: 'bossBody', cosmeticBoss: true, afterCommit: 'startSavedAuroraCompletion', requireAfterCommit: true });
    expect(completionProfiles(controller).auroraDepths.guardianBefore).not.toBe(true);
    expect(controller).toContain('guardianRestoredAfter: !profile.guardianBefore');
    expect(controller).toContain('state.commitHatchSaveDraft(draft.state,');
    expect(controller.indexOf("attempt.verified = true; attempt.phase = 'committed';")).toBeLessThan(controller.indexOf('blueprint.methods[profile.afterCommit].call'));
    expect(controller).toContain('blueprint.methods.showRegionalVictorySummary.call(scene)');
    expect(sequence).toContain('this.later(1800, () => this.finish())');
    expect(sequence).toContain('this.later(3000, () => this.finishSaved())');
    expect(sequence).toContain('this.savedUnavailable?.()');
    return controller;
}
module.exports = { expectForestCompletionConnection, expectPeaksCompletionConnection, expectCrystalCompletionConnection, expectReefCompletionConnection, expectAuroraCompletionConnection };
