#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const host = process.env.MYTHICAL_VOID_SMOKE_HOST || '127.0.0.1';
const port = Number(process.env.MYTHICAL_VOID_SMOKE_PORT) || 8125;
const baseUrl = `http://${host}:${port}`;
const startupTimeoutMs = 20000;

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer() {
    const startedAt = Date.now();
    let lastError = null;
    while (Date.now() - startedAt < startupTimeoutMs) {
        try {
            const response = await fetch(`${baseUrl}/play/`, { redirect: 'manual' });
            if (response.status >= 200 && response.status < 500) return;
        } catch (error) {
            lastError = error;
        }
        await delay(200);
    }
    throw new Error(
        `Vite did not become ready at ${baseUrl}` +
        (lastError ? `: ${lastError.message}` : '')
    );
}

function runNodeScript(script, extraEnv = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(projectRoot, script)], {
            cwd: projectRoot,
            env: {
                ...process.env,
                MYTHICAL_VOID_SMOKE_URL: baseUrl,
                ...extraEnv
            },
            stdio: 'inherit'
        });
        child.once('error', reject);
        child.once('exit', (code, signal) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(
                `${script} failed${signal ? ` with signal ${signal}` : ` with code ${code}`}`
            ));
        });
    });
}

async function main() {
    const viteBin = path.join(
        path.dirname(require.resolve('vite')),
        'bin/vite.js'
    );
    const vite = spawn(process.execPath, [
        viteBin,
        'preview',
        '--host',
        host,
        '--port',
        String(port),
        '--strictPort'
    ], {
        cwd: projectRoot,
        env: process.env,
        stdio: ['ignore', 'inherit', 'inherit']
    });

    let viteExit = null;
    vite.once('exit', (code, signal) => {
        viteExit = { code, signal };
    });

    try {
        await waitForServer();
        if (viteExit) {
            throw new Error(`Vite exited before smoke execution: ${JSON.stringify(viteExit)}`);
        }

        console.log('\n[release-smoke] Genuine interaction suite');
        const interactionCases = [
            'egg',
            'mythicalForest',
            'crystalCaves',
            'reef',
            'voidPeaks',
            'auroraDepths',
            'finalVoid'
        ];
        const failures = [];
        for (const smokeCase of interactionCases) {
            console.log(`[release-smoke] Interaction case: ${smokeCase}`);
            try {
                await runNodeScript('scripts/smoke-secondary-journeys.js', {
                    SMOKE_MODE: 'interaction',
                    SMOKE_CASE: smokeCase
                });
            } catch (error) {
                failures.push(`interaction:${smokeCase}: ${error.message}`);
            }
        }

        console.log('\n[release-smoke] Fast campaign state-contract suite');
        try {
            await runNodeScript('scripts/smoke-secondary-journeys.js', {
                SMOKE_MODE: 'state-contract'
            });
        } catch (error) {
            failures.push(`state-contract: ${error.message}`);
        }

        console.log('\n[release-smoke] Final priority mobile journey suite');
        try {
            await runNodeScript('scripts/smoke-secondary-journeys.js', {
                SMOKE_MODE: 'final-priority-journey'
            });
        } catch (error) {
            failures.push(`final-priority-journey: ${error.message}`);
        }

        console.log('\n[release-smoke] Save and reload player journey suite');
        try {
            await runNodeScript('scripts/smoke-secondary-journeys.js', {
                SMOKE_MODE: 'save-reload-journey'
            });
        } catch (error) {
            failures.push(`save-reload-journey: ${error.message}`);
        }

        console.log('\n[release-smoke] Sanctuary navigation lifecycle suite');
        try {
            await runNodeScript('scripts/smoke-secondary-journeys.js', {
                SMOKE_MODE: 'navigation-lifecycle'
            });
        } catch (error) {
            failures.push(`navigation-lifecycle: ${error.message}`);
        }

        console.log('\n[release-smoke] Hub-to-Forest transition suite');
        try {
            await runNodeScript('scripts/smoke-secondary-journeys.js', {
                SMOKE_MODE: 'hub-forest-transition'
            });
        } catch (error) {
            failures.push(`hub-forest-transition: ${error.message}`);
        }

        console.log('\n[release-smoke] Shop Base Builder mobile UI suite');
        try {
            await runNodeScript('scripts/smoke-secondary-journeys.js', {
                SMOKE_MODE: 'village-ui'
            });
        } catch (error) {
            failures.push(`village-ui: ${error.message}`);
        }

        console.log('\n[release-smoke] Mythical Forest field brief suite');
        try {
            await runNodeScript('scripts/smoke-secondary-journeys.js', {
                SMOKE_MODE: 'forest-arrival'
            });
        } catch (error) {
            failures.push(`forest-arrival: ${error.message}`);
        }

        if (failures.length) {
            throw new Error(
                `Release smoke failed (${failures.length} case${failures.length === 1 ? '' : 's'}):\n` +
                failures.map(failure => `- ${failure}`).join('\n')
            );
        }
    } finally {
        if (vite.exitCode === null && vite.signalCode === null) {
            vite.kill('SIGTERM');
            await Promise.race([
                new Promise(resolve => vite.once('exit', resolve)),
                delay(1500)
            ]);
        }
        if (vite.exitCode === null && vite.signalCode === null) {
            vite.kill('SIGKILL');
        }
    }
}

main().catch(error => {
    console.error(error.stack || error.message);
    process.exit(1);
});
