#!/usr/bin/env node
// Build the compatible fallback without changing the checked-out release source.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

async function main() {
    const output = path.join(root, '.visual-review/compatible-rollback');
    const overrides = {
        'src/config/final-void-release.json': {...require('../src/config/final-void-release.json'), encounter:'legacy-empress'},
        'src/config/final-void-films.json': {...require('../src/config/final-void-films.json'), enabled:false}
    };
    const { build } = await import('vite');
    await build({ root, build:{outDir:path.join(output,'dist')}, plugins:[{
        name:'compatible-finale-rollback', enforce:'pre',
        load(id) {
            const relative=path.relative(root,id);
            return overrides[relative] ? JSON.stringify(overrides[relative]) : null;
        }
    }] });
    execFileSync(process.execPath,['scripts/company/remove-withdrawn-public-media.cjs',path.join(output,'dist')],{cwd:root});
    const archive=path.join(output,'compatible-rollback.tar.gz');
    execFileSync('tar',['-czf',archive,'-C',path.join(output,'dist'),'.']);
    const bytes=fs.readFileSync(archive);
    const report={source:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
        overrides,archive,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
        deploymentExecuted:false,backendChanged:false};
    fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({source:report.source,archive,sha256:report.sha256}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
