#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const host = process.env.MYTHICAL_VOID_SMOKE_HOST || '127.0.0.1';
const port = Number(process.env.MYTHICAL_VOID_SMOKE_PORT) || 8125;
const baseUrl = `http://${host}:${port}`;
const startupTimeoutMs = 20000;
const configuredProcessCooldownMs = Number(
    process.env.MYTHICAL_VOID_SMOKE_PROCESS_COOLDOWN_MS
);
const processCooldownMs = Number.isFinite(configuredProcessCooldownMs) &&
    configuredProcessCooldownMs >= 0
    ? configuredProcessCooldownMs
    : 750;

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
        let stdout = '';
        const expectedMarker = extraEnv.SMOKE_MODE
            ? `[smoke-result] ${extraEnv.SMOKE_MODE}:${extraEnv.SMOKE_CASE || 'all'}:pass`
            : null;
        const child = spawn(process.execPath, [path.join(projectRoot, script)], {
            cwd: projectRoot,
            env: {
                ...process.env,
                MYTHICAL_VOID_SMOKE_URL: baseUrl,
                ...extraEnv
            },
            stdio: ['ignore', 'pipe', 'pipe']
        });
        child.stdout.on('data', chunk => {
            const text = chunk.toString();
            stdout += text;
            process.stdout.write(text);
        });
        child.stderr.on('data', chunk => {
            process.stderr.write(chunk);
        });
        child.once('error', reject);
        child.once('exit', async (code, signal) => {
            // Chrome can exit before macOS has released its GPU process and
            // WebGL resources. Give the next isolated profile a clean start so
            // frame budgets measure the game instead of process teardown.
            await delay(processCooldownMs);
            if (code === 0 && (!expectedMarker || stdout.includes(expectedMarker))) {
                resolve();
                return;
            }
            if (code === 0 && expectedMarker) {
                reject(new Error(
                    `${script} exited before completion marker ${expectedMarker}`
                ));
                return;
            }
            reject(new Error(
                `${script} failed${signal ? ` with signal ${signal}` : ` with code ${code}`}`
            ));
        });
    });
}

async function runNodeScriptWithRetry(script, extraEnv = {}, attempts = 2) {
    let lastError = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            await runNodeScript(script, extraEnv);
            return;
        } catch (error) {
            lastError = error;
            if (attempt < attempts) {
                console.warn(
                    `[release-smoke] Retrying ${extraEnv.SMOKE_MODE || script}` +
                    ` (${attempt + 1}/${attempts}) after timing-sensitive failure`
                );
                await delay(1000);
            }
        }
    }
    throw lastError;
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
        if (vite.exitCode !== null || vite.signalCode !== null) {
            throw new Error(
                `Release smoke does not own ${baseUrl}; choose a free MYTHICAL_VOID_SMOKE_PORT`
            );
        }

        const failures = [];

        // Run the two-scene Village journey before opening several independent
        // first-session browser profiles. macOS can briefly retain WebGL process
        // resources after sequential Chromium sessions, which can delay the
        // heavier GameScene boot without indicating a gameplay failure.
        console.log('\n[release-smoke] Shop Base Builder mobile UI suite');
        try {
            await runNodeScript('scripts/smoke-secondary-journeys.js', {
                SMOKE_MODE: 'village-ui'
            });
        } catch (error) {
            failures.push(`village-ui: ${error.message}`);
        }
        console.log('\n[release-smoke] Shop Base Builder desktop reload suite');
        try {
            await runNodeScript('scripts/smoke-secondary-journeys.js', {
                SMOKE_MODE: 'village-ui',
                SMOKE_CASE: 'desktop',
                SMOKE_VIEWPORT_WIDTH: '1440',
                SMOKE_VIEWPORT_HEIGHT: '810'
            });
        } catch (error) {
            failures.push(`village-ui:desktop: ${error.message}`);
        }

        console.log('\n[release-smoke] First-session Start-to-egg viewport suite');
        const homeEntryViewports = [
            { smokeCase: 'phone', width: 390, height: 844 },
            { smokeCase: 'mobile-landscape', width: 430, height: 384 },
            { smokeCase: 'wide-touch', width: 860, height: 768 }
        ];
        for (const viewport of homeEntryViewports) {
            try {
                await runNodeScript('scripts/smoke-secondary-journeys.js', {
                    SMOKE_MODE: 'home-entry',
                    SMOKE_CASE: viewport.smokeCase,
                    SMOKE_VIEWPORT_WIDTH: String(viewport.width),
                    SMOKE_VIEWPORT_HEIGHT: String(viewport.height)
                });
            } catch (error) {
                failures.push(`home-entry:${viewport.smokeCase}: ${error.message}`);
            }
        }

        console.log('\n[release-smoke] Living portrait to playable Sanctuary suite');
        try {
            await runNodeScript('scripts/smoke-secondary-journeys.js', {
                SMOKE_MODE: 'first-sanctuary',
                SMOKE_VIEWPORT_WIDTH: '390',
                SMOKE_VIEWPORT_HEIGHT: '844'
            });
        } catch (error) {
            failures.push(`first-sanctuary: ${error.message}`);
        }

        console.log('\n[release-smoke] Genuine interaction suite');
        const interactionCases = [
            'egg',
            'mythicalForest',
            'crystalCaves',
            'reef',
            'voidPeaks',
            'auroraDepths',
            'finalVoid',
            'finalVoidWithCreature'
        ];
        for (const smokeCase of interactionCases) {
            console.log(`[release-smoke] Interaction case: ${smokeCase}`);
            try {
                await runNodeScriptWithRetry('scripts/smoke-secondary-journeys.js', {
                    SMOKE_MODE: 'interaction',
                    SMOKE_CASE: smokeCase
                });
            } catch (error) {
                failures.push(`interaction:${smokeCase}: ${error.message}`);
            }
        }

        console.log('\n[release-smoke] Conservative campaign topology suite');
        try {
            await runNodeScript('scripts/smoke-secondary-journeys.js', {
                SMOKE_MODE: 'traversal-topology'
            });
        } catch (error) {
            failures.push(`traversal-topology: ${error.message}`);
        }

        console.log('\n[release-smoke] Aurora route collision and recovery suite');
        try {
            await runNodeScript('scripts/smoke-secondary-journeys.js', {
                SMOKE_MODE: 'aurora-route-journey'
            });
        } catch (error) {
            failures.push(`aurora-route-journey: ${error.message}`);
        }

        console.log('\n[release-smoke] Fast campaign state-contract suite');
        try {
            await runNodeScript('scripts/smoke-secondary-journeys.js', {
                SMOKE_MODE: 'state-contract'
            });
        } catch (error) {
            failures.push(`state-contract: ${error.message}`);
        }

        console.log('\n[release-smoke] Guardian defeat, debrief, and installation suite');
        const guardianHandoffCases = [
            'mythicalForest',
            'crystalCaves',
            'reef',
            'voidPeaks',
            'auroraDepths',
            'finalVoid'
        ];
        for (const smokeCase of guardianHandoffCases) {
            console.log(`[release-smoke] Guardian handoff case: ${smokeCase}`);
            try {
                await runNodeScript('scripts/smoke-secondary-journeys.js', {
                    SMOKE_MODE: 'guardian-handoff',
                    SMOKE_CASE: smokeCase
                });
            } catch (error) {
                failures.push(`guardian-handoff:${smokeCase}: ${error.message}`);
            }
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

        console.log('\n[release-smoke] Mythical Forest field brief suite');
        try {
            await runNodeScript('scripts/smoke-secondary-journeys.js', {
                SMOKE_MODE: 'forest-arrival'
            });
        } catch (error) {
            failures.push(`forest-arrival: ${error.message}`);
        }

        console.log('\n[release-smoke] Guardian telegraph and recovery suite');
        const guardianCases = [
            'MythicalForestLevel',
            'CrystalCavesLevel',
            'ReefLevel',
            'VoidPeaksLevel',
            'AuroraDepthsLevel',
            'FinalVoidLevel'
        ];
        for (const guardianCase of guardianCases) {
            console.log(`[release-smoke] Guardian case: ${guardianCase}`);
            try {
                await runNodeScriptWithRetry('scripts/smoke-secondary-journeys.js', {
                    SMOKE_MODE: 'guardian-pacing',
                    SMOKE_CASE: guardianCase
                });
            } catch (error) {
                failures.push(`guardian-pacing:${guardianCase}: ${error.message}`);
            }
        }

        if (failures.length) {
            throw new Error(
                `Release smoke failed (${failures.length} case${failures.length === 1 ? '' : 's'}):\n` +
                failures.map(failure => `- ${failure}`).join('\n')
            );
        }
        console.log('\n[release-smoke-result] pass');
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
