const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');

const filename = path.join(__dirname, '../../systems/ExpeditionCheckpoints.js');
const source = fs.readFileSync(filename, 'utf8');
const declarations = parse(source, { sourceType: 'module' }).program.body
    .filter(node => ['FunctionDeclaration', 'VariableDeclaration'].includes(node.type));
const checkpointHelpers = vm.runInNewContext(
    declarations.map(node => source.slice(node.start, node.end)).join('\n') +
    '\n;({ getExpeditionCheckpointDefinition, getExpeditionCheckpointResume });',
    {}, { filename }
);

function checkpointFixture(gateId, index = 1, overrides = {}) {
    const definition = checkpointHelpers.getExpeditionCheckpointDefinition(gateId);
    return {
        version: 2,
        sceneKey: definition.sceneKey,
        levelId: definition.levelId,
        checkpointId: definition.checkpoints[index][0],
        checkpointIndex: index,
        x: 500, y: 500, savedAt: 1000,
        routeSignalMask: (1 << (index + 1)) - 1,
        ...overrides
    };
}

module.exports = { checkpointHelpers, checkpointFixture };
