#!/usr/bin/env node

const https = require('https');

const API_URL = 'https://api.github.com/repos/TechevolveAI/Mythical-Void';
const EXPECTED = Object.freeze({
    repository: 'TechevolveAI/Mythical-Void',
    publicUrl: 'https://github.com/TechevolveAI/Mythical-Void',
    description: 'Free browser adventure: hatch an alien creature, cross six living realms, and decide what your mission should tell Earth. No download or account.',
    homepage: 'https://mythicalvoid.com/playable-now/',
    topics: [
        'browser-game',
        'creature-game',
        'early-access',
        'family-friendly',
        'free-game',
        'generative-ai',
        'html5-game',
        'indie-game',
        'javascript',
        'phaser',
        'science-fiction',
        'space-game',
        'stem',
        'web-game'
    ]
});

function evaluateGitHubIdentity(repository) {
    const failures = [];
    const topics = Array.isArray(repository?.topics) ? [...repository.topics].sort() : [];
    if (repository?.full_name !== EXPECTED.repository) failures.push('repository identity does not match');
    if (repository?.html_url !== EXPECTED.publicUrl) failures.push('public repository URL does not match');
    if (repository?.description !== EXPECTED.description) failures.push('public description does not match the approved plain-language description');
    if (repository?.homepage !== EXPECTED.homepage) failures.push('public website link does not match');
    if (repository?.private !== false) failures.push('repository is not publicly visible');
    if (repository?.archived !== false || repository?.disabled !== false) failures.push('repository is not active');
    if (JSON.stringify(topics) !== JSON.stringify(EXPECTED.topics)) failures.push('public discovery topics do not match the approved set');
    return failures;
}

function fetchLiveRepository() {
    return new Promise(resolve => {
        const request = https.get(API_URL, {
            headers: {
                Accept: 'application/vnd.github+json',
                'User-Agent': 'Mythical-Void-Public-Identity-Audit/1.0',
                'X-GitHub-Api-Version': '2022-11-28'
            }
        }, response => {
            const chunks = [];
            let bytes = 0;
            response.on('data', chunk => {
                bytes += chunk.length;
                if (bytes <= 512 * 1024) chunks.push(chunk);
            });
            response.on('end', () => {
                if (bytes > 512 * 1024) {
                    resolve({ status: response.statusCode || 0, data: null, error: 'response exceeded 512 KiB' });
                    return;
                }
                try {
                    resolve({ status: response.statusCode || 0, data: JSON.parse(Buffer.concat(chunks).toString('utf8')), error: null });
                } catch (error) {
                    resolve({ status: response.statusCode || 0, data: null, error: `invalid JSON: ${error.message}` });
                }
            });
        });
        request.setTimeout(15000, () => request.destroy(new Error('timeout')));
        request.on('error', error => resolve({ status: 0, data: null, error: error.message }));
    });
}

async function run() {
    const response = await fetchLiveRepository();
    const failures = [];
    if (response.error) failures.push(`GitHub API: ${response.error}`);
    if (response.status !== 200) failures.push(`GitHub API returned HTTP ${response.status}`);
    if (response.data) failures.push(...evaluateGitHubIdentity(response.data));
    const report = {
        checkedAt: new Date().toISOString(),
        valid: failures.length === 0,
        repository: EXPECTED.repository,
        description: response.data?.description || null,
        homepage: response.data?.homepage || null,
        topicCount: Array.isArray(response.data?.topics) ? response.data.topics.length : 0,
        readOnly: true,
        externalMutationPerformed: false,
        indexingClaimed: false,
        visitsClaimed: false,
        playsClaimed: false,
        growthClaimed: false,
        failures
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (failures.length) process.exitCode = 1;
}

if (require.main === module) run().catch(error => {
    console.error(error);
    process.exit(1);
});

module.exports = { API_URL, EXPECTED, evaluateGitHubIdentity, fetchLiveRepository };
